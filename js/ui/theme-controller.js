import { OdysseyConfig } from '../config/odyssey-config.js';
import { prefersReducedMotion } from '../core/motion.js';

export class ThemeController {
  #veil;
  #root;
  #current = 'dark';

  constructor() {
    this.#root = document.documentElement;
    this.#veil = document.getElementById(OdysseyConfig.dom.themeVeil);
    this.apply(this.#readStorage() || this.#current);
  }

  get current() {
    return this.#current;
  }

  isLight() {
    return this.#current === 'light';
  }

  apply(theme) {
    if (!OdysseyConfig.dom.themes.includes(theme)) theme = 'dark';
    this.#current = theme;
    this.#root.setAttribute(OdysseyConfig.dom.themeAttr, theme);
    this.#root.style.colorScheme = theme;
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
      document.startViewTransition(commit);
      return next;
    }

    if (!this.#veil) {
      commit();
      return next;
    }

    // Fallback for browsers without View Transitions: the original veil.
    const activeClass = OdysseyConfig.classes.active;
    this.#veil.classList.add(activeClass);
    setTimeout(() => {
      commit();
      setTimeout(
        () => this.#veil.classList.remove(activeClass),
        OdysseyConfig.timing.themeVeilReleaseMs
      );
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
