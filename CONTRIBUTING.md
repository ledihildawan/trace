# Contributing to TRACE

First off, thank you for considering contributing to **TRACE**.

TRACE is not just a codebase; it is a philosophy of time, perception, and digital peace. We welcome contributors who share our vision of creating "Digital Furniture"—software that is felt rather than used.

This document guides you through our vision, our coding standards, and our workflow to ensure that TRACE remains a cohesive, meditative experience.

---

## 1. The TRACE Philosophy

Before writing a single line of code, please understand the psychological principles that govern this project. We will **reject** contributions that violate these core tenets, regardless of code quality.

### Core Principles
1.  **Zero-UI:** We avoid buttons, menus, and overlays unless absolutely necessary. Interactions should be invisible and intuitive (e.g., Long Press, Hover).
2.  **Temporal Fading:** We respect the passage of time. Visuals for the past must desaturate or fade. We do not use bright colors for historical data.
3.  **Neuroaesthetics:**
    * **Fluid Motion:** All animations must use specific cubic-bezier curves (e.g., `0.22, 1, 0.36, 1`) or physics-based timing. No linear animations.
    * **Perceptual Color:** We use **OKLCH** exclusively to ensure consistent lightness across themes. Do not use RGB/HEX for dynamic theme colors.
4.  **Performance as Zen:** A choppy frame rate breaks the meditative state. We mandate GPU acceleration (`backface-visibility: hidden`) for all moving elements.

---

## 2. Development Workflow

We follow the **GitHub Flow** strategy (Trunk-Based Development).

| Branch       | Purpose                         |
| ------------ | ------------------------------- |
| `main`       | Production-ready, always stable |
| `feat/*`     | New features                    |
| `fix/*`      | Bug fixes                       |
| `docs/*`     | Documentation updates           |
| `refactor/*` | Code refactoring                |

### Prerequisites

Before you begin, ensure you have:
- **Git** (v2.30+) installed and configured
- A **GitHub account** with SSH keys set up ([guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh))
- A modern browser for testing (Chrome, Firefox, Safari)

### Step 1: Fork & Clone

1. **Fork the Repository**
   
   Click the **"Fork"** button on the top right of the repository page to create your own copy.

2. **Clone Your Fork**
   ```bash
   git clone git@github.com:YOUR-USERNAME/trace.git
   cd trace
   ```

3. **Add Upstream Remote**
   
   This allows you to sync with the original repository:
   ```bash
   git remote add upstream git@github.com:ledihildawan/trace.git
   git remote -v
   # Should show:
   # origin    git@github.com:YOUR-USERNAME/trace.git (fetch)
   # origin    git@github.com:YOUR-USERNAME/trace.git (push)
   # upstream  git@github.com:ledihildawan/trace.git (fetch)
   # upstream  git@github.com:ledihildawan/trace.git (push)
   ```

### Step 2: Keep Your Fork Updated

**Always sync before starting new work.** This prevents merge conflicts and ensures you're building on the latest code.

```bash
# Fetch latest changes from upstream
git fetch upstream

# Switch to your main branch
git checkout main

# Merge upstream changes into your local main
git merge upstream/main

# Push updates to your fork
git push origin main
```

### Step 3: Create a Feature Branch

**Never work directly on `main`.** Always create a descriptive branch:

```bash
# Ensure you're on an updated main
git checkout main
git pull upstream main

# Create and switch to a new branch
git checkout -b feat/temporal-soundscape
```

**Branch Naming Convention:** `type/short-description`

| Type        | Use Case           | Example                 |
| ----------- | ------------------ | ----------------------- |
| `feat/`     | New features       | `feat/ambient-audio`    |
| `fix/`      | Bug fixes          | `fix/safari-hover-bug`  |
| `docs/`     | Documentation      | `docs/update-api-guide` |
| `style/`    | Formatting, CSS    | `style/oklch-refactor`  |
| `refactor/` | Code restructuring | `refactor/date-utils`   |
| `perf/`     | Performance        | `perf/gpu-acceleration` |
| `chore/`    | Build, tooling     | `chore/update-deps`     |

### Step 4: Make Your Changes

Write your code following the **Coding Standards** section below. As you work:

- **Commit early and often** with meaningful messages
- **Test your changes** in multiple browsers
- **Keep commits focused** — one logical change per commit

### Step 5: Write Meaningful Commits

We use **[Conventional Commits](https://www.conventionalcommits.org/)** to auto-generate changelogs and enable semantic versioning.

**Format:**
```
<type>[optional scope]: <imperative description>

[optional body]

[optional footer(s)]
```

**Rules:**
- Use **imperative mood**: "add", "fix", "update" — not "added" or "fixed"
- Keep subject line under **72 characters**
- Separate body with a blank line
- Reference issues when applicable: `Closes #42`

**Examples:**

```bash
# Simple commit
git commit -m "feat: add subtle ambient sound on long press"

# Commit with scope
git commit -m "fix(safari): resolve hover state persistence bug"

# Commit with body and footer
git commit -m "feat(audio): implement temporal soundscape engine

- Add WebAudio API integration for ambient sounds
- Create frequency mapping based on time distance
- Implement smooth crossfade between sound states

Closes #128"
```

**Breaking Changes:**

For breaking changes, add `!` after the type or include a `BREAKING CHANGE:` footer:
```bash
git commit -m "feat!: redesign timeline interaction model

BREAKING CHANGE: Long press gesture now requires 500ms instead of 300ms"
```

### Step 6: Rebase Before Pushing

Before pushing, **rebase** your branch onto the latest `main` to maintain a clean history:

```bash
# Fetch latest upstream changes
git fetch upstream

# Rebase your branch onto upstream/main
git rebase upstream/main

# If there are conflicts, resolve them, then:
git add .
git rebase --continue
```

**Interactive Rebase (Optional):**

If you have multiple small commits, consider squashing them:
```bash
git rebase -i upstream/main
# In the editor, change "pick" to "squash" for commits to combine
```

### Step 7: Push Your Branch

```bash
# First push
git push origin feat/temporal-soundscape

# If you rebased after pushing, force push (with care)
git push origin feat/temporal-soundscape --force-with-lease
```

> ⚠️ **Note:** Only use `--force-with-lease` on your own feature branches, never on shared branches.

### Step 8: Open a Pull Request

1. Go to the [TRACE repository](https://github.com/ledihildawan/trace)
2. Click **"Compare & pull request"**
3. Fill out the PR template completely
4. Link any related issues (e.g., `Closes #42`)
5. Request a review from maintainers

**PR Checklist:**
- [ ] My code follows the TRACE philosophy (Zero-UI, Temporal Fading, Neuroaesthetics)
- [ ] I have tested on multiple browsers (Chrome, Firefox, Safari)
- [ ] My changes don't introduce console errors or warnings
- [ ] I have updated documentation if needed
- [ ] My commits follow Conventional Commits format
- [ ] I have rebased onto the latest `main`

### Step 9: Respond to Review Feedback

Maintainers may request changes. To update your PR:

```bash
# Make requested changes
git add .
git commit -m "fix: address review feedback"

# Push updates
git push origin feat/temporal-soundscape
```

For significant rework, consider squashing fixup commits:
```bash
git rebase -i upstream/main
# Squash fixup commits into the original
git push origin feat/temporal-soundscape --force-with-lease
```

### Step 10: After Your PR is Merged

🎉 Congratulations! Clean up your local environment:

```bash
# Switch to main
git checkout main

# Delete your local feature branch
git branch -d feat/temporal-soundscape

# Delete the remote branch (optional, GitHub can auto-delete)
git push origin --delete feat/temporal-soundscape

# Sync your fork with upstream
git pull upstream main
git push origin main
```

---

## 3. Coding Standards

### HTML
* **Semantic Structure:** Use strictly semantic HTML5.
* **No Frameworks:** TRACE is a Vanilla JS project. Do not introduce React, Vue, or heavy libraries without a major architectural discussion.

### CSS
* **Variable-First:** All colors, spacing, and timing must be defined in `:root`.
* **OKLCH Engine:** All dynamic colors must be derived using `oklch(from var(--base) ...)`.
* **GPU Layers:** Use `will-change`, `backface-visibility: hidden`, and `transform-style: preserve-3d` for any element that animates (hover, transitions).

### JavaScript
* **ES6 Modules:** Use modern ES6 syntax.
* **UTC Time Handling:** All `Date` objects must use UTC methods (`Date.UTC()`, `getUTCFullYear()`, etc.) to avoid timezone shifting bugs.
* **Constants Over Magic Numbers:** Define all timing, visual effect, and threshold values as static class constants (e.g., `static LONG_PRESS_DURATION = 800`).
* **JSDoc Documentation:** All class methods must include JSDoc comments with parameter types and descriptions.
* **Event Delegation:** Use event delegation on parent containers instead of attaching individual listeners to avoid memory leaks.
* **Error Handling:** Wrap `localStorage` operations and external API calls in try-catch blocks.
* **Performance:** Use `requestAnimationFrame` for visual updates. Avoid `setInterval` for high-frequency rendering.
* **XSS Prevention:** Never use `innerHTML` with dynamic content. Use `textContent` and `createElement()` instead.
* **Cleanup Methods:** Implement `destroy()` methods that clear all timers, intervals, and event listeners.

### Security
* **Content Security Policy:** The application includes CSP headers - ensure any new external resources are whitelisted.
* **Input Sanitization:** All user-facing text must be rendered using safe DOM methods, never `innerHTML`.
* **localStorage Safety:** Always wrap storage operations in try-catch blocks to handle private browsing mode and quota limits.
* **Dependency Audits:** Keep external dependencies (fonts, libraries) to a minimum and verify integrity.

### Accessibility
* **Keyboard Navigation:** Implement roving tabindex patterns for grid/list navigation using arrow keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End).
* **ARIA Labels:** All interactive elements must have descriptive `aria-label` attributes in English.
* **Screen Reader Support:** Use `aria-live` regions for dynamic content announcements.
* **Focus Management:** Visible focus indicators required for all interactive elements.
* **Language Consistency:** All `aria-label`, `title`, and screen reader text must be in English (`lang="en"`).

---

## 4. Issue & Labeling Strategy

We use GitHub Issues to track our work. Before opening a PR, check if an issue exists.

### Labels

We use the following labels to categorize issues and PRs:

#### Issue Types
| Label             | Meaning                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| `bug`             | Something isn't working as intended.                                      |
| `feature request` | Proposed ideas waiting for a philosophy check.                            |
| `documentation`   | Improvements or additions to documentation.                               |
| `accessibility`   | Improvements for screen readers, keyboard navigation, and ARIA standards. |

#### Priority & Help
| Label              | Meaning                                    |
| ------------------ | ------------------------------------------ |
| `good first issue` | Simple tasks for newcomers to the project. |
| `help wanted`      | Extra attention is needed.                 |

#### TRACE-Specific
| Label             | Meaning                                                 |
| ----------------- | ------------------------------------------------------- |
| `neuroaesthetics` | Focus on feel, motion curves, and psychological impact. |
| `visual-polish`   | Pixel-perfect design tweaks and OKLCH color harmony.    |
| `performance`     | GPU acceleration, frame rates, and efficiency.          |

#### Rejection Reasons
| Label                 | Meaning                                                    |
| --------------------- | ---------------------------------------------------------- |
| `philosophy mismatch` | Contributions that conflict with the core project vision.  |
| `out of scope`        | Suggestions that violate Zero-UI or minimalist principles. |

### When to Use Labels

- **Reporters:** When creating an issue, select the most appropriate label.
- **Maintainers:** Will add additional labels as needed during triage.
- **Contributors:** Use labels to find issues aligned with your interests.

---

## 5. Review Process

When you submit a PR, the maintainers will review it based on:
1.  **Psychological Integrity:** Does this feature add noise? Does it distract? If yes, it will be rejected.
2.  **Code Quality:** Is it clean? Does it follow the naming conventions?
3.  **Performance:** Does it cause jitter on mobile devices?

### Review Timeline

- **Initial Response:** Within 48 hours
- **Full Review:** Within 7 days for small PRs, 14 days for larger changes
- **Merge:** After all checks pass and at least one maintainer approves

### Common Rejection Reasons

Issues and PRs may be labeled with `philosophy mismatch` or `out of scope` if they don't align with TRACE's vision. Here's how to fix them:

| Rejection Reason                   | Label Applied                         | How to Fix                                                                    |
| ---------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| Introduces unnecessary UI elements | `philosophy mismatch`, `out of scope` | Remove buttons/overlays, use gestures (long press, hover) instead             |
| Linear or choppy animations        | `neuroaesthetics`                     | Use `cubic-bezier(0.22, 1, 0.36, 1)` or physics-based curves                  |
| Uses RGB/HEX for dynamic colors    | `visual-polish`                       | Convert to OKLCH with `oklch(from var(--base) ...)`                           |
| Causes performance jitter          | `performance`                         | Add GPU acceleration: `backface-visibility: hidden`, `will-change`, etc.      |
| Memory leaks from event listeners  | `performance`                         | Use event delegation instead of individual element listeners                  |
| Uses magic numbers                 | —                                     | Extract to static class constants with descriptive names                      |
| Missing JSDoc comments             | —                                     | Add JSDoc with `@param` and `@returns` tags to all methods                   |
| Uses local time instead of UTC     | `bug`                                 | Replace `new Date()` methods with UTC equivalents                             |
| Missing error handling             | —                                     | Wrap `localStorage` and external calls in try-catch blocks                    |
| XSS vulnerability with innerHTML   | `security`                            | Replace with `textContent` and `createElement()`                              |
| Missing cleanup in component       | `performance`                         | Implement `destroy()` method to clear timers and listeners                    |
| Unclear or non-standard commits    | —                                     | Rewrite using Conventional Commits format                                     |

---

## 6. Getting Help

If you need help at any point:

- 💬 **Discussions:** [GitHub Discussions](https://github.com/ledihildawan/trace/discussions) for questions and ideas
- 📖 **Documentation:** Check the [README](README.md) and this guide
- 🐛 **Issues:** Search [existing issues](https://github.com/ledihildawan/trace/issues) before creating new ones

---

## 7. Recognition

We value every contribution! Contributors will be:

- Listed in our [README](README.md) contributors section
- Mentioned in release notes when their changes ship
- Given appropriate credit in commit history

---

Thank you for helping us shape time. 🕰️