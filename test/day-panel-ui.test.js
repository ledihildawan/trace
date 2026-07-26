import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

installDom();

const { DayPanel } = await import('../js/ui/day-panel.js');
const { renderRichText } = await import('../js/core/rich-text.js');

function storeOf(entry) {
  return {
    get: () => entry,
    setNote() {}, setMood() {}, clear() { entry = null; }, flush() {},
  };
}

function open(note, mood = '') {
  document.body.replaceChildren();
  const panel = new DayPanel(storeOf(note || mood ? { note, mood } : null));
  panel.open(new Date(2026, 6, 27));
  const dialog = document.querySelector('.day-panel');
  return {
    panel, dialog,
    preview: dialog.querySelector('.day-panel-preview'),
    textarea: dialog.querySelector('.day-panel-note'),
  };
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
