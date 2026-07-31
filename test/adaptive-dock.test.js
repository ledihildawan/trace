import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';
import { AdaptiveDock } from '../js/ui/adaptive-dock.js';

const markup = `
  <nav id="adaptive-dock" aria-label="Tindakan utama">
    <button type="button" data-action="today">Hari ini</button>
    <button type="button" data-action="search">Cari</button>
    <button type="button" data-action="menu">Menu</button>
  </nav>`;

function makeDock(options = {}) {
  const target = installDom(`<!doctype html><body>${markup}</body>`);
  return new AdaptiveDock({
    target,
    idleMs: 10,
    coarseQuery: '(pointer: coarse)',
    onToday() {},
    onSearch() {},
    onMenu() {},
    ...options,
  });
}

test('intent reveals the dock and idle hides it', async () => {
  const dock = makeDock();
  window.dispatchEvent(new window.PointerEvent('pointermove'));
  assert.equal(dock.element.classList.contains('is-visible'), true);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(dock.element.classList.contains('is-visible'), false);
  dock.destroy();
});

test('pinned dock does not hide on idle', async () => {
  const dock = makeDock();
  dock.pin();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(dock.element.classList.contains('is-visible'), true);
  dock.destroy();
});

test('dock buttons emit only their supplied callbacks', () => {
  const calls = [];
  const dock = makeDock({
    onToday: () => calls.push('today'),
    onSearch: () => calls.push('search'),
    onMenu: () => calls.push('menu'),
  });
  for (const action of ['today', 'search', 'menu']) {
    dock.element.querySelector(`[data-action="${action}"]`).click();
  }
  assert.deepEqual(calls, ['today', 'search', 'menu']);
  dock.destroy();
});

test('destroy removes intent listeners', () => {
  const dock = makeDock();
  dock.destroy();
  window.dispatchEvent(new window.PointerEvent('pointermove'));
  assert.equal(dock.element.classList.contains('is-visible'), false);
});

test('coarse pointers reveal on pointerdown, not pointer movement', () => {
  const target = installDom(`<!doctype html><body>${markup}</body>`);
  target.matchMedia = () => ({ matches: true });
  const dock = new AdaptiveDock({
    target,
    idleMs: 100,
    coarseQuery: '(pointer: coarse)',
    onToday() {}, onSearch() {}, onMenu() {},
  });
  target.dispatchEvent(new target.PointerEvent('pointermove'));
  assert.equal(dock.element.classList.contains('is-visible'), false);
  target.dispatchEvent(new target.PointerEvent('pointerdown'));
  assert.equal(dock.element.classList.contains('is-visible'), true);
  dock.destroy();
});

test('destroy detaches actions and cancels the pending idle timer', async () => {
  let calls = 0;
  const dock = makeDock({ idleMs: 10, onToday: () => { calls += 1; } });
  dock.show('test');
  dock.destroy();
  dock.element.querySelector('[data-action="today"]').click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls, 0);
  assert.equal(dock.element.classList.contains('is-visible'), true);
});

test('nested pins keep the dock visible until the final unpin', async () => {
  const dock = makeDock({ idleMs: 10 });
  dock.pin();
  dock.pin();
  dock.unpin();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(dock.element.classList.contains('is-visible'), true);
  dock.unpin();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(dock.element.classList.contains('is-visible'), false);
  dock.destroy();
});
