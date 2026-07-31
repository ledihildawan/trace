import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

installDom();

const { NoteSearch } = await import('../js/ui/note-search.js');

// Minimal stand-in for DayStore: the widget only ever asks for entries().
const storeOf = (entries, size = entries.length) => ({ entries: () => entries, size });

const ENTRIES = [
  ['2026-01-05', { note: 'Rapat dengan tim desain' }],
  ['2026-07-27', { note: 'Rapat besar hari ini', mood: 'good' }],
  ['2025-12-01', { note: 'Libur panjang' }],
];

function open(entries = ENTRIES) {
  document.body.replaceChildren();
  const search = new NoteSearch(storeOf(entries));
  search.open();
  const dialog = document.querySelector('.note-search');
  return { search, dialog, input: dialog.querySelector('input') };
}

function type(input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

const rows = () => [...document.querySelectorAll('.note-hit')];

test('the box opens empty with a prompt instead of every day', () => {
  const { dialog } = open();
  assert.equal(dialog.open, true);
  assert.equal(rows().length, 0);
  assert.match(dialog.querySelector('.note-search-status').textContent, /Ketik untuk mencari/);
});

test('an empty store shows a distinct empty state instead of the prompt', () => {
  const { dialog } = open([], 0);
  assert.equal(dialog.open, true);
  assert.equal(rows().length, 0);
  assert.match(dialog.querySelector('.note-search-status').textContent, /Belum ada hari/);
});

test('typing lists the matching days, newest first', () => {
  const { input } = open();
  type(input, 'rapat');
  const dates = rows().map((r) => r.querySelector('.note-hit-date').textContent);
  assert.equal(rows().length, 2);
  assert.match(dates[0], /27 Juli 2026/, 'newer of two equal-ranked hits leads');
});

test('the matched text is wrapped in a mark element', () => {
  const { input } = open();
  type(input, 'libur');
  const mark = rows()[0].querySelector('mark');
  assert.ok(mark, 'the hit should be highlighted');
  assert.equal(mark.textContent.toLowerCase(), 'libur');
});

test('notes are rendered as text, never as markup', () => {
  // Notes are user input and can arrive from an imported file, so building
  // the snippet with innerHTML would be an injection.
  const { input } = open([['2026-01-01', { note: 'sebelum <img src=x onerror=alert(1)> sesudah' }]]);
  type(input, 'sebelum');

  const row = rows()[0];
  assert.equal(row.querySelectorAll('img').length, 0, 'no element was parsed out of the note');
  assert.match(row.querySelector('.note-hit-text').textContent, /<img src=x onerror=alert\(1\)>/);
});

test('a query with no matches says so and lists nothing', () => {
  const { input, dialog } = open();
  type(input, 'zzzz');
  assert.equal(rows().length, 0);
  assert.match(dialog.querySelector('.note-search-status').textContent, /Tidak ada catatan/);
});

test('the first result is selected, and arrows move the selection', () => {
  const { dialog, input } = open();
  type(input, 'rapat');
  assert.equal(rows()[0].getAttribute('aria-selected'), 'true');

  dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.equal(rows()[1].getAttribute('aria-selected'), 'true');
  assert.equal(rows()[0].getAttribute('aria-selected'), 'false');

  dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.equal(rows()[0].getAttribute('aria-selected'), 'true', 'wraps around');
});

test('the combobox points screen readers at the selected row', () => {
  const { dialog, input } = open();
  type(input, 'rapat');
  assert.equal(input.getAttribute('aria-activedescendant'), rows()[0].id);

  dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.equal(input.getAttribute('aria-activedescendant'), rows()[1].id);
  assert.ok(rows()[1].id, 'rows need ids for this to mean anything');
});

test('Enter reports the chosen day and closes the box', () => {
  const { search, dialog, input } = open();
  const chosen = [];
  search.onSelect((date) => chosen.push(date));

  type(input, 'libur');
  dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

  assert.equal(dialog.open, false, 'closes before handing over');
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].getFullYear(), 2025);
  assert.equal(chosen[0].getMonth(), 11);
  assert.equal(chosen[0].getDate(), 1);
});

test('closing without choosing reports nothing', () => {
  const { search, dialog, input } = open();
  const chosen = [];
  search.onSelect((date) => chosen.push(date));
  type(input, 'rapat');
  search.close();
  assert.equal(dialog.open, false);
  assert.deepEqual(chosen, []);
});

test('clicking a result selects that day, not the highlighted one', () => {
  const { search, input } = open();
  const chosen = [];
  search.onSelect((date) => chosen.push(date));
  type(input, 'rapat');
  rows()[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].getMonth(), 0, 'the second row was January');
});

test('reopening starts from a clean query', () => {
  const { search, input } = open();
  type(input, 'rapat');
  assert.equal(rows().length, 2);
  search.close();
  search.open();
  assert.equal(input.value, '');
  assert.equal(rows().length, 0);
});
