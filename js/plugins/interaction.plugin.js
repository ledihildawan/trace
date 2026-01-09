// TRACE Interaction Plugin
// Handles mouse, touch, keyboard, and gesture interactions
// Refactored to eliminate race conditions and event conflicts

import {
  DOUBLE_TAP_MAX_DELAY_MS,
  DOUBLE_TAP_MAX_DISTANCE_PX,
  DRAG_THRESHOLD_PX,
  HAPTIC_SCRUB_MS,
  HAPTIC_SUCCESS_MS,
  LONG_PRESS_DURATION_MS,
} from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';

export class InteractionPlugin extends TracePlugin {
  constructor() {
    super('InteractionPlugin');

    // State Flags
    this._rafPending = false;
    this._isTouchActive = false; // Master lock for touch interactions
    this._isDragging = false;

    // Coordinates
    this._pendingX = 0;
    this._pendingY = 0;

    // Element References
    this._lastHoveredElement = null;
    this._pressedElement = null;
    this._draggingElement = null;

    // Timers & Haptics
    this._timers = {
      gap: null,
      clear: null,
      longPress: null,
      cooldown: null,
    };
    this._lastHapticAt = { scrub: 0, success: 0 };

    // Touch Logic Data
    this.touchActiveElements = new Set();
    this.activePointerId = null;
    this.startX = 0;
    this.startY = 0;

    this.hasHover = false;
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

    this.tooltipPlugin = this.engine.plugins.get('TooltipPlugin');

    this.setupKeyboardControls();
    this.setupTouchGestures();
    this.setupMouseControls();
    this.setupEventDelegation();
  }

  isValidDay(element) {
    return element?.classList.contains('tr-day') && !element.classList.contains('tr-day--filler');
  }

  /**
   * Nuclear option: Clear ALL pending timers to prevent race conditions.
   * Called immediately on pointerdown.
   */
  _clearAllTimers() {
    if (this._timers.gap) clearTimeout(this._timers.gap);
    if (this._timers.clear) clearTimeout(this._timers.clear);
    if (this._timers.longPress) clearTimeout(this._timers.longPress);
    // Note: We deliberately do NOT clear cooldown here usually, but for a fresh press we might want to.

    this._timers.gap = null;
    this._timers.clear = null;
    this._timers.longPress = null;
  }

  setupKeyboardControls() {
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.engine.viewport && this.engine.viewport.contains(e.target)) return;
        const key = e.key.toLowerCase();
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          if (key === ' ' || key === 'spacebar') {
            e.preventDefault();
            this.engine.plugins.get('ThemePlugin')?.cycleTheme();
          } else if (key === 'r') {
            this.engine.plugins.get('DevToolsPlugin')?.randomizeThemeNowAndLocale();
          } else if (key === 'x') {
            this.engine.plugins.get('DevToolsPlugin')?.resetToDefaults();
          }
        }
      },
      { signal: this.signal }
    );
  }

  setupTouchGestures() {
    let pinchStartDistance = 0;
    let pinchTriggered = false;
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let startTime = 0;
    let longPressTriggered = false;

    // --- HELPER: Visual Cleanup ---
    const clearVisualState = () => {
      if (this._lastHoveredElement) {
        this._lastHoveredElement.classList.remove('tr-is-touch-active');
      }
      this.touchActiveElements.forEach((el) => el.classList.remove('tr-is-touch-active'));
      this.touchActiveElements.clear();
      this._lastHoveredElement = null;

      if (this._draggingElement) {
        this._draggingElement.classList.remove('tr-is-dragging');
        this._draggingElement = null;
      }
    };

    // --- RAF LOOP: Update State ---
    const processPointerMove = () => {
      this._rafPending = false;

      // If we are not actively touching/dragging, ignore (safety check)
      if (!this._isTouchActive && !this._isDragging) return;

      // Hit test
      const target = document.elementFromPoint(this._pendingX, this._pendingY);

      if (this.isValidDay(target)) {
        // We found a valid day - kill the gap timer immediately!
        if (this._timers.gap) {
          clearTimeout(this._timers.gap);
          this._timers.gap = null;
        }

        // State Change Check
        if (this._lastHoveredElement !== target) {
          // Clean old
          if (this._lastHoveredElement) {
            this._lastHoveredElement.classList.remove('tr-is-touch-active');
            this.touchActiveElements.delete(this._lastHoveredElement);
          }

          // Set new
          target.classList.add('tr-is-touch-active');
          this.touchActiveElements.add(target);
          this._lastHoveredElement = target;

          // Haptic & Visuals
          this.triggerHaptic('scrub');

          if (this._isDragging) {
            // If dragging, we also update the drag marker
            if (this._draggingElement && this._draggingElement !== target) {
              this._draggingElement.classList.remove('tr-is-dragging');
            }
            target.classList.add('tr-is-dragging');
            this._draggingElement = target;
          }
        }

        // Always update tooltip position if valid day, even if element didn't change
        if (this.tooltipPlugin) {
          this.tooltipPlugin.showTooltipAt(
            this._pendingX,
            this._pendingY,
            true, // isTouch
            target.dataset.trDate,
            target.dataset.trInfo
          );
        }
      } else {
        // We are in a gap or off-grid
        if (this._lastHoveredElement && !this._timers.gap) {
          // Grace period: Wait 100ms before clearing visuals to prevent flickering
          this._timers.gap = setTimeout(() => {
            clearVisualState();
            if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
            this._timers.gap = null;
          }, 100);
        }
      }
    };

    const requestUpdate = (x, y) => {
      this._pendingX = x;
      this._pendingY = y;
      if (!this._rafPending) {
        this._rafPending = true;
        requestAnimationFrame(processPointerMove);
      }
    };

    // --- HANDLERS ---

    const handlePointerDown = (e) => {
      if (e.pointerType === 'mouse') return;

      // 1. HARD RESET: Stop everything from previous interactions
      this._clearAllTimers();
      this.tooltipPlugin?.cancelHide(); // Stop tooltip from fading out

      // 2. Set State
      this._isTouchActive = true;
      this._isDragging = false;
      this.activePointerId = e.pointerId;
      this.engine.viewport.setPointerCapture(e.pointerId);

      this.startX = e.clientX;
      this.startY = e.clientY;
      startTime = performance.now();
      longPressTriggered = false;
      pinchTriggered = false;

      // 3. Clear old visuals explicitly
      clearVisualState();

      // 4. Hit test immediate
      const pressed = document.elementFromPoint(e.clientX, e.clientY);
      if (this.isValidDay(pressed)) {
        this._pressedElement = pressed;
        pressed.classList.add('tr-is-pressing');
        // Immediately show tooltip
        if (this.tooltipPlugin) {
          this.tooltipPlugin.showTooltipAt(e.clientX, e.clientY, true, pressed.dataset.trDate, pressed.dataset.trInfo);
        }
      }

      // 5. Setup Long Press
      this._timers.longPress = setTimeout(() => {
        if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
        this.engine.plugins.get('DevToolsPlugin')?.resetToDefaults();
        this.triggerHaptic('success');
        longPressTriggered = true;
        clearVisualState(); // Clear visuals on long press success
      }, LONG_PRESS_DURATION_MS);
    };

    const handlePointerMove = (e) => {
      if (e.pointerType === 'mouse' || this.activePointerId !== e.pointerId) return;

      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      const distSq = dx * dx + dy * dy;

      // Determine Drag Threshold
      const dpr = window.devicePixelRatio || 1;
      const threshold = this._pressedElement ? 10 : DRAG_THRESHOLD_PX; // Lower threshold if we started on a cell

      if (!this._isDragging && distSq > threshold * threshold) {
        this._isDragging = true;

        // Cancel Long Press immediately on movement
        if (this._timers.longPress) {
          clearTimeout(this._timers.longPress);
          this._timers.longPress = null;
        }

        // Clear "Pressing" state
        if (this._pressedElement) {
          this._pressedElement.classList.remove('tr-is-pressing');
          this._pressedElement = null;
        }
      }

      if (this._isDragging) {
        requestUpdate(e.clientX, e.clientY);
      }
    };

    const handlePointerEnd = (e) => {
      if (e.pointerType === 'mouse' || this.activePointerId !== e.pointerId) return;

      // Cleanup core state
      this.engine.viewport.releasePointerCapture(e.pointerId);
      this.activePointerId = null;
      this._clearAllTimers(); // Kill long press if it hasn't fired

      // Cleanup pressing visual
      if (this._pressedElement) {
        this._pressedElement.classList.remove('tr-is-pressing');
        this._pressedElement = null;
      }

      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      const duration = performance.now() - startTime;
      const isTap = !this._isDragging && duration < 500 && !longPressTriggered;

      // --- LOGIC: Tap / Swipe ---
      if (isTap) {
        // Double Tap Logic
        const now = performance.now();
        const tapDist = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY);

        if (now - lastTapTime < DOUBLE_TAP_MAX_DELAY_MS && tapDist < DOUBLE_TAP_MAX_DISTANCE_PX) {
          // Double Tap!
          this.engine.plugins.get('ThemePlugin')?.cycleTheme();
          this.triggerHaptic('success');
          lastTapTime = 0; // reset
        } else {
          // Single Tap
          lastTapTime = now;
          lastTapX = e.clientX;
          lastTapY = e.clientY;

          // Handle Swipe if it was fast enough but slightly dragged (micro-swipe)
          // Or if it was a distinct swipe movement
        }

        // Swipe logic could go here if separated from tap
      }

      // --- CLEANUP VISUALS ---
      // We start a "Cooldown". During this time, mouse events are ignored.
      // This solves the issue where raising a finger triggers a mouseover/click at the same spot.
      if (this._timers.cooldown) clearTimeout(this._timers.cooldown);
      this._timers.cooldown = setTimeout(() => {
        this._isTouchActive = false; // Unlock mouse events
        this._timers.cooldown = null;
      }, 500);

      // Tooltip & Highlight Cleanup
      if (this.tooltipPlugin) {
        if (!longPressTriggered) {
          // Linger the tooltip so user can read it
          this.tooltipPlugin.scheduleHide(1500);

          // Clear highlights slightly faster
          this._timers.clear = setTimeout(() => {
            clearVisualState();
          }, 300);
        } else {
          this.tooltipPlugin.hideTooltip();
          clearVisualState();
        }
      } else {
        clearVisualState();
      }

      this._isDragging = false;
    };

    this.engine.viewport.addEventListener('pointerdown', handlePointerDown, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener('pointermove', handlePointerMove, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener('pointerup', handlePointerEnd, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener('pointercancel', handlePointerEnd, { passive: true, signal: this.signal });
  }

  setupMouseControls() {
    this.engine.viewport.addEventListener(
      'wheel',
      (e) => {
        if (!this.hasHover) return;
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        if (Math.abs(e.deltaY) > 50) {
          this.engine.plugins.get('ThemePlugin')?.cycleTheme();
          this.triggerHaptic('success');
        }
      },
      { passive: false, signal: this.signal }
    );
  }

  setupEventDelegation() {
    let hoveredDayEl = null;
    let gapHideTimer = null;

    // MOUSEOVER
    this.engine.viewport.addEventListener(
      'mouseover',
      (e) => {
        // RACE CONDITION FIX:
        // If touch is active (or cooling down), IGNORE all mouse events.
        if (this._isTouchActive) return;
        if (!this.hasHover) return;

        const target = e.target;

        if (this.isValidDay(target)) {
          // Entered a valid day: Cancel any pending gap hide
          if (gapHideTimer) {
            clearTimeout(gapHideTimer);
            gapHideTimer = null;
          }

          // Immediate feedback
          if (this.tooltipPlugin) {
            this.tooltipPlugin.cancelHide();
            this.tooltipPlugin.showTooltipAt(e.clientX, e.clientY, false, target.dataset.trDate, target.dataset.trInfo);
          }
          hoveredDayEl = target;
        } else {
          // Entered gap/filler
          if (hoveredDayEl && !gapHideTimer) {
            gapHideTimer = setTimeout(() => {
              if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
              hoveredDayEl = null;
              gapHideTimer = null;
            }, 100); // 100ms tolerance for gap crossing
          }
        }
      },
      { passive: true, signal: this.signal }
    );

    // MOUSEMOVE (For Tooltip Position)
    this.engine.viewport.addEventListener(
      'mousemove',
      (e) => {
        if (this._isTouchActive) return; // Ignore if touching
        if (!this.hasHover) return;

        // Only update if we are hovering a valid day to save resources
        if (hoveredDayEl && this.tooltipPlugin) {
          // Pass false for isTouch
          this.tooltipPlugin.positionTooltip(e.clientX, e.clientY, false);
        }
      },
      { passive: true, signal: this.signal }
    );

    // MOUSEOUT (Leaving Viewport)
    this.engine.viewport.addEventListener(
      'mouseout',
      (e) => {
        if (this._isTouchActive) return;
        if (!this.hasHover) return;

        if (!this.engine.viewport.contains(e.relatedTarget)) {
          if (gapHideTimer) clearTimeout(gapHideTimer);
          if (this.tooltipPlugin) this.tooltipPlugin.scheduleHide(50);
          hoveredDayEl = null;
        }
      },
      { signal: this.signal }
    );

    // KEYBOARD
    this.engine.viewport.addEventListener(
      'keydown',
      (e) => {
        const target = e.target;
        if (!target.classList.contains('tr-day')) return;
        const index = parseInt(target.dataset.trIndex, 10);
        if (isNaN(index)) return;

        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.engine.plugins.get('ThemePlugin')?.cycleTheme();
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
        }

        if (targetIndex >= 0 && targetIndex < this.engine.gridCells.length) {
          const targetCell = this.engine.gridCells[targetIndex];
          if (this.isValidDay(targetCell)) {
            e.preventDefault();
            targetCell.focus();
          }
        }
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
    const minGap = type === 'scrub' ? 70 : 320;
    if (now - (this._lastHapticAt[type] ?? 0) < minGap) return;
    this._lastHapticAt[type] = now;
    navigator.vibrate(type === 'scrub' ? HAPTIC_SCRUB_MS : HAPTIC_SUCCESS_MS);
  }

  destroy() {
    this._clearAllTimers();
    if (this._timers.cooldown) clearTimeout(this._timers.cooldown);
    this.tooltipPlugin = null;
    super.destroy();
  }
}
