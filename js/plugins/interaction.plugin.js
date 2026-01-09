// TRACE Interaction Plugin
// UX UPDATE: Horizontal Scrubbing Lock & Scroll Passthrough

import {
  DOUBLE_TAP_MAX_DELAY_MS,
  HAPTIC_SCRUB_MS,
  HAPTIC_SUCCESS_MS,
  LONG_PRESS_DURATION_MS,
} from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';

export class InteractionPlugin extends TracePlugin {
  constructor() {
    super('InteractionPlugin');

    // State
    this._rafPending = false;
    this._isTouchActive = false; // True if user is touching
    this._isScrubbing = false; // True ONLY if moving horizontally
    this._scrollLocked = false; // True if native scroll took over

    // Coordinates
    this._pendingX = 0;
    this._pendingY = 0;
    this.startX = 0;
    this.startY = 0;

    // Elements
    this._activeDayEl = null; // The day cell currently highlighted
    this._pressedEl = null; // The cell initially pressed

    // Timers
    this._timers = {
      longPress: null,
      cooldown: null,
      cleanup: null,
    };

    this._lastHaptic = 0;
    this.hasHover = false;
  }

  init(engine) {
    super.init(engine);

    // Hover detection
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

    // Set CSS touch-action to allow vertical scroll but handle horizontal via JS if needed
    // Ideally this should be in CSS: .trace-grid { touch-action: pan-y; }
    this.engine.viewport.style.touchAction = 'pan-y';

    this.setupTouchGestures();
    this.setupMouseControls();
    this.setupKeyboardControls(); // Assuming standard keyboard controls
    this.setupHoverDelegate();
  }

  isValidDay(el) {
    return el?.classList.contains('tr-day') && !el.classList.contains('tr-day--filler');
  }

  _clearTimers() {
    if (this._timers.longPress) clearTimeout(this._timers.longPress);
    if (this._timers.cleanup) clearTimeout(this._timers.cleanup);
    this._timers.longPress = null;
    this._timers.cleanup = null;
  }

  _resetState() {
    this._isTouchActive = false;
    this._isScrubbing = false;
    this._scrollLocked = false;
    this._clearTimers();

    // Clear visuals
    if (this._activeDayEl) {
      this._activeDayEl.classList.remove('tr-is-touch-active');
      this._activeDayEl.classList.remove('tr-is-dragging');
      this._activeDayEl = null;
    }
    if (this._pressedEl) {
      this._pressedEl.classList.remove('tr-is-pressing');
      this._pressedEl = null;
    }
  }

  setupTouchGestures() {
    let lastTapTime = 0;

    // --- RAF LOOP (Only for scrubbing) ---
    const updateScrub = () => {
      this._rafPending = false;
      if (!this._isScrubbing || this._scrollLocked) return;

      const target = document.elementFromPoint(this._pendingX, this._pendingY);

      if (this.isValidDay(target)) {
        if (this._activeDayEl !== target) {
          // Switch active element
          if (this._activeDayEl) {
            this._activeDayEl.classList.remove('tr-is-dragging');
            this._activeDayEl.classList.remove('tr-is-touch-active');
          }

          target.classList.add('tr-is-dragging');
          target.classList.add('tr-is-touch-active'); // Add both for styling flexibility
          this._activeDayEl = target;

          this.triggerHaptic('scrub');
        }

        // UX KEY: Pass the ELEMENT to tooltip, not just coordinates
        // This enables "Snap-to-Grid" positioning
        if (this.tooltipPlugin) {
          this.tooltipPlugin.showTooltipForElement(target, true);
        }
      }
    };

    const requestUpdate = (x, y) => {
      this._pendingX = x;
      this._pendingY = y;
      if (!this._rafPending) {
        this._rafPending = true;
        requestAnimationFrame(updateScrub);
      }
    };

    // --- EVENTS ---

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse') return;

      this._resetState(); // Hard reset
      this._isTouchActive = true;
      this.startX = e.clientX;
      this.startY = e.clientY;

      // DO NOT CAPTURE POINTER YET. Wait for movement direction.

      // Visual feedback for immediate press
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (this.isValidDay(target)) {
        this._pressedEl = target;
        target.classList.add('tr-is-pressing');
        // Show tooltip immediately on tap, anchored to element
        if (this.tooltipPlugin) this.tooltipPlugin.showTooltipForElement(target, true);
      }

      // Long Press Logic
      this._timers.longPress = setTimeout(() => {
        if (this._isScrubbing || this._scrollLocked) return;
        // Trigger Long Press
        this.triggerHaptic('success');
        this.engine.plugins.get('DevToolsPlugin')?.resetToDefaults();
        if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
        this._resetState(); // End interaction
      }, LONG_PRESS_DURATION_MS);
    };

    const onPointerMove = (e) => {
      if (e.pointerType === 'mouse' || !this._isTouchActive || this._scrollLocked) return;

      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;

      // If already scrubbing, just update
      if (this._isScrubbing) {
        requestUpdate(e.clientX, e.clientY);
        return;
      }

      // --- INTENT CHECK ---
      const moveDist = Math.hypot(dx, dy);
      if (moveDist > 6) {
        // Sensitivity threshold
        // Movement detected, cancel long press
        if (this._timers.longPress) clearTimeout(this._timers.longPress);

        const isHorizontal = Math.abs(dx) > Math.abs(dy);

        if (isHorizontal) {
          // SCRUBBING! Lock interactions.
          this._isScrubbing = true;
          this.engine.viewport.setPointerCapture(e.pointerId); // Trap pointer

          // Clear "Press" state, move to "Drag" state
          if (this._pressedEl) {
            this._pressedEl.classList.remove('tr-is-pressing');
            this._pressedEl = null;
          }
          requestUpdate(e.clientX, e.clientY);
        } else {
          // SCROLLING! Abort our logic.
          this._scrollLocked = true;
          this._resetState(); // Clean up highlighting immediately
          if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
        }
      }
    };

    const onPointerUp = (e) => {
      if (e.pointerType === 'mouse') return;

      // Handle Taps (if not scrubbing and not scrolled)
      if (!this._isScrubbing && !this._scrollLocked && this._isTouchActive) {
        const now = performance.now();
        if (now - lastTapTime < DOUBLE_TAP_MAX_DELAY_MS) {
          // Double Tap
          this.engine.plugins.get('ThemePlugin')?.cycleTheme();
          this.triggerHaptic('success');
          if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
          lastTapTime = 0;
        } else {
          lastTapTime = now;
          // Single tap already showed tooltip on Down.
          // We just schedule a cleanup.
        }
      }

      // Cleanup
      this.engine.viewport.releasePointerCapture(e.pointerId);

      if (this.tooltipPlugin && this._isScrubbing) {
        // If we were scrubbing, linger the tooltip
        this.tooltipPlugin.scheduleHide(1200);
      } else if (!this._isScrubbing) {
        // If just a tap, linger briefly
        this.tooltipPlugin?.scheduleHide(2000);
      }

      // Visual cleanup delay
      this._timers.cleanup = setTimeout(() => {
        this._resetState();
      }, 500); // 500ms cooldown prevent mouse ghosts

      this._isTouchActive = false;
      this._isScrubbing = false;
    };

    this.engine.viewport.addEventListener('pointerdown', onPointerDown, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener('pointermove', onPointerMove, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener('pointerup', onPointerUp, { passive: true, signal: this.signal });
    this.engine.viewport.addEventListener(
      'pointercancel',
      (e) => {
        this._resetState();
        this.tooltipPlugin?.hideTooltip();
      },
      { passive: true, signal: this.signal }
    );
  }

  setupMouseControls() {
    // Standard mouse wheel
    this.engine.viewport.addEventListener(
      'wheel',
      (e) => {
        if (!this.hasHover || e.ctrlKey) return;
        if (Math.abs(e.deltaY) > 50) {
          e.preventDefault();
          this.engine.plugins.get('ThemePlugin')?.cycleTheme();
        }
      },
      { passive: false, signal: this.signal }
    );
  }

  setupHoverDelegate() {
    // Simplified Mouse Hover
    this.engine.viewport.addEventListener(
      'mouseover',
      (e) => {
        if (this._isTouchActive) return; // Ignore if touching
        if (!this.hasHover) return;

        const target = e.target;
        if (this.isValidDay(target)) {
          if (this.tooltipPlugin) this.tooltipPlugin.showTooltipForElement(target, false);
        }
      },
      { passive: true, signal: this.signal }
    );

    this.engine.viewport.addEventListener(
      'mouseout',
      (e) => {
        if (this._isTouchActive) return;
        if (!this.hasHover) return;
        if (!this.engine.viewport.contains(e.relatedTarget)) {
          this.tooltipPlugin?.hideTooltip();
        }
      },
      { signal: this.signal }
    );
  }

  setupKeyboardControls() {
    // Standard keyboard implementation...
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.engine.viewport?.contains(e.target)) return;
        if (e.key === ' ' && !e.ctrlKey) {
          e.preventDefault();
          this.engine.plugins.get('ThemePlugin')?.cycleTheme();
        }
      },
      { signal: this.signal }
    );
  }

  triggerHaptic(type) {
    if (!navigator.vibrate) return;
    const now = performance.now();
    const minGap = type === 'scrub' ? 60 : 200;
    if (now - this._lastHaptic < minGap) return;
    this._lastHaptic = now;
    navigator.vibrate(type === 'scrub' ? HAPTIC_SCRUB_MS : HAPTIC_SUCCESS_MS);
  }
}
