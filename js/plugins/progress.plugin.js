// TRACE Time Progress Plugin
// Manages real-time progress updates

import { MINUTES_PER_DAY } from '../core/constants.js';
import { TracePlugin } from '../core/plugin-manager.js';

export class TimeProgressPlugin extends TracePlugin {
  constructor() {
    super('TimeProgressPlugin');
    this.timeUpdateInterval = null;
  }

  init(engine) {
    super.init(engine);

    // Set up visibility change listeners
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.stopTimeProgressTicker();
        else this.startTimeProgressTicker();
      },
      { signal: this.signal }
    );

    document.addEventListener('freeze', () => this.stopTimeProgressTicker(), { signal: this.signal });
    document.addEventListener('resume', () => this.startTimeProgressTicker(), { signal: this.signal });

    // Start ticker
    this.startTimeProgressTicker();
  }

  /**
   * Start time progress ticker
   */
  startTimeProgressTicker() {
    this.stopTimeProgressTicker();
    this.updateTimeProgress();

    const scheduleNext = () => {
      const now = this.engine.getNow();
      const msToNextMinute =
        (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + (now.getSeconds() === 0 ? 60_000 : 0);
      const delay = Math.max(250, Math.min(60_000, msToNextMinute));

      this.timeUpdateInterval = setTimeout(() => {
        this.updateTimeProgress();
        if (this.timeUpdateInterval) scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  /**
   * Stop time progress ticker
   */
  stopTimeProgressTicker() {
    if (this.timeUpdateInterval) {
      clearTimeout(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  /**
   * Update time progress bar
   */
  updateTimeProgress() {
    const bar = document.getElementById('tr-today-bar');
    if (!bar) return;

    const now = this.engine.getNow();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const pct = minutes / MINUTES_PER_DAY;
    bar.style.transform = `scaleX(${pct})`;
  }

  destroy() {
    this.stopTimeProgressTicker();
    super.destroy();
  }
}
