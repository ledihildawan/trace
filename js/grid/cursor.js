import { OdysseyConfig } from '../config/odyssey-config.js';
import { onReducedMotionChange, prefersReducedMotion } from '../core/motion.js';

export class IonCursor {
  #target = { x: 0, y: 0 };
  #current = { x: 0, y: 0 };
  #rafId = null;
  #inertia = OdysseyConfig.physics.cursorInertia;

  constructor() {
    this.#target.x = window.innerWidth / 2;
    this.#target.y = window.innerHeight / 2;
    this.#current.x = this.#target.x;
    this.#current.y = this.#target.y;
    // Reduced-motion users get an instant cursor instead of a smoothed trail,
    // and toggling the OS setting takes effect without reloading the page.
    this.#applyMotionPreference(prefersReducedMotion());
    onReducedMotionChange((reduced) => this.#applyMotionPreference(reduced));
  }

  #applyMotionPreference(reduced) {
    this.#inertia = reduced ? 1 : OdysseyConfig.physics.cursorInertia;
  }

  setPointer(x, y) {
    this.#target.x = x;
    this.#target.y = y;
  }

  get position() {
    return this.#current;
  }

  start() {
    // Touch devices have no persistent pointer to trail.
    if (window.matchMedia(OdysseyConfig.timing.cursorCoarseQuery).matches) return;
    const tick = () => {
      this.#current.x += (this.#target.x - this.#current.x) * this.#inertia;
      this.#current.y += (this.#target.y - this.#current.y) * this.#inertia;
      document.documentElement.style.setProperty(OdysseyConfig.dom.ionXVar, this.#current.x);
      document.documentElement.style.setProperty(OdysseyConfig.dom.ionYVar, this.#current.y);
      this.#rafId = requestAnimationFrame(tick);
    };
    this.#rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (this.#rafId !== null) cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
  }
}
