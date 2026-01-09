// TRACE Interaction Plugin
// Optimized: DRY State Management, Performance-First, Modern Browser APIs

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
    this._timers = new Map(); // Centralized timer management
    this._tracking = { startX: 0, startY: 0, startTime: 0, velocity: 0, lastMoveTime: 0 };
    this._lastTapTime = 0;
    this.hasHover = window.matchMedia('(hover: hover)').matches;
  }

  init(engine) {
    super.init(engine);
    this.tooltip = this.engine.plugins.get('TooltipPlugin');
    const options = { passive: true, signal: this.signal };

    this._setupStyles();
    this._bindEvents(options);
  }

  _setupStyles() {
    Object.assign(this.engine.viewport.style, {
      touchAction: 'pan-y',
      userSelect: 'none',
      webkitUserSelect: 'none',
    });
  }

  _bindEvents(options) {
    const vp = this.engine.viewport;
    vp.addEventListener('pointerdown', (e) => this._onDown(e), options);
    vp.addEventListener('pointermove', (e) => this._onMove(e), options);
    vp.addEventListener('pointerup', (e) => this._onUp(e), options);
    vp.addEventListener('pointercancel', () => this._reset(true), options);
    vp.addEventListener('mouseover', (e) => this._onHover(e), options);
    window.addEventListener('keydown', (e) => this._onKey(e), options);

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        'resize',
        () => {
          if (this._activeElement) this.tooltip?.updatePosition();
        },
        options
      );
    }
  }

  // --- Unified State & Timer Management (DRY) ---

  _setTimer(key, fn, ms) {
    this._clearTimer(key);
    this._timers.set(key, setTimeout(fn, ms));
  }

  _clearTimer(key) {
    if (this._timers.has(key)) {
      clearTimeout(this._timers.get(key));
      this._timers.delete(key);
    }
  }

  _reset(immediate = false) {
    this._clearTimer('longPress');
    if (immediate) {
      this._clearTimer('linger');
      if (this._activeElement) {
        this._activeElement.classList.remove('tr-is-touch-active', 'tr-is-pressing');
        this._activeElement = null;
      }
      this.tooltip?.hideTooltip();
    }
  }

  // --- Event Handlers ---

  _onDown(e) {
    if (e.pointerType === 'mouse') return;
    this._reset(true);
    this._isTouching = true;
    Object.assign(this._tracking, {
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      lastMoveTime: performance.now(),
      velocity: 0,
    });

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (this._isDay(target)) this._updateActive(target, true);

    this._setTimer(
      'longPress',
      () => {
        if (this._isTouching && !this._hasMoved(e.clientX, e.clientY)) {
          this._trigger('reset');
        }
      },
      LONG_PRESS_DURATION_MS
    );
  }

  _onMove(e) {
    if (!this._isTouching || e.pointerType === 'mouse') return;

    const now = performance.now();
    const dt = now - this._tracking.lastMoveTime;
    if (dt > 16) {
      const dist = Math.hypot(
        e.clientX - (this._tracking.lastX || e.clientX),
        e.clientY - (this._tracking.lastY || e.clientY)
      );
      this._tracking.velocity = dist / dt;
      this._tracking.lastMoveTime = now;
      this._tracking.lastX = e.clientX;
      this._tracking.lastY = e.clientY;
    }

    if (this._hasMoved(e.clientX, e.clientY)) this._clearTimer('longPress');

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (this._isDay(target)) this._updateActive(target, false);
  }

  _onUp(e) {
    if (e.pointerType === 'mouse') return;
    this._isTouching = false;

    const duration = performance.now() - this._tracking.startTime;
    if (Math.abs(e.clientY - this._tracking.startY) > 100 && duration < 300) {
      this._trigger('random');
    } else {
      this._handleTap();
    }
  }

  _handleTap() {
    const now = performance.now();
    if (now - this._lastTapTime < DOUBLE_TAP_MAX_DELAY_MS) {
      this._trigger('theme');
    } else {
      this._lastTapTime = now;
      this._scheduleLinger();
    }
  }

  _onHover(e) {
    if (this._isTouching || !this.hasHover) return;
    if (this._isDay(e.target)) this.tooltip?.showTooltipForElement(e.target, false);
  }

  _onKey(e) {
    if (this.engine.viewport?.contains(e.target)) return;
    const key = e.key.toLowerCase();
    const actions = { c: 'theme', x: 'reset', r: 'random' };
    if (actions[key]) this._trigger(actions[key]);
  }

  // --- Logic Helpers ---

  _updateActive(el, pressing) {
    if (this._activeElement === el || !this._isDay(el)) return;
    this._resetVisualsOnly();
    this._activeElement = el;
    el.classList.add('tr-is-touch-active');
    if (pressing) el.classList.add('tr-is-pressing');

    this.tooltip?.showTooltipForElement(el, true);

    const isBoundary = el.dataset.trDate?.includes(' 1,') || el.classList.contains('tr-day--monday');
    this._vibrate(isBoundary ? 'boundary' : 'scrub');
  }

  _resetVisualsOnly() {
    if (this._activeElement) {
      this._activeElement.classList.remove('tr-is-touch-active', 'tr-is-pressing');
    }
  }

  _scheduleLinger() {
    this._clearTimer('linger');
    const schedule = () => {
      const ms = Math.max(1000, Math.min(2500, 2000 - this._tracking.velocity * 400));
      this._setTimer('linger', () => this._reset(true), ms);
      this.tooltip?.scheduleHide(ms);
    };

    if ('requestIdleCallback' in window) window.requestIdleCallback(schedule);
    else schedule();
  }

  _trigger(action) {
    const p = this.engine.plugins;
    if (action === 'theme') p.get('ThemePlugin')?.cycleTheme();
    if (action === 'reset') p.get('DevToolsPlugin')?.resetToDefaults();
    if (action === 'random') {
      p.get('DevToolsPlugin')?.randomizeThemeNowAndLocale();
      this.engine.viewport.classList.add('tr-theme-pulse');
      setTimeout(() => this.engine.viewport.classList.remove('tr-theme-pulse'), 600);
    }
    this._vibrate('success');
    this._reset(true);
  }

  _isDay(el) {
    return el?.classList?.contains('tr-day') && !el.classList.contains('tr-day--filler');
  }
  _hasMoved(x, y) {
    return Math.hypot(x - this._tracking.startX, y - this._tracking.startY) > 10;
  }

  _vibrate(type) {
    if (!navigator.vibrate) return;
    const patterns = { scrub: HAPTIC_SCRUB_MS, success: HAPTIC_SUCCESS_MS, boundary: [15, 30, 15] };
    navigator.vibrate(patterns[type] || HAPTIC_SCRUB_MS);
  }
}
