import { OdysseyConfig } from '../config/odyssey-config.js';

const ASSET_QUEUE = [
  { key: 'beep', file: 'confirmation-beep.mp3', priority: 1 },
  { key: 'hover', file: 'hover-over-cell.mp3', priority: 1 },
  { key: 'scroll', file: 'year-change-scroll-transition.mp3', priority: 1 },
  { key: 'base', file: 'master-ambient-loop.mp3', priority: 1 },
  { key: 'jump', file: 'jump-to-today.mp3', priority: 2 },
  { key: 'warp', file: 'fast-scroll-wrap-mode.mp3', priority: 2 },
  { key: 'theme', file: 'theme-toggle.mp3', priority: 2 },
  { key: 'enable', file: 'enabled-ambience.mp3', priority: 1 },
  { key: 'mute', file: 'mute-ambience.mp3', priority: 1 },
  { key: 'pulse', file: 'short-ambient-pulse.mp3', priority: 3 },
  { key: 'wind', file: 'nebula-wind-sweep.mp3', priority: 3 },
  { key: 'engine', file: 'engine-idle-hum.mp3', priority: 3 },
  { key: 'stellar', file: 'distant-stellar-ambience.mp3', priority: 3 },
];

const SPATIAL_KEYS = new Set(['hover', 'beep', 'pulse', 'wind']);
const IDLE_CLIPS = [
  { k: 'pulse', v: 0.15 },
  { k: 'wind', v: 0.2 },
  { k: 'engine', v: 0.15 },
  { k: 'stellar', v: 0.2 },
];

class AssetLoader {
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
    return this.#runWithLimit(
      targets.map((item) => () => this.load(item.key)),
      maxConcurrent
    );
  }

  #runWithLimit(tasks, limit) {
    return new Promise((resolve) => {
      let idx = 0;
      let active = 0;
      const total = tasks.length;
      let completed = 0;
      const next = () => {
        while (active < limit && idx < total) {
          const task = tasks[idx++];
          active++;
          Promise.resolve(task()).finally(() => {
            active--;
            completed++;
            if (completed === total) resolve();
            else next();
          });
        }
      };
      next();
    });
  }
}

class AudioGraph {
  #ctx = null;
  #master = null;
  #panner = null;

  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('AudioContext unsupported');
    this.#ctx = new Ctx();
    this.#master = this.#ctx.createGain();
    this.#master.gain.value = OdysseyConfig.audio.masterVolume;
    this.#panner = this.#ctx.createPanner();
    this.#panner.panningModel = 'HRTF';
    this.#panner.distanceModel = 'inverse';
    this.#panner.refDistance = 1;
    this.#panner.maxDistance = 10000;
    this.#panner.rolloffFactor = 1;
    this.#panner.connect(this.#master);
    this.#master.connect(this.#ctx.destination);
  }

  get ctx() { return this.#ctx; }
  get master() { return this.#master; }
  get panner() { return this.#panner; }

  resume() { return this.#ctx.resume(); }

  setMasterVolume(value, timeConstant = 0.08) {
    if (!this.#master) return;
    this.#master.gain.setTargetAtTime(value, this.#ctx.currentTime, timeConstant);
  }

  updateSpatialPosition(x, y) {
    if (!this.#panner) return;
    const px = (x / window.innerWidth) * 2 - 1;
    const py = -(y / window.innerHeight) * 2 + 1;
    // Older WebKit exposes only the deprecated setPosition(), with no
    // positionX/Y/Z AudioParams to ramp.
    if (!this.#panner.positionX) {
      this.#panner.setPosition?.(px, py, 0.5);
      return;
    }
    const t = this.#ctx.currentTime;
    this.#panner.positionX.setTargetAtTime(px, t, 0.1);
    this.#panner.positionY.setTargetAtTime(py, t, 0.1);
    this.#panner.positionZ.setTargetAtTime(0.5, t, 0.1);
  }

  spawnSource(buffer, options = {}) {
    const source = this.#ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.#ctx.createGain();
    gain.gain.value = options.volume ?? 1.0;
    source.playbackRate.value = options.playbackRate || 1.0;
    source.connect(gain);
    if (options.spatial !== false && SPATIAL_KEYS.has(options.key)) {
      gain.connect(this.#panner);
    } else {
      gain.connect(this.#master);
    }
    source.loop = Boolean(options.loop);
    source.start(0);
    return source;
  }
}

// Plays a random ambient clip once the user has been idle, then keeps
// re-scheduling itself at a jittered interval until activity resets it.
class IdleScheduler {
  #enabled;
  #playback;
  #timer = null;
  #isBusy = () => false;

  constructor(enabledProvider, playback) {
    this.#enabled = enabledProvider;
    this.#playback = playback;
  }

  setBusyFn(fn) { this.#isBusy = fn; }

  reset() {
    clearTimeout(this.#timer);
    if (!this.#enabled()) return;
    this.#timer = setTimeout(() => this.#fire(), OdysseyConfig.audio.idleDelay);
  }

  clear() {
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  #fire() {
    this.#timer = null;
    if (!this.#enabled() || this.#isBusy()) return;
    const clip = IDLE_CLIPS[Math.floor(Math.random() * IDLE_CLIPS.length)];
    this.#playback(clip.k, clip.v);
    const [min, max] = OdysseyConfig.audio.idleInterval;
    this.#timer = setTimeout(() => this.#fire(), Math.random() * (max - min) + min);
  }
}

export class GalacticAudio {
  #graph = null;
  #loader = null;
  #idle;
  #ambientSources = new Map();
  enabled = false;
  initialized = false;
  isBusy = false;
  #lastHoverPlay = 0;

  constructor() {
    this.#idle = new IdleScheduler(
      () => this.enabled,
      (key, volume) => this.play(key, { volume })
    );
    this.#idle.setBusyFn(() => this.isBusy);
    this.#setupActivation();
  }

  #setupActivation() {
    let started = false;
    const init = async () => {
      if (this.initialized || started) return;
      started = true;
      try {
        this.#graph = new AudioGraph();
        this.#loader = new AssetLoader(
          this.#graph.ctx,
          OdysseyConfig.audio.basePath,
          ASSET_QUEUE
        );
        await this.#loader.preloadPriority(1, OdysseyConfig.timing.audioConcurrentMax);
        this.#idle.reset();
        this.initialized = true;
        this.#scheduleDeferred();
      } catch (err) {
        // AudioContext unsupported or blocked — stay silent forever rather
        // than throwing on every subsequent user gesture.
        console.warn('[GalacticAudio] init failed — staying silent.', err);
      }
    };
    ['click', 'touchstart', 'keydown'].forEach((e) =>
      window.addEventListener(e, init, { once: true })
    );
  }

  #scheduleDeferred() {
    if (!this.#loader) return;
    const trigger = async () => {
      if (!this.#loader) return;
      await this.#loader.preloadPriority(2, OdysseyConfig.timing.audioConcurrentMax);
      const idle = window.requestIdleCallback
        ? (cb) => requestIdleCallback(cb, { timeout: 5000 })
        : (cb) => setTimeout(cb, 1500);
      idle(() => this.#loader.preloadPriority(3, OdysseyConfig.timing.audioConcurrentMax));
    };
    window.addEventListener('pointermove', trigger, { once: true });
    window.addEventListener('wheel', trigger, { once: true });
  }

  async #ensureLoaded(key) {
    if (!this.#loader || this.#loader.has(key)) return;
    await this.#loader.load(key);
  }

  async play(key, options = {}) {
    if (!this.enabled || !this.initialized) return;
    if (this.isBusy && key === 'hover') return;

    await this.#ensureLoaded(key);
    if (!this.#loader.has(key)) return;

    const buffer = this.#loader.get(key);
    const source = this.#graph.spawnSource(buffer, { ...options, key });
    if (options.loop) this.#ambientSources.set(key, source);
  }

  injectEnginePower(velocity) {
    if (!this.initialized) {
      this.#loader?.load('hover');
      return;
    }
    if (!this.enabled) return;
    const power = Math.min(velocity / 120, 1.0);
    if (power > 0.15) {
      const now = Date.now();
      if (now - this.#lastHoverPlay > 100) {
        this.play('hover', {
          volume: OdysseyConfig.audio.masterVolume * power * 0.3,
          playbackRate: 0.4 + power * 1.2,
        });
        this.#lastHoverPlay = now;
      }
    }
    this.#graph.setMasterVolume(OdysseyConfig.audio.masterVolume * (1.0 + power * 0.4));
  }

  resetIdleTimer() { this.#idle.reset(); }

  updateSpatialPosition(x, y) {
    if (!this.initialized) return;
    this.#graph.updateSpatialPosition(x, y);
  }

  toggleMaster() {
    if (!this.initialized) return false;
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.#graph.resume();
      this.#graph.setMasterVolume(OdysseyConfig.audio.masterVolume);
      this.play('enable');
      this.play('base', { volume: OdysseyConfig.audio.ambientBaseVolume, loop: true });
      this.#idle.reset();
    } else {
      this.play('mute');
      this.#ambientSources.forEach((src) => src.stop());
      this.#ambientSources.clear();
      this.#idle.clear();
    }
    return this.enabled;
  }

  setBusy(value) {
    this.isBusy = value;
    if (!this.initialized) return;
    this.#graph.setMasterVolume(value ? 0.1 : OdysseyConfig.audio.masterVolume, 0.5);
  }
}
