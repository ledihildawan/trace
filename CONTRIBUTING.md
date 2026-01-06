# Contributing to Trace

## Commit Message Guidelines

This project follows **Conventional Commits**[](https://www.conventionalcommits.org/) for clear, automated changelogs and versioning.

### Format

    <type>[optional scope]: <description>

    [optional body]

    [optional footer]

- **Subject line**: Imperative mood (e.g., "add" not "added"), max 72 characters, English.
- **Body**: Explain *why* the change was made (wrap at 72 characters).
- **Types**:
  | Type     | Usage                                    | Version Impact |
  | -------- | ---------------------------------------- | -------------- |
  | feat     | New feature                              | MINOR          |
  | fix      | Bug fix                                  | PATCH          |
  | docs     | Documentation only (e.g., README)        | None           |
  | style    | Formatting, whitespace (no logic change) | None           |
  | refactor | Code refactoring (no behavior change)    | None           |
  | test     | Adding or updating tests                 | None           |
  | chore    | Maintenance (deps, config, etc.)         | None           |
  | perf     | Performance improvements                 | None           |
  | ci       | CI/CD changes                            | None           |
  | build    | Build system changes                     | None           |

- **Scope** (optional): e.g., `(README)`, `(cli)`, `(trace)`.
- **Breaking changes**: Add `!` after type (e.g., `feat!:`) or footer `BREAKING CHANGE:`.

### Tips for GitHub Copilot
- Use temporary comments like `<!-- COPILOT COMMIT: docs(README): ... -->` for explicit hints.
- Commit atomically (one logical change per commit).

### Examples

    docs(README): add Changelog section and fix image links

    - Introduce structured changelog
    - Update image paths to relative links

    feat(trace): add process name filtering

    - Implement --process flag
    - Update help text

    Closes #12

Thank you for contributing! 🚀