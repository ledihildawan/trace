import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

installDom();

const { DayPanel } = await import('../js/ui/day-panel.js');
const { renderRichText } = await import('../js/core/rich-text.js');

function storeOf(entry) {
  const persistenceListeners = new Set();
  const store = {
    get: () => entry,
    setNote(_key, note) {
      entry = { ...entry, note: note.trim() ? note.trim() : '' };
      if (!entry.note && !entry.mood) entry = null;
    },
    setMood(_key, mood) {
      entry = { ...entry, mood };
      if (!entry.note && !entry.mood) entry = null;
    },
    clear() { entry = null; },
    flush() {},
    onPersistence(callback) {
      persistenceListeners.add(callback);
      return () => persistenceListeners.delete(callback);
    },
    emitPersistence(state) {
      persistenceListeners.forEach((callback) => callback(state));
    },
  };
  return store;
}

function openWithOptions(note, opts = {}, mood = '') {
  document.body.replaceChildren();
  const store = storeOf(note || mood ? { note, mood } : null);
  const panel = new DayPanel(store, opts);
  panel.open(new Date(2026, 6, 27));
  const dialog = document.querySelector('.day-panel');
  return {
    panel, dialog, store,
    preview: dialog.querySelector('.day-panel-preview'),
    textarea: dialog.querySelector('.day-panel-note'),
  };
}

function open(note, mood = '') {
  return openWithOptions(note, {}, mood);
}

async function settleClick(button) {
  button.click();
  await Promise.resolve();
  await Promise.resolve();
}

test('a day with a note opens as formatted text, not a textarea', () => {
  const { preview, textarea } = open('**penting** hari ini');
  assert.equal(preview.hidden, false);
  assert.equal(textarea.hidden, true);
  assert.equal(preview.querySelector('strong').textContent, 'penting');
});

test('an empty day opens ready to type', () => {
  const { preview, textarea } = open('');
  assert.equal(textarea.hidden, false);
  assert.equal(preview.hidden, true);
});

test('clicking the preview switches to the editor with the source intact', () => {
  const { preview, textarea } = open('- susu\n- roti');
  preview.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(textarea.hidden, false);
  assert.equal(preview.hidden, true);
  assert.equal(textarea.value, '- susu\n- roti', 'the editor shows the original markup');
});

test('the preview is keyboard reachable and activates on Enter', () => {
  const { preview, textarea } = open('catatan');
  assert.equal(preview.tabIndex, 0);
  preview.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(textarea.hidden, false);
});

test('lists render as real list elements', () => {
  const { preview } = open('- susu\n- roti\n\n1. satu');
  assert.equal(preview.querySelectorAll('ul li').length, 2);
  assert.equal(preview.querySelectorAll('ol li').length, 1);
});

test('markup inside a note never becomes an element', () => {
  // The strongest guarantee here: a note is data. This is the path an
  // imported archive would take, so it must hold for hostile input too.
  const { preview } = open('<img src=x onerror=alert(1)> **tebal**');
  assert.equal(preview.querySelectorAll('img').length, 0);
  assert.equal(preview.querySelector('strong').textContent, 'tebal');
  assert.match(preview.textContent, /<img src=x onerror=alert\(1\)>/);
});

test('renderRichText only ever emits the allowed tags', () => {
  const fragment = renderRichText('**a** *b* `c`\n- d\n\n1. e', document);
  const host = document.createElement('div');
  host.append(fragment);
  const tags = new Set([...host.querySelectorAll('*')].map((el) => el.tagName));
  assert.deepEqual([...tags].sort(), ['CODE', 'EM', 'LI', 'OL', 'P', 'STRONG', 'UL']);
});

test('moods have visible text labels', () => {
  const { dialog } = open('');
  assert.deepEqual(
    [...dialog.querySelectorAll('.mood-label')].map((el) => el.textContent),
    ['Luar Biasa', 'Baik', 'Biasa', 'Kurang', 'Buruk']
  );
  assert.equal(dialog.querySelectorAll('.mood-btn[aria-pressed]').length, 5);
});

test('delete is disabled for an empty day', () => {
  const { dialog } = open('');
  assert.equal(dialog.querySelector('.day-panel-delete').disabled, true);
});

test('non-empty delete requires confirmation', async () => {
  let confirmations = 0;
  const { dialog, textarea } = openWithOptions('catatan', {
    confirmDelete: () => { confirmations += 1; return false; },
  });

  await settleClick(dialog.querySelector('.day-panel-delete'));

  assert.equal(confirmations, 1);
  assert.equal(textarea.value, 'catatan');
  assert.equal(dialog.querySelector('.day-panel-delete').disabled, false);
});

test('default delete confirmation cancels without clearing the day', async () => {
  const { dialog, textarea } = open('catatan');
  const originalConfirm = window.confirm;
  let browserConfirmCalls = 0;
  window.confirm = () => { browserConfirmCalls += 1; return true; };
  try {
    dialog.querySelector('.day-panel-delete').click();

    const confirmation = document.querySelector('.day-panel-confirm');
    assert.equal(confirmation?.open, true, 'the app should use its own native dialog');
    assert.equal(browserConfirmCalls, 0, 'the blocking browser prompt must not be used');

    await settleClick(confirmation.querySelector('.day-panel-confirm-cancel'));

    assert.equal(confirmation.open, false);
    assert.equal(textarea.value, 'catatan');
  } finally {
    window.confirm = originalConfirm;
  }
});

test('default delete confirmation closes before clearing the day', async () => {
  const { dialog, textarea, store } = open('catatan');
  dialog.querySelector('.day-panel-delete').click();

  const confirmation = document.querySelector('.day-panel-confirm');
  assert.ok(confirmation, 'the app should render its own native confirmation dialog');
  let openWhenCleared = null;
  const originalClear = store.clear.bind(store);
  store.clear = () => {
    openWhenCleared = confirmation.open;
    originalClear();
  };

  await settleClick(confirmation.querySelector('.day-panel-confirm-accept'));

  assert.equal(openWhenCleared, false, 'the nested modal closes before deletion continues');
  assert.equal(textarea.value, '');
  assert.equal(dialog.querySelector('.day-panel-delete').disabled, true);
});

test('delete availability follows note and mood changes', () => {
  const { dialog, textarea } = open('');
  const deleteButton = dialog.querySelector('.day-panel-delete');

  textarea.value = 'catatan';
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(deleteButton.disabled, false, 'typing creates deletable content');

  textarea.value = '   ';
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(deleteButton.disabled, true, 'whitespace alone is not stored content');

  const mood = dialog.querySelector('.mood-btn');
  mood.click();
  assert.equal(deleteButton.disabled, false, 'a mood makes the day non-empty');
  mood.click();
  assert.equal(deleteButton.disabled, true, 'clearing the last mood empties the day');
});

test('the editor explains supported formatting', () => {
  const { dialog } = open('');
  const hint = dialog.querySelector('.day-panel-format-hint');
  assert.ok(hint, 'the formatting hint should be visible beside the editor');
  assert.equal(
    hint.textContent,
    '**tebal** · *miring* · daftar dengan - atau 1.'
  );
});

test('save status follows persistence outcomes', () => {
  const { dialog, textarea, store } = open('');
  const status = dialog.querySelector('.day-panel-save-status');
  assert.ok(status, 'persistence feedback should have a live status region');
  assert.equal(status.getAttribute('role'), 'status');

  textarea.value = 'catatan';
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(status.textContent, 'Menyimpan…');

  store.emitPersistence({ ok: true });
  assert.equal(status.textContent, 'Tersimpan otomatis');

  store.emitPersistence({ ok: false, error: new DOMException('Penuh', 'QuotaExceededError') });
  assert.equal(status.textContent, 'Tidak dapat menyimpan di browser ini');
});

test('mood changes show a pending save until persistence reports success', () => {
  const { dialog, store } = open('');
  const status = dialog.querySelector('.day-panel-save-status');
  assert.ok(status, 'persistence feedback should have a live status region');

  dialog.querySelector('.mood-btn').click();
  assert.equal(status.textContent, 'Menyimpan…');

  store.emitPersistence({ ok: true });
  assert.equal(status.textContent, 'Tersimpan otomatis');
});

test('a persistence failure remains visible after the panel is reopened', () => {
  const { panel, dialog, store } = open('catatan');
  const status = dialog.querySelector('.day-panel-save-status');

  store.emitPersistence({ ok: false, error: new DOMException('Penuh', 'QuotaExceededError') });
  panel.close();
  panel.open(new Date(2026, 6, 28));

  assert.equal(status.textContent, 'Tidak dapat menyimpan di browser ini');
});

test('a stale async confirmation cannot affect a reopened session for the same day', async () => {
  let resolveConfirmation;
  const confirmation = new Promise((resolve) => { resolveConfirmation = resolve; });
  const { panel, dialog, store, textarea } = openWithOptions('catatan lama', {
    confirmDelete: () => confirmation,
  });
  let clears = 0;
  store.clear = () => { clears += 1; };

  dialog.querySelector('.day-panel-delete').click();
  panel.close();
  panel.open(new Date(2026, 6, 27));
  assert.equal(
    dialog.querySelector('.day-panel-delete').disabled,
    false,
    'an unresolved confirmation from a closed session must not lock Delete'
  );

  textarea.value = 'catatan sesi baru';
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
  resolveConfirmation(true);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(clears, 0);
  assert.equal(textarea.value, 'catatan sesi baru');
  assert.equal(store.get().note, 'catatan sesi baru');
});
