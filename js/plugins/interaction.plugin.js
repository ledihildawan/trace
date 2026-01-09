// TRACE Interaction Plugin
// FIXED: Increased Jitter Tolerance (Anti-Flicker on Quick Taps)

import {
  DOUBLE_TAP_MAX_DELAY_MS,
  HAPTIC_SCRUB_MS,
  HAPTIC_SUCCESS_MS,
  LONG_PRESS_DURATION_MS,
} from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';

// --- CONFIGURATION ---
const LINGER_DURATION = 1500;
// UPDATE: Dinaikkan dari 8 ke 16 agar sentuhan yang sedikit goyang tidak dianggap scroll
const GESTURE_LOCK_THRESHOLD = 16;

export class InteractionPlugin extends TracePlugin {
  constructor() {
    super('InteractionPlugin');

    this._state = 'IDLE'; // 'IDLE' | 'MEASURING' | 'SCRUBBING' | 'SCROLLING'

    // Tracking Data
    this._startX = 0;
    this._startY = 0;
    this._activePointerId = null;
    this._lastTapTime = 0;

    // Element References
    this._activeElement = null;

    // Timers
    this._timers = {
      longPress: null,
      linger: null,
    };

    this._rafPending = false;
    this._pendingX = 0;
    this._pendingY = 0;

    this._lastHaptic = 0;
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
    this.setupMouseWheel();
  }

  isValidDay(el) {
    return el?.classList.contains('tr-day') && !el.classList.contains('tr-day--filler');
  }

  // --- STATE MANAGEMENT ---

  _setState(newState) {
    this._state = newState;
  }

  _clearTimers() {
    if (this._timers.longPress) clearTimeout(this._timers.longPress);
    if (this._timers.linger) clearTimeout(this._timers.linger);
    this._timers.longPress = null;
    this._timers.linger = null;
  }

  _resetVisuals(immediate = false) {
    const clear = () => {
      if (this._activeElement) {
        this._activeElement.classList.remove('tr-is-touch-active');
        this._activeElement.classList.remove('tr-is-dragging');
        this._activeElement.classList.remove('tr-is-pressing');
        this._activeElement = null;
      }
    };

    if (immediate) {
      clear();
    } else {
      this._timers.linger = setTimeout(clear, LINGER_DURATION);
    }
  }

  // --- POINTER EVENTS ---

  setupPointerEvents() {
    const vp = this.engine.viewport;

    // 1. POINTER DOWN
    vp.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse') return;

        this._clearTimers();
        this._resetVisuals(true);
        this.tooltipPlugin?.cancelHide();

        this._activePointerId = e.pointerId;
        this._startX = e.clientX;
        this._startY = e.clientY;

        const target = document.elementFromPoint(e.clientX, e.clientY);

        if (this.isValidDay(target)) {
          // Visual feedback INSTAN saat disentuh
          this._setActiveElement(target, 'press');
        }

        this._setState('MEASURING');

        this._timers.longPress = setTimeout(() => {
          if (this._state === 'MEASURING' || this._state === 'SCRUBBING') {
            this._handleLongPress();
          }
        }, LONG_PRESS_DURATION_MS);
      },
      { passive: true, signal: this.signal }
    );

    // 2. POINTER MOVE
    vp.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'mouse' || this._activePointerId !== e.pointerId) return;

        const x = e.clientX;
        const y = e.clientY;

        if (this._state === 'MEASURING') {
          const dx = Math.abs(x - this._startX);
          const dy = Math.abs(y - this._startY);
          const dist = Math.hypot(dx, dy);

          // Hanya kunci gesture jika gerakan SUDAH CUKUP BESAR (> 16px)
          if (dist > GESTURE_LOCK_THRESHOLD) {
            if (dx > dy) {
              // Gerak Horizontal -> LOCK SCRUB
              this._setState('SCRUBBING');
              vp.setPointerCapture(e.pointerId);
              this._updateScrub(x, y);
            } else {
              // Gerak Vertikal -> SCROLL
              // Kita batalkan interaksi highlight karena user mau scroll
              this._setState('SCROLLING');
              this._cancelInteraction();
            }
          }
          // Jika dist < threshold, kita biarkan status MEASURING.
          // Highlight TETAP NYALA (tr-is-touch-active aman).
        } else if (this._state === 'SCRUBBING') {
          this._pendingX = x;
          this._pendingY = y;
          if (!this._rafPending) {
            this._rafPending = true;
            requestAnimationFrame(() => {
              this._rafPending = false;
              this._updateScrub(this._pendingX, this._pendingY);
            });
          }
        }
      },
      { passive: true, signal: this.signal }
    );

    // 3. POINTER UP
    vp.addEventListener(
      'pointerup',
      (e) => {
        if (e.pointerType === 'mouse' || this._activePointerId !== e.pointerId) return;

        // Jika masih MEASURING (artinya gerakan < threshold), anggap sebagai TAP
        if (this._state === 'MEASURING') {
          this._handleTap();
        }

        this._startLinger(); // Mulai timer hilang perlahan

        if (vp.hasPointerCapture(e.pointerId)) {
          vp.releasePointerCapture(e.pointerId);
        }

        this._activePointerId = null;
        this._setState('IDLE');
      },
      { passive: true, signal: this.signal }
    );

    // 4. POINTER CANCEL
    vp.addEventListener(
      'pointercancel',
      () => {
        this._cancelInteraction();
        this._setState('IDLE');
      },
      { passive: true, signal: this.signal }
    );

    this.setupHoverDelegate();
  }

  // --- ACTIONS ---

  _setActiveElement(el, type = 'drag') {
    if (this._activeElement === el) return;

    if (this._activeElement) {
      this._activeElement.classList.remove('tr-is-touch-active');
      this._activeElement.classList.remove('tr-is-dragging');
      this._activeElement.classList.remove('tr-is-pressing');
    }

    this._activeElement = el;
    el.classList.add('tr-is-touch-active');

    if (type === 'press') el.classList.add('tr-is-pressing');
    if (type === 'drag') el.classList.add('tr-is-dragging');

    if (this.tooltipPlugin) {
      this.tooltipPlugin.showTooltipForElement(el, true);
    }
  }

  _updateScrub(x, y) {
    const target = document.elementFromPoint(x, y);
    if (this.isValidDay(target)) {
      if (this._activeElement !== target) {
        this._setActiveElement(target, 'drag');
        this.triggerHaptic('scrub');
      }
    }
  }

  _handleTap() {
    const now = performance.now();
    // Deteksi Double Tap
    if (now - this._lastTapTime < DOUBLE_TAP_MAX_DELAY_MS) {
      this.engine.plugins.get('ThemePlugin')?.cycleTheme();
      this.triggerHaptic('success');
      this._cancelInteraction(); // Double tap sukses -> reset UI
    }
    // Single tap tidak perlu aksi khusus karena highlight sudah nyala di PointerDown
    this._lastTapTime = now;
  }

  _handleLongPress() {
    this.triggerHaptic('success');
    this.engine.plugins.get('DevToolsPlugin')?.resetToDefaults();
    this._cancelInteraction();
  }

  _startLinger() {
    if (this.tooltipPlugin) {
      this.tooltipPlugin.scheduleHide(LINGER_DURATION);
    }
    this._resetVisuals(false); // Delay cleanup
  }

  _cancelInteraction() {
    this._clearTimers();
    this._resetVisuals(true); // Immediate cleanup
    this.tooltipPlugin?.hideTooltip();
  }

  // --- DESKTOP CONTROLS ---

  setupHoverDelegate() {
    this.engine.viewport.addEventListener(
      'mouseover',
      (e) => {
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
        if (!this.hasHover) return;
        if (!this.engine.viewport.contains(e.relatedTarget)) {
          this.tooltipPlugin?.hideTooltip();
        }
      },
      { signal: this.signal }
    );
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

  setupMouseWheel() {
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

  triggerHaptic(type) {
    if (!navigator.vibrate) return;
    const now = performance.now();
    const minGap = type === 'scrub' ? 60 : 200;
    if (now - this._lastHaptic < minGap) return;
    this._lastHaptic = now;
    navigator.vibrate(type === 'scrub' ? HAPTIC_SCRUB_MS : HAPTIC_SUCCESS_MS);
  }
}
