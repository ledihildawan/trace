import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The stylesheet carries load-bearing decisions that no JS test can see. This
// suite exists because an edit to #ion-drive once half-applied: the geometry
// changed, the paint did not, and the glow silently rendered off-screen.
const css = readFileSync(new URL('../assets/styles.css', import.meta.url), 'utf8');

// Finds a rule at the outermost level, which after layering means at most one
// level of indentation. Anything deeper is nested inside a media query and
// must not be mistaken for the base rule.
function ruleStart(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^ {0,2}${escaped} \\{`, 'm').exec(css);
  assert.ok(match, `no top-level rule for ${selector}`);
  return match.index;
}

function rule(selector) {
  const start = ruleStart(selector);
  const end = css.indexOf('\n  }', start);
  assert.notEqual(end, -1, `unterminated rule for ${selector}`);
  return css.slice(start, end);
}

// Declarations only. Assertions about what the stylesheet *does* must not be
// satisfied or broken by prose: a comment here explaining why `!important` is
// no longer needed once made the test that forbids `!important` fail.
const declarationsOnly = css.replace(/\/\*[\s\S]*?\*\//g, '');

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

test('cascade layers are declared before they are used', () => {
  const decl = /@layer ([\w\s,]+);/.exec(css);
  assert.ok(decl, 'the layer order must be declared up front');
  const order = decl[1].split(',').map((n) => n.trim());
  assert.deepEqual(order, ['tokens', 'app', 'overrides']);
  for (const name of order) {
    assert.ok(css.includes(`@layer ${name} {`), `layer "${name}" is declared but empty`);
  }
});

test('preference queries live in the top layer and need no !important', () => {
  // They used to beat rules below them in the file by force. In the last
  // layer they win by position, so the force is no longer needed.
  const start = declarationsOnly.indexOf('@layer overrides {');
  assert.notEqual(start, -1);
  const overrides = declarationsOnly.slice(start);
  for (const query of [
    'prefers-reduced-motion', 'prefers-reduced-transparency',
    'forced-colors', 'pointer: coarse', 'pointer: fine',
  ]) {
    assert.ok(overrides.includes(query), `${query} should be an override`);
  }
  assert.ok(!overrides.includes('!important'), 'layers replace the force');
});

test('property registration stays outside the layers', () => {
  // @property is a registration, not a cascade participant. Nesting it is not
  // worth betting the non-inheriting optimisation on.
  const layerStart = css.indexOf('@layer tokens, app, overrides;');
  assert.ok(css.slice(0, layerStart).includes('@property'), 'registered up front');
  assert.ok(!css.slice(layerStart).includes('@property'), 'and nowhere else');
});

test('cell tints derive from the theme, not from one theme written out', () => {
  // rgba(34,211,238) and rgba(251,191,36) are the dark accents written out, so
  // light mode kept cyan and amber while its own accents were indigo and blue.
  for (const selector of ['.cell.weekend', '.cell.week-start', '.cell.month-start']) {
    assert.match(rule(selector), /color-mix\(in oklab, var\(--accent-/,
      `${selector} still hardcodes a colour`);
  }
});

test('element transitions are suppressed while the theme switches', () => {
  // The view transition cross-fades two page snapshots. Element transitions
  // underneath fight it: the new snapshot is taken the moment the theme flips,
  // so each cell is captured at t=0 of its own fade, and the real elements are
  // then revealed part-way through 0.4s, 0.8s and 1s transitions. That is what
  // made the cells appear to change colour at different moments.
  assert.match(css, /html\.theme-switching \*[\s\S]{0,120}transition: none/);
  const start = css.indexOf('html.theme-switching');
  const overrides = css.lastIndexOf('@layer overrides {', start);
  assert.notEqual(overrides, -1, 'must live in the top layer, not rely on !important');
});

test('the toast animates only what it means to', () => {
  // `all` also transitions its offset and its background, neither of which
  // wants a 0.6s spring.
  const toast = rule('#toast');
  assert.ok(!/transition: all/.test(toast), 'transition: all is never the intent');
  assert.match(toast, /transition: opacity[\s\S]*transform/);
});

test('high contrast mode is handled', () => {
  const start = css.indexOf('@media (forced-colors: active)');
  assert.notEqual(start, -1, 'Windows High Contrast needs its own pass');
  const block = css.slice(start);
  assert.match(block, /#ion-drive[\s\S]*display: none/, 'decoration should step aside');
  assert.match(block, /\.cell \{[\s\S]*border:/, 'inset shadows are dropped, so draw borders');
  assert.match(block, /forced-color-adjust: none/, 'mood colour carries meaning and must survive');
  assert.match(block, /outline: 3px solid Highlight/, 'the focus ring is a box-shadow otherwise');
});

test('every animated property is registered as non-inheriting', () => {
  // A value written each frame on an inheriting property invalidates computed
  // style for the whole document; that was the single biggest scroll cost.
  // Matched as a rule, not by splitting on the word: prose mentioning
  // "@property" elsewhere in the file would otherwise be read as one.
  const blocks = [...css.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)];
  assert.ok(blocks.length >= 5, 'expected the animated properties to be registered');
  for (const [, name, body] of blocks) {
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

// Declarations of a top-level rule, tolerating one-line and multi-line
// formatting. Uses the same outermost-only anchor as rule(): an override
// nested in a media query must never be mistaken for the base rule, which is
// exactly what tripped this suite up while it was being written.
function declarations(selector) {
  const start = ruleStart(selector);
  const end = css.indexOf('}', start);
  assert.notEqual(end, -1, `unterminated rule for ${selector}`);
  return css.slice(start, end);
}

test('every edge-anchored control insets for the safe area', () => {
  // index.html asks for viewport-fit=cover, which puts the page under the
  // notch and the home indicator. Anything pinned to an edge has to inset.
  const anchored = [
    ['#toast', 'bottom'],
    ['.keyboard-hints', 'bottom'],
    ['#year-nav', 'left'],
    ['#year-nav-end', 'right'],
    ['.pos-scrubber', 'right'],
  ];
  for (const [selector, side] of anchored) {
    const body = declarations(selector);
    const pattern = new RegExp(`${side}:[^;]*env\\(safe-area-inset-${side}`);
    assert.match(body, pattern, `${selector} does not inset its ${side} edge`);
  }
});

test('the toast clears the hint strip instead of landing on it', () => {
  const offset = (selector) => {
    const m = /bottom:\s*calc\((\d+)px/.exec(declarations(selector));
    assert.ok(m, `${selector} should be offset from the bottom`);
    return Number(m[1]);
  };
  // The strip is about 20px tall, so at the old 30px the toast sat on it.
  const HINT_HEIGHT = 24;
  assert.ok(
    offset('#toast') >= offset('.keyboard-hints') + HINT_HEIGHT,
    `toast at ${offset('#toast')}px overlaps hints at ${offset('.keyboard-hints')}px`
  );
});

test('nothing sizes itself to 100vw', () => {
  // 100vw includes the scrollbar, which is how a page that fits exactly still
  // scrolls sideways. contain-intrinsic-size is a hint, not a used width.
  const offenders = [...css.matchAll(/^\s*(width|min-width):\s*100vw/gm)];
  assert.deepEqual(offenders.map((m) => m[0].trim()), []);
});

test('small controls carry a hit area big enough to press', () => {
  const expanded = /\.mood-btn::after,\s*\.year-nav-btn::after \{([^}]*)\}/.exec(css);
  assert.ok(expanded, 'the small controls should expand their target');
  assert.match(expanded[1], /width: max\(100%, 44px\)/);
  assert.match(expanded[1], /height: max\(100%, 44px\)/);
});

test('the day panel cannot outgrow a landscape phone', () => {
  const panel = rule('.day-panel');
  assert.match(panel, /max-height:/, 'without a cap the Done button falls off screen');
  assert.match(panel, /overflow-y: auto/);
});

test('keyboard hints are hidden where there is no keyboard', () => {
  assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*?\.keyboard-hints \{\s*display: none/);
});

test('floating surfaces share one glass recipe and the grid edge', () => {
  const shared = /\.day-panel,\s*\.date-jumper,\s*\.note-search \{([^}]*)\}/.exec(css);
  assert.ok(shared, 'the three panels should be styled by one shared rule');
  assert.match(shared[1], /backdrop-filter: var\(--glass\)/);
  assert.match(shared[1], /box-shadow: var\(--hairline\)/, 'the grid draws edges as insets');
  assert.match(shared[1], /border-radius: var\(--r-lg\)/);
});
