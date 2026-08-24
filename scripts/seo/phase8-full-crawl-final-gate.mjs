#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateFinalGate,
  runHttpCrawl,
  validateContracts,
} from './lib/phase8-final-gate.mjs';
import { renderPhase8MarkdownReport } from './lib/phase8-final-report.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (name, fallback = '') => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
};
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));

const main = async () => {
  const baseUrl = arg('base-url', process.env.CM_PHASE8_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const outputPath = path.resolve(root, arg('output', '.tmp/seo/phase-8-final-gate.json'));
  const markdownPath = path.resolve(root, arg('markdown', 'docs/seo/phase-8-full-crawl-final-seo-gate-2026-08-23.md'));
  const browserReportPath = arg('browser-report', '');
  const validationPath = arg('validation', '');
  const [pageMap, graph, structuralPolicy, indexPolicy, indexFixtures, crawlConfig] = await Promise.all([
    readJson('config/seo/seo-production-page-map.v1.json'),
    readJson('config/seo/internal-link-graph.v1.json'),
    readJson('config/seo/structural-route-policy.v1.json'),
    readJson('config/seo/index-policy-phase-6.v1.json'),
    readJson('config/seo/index-policy-phase-6-fixtures.v1.json'),
    readJson('config/seo/phase-8-full-crawl.v1.json'),
  ]);
  const browserReport = browserReportPath
    ? JSON.parse(await readFile(path.resolve(root, browserReportPath), 'utf8'))
    : null;
  const validation = validationPath
    ? JSON.parse(await readFile(path.resolve(root, validationPath), 'utf8'))
    : {};
  const contract = validateContracts({ pageMap, graph, structuralPolicy, indexPolicy, indexFixtures, crawlConfig });
  const crawl = await runHttpCrawl({ baseUrl, pageMap, config: crawlConfig });
  const result = evaluateFinalGate({ pageMap, graph, indexPolicy, crawlConfig, contract, crawl, browserReport });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await mkdir(path.dirname(markdownPath), { recursive: true });
  await writeFile(markdownPath, renderPhase8MarkdownReport({
    result,
    pageMap,
    graph,
    crawlConfig,
    browserReport,
    validation,
  }), 'utf8');
  process.stdout.write(`${JSON.stringify({
    phase: result.phase,
    seoGate: result.seoGate,
    families: result.families,
    targetIndexFamilies: result.targetIndexFamilies,
    permanentNoindexFamilies: result.permanentNoindexFamilies,
    crawlStats: result.crawlStats,
    p0: result.p0,
    p1: result.p1,
    p2: result.p2,
    blockingGates: result.blockingGates,
    realDataValidationPending: result.realDataValidationPending,
    productionActivated: result.productionActivated,
    productionSitemapPublished: result.productionSitemapPublished,
    searchEnginesNotified: result.searchEnginesNotified,
    output: path.relative(root, outputPath),
    markdown: path.relative(root, markdownPath),
  }, null, 2)}\n`);
  if (result.seoGate !== 'GO') process.exitCode = 1;
};

main().catch((error) => {
  process.stderr.write(`Phase 8 final gate failed closed: ${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
