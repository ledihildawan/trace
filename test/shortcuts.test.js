import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveShortcut } from '../js/core/shortcuts.js';

const run = () => {};
const TABLE = new Map([
  ['r', { run, prevent: false }],
  ['f', { run, prevent: true }],
  ['z', { run, prevent: true, combo: true }],
]);
const press = (key, mods = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, ...mods });

test('a plain shortcut resolves when no modifier is held', () => {
  assert.equal(resolveShortcut(TABLE, press('r')), TABLE.get('r'));
});

test('a plain shortcut is ignored under Ctrl or Cmd', () => {
  // The bug this guards: Ctrl+R switched layout instead of reloading the page,
  // and Ctrl+F never reached the browser's find bar.
  assert.equal(resolveShortcut(TABLE, press('r', { ctrlKey: true })), null);
  assert.equal(resolveShortcut(TABLE, press('r', { metaKey: true })), null);
  assert.equal(resolveShortcut(TABLE, press('f', { ctrlKey: true })), null);
});

test('a combo shortcut requires Ctrl or Cmd', () => {
  assert.equal(resolveShortcut(TABLE, press('z', { ctrlKey: true })), TABLE.get('z'));
  assert.equal(resolveShortcut(TABLE, press('z', { metaKey: true })), TABLE.get('z'));
  assert.equal(resolveShortcut(TABLE, press('z')), null, 'plain z is not undo');
});

test('Alt never resolves, with or without other modifiers', () => {
  assert.equal(resolveShortcut(TABLE, press('r', { altKey: true })), null);
  assert.equal(resolveShortcut(TABLE, press('z', { altKey: true, ctrlKey: true })), null);
});

test('keys are matched case-insensitively', () => {
  assert.equal(resolveShortcut(TABLE, press('R')), TABLE.get('r'));
  assert.equal(resolveShortcut(TABLE, press('Z', { ctrlKey: true })), TABLE.get('z'));
});

test('unknown keys and missing input resolve to nothing', () => {
  assert.equal(resolveShortcut(TABLE, press('q')), null);
  assert.equal(resolveShortcut(TABLE, press(undefined)), null);
  assert.equal(resolveShortcut(TABLE, null), null);
  assert.equal(resolveShortcut(null, press('r')), null);
});
