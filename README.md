# TypeUp Windows

TypeUp 是 Windows 桌面端语音输入与 AI 编辑客户端。Electron 壳启动本地 Node server 和内嵌 Python engine，React UI 通过本地 server 控制引擎、展示用量，并接入后端账号、订阅和模型代理。

仓库职责边界见 [docs/repository-boundaries.md](docs/repository-boundaries.md)。当前仓库负责桌面端 UI、本地 bridge、打包与内嵌 engine 集成；通用语音输入 engine 以上游 `wangqioo/voice-keyboard` 为准，云端账号/支付/模型代理由 `typeup-backend` 负责。

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
npm.cmd run engine:setup
$env:TYPEUP_BACKEND_URL="http://localhost:8000"
npm.cmd run start
```

在 PowerShell 中建议使用 `npm.cmd`。Windows 同时提供 `npm.cmd` 和 `npm.ps1` 两个入口，直接运行 `npm` 时可能命中 `npm.ps1`，被 PowerShell 执行策略拦截；`npm.cmd` 会走 Windows 命令脚本入口，更稳定。

```powershell
npm.cmd install
npm.cmd run engine:setup
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
- Electron 本地 server 已限制跨源访问，只接受 Electron/file、本机开发端口和无 Origin 的本地调用。
- 已支持注册、登录、刷新 session、退出登录。
- 已支持获取套餐、创建订单、打开 mock 支付链接、刷新订单和权益。
- 登录成功后会自动写入 `%APPDATA%\TypeUp\cloud-bridge.json` 和 `%USERPROFILE%\.voice-keyboard\config.yaml`。
- Python engine 的 STT/LLM provider 会切到 `typeup_backend`，并调用后端 `/v1/stt/transcribe`、`/v1/llm/chat`。
- engine 启动、STT/LLM 请求遇到 `401`、以及刷新后端 token 后，都会优先同步 `%APPDATA%\TypeUp\cloud-bridge.json` 和 `%USERPROFILE%\.voice-keyboard\config.yaml`，避免 UI 与 engine 登录态分叉导致“刷新凭证无效”。
- 后端返回 `401` 或 `403` 时，本地 server 会清空登录态，并同步清掉 Python engine 配置里的 access/refresh token。
- `typeup_backend` 模式下，LLM 会使用后端 token 初始化，因此 `ALT + SPACE` AI 编辑热键会被正确注册和拦截。
- 语音输入会在最终打字前清理 STT/LLM 偶发生成的开头 Markdown/井号标记，例如 `#`、`＃`、`润色结果：`、代码围栏等，避免正文前多出井号。
- Windows 悬浮状态框会在按住 `ALT` 说话时根据麦克风音量和 VAD 人声检测驱动右侧语音条跳动，安静时通过平滑衰减回到静止状态。
- Windows 悬浮状态框已改为双缓冲绘制，并禁止音量条刷新时擦除背景，减少透明窗口闪烁；React 底部状态栏也会去重相同状态更新，避免“处理中/就绪”反复重绘。
- 本地 server 会把启动日志、凭证同步日志和 STT 结果日志区分开：只有“识别中/解析指令”才进入 `transcribing`，避免启动后误停在“处理中”。
- 已知可继续优化项：原生 Win32 圆角裁剪仍可能在个别屏幕缩放下出现轻微边缘毛刺，后续可改成 per-pixel alpha layered window 继续打磨。
- 未登录时启动 engine 会进入 `needs_config` 状态，提示先登录后端账号。

## 正式支付切换说明

当前桌面端购买链路按 `DEV_MOCK_PAYMENTS=true` 联调：用户注册/登录、获取套餐、创建订单、打开 mock 支付链接、刷新权益都已经跑通。

真实支付宝收款不需要改桌面端代码，但需要后端先完成正式支付配置。项目组长需要使用自己的支付宝商家主体开通“电脑网站支付”，并生成自己的 `APPID`、应用私钥、应用公钥和支付宝公钥。后端 `.env` 配好正式 `ALIPAY_APP_ID`、`ALIPAY_PRIVATE_KEY`、`ALIPAY_PUBLIC_KEY`、`ALIPAY_GATEWAY` 和公网 HTTPS `APP_BASE_URL` 后，再把 `DEV_MOCK_PAYMENTS=false`。

注意：桌面端和前端 UI 不接触支付宝应用私钥，也不保存模型服务密钥；用户只拿 TypeUp 后端 token，STT/LLM 和支付状态都由后端统一处理。

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

本地 server 仅监听 `127.0.0.1` 随机端口，并对 `Origin` 做白名单校验。允许来源为 Electron/file 页面、本机开发/预览端口 `5173`、`4173`，以及无 `Origin` 的本地调用；其它网页来源会收到 `403 FORBIDDEN_ORIGIN`。

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

后端 refresh token 是旋转式的。engine 启动时会读取 `cloud-bridge.json` 中的最新凭证；STT/LLM 请求遇到 `401` 时，会先从 `cloud-bridge.json` 重新同步一次 access/refresh token 再重试，只有仍失败时才调用 `/v1/auth/refresh`。engine 如果刷新 token，会把新 token 同步回 `cloud-bridge.json`，避免 UI 和 engine 登录态分叉。

如果后端返回 `401` 或 `403`，Electron 本地 server 会清空 `cloud-bridge.json` 中的登录态，并把 engine 配置中的 `access_token` / `refresh_token` 清空；用户需要重新登录后端账号。`403` 通常表示账号已被禁用。

## 快捷键

TypeUp 默认 Windows 快捷键：

- `ALT`：按住说话，松开后转写到当前光标。
- `ALT + SPACE`：按住进行 AI 编辑。
- 双击 `ALT`：切换原生/微润色模式。

按住 `ALT` 录音时，Windows 悬浮状态框右侧语音条会随检测到的人声音量动态变化，用于确认麦克风正在采集到说话声。音量条刷新使用平滑衰减和双缓冲绘制，减少闪烁；如果只剩轻微边缘毛刺，属于后续视觉优化项。

## 构建

`package.json` 里的脚本直接调用 `node_modules` 中的本地依赖入口，避免 Windows 上 `.bin` 目录缺失时 `vite`、`concurrently` 等命令不可识别。

前端构建：

```powershell
npm.cmd run build
```

Windows 安装包：

```powershell
npm.cmd run engine:build
npm.cmd run build:win
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

### npm.cmd run build 找不到 vite

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
npm.cmd run engine:setup
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

如果日志出现 `[stt] 请求失败: 刷新凭证无效`，通常是 `cloud-bridge.json` 已经有新 token，但 engine 配置还留着旧 token。当前版本会在 engine 启动和 401 重试前自动同步两处凭证；仍异常时，先在 TypeUp 里点击刷新账号或退出后重新登录，再重启本地引擎。

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
