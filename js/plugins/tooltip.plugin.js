// TRACE Tooltip Plugin
// UX UPDATE: Snap-to-Element ("Magnetic") Positioning

import { TOOLTIP_LINGER_MS } from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';
import { clamp, pxVar } from '../core/utils.js';

export class TooltipPlugin extends TracePlugin {
  constructor() {
    super('TooltipPlugin');
    this._hideTimer = null;
    this._rafId = null;

    // Position tracking
    this._targetEl = null;
    this._isTouch = false;
  }

  init(engine) {
    super.init(engine);

    // Semantic & Accessibility
    const el = engine.tooltip;
    el.setAttribute('role', 'tooltip');
    el.setAttribute('aria-hidden', 'true');

    // Force Fixed positioning for absolute stability (no jitter on scroll)
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      zIndex: '10000',
      pointerEvents: 'none', // Allows clicking through tooltip
      willChange: 'transform, opacity',
      margin: '0',
    });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.style.transition = reduceMotion ? 'opacity 0ms' : 'opacity 150ms ease-out';
  }

  /**
   * PRIMARY METHOD: Show tooltip anchored to a DOM element.
   * This creates the "Magnetic Snap" effect.
   */
  showTooltipForElement(element, isTouch = false) {
    if (!element) return;

    this.cancelHide();

    // Update content from data attributes
    const date = element.dataset.trDate;
    const info = element.dataset.trInfo;
    if (!date || !info) return;

    this._updateContent(date, info);

    // Show visual
    this.engine.tooltip.setAttribute('aria-hidden', 'false');
    this.engine.tooltip.style.opacity = '1';

    // Update State & Schedule Position
    this._targetEl = element;
    this._isTouch = isTouch;

    if (!this._rafId) {
      this._rafId = requestAnimationFrame(this._updatePosition.bind(this));
    }
  }

  /**
   * Internal loop to update position based on target element's viewport rect.
   */
  _updatePosition() {
    this._rafId = null;
    if (!this._targetEl) return;

    // Get fresh coordinates
    const rect = this._targetEl.getBoundingClientRect();
    const toolRect = this.engine.tooltip.getBoundingClientRect();

    const pad = 14;
    const safeTop = (pxVar('--tr-safe-top') || 0) + pad;
    const safeBottom = (pxVar('--tr-safe-bottom') || 0) + pad;

    // --- HORIZONTAL: CENTER ON CELL ---
    let centerX = rect.left + rect.width / 2;

    // Clamp to viewport edges so tooltip doesn't go off-screen
    centerX = clamp(centerX, pad + toolRect.width / 2, window.innerWidth - pad - toolRect.width / 2);

    // --- VERTICAL: SNAP ABOVE CELL ---
    // UX Rule: For touch, we want it significantly above the finger/cell to avoid occlusion.
    const touchOffset = 45; // High clearance for finger
    const mouseOffset = 12; // Standard clearance
    const offset = this._isTouch ? touchOffset : mouseOffset;

    const topAnchor = rect.top - offset; // Ideal position above
    const bottomAnchor = rect.bottom + offset; // Ideal position below

    const spaceAbove = topAnchor - safeTop;
    const spaceBelow = window.innerHeight - safeBottom - bottomAnchor;

    let finalY = 0;
    let isAbove = true;

    // Preference Logic
    if (this._isTouch) {
      // Strongly prefer TOP for touch
      if (spaceAbove > toolRect.height) {
        isAbove = true;
      } else if (spaceBelow > toolRect.height) {
        isAbove = false;
      } else {
        // If tight on both sides, pick the larger side
        isAbove = spaceAbove > spaceBelow;
      }
    } else {
      // Standard logic: Prefer top unless it doesn't fit
      isAbove = spaceAbove > toolRect.height || spaceAbove > spaceBelow;
    }

    // Apply Transform
    if (isAbove) {
      finalY = topAnchor;
      // Anchor point: Bottom Center
      this.engine.tooltip.style.transform = `translate3d(${Math.round(centerX)}px, ${Math.round(
        finalY
      )}px, 0) translate(-50%, -100%)`;
    } else {
      finalY = bottomAnchor;
      // Anchor point: Top Center
      this.engine.tooltip.style.transform = `translate3d(${Math.round(centerX)}px, ${Math.round(
        finalY
      )}px, 0) translate(-50%, 0)`;
    }
  }

  _updateContent(date, info) {
    const key = date + info;
    // Cache check to avoid unnecessary DOM thrashing
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
