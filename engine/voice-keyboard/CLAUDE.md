# Voice Keyboard — 开发者指南

## 项目概述

语音打字工具。PTT 按住说话 → 讯飞 STT 识别 → 自动打字进当前输入框。
支持纯软件模式（任意麦克风）和 ESP32-S3 硬件模式。

## 平台差异

| 项目 | macOS | Windows |
|------|-------|---------|
| 启动命令 | `cd 项目目录 && SSL_CERT_FILE=$(…) .venv/bin/python -m agent.main --no-serial` | `cd 项目目录 && .venv\Scripts\python -m agent.main --no-serial` |
| 打字 API | Quartz `CGEventKeyboardSetUnicodeString`，绕过 IME | `SendInput + KEYEVENTF_UNICODE` 或剪贴板粘贴 |
| 微信/钉钉 | unicode 模式可用 | 需改 `typing.method: clip`（SendInput 被 Electron 过滤） |
| 热键名称（右 Alt） | `alt_r` | 英文键盘 `alt_r`，中文键盘 `alt_gr` |
| 热键名称（右 Ctrl） | `ctrl_r` | `ctrl_r` |
| 辅助功能授权 | 必须：系统设置 → 隐私与安全性 → 辅助功能 → 添加终端 | 首次运行 UAC 弹窗点"是"即可 |
| SSL 证书 | Python 官方包无系统证书，需手动指定（见下） | 无此问题 |

### macOS SSL 证书问题

Python 官方安装包在 macOS 上不读系统证书，讯飞 WebSocket 握手会报 `CERTIFICATE_VERIFY_FAILED`。

**解决方法**：用 certifi 提供的证书路径启动：

```bash
cd /Users/wq/voice-keyboard
SSL_CERT_FILE=$(.venv/bin/python -c "import certifi; print(certifi.where())") \
  .venv/bin/python -m agent.main --no-serial
```

或者一次性修复 Python 安装（如有 `/Applications/Python 3.x/Install Certificates.command`）：

```bash
/Applications/Python\ 3.x/Install\ Certificates.command
```

修复后可直接用 `.venv/bin/python -m agent.main --no-serial` 启动，无需前缀。

## 启动方式

```bash
# macOS（需指定 SSL 证书，见上方说明）
cd /Users/wq/voice-keyboard
SSL_CERT_FILE=$(.venv/bin/python -c "import certifi; print(certifi.where())") \
  .venv/bin/python -m agent.main --no-serial

# Windows
cd C:\path\to\voice-keyboard
.venv\Scripts\python -m agent.main --no-serial

# 列出可用麦克风
python -m agent.main --list-devices
```

## 核心文件

| 文件 | 职责 |
|------|------|
| `agent/main.py` | 入口，串联所有模块 |
| `agent/push_to_talk.py` | PTT 录音，pynput 键盘监听，双热键（ptt/ai） |
| `agent/ai_handler.py` | Instruction Mode 编排：STT→意图分类→Voice Text Operation 执行 |
| `agent/ai_intent.py` | AI 指令意图分类与本地兜底规则 |
| `agent/instruction_executor.py` | 执行快捷键、编辑、删除、写作、备忘等 Voice Text Operation |
| `agent/input_environment.py` | Operation Window 与 Replacement Plan 本地校验，控制可编辑范围 |
| `agent/stt.py` | STT 多 provider（xunfei/openai/aliyun/volcengine/zhipuai） |
| `agent/typer.py` | 三平台打字（Unicode / 剪贴板），退格擦除，行选择，jump_to_end |
| `agent/audio_monitor.py` | VAD 常开模式（PTT 模式不用此文件） |
| `agent/keyboard_monitor.py` | 退格监听，同步 TextBuffer；Enter 触发新段落 |
| `agent/mouse_monitor.py` | 鼠标点击检测；点击触发新段落 |
| `agent/text_buffer.py` | 文字账本：段落追踪（current_segment / replace_segment） |
| `agent/llm_editor.py` | LLM 编辑 + chat() + chat_stream() 流式接口 |
| `agent/config.py` | 加载 config.yaml / .env |

## 配置文件

`config.yaml`（从 `config.yaml.example` 复制）：

```yaml
stt:
  provider: xunfei          # 推荐：xunfei / aliyun
  app_id: "..."
  api_key: "..."
  api_secret: "..."
  language: zh_cn

llm:
  provider: zhipuai
  api_key: "..."
  model: glm-4-flash

typing:
  method: clip              # clip=剪贴板（微信）/ unicode=逐字（记事本/Word）

audio:
  mode: ptt                 # ptt=按键触发 / vad=自动检测
  ptt_key: shift_r          # macOS 右 Shift（推荐，避开 Ctrl+Space 输入法切换）；Windows/Linux alt_r
  ai_key: alt_r             # macOS 右 Option（推荐，不和 Cmd 系统快捷键冲突）；Windows/Linux ctrl_r
  device: auto              # 麦克风序号，auto=自动
```

## 打字方式选择

| 应用类型 | 推荐方式 | 原因 |
|----------|---------|------|
| 微信、钉钉、Electron 应用 | `method: clip` | 这类应用过滤 SendInput Unicode 事件 |
| 记事本、Word、VS Code | `method: unicode` | 逐字更精确，不占用剪贴板 |

## STT Provider 对比

| provider | 适合场景 | 特点 |
|----------|---------|------|
| `xunfei` | **推荐**，中文日常使用 | 原话逐字转写，数字自动阿拉伯数字，WebSocket 流式 |
| `aliyun` | 方言、多语言 | 支持方言，REST API |
| `volcengine` | 备选 | HTTP API，需 streaming_common 集群 |
| `zhipuai` | 不推荐做 STT | 对话模型，会改写内容而非原样转写 |
| `openai` | 英文 / 多语言 | Whisper，中文效果一般 |

## 已知约束

- **VAD 模式**：依赖 `webrtcvad`，Python 3.13+ 暂无预编译包，请用 PTT 模式
- **Windows 中文键盘**：右 Alt = `alt_gr`，右 Ctrl = `ctrl_r`（非 `right_alt` / `right_ctrl`）
- **Volcengine**：`/api/v1/asr` 端点不支持 `volcengine_input_common` 集群，若用火山引擎需换 WebSocket v2 协议
- **GLM-4-Voice**：是对话模型，不适合做 STT，会用自己的措辞回复

## 性能说明

| 阶段 | 典型耗时 | 说明 |
|------|---------|------|
| 讯飞 STT | 300–600ms | WebSocket 握手 + 服务端识别 |
| 剪贴板粘贴 | ~60ms | 写入 30ms + 粘贴 30ms |
| LLM 编辑 | 500–1000ms | GLM-4-Flash，仅语音编辑时触发 |

> `stt.py` 中发包间隔设为 5ms（非实时速率），PTT 音频已录完无需按实时速率发包，
> 可大幅减少长句的等待时间（3 秒录音节省约 2.6 秒）。

## 依赖安装

```bash
pip install -r requirements.txt
```

主要依赖：`sounddevice` `pynput` `websocket-client` `zhipuai` `requests` `pyyaml`

## AI 编辑架构

当前 AI 键是 Instruction Mode，不再把聊天回复写进输入框再定时删除。完整链路是：

1. `AIHandler` 做 STT，并读取 Explicit Selection 与 TextBuffer 的 Tracked Segment。
2. `ai_intent.classify_intent()` 先跑本地安全兜底，再让 LLM 返回结构化意图。
3. `voice_text_operation.operation_from_intent()` 把意图转成单个 Voice Text Operation。
4. `InstructionModeExecutor` 执行操作；编辑/删除会要求 LLM 生成 Replacement Plan。
5. `InputEnvironment.apply_replacement_plan()` 在本地校验目标文本存在、唯一、置信度足够，再替换。

关键规则：

- Explicit Selection 优先于 Tracked Segment。
- 无选区编辑默认作用于最近一次由 TypeUp 输出的 Tracked Segment。
- 无选区的局部删除会失败关闭，提示用户先选中内容。
- 聊天反馈只显示在状态/HUD，不再直接写入目标输入框。
- 写作先等模型完成，再一次性插入，并做中文标点兜底。

## AI 键已知 Bug 及修复记录

### 1. AI 键按下时触发「录音太短，跳过」

**现象**：每次按下 AI 键，日志里紧跟一条 `[ptt] 录音太短，跳过`。

**原因**：`get_selection()` 会通过 pynput Controller 发出复制快捷键。pynput 监听线程收到合成按键事件后，可能误判为新的热键事件。

**修复**：`typer.py` 用 `_simulating` 标志包住 `_copy_selection()` / `replace_selection()`。`push_to_talk._on_press` / `_on_release` 开头检查 `is_simulating()`，为真则直接返回。

---

### 2. 聊天回复误删或覆盖用户原文

**现象**：旧版本会把聊天回复写进输入框，再用定时器擦掉；连续触发 AI 键时，可能误删输入框里的原文。

**原因**：聊天反馈不属于目标输入内容，却和真实输入共用 `erase_last()` / `type_text()` 副作用。

**修复**：聊天路径现在只调用 `status_window.show_typing_message()` / `show_message()`，不再向目标输入框写入临时 AI 回复。

---

### 3. 有选中文字时聊天/写作覆盖选中内容

**现象**：鼠标选中了一段文字，用 AI 键聊天或写作时，系统输入会替换选中区域。

**原因**：`type_text` / 粘贴在有选区时会替换选中区域，这是操作系统标准行为。

**修复**：写作和备忘插入走 `InputEnvironment.insert_generated_text()`；有选区时先 `jump_to_end()` 取消选中，再插入生成文本。聊天只显示 HUD，不碰输入框。

---

### 4. delete 意图说删除后仍无法删除

**现象**：用户选中内容后说「删除」，旧实现可能让 LLM 产出空字符串并尝试粘贴空文本，部分应用不会删除选区。

**修复**：新增独立 `delete` Voice Text Operation。局部删除必须有 Explicit Selection；全文/清空类指令走 Operation Window 或全选删除兜底。

---

### 5. 编辑目标过大或替错位置

**现象**：旧实现把整段上下文直接交给 LLM 改写，容易出现局部修改却替换整段、或目标不明确时仍强行改写。

**修复**：LLM 现在返回 `{target_text, replacement_text, confidence}` 的 Replacement Plan。`InputEnvironment` 会在本地确认 target 存在且唯一，低置信度或歧义目标不会写入。

---

### 6. 写作输出无标点，整块文字一次性输出

**现象**：AI 写作时不加任何标点，旧流式分句逻辑检测不到句子边界，整段内容等到流结束才一次性打出。

**修复**：写作 prompt 明确要求完整中文标点；执行器收集完整生成结果后统一插入，并用 `punctuation.normalize_spoken_punctuation()` 和句末标点兜底，避免半句流式写入。

---

### 7. Windows 光标窗口能力限制

**现状**：Windows 端 `typer.get_caret_text_window()` 暂时保守返回 `None`。因此「无选区且无 Tracked Segment」的局部编辑会提示先选中内容；最近一次 TypeUp 输出的文本仍可作为默认编辑目标。

---

## 热键检测（Windows）

不确定按键名称时，运行：

```bat
.venv\Scripts\python -c "from pynput import keyboard; l = keyboard.Listener(on_press=lambda k: print(k)); l.start(); input()"
```

按目标键，控制台打印的即为 config.yaml 中应填的名称。
