export class AdaptiveDock {
  #el;
  #timer = null;
  #pins = 0;
  #idleMs;
  #target;
  #intentListeners = [];
  #actions = [];

  constructor({
    target = window,
    idleMs = 4000,
    coarseQuery = '(pointer: coarse)',
    onToday = () => {},
    onSearch = () => {},
    onMenu = () => {},
  } = {}) {
    this.#target = target;
    this.#idleMs = idleMs;
    this.#el = document.getElementById('adaptive-dock');
    if (!this.#el) throw new Error('Adaptive dock requires #adaptive-dock.');

    this.#bindAction('today', onToday);
    this.#bindAction('search', onSearch);
    this.#bindAction('menu', onMenu);

    const coarsePointer = target.matchMedia?.(coarseQuery).matches;
    const intentTypes = coarsePointer
      ? ['pointerdown', 'keydown', 'focusin']
      : ['pointermove', 'pointerdown', 'keydown', 'focusin'];
    for (const type of intentTypes) this.#listen(type);
  }

  #bindAction(action, callback) {
    const button = this.#el.querySelector(`[data-action="${action}"]`);
    if (!button) throw new Error(`Adaptive dock requires [data-action="${action}"].`);
    button.addEventListener('click', callback);
    this.#actions.push([button, callback]);
  }

  #listen(type) {
    const listener = () => this.show(type);
    this.#target.addEventListener(type, listener, { passive: true });
    this.#intentListeners.push([type, listener]);
  }

  show() {
    clearTimeout(this.#timer);
    this.#timer = null;
    this.#el.classList.add('is-visible');
    if (!this.#pins) this.#timer = setTimeout(() => this.hide(), this.#idleMs);
  }

  hide() {
    if (this.#pins) return;
    clearTimeout(this.#timer);
    this.#timer = null;
    this.#el.classList.remove('is-visible');
  }

  pin() {
    this.#pins += 1;
    this.show('pin');
  }

  unpin() {
    this.#pins = Math.max(0, this.#pins - 1);
    this.show('unpin');
  }

  destroy() {
    clearTimeout(this.#timer);
    this.#timer = null;
    for (const [type, listener] of this.#intentListeners) {
      this.#target.removeEventListener(type, listener);
    }
    this.#intentListeners = [];
    for (const [button, callback] of this.#actions) {
      button.removeEventListener('click', callback);
    }
    this.#actions = [];
  }

  get element() {
    return this.#el;
  }
}
