/*
 * Starcat Companion shared utilities.
 *
 * The extension deliberately stores only the local service URL and Companion bearer
 * token. GitHub data, notes, health scores, and actions remain owned by the
 * Starcat app and are fetched through the loopback API.
 */

(function () {
  const extensionAPI = globalThis.chrome;
  const STORAGE_KEYS = {
    serviceURL: "starcatCompanionServiceURL",
    port: "starcatCompanionPort",
    token: "starcatCompanionToken"
  };

  const DEFAULT_SERVICE_URL = "http://127.0.0.1:5051";
  // Keep pairing, options and popup recovery text consistent; never display
  // raw transport/storage errors or credential details in these user surfaces.
  function connectionErrorMessage(error, locale = "en") {
    const messages = {
      en: {
        discovery_timeout: "Finding Starcat timed out. Open Starcat, enable Browser Plugin Service in Settings > Extensions & Connections > Browser Extensions, then try again or use a Key.",
        connection_timeout: "The connection timed out after 5 seconds. Check that Starcat is running, then try again. The request may have reached the app; check it before starting another request.",
        pairing_expired: "The request expired. Pair again.",
        pairing_claim_invalid: "The pairing request is no longer valid. Pair again.",
        credential_storage_failed: "The browser could not save the pairing credentials. Try again or use a Key.",
        pairing_already_configured: "This browser is already paired. Unpair it before connecting again or using a manual Key.",
        unpair_before_manual_key: "Unpair this browser on the pairing page before saving a manual Key.",
        native_host_unavailable: "The local connection component is unavailable. Check that Starcat is running and try again, or use a Key.",
        companion_unavailable: "Cannot reach Starcat. Open the app and enable Browser Plugin Service, then try again.",
        invalid_pairing_response: "Starcat returned an invalid pairing response. Check for app and extension updates, then pair again.",
        pairing_revoked: "This browser's authorization was revoked. Pair again or use a Key.",
        missing_token: "Pair this browser or enter a Local API Key first.",
        unauthorized: "The Local API Key is invalid or has changed. Copy it again from Starcat Settings > Extensions & Connections > Browser Extensions > Local API Key.",
        failed: "Connection failed. Check that Starcat is running and the service address is correct, then try again or use a Key."
      },
      zh: {
        discovery_timeout: "查找 Starcat 超时。请打开 Starcat，在“设置 → 扩展与连接 → 浏览器扩展”中启用浏览器插件服务，再重新查找或使用 Key 连接。",
        connection_timeout: "连接已超时（5 秒）。请确认 Starcat 正在运行后重试。请求可能已送达 App，再次发起前请先检查 App 中的请求状态。",
        pairing_expired: "请求已过期，请重新配对。",
        pairing_claim_invalid: "配对请求已失效，请重新配对。",
        credential_storage_failed: "未能在浏览器中保存配对凭据，请重试或使用 Key 连接。",
        pairing_already_configured: "此浏览器已配对，请先取消配对，再重新连接或使用手工 Key。",
        unpair_before_manual_key: "请先在配对页取消此浏览器的配对，再保存手工 Key。",
        native_host_unavailable: "本地连接组件不可用，请确认 Starcat 正在运行后重试，或使用 Key 连接。",
        companion_unavailable: "无法连接 Starcat，请打开 App 并启用浏览器插件服务后重试。",
        invalid_pairing_response: "Starcat 返回的配对信息无效，请检查 App 和扩展更新后重新配对。",
        pairing_revoked: "此浏览器的授权已撤销，请重新配对或使用 Key 连接。",
        missing_token: "请先配对此浏览器，或填写本地 API Key。",
        unauthorized: "本地 API Key 无效或已更新，请从“Starcat 设置 → 扩展与连接 → 浏览器扩展 → 本地 API Key”重新复制。",
        failed: "连接失败，请确认 Starcat 正在运行且服务地址正确，再重试或使用 Key 连接。"
      }
    };
    const text = messages[locale] || messages.en;
    const code = text[error?.message] ? error.message
      : error?.status === 401 || error?.message === "http_401" ? "unauthorized" : "failed";
    return text[code] || text.failed;
  }
  const REPO_SEGMENT_BLOCKLIST = new Set([
    "about",
    "apps",
    "codespaces",
    "collections",
    "customer-stories",
    "dashboard",
    "events",
    "explore",
    "features",
    "marketplace",
    "new",
    "notifications",
    "orgs",
    "pricing",
    "pulls",
    "search",
    "settings",
    "sponsors",
    "topics",
    "trending"
  ]);

  function normalizeServiceURL(value) {
    const raw = String(value || "").trim();
    if (!raw) return DEFAULT_SERVICE_URL;

    try {
      const url = new URL(raw);
      const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
      if (isLoopback && url.port) {
        // Starcat's loopback Companion service is plain HTTP. Normalizing any
        // accidental https:// input avoids Safari/Chrome trying TLS on 127.0.0.1.
        url.protocol = "http:";
        url.pathname = "";
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/$/, "");
      }
    } catch {
      // Fall through to the default. The local API should never be a relative URL.
    }
    return DEFAULT_SERVICE_URL;
  }

  function normalizeToken(value) {
    return String(value || "").trim();
  }

  async function loadConfig() {
    if (!["chrome-extension:", "safari-web-extension:"].includes(globalThis.location?.protocol)) {
      const reply = await extensionAPI.runtime.sendMessage({ type: "starcat.publicConfig" });
      return { serviceURL: reply.serviceURL, token: reply.configured ? "background-managed" : "" };
    }
    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.serviceURL,
      STORAGE_KEYS.port,
      STORAGE_KEYS.token,
      "starcatCompanionConnection"
    ]);
    if (stored.starcatCompanionConnection) {
      return { ...stored.starcatCompanionConnection, token: "", paired: true };
    }
    const migratedURL = stored[STORAGE_KEYS.serviceURL]
      || (stored[STORAGE_KEYS.port] ? `http://127.0.0.1:${stored[STORAGE_KEYS.port]}` : DEFAULT_SERVICE_URL);
    return {
      serviceURL: normalizeServiceURL(migratedURL),
      token: normalizeToken(stored[STORAGE_KEYS.token])
    };
  }

  async function saveConfig(config) {
    const previous = await loadConfig();
    if (previous.mode === "paired") {
      if (!config.token && normalizeServiceURL(config.serviceURL) === previous.serviceURL) return;
      throw new Error("unpair_before_manual_key");
    }
    await extensionAPI.storage.local.remove("starcatCompanionConnection");
    await chrome.storage.local.set({
      [STORAGE_KEYS.serviceURL]: normalizeServiceURL(config.serviceURL),
      [STORAGE_KEYS.token]: normalizeToken(config.token)
    });
  }

  function parseGitHubRepo(urlString) {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      return null;
    }
    if (url.hostname !== "github.com") return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    if (REPO_SEGMENT_BLOCKLIST.has(owner)) return null;
    if (!/^[A-Za-z0-9._-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) return null;

    return {
      owner,
      repo,
      fullName: `${owner}/${repo}`
    };
  }

  function createClient(config) {
    const baseURL = normalizeServiceURL(config.serviceURL);
    const token = normalizeToken(config.token);

    async function request(path, options = {}) {
      const response = await extensionAPI.runtime.sendMessage({
        type: "starcat.localRequest",
        path,
        method: options.method || "GET",
        body: options.body || null
      });
      if (!response?.ok) {
        const error = new Error(response?.error || "request_failed");
        error.status = response?.status || 0;
        error.body = response?.body || null;
        throw error;
      }
      return response.body;
    }

    async function streamEvents(params, handlers) {
      const subscriptionID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const port = extensionAPI.runtime.connect({ name: "starcat.events" });
      port.onMessage.addListener((message) => {
        if (message?.subscriptionID !== subscriptionID) return;
        if (message.type === "starcat.event") handlers.onEvent?.(message.event);
        if (message.type === "starcat.event.error") {
          handlers.onError?.(new Error(message.error || "events_failed"));
        }
      });
      port.postMessage({ type: "open", subscriptionID, repoID: params.repoID });
      return {
        close() {
          try { port.postMessage({ type: "close", subscriptionID }); } catch {}
          port.disconnect();
        }
      };
    }

    return {
      ping() {
        return request("/plugin/v1/ping");
      },
      repoContext(repo) {
        const params = new URLSearchParams({ owner: repo.owner, repo: repo.repo });
        return request(`/plugin/v1/repo-context?${params.toString()}`);
      },
      syncStarState(repo, isStarred) {
        return request("/plugin/v1/stars/state", {
          method: "POST",
          body: JSON.stringify({
            owner: repo.owner,
            repo: repo.repo,
            state: isStarred ? "starred" : "unstarred"
          })
        });
      },
      loadMoreRecommendations(repo) {
        return request("/plugin/v1/recommendations/more", {
          method: "POST",
          body: JSON.stringify({ owner: repo.owner, repo: repo.repo })
        });
      },
      saveNote(repo, content) {
        return request("/plugin/v1/notes", {
          method: "PATCH",
          body: JSON.stringify({ owner: repo.owner, repo: repo.repo, content })
        });
      },
      saveTags(repo, tagIDs) {
        return request("/plugin/v1/tags", {
          method: "PATCH",
          body: JSON.stringify({ owner: repo.owner, repo: repo.repo, tag_ids: tagIDs })
        });
      },
      saveLibraryState(repo, state) {
        return request("/plugin/v1/library-state", {
          method: "PATCH",
          body: JSON.stringify({
            owner: repo.owner,
            repo: repo.repo,
            state
          })
        });
      },
      openAction(repo, action) {
        return request("/plugin/v1/actions/open", {
          method: "POST",
          body: JSON.stringify({ owner: repo.owner, repo: repo.repo, action })
        });
      },
      events(params, handlers) {
        return streamEvents(params, handlers);
      }
    };
  }

  globalThis.StarcatCompanion = {
    DEFAULT_SERVICE_URL,
    extensionAPI,
    connectionErrorMessage,
    normalizeServiceURL,
    loadConfig,
    saveConfig,
    parseGitHubRepo,
    createClient
  };
})();
