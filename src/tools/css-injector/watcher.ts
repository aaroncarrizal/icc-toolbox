import chokidar from "chokidar";

/** Calls onChange (debounced) when anything under `paths` is added, changed or removed. */
export function watch(paths: string | string[], onChange: () => void, delayMs = 100): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const watcher = chokidar.watch(paths, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 },
  });
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, delayMs);
  };
  watcher.on("add", fire).on("change", fire).on("unlink", fire);
  return () => {
    if (timer) clearTimeout(timer);
    void watcher.close();
  };
}
