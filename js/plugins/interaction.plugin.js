// TRACE Interaction Plugin
// Version: Stable Mobile-Optimized Standard (ES2024+)

import {
  DOUBLE_TAP_MAX_DELAY_MS,
  HAPTIC_SCRUB_MS,
  HAPTIC_SUCCESS_MS,
  LONG_PRESS_DURATION_MS,
} from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';

export class InteractionPlugin extends TracePlugin {
  #activeEl = null;
  #lastTapTarget = null;
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
    // NATIVE FIX: Disable touch actions to prevent native scrolling from killing pointer events
    Object.assign(this.engine.viewport.style, {
      touchAction: 'none',
      userSelect: 'none',
      webkitUserSelect: 'none',
      webkitTouchCallout: 'none',
    });
  }

  #bindEvents() {
    const options = { passive: false, signal: this.signal };
    const vp = this.engine.viewport;

    // Pointer Events - Unified for touch and stylus
    vp.addEventListener('pointerdown', (e) => this.#onPointerDown(e), options);
    vp.addEventListener('pointermove', (e) => this.#onPointerMove(e), options);
    vp.addEventListener('pointerup', (e) => this.#onPointerUp(e), options);
    vp.addEventListener('pointercancel', () => this.#cleanup(true), options);

    // Mouse specific for Desktop hover
    vp.addEventListener('mouseover', (e) => this.#onMouseOver(e), { passive: true, signal: this.signal });
    window.addEventListener('keydown', (e) => this.#onKeyDown(e), { passive: true, signal: this.signal });
  }

  // --- INTERACTION HANDLERS ---

  #onPointerDown(e) {
    if (e.pointerType === 'mouse') return;

    // NATIVE: Lock event to original target to ensure pointerup is accurate
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
    const el = target?.closest('.tr-day');

    this.#handleHapticScrub(el, true);

    // Initialize Long Press with specific element reference
    this.#setTimer('longPress', () => this.#onLongPress(el), LONG_PRESS_DURATION_MS);
  }

  #onPointerMove(e) {
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

    // SMALL SCREEN FIX: Higher movement threshold (20px) to prevent jitter from canceling actions
    if (this.#hasMoved(e.clientX, e.clientY, 20)) {
      this.#clearTimer('longPress');
    }

    const target = document.elementFromPoint(e.clientX, e.clientY);
    this.#handleHapticScrub(target?.closest('.tr-day'), false);
  }

  #onPointerUp(e) {
    if (e.pointerType === 'mouse') return;
    this.#isTouching = false;
    this.#clearTimer('longPress');

    const now = performance.now();
    const currentTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.tr-day');

    // NATIVE VALIDATION: Abort if release is outside grid or on a different cell
    if (!currentTarget) {
      this.#lastTapTarget = null;
      this.#cleanup(true);
      return;
    }

    const duration = now - this.#track.startTime;
    const deltaY = e.clientY - this.#track.startY;

    // 1. Vertical Swipe (Gesture)
    if (Math.abs(deltaY) > 80 && duration < 250) {
      this.#onSwipeVertical();
      this.#lastTapTarget = null;
      return;
    }

    // 2. Double Tap vs Single Tap (Object Identity Validation)
    if (now - this.#lastTapTime < DOUBLE_TAP_MAX_DELAY_MS && this.#lastTapTarget === currentTarget) {
      this.#onDoubleTap();
      this.#lastTapTime = 0;
      this.#lastTapTarget = null;
    } else {
      this.#lastTapTime = now;
      this.#lastTapTarget = currentTarget;
      this.#onSingleTap();
    }
  }

  // --- DISCRETE ACTIONS ---

  #onSingleTap() {
    this.#scheduleLingerTooltip();
  }

  #onDoubleTap() {
    this.#executeAction('theme');
  }

  #onLongPress(el) {
    // Extra validation: only reset if finger hasn't strayed from the origin element
    if (this.#isTouching && this.#activeEl === el) {
      this.#executeAction('reset');
    }
  }

  #onSwipeVertical() {
    this.#executeAction('random');
  }

  // --- LOGIC HELPERS ---

  #handleHapticScrub(el, isPressing) {
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

  #scheduleLingerTooltip() {
    this.#clearTimer('linger');
    // MOBILE FIX: Increased minimum linger time (1500ms) for legibility on small screens
    const lingerTime = Math.max(1500, Math.min(3500, 3000 - this.#track.velocity * 500));
    this.#setTimer('linger', () => this.#cleanup(true), lingerTime);
    this.tooltip?.scheduleHide(lingerTime);
  }

  #executeAction(action) {
    const p = this.engine.plugins;
    if (action === 'theme') p.get('ThemePlugin')?.cycleTheme();
    if (action === 'reset') p.get('DevToolsPlugin')?.resetToDefaults();
    if (action === 'random') {
      p.get('DevToolsPlugin')?.randomizeThemeNowAndLocale();
      this.#animatePulse();
    }
    this.#vibrate('success');
    this.#cleanup(false); // Do not cleanup immediately to allow visual feedback
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

  // --- UTILITIES ---

  #clearVisuals() {
    this.#activeEl?.classList.remove('tr-is-touch-active', 'tr-is-pressing');
  }

  #hasMoved(x, y, threshold = 12) {
    return Math.hypot(x - this.#track.startX, y - this.#track.startY) > threshold;
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

  #onMouseOver(e) {
    if (this.#isTouching || !window.matchMedia('(hover: hover)').matches) return;
    const target = e.target.closest('.tr-day');
    if (target && !target.classList.contains('tr-day--filler')) {
      this.tooltip?.showTooltipForElement(target, false);
    }
  }

  #onKeyDown(e) {
    if (this.engine.viewport?.contains(e.target)) return;
    const actions = { c: 'theme', x: 'reset', r: 'random' };
    const action = actions[e.key.toLowerCase()];
    if (action) this.#executeAction(action);
  }
}
