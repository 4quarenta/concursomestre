import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/admin/components/import/AdminGranCrawlerSection.tsx'),
  'utf8',
);
const reviewQueueSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/admin/components/database/AdminDatabaseSections.tsx'),
  'utf8',
);
const reviewCardSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/admin/components/import/AdminImportSection.tsx'),
  'utf8',
);
const bridgeSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/admin/components/import/granExtensionBridge.ts'),
  'utf8',
);
const extensionWorkerSource = fs.readFileSync(
  path.resolve(process.cwd(), 'browser-extension/gran-collector/service-worker.js'),
  'utf8',
);

describe('AdminGranCrawlerSection requests', () => {
  it('loads taxonomy status and the current publication in one initial bootstrap', () => {
    expect(source).toContain('loadBootstrap(true, true, false, bootstrapController.signal)');
    expect(source).not.toContain('loadTaxonomyStatus();');
    expect(source).toContain('taxonomyStatus?: Record<string, GranTaxonomyStatus>');
    expect(source).toContain('currentBatch?: GranPublicationBatch | null');
    expect(source.match(/apiClient\.get\(ENDPOINT(?:, \{ signal: controller\.signal \})?\)/g)).toHaveLength(1);
    expect(source).toContain('fetchGranCrawlerBootstrap');
    expect(source).not.toContain("handleVisibility();\n    document.addEventListener('visibilitychange'");
  });

  it('coalesces bootstrap refreshes, caches remounts, and never polls in the background', () => {
    expect(source).toContain('if (bootstrapRequest) return bootstrapRequest;');
    expect(source).toContain('BOOTSTRAP_CACHE_MS = 60_000');
    expect(source).toContain('bootstrapCache = { data, fetchedAt: Date.now() };');
    expect(source).toContain('cancelGranCrawlerBootstrap');
    expect(source).toContain('bootstrapAbortController?.abort();');
    expect(source).toContain('const refreshCurrentProcessing = React.useCallback');
    expect(source).not.toContain('window.setInterval(');
    expect(source).not.toContain('visibilitychange');
    expect(source).toContain('const ACTIVE_BATCH_STATUS_REFRESH_MS = 15_000;');
    expect(source).toContain("action: 'publication_batch_progress'");
    expect(source).toContain("document.visibilityState !== 'visible'");
  });

  it('shows only the current processing summary and no processing history', () => {
    expect(source).toContain('data-testid="gran-current-processing"');
    expect(source).toContain("hasActiveJobs ? 'Processamento atual' : 'Último processamento'");
    expect(source).not.toContain('Histórico de processamento');
    expect(source).not.toContain('gran-processing-history-pagination');
    expect(source).not.toContain('handleHistoryPrevious');
    expect(source).not.toContain('handleHistoryNext');
  });

  it('uses a real forced extension ping and verifies stale taxonomy manifests before sync', () => {
    expect(source).toContain('checkCollector(true, true)');
    expect(source).toContain('isTaxonomyVerificationFresh');
    expect(source).toContain('Verificando atualizacoes antes de sincronizar.');
    expect(source).toContain('handleCheckTaxonomyUpdates(true)');
    expect(source).toContain('data-testid="gran-taxonomy-check-result"');
    expect(source).toContain('changedCategories');
    expect(source.indexOf('data-testid="gran-taxonomy-check-result"'))
      .toBeLessThan(source.indexOf('{taxonomyExpanded ? <>'));
  });

  it('uses bounded persistence and cursor-based cargo finalization', () => {
    expect(source).toContain('splitGranTaxonomyResponses');
    expect(source).toContain('finalizeRelations: false');
    expect(source.match(/action: 'finalize_cargo_taxonomy_relations'/g)).toHaveLength(1);
    expect(source).toContain('finalizeCargoRelationsInChunks(true)');
    expect(source).toContain('finalizeCargoRelationsInChunks(false)');
    expect(source).toContain('pendingOnly,');
    expect(source).toContain('nextCursor <= cursor');
    expect(source).toContain('{ timeout: 80_000 }');
  });

  it('accepts a manual bounded page size and delegates every status to the unified queue', () => {
    expect(source).toContain('MAX_GRAN_QUESTIONS_PER_PAGE = 1000');
    expect(source).toContain('type="number"');
    expect(source).toContain('max={MAX_GRAN_QUESTIONS_PER_PAGE}');
    expect(source).toContain("GRAN_LAST_YEAR_STORAGE_KEY = 'admin.granCrawler.lastYear'");
    expect(source).toContain('window.localStorage.setItem(GRAN_LAST_YEAR_STORAGE_KEY, savedYear)');
    expect(source).toContain('setResult(data);');
    expect(source).not.toContain('mergeGranReviewPayloads(current.payloads');
    expect(source).toContain('partitionGranReviewPayloads');
    expect(source).toContain('renderReviewQueue(result?.payloads || []');
    expect(source).not.toContain('<details className={ADMIN_PAGE_PANEL_CLASS}>');
    expect(reviewQueueSource).toContain("useState<GranReviewDisplayStatus | 'all'>('review')");
    expect(reviewQueueSource).toContain("{ value: 'failed', label: 'Falhou'");
    expect(reviewQueueSource).toContain('Tentar falhas novamente');
    expect(reviewQueueSource.match(/action: 'enqueue_publication'/g)).toHaveLength(2);
  });

  it('maps and renders the sanitized reason for every failed question', () => {
    expect(source).toContain('questionErrors?: Record<string, { code?: string; message?: string }>');
    expect(reviewQueueSource).toContain('queueErrorByQuestionKey');
    expect(reviewQueueSource).toContain('reviewQuestionQueueErrors');
    expect(reviewCardSource).toContain("queueStatus === 'failed' && queueError");
    expect(reviewCardSource).toContain('Motivo da falha: {queueError}');
  });

  it('shows the filtered year and per-question outcome details in the latest batch', () => {
    expect(source).toContain('collectionYears?: number[]');
    expect(source).toContain('Detalhes das {currentBatchQuestionDetails.length} questões');
    expect(source).toContain('formatQuestionKey(detail.key, detail.index)');
    expect(source).toContain("duplicate: 'Já existente'");
    expect(source).toContain("detail.status === 'failed' ? 'Falha sem detalhe registrado.'");
  });

  it('pipelines automatic collection with bounded publication and persists a resumable checkpoint', () => {
    expect(source).toContain('Modo automatico');
    expect(source).not.toContain('Paginas por lote');
    expect(source).not.toContain('automaticPagesPerBatch');
    expect(source).toContain('Publica enquanto coleta a pagina seguinte');
    expect(source).toContain('automaticCheckpoint?: GranAutomaticCheckpoint | null');
    expect(source).toContain("action: 'save_automatic_checkpoint'");
    expect(source).toContain("action: 'clear_automatic_checkpoint'");
    expect(source).not.toContain('for (let offset = 0; ; offset += 1)');
    expect(source).not.toContain('MAX_AUTOMATIC_QUESTIONS_PER_BATCH');
    expect(source).toContain('Coletando pagina ${cursorPage} de ${displayedTotal || \'?\'} (ano ${cursorYear}).');
    expect(source).toContain('Publicando pagina ${cursorPage} de ${knownPageCount || \'?\'} (ano ${cursorYear})');
    expect(source).toContain('function fingerprintAutomaticInput(input: unknown): string');
    expect(source).toContain("action: 'map_and_enqueue_publication'");
    expect(source).toContain('const collectAndEnqueueAutomaticPage = React.useCallback');
    expect(source).toContain('fingerprintAutomaticInput({');
    expect(source).not.toContain('payloads: pagePayloads');
    expect(source).toContain("action: 'publication_batch_progress'");
    expect(source).toContain('const AUTOMATIC_BATCH_STATUS_POLL_MS = 12_000;');
    expect(source).toContain('readRateLimitRetryDelay');
    expect(source).toContain('attempt <= 5');
    expect(source).toContain('Limite temporario recebido na pagina ${cursorPage}');
    expect(source).toContain('MAX_AUTOMATIC_IN_FLIGHT_BATCHES = 2');
    expect(source).toContain('inFlightBatches.push({');
    expect(source).toContain('if (inFlightBatches.length >= MAX_AUTOMATIC_IN_FLIGHT_BATCHES)');
    expect(source).toContain('await waitForOldestPublication();');
    expect(source).toContain('const processedBatch = await waitForPublicationBatch(flight.batch, controller.signal);');
    expect(source).toContain('const nextPage = exhaustedYear ? 1 : cursorPage + 1;');
    expect(source.indexOf('const nextPage = exhaustedYear ? 1 : cursorPage + 1;'))
      .toBeLessThan(source.indexOf('if (inFlightBatches.length >= MAX_AUTOMATIC_IN_FLIGHT_BATCHES)'));
    expect(source).toContain('collectGranQuestions(requestUrl, signal)');
    expect(bridgeSource).toContain("signal?.addEventListener('abort', handleAbort, { once: true });");
  });

  it('loads only active durable failures and removes resolved items from the operational list', () => {
    expect(source).toContain('failureHistory?: GranFailureHistoryPage');
    expect(source).toContain("action: 'list_publication_failures'");
    expect(source).toContain("status: 'active'");
    expect(source).toContain("failure.status === 'open' || failure.status === 'retrying'");
    expect(source).toContain("action: 'get_publication_failure'");
    expect(source).toContain("action: 'retry_publication_failures'");
    expect(source).toContain('failureIds,');
    expect(source).toContain("action: 'ignore_publication_failure'");
    expect(source).toContain("action: 'ignore_all_publication_failures'");
    expect(source).toContain('data-testid="gran-publication-failure-history"');
    expect(source).toContain('Moderar e editar');
    expect(source).toContain('Tentar novamente');
    expect(source).toContain('Tentar todas ({failureHistory.openCount})');
    expect(source).toContain('Ignorar todas ({failureHistory.total})');
    expect(source).toContain('Questoes com erro pendente ({failureHistory.total})');
    expect(source).toContain('Ignorar');
    expect(source).toContain("failure.status === 'open' || failure.status === 'retrying'");
    expect(source).not.toContain("(['all', 'open', 'resolved'] as const)");
    expect(source).toContain('Depois de publicada, a questao e removida automaticamente desta lista.');
  });

  it('offers a bounded manual cleanup for closed diagnostics without touching active failures', () => {
    expect(source).toContain('failureRetention?: GranFailureRetention');
    expect(source).toContain("action: 'publication_failure_retention_preview'");
    expect(source).toContain("action: 'purge_publication_failure_diagnostics'");
    expect(source).toContain('Limpar diagnosticos antigos');
    expect(source).toContain('Falhas abertas e em nova tentativa ficam preservadas.');
    expect(source).toContain('failureActionId === \'retention\'');
  });

  it('uses the fixed single-question Gran endpoint only as moderation fallback', () => {
    expect(bridgeSource).toContain('collectGranQuestionById');
    expect(bridgeSource).toContain("'COLLECT_QUESTION'");
    expect(extensionWorkerSource).toContain("const GRAN_SINGLE_QUESTION_PATH = '/open/elastic/questao'");
    expect(extensionWorkerSource).toContain("url.searchParams.set('shouldId', externalId)");
    expect(extensionWorkerSource).toContain("url.searchParams.set('perPage', '1')");
  });
});
