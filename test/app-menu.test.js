import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';
import { AppMenu } from '../js/ui/app-menu.js';

function makeMenu(calls, options = {}) {
  installDom();
  return new AppMenu({
    onTheme: () => calls.push('theme'),
    onAudio: () => calls.push('audio'),
    onLayout: () => calls.push('layout'),
    onData: () => calls.push('data'),
    onHelp: () => calls.push('help'),
    onOpen() {},
    onClose() {},
    ...options,
  });
}

test('menu exposes every formerly hidden primary action', () => {
  const calls = [];
  const menu = makeMenu(calls);
  menu.open();
  for (const action of ['theme', 'audio', 'layout', 'data', 'help']) {
    menu.element.querySelector(`[data-action="${action}"]`).click();
    if (!menu.isOpen()) menu.open();
  }
  assert.deepEqual(calls, ['theme', 'audio', 'layout', 'data', 'help']);
});

test('menu retains its dialog while updating current-state text', () => {
  const calls = [];
  const menu = makeMenu(calls, {
    onTheme: () => 'light',
    onAudio: () => true,
    onLayout: () => 'dynamic',
  });
  const dialog = menu.element;
  menu.open();
  dialog.querySelector('[data-action="theme"]').click();
  assert.equal(menu.element, dialog);
  assert.match(dialog.querySelector('[data-status="theme"]').textContent, /Terang/);
});

test('data keeps the menu open while one-shot actions close it', () => {
  const calls = [];
  const menu = makeMenu(calls);
  menu.open();
  menu.element.querySelector('[data-action="data"]').click();
  assert.equal(menu.isOpen(), true);
  menu.element.querySelector('[data-action="help"]').click();
  assert.equal(menu.isOpen(), false);
});

test('menu toggles from the controller layout changed by a shortcut', () => {
  const calls = [];
  let layout = 'structured';
  const menu = makeMenu(calls, {
    getLayout: () => layout,
    onLayout: (next) => { layout = next; return layout; },
  });

  // The grid's existing R shortcut changed the controller while Menu was closed.
  layout = 'dynamic';
  menu.open();
  assert.match(menu.element.querySelector('[data-status="layout"]').textContent, /Dinamis/);
  menu.element.querySelector('[data-action="layout"]').click();
  assert.equal(layout, 'structured');
});

test('menu reads the persisted controller theme when it opens', () => {
  const calls = [];
  let theme = 'light';
  const menu = makeMenu(calls, {
    getTheme: () => theme,
    onTheme: () => { theme = 'dark'; return theme; },
  });
  menu.open();
  assert.match(menu.element.querySelector('[data-status="theme"]').textContent, /Terang/);
  menu.element.querySelector('[data-action="theme"]').click();
  assert.match(menu.element.querySelector('[data-status="theme"]').textContent, /Gelap/);
});
