export class AppMenu {
  #dialog;
  #callbacks;
  #stateQueries;
  #status = { theme: 'dark', audio: false, layout: 'structured' };

  constructor({
    onTheme = () => {},
    onAudio = () => {},
    onLayout = () => {},
    onData = () => {},
    onHelp = () => {},
    onOpen = () => {},
    onClose = () => {},
    getTheme = () => undefined,
    getAudio = () => undefined,
    getLayout = () => undefined,
  } = {}) {
    this.#callbacks = { onTheme, onAudio, onLayout, onData, onHelp, onOpen, onClose };
    this.#stateQueries = { getTheme, getAudio, getLayout };
    this.#build();
  }

  get element() {
    return this.#dialog;
  }

  isOpen() {
    return this.#dialog.open;
  }

  open() {
    if (this.isOpen()) return;
    this.#syncStatus();
    this.#dialog.showModal();
    this.#callbacks.onOpen();
  }

  close() {
    if (this.isOpen()) this.#dialog.close();
  }

  #build() {
    const dialog = document.createElement('dialog');
    dialog.className = 'app-menu';

    const title = document.createElement('h2');
    title.id = 'app-menu-title';
    title.textContent = 'Menu TRACE';
    dialog.setAttribute('aria-labelledby', title.id);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'app-menu-close';
    close.setAttribute('aria-label', 'Tutup menu');
    close.textContent = '×';
    close.addEventListener('click', () => this.close());

    const settings = this.#group('Pengaturan', [
      ['theme', 'Tema', 'Ganti tema'],
      ['audio', 'Audio', 'Nyalakan atau matikan audio'],
      ['layout', 'Tata letak', 'Ganti tata letak'],
    ]);
    const actions = this.#group('Lainnya', [
      ['data', 'Data', 'Kelola data perjalanan'],
      ['help', 'Panduan', 'Buka panduan TRACE'],
    ], false);

    dialog.append(close, title, settings, actions);
    dialog.addEventListener('click', (event) => this.#handleAction(event));
    dialog.addEventListener('close', () => this.#callbacks.onClose());
    dialog.addEventListener('keydown', (event) => event.stopPropagation());
    document.body.append(dialog);
    this.#dialog = dialog;
  }

  #group(label, entries, includesStatus = true) {
    const group = document.createElement('section');
    group.className = 'app-menu-group';
    const heading = document.createElement('h3');
    heading.textContent = label;
    group.append(heading);

    for (const [action, labelText, description] of entries) {
      const row = document.createElement('div');
      row.className = 'app-menu-row';
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.textContent = labelText;
      button.setAttribute('aria-label', description);
      row.append(button);
      if (includesStatus) {
        const status = document.createElement('span');
        status.dataset.status = action;
        status.setAttribute('aria-live', 'polite');
        row.append(status);
      }
      group.append(row);
    }
    this.#renderStatus(group);
    return group;
  }

  #handleAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action } = button.dataset;
    this.#syncStatus();
    switch (action) {
      case 'theme':
        this.#status.theme = this.#normaliseTheme(this.#callbacks.onTheme(), this.#status.theme);
        this.#syncStatus();
        this.close();
        break;
      case 'audio':
        this.#status.audio = this.#normaliseAudio(this.#callbacks.onAudio(), this.#status.audio);
        this.#syncStatus();
        this.close();
        break;
      case 'layout': {
        const next = this.#status.layout === 'structured' ? 'dynamic' : 'structured';
        this.#status.layout = this.#normaliseLayout(this.#callbacks.onLayout(next), next);
        this.#syncStatus();
        this.close();
        break;
      }
      case 'data':
        this.#callbacks.onData();
        break;
      case 'help':
        this.close();
        this.#callbacks.onHelp();
        break;
    }
  }

  #renderStatus(root) {
    const labels = {
      theme: `Tema: ${this.#status.theme === 'light' ? 'Terang' : 'Gelap'}`,
      audio: `Audio: ${this.#status.audio ? 'Nyala' : 'Senyap'}`,
      layout: `Tata letak: ${this.#status.layout === 'dynamic' ? 'Dinamis' : 'Terstruktur'}`,
    };
    for (const [name, text] of Object.entries(labels)) {
      const status = root?.querySelector(`[data-status="${name}"]`);
      if (status) status.textContent = text;
    }
  }

  #syncStatus() {
    const theme = this.#stateQueries.getTheme();
    const audio = this.#stateQueries.getAudio();
    const layout = this.#stateQueries.getLayout();
    if (theme === 'light' || theme === 'dark') this.#status.theme = theme;
    if (typeof audio === 'boolean') this.#status.audio = audio;
    if (layout === 'dynamic' || layout === 'structured') this.#status.layout = layout;
    this.#renderStatus(this.#dialog);
  }

  #normaliseTheme(value, current) {
    return value === 'light' || value === 'dark' ? value : (current === 'dark' ? 'light' : 'dark');
  }

  #normaliseAudio(value, current) {
    return typeof value === 'boolean' ? value : !current;
  }

  #normaliseLayout(value, fallback) {
    return value === 'dynamic' || value === 'structured' ? value : fallback;
  }
}
