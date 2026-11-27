/* Handraw Skill Gallery — Silent Showcase & Image Cache (localStorage + IndexedDB)
 * - 0ms instant render from localStorage SWR cache on repeat visits
 * - Silent background refresh from https://handraw-style.com/api/public/skill-showcase
 * - Silent idle WebP thumbnail caching into IndexedDB (bounded LRU, works on file:// & localhost)
 * - Gracefully degrades to direct <img referrerpolicy="no-referrer"> if IndexedDB/CORS is unavailable
 */
(function (global) {
  "use strict";

  const API_BASE = "https://handraw-style.com/api/public/skill-showcase";
  const META_PREFIX = "hw_skill_showcase_v1:";
  const IDB_NAME = "hw_skill_img_cache_v1";
  const IDB_STORE = "blobs";
  const MAX_CACHED_IMAGES = 80;
  const MAX_BLOB_BYTES = 600 * 1024;
  const SOFT_TTL_MS = 10 * 60 * 1000; // 10 min before silent revalidation
  const CONCURRENCY = 2;

  let dbPromise = null;
  const memUrls = new Map();
  const prefetchQueue = [];
  const prefetchQueued = new Set();
  let activeFetches = 0;

  function safeHref(url, fallback) {
    const s = String(url || "").trim();
    if (/^https:\/\//i.test(s) || /^handraw:\/\//i.test(s)) return s;
    return fallback || "";
  }

  function scheduleIdle(fn, delay) {
    if (typeof global.requestIdleCallback === "function") {
      global.requestIdleCallback(() => fn(), { timeout: Math.max(800, delay || 1500) });
    } else {
      global.setTimeout(fn, delay || 180);
    }
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    if (!global.indexedDB) {
      dbPromise = Promise.resolve(null);
      return dbPromise;
    }
    dbPromise = new Promise((resolve) => {
      try {
        const req = global.indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            const store = db.createObjectStore(IDB_STORE, { keyPath: "url" });
            store.createIndex("ts", "ts", { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  async function idbGetBlob(url) {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(url);
        req.onsuccess = () => resolve(req.result && req.result.blob ? req.result.blob : null);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function idbPutBlob(url, blob) {
    if (!blob || !blob.size || blob.size > MAX_BLOB_BYTES) return;
    const db = await openDB();
    if (!db) return;
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        store.put({ url, blob, ts: Date.now(), size: blob.size });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (_) {
        resolve();
      }
    });
    scheduleIdle(() => void trimIdbCache(db), 3000);
  }

  async function trimIdbCache(db) {
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const countReq = store.count();
      countReq.onsuccess = () => {
        const total = Number(countReq.result || 0);
        if (total <= MAX_CACHED_IMAGES) return;
        let toDelete = total - MAX_CACHED_IMAGES;
        const idx = store.index("ts");
        const cursorReq = idx.openCursor();
        cursorReq.onsuccess = (ev) => {
          const cur = ev.target.result;
          if (cur && toDelete > 0) {
            cur.delete();
            toDelete--;
            cur.continue();
          }
        };
      };
    } catch (_) {}
  }

  function pumpPrefetch() {
    while (activeFetches < CONCURRENCY && prefetchQueue.length > 0) {
      const url = prefetchQueue.shift();
      if (!url || memUrls.has(url)) continue;
      activeFetches++;
      (async () => {
        try {
          const existing = await idbGetBlob(url);
          if (existing) {
            memUrls.set(url, URL.createObjectURL(existing));
            return;
          }
          const ctrl = typeof AbortController === "function" ? new AbortController() : null;
          const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : 0;
          const resp = await fetch(url, { mode: "cors", credentials: "omit", signal: ctrl ? ctrl.signal : undefined });
          if (timer) clearTimeout(timer);
          if (!resp.ok) return;
          const blob = await resp.blob();
          if (blob && blob.size > 0 && blob.size <= MAX_BLOB_BYTES && String(blob.type || "").startsWith("image/")) {
            await idbPutBlob(url, blob);
            memUrls.set(url, URL.createObjectURL(blob));
          }
        } catch (_) {
          // Silent ignore when offline or CORS blocked
        } finally {
          activeFetches--;
          if (prefetchQueue.length > 0) {
            scheduleIdle(pumpPrefetch, 120);
          }
        }
      })();
    }
  }

  function prefetchUrls(urls) {
    if (!Array.isArray(urls) || !urls.length) return;
    let added = false;
    for (const raw of urls) {
      const u = safeHref(raw, "");
      if (!u || !/^https:\/\//i.test(u) || prefetchQueued.has(u) || memUrls.has(u)) continue;
      prefetchQueued.add(u);
      prefetchQueue.push(u);
      added = true;
    }
    if (added) scheduleIdle(pumpPrefetch, 350);
  }

  function attachImage(imgEl, thumbUrl, fallbackUrl) {
    if (!imgEl) return;
    const primary = safeHref(thumbUrl, "") || safeHref(fallbackUrl, "");
    const fallback = safeHref(fallbackUrl, "") || primary;
    if (!primary) return;
    imgEl.referrerPolicy = "no-referrer";
    imgEl.decoding = "async";

    if (memUrls.has(primary)) {
      imgEl.src = memUrls.get(primary);
      return;
    }

    // Check IndexedDB first; if missing, paint direct URL immediately and silently cache in background.
    let settled = false;
    idbGetBlob(primary).then((blob) => {
      if (blob && imgEl.isConnected) {
        const objUrl = URL.createObjectURL(blob);
        memUrls.set(primary, objUrl);
        settled = true;
        imgEl.src = objUrl;
      } else if (!settled) {
        imgEl.src = primary;
        if (fallback && fallback !== primary) {
          imgEl.addEventListener("error", () => {
            if (imgEl.dataset.fallbackUsed) return;
            imgEl.dataset.fallbackUsed = "1";
            imgEl.src = fallback;
          }, { once: true });
        }
        prefetchUrls([primary]);
      }
    }).catch(() => {
      imgEl.src = primary;
    });
  }

  function readMetaCache(kind) {
    try {
      const raw = global.localStorage.getItem(META_PREFIX + kind);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data || typeof parsed.data !== "object") return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeMetaCache(kind, data, signature) {
    try {
      global.localStorage.setItem(META_PREFIX + kind, JSON.stringify({
        ts: Date.now(),
        sig: signature,
        data,
      }));
    } catch (_) {}
  }

  function payloadSignature(data) {
    try {
      const exIds = (data.exclusives || []).map((x) => `${x.code}:${x.image}`).join(",");
      const inIds = (data.inspirations || []).map((x) => `${x.id}:${x.price}:${x.thumbImage}`).join(",");
      return `${exIds}|${inIds}`;
    } catch (_) {
      return String(Date.now());
    }
  }

  function load(opts, onData) {
    const kind = (opts && opts.kind) || "all";
    const exclusiveLimit = Number((opts && opts.exclusiveLimit) || 18);
    const inspirationLimit = Number((opts && opts.inspirationLimit) ?? 24);
    const forceNetwork = Boolean(opts && opts.forceNetwork);

    const cached = readMetaCache(kind);
    let lastSig = "";
    if (cached && cached.data) {
      lastSig = cached.sig || payloadSignature(cached.data);
      try {
        onData(cached.data, { fromCache: true, stale: (Date.now() - Number(cached.ts || 0)) > SOFT_TTL_MS });
      } catch (_) {}
    }

    const doFetch = async () => {
      try {
        const url = `${API_BASE}?kind=${encodeURIComponent(kind)}&exclusiveLimit=${exclusiveLimit}&inspirationLimit=${inspirationLimit}`;
        const ctrl = typeof AbortController === "function" ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), 6000) : 0;
        const resp = await fetch(url, { mode: "cors", credentials: "omit", signal: ctrl ? ctrl.signal : undefined });
        if (timer) clearTimeout(timer);
        if (!resp.ok) {
          if (!cached) onData(null, { fromCache: false, offline: true });
          return;
        }
        const fresh = await resp.json();
        if (!fresh || fresh.ok === false) {
          if (!cached) onData(null, { fromCache: false, offline: true });
          return;
        }
        const sig = payloadSignature(fresh);
        writeMetaCache(kind, fresh, sig);

        // Silently cache thumbnails into IndexedDB during idle time
        const thumbs = [
          ...(fresh.exclusives || []).map((x) => x.thumbImage || x.image),
          ...(fresh.inspirations || []).map((x) => x.thumbImage || x.image),
        ].filter(Boolean);
        prefetchUrls(thumbs);

        if (!cached || sig !== lastSig) {
          lastSig = sig;
          onData(fresh, { fromCache: false, offline: false });
        }
      } catch (_) {
        if (!cached) {
          try { onData(null, { fromCache: false, offline: true }); } catch (_) {}
        }
      }
    };

    if (!cached || forceNetwork) {
      void doFetch();
    } else {
      scheduleIdle(() => void doFetch(), 400);
    }
  }

  global.HandrawShowcaseCache = {
    load,
    attachImage,
    prefetchUrls,
    safeHref,
  };
})(window);
