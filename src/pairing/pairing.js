/*
 * Pairing stays in a regular extension tab while the user switches to Starcat.
 * The background owns claim secrets and device tokens; this page gets only the
 * display code and terminal status. Discovery alone never asks for approval.
 */
(async function () {
  const api = StarcatCompanion.extensionAPI;
  let timer;
  let countdownTimer;
  let statusAnimation;
  let generation = 0;
  let active = false;
  let closed = false;
  const embedded = globalThis.parent && parent !== globalThis;
  if (embedded) document.documentElement.dataset.embedded = "true";
  // Install before asynchronous initialization so an immediately closed dialog
  // cannot resume setup or start a request after its frame has been removed.
  globalThis.StarcatPairing = {
    async close() {
      if (closed) return;
      closed = true;
      ++generation;
      clearTimeout(timer);
      clearTimeout(countdownTimer);
      statusAnimation?.cancel();
      const needsCancellation = active;
      active = false;
      if (needsCancellation) await send("cancel");
    }
  };
  const preferences = await api.storage.local.get(["starcatOptionsLocale", "starcatOptionsTheme"]);
  if (closed) return;
  const language = preferences.starcatOptionsLocale || (navigator.language.startsWith("zh") ? "zh" : "en");
  const words = {
    en: {
      title: "Connect to Starcat", intro: "Bring Starcat to your browser. Pair with the app on this Mac to get started.",
      page_title: "Browser connection · Starcat", local: "On this Mac", privacy: "A local connection between this browser and your Mac.",
      step_find: "Find app", step_verify: "Verify code", step_done: "Connected",
      verify_title: "Confirm in Starcat", verify_intro: "Compare the six digits below with the request in the app.",
      success_title: "You're all set", success_intro: "Return to GitHub to start using your Starcat extension.",
      configured_title: "Connection configured", configured_intro: "Your connection is saved. Check its status in the extension.",
      code_label: "PAIRING CODE", verify_help: "Keep this tab open. Only approve a request you started, and only if the digits match.",
      browser: "Browser", service: "Local service", manage: "Manage connection", manual_summary: "Connect with an API Key instead",
      paired_authorization: "This browser has its own authorization. You can revoke it separately in Starcat Settings.",
      key_authorization: "This browser uses a shared API Key. Rotate the Key in Starcat to revoke access.",
      name: "Browser name", discover: "Find again", discovering: "Finding…", instances: "Available apps", advanced: "Custom service address",
      address: "Service address", address_help: "Only needed if your app is not found automatically.",
      connect: "Connect to Starcat", cancel: "Cancel request", disconnect: "Unpair browser",
      forget: "Clear locally only", manual: "Use a Key to connect", retry: "Pair again",
      key_help: "Find and copy your Key in Starcat > Settings > Extensions & Connections > Browser Extensions > Local API Key. If this browser is already paired, unpair it before switching to a manual Key.",
      countdown: "Request expires in {seconds} seconds.", connecting: "Sending a pairing request…",
      cancelling: "Cancelling the pairing request…", disconnecting: "Removing this browser's connection…",
      offline: "Clearing locally does not revoke app authorization. When offline, also revoke this browser in Starcat Settings. Manual Keys are shared and must be rotated in the app.",
      searching: "Finding Starcat (up to 5 seconds)…", none: "No compatible app found. Open Starcat > Settings > Extensions & Connections > Browser Extensions and enable Browser Plugin Service, then try again or use a Key.",
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
      title: "连接 Starcat", intro: "让浏览器与你的 Mac 协作，在 GitHub 上直接使用 Starcat。",
      page_title: "浏览器连接 · Starcat", local: "在此 Mac 上", privacy: "仅在此浏览器与你的 Mac 之间建立本机连接。",
      step_find: "选择 App", step_verify: "核对数字", step_done: "完成连接",
      verify_title: "在 Starcat 中确认", verify_intro: "切换到 Mac 上的 Starcat，核对两端显示的六位数字。",
      success_title: "配对成功", success_intro: "一切就绪，返回 GitHub 即可使用 Starcat 浏览器扩展。",
      configured_title: "已配置连接", configured_intro: "连接配置已保存在此浏览器，可在扩展中查看连接状态。",
      code_label: "配对确认码", verify_help: "请保持此标签页打开。仅在数字一致时，批准自己主动发起的请求。",
      browser: "浏览器", service: "本机服务", manage: "管理连接", manual_summary: "改用 API Key 连接",
      paired_authorization: "此浏览器使用独立授权，可在 Starcat 设置中单独撤销。",
      key_authorization: "此浏览器使用共享 API Key。如需使其失效，请在 Starcat 中轮换 Key。",
      name: "浏览器名称", discover: "重新查找", discovering: "查找中…", instances: "可连接的 App", advanced: "自定义服务地址",
      address: "服务地址", address_help: "仅在无法自动找到 App 时，才需要修改此地址。",
      connect: "连接 Starcat", cancel: "取消请求", disconnect: "取消浏览器配对",
      forget: "仅清除本地凭据", manual: "使用 Key 连接", retry: "重新配对",
      key_help: "获取 Key：Starcat → 设置 → 扩展与连接 → 浏览器扩展 → 本地 API Key → 复制。已配对的浏览器需先取消配对，再切换为手工 Key。",
      countdown: "请求将在 {seconds} 秒后过期。", connecting: "正在发送配对请求…",
      cancelling: "正在取消配对请求…", disconnecting: "正在移除此浏览器的连接…",
      offline: "清除本地凭据不会撤销 App 端授权。离线时还需在 Starcat 设置中撤销该浏览器。手工 Key 为共享凭据，需在 App 中轮换才能使其失效。",
      searching: "正在查找 Starcat（最多 5 秒）…", none: "没有找到兼容的 App。请在“Starcat 设置 → 扩展与连接 → 浏览器扩展”中启用浏览器插件服务，再重新查找或使用 Key 连接。",
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
  const embeddedWords = {
    en: {
      step_find: "Choose app", verify_title: "Match the code in Starcat",
      verify_intro: "Approve in the app only when both codes match.",
      verify_help: "Only approve a request you started.",
      waiting: "Waiting for Starcat approval", countdown: "Expires in {seconds}s"
    },
    zh: {
      step_find: "选择本机", step_verify: "核对配对码", verify_title: "在 Starcat 中核对配对码",
      verify_intro: "两处显示的数字一致时，再在 App 中点击批准。",
      verify_help: "只批准你亲自发起的请求。",
      waiting: "等待 Starcat 批准", countdown: "{seconds} 秒后过期"
    }
  };
  const text = { ...(words[language] || words.en), ...(embedded ? embeddedWords[language] || embeddedWords.en : {}) };
  document.documentElement.lang = language;
  document.title = text.page_title;
  if (["dark", "light"].includes(preferences.starcatOptionsTheme)) document.documentElement.dataset.theme = preferences.starcatOptionsTheme;
  document.querySelectorAll("[data-text]").forEach((element) => { element.textContent = text[element.dataset.text]; });
  const find = (id) => document.getElementById(id);
  let deadline = 0;
  let discovering = false;
  const current = await StarcatCompanion.loadConfig();
  if (closed) return;
  let configured = Boolean(current.paired || (!embedded && current.token));
  let paired = Boolean(current.paired);
  let phase = "setup";
  const browserName = api.runtime.getURL("").startsWith("safari-web-extension:") ? "Safari" : "Chrome";
  find("address").value = current.serviceURL;
  find("name").value = browserName;
  find("browser-label").textContent = browserName;
  find("chrome-icon").hidden = browserName !== "Chrome";
  find("safari-icon").hidden = browserName !== "Safari";

  // Render only the current task. A saved credential is not evidence that the app
  // is online, so restored connections use a different heading from new approvals.
  function status(key) {
    if (key === "approved") { configured = true; paired = true; }
    if (["revoked", "local_only"].includes(key)) { configured = false; paired = false; }
    const verifying = ["connecting", "waiting", "cancelling"].includes(key);
    const nextPhase = configured ? "complete" : verifying ? "verify" : "setup";
    const neutral = ["ready", "connected", "cancelled", "revoked"];
    const pending = ["searching", "connecting", "waiting", "cancelling", "disconnecting"];
    find("page").dataset.phase = nextPhase;
    find("page").dataset.state = key;
    find("page").dataset.tone = key === "approved" ? "success" : pending.includes(key) ? "busy" : neutral.includes(key) ? "neutral" : "error";
    find("setup").hidden = configured || verifying;
    find("verification").hidden = !verifying;
    find("code-area").hidden = key !== "waiting";
    find("connection-summary").hidden = !configured;
    find("connection-management").hidden = !configured;
    find("manual-help").hidden = configured || verifying;
    find("steps").hidden = configured;
    for (const step of [1, 2, 3]) find(`step-${step}`).setAttribute("aria-current", step === (configured ? 3 : verifying ? 2 : 1) ? "step" : "false");
    if (embedded && phase !== nextPhase) {
      // Keep a single live announcement while moving feedback beside Cancel in verification.
      if (verifying) find("verification-footer").prepend(find("status"));
      else find("setup").before(find("status"));
    }
    const heading = key === "approved" ? "success" : configured ? "configured" : verifying ? "verify" : "";
    find("title").textContent = heading ? text[`${heading}_title`] : text.title;
    find("intro").textContent = heading ? text[`${heading}_intro`] : text.intro;
    find("connected-name").textContent = find("name").value;
    find("connected-address").textContent = find("address").value;
    find("authorization-note").textContent = paired ? text.paired_authorization : text.key_authorization;
    find("status").textContent = text[key] || StarcatCompanion.connectionErrorMessage({ message: key }, language);
    // Hiding a submitted form also hides the focused button; move keyboard users
    // to the new heading so the next Tab reaches that phase's available action.
    if (phase !== nextPhase) find("title").focus({ preventScroll: true });
    phase = nextPhase;
    statusAnimation?.cancel();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      statusAnimation = find("status").animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "ease-out" });
    }
  }
  async function send(action, values = {}) {
    let timeout;
    try {
      const request = api.runtime.sendMessage({ type: "starcat.pairing", action, ...values });
      // Include time waiting for the background queue in the visible discovery budget.
      const reply = action === "discover" ? await Promise.race([
        request,
        new Promise((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error("discovery_timeout")), 5000);
        })
      ]) : await request;
      if (!reply?.ok) throw new Error(reply?.error || "failed");
      return reply.body;
    } finally { clearTimeout(timeout); }
  }
  function busy(value) {
    active = value;
    for (const id of ["connect", "discover", "name", "address", "instances", "disconnect"]) find(id).disabled = value || discovering;
    find("cancel").disabled = !value;
    find("discover").dataset.loading = String(discovering);
    find("discover-label").textContent = discovering ? text.discovering : text.discover;
    find("pairing-form").setAttribute("aria-busy", String(value || discovering));
  }
  function finish(key) {
    ++generation;
    clearTimeout(timer);
    clearTimeout(countdownTimer);
    busy(false);
    find("code").textContent = "";
    find("countdown").textContent = "";
    find("connect").textContent = key === "approved" ? text.connect : text.retry;
    status(key);
    // A poll can already be claiming credentials when the local deadline fires.
    // Queue cancellation after it so expiry also clears any just-claimed device.
    if (key === "expired") send("cancel").catch(() => {});
  }
  // Expiry must not depend on a poll returning: an unavailable host must not
  // keep an expired code visible or let its late response overwrite a retry.
  function updateCountdown(identity) {
    if (identity !== generation || !active) return;
    const remaining = deadline - Date.now();
    if (remaining <= 0) { finish("expired"); return; }
    find("countdown").textContent = text.countdown.replace("{seconds}", Math.ceil(remaining / 1000));
    countdownTimer = setTimeout(() => updateCountdown(identity), Math.min(1000, remaining));
  }
  async function discover() {
    if (closed || active || discovering) return;
    discovering = true;
    busy(false);
    status("searching");
    const select = find("instances");
    select.replaceChildren();
    select.add(new Option(text.choose, ""));
    try {
      const result = await send("discover", { serviceURL: find("address").value });
      for (const item of result.candidates) {
        // Keep the address visible for multiple running builds; known bundle IDs
        // get readable names while unrecognized channels retain their identity.
        const channels = {
          appstore: "Starcat · App Store", direct: "Starcat · Direct",
          "com.starcat.app": "Starcat · App Store", "com.starcat.app.debug": "Starcat · App Store (Debug)",
          "com.starcat.app.direct": "Starcat · Direct", "com.starcat.app.direct.debug": "Starcat · Direct (Debug)"
        };
        select.add(new Option(`${channels[item.channel] || item.channel} · ${item.serviceURL}`, item.serviceURL));
      }
      if (result.candidates.length === 1) {
        select.value = result.candidates[0].serviceURL;
        find("address").value = select.value;
      } else if (result.candidates.length > 1) find("address").value = "";
      status(result.candidates.length ? "ready" : "none");
    } catch (error) { status(error.message); }
    finally { discovering = false; busy(active); }
  }
  async function poll(identity) {
    if (identity !== generation || !active) return;
    if (Date.now() >= deadline) { finish("expired"); return; }
    try {
      const result = await send("poll");
      if (identity !== generation) return;
      if (Date.now() >= deadline) { finish("expired"); return; }
      if (result.status === "pending") timer = setTimeout(() => poll(identity), 2000);
      else finish(result.status);
    } catch (error) { if (identity === generation) finish(error.message); }
  }
  find("pairing-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (closed || active || discovering) return;
    const identity = ++generation;
    busy(true);
    status("connecting");
    try {
      const receipt = await send("start", { serviceURL: find("address").value, name: find("name").value });
      if (identity !== generation) return;
      deadline = Date.parse(receipt.expiresAt);
      if (!Number.isFinite(deadline)) { finish("invalid_pairing_response"); return; }
      if (embedded) {
        const digits = Array.from(String(receipt.code), (digit) => {
          const cell = document.createElement("span");
          cell.textContent = digit;
          return cell;
        });
        find("code").replaceChildren(...digits);
      } else {
        find("code").textContent = receipt.code;
      }
      status("waiting");
      updateCountdown(identity);
      if (identity === generation) timer = setTimeout(() => poll(identity), 2000);
    } catch (error) { if (identity === generation) finish(error.message); }
  });
  find("cancel").addEventListener("click", async () => {
    const identity = ++generation;
    clearTimeout(timer);
    clearTimeout(countdownTimer);
    find("code").textContent = "";
    find("countdown").textContent = "";
    find("cancel").disabled = true;
    status("cancelling");
    try { await send("cancel"); if (identity === generation) finish("cancelled"); }
    catch (error) { if (identity === generation) finish(error.message); }
  });
  find("discover").addEventListener("click", discover);
  find("instances").addEventListener("change", () => { find("address").value = find("instances").value; });
  async function disconnect(localOnly) {
    find("disconnect").disabled = true;
    find("forget").disabled = true;
    status("disconnecting");
    try {
      const result = await send("disconnect", { localOnly });
      status(result.status);
      find("forget").hidden = result.status !== "revoke_failed";
    } catch (error) { status(error.message); }
    finally { find("disconnect").disabled = false; find("forget").disabled = false; }
  }
  find("disconnect").addEventListener("click", () => disconnect(false));
  find("forget").addEventListener("click", () => disconnect(true));
  addEventListener("pagehide", () => { globalThis.StarcatPairing.close().catch(() => {}); });
  if (embedded) {
    const requestClose = (useManualKey = false) => parent.postMessage({ type: "starcat.pairing.close", useManualKey }, "*");
    find("manual").addEventListener("click", (event) => {
      event.preventDefault();
      requestClose(true);
    });
    addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      requestClose();
    });
  }
  if (configured) status("connected");
  else await discover();
})();
