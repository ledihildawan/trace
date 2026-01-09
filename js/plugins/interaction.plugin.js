// TRACE Interaction Plugin
// Integrated: Keyboard Shortcuts (C, X, R) & Mobile Gestures (Swipe, Long Press, Double Tap)

import {
  DOUBLE_TAP_MAX_DELAY_MS,
  HAPTIC_SCRUB_MS,
  HAPTIC_SUCCESS_MS,
  LONG_PRESS_DURATION_MS,
} from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';

const LINGER_DURATION = 1500;

export class InteractionPlugin extends TracePlugin {
  constructor() {
    super('InteractionPlugin');

    this._activeElement = null;
    this._isTouching = false;
    this._timerLinger = null;
    this._timerLongPress = null;

    // Gesture tracking
    this._startY = 0;
    this._startTime = 0;
    this._lastTapTime = 0;

    this.hasHover = false;
  }

  init(engine) {
    super.init(engine);

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

    // UI configuration
    this.engine.viewport.style.touchAction = 'pan-y'; // Allow native vertical scroll
    this.engine.viewport.style.userSelect = 'none';
    this.engine.viewport.style.webkitUserSelect = 'none';

    this.setupPointerEvents();
    this.setupKeyboardControls();
  }

  isValidDay(el) {
    return el?.classList.contains('tr-day') && !el.classList.contains('tr-day--filler');
  }

  // --- GESTURE & POINTER LOGIC ---

  setupPointerEvents() {
    const vp = this.engine.viewport;

    vp.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse') return;

        this._isTouching = true;
        this._startY = e.clientY;
        this._startTime = performance.now();
        this._clearLinger();

        const target = document.elementFromPoint(e.clientX, e.clientY);
        this._handleTouchUpdate(target, true);

        // Long Press -> RESET (X equivalent)
        this._timerLongPress = setTimeout(() => {
          if (this._isTouching) {
            this.triggerHaptic(HAPTIC_SUCCESS_MS);
            this.engine.plugins.get('DevToolsPlugin')?.resetToDefaults();
            this._resetInteraction(true);
          }
        }, LONG_PRESS_DURATION_MS);
      },
      { passive: true, signal: this.signal }
    );

    vp.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'mouse' || !this._isTouching) return;
        const target = document.elementFromPoint(e.clientX, e.clientY);
        this._handleTouchUpdate(target, false);
      },
      { passive: true, signal: this.signal }
    );

    vp.addEventListener(
      'pointerup',
      (e) => {
        if (e.pointerType === 'mouse') return;

        const deltaY = e.clientY - this._startY;
        const duration = performance.now() - this._startTime;

        // Vertical Swipe -> RANDOMIZE (R equivalent)
        if (Math.abs(deltaY) > 100 && duration < 300) {
          this._triggerRandomize();
        }
        // Tap Logic
        else {
          const now = performance.now();
          if (now - this._lastTapTime < DOUBLE_TAP_MAX_DELAY_MS) {
            // Double Tap -> CHANGE THEME (C equivalent)
            this.engine.plugins.get('ThemePlugin')?.cycleTheme();
            this.triggerHaptic(HAPTIC_SUCCESS_MS);
            this._resetInteraction(true);
            this._lastTapTime = 0;
          } else {
            this._lastTapTime = now;
            this._scheduleLinger();
          }
        }

        this._isTouching = false;
        if (this._timerLongPress) clearTimeout(this._timerLongPress);
      },
      { passive: true, signal: this.signal }
    );

    vp.addEventListener(
      'pointercancel',
      () => {
        this._isTouching = false;
        this._resetInteraction(true);
      },
      { passive: true, signal: this.signal }
    );

    // Desktop Hover
    vp.addEventListener(
      'mouseover',
      (e) => {
        if (this._isTouching || !this.hasHover) return;
        if (this.isValidDay(e.target)) {
          this.tooltipPlugin?.showTooltipForElement(e.target, false);
        }
      },
      { passive: true, signal: this.signal }
    );
  }

  // --- KEYBOARD SHORTCUTS (C, X, R) ---

  setupKeyboardControls() {
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.engine.viewport && this.engine.viewport.contains(e.target)) return;
        const key = e.key.toLowerCase();

        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          // C -> Cycle Theme
          if (key === 'c') {
            this.engine.plugins.get('ThemePlugin')?.cycleTheme();
            this.triggerHaptic(HAPTIC_SUCCESS_MS);
          }
          // X -> Reset to Defaults
          else if (key === 'x') {
            this.engine.plugins.get('DevToolsPlugin')?.resetToDefaults();
            this.triggerHaptic(HAPTIC_SUCCESS_MS);
          }
          // R -> Randomize
          else if (key === 'r') {
            this._triggerRandomize();
          }
        }
      },
      { signal: this.signal }
    );
  }

  // --- HELPERS ---

  _triggerRandomize() {
    const devTools = this.engine.plugins.get('DevToolsPlugin');
    if (devTools) {
      devTools.randomizeThemeNowAndLocale();
      this.triggerHaptic(HAPTIC_SUCCESS_MS);
      this.engine.viewport.classList.add('tr-theme-pulse');
      setTimeout(() => this.engine.viewport.classList.remove('tr-theme-pulse'), 600);
    }
    this._resetInteraction(true);
  }

  _handleTouchUpdate(target, isPressing) {
    if (!this.isValidDay(target)) return;
    if (this._activeElement !== target) {
      this._resetVisuals();
      this._activeElement = target;
      target.classList.add('tr-is-touch-active');
      if (isPressing) target.classList.add('tr-is-pressing');
      this.tooltipPlugin?.showTooltipForElement(target, true);
      this.triggerHaptic(HAPTIC_SCRUB_MS);
    }
  }

  _resetVisuals() {
    if (this._activeElement) {
      this._activeElement.classList.remove('tr-is-touch-active', 'tr-is-pressing');
    }
  }

  _resetInteraction(immediate = false) {
    if (this._timerLongPress) clearTimeout(this._timerLongPress);
    if (immediate) {
      this._resetVisuals();
      this._activeElement = null;
      this.tooltipPlugin?.hideTooltip();
    }
  }

  _scheduleLinger() {
    this._clearLinger();
    this._timerLinger = setTimeout(() => this._resetInteraction(true), LINGER_DURATION);
  }

  _clearLinger() {
    if (this._timerLinger) clearTimeout(this._timerLinger);
  }

  triggerHaptic(ms = HAPTIC_SCRUB_MS) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }
}
