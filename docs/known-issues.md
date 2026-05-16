# Known Issues

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
