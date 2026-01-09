// TRACE Interaction Plugin
// SIMPLE VERSION: Touch behaves like Mouse Hover + Native Scroll Handling

import { HAPTIC_SCRUB_MS, LONG_PRESS_DURATION_MS } from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';

const LINGER_DURATION = 1500; // Time tooltip stays visible after touch ends

export class InteractionPlugin extends TracePlugin {
  constructor() {
    super('InteractionPlugin');

    this._activeElement = null; // The day element currently highlighted
    this._isTouching = false; // Flag: is user currently touching screen?
    this._timerLinger = null; // Timer for hiding tooltip after release
    this._timerLongPress = null;

    this.hasHover = false;
  }

  init(engine) {
    super.init(engine);

    // Detect Hover Capability
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

    // CSS: Allow native vertical scrolling (pan-y)
    // This allows the browser to claim the interaction for scrolling if needed,
    // firing a 'pointercancel' event which we use to cleanup.
    this.engine.viewport.style.touchAction = 'pan-y';

    // Prevent text/image selection on long press
    this.engine.viewport.style.userSelect = 'none';
    this.engine.viewport.style.webkitUserSelect = 'none';

    this.setupPointerEvents();
    this.setupKeyboardControls();
  }

  isValidDay(el) {
    return el?.classList.contains('tr-day') && !el.classList.contains('tr-day--filler');
  }

  // --- CORE POINTER LOGIC ---

  setupPointerEvents() {
    const vp = this.engine.viewport;

    // 1. POINTER DOWN: Start Interaction
    vp.addEventListener(
      'pointerdown',
      (e) => {
        // Ignore mouse here (handled by mouseover delegate below)
        if (e.pointerType === 'mouse') return;

        this._isTouching = true;
        this._clearLinger(); // Cancel any pending hide timers

        const target = document.elementFromPoint(e.clientX, e.clientY);

        // Attempt to capture pointer to track movement
        // (Browser may steal this back if it detects a scroll gesture)
        try {
          vp.setPointerCapture(e.pointerId);
        } catch (err) {
          // Ignore capture errors
        }

        this._handleTouchUpdate(target, true); // true = add 'pressing' visual

        // Optional Long Press Logic
        this._timerLongPress = setTimeout(() => {
          if (this._isTouching && this._activeElement) {
            this.triggerHaptic();
            this.engine.plugins.get('DevToolsPlugin')?.resetToDefaults();
            // Reset interaction on success
            this._resetInteraction(true);
          }
        }, LONG_PRESS_DURATION_MS);
      },
      { passive: true, signal: this.signal }
    );

    // 2. POINTER MOVE: Update Highlight
    vp.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'mouse' || !this._isTouching) return;

        // Use elementFromPoint because e.target is locked to the initial element during capture
        const target = document.elementFromPoint(e.clientX, e.clientY);
        this._handleTouchUpdate(target, false);
      },
      { passive: true, signal: this.signal }
    );

    // 3. POINTER UP: End Interaction (with Linger)
    vp.addEventListener(
      'pointerup',
      (e) => {
        if (e.pointerType === 'mouse') return;

        this._isTouching = false;
        if (this._timerLongPress) clearTimeout(this._timerLongPress);

        if (vp.hasPointerCapture(e.pointerId)) {
          vp.releasePointerCapture(e.pointerId);
        }

        // Don't hide immediately. Schedule linger so user can read tooltip.
        this._scheduleLinger();
      },
      { passive: true, signal: this.signal }
    );

    // 4. POINTER CANCEL: Native Scroll Interruption
    // This fires when the browser decides the user is scrolling the page.
    vp.addEventListener(
      'pointercancel',
      () => {
        this._isTouching = false;
        if (this._timerLongPress) clearTimeout(this._timerLongPress);

        // If scrolling, immediately clear visuals so they don't stick
        this._resetInteraction(true);
      },
      { passive: true, signal: this.signal }
    );

    // --- DESKTOP MOUSE DELEGATE ---
    // (Standard hover behavior for non-touch devices)

    vp.addEventListener(
      'mouseover',
      (e) => {
        if (this._isTouching) return; // Priority to touch
        if (!this.hasHover) return;

        const target = e.target;
        if (this.isValidDay(target)) {
          if (this.tooltipPlugin) this.tooltipPlugin.showTooltipForElement(target, false);
        }
      },
      { passive: true, signal: this.signal }
    );

    vp.addEventListener(
      'mouseout',
      (e) => {
        if (this._isTouching) return;
        if (!this.hasHover) return;

        if (!vp.contains(e.relatedTarget)) {
          this.tooltipPlugin?.hideTooltip();
        }
      },
      { signal: this.signal }
    );
  }

  // --- HELPERS ---

  _handleTouchUpdate(target, isPressing) {
    // If not a valid day, do nothing (keep previous valid one active for smoothness)
    // OR: You could clear it if you want strict behavior. Here we are sticky.
    if (!this.isValidDay(target)) return;

    // If we moved to a new element
    if (this._activeElement !== target) {
      this._resetVisuals(); // Clear old element

      this._activeElement = target;

      // Add Visual Classes
      target.classList.add('tr-is-touch-active');
      target.classList.add('tr-is-dragging'); // Re-use drag style for active state
      if (isPressing) target.classList.add('tr-is-pressing');

      // Update Tooltip (Magnetic Snap)
      if (this.tooltipPlugin) {
        this.tooltipPlugin.showTooltipForElement(target, true);
      }

      // Haptic Feedback on cell change
      this.triggerHaptic();
    }
  }

  _resetInteraction(immediate = false) {
    if (this._timerLongPress) clearTimeout(this._timerLongPress);

    if (immediate) {
      this._clearLinger();
      this._resetVisuals();
      this._activeElement = null;
      this.tooltipPlugin?.hideTooltip();
    } else {
      this._scheduleLinger();
    }
  }

  _resetVisuals() {
    if (this._activeElement) {
      this._activeElement.classList.remove('tr-is-touch-active');
      this._activeElement.classList.remove('tr-is-pressing');
      this._activeElement.classList.remove('tr-is-dragging');
    }
  }

  _scheduleLinger() {
    this._clearLinger();
    this._timerLinger = setTimeout(() => {
      this._resetVisuals();
      this._activeElement = null;
      this.tooltipPlugin?.hideTooltip();
    }, LINGER_DURATION);
  }

  _clearLinger() {
    if (this._timerLinger) clearTimeout(this._timerLinger);
    this._timerLinger = null;
  }

  setupKeyboardControls() {
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.engine.viewport && this.engine.viewport.contains(e.target)) return;
        if (e.key === ' ' && !e.ctrlKey) {
          e.preventDefault();
          this.engine.plugins.get('ThemePlugin')?.cycleTheme();
        }
      },
      { signal: this.signal }
    );
  }

  triggerHaptic() {
    if (navigator.vibrate) navigator.vibrate(HAPTIC_SCRUB_MS);
  }
}
