// Which clip lives in which file, and how urgently it is needed.
// Priority 1 loads on the first gesture; 2 on the first pointer move or
// wheel; 3 only when the browser reports it is idle.
export const ASSET_QUEUE = [
  { key: 'beep', file: 'confirmation-beep.mp3', priority: 1 },
  { key: 'hover', file: 'hover-over-cell.mp3', priority: 1 },
  { key: 'scroll', file: 'year-change-scroll-transition.mp3', priority: 1 },
  { key: 'base', file: 'master-ambient-loop.mp3', priority: 1 },
  { key: 'jump', file: 'jump-to-today.mp3', priority: 2 },
  { key: 'warp', file: 'fast-scroll-wrap-mode.mp3', priority: 2 },
  { key: 'theme', file: 'theme-toggle.mp3', priority: 2 },
  { key: 'enable', file: 'enabled-ambience.mp3', priority: 1 },
  { key: 'mute', file: 'mute-ambience.mp3', priority: 1 },
  { key: 'pulse', file: 'short-ambient-pulse.mp3', priority: 3 },
  { key: 'wind', file: 'nebula-wind-sweep.mp3', priority: 3 },
  { key: 'engine', file: 'engine-idle-hum.mp3', priority: 3 },
  { key: 'stellar', file: 'distant-stellar-ambience.mp3', priority: 3 },
];

export const SPATIAL_KEYS = new Set(['hover', 'beep', 'pulse', 'wind']);

export const IDLE_CLIPS = [
  { k: 'pulse', v: 0.15 },
  { k: 'wind', v: 0.2 },
  { k: 'engine', v: 0.15 },
  { k: 'stellar', v: 0.2 },
];
