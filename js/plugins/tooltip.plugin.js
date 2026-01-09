// TRACE Tooltip Plugin
// Optimized: CSS Individual Transforms, Anti-Collision, Intra-Element Transitions

import { TracePlugin } from '../core/plugin-manager.js';
import { clamp, pxVar } from '../core/utils.js';

export class TooltipPlugin extends TracePlugin {
  constructor() {
    super('TooltipPlugin');
    this._target = null;
    this._raf = null;
    this._isTouch = false;
  }

  init(engine) {
    super.init(engine);
    Object.assign(this.engine.tooltip.style, {
      position: 'fixed',
      inset: '0 auto auto 0',
      zIndex: '10000',
      pointerEvents: 'none',
      willChange: 'translate, opacity',
      translate: '0 0', // Modern Individual Transform
      display: 'flex',
      flexDirection: 'column',
    });

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.engine.tooltip.style.transition = reduce ? 'opacity 0ms' : 'opacity 150ms ease-out, translate 0.1s ease-out';
  }

  showTooltipForElement(el, isTouch = false) {
    if (!el) return;
    this._isTouch = isTouch;
    this.cancelHide();

    const cacheKey = el.dataset.trDate + el.dataset.trInfo;
    if (this.engine.tooltip.dataset.cache !== cacheKey) {
      this._render(el.dataset.trDate, el.dataset.trInfo);
    }

    this.engine.tooltip.style.opacity = '1';
    this.engine.tooltip.setAttribute('aria-hidden', 'false');

    this._target = el;
    this.updatePosition();
  }

  _render(date, info) {
    const el = this.engine.tooltip;
    el.style.opacity = '0.4'; // Content transition hint

    const frag = document.createDocumentFragment();
    const create = (tag, text, cls) => {
      const n = document.createElement(tag);
      n.className = cls;
      n.textContent = text;
      return n;
    };

    frag.append(create('span', date, 'tr-tip-line'), create('b', info, 'tr-tip-line'));

    // Batch DOM update
    setTimeout(() => {
      el.replaceChildren(frag);
      el.style.opacity = '1';
      el.dataset.cache = date + info;
    }, 30);
  }

  updatePosition() {
    if (this._raf) cancelAnimationFrame(this._raf);

    const loop = () => {
      if (!this._target) return (this._raf = null);

      const r = this._target.getBoundingClientRect();
      const t = this.engine.tooltip.getBoundingClientRect();
      const pad = 14;

      // Collision Avoidance: Horizontal
      const x = clamp(r.left + r.width / 2, pad + t.width / 2, window.innerWidth - pad - t.width / 2);

      // Dynamic Offsets
      const offset = this._isTouch ? 50 : 15;
      const safeTop = (pxVar('--tr-safe-top') || 0) + pad;
      const useBottom = r.top - safeTop < t.height;

      const y = useBottom ? r.bottom + offset : r.top - offset;

      // Performance: GPU Accelerated Individual Transforms
      this.engine.tooltip.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
      this.engine.tooltip.style.transform = `translate(-50%, ${useBottom ? '0' : '-100%'})`;

      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  hideTooltip() {
    this.cancelHide();
    this._target = null;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.engine.tooltip.style.opacity = '0';
    this.engine.tooltip.setAttribute('aria-hidden', 'true');
  }

  scheduleHide(ms) {
    this.cancelHide();
    this._hideTimer = setTimeout(() => this.hideTooltip(), ms);
  }

  cancelHide() {
    clearTimeout(this._hideTimer);
    this._hideTimer = null;
  }
}
