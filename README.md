# TypeUp Windows

TypeUp 是 Windows 桌面端语音输入与 AI 编辑客户端。Electron 壳启动本地 Node server 和内嵌 Python engine，React UI 通过本地 server 控制引擎、展示用量，并接入后端账号、订阅和模型代理。

仓库职责边界见 [docs/repository-boundaries.md](docs/repository-boundaries.md)。当前仓库负责桌面端 UI、本地 bridge、打包与内嵌 engine 集成；通用语音输入 engine 以上游 `wangqioo/voice-keyboard` 为准，云端账号/支付/模型代理由 `typeup-backend` 负责。内嵌 engine 的同步规则见 [docs/engine-sync.md](docs/engine-sync.md)。

给测试用户分发安装包时，优先发送简洁版说明：[docs/tester-quickstart.md](docs/tester-quickstart.md)。

当前正式版安装包为 `TypeUp-Setup-0.3.13.exe`，默认连接公网后端 `http://150.158.146.192:6053`。本地开发联调时可以通过 `TYPEUP_BACKEND_URL` 覆盖为 `http://localhost:8000`。
`0.1.8` 起桌面端接入 GitHub Releases 自动更新；更旧的测试版需要手动安装一次 `0.1.8` 或更新版本，后续版本才会在软件内提示下载和重启安装。

## 0.3.13 更新重点

- 修复远程更新点击“立即安装并重启”后安装器没有继续安装的问题。
- 静默更新时强制使用当前用户安装目录，避免安装器跑偏或无声退出。
- 增加安装器启动日志，方便排查极少数机器上的安装失败。

## 0.3.12 更新重点

- 这是一个远程更新链路测试版，用于验证 `0.3.11` 之后的自动下载、安装和重启流程。
- 更新说明会显示本次测试版本号，便于确认安装完成后已经进入新版。
- 不改变语音输入、AI 编辑、账号订阅和本地引擎逻辑。

## 0.3.11 更新重点

- 修复下载完成后点击“立即安装并重启”只关闭应用、不继续安装和重启的问题。
- Windows fallback 安装器改用独立的隐藏启动器，应用退出后仍会继续启动 NSIS 安装包。
- 安装启动脚本仍会等待旧 TypeUp 进程退出，再静默安装并触发更新后的自动重启。
- 新增回归测试，确保安装启动链路不再依赖会被 Electron 退出带掉的子进程。

## 0.3.10 更新重点

- Windows 更新器优先读取 `typeup-update.json`，继续保留 `latest.yml` 兼容旧更新源。
- 安装包下载支持 HTTP Range 断点续传、`.part` 临时文件、失败重试和备用下载源。
- 安装前会同时校验安装包大小和 sha256，避免半包或缓存污染进入安装流程。
- 更新进度会区分连接下载源、下载中、校验安装包和安装准备中，避免用户看到 `0%` 却不知道发生了什么。
- 发布脚本改为上传到 release 快照后再切 `current`，并在发布后检查 `latest.yml`、`typeup-update.json`、HEAD、Range `206` 和公网 sha256。

## 0.3.9 更新重点

- Windows 自动更新下载改为优先使用完整安装包直连下载，不再依赖容易卡住的 NSIS 差分下载路径。
- 更新下载器支持当前 HTTP 更新源的直连下载，并保留安装包大小校验，避免 0 字节临时文件进入安装流程。
- AI 编辑快捷键提示统一显示为 `RIGHT ALT + RIGHT SHIFT`，配置页、首页和 Windows 悬浮状态窗保持一致。
- 同步更新快捷键示例和维护文档，避免旧的 `Alt + Space` 文案回到软件里。

## 0.3.8 更新重点

- Prompt 风格会从原始语音里提取实际关注点，不再给项目理解类请求固定补全启动、测试或维护风险。
- 短 Prompt 的结构化结果会保留换行，Windows 下多行文本会强制走剪贴板粘贴，避免被目标输入框压成一行。
- 按住 Alt 使用 Prompt 风格时，悬浮状态窗会显示 Prompt 风格，不再误显示为微润色。
- 配置页输出风格选择器改成更柔和的圆角胶囊选中态，更贴近当前 TypeUp UI。

## 0.3.7 更新重点

- Prompt 风格下会等待本次按住说话结束后，再把整段录音整理成结构化 prompt。
- 修复用户还没说完整段需求时，因为中途停顿触发实时分句，导致提前输出结构化命令的问题。
- 普通微润色仍保留实时分句提前输出，连续听写体验不受影响。
- 新增回归测试，覆盖 Prompt 风格禁用中途分句、微润色保留中途分句两个路径。

## 0.3.6 更新重点

- 配置页新增输出风格切换：微润色、Prompt、正式和简洁，点击风格会立即保存并重启本地引擎。
- Prompt 风格会把口语需求整理成结构化 prompt，项目理解类请求会稳定输出任务、关注点和输出要求。
- 增强 Prompt 输出安全回退，避免 `JSON`、`transcript` 字段或内部处理说明被打进当前应用。
- 长语音转写和文本输入链路更稳，长文本优先使用剪贴板粘贴，减少逐字输入卡顿。
- 开发者栏目里的启动、停止、重启按钮已与首页保持一致。

## 0.3.6-beta.2 更新重点

- 配置页新增输出风格切换：微润色、Prompt、正式和简洁，点击风格会立即保存并重启本地引擎。
- Prompt 风格使用独立整理规则，支持把口语需求整理成结构化 prompt，不再被微润色规则压回普通转写。
- 修复录音 watchdog 初始化异常，避免测试版启动后反复报错。
- 长语音转写和文本输入链路更稳，长文本优先使用剪贴板粘贴，减少逐字输入卡顿。
- 开发者栏目里的启动、停止、重启按钮已与首页保持一致。

## 0.3.6-beta.1 更新重点

- 后端模型调用和 STT 超时时间对长语音更友好，减少长句处理失败。
- 长文本输入改用剪贴板粘贴并自动恢复原剪贴板内容。
- 为输出风格配置预留 engine 入口，方便后续测试不同润色风格。

## 0.3.5 更新重点

- 开发者栏目里的启动、重启和停止按钮增加独立间距，避免按钮挤在一起。
- 麦克风设置区域把当前设备和录入设备选择拆成更清晰的独立卡片。
- 录入设备下拉框的边距、边框和高度统一优化，提升设置页的可读性。

## 0.3.4 更新重点

- 延续 0.3.3 的麦克风设备 JSON 枚举，确保中文设备名和系统默认设备显示正常。
- 设置页保持只展示录入设备选择，调试输出留在开发者栏目。
- 重新打包并发布 Windows 安装包，方便已安装用户通过更新源获取最新优化。

## 0.3.3 更新重点

- 麦克风设备枚举改为结构化 JSON，中文设备名不再因为控制台编码显示成乱码。
- 设置页移除普通用户可见的黑色设备输出窗口，原始日志仍保留在开发者栏目。
- Windows 设备列表会过滤系统包装设备和重复项，优先显示更完整的真实输入设备名称。

## 0.3.2 更新重点

- 主界面品牌文案统一为 TypeUp，首页欢迎语改为“您好，欢迎来到 TypeUp”。
- 订阅计划里的“默认”和“推荐”徽标现在会稳定居中显示在灰色椭圆框内。
- 今日转写字数统计卡改为白色样式，并且总节约时间不再向用户展示内部计算方式。
- 设置页只保留录入设备选择，VAD 和监听模式移动到开发者栏目。
- 麦克风自动选择会优先使用系统默认输入设备，设备列表也会返回结构化信息供界面准确选择。
- Windows 托盘后端显示 TypeUp，并优先使用应用图标资源。

## 0.3.1 更新重点

- 按新的版本规则发布补丁版：后续版本每累计 20 个补丁位进入下一档版本段。
- 修复服务器更新源误指向异常快照后，客户端看到不该出现版本的问题。
- 修复更新说明遇到异常编码内容时显示 `????` 乱码的问题，会自动回退到内置中文说明。
- 账号页右侧连接信息改为规整的信息行，后端地址会自动换行，不再挤乱标题和标签。

## 0.1.40 更新重点

- 顶部栏移除重复的 `检查更新`、运行状态和语言切换入口，减少首屏干扰。
- 中英文切换迁移到配置页面，和快捷键、麦克风、输入方式等设置放在一起管理。
- 首页快捷键说明统一移动到操作项右侧，并更新为“长按 ALT 期间进行转写”“支持精准转录与 AI 润色双模式切换”“下发指令，改写已有内容”。
- 首页新增状态引导提示，启动、停止和重启按钮层级更清楚，用户能更快判断下一步操作。
- 总节约时间改为按 `今日转写字数 ÷ 100 × 60` 秒估算，并在统计卡片中展示计算口径。

## 0.1.39 更新重点

- 融合团队优化版 UI/UX：主界面改为侧边导航工作台，首页、历史、词典、设置、订阅计划、账号、隐私和开发者栏目更清晰。
- 首页保留语音控制台的 `启动`、`停止`、`重启` 按钮，用户打开软件后能直接看到本地引擎控制入口。
- Electron 主窗口改为透明背景，最外侧四个角跟随圆角窗口显示，不再露出直角底色。
- 右上角最小化、最大化和关闭按钮改为标准线形图标，不再显示 `-`、`[]`、`x` 这类奇怪文本符号。

## 0.1.38 更新重点

- Windows 语音控制台快捷键改为 `CTRL + O` 启动、`CTRL + P` 停止。Electron 主进程会注册全局快捷键，所以即使本地 Python engine 已停止，`CTRL + O` 仍能重新启动语音控制台。
- `CTRL + O` 启动时会强制让 engine 以“转写已启用”状态运行；如果 engine 还活着但转写已关闭，会自动重启到可转写状态。
- Windows 默认语音热键改为右侧修饰键专属：按住 `RIGHT ALT` 转写，双击 `RIGHT ALT` 切换原生/微润色模式，按住 `RIGHT ALT + RIGHT SHIFT` 进入 AI 编辑。左侧 `ALT` 不再触发 TypeUp 转写。
- 个人词库、本地纠错学习和相关接口已从当前版本移除，计划第二版重新设计后再加入。
- `npm.cmd run start` 的开发模式默认设置 `TYPEUP_USE_ENGINE_SOURCE=1`，优先运行 `engine/voice-keyboard/agent` 源码，而不是旧的 `dist/TypeUpAgent/TypeUpAgent.exe`。
- 修复 Windows `pynput` 键盘监听回调签名不兼容的问题，避免启动后出现 `TypeError: PushToTalk._on_press() takes 2 positional arguments but 3 were given`。

## 0.1.37 更新重点

- 继续热修 `CTRL + ALT` 启用转写后的键盘卡住问题：切换后会立即清空 TypeUp 内部的 `CTRL` / `ALT` 过滤状态。
- 按住 `CTRL + ALT` 这组开关不松时，不会被误判成 `ALT` 按住录音；释放开关后再按 `ALT` 才开始转写。
- 非吞掉的热键释放事件也会同步给内部状态，避免后续第二次切换或普通按键被误判。
- 新增 Windows 回归测试，覆盖启用后仍按住 `CTRL + ALT` 时空格交给系统、释放后 `ALT` 才进入转写。

## 0.1.36 更新重点

- 热修 `CTRL + ALT` 转写开关：现在它只负责启用或关闭转写功能，不再启动持续录音。
- 配置了 `CTRL + ALT` 开关时，TypeUp 启动后默认不接管 `ALT`；首次按 `CTRL + ALT` 才启用转写。
- 转写功能关闭后，`ALT`、空格和其他键都会正常交给系统和输入法；只有再次按 `CTRL + ALT` 才会重新启用 TypeUp 转写。
- 启用或关闭时会短暂显示状态框：「转写功能已启动」/「转写功能已关闭」。
- 新增 Windows 热键回归测试，覆盖关闭后 `ALT` 不再触发录音、不再被系统级钩子吞掉。

## 0.1.35 更新重点

- Windows 新增切换式转写热键：按一下 `CTRL + ALT` 开始持续转写，再按一下停止录音并把转写结果输入到当前光标。
- 原有热键保持不变：`ALT` 仍然是按住说话、松开转写，`ALT + SPACE` 仍然进入 AI 指令编辑，双击 `ALT` 仍然切换润色模式。
- 首页“此次更新内容”补齐 `0.1.28` 之后的内置更新说明；服务器更新源只提供 `latest.yml`、没有 release notes 正文时，也会显示具体更新点。
- 快捷键展示会读取当前配置并显示 `ALT`、`CTRL + ALT`、`ALT + SPACE` 和双击 `ALT`。

## 0.1.34 更新重点

- Windows 新增切换式转写热键：按一下 `CTRL + ALT` 开始持续转写，再按一下停止录音并把转写结果输入到当前光标。
- 原有热键保持不变：`ALT` 仍然是按住说话、松开转写，`ALT + SPACE` 仍然进入 AI 指令编辑。
- 本地 engine 的 `audio.toggle_key` 支持 `[ctrl, alt]` YAML 写法，也支持 `.env` 中的 `TOGGLE_KEY=ctrl+alt`。
- 快捷键展示会读取当前配置并显示 `ALT`、`CTRL + ALT`、`ALT + SPACE` 和双击 `ALT`。

## 0.1.29 更新重点

- 优化 Windows 自动更新下载体验：优先使用 Node 流式下载显示真实进度，网络超时或连接重置时再回退到 PowerShell 稳定下载。
- 保留安装包大小和 SHA 校验，避免网络波动时误安装不完整文件。
- 保留 `0.1.28` 的单实例窗口修复和窗口显示兜底。

## 0.1.28 更新重点

- 修复源码版或安装版被重复打开时可能出现两个相同 TypeUp 窗口的问题；现在第二次打开会聚焦已有窗口。
- 增加主窗口显示兜底，避免开发环境或慢加载时 Electron 进程已启动但窗口一直不显示。
- 保留 `0.1.27` 的 AI 指令打开应用、显式选区快照和桌面图标修复。

## 0.1.27 更新重点

- 修复 Windows 桌面和开始菜单快捷方式仍显示旧图标的问题。
- 安装器现在会把快捷方式图标直接指向安装目录里的 `uninstallerIcon.ico`，避免继续依赖容易被系统缓存卡住的 `TypeUp.exe,0`。
- 安装完成后会通知 Windows Shell 刷新图标缓存，降低更新后桌面图标不立刻变化的概率。
- AI 指令模式新增本地打开应用动作：按住 `ALT + SPACE` 说“打开微信”“打开谷歌浏览器”等，会优先拉起已有窗口，找不到时再从常见安装目录、PATH 或开始菜单快捷方式启动。
- AI 编辑会在热键录音前后捕获显式选区快照，避免 `ALT + SPACE` 录音流程打断选区后提示“没有可编辑的内容”。
- 显式选区整体润色时，如果模型替换计划里的目标文本没有命中原选区，会在安全条件下回退为整体替换选区，减少“明明选中了却找不到文字”的情况。

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

源码开发模式下，`npm.cmd run start` 会通过 `TYPEUP_USE_ENGINE_SOURCE=1` 让 Electron 启动 `engine\voice-keyboard\.venv\Scripts\python.exe -m agent.main`，因此 Python engine 源码改动会直接生效。只有构建安装包或验证打包产物时才需要运行 `npm.cmd run engine:build` 生成 `dist\TypeUpAgent\TypeUpAgent.exe`。

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
8. 按住 `RIGHT ALT` 说话，松开后通过后端 STT 代理转写。
9. 按 `CTRL + P` 停止语音控制台；按 `CTRL + O` 重新启动并启用转写。
10. 按住 `RIGHT ALT + RIGHT SHIFT` 进行 AI 编辑，通过后端 LLM 代理处理。

### 4. 测试版安装包使用

测试版安装包已经内置公网后端地址，普通测试用户不需要手动填写服务器地址。首次使用时按下面流程即可：

1. 安装并打开 TypeUp。
2. 注册账号，邮箱需要是标准邮箱格式，密码至少 8 位。
3. 注册成功后会自动获得 `free_trial` 免费权益：30 天、600 分钟语音额度、3000 次 AI 请求额度。
4. 点击「启动」启动本地引擎。
5. 按住 `RIGHT ALT` 说话转写；按 `CTRL + P` 停止语音控制台，按 `CTRL + O` 启动语音控制台；按住 `RIGHT ALT + RIGHT SHIFT` 使用 AI 编辑。

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
- `typeup_backend` 模式下，LLM 会使用后端 token 初始化，因此 `RIGHT ALT + RIGHT SHIFT` AI 编辑热键会被正确注册和拦截。
- Windows 默认提供 `CTRL + O` 启动语音控制台、`CTRL + P` 停止语音控制台；这两个快捷键由 Electron 主进程注册，即使 engine 已停止也能重新启动。
- 语音输入会在最终打字前清理 STT/LLM 偶发生成的开头 Markdown/井号标记，例如 `#`、`＃`、`润色结果：`、代码围栏等，避免正文前多出井号。
- Windows 悬浮状态框会在按住 `RIGHT ALT` 说话时根据麦克风音量和 VAD 人声检测驱动右侧语音条跳动，安静时通过平滑衰减回到静止状态。
- Windows 悬浮状态框已改为双缓冲绘制，并禁止音量条刷新时擦除背景，减少透明窗口闪烁；React 底部状态栏也会去重相同状态更新，避免“处理中/就绪”反复重绘。
- 语音控制台的「启动 / 停止」按钮会按本地 engine 状态互斥高亮：运行时启动按钮为蓝色，停止或异常时停止按钮为蓝色，不需要再只看顶部状态标签判断当前状态。
- 本地 server 会把启动日志、凭证同步日志和 STT 结果日志区分开：只有“识别中/解析指令”才进入 `transcribing`，避免启动后误停在“处理中”。
- React UI 的快捷键提示会按当前平台和本地 engine 配置动态显示，避免 Windows 用户看到 macOS 默认的“右 Shift / 右 Option”提示。
- Windows 默认热键配置为 `RIGHT ALT` / `RIGHT ALT + RIGHT SHIFT`，底层使用 `alt_r` 和 `shift_r` 区分左右侧修饰键，避免左侧 `ALT` 误触发转写。
- AI 编辑热键现在进入 Instruction Mode：语音会先经过 STT，再交给本地意图分类和后端 LLM 代理生成可验证的操作，而不是把模型聊天内容当正文输入。
- 普通问答类 AI 回复只显示在状态框，不写入当前输入框；需要写入内容时必须被识别为生成、改写或记忆片段召回。
- 删除类指令采用保守策略：有选区时可删除选区；“清空全文”等明确指令可执行整段删除；没有选区的局部删除不会猜测用户想删哪一段。
- Windows 端当前无法稳定读取所有第三方应用的光标周边文本，因此无选区且无 TypeUp 追踪片段时，会要求用户先选中文本或改用生成输入。
- 已知可继续优化项：原生 Win32 圆角裁剪仍可能在个别屏幕缩放下出现轻微边缘毛刺，后续可改成 per-pixel alpha layered window 继续打磨。
- 未登录时启动 engine 会进入 `needs_config` 状态，提示先登录后端账号。

## 个人词库

个人词库和本地纠错学习功能已从当前版本移除，计划在第二版本重新设计后再加入。当前版本不会写入 `%APPDATA%\TypeUp\engine\corrections.json`，也不会在 STT 后处理或 AI 提示词中使用个人纠正规则。

## AI 编辑与指令模式

`RIGHT ALT + RIGHT SHIFT` 对应 AI 指令模式。它的目标不是聊天，而是把用户说的话变成一个安全、可验证的本地文本操作：

1. 录音结束后，engine 先通过后端 STT 代理获得语音文本。
2. 本地意图分类器判断这是改写、删除、生成、撤销、打开应用、快捷键、记忆片段操作，还是普通问答。
3. 需要改写时，engine 会读取显式选区或最近一次 TypeUp 输入的可追踪片段，调用后端 `/v1/llm/chat` 生成替换计划。
4. 本地 `ReplacementPlan` 校验通过后才执行替换；校验失败时会在状态框提示，不会强行覆盖当前输入框。
5. 普通问答只在状态框显示，避免把“好的，我来帮你修改”这类聊天内容误插入正文。

当前 Windows 版支持的 AI 编辑能力：

- 改写选中文本，例如“把这段改正式一点”“翻译成英文”“缩短一点”。
- 改写刚由 TypeUp 输入的片段，例如刚转写一句后说“润色一下刚才那句”。
- 生成新内容并插入光标位置，例如“写一封请假邮件”。
- 删除选中文本、清空当前可控文本，或执行系统撤销。
- 打开本地应用并切到前台，例如“打开微信”“打开谷歌浏览器”“打开记事本”；常见应用走内置匹配，其它软件会尝试匹配开始菜单快捷方式。
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

本次 `CTRL + O` / `CTRL + P` 语音控制台快捷键最终检查使用：

```powershell
git diff --check
node scripts\test-voice-shortcuts.cjs
node scripts\test-agent-manager-start-transcription.cjs
engine\voice-keyboard\.venv\Scripts\python.exe -m unittest discover -s engine\voice-keyboard\test
engine\voice-keyboard\.venv\Scripts\python.exe -m compileall -q engine\voice-keyboard\agent engine\voice-keyboard\test
node --check electron\settings-store.js
npm.cmd run build
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

- `RIGHT ALT`：按住说话，松开后转写到当前光标。
- `CTRL + O`：启动语音控制台，并启用后台转写。
- `CTRL + P`：停止语音控制台；停止后本地 engine 退出，`RIGHT ALT` 恢复为普通按键。
- `RIGHT ALT + RIGHT SHIFT`：按住进行 AI 编辑。
- 双击 `RIGHT ALT`：切换原生/微润色模式。

macOS 默认快捷键为右 `Shift` 说话、右 `Option` 进行 AI 编辑、双击右 `Shift` 切换润色模式。桌面 UI 会读取当前平台和 `settings.audio.ptt_key` / `settings.audio.enable_key` / `settings.audio.disable_key` / `settings.audio.ai_key` 后再显示提示文案。

按住 `RIGHT ALT` 录音时，Windows 悬浮状态框右侧语音条会随检测到的人声音量动态变化，用于确认麦克风正在采集到说话声。音量条刷新使用平滑衰减和双缓冲绘制，减少闪烁；如果只剩轻微边缘毛刺，属于后续视觉优化项。

## 自动更新

桌面端保留 `electron-updater` 的 `latest.yml` 兼容入口，同时 Windows 打包版会优先读取 TypeUp 自有静态发布目录里的 `typeup-update.json`：`http://150.158.146.192:6052/apps/typeup-win-release/`。用户打开 TypeUp 后会自动静默检查新版；如果发现新版本，界面顶部会提示“已有新版本，请更新”，用户可以在软件内完成断点续传下载，并在下载完成后点击“重启安装”。

注意：只有安装了带自动更新能力的版本后，后续版本才能自动更新。`0.1.8` 是自动更新起点，已经安装更旧版本的测试用户需要手动安装一次 `0.1.8` 或更新版本安装包。当前可分发测试版是 `0.3.5`。

`0.1.19` 起，点击“立即安装并重启”前会把目标版本、Release 标题、Release notes 和发布页链接写入本地用户数据。新版首次启动时，React 主界面会在顶部显示同风格更新说明卡片；同一版本关闭后只记录为已读，不会重复弹出。TypeUp 自有服务器更新源的 `latest.yml` 默认不携带正文，客户端会回退到内置版本说明；每次发版都要同步更新 `BUILTIN_RELEASE_NOTES`，确保首页显示真实更新内容。

当前发布流程会先在本地生成 `typeup-update.json`，其中包含版本、安装包 URL、大小、sha256、发布时间和备用下载地址；然后把 `TypeUp-Setup-<version>.exe`、`.blockmap`、`latest.yml` 和 `typeup-update.json` 上传到服务器的 `releases/<timestamp>-v<version>` 快照目录，校验远端 sha256 后再把 `current` 切换到该快照。公网只读取 `current`，所以发布后必须验证 `latest.yml`、`typeup-update.json`、安装包和 blockmap 的公网 URL。

发布新版时需要：

```powershell
cd C:\Users\Administrator\Desktop\ai_deploy\typeup-win
npm.cmd version <next-version> --no-git-tag-version
npm.cmd run build:win
```

`build:win` 会先自动重建内嵌 Python engine，再构建 React UI 和 NSIS 安装包。然后使用 TypeUp 发布脚本上传 `release\` 目录里的安装包和更新元数据：

```text
TypeUp-Setup-<version>.exe
TypeUp-Setup-<version>.exe.blockmap
latest.yml
typeup-update.json
```

发布脚本入口：

```powershell
$env:TYPEUP_SSH_PASS = "<ssh-password>"
python scripts\publish-typeup-release.py --repo C:\Users\Administrator\Desktop\ai_deploy\typeup-win --version <next-version>
```

发布完成后脚本会自动检查 `latest.yml` 和 `typeup-update.json` 返回新版本，用 `HEAD` 确认安装包和 blockmap 的 `Content-Length`，用 `Range` 请求确认安装包返回 `206`，并重新下载公网安装包做 sha256 校验；任何一步失败都不会提示发布成功。

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
