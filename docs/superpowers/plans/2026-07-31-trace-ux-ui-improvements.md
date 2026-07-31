# TRACE UX/UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TRACE discoverable, readable, responsive, and safe to manage without losing its immersive Zero-UI character.

**Architecture:** Add small UI controllers around the existing `GridArchitect`, `DayStore`, and dialog components. `GridArchitect` exposes narrow navigation and responsive-rebuild methods; new dock, menu, onboarding, year-context, and data-action modules call those methods through callbacks supplied by `main.js`.

**Tech Stack:** ES2025 browser modules, semantic HTML/CSS, native `<dialog>`, `localStorage`, Node `node:test`, jsdom 29, existing TRACE event and rendering modules.

## Global Constraints

- Preserve existing notes, moods, JSON archive format, shortcuts, themes, audio behavior, and atmospheric rendering.
- Add no framework or runtime dependency.
- Use Indonesian for every new visible string, accessible name, status, toast, and error.
- Keep primary touch targets at least 44 × 44 px while allowing smaller visible glyphs.
- Preserve reduced-motion, reduced-transparency, forced-colors, keyboard, and screen-reader support.
- Preserve unrelated local modifications currently present in the worktree.
- Implement each task test-first and commit only that task's files.

## File Map

**Create**

- `js/ui/adaptive-dock.js` — dock DOM, intent visibility, pinning, and idle state.
- `js/ui/app-menu.js` — theme, audio, layout, data, and help menu.
- `js/ui/onboarding.js` — first-run and replayable onboarding dialog.
- `js/ui/year-context.js` — active-year display and adjacent navigation.
- `js/ui/data-actions.js` — archive validation, import summary, export orchestration.
- `js/grid/responsive-layout.js` — classify viewport changes and capture restoration state.
- `js/core/ui-copy.js` — centralized Indonesian application copy.
- Corresponding focused test files under `test/`.

**Modify**

- `index.html` — Indonesian static labels and dock mount point.
- `assets/styles.css` — adaptive dock, menu, onboarding, readability, panel, and mobile presentation.
- `js/main.js` — composition root for new controllers.
- `js/config/odyssey-config.js` — DOM IDs, storage keys, timing, and responsive thresholds.
- `js/grid/grid-architect.js` — public navigation state/actions and responsive rebuild integration.
- `js/ui/day-panel.js` — labelled moods, save state, guarded delete, formatting hint.
- `js/ui/note-search.js` — distinct empty states and status copy.
- `js/systems/day-store.js` — observable persistence result and validated archive merge summary.
- `js/systems/galactic-audio.js` — expose explicit enabled-state control if not already public.
- Existing tests where the contract already belongs.

---

### Task 1: Indonesian UI Copy and Static Accessibility Labels

**Files:**
- Create: `js/core/ui-copy.js`
- Modify: `index.html`
- Modify: `js/main.js`
- Modify: `js/grid/grid-architect.js`
- Modify: `js/ui/note-search.js`
- Test: `test/locale.test.js`

**Interfaces:**
- Produces: `UI_COPY`, a frozen nested object imported by all new UI modules.
- Produces: `formatYearTravel(delta, year)` returning an Indonesian toast string.
- Consumes: `TemporalLabels` only for calendar date labels; application copy does not depend on `Intl`.

- [ ] **Step 1: Write failing copy-contract tests**

```js
import { UI_COPY, formatYearTravel } from '../js/core/ui-copy.js';

test('application chrome uses Indonesian copy', () => {
  assert.equal(UI_COPY.dock.today, 'Hari ini');
  assert.equal(UI_COPY.dock.search, 'Cari');
  assert.equal(UI_COPY.dock.menu, 'Menu');
  assert.equal(UI_COPY.loading, 'Menyelaraskan perjalanan waktu…');
});

test('year travel feedback names the destination', () => {
  assert.equal(formatYearTravel(1, 2027), 'Menuju tahun 2027');
  assert.equal(formatYearTravel(-10, 2016), 'Mundur 10 tahun · 2016');
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test test/locale.test.js`  
Expected: FAIL because `js/core/ui-copy.js` does not exist.

- [ ] **Step 3: Add the minimal copy module**

```js
export const UI_COPY = Object.freeze({
  loading: 'Menyelaraskan perjalanan waktu…',
  viewport: 'Grid perjalanan waktu',
  dock: { today: 'Hari ini', search: 'Cari', menu: 'Menu' },
  nav: { previousYear: 'Tahun sebelumnya', nextYear: 'Tahun berikutnya' },
  search: {
    label: 'Cari catatan',
    prompt: 'Ketik untuk mencari catatan dan suasana',
    empty: 'Belum ada hari yang tercatat',
    noResults: 'Tidak ada catatan yang cocok',
  },
});

export function formatYearTravel(delta, year) {
  if (Math.abs(delta) === 1) return `Menuju tahun ${year}`;
  return `${delta < 0 ? 'Mundur' : 'Maju'} ${Math.abs(delta)} tahun · ${year}`;
}
```

- [ ] **Step 4: Replace English static and runtime labels**

Use `UI_COPY` in `GridArchitect` and `NoteSearch`. Change `index.html` labels for loading, previous/next year, shortcut words, and main landmark to Indonesian. Do not translate key names such as `Space`; expose them as `<kbd>` values with Indonesian action text.

- [ ] **Step 5: Run locale and full tests**

Run: `node --test test/locale.test.js`  
Expected: PASS.

Run: `npm test`  
Expected: all tests PASS.

- [ ] **Step 6: Commit the copy foundation**

```bash
git add index.html js/core/ui-copy.js js/main.js js/grid/grid-architect.js js/ui/note-search.js test/locale.test.js
git commit -m "feat: localize TRACE application chrome"
```

---

### Task 2: Adaptive Dock State and UI

**Files:**
- Create: `js/ui/adaptive-dock.js`
- Create: `test/adaptive-dock.test.js`
- Modify: `index.html`
- Modify: `assets/styles.css`
- Modify: `js/config/odyssey-config.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `{ onToday, onSearch, onMenu, idleMs, target, coarseQuery }`.
- Produces: `show(reason)`, `hide()`, `pin()`, `unpin()`, `destroy()`, and `element`.
- Emits actions only through constructor callbacks; it does not import `GridArchitect`.

- [ ] **Step 1: Write failing dock behavior tests**

```js
test('intent reveals the dock and idle hides it', async () => {
  const dock = new AdaptiveDock({
    target: window, idleMs: 10, coarseQuery: '(pointer: fine)',
    onToday() {}, onSearch() {}, onMenu() {},
  });
  window.dispatchEvent(new window.PointerEvent('pointermove'));
  assert.equal(dock.element.classList.contains('is-visible'), true);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(dock.element.classList.contains('is-visible'), false);
});

test('pinned dock does not hide on idle', async () => {
  const dock = makeDock({ idleMs: 10 });
  dock.pin();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(dock.element.classList.contains('is-visible'), true);
});
```

Add `PointerEvent` to the jsdom helper globals if required.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test test/adaptive-dock.test.js`  
Expected: FAIL because `AdaptiveDock` is not defined.

- [ ] **Step 3: Implement the dock controller**

```js
export class AdaptiveDock {
  #el;
  #timer = null;
  #pins = 0;
  #idleMs;

  constructor({ target = window, idleMs, onToday, onSearch, onMenu }) {
    this.#idleMs = idleMs;
    this.#el = document.getElementById('adaptive-dock');
    this.#el.querySelector('[data-action="today"]').addEventListener('click', onToday);
    this.#el.querySelector('[data-action="search"]').addEventListener('click', onSearch);
    this.#el.querySelector('[data-action="menu"]').addEventListener('click', onMenu);
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'focusin']) {
      target.addEventListener(type, () => this.show(type), { passive: true });
    }
  }

  show() {
    clearTimeout(this.#timer);
    this.#el.classList.add('is-visible');
    if (!this.#pins) this.#timer = setTimeout(() => this.hide(), this.#idleMs);
  }
  hide() { if (!this.#pins) this.#el.classList.remove('is-visible'); }
  pin() { this.#pins += 1; this.show('pin'); }
  unpin() { this.#pins = Math.max(0, this.#pins - 1); this.show('unpin'); }
  get element() { return this.#el; }
}
```

Keep listener references so `destroy()` can remove them.

- [ ] **Step 4: Add semantic dock markup and styling**

Add a `<nav id="adaptive-dock" aria-label="Tindakan utama">` containing three
real buttons. Style it as a bottom-centered glass pill, hidden with opacity and
transform only, inside safe-area bounds. Under `(pointer: coarse)`, reveal it on
the first tap rather than displaying keyboard hints.

- [ ] **Step 5: Compose it in `main.js`**

Instantiate after `GridArchitect` and wire:

```js
new AdaptiveDock({
  idleMs: OdysseyConfig.timing.dockIdleMs,
  onToday: () => grid.jumpToToday(),
  onSearch: () => grid.openSearch(),
  onMenu: () => menu.open(),
});
```

Change the `safe('GridArchitect', …)` call to retain the returned instance.

- [ ] **Step 6: Run tests and commit**

Run: `node --test test/adaptive-dock.test.js test/shortcuts.test.js`  
Expected: PASS.

Run: `npm test`  
Expected: all tests PASS.

```bash
git add index.html assets/styles.css js/config/odyssey-config.js js/main.js js/ui/adaptive-dock.js test/adaptive-dock.test.js test/helpers/dom.js
git commit -m "feat: add adaptive Zero UI dock"
```

---

### Task 3: First-Run Onboarding

**Files:**
- Create: `js/ui/onboarding.js`
- Create: `test/onboarding.test.js`
- Modify: `assets/styles.css`
- Modify: `js/config/odyssey-config.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `{ storage, storageKey, onOpen, onClose }`.
- Produces: `showFirstRun()`, `open()`, `close()`, `start()`, `isOpen()`,
  `hasCompleted`.
- `showFirstRun()` returns `true` only when it opens the dialog.

- [ ] **Step 1: Write failing first-run tests**

```js
test('first visit opens onboarding and completion persists', () => {
  const onboarding = makeOnboarding();
  assert.equal(onboarding.showFirstRun(), true);
  document.querySelector('[data-action="start"]').click();
  assert.equal(localStorage.getItem('trace-onboarding-v1'), 'complete');
});

test('return visit stays ambient but Help can reopen onboarding', () => {
  localStorage.setItem('trace-onboarding-v1', 'complete');
  const onboarding = makeOnboarding();
  assert.equal(onboarding.showFirstRun(), false);
  onboarding.open();
  assert.equal(document.querySelector('.onboarding').open, true);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test test/onboarding.test.js`  
Expected: FAIL because `Onboarding` does not exist.

- [ ] **Step 3: Implement the native-dialog onboarding**

Build one dialog with title, four concise explanatory items, **Mulai
menjelajah**, and a close control for replay mode. Catch storage reads/writes;
storage failure must not throw or block `close()`.

```js
showFirstRun() {
  try {
    if (this.#storage.getItem(this.#key) === 'complete') return false;
  } catch {}
  this.open();
  return true;
}
```

- [ ] **Step 4: Style onboarding in the existing floating-surface system**

Reuse glass tokens, `::backdrop`, focus styles, reduced-transparency behavior,
and the existing dialog transition. Use readable 14–16 px body copy.

- [ ] **Step 5: Compose and pin the dock while onboarding is open**

Pass `onOpen: () => dock.pin()` and `onClose: () => dock.unpin()`. Invoke
`showFirstRun()` after the boot sequence has revealed the grid.

- [ ] **Step 6: Run tests and commit**

Run: `node --test test/onboarding.test.js`  
Expected: PASS.

Run: `npm test`  
Expected: all tests PASS.

```bash
git add assets/styles.css js/config/odyssey-config.js js/main.js js/ui/onboarding.js test/onboarding.test.js
git commit -m "feat: guide first time TRACE users"
```

---

### Task 4: Application Menu and Year Context

**Files:**
- Create: `js/ui/app-menu.js`
- Create: `js/ui/year-context.js`
- Create: `test/app-menu.test.js`
- Create: `test/year-context.test.js`
- Modify: `assets/styles.css`
- Modify: `js/main.js`
- Modify: `js/grid/grid-architect.js`

**Interfaces:**
- `AppMenu` consumes `{ onTheme, onAudio, onLayout, onData, onHelp, onOpen, onClose }`.
- `YearContext` consumes `{ onPrevious, onNext }` and produces `setYear(year)`.
- `GridArchitect` produces `currentYear`, `navigateYears(delta)`,
  `onYearChange(callback)`, `openSearch()`, and `setLayout(mode)`.

- [ ] **Step 1: Write failing menu and year-context tests**

```js
test('menu exposes every formerly hidden primary action', () => {
  const calls = [];
  const menu = makeMenu(calls);
  menu.open();
  for (const action of ['theme', 'audio', 'layout', 'data', 'help']) {
    document.querySelector(`[data-action="${action}"]`).click();
  }
  assert.deepEqual(calls, ['theme', 'audio', 'layout', 'data', 'help']);
});

test('year context updates without rebuilding itself', () => {
  const context = new YearContext({ onPrevious() {}, onNext() {} });
  context.setYear(2026);
  assert.equal(context.element.querySelector('[aria-current="true"]').textContent, '2026');
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test test/app-menu.test.js test/year-context.test.js`  
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Expose narrow public grid APIs**

```js
get currentYear() { return this.#currentYear(); }
openSearch() { this.#search.open(); }
navigateYears(delta) { this.#navigateYear(delta); }
setLayout(mode) { this.#setMode(mode === 'dynamic'); }
onYearChange(callback) {
  this.#yearListeners.add(callback);
  callback(this.currentYear);
  return () => this.#yearListeners.delete(callback);
}
```

Publish only when the rounded active year changes.

- [ ] **Step 4: Implement `YearContext`**

Render previous, active, and next year as three buttons/text elements. Previous
and next call the supplied callbacks; active carries `aria-current="true"`.

- [ ] **Step 5: Implement `AppMenu`**

Use a native dialog with grouped buttons and current-state text for theme,
audio, and layout. Close after one-shot actions; keep it open when entering the
Data subsection in Task 8.

- [ ] **Step 6: Compose callbacks**

Wire theme to `theme.toggle()`, audio to `audio.toggleMaster()`, layout to
`grid.setLayout(mode)`, Help to `onboarding.open()`, and year actions to
`grid.navigateYears(-1|1)`.

- [ ] **Step 7: Run tests and commit**

Run: `node --test test/app-menu.test.js test/year-context.test.js test/shortcuts.test.js`  
Expected: PASS.

Run: `npm test`  
Expected: all tests PASS.

```bash
git add assets/styles.css js/main.js js/grid/grid-architect.js js/ui/app-menu.js js/ui/year-context.js test/app-menu.test.js test/year-context.test.js
git commit -m "feat: expose TRACE navigation and settings"
```

---

### Task 5: Responsive Rebuild and Temporal Restoration

**Files:**
- Create: `js/grid/responsive-layout.js`
- Create: `test/responsive-layout.test.js`
- Modify: `js/config/odyssey-config.js`
- Modify: `js/grid/grid-architect.js`
- Modify: `js/grid/day-focus.js`
- Modify: `assets/styles.css`

**Interfaces:**
- Produces: `classifyViewportChange(previous, next, thresholds)` returning
  `'none' | 'height-only' | 'structural'`.
- Produces: `captureResponsiveState({ year, focusedDate, yearOffset })`.
- `GridArchitect.reflowForViewport()` preserves active year and focused date.
- `GridArchitect.focusDate(date)` navigates to and focuses a date.
- `GridArchitect.focusedDate` returns the focus controller's cloned date.
- `DayFocus.focusedDate` returns a cloned `Date` or `null`.

- [ ] **Step 1: Write failing pure responsive tests**

```js
test('orientation and breakpoint changes are structural', () => {
  assert.equal(classifyViewportChange(
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { widthPx: 24, heightPx: 80, breakpoint: 600 }
  ), 'structural');
});

test('small mobile browser chrome movement does not rebuild', () => {
  assert.equal(classifyViewportChange(
    { width: 390, height: 844 },
    { width: 390, height: 805 },
    { widthPx: 24, heightPx: 80, breakpoint: 600 }
  ), 'none');
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test test/responsive-layout.test.js`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure classification and state capture**

```js
export function classifyViewportChange(a, b, t) {
  const crossed = (a.width < t.breakpoint) !== (b.width < t.breakpoint);
  const rotated = (a.width > a.height) !== (b.width > b.height);
  if (crossed || rotated || Math.abs(a.width - b.width) >= t.widthPx) return 'structural';
  if (Math.abs(a.height - b.height) >= t.heightPx) return 'height-only';
  return 'none';
}
```

- [ ] **Step 4: Add `GridArchitect.reflowForViewport()`**

Capture:

```js
const state = {
  year: this.currentYear,
  focusedDate: this.#focus.focusedDate,
  offset: this.#viewport.scrollTop % this.#yearHeight,
};
```

Cancel active smooth motion, update `#yearHeight`, canvas height, and scroll
position, release active year blocks through the pool, render the captured
year, then restore the focused date if present. Debounce `resize` through
`requestAnimationFrame`.

- [ ] **Step 5: Add dedicated mobile and landscape CSS**

Keep seven columns below 600 px, locate the dock and edge arrows inside
safe-area bounds, hide keyboard hints for coarse pointers, and prevent
horizontal overflow. Do not shrink functional text below Task 7 minima.

- [ ] **Step 6: Run responsive and renderer tests**

Run: `node --test test/responsive-layout.test.js test/grid-renderer.test.js test/day-focus.test.js`  
Expected: PASS.

Run: `npm test`  
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add assets/styles.css js/config/odyssey-config.js js/grid/responsive-layout.js js/grid/grid-architect.js js/grid/day-focus.js test/responsive-layout.test.js test/day-focus.test.js
git commit -m "fix: preserve temporal context across resize"
```

---

### Task 6: Reliable Persistence Feedback

**Files:**
- Modify: `js/systems/day-store.js`
- Create: `test/day-store-persistence.test.js`
- Modify: `test/helpers/dom.js`

**Interfaces:**
- `DayStore.onPersistence(callback)` emits `{ ok, error }`.
- `flush()` returns `{ ok: boolean, error?: Error }`.
- Existing `setNote`, `setMood`, `clear`, `merge`, and `onChange` contracts remain compatible.

- [ ] **Step 1: Write failing success and failure tests**

```js
test('flush reports successful persistence', () => {
  const store = new DayStore();
  const states = [];
  store.onPersistence((state) => states.push(state));
  store.setNote('2026-07-31', 'catatan');
  assert.equal(store.flush().ok, true);
  assert.equal(states.at(-1).ok, true);
});

test('quota failure remains in memory and reports failure', () => {
  localStorage.setItem = () => { throw new DOMException('Penuh', 'QuotaExceededError'); };
  const store = new DayStore();
  const states = [];
  store.onPersistence((state) => states.push(state));
  store.setMood('2026-07-31', 'good');
  assert.equal(store.get('2026-07-31').mood, 'good');
  assert.equal(states.at(-1).ok, false);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test test/day-store-persistence.test.js`  
Expected: FAIL because persistence outcomes are not observable.

- [ ] **Step 3: Return and emit write outcomes**

```js
#writeNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.#data]));
    return this.#emitPersistence({ ok: true });
  } catch (error) {
    return this.#emitPersistence({ ok: false, error });
  }
}
```

Keep in-memory data unchanged on failure. Make `flush()` return the most recent
outcome even when no timer is pending.

- [ ] **Step 4: Run store tests and commit**

Run: `node --test test/day-store.test.js test/day-store-persistence.test.js`  
Expected: PASS.

Run: `npm test`  
Expected: all tests PASS.

```bash
git add js/systems/day-store.js test/day-store-persistence.test.js test/helpers/dom.js
git commit -m "feat: report local persistence outcomes"
```

---

### Task 7: Readable and Safer Day Panel

**Files:**
- Modify: `js/ui/day-panel.js`
- Modify: `assets/styles.css`
- Modify: `test/day-panel-ui.test.js`

**Interfaces:**
- Consumes: `store.onPersistence(callback)` from Task 6.
- Constructor accepts `{ onClose, confirmDelete }`.
- Mood buttons expose visible `.mood-label` text and retain `aria-pressed`.

- [ ] **Step 1: Add failing panel tests**

```js
test('moods have visible text labels', () => {
  const { dialog } = open('');
  assert.deepEqual(
    [...dialog.querySelectorAll('.mood-label')].map((el) => el.textContent),
    ['Luar Biasa', 'Baik', 'Biasa', 'Kurang', 'Buruk']
  );
});

test('delete is disabled for an empty day', () => {
  const { dialog } = open('');
  assert.equal(dialog.querySelector('.day-panel-delete').disabled, true);
});

test('non-empty delete requires confirmation', () => {
  let confirmations = 0;
  const { dialog } = openWithOptions('catatan', {
    confirmDelete: () => { confirmations += 1; return false; },
  });
  dialog.querySelector('.day-panel-delete').click();
  assert.equal(confirmations, 1);
  assert.equal(dialog.querySelector('textarea').value, 'catatan');
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test test/day-panel-ui.test.js`  
Expected: FAIL on labels, disabled state, and confirmation.

- [ ] **Step 3: Implement labelled moods and safe delete**

Each mood button contains a dot and label. Update Delete availability whenever
note or mood changes. Before clearing non-empty data, call:

```js
const allowed = await Promise.resolve(this.#opts.confirmDelete?.() ?? true);
if (!allowed) return;
```

Use an application-styled confirmation dialog supplied by `main.js`; do not use
`window.confirm`.

- [ ] **Step 4: Add save status and formatting hint**

Append `.day-panel-save-status` with `role="status"` and a compact hint:
`**tebal** · *miring* · daftar dengan - atau 1.`. On input show
`Menyimpan…`; on persistence success show `Tersimpan otomatis`; on failure show
`Tidak dapat menyimpan di browser ini`.

- [ ] **Step 5: Fix panel positioning and mobile bottom sheet**

Restore centered dialog margins explicitly because the global reset removes
user-agent dialog margins. At max-width 600 px, anchor it to the bottom, use
safe-area padding, full available width, rounded top corners, and reachable
actions in landscape.

- [ ] **Step 6: Raise readability floors**

Set `.info-meta` to `clamp(9px, 0.8dvh, 10px)`, functional microcopy/buttons to
at least 12 px, and increase muted-text contrast using theme tokens. Preserve
past-day hierarchy and forced-colors overrides.

- [ ] **Step 7: Run tests and commit**

Run: `node --test test/day-panel-ui.test.js test/styles.test.js`  
Expected: PASS.

Run: `npm test`  
Expected: all tests PASS.

```bash
git add assets/styles.css js/ui/day-panel.js test/day-panel-ui.test.js test/styles.test.js
git commit -m "feat: make daily recording clear and safe"
```

---

### Task 8: Search Empty States and Data Management

**Files:**
- Create: `js/ui/data-actions.js`
- Create: `test/data-actions.test.js`
- Modify: `js/ui/app-menu.js`
- Modify: `js/ui/note-search.js`
- Modify: `js/systems/day-store.js`
- Modify: `test/note-search-ui.test.js`
- Modify: `test/day-archive.test.js`
- Modify: `assets/styles.css`
- Modify: `js/main.js`

**Interfaces:**
- Produces: `validateArchive(value)` returning normalized entries or throwing `ArchiveError`.
- Produces: `summarizeMerge(existingEntries, incomingEntries)` returning
  `{ imported, preserved, skipped, entries }`.
- `DataActions.open()` displays recorded count and import/export actions.
- `DayStore.merge(entries)` returns `{ changed, preserved, skipped }`.

- [ ] **Step 1: Write failing archive validation tests**

```js
test('invalid archive is rejected before mutation', () => {
  assert.throws(
    () => validateArchive({ version: 1, days: [['not-a-date', { note: 'x' }]] }),
    { name: 'ArchiveError' }
  );
});

test('merge summary distinguishes changed and preserved days', () => {
  const summary = summarizeMerge(
    [['2026-07-30', { note: 'lama', mood: '' }]],
    [
      ['2026-07-30', { note: 'lama', mood: '' }],
      ['2026-07-31', { note: 'baru', mood: 'good' }],
    ]
  );
  assert.deepEqual(
    { imported: summary.imported, preserved: summary.preserved, skipped: summary.skipped },
    { imported: 1, preserved: 1, skipped: 0 }
  );
});
```

- [ ] **Step 2: Add failing search-state tests**

```js
test('empty store is different from no matching result', () => {
  const search = openSearch(storeOf([]));
  assert.match(search.status.textContent, /Belum ada hari/);
  storeWithOneDay(search.store);
  search.input.value = 'tidak ditemukan';
  fire(search.input, 'input');
  assert.match(search.status.textContent, /Tidak ada catatan yang cocok/);
});
```

- [ ] **Step 3: Verify failures**

Run: `node --test test/data-actions.test.js test/note-search-ui.test.js`  
Expected: FAIL on missing module and indistinguishable search state.

- [ ] **Step 4: Implement strict validation and summary**

Validate archive version, outer structure, ISO date keys through
`DayStore.dateOf`, note type, and mood membership. Construct a normalized array
before calling `store.merge`; never mutate during validation.

- [ ] **Step 5: Implement the Data surface**

Show:

- `${store.size} hari tercatat`
- `Data tersimpan hanya di browser ini`
- `Ekspor data`
- `Impor data`

Use the existing download/file-input archive mechanism. Report import result:
`1 diperbarui · 3 dipertahankan · 0 dilewati`. Report invalid input through
the toast and inline `role="alert"` without closing the surface.

- [ ] **Step 6: Update search statuses**

Check `store.size` before query state. For results, use
`${count} hasil · ↑↓ pilih · Enter buka`; retain `aria-live` and
`aria-activedescendant`.

- [ ] **Step 7: Run tests and commit**

Run: `node --test test/data-actions.test.js test/note-search-ui.test.js test/day-archive.test.js`  
Expected: PASS.

Run: `npm test`  
Expected: all tests PASS.

```bash
git add assets/styles.css js/main.js js/ui/app-menu.js js/ui/data-actions.js js/ui/note-search.js js/systems/day-store.js test/data-actions.test.js test/note-search-ui.test.js test/day-archive.test.js
git commit -m "feat: expose search and local data management"
```

---

### Task 9: Integration, Accessibility, and Visual Verification

**Files:**
- Create: `test/ux-flow.test.js`
- Modify: `test/styles.test.js`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `.gitignore`
- Modify other files only when verification finds a scoped defect.

**Interfaces:**
- Consumes all public contracts from Tasks 1–8.
- Test-only `bootTestApp(options)` composes real controllers with stub
  audio/particles and returns `{ onboarding, dock, grid, dayPanel, store,
  resizeTo(width, height) }`.
- Produces no new runtime API.

- [ ] **Step 1: Build the test-only composition harness**

```js
function bootTestApp({ width = 1440, height = 900 } = {}) {
  installTraceDom();
  setViewport(width, height);
  const store = new DayStore();
  const dayPanel = new DayPanel(store, { confirmDelete: () => true });
  const grid = createGridHarness({ store, dayPanel });
  const onboarding = new Onboarding({
    storage: localStorage,
    storageKey: 'trace-onboarding-v1',
  });
  const dock = new AdaptiveDock({
    target: window,
    idleMs: 50,
    onToday: () => grid.jumpToToday(),
    onSearch: () => grid.openSearch(),
    onMenu() {},
  });
  return {
    store, dayPanel, grid, onboarding, dock,
    resizeTo(w, h) { setViewport(w, h); grid.reflowForViewport(); },
  };
}
```

`createGridHarness` must use the real `GridArchitect` with the existing
audio/particle stubs and deterministic date injection already used by grid
tests; it must not reimplement grid navigation.

- [ ] **Step 2: Add integration tests for the primary journey**

```js
test('first run can discover and record a day', async () => {
  const app = bootTestApp();
  assert.equal(app.onboarding.isOpen(), true);
  app.onboarding.start();
  app.dock.show('test');
  app.dock.element.querySelector('[data-action="today"]').click();
  app.dayPanel.open(new Date(2026, 6, 31));
  const textarea = document.querySelector('.day-panel-note');
  textarea.value = 'Hari yang baik';
  fire(textarea, 'input');
  app.store.flush();
  assert.equal(app.store.get('2026-07-31').note, 'Hari yang baik');
});

test('responsive reflow retains active year and focused date', () => {
  const app = bootTestApp({ width: 1440, height: 900 });
  app.grid.focusDate(new Date(2026, 6, 31));
  app.resizeTo(390, 844);
  assert.equal(app.grid.currentYear, 2026);
  assert.equal(DayStore.keyOf(app.grid.focusedDate), '2026-07-31');
});
```

Keep the harness minimal: substitute audio/particles and exercise real UI
controllers plus the real store.

- [ ] **Step 3: Extend structural CSS tests**

Assert presence of:

- Dock safe-area placement
- Mobile bottom-sheet breakpoint
- 9 px minimum `.info-meta`
- 12 px functional copy
- Reduced-motion and reduced-transparency coverage for new surfaces
- Forced-colors borders for dock/menu/onboarding

- [ ] **Step 4: Run the complete automated suite**

Run: `npm test`  
Expected: all tests PASS with no unhandled jsdom errors.

- [ ] **Step 5: Start the application for browser QA**

Run: `npm start`  
Expected: server available at `http://127.0.0.1:8000`.

- [ ] **Step 6: Verify desktop 1440 × 900**

Check dark and light themes:

- First-run onboarding is centered, readable, and keyboard trapped.
- Dock appears on intent and fades after idle.
- Year context matches the active grid year.
- Day panel is centered and exposes labelled moods and persistence status.
- Search and Data surfaces have correct empty/success/error states.
- No console errors or horizontal overflow.

- [ ] **Step 7: Verify mobile portrait 390 × 844**

Check:

- Fresh load and desktop-to-mobile resize both show seven usable columns.
- Dock and edge navigation do not obscure primary date content.
- Day panel is a bottom sheet with reachable actions.
- All primary features are reachable without a hardware keyboard.
- Safe-area padding and 44 px targets are present.

- [ ] **Step 8: Verify mobile landscape 844 × 390**

Check that dialogs scroll internally, action buttons remain reachable, grid
context is retained through rotation, and no keyboard-only hint is shown for a
coarse pointer.

- [ ] **Step 9: Verify accessibility preferences**

Emulate reduced motion, reduced transparency, and forced colors. Tab through
onboarding → dock → menu → grid → day panel → search. Verify visible focus,
Indonesian accessible names, correct modal focus restoration, and no
color-only mood meaning.

- [ ] **Step 10: Update documentation and ignore mockup state**

Update `README.md` interaction instructions and `ARCHITECTURE.md` component map.
Add `.superpowers/` to `.gitignore` so brainstorming screens are not committed.

- [ ] **Step 11: Re-run final verification**

Run: `npm test`  
Expected: all tests PASS.

Run: `git diff --check`  
Expected: no whitespace errors.

- [ ] **Step 12: Commit verification and documentation**

```bash
git add .gitignore README.md ARCHITECTURE.md test/ux-flow.test.js test/styles.test.js
git commit -m "test: verify TRACE UX UI journey"
```

## Completion Gate

Before claiming completion:

1. Run `npm test` from a clean command invocation.
2. Confirm browser QA at all three target viewports.
3. Inspect `git status --short` and ensure pre-existing user changes are
   preserved and not accidentally included in task commits.
4. Review the final diff against every acceptance criterion in
   `docs/superpowers/specs/2026-07-31-trace-ux-ui-improvements-design.md`.
