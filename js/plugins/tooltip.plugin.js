// TRACE Tooltip Plugin
// Manages tooltip display and positioning

import { TOOLTIP_LINGER_MS } from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';
import { clamp, pxVar } from '../core/utils.js';

export class TooltipPlugin extends TracePlugin {
  constructor() {
    super('TooltipPlugin');
    this.tooltipHideTimer = null;
    this.tooltipWidth = 0;
    this.tooltipHeight = 0;
    this._rafPending = false;
    this._pendingX = 0;
    this._pendingY = 0;
    this._pendingIsTouch = false;
    this._lastRafId = null;
  }

  init(engine) {
    super.init(engine);
  }

  /**
   * Show tooltip at specific coordinates
   */
  showTooltipAt(clientX, clientY, isTouch, dateText, infoText) {
    if (!dateText || !infoText) return;
    this.updateTooltipContent(dateText, infoText);
    this.positionTooltip(clientX, clientY, isTouch);
  }

  /**
   * Update tooltip content
   */
  updateTooltipContent(dateText, infoText) {
    const cacheKey = `${dateText}|${infoText}`;
    if (this.engine.tooltip.dataset.cache !== cacheKey) {
      this.engine.tooltip.textContent = '';

      const dateLine = document.createElement('span');
      dateLine.className = 'tr-tip-line';
      dateLine.textContent = dateText;
      this.engine.tooltip.appendChild(dateLine);

      const boldInfo = document.createElement('b');
      boldInfo.className = 'tr-tip-line';
      boldInfo.textContent = infoText;
      this.engine.tooltip.appendChild(boldInfo);

      this.engine.tooltip.dataset.cache = cacheKey;
    }

    const rect = this.engine.tooltip.getBoundingClientRect();
    this.tooltipWidth = rect.width;
    this.tooltipHeight = rect.height;
    this.engine.tooltip.style.opacity = '1';
  }

  /**
   * Position tooltip relative to cursor/touch point
   */
  positionTooltip(clientX, clientY, isTouch = false) {
    this._pendingX = clientX;
    this._pendingY = clientY;
    this._pendingIsTouch = Boolean(isTouch);
    if (this._rafPending) return;
    this._rafPending = true;
    this._lastRafId = requestAnimationFrame(() => {
      this._rafPending = false;
      this._lastRafId = null;
      const clientX = this._pendingX;
      const clientY = this._pendingY;
      const isTouch = this._pendingIsTouch;

      const pad = 16;
      const safeTop = pxVar('--tr-safe-top');
      const safeRight = pxVar('--tr-safe-right');
      const safeBottom = pxVar('--tr-safe-bottom');
      const safeLeft = pxVar('--tr-safe-left');

      // Measure sizes only when needed (content may have changed)
      const rect = this.engine.tooltip.getBoundingClientRect();
      const w = this.tooltipWidth || rect.width;
      const h = this.tooltipHeight || rect.height;

      let x = clientX;
      let y = clientY;

      const minX = safeLeft + pad + w / 2;
      const maxX = window.innerWidth - safeRight - pad - w / 2;
      x = clamp(x, minX, maxX);

      // Touch needs more offset to avoid finger covering tooltip
      const baseOffset = pxVar('--tr-tooltip-vertical-offset') || 40;
      const vOffset = isTouch ? baseOffset + 20 : baseOffset;
      const topBound = safeTop + pad;
      const bottomBound = window.innerHeight - safeBottom - pad;

      const aboveAnchorY = clientY - vOffset;
      const belowAnchorY = clientY + vOffset;

      const aboveFits = aboveAnchorY - h >= topBound && aboveAnchorY <= bottomBound;
      const belowFits = belowAnchorY >= topBound && belowAnchorY + h <= bottomBound;

      const spaceAbove = aboveAnchorY - topBound;
      const spaceBelow = bottomBound - belowAnchorY;

      // For touch, prefer showing above to avoid covering the tapped element
      // For mouse, use space-based logic
      let placeBelow;
      if (isTouch) {
        placeBelow = aboveFits ? false : belowFits ? true : spaceBelow > spaceAbove + 20;
      } else {
        placeBelow = aboveFits ? false : belowFits ? true : spaceBelow > spaceAbove;
      }

      if (placeBelow) {
        y = clamp(belowAnchorY, topBound, bottomBound - h);
        this.engine.tooltip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(
          y
        )}px, 0) translate(-50%, 0)`;
      } else {
        y = clamp(aboveAnchorY, topBound + h, bottomBound);
        this.engine.tooltip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(
          y
        )}px, 0) translate(-50%, -100%)`;
      }

      this.engine.tooltip.style.left = '0px';
      this.engine.tooltip.style.top = '0px';
    });
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    if (this._lastRafId) {
      cancelAnimationFrame(this._lastRafId);
      this._lastRafId = null;
      this._rafPending = false;
    }
    this.engine.tooltip.style.opacity = '0';
  }

  /**
   * Schedule tooltip hide
   */
  scheduleHide(delay = TOOLTIP_LINGER_MS) {
    if (this.tooltipHideTimer) {
      clearTimeout(this.tooltipHideTimer);
    }
    this.tooltipHideTimer = setTimeout(() => {
      this.hideTooltip();
    }, delay);
  }

  /**
   * Cancel scheduled hide
   */
  cancelHide() {
    if (this.tooltipHideTimer) {
      clearTimeout(this.tooltipHideTimer);
      this.tooltipHideTimer = null;
    }
  }

  destroy() {
    this.cancelHide();
    super.destroy();
  }
}
