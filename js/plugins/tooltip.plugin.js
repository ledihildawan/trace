// TRACE Tooltip Plugin
// UX UPDATE: Snap-to-Element for stable mobile reading

import { TOOLTIP_LINGER_MS } from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';
import { clamp, pxVar } from '../core/utils.js';

export class TooltipPlugin extends TracePlugin {
  constructor() {
    super('TooltipPlugin');
    this._hideTimer = null;
    this._rafId = null;

    // Position state
    this._targetEl = null;
    this._isTouch = false;
  }

  init(engine) {
    super.init(engine);

    // Semantic & Style
    const el = engine.tooltip;
    el.setAttribute('role', 'tooltip');
    el.setAttribute('aria-hidden', 'true');

    // Force Fixed positioning for stability
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      zIndex: '10000',
      pointerEvents: 'none',
      willChange: 'transform, opacity',
      margin: '0', // Reset any default
    });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.style.transition = reduceMotion ? 'opacity 0ms' : 'opacity 150ms ease-out';
  }

  /**
   * NEW METHOD: Show tooltip anchored to a DOM element.
   * This is the magic for the "Snap" effect.
   */
  showTooltipForElement(element, isTouch = false) {
    if (!element) return;

    this.cancelHide();

    // Update content
    const date = element.dataset.trDate;
    const info = element.dataset.trInfo;
    if (!date || !info) return;

    this._updateContent(date, info);

    // Show
    this.engine.tooltip.setAttribute('aria-hidden', 'false');
    this.engine.tooltip.style.opacity = '1';

    // Schedule position update
    this._targetEl = element;
    this._isTouch = isTouch;

    if (!this._rafId) {
      this._rafId = requestAnimationFrame(this._updatePosition.bind(this));
    }
  }

  /**
   * Internal loop to update position based on target element
   */
  _updatePosition() {
    this._rafId = null;
    if (!this._targetEl) return;

    const rect = this._targetEl.getBoundingClientRect();
    const toolRect = this.engine.tooltip.getBoundingClientRect();

    const pad = 14;
    const safeTop = (pxVar('--tr-safe-top') || 0) + pad;
    const safeBottom = (pxVar('--tr-safe-bottom') || 0) + pad;

    // --- HORIZONTAL: CENTER ON CELL ---
    // Calculate center of the cell
    let centerX = rect.left + rect.width / 2;

    // Clamp to viewport edges
    centerX = clamp(centerX, pad + toolRect.width / 2, window.innerWidth - pad - toolRect.width / 2);

    // --- VERTICAL: SNAP ABOVE CELL ---
    // UX Rule: For touch, we want it significantly above the finger/cell.
    const touchOffset = 45; // Pixel gap for touch
    const mouseOffset = 12; // Pixel gap for mouse
    const offset = this._isTouch ? touchOffset : mouseOffset;

    const topAnchor = rect.top - offset; // Position above cell
    const bottomAnchor = rect.bottom + offset; // Position below cell

    const spaceAbove = topAnchor - safeTop;
    const spaceBelow = window.innerHeight - safeBottom - bottomAnchor;

    let finalY = 0;
    let isAbove = true;

    // Preference logic
    if (this._isTouch) {
      // Strongly prefer TOP for touch to avoid finger occlusion
      if (spaceAbove > toolRect.height) {
        isAbove = true;
      } else if (spaceBelow > toolRect.height) {
        isAbove = false;
      } else {
        // If tight, pick side with more space
        isAbove = spaceAbove > spaceBelow;
      }
    } else {
      // Standard mouse logic
      isAbove = spaceAbove > toolRect.height || spaceAbove > spaceBelow;
    }

    if (isAbove) {
      finalY = topAnchor;
      this.engine.tooltip.style.transform = `translate3d(${Math.round(centerX)}px, ${Math.round(
        finalY
      )}px, 0) translate(-50%, -100%)`;
    } else {
      finalY = bottomAnchor;
      this.engine.tooltip.style.transform = `translate3d(${Math.round(centerX)}px, ${Math.round(
        finalY
      )}px, 0) translate(-50%, 0)`;
    }
  }

  // Deprecated/Legacy support if needed, but redirects to element logic if possible
  showTooltipAt(x, y, isTouch, date, info) {
    // Fallback only if strictly coordinate based is needed (rare in this new UX)
    // For this Grid implementation, we prefer Element-based.
    // But for compatibility with interaction.plugin calling, we update content here
    // and might assume interaction plugin passed element.
  }

  _updateContent(date, info) {
    const key = date + info;
    if (this.engine.tooltip.dataset.cache === key) return;

    this.engine.tooltip.textContent = '';
    const dSpan = document.createElement('span');
    dSpan.className = 'tr-tip-line';
    dSpan.textContent = date;

    const iSpan = document.createElement('b');
    iSpan.className = 'tr-tip-line';
    iSpan.textContent = info;

    this.engine.tooltip.append(dSpan, iSpan);
    this.engine.tooltip.dataset.cache = key;
  }

  hideTooltip() {
    this.cancelHide();
    this._targetEl = null; // Stop tracking
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;

    this.engine.tooltip.style.opacity = '0';
    this.engine.tooltip.setAttribute('aria-hidden', 'true');
  }

  scheduleHide(ms = TOOLTIP_LINGER_MS) {
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
