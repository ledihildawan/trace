import { OdysseyConfig } from '../config/odyssey-config.js';

export class KeyboardHints {
  #el;
  #hideTimer = null;
  #fadedClass = OdysseyConfig.classes.faded;

  constructor() {
    this.#el = document.getElementById(OdysseyConfig.dom.keyboardHints);
  }

  start() {
    if (!this.#el) return;
    setTimeout(() => this.#el.classList.add(this.#fadedClass), 6000);
    window.addEventListener('pointermove', (e) => {
      if (e.clientY <= window.innerHeight - 80) return;
      this.#el.classList.remove(this.#fadedClass);
      if (this.#hideTimer) clearTimeout(this.#hideTimer);
      this.#hideTimer = setTimeout(
        () => this.#el.classList.add(this.#fadedClass),
        2000
      );
    });
  }
}
