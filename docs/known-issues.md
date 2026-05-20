# Known Issues

## 2026-05-20

### 选中文字后按 ALT + SPACE 会先用空格覆盖选区

- 状态：已修复
- 复现：在任意输入框中选中一段文字，按住 `ALT + SPACE` 触发 AI 编辑。
- 现象：AI 处理完成后会输出替换结果，但在说话期间选中的文字会先消失或变成空格。
- 原因：Windows 热键配置和界面文案都显示为 `ALT`，但底层钩子实际可能收到 `alt_l`、`alt_r`、通用 `alt`，或者只在 `SPACE` 的 `WM_SYSKEY*` 事件 flags 中携带 Alt-down 上下文。旧逻辑按字面匹配热键，且没有把这个 Alt 上下文合成进候选组合键，导致某些路径里 `SPACE` 没被完整吞掉，前台输入框会把选区覆盖成空格。
- 修复：`engine/voice-keyboard/agent/push_to_talk.py` 增加修饰键别名匹配，`alt`/`ctrl`/`shift`/`cmd` 可匹配左右键事件；Windows 默认托管配置升级为 `ALT` / `ALT + SPACE` 的通用形式；`win32_event_filter` 会从 `WM_SYSKEY*` 的 Alt-down flags 合成通用 Alt 状态并显式返回 `False` 阻止事件继续传给前台。回归测试已覆盖选区不被 `SPACE` 穿透破坏、合成 Alt 释放、听写延迟启动等路径。

## 2026-05-15

### ALT + SPACE AI 编辑在微信对话框中会输入空格

- 状态：已修复
- 复现：在微信聊天输入框中按住 `ALT + SPACE` 触发 AI 编辑。
- 现象：AI 编辑没有进入录音/处理流程，前台输入框会持续输入空格。
- 原因：桌面端登录后会把 `llm.provider` 切到 `typeup_backend`，但 engine 只在 `llm.api_key` 存在时初始化 LLM。后端代理模式使用 `access_token`，因此 AIHandler 没被创建，`ALT + SPACE` 没注册为 AI 热键，`SPACE` 会穿透到微信输入框。
- 修复：`engine/voice-keyboard/agent/main.py` 现在会在 `typeup_backend` 且存在后端地址和 `access_token` 时启用 LLM/AIHandler，从而注册并拦截 `ALT + SPACE`。

### 切换润色模式时会先输入井号

- 状态：已修复
- 复现：通过双击 `ALT` 切换原文/微润色模式。
- 现象：切换到润色模式后，下一次说话的润色转录结果前面会先出现一个 `#`。
- 原因：微润色走 LLM 后处理，模型偶发返回 Markdown 标题或标签式前缀，例如 `# ...`、`润色结果：...`。
- 修复：`engine/voice-keyboard/agent/main.py` 在微润色输出前增加窄范围清洗，移除 Markdown 代码围栏、开头 `#` 标题、列表符号，以及 `润色后/润色结果/修改后/优化后` 等标签前缀。
