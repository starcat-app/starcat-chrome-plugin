/*
 * Settings keeps saved credentials, form edits, and the last connection test
 * separate. Only Save or an approved pairing can change the connection.
 */
(async function () {
  const PREF_KEYS = { theme: "starcatOptionsTheme", locale: "starcatOptionsLocale" };
  const I18N = {
    en: {
      "page.settings": "Extension settings",
      "page.browser": "Chrome extension",
      "page.privacy": "Connection credentials stay on this device. Starcat manages repository data and notes.",
      "nav.connection": "Connection",
      "nav.github": "GitHub enhancements",
      "nav.preferences": "Preferences",
      "nav.support": "Support & privacy",
      "connection.title": "Connect to Starcat",
      "connection.intro": "Connect Chrome to Starcat on this Mac to use its features on GitHub repository pages.",
      "connection.settings": "Connection settings",
      "connection.help": "Can’t find Starcat?",
      "connection.hint": "Check that the app is running and its browser plugin service is enabled.",
      "mode.unpaired.badge": "Not paired",
      "mode.unpaired.title": "Pair on this Mac",
      "mode.unpaired.description": "Enable the plugin service in Starcat’s Browser Extensions settings, then match the six-digit code in the app.",
      "mode.manual.badge": "API Key saved",
      "mode.manual.title": "Manual connection configured",
      "mode.manual.description": "Test the connection or pair this browser to give it its own revocable authorization.",
      "mode.paired.badge": "Paired",
      "mode.paired.title": "Chrome is paired with Starcat",
      "mode.paired.description": "This browser has its own authorization. Manage the connection to unpair or switch to a manual Key.",
      "field.serviceURL": "Service address",
      "field.fallback": "Alternative connection",
      "field.manual": "Manual API Key",
      "field.token": "Local API Key",
      "field.tokenHelp": "Copy the Key in Starcat → Settings → Extensions & Connections → Browser Extensions.",
      "action.save": "Save",
      "action.test": "Test connection",
      "action.pair": "Pair without a Key",
      "action.manage": "Manage connection",
      "action.close": "Close",
      "draft.clean": "No unsaved changes",
      "draft.dirty": "Unsaved changes",
      "status.paired": "Browser paired with Starcat.",
      "status.unpaired": "Browser connection removed.",
      "status.saved": "Saved.",
      "status.testing": "Testing connection…",
      "status.connected": "Connected to {app}.",
      "status.invalid_service_url": "Enter a local service address with a port, such as http://127.0.0.1:5051.",
      "status.connection_timeout": "Connection timed out. Check that Starcat is running and try again.",
      "github.intro": "Once connected, refresh a GitHub repository page to see these features.",
      "github.about": "About sidebar",
      "github.notes": "Private notes for starred repos, similar repos (Pro)",
      "github.signals": "Watch / Fork / Star row",
      "github.toolbar": "Add file / Code toolbar",
      "github.pro": "Pro features stay visible and require a Starcat Pro subscription to use.",
      "preference.theme": "Appearance",
      "preference.locale": "Language",
      "preference.hint": "Changes apply immediately.",
      "theme.system": "System",
      "theme.light": "Light",
      "theme.dark": "Dark",
      "support.troubleshoot": "Troubleshoot connection",
      "support.checkApp": "In Starcat, open Settings → Extensions & Connections → Browser Extensions and enable the browser plugin service.",
      "support.checkAddress": "Check that the service address matches the one in Starcat and the loopback connection is allowed by your firewall or proxy.",
      "support.refresh": "After saving a change, refresh the GitHub repository page.",
      "support.website": "Starcat website",
      "support.privacy": "Privacy policy"
    },
    zh: {
      "page.settings": "插件设置",
      "page.browser": "Chrome 扩展",
      "page.privacy": "连接凭据保存在本机，仓库数据与笔记由 Starcat 管理。",
      "nav.connection": "连接",
      "nav.github": "GitHub 增强",
      "nav.preferences": "偏好",
      "nav.support": "支持与隐私",
      "connection.title": "连接 Starcat",
      "connection.intro": "将 Chrome 配对到这台 Mac 上的 Starcat，在 GitHub 仓库页使用它的功能。",
      "connection.settings": "连接设置",
      "connection.help": "找不到 Starcat？",
      "connection.hint": "检查 App 是否正在运行，浏览器插件服务是否已开启。",
      "mode.unpaired.badge": "未配对",
      "mode.unpaired.title": "在本机完成配对",
      "mode.unpaired.description": "先在 Starcat「浏览器扩展」中启用插件服务。无需复制 Key，在 App 中核对六位数字即可。",
      "mode.manual.badge": "已保存 API Key",
      "mode.manual.title": "已设置手工连接",
      "mode.manual.description": "可以测试当前连接，或改用免 Key 配对，为此浏览器授予单独可撤销的权限。",
      "mode.paired.badge": "已配对",
      "mode.paired.title": "Chrome 已与 Starcat 配对",
      "mode.paired.description": "此浏览器使用独立授权。可以在「管理连接」中取消配对，再切换为手工 Key。",
      "field.serviceURL": "服务地址",
      "field.fallback": "备用连接方式",
      "field.manual": "手工 API Key",
      "field.token": "本地 API Key",
      "field.tokenHelp": "在 Starcat → 设置 → 扩展与连接 → 浏览器扩展中复制本地 API Key。",
      "action.save": "保存",
      "action.test": "测试连接",
      "action.pair": "免 Key 配对",
      "action.manage": "管理连接",
      "action.close": "关闭",
      "draft.clean": "没有未保存的更改",
      "draft.dirty": "有未保存的更改",
      "status.paired": "浏览器已与 Starcat 配对。",
      "status.unpaired": "已移除浏览器连接。",
      "status.saved": "已保存。",
      "status.testing": "正在测试连接…",
      "status.connected": "已连接到 {app}。",
      "status.invalid_service_url": "填写带端口的本机服务地址，例如 http://127.0.0.1:5051。",
      "status.connection_timeout": "连接超时。请确认 Starcat 正在运行后重试。",
      "github.intro": "连接成功后，在 GitHub 仓库页刷新一次即可看到入口。",
      "github.about": "About 侧栏",
      "github.notes": "私有笔记（已收藏仓库）、相似仓库（Pro）",
      "github.signals": "Watch / Fork / Star 按钮行",
      "github.toolbar": "添加文件 / Code 工具栏",
      "github.pro": "未订阅时仍可看到 Pro 功能入口，订阅后即可使用。",
      "preference.theme": "外观",
      "preference.locale": "语言",
      "preference.hint": "切换后立即生效。",
      "theme.system": "跟随系统",
      "theme.light": "浅色",
      "theme.dark": "深色",
      "support.troubleshoot": "连接排查",
      "support.checkApp": "在 Starcat → 设置 → 扩展与连接 → 浏览器扩展中启用浏览器插件服务。",
      "support.checkAddress": "确认服务地址与 App 中一致，并检查防火墙或代理是否放行本机连接。",
      "support.refresh": "保存连接设置后，刷新 GitHub 仓库页。",
      "support.website": "Starcat 官网",
      "support.privacy": "隐私政策"
    }
  };

  const form = document.querySelector("#options-form");
  const serviceURLInput = document.querySelector("#service-url");
  const tokenInput = document.querySelector("#token");
  const manualSettings = document.querySelector("#manual-settings");
  const manualKey = document.querySelector("#manual-key");
  const saveButton = document.querySelector("#save");
  const testButton = document.querySelector("#test");
  const pairButton = document.querySelector("#pair");
  const pairingDialog = document.querySelector("#pairing-dialog");
  const pairingTitle = document.querySelector("#pairing-dialog-title");
  const pairingFrame = document.querySelector("#pairing-frame");
  const closePairingButton = document.querySelector("#pairing-close");
  const status = document.querySelector("#status");
  const draftStatus = document.querySelector("#draft-status");
  const connectionCard = document.querySelector("#connection-card");
  const themeButtons = [...document.querySelectorAll("[data-theme-option]")];
  const localeButtons = [...document.querySelectorAll("[data-locale-option]")];
  const troubleshooting = document.querySelector("#troubleshooting");
  const navItems = [...document.querySelectorAll(".settings-nav a")].map((link) => ({
    link,
    panel: document.querySelector(link.hash)
  }));
  let frameObserver;
  let closingPairing = false;
  let operation = "";
  let feedback;

  const storedPrefs = await chrome.storage.local.get([PREF_KEYS.theme, PREF_KEYS.locale]);
  let currentLocale = storedPrefs[PREF_KEYS.locale] || (navigator.language.startsWith("zh") ? "zh" : "en");
  let savedConfig = await StarcatCompanion.loadConfig();

  function t(key, values = {}) {
    let text = I18N[currentLocale]?.[key] || I18N.en[key];
    for (const [name, value] of Object.entries(values)) text = text.replace(`{${name}}`, () => value);
    return text;
  }

  function applyTheme(theme) {
    const selected = ["light", "dark"].includes(theme) ? theme : "system";
    if (selected === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme = selected;
    themeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeOption === selected));
    });
  }

  function applyLocale(locale) {
    currentLocale = locale === "zh" ? "zh" : "en";
    document.documentElement.lang = currentLocale === "zh" ? "zh-Hans" : "en";
    document.title = `${t("page.settings")} · Starcat`;
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    localeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.localeOption === currentLocale));
    });
    renderConnection();
    renderFeedback();
  }

  function renderFeedback() {
    let message = "";
    if (feedback?.error) {
      message = t(`status.${feedback.error.message}`) || StarcatCompanion.connectionErrorMessage(feedback.error, currentLocale);
    } else if (feedback) {
      message = t(feedback.key, feedback.values);
    }
    status.textContent = message;
    status.dataset.tone = feedback?.tone || "";
  }

  function setFeedback(next) {
    feedback = next;
    renderFeedback();
  }

  function draft() {
    return { serviceURL: serviceURLInput.value.trim(), token: tokenInput.value.trim() };
  }

  function isDirty(current = draft()) {
    return current.serviceURL !== savedConfig.serviceURL || current.token !== savedConfig.token;
  }

  function renderConnection() {
    const paired = Boolean(savedConfig.paired);
    const mode = paired ? "paired" : savedConfig.token ? "manual" : "unpaired";
    connectionCard.dataset.mode = mode;
    document.querySelector("#connection-badge").textContent = t(`mode.${mode}.badge`);
    document.querySelector("#connection-heading").textContent = t(`mode.${mode}.title`);
    document.querySelector("#connection-description").textContent = t(`mode.${mode}.description`);
    manualSettings.hidden = paired;
    serviceURLInput.readOnly = paired || operation === "saving";
    tokenInput.readOnly = operation === "saving";
    const dirty = !paired && isDirty();
    draftStatus.textContent = t(dirty ? "draft.dirty" : "draft.clean");
    saveButton.disabled = !dirty || Boolean(operation);
    testButton.disabled = Boolean(operation);
    pairButton.disabled = Boolean(operation);
    pairButton.textContent = t(paired ? "action.manage" : "action.pair");
    pairingTitle.textContent = pairButton.textContent;
    pairingFrame.title = pairButton.textContent;
  }

  function populateForm() {
    serviceURLInput.value = savedConfig.serviceURL;
    tokenInput.value = savedConfig.token;
    if (savedConfig.paired) manualKey.open = false;
  }

  function validatedDraft(current) {
    if (!current.serviceURL) return { ...current, serviceURL: StarcatCompanion.DEFAULT_SERVICE_URL };
    let url;
    try {
      url = new URL(current.serviceURL);
    } catch {
      throw new Error("invalid_service_url");
    }
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.port
        || !["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("invalid_service_url");
    }
    return { ...current, serviceURL: StarcatCompanion.normalizeServiceURL(current.serviceURL) };
  }

  function selectNav() {
    const hash = location.hash;
    const panelHash = { "#manual-key": "#connection", "#troubleshooting": "#support" }[hash] || hash;
    const selected = navItems.find(({ link }) => link.hash === panelHash) || navItems[0];
    const changed = selected.panel.hidden;
    const focusedPanel = document.activeElement?.closest(".settings-panel");

    // Keep live form controls mounted across navigation, and silence the outgoing panel during its fade.
    for (const { link, panel } of navItems) {
      const current = panel === selected.panel;
      panel.inert = !current;
      panel.hidden = !current;
      if (current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
    if (hash === "#manual-key" && !savedConfig.paired) manualKey.open = true;
    if (hash === "#troubleshooting") troubleshooting.open = true;
    if (changed) window.scrollTo(0, 0);
    if (changed && hash === "#troubleshooting") {
      troubleshooting.querySelector("summary").focus();
    } else if (focusedPanel?.hidden) {
      selected.panel.focus({ preventScroll: true });
    }
  }

  populateForm();
  applyTheme(storedPrefs[PREF_KEYS.theme]);
  applyLocale(currentLocale);
  selectNav();
  addEventListener("hashchange", selectNav);

  themeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      applyTheme(button.dataset.themeOption);
      await chrome.storage.local.set({ [PREF_KEYS.theme]: button.dataset.themeOption });
    });
  });

  localeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      applyLocale(button.dataset.localeOption);
      await chrome.storage.local.set({ [PREF_KEYS.locale]: currentLocale });
    });
  });

  form.addEventListener("input", () => {
    setFeedback();
    renderConnection();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saveButton.disabled) return;
    operation = "saving";
    renderConnection();
    try {
      await StarcatCompanion.saveConfig(validatedDraft(draft()));
      savedConfig = await StarcatCompanion.loadConfig();
      populateForm();
      setFeedback({ key: "status.saved", tone: "success" });
    } catch (error) {
      setFeedback({ error, tone: "error" });
    } finally {
      operation = "";
      renderConnection();
    }
  });

  testButton.addEventListener("click", async () => {
    const tested = draft();
    operation = "testing";
    renderConnection();
    setFeedback({ key: "status.testing" });
    try {
      const reply = await chrome.runtime.sendMessage({
        type: "starcat.optionsPing",
        ...(savedConfig.paired ? {} : validatedDraft(tested))
      });
      if (!reply?.ok) {
        const error = new Error(reply?.error || "request_failed");
        error.status = reply?.status || 0;
        throw error;
      }
      if (feedback?.key === "status.testing") {
        setFeedback({ key: "status.connected", tone: "success", values: { app: reply.body?.app || "Starcat" } });
      }
    } catch (error) {
      if (feedback?.key === "status.testing") setFeedback({ error, tone: "error" });
    } finally {
      operation = "";
      renderConnection();
    }
  });

  pairButton.addEventListener("click", () => {
    pairingFrame.src = "../pairing/pairing.html?embedded=1";
    pairingDialog.showModal();
  });

  pairingFrame.addEventListener("load", () => {
    frameObserver?.disconnect();
    if (!pairingDialog.open) return;
    const page = pairingFrame.contentDocument?.getElementById("page");
    if (!page) return;
    // Follow each pairing phase's natural height while letting short windows scroll.
    frameObserver = new ResizeObserver(() => {
      pairingFrame.style.height = `${Math.ceil(page.getBoundingClientRect().height)}px`;
    });
    frameObserver.observe(page);
  });

  async function closePairing(useManualKey = false) {
    if (!pairingDialog.open || closingPairing) return;
    closingPairing = true;
    closePairingButton.disabled = true;
    try {
      // The child cancels only active requests. A completed pairing stays authorized.
      await pairingFrame.contentWindow.StarcatPairing?.close();
      const nextConfig = await StarcatCompanion.loadConfig();
      if (JSON.stringify(nextConfig) !== JSON.stringify(savedConfig)) {
        savedConfig = nextConfig;
        populateForm();
        renderConnection();
        setFeedback({ key: savedConfig.paired ? "status.paired" : "status.unpaired", tone: savedConfig.paired ? "success" : "" });
      }
    } catch (error) {
      setFeedback({ error, tone: "error" });
    } finally {
      frameObserver?.disconnect();
      pairingFrame.removeAttribute("src");
      pairingFrame.style.height = "";
      pairingDialog.close();
      closePairingButton.disabled = false;
      closingPairing = false;
      if (useManualKey && !savedConfig.paired) {
        manualKey.open = true;
        tokenInput.focus();
      } else {
        pairButton.focus();
      }
    }
  }

  closePairingButton.addEventListener("click", () => closePairing());
  pairingDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePairing();
  });
  addEventListener("message", (event) => {
    if (event.source === pairingFrame.contentWindow && event.data?.type === "starcat.pairing.close") {
      closePairing(event.data.useManualKey === true);
    }
  });
})();
