export function classifyViewportChange(previous, next, thresholds) {
  const crossedBreakpoint =
    (previous.width < thresholds.breakpoint) !== (next.width < thresholds.breakpoint);
  const rotated =
    (previous.width > previous.height) !== (next.width > next.height);

  if (
    crossedBreakpoint
    || rotated
    || Math.abs(previous.width - next.width) >= thresholds.widthPx
  ) {
    return 'structural';
  }

  if (Math.abs(previous.height - next.height) >= thresholds.heightPx) {
    return 'height-only';
  }

  return 'none';
}

export function captureResponsiveState({ year, focusedDate, yearOffset }) {
  return {
    year,
    focusedDate: focusedDate ? new Date(focusedDate) : null,
    yearOffset,
  };
}
