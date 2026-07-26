import { OdysseyConfig } from '../config/odyssey-config.js';

export class YearNavigator {
  #containers = [];
  #buttons = { prev: [], next: [] };
  #onPrev = null;
  #onNext = null;
  #enabled = { prev: true, next: true };

  constructor(root = document.body) {
    this.#containers = Array.from(root.querySelectorAll('.year-nav'));
    this.#containers.forEach((container) => {
      container.querySelectorAll('[data-nav]').forEach((btn) => {
        const dir = btn.dataset.nav;
        if (dir !== 'prev' && dir !== 'next') return;
        this.#buttons[dir].push(btn);
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          if (!this.#enabled[dir]) return;
          (dir === 'prev' ? this.#onPrev : this.#onNext)?.();
        });
      });
    });
  }

  onPrev(callback) { this.#onPrev = callback; return this; }
  onNext(callback) { this.#onNext = callback; return this; }

  setPrevEnabled(enabled) { this.#setEnabled('prev', enabled); }
  setNextEnabled(enabled) { this.#setEnabled('next', enabled); }

  setBounds(prev, next) {
    this.#setEnabled('prev', prev);
    this.#setEnabled('next', next);
  }

  reveal() {
    this.#containers.forEach((c) => c.classList.add(OdysseyConfig.classes.visible));
  }

  hide() {
    this.#containers.forEach((c) => c.classList.remove(OdysseyConfig.classes.visible));
  }

  // setBounds is called from the per-frame scroll loop, so bail out unless the
  // state actually flipped — otherwise every frame writes to the DOM for nothing.
  #setEnabled(dir, enabled) {
    if (this.#enabled[dir] === enabled) return;
    this.#enabled[dir] = enabled;
    this.#buttons[dir].forEach((btn) => {
      btn.classList.toggle(OdysseyConfig.classes.disabled, !enabled);
      btn.disabled = !enabled;
    });
  }
}
