// TRACE Core Constants
// Shared constants used across the engine and plugins

export const MS_PER_DAY = 86_400_000;
export const MINUTES_PER_DAY = 1_440;

export const TONE_TO_DARK_LUM = 0.38;
export const TONE_TO_LIGHT_LUM = 0.44;

export const LONG_PRESS_DURATION = 500;
export const TOOLTIP_LINGER_MS = 2500;
export const TIME_UPDATE_INTERVAL = 60000;
export const RESIZE_DEBOUNCE_MS = 100;

export const OPACITY_DECAY_RATE = 0.008;
export const GRAYSCALE_RATE = 0.5;
export const HAPTIC_SCRUB_MS = 5;
export const HAPTIC_SUCCESS_MS = 50;
export const DRAG_THRESHOLD_PX = 15;

// Mobile gesture thresholds (tunable based on device testing)
export const LONG_PRESS_DURATION_MS = 600;
export const DOUBLE_TAP_MAX_DELAY_MS = 350;
export const DOUBLE_TAP_MAX_DISTANCE_PX = 20;
export const PINCH_MIN_DISTANCE_CHANGE_PX = 30;
export const SWIPE_MIN_DISTANCE = 60;
export const MOUSE_DRAG_THRESHOLD = 80;
