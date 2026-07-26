import { OdysseyConfig } from '../config/odyssey-config.js';
import { dayProgress, stampOf } from '../core/date-utils.js';

// "The Pulse of Now": instead of a ticking clock, today's cell fills gradually
// as the day is spent. Publishes the fraction as --day-progress and reports
// midnight rollovers, since the grid's idea of "today" is otherwise fixed at
// boot and would go stale on a screen left open overnight.
export class DayPulse {
  #onRollover;
  #stamp;
  #timer = null;

  constructor({ onRollover } = {}) {
    this.#onRollover = onRollover;
    this.#stamp = stampOf(new Date());
  }

  start() {
    this.#tick();
    // A minute moves the bar by 1/1440 of a cell — finer would be invisible.
    this.#timer = setInterval(() => this.#tick(), OdysseyConfig.timing.dayPulseIntervalMs);
    // Coming back to a backgrounded tab is the most likely moment for the
    // date to have changed without a single tick having run.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.#tick();
    });
  }

  stop() {
    if (this.#timer !== null) clearInterval(this.#timer);
    this.#timer = null;
  }

  #tick() {
    const now = new Date();
    document.documentElement.style.setProperty(
      OdysseyConfig.dom.dayProgressVar,
      dayProgress(now).toFixed(4)
    );

    const stamp = stampOf(now);
    if (stamp === this.#stamp) return;
    this.#stamp = stamp;
    this.#onRollover?.(now);
  }
}
