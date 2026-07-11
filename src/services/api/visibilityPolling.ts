type TimerHandle = ReturnType<typeof setTimeout>;

export type VisibilityAwarePollingOptions = {
  isVisible: () => boolean;
  poll: () => Promise<void>;
  onPause?: () => void;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (timer: TimerHandle) => void;
};

export type VisibilityAwarePoller = {
  start: (delayMs: number) => void;
  resume: (delayMs: number) => void;
  pause: () => void;
  stop: () => void;
};

/**
 * Schedules polling only while the document is visible. The caller owns the
 * actual request and can cancel it from onPause when the tab is hidden.
 */
export const createVisibilityAwarePoller = ({
  isVisible,
  poll,
  onPause,
  setTimer = (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer = (timer) => clearTimeout(timer),
}: VisibilityAwarePollingOptions): VisibilityAwarePoller => {
  let timer: TimerHandle | null = null;
  let stopped = false;

  const clearScheduledPoll = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  const schedule = (delayMs: number) => {
    clearScheduledPoll();
    if (stopped || !isVisible()) {
      return;
    }

    timer = setTimer(() => {
      timer = null;
      if (stopped || !isVisible()) {
        return;
      }

      void poll();
    }, Math.max(0, delayMs));
  };

  return {
    start: schedule,
    resume: schedule,
    pause: () => {
      clearScheduledPoll();
      onPause?.();
    },
    stop: () => {
      stopped = true;
      clearScheduledPoll();
      onPause?.();
    },
  };
};
