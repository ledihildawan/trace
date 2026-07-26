import { OdysseyConfig } from '../config/odyssey-config.js';

export class ToastManager {
  #el;
  #hideTimer = null;

  constructor() {
    this.#el = document.getElementById(OdysseyConfig.dom.toast);
  }

  show(message) {
    if (!this.#el) return;
    if (this.#hideTimer) clearTimeout(this.#hideTimer);
    this.#el.innerText = message;
    this.#el.classList.add(OdysseyConfig.classes.active);
    this.#hideTimer = setTimeout(
      () => this.#el.classList.remove(OdysseyConfig.classes.active),
      OdysseyConfig.timing.toastMs
    );
  }
}
