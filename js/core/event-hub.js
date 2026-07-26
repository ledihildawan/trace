import { OdysseyConfig } from '../config/odyssey-config.js';

export class LongPressDetector {
  #timer = null;
  #start = { x: 0, y: 0 };
  #onTrigger = null;

  constructor(target = window) {
    this.#attach(target);
  }

  onTrigger(callback) {
    this.#onTrigger = callback;
    return this;
  }

  #startTimer(x, y) {
    this.#start = { x, y };
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#onTrigger?.(x, y);
    }, OdysseyConfig.timing.longPressMs);
  }

  #cancel() {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  #attach(target) {
    target.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.#startTimer(e.clientX, e.clientY);
    });
    const moveCheck = (e) => {
      if (!this.#timer) return;
      const dx = e.clientX - this.#start.x;
      const dy = e.clientY - this.#start.y;
      if (dx * dx + dy * dy > OdysseyConfig.timing.longPressMoveTolerancePx2) {
        this.#cancel();
      }
    };
    target.addEventListener('pointermove', moveCheck);
    const cancelAll = () => this.#cancel();
    target.addEventListener('pointerup', cancelAll);
    target.addEventListener('pointerleave', cancelAll);
    target.addEventListener('pointercancel', cancelAll);
  }
}

export class ScrollEndDetector {
  #timer = null;
  #onSettle = null;
  #target;

  constructor(target) {
    this.#target = target;
    target.addEventListener('scroll', () => {
      if (this.#timer) clearTimeout(this.#timer);
      this.#timer = setTimeout(() => {
        this.#timer = null;
        this.#onSettle?.(this.#target.scrollTop);
      }, OdysseyConfig.timing.scrollSettleMs);
    }, { passive: true });
  }

  onSettle(callback) {
    this.#onSettle = callback;
    return this;
  }
}
