# TypeUp Windows

TypeUp 是 Windows 桌面端语音输入与 AI 编辑客户端。Electron 壳启动本地 Node server 和内嵌 Python engine，React UI 通过本地 server 控制引擎、展示用量，并接入后端账号、订阅和模型代理。

## 当前架构

```text
React UI
  -> Electron preload
  -> Local Node server (随机 localhost 端口)
  -> TypeUp Backend (默认 http://localhost:8000)
  -> STT / LLM / 支付 / 权益校验

Local Node server
  -> Python engine
  -> typeup_backend provider
  -> TypeUp Backend /v1/stt/transcribe and /v1/llm/chat
```

关键点：

- 前端 UI 不直接保存模型 API Key。
- 用户在 TypeUp 中注册或登录后端账号。
- Electron 本地 server 保存登录态并自动刷新 token。
- 登录态保存在 `%APPDATA%\TypeUp\cloud-bridge.json`。
- Python engine 配置保存在 `%USERPROFILE%\.voice-keyboard\config.yaml`。
- 登录成功后，Electron 会把 engine 的 STT/LLM provider 自动切到 `typeup_backend`。
- 语音识别和 AI 编辑统一走后端代理，并由后端做权益和额度校验。

## 相关项目

后端项目：

```text
C:\Users\Administrator\Desktop\ai_deploy\voice-keyboard-backend
```

前端项目：

```text
C:\Users\Administrator\Desktop\ai_deploy\typeup-win
```

## 本地联调

### 1. 启动后端

```powershell
cd C:\Users\Administrator\Desktop\ai_deploy\voice-keyboard-backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
```

本地前端联调建议在后端 `.env` 中开启：

```env
DEV_MOCK_MODE=false
DEV_MOCK_PAYMENTS=true
DEV_MOCK_MODELS=false
GLM_API_KEY=你的真实 GLM Key
APP_BASE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173
```

启动后端：

```powershell
.venv\Scripts\uvicorn app.main:app --reload
```

检查：

```text
http://localhost:8000/health
http://localhost:8000/docs
```

### 2. 安装并启动前端

```powershell
cd C:\Users\Administrator\Desktop\ai_deploy\typeup-win
npm.cmd install
npm run engine:setup
$env:TYPEUP_BACKEND_URL="http://localhost:8000"
npm run start
```

如果 PowerShell 禁止运行 `npm.ps1`，使用 `npm.cmd`：

```powershell
npm.cmd install
npm.cmd run start
```

### 3. 桌面端操作流程

1. 打开 TypeUp。
2. 在右侧「账号与订阅」面板确认后端地址为 `http://localhost:8000`。
3. 注册或登录账号。
4. 选择套餐并点击购买。
5. `DEV_MOCK_PAYMENTS=true` 时会打开本地支付链接，后端会把订单标记为 `paid`。
6. 点击刷新订单或刷新账号，确认权益为 active。
7. 点击启动本地引擎。
8. 按住 `ALT` 说话，松开后通过后端 STT 代理转写。
9. 按住 `ALT + SPACE` 进行 AI 编辑，通过后端 LLM 代理处理。

## 当前联调状态

当前前端已经接入 `voice-keyboard-backend` 的账号、订阅、权益和模型代理链路：

- React UI 通过 Electron 本地 server 调用后端，不直接保存模型 API Key。
- 已支持注册、登录、刷新 session、退出登录。
- 已支持获取套餐、创建订单、打开 mock 支付链接、刷新订单和权益。
- 登录成功后会自动写入 `%APPDATA%\TypeUp\cloud-bridge.json` 和 `%USERPROFILE%\.voice-keyboard\config.yaml`。
- Python engine 的 STT/LLM provider 会切到 `typeup_backend`，并调用后端 `/v1/stt/transcribe`、`/v1/llm/chat`。
- engine 刷新后端 token 后会把新 token 同步回 `cloud-bridge.json`，避免 UI 和 engine 登录态分叉。
- 后端返回 `401` 或 `403` 时，本地 server 会清空登录态，并同步清掉 Python engine 配置里的 access/refresh token。
- `typeup_backend` 模式下，LLM 会使用后端 token 初始化，因此 `ALT + SPACE` AI 编辑热键会被正确注册和拦截。
- 微润色模式会清理模型偶发返回的 Markdown/标签前缀，例如开头 `#`、`润色结果：`、代码围栏等。
- 未登录时启动 engine 会进入 `needs_config` 状态，提示先登录后端账号。

已知问题和修复记录在 [docs/known-issues.md](docs/known-issues.md)。

已验证通过的本地回归：

```powershell
npm.cmd run build
engine\voice-keyboard\.venv\Scripts\python.exe -m unittest discover -s engine\voice-keyboard\test
engine\voice-keyboard\.venv\Scripts\python.exe -m compileall engine\voice-keyboard\agent engine\voice-keyboard\test
node --check electron\local-server.js
node --check electron\settings-store.js
node --check electron\main.js
node --check electron\preload.js
node --check electron\agent-manager.js
node --check electron\usage-store.js
```

## 前端本地接口

React UI 只请求 Electron 本地 server。Electron 启动后会通过 preload 暴露本地 server 地址：

```js
const apiBase = await window.typeup.apiBase();
```

主要本地接口：

```text
GET  /api/auth/session
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout

GET  /api/billing/plans
POST /api/billing/orders
GET  /api/billing/orders/:orderId

GET  /api/status
POST /api/agent/start
POST /api/agent/stop
POST /api/agent/restart
GET  /api/usage
GET  /api/settings
PUT  /api/settings
```

本地接口会把后端错误保持为统一格式：

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "请先登录",
    "status": 401
  }
}
```

## Engine 后端代理

登录成功后，Electron 会写入类似配置：

```yaml
stt:
  provider: typeup_backend
  api_base_url: http://localhost:8000
  access_token: ...
  refresh_token: ...
  cloud_bridge_path: C:\Users\<User>\AppData\Roaming\TypeUp\cloud-bridge.json
  model: glm-asr-2512
  language: zh

llm:
  provider: typeup_backend
  api_base_url: http://localhost:8000
  access_token: ...
  refresh_token: ...
  cloud_bridge_path: C:\Users\<User>\AppData\Roaming\TypeUp\cloud-bridge.json
  model: glm-4-flash
```

`typeup_backend` provider 会调用：

```text
POST /v1/stt/transcribe
POST /v1/llm/chat
POST /v1/auth/refresh
```

后端 refresh token 是旋转式的。engine 如果刷新 token，会把新 token 同步回 `cloud-bridge.json`，避免 UI 和 engine 登录态分叉。

如果后端返回 `401` 或 `403`，Electron 本地 server 会清空 `cloud-bridge.json` 中的登录态，并把 engine 配置中的 `access_token` / `refresh_token` 清空；用户需要重新登录后端账号。`403` 通常表示账号已被禁用。

## 快捷键

TypeUp 默认 Windows 快捷键：

- `ALT`：按住说话，松开后转写到当前光标。
- `ALT + SPACE`：按住进行 AI 编辑。
- 双击 `ALT`：切换原生/微润色模式。

## 构建

`package.json` 里的脚本直接调用 `node_modules` 中的本地依赖入口，避免 Windows 上 `.bin` 目录缺失时 `vite`、`concurrently` 等命令不可识别。

前端构建：

```powershell
npm.cmd run build
```

Windows 安装包：

```powershell
npm run engine:build
npm run build:win
```

安装包输出到：

```text
release\
```

`engine:build` 会生成：

```text
engine\voice-keyboard\dist\TypeUpAgent\TypeUpAgent.exe
```

Electron 会优先使用这个打包后的 agent，因此安装后的用户不需要本地 Python 运行时。

## 常见问题

### npm install 卡住或 Electron 下载失败

Electron 安装和 `build:win` 需要下载 Electron 二进制。如果看到 `ECONNRESET`，通常是当前网络到 Electron 下载源不稳定。

可先验证前端源码构建：

```powershell
npm.cmd run build
```

等网络恢复后重新执行：

```powershell
npm.cmd install
npm.cmd run build:win
```

### npm run build 找不到 vite

当前脚本已经直接调用 `node_modules/vite/bin/vite.js`。如果仍然失败，说明 `node_modules` 没安装完整，重新执行：

```powershell
npm.cmd install
```

### PowerShell 无法运行 npm.ps1

使用 `npm.cmd`：

```powershell
npm.cmd run build
```

### engine 提示缺少 Python 依赖

执行：

```powershell
npm run engine:setup
```

或进入 engine 目录安装：

```powershell
cd engine\voice-keyboard
python -m pip install -r requirements.txt
```

### 登录成功但 STT/LLM 仍提示未配置

检查：

```text
%APPDATA%\TypeUp\cloud-bridge.json
%USERPROFILE%\.voice-keyboard\config.yaml
```

确认 `stt.provider` 和 `llm.provider` 都是 `typeup_backend`，并且 `access_token` 不为空。也可以在 TypeUp 中退出登录后重新登录。

如果后端账号被禁用，TypeUp 会在刷新 session 时清空登录态；重新登录前 STT/LLM 会进入未配置状态。

### mock 支付打开后订单没有变 paid

确认后端 `.env`：

```env
DEV_MOCK_PAYMENTS=true
APP_BASE_URL=http://localhost:8000
```

然后重启后端。

### 已有 GLM Key，但还没有真实支付宝

这是当前推荐配置：

```env
DEV_MOCK_MODE=false
DEV_MOCK_PAYMENTS=true
DEV_MOCK_MODELS=false
GLM_API_KEY=你的真实 GLM Key
```

这样购买流程走 mock 支付，语音识别和 AI 编辑走真实 GLM。
