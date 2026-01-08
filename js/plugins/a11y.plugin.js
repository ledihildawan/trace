// TRACE Accessibility Plugin (A11y)
// Screen reader support and accessibility features

import { TracePlugin } from '../core/plugin-manager.js';

export class A11yPlugin extends TracePlugin {
  constructor() {
    super('A11yPlugin');
  }

  init(engine) {
    super.init(engine);
    this.setupAriaAttributes();
  }

  /**
   * Setup ARIA attributes for viewport
   */
  setupAriaAttributes() {
    if (this.engine.viewport) {
      this.engine.viewport.setAttribute('role', 'grid');
      this.engine.viewport.setAttribute('aria-label', 'Year calendar grid');
    }
  }

  /**
   * Announce message to screen readers
   */
  announce(message) {
    if (this.engine.announcer) {
      this.engine.announcer.innerText = message;
    }
  }

  /**
   * Update screen reader status
   */
  updateStatus(message) {
    if (this.engine.srStatus) {
      this.engine.srStatus.textContent = message;
    }
  }

  /**
   * Set up cell accessibility attributes
   * Called during render for each cell
   */
  setupCellA11y(cell, { type, dateLong, infoStr, isToday, index }) {
    if (type === 'filler') {
      cell.removeAttribute('role');
      cell.removeAttribute('tabindex');
      cell.removeAttribute('aria-label');
      return;
    }

    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('tabindex', isToday ? '0' : '-1');
    cell.setAttribute('aria-label', `${dateLong}. ${infoStr}`);
    cell.dataset.trIndex = index.toString();
    
    if (isToday) {
      cell.setAttribute('aria-current', 'date');
    }
  }
}
