import { OdysseyConfig } from '../config/odyssey-config.js';
import { prefersReducedMotion } from './motion.js';
import {
  durationForDistance,
  durationForSteps,
  easeInOutCubic,
} from './scroll-easing.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const SIGN = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

export class SmoothScroll {
  #viewport;
  #step = 0;

  #inertiaTarget = 0;
  #inertiaVelocity = 0;
  #lastFrameTop = 0;
  #inertiaRaf = null;
  #touchDragging = false;

  #animRaf = null;
  #animStart = 0;
  #animFrom = 0;
  #animTo = 0;
  #animDuration = 0;

  #pendingDelta = 0;
  #onArrive = null;
  #onVelocityChange = null;

  constructor(viewport, step) {
    this.#viewport = viewport;
    this.#step = step;
    this.#inertiaTarget = viewport.scrollTop;
    this.#lastFrameTop = viewport.scrollTop;
  }

  setStep(step) {
    if (step > 0) this.#step = step;
  }

  onArrive(callback) { this.#onArrive = callback; return this; }
  onVelocityChange(callback) { this.#onVelocityChange = callback; return this; }

  get velocity() { return this.#inertiaVelocity; }
  get step() { return this.#step; }

  get currentIndex() {
    if (this.#step <= 0) return 0;
    return Math.round(this.#viewport.scrollTop / this.#step);
  }

  maxIndex() {
    if (this.#step <= 0) return 0;
    return Math.floor(this.#viewport.scrollHeight / this.#step) - 1;
  }

  #maxScroll() {
    return Math.max(0, this.#viewport.scrollHeight - this.#viewport.clientHeight);
  }

  #clampIndex(idx) {
    return clamp(idx, 0, this.maxIndex());
  }


  startInertia() {
    if (this.#inertiaRaf !== null) return;
    const tick = () => {
      const current = this.#viewport.scrollTop;

      // A programmatic animation or a native touch drag is currently driving
      // scrollTop. Keep the loop alive and track velocity from the real
      // position (so scroll effects stay live), but never fight the active
      // driver by writing scrollTop ourselves.
      if (this.#animRaf !== null || this.#touchDragging) {
        this.#inertiaVelocity = current - this.#lastFrameTop;
        this.#lastFrameTop = current;
        this.#onVelocityChange?.(this.#inertiaVelocity);
        this.#inertiaRaf = requestAnimationFrame(tick);
        return;
      }

      const diff = this.#inertiaTarget - current;
      if (Math.abs(diff) > 0.5) {
        const stepPx = Math.min(Math.abs(diff), OdysseyConfig.timing.inertiaStepMaxPx);
        this.#viewport.scrollTop = current + SIGN(diff) * stepPx;
        this.#inertiaVelocity = this.#viewport.scrollTop - this.#lastFrameTop;
        this.#lastFrameTop = this.#viewport.scrollTop;
      } else {
        this.#inertiaVelocity *= 0.82;
        if (Math.abs(this.#inertiaVelocity) < 0.5) this.#inertiaVelocity = 0;
      }
      this.#onVelocityChange?.(this.#inertiaVelocity);
      // Nothing is driving scroll and nothing is moving — release the frame
      // until an animation or touch drag wakes us (startInertia is idempotent).
      if (this.#animRaf === null && !this.#touchDragging
        && Math.abs(diff) < 0.5 && Math.abs(this.#inertiaVelocity) < 0.5) {
        this.#inertiaRaf = null;
        return;
      }
      this.#inertiaRaf = requestAnimationFrame(tick);
    };
    this.#inertiaRaf = requestAnimationFrame(tick);
  }

  beginTouchDrag() {
    this.#touchDragging = true;
    this.cancelAnimation();
    this.startInertia();
  }

  endTouchDrag() {
    this.#touchDragging = false;
    const current = this.#viewport.scrollTop;
    this.#inertiaTarget = current;
    this.#lastFrameTop = current;
    this.#inertiaVelocity = 0;
  }

  nudge(deltaY) {
    const max = this.#maxScroll();
    this.#inertiaTarget = clamp(this.#inertiaTarget + deltaY, 0, max);
    this.#inertiaVelocity += deltaY * 0.3;
  }

  syncTo(newTop) {
    this.#inertiaTarget = newTop;
    this.#lastFrameTop = newTop;
    this.#viewport.scrollTop = newTop;
  }

  resetTo(newTop) {
    this.cancelAnimation();
    if (this.#inertiaRaf !== null) {
      cancelAnimationFrame(this.#inertiaRaf);
      this.#inertiaRaf = null;
    }
    this.#touchDragging = false;
    this.#inertiaVelocity = 0;
    this.#inertiaTarget = newTop;
    this.#lastFrameTop = newTop;
    this.#viewport.scrollTop = newTop;
  }

  clampInertia() {
    const max = this.#maxScroll();
    this.#inertiaTarget = clamp(this.#inertiaTarget, 0, max);
  }

  isAnimating() { return this.#animRaf !== null; }

  cancelAnimation() {
    if (this.#animRaf !== null) {
      cancelAnimationFrame(this.#animRaf);
      this.#animRaf = null;
    }
    this.#pendingDelta = 0;
  }

  stepBy(delta, duration) {
    if (this.#step <= 0) return;
    if (delta === 0) return;

    if (this.#animRaf !== null) {
      this.#pendingDelta = Math.sign(this.#pendingDelta + delta) *
        Math.min(Math.abs(this.#pendingDelta) + Math.abs(delta), 3);
      return;
    }

    const targetIdx = this.#clampIndex(this.currentIndex + delta);
    if (targetIdx === this.currentIndex) {
      this.#onArrive?.(this.#viewport.scrollTop);
      return;
    }

    const dur = duration ?? durationForSteps(delta);
    this.#animateToIndex(targetIdx, dur);
  }

  jumpToIndex(idx, duration) {
    if (this.#step <= 0) return;
    const target = this.#clampIndex(idx);
    if (target === this.currentIndex) {
      this.#onArrive?.(this.#viewport.scrollTop);
      return;
    }
    const dist = Math.abs(target - this.currentIndex);
    const dur = duration ?? durationForDistance(dist);
    this.#animateToIndex(target, dur);
  }


  settleToNearest() {
    if (this.#step <= 0) return;
    const snapIdx = this.currentIndex;
    const target = snapIdx * this.#step;
    if (Math.abs(target - this.#viewport.scrollTop) < 0.5) {
      this.#viewport.scrollTop = target;
      this.#onArrive?.(target);
      return;
    }
    this.#animateTo(target, OdysseyConfig.display.snapMs);
  }

  flushPendingDelta() {
    if (this.#pendingDelta === 0) return;
    const delta = this.#pendingDelta;
    this.#pendingDelta = 0;
    this.stepBy(delta, null);
  }




  #animateToIndex(targetIdx, duration) {
    const target = targetIdx * this.#step;
    this.#animateTo(target, duration);
  }

  #animateTo(targetY, duration) {
    this.cancelAnimation();
    if (prefersReducedMotion()) {
      this.#viewport.scrollTop = targetY;
      this.#inertiaTarget = targetY;
      this.#lastFrameTop = targetY;
      this.#inertiaVelocity = 0;
      this.#onArrive?.(targetY);
      return;
    }

    this.startInertia(); // ensure the velocity-tracking loop is awake during the animation

    this.#animStart = performance.now();
    this.#animFrom = this.#viewport.scrollTop;
    this.#animTo = targetY;
    this.#animDuration = duration;

    const animate = (now) => {
      const elapsed = now - this.#animStart;
      const progress = Math.min(elapsed / this.#animDuration, 1);
      const eased = easeInOutCubic(progress);
      const next = this.#animFrom + (this.#animTo - this.#animFrom) * eased;
      this.#viewport.scrollTop = next;

      if (progress < 1) {
        this.#animRaf = requestAnimationFrame(animate);
      } else {
        this.#animRaf = null;
        this.#viewport.scrollTop = this.#animTo;
        this.#inertiaTarget = this.#animTo;
        this.#inertiaVelocity = 0;
        this.#lastFrameTop = this.#animTo;
        this.#onArrive?.(this.#animTo);
        this.flushPendingDelta();
      }
    };
    this.#animRaf = requestAnimationFrame(animate);
  }
}
