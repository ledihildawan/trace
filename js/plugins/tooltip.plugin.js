// TRACE Tooltip Plugin
// Manages tooltip display and positioning

import { TracePlugin } from '../core/plugin-manager.js';
import { TOOLTIP_LINGER_MS } from '../core/constants.js';
import { clamp, pxVar } from '../core/utils.js';

export class TooltipPlugin extends TracePlugin {
  constructor() {
    super('TooltipPlugin');
    this.tooltipHideTimer = null;
    this.tooltipWidth = 0;
    this.tooltipHeight = 0;
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
    this.engine.tooltip.style.transition = 'opacity 0.2s ease-out';
    this.engine.tooltip.style.opacity = '1';
  }

  /**
   * Position tooltip relative to cursor/touch point
   */
  positionTooltip(clientX, clientY, isTouch = false) {
    const pad = 12;
    const safeTop = pxVar('--tr-safe-top');
    const safeRight = pxVar('--tr-safe-right');
    const safeBottom = pxVar('--tr-safe-bottom');
    const safeLeft = pxVar('--tr-safe-left');
    
    const w = this.tooltipWidth || this.engine.tooltip.getBoundingClientRect().width;
    const h = this.tooltipHeight || this.engine.tooltip.getBoundingClientRect().height;
    
    let x = clientX;
    let y = clientY;
    
    const minX = safeLeft + pad + w / 2;
    const maxX = window.innerWidth - safeRight - pad - w / 2;
    x = clamp(x, minX, maxX);
    
    const vOffset = pxVar('--tr-tooltip-vertical-offset') || 40;
    const topBound = safeTop + pad;
    const bottomBound = window.innerHeight - safeBottom - pad;
    
    const aboveAnchorY = clientY - vOffset;
    const belowAnchorY = clientY + vOffset;
    
    const aboveFits = aboveAnchorY - h >= topBound && aboveAnchorY <= bottomBound;
    const belowFits = belowAnchorY >= topBound && belowAnchorY + h <= bottomBound;
    
    const spaceAbove = aboveAnchorY - topBound;
    const spaceBelow = bottomBound - belowAnchorY;
    
    let placeBelow;
    if (aboveFits) placeBelow = false;
    else if (belowFits) placeBelow = true;
    else placeBelow = spaceBelow > spaceAbove;
    
    if (placeBelow) {
      y = clamp(belowAnchorY, topBound, bottomBound - h);
      this.engine.tooltip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, 0)`;
    } else {
      y = clamp(aboveAnchorY, topBound + h, bottomBound);
      this.engine.tooltip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
    }
    
    this.engine.tooltip.style.left = '0px';
    this.engine.tooltip.style.top = '0px';
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    this.engine.tooltip.style.transition = 'opacity 0.3s ease-out';
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
