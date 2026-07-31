export const OdysseyConfig = {
  temporal: {
    totalYears: 2000,
    // Month and weekday names are derived from this via Intl (see core/locale.js).
    locale: 'id-ID',
  },
  display: { defaultMode: 'structured', minCols: 7, snapMs: 380, yearLeapStep: 10 },
  audio: {
    basePath: 'assets/sfx/',
    masterVolume: 0.4,
    ambientBaseVolume: 0.12,
    idleInterval: [10000, 25000],
    idleDelay: 30000,
    fetchTimeoutMs: 15000,
    maxVoices: 12,           // a burst must not pile up sources on the audio thread
    stealFadeSec: 0.04,      // retiring a voice early: short, but not a click
    stopFadeSec: 0.25,        // loops fade out; stopping outright clicks
    duckedGain: 0.18,         // how far a jump pulls everything down
    enginePowerRange: 0.4,    // how much pointer speed lifts the sfx bus
    engineVelocityFullPx: 120,
    engineFloor: 0.15,        // below this, pointer motion makes no sound
    hoverRepeatMs: 100,
    // A safety limiter, not a colour: overlapping one-shots on top of the
    // ambient bed would otherwise sum past unity and clip.
    limiter: {
      thresholdDb: -6,
      kneeDb: 6,
      ratio: 12,
      attackSec: 0.003,
      releaseSec: 0.25,
    },
  },
  physics: {
    cursorInertia: 0.12,
    spatialAudioThrottleMs: 120,
    exhaustThreshold: 15,
    wheelLineHeightPx: 40,      // assumed line height for deltaMode === LINE
    flingVelocityThreshold: 0.6, // px/ms below which a swipe just settles
    flingProjectionMs: 200,      // how far ahead a fling is projected
    flingMaxSteps: 4,            // ceiling on years travelled per fling
    flingSampleCount: 5,         // touch samples kept for velocity averaging
    touchSettleMs: 50,           // grace period before wheel input re-engages
  },

  timing: {
    bootStepMs: 400,
    loadingHideMs: 600,
    jumpInitialDelayMs: 150,
    lockReleaseDelayMs: 400,
    longPressMs: 800,
    longPressMoveTolerancePx2: 100,
    scrollSettleMs: 150,
    inertiaStepMaxPx: 120,
    toastMs: 2500,
    dayPulseIntervalMs: 60000,
    themeVeilDelayMs: 400,
    themeVeilReleaseMs: 200,
    dockIdleMs: 4000,
    cursorCoarseQuery: '(pointer: coarse)',
    audioConcurrentMax: 2,
  },

  responsive: {
    widthPx: 24,
    heightPx: 80,
    breakpoint: 600,
  },

  dom: {
    viewport: 'viewport',
    infiniteCanvas: 'infinite-canvas',
    ionDrive: 'ion-drive',
    themeVeil: 'theme-veil',
    toast: 'toast',
    keyboardHints: 'keyboard-hints',
    adaptiveDock: 'adaptive-dock',
    onboardingStorageKey: 'trace-onboarding-v1',
    loadingScreen: 'loading-screen',
    loadProgress: 'load-progress',
    loadStatus: 'load-status',
    ionXVar: '--ion-x',
    ionYVar: '--ion-y',
    ionGlowVar: '--ion-glow',
    chromaDistVar: '--chroma-dist',
    dayProgressVar: '--day-progress',
    yearSettleVar: '--year-settle',
    ionGlowDefault: '700px',
    ionGlowHover: '900px',
    ionGlowFiller: '200px',
    ionGlowLocked: '200px',
    themeStorageKey: 'theme',
    themes: ['dark', 'light'],
    themeAttr: 'data-theme',
  },

  classes: {
    cell: 'cell',
    filler: 'filler',
    weekend: 'weekend',
    weekStart: 'week-start',
    monthStart: 'month-start',
    today: 'today',
    past: 'past',
    dayPulse: 'day-pulse',
    enriched: 'enriched',
    active: 'active',
    isLocked: 'is-locked',
    isScrolling: 'is-scrolling',
    isShifting: 'is-shifting',
    jumping: 'jumping',
    warpingFar: 'warping-far',
    warpingNear: 'warping-near',
    yearBlock: 'year-block',
    gridLayer: 'grid-layer',
    gridRow: 'grid-row',
    gridContainer: 'grid-container',
    watermark: 'watermark-embedded',
    cellContent: 'cell-content',
    infoMeta: 'info-meta',
    dateNum: 'date-num',
    topLabel: 'top-label',
    faded: 'faded',
    hidden: 'hidden',
    hasData: 'has-data',
    isActive: 'is-active',
    visible: 'visible',
    disabled: 'disabled',
  },

  particles: {
    maxBase: 200,
    maxPerAreaPx: 800,
    maxCeiling: 1200,
    blendModeLight: 'normal',
    blendModeDark: 'screen',
    contrastScaleLight: 0.75,
    exhaustCount: 2,
    ambientCount: 12,
    exhaustForceMax: 2,
    ambientForceMin: 1.5,
    ambientForceMax: 6.5,
    exhaustDecay: 0.04,
    ambientDecay: 0.015,
    exhaustSize: 8,
    ambientSize: 22,
    drag: 0.98,
    dprCap: 2,
  },

  render: {
    scrollEndVelocityPx: 0.6,
    scrollSkipVelocityPx: 2.0,
    adaptiveExtendMax: 3,
    fastVelocityFactor: 1.5,
    chromaCapPx: 12,
    chromaVelocityDivisor: 10,
    minCellPx: 60,
    layoutRatioNumerator: 373,
    wideViewportPx: 600,
  },
};
