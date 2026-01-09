// TRACE Tooltip Plugin
// Modern Standard: Individual Transforms (ES2024+)

import { TracePlugin } from '../core/plugin-manager.js';
import { clamp, pxVar } from '../core/utils.js';

export class TooltipPlugin extends TracePlugin {
  #target = null;
  #raf = null;
  #isTouch = false;
  #hideTimer = null;

  init(engine) {
    super.init(engine);
    Object.assign(this.engine.tooltip.style, {
      position: 'fixed',
      inset: '0 auto auto 0',
      zIndex: '10000',
      pointerEvents: 'none',
      willChange: 'translate, opacity',
      translate: '0 0',
      display: 'flex',
      flexDirection: 'column',
    });

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.engine.tooltip.style.transition = reduce
      ? 'opacity 0ms'
      : 'opacity 150ms ease-out, translate 100ms cubic-bezier(0.22, 1, 0.36, 1)';
  }

  showTooltipForElement(el, isTouch = false) {
    if (!el) return;
    this.#isTouch = isTouch;
    this.cancelHide();

    if (this.engine.tooltip.dataset.cache !== el.dataset.trDate + el.dataset.trInfo) {
      this.#render(el);
    }

    this.engine.tooltip.style.opacity = '1';
    this.engine.tooltip.setAttribute('aria-hidden', 'false');
    this.#target = el;
    this.updatePosition();
  }

  #render(el) {
    const tip = this.engine.tooltip;
    tip.style.opacity = '0.4';

    requestAnimationFrame(() => {
      const frag = document.createDocumentFragment();
      const d = document.createElement('span');
      d.className = 'tr-tip-line';
      d.textContent = el.dataset.trDate;
      const i = document.createElement('b');
      i.className = 'tr-tip-line';
      i.textContent = el.dataset.trInfo;
      frag.append(d, i);
      tip.replaceChildren(frag);
      tip.dataset.cache = el.dataset.trDate + el.dataset.trInfo;
      requestAnimationFrame(() => (tip.style.opacity = '1'));
    });
  }

  updatePosition() {
    if (this.#raf) cancelAnimationFrame(this.#raf);

    const loop = () => {
      if (!this.#target) return (this.#raf = null);
      const r = this.#target.getBoundingClientRect();
      const t = this.engine.tooltip.getBoundingClientRect();
      const pad = 14;

      const x = clamp(r.left + r.width / 2, pad + t.width / 2, window.innerWidth - pad - t.width / 2);
      const offset = this.#isTouch ? 50 : 15;
      const safeTop = (pxVar('--tr-safe-top') || 0) + pad;
      const useBottom = r.top - safeTop < t.height;
      const y = useBottom ? r.bottom + offset : r.top - offset;

      this.engine.tooltip.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
      this.engine.tooltip.style.transform = `translate(-50%, ${useBottom ? '0' : '-100%'})`;

      this.#raf = requestAnimationFrame(loop);
    };
    this.#raf = requestAnimationFrame(loop);
  }

  hideTooltip() {
    this.cancelHide();
    this.#target = null;
    this.engine.tooltip.style.opacity = '0';
    this.engine.tooltip.setAttribute('aria-hidden', 'true');
  }

  scheduleHide(ms) {
    this.cancelHide();
    this.#hideTimer = setTimeout(() => this.hideTooltip(), ms);
  }

  cancelHide() {
    clearTimeout(this.#hideTimer);
    this.#hideTimer = null;
  }
}
