import { useEffect } from 'react';
import type { GranPublicationBatch } from './AdminGranCrawlerSection';

type Options = {
  batchId?: string;
  status?: string;
  automaticMode: boolean;
  retryingCount: number;
  intervalMs: number;
  readBatch: (batchId: string, complete: boolean, signal: AbortSignal) => Promise<GranPublicationBatch>;
  refreshFailures: () => Promise<void>;
  onBatch: (batch: GranPublicationBatch, complete: boolean) => void;
};

export function useGranPublicationPolling({
  batchId, status, automaticMode, retryingCount, intervalMs, readBatch, refreshFailures, onBatch,
}: Options) {
  useEffect(() => {
    const active = status === 'pending' || status === 'processing';
    if (automaticMode || (!active && retryingCount === 0)) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let inFlight = false;
    let completed = false;
    const refresh = async () => {
      if (controller.signal.aborted || inFlight) return;
      clearTimeout(timer);
      inFlight = true;
      try {
        if (document.visibilityState !== 'visible') return;
        let batch: GranPublicationBatch | undefined;
        let complete = false;
        if (active && batchId && !completed) {
          batch = await readBatch(batchId, false, controller.signal);
          if (controller.signal.aborted) return;
          complete = batch.status !== 'pending' && batch.status !== 'processing';
          // Progress omits per-question outcomes. Reload them before ending polling.
          if (complete) batch = await readBatch(batchId, true, controller.signal);
        }
        if (controller.signal.aborted) return;
        if (complete || retryingCount > 0) await refreshFailures();
        if (controller.signal.aborted) return;
        if (batch) onBatch(batch, complete);
        completed = complete;
      } catch {
        // Observation failures must not resubmit the batch or stop the worker.
      } finally {
        inFlight = false;
        if (!controller.signal.aborted && !completed) timer = setTimeout(refresh, intervalMs);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    timer = setTimeout(refresh, intervalMs);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [batchId, status, automaticMode, retryingCount, intervalMs, readBatch, refreshFailures, onBatch]);
}
