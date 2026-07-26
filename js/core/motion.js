const MQ = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion() {
  return window.matchMedia?.(MQ).matches === true;
}

// Subscribe to OS-level motion-preference changes (e.g. user toggles the
// setting while the app is open). Returns an unsubscribe function.
export function onReducedMotionChange(cb) {
  const mql = window.matchMedia?.(MQ);
  if (!mql) return () => {};
  const handler = () => cb(mql.matches);
  mql.addEventListener?.('change', handler);
  return () => mql.removeEventListener?.('change', handler);
}
