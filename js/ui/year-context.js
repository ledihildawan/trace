export class YearContext {
  #element;
  #previous;
  #active;
  #next;

  constructor({ onPrevious = () => {}, onNext = () => {} } = {}) {
    const element = document.createElement('nav');
    element.className = 'year-context';
    element.setAttribute('aria-label', 'Konteks tahun');

    this.#previous = this.#button('previous', onPrevious);
    this.#active = document.createElement('span');
    this.#active.className = 'year-context-active';
    this.#active.setAttribute('aria-current', 'true');
    this.#next = this.#button('next', onNext);
    element.append(this.#previous, this.#active, this.#next);
    document.body.append(element);
    this.#element = element;
    this.setYear(new Date().getFullYear());
  }

  get element() {
    return this.#element;
  }

  setYear(year) {
    const activeYear = Math.round(Number(year));
    if (!Number.isFinite(activeYear)) return;
    this.#previous.textContent = String(activeYear - 1);
    this.#active.textContent = String(activeYear);
    this.#next.textContent = String(activeYear + 1);
    this.#previous.setAttribute('aria-label', `Buka tahun ${activeYear - 1}`);
    this.#next.setAttribute('aria-label', `Buka tahun ${activeYear + 1}`);
  }

  #button(action, callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.addEventListener('click', callback);
    return button;
  }
}
