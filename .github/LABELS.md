# GitHub Labels Guide

This file documents all GitHub labels used in the TRACE project for issues and pull requests.

## Label Taxonomy

### Issue Types (Choose One)

| Label             | Color    | Description                                    | Use When                                |
| ----------------- | -------- | ---------------------------------------------- | --------------------------------------- |
| `bug`             | 🔴 Red    | Something isn't working as intended.           | You found a problem in the code or UI   |
| `feature request` | 💡 Yellow | Proposed ideas waiting for a philosophy check. | You have a suggestion for a new feature |
| `documentation`   | 📚 Blue   | Improvements or additions to documentation.    | Docs are missing, unclear, or outdated  |
| `accessibility`   | ♿ Teal   | Improvements for screen readers, keyboard navigation, and ARIA standards. | Missing or broken a11y features |
| `security`        | 🔒 Dark Red | Security vulnerabilities or concerns.        | Found XSS, data leaks, or security issues |

### Priority & Help (Optional)

| Label              | Color    | Description                                | Use When                                      |
| ------------------ | -------- | ------------------------------------------ | --------------------------------------------- |
| `good first issue` | 🟢 Green  | Simple tasks for newcomers to the project. | Issue is suitable for first-time contributors |
| `help wanted`      | 🟠 Orange | Extra attention is needed.                 | Issue needs more discussion or investigation  |

### TRACE-Specific Categories (For PRs & Complex Issues)

| Label             | Color          | Description                                             | Use When                                            |
| ----------------- | -------------- | ------------------------------------------------------- | --------------------------------------------------- |
| `neuroaesthetics` | 🎨 Purple       | Focus on feel, motion curves, and psychological impact. | Changes affect animations, timing, or UX psychology |
| `visual-polish`   | ✨ Cyan         | Pixel-perfect design tweaks and OKLCH color harmony.    | Changes affect colors, spacing, or visual alignment |
| `performance`     | ⚡ Yellow-green | GPU acceleration, frame rates, and efficiency.          | Changes affect speed, smoothness, or resource usage |

### Rejection Labels (Applied by Maintainers)

| Label                 | Color  | Description                                                | Meaning                                                         |
| --------------------- | ------ | ---------------------------------------------------------- | --------------------------------------------------------------- |
| `philosophy mismatch` | ⛔ Red  | Contributions that conflict with the core project vision.  | Issue/PR violates TRACE's core principles but could be reworked |
| `out of scope`        | 🚫 Gray | Suggestions that violate Zero-UI or minimalist principles. | Rejected; won't be reconsidered                                 |

---

## How Labels Are Used

### For Reporters
When creating an **issue**, select the primary label that best describes it:
- Creating a bug report? Use `bug`
- Suggesting a feature? Use `feature request`
- Reporting docs issues? Use `documentation`
- Found accessibility issues? Use `accessibility`

After creation, maintainers may add additional context labels like `neuroaesthetics` or `performance`.

### For Maintainers
During triage:
1. **Assign** the primary type label (`bug`, `feature request`, `documentation`)
2. **Add context** labels from TRACE-Specific categories if relevant
3. **Add help indicators** if needed (`good first issue`, `help wanted`)
4. **Apply rejection** labels if the suggestion violates core principles

### For Contributors
Use labels to find issues aligned with your interests:
- Want to improve animations? Filter by `neuroaesthetics`
- Want to polish the UI? Filter by `visual-polish`
- Want to optimize performance? Filter by `performance`
- Getting started? Filter by `good first issue`

---

## Example Scenarios

### Scenario 1: Animation Bug in Safari
- Reporter creates an issue with label: `bug`
- Maintainer adds: `neuroaesthetics`
- Issue: "Safari animation stutters on hover"

### Scenario 2: Feature Request (Approved)
- Reporter creates issue with label: `feature request`
- Maintainer approves and adds: `neuroaesthetics`, `good first issue`
- Contributor can now work on it

### Scenario 3: Feature Request (Rejected)
- Reporter suggests adding a notification popup
- Maintainer applies: `philosophy mismatch` or `out of scope`
- Reason: Violates Zero-UI principle

### Scenario 4: Accessibility Issue
- Reporter finds that keyboard navigation is broken
- Reporter creates issue with label: `accessibility`
- Maintainer adds: `bug`, `help wanted`
- Issue: "Tab key doesn't work with temporal slider"

### Scenario 5: Documentation PR
- Contributor opens PR with label: `documentation`
- Maintainer reviews and merges

---

## Quick Reference: Label Search

Use GitHub's search to find issues by label:

```
# Find bugs that need help
is:open label:bug label:"help wanted"

# Find good starter tasks
is:open label:"good first issue"

# Find accessibility-related work
is:open label:accessibility

# Find performance-related work
is:open label:performance

# Find rejected suggestions
is:open label:"philosophy mismatch"
```

---

## Contributing New Labels

If you believe a new label should be added:
1. Open an issue discussing the need
2. Explain how it differs from existing labels
3. Get approval from maintainers before using it

Consistency matters! We keep our label taxonomy simple and meaningful.
