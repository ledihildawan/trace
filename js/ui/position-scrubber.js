// Vertical "you are here" minimap: a thin edge bar over the full scroll range
// with a fixed "today" tick and a moving thumb. Pointer-drag or keyboard scrubs.
export class PositionScrubber {
  #viewport;
  #opts;
  #bar;
  #thumb;
  #dragging = false;

  constructor(viewport, opts = {}) {
    this.#viewport = viewport;
    this.#opts = opts;
    this.#build();
    this.#bind();
  }

  // Move the thumb to match the current scroll position. Call on scroll/render.
  update() {
    const max = this.#viewport.scrollHeight - this.#viewport.clientHeight;
    if (max <= 0) return;
    const ratio = Math.max(0, Math.min(1, this.#viewport.scrollTop / max));
    this.#thumb.style.top = `${8 + ratio * 84}%`;
    this.#bar.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  }

  #build() {
    const bar = document.createElement('div');
    bar.className = 'pos-scrubber';
    bar.setAttribute('role', 'slider');
    bar.setAttribute('aria-label', 'Posisi tahun');
    bar.setAttribute('aria-orientation', 'vertical');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', '50');
    bar.setAttribute('tabindex', '0');

    const today = document.createElement('div');
    today.className = 'pos-today';
    today.title = 'Hari ini';
    today.setAttribute('aria-hidden', 'true');
    today.style.top = `${8 + (this.#opts.todayRatio ?? 0.5) * 84}%`;

    const thumb = document.createElement('div');
    thumb.className = 'pos-thumb';
    thumb.setAttribute('aria-hidden', 'true');

    bar.append(today, thumb);
    document.body.append(bar);
    this.#bar = bar;
    this.#thumb = thumb;
  }

  #maxScroll() {
    return Math.max(0, this.#viewport.scrollHeight - this.#viewport.clientHeight);
  }

  #seek(clientY) {
    const rect = this.#bar.getBoundingClientRect();
    const usable = rect.height * 0.84;
    const origin = rect.top + rect.height * 0.08;
    const ratio = Math.max(0, Math.min(1, (clientY - origin) / usable));
    this.#opts.onScrub?.(Math.round(ratio * this.#maxScroll()));
  }

  #bind() {
    const onDown = (e) => {
      this.#dragging = true;
      this.#bar.setPointerCapture?.(e.pointerId);
      this.#opts.onStart?.();
      this.#seek(e.clientY);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (this.#dragging) this.#seek(e.clientY);
    };
    const onUp = (e) => {
      if (!this.#dragging) return;
      this.#dragging = false;
      this.#bar.releasePointerCapture?.(e.pointerId);
      this.#opts.onEnd?.();
      this.#opts.onSettle?.();
    };
    this.#bar.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    this.#bar.addEventListener('keydown', (e) => {
      const step = this.#viewport.clientHeight;
      let delta = null;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') delta = step;
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') delta = -step;
      else if (e.key === 'Home') {
        e.preventDefault(); e.stopPropagation();
        this.#opts.onStart?.(); this.#opts.onScrub?.(0); this.#opts.onEnd?.();
        return;
      } else if (e.key === 'End') {
        e.preventDefault(); e.stopPropagation();
        this.#opts.onStart?.(); this.#opts.onScrub?.(this.#maxScroll()); this.#opts.onEnd?.();
        return;
      } else {
        return; // let other shortcuts (T, M, G, …) bubble through
      }
      e.preventDefault();
      e.stopPropagation();
      this.#opts.onStart?.();
      this.#opts.onScrub?.(Math.max(0, Math.min(this.#maxScroll(), this.#viewport.scrollTop + delta)));
      this.#opts.onEnd?.();
    });
  }
}
