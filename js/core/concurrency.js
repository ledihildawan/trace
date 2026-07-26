// Runs `tasks` with at most `limit` in flight at once, resolving when every
// one has settled. Failures do not abort the batch: decoding one broken audio
// file should not stop the rest from loading.
export function runWithLimit(tasks, limit) {
  const total = tasks.length;
  if (total === 0) return Promise.resolve();
  const ceiling = Math.max(1, Math.floor(limit) || 1);

  return new Promise((resolve) => {
    let next = 0;
    let done = 0;
    const start = () => {
      while (next < total) {
        const task = tasks[next++];
        Promise.resolve()
          .then(task)
          .catch(() => {})
          .finally(() => {
            done++;
            if (done === total) resolve();
            else start();
          });
        // One slot filled; the finally above frees it again.
        return;
      }
    };
    for (let i = 0; i < Math.min(ceiling, total); i++) start();
  });
}
