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
    normalizeServiceURL,
    loadConfig,
    saveConfig,
    parseGitHubRepo,
    createClient
  };
})();
