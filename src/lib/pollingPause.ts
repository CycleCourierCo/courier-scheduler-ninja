/**
 * Tiny module-level switch so open dialogs can pause background polling
 * (polling swaps the order object and steals focus from inputs mid-typing).
 */
let pauseCount = 0;

export const pausePolling = () => {
  pauseCount += 1;
};

export const resumePolling = () => {
  pauseCount = Math.max(0, pauseCount - 1);
};

export const isPollingPaused = () => pauseCount > 0;

/** Convenience for dialog onOpenChange handlers. */
export const setPollingPaused = (paused: boolean, wasPaused: boolean) => {
  if (paused && !wasPaused) pausePolling();
  if (!paused && wasPaused) resumePolling();
};
