// TRACE Interaction Plugin
// UX UPDATE: Synchronized Visual & Tooltip Linger Duration

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

    // State Flags
    this._rafPending = false;
    this._isTouchActive = false;
    this._isScrubbing = false;
    this._scrollLocked = false;

    // Coordinates
    this._pendingX = 0;
    this._pendingY = 0;
    this.startX = 0;
    this.startY = 0;

    // Element References
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

    this.setupTouchGestures();
    this.setupMouseControls();
    this.setupKeyboardControls();
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

    // Clear visuals immediately
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
          target.classList.add('tr-is-touch-active');
          this._activeDayEl = target;

          this.triggerHaptic('scrub');
        }

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

      this._resetState(); // Hard reset previous state
      this._isTouchActive = true;
      this.startX = e.clientX;
      this.startY = e.clientY;

      const target = document.elementFromPoint(e.clientX, e.clientY);

      // Visual Feedback Instan
      if (this.isValidDay(target)) {
        this._pressedEl = target;
        this._activeDayEl = target;

        target.classList.add('tr-is-pressing');
        target.classList.add('tr-is-touch-active');

        if (this.tooltipPlugin) this.tooltipPlugin.showTooltipForElement(target, true);
      }

      this._timers.longPress = setTimeout(() => {
        if (this._isScrubbing || this._scrollLocked) return;

        this.triggerHaptic('success');
        this.engine.plugins.get('DevToolsPlugin')?.resetToDefaults();
        if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
        this._resetState();
      }, LONG_PRESS_DURATION_MS);
    };

    const onPointerMove = (e) => {
      if (e.pointerType === 'mouse' || !this._isTouchActive || this._scrollLocked) return;

      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;

      if (this._isScrubbing) {
        requestUpdate(e.clientX, e.clientY);
        return;
      }

      const moveDist = Math.hypot(dx, dy);
      const threshold = 6;

      if (moveDist > threshold) {
        if (this._timers.longPress) clearTimeout(this._timers.longPress);

        const isHorizontal = Math.abs(dx) > Math.abs(dy);

        if (isHorizontal) {
          // SCRUBBING
          this._isScrubbing = true;
          this.engine.viewport.setPointerCapture(e.pointerId);

          if (this._pressedEl) {
            this._pressedEl.classList.remove('tr-is-pressing');
            this._pressedEl = null;
          }
          requestUpdate(e.clientX, e.clientY);
        } else {
          // SCROLLING
          this._scrollLocked = true;
          this._resetState();
          if (this.tooltipPlugin) this.tooltipPlugin.hideTooltip();
        }
      }
    };

    const onPointerUp = (e) => {
      if (e.pointerType === 'mouse') return;

      // Tap Logic
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
        }
      }

      if (this.engine.viewport.hasPointerCapture(e.pointerId)) {
        this.engine.viewport.releasePointerCapture(e.pointerId);
      }

      // PERBAIKAN DI SINI: Sinkronisasi waktu cleanup
      // Samakan durasi highlight visual dengan durasi tooltip
      const lingerDuration = this._isScrubbing ? 1200 : 2000;

      if (this.tooltipPlugin) {
        this.tooltipPlugin.scheduleHide(lingerDuration);
      }

      // Jangan hapus visual (tr-is-touch-active) terlalu cepat!
      // Kita set waktunya sama dengan tooltip linger (1200ms/2000ms)
      // Jika user tap tempat lain, _resetState() akan dipanggil otomatis di onPointerDown,
      // jadi aman untuk menahannya lama.
      this._timers.cleanup = setTimeout(() => {
        this._resetState();
      }, lingerDuration);

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
    this.engine.viewport.addEventListener(
      'mouseover',
      (e) => {
        if (this._isTouchActive) return;
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
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.engine.viewport && this.engine.viewport.contains(e.target)) return;
        const key = e.key.toLowerCase();
        if (key === ' ' && !e.ctrlKey && !e.metaKey) {
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

  destroy() {
    this._resetState();
    super.destroy();
  }
}
