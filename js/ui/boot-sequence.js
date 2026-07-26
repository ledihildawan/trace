import { OdysseyConfig } from '../config/odyssey-config.js';

const STEPS = [
  { p: 40, t: 'Binding Light Stream...' },
  { p: 80, t: 'Synchronizing Neural Audio...' },
  { p: 100, t: 'System Online.' },
];

export class BootSequence {
  #bar;
  #status;
  #screen;

  constructor() {
    this.#bar = document.getElementById(OdysseyConfig.dom.loadProgress);
    this.#status = document.getElementById(OdysseyConfig.dom.loadStatus);
    this.#screen = document.getElementById(OdysseyConfig.dom.loadingScreen);
  }

  async run(onComplete) {
    for (const step of STEPS) {
      await this.#delay(OdysseyConfig.timing.bootStepMs);
      if (this.#bar) this.#bar.style.width = `${step.p}%`;
      if (this.#status) this.#status.innerText = step.t;
    }
    onComplete?.();
    setTimeout(
      () => this.#screen?.classList.add('hidden'),
      OdysseyConfig.timing.loadingHideMs
    );
  }

  #delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
