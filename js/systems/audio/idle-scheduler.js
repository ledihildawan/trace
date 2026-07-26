import { OdysseyConfig } from '../../config/odyssey-config.js';
import { IDLE_CLIPS } from './asset-manifest.js';

export // Plays a random ambient clip once the user has been idle, then keeps
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
