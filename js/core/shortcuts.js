// Decides whether a keydown belongs to the app, kept apart from the handler so
// the rule can be tested. Getting this wrong is not cosmetic: a table that
// ignores modifiers swallows Ctrl+R, Ctrl+F and Ctrl+S from the browser.
//
// An entry is { run, prevent?, combo? }. `combo: true` means the shortcut
// *requires* Ctrl or Cmd; anything else requires that neither is held.
export function resolveShortcut(table, event) {
  if (!table || !event) return null;
  if (event.altKey) return null; // Alt combinations are never ours

  const action = table.get(String(event.key ?? '').toLowerCase());
  if (!action) return null;

  const combo = Boolean(event.ctrlKey || event.metaKey);
  return combo === Boolean(action.combo) ? action : null;
}
