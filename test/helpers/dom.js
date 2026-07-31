import { JSDOM } from 'jsdom';

// Boots a DOM for the modules that genuinely need one. Call before importing
// anything under js/ui or js/grid, since several read `document` at module
// scope.
export function installDom(html = '<!doctype html><html><body></body></html>') {
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  const { window } = dom;

  for (const key of [
    'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node',
    'CustomEvent', 'Event', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'DOMException', 'getComputedStyle',
    'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia',
  ]) {
    if (window[key] === undefined) continue;
    // Node exposes some of these (navigator) as getter-only globals, so a
    // plain assignment throws; defineProperty replaces them outright.
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: window[key],
    });
  }
  globalThis.addEventListener = window.addEventListener.bind(window);
  globalThis.localStorage = createStorage();

  // jsdom does not yet expose PointerEvent in every release. The dock only
  // relies on its Event behaviour, so MouseEvent is an adequate test shim.
  if (!window.PointerEvent) {
    window.PointerEvent = window.MouseEvent;
    globalThis.PointerEvent = window.PointerEvent;
  }

  // jsdom implements no layout, so scrollIntoView is missing. Without this the
  // call throws inside an event handler, where the error is swallowed by the
  // dispatcher and the rest of the handler silently never runs.
  if (typeof window.Element.prototype.scrollIntoView !== 'function') {
    window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  }

  // jsdom 29 still ships no HTMLDialogElement.showModal, so exercising any
  // dialog-based widget needs this shim. It reproduces only the bits our code
  // depends on — `open`, `close` and the close event. Real modal behaviour
  // (top layer, focus trap, inert background) is the platform's job and stays
  // unverified here; that needs a browser.
  const proto = window.HTMLDialogElement?.prototype;
  if (proto && typeof proto.showModal !== 'function') {
    proto.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    proto.show = proto.showModal;
    proto.close = function close(returnValue) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      if (returnValue !== undefined) this.returnValue = returnValue;
      this.dispatchEvent(new window.Event('close'));
    };
    Object.defineProperty(proto, 'open', {
      configurable: true,
      get() { return this.hasAttribute('open'); },
      set(value) {
        if (value) this.setAttribute('open', '');
        else this.removeAttribute('open');
      },
    });
  }

  return window;
}

function createStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

// Fires a bubbling event, which is what the delegated listeners rely on.
export function fire(target, type, init = {}) {
  target.dispatchEvent(new globalThis.window.Event(type, { bubbles: true, ...init }));
}
