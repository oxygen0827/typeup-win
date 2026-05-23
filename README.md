# TypeUp Windows

TypeUp 是 Windows 桌面端语音输入与 AI 编辑客户端。Electron 壳启动本地 Node server 和内嵌 Python engine，React UI 通过本地 server 控制引擎、展示用量，并接入后端账号、订阅和模型代理。

仓库职责边界见 [docs/repository-boundaries.md](docs/repository-boundaries.md)。当前仓库负责桌面端 UI、本地 bridge、打包与内嵌 engine 集成；通用语音输入 engine 以上游 `wangqioo/voice-keyboard` 为准，云端账号/支付/模型代理由 `typeup-backend` 负责。内嵌 engine 的同步规则见 [docs/engine-sync.md](docs/engine-sync.md)。

给测试用户分发安装包时，优先发送简洁版说明：[docs/tester-quickstart.md](docs/tester-quickstart.md)。

当前测试版安装包为 `TypeUp-Setup-0.1.26.exe`，默认连接公网后端 `http://150.158.146.192:6053`。本地开发联调时可以通过 `TYPEUP_BACKEND_URL` 覆盖为 `http://localhost:8000`。
`0.1.8` 起桌面端接入 GitHub Releases 自动更新；更旧的测试版需要手动安装一次 `0.1.8` 或更新版本，后续版本才会在软件内提示下载和重启安装。

## 0.1.26 更新重点

- 更新 TypeUp 应用图标、安装器图标、安装器头图和侧栏图，安装版会随包携带运行时图标资源，避免窗口或快捷方式回退到旧图标。
- 左侧功能栏新增“功能介绍”“改进意见”“社区”，测试用户可以在应用内了解主要能力、提交反馈并打开发布记录。
- 参考旧优化版继续打磨桌面 UI：侧边栏、状态栏、语音控制台和卡片间距更接近原生软件界面。
- 修复底部状态栏在窗口拉宽时与上方内容右边界不对齐的问题，状态栏现在会跟随内容区宽度变化。
- 修复 `build:win` 在源码版 `TypeUpAgent.exe` 运行时可能因为文件占用导致 PyInstaller 打包失败的问题。

## 0.1.25 更新重点

- 修复 GitHub 更新检查偶发超时后直接失败的问题，`GitHub request timed out` 现在会被正确识别为可重试网络错误。
- GitHub API 不稳定时，会自动改从 Release 的 `latest.yml` 读取最新版本和安装包地址。
- 更新请求超时时间从 20 秒提高到 45 秒，降低国内网络波动造成的失败概率。

## 0.1.24 更新重点

- 修复微润色把“给我一段话让我测试”这类原话误当成指令执行的问题，不再生成测试样例或说明文字。
- 微润色现在把语音转写作为 JSON transcript 字段传给模型，明确区分待处理文本和指令。
- 增加安全回退：当模型输出“当然可以”“以下是一段测试文本”等非原文内容、过长扩写或过短总结时，自动使用本地保守微润色结果。

## 0.1.23 更新重点

- 修复 Windows 自动更新下载卡住或下载后安装失败的问题：Windows 打包版现在直接读取 GitHub Release，并使用已校验的安装包下载链路。
- 点击“立即安装并重启”后，安装器会等待 TypeUp 主进程退出再启动，减少文件占用导致的安装失败。
- 安装包下载完成后继续校验大小和 SHA256，避免损坏包进入安装流程。

## 0.1.22 更新重点

- 更新横幅里的“下载更新”和“立即安装并重启”改为专用按钮样式，不再复用通用保存按钮样式。
- 鼠标移到“立即安装并重启”上时会保持蓝色文字和蓝色图标，不再出现整块按钮变白、图标消失的问题。
- 保留 `0.1.21` 的更新说明 HTML 标签清洗修复。

## 0.1.21 更新重点

- 修复更新后首次打开的更新说明：当上游返回 HTML 格式 release notes 时，会清洗 `<h2>`、`<ul>`、`<li>` 等标签，不再把奇怪符号展示给用户。
- 修复“立即安装并重启”等蓝色主按钮的 hover 视觉：鼠标移上去后变为白底蓝字/蓝图标，不再出现白色图标消失在白色背景里的问题。
- 保留 `0.1.20` 的微润色输出优化。

## 0.1.20 更新重点

- 优化微润色模式的提示词：明确只做轻量清理，保留原意、语气、数字、专有名词、代码、链接和语言种类。
- 微润色会更专注于去掉口语填充词、重复卡顿、明显错别字和小语序问题，并补齐自然标点。
- 进一步约束模型不要扩写、总结、翻译、升华或改成公文腔，降低“润色过头”的概率。
- 增强润色结果清洗：自动移除“好的，润色如下：”“以下是微润色后的文本：”等模型前缀，避免说明文字被输入到当前应用。
- 发布包版本更新到 `0.1.20`，可从已安装的 `0.1.19` 通过软件内检查更新获取。

## 0.1.19 更新重点

- 新增“更新后首次打开”更新说明：TypeUp 安装新版并重新打开后，主界面顶部会显示本次更新内容。
- 同一版本的更新说明只显示一次，用户关闭后不会反复打扰。
- 更新器会在安装前记录目标版本、Release 标题、更新说明和发布页链接；新版启动后读取并展示。
- 如果是从旧版更新到 `0.1.19`，由于旧版还没有记录能力，客户端会使用内置的 `0.1.19` 更新说明兜底展示。

## 0.1.18 回退说明

- 作废 `0.1.17` 微润色预览框版本，并撤销 `0.1.16` 引入的微润色预览/确认输出改造。
- 微润色模式恢复到 `0.1.15` 的行为：不再弹出额外确认窗口，也不再在状态栏上方显示独立预览框。
- 保留 `0.1.15` 已验证的 Windows 热键修复、底部状态栏对齐、图标尺寸、更新兜底和配置页隐藏 API Key 等改动。
- 由于自动更新不会安装低版本，本次以 `0.1.18` 发布回退包，确保已安装 `0.1.16`/`0.1.17` 的测试用户也能更新到回退后的稳定行为。

## 0.1.15 更新重点

- 配置页不再暴露可编辑的 STT/LLM Provider 与 API Key，统一显示“已接入后台”和“已包含在订阅服务内”，避免用户误填个人模型 Key。
- 保存配置时会强制 STT/LLM 使用 `typeup_backend` 并清空本地 `api_key` 字段；Electron 本地设置层也会再次兜底清理旧 Key。
- 修复部分 Windows 环境检查更新时 GitHub Release 下载链路返回 `ERR_CONNECTION_RESET` 的问题：更新器会在官方 `electron-updater` 失败后自动走 GitHub Releases API 兜底判断最新版本。
- 兜底下载会优先使用系统 PowerShell 网络栈，并校验安装包大小和 GitHub API 返回的 sha256 digest，避免下载链路不稳定时误装损坏文件。
- 修复 Windows `ALT + SPACE` AI 编辑后的热键状态残留：普通空格不再被全局键盘钩子吞掉，只有真正按住 `ALT + SPACE` 时才进入 AI 编辑。
- 底部状态栏已经放入主工作区网格，并按滚动条预留宽度收齐，右边界与上方主内容区视觉对齐。
- Windows 桌面图标和安装器图标资源已重新生成，`ico/png` 各尺寸不再保留透明留白，桌面快捷方式图标会按正常软件大小显示。
- `npm.cmd run build:win` 现在会先自动执行 `engine:build`，确保 Windows 安装包里的 `TypeUpAgent.exe` 一定包含最新 Python engine 代码。
- `scripts/build-engine.ps1` 已对 PyInstaller 等原生命令做退出码检查；引擎打包失败会立刻中断，不会悄悄产出旧引擎安装包。
- 桌面端首页改为软件式模块导航，不再把语音控制、账号订阅、用量趋势、配置和日志全部堆在同一个纵向网页里。
- 左侧模块栏已收窄并优化选中态，整体视觉更接近原生桌面软件。
- 用量趋势页固定工作区高度，趋势图缩小到无需下滑即可看全，外层白色背景板会完整兜住图表。
- 语音控制台进一步降低阴影和背景噪声，底部状态栏、面板间距、滚动条和卡片圆角做了统一打磨。
- “启动 / 停止”按钮会按 engine 状态互斥高亮：运行中高亮启动，停止或异常时高亮停止。
- AI 编辑已迁移 macOS 版的指令模式：`ALT + SPACE` 不再把聊天回复直接打进输入框，而是把语音识别结果分类为改写、删除、生成、撤销、快捷键、记忆片段或普通问答。
- AI 改写优先处理用户显式选中的文字；没有选区时只处理 TypeUp 刚输入并可追踪的片段，避免误改当前应用里其它内容。
- 改写会先生成 `ReplacementPlan` 并在本地校验原文与替换范围；校验失败时不会盲目粘贴，降低误删、错替换风险。
- Windows 热键现在按通用 `ALT` 处理，左右 Alt、系统上报差异和 `WM_SYSKEY*` 的 Alt-down 上下文都会被同一套 `ALT + SPACE` 拦截逻辑覆盖，避免 AI 编辑时 `SPACE` 穿透到前台输入框并提前覆盖选区。
- 新增语音记忆片段能力，可用语音保存、更新、删除和召回常用文本。
- 打包后的 `TypeUpAgent.exe` 增加日志路径兜底，在用户目录权限异常时会退到临时目录写日志，避免启动时只因日志目录不可写而失败。
- 本次发布前已验证 `npm.cmd run build:win`、engine `unittest` 126 项、Python 编译检查和 Electron 语法检查。

## 当前架构

```text
React UI
  -> Electron preload
  -> Local Node server (随机 localhost 端口)
  -> TypeUp Backend (测试版默认 http://150.158.146.192:6053，本地联调用 http://localhost:8000)
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
2. 在左侧模块栏打开「账号」模块，确认后端地址为 `http://localhost:8000`。
3. 注册或登录账号。
4. 选择套餐并点击购买。
5. `DEV_MOCK_PAYMENTS=true` 时会打开本地支付链接，后端会把订单标记为 `paid`。
6. 点击刷新订单或刷新账号，确认权益为 active。
7. 点击启动本地引擎。
8. 按住 `ALT` 说话，松开后通过后端 STT 代理转写。
9. 按住 `ALT + SPACE` 进行 AI 编辑，通过后端 LLM 代理处理。

### 4. 测试版安装包使用

测试版安装包已经内置公网后端地址，普通测试用户不需要手动填写服务器地址。首次使用时按下面流程即可：

1. 安装并打开 TypeUp。
2. 注册账号，邮箱需要是标准邮箱格式，密码至少 8 位。
3. 注册成功后会自动获得 `free_trial` 免费权益：30 天、600 分钟语音额度、3000 次 AI 请求额度。
4. 点击「启动」启动本地引擎。
5. 按住 `ALT` 说话转写，按住 `ALT + SPACE` 使用 AI 编辑。

如果注册时密码少于 8 位，前端会直接提示「注册密码至少 8 位」；后端也会返回「密码至少 8 位」，不会再只显示笼统的「请求参数不正确」。

## 当前联调状态

当前前端已经接入 `voice-keyboard-backend` 的账号、订阅、权益和模型代理链路：

- React UI 通过 Electron 本地 server 调用后端，不直接保存模型 API Key。
- Electron 本地 server 已限制跨源访问，只接受 Electron/file、本机开发端口和无 Origin 的本地调用。
- 已支持注册、登录、刷新 session、退出登录。
- 注册表单会本地校验邮箱和密码长度；注册密码少于 8 位时会给出明确提示。
- 新用户注册成功后，后端会自动发放隐藏的 `free_trial` 权益，额度为 30 天、600 分钟 STT、3000 次 AI 请求。
- 已支持获取套餐、创建订单、打开 mock 支付链接、刷新订单和权益。
- 登录成功后会自动写入 `%APPDATA%\TypeUp\cloud-bridge.json` 和 `%USERPROFILE%\.voice-keyboard\config.yaml`。
- Python engine 的 STT/LLM provider 会切到 `typeup_backend`，并调用后端 `/v1/stt/transcribe`、`/v1/llm/chat`。
- engine 启动、STT/LLM 请求遇到 `401`、以及刷新后端 token 后，都会优先同步 `%APPDATA%\TypeUp\cloud-bridge.json` 和 `%USERPROFILE%\.voice-keyboard\config.yaml`，避免 UI 与 engine 登录态分叉导致“刷新凭证无效”。
- 后端返回 `401` 或 `403` 时，本地 server 会清空登录态，并同步清掉 Python engine 配置里的 access/refresh token。
- `typeup_backend` 模式下，LLM 会使用后端 token 初始化，因此 `ALT + SPACE` AI 编辑热键会被正确注册和拦截。
- 语音输入会在最终打字前清理 STT/LLM 偶发生成的开头 Markdown/井号标记，例如 `#`、`＃`、`润色结果：`、代码围栏等，避免正文前多出井号。
- Windows 悬浮状态框会在按住 `ALT` 说话时根据麦克风音量和 VAD 人声检测驱动右侧语音条跳动，安静时通过平滑衰减回到静止状态。
- Windows 悬浮状态框已改为双缓冲绘制，并禁止音量条刷新时擦除背景，减少透明窗口闪烁；React 底部状态栏也会去重相同状态更新，避免“处理中/就绪”反复重绘。
- 语音控制台的「启动 / 停止」按钮会按本地 engine 状态互斥高亮：运行时启动按钮为蓝色，停止或异常时停止按钮为蓝色，不需要再只看顶部状态标签判断当前状态。
- 本地 server 会把启动日志、凭证同步日志和 STT 结果日志区分开：只有“识别中/解析指令”才进入 `transcribing`，避免启动后误停在“处理中”。
- React UI 的快捷键提示会按当前平台和本地 engine 配置动态显示，避免 Windows 用户看到 macOS 默认的“右 Shift / 右 Option”提示。
- Windows 默认热键配置为通用 `ALT` / `ALT + SPACE`，底层会兼容 `alt_l`、`alt_r` 和通用 `alt` 事件，减少不同键盘布局或应用场景下的热键穿透。
- AI 编辑热键现在进入 Instruction Mode：语音会先经过 STT，再交给本地意图分类和后端 LLM 代理生成可验证的操作，而不是把模型聊天内容当正文输入。
- 普通问答类 AI 回复只显示在状态框，不写入当前输入框；需要写入内容时必须被识别为生成、改写或记忆片段召回。
- 删除类指令采用保守策略：有选区时可删除选区；“清空全文”等明确指令可执行整段删除；没有选区的局部删除不会猜测用户想删哪一段。
- Windows 端当前无法稳定读取所有第三方应用的光标周边文本，因此无选区且无 TypeUp 追踪片段时，会要求用户先选中文本或改用生成输入。
- 已知可继续优化项：原生 Win32 圆角裁剪仍可能在个别屏幕缩放下出现轻微边缘毛刺，后续可改成 per-pixel alpha layered window 继续打磨。
- 未登录时启动 engine 会进入 `needs_config` 状态，提示先登录后端账号。

## AI 编辑与指令模式

`ALT + SPACE` 对应 AI 指令模式。它的目标不是聊天，而是把用户说的话变成一个安全、可验证的本地文本操作：

1. 录音结束后，engine 先通过后端 STT 代理获得语音文本。
2. 本地意图分类器判断这是改写、删除、生成、撤销、快捷键、记忆片段操作，还是普通问答。
3. 需要改写时，engine 会读取显式选区或最近一次 TypeUp 输入的可追踪片段，调用后端 `/v1/llm/chat` 生成替换计划。
4. 本地 `ReplacementPlan` 校验通过后才执行替换；校验失败时会在状态框提示，不会强行覆盖当前输入框。
5. 普通问答只在状态框显示，避免把“好的，我来帮你修改”这类聊天内容误插入正文。

当前 Windows 版支持的 AI 编辑能力：

- 改写选中文本，例如“把这段改正式一点”“翻译成英文”“缩短一点”。
- 改写刚由 TypeUp 输入的片段，例如刚转写一句后说“润色一下刚才那句”。
- 生成新内容并插入光标位置，例如“写一封请假邮件”。
- 删除选中文本、清空当前可控文本，或执行系统撤销。
- 召回、保存、更新、删除常用记忆片段。
- 根据安全策略执行常见快捷键意图；不确定或高风险快捷键会拒绝执行并提示用户。

需要注意：Windows 端暂时不依赖全局读取第三方应用光标上下文。没有显式选区、也没有 TypeUp 最近追踪片段时，AI 不会猜测当前应用里要改哪段文字。

## 正式支付切换说明

当前桌面端购买链路按 `DEV_MOCK_PAYMENTS=true` 联调：用户注册/登录、获取套餐、创建订单、打开 mock 支付链接、刷新权益都已经跑通。

真实支付宝收款不需要改桌面端代码，但需要后端先完成正式支付配置。项目组长需要使用自己的支付宝商家主体开通“电脑网站支付”，并生成自己的 `APPID`、应用私钥、应用公钥和支付宝公钥。后端 `.env` 配好正式 `ALIPAY_APP_ID`、`ALIPAY_PRIVATE_KEY`、`ALIPAY_PUBLIC_KEY`、`ALIPAY_GATEWAY` 和公网 HTTPS `APP_BASE_URL` 后，再把 `DEV_MOCK_PAYMENTS=false`。

注意：桌面端和前端 UI 不接触支付宝应用私钥，也不保存模型服务密钥；用户只拿 TypeUp 后端 token，STT/LLM 和支付状态都由后端统一处理。

已知问题和修复记录在 [docs/known-issues.md](docs/known-issues.md)。

已验证通过的本地回归：

```powershell
npm.cmd run build
npm.cmd run build:win
engine\voice-keyboard\.venv\Scripts\python.exe -m unittest discover -s engine\voice-keyboard\test
engine\voice-keyboard\.venv\Scripts\python.exe -m compileall engine\voice-keyboard\agent engine\voice-keyboard\test
node --check electron\local-server.js
node --check electron\settings-store.js
node --check electron\main.js
node --check electron\preload.js
node --check electron\updater.js
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

macOS 默认快捷键为右 `Shift` 说话、右 `Option` 进行 AI 编辑、双击右 `Shift` 切换润色模式。桌面 UI 会读取当前平台和 `settings.audio.ptt_key` / `settings.audio.ai_key` 后再显示提示文案。

按住 `ALT` 录音时，Windows 悬浮状态框右侧语音条会随检测到的人声音量动态变化，用于确认麦克风正在采集到说话声。音量条刷新使用平滑衰减和双缓冲绘制，减少闪烁；如果只剩轻微边缘毛刺，属于后续视觉优化项。

## 自动更新

桌面端已经接入 `electron-updater`，更新源指向 GitHub Releases：`oxygen0827/typeup-win`。用户打开 TypeUp 后会自动静默检查新版；如果发现新版本，界面顶部会提示“已有新版本，请更新”，用户可以在软件内完成下载，并在下载完成后点击“重启安装”。

注意：只有安装了带自动更新能力的版本后，后续版本才能自动更新。`0.1.8` 是自动更新起点，已经安装更旧版本的测试用户需要手动安装一次 `0.1.8` 或更新版本安装包。当前可分发测试版是 `0.1.26`。

`0.1.19` 起，点击“立即安装并重启”前会把目标版本、Release 标题、Release notes 和发布页链接写入本地用户数据。新版首次启动时，React 主界面会在顶部显示同风格更新说明卡片；同一版本关闭后只记录为已读，不会重复弹出。发布 GitHub Release 时请把用户能看懂的更新内容写进 Release notes，客户端会优先展示这份说明。

后续计划：增加 TypeUp 自有更新下载源，降低国内网络访问 GitHub Release 时的超时和慢速问题。推荐方案是由后端提供 `GET /v1/desktop/releases/latest?platform=win32&arch=x64&current=<version>` 元数据接口，返回最新版本、更新说明、安装包 URL、size 和 sha256；安装包文件放到对象存储/CDN（例如 COS/OSS/R2 或自有 Nginx 静态目录）。客户端优先请求 TypeUp 后端元数据并从 CDN 下载，失败时再 fallback 到 GitHub API / `latest.yml`；无论下载源来自哪里，都必须继续校验 size 和 sha256 后才允许安装。

发布新版时需要：

```powershell
cd C:\Users\Administrator\Desktop\ai_deploy\typeup-win
npm.cmd version <next-version> --no-git-tag-version
npm.cmd run build:win
```

`build:win` 会先自动重建内嵌 Python engine，再构建 React UI 和 NSIS 安装包。然后在 GitHub 创建对应版本的 Release，例如 `v0.1.20`，上传 `release\` 目录里的安装包和更新元数据：

```text
TypeUp-Setup-<version>.exe
TypeUp-Setup-<version>.exe.blockmap
latest.yml
```

如果以后想让构建命令直接发布到 GitHub Releases，可以在本机设置 `GH_TOKEN` 后使用 electron-builder 的 `--publish always`；这个 token 只给发布者本机使用，不能写进代码或安装包。

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

### 注册时提示密码不符合要求

TypeUp 注册密码至少 8 位。测试用户如果使用 6 位密码，会看到「注册密码至少 8 位」或「密码至少 8 位」；改成 8 位以上后重新注册即可。

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
