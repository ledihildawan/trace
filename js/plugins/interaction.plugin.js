// TRACE Interaction Plugin
// Version: Production-Grade Seamless Interaction (ES2024+)

import {
  DOUBLE_TAP_MAX_DELAY_MS,
  HAPTIC_SCRUB_MS,
  HAPTIC_SUCCESS_MS,
  LONG_PRESS_DURATION_MS,
} from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';

export class InteractionPlugin extends TracePlugin {
  #activeEl = null;
  #isTouching = false;
  #lastTapTime = 0;
  #timers = new Map();
  #track = { startX: 0, startY: 0, lastX: 0, lastY: 0, startTime: 0, lastTime: 0, velocity: 0 };

  init(engine) {
    super.init(engine);
    this.tooltip = this.engine.plugins.get('TooltipPlugin');

    this.#setupViewport();
    this.#bindEvents();
  }

  #setupViewport() {
    Object.assign(this.engine.viewport.style, {
      touchAction: 'pan-y',
      userSelect: 'none',
      webkitUserSelect: 'none',
      webkitTouchCallout: 'none',
    });
  }

  #bindEvents() {
    const options = { passive: true, signal: this.signal };
    const vp = this.engine.viewport;

    vp.addEventListener('pointerdown', (e) => this.#handleDown(e), { passive: false, signal: this.signal });
    vp.addEventListener('pointermove', (e) => this.#handleMove(e), options);
    vp.addEventListener('pointerup', (e) => this.#handleUp(e), options);
    vp.addEventListener('pointercancel', () => this.#cleanup(true), options);
    vp.addEventListener('mouseover', (e) => this.#handleHover(e), options);
    window.addEventListener('keydown', (e) => this.#handleKey(e), options);
  }

  #handleDown(e) {
    if (e.pointerType === 'mouse') return;
    e.target.setPointerCapture(e.pointerId);

    this.#cleanup(true);
    this.#isTouching = true;

    const now = performance.now();
    Object.assign(this.#track, {
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      startTime: now,
      lastTime: now,
      velocity: 0,
    });

    const target = document.elementFromPoint(e.clientX, e.clientY);
    this.#processHit(target, true);

    this.#setTimer(
      'longPress',
      () => {
        if (this.#isTouching && !this.#hasMoved(e.clientX, e.clientY)) {
          this.#execute('reset');
        }
      },
      LONG_PRESS_DURATION_MS
    );
  }

  #handleMove(e) {
    if (!this.#isTouching || e.pointerType === 'mouse') return;

    const now = performance.now();
    const dt = now - this.#track.lastTime;

    if (dt > 10) {
      const dist = Math.hypot(e.clientX - this.#track.lastX, e.clientY - this.#track.lastY);
      this.#track.velocity = dist / dt;
      this.#track.lastX = e.clientX;
      this.#track.lastY = e.clientY;
      this.#track.lastTime = now;
    }

    if (this.#hasMoved(e.clientX, e.clientY)) this.#clearTimer('longPress');

    const target = document.elementFromPoint(e.clientX, e.clientY);
    this.#processHit(target, false);
  }

  #handleUp(e) {
    if (e.pointerType === 'mouse') return;
    this.#isTouching = false;
    this.#clearTimer('longPress');

    const duration = performance.now() - this.#track.startTime;
    const deltaY = e.clientY - this.#track.startY;

    if (Math.abs(deltaY) > 80 && duration < 250) {
      this.#execute('random');
    } else {
      const now = performance.now();
      if (now - this.#lastTapTime < DOUBLE_TAP_MAX_DELAY_MS) {
        this.#execute('theme');
        this.#lastTapTime = 0;
      } else {
        this.#lastTapTime = now;
        this.#scheduleLinger();
      }
    }
  }

  #processHit(target, isPressing) {
    const el = target?.closest('.tr-day');
    if (!el || el.classList.contains('tr-day--filler')) return;

    if (this.#activeEl !== el) {
      this.#clearVisuals();
      this.#activeEl = el;
      el.classList.add('tr-is-touch-active');
      if (isPressing) el.classList.add('tr-is-pressing');
      this.tooltip?.showTooltipForElement(el, true);

      const isBoundary = el.dataset.trDate?.includes(' 1,') || el.classList.contains('tr-day--monday');
      this.#vibrate(isBoundary ? 'boundary' : 'scrub');
    }
  }

  #scheduleLinger() {
    this.#clearTimer('linger');
    const lingerTime = Math.max(1200, Math.min(3000, 2500 - this.#track.velocity * 500));
    this.#setTimer('linger', () => this.#cleanup(true), lingerTime);
    this.tooltip?.scheduleHide(lingerTime);
  }

  #execute(action) {
    const p = this.engine.plugins;
    if (action === 'theme') p.get('ThemePlugin')?.cycleTheme();
    if (action === 'reset') p.get('DevToolsPlugin')?.resetToDefaults();
    if (action === 'random') {
      p.get('DevToolsPlugin')?.randomizeThemeNowAndLocale();
      this.#animatePulse();
    }
    this.#vibrate('success');
    this.#cleanup(true);
  }

  #animatePulse() {
    const vp = this.engine.viewport;
    vp.classList.remove('tr-theme-pulse');
    void vp.offsetWidth;
    vp.classList.add('tr-theme-pulse');
    vp.addEventListener('animationend', () => vp.classList.remove('tr-theme-pulse'), { once: true });
  }

  #cleanup(immediate) {
    this.#clearTimer('longPress');
    if (immediate) {
      this.#clearTimer('linger');
      this.#clearVisuals();
      this.#activeEl = null;
      this.tooltip?.hideTooltip();
    }
  }

  #clearVisuals() {
    this.#activeEl?.classList.remove('tr-is-touch-active', 'tr-is-pressing');
  }
  #hasMoved(x, y) {
    return Math.hypot(x - this.#track.startX, y - this.#track.startY) > 12;
  }
  #setTimer(k, f, ms) {
    this.#clearTimer(k);
    this.#timers.set(k, setTimeout(f, ms));
  }
  #clearTimer(k) {
    clearTimeout(this.#timers.get(k));
    this.#timers.delete(k);
  }

  #vibrate(t) {
    if (!navigator.vibrate) return;
    const p = { scrub: HAPTIC_SCRUB_MS, success: HAPTIC_SUCCESS_MS, boundary: [10, 25, 10] };
    navigator.vibrate(p[t] || HAPTIC_SCRUB_MS);
  }

  #handleHover(e) {
    if (this.#isTouching || !window.matchMedia('(hover: hover)').matches) return;
    const target = e.target.closest('.tr-day');
    if (target && !target.classList.contains('tr-day--filler')) {
      this.tooltip?.showTooltipForElement(target, false);
    }
  }

  #handleKey(e) {
    if (this.engine.viewport?.contains(e.target)) return;
    const actions = { c: 'theme', x: 'reset', r: 'random' };
    const action = actions[e.key.toLowerCase()];
    if (action) this.#execute(action);
  }
}
