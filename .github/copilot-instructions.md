# Copilot Instructions for Commit Messages

Always generate commit messages following Conventional Commits specification.

Key rules:

- Use format: <type>[optional scope]: <imperative description>
- Imperative mood: e.g., "add", "fix", "update" — never "added" or "fixed".
- Subject line: English, lowercase type, max 72 characters.
- Separate body with blank line.
- In body: Use bullet points starting with "-" to explain changes and why.
- Supported types: feat, fix, docs, style, refactor, test, chore, perf, ci, build.
- Include scope when relevant (e.g., (README), (cli), (trace)).
- If breaking change: Add "!" after type or include "BREAKING CHANGE:" footer.
- Analyze the full diff to accurately summarize all changes.
- Prefer concise but informative messages.
- Do not add unnecessary emojis or tags unless specified.

Reference the project's CONTRIBUTING.md for full details if needed.
