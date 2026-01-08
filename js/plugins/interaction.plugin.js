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

    this.setupKeyboardControls();
    this.setupTouchGestures();
    this.setupMouseControls();
    this.setupEventDelegation();
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

    // Prevent any existing engine-level touch handlers from also processing
    // touch pointer events (they were left active from the pre-plugin code).
    // We use capture + stopImmediatePropagation for touch only so mouse
    // handlers (desktop) remain unaffected.
    const stopEngineTouchPropagation = (evt) => {
      if (evt.pointerType === 'touch') {
        evt.stopImmediatePropagation();
      }
    };
    this.engine.viewport.addEventListener('pointerdown', stopEngineTouchPropagation, {
      capture: true,
      passive: true,
      signal: this.signal,
    });
    this.engine.viewport.addEventListener('pointermove', stopEngineTouchPropagation, {
      capture: true,
      passive: true,
      signal: this.signal,
    });
    this.engine.viewport.addEventListener('pointerup', stopEngineTouchPropagation, {
      capture: true,
      passive: true,
      signal: this.signal,
    });
    this.engine.viewport.addEventListener('pointercancel', stopEngineTouchPropagation, {
      capture: true,
      passive: true,
      signal: this.signal,
    });

    // Multi-touch state for pinch
    const touches = new Map();
    let pinchStartDistance = 0;
    let pinchTriggered = false;

    // Double tap detection for quick theme cycle
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const processPointerMove = () => {
      this._rafPending = false;
      if (this.ignoreHover || isDragging) return;
      const target = document.elementFromPoint(this._pendingX, this._pendingY);
      if (target?.classList.contains('tr-day') && !target.classList.contains('tr-day--filler')) {
        if (this._lastHoveredElement !== target) {
          if (this._lastHoveredElement) {
            this._lastHoveredElement.classList.remove('tr-is-touch-active');
          }
          target.classList.add('tr-is-touch-active');
          this._lastHoveredElement = target;
          this.triggerHaptic('scrub');
        }
        const dateText = target.dataset.trDate;
        const infoText = target.dataset.trInfo;
        const tooltipPlugin = this.engine.plugins.get('TooltipPlugin');
        if (tooltipPlugin) {
          tooltipPlugin.showTooltipAt(this._pendingX, this._pendingY, true, dateText, infoText);
        }
      } else if (this._lastHoveredElement) {
        this._lastHoveredElement.classList.remove('tr-is-touch-active');
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
      // Cancel any pending hover RAF so stale callbacks don't re-add active classes
      if (this._rafPending && typeof cancelAnimationFrame === 'function' && this._lastRafId) {
        cancelAnimationFrame(this._lastRafId);
        this._rafPending = false;
        this._lastRafId = null;
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
      if (this._lastHoveredElement?.classList) this._lastHoveredElement.classList.remove('tr-is-touch-active');
      this._lastHoveredElement = null;
      document.querySelectorAll('.tr-is-touch-active').forEach((el) => el.classList.remove('tr-is-touch-active'));
      if (this._draggingElement?.classList) this._draggingElement.classList.remove('tr-is-dragging');
      this._draggingElement = null;

      // Long press → reset to defaults
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        const tooltipPlugin = this.engine.plugins.get('TooltipPlugin');
        if (tooltipPlugin) tooltipPlugin.hideTooltip();
        const devTools = this.engine.plugins.get('DevToolsPlugin');
        if (devTools) devTools.resetToDefaults();
        this.triggerHaptic('success');
        longPressTriggered = true;
      }, LONG_PRESS_DURATION_MS);

      const tooltipPlugin = this.engine.plugins.get('TooltipPlugin');
      if (tooltipPlugin) tooltipPlugin.cancelHide();

      schedulePointerUpdate(e.clientX, e.clientY);

      if (this._pressedElement) {
        this._pressedElement.classList.remove('tr-is-pressing');
        this._pressedElement = null;
      }
      const pressed = document.elementFromPoint(e.clientX, e.clientY);
      if (pressed?.classList?.contains('tr-day') && !pressed.classList.contains('tr-day--filler')) {
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
            const tooltipPlugin = this.engine.plugins.get('TooltipPlugin');
            if (tooltipPlugin) tooltipPlugin.hideTooltip();
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

      if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        isDragging = true;
        // Cancel pending hover RAF to avoid stale hover re-appearing
        if (this._rafPending && typeof cancelAnimationFrame === 'function' && this._lastRafId) {
          cancelAnimationFrame(this._lastRafId);
          this._rafPending = false;
          this._lastRafId = null;
        }
        // While actively dragging, suppress hover updates so old "active" days
        // aren't left highlighted. Clear any existing hover highlight.
        this.ignoreHover = true;
        if (this._lastHoveredElement?.classList) this._lastHoveredElement.classList.remove('tr-is-touch-active');
        this._lastHoveredElement = null;
        // Also defensively clear any leftover active classes in the DOM
        document.querySelectorAll('.tr-is-touch-active').forEach((el) => el.classList.remove('tr-is-touch-active'));
        // Hide tooltip while dragging to avoid stale highlights
        this.engine.plugins.get('TooltipPlugin')?.hideTooltip();
        if (this._pressedElement) {
          this._pressedElement.classList.remove('tr-is-pressing');
          this._pressedElement = null;
        }
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        // Apply dragging visual class similar to hover
        const dragTarget = document.elementFromPoint(e.clientX, e.clientY);
        if (dragTarget?.classList?.contains('tr-day') && !dragTarget.classList.contains('tr-day--filler')) {
          // Remove previous dragging marker if present and different
          if (this._draggingElement && this._draggingElement !== dragTarget && this._draggingElement.classList) {
            this._draggingElement.classList.remove('tr-is-dragging');
          }
          dragTarget.classList.add('tr-is-dragging');
          this._draggingElement = dragTarget;
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
        const now = performance.now();
        const tappedQuickly = now - lastTapTime < DOUBLE_TAP_MAX_DELAY_MS;
        const tappedNearby = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < DOUBLE_TAP_MAX_DISTANCE_PX;

        const tooltipPlugin = this.engine.plugins.get('TooltipPlugin');

        if (!isDragging && !longPressTriggered && !pinchTriggered && tappedQuickly && tappedNearby) {
          // Double tap detected - hide tooltip and cycle theme
          if (tooltipPlugin) tooltipPlugin.hideTooltip();
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
              if (tooltipPlugin) tooltipPlugin.hideTooltip();

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

      const tooltipPlugin = this.engine.plugins.get('TooltipPlugin');
      if (tooltipPlugin) {
        // Only schedule hide if no gesture was triggered
        if (!longPressTriggered && !pinchTriggered) {
          const duration = isDragging ? 1250 : 2500;
          tooltipPlugin.scheduleHide(duration);
        }
        // Ensure any hovered markers are cleared
        document.querySelectorAll('.tr-is-touch-active').forEach((el) => el.classList.remove('tr-is-touch-active'));
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
    let mouseRafPending = false;
    let pendingMouseX = 0;
    let pendingMouseY = 0;

    const tooltipPlugin = this.engine.plugins.get('TooltipPlugin');

    const processMouseMove = () => {
      mouseRafPending = false;
      if (tooltipPlugin) {
        tooltipPlugin.positionTooltip(pendingMouseX, pendingMouseY, false);
      }
    };

    this.engine.viewport.addEventListener(
      'mouseover',
      (e) => {
        if (!this.hasHover) return;
        if (this.ignoreHover) return;
        const target = e.target;
        if (target.classList.contains('tr-day') && !target.classList.contains('tr-day--filler')) {
          const dateText = target.dataset.trDate;
          const infoText = target.dataset.trInfo;
          if (tooltipPlugin) {
            tooltipPlugin.showTooltipAt(e.clientX, e.clientY, false, dateText, infoText);
          }
        }
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'mousemove',
      (e) => {
        if (!this.hasHover) return;
        if (this.engine.tooltip.style.opacity === '1') {
          pendingMouseX = e.clientX;
          pendingMouseY = e.clientY;
          if (!mouseRafPending) {
            mouseRafPending = true;
            requestAnimationFrame(processMouseMove);
          }
        }
      },
      { signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'mouseout',
      (e) => {
        if (!this.hasHover) return;
        if (!this.engine.viewport.contains(e.relatedTarget)) {
          this.engine.tooltip.style.opacity = '0';
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
            if (this.engine.srStatus) {
              this.engine.srStatus.textContent = targetCell.getAttribute('aria-label');
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
        if (target.classList.contains('tr-day') && !target.classList.contains('tr-day--filler')) {
          const rect = target.getBoundingClientRect();
          const dateText = target.dataset.trDate;
          const infoText = target.dataset.trInfo;
          if (tooltipPlugin) {
            tooltipPlugin.showTooltipAt(
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
        this.engine.tooltip.style.opacity = '0';
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
    const minGap = type === 'scrub' ? 90 : 350;
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
    super.destroy();
  }
}
