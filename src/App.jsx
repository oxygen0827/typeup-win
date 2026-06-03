import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Cloud,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  History,
  Home,
  Languages,
  LogIn,
  LogOut,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Save,
  Settings,
  Shield,
  ShieldCheck,
  Square,
  Terminal,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import mark from "./assets/typeup-mark.png";
import {
  localizedReleaseNoteItems,
  localizedReleaseNoteSummary,
  parseReleaseVersion,
  withBuiltinReleaseNotesFallback,
} from "./releaseNotes.mjs";

const STATUS_COPY = {
  zh: {
    stopped: { label: "已停止", title: "本地引擎已停止", detail: "点击启动后，TypeUp 会回到后台等待语音输入。", tone: "muted" },
    transcription_off: { label: "已停止", title: "转写功能已关闭", detail: "后台引擎仍在运行，普通键盘输入会正常交给系统。", tone: "muted" },
    stopping: { label: "停止中", title: "正在停止引擎", detail: "正在释放麦克风和键盘监听。", tone: "muted" },
    starting: { label: "启动中", title: "正在启动本地引擎", detail: "正在加载语音、输入和 AI 编辑模块。", tone: "warn" },
    listening: { label: "就绪", title: "按住快捷键开始说话", detail: "松开后自动转写并输入到当前光标位置。", tone: "ok" },
    transcribing: { label: "处理中", title: "正在转写或编辑", detail: "结果完成后会自动写入当前窗口。", tone: "active" },
    needs_config: { label: "等待配置", title: "需要填写 STT Key", detail: "保存配置后会自动重启本地引擎。", tone: "warn" },
    error: { label: "异常", title: "本地引擎遇到问题", detail: "查看日志定位错误，修复后可直接重启。", tone: "danger" },
  },
  en: {
    stopped: { label: "Stopped", title: "Local engine is stopped", detail: "Start it to return TypeUp to background voice input.", tone: "muted" },
    transcription_off: { label: "Stopped", title: "Transcription is off", detail: "The background engine is still running, and keyboard input passes through normally.", tone: "muted" },
    stopping: { label: "Stopping", title: "Stopping engine", detail: "Releasing microphone and keyboard hooks.", tone: "muted" },
    starting: { label: "Starting", title: "Starting local engine", detail: "Loading speech, typing, and AI editing modules.", tone: "warn" },
    listening: { label: "Ready", title: "Hold the speak shortcut", detail: "Release to transcribe and type at the current cursor.", tone: "ok" },
    transcribing: { label: "Working", title: "Transcribing or editing", detail: "The result will be written into the active window.", tone: "active" },
    needs_config: { label: "Setup", title: "STT key required", detail: "Save settings to restart the local engine.", tone: "warn" },
    error: { label: "Error", title: "Local engine needs attention", detail: "Check logs, then restart after fixing the issue.", tone: "danger" },
  },
};

const COPY = {
  zh: {
    language: "语言",
    localEngine: "本地引擎",
    voiceConsole: "语音控制台",
    shortcuts: "快捷键",
    usage: "用量趋势",
    usageRange: "最近 7 天",
    logs: "运行日志",
    backend: "本地后端",
    account: "账号",
    accountCenter: "账号与订阅",
    backendUrl: "后端地址",
    email: "邮箱",
    password: "密码",
    invalidEmail: "请输入正确的邮箱地址",
    passwordRequired: "请输入密码",
    registerPasswordTooShort: "注册密码至少 8 位",
    login: "登录",
    register: "注册",
    logout: "退出登录",
    refreshAccount: "刷新账号",
    signedInAs: "当前账号",
    subscription: "订阅权益",
    noSubscription: "未开通服务",
    activeSubscription: "服务已开通",
    sttQuota: "语音额度",
    aiQuota: "AI 额度",
    plans: "套餐",
    createOrder: "购买",
    openPayment: "打开支付",
    pollOrder: "刷新订单",
    orderStatus: "订单状态",
    authHint: "登录后会自动把本地引擎切到后端代理，无需在本机保存模型 Key。",
    settings: "配置",
    speechModel: "语音与模型",
    process: "进程",
    listenMode: "监听模式",
    stt: "STT",
    typing: "输入方式",
    notRunning: "未运行",
    notConfigured: "未配置",
    pushToTalk: "按键说话",
    alwaysOn: "常开 VAD",
    clipboard: "剪贴板",
    unicode: "Unicode",
    start: "启动",
    stop: "停止",
    restart: "重启",
    microphone: "麦克风",
    deviceFallback: "未发现输入设备",
    configured: "订阅模型代理已接入。",
    missingConfig: "请先登录账号，本地引擎会通过订阅服务调用模型。",
    managedProvider: "已接入后台",
    subscriptionIncluded: "已包含在订阅服务内",
    transcribedChars: "今日转写字数",
    aiEditedChars: "今日 AI 编辑字数",
    savedTime: "总节约时间",
    successfulEvents: "历史成功事件",
    noLogs: "暂无日志",
    saveAndRestart: "保存并重启",
    saving: "保存中",
    vad: "常开",
    ptt: "按键",
    original: "原生",
    lightPolish: "微润色",
    outputStyle: "输出风格",
    outputStyleHint: "点击即保存并重启；双击说话快捷键切到润色模式后使用",
    outputStyleMicro: "微润色",
    outputStylePrompt: "Prompt",
    outputStyleFormal: "正式",
    outputStyleConcise: "简洁",
    outputStyleMicroDetail: "保留原意和语气，只清理口语填充、错别字和轻微表达问题。",
    outputStylePromptDetail: "把零散口语整理成适合发给 AI 工具的清晰需求。",
    outputStyleFormalDetail: "更适合邮件、报告和工作沟通。",
    outputStyleConciseDetail: "压缩冗余表达，让内容更短、更直接。",
    outputStyleCustom: "自定义要求",
    outputStyleCustomDetail: "留空则使用所选风格的内置规则",
    outputStyleCustomPlaceholder: "例如：改成会议纪要风格，保留项目名，最后列出下一步。",
    outputStyleSaveHint: "风格已保存，正在重启引擎",
    statusDockReady: "TypeUp 已接管预览页热键",
    statusDockHint: "快捷键会根据当前平台和配置显示。",
    shortcutSpeak: "开始说话",
    shortcutSpeakDetail: "长按 ALT 期间进行转写",
    shortcutStartTranscription: "启动转写",
    shortcutStartTranscriptionDetail: "按一下开启后台转写",
    shortcutStopTranscription: "停止转写",
    shortcutStopTranscriptionDetail: "按一下关闭后台转写",
    shortcutAi: "AI 编辑",
    shortcutAiDetail: "下发指令，改写已有内容",
    shortcutPolish: "切换润色模式",
    shortcutPolishDetail: "支持精准转录与 AI 润色双模式切换",
    modeDisplay: "润色模式",
    permissions: "权限",
    permissionCenter: "macOS 权限",
    permissionHint: "参考轻量版 TypeUp：授权后才能监听热键、录音并输入文字。",
    permissionTarget: "需要授权的是 TypeUp 内嵌引擎，不是你本机独立安装的旧版语音输入工具。",
    revealPermissionTarget: "显示授权对象",
    accessibility: "辅助功能",
    inputMonitoring: "输入监控",
    permissionGranted: "已授权",
    permissionDenied: "已拒绝",
    permissionPending: "未决定",
    permissionUnknown: "未知",
    openSystemSettings: "打开系统设置",
    requestPermission: "请求权限",
    requestMic: "请求麦克风",
    recheck: "重新检查",
    restartAfterGrant: "授权后请重启本地引擎。",
    checkUpdate: "检查更新",
    updateChecking: "正在检查更新",
    updateLatest: "已是最新版本",
    updateAvailable: "已有新版本，请更新",
    updateAvailableDetail: "TypeUp {version} 已发布，下载后可一键静默安装并自动重启。",
    updateDownload: "下载更新",
    updateDownloading: "正在下载",
    updateDownloaded: "更新已下载",
    updateDownloadedDetail: "点击后 TypeUp 会关闭窗口、静默安装新版并自动重新打开。",
    updateInstall: "立即安装并重启",
    updateInstalling: "正在关闭并安装",
    updateError: "更新检查失败",
    updateDisabled: "开发模式不检查更新",
  },
  en: {
    language: "Language",
    localEngine: "Local Engine",
    voiceConsole: "Voice Console",
    shortcuts: "Shortcuts",
    usage: "Usage Trend",
    usageRange: "Last 7 days",
    logs: "Runtime Logs",
    backend: "Local Backend",
    account: "Account",
    accountCenter: "Account and Plan",
    backendUrl: "Backend URL",
    email: "Email",
    password: "Password",
    invalidEmail: "Enter a valid email address.",
    passwordRequired: "Enter your password.",
    registerPasswordTooShort: "Registration password must be at least 8 characters.",
    login: "Login",
    register: "Register",
    logout: "Logout",
    refreshAccount: "Refresh Account",
    signedInAs: "Signed in as",
    subscription: "Subscription",
    noSubscription: "No active plan",
    activeSubscription: "Plan active",
    sttQuota: "STT quota",
    aiQuota: "AI quota",
    plans: "Plans",
    createOrder: "Buy",
    openPayment: "Open Payment",
    pollOrder: "Refresh Order",
    orderStatus: "Order Status",
    authHint: "After login, the local engine uses the backend proxy. No model keys need to be stored locally.",
    settings: "Settings",
    speechModel: "Speech and Models",
    process: "Process",
    listenMode: "Listen Mode",
    stt: "STT",
    typing: "Typing",
    notRunning: "Not running",
    notConfigured: "Not configured",
    pushToTalk: "Push to talk",
    alwaysOn: "Always-on VAD",
    clipboard: "Clipboard",
    unicode: "Unicode",
    start: "Start",
    stop: "Stop",
    restart: "Restart",
    microphone: "Microphone",
    deviceFallback: "No input devices found",
    configured: "Subscription model proxy is connected.",
    missingConfig: "Sign in first. The local engine calls models through your subscription.",
    managedProvider: "Managed by backend",
    subscriptionIncluded: "Included in subscription",
    transcribedChars: "Transcribed Today",
    aiEditedChars: "AI Edited Today",
    savedTime: "Time Saved",
    successfulEvents: "Successful Events",
    noLogs: "No logs yet",
    saveAndRestart: "Save and Restart",
    saving: "Saving",
    vad: "Always-on",
    ptt: "Push",
    original: "Original",
    lightPolish: "Light Polish",
    outputStyle: "Output Style",
    outputStyleHint: "Click to save and restart; used after double-tapping the speak shortcut into polish mode",
    outputStyleMicro: "Micro",
    outputStylePrompt: "Prompt",
    outputStyleFormal: "Formal",
    outputStyleConcise: "Concise",
    outputStyleMicroDetail: "Keep intent and tone while fixing fillers, typos, and minor phrasing.",
    outputStylePromptDetail: "Turn spoken notes into a clear prompt for AI tools.",
    outputStyleFormalDetail: "Better suited for email, reports, and work communication.",
    outputStyleConciseDetail: "Reduce redundancy so the result is shorter and more direct.",
    outputStyleCustom: "Custom Instructions",
    outputStyleCustomDetail: "Leave empty to use the built-in rule for the selected style.",
    outputStyleCustomPlaceholder: "Example: write it like meeting notes, keep product names, and end with next steps.",
    outputStyleSaveHint: "Style saved, restarting engine",
    statusDockReady: "TypeUp is using the preview shortcuts",
    statusDockHint: "Shortcuts follow the current platform and settings.",
    shortcutSpeak: "Start Speaking",
    shortcutSpeakDetail: "Hold ALT to transcribe",
    shortcutStartTranscription: "Start Transcription",
    shortcutStartTranscriptionDetail: "Press once to enable background transcription",
    shortcutStopTranscription: "Stop Transcription",
    shortcutStopTranscriptionDetail: "Press once to disable background transcription",
    shortcutAi: "AI Edit",
    shortcutAiDetail: "Send a command to rewrite existing content",
    shortcutPolish: "Switch Polish Mode",
    shortcutPolishDetail: "Switch between precise transcription and AI polish",
    modeDisplay: "Polish Mode",
    permissions: "Permissions",
    permissionCenter: "macOS Permissions",
    permissionHint: "Mirrors lightweight TypeUp: required for hotkeys, recording, and typing.",
    permissionTarget: "Grant permissions to the embedded TypeUp engine, not a separately installed legacy voice app.",
    revealPermissionTarget: "Show Target",
    accessibility: "Accessibility",
    inputMonitoring: "Input Monitoring",
    permissionGranted: "Granted",
    permissionDenied: "Denied",
    permissionPending: "Not decided",
    permissionUnknown: "Unknown",
    openSystemSettings: "Open Settings",
    requestPermission: "Request",
    requestMic: "Request Mic",
    recheck: "Recheck",
    restartAfterGrant: "Restart the local engine after granting permissions.",
    checkUpdate: "Check Updates",
    updateChecking: "Checking for updates",
    updateLatest: "TypeUp is up to date",
    updateAvailable: "A new version is available",
    updateAvailableDetail: "TypeUp {version} is ready. Download it, then install silently and restart automatically.",
    updateDownload: "Download",
    updateDownloading: "Downloading",
    updateDownloaded: "Update downloaded",
    updateDownloadedDetail: "TypeUp will close, install silently, and reopen automatically.",
    updateInstall: "Install and Restart",
    updateInstalling: "Closing and installing",
    updateError: "Update check failed",
    updateDisabled: "Updates are disabled in development",
  },
};

COPY.zh.releaseNotesTitle = "已更新到 {version}";
COPY.zh.releaseNotesSubtitle = "此次更新内容";
COPY.zh.releaseNotesFallback = "本次更新包含稳定性与体验优化。";
COPY.zh.releaseNotesOpen = "查看发布页";
COPY.zh.releaseNotesClose = "关闭";
COPY.en.releaseNotesTitle = "Updated to {version}";
COPY.en.releaseNotesSubtitle = "What changed";
COPY.en.releaseNotesFallback = "This update includes stability and experience improvements.";
COPY.en.releaseNotesOpen = "View Release";
COPY.en.releaseNotesClose = "Close";

Object.assign(COPY.zh, {
  features: "功能介绍",
  featuresNavDetail: "核心能力",
  featuresSub: "了解 TypeUp 如何把语音、输入和轻量 AI 编辑组合成一个顺手的桌面工具。",
  featureVoiceTitle: "语音输入",
  featureVoiceDetail: "按住快捷键说话，松开后自动转写并写入当前光标位置。",
  featureAiTitle: "AI 编辑",
  featureAiDetail: "用组合快捷键处理当前文字，适合改写、整理和轻量润色。",
  featurePolishTitle: "微润色模式",
  featurePolishDetail: "保留原意和语气，只修正口语填充、错别字和轻微表达问题。",
  featurePrivateTitle: "本地常驻",
  featurePrivateDetail: "桌面端负责热键、录音和输入，模型调用通过订阅后端代理完成。",
  feedback: "改进意见",
  feedbackNavDetail: "提交建议",
  feedbackSub: "把你觉得别扭、缺失或值得优化的地方记下来，点击按钮会带着内容打开 GitHub Issue。",
  feedbackLabel: "你的建议",
  feedbackPlaceholder: "例如：希望微润色保留更多口语感，或者希望更新下载源可以自定义...",
  feedbackOpenIssues: "提交到 Issues",
  feedbackIssueTitle: "TypeUp 改进意见",
  feedbackIssueBody: "请描述你遇到的问题、期待的体验，以及相关截图或复现步骤。",
  community: "社区",
  communityNavDetail: "项目链接",
  communitySub: "查看源码、发布记录和问题反馈入口。",
  openRepo: "打开仓库",
  openReleases: "查看发布记录",
  openIssues: "查看 Issues",
});

Object.assign(COPY.en, {
  features: "Features",
  featuresNavDetail: "Core flow",
  featuresSub: "See how TypeUp combines voice, typing, and light AI editing into a fast desktop workflow.",
  featureVoiceTitle: "Voice Input",
  featureVoiceDetail: "Hold the shortcut to speak, then release to transcribe and type at the cursor.",
  featureAiTitle: "AI Editing",
  featureAiDetail: "Use the edit shortcut to process selected or current text with lightweight AI help.",
  featurePolishTitle: "Light Polish",
  featurePolishDetail: "Keep intent and tone while fixing filler words, typos, and small phrasing issues.",
  featurePrivateTitle: "Local Companion",
  featurePrivateDetail: "The desktop app handles hotkeys, recording, and typing while model calls go through the subscription backend.",
  feedback: "Feedback",
  feedbackNavDetail: "Share ideas",
  feedbackSub: "Write down what feels awkward, missing, or worth improving. The button opens a GitHub Issue with your notes.",
  feedbackLabel: "Your feedback",
  feedbackPlaceholder: "For example: keep more spoken style in light polish, or allow custom update mirrors...",
  feedbackOpenIssues: "Send to Issues",
  feedbackIssueTitle: "TypeUp feedback",
  feedbackIssueBody: "Please describe the issue, expected experience, screenshots, or reproduction steps.",
  community: "Community",
  communityNavDetail: "Project links",
  communitySub: "Open the source repository, release history, and issue tracker.",
  openRepo: "Open Repository",
  openReleases: "View Releases",
  openIssues: "View Issues",
});

const DEFAULT_BACKEND_URL = "http://150.158.146.192:6053";
const POLISH_STYLE_IDS = ["micro", "prompt", "formal", "concise"];

const EMPTY_SETTINGS = {
  stt: { provider: "typeup_backend", api_base_url: DEFAULT_BACKEND_URL, access_token: "", model: "glm-asr-2512", language: "zh" },
  audio: { mode: "ptt", device: "auto", vad_aggressiveness: 2, polish_style: "micro", polish_style_prompt: "" },
  typing: { method: "unicode" },
  llm: { provider: "typeup_backend", api_base_url: DEFAULT_BACKEND_URL, access_token: "", model: "glm-4-flash" },
};

const EMPTY_AUTH = {
  apiBaseUrl: DEFAULT_BACKEND_URL,
  connected: false,
  authenticated: false,
  user: null,
  entitlement: null,
};

const EMPTY_PERMISSIONS = {
  platform: "",
  permissions: {
    accessibility: "unknown",
    input_monitoring: "unknown",
    microphone: "unknown",
  },
};

const STATUS_KEYS = [
  "state",
  "pid",
  "startedAt",
  "exitedAt",
  "lastError",
  "configured",
  "configPath",
  "historyPath",
  "logPath",
  "engineDir",
  "mode",
  "provider",
  "typingMethod",
  "transcriptionEnabled",
];

const DEFAULT_UPDATE_STATE = {
  status: "disabled",
  currentVersion: "",
  availableVersion: "",
  releaseName: "",
  releaseNotes: "",
  releaseUrl: "",
  progress: 0,
  error: "",
};

const RELEASE_NOTES_SEEN_KEY = "typeup.releaseNotes.seen";

const BUILTIN_RELEASE_NOTES = {
  "0.3.7": {
    releaseName: "TypeUp 0.3.7",
    zh: {
      summary: "本次热修避免 Prompt 风格在用户还没说完时提前输出结构化命令。",
      items: [
        "Prompt 风格下会等待本次按住说话结束后，再把整段录音整理成结构化 prompt。",
        "普通微润色仍保留实时分句提前输出，连续听写体验不受影响。",
        "新增回归测试，覆盖 Prompt 风格禁用中途分句、微润色保留中途分句两个路径。",
      ],
    },
    en: {
      summary: "This hotfix prevents Prompt style from emitting structured output before the user finishes speaking.",
      items: [
        "Prompt style now waits for the current push-to-talk recording to finish before formatting the full utterance.",
        "Micro polish keeps mid-sentence dispatch so continuous dictation remains responsive.",
        "Regression coverage now locks both Prompt-style suppression and Micro-style mid-sentence behavior.",
      ],
    },
  },
  "0.3.6": {
    releaseName: "TypeUp 0.3.6",
    zh: {
      summary: "本次正式版加入输出风格切换，并把 Prompt 模式打磨为可直接发给 AI 的结构化需求。",
      items: [
        "配置页新增输出风格切换：微润色、Prompt、正式和简洁，点击风格会立即保存并重启本地引擎。",
        "Prompt 风格会把口语需求整理成结构化 prompt，项目理解类请求会稳定输出任务、关注点和输出要求。",
        "增强 Prompt 输出安全回退，避免 JSON、transcript 字段或内部处理说明被打进当前应用。",
        "长语音转写和文本输入链路更稳，长文本优先使用剪贴板粘贴，减少逐字输入卡顿。",
        "开发者栏目里的启动、停止、重启按钮已与首页保持一致。",
      ],
    },
    en: {
      summary: "This release adds output style switching and turns Prompt style into structured AI-ready requests.",
      items: [
        "Settings now includes output styles: Micro, Prompt, Formal, and Concise. Selecting a style saves and restarts the local engine.",
        "Prompt style turns spoken requests into structured prompts; project-understanding requests produce a task, focus areas, and output requirements.",
        "Prompt output now has stronger safety fallbacks so JSON, transcript fields, and internal processing instructions are not typed into the active app.",
        "Long dictation and text insertion are more stable, with long text using clipboard paste instead of slow character-by-character input.",
        "Developer engine controls now match the Home start, stop, and restart interaction.",
      ],
    },
  },
  "0.3.6-beta.2": {
    releaseName: "TypeUp 0.3.6 Beta 2",
    zh: {
      summary: "本次测试版加入输出风格切换，并修复 Prompt 风格和录音异常问题。",
      items: [
        "配置页新增输出风格切换：微润色、Prompt、正式和简洁，点击风格会立即保存并重启本地引擎。",
        "Prompt 风格使用独立整理规则，支持把口语需求整理成结构化 prompt，不再被微润色规则压回普通转写。",
        "修复录音 watchdog 初始化异常，避免测试版启动后反复报错。",
        "长语音转写和文本输入链路更稳，长文本优先使用剪贴板粘贴，减少逐字输入卡顿。",
        "开发者栏目里的启动、停止、重启按钮已与首页保持一致。",
      ],
    },
    en: {
      summary: "This beta adds output style switching and fixes Prompt style plus recording stability.",
      items: [
        "Settings now includes output styles: Micro, Prompt, Formal, and Concise. Selecting a style saves and restarts the local engine.",
        "Prompt style now uses dedicated prompt-cleanup rules and keeps structured prompt output instead of falling back to light polish.",
        "Fixed the recording watchdog initialization error that caused repeated beta runtime failures.",
        "Long dictation and text insertion are more stable, with long text using clipboard paste instead of slow character-by-character input.",
        "Developer engine controls now match the Home start, stop, and restart interaction.",
      ],
    },
  },
  "0.3.6-beta.1": {
    releaseName: "TypeUp 0.3.6 Beta 1",
    zh: {
      summary: "本次测试版引入 OpenLess 启发的语音链路稳定性优化。",
      items: [
        "后端模型调用和 STT 超时时间对长语音更友好，减少长句处理失败。",
        "长文本输入改用剪贴板粘贴并自动恢复原剪贴板内容。",
        "为输出风格配置预留 engine 入口，方便后续测试不同润色风格。",
      ],
    },
    en: {
      summary: "This beta brings OpenLess-inspired stability work to the voice pipeline.",
      items: [
        "Backend and STT timeouts are friendlier to longer dictation.",
        "Long text insertion uses clipboard paste and restores the previous clipboard afterwards.",
        "Engine configuration now has hooks for testing multiple polish styles.",
      ],
    },
  },
  "0.3.5": {
    releaseName: "TypeUp 0.3.5",
    zh: {
      summary: "本次发布继续打磨设置页和开发者栏目的视觉细节。",
      items: [
        "开发者栏目里的启动、重启和停止按钮增加独立间距，避免按钮挤在一起。",
        "麦克风设置区域把当前设备和录入设备选择拆成更清晰的独立卡片。",
        "录入设备下拉框的边距、边框和高度统一优化，提升设置页的可读性。",
      ],
    },
    en: {
      summary: "This release refines Settings and Developer layout details.",
      items: [
        "Developer start, restart, and stop controls now have clearer spacing instead of crowding together.",
        "Microphone settings separate the current device and input-device selector into distinct cards.",
        "Input-device selector spacing, border treatment, and height are tightened for better readability.",
      ],
    },
  },
  "0.3.4": {
    releaseName: "TypeUp 0.3.4",
    zh: {
      summary: "本次发布确认源码预览效果，并将麦克风乱码修复推送给所有用户。",
      items: [
        "延续 0.3.3 的麦克风设备 JSON 枚举，确保中文设备名和系统默认设备显示正常。",
        "设置页保持只展示录入设备选择，调试输出留在开发者栏目。",
        "重新打包并发布 Windows 安装包，方便已安装用户通过更新源获取最新优化。",
      ],
    },
    en: {
      summary: "This release confirms the source preview and ships the microphone mojibake fix to all users.",
      items: [
        "Keeps the 0.3.3 structured microphone enumeration so localized device names and system defaults display correctly.",
        "Settings continues to show only input-device selection, with debug output kept in Developer.",
        "Repackages and publishes the Windows installer so installed clients can update through the feed.",
      ],
    },
  },
  "0.3.3": {
    releaseName: "TypeUp 0.3.3",
    zh: {
      summary: "本次补丁修复麦克风设备列表和设置页日志乱码。",
      items: [
        "麦克风设备枚举改为结构化 JSON，中文设备名不再因为控制台编码显示成乱码。",
        "设置页移除普通用户可见的黑色设备输出窗口，原始日志仍保留在开发者栏目。",
        "Windows 设备列表会过滤系统包装设备和重复项，优先显示更完整的真实输入设备名称。",
      ],
    },
    en: {
      summary: "This patch fixes microphone device listing and Settings log mojibake.",
      items: [
        "Microphone enumeration now uses structured JSON so localized device names are no longer corrupted by console encoding.",
        "The Settings page no longer shows the raw black device-output panel to regular users; raw logs remain in Developer.",
        "Windows device lists now filter wrapper devices and duplicates, preferring clearer real input device names.",
      ],
    },
  },
  "0.3.2": {
    releaseName: "TypeUp 0.3.2",
    zh: {
      summary: "本次继续打磨 TypeUp 品牌、订阅计划、麦克风设备识别和设置页体验。",
      items: [
        "主界面品牌文案统一为 TypeUp，首页欢迎语改为“您好，欢迎来到 TypeUp”。",
        "订阅计划里的“默认”和“推荐”徽标现在会稳定居中显示在灰色椭圆框内。",
        "今日转写字数统计卡改为白色样式，并且总节约时间不再向用户展示内部计算方式。",
        "设置页只保留录入设备选择，VAD 和监听模式移动到开发者栏目。",
        "麦克风自动选择会优先使用系统默认输入设备，设备列表也会返回结构化信息供界面准确选择。",
        "Windows 托盘后端显示 TypeUp，并优先使用应用图标资源。",
      ],
    },
    en: {
      summary: "This update polishes TypeUp branding, plans, microphone device handling, and Settings.",
      items: [
        "User-facing product copy now consistently says TypeUp, with a refreshed Home welcome message.",
        "The Default and Recommended plan badges now stay centered inside their gray pill backgrounds.",
        "The transcribed-characters stat now uses the same white card style, and saved time no longer exposes its internal calculation.",
        "Settings now keeps only input-device selection, while VAD and listening mode live in Developer.",
        "Automatic microphone selection now prefers the system default input device and exposes structured device data to the UI.",
        "The Windows tray backend now shows TypeUp and prefers the app icon asset.",
      ],
    },
  },
  "0.3.1": {
    releaseName: "TypeUp 0.3.1",
    zh: {
      summary: "本次发布补丁版，修复更新源误指向、更新说明乱码兜底和账号页连接信息布局。",
      items: [
        "按新的版本规则发布为 0.3.1，后续版本每累计 20 个补丁位进入下一档版本段。",
        "修复更新说明遇到异常编码内容时显示问号乱码的问题，会自动回退到内置中文说明。",
        "账号页右侧连接信息改为规整的信息行，后端地址会自动换行，不再挤乱标题和标签。",
        "服务器更新源已恢复到正确发布链路，避免客户端看到不该出现的版本。",
      ],
    },
    en: {
      summary: "This patch fixes update-feed confusion, release-note fallback handling, and the Account connection layout.",
      items: [
        "Released as 0.3.1 under the new versioning rule, where every 20 patch releases advances to the next version band.",
        "Release notes now fall back to built-in localized copy when malformed encoded content would otherwise show question marks.",
        "The Account connection card now uses a cleaner information row, and backend URLs wrap without breaking the title layout.",
        "The server update feed has been restored to the intended release path so clients do not see unexpected versions.",
      ],
    },
  },
  "0.1.40": {
    releaseName: "TypeUp 0.1.40",
    zh: {
      summary: "本次继续打磨首页 UI/UX，让语音控制、快捷键说明和用量统计更清晰。",
      items: [
        "顶部栏移除重复的检查更新、运行状态和语言切换入口，减少首屏干扰。",
        "语言切换迁移到配置页面，和快捷键、麦克风等设置放在一起管理。",
        "首页快捷键说明改到每个操作的右侧展示，并更新为更贴近实际工作流的文案。",
        "首页新增状态引导提示，启动、停止和重启按钮层级更清楚，用户能更快判断下一步操作。",
        "总节约时间继续保留在统计卡片中，但不再展示内部计算口径。",
      ],
    },
    en: {
      summary: "This update continues polishing the Home UI/UX so voice controls, shortcuts, and usage stats are clearer.",
      items: [
        "The top bar removes duplicate update, status, and language controls to reduce first-screen noise.",
        "Language switching now lives in Settings alongside shortcuts, microphone, and typing preferences.",
        "Home shortcut descriptions now sit on the right side of each action with clearer workflow copy.",
        "Home adds state guidance and clearer Start, Stop, and Restart button hierarchy so the next action is easier to understand.",
        "Time saved is now estimated as today's transcribed characters divided by 100 and multiplied by 60 seconds, with the formula shown in the stat card.",
      ],
    },
  },
  "0.1.39": {
    releaseName: "TypeUp 0.1.39",
    zh: {
      summary: "本次把团队优化版 UI/UX 融合进现有桌面端，并修复主窗口圆角和窗口控制按钮体验。",
      items: [
        "主界面迁移为优化版侧边导航工作台，首页、历史、词典、设置、订阅计划、账号、隐私和开发者栏目更清晰。",
        "首页保留语音控制台的启动、停止和重启入口，用户一打开软件就能看到如何控制本地引擎。",
        "Electron 主窗口改为透明背景，最外侧四个角跟随圆角窗口显示，不再露出直角底色。",
        "右上角最小化、最大化和关闭按钮改为标准线形图标，不再显示奇怪的文本符号。",
      ],
    },
    en: {
      summary: "This update merges the optimized UI/UX into the desktop app and fixes window rounding and control buttons.",
      items: [
        "The main UI now uses the optimized sidebar workspace with clearer Home, History, Dictionary, Settings, Plans, Account, Privacy, and Developer sections.",
        "The Home page keeps Start, Stop, and Restart controls in the voice console so users can immediately control the local engine.",
        "The Electron window now uses a transparent background so the outer corners render as rounded corners instead of a rectangular backdrop.",
        "The top-right minimize, maximize, and close controls now use standard line icons instead of odd text symbols.",
      ],
    },
  },
  "0.1.38": {
    releaseName: "TypeUp 0.1.38",
    zh: {
      summary: "本次更新语音控制台快捷键和 Windows 右侧 Alt 工作流，并暂时移除个人词库。",
      items: [
        "Ctrl + O 现在用于启动语音控制台，Ctrl + P 用于停止；即使本地 engine 已停止，也可以通过 Ctrl + O 从 Electron 主进程重新拉起。",
        "Windows 默认改为右 Alt 按住转写，双击右 Alt 切换原生/微润色模式，右 Alt + 右 Shift 进入 AI 编辑，左 Alt 不再触发 TypeUp。",
        "个人词库、本地纠错学习和相关接口已从当前版本移除，计划第二版重新设计后再加入。",
        "开发模式默认运行 Python engine 源码，并修复 pynput 键盘监听回调签名不兼容导致的启动异常。",
      ],
    },
    en: {
      summary: "This update refreshes voice-console shortcuts, switches Windows to right-Alt workflows, and removes the personal dictionary for now.",
      items: [
        "Ctrl + O now starts the voice console and Ctrl + P stops it; Electron can relaunch the local engine even when it has stopped.",
        "Windows defaults now use right Alt for dictation, double right Alt for original/light-polish mode, and right Alt + right Shift for AI edit. Left Alt no longer triggers TypeUp.",
        "The personal dictionary, local correction learning, and related APIs have been removed from this version and are planned for a redesigned v2.",
        "Development mode runs the Python engine source by default, and the pynput keyboard callback compatibility issue is fixed.",
      ],
    },
  },
  "0.1.37": {
    releaseName: "TypeUp 0.1.37",
    zh: {
      summary: "本次继续修复 Ctrl + Alt 启用后的键盘卡住问题。",
      items: [
        "修复 Ctrl + Alt 启用转写后，内部仍可能残留 Ctrl/Alt 状态，导致键盘或输入法表现异常的问题。",
        "切换开关后会立即清空 TypeUp 的热键过滤状态；按住这组开关不松时不会被当成 Alt 录音。",
        "非吞掉的热键释放事件也会同步给内部状态，避免第二次切换或后续按键被误判。",
        "新增 Windows 回归测试，覆盖启用后按住 Ctrl + Alt 再按空格仍会交给系统、释放后 Alt 才开始转写。",
      ],
    },
    en: {
      summary: "This hotfix continues the Ctrl + Alt keyboard-stuck fix after enabling transcription.",
      items: [
        "Fixed stale Ctrl/Alt state after Ctrl + Alt enables transcription, which could make the keyboard or IME behave as if a modifier were stuck.",
        "TypeUp now clears its hotkey filter state immediately after the switch, and holding the switch combo is never treated as Alt recording.",
        "Unsuppressed hotkey release events are also synchronized into the internal state so later toggles and keys are not misread.",
        "Added Windows regression coverage for Space passing through while Ctrl + Alt is still held, and Alt starting transcription only after the switch combo releases.",
      ],
    },
  },
  "0.1.36": {
    releaseName: "TypeUp 0.1.36",
    zh: {
      summary: "本次热修 Ctrl + Alt 转写开关，关闭后不会再拦截普通键盘和输入法。",
      items: [
        "Ctrl + Alt 现在只负责启用或关闭转写功能，不再启动持续录音。",
        "配置了 Ctrl + Alt 开关时，TypeUp 启动后默认不接管 Alt；首次按 Ctrl + Alt 才启用转写。",
        "转写功能关闭后，Alt、空格和其他键都会正常交给系统和输入法；只有再次按 Ctrl + Alt 才会重新启用 TypeUp 转写。",
        "启用或关闭时会短暂显示状态框：转写功能已启动 / 转写功能已关闭。",
      ],
    },
    en: {
      summary: "This hotfix makes Ctrl + Alt a transcription enable/disable switch and stops intercepting normal keyboard input when disabled.",
      items: [
        "Ctrl + Alt now only enables or disables transcription instead of starting continuous recording.",
        "When a Ctrl + Alt switch is configured, TypeUp starts with Alt untouched; press Ctrl + Alt once to enable transcription.",
        "When transcription is disabled, Alt, Space, and other keys are passed back to Windows and IMEs normally; pressing Ctrl + Alt again re-enables TypeUp transcription.",
        "A short status HUD now confirms Transcription enabled or Transcription disabled.",
      ],
    },
  },
  "0.1.35": {
    releaseName: "TypeUp 0.1.35",
    zh: {
      summary: "本次新增 Ctrl + Alt 切换式转写，并修复新版首页更新说明在服务器更新源下显示不完整的问题。",
      items: [
        "按一下 Ctrl + Alt 开始持续转写，再按一下停止录音并输入结果，不需要打开软件页面手动关闭。",
        "原有 Alt 按住说话、Alt + Space AI 编辑、双击 Alt 切换润色模式保持不变。",
        "首页更新说明补齐 0.1.28 之后的版本内容；服务器更新源只返回 latest.yml 时也会显示具体更新点。",
        "桌面快捷键提示会读取当前配置，显示 Alt、Ctrl + Alt、Alt + Space 和双击 Alt。",
      ],
    },
    en: {
      summary: "This update adds Ctrl + Alt toggle transcription and improves first-launch release notes for server-hosted updates.",
      items: [
        "Press Ctrl + Alt once to start continuous transcription, then press it again to stop and type the result.",
        "Existing Alt push-to-talk, Alt + Space AI edit, and double-Alt polish toggle shortcuts remain unchanged.",
        "The home-screen changelog now includes versions after 0.1.28 and falls back to built-in notes when the server feed only provides latest.yml.",
        "Shortcut hints now show Alt, Ctrl + Alt, Alt + Space, and double Alt from the active configuration.",
      ],
    },
  },
  "0.1.34": {
    releaseName: "TypeUp 0.1.34",
    zh: {
      summary: "本次加入 Ctrl + Alt 切换式转写热键，个人词库延后到第二版。",
      items: [
        "新增 Ctrl + Alt 切换式转写：按一下开始持续录音，再按一下停止并输入结果。",
        "个人词库界面和本地纠错学习延后到第二版重新设计。",
      ],
    },
    en: {
      summary: "This update adds a Ctrl + Alt transcription toggle and defers personal dictionary work to a later release.",
      items: [
        "Ctrl + Alt now toggles continuous dictation: press once to record, press again to stop and type.",
        "The personal dictionary interface and local correction learning are deferred to a later version.",
      ],
    },
  },
  "0.1.31": {
    releaseName: "TypeUp 0.1.31",
    zh: {
      summary: "本次用于验证服务器托管的 Windows 差分更新下载链路。",
      items: [
        "继续使用 TypeUp 服务器镜像作为打包后的更新源。",
        "保留 electron-updater 标准元数据，方便后续 Windows 更新使用差分下载。",
        "用户工作流没有变化，主要用于验证更新分发链路。",
      ],
    },
    en: {
      summary: "This update verifies server-hosted Windows differential update delivery.",
      items: [
        "The packaged updater continues to use the TypeUp server mirror.",
        "Standard electron-updater metadata is kept so later Windows updates can use differential downloads.",
        "There are no user-facing workflow changes beyond update delivery verification.",
      ],
    },
  },
  "0.1.30": {
    releaseName: "TypeUp 0.1.30",
    zh: {
      summary: "本次把打包后的更新源切换到 TypeUp 自有服务器镜像。",
      items: [
        "安装包内置更新地址改为 TypeUp 服务器镜像，减少国内访问 GitHub Release 的不稳定。",
        "保留 electron-updater 标准 latest.yml 和 blockmap 元数据。",
        "该版本作为手动安装基线，用于测试后续服务器托管更新。",
      ],
    },
    en: {
      summary: "This update switches the packaged updater feed to the TypeUp server mirror.",
      items: [
        "The packaged update feed now points to the TypeUp server mirror.",
        "Standard electron-updater latest.yml and blockmap metadata remain available.",
        "This build is the manual install baseline for testing server-hosted updates.",
      ],
    },
  },
  "0.1.29": {
    releaseName: "TypeUp 0.1.29",
    zh: {
      summary: "本次优化 Windows 自动更新下载体验，网络不稳定时会更稳地回退下载。",
      items: [
        "优先使用 Node 流式下载显示真实进度，超时或连接重置时再回退到 PowerShell。",
        "保留安装包大小和 SHA 校验，避免网络波动时误安装不完整文件。",
        "保留 0.1.28 的单实例窗口修复和窗口显示兜底。",
      ],
    },
    en: {
      summary: "This update improves Windows auto-update downloads when the network is unstable.",
      items: [
        "Node streaming download shows real progress first, then falls back to PowerShell after timeouts or resets.",
        "Installer size and SHA checks remain in place to avoid installing incomplete downloads.",
        "The 0.1.28 single-instance and window display fixes remain included.",
      ],
    },
  },
  "0.1.28": {
    releaseName: "TypeUp 0.1.28",
    zh: {
      summary: "本次修复重复打开 TypeUp 时可能出现多个窗口的问题。",
      items: [
        "重复启动源码版或安装版时，会聚焦已有窗口，不再打开两个相同窗口。",
        "增加主窗口显示兜底，避免 Electron 进程启动后窗口一直不显示。",
        "保留 0.1.27 的 AI 指令打开应用、显式选区快照和桌面图标修复。",
      ],
    },
    en: {
      summary: "This update fixes duplicate TypeUp windows when the app is opened repeatedly.",
      items: [
        "Opening TypeUp again now focuses the existing window instead of creating a duplicate.",
        "A main-window visibility fallback prevents the Electron process from running without showing a window.",
        "The 0.1.27 AI app-launch, explicit selection snapshot, and shortcut icon fixes remain included.",
      ],
    },
  },
  "0.1.27": {
    releaseName: "TypeUp 0.1.27",
    zh: {
      summary: "本次修复 Windows 桌面和开始菜单快捷方式仍显示旧图标的问题。",
      items: [
        "安装器会把快捷方式图标直接指向安装目录里的新 ico 文件。",
        "不再只依赖 TypeUp.exe,0，降低 Windows 图标缓存导致旧图标残留的概率。",
        "安装完成后会通知 Windows Shell 刷新图标显示。",
      ],
    },
    en: {
      summary: "This update fixes stale shortcut icons on Windows desktops and Start menus.",
      items: [
        "Installer-created shortcuts now point directly to the installed ico file.",
        "Shortcuts no longer depend only on TypeUp.exe,0, reducing stale Windows icon-cache cases.",
        "The installer notifies Windows Shell to refresh icons after installation.",
      ],
    },
  },
  "0.1.26": {
    releaseName: "TypeUp 0.1.26",
    zh: {
      summary: "本次更新图标资源、左侧功能栏和底部状态栏对齐，并增强 Windows 打包稳定性。",
      items: [
        "更新 TypeUp 应用图标、安装器图标和安装器展示图，安装版会随包携带运行时图标资源。",
        "左侧功能栏新增功能介绍、改进意见和社区，方便测试用户了解能力、提交反馈和查看发布记录。",
        "底部状态栏会跟随窗口宽度变化，并与上方内容右边界对齐。",
        "build:win 会先处理运行中的源码版 TypeUpAgent，减少文件占用导致的打包失败。",
      ],
    },
    en: {
      summary: "This update refreshes icons, adds side navigation pages, aligns the status dock, and hardens Windows packaging.",
      items: [
        "TypeUp now ships refreshed app, installer, and runtime icon assets.",
        "The sidebar adds Features, Feedback, and Community pages for testers.",
        "The bottom status dock now follows the content width and aligns with the main panels.",
        "build:win handles a running source TypeUpAgent before packaging to avoid locked-file failures.",
      ],
    },
  },
  "0.1.25": {
    releaseName: "TypeUp 0.1.25",
    zh: {
      summary: "本次修复 GitHub 更新检查偶发超时导致无法下载更新的问题。",
      items: [
        "更新检查超时时会被正确识别为可重试错误，不再直接停在失败状态。",
        "GitHub API 不稳定时会改从 Release 的 latest.yml 读取最新版本和安装包地址。",
        "更新请求超时时间从 20 秒提高到 45 秒，降低国内网络抖动造成的失败概率。",
      ],
    },
    en: {
      summary: "This update makes GitHub update checks more tolerant of timeouts.",
      items: [
        "Timed-out update checks are now treated as retryable network errors.",
        "If the GitHub API is unstable, TypeUp falls back to the Release latest.yml metadata.",
        "The update request timeout has been raised from 20s to 45s.",
      ],
    },
  },
  "0.1.24": {
    releaseName: "TypeUp 0.1.24",
    zh: {
      summary: "本次修复微润色把用户原话误当成指令、生成测试样例的问题。",
      items: [
        "微润色会把语音转写作为 JSON 字段传给模型，明确区分待处理文本和指令。",
        "如果模型生成“当然可以”“以下是一段测试文本”等非原文内容，会自动回退到本地保守润色。",
        "新增过长、过短总结和包装 JSON 的保护，优先保证不出差错。",
      ],
    },
    en: {
      summary: "This update prevents micro-polish from treating dictated text as a command.",
      items: [
        "Micro-polish now sends transcripts as JSON data so the model does not execute text inside them.",
        "Generated examples or assistant-style replies fall back to conservative local cleanup.",
        "Extra guards catch overlong output, over-short summaries, and JSON-wrapped model replies.",
      ],
    },
  },
  "0.1.23": {
    releaseName: "TypeUp 0.1.23",
    zh: {
      summary: "本次修复 Windows 自动更新下载卡住或安装失败的问题。",
      items: [
        "Windows 打包版更新检查改为直接读取 GitHub Release，并使用已校验的安装包下载链路，避开损坏的 electron-updater 缓存。",
        "点击“立即安装并重启”后，安装器会等待 TypeUp 主进程退出再启动，减少文件占用导致的安装失败。",
        "安装包下载完成后会继续校验大小和 SHA256，避免损坏包进入安装流程。",
      ],
    },
    en: {
      summary: "This update fixes Windows auto-update downloads that could stall or fail to install.",
      items: [
        "Packaged Windows builds now check GitHub Releases directly and use the verified installer download path.",
        "Install-and-restart now launches the installer after the TypeUp main process exits to avoid locked files.",
        "Downloaded installers continue to be checked by size and SHA256 before installation.",
      ],
    },
  },
  "0.1.22": {
    releaseName: "TypeUp 0.1.22",
    zh: {
      summary: "本次继续修复更新按钮 hover 视觉，让安装按钮不会再白底白字。",
      items: [
        "更新横幅里的下载和安装按钮改为专用样式，不再复用通用保存按钮样式。",
        "鼠标移到“立即安装并重启”上时会保持蓝色文字和图标，避免看起来整块变白。",
        "继续保留 0.1.21 的更新说明 HTML 清洗修复。",
      ],
    },
    en: {
      summary: "This update tightens the update-button hover style so install actions stay readable.",
      items: [
        "Download and install buttons in the update banner now use a dedicated style.",
        "Hovering install-and-restart keeps blue text and icons instead of white-on-white.",
        "The release-note HTML cleanup from 0.1.21 remains included.",
      ],
    },
  },
  "0.1.21": {
    releaseName: "TypeUp 0.1.21",
    zh: {
      summary: "本次修复更新说明显示和更新按钮 hover 视觉问题。",
      items: [
        "更新说明会正确清洗 HTML 标签，不再显示 <h2>、<ul>、<li> 这类符号。",
        "立即安装并重启按钮 hover 时会变为白底蓝字，图标不会再消失在白色背景里。",
        "继续保留 0.1.20 的微润色输出优化。",
      ],
    },
    en: {
      summary: "This update fixes release-note rendering and update-button hover contrast.",
      items: [
        "Release notes now strip HTML tags such as <h2>, <ul>, and <li> before display.",
        "The install-and-restart button now keeps clear blue text and icons on hover.",
        "The micro-polish output improvements from 0.1.20 remain included.",
      ],
    },
  },
  "0.1.20": {
    releaseName: "TypeUp 0.1.20",
    zh: {
      summary: "本次重点优化微润色输出，让语音输入更稳地保留原意和说话风格。",
      items: [
        "微润色模式只做轻量清理：去口头填充词、修正明显错字并补齐自然标点。",
        "进一步约束模型不要扩写、总结、翻译或改成公文腔，减少过度改写。",
        "增强输出清洗，自动去掉“润色如下”等模型前缀，避免把说明文字打进输入框。",
      ],
    },
    en: {
      summary: "This update improves micro-polish output so dictated text keeps the original meaning and voice.",
      items: [
        "Micro-polish now focuses on light cleanup: filler words, obvious typos, and natural punctuation.",
        "The model is more strongly guided not to expand, summarize, translate, or over-formalize your words.",
        "Output cleanup now strips model preambles such as “polished text below” before typing.",
      ],
    },
  },
  "0.1.19": {
    releaseName: "TypeUp 0.1.19",
    zh: {
      summary: "本次加入更新后首次打开的版本说明，让你能直接看到这次更新改了什么。",
      items: [
        "更新安装完成并重新打开 TypeUp 后，主界面顶部会显示本次更新内容。",
        "同一个版本的更新说明只显示一次，关闭后不会重复打扰。",
        "后续版本会优先展示 GitHub Release 中填写的真实发布说明。",
      ],
    },
    en: {
      summary: "This update adds a first-launch changelog after TypeUp installs an update.",
      items: [
        "After TypeUp installs an update and reopens, the main screen shows what changed.",
        "Release notes are shown once per version and stay dismissed afterward.",
        "Future versions prefer the release notes published on GitHub Releases.",
      ],
    },
  },
};

export default function App() {
  const [lang, setLang] = useState("zh");
  const [apiBase, setApiBase] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatusState] = useState({ state: "starting" });
  const [usage, setUsage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [auth, setAuth] = useState(EMPTY_AUTH);
  const [authForm, setAuthForm] = useState({ mode: "login", apiBaseUrl: DEFAULT_BACKEND_URL, email: "", password: "" });
  const [plans, setPlans] = useState([]);
  const [accountBusy, setAccountBusy] = useState("");
  const [accountError, setAccountError] = useState("");
  const [lastOrder, setLastOrder] = useState(null);
  const [devices, setDevices] = useState("");
  const [deviceInfo, setDeviceInfo] = useState({ items: [], output: "" });
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS);
  const [saving, setSaving] = useState(false);
  const [updateState, setUpdateState] = useState(DEFAULT_UPDATE_STATE);
  const [releaseNotes, setReleaseNotes] = useState(null);
  const [activeModule, setActiveModule] = useState("home");
  const [historyFilter, setHistoryFilter] = useState("");

  function setStatus(next) {
    setStatusState((current) => (sameStatus(current, next) ? current : next));
  }

  useEffect(() => {
    let mounted = true;
    async function loadBase() {
      const base = window.typeup ? await window.typeup.apiBase() : "";
      if (mounted) setApiBase(base || "http://127.0.0.1:3000");
      if (window.typeup?.platform) {
        const nextPlatform = await window.typeup.platform();
        if (mounted) setPlatform(nextPlatform || "");
      }
    }
    loadBase();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!apiBase) return undefined;
    refreshAll(apiBase, { setStatus, setUsage, setLogs, setSettings });
    refreshPermissions(apiBase, setPermissions);
    refreshDeviceInfo(apiBase, { setDevices, setDeviceInfo }, text.deviceFallback);
    refreshAccount(apiBase, { setAuth, setPlans, setAuthForm, setAccountError });
    const timer = setInterval(() => {
      refreshUsage(apiBase, setUsage);
      refreshStatus(apiBase, setStatus);
      refreshPermissions(apiBase, setPermissions);
    }, 2200);
    const events = new EventSource(`${apiBase}/api/events`);
    events.addEventListener("status", (event) => setStatus(JSON.parse(event.data)));
    events.addEventListener("log", (event) => {
      const item = JSON.parse(event.data);
      setLogs((current) => [item, ...current].slice(0, 120));
    });
    return () => {
      clearInterval(timer);
      events.close();
    };
  }, [apiBase]);

  useEffect(() => {
    if (!window.typeup?.updates) return undefined;
    let mounted = true;
    window.typeup.updates.getState().then((next) => {
      if (mounted && next) setUpdateState(next);
    });
    const unsubscribe = window.typeup.updates.onEvent((next) => {
      if (next) setUpdateState(next);
    });
    return () => {
      mounted = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    const version = updateState.currentVersion;
    if (!version || hasSeenReleaseNotes(version)) return undefined;
    let cancelled = false;
    async function loadReleaseNotes() {
      const pending = await window.typeup?.updates?.getReleaseNotes?.();
      const builtin = builtinReleaseNotes(version);
      const notes = withBuiltinReleaseNotesFallback(normalizeReleaseNotesPayload(pending, version), builtin);
      if (!cancelled && notes && !hasSeenReleaseNotes(notes.version)) {
        setReleaseNotes(notes);
      }
    }
    loadReleaseNotes();
    return () => {
      cancelled = true;
    };
  }, [updateState.currentVersion]);

  const text = COPY[lang];
  const defaultHotkeys = defaultAudioHotkeys(platform);
  const pttKey = settings.audio?.ptt_key || defaultHotkeys.pttKey;
  const aiKey = settings.audio?.ai_key || defaultHotkeys.aiKey;
  const enableKey = settings.audio?.enable_key || defaultHotkeys.enableKey;
  const disableKey = settings.audio?.disable_key || defaultHotkeys.disableKey;
  const polishKey = `${lang === "zh" ? "双击" : "Double"} ${formatHotkey(pttKey, lang, platform)}`;
  const polishStyle = normalizedPolishStyle(settings.audio?.polish_style);
  const statusDockHint = formatStatusDockHint(lang, pttKey, aiKey, enableKey, disableKey, polishKey, platform);
  const engineProcessStopped = ["stopped", "stopping", "error"].includes(status.state);
  const engineAcceptingVoice = ["listening", "transcribing"].includes(status.state);
  const transcriptionStopped = engineAcceptingVoice && status.transcriptionEnabled === false;
  const transcriptionActive = engineAcceptingVoice && !transcriptionStopped;
  const effectiveStatusState = transcriptionStopped ? "transcription_off" : status.state;
  const statusMeta = withDynamicStatusCopy(
    STATUS_COPY[lang][effectiveStatusState] || STATUS_COPY[lang].stopped,
    effectiveStatusState,
    lang,
    pttKey,
    platform,
  );
  const homeGuidance = getHomeGuidance(effectiveStatusState, lang);
  const today = usage?.today || {};
  const totals = usage?.totals || {};
  const days = usage?.days || [];
  const savedTime = formatSavedTime(today.transcribedChars || 0, lang);
  const engineStopped = engineProcessStopped || transcriptionStopped;
  const engineRunning = transcriptionActive;
  const navItems = [
    { id: "home", label: lang === "zh" ? "首页" : "Home", icon: <Home size={18} /> },
    { id: "history", label: lang === "zh" ? "历史" : "History", icon: <History size={18} /> },
    { id: "dictionary", label: lang === "zh" ? "词典" : "Dictionary", icon: <BookOpen size={18} /> },
    { id: "settings", label: text.settings, icon: <Settings size={18} /> },
    { id: "plan", label: lang === "zh" ? "订阅计划" : "Plans", icon: <CreditCard size={18} /> },
    { divider: true },
    { id: "account", label: text.account, icon: <UserRound size={18} /> },
    { id: "privacy", label: lang === "zh" ? "隐私" : "Privacy", icon: <Shield size={18} /> },
    { id: "developer", label: lang === "zh" ? "开发者" : "Developer", icon: <Terminal size={18} /> },
  ];

  const peak = useMemo(() => {
    return Math.max(1, ...days.map((day) => (day.transcribedChars || 0) + (day.aiEditedChars || 0)));
  }, [days]);

  async function agentAction(action) {
    const next = await api(apiBase, `/api/agent/${action}`, { method: "POST" });
    setStatus(next);
    await refreshUsage(apiBase, setUsage);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const next = await persistSettings(settings);
      setSettings(next);
      await refreshStatus(apiBase, setStatus);
    } finally {
      setSaving(false);
    }
  }

  async function saveSettingsPatch(mutator) {
    if (!apiBase) return;
    setSaving(true);
    try {
      const patch = structuredClone(settings);
      mutator(patch);
      setSettings(patch);
      const next = await persistSettings(patch, { audioOnly: true });
      setSettings(next);
      await refreshStatus(apiBase, setStatus);
    } finally {
      setSaving(false);
    }
  }

  async function persistSettings(nextSettings, options = {}) {
    const payload = options.audioOnly
      ? { audio: nextSettings.audio || {} }
      : toManagedSettings(nextSettings);
    return api(apiBase, "/api/settings?restart=1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAccountError("");
    const validationError = validateAuthForm(authForm, text);
    if (validationError) {
      setAccountError(validationError);
      return;
    }
    setAccountBusy(authForm.mode);
    try {
      const session = await api(apiBase, `/api/auth/${authForm.mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiBaseUrl: authForm.apiBaseUrl,
          email: authForm.email,
          password: authForm.password,
        }),
      });
      setAuth(session);
      setAuthForm((current) => ({ ...current, apiBaseUrl: session.apiBaseUrl, password: "" }));
      setLastOrder(null);
      await Promise.all([
        refreshStatus(apiBase, setStatus),
        refreshPlans(apiBase, setPlans, session.apiBaseUrl),
      ]);
    } catch (error) {
      setAccountError(error.message);
    } finally {
      setAccountBusy("");
    }
  }

  async function logout() {
    setAccountBusy("logout");
    setAccountError("");
    try {
      const session = await api(apiBase, "/api/auth/logout", { method: "POST" });
      setAuth(session);
      setLastOrder(null);
      await refreshStatus(apiBase, setStatus);
    } catch (error) {
      setAccountError(error.message);
    } finally {
      setAccountBusy("");
    }
  }

  async function reloadAccount() {
    setAccountBusy("refresh");
    setAccountError("");
    try {
      await refreshAccount(apiBase, { setAuth, setPlans, setAuthForm, setAccountError });
    } finally {
      setAccountBusy("");
    }
  }

  async function createOrder(planId) {
    setAccountBusy(`order:${planId}`);
    setAccountError("");
    try {
      const order = await api(apiBase, "/api/billing/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, payment_method: "alipay" }),
      });
      setLastOrder(order);
      if (order.pay_url) await openPayment(order.pay_url);
    } catch (error) {
      setAccountError(error.message);
    } finally {
      setAccountBusy("");
    }
  }

  async function refreshOrder() {
    if (!lastOrder?.id) return;
    setAccountBusy("order-refresh");
    setAccountError("");
    try {
      const order = await api(apiBase, `/api/billing/orders/${lastOrder.id}`);
      setLastOrder(order);
      if (order.status === "paid") {
        await refreshAccount(apiBase, { setAuth, setPlans, setAuthForm, setAccountError });
      }
    } catch (error) {
      setAccountError(error.message);
    } finally {
      setAccountBusy("");
    }
  }

  async function openPayment(url) {
    if (window.typeup?.openExternal) {
      await window.typeup.openExternal(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function listDevices() {
    const result = await api(apiBase, "/api/devices");
    const info = normalizeDeviceResult(result);
    setDeviceInfo(info);
    setDevices(info.output || text.deviceFallback);
  }

  async function openPermission(name) {
    await api(apiBase, `/api/permissions/${name}/open`, { method: "POST" });
  }

  async function requestPermission(name) {
    await api(apiBase, `/api/permissions/${name}/request`, { method: "POST" });
    await refreshPermissions(apiBase, setPermissions);
  }

  async function requestMicPermission() {
    await api(apiBase, "/api/permissions/microphone/request", { method: "POST" });
    await refreshPermissions(apiBase, setPermissions);
  }

  async function recheckPermissions() {
    await refreshPermissions(apiBase, setPermissions);
  }

  async function revealPermissionTarget() {
    await api(apiBase, "/api/permissions/engine/reveal", { method: "POST" });
  }

  async function checkForUpdates() {
    if (!window.typeup?.updates) return;
    const next = await window.typeup.updates.check();
    if (next) setUpdateState(next);
  }

  async function downloadUpdate() {
    if (!window.typeup?.updates) return;
    const next = await window.typeup.updates.download();
    if (next) setUpdateState(next);
  }

  async function installUpdate() {
    if (!window.typeup?.updates) return;
    const next = await window.typeup.updates.install();
    if (next) setUpdateState(next);
  }

  async function openReleaseNotes() {
    if (!releaseNotes?.releaseUrl) return;
    await openPayment(releaseNotes.releaseUrl);
  }

  async function dismissReleaseNotes() {
    if (!releaseNotes?.version) return;
    markReleaseNotesSeen(releaseNotes.version);
    await window.typeup?.updates?.dismissReleaseNotes?.(releaseNotes.version);
    setReleaseNotes(null);
  }

  async function windowAction(action) {
    await window.typeup?.window?.[action]?.();
  }

  return (
    <main className="app-shell app-canvas">
      <section className="desktop-window">
      <header className="app-titlebar window-bar">
        <div className="brand window-brand">
          <img className="brand-logo" src={mark} alt="" />
          <div>
            <h1 className="brand-word">TypeUp</h1>
          </div>
        </div>
        <div className="window-title" aria-hidden="true" />
        <div className="titlebar-actions window-right">
          <div className="window-controls">
            <button className="window-control minimize" type="button" onClick={() => windowAction("minimize")} aria-label="Minimize" title="Minimize" />
            <button className="window-control maximize" type="button" onClick={() => windowAction("toggleMaximize")} aria-label="Maximize" title="Maximize" />
            <button className="window-control close" type="button" onClick={() => windowAction("close")} aria-label="Close" title="Close" />
          </div>
        </div>
      </header>

      <div className="app-body">
        <UpdateBanner
          text={text}
          updateState={updateState}
          onCheck={checkForUpdates}
          onDownload={downloadUpdate}
          onInstall={installUpdate}
        />
        <ReleaseNotesBanner
          lang={lang}
          notes={releaseNotes}
          onOpen={openReleaseNotes}
          onClose={dismissReleaseNotes}
        />

        <section className="optimized-workspace hub-layout">
          <nav className="side-nav" aria-label="TypeUp sections">
            {navItems.map((item, index) => item.divider ? (
              <div className="nav-spacer" key={`divider-${index}`} />
            ) : (
              <button
                type="button"
                key={item.id}
                className={`nav-item ${activeModule === item.id ? "active" : ""}`}
                onClick={() => setActiveModule(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <section className="content">
            {activeModule === "home" ? (
              <section className="hub-panel active">
                <div className="hub-header">
                  <div>
                    <h1>{lang === "zh" ? "您好，欢迎来到 TypeUp" : "Hello, welcome to TypeUp"}</h1>
                    <p>
                      {lang === "zh"
                        ? "TypeUp 在后台等待快捷键，不打断你当前正在使用的软件。按下快捷键，说话，然后把干净文本写回光标位置。"
                        : "TypeUp waits in the background for your shortcuts, then turns speech into clean text wherever your cursor is."}
                    </p>
                  </div>
                  <div className="header-actions">
                    <button className="ghost-action update-action" type="button" onClick={checkForUpdates}>
                      <RefreshCw size={16} />
                      {text.checkUpdate}
                    </button>
                    <div className={`status-chip ${statusMeta.tone === "warn" ? "warn" : statusMeta.tone === "danger" ? "danger" : ""}`}>
                      <i />
                      {statusMeta.label}
                    </div>
                  </div>
                </div>
                <div className="home-grid">
                  <section className="card voice-card">
                    <div className="voice-visual">
                      <div className={`orb ${engineRunning ? "listening" : ""}`}>
                        <div className="wave" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                        </div>
                      </div>
                    </div>
                    <div className="voice-copy">
                      <div>
                        <h2>{statusMeta.title}</h2>
                        <p>{statusMeta.detail}</p>
                        <div className={`home-guidance ${statusMeta.tone}`}>
                          <span>{statusMeta.label}</span>
                          <strong>{homeGuidance}</strong>
                        </div>
                      </div>
                      <div className="shortcut-list">
                        <ShortcutItem keys={formatHotkey(pttKey, lang, platform)} title={text.shortcutSpeak} detail={text.shortcutSpeakDetail} />
                        <ShortcutItem keys={polishKey} title={text.shortcutPolish} detail={text.shortcutPolishDetail} />
                        <ShortcutItem keys={formatHotkey(aiKey, lang, platform)} title={text.shortcutAi} detail={text.shortcutAiDetail} />
                      </div>
                      <div className="home-engine-actions">
                        <button className={`engine-action start-action ${engineRunning ? "state-active" : ""}`} type="button" onClick={() => agentAction("start")} disabled={!apiBase}>
                          <Play size={18} />
                          {text.start}
                        </button>
                        <button className={`engine-action stop-action ${engineStopped ? "state-active" : ""}`} type="button" onClick={() => agentAction("stop")} disabled={!apiBase}>
                          <Square size={18} />
                          {text.stop}
                        </button>
                        <button className="engine-action ghost" type="button" onClick={() => agentAction("restart")} disabled={!apiBase}>
                          <RefreshCw size={18} />
                          {text.restart}
                        </button>
                      </div>
                    </div>
                  </section>
                  <section className="home-stats-grid" aria-label={text.usage}>
                    <MiniStat label={text.transcribedChars} value={formatNumber(today.transcribedChars, lang)} />
                    <MiniStat label={text.aiEditedChars} value={formatNumber(today.aiEditedChars, lang)} />
                    <MiniStat label={text.savedTime} value={savedTime} />
                    <MiniStat label={text.successfulEvents} value={formatNumber(totals.successfulEvents, lang)} />
                  </section>
                </div>
              </section>
            ) : null}

            {activeModule === "history" ? (
              <HistoryPanel
                lang={lang}
                text={text}
                usage={usage}
                historyFilter={historyFilter}
                setHistoryFilter={setHistoryFilter}
                today={today}
              />
            ) : null}

            {activeModule === "dictionary" ? (
              <section className="hub-panel active">
                <div className="hub-header">
                  <div>
                    <h1>{lang === "zh" ? "词典" : "Dictionary"}</h1>
                    <p>{lang === "zh" ? "把专有名词、输出偏好和插入方式放在一起，减少用户去配置深处寻找的成本。" : "Keep terms, output preferences, and insertion behavior in one place."}</p>
                  </div>
                  <div className="status-chip muted"><i />{lang === "zh" ? "本地优先" : "Local first"}</div>
                </div>
                <div className="settings-layout">
                  <section className="settings-group">
                    <SettingRow title={lang === "zh" ? "专有名词" : "Custom terms"} detail={lang === "zh" ? "产品名、人名和公司名优先保留原写法。" : "Prefer the original spelling for product, person, and company names."}>
                      <button type="button" disabled>{lang === "zh" ? "稍后开放" : "Soon"}</button>
                    </SettingRow>
                    <SettingRow title={lang === "zh" ? "输出语言" : "Output language"} detail={`${lang === "zh" ? "当前配置" : "Current"}: ${settings.stt?.language || "auto"}`}>
                      <span className="select-pill">{settings.stt?.language || "auto"}</span>
                    </SettingRow>
                    <SettingRow title={text.outputStyle} detail={polishStyleDetail(polishStyle, text)}>
                      <span className="select-pill">{polishStyleLabel(polishStyle, text)}</span>
                    </SettingRow>
                    <SettingRow title={text.typing} detail={settings.typing?.method === "clip" ? text.clipboard : text.unicode}>
                      <Segmented
                        label=""
                        value={settings.typing?.method || "unicode"}
                        options={[
                          ["unicode", "Unicode"],
                          ["clip", text.clipboard],
                        ]}
                        onChange={(value) => setNested(setSettings, ["typing", "method"], value)}
                      />
                    </SettingRow>
                  </section>
                  <aside className="side-stack">
                    <section className="card history-card">
                      <div className="card-title"><h2>{lang === "zh" ? "当前配置" : "Current config"}</h2><span>{lang === "zh" ? "只读" : "Read only"}</span></div>
                      <div className="meter">
                        <InfoRow label="STT" value={settings.stt?.model || "glm-asr-2512"} />
                        <InfoRow label="LLM" value={settings.llm?.model || "glm-4-flash"} />
                      </div>
                    </section>
                  </aside>
                </div>
              </section>
            ) : null}

            {activeModule === "settings" ? (
              <section className="hub-panel active">
                <div className="hub-header">
                  <div>
                    <h1>{text.settings}</h1>
                    <p>{lang === "zh" ? "快捷键、麦克风、语言和输入方式使用优化版工作台样式，同时继续接入当前项目的真实配置。" : "Shortcuts, microphone, language, and typing behavior use the optimized workspace while keeping the live settings backend."}</p>
                  </div>
                  <div className="status-chip"><i />{statusMeta.label}</div>
                </div>
                <div className="settings-layout">
                  <section className="settings-group">
                    <SettingRow title={text.language} detail={lang === "zh" ? "切换界面显示语言" : "Switch the interface language"}>
                      <div className="settings-language-switch" aria-label={text.language}>
                        <Languages size={16} />
                        <button type="button" className={lang === "zh" ? "selected" : ""} onClick={() => setLang("zh")}>中文</button>
                        <button type="button" className={lang === "en" ? "selected" : ""} onClick={() => setLang("en")}>EN</button>
                      </div>
                    </SettingRow>
                    <SettingRow title={text.shortcutSpeak} detail={text.shortcutSpeakDetail}>
                      <KeyRow keys={formatHotkey(pttKey, lang, platform)} />
                    </SettingRow>
                    <SettingRow title={text.shortcutStartTranscription} detail={text.shortcutStartTranscriptionDetail}>
                      <KeyRow keys={formatHotkey(enableKey, lang, platform)} />
                    </SettingRow>
                    <SettingRow title={text.shortcutStopTranscription} detail={text.shortcutStopTranscriptionDetail}>
                      <KeyRow keys={formatHotkey(disableKey, lang, platform)} />
                    </SettingRow>
                    <SettingRow title={text.shortcutAi} detail={text.shortcutAiDetail}>
                      <KeyRow keys={formatHotkey(aiKey, lang, platform)} />
                    </SettingRow>
                    <SettingRow title={text.shortcutPolish} detail={text.shortcutPolishDetail}>
                      <KeyRow keys={polishKey} />
                    </SettingRow>
                    <SettingRow title={text.outputStyle} detail={text.outputStyleHint}>
                      <Segmented
                        label=""
                        columns={4}
                        value={polishStyle}
                        options={polishStyleOptions(text)}
                        disabled={saving || !apiBase}
                        onChange={(value) => saveSettingsPatch((next) => {
                          next.audio = next.audio || {};
                          next.audio.polish_style = value;
                        })}
                      />
                    </SettingRow>
                    <div className="setting-row output-style-editor">
                      <div>
                        <strong>{text.outputStyleCustom}</strong>
                        <span>{text.outputStyleCustomDetail}</span>
                      </div>
                      <div className="setting-action">
                        <textarea
                          value={settings.audio?.polish_style_prompt || ""}
                          onChange={(event) => setNested(setSettings, ["audio", "polish_style_prompt"], event.target.value)}
                          placeholder={text.outputStyleCustomPlaceholder}
                          disabled={saving || !apiBase}
                          rows={4}
                        />
                      </div>
                    </div>
                  </section>
                  <aside className="side-stack">
                    <section className="card meter-card">
                      <div className="card-title"><h2>{text.microphone}</h2><span>{text.settings}</span></div>
                      <div className="mic-device">
                        <div>
                          <strong>{lang === "zh" ? "当前麦克风" : "Current microphone"}</strong>
                          <span>{formatCurrentMicrophone(settings.audio?.device, deviceInfo, text, lang)}</span>
                        </div>
                        <button type="button" onClick={listDevices}>{lang === "zh" ? "设备" : "Devices"}</button>
                      </div>
                      <label className="device-select-row">
                        <span>{lang === "zh" ? "录入设备" : "Input device"}</span>
                        <select
                          value={settings.audio?.device || "auto"}
                          onChange={(event) => setNested(setSettings, ["audio", "device"], event.target.value)}
                          disabled={!deviceInfo.items.length}
                        >
                          {deviceOptions(deviceInfo, text, lang).map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      <div className="meter">
                        <button className="save-button" type="button" onClick={saveSettings} disabled={saving || !apiBase}>
                          <Save size={18} />
                          {saving ? text.saving : text.saveAndRestart}
                        </button>
                      </div>
                    </section>
                  </aside>
                </div>
              </section>
            ) : null}

            {activeModule === "plan" ? (
              <PlanHub lang={lang} text={text} auth={auth} plans={plans} accountBusy={accountBusy} onCreateOrder={createOrder} onAccount={() => setActiveModule("account")} />
            ) : null}

            {activeModule === "account" ? (
              <section className="hub-panel active">
                <div className="hub-header">
                  <div>
                    <h1>{text.account}</h1>
                    <p>{lang === "zh" ? "登录状态会保存在本机，后续打开 TypeUp 会自动恢复，也可以随时退出并切换账号。" : "Your session is stored locally and restored on launch. You can sign out or switch accounts at any time."}</p>
                  </div>
                  <div className={`status-chip ${auth.authenticated ? "" : "warn"}`}><i />{auth.authenticated ? text.activeSubscription : text.login}</div>
                </div>
                <div className="account-grid">
                  <AccountPanel
                    text={text}
                    auth={auth}
                    authForm={authForm}
                    setAuthForm={setAuthForm}
                    plans={plans}
                    lastOrder={lastOrder}
                    accountBusy={accountBusy}
                    accountError={accountError}
                    onSubmitAuth={submitAuth}
                    onLogout={logout}
                    onRefresh={reloadAccount}
                    onCreateOrder={createOrder}
                    onRefreshOrder={refreshOrder}
                    onOpenPayment={openPayment}
                    lang={lang}
                  />
                  <aside className="side-stack">
                    <section className="card account-card connection-card">
                      <div className="card-title">
                        <h2>{lang === "zh" ? "连接信息" : "Connection"}</h2>
                        <span>{lang === "zh" ? "本机" : "Local"}</span>
                      </div>
                      <div className="account-id connection-row">
                        <span>{text.backendUrl}</span>
                        <strong>{auth.apiBaseUrl || authForm.apiBaseUrl || DEFAULT_BACKEND_URL}</strong>
                      </div>
                    </section>
                  </aside>
                </div>
                {platform === "darwin" ? (
                  <PermissionsPanel
                    text={text}
                    permissions={permissions.permissions}
                    engineAppPath={permissions.engineAppPath}
                    onOpen={openPermission}
                    onRequest={requestPermission}
                    onRequestMic={requestMicPermission}
                    onRecheck={recheckPermissions}
                    onRevealTarget={revealPermissionTarget}
                    disabled={!apiBase}
                  />
                ) : null}
              </section>
            ) : null}

            {activeModule === "privacy" ? (
              <PrivacyHub lang={lang} status={status} usage={usage} onHistory={() => setActiveModule("history")} onAccount={() => setActiveModule("account")} onDeveloper={() => setActiveModule("developer")} />
            ) : null}

            {activeModule === "developer" ? (
              <DeveloperHub
                lang={lang}
                text={text}
                status={status}
                settings={settings}
                plans={plans}
                permissions={permissions}
                devices={devices}
                logs={logs}
                apiBase={apiBase}
                onStart={() => agentAction("start")}
                onRestart={() => agentAction("restart")}
                onStop={() => agentAction("stop")}
                onDevices={listDevices}
                onMic={requestMicPermission}
                onUpdates={checkForUpdates}
                onAudioChange={(key, value) => setNested(setSettings, ["audio", key], value)}
                onSaveSettings={saveSettings}
                saving={saving}
              />
            ) : null}
          </section>
        </section>
      </div>
      </section>
    </main>
  );
}

function UpdateBanner({ text, updateState, onCheck, onDownload, onInstall }) {
  const status = updateState?.status || "disabled";
  const visibleStatuses = new Set(["checking", "latest", "available", "downloading", "downloaded", "installing", "error"]);
  if (!visibleStatuses.has(status)) return null;

  const version = updateState.availableVersion || "";
  const progress = Math.max(0, Math.min(100, Number(updateState.progress || 0)));
  let tone = "info";
  let title = text.checkUpdate;
  let detail = "";
  let icon = <RefreshCw size={18} />;
  let action = null;

  if (status === "checking") {
    title = text.updateChecking;
    detail = updateState.currentVersion ? `v${updateState.currentVersion}` : "";
  } else if (status === "latest") {
    tone = "ok";
    title = text.updateLatest;
    detail = updateState.currentVersion ? `v${updateState.currentVersion}` : "";
    icon = <CheckCircle2 size={18} />;
    action = (
      <button type="button" onClick={onCheck}>
        <RefreshCw size={16} />
        {text.checkUpdate}
      </button>
    );
  } else if (status === "available") {
    tone = "warn";
    title = text.updateAvailable;
    detail = formatUpdateDetail(text.updateAvailableDetail, version);
    icon = <Download size={18} />;
    action = (
      <button type="button" className="update-action-button" onClick={onDownload}>
        <Download size={16} />
        {text.updateDownload}
      </button>
    );
  } else if (status === "downloading") {
    title = `${text.updateDownloading} ${Math.round(progress)}%`;
    detail = formatUpdateDetail(text.updateAvailableDetail, version);
    icon = <Download size={18} />;
  } else if (status === "downloaded") {
    tone = "ok";
    title = text.updateDownloaded;
    detail = text.updateDownloadedDetail;
    icon = <CheckCircle2 size={18} />;
    action = (
      <button type="button" className="update-action-button" onClick={onInstall}>
        <RefreshCw size={16} />
        {text.updateInstall}
      </button>
    );
  } else if (status === "installing") {
    title = text.updateInstalling;
    detail = text.updateDownloadedDetail;
  } else if (status === "error") {
    tone = "danger";
    title = text.updateError;
    detail = updateState.error || "";
    icon = <AlertCircle size={18} />;
    action = (
      <button type="button" onClick={onCheck}>
        <RefreshCw size={16} />
        {text.checkUpdate}
      </button>
    );
  }

  return (
    <section className={`update-banner ${tone}`}>
      <div className="update-banner-main">
        {icon}
        <div>
          <strong>{title}</strong>
          {detail ? <span>{detail}</span> : null}
        </div>
      </div>
      {status === "downloading" ? (
        <div className="update-progress" aria-label={title}>
          <span style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {action ? <div className="update-banner-actions">{action}</div> : null}
    </section>
  );
}

function ReleaseNotesBanner({ lang, notes, onOpen, onClose }) {
  if (!notes) return null;
  const text = COPY[lang];
  const builtin = builtinReleaseNotes(notes.version);
  const safeNotes = withBuiltinReleaseNotesFallback(notes, builtin);
  const rawItems = localizedReleaseNoteItems(safeNotes, lang);
  const items = rawItems.filter((item) => !looksLikeMojibake(item));
  const rawSummary = localizedReleaseNoteSummary(safeNotes, lang);
  const summary = looksLikeMojibake(rawSummary) ? "" : rawSummary;
  const displaySummary = summary || text.releaseNotesFallback || "This update includes improvements.";
  const title = formatUpdateDetail(text.releaseNotesTitle || "Updated to {version}", notes.version);

  return (
    <section className="release-notes-banner">
      <div className="release-notes-main">
        <WandSparkles size={19} />
        <div>
          <span>{text.releaseNotesSubtitle || "What changed"}</span>
          <strong>{title}</strong>
          <p>{displaySummary}</p>
          {items.length ? (
            <ul>
              {items.slice(0, 5).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="release-notes-actions">
        {notes.releaseUrl ? (
          <button type="button" onClick={onOpen}>
            <ExternalLink size={15} />
            {text.releaseNotesOpen || "View Release"}
          </button>
        ) : null}
        <button type="button" className="icon-button" onClick={onClose} aria-label={text.releaseNotesClose || "Close"} title={text.releaseNotesClose || "Close"}>
          <X size={17} />
        </button>
      </div>
    </section>
  );
}

function formatUpdateDetail(template, version) {
  return String(template || "").replace("{version}", version ? `v${version}` : "新版本");
}

function normalizeReleaseNotesPayload(payload, currentVersion) {
  const version = parseReleaseVersion(payload?.version || currentVersion);
  if (!version) return null;
  return {
    version,
    releaseName: payload?.releaseName || `TypeUp ${version}`,
    releaseNotes: String(payload?.releaseNotes || ""),
    releaseUrl: String(payload?.releaseUrl || ""),
  };
}

function builtinReleaseNotes(version) {
  const normalized = parseReleaseVersion(version);
  const item = BUILTIN_RELEASE_NOTES[normalized];
  if (!item) return null;
  return {
    version: normalized,
    releaseName: item.releaseName || `TypeUp ${normalized}`,
    releaseNotes: "",
    releaseUrl: "",
    localized: item,
  };
}

function hasSeenReleaseNotes(version) {
  try {
    const seen = JSON.parse(window.localStorage.getItem(RELEASE_NOTES_SEEN_KEY) || "{}");
    return Boolean(seen[parseReleaseVersion(version)]);
  } catch (_error) {
    return false;
  }
}

function markReleaseNotesSeen(version) {
  try {
    const seen = JSON.parse(window.localStorage.getItem(RELEASE_NOTES_SEEN_KEY) || "{}");
    seen[parseReleaseVersion(version)] = Date.now();
    window.localStorage.setItem(RELEASE_NOTES_SEEN_KEY, JSON.stringify(seen));
  } catch (_error) {
    // Ignore storage failures; the user can still close the banner for this session.
  }
}

function Shortcut({ label, detail, keys }) {
  return (
    <article className="shortcut-card">
      <div className="keycap-row">
        {String(keys).split("+").map((key) => (
          <span className="keycap" key={key.trim()}>{key.trim()}</span>
        ))}
      </div>
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

function KeyRow({ keys }) {
  const parts = String(keys || "").split("+").map((key) => key.trim()).filter(Boolean);
  return (
    <div className="key-row">
      {parts.map((key, index) => (
        <span key={`${key}-${index}`} className="keycap-pair">
          {index > 0 ? <span className="key-plus">+</span> : null}
          <span className="keycap">{key}</span>
        </span>
      ))}
    </div>
  );
}

function ShortcutItem({ keys, title, detail }) {
  return (
    <div className="shortcut-item">
      <div className="shortcut-main">
        <KeyRow keys={keys} />
        <strong>{title}</strong>
      </div>
      {detail ? <div className="shortcut-detail">{detail}</div> : null}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <article className={`mini-stat ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SettingRow({ title, detail, children }) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <div className="setting-action">{children}</div>
    </div>
  );
}

function HistoryPanel({ lang, text, usage, historyFilter, setHistoryFilter, today }) {
  const recent = (usage?.recent || []).filter((item) => {
    const filter = historyFilter.trim().toLowerCase();
    if (!filter) return true;
    return `${item.text || ""} ${item.mode || ""} ${item.detail || ""}`.toLowerCase().includes(filter);
  });

  return (
    <section className="hub-panel active">
      <div className="hub-header">
        <div>
          <h1>{lang === "zh" ? "历史" : "History"}</h1>
          <p>{lang === "zh" ? "最近的转写和 AI 编辑记录保存在本机，方便复制、查看和排查。" : "Recent transcription and AI editing records are kept locally for review, copying, and debugging."}</p>
        </div>
        <div className="status-chip muted"><i />{lang === "zh" ? "本机记录" : "Local records"}</div>
      </div>
      <div className="stats-grid">
        <article className="stat-card"><strong>{formatNumber(today.transcribedChars, lang)}</strong><span>{text.transcribedChars}</span></article>
        <article className="stat-card"><strong>{formatNumber((today.aiEditedChars || 0) + (today.aiCommandChars || 0), lang)}</strong><span>{text.aiEditedChars}</span></article>
      </div>
      <section className="settings-group">
        <div className="setting-row">
          <div><strong>{lang === "zh" ? "搜索记录" : "Search history"}</strong><span>{lang === "zh" ? "按内容、模式或错误信息快速筛选。" : "Filter by content, mode, or error detail."}</span></div>
          <input value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)} placeholder={lang === "zh" ? "搜索转写或 AI 编辑" : "Search transcription or AI edit"} />
        </div>
      </section>
      <div className="history-list">
        {recent.length ? recent.map((item, index) => (
          <article className="history-item" key={`${item.ts || index}-${index}`}>
            <div className="history-meta">
              <span>{formatTime(item.ts, lang)} · {item.mode || "local"}</span>
              <span>{item.status === "error" ? (lang === "zh" ? "失败" : "Failed") : (lang === "zh" ? "已保存" : "Saved")}</span>
            </div>
            <div className="transcript">{item.text || item.detail || (lang === "zh" ? "空记录" : "Empty record")}</div>
          </article>
        )) : <div className="empty-state">{lang === "zh" ? "还没有本机历史。完成一次语音转写后，这里会显示最近记录。" : "No local history yet. Recent records appear here after a transcription."}</div>}
      </div>
    </section>
  );
}

function PlanHub({ lang, text, auth, plans, accountBusy, onCreateOrder, onAccount }) {
  return (
    <section className="hub-panel active">
      <div className="hub-header">
        <div>
          <h1>{lang === "zh" ? "订阅计划" : "Plans"}</h1>
          <p>{lang === "zh" ? "把免费版和 Pro 的用量边界直接展示出来，避免用户在账号页里寻找限制说明。" : "Show Free and Pro limits directly so users do not need to hunt through account details."}</p>
        </div>
        <div className={`status-chip ${auth.authenticated ? "" : "warn"}`}><i />{auth.authenticated ? text.activeSubscription : text.login}</div>
      </div>
      <div className="plan-grid">
        {(plans.length ? plans : [
          { id: "free", name: "Free", price_cents: 0, currency: "CNY", duration_days: 30 },
          { id: "pro", name: "Pro", price_cents: 0, currency: "CNY", duration_days: 30, featured: true },
        ]).map((plan, index) => (
          <article className={`plan-card ${plan.featured || index === 1 ? "featured" : ""}`} key={plan.id}>
            <div className="plan-heading">
              <div><h2>{plan.name}</h2><p>{index === 0 ? (lang === "zh" ? "适合轻量语音输入和基础 AI 编辑。" : "For light voice input and basic AI editing.") : (lang === "zh" ? "面向高频听写、长文整理和持续办公。" : "For frequent dictation, long-form cleanup, and daily work.")}</p></div>
              <span className="plan-badge">{index === 0 ? (lang === "zh" ? "默认" : "Default") : (lang === "zh" ? "推荐" : "Recommended")}</span>
            </div>
            <div className="plan-feature"><strong>{formatMoney(plan.price_cents, plan.currency, lang)}</strong><span>{plan.duration_days}d</span></div>
            <button className={index === 1 ? "blue-action" : ""} type="button" onClick={plans.length ? () => onCreateOrder(plan.id) : onAccount} disabled={plans.length ? !auth.authenticated || Boolean(accountBusy) : false}>
              {auth.authenticated ? text.createOrder : text.login}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PrivacyHub({ lang, status, usage, onHistory, onAccount, onDeveloper }) {
  return (
    <section className="hub-panel active">
      <div className="hub-header">
        <div>
          <h1>{lang === "zh" ? "隐私" : "Privacy"}</h1>
          <p>{lang === "zh" ? "录音、历史、云端处理和本地保存沿用当前安装包的本地优先架构。" : "Recording, history, cloud processing, and local storage follow the current app's local-first design."}</p>
        </div>
        <div className="status-chip"><i />{lang === "zh" ? "本地优先" : "Local first"}</div>
      </div>
      <div className="settings-layout">
        <section className="settings-group">
          <SettingRow title={lang === "zh" ? "历史保存在本机" : "History stays local"} detail={status.historyPath || usage?.historyPath || (lang === "zh" ? "本机历史文件" : "Local history file")}>
            <button type="button" onClick={onHistory}>{lang === "zh" ? "查看" : "View"}</button>
          </SettingRow>
          <SettingRow title={lang === "zh" ? "云端识别" : "Cloud recognition"} detail={lang === "zh" ? "登录后由后端处理转写和 AI 编辑，令牌保存在本机配置里。" : "After sign-in, transcription and AI editing go through the backend; tokens are stored locally."}>
            <button type="button" onClick={onAccount}>{lang === "zh" ? "账号" : "Account"}</button>
          </SettingRow>
          <SettingRow title={lang === "zh" ? "本地引擎日志" : "Local engine logs"} detail={lang === "zh" ? "用于排查引擎状态，不作为历史内容展示。" : "Used to debug engine state, not displayed as content history."}>
            <button type="button" onClick={onDeveloper}>{lang === "zh" ? "查看" : "View"}</button>
          </SettingRow>
        </section>
      </div>
    </section>
  );
}

function DeveloperHub({
  lang,
  text,
  status,
  settings,
  plans,
  permissions,
  devices,
  logs,
  apiBase,
  onStart,
  onRestart,
  onStop,
  onDevices,
  onMic,
  onUpdates,
  onAudioChange,
  onSaveSettings,
  saving,
}) {
  const logText = logs.length ? logs.map((item) => `${formatTime(item.ts, lang)} ${item.line || ""}`).join("\n") : text.noLogs;
  const engineProcessStopped = ["stopped", "stopping", "error"].includes(status.state);
  const engineAcceptingVoice = ["listening", "transcribing"].includes(status.state);
  const transcriptionStopped = engineAcceptingVoice && status.transcriptionEnabled === false;
  const engineStopped = engineProcessStopped || transcriptionStopped;
  const engineRunning = engineAcceptingVoice && !transcriptionStopped;
  return (
    <section className="hub-panel active">
      <div className="hub-header">
        <div>
          <h1>{lang === "zh" ? "开发者栏目" : "Developer"}</h1>
          <p>{lang === "zh" ? "把底层能力集中放在这里，方便继续接入而不破坏主界面的轻量体验。" : "Low-level controls live here so the main experience stays calm."}</p>
        </div>
        <div className="status-chip muted"><i />{text.backend}</div>
      </div>
      <div className="developer-layout">
        <section className="settings-group">
          <SettingRow title={text.localEngine} detail={lang === "zh" ? "启动、停止、重启和状态检查。" : "Start, stop, restart, and inspect the local engine."}>
            <div className="home-engine-actions developer-engine-actions">
              <button className={`engine-action start-action ${engineRunning ? "state-active" : ""}`} type="button" onClick={onStart} disabled={!apiBase}>
                <Play size={18} />
                {text.start}
              </button>
              <button className={`engine-action stop-action ${engineStopped ? "state-active" : ""}`} type="button" onClick={onStop} disabled={!apiBase}>
                <Square size={18} />
                {text.stop}
              </button>
              <button className="engine-action ghost" type="button" onClick={onRestart} disabled={!apiBase}>
                <RefreshCw size={18} />
                {text.restart}
              </button>
            </div>
          </SettingRow>
          <SettingRow title={lang === "zh" ? "权限与设备" : "Permissions and devices"} detail={lang === "zh" ? "麦克风权限、输入设备列表和平台权限。" : "Microphone permission, input device list, and platform permissions."}>
            <div className="button-row developer-secondary-row">
              <button type="button" onClick={onMic} disabled={!apiBase}>{text.microphone}</button>
              <button type="button" onClick={onDevices} disabled={!apiBase}>{lang === "zh" ? "设备" : "Devices"}</button>
            </div>
          </SettingRow>
          <SettingRow title={lang === "zh" ? "开发者监听参数" : "Developer listening controls"} detail={lang === "zh" ? "临时保留 VAD 和监听模式，面向调试使用。" : "Temporary VAD and listening-mode controls for debugging."}>
            <div className="developer-control-stack">
              <Segmented
                label={text.listenMode}
                value={settings.audio?.mode || "ptt"}
                options={[
                  ["ptt", text.ptt],
                  ["vad", text.vad],
                ]}
                onChange={(value) => onAudioChange("mode", value)}
              />
              <Range label="VAD" value={settings.audio?.vad_aggressiveness ?? 2} onChange={(value) => onAudioChange("vad_aggressiveness", Number(value))} />
              <button className="save-button" type="button" onClick={onSaveSettings} disabled={saving || !apiBase}>
                <Save size={18} />
                {saving ? text.saving : text.saveAndRestart}
              </button>
            </div>
          </SettingRow>
          <SettingRow title={text.checkUpdate} detail={lang === "zh" ? "保留当前安装包的自动更新入口。" : "Keep the current updater entry point."}>
            <button type="button" onClick={onUpdates}>{text.checkUpdate}</button>
          </SettingRow>
        </section>
        <aside className="side-stack">
          <section className="card developer-card">
            <div className="card-title"><h2>{text.logs}</h2><span>{logs.length}</span></div>
            <div className="meter"><pre className="developer-log">{logText}</pre></div>
          </section>
        </aside>
      </div>
      <div className="developer-grid">
        <DebugTile title={lang === "zh" ? "状态" : "Status"} value={status} />
        <DebugTile title={lang === "zh" ? "配置" : "Settings"} value={snapshotSettingsFrom(settings)} />
        <DebugTile title={lang === "zh" ? "后端计划" : "Plans"} value={plans} />
        <DebugTile title={lang === "zh" ? "权限设备" : "Permissions"} value={{ permissions, devices }} />
      </div>
    </section>
  );
}

function DebugTile({ title, value }) {
  return (
    <article className="developer-tile">
      <strong>{title}</strong>
      <span><pre className="json-block">{JSON.stringify(value || {}, null, 2).slice(0, 900)}</pre></span>
    </article>
  );
}

function snapshotSettingsFrom(settings) {
  if (!settings) return {};
  return {
    audio: settings.audio,
    typing: settings.typing,
    stt: {
      provider: settings.stt?.provider,
      model: settings.stt?.model,
      api_base_url: settings.stt?.api_base_url,
    },
    llm: {
      provider: settings.llm?.provider,
      model: settings.llm?.model,
      api_base_url: settings.llm?.api_base_url,
    },
    configPath: settings.configPath,
  };
}

function PermissionsPanel({ text, permissions, engineAppPath, onOpen, onRequest, onRequestMic, onRecheck, onRevealTarget, disabled }) {
  const rows = [
    ["accessibility", text.accessibility],
    ["input_monitoring", text.inputMonitoring],
    ["microphone", text.microphone],
  ];
  return (
    <section className="permissions-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">{text.permissions}</p>
          <h2>{text.permissionCenter}</h2>
        </div>
        <ShieldCheck size={22} />
      </div>
      <p className="permission-hint">{text.permissionHint}</p>
      <div className="permission-target">
        <span>{text.permissionTarget}</span>
        <button type="button" onClick={onRevealTarget} disabled={disabled}>
          <ExternalLink size={15} />
          {text.revealPermissionTarget}
        </button>
        {engineAppPath ? <code>{engineAppPath}</code> : null}
      </div>
      <div className="permission-list">
        {rows.map(([key, label]) => (
          <div className="permission-row" key={key}>
            <div>
              <strong>{label}</strong>
              <span className={`permission-state ${permissionTone(permissions?.[key])}`}>
                {permissionText(permissions?.[key], text)}
              </span>
            </div>
            <button type="button" onClick={() => onOpen(key)} disabled={disabled}>
              <ExternalLink size={15} />
              {text.openSystemSettings}
            </button>
            <button type="button" onClick={() => onRequest(key)} disabled={disabled}>
              <ShieldCheck size={15} />
              {text.requestPermission}
            </button>
          </div>
        ))}
      </div>
      <div className="permission-actions">
        <button type="button" onClick={onRequestMic} disabled={disabled}>
          <Mic size={16} />
          {text.requestMic}
        </button>
        <button type="button" onClick={onRecheck} disabled={disabled}>
          <RefreshCw size={16} />
          {text.recheck}
        </button>
      </div>
      <p className="permission-footer">{text.restartAfterGrant}</p>
    </section>
  );
}

function AccountPanel({
  text,
  auth,
  authForm,
  setAuthForm,
  plans,
  lastOrder,
  accountBusy,
  accountError,
  onSubmitAuth,
  onLogout,
  onRefresh,
  onCreateOrder,
  onRefreshOrder,
  onOpenPayment,
  lang,
}) {
  const entitlement = auth.entitlement || {};
  const sttLimitSeconds = (entitlement.stt_minutes_limit || 0) * 60;
  const sttText = `${formatDuration(entitlement.stt_seconds_used || 0, lang)} / ${formatDuration(sttLimitSeconds, lang)}`;
  const aiText = `${formatNumber(entitlement.ai_requests_used || 0, lang)} / ${formatNumber(entitlement.ai_requests_limit || 0, lang)}`;

  return (
    <section className="account-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">{text.account}</p>
          <h2>{text.accountCenter}</h2>
        </div>
        <UserRound size={22} />
      </div>

      {!auth.authenticated ? (
        <form className="account-form" onSubmit={onSubmitAuth}>
          <FormInput
            label={text.backendUrl}
            value={authForm.apiBaseUrl}
            onChange={(value) => setAuthForm((current) => ({ ...current, apiBaseUrl: value }))}
          />
          <div className="auth-mode">
            <button type="button" className={authForm.mode === "login" ? "selected" : ""} onClick={() => setAuthForm((current) => ({ ...current, mode: "login" }))}>
              {text.login}
            </button>
            <button type="button" className={authForm.mode === "register" ? "selected" : ""} onClick={() => setAuthForm((current) => ({ ...current, mode: "register" }))}>
              {text.register}
            </button>
          </div>
          <FormInput
            label={text.email}
            value={authForm.email}
            onChange={(value) => setAuthForm((current) => ({ ...current, email: value }))}
          />
          <FormInput
            label={text.password}
            value={authForm.password}
            type="password"
            onChange={(value) => setAuthForm((current) => ({ ...current, password: value }))}
          />
          <p className="account-hint">{text.authHint}</p>
          <button className="save-button" type="submit" disabled={Boolean(accountBusy)}>
            <LogIn size={18} />
            {accountBusy ? text.saving : authForm.mode === "register" ? text.register : text.login}
          </button>
        </form>
      ) : (
        <div className="account-summary">
          <div className="signed-user">
            <span>{text.signedInAs}</span>
            <strong>{auth.user?.email || "-"}</strong>
          </div>
          <div className={`subscription-card ${entitlement.active ? "active" : "inactive"}`}>
            <div>
              <span>{text.subscription}</span>
              <strong>{entitlement.active ? text.activeSubscription : text.noSubscription}</strong>
            </div>
            <CheckCircle2 size={20} />
          </div>
          <InfoRow label={text.sttQuota} value={sttText} />
          <InfoRow label={text.aiQuota} value={aiText} />
          <div className="account-actions">
            <button type="button" onClick={onRefresh} disabled={Boolean(accountBusy)}>
              <RefreshCw size={18} />
              {text.refreshAccount}
            </button>
            <button type="button" onClick={onLogout} disabled={Boolean(accountBusy)}>
              <LogOut size={18} />
              {text.logout}
            </button>
          </div>
        </div>
      )}

      {accountError ? (
        <div className="notice danger account-error">
          <AlertCircle size={18} />
          <span>{accountError}</span>
        </div>
      ) : null}

      <div className="plans-block">
        <div className="plans-heading">
          <span>{text.plans}</span>
          <Cloud size={16} />
        </div>
        {plans.length ? plans.map((plan) => (
          <article className="plan-card" key={plan.id}>
            <div>
              <strong>{plan.name}</strong>
              <span>{formatMoney(plan.price_cents, plan.currency, lang)} / {plan.duration_days}d</span>
            </div>
            <button type="button" onClick={() => onCreateOrder(plan.id)} disabled={!auth.authenticated || accountBusy === `order:${plan.id}`}>
              <CreditCard size={16} />
              {text.createOrder}
            </button>
          </article>
        )) : (
          <p className="account-hint">{auth.apiBaseUrl}</p>
        )}
      </div>

      {lastOrder ? (
        <div className="order-card">
          <InfoRow label={text.orderStatus} value={lastOrder.status} />
          <div className="account-actions">
            {lastOrder.pay_url ? (
              <button type="button" onClick={() => onOpenPayment(lastOrder.pay_url)}>
                <ExternalLink size={18} />
                {text.openPayment}
              </button>
            ) : null}
            <button type="button" onClick={onRefreshOrder} disabled={accountBusy === "order-refresh"}>
              <RefreshCw size={18} />
              {text.pollOrder}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FeaturesPanel({ text }) {
  const items = [
    [text.featureVoiceTitle, text.featureVoiceDetail, <Mic size={20} />],
    [text.featureAiTitle, text.featureAiDetail, <WandSparkles size={20} />],
    [text.featurePolishTitle, text.featurePolishDetail, <FileText size={20} />],
    [text.featurePrivateTitle, text.featurePrivateDetail, <ShieldCheck size={20} />],
  ];

  return (
    <section className="feature-panel">
      <div className="page-hero">
        <p className="eyebrow">{text.features}</p>
        <h2>TypeUp</h2>
        <p>{text.featuresSub}</p>
      </div>
      <div className="feature-grid">
        {items.map(([title, detail, icon]) => (
          <article className="feature-card" key={title}>
            <div className="feature-icon">{icon}</div>
            <strong>{title}</strong>
            <span>{detail}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeedbackPanel({ text, lang, onOpen }) {
  const [value, setValue] = useState("");

  function openIssue() {
    const title = encodeURIComponent(text.feedbackIssueTitle);
    const body = encodeURIComponent(value.trim() || text.feedbackIssueBody);
    onOpen(`https://github.com/oxygen0827/typeup-win/issues/new?title=${title}&body=${body}`);
  }

  return (
    <section className="feedback-panel">
      <div className="page-hero">
        <p className="eyebrow">{text.feedback}</p>
        <h2>{text.feedback}</h2>
        <p>{text.feedbackSub}</p>
      </div>
      <label className="feedback-box">
        <span>{text.feedbackLabel}</span>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={text.feedbackPlaceholder}
          lang={lang === "zh" ? "zh-CN" : "en"}
        />
      </label>
      <div className="feedback-actions">
        <button type="button" className="save-button compact" onClick={openIssue}>
          <ExternalLink size={18} />
          {text.feedbackOpenIssues}
        </button>
      </div>
    </section>
  );
}

function CommunityPanel({ text, onOpen }) {
  const links = [
    [text.openRepo, "https://github.com/oxygen0827/typeup-win", <Cloud size={18} />],
    [text.openReleases, "https://github.com/oxygen0827/typeup-win/releases", <Download size={18} />],
    [text.openIssues, "https://github.com/oxygen0827/typeup-win/issues", <ExternalLink size={18} />],
  ];

  return (
    <section className="community-panel">
      <div className="page-hero">
        <p className="eyebrow">{text.community}</p>
        <h2>{text.community}</h2>
        <p>{text.communitySub}</p>
      </div>
      <div className="community-grid">
        {links.map(([label, url, icon]) => (
          <button type="button" key={label} onClick={() => onOpen(url)}>
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Metric({ icon, label, value, accent }) {
  return (
    <article className={`metric-card ${accent}`}>
      <div>{icon}</div>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function TrendChart({ days, peak, lang }) {
  const points = days.length ? days : [];
  const width = 680;
  const height = 170;
  const left = 22;
  const right = 20;
  const top = 16;
  const bottom = 36;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const linePoints = points.map((day, index) => {
    const value = (day.transcribedChars || 0) + (day.aiEditedChars || 0);
    const x = left + (points.length <= 1 ? chartWidth : (index / (points.length - 1)) * chartWidth);
    const y = top + chartHeight - (value / peak) * chartHeight;
    return { x, y, value, label: day.label };
  });

  const polyline = linePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const area = linePoints.length
    ? `${left},${height - bottom} ${polyline} ${width - right},${height - bottom}`
    : "";

  return (
    <div className="trend-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={COPY[lang].usage}>
        <defs>
          <linearGradient id="trendArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f9fb1" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0f9fb1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((row) => {
          const y = top + (row / 2) * chartHeight;
          return <line key={row} x1={left} x2={width - right} y1={y} y2={y} />;
        })}
        {area ? <polygon points={area} /> : null}
        {polyline ? <polyline points={polyline} /> : null}
        {linePoints.map((point) => (
          <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="4.5" />
        ))}
        {linePoints.map((point) => (
          <text key={`${point.label}-label`} x={point.x} y={height - 10}>{point.label}</text>
        ))}
      </svg>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FormInput({ label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ReadonlyField({ label, value }) {
  return (
    <div className="field readonly-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([id, labelText]) => <option key={id} value={id}>{labelText}</option>)}
      </select>
    </label>
  );
}

function Segmented({ label, value, onChange, options, columns, disabled = false }) {
  const style = columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined;
  const className = columns && columns > 2 ? "field segmented-field-wide" : "field";
  return (
    <div className={className}>
      {label ? <span>{label}</span> : null}
      <div className="segmented" style={style}>
        {options.map(([id, labelText]) => (
          <button type="button" key={id} className={value === id ? "selected" : ""} onClick={() => onChange(id)} disabled={disabled}>
            {labelText}
          </button>
        ))}
      </div>
    </div>
  );
}

function Range({ label, value, onChange }) {
  return (
    <label className="field range-field">
      <span>{label}</span>
      <input min="0" max="3" step="1" type="range" value={value} onChange={(event) => onChange(event.target.value)} />
      <strong>{value}</strong>
    </label>
  );
}

async function refreshAll(apiBase, setters) {
  await Promise.all([
    refreshStatus(apiBase, setters.setStatus),
    refreshUsage(apiBase, setters.setUsage),
    api(apiBase, "/api/logs").then((data) => setters.setLogs((data.logs || []).slice().reverse())),
    api(apiBase, "/api/settings").then(setters.setSettings),
  ]);
}

async function refreshPermissions(apiBase, setPermissions) {
  try {
    const data = await api(apiBase, "/api/permissions");
    setPermissions(data || EMPTY_PERMISSIONS);
  } catch (_error) {
    setPermissions(EMPTY_PERMISSIONS);
  }
}

async function refreshAccount(apiBase, setters) {
  try {
    const session = await api(apiBase, "/api/auth/session");
    setters.setAuth(session);
    setters.setAuthForm((current) => ({
      ...current,
      apiBaseUrl: session.apiBaseUrl || current.apiBaseUrl || DEFAULT_BACKEND_URL,
    }));
    if (session.connected) {
      await refreshPlans(apiBase, setters.setPlans, session.apiBaseUrl);
    } else {
      setters.setPlans([]);
    }
  } catch (error) {
    setters.setAccountError(error.message);
  }
}

async function refreshPlans(apiBase, setPlans, backendUrl) {
  const query = backendUrl ? `?apiBaseUrl=${encodeURIComponent(backendUrl)}` : "";
  const data = await api(apiBase, `/api/billing/plans${query}`);
  setPlans(Array.isArray(data) ? data : []);
}

async function refreshStatus(apiBase, setStatus) {
  const data = await api(apiBase, "/api/status");
  setStatus(data);
}

async function refreshUsage(apiBase, setUsage) {
  const data = await api(apiBase, "/api/usage");
  setUsage(data);
}

async function refreshDeviceInfo(apiBase, setters, fallback) {
  try {
    const data = await api(apiBase, "/api/devices");
    const info = normalizeDeviceResult(data);
    setters.setDeviceInfo(info);
    setters.setDevices(info.output || fallback);
  } catch (_error) {
    setters.setDeviceInfo({ items: [], output: "" });
    setters.setDevices("");
  }
}

async function api(apiBase, path, options) {
  const response = await fetch(`${apiBase}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(formatApiError(body, response.statusText));
  }
  return body;
}

function normalizeDeviceResult(result) {
  const output = String(result?.output || "");
  const items = Array.isArray(result?.devices) ? result.devices : parseDeviceOutput(output);
  return { output, items };
}

function parseDeviceOutput(output) {
  return String(output || "")
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\s*\[\s*(\d+)\]\s+(.+?)(?:\s*(?:←\s*系统默认|<-\s*default))?\s*$/);
      if (!match) return null;
      return {
        id: Number(match[1]),
        name: match[2].trim(),
        default: /系统默认|<-\s*default/i.test(line),
      };
    })
    .filter(Boolean);
}

function deviceOptions(deviceInfo, text, lang) {
  const items = deviceInfo?.items || [];
  const defaultDevice = items.find((item) => item.default) || items[0];
  const autoLabel = defaultDevice
    ? `${lang === "zh" ? "自动选择" : "Auto-detect"} (${defaultDevice.name})`
    : `${lang === "zh" ? "自动选择" : "Auto-detect"} (${text.deviceFallback})`;
  return [
    { value: "auto", label: autoLabel },
    ...items.map((item) => ({
      value: String(item.id),
      label: `${item.name}${item.default ? (lang === "zh" ? "（系统默认）" : " (system default)") : ""}`,
    })),
  ];
}

function formatCurrentMicrophone(configuredDevice, deviceInfo, text, lang) {
  const value = String(configuredDevice || "auto");
  const items = deviceInfo?.items || [];
  if (!items.length) return text.deviceFallback;
  if (value === "auto") {
    const item = items.find((device) => device.default) || items[0];
    return item ? `${lang === "zh" ? "自动选择" : "Auto-detect"}：${item.name}` : text.deviceFallback;
  }
  const configured = items.find((item) => String(item.id) === value || item.name.toLowerCase().includes(value.toLowerCase()));
  return configured?.name || value || text.deviceFallback;
}

function normalizedPolishStyle(value) {
  const style = String(value || "micro").trim().toLowerCase();
  return POLISH_STYLE_IDS.includes(style) ? style : "micro";
}

function polishStyleOptions(text) {
  return POLISH_STYLE_IDS.map((style) => [style, polishStyleLabel(style, text)]);
}

function polishStyleLabel(style, text) {
  const labels = {
    micro: text.outputStyleMicro,
    prompt: text.outputStylePrompt,
    formal: text.outputStyleFormal,
    concise: text.outputStyleConcise,
  };
  return labels[normalizedPolishStyle(style)] || text.outputStyleMicro;
}

function polishStyleDetail(style, text) {
  const details = {
    micro: text.outputStyleMicroDetail,
    prompt: text.outputStylePromptDetail,
    formal: text.outputStyleFormalDetail,
    concise: text.outputStyleConciseDetail,
  };
  return details[normalizedPolishStyle(style)] || text.outputStyleMicroDetail;
}

function setNested(setter, path, value) {
  setter((current) => {
    const next = structuredClone(current);
    let cursor = next;
    for (let i = 0; i < path.length - 1; i += 1) {
      cursor[path[i]] = cursor[path[i]] || {};
      cursor = cursor[path[i]];
    }
    cursor[path[path.length - 1]] = value;
    return next;
  });
}

function toManagedSettings(settings) {
  const { toggle_key: _toggleKey, ...audio } = settings.audio || {};
  return {
    ...settings,
    audio,
    stt: {
      ...(settings.stt || {}),
      provider: "typeup_backend",
      api_key: "",
    },
    llm: {
      ...(settings.llm || {}),
      provider: "typeup_backend",
      api_key: "",
    },
  };
}

function validateAuthForm(form, text) {
  const email = String(form.email || "").trim();
  const password = String(form.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return text.invalidEmail;
  }
  if (!password) {
    return text.passwordRequired;
  }
  if (form.mode === "register" && password.length < 8) {
    return text.registerPasswordTooShort;
  }
  return "";
}

function defaultAudioHotkeys(platform = "") {
  if (platform === "darwin") {
    return { pttKey: "shift_r", aiKey: "alt_r", enableKey: "", disableKey: "" };
  }
  return { pttKey: "alt_r", aiKey: ["alt_r", "shift_r"], enableKey: ["ctrl", "o"], disableKey: ["ctrl", "p"] };
}

function withDynamicStatusCopy(meta, state, lang, pttKey, platform = "") {
  if (state !== "listening") return meta;
  const key = formatHotkey(pttKey, lang, platform);
  return {
    ...meta,
    title: lang === "zh" ? `按住 ${key} 开始说话` : `Hold ${key} to speak`,
  };
}

function getHomeGuidance(state, lang = "zh") {
  const zh = {
    stopped: "点击启动后即可用快捷键开始转写",
    transcription_off: "需要语音输入时点击启动转写",
    stopping: "正在释放资源，稍后可重新启动",
    starting: "正在准备本地引擎，请稍候",
    listening: "现在可以长按快捷键说话",
    transcribing: "正在转写，松开后会输入到光标处",
    error: "建议重启本地引擎恢复服务",
  };
  const en = {
    stopped: "Start it, then use the shortcut to dictate",
    transcription_off: "Start transcription when you need voice input",
    stopping: "Releasing resources, restart shortly",
    starting: "Preparing the local engine",
    listening: "Hold the shortcut to speak now",
    transcribing: "Transcribing and will type at the cursor",
    error: "Restart the local engine to recover",
  };
  const copy = lang === "zh" ? zh : en;
  return copy[state] || copy.stopped;
}

function looksLikeMojibake(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const questionRuns = (text.match(/\?{4,}/g) || []).join("").length;
  const replacementChars = (text.match(/\uFFFD/g) || []).length;
  return questionRuns >= 8 || replacementChars >= 2;
}

function formatStatusDockHint(lang, pttKey, aiKey, enableKey, disableKey, polishKey, platform = "") {
  const speak = formatHotkey(pttKey, lang, platform);
  const ai = formatHotkey(aiKey, lang, platform);
  const enable = enableKey ? formatHotkey(enableKey, lang, platform) : "";
  const disable = disableKey ? formatHotkey(disableKey, lang, platform) : "";
  if (lang === "zh") {
    const switchPart = enable && disable ? `${enable} 启动转写，${disable} 停止转写，` : "";
    return `${speak} 说话，${switchPart}${ai} 进行 AI 编辑，${polishKey} 切换润色模式`;
  }
  const switchPart = enable && disable ? `${enable} starts transcription, ${disable} stops transcription, ` : "";
  return `${speak} to speak, ${switchPart}${ai} for AI editing, ${polishKey} to switch polish mode`;
}

function formatHotkey(value, lang, platform = "") {
  const tokens = Array.isArray(value) ? value : [value];
  const visibleTokens = tokens.filter((token) => String(token || "").trim());
  if (!visibleTokens.length) return "-";
  return visibleTokens
    .map((token) => {
      const text = String(token || "").toLowerCase();
      if (text === "alt") return "ALT";
      if (text === "alt_l" || text === "left_alt") return platform === "darwin" ? (lang === "zh" ? "左 OPTION" : "LEFT OPTION") : "ALT";
      if (text === "alt_r" || text === "right_alt") return platform === "darwin" ? (lang === "zh" ? "右 OPTION" : "RIGHT OPTION") : "RIGHT ALT";
      if (text === "ctrl" || text === "control" || text === "ctrl_l" || text === "ctrl_r" || text === "right_ctrl" || text === "left_ctrl") return "CTRL";
      if (text === "space") return lang === "zh" ? "SPACE" : "SPACE";
      if (text === "shift_l" || text === "left_shift") return lang === "zh" ? "左 SHIFT" : "LEFT SHIFT";
      if (text === "shift_r" || text === "right_shift") return lang === "zh" ? "右 SHIFT" : "RIGHT SHIFT";
      if (text === "cmd_l" || text === "cmd_r") return platform === "darwin" ? "COMMAND" : "WIN";
      return text.toUpperCase();
    })
    .join(" + ");
}

function permissionTone(value) {
  if (value === "granted") return "ok";
  if (value === "denied") return "danger";
  if (value === "not_determined") return "warn";
  return "muted";
}

function permissionText(value, text) {
  if (value === "granted") return text.permissionGranted;
  if (value === "denied") return text.permissionDenied;
  if (value === "not_determined") return text.permissionPending;
  return text.permissionUnknown;
}

function sameStatus(left, right) {
  if (!left || !right) return left === right;
  return STATUS_KEYS.every((key) => left[key] === right[key]);
}

function formatNumber(value = 0, lang = "zh") {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US").format(value || 0);
}

function formatMoney(cents = 0, currency = "CNY", lang = "zh") {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: currency || "CNY",
  }).format((cents || 0) / 100);
}

function formatDuration(seconds = 0, lang = "zh") {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return lang === "zh" ? `${value} 秒` : `${value}s`;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  if (minutes < 60) return lang === "zh" ? `${minutes} 分 ${rest} 秒` : `${minutes}m ${rest}s`;
  const hours = Math.floor(minutes / 60);
  const minuteRest = minutes % 60;
  return lang === "zh" ? `${hours} 小时 ${minuteRest} 分` : `${hours}h ${minuteRest}m`;
}

function formatApiError(body, fallback) {
  if (body && typeof body === "object") {
    return body.error?.message || body.detail || body.message || fallback;
  }
  return body || fallback;
}

function formatSavedTime(chars = 0, lang = "zh") {
  const seconds = Math.round(((chars || 0) / 100) * 60);
  if (seconds < 60) return lang === "zh" ? `${seconds} 秒` : `${seconds}s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return lang === "zh" ? `${minutes} 分 ${rest} 秒` : `${minutes}m ${rest}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return lang === "zh" ? `${hours} 小时 ${minutes} 分` : `${hours}h ${minutes}m`;
}

function formatTime(ts, lang = "zh") {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}
