import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRichText, parseSpans } from '../js/core/rich-text.js';

const plain = (line) => parseSpans(line).map((s) => s.text).join('');

test('plain text is one unstyled span', () => {
  assert.deepEqual(parseSpans('hari biasa'), [{ text: 'hari biasa' }]);
});

test('bold, italic and code are recognised', () => {
  assert.deepEqual(parseSpans('**tebal**'), [{ text: 'tebal', bold: true }]);
  assert.deepEqual(parseSpans('*miring*'), [{ text: 'miring', italic: true }]);
  assert.deepEqual(parseSpans('`kode`'), [{ text: 'kode', code: true }]);
});

test('bold wins over italic, so ** is never read as two asterisks', () => {
  const spans = parseSpans('**tebal** dan *miring*');
  assert.deepEqual(spans, [
    { text: 'tebal', bold: true },
    { text: ' dan ' },
    { text: 'miring', italic: true },
  ]);
});

test('code contents are taken literally', () => {
  assert.deepEqual(parseSpans('`**bukan tebal**`'), [{ text: '**bukan tebal**', code: true }]);
});

test('unmatched markers stay as ordinary characters', () => {
  assert.equal(plain('2 * 3 = 6'), '2 * 3 = 6');
  assert.equal(plain('setengah **jadi'), 'setengah **jadi');
  assert.deepEqual(parseSpans('a * b'), [{ text: 'a * b' }]);
});

test('a blank line separates paragraphs', () => {
  const blocks = parseRichText('satu\n\ndua');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].lines.length, 1);
  assert.equal(blocks[1].lines[0][0].text, 'dua');
});

test('a single newline stays inside one paragraph', () => {
  const blocks = parseRichText('baris satu\nbaris dua');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].lines.length, 2, 'two lines, one paragraph');
});

test('bullets become a list', () => {
  const blocks = parseRichText('- susu\n- roti\n- telur');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'list');
  assert.equal(blocks[0].ordered, false);
  assert.equal(blocks[0].items.length, 3);
  assert.equal(blocks[0].items[1][0].text, 'roti');
});

test('all three bullet markers work', () => {
  for (const marker of ['-', '*', '+']) {
    const blocks = parseRichText(`${marker} satu`);
    assert.equal(blocks[0].type, 'list', `marker ${marker}`);
  }
});

test('numbers become an ordered list, separate from bullets', () => {
  const blocks = parseRichText('1. satu\n2. dua\n- lain');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].ordered, true);
  assert.equal(blocks[0].items.length, 2);
  assert.equal(blocks[1].ordered, false);
});

test('a list ends where prose resumes', () => {
  const blocks = parseRichText('- satu\nbukan butir');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'list');
  assert.equal(blocks[1].type, 'paragraph');
});

test('inline styling works inside list items', () => {
  const blocks = parseRichText('- beli **susu**');
  assert.deepEqual(blocks[0].items[0], [{ text: 'beli ' }, { text: 'susu', bold: true }]);
});

test('italic at the start of a line is not mistaken for a bullet', () => {
  const blocks = parseRichText('*penting* sekali');
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].lines[0][0].italic, true);
});

test('empty and blank input produce no blocks', () => {
  assert.deepEqual(parseRichText(''), []);
  assert.deepEqual(parseRichText('   \n\n  '), []);
  assert.deepEqual(parseRichText(null), []);
  assert.deepEqual(parseRichText(undefined), []);
});

test('CRLF input parses the same as LF', () => {
  assert.deepEqual(parseRichText('satu\r\n\r\ndua'), parseRichText('satu\n\ndua'));
});

test('markup in a note is data, never structure', () => {
  // The parser has no concept of HTML, so angle brackets survive as text and
  // the renderer only ever assigns them via textContent.
  const blocks = parseRichText('<img src=x onerror=alert(1)>');
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].lines[0], [{ text: '<img src=x onerror=alert(1)>' }]);
});
