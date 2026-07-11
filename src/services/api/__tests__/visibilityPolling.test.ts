import { describe, expect, it, vi } from 'vitest';

import { createVisibilityAwarePoller } from '../visibilityPolling';

describe('createVisibilityAwarePoller', () => {
  it('does not schedule polling while the tab is hidden', () => {
    const setTimer = vi.fn();
    const onPause = vi.fn();
    const poller = createVisibilityAwarePoller({
      isVisible: () => false,
      poll: vi.fn().mockResolvedValue(undefined),
      onPause,
      setTimer: setTimer as never,
      clearTimer: vi.fn() as never,
    });

    poller.start(1000);
    poller.pause();

    expect(setTimer).not.toHaveBeenCalled();
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('runs only the scheduled visible poll and pauses pending work', async () => {
    let visible = true;
    let scheduledCallback: (() => void) | null = null;
    const poll = vi.fn().mockResolvedValue(undefined);
    const onPause = vi.fn();
    const setTimer = vi.fn((callback: () => void) => {
      scheduledCallback = callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });
    const clearTimer = vi.fn();
    const poller = createVisibilityAwarePoller({
      isVisible: () => visible,
      poll,
      onPause,
      setTimer,
      clearTimer,
    });

    poller.start(1000);
    expect(setTimer).toHaveBeenCalledTimes(1);

    scheduledCallback?.();
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);

    poller.resume(1000);
    expect(setTimer).toHaveBeenCalledTimes(2);
    visible = false;
    poller.pause();
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(clearTimer).toHaveBeenCalled();
  });
});
