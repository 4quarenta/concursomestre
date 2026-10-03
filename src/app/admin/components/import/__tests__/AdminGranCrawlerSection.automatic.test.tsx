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

  const mountCrawler = async () => {
    const { default: AdminGranCrawlerSection } = await import('../AdminGranCrawlerSection');
    await act(async () => {
      root.render(<AdminGranCrawlerSection renderReviewQueue={() => null} />);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  };

  const startCollection = async () => {
    await mountCrawler();
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
    let releaseSecondPage: (() => void) | null = null;
    mocks.collect.mockImplementation(async (requestUrl: string) => {
      if (new URL(requestUrl).searchParams.get('page') === '2') {
        await new Promise<void>((resolve) => { releaseSecondPage = resolve; });
      }
      return { requestUrl, json: { data: { rows: [] } }, examFiles: {}, assetData: {} };
    });
    await startCollection();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(mocks.collect).toHaveBeenCalledTimes(2);
    expect(mocks.collect.mock.calls.map(([url]) => new URL(url).searchParams.get('page')))
      .toEqual(['1', '2']);
    expect(container.textContent).toContain('Coletando pagina 2 de 2 (ano 2000).');
    await act(async () => { releaseSecondPage?.(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mocks.post.mock.calls.filter(([, input]) => input.action === 'save_automatic_checkpoint')
      .map(([, input]) => input.page)).toEqual([2, 3]);
    expect(container.textContent).toContain('Coleta automatica do ano 2000 concluida.');
    expect(mocks.post.mock.calls.some(([, input]) => input.status === 'error')).toBe(false);
  });

  it('shows the backend validation message instead of a generic HTTP 400', async () => {
    mocks.post.mockImplementation(async (_endpoint: string, input: Record<string, unknown>) => {
      if (input.action === 'map_and_enqueue_publication') {
        throw Object.assign(new Error('Request failed with status code 400'), {
          response: { data: { message: 'A taxonomia precisa ser sincronizada.' } },
        });
      }
      if (input.action === 'save_automatic_checkpoint') return { data: { data: input } };
      throw new Error(`Unexpected request: ${String(input.action)}`);
    });

    await startCollection();

    expect(container.textContent).toContain('A taxonomia precisa ser sincronizada.');
    expect(container.textContent).not.toContain('Request failed with status code 400');
  });

  it('preserves the failing page and does not declare completion after a truncated Gran response', async () => {
    mocks.post.mockImplementation(async (_endpoint: string, input: Record<string, unknown>) => {
      if (input.action === 'map_and_enqueue_publication') {
        throw Object.assign(new Error('Request failed with status code 400'), {
          response: { data: { message: 'Coleta incompleta: solicitou 100, mas a Gran respondeu perPage 5.' } },
        });
      }
      if (input.action === 'save_automatic_checkpoint') return { data: { data: input } };
      throw new Error(`Unexpected request: ${String(input.action)}`);
    });
    await startCollection();
    expect(container.textContent).toContain('Coleta incompleta: solicitou 100');
    expect(container.textContent).not.toContain('Coleta automatica do ano 2000 concluida.');
    expect(mocks.post).toHaveBeenCalledWith('admin/gran_crawler.php', expect.objectContaining({
      action: 'save_automatic_checkpoint', page: 1, status: 'error',
    }), undefined);
    expect(mocks.post.mock.calls.some(([, input]) => input.action === 'clear_automatic_checkpoint')).toBe(false);
  });

  it('retries a large page with a safe size when Gran ignores the year filter', async () => {
    mocks.get.mockResolvedValue({ data: { data: {
      automaticCheckpoint: {
        runKey: 'large-page-run',
        requestUrl: 'https://rota-api.grancursosonline.com.br/v1/elastic/questao?anos[]=2000&page=1&perPage=1000',
        perPage: 1000,
        year: 2000,
        page: 1,
        status: 'paused',
        totalPages: null,
        lastBatchId: null,
      },
      taxonomyStatus: {},
      failureHistory: { items: [], total: 0, openCount: 0, retryingCount: 0 },
    } } });
    mocks.collect.mockImplementation(async (requestUrl: string) => ({
      requestUrl,
      json: new URL(requestUrl).searchParams.get('perPage') === '1000'
        ? { data: { rows: [{ id: 1, ano: 2012 }] } }
        : { data: { rows: [{ id: 1, ano: 2000 }] } },
      examFiles: {},
      assetData: {},
    }));

    await startCollection();

    expect(mocks.collect.mock.calls.map(([url]) => new URL(url).searchParams.get('perPage')))
      .toEqual(['1000', '20']);
    expect(mocks.post).toHaveBeenCalledWith('admin/gran_crawler.php', expect.objectContaining({
      action: 'map_and_enqueue_publication',
      perPage: 20,
    }), expect.anything());
    expect(container.textContent).toContain('Coleta automatica do ano 2000 concluida.');
  });

  it('allows hiding failures and shows the green confirmed-publication counter', async () => {
    await mountCrawler();
    const toggle = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Ocultar falhas')!;
    await act(async () => { toggle.click(); });
    expect(container.querySelector<HTMLElement>('#gran-failures-content')?.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="gran-automatic-published-count"]')?.textContent).toContain('0 questões adicionadas para o ano 2000');
    await act(async () => { toggle.click(); });
    expect(container.querySelector<HTMLElement>('#gran-failures-content')?.hidden).toBe(false);
  });

  it.each(['year', 'direct-url'])(
    'loads a manual filtered query (%s) and displays its total separately from the page size',
    async (filterMode) => {
      mocks.get.mockResolvedValue({ data: { data: { taxonomyStatus: {}, automaticCheckpoint: null } } });
      mocks.post.mockImplementation(async (_endpoint: string, input: Record<string, unknown>) => {
        expect(input.action).toBe('map');
        return { data: { data: {
          page: 1, perPage: 20, total: 1803, totalKnown: true, pages: 91,
          questionCount: 20, fileCount: 0, requestUrl: input.granRequestUrl,
          payloads: [{ schemaVersion: 'question-import.v2', exam: {}, questions: Array.from(
            { length: 20 }, (_, index) => ({ tempId: `question-${index}` }),
          ) }],
        } } };
      });
      await mountCrawler();
      const input = container.querySelector<HTMLInputElement>(
        filterMode === 'year' ? 'input[placeholder="2026"]' : 'input[type="url"]',
      )!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
          input,
          filterMode === 'year' ? '2000'
            : 'https://rota-api.grancursosonline.com.br/v1/elastic/questao?anos[]=2000&perPage=20&page=1&bancas[]=10',
        );
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const load = Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'Carregar questões')!;
      await act(async () => { load.click(); });

      expect(mocks.collect).toHaveBeenCalledTimes(1);
      const request = new URL(mocks.collect.mock.calls[0][0]);
      expect(request.searchParams.get('anos[]')).toBe('2000');
      expect(request.searchParams.get('perPage')).toBe('20');
      expect(request.searchParams.get('inedita')).toBe('0');
      if (filterMode === 'direct-url') expect(request.searchParams.get('bancas[]')).toBe('10');
      expect(container.querySelector('[data-testid="gran-review-filter-count"]')?.textContent)
        .toBe('1.803 questões encontradas para o filtro aplicado.');
      expect(container.textContent).toContain('20 questão(ões) carregada(s) nesta página.');
    },
  );
});
