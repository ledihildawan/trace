import { OdysseyConfig } from '../../config/odyssey-config.js';
import { runWithLimit } from '../../core/concurrency.js';

// Fetches and decodes clips on demand, de-duplicating concurrent requests
// for the same key and capping how many decode at once.
export class AssetLoader {
  #path;
  #ctx;
  #queue;
  #sounds = new Map();
  #inFlight = new Map();

  constructor(ctx, path, queue) {
    this.#ctx = ctx;
    this.#path = path;
    this.#queue = queue;
  }

  has(key) { return this.#sounds.has(key); }
  get(key) { return this.#sounds.get(key) ?? null; }

  async load(key) {
    if (this.#sounds.has(key)) return this.#sounds.get(key);
    if (this.#inFlight.has(key)) return this.#inFlight.get(key);

    const item = this.#queue.find((q) => q.key === key);
    if (!item) return null;

    const promise = this.#fetchAndDecode(item).finally(() => this.#inFlight.delete(key));
    this.#inFlight.set(key, promise);
    return promise;
  }

  async #fetchAndDecode(item) {
    try {
      // Without a deadline a stalled request leaves its entry in #inFlight
      // forever, so that clip can never be retried.
      const res = await fetch(`${this.#path}${item.file}`, {
        signal: AbortSignal.timeout(OdysseyConfig.audio.fetchTimeoutMs),
      });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const decoded = await this.#ctx.decodeAudioData(buf);
      this.#sounds.set(item.key, decoded);
      return decoded;
    } catch (err) {
      console.warn(`[GalacticAudio] Failed to load ${item.file}`, err);
      return null;
    }
  }

  preloadPriority(priority, maxConcurrent) {
    const targets = this.#queue.filter((q) => q.priority === priority && !this.#sounds.has(q.key));
    return runWithLimit(
      targets.map((item) => () => this.load(item.key)),
      maxConcurrent
    );
  }

}
