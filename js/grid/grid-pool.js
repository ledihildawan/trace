import { OdysseyConfig } from '../config/odyssey-config.js';

export class GridPool {
  #pool = [];
  #factory;

  constructor(factory) {
    this.#factory = factory;
  }

  acquire(year, yPos) {
    const reused = this.#pool.pop();
    if (reused) {
      reused.style.display = '';
      reused.style.top = `${yPos}px`;
      reused.dataset.year = year;
      reused.dataset.pooled = 'false';
      reused.dataset.detailed = 'false';
      reused.classList.remove(
        OdysseyConfig.classes.active,
        OdysseyConfig.classes.isScrolling
      );
      // #drawYear always rebuilds the grid-container from scratch, so a reused
      // block must start empty (matching a fresh skeleton) — otherwise stale
      // containers and watermarks accumulate on every reuse.
      reused.replaceChildren();
      return reused;
    }
    return this.#factory(year, yPos);
  }

  release(block) {
    if (this.#pool.length < 7) {
      block.style.display = 'none';
      block.dataset.pooled = 'true';
      block.dataset.detailed = 'false';
      this.#pool.push(block);
    } else {
      block.remove();
    }
  }
}
