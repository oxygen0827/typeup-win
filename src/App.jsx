import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cloud,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Languages,
  LogIn,
  LogOut,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Square,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import mark from "./assets/typeup-mark.png";
import {
  localizedReleaseNoteItems,
  localizedReleaseNoteSummary,
  parseReleaseVersion,
} from "./releaseNotes.mjs";

const STATUS_COPY = {
  zh: {
    stopped: { label: "已停止", title: "本地引擎已停止", detail: "点击启动后，TypeUp 会回到后台等待语音输入。", tone: "muted" },
    stopping: { label: "停止中", title: "正在停止引擎", detail: "正在释放麦克风和键盘监听。", tone: "muted" },
    starting: { label: "启动中", title: "正在启动本地引擎", detail: "正在加载语音、输入和 AI 编辑模块。", tone: "warn" },
    listening: { label: "就绪", title: "按住快捷键开始说话", detail: "松开后自动转写并输入到当前光标位置。", tone: "ok" },
    transcribing: { label: "处理中", title: "正在转写或编辑", detail: "结果完成后会自动写入当前窗口。", tone: "active" },
    needs_config: { label: "等待配置", title: "需要填写 STT Key", detail: "保存配置后会自动重启本地引擎。", tone: "warn" },
    error: { label: "异常", title: "本地引擎遇到问题", detail: "查看日志定位错误，修复后可直接重启。", tone: "danger" },
  },
  en: {
    stopped: { label: "Stopped", title: "Local engine is stopped", detail: "Start it to return TypeUp to background voice input.", tone: "muted" },
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
    statusDockReady: "TypeUp 已接管预览页热键",
    statusDockHint: "快捷键会根据当前平台和配置显示。",
    shortcutSpeak: "开始说话",
    shortcutSpeakDetail: "松开后转写到当前光标",
    shortcutAi: "AI 编辑",
    shortcutAiDetail: "按住组合键处理当前文字",
    shortcutPolish: "切换润色模式",
    shortcutPolishDetail: "原生与微润色之间切换",
    modeDisplay: "润色模式",
    permissions: "权限",
    permissionCenter: "macOS 权限",
    permissionHint: "参考轻量版 Voice Keyboard：授权后才能监听热键、录音并输入文字。",
    permissionTarget: "需要授权的是 TypeUp 内嵌引擎，不是你本机独立安装的 Voice Keyboard。",
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
    statusDockReady: "TypeUp is using the preview shortcuts",
    statusDockHint: "Shortcuts follow the current platform and settings.",
    shortcutSpeak: "Start Speaking",
    shortcutSpeakDetail: "Release to type at the cursor",
    shortcutAi: "AI Edit",
    shortcutAiDetail: "Hold the combo to edit text",
    shortcutPolish: "Switch Polish Mode",
    shortcutPolishDetail: "Toggle original and light polish",
    modeDisplay: "Polish Mode",
    permissions: "Permissions",
    permissionCenter: "macOS Permissions",
    permissionHint: "Mirrors the lightweight Voice Keyboard app: required for hotkeys, recording, and typing.",
    permissionTarget: "Grant permissions to the embedded TypeUp engine, not a separately installed Voice Keyboard app.",
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

const EMPTY_SETTINGS = {
  stt: { provider: "typeup_backend", api_base_url: DEFAULT_BACKEND_URL, access_token: "", model: "glm-asr-2512", language: "zh" },
  audio: { mode: "ptt", device: "auto", vad_aggressiveness: 2 },
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
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS);
  const [saving, setSaving] = useState(false);
  const [updateState, setUpdateState] = useState(DEFAULT_UPDATE_STATE);
  const [releaseNotes, setReleaseNotes] = useState(null);
  const [activeModule, setActiveModule] = useState("voice");

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
      const notes = normalizeReleaseNotesPayload(pending, version) || builtinReleaseNotes(version);
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
  const polishKey = `${lang === "zh" ? "双击" : "Double"} ${formatHotkey(pttKey, lang, platform)}`;
  const statusDockHint = formatStatusDockHint(lang, pttKey, aiKey, polishKey, platform);
  const statusMeta = withDynamicStatusCopy(
    STATUS_COPY[lang][status.state] || STATUS_COPY[lang].stopped,
    status.state,
    lang,
    pttKey,
    platform,
  );
  const today = usage?.today || {};
  const totals = usage?.totals || {};
  const days = usage?.days || [];
  const activeChars = (today.transcribedChars || 0) + (today.aiEditedChars || 0);
  const savedTime = formatSavedTime(activeChars, lang);
  const engineStopped = ["stopped", "stopping", "error"].includes(status.state);
  const engineRunning = !engineStopped;
  const moduleItems = [
    { id: "voice", label: text.voiceConsole, detail: statusMeta.label, icon: <Mic size={18} /> },
    {
      id: "account",
      label: text.accountCenter,
      detail: auth.authenticated ? auth.user?.email || text.activeSubscription : text.login,
      icon: <UserRound size={18} />,
    },
    { id: "usage", label: text.usage, detail: text.usageRange, icon: <Activity size={18} /> },
    { id: "features", label: text.features, detail: text.featuresNavDetail, icon: <ShieldCheck size={18} /> },
    { id: "feedback", label: text.feedback, detail: text.feedbackNavDetail, icon: <FileText size={18} /> },
    { id: "community", label: text.community, detail: text.communityNavDetail, icon: <ExternalLink size={18} /> },
    { id: "settings", label: text.settings, detail: text.speechModel, icon: <Settings size={18} /> },
    { id: "logs", label: text.logs, detail: text.backend, icon: <Pause size={18} /> },
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
      const next = await api(apiBase, "/api/settings?restart=1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toManagedSettings(settings)),
      });
      setSettings(next);
      await refreshStatus(apiBase, setStatus);
    } finally {
      setSaving(false);
    }
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
    setDevices(result.output || text.deviceFallback);
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

  return (
    <main className="app-shell">
      <header className="app-titlebar">
        <div className="brand">
          <img src={mark} alt="" />
          <div>
            <h1>TypeUp</h1>
          </div>
        </div>
        <div className="titlebar-actions">
          <button
            type="button"
            className="update-check-button"
            onClick={checkForUpdates}
            disabled={["checking", "downloading", "installing", "disabled"].includes(updateState.status)}
          >
            <RefreshCw size={16} />
            {text.checkUpdate}
          </button>
          <div className="language-switch" aria-label={text.language}>
            <Languages size={16} />
            <button className={lang === "zh" ? "selected" : ""} onClick={() => setLang("zh")}>中文</button>
            <button className={lang === "en" ? "selected" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          <div className={`status-pill ${statusMeta.tone}`}>
            <span />
            {statusMeta.label}
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

        <section className="app-workspace">
          <nav className="module-nav" aria-label="TypeUp modules">
            {moduleItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={activeModule === item.id ? "selected" : ""}
                onClick={() => setActiveModule(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </button>
            ))}
          </nav>

          <div className="module-content">
            <div className={activeModule === "voice" ? "module-view active" : "module-view"}>
              <section className="voice-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{text.localEngine}</p>
                    <h2>{text.voiceConsole}</h2>
                  </div>
                </div>

                <div className="voice-grid">
                  <div className={`voice-orb ${statusMeta.tone}`}>
                    <div className="orb-ring" />
                    <div className="orb-core">
                      <Mic size={34} />
                    </div>
                    <div className="wave-lines" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>

                  <div className="voice-state">
                    <div className={`state-badge ${statusMeta.tone}`}>
                      <span />
                      {statusMeta.label}
                    </div>
                    <h3>{statusMeta.title}</h3>
                    <p>{statusMeta.detail}</p>
                    <div className="mode-card">
                      <span>{text.modeDisplay}</span>
                      <div>
                        <strong>{text.original}</strong>
                        <i />
                        <strong>{text.lightPolish}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="engine-card">
                    <InfoRow label={text.process} value={status.pid ? `PID ${status.pid}` : text.notRunning} />
                    <InfoRow label={text.listenMode} value={status.mode === "ptt" ? text.pushToTalk : text.alwaysOn} />
                    <InfoRow label={text.stt} value={status.provider || text.notConfigured} />
                    <InfoRow label={text.typing} value={status.typingMethod === "clip" ? text.clipboard : text.unicode} />
                  </div>
                </div>

                {status.lastError ? (
                  <div className="notice danger">
                    <AlertCircle size={18} />
                    <span>{status.lastError}</span>
                  </div>
                ) : null}
                {!status.configured ? (
                  <div className="notice warn">
                    <AlertCircle size={18} />
                    <span>{text.missingConfig}</span>
                  </div>
                ) : (
                  <div className="notice ok">
                    <CheckCircle2 size={18} />
                    <span>{text.configured}</span>
                  </div>
                )}

                <div className="actions">
                  <button className={engineRunning ? "state-active" : ""} onClick={() => agentAction("start")} disabled={!apiBase}>
                    <Play size={18} />
                    {text.start}
                  </button>
                  <button className={engineStopped ? "state-active" : ""} onClick={() => agentAction("stop")} disabled={!apiBase}>
                    <Square size={18} />
                    {text.stop}
                  </button>
                  <button onClick={() => agentAction("restart")} disabled={!apiBase}>
                    <RefreshCw size={18} />
                    {text.restart}
                  </button>
                  <button onClick={listDevices} disabled={!apiBase}>
                    <Mic size={18} />
                    {text.microphone}
                  </button>
                </div>
              </section>

              <section className="shortcut-panel">
                <div className="panel-heading compact">
                  <div>
                    <p className="eyebrow">{text.shortcuts}</p>
                    <h2>{formatHotkey(pttKey, lang, platform)} / {formatHotkey(aiKey, lang, platform)} / {polishKey}</h2>
                  </div>
                  <WandSparkles size={22} />
                </div>
                <div className="shortcut-grid">
                  <Shortcut label={text.shortcutSpeak} detail={text.shortcutSpeakDetail} keys={formatHotkey(pttKey, lang, platform)} />
                  <Shortcut label={text.shortcutAi} detail={text.shortcutAiDetail} keys={formatHotkey(aiKey, lang, platform)} />
                  <Shortcut label={text.shortcutPolish} detail={text.shortcutPolishDetail} keys={polishKey} />
                </div>
              </section>
            </div>

            <div className={activeModule === "usage" ? "module-view usage-view active" : "module-view usage-view"}>
              <section className="metrics-grid">
                <Metric icon={<FileText />} label={text.transcribedChars} value={formatNumber(today.transcribedChars, lang)} accent="blue" />
                <Metric icon={<WandSparkles />} label={text.aiEditedChars} value={formatNumber(today.aiEditedChars, lang)} accent="violet" />
                <Metric icon={<Activity />} label={text.savedTime} value={savedTime} accent="cyan" />
                <Metric icon={<CheckCircle2 />} label={text.successfulEvents} value={formatNumber(totals.successfulEvents, lang)} accent="green" />
              </section>

              <section className="usage-panel">
                <div className="panel-heading compact">
                  <div>
                    <p className="eyebrow">{text.usageRange}</p>
                    <h2>{text.usage}</h2>
                  </div>
                  <Activity size={22} />
                </div>
                <TrendChart days={days} peak={peak} lang={lang} />
              </section>
            </div>

            <div className={activeModule === "features" ? "module-view active" : "module-view"}>
              <FeaturesPanel text={text} />
            </div>

            <div className={activeModule === "feedback" ? "module-view active" : "module-view"}>
              <FeedbackPanel text={text} lang={lang} onOpen={openPayment} />
            </div>

            <div className={activeModule === "community" ? "module-view active" : "module-view"}>
              <CommunityPanel text={text} onOpen={openPayment} />
            </div>

            <div className={activeModule === "logs" ? "module-view active" : "module-view"}>
              <section className="log-panel">
                <div className="panel-heading compact">
                  <div>
                    <p className="eyebrow">{text.logs}</p>
                    <h2>{text.backend}</h2>
                  </div>
                  <Pause size={22} />
                </div>
                <div className="logs">
                  {logs.length ? logs.map((item) => (
                    <p key={`${item.ts}-${item.line}`}>
                      <time>{formatTime(item.ts, lang)}</time>
                      <span>{item.line}</span>
                    </p>
                  )) : <p className="empty-log">{text.noLogs}</p>}
                </div>
              </section>
            </div>

            <div className={activeModule === "account" ? "module-view active" : "module-view"}>
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
            </div>

            <div className={activeModule === "settings" ? "module-view active" : "module-view"}>
              <section className="settings-panel">
                <div className="panel-heading compact">
                  <div>
                    <p className="eyebrow">{text.settings}</p>
                    <h2>{text.speechModel}</h2>
                  </div>
                  <Settings size={22} />
                </div>
            <ReadonlyField label="STT Provider" value={text.managedProvider} />
            <ReadonlyField label="STT API Key" value={text.subscriptionIncluded} />
            <FormInput
              label="STT Model"
              value={settings.stt?.model || ""}
              onChange={(value) => setNested(setSettings, ["stt", "model"], value)}
            />
            <FormInput
              label={text.microphone}
              value={settings.audio?.device || "auto"}
              onChange={(value) => setNested(setSettings, ["audio", "device"], value)}
            />
            <Segmented
              label={text.listenMode}
              value={settings.audio?.mode || "ptt"}
              options={[
                ["ptt", text.ptt],
                ["vad", text.vad],
              ]}
              onChange={(value) => setNested(setSettings, ["audio", "mode"], value)}
            />
            <Range
              label="VAD"
              value={settings.audio?.vad_aggressiveness ?? 2}
              onChange={(value) => setNested(setSettings, ["audio", "vad_aggressiveness"], Number(value))}
            />
            <Segmented
              label={text.typing}
              value={settings.typing?.method || "unicode"}
              options={[
                ["unicode", "Unicode"],
                ["clip", text.clipboard],
              ]}
              onChange={(value) => setNested(setSettings, ["typing", "method"], value)}
            />
            <ReadonlyField label="LLM Provider" value={text.managedProvider} />
            <ReadonlyField label="LLM API Key" value={text.subscriptionIncluded} />
            <button className="save-button" onClick={saveSettings} disabled={saving || !apiBase}>
              <Save size={18} />
              {saving ? text.saving : text.saveAndRestart}
            </button>
              </section>

              {devices ? (
                <section className="devices-panel">
                  <pre>{devices}</pre>
                </section>
              ) : null}
            </div>
          </div>

          <div className={`status-dock ${statusMeta.tone}`}>
            <div className="dock-core">
              <span className="dock-dot" />
            </div>
            <div className="dock-copy">
              <strong>{text.statusDockReady}</strong>
              <small>{statusDockHint || text.statusDockHint}</small>
            </div>
            <div className="dock-meter" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </section>
      </div>
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
  const items = localizedReleaseNoteItems(notes, lang);
  const summary = localizedReleaseNoteSummary(notes, lang) || text.releaseNotesFallback || "This update includes improvements.";
  const title = formatUpdateDetail(text.releaseNotesTitle || "Updated to {version}", notes.version);

  return (
    <section className="release-notes-banner">
      <div className="release-notes-main">
        <WandSparkles size={19} />
        <div>
          <span>{text.releaseNotesSubtitle || "What changed"}</span>
          <strong>{title}</strong>
          <p>{summary}</p>
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

function Segmented({ label, value, onChange, options }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented">
        {options.map(([id, labelText]) => (
          <button type="button" key={id} className={value === id ? "selected" : ""} onClick={() => onChange(id)}>
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

async function api(apiBase, path, options) {
  const response = await fetch(`${apiBase}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(formatApiError(body, response.statusText));
  }
  return body;
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
  return {
    ...settings,
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
    return { pttKey: "shift_r", aiKey: "alt_r" };
  }
  return { pttKey: "alt", aiKey: ["alt", "space"] };
}

function withDynamicStatusCopy(meta, state, lang, pttKey, platform = "") {
  if (state !== "listening") return meta;
  const key = formatHotkey(pttKey, lang, platform);
  return {
    ...meta,
    title: lang === "zh" ? `按住 ${key} 开始说话` : `Hold ${key} to speak`,
  };
}

function formatStatusDockHint(lang, pttKey, aiKey, polishKey, platform = "") {
  const speak = formatHotkey(pttKey, lang, platform);
  const ai = formatHotkey(aiKey, lang, platform);
  if (lang === "zh") {
    return `${speak} 说话，${ai} 进行 AI 编辑，${polishKey} 切换润色模式`;
  }
  return `${speak} to speak, ${ai} for AI editing, ${polishKey} to switch polish mode`;
}

function formatHotkey(value, lang, platform = "") {
  const tokens = Array.isArray(value) ? value : [value];
  return tokens
    .map((token) => {
      const text = String(token || "").toLowerCase();
      if (text === "alt") return "ALT";
      if (text === "alt_l" || text === "left_alt") return platform === "darwin" ? (lang === "zh" ? "左 OPTION" : "LEFT OPTION") : "ALT";
      if (text === "alt_r" || text === "right_alt") return platform === "darwin" ? (lang === "zh" ? "右 OPTION" : "RIGHT OPTION") : "RIGHT ALT";
      if (text === "ctrl_l" || text === "ctrl_r" || text === "right_ctrl" || text === "left_ctrl") return "CTRL";
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
  const seconds = Math.round((chars || 0) * 0.11);
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
