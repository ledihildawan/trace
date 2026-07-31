import test from 'node:test';
import assert from 'node:assert/strict';

import { installDom } from './helpers/dom.js';

installDom();

const { DayStore } = await import('../js/systems/day-store.js');

test('flush reports successful persistence', () => {
  const store = new DayStore();
  const states = [];
  store.onPersistence((state) => states.push(state));

  store.setNote('2026-07-31', 'catatan');

  assert.deepEqual(store.flush(), { ok: true });
  assert.deepEqual(states.at(-1), { ok: true });
});

test('quota failure preserves memory and reports the error', () => {
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = () => {
    throw new DOMException('Penuh', 'QuotaExceededError');
  };

  try {
    const store = new DayStore();
    const states = [];
    store.onPersistence((state) => states.push(state));

    store.setMood('2026-07-31', 'good');

    assert.equal(store.get('2026-07-31').mood, 'good');
    assert.equal(states.at(-1).ok, false);
    assert.equal(states.at(-1).error.name, 'QuotaExceededError');
    assert.equal(store.flush().ok, false, 'flush returns the last outcome without a timer');
  } finally {
    localStorage.setItem = originalSetItem;
  }
});

test('subscriber errors do not change a successful storage outcome', () => {
  const store = new DayStore();
  store.onPersistence(() => {
    throw new Error('subscriber failed');
  });

  assert.throws(() => store.setMood('2026-07-31', 'good'), /subscriber failed/);
  assert.deepEqual(store.flush(), { ok: true });
});
