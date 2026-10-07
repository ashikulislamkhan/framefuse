import { CONFIG } from "./config.js";

/**
 * FrameProvider: the only code that knows where hosted frames come from.
 * The editor asks for a slug and gets metadata plus an ImageBitmap back.
 *
 * To swap storage later (Drive API, Firebase, ...) replace #loadRegistry() and #sources();
 * everything else, including caching, stays the same.
 */
export class FrameProvider {
  #registry = null;            // Promise of the parsed frames.json
  #inflight = new Map();       // cache key -> Promise<Blob>, so one frame is never downloaded twice at once

  constructor(config = CONFIG) { this.config = config; }

  /** Load (once) and return the registry object { slug: entry }. */
  #loadRegistry() {
    this.#registry ||= fetch(this.config.REGISTRY_URL, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`${this.config.REGISTRY_URL}: HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => { this.#registry = null; throw err; });
    return this.#registry;
  }

  /** Candidate download URLs for a registry entry. An explicit `url` field wins over Drive. */
  #sources(frame) {
    if (frame.url) return [frame.url];
    if (!frame.fileId || /^REPLACE/.test(frame.fileId)) throw new Error(`"${frame.title}" has no fileId in frames.json`);
    return this.config.DRIVE_URL_TEMPLATES.map((t) => t.replace("{id}", encodeURIComponent(frame.fileId)));
  }

  /** Cache key per slug + version; bumping `version` in frames.json invalidates the cached PNG. */
  #cacheKey(frame) {
    return new URL(`frame-cache/${encodeURIComponent(frame.slug)}/v${frame.version ?? 1}`, document.baseURI).href;
  }

  /** @returns {Promise<object|null>} the entry (with its `slug`) or null if unknown. Case-insensitive. */
  async find(slug) {
    const registry = await this.#loadRegistry();
    const key = Object.keys(registry).find((k) => k.toLowerCase() === String(slug).toLowerCase());
    return key ? { ...registry[key], slug: key } : null;
  }

  /** Download the original PNG once; later calls are served from the Cache API (works offline). */
  getBlob(frame) {
    const key = this.#cacheKey(frame);
    if (!this.#inflight.has(key)) {
      const job = this.#fetchBlob(frame, key).finally(() => this.#inflight.delete(key));
      this.#inflight.set(key, job);
    }
    return this.#inflight.get(key);
  }

  async #fetchBlob(frame, key) {
    const cache = "caches" in globalThis ? await caches.open(this.config.FRAME_CACHE).catch(() => null) : null;
    const hit = await cache?.match(key);
    if (hit) return hit.blob();

    let lastError;
    for (const url of this.#sources(frame)) {
      try {
        const res = await fetch(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) throw new Error(`not an image (${blob.type || "unknown type"})`);
        if (cache) {
          await cache.put(key, new Response(blob, { headers: { "Content-Type": blob.type } })).catch(() => {});
          const prefix = key.slice(0, key.lastIndexOf("/") + 1);       // drop older versions of this slug
          for (const req of await cache.keys()) if (req.url.startsWith(prefix) && req.url !== key) cache.delete(req);
        }
        return blob;
      } catch (err) { lastError = err; }
    }
    throw new Error(`Could not download "${frame.title}" from ${this.config.DRIVE_FOLDER_NAME}: ${lastError?.message}`);
  }

  /** The original PNG decoded for the editor (not memoised: the editor owns and closes its bitmap). */
  async getBitmap(frame) {
    return createImageBitmap(await this.getBlob(frame));
  }
}
