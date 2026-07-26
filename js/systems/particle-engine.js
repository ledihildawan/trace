import { OdysseyConfig } from '../config/odyssey-config.js';
import { prefersReducedMotion } from '../core/motion.js';
import { parseColorString } from '../core/color.js';
import {
  GL_CONTEXT_ATTRS,
  ParticlePool,
  computeCapacity,
  createParticleProgram,
  renderFrame,
} from './particle-core.js';

function isLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

// Theme colors change only when data-theme flips, so cache the parsed values.
class ThemeColorProvider {
  #cache = new Map();

  clear() { this.#cache.clear(); }

  parse(variableName) {
    const hit = this.#cache.get(variableName);
    if (hit) return hit;
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(variableName).trim();
    const rgb = parseColorString(raw, isLightTheme());
    this.#cache.set(variableName, rgb);
    return rgb;
  }
}

export class ParticleEngine {
  #canvas;
  #colors = new ThemeColorProvider();
  #dpr;
  #lastLight = false;
  #active = false;

  // Worker (off-main-thread) path
  #worker = null;

  // Main-thread fallback path
  #gl = null;
  #program = null;
  #pool = null;
  #raf = null;

  constructor() {
    if (prefersReducedMotion()) return; // honor reduced motion: no particles

    this.#dpr = Math.min(window.devicePixelRatio || 1, OdysseyConfig.particles.dprCap);
    this.#canvas = document.createElement('canvas');
    this.#lastLight = isLightTheme();
    this.#installCanvas();

    if (this.#tryWorker()) {
      this.#active = true;
      return; // worker owns rendering from here
    }
    this.#active = this.#initMainThread();
    if (!this.#active) this.#canvas.remove();
  }

  #installCanvas() {
    Object.assign(this.#canvas.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2',
      pointerEvents: 'none',
      mixBlendMode: this.#blendMode(),
    });
    this.#canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.#canvas);
  }

  #blendMode() {
    return this.#lastLight
      ? OdysseyConfig.particles.blendModeLight
      : OdysseyConfig.particles.blendModeDark;
  }

  #capacity() {
    return computeCapacity(window.innerWidth, window.innerHeight);
  }

  // Move rendering to a Web Worker via OffscreenCanvas. Returns true if the
  // worker took over; false means the caller should fall back to main-thread GL.
  #tryWorker() {
    if (typeof OffscreenCanvas === 'undefined') return false;
    if (typeof Worker === 'undefined') return false;
    if (typeof this.#canvas.transferControlToOffscreen !== 'function') return false;

    let worker;
    try {
      worker = new Worker(new URL('./particle-worker.js', import.meta.url), { type: 'module' });
    } catch {
      return false;
    }

    let offscreen;
    try {
      offscreen = this.#canvas.transferControlToOffscreen();
    } catch {
      worker.terminate();
      return false;
    }

    this.#worker = worker;
    worker.onerror = () => {
      // The canvas control is already transferred, so we cannot fall back to
      // main-thread GL here — just stop talking to the dead worker.
      console.warn('[ParticleEngine] worker error — particle rendering disabled');
      this.#worker = null;
      this.#active = false;
    };
    worker.postMessage(
      {
        type: 'init',
        canvas: offscreen,
        width: window.innerWidth * this.#dpr,
        height: window.innerHeight * this.#dpr,
        dpr: this.#dpr,
        capacity: this.#capacity(),
        light: this.#lastLight,
      },
      [offscreen]
    );

    // CSS mixBlendMode lives on the main-thread element; the worker only owns GL.
    // Watch data-theme to update both the CSS blend and the worker's GL blendFunc.
    const themeObserver = new MutationObserver(() => {
      if (!this.#syncTheme()) return;
      this.#worker?.postMessage({ type: 'theme', light: this.#lastLight });
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      this.#worker?.postMessage({ type: 'visibility', hidden: document.hidden });
    });
    return true;
  }

  // Fallback: render on the main thread when OffscreenCanvas/Worker are absent.
  #initMainThread() {
    this.#gl = this.#canvas.getContext('webgl', GL_CONTEXT_ATTRS);
    if (!this.#gl) return false;

    this.#program = createParticleProgram(this.#gl);
    if (!this.#program) {
      this.#gl = null;
      return false;
    }

    this.#pool = new ParticlePool(this.#capacity(), this.#dpr);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.#sleep();
      else this.#wake();
    });
    return true;
  }

  // Returns true when the theme actually flipped.
  #syncTheme() {
    const light = isLightTheme();
    if (light === this.#lastLight) return false;
    this.#lastLight = light;
    this.#colors.clear();
    this.#canvas.style.mixBlendMode = this.#blendMode();
    return true;
  }

  resize() {
    if (!this.#active) return;
    const w = window.innerWidth * this.#dpr;
    const h = window.innerHeight * this.#dpr;
    if (this.#worker) {
      this.#worker.postMessage({ type: 'resize', width: w, height: h });
      return;
    }
    this.#canvas.width = w;
    this.#canvas.height = h;
    this.#gl?.viewport(0, 0, w, h);
  }

  spawn(x, y, isExhaust = false) {
    if (!this.#active) return;
    const primary = this.#colors.parse('--ion-primary');
    const secondary = this.#colors.parse('--ion-secondary');
    if (this.#worker) {
      this.#worker.postMessage({ type: 'spawn', x, y, isExhaust, primary, secondary });
      return;
    }
    this.#pool.spawn(x, y, isExhaust, primary, secondary, this.#lastLight);
    this.#wake();
  }

  #loop = () => {
    this.#syncTheme();
    const alive = renderFrame(
      this.#gl, this.#program, this.#pool,
      this.#lastLight, this.#canvas.width, this.#canvas.height
    );
    // Drained — the clear already wiped the last frame, so idle until the
    // next spawn() wakes the loop.
    this.#raf = alive ? requestAnimationFrame(this.#loop) : null;
  };

  #wake() {
    if (this.#raf === null && this.#gl) this.#raf = requestAnimationFrame(this.#loop);
  }

  #sleep() {
    if (this.#raf !== null) {
      cancelAnimationFrame(this.#raf);
      this.#raf = null;
    }
  }
}
