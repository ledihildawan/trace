import { OdysseyConfig } from '../config/odyssey-config.js';
import { formatYearTravel } from '../core/ui-copy.js';
import { SmoothScroll } from '../core/smooth-scroll.js';
import { LongPressDetector, ScrollEndDetector } from '../core/event-hub.js';
import { prefersReducedMotion } from '../core/motion.js';
import { resolveShortcut } from '../core/shortcuts.js';
import { durationForDistance, durationForSteps } from '../core/scroll-easing.js';
import {
  addMonths,
  daysInYear,
  endOfMonth,
  formatFullDate,
  stampOf,
  shiftDays,
  startOfMonth,
} from '../core/date-utils.js';
import {
  flingVelocity,
  isFling,
  pushSample,
  stepsFromFling,
  stepsFromPixels,
  wheelDeltaToPixels,
} from '../core/gesture-math.js';
import { DayStore, moodColor } from '../systems/day-store.js';
import { downloadArchive, pickArchiveFile } from '../systems/day-archive.js';
import { DayPulse } from '../systems/day-pulse.js';
import { DayPanel } from '../ui/day-panel.js';
import { DateJumper } from '../ui/date-jumper.js';
import { NoteSearch } from '../ui/note-search.js';
import { PositionScrubber } from '../ui/position-scrubber.js';
import { DayFocus } from './day-focus.js';
import { GridPool } from './grid-pool.js';
import { IonCursor } from './cursor.js';
import {
  captureResponsiveState,
  classifyViewportChange,
} from './responsive-layout.js';
import { YearNavigator } from './year-navigator.js';
import {
  buildBlockSkeleton,
  buildGridContainer,
  buildGridLayer,
  buildYearCellsHTML,
  enrichCell,
  findDayCell,
  computeGridCols,
  computeYearOffset,
  isScrollableLayout,
} from './grid-renderer.js';

const DAYS_PER_WEEK = 7;

export class GridArchitect {
  #viewport;
  #canvas;
  #ionDrive;
  #audio;
  #particles;
  #theme;
  #toast;
  #boot;
  #smoothScroll;
  #pool;
  #cursor;
  #navigator;

  #touchActive = false;
  #touchScrollEndWillSnap = false;
  #activeYears = new Map();
  #observer = null;
  #containers = new Map();
  #renderRaf = null;
  #resizeRaf = null;
  #shifting = false;

  #isWarping = false;
  #isAnimating = false;
  #interactionsAllowed = true;
  #unlockTimer = null;
  #lockGeneration = 0;
  #lastRenderTop = -1;
  #lastChroma = 0;
  #settleMs = -1;
  #yearListeners = new Set();
  #publishedYear = null;
  #initialized = false;

  #today = new Date();
  #totalYears;
  #yearHeight;
  #viewportSize;
  #startY;
  #mode = null;

  #focus = null;
  #pendingFocusDate = null;
  #jumper = null;
  #search = null;
  #shortcuts = null;
  #store = new DayStore();
  #panel = null;
  #scrubber = null;
  #pulse = null;

  constructor(deps) {
    this.#viewport = deps.viewport;
    this.#canvas = deps.canvas;
    this.#ionDrive = deps.ionDrive;
    this.#audio = deps.audio;
    this.#particles = deps.particles;
    this.#theme = deps.theme;
    this.#toast = deps.toast;
    this.#boot = deps.boot;

    this.#totalYears = OdysseyConfig.temporal.totalYears;
    this.#yearHeight = window.innerHeight;
    this.#viewportSize = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    this.#startY = (this.#totalYears / 2) * this.#yearHeight;
    this.#mode = OdysseyConfig.display.defaultMode === 'structured';

    this.#focus = new DayFocus(this.#canvas, {
      resolveBlock: (year) => this.#activeYears.get(year),
      today: this.#today,
    });
    this.#pool = new GridPool((year, yPos) => buildBlockSkeleton(year, yPos));
    this.#smoothScroll = new SmoothScroll(this.#viewport, this.#yearHeight)
      .onArrive((scrollTop) => this.#handleArrival(scrollTop))
      .onVelocityChange((velocity) => this.#handleInertiaVelocity(velocity));
    this.#cursor = new IonCursor(this.#ionDrive);
    // Both detectors bind their own listeners on construction and are driven
    // entirely by callbacks, so there is nothing to hold on to afterwards.
    new LongPressDetector().onTrigger(() => this.#handleLongPress());
    new ScrollEndDetector(this.#viewport).onSettle(() => this.#handleTouchSettled());
    this.#navigator = new YearNavigator()
      .onPrev(() => this.#navigateYear(-1))
      .onNext(() => this.#navigateYear(1));
    this.#navigator.reveal();

    this.#panel = new DayPanel(this.#store, {
      onClose: () => this.#focus.restoreFocus(),
    });
    this.#jumper = new DateJumper()
      .onSubmit((date) => this.#travelToDate(date))
      .onReject(() => this.#toast.show('INVALID DATE'));
    this.#search = new NoteSearch(this.#store)
      .onSelect((date) => this.#travelToDate(date));
    this.#store.onChange((key) => this.#refreshDataMarkers(key));
    this.#scrubber = new PositionScrubber(this.#viewport, {
      todayRatio: 0.5,
      onStart: () => this.#smoothScroll.beginTouchDrag(),
      onScrub: (top) => { this.#viewport.scrollTop = top; },
      onEnd: () => this.#smoothScroll.endTouchDrag(),
      onSettle: () => {
        this.#setSettle(OdysseyConfig.display.snapMs);
        this.#smoothScroll.settleToNearest();
      },
    });

    this.#pulse = new DayPulse({ onRollover: (now) => this.#handleDayRollover(now) });

    this.#runBoot();
  }

  async #runBoot() {
    await this.#boot.run(() => this.#initialize());
  }

  #initialize() {
    this.#publishYearHeight();
    this.#canvas.style.height = `${this.#totalYears * this.#yearHeight}px`;
    this.#viewport.scrollTop = this.#startY;

    this.#installIntersectionObserver();
    this.#installEventListeners();
    this.#installKeyShortcuts();
    this.#smoothScroll.startInertia();
    this.#cursor.start();
    this.#pulse.start();
    this.#smoothScroll.syncTo(this.#startY);
    this.#initialized = true;
    this.#publishYearChange();
    this.#render();
    this.#updateNavBounds();
    this.#scrubber?.measure();
    this.#scrubber?.update();
    setTimeout(() => this.jumpToToday(true), OdysseyConfig.timing.jumpInitialDelayMs);
  }

  #installIntersectionObserver() {
    this.#observer = new IntersectionObserver(
      (entries) => this.#handleIntersections(entries),
      { threshold: 0.05, rootMargin: '20% 0px' }
    );
  }

  #handleIntersections(entries) {
    for (const entry of entries) {
      const block = entry.target;
      const year = parseInt(block.dataset.year, 10);
      block.classList.toggle(OdysseyConfig.classes.active, entry.isIntersecting);

      if (entry.isIntersecting) this.#enrichYearBlock(block);
      if (!entry.isIntersecting) {
        const idx = this.#smoothScroll.currentIndex;
        const currentYear = this.#today.getFullYear() + (idx - this.#totalYears / 2);
        if (Math.abs(year - currentYear) > 2) this.#deactivateYearBlock(year, block);
      }
    }
  }

  #deactivateYearBlock(year, block) {
    this.#activeYears.delete(year);
    this.#containers.delete(year);
    this.#observer.unobserve(block);
    this.#pool.release(block);
  }

  // Upgrades a block rendered with date-only cells to fully-labelled ones.
  // Idempotent and self-flagging, so every caller can just call it.
  #enrichYearBlock(block) {
    if (block.dataset.detailed === 'true') return;
    block.dataset.detailed = 'true';

    const C = OdysseyConfig.classes;
    const cells = block.querySelectorAll(`.${C.cell}:not(.${C.enriched}):not(.${C.filler})`);
    cells.forEach((cell) => {
      const month = parseInt(cell.dataset.month, 10);
      const day = parseInt(cell.dataset.day, 10);
      const date = parseInt(cell.dataset.date, 10);
      if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(date)) return;
      cell.classList.add(C.enriched);
      enrichCell(cell, month, day, date, cell.dataset.isMonthStart === 'true');
    });
  }

  #installEventListeners() {
    let lastX = 0;
    let lastY = 0;
    let lastSpatialAt = 0;
    const spatialThrottle = OdysseyConfig.physics.spatialAudioThrottleMs;

    window.addEventListener(
      'pointermove',
      (e) => {
        this.#cursor.setPointer(e.clientX, e.clientY);
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        const velocity = Math.hypot(dx, dy);
        if (velocity > OdysseyConfig.physics.exhaustThreshold) {
          this.#particles.spawn(e.clientX, e.clientY, true);
        }
        this.#audio.injectEnginePower(velocity);
        this.#audio.resetIdleTimer();
        // Pan the spatial bus toward the pointer. Throttled: each update
        // schedules three AudioParam ramps.
        const now = performance.now();
        if (now - lastSpatialAt > spatialThrottle) {
          lastSpatialAt = now;
          this.#audio.updateSpatialPosition(e.clientX, e.clientY);
        }
        lastX = e.clientX;
        lastY = e.clientY;
      },
      { passive: true }
    );

    const glowVar = OdysseyConfig.dom.ionGlowVar;
    const defaultGlow = OdysseyConfig.dom.ionGlowDefault;

    document.addEventListener('mouseover', (e) => {
      if (!this.#interactionsAllowed || this.#isWarping || this.#isAnimating) return;
      const cell = e.target.closest(`.${OdysseyConfig.classes.cell}`);
      if (cell) {
        const isFiller = cell.classList.contains(OdysseyConfig.classes.filler);
        this.#ionDrive.classList.add(OdysseyConfig.classes.active);
        this.#ionDrive.style.setProperty(
          glowVar,
          isFiller ? OdysseyConfig.dom.ionGlowFiller : OdysseyConfig.dom.ionGlowHover
        );
        // A filler day answers quieter and lower: it is not really a day.
        this.#audio.play('hover', isFiller ? { volume: 0.04, playbackRate: 0.5 } : {});
      }
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(`.${OdysseyConfig.classes.cell}`) && this.#interactionsAllowed) {
        this.#ionDrive.classList.remove(OdysseyConfig.classes.active);
        this.#ionDrive.style.setProperty(glowVar, defaultGlow);
      }
    }, { passive: true });

    // Both this and the inertia loop fire in the same frame; the scheduler
    // collapses them into one render pass.
    this.#viewport.addEventListener('scroll', () => {
      this.#scheduleRender();
      if (!this.#smoothScroll.isAnimating() && !this.#isWarping) this.#updateChroma();
    }, { passive: true });

    this.#installWheel();
    this.#installTouch();
    this.#installResizeAndClick();
  }

  #installWheel() {
    this.#viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.#isWarping || this.#touchActive) return;
      const deltaPx = wheelDeltaToPixels(e.deltaY, e.deltaMode, window.innerHeight);
      const steps = stepsFromPixels(deltaPx, this.#yearHeight);
      this.#setSettle(durationForSteps(steps));
      this.#smoothScroll.stepBy(steps);
    }, { passive: false });
  }

  #installTouch() {
    let lastTouchY = 0;
    let samples = [];

    this.#viewport.addEventListener('touchstart', (e) => {
      this.#touchActive = true;
      lastTouchY = e.touches[0].clientY;
      samples = [{ y: lastTouchY, t: performance.now() }];
      this.#touchScrollEndWillSnap = false;
      this.#smoothScroll.beginTouchDrag();
    }, { passive: true });

    this.#viewport.addEventListener('touchmove', (e) => {
      const y = e.touches[0].clientY;
      if (!lastTouchY) { lastTouchY = y; return; }
      const deltaY = lastTouchY - y;
      lastTouchY = y;
      pushSample(samples, { y, t: performance.now() });

      this.#smoothScroll.cancelAnimation();
      this.#smoothScroll.nudge(deltaY);
    }, { passive: true });

    this.#viewport.addEventListener('touchend', () => {
      const velocity = flingVelocity(samples);
      lastTouchY = 0;
      // Brief grace period so a trackpad's momentum wheel events, which arrive
      // right after touchend, do not double-navigate.
      setTimeout(() => { this.#touchActive = false; }, OdysseyConfig.physics.touchSettleMs);

      if (isFling(velocity)) {
        const steps = stepsFromFling(velocity, this.#yearHeight);
        this.#setSettle(durationForSteps(steps));
        this.#smoothScroll.stepBy(steps);
      } else {
        this.#touchScrollEndWillSnap = true;
      }
      this.#smoothScroll.endTouchDrag();
    });
  }

  #installResizeAndClick() {
    window.addEventListener('resize', () => {
      if (this.#resizeRaf !== null) return;
      this.#resizeRaf = requestAnimationFrame(() => {
        this.#resizeRaf = null;
        const next = {
          width: window.innerWidth,
          height: window.innerHeight,
        };
        const change = classifyViewportChange(
          this.#viewportSize,
          next,
          OdysseyConfig.responsive
        );
        if (change !== 'none') this.reflowForViewport();
      });
    });

    document.addEventListener('click', (e) => {
      if (!this.#interactionsAllowed) return;
      this.#particles.spawn(e.clientX, e.clientY, false);
      if (this.#audio.enabled) this.#audio.play('beep');
      const cell = e.target.closest(
        `.${OdysseyConfig.classes.cell}:not(.${OdysseyConfig.classes.filler})`
      );
      // DayFocus picks this up via focusin and syncs state + the tab stop.
      if (cell) cell.focus();
    });

    // Click alone only focuses, which left the panel undiscoverable: people
    // clicked a date, nothing happened, and concluded it was broken. Double
    // click opens it, while a single click stays quiet for browsing.
    this.#canvas.addEventListener('dblclick', (e) => {
      if (!this.#interactionsAllowed) return;
      const cell = e.target.closest(
        `.${OdysseyConfig.classes.cell}:not(.${OdysseyConfig.classes.filler})`
      );
      if (!cell) return;
      e.preventDefault();
      cell.focus();
      this.#openDayPanel();
    });
  }

  #installKeyShortcuts() {
    this.#shortcuts = this.#buildShortcuts();
    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if (this.#panel?.isOpen() || this.#jumper?.isOpen() || this.#search?.isOpen()) return;
      const bare = !(e.ctrlKey || e.metaKey || e.altKey);

      // A focused day cell claims the arrow/home/end/page keys for day-wise motion.
      if (bare && this.#focus.isCellFocused()
        && this.#handleCellNav(e, e.key.toLowerCase())) return;

      const action = resolveShortcut(this.#shortcuts, e);
      if (!action) return;
      if (action.prevent) e.preventDefault();
      action.run(e);
    });
  }

  // Shortcuts as data rather than an if/else ladder: one row per key, and
  // preventDefault is opt-in because T/M/R/S should not swallow anything.
  #buildShortcuts() {
    const leap = OdysseyConfig.display.yearLeapStep;
    const plain = (run) => ({ prevent: false, run });
    const prevent = (run) => ({ prevent: true, run });
    const withCtrl = (run) => ({ prevent: true, combo: true, run });
    const byYear = (sign) => prevent((e) => this.#navigateYear(sign * (e.shiftKey ? leap : 1)));

    return new Map([
      ['t', plain(() => this.#toggleTheme())],
      ['m', plain(() => this.#toggleAudio())],
      ['r', plain(() => this.#setMode(true))],
      ['s', plain(() => this.#setMode(false))],
      ['e', prevent(() => this.#exportDays())],
      ['i', prevent(() => this.#importDays())],
      ['f', prevent(() => this.#focusDate(this.#today))],
      ['g', prevent(() => this.#jumper.open())],
      ['/', prevent(() => this.#search.open())],
      ['z', withCtrl(() => this.#undoDayEdit())],
      ['[', prevent(() => this.#travelToRecorded(-1))],
      [']', prevent(() => this.#travelToRecorded(1))],
      [' ', prevent(() => this.jumpToToday())],
      ['home', prevent(() => this.#jumpToEdge(0))],
      ['end', prevent(() => this.#jumpToEdge(this.#totalYears - 1))],
      ['arrowup', byYear(-1)],
      ['pageup', byYear(-1)],
      ['arrowdown', byYear(1)],
      ['pagedown', byYear(1)],
    ]);
  }

  #toggleTheme() {
    this.#audio.play('theme');
    this.#theme.toggle();
  }

  #toggleAudio() {
    const on = this.#audio.toggleMaster();
    this.#toast.show(on ? 'ION DRIVE ONLINE' : 'SILENT CRUISE');
  }

  // ── Keyboard day navigation (WAI-ARIA grid pattern) ──

  #handleCellNav(e, k) {
    const date = this.#focus.date;
    if (!date) return false;
    let next = null;
    switch (k) {
      case 'arrowright': next = shiftDays(date, 1); break;
      case 'arrowleft': next = shiftDays(date, -1); break;
      case 'arrowdown': next = shiftDays(date, DAYS_PER_WEEK); break;
      case 'arrowup': next = shiftDays(date, -DAYS_PER_WEEK); break;
      case 'home': next = startOfMonth(date); break;
      case 'end': next = endOfMonth(date); break;
      case 'pageup': next = addMonths(date, -1); break;
      case 'pagedown': next = addMonths(date, 1); break;
      case 'enter':
      case ' ':
        e.preventDefault();
        this.#openDayPanel();
        return true;
      case 'escape':
        e.preventDefault();
        document.activeElement?.blur();
        return true;
      default:
        return false;
    }
    e.preventDefault();
    this.#focusDate(next);
    return true;
  }


  #focusDate(date) {
    this.#focus.date = date;
    const year = date.getFullYear();
    const block = this.#activeYears.get(year);
    if (block && block.dataset.detailed === 'true') {
      this.#focus.focusIn(block, date);
      return;
    }
    // Target year isn't rendered yet — travel there and focus on arrival.
    this.#pendingFocusDate = date;
    if (this.#isWarping) return;
    const index = this.#yearToIndex(year);
    this.#setSettle(durationForDistance(Math.abs(index - this.#smoothScroll.currentIndex)));
    this.#smoothScroll.jumpToIndex(index);
    this.#updateNavBounds();
  }


  // ── Per-day data (notes + mood) ──

  #openDayPanel() {
    if (!this.#focus.date) return;
    this.#panel.open(this.#focus.date);
  }

  // A single day changed (someone typed a note or picked a mood): touch only
  // that one cell. Without a key, fall back to a full re-scan.
  #refreshDataMarkers(key) {
    if (!key) {
      this.#activeYears.forEach((block) => this.#markBlock(block));
      return;
    }
    const parts = DayStore.dateOf(key);
    if (!parts) return;
    const block = this.#activeYears.get(parts.year);
    if (!block) return;
    const cell = findDayCell(block, parts.month, parts.date);
    if (cell) this.#applyMarker(cell, this.#store.get(key));
  }

  #applyMarker(cell, entry) {
    if (entry && (entry.note || entry.mood)) {
      cell.classList.add(OdysseyConfig.classes.hasData);
      cell.style.setProperty('--mood-color', moodColor(entry.mood) || 'transparent');
    } else {
      cell.classList.remove(OdysseyConfig.classes.hasData);
      cell.style.removeProperty('--mood-color');
    }
  }

  // Driven by the data, not the DOM: clear the handful of cells currently
  // marked, then paint only the days this year actually has entries for.
  // The old version tested all ~400 cells of the block on every arrival.
  #markBlock(block) {
    const year = parseInt(block.dataset.year, 10);
    if (Number.isNaN(year)) return;

    block.querySelectorAll(`.${OdysseyConfig.classes.hasData}`).forEach((cell) => this.#applyMarker(cell, null));

    for (const key of this.#store.keysForYear(year)) {
      const parts = DayStore.dateOf(key);
      if (!parts) continue;
      const cell = findDayCell(block, parts.month, parts.date);
      if (cell) this.#applyMarker(cell, this.#store.get(key));
    }
  }


  // Midnight passed while the app was open: "today" moved on, so every
  // rendered block is now marked against the wrong day.
  #handleDayRollover(now) {
    this.#today = now;
    this.#rebuildAllYears();
    this.#toast.show(formatFullDate(now));
  }

  #rebuildAllYears() {
    // Snapshot first: #deactivateYearBlock mutates #activeYears as it goes.
    [...this.#activeYears].forEach(([year, block]) => this.#deactivateYearBlock(year, block));
    this.#activeYears.clear();
    this.#containers.clear();
    this.#lastRenderTop = -1;
    this.#render();
  }

  // ── Import / export ──

  #exportDays() {
    const entries = this.#store.entries();
    if (!entries.length) {
      this.#toast.show('NOTHING TO EXPORT');
      return;
    }
    this.#store.flush();
    downloadArchive(entries);
    this.#toast.show(`${entries.length} DAYS EXPORTED`);
  }

  async #importDays() {
    const result = await pickArchiveFile();
    if (!result) return; // picker dismissed
    if (result.error) {
      this.#toast.show('IMPORT FAILED');
      console.warn('[TRACE] import rejected:', result.error);
      return;
    }
    const changed = this.#store.merge(result.entries);
    this.#toast.show(changed ? `${changed} DAYS RESTORED` : 'ALREADY UP TO DATE');
  }

  #undoDayEdit() {
    const key = this.#store.undo();
    if (!key) {
      this.#toast.show('NOTHING TO UNDO');
      return;
    }
    const parts = DayStore.dateOf(key);
    if (parts) this.#travelToDate(new Date(parts.year, parts.month, parts.date));
    this.#toast.show('UNDONE');
  }

  // Every "go to this date" path: move there, then say where we landed.
  #travelToDate(date) {
    this.#focusDate(date);
    this.#toast.show(formatFullDate(date));
  }

  // Hops to the previous/next day that actually holds a note or mood, so a
  // sparse log can be walked without knowing the dates by heart.
  #travelToRecorded(direction) {
    const from = DayStore.keyOf(this.#focus.date ?? this.#today);
    const key = this.#store.adjacentKey(from, direction);
    if (!key) {
      this.#toast.show(direction > 0 ? 'NO LATER ENTRY' : 'NO EARLIER ENTRY');
      return;
    }
    const parts = DayStore.dateOf(key);
    if (parts) this.#travelToDate(new Date(parts.year, parts.month, parts.date));
  }

  #currentYear() {
    return this.#today.getFullYear() + (this.#smoothScroll.currentIndex - this.#totalYears / 2);
  }

  get currentYear() { return this.#currentYear(); }

  get focusedDate() { return this.#focus.focusedDate; }

  get layout() { return this.#mode ? 'dynamic' : 'structured'; }

  openSearch() { this.#search.open(); }

  navigateYears(delta) { this.#navigateYear(delta); }

  focusDate(date) {
    const target = new Date(date);
    if (Number.isNaN(target.getTime())) return;
    this.#focusDate(target);
  }

  reflowForViewport() {
    const year = Math.round(this.currentYear);
    const gridOwnedFocus = this.#focus.isCellFocused();
    const state = captureResponsiveState({
      year,
      focusedDate: this.#focus.focusedDate,
      yearOffset: this.#viewport.scrollTop - this.#yearToIndex(year) * this.#yearHeight,
    });

    this.#smoothScroll.cancelAnimation();
    this.#isAnimating = false;
    this.#isWarping = false;
    this.#viewport.classList.remove(
      OdysseyConfig.classes.warpingFar,
      OdysseyConfig.classes.warpingNear
    );
    this.#ionDrive.classList.remove(OdysseyConfig.classes.jumping);
    this.#setChroma(0);
    if (!this.#interactionsAllowed) this.#releaseInteractionLock();

    this.#yearHeight = Math.max(1, window.innerHeight);
    this.#viewportSize = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    this.#publishYearHeight();
    this.#canvas.style.height = `${this.#totalYears * this.#yearHeight}px`;
    this.#smoothScroll.setStep(this.#yearHeight);

    const targetTop = this.#yearToIndex(state.year) * this.#yearHeight
      + state.yearOffset;
    this.#smoothScroll.resetTo(targetTop);

    [...this.#activeYears].forEach(([activeYear, block]) => {
      this.#deactivateYearBlock(activeYear, block);
    });
    this.#activeYears.clear();
    this.#containers.clear();
    this.#lastRenderTop = -1;
    this.#render();

    const restoreFocusedDate =
      gridOwnedFocus && state.focusedDate?.getFullYear() === state.year;
    if (restoreFocusedDate) this.focusDate(state.focusedDate);
    else this.#focus.refreshTabStop(state.year);

    this.#particles.resize();
    this.#updateNavBounds();
    this.#scrubber?.measure();
    this.#scrubber?.update();
    this.#publishYearChange();
  }

  #publishYearHeight() {
    this.#canvas.style.setProperty(
      OdysseyConfig.dom.yearHeightVar,
      `${this.#yearHeight}px`
    );
  }

  setLayout(mode) { this.#setMode(mode === 'dynamic'); }

  onYearChange(callback) {
    this.#yearListeners.add(callback);
    if (this.#initialized) callback(Math.round(this.currentYear));
    return () => this.#yearListeners.delete(callback);
  }

  #publishYearChange() {
    if (!this.#initialized) return;
    const year = Math.round(this.currentYear);
    if (year === this.#publishedYear) return;
    this.#publishedYear = year;
    this.#yearListeners.forEach((callback) => callback(year));
  }

  #clampIndex(idx) {
    return Math.max(0, Math.min(this.#totalYears - 1, idx));
  }

  #yearToIndex(year) {
    return this.#clampIndex(year - this.#today.getFullYear() + this.#totalYears / 2);
  }

  #navigateYear(delta) {
    if (this.#isWarping) return;
    const target = this.#clampIndex(this.#smoothScroll.currentIndex + delta);
    this.#setSettle(durationForSteps(delta));
    this.#smoothScroll.stepBy(delta);
    this.#audio.play('scroll');
    // Haptic tick on a deliberate year change only — buzzing on every block
    // that scrolls into view made the whole page vibrate continuously.
    if ('vibrate' in navigator && !prefersReducedMotion()) navigator.vibrate(8);
    const year = this.#today.getFullYear() + (target - this.#totalYears / 2);
    this.#toast.show(formatYearTravel(delta, year));
    this.#navigator.setBounds(target > 0, target < this.#totalYears - 1);
  }

  #jumpToEdge(idx) {
    const target = this.#clampIndex(idx);
    const current = this.#smoothScroll.currentIndex;
    if (target === current) return;
    this.#isWarping = true;
    this.#lockInteractions();
    this.#audio.play('jump');
    this.#viewport.classList.add(OdysseyConfig.classes.warpingFar);
    this.#setSettle(durationForDistance(Math.abs(target - current)));
    this.#smoothScroll.jumpToIndex(target);
    this.#toast.show(target === 0 ? 'EPOCH ZERO' : 'EPOCH ULTIMA');
    this.#updateNavBounds();
  }

  // The depth transition on a year block used to run for a fixed second while
  // the scroll it belongs to finished in 250ms, so the motion stopped and the
  // picture kept catching up. Publishing the real travel time lets both end
  // together. Dirty-checked: this inherits into every cell, so it must not be
  // written on repeat navigations of the same distance.
  #setSettle(ms) {
    const rounded = Math.round(ms);
    if (rounded === this.#settleMs) return;
    this.#settleMs = rounded;
    this.#canvas.style.setProperty(OdysseyConfig.dom.yearSettleVar, `${rounded}ms`);
  }

  #updateNavBounds() {
    const idx = this.#smoothScroll.currentIndex;
    this.#navigator.setBounds(idx > 0, idx < this.#totalYears - 1);
  }

  #handleArrival(_scrollTop) {
    const wasAnimating = this.#isAnimating;
    const wasWarping = this.#isWarping;
    this.#isAnimating = false;
    this.#isWarping = false;
    this.#ionDrive.classList.remove(OdysseyConfig.classes.jumping);
    this.#setChroma(0);

    if (wasWarping) {
      this.#viewport.classList.remove(
        OdysseyConfig.classes.warpingFar,
        OdysseyConfig.classes.warpingNear
      );
      this.#audio.play('beep');
    }
    if (!this.#interactionsAllowed) {
      this.#unlockInteractions();
    }

    this.#updateNavBounds();
    this.#activeYears.forEach((block) => this.#enrichYearBlock(block));
    this.#refreshDataMarkers();
    this.#focus.refreshTabStop(this.#currentYear());
    this.#publishYearChange();

    // Focus the date requested while its year was still off-screen. Force a
    // render first: on instant (reduced-motion) or long jumps, this runs before
    // the scroll event that would otherwise draw the target year's block.
    if (this.#pendingFocusDate) {
      const d = this.#pendingFocusDate;
      this.#pendingFocusDate = null;
      this.#lastRenderTop = -1;
      this.#render();
      const block = this.#activeYears.get(d.getFullYear());
      if (block) this.#focus.focusIn(block, d);
    }
  }

  #handleInertiaVelocity(velocity) {
    if (this.#isWarping || this.#isAnimating) return;
    this.#scheduleRender();
    this.#updateChroma(velocity);
    this.#updateNavBounds();
  }

  // The scroll event and the inertia loop both fire in the same frame; without
  // coalescing they each ran a full render pass.
  #scheduleRender() {
    if (this.#renderRaf !== null) return;
    this.#renderRaf = requestAnimationFrame(() => {
      this.#renderRaf = null;
      this.#render();
      this.#updateNavBounds();
      this.#scrubber?.update();
      this.#publishYearChange();
    });
  }

  #handleTouchSettled() {
    const wantsSnap = this.#touchScrollEndWillSnap;
    this.#touchScrollEndWillSnap = false;
    const velocity = Math.abs(this.#smoothScroll.velocity || 0);
    if (wantsSnap && velocity < 0.5 && !this.#isWarping && !this.#isAnimating) {
      this.#setSettle(OdysseyConfig.display.snapMs);
      this.#smoothScroll.settleToNearest();
    }
  }

  #handleLongPress() {
    this.#audio.play('theme');
    this.#theme.toggle();
    this.#toast.show('MOOD SHIFT');
    this.#ionDrive.classList.add(OdysseyConfig.classes.active);
    setTimeout(() => this.#ionDrive.classList.remove(OdysseyConfig.classes.active), 300);
  }

  #updateChroma(velocity = Math.abs(this.#smoothScroll.velocity || 0)) {
    // Both of these must clear rather than just bail: leaving a stale value
    // keeps .is-shifting on, and with it a filter over the entire grid.
    if (prefersReducedMotion()) {
      this.#setChroma(0);
      return;
    }
    if (velocity <= OdysseyConfig.render.scrollEndVelocityPx) {
      this.#setChroma(0);
      return;
    }
    // Too fast to be worth smearing; leave the last value until it settles.
    if (velocity > OdysseyConfig.render.scrollSkipVelocityPx) return;
    const chroma = Math.min(
      OdysseyConfig.render.chromaCapPx,
      velocity / OdysseyConfig.render.chromaVelocityDivisor
    );
    // This runs every animation frame; only touch the CSSOM when it matters.
    this.#setChroma(Math.round(chroma * 100) / 100);
  }

  // Writes to the few grid containers that read it rather than to :root, and
  // toggles the class that brings the filter into existence at all.
  #setChroma(value) {
    if (value === this.#lastChroma) return;
    this.#lastChroma = value;

    const shifting = value > 0;
    if (shifting !== this.#shifting) {
      this.#shifting = shifting;
      this.#viewport.classList.toggle(OdysseyConfig.classes.isShifting, shifting);
    }
    if (!shifting) return;
    for (const container of this.#containers.values()) {
      container.style.setProperty(OdysseyConfig.dom.chromaDistVar, value);
    }
  }

  #lockInteractions() {
    this.#cancelPendingUnlock();
    this.#lockGeneration += 1;
    this.#interactionsAllowed = false;
    this.#audio.setBusy(true);
    this.#viewport.classList.add(OdysseyConfig.classes.isLocked);
    this.#ionDrive.style.setProperty(
      OdysseyConfig.dom.ionGlowVar,
      OdysseyConfig.dom.ionGlowLocked
    );
  }

  #unlockInteractions() {
    this.#cancelPendingUnlock();
    const generation = this.#lockGeneration;
    const timer = setTimeout(() => {
      if (generation !== this.#lockGeneration || this.#unlockTimer !== timer) return;
      this.#unlockTimer = null;
      this.#releaseInteractionLock();
    }, OdysseyConfig.timing.lockReleaseDelayMs);
    this.#unlockTimer = timer;
  }

  #cancelPendingUnlock() {
    if (this.#unlockTimer !== null) clearTimeout(this.#unlockTimer);
    this.#unlockTimer = null;
  }

  #releaseInteractionLock() {
    this.#cancelPendingUnlock();
    this.#lockGeneration += 1;
    this.#interactionsAllowed = true;
    this.#audio.setBusy(false);
    this.#viewport.classList.remove(OdysseyConfig.classes.isLocked);
    this.#ionDrive.style.setProperty(
      OdysseyConfig.dom.ionGlowVar,
      OdysseyConfig.dom.ionGlowDefault
    );
  }

  jumpToToday(isInitial = false) {
    if (this.#isWarping) return;

    const targetYear = this.#today.getFullYear();
    const targetIdx = this.#yearToIndex(targetYear);
    const currentIdx = this.#smoothScroll.currentIndex;
    const distance = Math.abs(targetIdx - currentIdx);

    this.#ionDrive.classList.add(OdysseyConfig.classes.jumping);

    this.#setSettle(durationForDistance(distance));
    if (distance <= 1) {
      this.#isAnimating = true;
      this.#lockInteractions();
      this.#audio.play('scroll');
      this.#smoothScroll.jumpToIndex(targetIdx);
      return;
    }

    this.#isWarping = true;
    this.#lockInteractions();
    let warpClass = OdysseyConfig.classes.warpingNear;

    if (distance > 20) {
      warpClass = OdysseyConfig.classes.warpingFar;
      this.#audio.play('jump');
      for (let i = 0; i < 15; i++) this.#particles.spawn(this.#cursor.position.x, this.#cursor.position.y, false);
    } else {
      this.#audio.play('warp');
    }

    this.#viewport.classList.add(warpClass);
    this.#smoothScroll.jumpToIndex(targetIdx);
    this.#updateNavBounds();

    if (!isInitial) {
      this.#toast.show(distance > 20 ? 'INTERSTELLAR JUMP' : 'LOCAL WARP');
    }
  }

  #render() {
    const scrollTop = this.#viewport.scrollTop;
    const velocity = Math.abs(this.#smoothScroll.velocity || 0);
    const isFast = velocity > OdysseyConfig.render.scrollEndVelocityPx;
    if (isFast && velocity > OdysseyConfig.render.scrollSkipVelocityPx) return;
    if (!isFast && scrollTop === this.#lastRenderTop) return;
    this.#lastRenderTop = scrollTop;

    const idx = Math.round(scrollTop / this.#yearHeight);
    const base = this.#today.getFullYear() + (idx - this.#totalYears / 2);
    const extend = isFast
      ? Math.min(OdysseyConfig.render.adaptiveExtendMax, Math.ceil(velocity * OdysseyConfig.render.fastVelocityFactor))
      : 1;

    for (let i = -extend; i <= extend; i++) {
      this.#drawYear(base + i, (idx + i) * this.#yearHeight, isFast);
    }
  }

  #drawYear(year, yPos, fast) {
    const existing = this.#activeYears.get(year);
    if (existing) {
      if (existing.style.top !== `${yPos}px`) existing.style.top = `${yPos}px`;
      // Only upgrade date-only cells once the scroll has calmed down —
      // enriching mid-fling is exactly the wrong moment to touch the DOM.
      if (!fast) this.#enrichYearBlock(existing);
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cols = computeGridCols(vw, vh);
    const days = daysInYear(year);
    const gO = computeYearOffset(year, cols, this.#mode);
    const rows = Math.ceil((days + gO) / cols);
    const isScrollable = isScrollableLayout(rows, vh);

    const block = this.#pool.acquire(year, yPos);
    if (isScrollable) block.classList.add(OdysseyConfig.classes.isScrolling);

    const cont = buildGridContainer(year, isScrollable);
    const grid = buildGridLayer(year, cols, rows, isScrollable);
    // Whole year in one parse. While scrolling fast we emit date-only cells and
    // let #enrichYearBlock add the labels once the block settles.
    grid.innerHTML = buildYearCellsHTML(
      year, cols, rows, gO, stampOf(this.#today), !fast
    );
    if (!fast) block.dataset.detailed = 'true';
    cont.append(grid);
    block.append(cont);
    this.#canvas.append(block);
    this.#activeYears.set(year, block);
    this.#containers.set(year, cont);
    this.#observer.observe(block);
    this.#markBlock(block);
    this.#focus.refreshTabStop(this.#currentYear());
  }

  #setMode(random) {
    if (this.#mode === random) return;
    this.#mode = random;
    // Snapshot first: #deactivateYearBlock mutates #activeYears as it goes.
    [...this.#activeYears].forEach(([year, block]) => this.#deactivateYearBlock(year, block));
    this.#activeYears.clear();
    this.#containers.clear();
    this.#lastRenderTop = -1;
    this.#render();
    this.#audio.play('beep');
    this.#toast.show(random ? 'NEBULA DYNAMIC STRUCTURE' : 'MONDAY ALIGNED ORBIT');
  }

}
