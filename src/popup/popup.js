/*
 * The toolbar popup only checks the saved connection. Credential edits stay in
 * settings, and pairing uses a tab that stays open while the app has focus.
 */
(async function () {
  const THEME_KEY = "starcatOptionsTheme";
  const LOCALE_KEY = "starcatOptionsLocale";
  const I18N = {
    en: {
      browser: "Chrome extension",
      settings: "Extension settings",
      lastChecked: "Last checked",
      notChecked: "Not checked",
      pair: "Pair without a Key",
      test: "Test connection",
      retry: "Retry",
      checkingTitle: "Checking connection…",
      checkingDescription: "Looking for Starcat on this Mac.",
      setupTitle: "Not paired",
      setupDescription: "Pair this browser and match the six-digit code in Starcat.",
      connectedTitle: "Connected to Starcat",
      connectedDescription: "Starcat features are ready on GitHub repository pages.",
      errorTitle: "Connection failed",
      timeout: "Connection timed out. Check that Starcat is running, then retry."
    },
    zh: {
      browser: "Chrome 扩展",
      settings: "插件设置",
      lastChecked: "最近检查",
      notChecked: "尚未检查",
      pair: "免 Key 配对",
      test: "测试连接",
      retry: "重试",
      checkingTitle: "正在检查连接…",
      checkingDescription: "正在查找这台 Mac 上的 Starcat。",
      setupTitle: "尚未配对",
      setupDescription: "配对此浏览器，并在 Starcat 中核对六位数字。",
      connectedTitle: "已连接到 Starcat",
      connectedDescription: "现在可以在 GitHub 仓库页使用 Starcat 功能。",
      errorTitle: "连接失败",
      timeout: "连接超时。请确认 Starcat 正在运行，然后重试。"
    }
  };

  const extensionAPI = StarcatCompanion.extensionAPI;
  const popup = document.querySelector(".popup");
  const version = document.querySelector("#version");
  const card = document.querySelector("#connection-card");
  const title = document.querySelector("#connection-title");
  const description = document.querySelector("#connection-description");
  const lastChecked = document.querySelector("#last-checked");
  const pairButton = document.querySelector("#pair");
  const testButton = document.querySelector("#test");
  const openOptionsButton = document.querySelector("#open-options");
  const preferences = await extensionAPI.storage.local.get([THEME_KEY, LOCALE_KEY]).catch(() => ({}));
  const defaultLocale = navigator.language.startsWith("zh") ? "zh" : "en";
  const selectedLocale = preferences[LOCALE_KEY] || defaultLocale;
  const locale = selectedLocale === "zh" ? "zh" : "en";
  const text = I18N[locale];
  const language = locale === "zh" ? "zh-Hans" : "en";
  const timeFormat = new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const theme = preferences[THEME_KEY];
  let checkedAt;

  document.documentElement.lang = language;
  document.title = `Starcat · ${text.browser}`;
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = text[element.dataset.i18n];
  });
  version.textContent = `v${extensionAPI.runtime.getManifest().version}`;

  function render(state, message = text[`${state}Description`]) {
    card.dataset.state = state;
    title.textContent = text[`${state}Title`];
    description.textContent = message;
    lastChecked.textContent = checkedAt ? timeFormat.format(checkedAt) : text.notChecked;
    pairButton.hidden = state !== "setup";
    testButton.hidden = state === "setup";
    if (state !== "checking" || !testButton.textContent) {
      testButton.textContent = state === "error" ? text.retry : text.test;
    }
    testButton.setAttribute("aria-disabled", String(state === "checking"));
  }

  /** Check only the saved connection, including a manual Key set in options. */
  async function checkConnection() {
    render("checking");
    try {
      const config = await StarcatCompanion.loadConfig();
      if (!config.serviceURL || (!config.paired && !config.token)) {
        checkedAt = undefined;
        render("setup");
        return;
      }
      await StarcatCompanion.createClient(config).ping();
      checkedAt = new Date();
      render("connected");
    } catch (error) {
      checkedAt = new Date();
      const message = error?.message === "connection_timeout"
        ? text.timeout
        : StarcatCompanion.connectionErrorMessage(error, locale);
      render("error", message);
    }
  }

  testButton.addEventListener("click", () => {
    if (card.dataset.state !== "checking") return checkConnection();
  });
  openOptionsButton.addEventListener("click", () => {
    extensionAPI.runtime.openOptionsPage();
  });

  const initialCheck = checkConnection();
  popup.hidden = false;
  await initialCheck;
})();
