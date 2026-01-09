// TRACE Interaction Plugin
// Optimized with: Adaptive Haptics, Dynamic Linger, and Anti-Collision Logic

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

    this._activeElement = null;
    this._isTouching = false;
    this._timerLinger = null;
    this._timerLongPress = null;

    // Tracking for Velocity & Gestures
    this._startX = 0;
    this._startY = 0;
    this._startTime = 0;
    this._lastMoveTime = 0;
    this._velocity = 0;
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

    this.engine.viewport.style.touchAction = 'pan-y';
    this.engine.viewport.style.userSelect = 'none';
    this.engine.viewport.style.webkitUserSelect = 'none';

    this.setupPointerEvents();
    this.setupKeyboardControls();
  }

  isValidDay(el) {
    return el?.classList.contains('tr-day') && !el.classList.contains('tr-day--filler');
  }

  setupPointerEvents() {
    const vp = this.engine.viewport;

    vp.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse') return;

        this._isTouching = true;
        this._startX = e.clientX;
        this._startY = e.clientY;
        this._startTime = performance.now();
        this._lastMoveTime = this._startTime;
        this._velocity = 0;

        this._clearLinger();

        const target = document.elementFromPoint(e.clientX, e.clientY);
        this._handleTouchUpdate(target, true);

        if (this._timerLongPress) clearTimeout(this._timerLongPress);
        this._timerLongPress = setTimeout(() => {
          if (this._isTouching) {
            this.triggerHaptic('success');
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

        // 1. Velocity Tracking for Dynamic Linger
        const now = performance.now();
        const dt = now - this._lastMoveTime;
        if (dt > 0) {
          const dist = Math.hypot(e.clientX - this._pendingX || 0, e.clientY - this._pendingY || 0);
          this._velocity = dist / dt;
        }
        this._lastMoveTime = now;
        this._pendingX = e.clientX;
        this._pendingY = e.clientY;

        // 2. Anti-Reset logic: Cancel long press if finger moves > 10px
        const dx = Math.abs(e.clientX - this._startX);
        const dy = Math.abs(e.clientY - this._startY);
        if (dx > 10 || dy > 10) {
          if (this._timerLongPress) {
            clearTimeout(this._timerLongPress);
            this._timerLongPress = null;
          }
        }

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

        if (Math.abs(deltaY) > 100 && duration < 300) {
          this._triggerRandomize();
        } else {
          const now = performance.now();
          if (now - this._lastTapTime < DOUBLE_TAP_MAX_DELAY_MS) {
            this.engine.plugins.get('ThemePlugin')?.cycleTheme();
            this.triggerHaptic('success');
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

  _handleTouchUpdate(target, isPressing) {
    if (!this.isValidDay(target)) return;
    if (this._activeElement !== target) {
      this._resetVisuals();
      this._activeElement = target;
      target.classList.add('tr-is-touch-active');
      if (isPressing) target.classList.add('tr-is-pressing');

      this.tooltipPlugin?.showTooltipForElement(target, true);

      // 3. Adaptive Haptics: Stronger vibration for start of month/Monday
      const isBoundary = target.classList.contains('tr-day--monday') || target.dataset.trDate.includes(' 1,');
      this.triggerHaptic(isBoundary ? 'boundary' : 'scrub');
    }
  }

  _triggerRandomize() {
    const devTools = this.engine.plugins.get('DevToolsPlugin');
    if (devTools) {
      devTools.randomizeThemeNowAndLocale();
      this.triggerHaptic('success');
      this.engine.viewport.classList.add('tr-theme-pulse');
      setTimeout(() => this.engine.viewport.classList.remove('tr-theme-pulse'), 600);
    }
    this._resetInteraction(true);
  }

  _scheduleLinger() {
    this._clearLinger();
    // 4. Dynamic Linger: Longer if scrubbing was slow (reading), shorter if fast
    const dynamicDuration = clamp(2500 - this._velocity * 500, 1000, 3000);

    this._timerLinger = setTimeout(() => this._resetInteraction(true), dynamicDuration);
    if (this.tooltipPlugin) this.tooltipPlugin.scheduleHide(dynamicDuration);
  }

  _resetVisuals() {
    if (this._activeElement) {
      this._activeElement.classList.remove('tr-is-touch-active', 'tr-is-pressing');
    }
  }

  _resetInteraction(immediate = false) {
    if (this._timerLongPress) clearTimeout(this._timerLongPress);
    if (immediate) {
      this._clearLinger();
      this._resetVisuals();
      this._activeElement = null;
      this.tooltipPlugin?.hideTooltip();
    }
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
        const key = e.key.toLowerCase();
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          if (key === 'c') {
            this.engine.plugins.get('ThemePlugin')?.cycleTheme();
            this.triggerHaptic('success');
          } else if (key === 'x') {
            this.engine.plugins.get('DevToolsPlugin')?.resetToDefaults();
            this.triggerHaptic('success');
          } else if (key === 'r') {
            this._triggerRandomize();
          }
        }
      },
      { signal: this.signal }
    );
  }

  triggerHaptic(type) {
    if (!navigator.vibrate) return;
    if (type === 'boundary') navigator.vibrate([15, 30, 15]);
    else if (type === 'success') navigator.vibrate(HAPTIC_SUCCESS_MS);
    else navigator.vibrate(HAPTIC_SCRUB_MS);
  }

  destroy() {
    this._resetInteraction(true);
    super.destroy();
  }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
