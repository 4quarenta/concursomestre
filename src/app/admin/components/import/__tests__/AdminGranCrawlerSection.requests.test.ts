import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/admin/components/import/AdminGranCrawlerSection.tsx'),
  'utf8',
);

describe('AdminGranCrawlerSection requests', () => {
  it('loads jobs, taxonomy status and publication batches in one initial bootstrap', () => {
    expect(source).toContain('loadBootstrap(true, true, false, null)');
    expect(source).not.toContain('loadTaxonomyStatus();');
    expect(source).toContain('taxonomyStatus?: Record<string, GranTaxonomyStatus>');
    expect(source).toContain('publicationBatches?: GranPublicationBatch[]');
    expect(source.match(/apiClient\.get\(ENDPOINT,/g)).toHaveLength(1);
    expect(source).toContain('fetchGranCrawlerBootstrap');
    expect(source).not.toContain("handleVisibility();\n    document.addEventListener('visibilitychange'");
  });

  it('coalesces concurrent bootstrap refreshes and caches remounts', () => {
    expect(source).toContain('const pending = bootstrapRequests.get(cacheKey);');
    expect(source).toContain('if (pending) return pending;');
    expect(source).toContain('BOOTSTRAP_CACHE_MS = 60_000');
    expect(source).toContain('bootstrapCache.set(cacheKey, { data, fetchedAt: Date.now() });');
  });

  it('paginates processing history with one cursor-aware request per page', () => {
    expect(source).toContain('history_cursor: historyCursor');
    expect(source).toContain('data-testid="gran-processing-history-pagination"');
    expect(source).toContain('handleHistoryPrevious');
    expect(source).toContain('handleHistoryNext');
    expect(source).toContain('Página {historyPage}');
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

  it('accepts a manual bounded page size and keeps published questions collapsed', () => {
    expect(source).toContain('MAX_GRAN_QUESTIONS_PER_PAGE = 100');
    expect(source).toContain('type="number"');
    expect(source).toContain('max={MAX_GRAN_QUESTIONS_PER_PAGE}');
    expect(source).toContain('partitionGranReviewPayloads');
    expect(source).toContain('<details className={ADMIN_PAGE_PANEL_CLASS}>');
    expect(source).toContain('Questões já publicadas');
  });
});
