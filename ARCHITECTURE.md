# Architecture

TRACE is plain ES modules loaded straight from `index.html` — no bundler, no
build step, no runtime dependencies. `index.html` is markup only; the
stylesheet lives in `assets/styles.css`, and every module under `js/` owns
one job.

> The plugin/`TraceEngine` system described in earlier documents no longer
> exists. Those documents are kept in [`archive/docs/`](./archive/docs/) for
> historical reference only.

## Boot

`js/main.js` is the entry point. It validates the config shape, then builds
each subsystem inside a `safe()` wrapper so one failing subsystem degrades
instead of taking the page down. Audio and particles fall back to a shared
no-op stub, which is why the grid still works without WebGL or an AudioContext.

```
main.js
  └── GridArchitect ── orchestrates rendering, input, and navigation
        ├── SmoothScroll     scroll physics + programmatic travel
        ├── GridPool         recycles year blocks
        ├── DayFocus         focused day + roving tabindex
        ├── IonCursor        smoothed pointer position → CSS vars
        ├── YearNavigator    edge buttons
        ├── DayStore         per-day notes and moods (localStorage)
        ├── DayPanel         modal editor for one day
        ├── DateJumper       jump-to-date command box
        ├── NoteSearch       ranked search over recorded days
        └── PositionScrubber right-edge minimap
```

`GridArchitect` is still the largest module because it is the only place that
knows how scroll position, rendering, and focus relate. What it delegates is
anything that can be described without that context: pure date arithmetic,
gesture maths, focus bookkeeping, and every self-contained widget.

## Directory map

| Path | Responsibility |
| --- | --- |
| `js/config/odyssey-config.js` | Every tunable constant. No logic. |
| `js/core/locale.js` | Month/weekday names from `Intl`, resolved once. |
| `js/core/color.js` | Resolves CSS colours to RGB for WebGL. |
| `js/core/date-utils.js` | Calendar arithmetic, parsing, formatting. Pure. |
| `js/core/rich-text.js` | Note formatting: parses to blocks, renders to DOM. |
| `js/core/gesture-math.js` | Wheel/fling arithmetic, separate from listeners. Pure. |
| `js/core/event-hub.js` | Long-press and scroll-settle detectors. |
| `js/core/motion.js` | `prefers-reduced-motion` queries. |
| `js/core/scroll-easing.js` | Easing and travel-time curves. Pure. |
| `js/core/smooth-scroll.js` | Inertia loop, eased jumps, snap-to-year. |
| `js/grid/grid-architect.js` | Orchestrator: input, rendering cadence, navigation. |
| `js/grid/grid-renderer.js` | Pure functions that produce grid markup. |
| `js/grid/day-focus.js` | Focused day and the roving tabindex. |
| `js/grid/grid-pool.js` | Year-block reuse. |
| `js/systems/particle-core.js` | Shaders and the particle simulation. |
| `js/systems/particle-engine.js` | Main-thread owner; prefers the worker. |
| `js/systems/particle-worker.js` | Same simulation on an OffscreenCanvas. |
| `js/systems/galactic-audio.js` | Facade: enabled/busy state and activation. |
| `js/systems/audio/asset-manifest.js` | Which clip, which file, which priority. |
| `js/systems/audio/asset-loader.js` | Fetch + decode on demand, deduplicated. |
| `js/systems/audio/audio-graph.js` | Bus graph, limiter, voice lifecycle. |
| `js/systems/audio/mix.js` | Level, bus, detune and fade per clip. Pure. |
| `js/systems/audio/idle-scheduler.js` | Ambient clips once the user goes quiet. |
| `js/core/concurrency.js` | Bounded-parallelism task runner. Pure. |
| `js/systems/day-store.js` | Persistence for notes and moods, indexed by year. |
| `js/systems/day-archive.js` | Import/export of the day log. Parsing is pure. |
| `js/systems/day-search.js` | Ranked full-text search over notes and moods. Pure. |
| `js/systems/day-pulse.js` | Publishes `--day-progress`; reports midnight. |
| `js/ui/*` | Self-contained widgets. |

## The rendering model

The canvas is `totalYears × viewportHeight` tall and only a few year blocks
exist at any time.

1. **Virtualisation.** `#render()` draws the year at the current scroll index
   plus neighbours. An `IntersectionObserver` releases blocks that drift more
   than two years away back into `GridPool`.
2. **Two fidelities.** While scrolling fast, a year renders as date-only cells;
   once motion settles, `#enrichYearBlock` upgrades them to full labels. Both
   forms carry identical `data-*` attributes — click focus, keyboard navigation
   and mood markers all depend on them.
3. **One parse per year.** A year block is built as a single HTML string
   (~400 cells) rather than one `innerHTML` write per cell.
4. **Time is an integer.** Each cell compares one number (`20260727`) against
   today's, which is how past / today / future is decided without allocating a
   `Date` or building a string per cell.
5. **Compositor-first effects.** Parallax runs on a scroll-driven
   `animation-timeline: view()`; the cursor glow and chromatic aberration are
   CSS custom properties written at most once per frame.

## Leaning on the platform

Where a browser API does the job, it replaces hand-written code rather than
sitting next to it:

| Concern | Platform feature | What it replaced |
| --- | --- | --- |
| Modals | `<dialog>.showModal()` | Focus trap, Escape handling, backdrop, z-index, focus restore |
| Modal animation | `@starting-style` + `allow-discrete` | `setTimeout` choreography |
| Theme switch | `document.startViewTransition()` | An opaque veil on nested timers |
| Month/day names | `Intl.DateTimeFormat` | Four hand-maintained arrays |
| Colour parsing | Canvas 2D `fillStyle` | Per-syntax regex parsing |
| Fetch deadlines | `AbortSignal.timeout()` | Nothing — requests could hang forever |

Each has a fallback where support is not universal: theme switching still uses
`#theme-veil`, and colour parsing still has hex/`rgb()` regexes.

## Audio

One signal chain, with the stages kept apart so they cannot fight:

```
one-shots ─▶ sfx ────┐
ambient   ─▶ ambient ┼─▶ duck ─▶ master ─▶ limiter ─▶ destination
spatial   ─▶ panner ─┘
```

- **master** is the user's volume, toggled with `M`.
- **duck** is what a jump pulls down, so it no longer competes with master.
- **sfx** carries the engine, which rides pointer speed.
- **limiter** is a safety net: stacked one-shots would otherwise clip.

`mix.js` is the only place that says how loud anything is. Voices release
their nodes on `ended`, loops fade rather than cut, and each voice takes a
few cents of random detune so repeats do not sound mechanical.

## Accessibility contract

Changing the markup means keeping these intact:

- **Grid semantics.** `role="grid"` → `role="row"` → `role="gridcell"`. The row
  wrappers are `display: contents` so the cells remain direct CSS-grid items.
- **Roving tabindex.** Exactly one cell carries `tabindex="0"` so `Tab` can
  reach the calendar; it follows focus. Everything else is `tabindex="-1"`.
- **Filler cells** are `aria-hidden` and carry no date data.
- **Reduced motion** disables particles, cursor smoothing, chromatic
  aberration, and scroll easing.

## Colour

The palette is defined in OKLCH inside `light-dark()`. Two consequences:

- Mixing and gradient interpolation use `oklab`, so ramps stay perceptually
  even instead of dipping through grey.
- The particle system needs real RGB, and `getComputedStyle` returns custom
  properties as unresolved text. `js/core/color.js` splits `light-dark()`
  itself, then hands the branch to a canvas 2D context — the browser's own
  parser — so any colour syntax resolves without hand-written maths.

## Tests

`npm test` runs `node:test`. Most suites are DOM-free — grid markup, the
particle pool, colour parsing, date and gesture maths, search ranking, the
day store. The rest boot jsdom through `test/helpers/dom.js` to cover
`GridPool`, `DayFocus` (roving tabindex) and the search widget.

Two gaps that helper cannot close, both noted in the file: jsdom ships no
`HTMLDialogElement.showModal`, so the modal behaviour our widgets rely on
(top layer, focus trap, inert background) is shimmed rather than verified;
and it has no layout, so anything depending on measurement is out of scope.
Both still need a real browser. WebGL likewise.
