// TRACE Tooltip Plugin
// Optimized with: Intra-Element Transitions & Collision Avoidance

import { TracePlugin } from '../core/plugin-manager.js';
import { clamp, pxVar } from '../core/utils.js';

export class TooltipPlugin extends TracePlugin {
  constructor() {
    super('TooltipPlugin');
    this._hideTimer = null;
    this._rafId = null;
    this._targetEl = null;
    this._isTouch = false;
  }

  init(engine) {
    super.init(engine);

    const el = engine.tooltip;
    el.setAttribute('role', 'tooltip');
    el.setAttribute('aria-hidden', 'true');

    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      zIndex: '10000',
      pointerEvents: 'none',
      willChange: 'transform, opacity',
      margin: '0',
      display: 'flex',
      flexDirection: 'column',
    });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.style.transition = reduceMotion ? 'opacity 0ms' : 'opacity 150ms ease-out, transform 0.1s ease-out';
  }

  showTooltipForElement(element, isTouch = false) {
    if (!element) return;
    this.cancelHide();

    const date = element.dataset.trDate;
    const info = element.dataset.trInfo;
    if (!date || !info) return;

    // 5. Intra-Element Transition: Subtle cross-fade for content change
    this._updateContent(date, info);

    this.engine.tooltip.setAttribute('aria-hidden', 'false');
    this.engine.tooltip.style.opacity = '1';

    this._targetEl = element;
    this._isTouch = isTouch;

    if (!this._rafId) {
      this._rafId = requestAnimationFrame(this._updatePosition.bind(this));
    }
  }

  _updatePosition() {
    this._rafId = null;
    if (!this._targetEl) return;

    const rect = this._targetEl.getBoundingClientRect();
    const toolRect = this.engine.tooltip.getBoundingClientRect();
    const pad = 14;

    // --- COLLISION AVOIDANCE: Horizontal Shift ---
    let centerX = rect.left + rect.width / 2;
    const minX = pad + toolRect.width / 2;
    const maxX = window.innerWidth - pad - toolRect.width / 2;

    // If tooltip would bleed off edge, shift it horizontally while keeping anchor
    centerX = clamp(centerX, minX, maxX);

    const offset = this._isTouch ? 50 : 15;
    const topAnchor = rect.top - offset;
    const safeTop = (pxVar('--tr-safe-top') || 0) + pad;

    let finalY = topAnchor;
    let anchorBottom = true;

    if (topAnchor - safeTop < toolRect.height) {
      finalY = rect.bottom + offset;
      anchorBottom = false;
    }

    const transY = anchorBottom ? '-100%' : '0';
    this.engine.tooltip.style.transform = `translate3d(${Math.round(centerX)}px, ${Math.round(
      finalY
    )}px, 0) translate(-50%, ${transY})`;
  }

  _updateContent(date, info) {
    const key = date + info;
    if (this.engine.tooltip.dataset.cache === key) return;

    const el = this.engine.tooltip;

    // Simple fade-out-in transition for text
    el.style.opacity = '0.4';

    setTimeout(() => {
      el.textContent = '';
      const dSpan = document.createElement('span');
      dSpan.className = 'tr-tip-line';
      dSpan.textContent = date;

      const iSpan = document.createElement('b');
      iSpan.className = 'tr-tip-line';
      iSpan.textContent = info;

      el.append(dSpan, iSpan);
      el.style.opacity = '1';
      el.dataset.cache = key;
    }, 40);
  }

  hideTooltip() {
    this.cancelHide();
    this._targetEl = null;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    this.engine.tooltip.style.opacity = '0';
    this.engine.tooltip.setAttribute('aria-hidden', 'true');
  }

  scheduleHide(ms) {
    this.cancelHide();
    this._hideTimer = setTimeout(() => this.hideTooltip(), ms);
  }

  cancelHide() {
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._hideTimer = null;
  }

  destroy() {
    this.hideTooltip();
    super.destroy();
  }
}
