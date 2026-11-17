/*
 * Companion credentials and transport belong to the extension background.
 * Content scripts receive business data and a configured flag only. Pairing
 * messages require an extension-owned page, not a GitHub or Google sender.
 */
(function () {
  const api = globalThis.browser || globalThis.chrome;
  const DEFAULT_URL = "http://127.0.0.1:5051";
  const CONNECTION = "starcatCompanionConnection";
  let pending = null;
  let pairingQueue = Promise.resolve();
  const nativeAddresses = new Set();
  const activeStreams = new Set();
  Promise.resolve(api.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" })).catch(() => {});

  // Content scripts use the web page's IndexedDB origin, not the extension's.
  // Keeping credentials here also protects Safari, which has no setAccessLevel.
  function credential(action, deviceID, token) {
    return new Promise((resolve, reject) => {
      const opening = indexedDB.open("starcat-companion", 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore("credentials");
      opening.onerror = () => reject(new Error("credential_storage_failed"));
      opening.onsuccess = () => {
        const database = opening.result;
        const transaction = database.transaction("credentials", action === "get" ? "readonly" : "readwrite");
        const store = transaction.objectStore("credentials");
        const request = action === "get" ? store.get(deviceID)
          : action === "put" ? store.put(token, deviceID) : store.delete(deviceID);
        transaction.oncomplete = () => { database.close(); resolve(request.result); };
        transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error("credential_storage_failed")); };
      };
    });
  }

  function localURL(value) {
    const url = new URL(value || DEFAULT_URL);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.port
        || !["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("invalid_service_url");
    }
    return `http://${url.hostname}:${url.port}`;
  }

  async function config() {
    const stored = await api.storage.local.get([CONNECTION, "starcatCompanionServiceURL", "starcatCompanionPort", "starcatCompanionToken"]);
    if (stored[CONNECTION]) {
      return { ...stored[CONNECTION], token: await credential("get", stored[CONNECTION].deviceID) || "" };
    }
    return {
      serviceURL: localURL(stored.starcatCompanionServiceURL || (stored.starcatCompanionPort
        ? `http://127.0.0.1:${stored.starcatCompanionPort}` : DEFAULT_URL)),
      token: stored.starcatCompanionToken || "", mode: "manual"
    };
  }

  // Native Messaging has no abort API. Bound its wait as well as fetch/body
  // decoding; a late native reply is ignored and must never trigger a replay.
  async function withTimeout(operation, milliseconds, code = "connection_timeout") {
    if (milliseconds <= 0) throw new Error(code);
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => { reject(new Error(code)); controller.abort(); }, milliseconds);
    });
    try { return await Promise.race([operation(controller.signal), timeout]); }
    finally { clearTimeout(timer); }
  }

  // Transport is fixed when pairing begins. A failed write is never retried
  // over HTTP, because the native host may already have accepted the operation.
  async function jsonRequest(base, path, options = {}, token = "", transport = "http") {
    return withTimeout(async (signal) => {
      if (transport === "native") {
        const result = await api.runtime.sendNativeMessage("com.starcat.browser", {
          action: "request", service_url: localURL(base), path,
          method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null, token
        }).catch(() => { throw new Error("native_host_unavailable"); });
        if (!result?.ok) {
          const error = new Error(result?.body?.error || result?.error || "native_host_unavailable");
          error.status = result?.status || 0;
          throw error;
        }
        return result.body;
      }
      const response = await fetch(`${localURL(base)}${path}`, {
        method: options.method || "GET", body: options.body || undefined,
        signal, cache: "no-store", redirect: "error",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      const body = await response.json();
      if (!response.ok) {
        const error = new Error(body.error || `http_${response.status}`);
        error.status = response.status;
        throw error;
      }
      return body;
    }, 5000);
  }

  function extensionPage(sender) {
    return sender.id === api.runtime.id && sender.url?.startsWith(api.runtime.getURL("src/"));
  }

  function businessPath(path, method) {
    if (typeof path !== "string" || !path.startsWith("/plugin/v1/")) return false;
    const name = path.split("?")[0];
    return {
      GET: ["/plugin/v1/ping", "/plugin/v1/repo-context"],
      POST: ["/plugin/v1/stars/state", "/plugin/v1/recommendations/more", "/plugin/v1/actions/open"],
      PATCH: ["/plugin/v1/notes", "/plugin/v1/tags", "/plugin/v1/library-state"]
    }[method]?.includes(name) === true;
  }

  // Probe only the saved address and App default, never a range of local ports.
  async function discover(savedURL) {
    const deadline = Date.now() + 5000;
    return withTimeout(async () => {
      const current = await config();
      nativeAddresses.clear();
      // Reserve time for HTTP fallback inside the shared five-second budget.
      // Discovery is read-only and never exchanges credentials or starts pairing.
      if (api.runtime.sendNativeMessage) {
        try {
          const native = await withTimeout(() => api.runtime.sendNativeMessage("com.starcat.browser", {
            action: "discover", service_url: localURL(savedURL || current.serviceURL)
          }), Math.min(3500, deadline - Date.now()), "discovery_timeout");
          if (native?.ok && Array.isArray(native.body?.candidates) && native.body.candidates.length) {
            native.body.candidates.forEach((item) => nativeAddresses.add(localURL(item.serviceURL)));
            return native.body.candidates;
          }
        } catch {}
      }
      const candidates = [...new Set([savedURL || current.serviceURL, DEFAULT_URL].map(localURL))];
      let timedOut = false;
      const found = await Promise.all(candidates.map(async (serviceURL) => {
        try {
          return await withTimeout(async (signal) => {
            const response = await fetch(`${serviceURL}/plugin/v1/discover`, {
              signal, cache: "no-store", redirect: "error"
            });
            const data = await response.json();
            if (!response.ok || data.product !== "starcat" || data.protocol_version !== "1"
                || data.pairing !== "numeric_comparison" || !data.instance_id) return null;
            return { serviceURL, instanceID: data.instance_id, channel: data.channel };
          }, Math.min(1300, deadline - Date.now()), "discovery_timeout");
        } catch (error) {
          if (error.message === "discovery_timeout") timedOut = true;
          return null;
        }
      }));
      const seen = new Set();
      const matches = found.filter((item) => item && !seen.has(item.instanceID) && seen.add(item.instanceID));
      if (!matches.length && timedOut) throw new Error("discovery_timeout");
      return matches;
    }, 5000, "discovery_timeout");
  }

  // Version is display metadata only. Prefer Chrome's full client hint; the
  // reduced UA's zero suffix is not a real release number. Safari uses Version/.
  async function browserVersion(browser) {
    const navigator = globalThis.navigator;
    if (browser === "chrome" && navigator?.userAgentData?.getHighEntropyValues) {
      try {
        const hints = await navigator.userAgentData.getHighEntropyValues(["fullVersionList"]);
        const brands = hints.fullVersionList || [];
        const version = (brands.find((item) => item.brand === "Google Chrome")
          || brands.find((item) => item.brand === "Chromium"))?.version;
        if (/^\d+(?:\.\d+){0,3}$/.test(version)) return version;
      } catch {}
    }
    const version = navigator?.userAgent?.match(browser === "safari" ? /Version\/([\d.]+)/ : /Chrome\/([\d.]+)/)?.[1];
    return browser === "chrome" ? version?.replace(/\.0\.0\.0$/, "") : version;
  }

  async function pairing(message, sender) {
    if (!extensionPage(sender)) throw new Error("extension_page_required");
    const action = message.action;
    if (action === "discover") return { candidates: await discover(message.serviceURL) };
    if (action === "start") {
      if ((await config()).mode === "paired") throw new Error("pairing_already_configured");
      if (pending && !pending.completed && Date.parse(pending.receipt.expires_at) > Date.now()) throw new Error("pairing_pending");
      // A multi-app result clears the page address; never turn that into an implicit default selection.
      if (typeof message.serviceURL !== "string" || !message.serviceURL.trim()) throw new Error("service_selection_required");
      const stored = await api.storage.local.get("starcatCompanionInstanceID");
      const instanceID = stored.starcatCompanionInstanceID || crypto.randomUUID();
      await api.storage.local.set({ starcatCompanionInstanceID: instanceID });
      const serviceURL = localURL(message.serviceURL);
      const transport = nativeAddresses.has(serviceURL) ? "native" : "http";
      const browser = api.runtime.getURL("").startsWith("safari-web-extension:") ? "safari" : "chrome";
      const receipt = await jsonRequest(serviceURL, "/plugin/v1/pairing/start", {
        method: "POST", body: JSON.stringify({
          instance_id: instanceID, browser, name: message.name || `${browser} browser`,
          browser_version: await browserVersion(browser)
        })
      }, "", transport);
      pending = { serviceURL, receipt, transport, tabID: sender.tab?.id };
      return { code: receipt.code, expiresAt: receipt.expires_at };
    }
    if (action === "poll" || action === "cancel") {
      if (!pending || pending.tabID !== sender.tab?.id) throw new Error("pairing_expired");
      const request = pending;
      if (action === "poll" && request.completed) return { status: "approved" };
      const result = await jsonRequest(request.serviceURL, `/plugin/v1/pairing/${action}`, {
        method: "POST",
        body: JSON.stringify({ request_id: request.receipt.request_id, claim_secret: request.receipt.claim_secret })
      }, "", request.transport);
      if (action === "cancel") {
        if (request.completed) {
          const current = await config();
          await credential("delete", current.deviceID);
          await api.storage.local.remove(CONNECTION);
        }
        pending = null;
        return result;
      }
      if (result.status === "approved") {
        if (!result.token || !result.device_id || result.scope !== "companion") throw new Error("invalid_pairing_response");
        try {
          await credential("put", result.device_id, result.token);
          await api.storage.local.set({ [CONNECTION]: {
            serviceURL: request.serviceURL, mode: "paired", deviceID: result.device_id, scope: result.scope,
            transport: request.transport
          } });
        } catch (error) {
          await credential("delete", result.device_id).catch(() => {});
          await jsonRequest(request.serviceURL, "/plugin/v1/devices/revoke-current", { method: "POST" }, result.token, request.transport).catch(() => {});
          pending = null;
          throw new Error("credential_storage_failed");
        }
        request.completed = true;
        await api.storage.local.remove("starcatCompanionToken").catch(() => {});
      }
      if (!["pending", "approved"].includes(result.status)) pending = null;
      return { status: result.status };
    }
    if (action === "disconnect") {
      const current = await config();
      let revoked = false;
      if (current.mode === "paired" && current.token) {
        try {
          await jsonRequest(current.serviceURL, "/plugin/v1/devices/revoke-current", { method: "POST" }, current.token, current.transport);
          revoked = true;
        } catch (error) {
          if (error.status === 401) revoked = true;
          else if (!message.localOnly) return { status: "revoke_failed" };
        }
      }
      if (current.deviceID) await credential("delete", current.deviceID);
      await api.storage.local.remove([CONNECTION, "starcatCompanionToken"]);
      for (const stream of activeStreams) stream.abort();
      return { status: revoked ? "revoked" : "local_only" };
    }
    throw new Error("unsupported_pairing_action");
  }

  async function handle(message, sender) {
    if (message?.type === "starcat.publicConfig") {
      const current = await config();
      return { serviceURL: current.serviceURL, configured: Boolean(current.token) };
    }
    if (message?.type === "starcat.pairing") {
      const operation = pairingQueue.then(() => pairing(message, sender));
      pairingQueue = operation.catch(() => {});
      return { ok: true, body: await operation };
    }
    if (message?.type !== "starcat.localRequest") return undefined;
    const method = message.method || "GET";
    if (!businessPath(message.path, method)) throw new Error("unsupported_local_request");
    const current = await config();
    if (!current.token) throw new Error("missing_token");
    try {
      return { ok: true, body: await jsonRequest(current.serviceURL, message.path, { method, body: message.body }, current.token, current.transport) };
    } catch (error) {
      if (error.status === 401 && current.mode === "paired") error.message = "pairing_revoked";
      throw error;
    }
  }

  api.runtime.onMessage.addListener((message, sender, reply) => {
    if (!["starcat.publicConfig", "starcat.pairing", "starcat.localRequest"].includes(message?.type)) return false;
    handle(message, sender).then(reply, (error) => reply({ ok: false, error: error.message, status: error.status || 0 }));
    return true;
  });

  // Background owns SSE headers as well. Disconnect and revocation never expose
  // tokens to ports, and no automatic fallback or reconnection is attempted.
  api.runtime.onConnect.addListener((port) => {
    if (port.name !== "starcat.events") return;
    const streams = new Map();
    port.onMessage.addListener(async (message) => {
      if (message.type === "close") {
        streams.get(message.subscriptionID)?.abort();
        streams.delete(message.subscriptionID);
        return;
      }
      if (message.type !== "open") return;
      const controller = new AbortController();
      streams.get(message.subscriptionID)?.abort();
      streams.set(message.subscriptionID, controller);
      activeStreams.add(controller);
      try {
        const current = await config();
        if (!current.token) throw new Error("missing_token");
        const query = new URLSearchParams();
        if (message.repoID) query.set("repo_id", String(message.repoID));
        if (current.transport === "native") {
          await new Promise((resolve, reject) => {
            const native = api.runtime.connectNative("com.starcat.browser");
            controller.signal.addEventListener("abort", () => { native.disconnect(); resolve(); }, { once: true });
            native.onMessage.addListener((result) => {
              if (result.ok && result.event) port.postMessage({
                type: "starcat.event", subscriptionID: message.subscriptionID, event: result.event
              });
              else reject(new Error(result.body?.error || result.error || "native_event_failed"));
            });
            native.onDisconnect.addListener(() => {
              if (controller.signal.aborted) resolve();
              else reject(new Error("native_event_disconnected"));
            });
            native.postMessage({
              action: "events", service_url: localURL(current.serviceURL), method: "GET",
              path: `/plugin/v1/events?${query}`, token: current.token
            });
          });
          return;
        }
        const response = await fetch(`${localURL(current.serviceURL)}/plugin/v1/events?${query}`, {
          headers: { Authorization: `Bearer ${current.token}`, Accept: "text/event-stream" },
          signal: controller.signal, cache: "no-store", redirect: "error"
        });
        if (!response.ok || !response.body) throw new Error(`events_http_${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.replace(/\r\n/g, "\n").split("\n\n");
          buffer = parts.pop();
          for (const part of parts) {
            const lines = part.split("\n");
            const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
            if (!data) continue;
            const type = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
            port.postMessage({ type: "starcat.event", subscriptionID: message.subscriptionID, event: { type, data: JSON.parse(data) } });
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          try { port.postMessage({ type: "starcat.event.error", subscriptionID: message.subscriptionID, error: error.message }); } catch {}
        }
      } finally {
        if (streams.get(message.subscriptionID) === controller) streams.delete(message.subscriptionID);
        activeStreams.delete(controller);
      }
    });
    port.onDisconnect.addListener(() => { for (const stream of streams.values()) stream.abort(); });
  });
})();
