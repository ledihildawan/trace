import { OdysseyConfig } from '../config/odyssey-config.js';
import { onReducedMotionChange, prefersReducedMotion } from '../core/motion.js';

export class IonCursor {
  #host;
  #target = { x: 0, y: 0 };
  #current = { x: 0, y: 0 };
  #rafId = null;
  #enabled = false;
  #inertia = OdysseyConfig.physics.cursorInertia;

  constructor(host) {
    this.#host = host;
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
    this.#wake();
  }

  get position() {
    return this.#current;
  }

  start() {
    // Touch devices have no persistent pointer to trail.
    if (window.matchMedia(OdysseyConfig.timing.cursorCoarseQuery).matches) return;
    this.#enabled = true;
    this.#tick();
  }

  // Runs only while the trail is still catching up. Idling at 60fps to write
  // two unchanged values was burning a frame budget for nothing.
  #tick = () => {
    const dx = this.#target.x - this.#current.x;
    const dy = this.#target.y - this.#current.y;
    this.#current.x += dx * this.#inertia;
    this.#current.y += dy * this.#inertia;

    const style = this.#host.style;
    style.setProperty(OdysseyConfig.dom.ionXVar, this.#current.x);
    style.setProperty(OdysseyConfig.dom.ionYVar, this.#current.y);

    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
      this.#current.x = this.#target.x;
      this.#current.y = this.#target.y;
      this.#rafId = null;
      return;
    }
    this.#rafId = requestAnimationFrame(this.#tick);
  };

  #wake() {
    if (this.#rafId === null && this.#enabled) this.#rafId = requestAnimationFrame(this.#tick);
  }

  stop() {
    if (this.#rafId !== null) cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
  }
}
