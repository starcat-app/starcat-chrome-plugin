/*
 * Pairing stays in a regular extension tab while the user switches to Starcat.
 * The background owns claim secrets and device tokens; this page gets only the
 * display code and terminal status. Discovery alone never asks for approval.
 */
(async function () {
  const api = StarcatCompanion.extensionAPI;
  const preferences = await api.storage.local.get(["starcatOptionsLocale", "starcatOptionsTheme"]);
  const language = preferences.starcatOptionsLocale || (navigator.language.startsWith("zh") ? "zh" : "en");
  const words = {
    en: {
      title: "Connect to Starcat", intro: "Find Starcat on this Mac, then compare the six digits in the app. Only approve a request you started.",
      name: "Browser name", discover: "Find Starcat", instances: "Available apps", advanced: "Custom service address",
      address: "Service address", connect: "Connect", cancel: "Cancel request", disconnect: "Unpair browser",
      forget: "Clear locally only", manual: "Advanced settings and manual Key",
      offline: "Clearing locally does not revoke app authorization. When offline, also revoke this browser in Starcat Settings. Manual Keys are shared and must be rotated in the app.",
      searching: "Finding Starcat…", none: "No compatible app found. Enable Browser Plugin Service in Starcat, or enter its custom address.",
      choose: "Choose an app", ready: "Choose an app and click Connect.", waiting: "Compare these six digits in Starcat and approve only if they match.",
      service_selection_required: "Choose an app or enter its service address before connecting.",
      approved: "Paired. This browser now has its own revocable authorization.", rejected: "Pairing was rejected in Starcat.",
      expired: "The request expired. Click Connect to start again.", cancelled: "Pairing request cancelled.",
      revoke_failed: "Starcat could not confirm revocation. Retry while it is running, or clear locally and revoke in the app.",
      revoked: "Browser authorization revoked.", local_only: "Local credentials cleared. App authorization may remain; revoke it in Starcat Settings.",
      failed: "Connection failed. Check that Starcat is running and the service address is correct.",
      pairing_pending: "Another pairing request is pending. Finish or cancel it before trying again.",
      pairing_rate_limited: "Too many pairing requests. Wait a minute before trying again.",
      extension_page_required: "Open this page from the installed extension.", invalid_service_url: "Enter a loopback address with a port, such as http://127.0.0.1:5051.",
      connected: "This browser is configured. You can unpair it here or manage its authorization in Starcat Settings."
    },
    zh: {
      title: "连接 Starcat", intro: "查找这台 Mac 上的 Starcat，在 App 中核对六位数字。只批准自己主动发起的请求。",
      name: "浏览器名称", discover: "查找 Starcat", instances: "可连接的 App", advanced: "自定义服务地址",
      address: "服务地址", connect: "连接", cancel: "取消请求", disconnect: "取消浏览器配对",
      forget: "仅清除本地凭据", manual: "高级设置与手工 Key",
      offline: "清除本地凭据不会撤销 App 端授权。离线时还需在 Starcat 设置中撤销该浏览器。手工 Key 为共享凭据，需在 App 中轮换才能使其失效。",
      searching: "正在查找 Starcat…", none: "没有找到兼容的 App。请在 Starcat 中启用浏览器插件服务，或填写自定义服务地址。",
      choose: "请选择 App", ready: "选择 App 后点击连接。", waiting: "请在 Starcat 中核对这六位数字，仅在数字一致时批准。",
      service_selection_required: "请先选择 App 或填写服务地址，再点击连接。",
      approved: "配对成功。此浏览器已获得可单独撤销的授权。", rejected: "Starcat 已拒绝此次配对。",
      expired: "请求已过期，请重新点击连接。", cancelled: "已取消配对请求。",
      revoke_failed: "Starcat 未能确认撤销。请运行 App 后重试，或仅清除本地凭据并在 App 设置中撤销。",
      revoked: "已撤销浏览器授权。", local_only: "已清除本地凭据，App 端授权可能仍有效，请在 Starcat 设置中撤销。",
      failed: "连接失败，请确认 Starcat 正在运行且服务地址正确。",
      pairing_pending: "已有待确认的配对请求，请先完成或取消。", pairing_rate_limited: "配对请求过多，请稍等一分钟再试。",
      extension_page_required: "请从已安装的浏览器扩展打开此页面。", invalid_service_url: "请填写含端口的本机地址，例如 http://127.0.0.1:5051。",
      connected: "此浏览器已配置连接。可在这里取消配对，或在 Starcat 设置中管理授权。"
    }
  };
  const text = words[language] || words.en;
  document.documentElement.lang = language;
  if (["dark", "light"].includes(preferences.starcatOptionsTheme)) document.documentElement.dataset.theme = preferences.starcatOptionsTheme;
  document.querySelectorAll("[data-text]").forEach((element) => { element.textContent = text[element.dataset.text]; });
  const find = (id) => document.getElementById(id);
  let timer;
  let deadline = 0;
  let generation = 0;
  let active = false;
  const current = await StarcatCompanion.loadConfig();
  find("address").value = current.serviceURL;
  find("name").value = api.runtime.getURL("").startsWith("safari-web-extension:") ? "Safari" : "Chrome";

  function status(key) { find("status").textContent = text[key] || text.failed; }
  async function send(action, values = {}) {
    const reply = await api.runtime.sendMessage({ type: "starcat.pairing", action, ...values });
    if (!reply?.ok) throw new Error(reply?.error || "failed");
    return reply.body;
  }
  function busy(value) {
    active = value;
    for (const id of ["connect", "discover", "name", "address", "instances", "disconnect"]) find(id).disabled = value;
    find("cancel").disabled = !value;
  }
  function finish(key) {
    clearTimeout(timer);
    busy(false);
    find("code").textContent = "";
    status(key);
  }
  async function discover() {
    status("searching");
    find("discover").disabled = true;
    try {
      const result = await send("discover", { serviceURL: find("address").value });
      const select = find("instances");
      select.replaceChildren();
      select.add(new Option(text.choose, ""));
      for (const item of result.candidates) select.add(new Option(`${item.channel} · ${item.serviceURL}`, item.serviceURL));
      if (result.candidates.length === 1) {
        select.value = result.candidates[0].serviceURL;
        find("address").value = select.value;
      } else if (result.candidates.length > 1) find("address").value = "";
      status(result.candidates.length ? "ready" : "none");
    } catch (error) { status(error.message); }
    finally { find("discover").disabled = false; }
  }
  async function poll(identity) {
    if (identity !== generation || !active) return;
    if (Date.now() >= deadline) { finish("expired"); return; }
    try {
      const result = await send("poll");
      if (identity !== generation) return;
      if (result.status === "pending") timer = setTimeout(() => poll(identity), 2000);
      else finish(result.status);
    } catch (error) { if (identity === generation) finish(error.message); }
  }
  find("pairing-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const identity = ++generation;
    busy(true);
    try {
      const receipt = await send("start", { serviceURL: find("address").value, name: find("name").value });
      if (identity !== generation) return;
      deadline = Date.parse(receipt.expiresAt);
      find("code").textContent = receipt.code;
      status("waiting");
      timer = setTimeout(() => poll(identity), 2000);
    } catch (error) { finish(error.message); }
  });
  find("cancel").addEventListener("click", async () => {
    ++generation;
    clearTimeout(timer);
    try { await send("cancel"); finish("cancelled"); }
    catch (error) { finish(error.message); }
  });
  find("discover").addEventListener("click", discover);
  find("instances").addEventListener("change", () => { find("address").value = find("instances").value; });
  async function disconnect(localOnly) {
    try {
      const result = await send("disconnect", { localOnly });
      status(result.status);
      find("forget").hidden = result.status !== "revoke_failed";
    } catch (error) { status(error.message); }
  }
  find("disconnect").addEventListener("click", () => disconnect(false));
  find("forget").addEventListener("click", () => disconnect(true));
  addEventListener("pagehide", () => { clearTimeout(timer); if (active) send("cancel").catch(() => {}); });
  if (current.paired || current.token) status("connected");
  else await discover();
})();
