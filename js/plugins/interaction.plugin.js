// TRACE Interaction Plugin
// Handles mouse, touch, keyboard, and gesture interactions

import {
  DOUBLE_TAP_MAX_DELAY_MS,
  DOUBLE_TAP_MAX_DISTANCE_PX,
  DRAG_THRESHOLD_PX,
  HAPTIC_SCRUB_MS,
  HAPTIC_SUCCESS_MS,
  LONG_PRESS_DURATION_MS,
  PINCH_MIN_DISTANCE_CHANGE_PX,
  SWIPE_MIN_DISTANCE,
} from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';

export class InteractionPlugin extends TracePlugin {
  constructor() {
    super('InteractionPlugin');
    this._rafPending = false;
    this._pendingX = 0;
    this._pendingY = 0;
    this._lastHoveredElement = null;
    this._pressedElement = null;
    this._draggingElement = null;
    this._lastHapticAt = { scrub: 0, success: 0 };
    this.hasHover = false;
    this.ignoreHover = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.currentFocusIndex = -1;
  }

  init(engine) {
    super.init(engine);

    // Detect hover capability
    this._hoverMql = window.matchMedia('(hover: hover)');
    this.hasHover = this._hoverMql.matches;

    this._hoverMql.addEventListener(
      'change',
      (e) => {
        this.hasHover = e.matches;
      },
      { signal: this.signal }
    );

    // Cache frequently used plugins to avoid repeated lookups
    this.tooltipPlugin = this.engine.plugins.get('TooltipPlugin');

    this.setupKeyboardControls();
    this.setupTouchGestures();
    this.setupMouseControls();
    this.setupEventDelegation();
  }

  /**
   * Check if element is a valid (non-filler) day cell
   */
  isValidDay(element) {
    return element?.classList.contains('tr-day') && !element.classList.contains('tr-day--filler');
  }

  /**
   * Setup keyboard controls
   */
  setupKeyboardControls() {
    window.addEventListener(
      'keydown',
      (e) => {
        // Avoid double-handling when focus is inside the grid
        if (this.engine.viewport && this.engine.viewport.contains(e.target)) return;
        const key = e.key.toLowerCase();

        // Single key shortcuts (no modifiers)
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          if (key === ' ' || key === 'spacebar') {
            e.preventDefault();
            const themePlugin = this.engine.plugins.get('ThemePlugin');
            if (themePlugin) themePlugin.cycleTheme();
            return;
          }
          if (key === 'r') {
            const devTools = this.engine.plugins.get('DevToolsPlugin');
            if (devTools) devTools.randomizeThemeNowAndLocale();
            return;
          }
          if (key === 'x') {
            const devTools = this.engine.plugins.get('DevToolsPlugin');
            if (devTools) devTools.resetToDefaults();
            return;
          }
        }
      },
      { signal: this.signal }
    );
  }

  /**
   * Setup touch gestures (swipe, triple tap, long press)
   */
  setupTouchGestures() {
    // Pointer state
    let isDragging = false;
    let activePointerId = null;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let longPressTimer = null;
    let longPressTriggered = false;

    // Multi-touch state for pinch
    const touches = new Map();
    let pinchStartDistance = 0;
    let pinchTriggered = false;

    // Double tap detection for quick theme cycle
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    // Cache touch-active elements to avoid querySelectorAll on pointerEnd
    let touchActiveElements = new Set();

    const processPointerMove = () => {
      this._rafPending = false;
      if (this.ignoreHover || isDragging) return;
      const target = document.elementFromPoint(this._pendingX, this._pendingY);
      if (this.isValidDay(target)) {
        if (this._lastHoveredElement !== target) {
          if (this._lastHoveredElement) {
            this._lastHoveredElement.classList.remove('tr-is-touch-active');
            touchActiveElements.delete(this._lastHoveredElement);
          }
          target.classList.add('tr-is-touch-active');
          touchActiveElements.add(target);
          this._lastHoveredElement = target;
          this.triggerHaptic('scrub');
        }
        const dateText = target.dataset.trDate;
        const infoText = target.dataset.trInfo;
        if (this.tooltipPlugin) {
          this.tooltipPlugin.showTooltipAt(this._pendingX, this._pendingY, true, dateText, infoText);
        }
      } else if (this._lastHoveredElement) {
        this._lastHoveredElement.classList.remove('tr-is-touch-active');
        touchActiveElements.delete(this._lastHoveredElement);
        this._lastHoveredElement = null;
      }
    };

    const schedulePointerUpdate = (x, y) => {
      this._pendingX = x;
      this._pendingY = y;
      this.lastPointerX = x;
      this.lastPointerY = y;
      if (!this._rafPending) {
        this._rafPending = true;
        this._lastRafId = requestAnimationFrame(processPointerMove);
      }
    };

    const handlePointerDown = (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // If second touch begins, initialise pinch tracking
        if (touches.size === 2) {
          const pts = Array.from(touches.values());
          pinchStartDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          pinchTriggered = false;
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }
        if (touches.size > 1) return;
      }
      activePointerId = e.pointerId;
      this.engine.viewport.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      startTime = performance.now();
      isDragging = false;
      longPressTriggered = false;

      // Defensive cleanup: clear any stale hover/drag markers left from
      // previous interactions so a new press doesn't inherit them.
      if (this._lastHoveredElement?.classList) {
        this._lastHoveredElement.classList.remove('tr-is-touch-active');
        touchActiveElements.delete(this._lastHoveredElement);
      }
      this._lastHoveredElement = null;
      // Clear cached touch-active set instead of DOM query
      touchActiveElements.forEach((el) => el.classList.remove('tr-is-touch-active'));
      touchActiveElements.clear();
      if (this._draggingElement?.classList) this._draggingElement.classList.remove('tr-is-dragging');
      this._draggingElement = null;

      // Long press → reset to defaults
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
        const devTools = this.engine.plugins.get('DevToolsPlugin');
        if (devTools) devTools.resetToDefaults();
        this.triggerHaptic('success');
        longPressTriggered = true;
      }, LONG_PRESS_DURATION_MS);
      if (this.tooltipPlugin) this.tooltipPlugin.cancelHide();

      schedulePointerUpdate(e.clientX, e.clientY);

      if (this._pressedElement) {
        this._pressedElement.classList.remove('tr-is-pressing');
        this._pressedElement = null;
      }
      const pressed = document.elementFromPoint(e.clientX, e.clientY);
      if (this.isValidDay(pressed)) {
        this._pressedElement = pressed;
        pressed.classList.add('tr-is-pressing');
      }
    };

    const handlePointerMove = (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // Pinch detection: when two fingers move apart/closer
        if (touches.size === 2 && pinchStartDistance > 0 && !pinchTriggered) {
          const pts = Array.from(touches.values());
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (Math.abs(dist - pinchStartDistance) > PINCH_MIN_DISTANCE_CHANGE_PX) {
            if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
            const devTools = this.engine.plugins.get('DevToolsPlugin');
            if (devTools) devTools.randomizeThemeNowAndLocale();
            this.triggerHaptic('success');
            pinchTriggered = true;
          }
        }

        if (touches.size > 1) return;
      }

      if (activePointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Adaptive drag threshold: more sensitive on day cells, account for touch accuracy
      // High DPR devices (phones) get slightly lower threshold for better responsiveness
      const dpr = window.devicePixelRatio || 1;
      const baseThreshold = this._pressedElement ? Math.max(8, Math.floor(DRAG_THRESHOLD_PX / 3)) : DRAG_THRESHOLD_PX;
      const effectiveThreshold = dpr > 2 ? Math.max(6, baseThreshold - 2) : baseThreshold;
      if (dx * dx + dy * dy > effectiveThreshold * effectiveThreshold) {
        isDragging = true;
        // No RAF cancellation here — rely on ignoreHover/isDragging guards.
        // While actively dragging, suppress hover updates so old "active" days
        // aren't left highlighted. Clear any existing hover highlight.
        this.ignoreHover = true;
        if (this._lastHoveredElement?.classList) {
          this._lastHoveredElement.classList.remove('tr-is-touch-active');
          touchActiveElements.delete(this._lastHoveredElement);
        }
        this._lastHoveredElement = null;
        // Clear cached touch-active set (no expensive querySelectorAll)
        touchActiveElements.forEach((el) => el.classList.remove('tr-is-touch-active'));
        touchActiveElements.clear();
        // While dragging, ensure the currently dragged day becomes active
        const dragTarget = document.elementFromPoint(e.clientX, e.clientY);
        if (this.isValidDay(dragTarget)) {
          // Remove previous dragging marker if present and different
          if (this._draggingElement && this._draggingElement !== dragTarget && this._draggingElement.classList) {
            this._draggingElement.classList.remove('tr-is-dragging');
          }
          dragTarget.classList.add('tr-is-dragging');
          this._draggingElement = dragTarget;

          // Show tooltip for the dragged element so users see context while dragging
          if (this.tooltipPlugin) {
            const dateText = dragTarget.dataset.trDate;
            const infoText = dragTarget.dataset.trInfo;
            this.tooltipPlugin.showTooltipAt(e.clientX, e.clientY, true, dateText, infoText);
          }
        } else {
          // If not over a day, ensure tooltip is hidden
          if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
        }
        if (this._pressedElement) {
          this._pressedElement.classList.remove('tr-is-pressing');
          this._pressedElement = null;
        }
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }

      schedulePointerUpdate(e.clientX, e.clientY);
    };

    const handlePointerEnd = (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerType === 'touch') {
        touches.delete(e.pointerId);
        if (touches.size < 2) {
          pinchStartDistance = 0;
          pinchTriggered = false;
        }
        if (activePointerId !== e.pointerId) return;

        // Cancel pending long press if finger lifted early
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const duration = performance.now() - startTime;

        const devTools = this.engine.plugins.get('DevToolsPlugin');
        const themePlugin = this.engine.plugins.get('ThemePlugin');

        // Double tap → cycle theme
        // More forgiving distance threshold for larger touch targets
        const now = performance.now();
        const tappedQuickly = now - lastTapTime < DOUBLE_TAP_MAX_DELAY_MS;
        const tapDistance = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY);
        const maxDistance = Math.max(DOUBLE_TAP_MAX_DISTANCE_PX, 60); // Minimum 60px for touch accuracy
        const tappedNearby = tapDistance < maxDistance;

        if (!isDragging && !longPressTriggered && !pinchTriggered && tappedQuickly && tappedNearby) {
          // Double tap detected - hide tooltip and cycle theme
          if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
          if (themePlugin) themePlugin.cycleTheme();
          this.triggerHaptic('success');
          lastTapTime = 0;
          lastTapX = 0;
          lastTapY = 0;
        } else {
          lastTapTime = now;
          lastTapX = e.clientX;
          lastTapY = e.clientY;

          // Swipe detection: fast, directional gesture (not slow drag)
          // Requirements: minimum distance + fast duration + clear direction
          const isFastSwipe = distance > SWIPE_MIN_DISTANCE && duration < 400;
          const shouldCheckSwipe = !longPressTriggered && !pinchTriggered && isFastSwipe;

          if (shouldCheckSwipe) {
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            // Require clear directional intent (not diagonal)
            const isHorizontalSwipe = absDx > absDy * 1.5;
            const isVerticalSwipe = absDy > absDx * 1.5;

            if (isHorizontalSwipe || isVerticalSwipe) {
              // Hide tooltip before swipe action
              if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();

              if (isHorizontalSwipe) {
                // Horizontal swipe → cycle theme
                if (themePlugin) themePlugin.cycleTheme();
                this.triggerHaptic('success');
              } else {
                // Vertical swipe → randomize
                if (devTools) devTools.randomizeThemeNowAndLocale();
                this.triggerHaptic('success');
              }
            }
          }
        }
      }
      if (activePointerId !== e.pointerId) return;
      activePointerId = null;
      if (this._pressedElement) {
        this._pressedElement.classList.remove('tr-is-pressing');
        this._pressedElement = null;
      }
      if (this.tooltipPlugin) {
        // Only schedule hide if no gesture was triggered
        if (!longPressTriggered && !pinchTriggered) {
          const duration = isDragging ? 1250 : 2500;
          this.tooltipPlugin.scheduleHide(duration);
        }
        // Clear cached touch-active elements
        touchActiveElements.forEach((el) => el.classList.remove('tr-is-touch-active'));
        touchActiveElements.clear();
        this._lastHoveredElement = null;
        this.ignoreHover = false;
      }
      // remove dragging visual class for touch
      if (this._draggingElement?.classList) this._draggingElement.classList.remove('tr-is-dragging');
      this._draggingElement = null;
      isDragging = false;
    };

    this.engine.viewport.addEventListener('pointerdown', handlePointerDown, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener('pointermove', handlePointerMove, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener('pointerup', handlePointerEnd, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener('pointercancel', handlePointerEnd, { passive: true, signal: this.signal });
  }

  /**
   * Setup mouse controls (wheel, drag)
   */
  setupMouseControls() {
    this.engine.viewport.addEventListener(
      'wheel',
      (e) => {
        if (!this.hasHover) return;
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        if (Math.abs(e.deltaY) > 50) {
          const themePlugin = this.engine.plugins.get('ThemePlugin');
          if (themePlugin) themePlugin.cycleTheme();
          this.triggerHaptic('success');
        }
      },
      { passive: false, signal: this.signal }
    );
  }

  /**
   * Setup event delegation for hover and keyboard navigation
   */
  setupEventDelegation() {
    // Device-specific adaptive parameters
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const speedSeed = dpr < 1.25 ? 350 : dpr < 2 ? 600 : 800;
    const dwellSeed = dpr < 1.25 ? 110 : 90;

    // Mouse position and RAF state
    let mouseRafPending = false;
    let pendingMouseX = 0;
    let pendingMouseY = 0;

    // Tooltip state
    let hoveredDayEl = null;
    let tooltipVisible = false;
    let lastMouseOverTargetId = null;

    // Gap crossing behavior
    let gapHideTimer = null;
    let gapEnterTime = 0;

    // Adaptive speed tracking (EWMA)
    let lastMouseX = 0;
    let lastMouseY = 0;
    let lastMouseTs = 0;
    let speedEwma = speedSeed; // px/s
    let dwellEwma = dwellSeed; // ms

    /**
     * Calculate gap hide delay based on gap size and speed
     * @returns {number} Delay in milliseconds
     */
    const calculateGapDelay = () => {
      const style = window.getComputedStyle(this.engine.viewport);
      const gap = parseFloat(style.gap) || parseFloat(style.gridGap) || 0;
      const speed = Math.max(100, Math.min(1800, speedEwma));
      const traversalMs = (gap / speed) * 1000;
      const baseBuffer = dpr < 1.25 ? 80 : dpr < 2 ? 65 : 55;
      const delay = Math.max(100, Math.min(240, traversalMs + baseBuffer));
      return Math.round(delay);
    };

    /**
     * Calculate dynamic gap hide delay with cell size hysteresis
     * Factors: gap size, cell width (12%), pointer speed, DPR, and observed dwell
     * @returns {number} Delay in milliseconds
     */
    const calculateGapDelayDynamic = () => {
      const style = window.getComputedStyle(this.engine.viewport);
      const gap = parseFloat(style.gap) || parseFloat(style.gridGap) || 0;

      // Get cell width for hysteresis calculation
      let cellW = 0;
      if (hoveredDayEl) {
        cellW = Math.round(hoveredDayEl.getBoundingClientRect().width);
      } else if (this.engine.gridCells?.length) {
        cellW = Math.round(this.engine.gridCells[0].getBoundingClientRect().width);
      }

      const speed = Math.max(100, Math.min(1800, speedEwma));
      const hysteresis = Math.min(24, Math.round(cellW * 0.12));
      const effectivePx = gap + hysteresis;
      const traversalMs = (effectivePx / speed) * 1000;

      const baseBuffer = dpr < 1.25 ? 85 : dpr < 2 ? 70 : 60;
      const dwellMargin = Math.min(60, Math.max(30, dwellEwma * 0.5));
      const delay = Math.max(110, Math.min(280, traversalMs + baseBuffer + dwellMargin));
      return Math.round(delay);
    };

    const processMouseMove = () => {
      mouseRafPending = false;
      if (this.tooltipPlugin) {
        this.tooltipPlugin.positionTooltip(pendingMouseX, pendingMouseY, false);
      }
    };

    this.engine.viewport.addEventListener(
      'mouseover',
      (e) => {
        if (!this.hasHover) return;
        if (this.ignoreHover) return;
        const target = e.target;
        // Debounce: skip if mouseover fires on same element multiple times
        if (target === lastMouseOverTargetId) return;
        lastMouseOverTargetId = target;

        if (this.isValidDay(target)) {
          // Cancel any pending gap hide timer - tooltip stays visible smoothly
          if (gapHideTimer) {
            clearTimeout(gapHideTimer);
            gapHideTimer = null;
          }
          // Update observed dwell time if we just crossed a gap
          if (gapEnterTime) {
            const spent = performance.now() - gapEnterTime;
            // EWMA update (alpha = 0.2) - learn user's natural hover pace
            dwellEwma = dwellEwma * 0.8 + spent * 0.2;
            gapEnterTime = 0;
          }
          // Cancel any previously scheduled tooltip hide for instant feedback
          if (this.tooltipPlugin) this.tooltipPlugin.cancelHide();
          const dateText = target.dataset.trDate;
          const infoText = target.dataset.trInfo;
          if (this.tooltipPlugin) {
            this.tooltipPlugin.showTooltipAt(e.clientX, e.clientY, false, dateText, infoText);
            tooltipVisible = true;
          }
          hoveredDayEl = target;
        } else {
          // Delay hide when hovering gap/filler to prevent flicker when moving between cells
          if (gapHideTimer) clearTimeout(gapHideTimer);
          gapEnterTime = performance.now();
          const dynamicDelay = calculateGapDelayDynamic();
          gapHideTimer = setTimeout(() => {
            if (this.tooltipPlugin) {
              this.tooltipPlugin.hideTooltip();
              tooltipVisible = false;
              hoveredDayEl = null;
            }
            gapHideTimer = null;
          }, dynamicDelay); // Dynamically calculated delay based on gap + cell size + speed
        }
      },
      { passive: true, signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'mousemove',
      (e) => {
        if (!this.hasHover) return;
        // Update adaptive speed tracking (EWMA with alpha = 0.25)
        const now = performance.now();
        if (lastMouseTs) {
          const deltaTime = now - lastMouseTs;
          if (deltaTime > 0) {
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;
            const distance = Math.hypot(deltaX, deltaY);
            const instantSpeed = (distance / deltaTime) * 1000; // px/s
            speedEwma = speedEwma * 0.75 + instantSpeed * 0.25;
          }
        }
        lastMouseTs = now;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        // Skip expensive hit-tests; rely on latest mouseover-set hoveredDayEl.
        if (!hoveredDayEl || hoveredDayEl.classList.contains('tr-day--filler')) {
          // Don't immediately hide here - let gap timer handle it
          return;
        }
        // Only update position if tooltip is visible; avoid getComputedStyle (layout thrashing).
        if (tooltipVisible && this.tooltipPlugin && !mouseRafPending) {
          pendingMouseX = e.clientX;
          pendingMouseY = e.clientY;
          mouseRafPending = true;
          requestAnimationFrame(processMouseMove);
        }
      },
      { passive: true, signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'mouseout',
      (e) => {
        if (!this.hasHover) return;
        // Only hide if truly leaving the viewport (not just to another element)
        if (!this.engine.viewport.contains(e.relatedTarget) && e.relatedTarget !== null) {
          // Brief delay before hiding to handle edge jitter
          if (gapHideTimer) {
            clearTimeout(gapHideTimer);
          }
          gapHideTimer = setTimeout(() => {
            if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
            tooltipVisible = false;
            hoveredDayEl = null;
            gapHideTimer = null;
          }, 50); // Short grace period for accidental edge exits
        }
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'keydown',
      (e) => {
        const target = e.target;
        if (!target.classList.contains('tr-day')) return;
        const index = parseInt(target.dataset.trIndex, 10);
        if (isNaN(index)) return;

        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const themePlugin = this.engine.plugins.get('ThemePlugin');
          if (themePlugin) themePlugin.cycleTheme();
          return;
        }

        let targetIndex = -1;
        switch (e.key) {
          case 'ArrowRight':
            targetIndex = index + 1;
            break;
          case 'ArrowLeft':
            targetIndex = index - 1;
            break;
          case 'ArrowDown':
            targetIndex = index + this.engine._currentColumns;
            break;
          case 'ArrowUp':
            targetIndex = index - this.engine._currentColumns;
            break;
          case 'Home':
            targetIndex = 0;
            break;
          case 'End':
            targetIndex = this.engine.gridCells.length - 1;
            break;
          default:
            return;
        }

        if (targetIndex >= 0 && targetIndex < this.engine.gridCells.length) {
          const targetCell = this.engine.gridCells[targetIndex];
          if (targetCell && !targetCell.classList.contains('tr-day--filler')) {
            e.preventDefault();
            targetCell.focus();
            // Enhanced screen reader feedback with position context
            if (this.engine.srStatus) {
              const label = targetCell.getAttribute('aria-label');
              const position = `${targetIndex + 1} of ${
                this.engine.gridCells.filter((c) => !c.classList.contains('tr-day--filler')).length
              }`;
              this.engine.srStatus.textContent = `${label}, ${position}`;
            }
          }
        }
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'focusin',
      (e) => {
        const target = e.target;
        if (this.isValidDay(target)) {
          const rect = target.getBoundingClientRect();
          const dateText = target.dataset.trDate;
          const infoText = target.dataset.trInfo;
          if (this.tooltipPlugin) {
            this.tooltipPlugin.showTooltipAt(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
              false,
              dateText,
              infoText
            );
          }
        }
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'focusout',
      () => {
        if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
      },
      { signal: this.signal }
    );
  }

  /**
   * Trigger haptic feedback
   */
  triggerHaptic(type) {
    if (!navigator.vibrate) return;
    const now = performance.now();
    // Refined timing: scrub slightly more frequent for better tactile feedback
    const minGap = type === 'scrub' ? 75 : 350;
    if (now - (this._lastHapticAt[type] ?? 0) < minGap) return;
    this._lastHapticAt[type] = now;
    navigator.vibrate(type === 'scrub' ? HAPTIC_SCRUB_MS : HAPTIC_SUCCESS_MS);
  }

  destroy() {
    if (this._lastHoveredElement) {
      this._lastHoveredElement.classList.remove('tr-is-touch-active');
      this._lastHoveredElement = null;
    }
    if (this._pressedElement) {
      this._pressedElement.classList.remove('tr-is-pressing');
      this._pressedElement = null;
    }
    // Clear cached plugin references
    this.tooltipPlugin = null;
    super.destroy();
  }
}
