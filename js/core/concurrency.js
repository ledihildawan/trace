// Runs `tasks` with at most `limit` in flight at once, resolving when every
// one has settled. Failures do not abort the batch: decoding one broken audio
// file should not stop the rest from loading.
export async function runWithLimit(tasks, limit) {
  if (tasks.length === 0) return;
  const workers = Math.min(Math.max(1, Math.floor(limit) || 1), tasks.length);

  // One iterator shared by every worker. Pulling from it is what schedules the
  // work: a worker takes the next task the moment it frees up, so a slow
  // decode never holds up the ones queued behind it.
  const queue = tasks[Symbol.iterator]();
  const drain = async () => {
    for (const task of queue) {
      await Promise.try(task).catch(() => {});
    }
  };
  await Promise.all(Array.from({ length: workers }, drain));
}
