// TRACE Interaction Plugin
// REWRITE: State Machine Driven Interaction (Scrub vs Scroll vs Tap)

import {
  DOUBLE_TAP_MAX_DELAY_MS,
  HAPTIC_SCRUB_MS,
  HAPTIC_SUCCESS_MS,
  LONG_PRESS_DURATION_MS,
} from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';

// --- CONFIGURATION ---
const LINGER_DURATION = 1500; // Waktu tooltip & highlight bertahan setelah jari diangkat
const GESTURE_LOCK_THRESHOLD = 8; // Pixel gerakan sebelum menentukan Scroll vs Scrub

export class InteractionPlugin extends TracePlugin {
  constructor() {
    super('InteractionPlugin');

    // STATE MACHINE
    // States: 'IDLE' | 'MEASURING' | 'SCRUBBING' | 'SCROLLING' | 'COOLDOWN'
    this._state = 'IDLE';

    // Tracking Data
    this._startX = 0;
    this._startY = 0;
    this._activePointerId = null;
    this._lastTapTime = 0;

    // Element References
    this._activeElement = null; // Element yang sedang di-highlight

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

    // Detect Hover
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

    // CSS: Izinkan browser menangani scroll vertikal, kita handle horizontal
    this.engine.viewport.style.touchAction = 'pan-y';
    // Mencegah menu konteks klik kanan pada mobile saat tahan lama
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
    // console.log(`State Change: ${this._state} -> ${newState}`);
    this._state = newState;
  }

  _clearTimers() {
    if (this._timers.longPress) clearTimeout(this._timers.longPress);
    if (this._timers.linger) clearTimeout(this._timers.linger);
    this._timers.longPress = null;
    this._timers.linger = null;
  }

  _resetVisuals(immediate = false) {
    // Fungsi ini menghapus semua highlight visual
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
      // Hapus nanti (saat cooldown selesai)
      this._timers.linger = setTimeout(clear, LINGER_DURATION);
    }
  }

  // --- POINTER EVENTS (Core Logic) ---

  setupPointerEvents() {
    const vp = this.engine.viewport;

    // 1. POINTER DOWN: Mulai Mengukur
    vp.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse') return; // Mouse ditangani terpisah via hover

        // Reset total
        this._clearTimers();
        this._resetVisuals(true); // Hapus sisa highlight lama instan
        this.tooltipPlugin?.cancelHide(); // Jangan sembunyikan tooltip jika ada

        this._activePointerId = e.pointerId;
        this._startX = e.clientX;
        this._startY = e.clientY;

        // Hit Test Awal
        const target = document.elementFromPoint(e.clientX, e.clientY);

        if (this.isValidDay(target)) {
          // OPTIMISTIC UI: Langsung nyalakan highlight & tooltip
          // Ini menjawab komplain "tidak ada perubahan saat disentuh"
          this._setActiveElement(target, 'press');
        }

        this._setState('MEASURING');

        // Long Press Timer
        this._timers.longPress = setTimeout(() => {
          if (this._state === 'MEASURING' || this._state === 'SCRUBBING') {
            this._handleLongPress();
          }
        }, LONG_PRESS_DURATION_MS);
      },
      { passive: true, signal: this.signal }
    );

    // 2. POINTER MOVE: Tentukan Niat (Scroll vs Scrub)
    vp.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'mouse' || this._activePointerId !== e.pointerId) return;

        const x = e.clientX;
        const y = e.clientY;

        // Logic 1: Mode MEASURING (Belum tahu user mau ngapain)
        if (this._state === 'MEASURING') {
          const dx = Math.abs(x - this._startX);
          const dy = Math.abs(y - this._startY);
          const dist = Math.hypot(dx, dy);

          if (dist > GESTURE_LOCK_THRESHOLD) {
            // User sudah bergerak cukup jauh, tentukan arah
            if (dx > dy) {
              // Gerak Horizontal -> SCRUBBING
              this._setState('SCRUBBING');
              vp.setPointerCapture(e.pointerId); // Kunci pointer agar tidak scroll
              this._updateScrub(x, y);
            } else {
              // Gerak Vertikal -> SCROLLING
              this._setState('SCROLLING');
              this._cancelInteraction(); // Matikan semua highlight
              // Jangan capture pointer, biarkan browser scroll native
            }
          }
        }

        // Logic 2: Mode SCRUBBING (Sudah terkunci horizontal)
        else if (this._state === 'SCRUBBING') {
          // Gunakan RAF untuk performa tinggi
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

    // 3. POINTER UP: Selesai
    vp.addEventListener(
      'pointerup',
      (e) => {
        if (e.pointerType === 'mouse' || this._activePointerId !== e.pointerId) return;

        // Jika Tap Cepat (masih MEASURING)
        if (this._state === 'MEASURING') {
          this._handleTap();
        }

        // Mulai fase pendinginan (Linger)
        // Ini menjawab "cepat sekali hilangnya"
        this._startLinger();

        if (vp.hasPointerCapture(e.pointerId)) {
          vp.releasePointerCapture(e.pointerId);
        }

        this._activePointerId = null;
        this._setState('IDLE');
      },
      { passive: true, signal: this.signal }
    );

    // 4. POINTER CANCEL (Browser mengambil alih, misal scroll)
    vp.addEventListener(
      'pointercancel',
      () => {
        this._cancelInteraction();
        this._setState('IDLE');
      },
      { passive: true, signal: this.signal }
    );

    // --- HOVER DELEGATE (Untuk Mouse Desktop) ---
    this.setupHoverDelegate();
  }

  // --- ACTIONS & LOGIC ---

  _setActiveElement(el, type = 'drag') {
    if (this._activeElement === el) return; // Tidak ada perubahan

    // Bersihkan elemen sebelumnya
    if (this._activeElement) {
      this._activeElement.classList.remove('tr-is-touch-active');
      this._activeElement.classList.remove('tr-is-dragging');
      this._activeElement.classList.remove('tr-is-pressing');
    }

    // Set elemen baru
    this._activeElement = el;
    el.classList.add('tr-is-touch-active'); // Kelas utama untuk styling

    if (type === 'press') el.classList.add('tr-is-pressing');
    if (type === 'drag') el.classList.add('tr-is-dragging');

    // Tampilkan Tooltip (Magnetic Snap)
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
    if (now - this._lastTapTime < DOUBLE_TAP_MAX_DELAY_MS) {
      // DOUBLE TAP
      this.engine.plugins.get('ThemePlugin')?.cycleTheme();
      this.triggerHaptic('success');
      this._cancelInteraction(); // Sembunyikan tooltip segera pada double tap
    } else {
      // SINGLE TAP
      // Tidak perlu melakukan apa-apa karena tooltip sudah muncul saat PointerDown
    }
    this._lastTapTime = now;
  }

  _handleLongPress() {
    this.triggerHaptic('success');
    this.engine.plugins.get('DevToolsPlugin')?.resetToDefaults();
    this._cancelInteraction(); // Reset UI setelah aksi sukses
  }

  _startLinger() {
    // SINKRONISASI: Tooltip dan Visual Highlight hilang bersamaan
    if (this.tooltipPlugin) {
      this.tooltipPlugin.scheduleHide(LINGER_DURATION);
    }
    // Hapus kelas visual setelah durasi yang sama
    this._resetVisuals(false); // false = gunakan delay
  }

  _cancelInteraction() {
    this._clearTimers();
    this._resetVisuals(true); // true = hapus segera
    this.tooltipPlugin?.hideTooltip();
  }

  // --- CONTROLS LAIN (Keyboard/Mouse) ---

  setupHoverDelegate() {
    // Mouse Interaction (Desktop)
    this.engine.viewport.addEventListener(
      'mouseover',
      (e) => {
        if (!this.hasHover) return; // Abaikan di touch device
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
