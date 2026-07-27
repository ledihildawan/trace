import { OdysseyConfig } from '../config/odyssey-config.js';
import { prefersReducedMotion } from '../core/motion.js';

const SWITCHING_CLASS = 'theme-switching';

export class ThemeController {
  #veil;
  #root;
  #current = 'dark';
  // Counted, not a boolean: toggling again mid-switch would otherwise clear
  // the flag while the first switch is still running.
  #switching = 0;

  constructor() {
    this.#root = document.documentElement;
    this.#veil = document.getElementById(OdysseyConfig.dom.themeVeil);
    this.apply(this.#readStorage() || this.#current);
  }

  get current() {
    return this.#current;
  }


  apply(theme) {
    if (!OdysseyConfig.dom.themes.includes(theme)) theme = 'dark';
    this.#current = theme;
    this.#root.setAttribute(OdysseyConfig.dom.themeAttr, theme);
    this.#root.style.colorScheme = theme;
  }

  // Element transitions are suppressed for the length of a switch. Otherwise
  // each one runs on its own clock — 0.4s for a cell, 0.8s for the grid, 1s
  // for the watermark — and the theme arrives in pieces instead of at once.
  #beginSwitch() {
    this.#switching += 1;
    this.#root.classList.add(SWITCHING_CLASS);
  }

  #endSwitch() {
    this.#switching = Math.max(0, this.#switching - 1);
    if (this.#switching === 0) this.#root.classList.remove(SWITCHING_CLASS);
  }

  toggle() {
    const next = this.#current === 'light' ? 'dark' : 'light';
    const commit = () => {
      this.apply(next);
      this.#writeStorage(next);
    };

    // The View Transitions API cross-fades the real pixels of the page, which
    // is what the hand-rolled veil was approximating by covering everything
    // with an opaque panel on a pair of nested timers.
    if (!prefersReducedMotion() && typeof document.startViewTransition === 'function') {
      this.#beginSwitch();
      const transition = document.startViewTransition(commit);
      // `finished` rejects if the transition is skipped, so settle either way.
      transition.finished.catch(() => {}).finally(() => this.#endSwitch());
      return next;
    }

    if (!this.#veil) {
      commit();
      return next;
    }

    // Fallback for browsers without View Transitions: the original veil. The
    // veil starts lifting before the cells would have finished their own
    // fades, so the same suppression applies.
    const activeClass = OdysseyConfig.classes.active;
    this.#veil.classList.add(activeClass);
    setTimeout(() => {
      this.#beginSwitch();
      commit();
      setTimeout(() => {
        this.#veil.classList.remove(activeClass);
        this.#endSwitch();
      }, OdysseyConfig.timing.themeVeilReleaseMs);
    }, OdysseyConfig.timing.themeVeilDelayMs);
    return next;
  }

  // localStorage can throw in private-browsing / sandboxed contexts.
  #readStorage() {
    try { return localStorage.getItem(OdysseyConfig.dom.themeStorageKey); }
    catch { return null; }
  }

  #writeStorage(value) {
    try { localStorage.setItem(OdysseyConfig.dom.themeStorageKey, value); }
    catch { /* storage unavailable — keep theme in-memory only */ }
  }
}
