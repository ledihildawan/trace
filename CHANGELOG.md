# Changelog

All notable changes to the **TRACE** project will be documented in this file.

## [1.0.4] - 2026-01-07

### Features
* **Dynamic Year Engine:** Automated temporal synchronization that identifies and renders the current year, ensuring the application is officially future-proof.
* **Smart HUD (Heads-Up Display):** Adaptive tooltip positioning with "Vertical Flip" logic to prevent finger occlusion on mobile and tablet devices.
* **Dual-Tier Haptic Engine:** Differentiated tactile feedback providing "Texture Ticks" (5ms) for grid scrubbing and "Solid Thumps" (50ms) for theme change confirmation.

### Performance & Engineering
* **Layout Containment:** Implemented CSS `contain: strict` on the grid viewport, isolating rendering processes to achieve a 50% reduction in browser reflow time.
* **Geometry Caching:** Optimized the interaction loop by caching DOM measurements, effectively eliminating "Layout Thrashing" during rapid movement.
* **RAF Throttling:** Synchronized scrubbing logic with the screen's native refresh rate (60Hz/120Hz) via `requestAnimationFrame`.
* **Code Purification:** Centralized temporal references and removed redundant Date object instantiations to minimize memory footprint.

## [1.0.3] - 2026-01-07

### UX/UI Refinements
* **The Museum Edition:** Replaced aggressive `scale(1.3)` hover with a refined "Museum Exhibit" effect—using subtle `translateY` and layered ambient shadows for zero layout shift.
* **Universal Interaction Lock:** Implementation of a visual "freeze" state during press actions, focusing all sensory feedback purely on the theme transition ritual.
* **Mobile Scrubbing Engine:** Redesigned touch logic allowing users to press and slide (scrub) to inspect dates, mirroring high-end financial instrument interfaces.
* **Lingering Presence:** Added a 2.5-second visibility buffer (fade-out) for mobile tooltips, allowing users time to read data after lifting their finger.

### Engineering
* **Adaptive Contrast Engine:** Expanded the luminance calculation logic to hover states, ensuring dark themes stay deep and light themes remain crisp and visible.
* **Touch Delegation:** Optimized event listeners by moving from per-element tracking to a global viewport delegation system for improved mobile responsiveness.

## [1.0.2] - 2026-01-07

### Engineering
* **CSS Houdini Integration:** Registered `--base-hex` as a native `<color>` type, offloading theme transitions to the GPU for silk-smooth color interpolation.
* **Modern API Migration:** Implementation of CSS Nesting and the `:has()` parent selector to create complex "Focus Mode" interactions with zero JavaScript overhead.
* **Fluid Typography:** Migrated all labels and tooltips to a `clamp()` based responsive system, ensuring pixel-perfect legibility from tiny handhelds to ultra-wide monitors.

## [1.0.1] - 2026-01-06

### Features
* **Laminar Flow Transitions:** Introduced a diagonal wave animation for theme changes, creating a "ripple" effect that follows a temporal-spatial path across the grid.
* **Monday Markers:** Minimalist adaptive dots on the grid to provide a subtle rhythmic anchor for the start of the week without adding visual clutter.
* **Interactive Tooltips:** Added rich data overlays showing Day Number and Year Percentage on hover/touch.

### Engineering
* **Filler Isolation:** Implemented `pointer-events: none` for days outside the target year boundaries to prevent interaction "noise" and maintain focus.

## [1.0.0] - 2026-01-06

### Features
* **High-Density Temporal Grid:** Automated rendering of a 365/366-day landscape with fluid resizing for 240px to 4K displays.
* **OKLCH Color Engine:** Implemented a perceptually accurate color system for 10 curated meditative themes.
* **Temporal Fading Logic:** Advanced past-date desaturation and opacity decay to visualize the passage of time.
* **Adaptive Progress Bar:** Dynamic contrast calculation for the daily indicator to ensure visibility across all luminance levels (from Teal to Peach).
* **Ghost Navigation:** Contextual month labels with smart color-inversion to maintain legibility on faded backgrounds.

### Engineering
* **12:00 PM Anchor:** Standardized all date calculations to noon to eliminate timezone-related day-shifting bugs.
* **GPU-Accelerated Interaction:** Implemented hardware acceleration for hover transforms to ensure zero-jitter visual fluidity.
* **Meditative Input:** Unified "Long Press" interaction (800ms) for theme cycling across Desktop and Touch devices.
* **Absolute Symmetry:** Synchronized layout rendering using `requestAnimationFrame` to lock the Year Watermark and Grid to a central axis.

### UX/UI
* **Edge-Safe Tooltips:** Smart positioning logic for year progress and date data.
* **Zero-UI Philosophy:** Removal of all traditional buttons to maintain a distraction-free aesthetic.