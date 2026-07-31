# TRACE UX/UI Improvements Design

**Date:** 2026-07-31  
**Status:** Approved design  
**Scope:** Eight UX/UI improvements identified in the project audit

## Objective

Make TRACE understandable and usable without documentation while preserving its
identity as calm, atmospheric “digital furniture.” The grid remains the primary
visual surface. Controls appear when the user shows intent and recede when TRACE
returns to an ambient state.

## Design Principles

1. Preserve the immersive grid and cosmic visual language.
2. Prefer progressive disclosure over permanently visible application chrome.
3. Give touch, pointer, keyboard, and assistive-technology users equivalent
   access to every primary action.
4. Keep existing local data compatible; no migration is required.
5. Use Indonesian consistently throughout the product.
6. Respect reduced-motion, reduced-transparency, forced-colors, and safe-area
   preferences.

## 1. Adaptive Navigation and Discoverability

### Adaptive dock

Add a compact glass dock containing:

- **Hari ini**
- **Cari**
- **Menu**

On desktop, the dock appears when the pointer moves, the grid receives keyboard
focus, a shortcut is used, or a dialog closes. It fades after a short idle
period when no dialog or menu is open.

On touch devices, the dock appears on the first intentional tap and remains
visible while a panel or menu is open. Tapping the ambient grid can reveal it
again. Its controls meet the 44 px enhanced touch-target recommendation without
requiring 44 px visible icons.

Keyboard shortcuts remain available and are documented in Help. The dock does
not replace keyboard navigation.

### Application menu

The Menu action opens a single surface containing:

- Theme
- Audio
- Grid layout
- Data
- Help

This replaces undiscoverable shortcut-only access without adding a permanent
toolbar.

### Year context

Show the active year close to the dock with adjacent-year navigation:

`‹ 2025 · 2026 · 2027 ›`

The active year has clear emphasis. Existing edge arrows remain as secondary
controls. Year-change feedback uses Indonesian and identifies the destination
year.

### First-run onboarding

Show a single onboarding surface on first visit. It explains:

- What TRACE is
- How to open a day and record a note/mood
- What the adaptive dock provides
- How to begin exploring

The user dismisses it with **Mulai menjelajah**. The dismissed state is stored
locally. Help can reopen the onboarding at any time. If the preference cannot be
stored, onboarding failure must not block the application.

## 2. Responsive Layout

Introduce a responsive-layout coordinator that reacts to material viewport
changes, including resize, orientation change, split-screen, and foldable
viewport changes.

Before rebuilding, capture the active year, focused date, and relative scroll
position. Recompute column count and scrollable layout using the new viewport,
rebuild the necessary pool, then restore the same year/date. Avoid rerendering
for insignificant browser-chrome height changes.

Mobile uses a dedicated presentation:

- Seven-column calendar grid
- Adaptive dock inside safe-area bounds
- Day panel presented as a bottom sheet
- No keyboard-only hints
- Edge navigation positioned so it does not cover primary date content

Target verification sizes are:

- Desktop: 1440 × 900
- Mobile portrait: 390 × 844
- Mobile landscape: 844 × 390

## 3. Readability and Language

Use Indonesian for all visible labels, accessible names, loading messages,
empty states, toasts, and help content.

Raise calendar metadata to a practical minimum of 9–10 px and functional text
to at least 12 px. Preserve temporal fading, but keep dates and weekday labels
legible. Secondary text must maintain adequate contrast in both themes.

The visual hierarchy remains:

1. Today
2. Focused or selected day
3. Future days
4. Past days
5. Decorative watermark and atmosphere

## 4. Day Panel and Mood Recording

Center the day panel on larger screens and present it as a bottom sheet on
mobile. Retain native `<dialog>` behavior for focus trapping, Escape handling,
background inertness, and focus restoration.

Mood controls use both color and text:

- Buruk
- Kurang
- Biasa
- Baik
- Luar Biasa

Color remains an enhancement rather than the only carrier of meaning.

The panel:

- Opens empty entries directly in edit mode
- Shows **Tersimpan otomatis** after a successful persisted change
- Shows a clear failure state if local persistence fails
- Disables Delete when the day has no stored content
- Requests confirmation before deleting non-empty content
- Provides a compact formatting hint without becoming a full Markdown editor

Existing note and mood storage formats remain unchanged.

## 5. Search and Empty States

Search remains keyboard accessible through `/` and becomes accessible through
the dock. It must provide:

- A clear initial instruction
- A “no recorded days yet” state
- A “no matching results” state
- Result count feedback
- Keyboard selection feedback that remains screen-reader compatible

Selecting a result navigates to the date while retaining the established
motion/reduced-motion behavior.

## 6. Data Management

Add a Data section inside the application menu. It displays:

- Number of recorded days
- A reminder that data lives in this browser
- Export action
- Import action

Export and import continue using the existing JSON format. Import validates the
file before mutation. Invalid or unreadable input leaves existing data
untouched and produces an Indonesian error message. Successful merges report
the number of imported, preserved, and skipped records.

The existing `E` and `I` shortcuts remain supported.

## 7. Component Architecture

Add focused modules instead of increasing `GridArchitect` responsibilities:

- `AdaptiveDock`: dock visibility, intent signals, and idle timing
- `Onboarding`: first-run preference and onboarding dialog
- `AppMenu`: theme, audio, layout, data, and help entry points
- `YearContext`: active-year display and adjacent navigation
- `ResponsiveLayout`: viewport-change classification and position restoration
- `DataActions`: import/export orchestration and user feedback

Extend existing modules through their current public interfaces:

- `DayPanel` receives persistence feedback and labelled mood presentation.
- `NoteSearch` receives empty states and dock entry.
- Locale utilities own all new Indonesian strings.
- `ToastManager` reports actionable success and failure messages.
- `GridArchitect` publishes navigation state and delegates UI behavior.

No framework or runtime dependency is introduced.

## 8. State and Event Flow

The event hub remains the coordination boundary:

1. Pointer, touch, keyboard, or focus activity publishes user intent.
2. `AdaptiveDock` reveals itself and resets its idle timer.
3. Dock actions call existing navigation/search/theme/audio behavior through
   explicit callbacks or events.
4. Year navigation publishes the active year to `YearContext`.
5. Material viewport changes invoke `ResponsiveLayout`, which captures,
   rebuilds, and restores navigation state.
6. Day and data changes flow through `DayStore`; user feedback is emitted only
   after persistence succeeds or fails.

Dialogs and menus suspend dock auto-hide until they close.

## Error Handling

- Invalid imports never mutate stored data.
- Storage failure keeps the application usable and reports that changes could
  not be saved.
- Audio initialization failure leaves controls usable and reports audio as
  unavailable.
- Onboarding-preference failure falls back safely without blocking startup.
- Responsive rebuild failure restores the last stable layout when possible and
  keeps the active year accessible.

## Testing and Verification

### Unit tests

- Adaptive dock reveal, pin, and idle-hide states
- Onboarding first-run and reopen behavior
- Responsive change classification and restoration data
- Indonesian locale coverage for new UI strings
- Day panel delete availability and persistence status
- Import validation and merge summaries

### Integration tests

- Onboarding → dock → day panel → saved note
- Dock → search → result navigation
- Menu → data export/import
- Resize/orientation → same active year and focused date
- Keyboard-only traversal through dock, menu, grid, and dialogs

### Visual and accessibility QA

Verify all target viewports in dark and light themes. Check focus visibility,
touch targets, dialog positioning, text contrast, reduced motion, reduced
transparency, forced colors, screen-reader names, and absence of unintended
horizontal overflow.

## Acceptance Criteria

The design is complete when:

1. A first-time user can discover day recording, search, and settings without
   reading the repository README.
2. TRACE returns to an unobstructed ambient grid after interaction stops.
3. Resize and orientation changes retain the active temporal context.
4. Mobile offers visible access to every primary action.
5. All user-facing and accessible UI strings are Indonesian.
6. Calendar metadata and controls are readable at the target viewports.
7. Mood meaning is understandable without relying on color.
8. Users can inspect, export, and import local data through visible UI.
9. Existing stored notes, moods, shortcuts, accessibility preferences, and
   atmospheric behavior remain compatible.
