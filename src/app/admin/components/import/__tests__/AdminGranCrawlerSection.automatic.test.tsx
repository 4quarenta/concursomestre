// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  collect: vi.fn(),
}));

vi.mock('@services/api', () => ({ apiClient: { get: mocks.get, post: mocks.post } }));
vi.mock('../granExtensionBridge', () => ({
  collectGranQuestions: mocks.collect,
  detectGranCollector: vi.fn(async () => ({ detected: true })),
  verifyGranCollector: vi.fn(async () => ({ connected: true, expiresAt: null })),
  collectGranTaxonomyBatch: vi.fn(),
  collectGranTaxonomyById: vi.fn(),
  collectGranQuestionById: vi.fn(),
  checkGranTaxonomyUpdates: vi.fn(),
}));
vi.mock('../useGranPublicationPolling', () => ({ useGranPublicationPolling: vi.fn() }));

describe('Gran automatic collection with filtered-out pages', () => {
  let root: Root;
  let container: HTMLDivElement;
  let lastBatchId: string | null;
  let pageCount: number;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    lastBatchId = null;
    pageCount = 1;
    mocks.get.mockImplementation(async () => ({ data: { data: {
      automaticCheckpoint: {
        runKey: 'filtered-page-run',
        requestUrl: 'https://rota-api.grancursosonline.com.br/v1/elastic/questao?anos[]=2000&page=1&perPage=20',
        perPage: 20,
        year: 2000,
        page: 1,
        status: 'paused',
        totalPages: null,
        lastBatchId,
      },
      taxonomyStatus: {},
      failureHistory: { items: [], total: 0, openCount: 0, retryingCount: 0 },
    } } }));
    mocks.collect.mockImplementation(async (requestUrl: string) => ({
      requestUrl,
      json: { data: { rows: [] } },
      examFiles: {},
      assetData: {},
    }));
    mocks.post.mockImplementation(async (_endpoint: string, input: Record<string, unknown>) => {
      switch (input.action) {
        case 'map_and_enqueue_publication':
          return { data: { data: {
            page: input.page,
            perPage: 20,
            total: pageCount === 1 ? 1 : 21,
            pages: pageCount,
            sourceQuestionCount: input.page === 1 ? (pageCount === 1 ? 1 : 20) : 0,
            questionCount: 0,
            fileCount: 0,
            batch: null,
          } } };
        case 'save_automatic_checkpoint':
          return { data: { data: input } };
        case 'clear_automatic_checkpoint':
          return { data: {} };
        default:
          throw new Error(`Unexpected request: ${String(input.action)}`);
      }
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const startCollection = async () => {
    const { default: AdminGranCrawlerSection } = await import('../AdminGranCrawlerSection');
    await act(async () => {
      root.render(<AdminGranCrawlerSection renderReviewQueue={() => null} />);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const toggle = container.querySelector<HTMLInputElement>(
      '[aria-label="Ativar ou desativar modo automatico"]',
    );
    expect(toggle).not.toBeNull();
    await act(async () => { toggle!.click(); });
  };

  it.each([null, 'previous-publication-batch'])(
    'finishes a page without a batch, preserving the previous batch identity (%s)',
    async (previousBatch) => {
      lastBatchId = previousBatch;
      await startCollection();

      expect(container.textContent).toContain('Coleta automatica do ano 2000 concluida.');
      expect(mocks.post).toHaveBeenCalledWith('admin/gran_crawler.php', expect.objectContaining({
        action: 'save_automatic_checkpoint', page: 2, status: 'running', lastBatchId: previousBatch,
      }), expect.anything());
      expect(mocks.post).toHaveBeenCalledWith('admin/gran_crawler.php', {
        action: 'clear_automatic_checkpoint',
      });
      expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
      expect(mocks.post.mock.calls.some(([, input]) => input.status === 'error')).toBe(false);
    },
  );

  it('advances past a filtered-out page and finishes when the source is exhausted', async () => {
    pageCount = 2;
    await startCollection();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(mocks.collect).toHaveBeenCalledTimes(2);
    expect(mocks.collect.mock.calls.map(([url]) => new URL(url).searchParams.get('page')))
      .toEqual(['1', '2']);
    expect(mocks.post.mock.calls.filter(([, input]) => input.action === 'save_automatic_checkpoint')
      .map(([, input]) => input.page)).toEqual([2, 3]);
    expect(container.textContent).toContain('Coleta automatica do ano 2000 concluida.');
    expect(mocks.post.mock.calls.some(([, input]) => input.status === 'error')).toBe(false);
  });
});
