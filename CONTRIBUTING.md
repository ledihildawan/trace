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
* **`main`**: The production-ready branch.
* **Feature Branches**: Created from `main`, merged back into `main`.

### Step-by-Step Guide

1.  **Fork the Repository**
    Click the "Fork" button on the top right of the repository page.

2.  **Clone your Fork**
    ```bash
    git clone [https://github.com/YOUR-USERNAME/trace.git](https://github.com/YOUR-USERNAME/trace.git)
    cd trace
    ```

3.  **Create a Branch**
    Branches must be named descriptively using the format: `type/short-description`.
    ```bash
    # Good Examples
    git checkout -b feat/temporal-soundscape
    git checkout -b fix/safari-hover-bug
    git checkout -b docs/update-readme
    ```

4.  **Make Changes**
    Write your code. Ensure it adheres to the **Coding Standards** below.

5.  **Commit Your Changes**
    We use **Conventional Commits**. This allows us to auto-generate changelogs.
    * `feat`: A new feature
    * `fix`: A bug fix
    * `docs`: Documentation only changes
    * `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
    * `refactor`: A code change that neither fixes a bug nor adds a feature
    * `perf`: A code change that improves performance
    * `chore`: Changes to the build process or auxiliary tools

    **Example:**
    ```bash
    git commit -m "feat: add subtle ambient sound on long press"
    ```

6.  **Push and Open a Pull Request (PR)**
    ```bash
    git push origin feat/temporal-soundscape
    ```
    Go to the original TRACE repository and click "Compare & pull request". Fill out the PR template completely.

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
* **12:00 PM Normalization:** All `Date` objects must be set to Noon to avoid timezone shifting bugs.
* **Performance:** Use `requestAnimationFrame` for visual updates. Avoid `setInterval` for high-frequency rendering.

---

## 4. Issue & Labeling Strategy

We use GitHub Issues to track our work. Before opening a PR, check if an issue exists.

### Labels
* `bug`: Something isn't working.
* `enhancement`: New feature or request.
* `design`: Visual or UX related changes (Requires strict review).
* `good first issue`: Good for newcomers.
* `wontfix`: The suggestion violates the TRACE philosophy.

---

## 5. Review Process

When you submit a PR, the maintainers will review it based on:
1.  **Psychological Integrity:** Does this feature add noise? Does it distract? If yes, it will be rejected.
2.  **Code Quality:** Is it clean? Does it follow the naming conventions?
3.  **Performance:** Does it cause jitter on mobile devices?

Thank you for helping us shape time.

---