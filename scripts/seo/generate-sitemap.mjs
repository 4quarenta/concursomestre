import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const publicDir = path.join(projectRoot, 'public');
const websiteManifestPath = path.join(projectRoot, 'config', 'platform', 'website.json');

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || 'http://localhost/questao-pro-backend/api/';
const QUESTION_PAGE_LIMIT = 500;
const INSTITUTIONAL_PATHS = ['/', '/plans', '/faq', '/changelog', '/privacy', '/terms'];

const normalizeUrlBase = (value) => {
  if (!value) {
    return 'https://concursomestre.com.br/';
  }

  return value.endsWith('/') ? value : `${value}/`;
};

const slugifyContent = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const stripHtml = (value) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${url} (${response.status})`);
  }

  return response.json();
};

const readEnvelopeData = (payload, fallback) => {
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data ?? fallback;
  }

  return payload ?? fallback;
};

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildAbsoluteUrl = (baseUrl, routePath) => new URL(routePath.replace(/^\//, ''), baseUrl).toString();

const getQuestionPath = (question) => {
  const label = stripHtml(question.enunciado_clean || question.enunciado || '') || `questao-${question.id}`;
  return `/question/${question.id}/${slugifyContent(label)}`;
};

const getRankingPath = (ranking) => {
  const label = [ranking.name, ranking.institution].filter(Boolean).join(' ') || `ranking-${ranking.id}`;
  return `/ranking/${ranking.id}/${slugifyContent(label)}`;
};

const getMaterialPath = (material) => {
  const label = material.title || material.description || `material-${material.id}`;
  return `/material/${material.id}/${slugifyContent(label)}`;
};

const fetchAllQuestions = async (apiBaseUrl) => {
  const questions = [];
  let currentPage = 1;
  let total = Number.POSITIVE_INFINITY;

  while (questions.length < total) {
    const url = new URL('questionsList', apiBaseUrl);
    url.searchParams.set('page', String(currentPage));
    url.searchParams.set('limit', String(QUESTION_PAGE_LIMIT));

    const payload = readEnvelopeData(await fetchJson(url.toString()), { rows: [], total: 0 });
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    total = Number(payload?.total || rows.length || 0);

    if (rows.length === 0) {
      break;
    }

    questions.push(...rows);
    currentPage += 1;
  }

  return questions;
};

const buildSitemapXml = (entries) => {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const entry of entries) {
    lines.push('  <url>');
    lines.push(`    <loc>${xmlEscape(entry.loc)}</loc>`);
    lines.push(`    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`);
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return `${lines.join('\n')}\n`;
};

const buildRobotsTxt = (canonicalBaseUrl) => [
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${buildAbsoluteUrl(canonicalBaseUrl, '/sitemap.xml')}`,
  '',
].join('\n');

const createCoverageBucket = (total, indexed) => ({
  total,
  indexed,
  missing: Math.max(total - indexed, 0),
});

const buildEntries = (items, getId, getPath, getLabel, canonicalBaseUrl) => {
  const indexedEntries = [];
  const missingLabels = [];

  for (const item of items) {
    const id = getId(item);
    if (!id) {
      missingLabels.push(getLabel(item));
      continue;
    }

    indexedEntries.push({
      loc: buildAbsoluteUrl(canonicalBaseUrl, getPath(item)),
      lastmod: new Date().toISOString(),
    });
  }

  return {
    indexedEntries,
    missingLabels,
  };
};

const main = async () => {
  const websiteManifest = await readJson(websiteManifestPath);
  const canonicalBaseUrl = normalizeUrlBase(process.env.CANONICAL_BASE_URL || websiteManifest.website?.canonicalUrl);
  const apiBaseUrl = normalizeUrlBase(DEFAULT_API_BASE_URL);

  const [questions, rankingsPayload, materialsPayload] = await Promise.all([
    fetchAllQuestions(apiBaseUrl),
    fetchJson(new URL('rankingsList', apiBaseUrl).toString()),
    fetchJson(new URL('materialsList', apiBaseUrl).toString()),
  ]);

  const rankings = readEnvelopeData(rankingsPayload, []);
  const materials = readEnvelopeData(materialsPayload, []);

  const institutionalEntries = INSTITUTIONAL_PATHS.map((routePath) => ({
    loc: buildAbsoluteUrl(canonicalBaseUrl, routePath),
    lastmod: new Date().toISOString(),
  }));

  const questionResult = buildEntries(
    Array.isArray(questions) ? questions : [],
    (question) => question?.id,
    getQuestionPath,
    (question) => stripHtml(question?.enunciado_clean || question?.enunciado || `questao-sem-id-${Math.random()}`),
    canonicalBaseUrl,
  );
  const rankingResult = buildEntries(
    Array.isArray(rankings) ? rankings : [],
    (ranking) => ranking?.id,
    getRankingPath,
    (ranking) => ranking?.name || ranking?.institution || 'ranking-sem-id',
    canonicalBaseUrl,
  );
  const materialResult = buildEntries(
    Array.isArray(materials) ? materials : [],
    (material) => material?.id,
    getMaterialPath,
    (material) => material?.title || material?.description || 'material-sem-id',
    canonicalBaseUrl,
  );

  const sitemapEntries = [
    ...institutionalEntries,
    ...questionResult.indexedEntries,
    ...rankingResult.indexedEntries,
    ...materialResult.indexedEntries,
  ];

  const sitemapXml = buildSitemapXml(sitemapEntries);
  const robotsTxt = buildRobotsTxt(canonicalBaseUrl);
  const sitemapStatus = {
    scope: 'sitemap_coverage',
    generatedAt: new Date().toISOString(),
    canonicalBaseUrl,
    sitemapUrl: buildAbsoluteUrl(canonicalBaseUrl, '/sitemap.xml'),
    robotsUrl: buildAbsoluteUrl(canonicalBaseUrl, '/robots.txt'),
    totalUrls: sitemapEntries.length,
    coverage: {
      institutional: createCoverageBucket(INSTITUTIONAL_PATHS.length, institutionalEntries.length),
      questions: createCoverageBucket(Array.isArray(questions) ? questions.length : 0, questionResult.indexedEntries.length),
      rankings: createCoverageBucket(Array.isArray(rankings) ? rankings.length : 0, rankingResult.indexedEntries.length),
      materials: createCoverageBucket(Array.isArray(materials) ? materials.length : 0, materialResult.indexedEntries.length),
    },
    missingSamples: {
      questions: questionResult.missingLabels.slice(0, 10),
      rankings: rankingResult.missingLabels.slice(0, 10),
      materials: materialResult.missingLabels.slice(0, 10),
    },
    note: 'Cobertura mede URLs geradas no sitemap. Indexacao em buscadores depende de rastreamento externo.',
  };

  await fs.mkdir(publicDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8'),
    fs.writeFile(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8'),
    fs.writeFile(path.join(publicDir, 'sitemap-status.json'), JSON.stringify(sitemapStatus, null, 2), 'utf8'),
  ]);

  console.log(`Sitemap gerado com ${sitemapEntries.length} URLs.`);
  console.log(`Questoes: ${sitemapStatus.coverage.questions.indexed}/${sitemapStatus.coverage.questions.total}`);
  console.log(`Rankings: ${sitemapStatus.coverage.rankings.indexed}/${sitemapStatus.coverage.rankings.total}`);
  console.log(`Materiais: ${sitemapStatus.coverage.materials.indexed}/${sitemapStatus.coverage.materials.total}`);
};

main().catch((error) => {
  console.error('[seo:generate]', error);
  process.exitCode = 1;
});
