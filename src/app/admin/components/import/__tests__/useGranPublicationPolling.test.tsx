// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGranPublicationPolling } from '../useGranPublicationPolling';
import type { GranPublicationBatch } from '../AdminGranCrawlerSection';

const batch = (status: string): GranPublicationBatch => ({
  batchId: 'retry-batch', status, questionCount: 1, jobCount: 1,
  pending: status === 'pending' ? 1 : 0, processing: 0,
  published: status === 'done' ? 1 : 0, duplicates: 0, failures: status === 'partial' ? 1 : 0,
});
type Options = Parameters<typeof useGranPublicationPolling>[0];
function Monitor(props: Options) { useGranPublicationPolling(props); return null; }

describe('Gran publication retry observation', () => {
  let root: Root;
  let options: Options;
  const render = async () => { await act(async () => root.render(<Monitor {...options} />)); };
  const tick = async () => { await act(async () => vi.advanceTimersByTimeAsync(15000)); };

  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    root = createRoot(document.createElement('div'));
    options = {
      batchId: 'retry-batch', status: 'pending', automaticMode: false, retryingCount: 1, intervalMs: 15000,
      readBatch: vi.fn().mockResolvedValue(batch('pending')),
      refreshFailures: vi.fn().mockResolvedValue(undefined),
      onBatch: vi.fn(),
    };
  });
  afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });

  it.each(['done', 'partial', 'failed'])('reloads outcomes and failure history on %s, then stops', async (status) => {
    const details = { ...batch(status), questionStatuses: { 'gran:7': status === 'done' ? 'published' as const : 'failed' as const } };
    options.readBatch = vi.fn().mockResolvedValueOnce(batch(status)).mockResolvedValueOnce(details);
    await render(); await tick();
    expect(options.readBatch).toHaveBeenNthCalledWith(1, 'retry-batch', false, expect.any(AbortSignal));
    expect(options.readBatch).toHaveBeenNthCalledWith(2, 'retry-batch', true, expect.any(AbortSignal));
    expect(options.refreshFailures).toHaveBeenCalledOnce();
    expect(options.onBatch).toHaveBeenCalledWith(details, true);
    await tick();
    expect(options.readBatch).toHaveBeenCalledTimes(2);
  });

  it('retries observation after a network error without resubmitting publication', async () => {
    options.readBatch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(batch('pending'));
    await render(); await tick(); await tick();
    expect(options.readBatch).toHaveBeenCalledTimes(2);
    expect(options.onBatch).toHaveBeenCalledWith(batch('pending'), false);
  });

  it('resumes on returning to a hidden tab and prevents overlapping polls', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await render(); await tick();
    expect(options.readBatch).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(options.readBatch).toHaveBeenCalledOnce();
    await tick(); expect(options.readBatch).toHaveBeenCalledTimes(2);
  });

  it('refreshes other retrying failures even when the displayed batch has ended', async () => {
    options.status = 'done';
    await render(); await tick();
    expect(options.readBatch).not.toHaveBeenCalled();
    expect(options.refreshFailures).toHaveBeenCalledOnce();
    options.retryingCount = 0;
    await render(); await tick();
    expect(options.refreshFailures).toHaveBeenCalledOnce();
  });

  it.each(['done', 'partial'])('converges batch details and retry UI together after %s', async (status) => {
    const container = document.createElement('div');
    await act(async () => root.unmount());
    root = createRoot(container);
    options.readBatch = vi.fn().mockResolvedValue(batch(status));
    function RetryScreen() {
      const [current, setCurrent] = React.useState(batch('pending'));
      const [failure, setFailure] = React.useState('retrying');
      const refreshFailures = React.useCallback(async () => {
        setFailure(status === 'done' ? 'resolved' : 'open');
      }, []);
      const onBatch = React.useCallback((value: GranPublicationBatch) => setCurrent(value), []);
      useGranPublicationPolling({ ...options, status: current.status,
        retryingCount: failure === 'retrying' ? 1 : 0, refreshFailures, onBatch });
      return <div data-status={current.status}>{failure !== 'resolved'
        ? <button disabled={failure === 'retrying'}>{failure === 'retrying' ? 'waiting' : 'retry'}</button> : null}</div>;
    }
    await act(async () => root.render(<RetryScreen />));
    await tick();
    expect(container.firstElementChild?.getAttribute('data-status')).toBe(status);
    if (status === 'done') expect(container.querySelector('button')).toBeNull();
    else expect(container.querySelector('button')?.disabled).toBe(false);
    await tick();
    expect(options.readBatch).toHaveBeenCalledTimes(2);
  });

  it('aborts stale observations on unmount and removes the visibility listener', async () => {
    let finish!: (value: GranPublicationBatch) => void;
    options.readBatch = vi.fn().mockImplementation(() => new Promise<GranPublicationBatch>((resolve) => { finish = resolve; }));
    await render(); await tick();
    await act(async () => root.unmount());
    await act(async () => finish(batch('done')));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(options.onBatch).not.toHaveBeenCalled();
    expect(options.refreshFailures).not.toHaveBeenCalled();
    expect(vi.mocked(options.readBatch).mock.calls[0]?.[2].aborted).toBe(true);
    root = createRoot(document.createElement('div'));
  });
});
