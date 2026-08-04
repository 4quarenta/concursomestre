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

describe('AdminGranCrawlerSection requests', () => {
  it('loads taxonomy status and the current publication in one initial bootstrap', () => {
    expect(source).toContain('loadBootstrap(true, true)');
    expect(source).not.toContain('loadTaxonomyStatus();');
    expect(source).toContain('taxonomyStatus?: Record<string, GranTaxonomyStatus>');
    expect(source).toContain('currentBatch?: GranPublicationBatch | null');
    expect(source.match(/apiClient\.get\(ENDPOINT\)/g)).toHaveLength(1);
    expect(source).toContain('fetchGranCrawlerBootstrap');
    expect(source).not.toContain("handleVisibility();\n    document.addEventListener('visibilitychange'");
  });

  it('coalesces concurrent bootstrap refreshes and caches remounts', () => {
    expect(source).toContain('if (bootstrapRequest) return bootstrapRequest;');
    expect(source).toContain('BOOTSTRAP_CACHE_MS = 60_000');
    expect(source).toContain('bootstrapCache = { data, fetchedAt: Date.now() };');
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
});
