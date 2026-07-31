import { OdysseyConfig } from '../config/odyssey-config.js';
import { ASSET_QUEUE } from './audio/asset-manifest.js';
import { AssetLoader } from './audio/asset-loader.js';
import { AudioGraph } from './audio/audio-graph.js';
import { IdleScheduler } from './audio/idle-scheduler.js';
import { resolveVoice } from './audio/mix.js';

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
      (key) => this.play(key)
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
        this.#watchContextState();
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
    for (const type of ['click', 'touchstart', 'keydown']) {
      window.addEventListener(type, init, { once: true });
    }
  }

  // A phone call, a screen lock or an autoplay policy can suspend the context
  // out from under us. Nothing was watching for it, so audio simply stopped
  // and never came back until the page was reloaded.
  #watchContextState() {
    const ctx = this.#graph.ctx;
    const revive = () => {
      if (!this.enabled) return;
      if (ctx.state === 'running') return;
      this.#graph.resume().catch(() => {});
    };
    ctx.addEventListener?.('statechange', revive);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) revive();
    });
    // Some platforms only allow resuming inside a gesture.
    for (const type of ['pointerdown', 'keydown', 'touchend']) {
      window.addEventListener(type, revive, { passive: true });
    }
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

  // Levels come from the mix table; callers pass a key, not a number.
  async play(key, options = {}) {
    if (!this.enabled || !this.initialized) return;
    if (this.isBusy && key === 'hover') return;

    await this.#ensureLoaded(key);
    if (!this.#loader.has(key)) return;

    const voice = resolveVoice(key, options);
    const handle = this.#graph.play(this.#loader.get(key), voice);
    if (!voice.loop) return;
    this.#ambientSources.get(key)?.stop();
    this.#ambientSources.set(key, handle);
  }

  injectEnginePower(velocity) {
    if (!this.initialized) {
      this.#loader?.load('hover');
      return;
    }
    if (!this.enabled) return;
    const cfg = OdysseyConfig.audio;
    const power = Math.min(velocity / cfg.engineVelocityFullPx, 1);
    if (power > cfg.engineFloor) {
      const now = Date.now();
      if (now - this.#lastHoverPlay > cfg.hoverRepeatMs) {
        this.play('hover', {
          volume: cfg.masterVolume * power * 0.3,
          playbackRate: 0.4 + power * 1.2,
        });
        this.#lastHoverPlay = now;
      }
    }
    // Rides the sfx bus, not the master: the master carries the user's own
    // volume and the duck, and writing it here cancelled both.
    this.#graph.setSfxGain(1 + power * cfg.enginePowerRange);
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
      this.play('base');
      this.#idle.reset();
    } else {
      this.play('mute');
      this.#ambientSources.forEach((handle) => handle.stop());
      this.#ambientSources.clear();
      this.#idle.clear();
    }
    return this.enabled;
  }

  setBusy(value) {
    this.isBusy = value;
    if (!this.initialized) return;
    this.#graph.setDuck(value ? OdysseyConfig.audio.duckedGain : 1);
  }
}
