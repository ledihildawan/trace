export class Onboarding {
  #storage;
  #key;
  #onOpen;
  #onClose;
  #dialog;
  #closeButton;
  #completed = false;

  constructor({
    storage = localStorage,
    storageKey = 'trace-onboarding-v1',
    onOpen = () => {},
    onClose = () => {},
  } = {}) {
    this.#storage = storage;
    this.#key = storageKey;
    this.#onOpen = onOpen;
    this.#onClose = onClose;
    this.#completed = this.#readCompletion();
    this.#build();
  }

  get hasCompleted() {
    return this.#completed;
  }

  isOpen() {
    return this.#dialog.open;
  }

  showFirstRun() {
    try {
      if (this.#storage.getItem(this.#key) === 'complete') {
        this.#completed = true;
        return false;
      }
    } catch {}
    if (this.isOpen()) return false;
    this.open(false);
    return true;
  }

  open(replay = true) {
    if (this.#dialog.open) return;
    this.#closeButton.hidden = !replay;
    this.#dialog.showModal();
    this.#onOpen();
  }

  close() {
    if (this.#dialog.open) this.#dialog.close();
  }

  start() {
    this.#completed = true;
    try {
      this.#storage.setItem(this.#key, 'complete');
    } catch {}
    this.close();
  }

  #readCompletion() {
    try {
      this.#completed = this.#storage.getItem(this.#key) === 'complete';
    } catch {}
    return this.#completed;
  }

  #build() {
    const dialog = document.createElement('dialog');
    dialog.className = 'onboarding';

    const title = document.createElement('h2');
    title.id = 'onboarding-title';
    title.textContent = 'Selamat datang di TRACE';
    dialog.setAttribute('aria-labelledby', title.id);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'onboarding-close';
    closeButton.dataset.action = 'close';
    closeButton.setAttribute('aria-label', 'Tutup panduan');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => this.close());

    const intro = document.createElement('p');
    intro.className = 'onboarding-intro';
    intro.textContent = 'Jejakkan satu hari, lalu lihat bagaimana waktu membentuk perjalananmu.';

    const list = document.createElement('ol');
    list.className = 'onboarding-steps';
    for (const text of [
      'Gulir untuk menelusuri tahun.',
      'Pilih hari untuk mencatat suasana dan kenangan.',
      'Gunakan Cari untuk menemukan catatan lama.',
      'Gunakan Dock di bawah, lalu pilih Menu untuk membuka panduan ini lagi.',
    ]) {
      const item = document.createElement('li');
      item.textContent = text;
      list.append(item);
    }

    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'onboarding-start';
    startButton.dataset.action = 'start';
    startButton.textContent = 'Mulai menjelajah';
    startButton.addEventListener('click', () => this.start());

    dialog.append(closeButton, title, intro, list, startButton);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && this.#completed) this.close();
    });
    dialog.addEventListener('close', () => this.#onClose());
    dialog.addEventListener('keydown', (event) => event.stopPropagation());
    document.body.append(dialog);

    this.#dialog = dialog;
    this.#closeButton = closeButton;
  }
}
