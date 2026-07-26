import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The stylesheet carries load-bearing decisions that no JS test can see. This
// suite exists because an edit to #ion-drive once half-applied: the geometry
// changed, the paint did not, and the glow silently rendered off-screen.
const css = readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');

function rule(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `no rule for ${selector}`);
  const end = css.indexOf('\n}', start);
  assert.notEqual(end, -1, `unterminated rule for ${selector}`);
  return css.slice(start, end);
}

test('the stylesheet is structurally intact', () => {
  assert.equal(css.match(/\{/g).length, css.match(/\}/g).length, 'unbalanced braces');
});

test('every custom property referenced is defined or set at runtime', () => {
  // These four are written from JavaScript on the element that reads them.
  const runtime = new Set(['--mood-color', '--day-progress', '--ion-x', '--ion-y']);
  const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  const defined = new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
  const registered = new Set([...css.matchAll(/@property\s+(--[\w-]+)/g)].map((m) => m[1]));
  const missing = [...used].filter((v) => !defined.has(v) && !registered.has(v) && !runtime.has(v));
  assert.deepEqual(missing, [], `undefined custom properties: ${missing}`);
});

test('every animated property is registered as non-inheriting', () => {
  // A value written each frame on an inheriting property invalidates computed
  // style for the whole document; that was the single biggest scroll cost.
  const blocks = css.split('@property ').slice(1);
  assert.ok(blocks.length >= 5, 'expected the animated properties to be registered');
  for (const block of blocks) {
    const name = block.slice(0, block.indexOf(' '));
    const body = block.slice(0, block.indexOf('}'));
    assert.match(body, /inherits:\s*false/, `${name} must not inherit`);
  }
});

test('the ion drive follows the pointer by transform, not by repainting', () => {
  const ion = rule('#ion-drive');
  assert.match(ion, /circle at 50% 50%/, 'the gradient must be anchored to the field');
  assert.ok(
    !/circle at calc\(var\(--ion-x\)/.test(ion),
    'a pointer-positioned gradient repaints the whole viewport every frame'
  );
  assert.match(ion, /translate3d\(calc\(var\(--ion-x\) \* 1px\)/, 'must translate');
  assert.match(ion, /scale\(var\(--ion-scale\)\)/, 'scale must compose with the translate');
});

test('the ion field is large enough for the widest glow', () => {
  const field = /--ion-field:\s*(\d+)px/.exec(css);
  assert.ok(field, '--ion-field must be defined');
  // The gradient is centred in the field, so the field must reach a full glow
  // radius in every direction. The widest the app ever sets is 900px.
  const LARGEST_GLOW_PX = 900;
  assert.ok(
    Number(field[1]) / 2 >= LARGEST_GLOW_PX,
    `field ${field[1]}px leaves less than ${LARGEST_GLOW_PX}px of reach`
  );
});

test('the jump collapse composes with the pointer transform', () => {
  const jump = rule('#ion-drive.jumping');
  assert.match(jump, /--ion-scale:\s*0/, 'must collapse via the variable');
  assert.ok(!/transform:/.test(jump), 'overwriting transform would drop the translate');
  assert.ok(!/!important/.test(jump), 'specificity already wins here');
});

test('expensive effects are gated behind a state class', () => {
  // Left unconditional, this filter keeps a double drop-shadow path alive over
  // every rendered cell even when nothing is moving.
  assert.match(css, /#viewport\.is-shifting \.grid-container \{[^}]*filter:/);
  const container = rule('.grid-container');
  assert.ok(!/filter:/.test(container), 'the base rule must not carry the filter');
  assert.ok(!/will-change/.test(container), 'nor pin will-change permanently');
});

test('will-change is scoped rather than pinned on every block', () => {
  const block = rule('.year-block');
  assert.ok(!/will-change/.test(block), 'a permanent layer per year block is the bug');
  assert.match(css, /#viewport\.warping-(far|near) \.year-block[^{]*\{[^}]*will-change/);
});

test('floating surfaces share one glass recipe and the grid edge', () => {
  const shared = /\.day-panel,\s*\.date-jumper,\s*\.note-search \{([^}]*)\}/.exec(css);
  assert.ok(shared, 'the three panels should be styled by one shared rule');
  assert.match(shared[1], /backdrop-filter: var\(--glass\)/);
  assert.match(shared[1], /box-shadow: var\(--hairline\)/, 'the grid draws edges as insets');
  assert.match(shared[1], /border-radius: var\(--r-lg\)/);
});
