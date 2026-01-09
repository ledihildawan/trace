// TRACE Tooltip Plugin
// Manages tooltip display and positioning
// Optimized for "Fixed" positioning to guarantee accuracy

import { TOOLTIP_LINGER_MS } from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';
import { clamp, pxVar } from '../core/utils.js';

export class TooltipPlugin extends TracePlugin {
  constructor() {
    super('TooltipPlugin');
    this.tooltipHideTimer = null;

    // Cache dimensions
    this.tooltipWidth = 0;
    this.tooltipHeight = 0;

    // RAF State
    this._rafId = null;
    this._pending = { x: 0, y: 0, isTouch: false, active: false };
  }

  init(engine) {
    super.init(engine);

    // ACCESSIBILITY & STYLING
    engine.tooltip.setAttribute('role', 'tooltip');
    engine.tooltip.setAttribute('aria-hidden', 'true');

    // FORCE FIXED POSITIONING (The fix for "wrong position")
    // This ensures clientX/clientY matches the visual position 1:1
    Object.assign(engine.tooltip.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      margin: '0',
      pointerEvents: 'none', // Allow clicking through the tooltip
      zIndex: '9999', // Ensure it sits on top of everything
      willChange: 'transform, opacity',
    });

    // Motion preferences
    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduce) {
      engine.tooltip.style.transition = 'opacity 0ms linear';
    } else {
      engine.tooltip.style.transition = 'opacity 150ms ease-out';
    }
  }

  showTooltipAt(clientX, clientY, isTouch, dateText, infoText) {
    if (!dateText || !infoText) return;

    this.cancelHide();
    this.updateTooltipContent(dateText, infoText);

    this.engine.tooltip.setAttribute('aria-hidden', 'false');
    this.engine.tooltip.style.opacity = '1';

    this.positionTooltip(clientX, clientY, isTouch);
  }

  updateTooltipContent(dateText, infoText) {
    const cacheKey = `${dateText}|${infoText}`;
    if (this.engine.tooltip.dataset.cache !== cacheKey) {
      this.engine.tooltip.textContent = '';

      const line1 = document.createElement('span');
      line1.className = 'tr-tip-line';
      line1.textContent = dateText;

      const line2 = document.createElement('b');
      line2.className = 'tr-tip-line';
      line2.textContent = infoText;

      this.engine.tooltip.append(line1, line2);
      this.engine.tooltip.dataset.cache = cacheKey;

      // Reset width cache to force remeasure
      this.tooltipWidth = 0;
      this.tooltipHeight = 0;
    }
  }

  positionTooltip(clientX, clientY, isTouch = false) {
    this._pending.x = clientX;
    this._pending.y = clientY;
    this._pending.isTouch = isTouch;
    this._pending.active = true;

    if (this._rafId) return;

    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (!this._pending.active) return;

      const { x: cx, y: cy, isTouch: touch } = this._pending;

      // Safety padding from screen edges
      const pad = 12;
      const safeTop = (pxVar('--tr-safe-top') || 0) + pad;
      const safeBottom = (pxVar('--tr-safe-bottom') || 0) + pad;

      // Measure if not cached
      if (!this.tooltipWidth || !this.tooltipHeight) {
        const rect = this.engine.tooltip.getBoundingClientRect();
        this.tooltipWidth = rect.width;
        this.tooltipHeight = rect.height;
      }

      const w = this.tooltipWidth;
      const h = this.tooltipHeight;

      // 1. HORIZONTAL CLAMPING
      // Keep tooltip fully inside the viewport width
      let finalX = clamp(cx, pad + w / 2, window.innerWidth - pad - w / 2);

      // 2. VERTICAL POSITIONING STRATEGY
      const baseOffset = pxVar('--tr-tooltip-vertical-offset') || 20;

      // For Touch: Give more space (finger radius ~40px + buffer)
      // For Mouse: Standard small offset
      const vOffset = touch ? 60 : baseOffset;

      const topAnchor = cy - vOffset; // Point above the cursor
      const bottomAnchor = cy + vOffset; // Point below the cursor

      // Check available space
      const spaceAbove = topAnchor - safeTop;
      const spaceBelow = window.innerHeight - safeBottom - bottomAnchor;

      // Decision Logic:
      // Default to TOP (Above finger) for better visibility.
      // Move to BOTTOM if:
      // a) Not enough space above AND enough space below.
      // b) Touch specific: Unless strictly necessary, keep above to avoid occlusion.

      let placeOnTop = true;

      if (spaceAbove < h) {
        // Not enough space on top. Can we fit below?
        if (spaceBelow >= h) {
          placeOnTop = false;
        } else {
          // Fits nowhere? Pick the side with MORE space.
          placeOnTop = spaceAbove > spaceBelow;
        }
      }

      let finalY = 0;
      let transformString = '';

      if (placeOnTop) {
        // Anchor: Bottom-Center of tooltip to [finalX, topAnchor]
        finalY = topAnchor;
        transformString = `translate3d(${Math.round(finalX)}px, ${Math.round(finalY)}px, 0) translate(-50%, -100%)`;
      } else {
        // Anchor: Top-Center of tooltip to [finalX, bottomAnchor]
        finalY = bottomAnchor;
        transformString = `translate3d(${Math.round(finalX)}px, ${Math.round(finalY)}px, 0) translate(-50%, 0)`;
      }

      this.engine.tooltip.style.transform = transformString;
    });
  }

  hideTooltip() {
    this.cancelHide();
    this._pending.active = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.engine.tooltip.style.opacity = '0';
    this.engine.tooltip.setAttribute('aria-hidden', 'true');
  }

  scheduleHide(delay = TOOLTIP_LINGER_MS) {
    this.cancelHide();
    this.tooltipHideTimer = setTimeout(() => {
      this.hideTooltip();
    }, delay);
  }

  cancelHide() {
    if (this.tooltipHideTimer) {
      clearTimeout(this.tooltipHideTimer);
      this.tooltipHideTimer = null;
    }
  }

  destroy() {
    this.cancelHide();
    if (this._rafId) cancelAnimationFrame(this._rafId);
    super.destroy();
  }
}
