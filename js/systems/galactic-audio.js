import { OdysseyConfig } from '../config/odyssey-config.js';
import { ASSET_QUEUE } from './audio/asset-manifest.js';
import { AssetLoader } from './audio/asset-loader.js';
import { AudioGraph } from './audio/audio-graph.js';
import { IdleScheduler } from './audio/idle-scheduler.js';

// Facade over the audio subsystem: owns the enabled/busy state and decides
// when the graph, the loader and the idle scheduler come into play.
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
