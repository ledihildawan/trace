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
