#!/usr/bin/env node
/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved.
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import {
  extractGranPagination,
  extractGranRows,
  mapGranBatchToQuestionImport,
  validateQuestionImportPayload,
} from './gran_mapper.mjs';

const GRAN_WEB_ORIGIN = 'https://questoes.grancursosonline.com.br';
const GRAN_API_ORIGIN = 'https://rota-api.grancursosonline.com.br';
const GRAN_QUESTIONS_PATH = '/v1/elastic/questao';
const MAX_PER_PAGE = 50;
const MAX_PAGES_PER_RUN = 100;

const usage = () => `
Uso:
  npm run crawler:gran -- --confirm-authorized-access [opcoes]

Opcoes:
  --output <arquivo>       JSON de saida (padrao: .tmp/local-question-crawler/...).
  --profile-dir <pasta>    Perfil Chrome local dedicado.
  --start-page <numero>    Primeira pagina da coleta (padrao: pagina observada).
  --max-pages <numero>     Limite desta execucao (padrao: 1; maximo: ${MAX_PAGES_PER_RUN}).
  --per-page <numero>      Itens por pagina (padrao: requisicao observada; maximo: ${MAX_PER_PAGE}).
  --delay-ms <numero>      Pausa entre paginas (padrao: 1500; minimo: 1000).
  --year <ano>             Sobrescreve o filtro de ano da requisicao observada.
  --title <titulo>         Titulo da prova/lote no JSON.
  --capture-timeout <ms>   Tempo para login/navegacao (padrao: 600000).
  --help                   Exibe esta ajuda.

O coletor nao contorna login, CAPTCHA, bloqueios ou limites. Use somente em
conteudo que sua conta esteja autorizada a acessar.
`.trim();

const readArgs = (argv) => {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Argumento invalido: ${argument}`);
    const name = argument.slice(2);
    if (name === 'confirm-authorized-access' || name === 'help') {
      options[name] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Informe um valor para --${name}.`);
    options[name] = value;
    index += 1;
  }
  return options;
};

const toBoundedInteger = (value, fallback, minimum, maximum, label) => {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} deve estar entre ${minimum} e ${maximum}.`);
  }
  return parsed;
};

const defaultProfileDirectory = () => path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'),
  'ConcursoMestre',
  'GranCrawler',
  'chrome-profile',
);

const defaultOutputFile = () => path.resolve(
  '.tmp',
  'local-question-crawler',
  `gran-question-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);

const isGranQuestionsRequest = (request) => {
  if (request.method() !== 'GET') return false;
  try {
    const url = new URL(request.url());
    return url.origin === GRAN_API_ORIGIN && url.pathname === GRAN_QUESTIONS_PATH;
  } catch {
    return false;
  }
};

const captureAuthorizedRequest = async (context, page, timeoutMs) => {
  let resolveCapture;
  let rejectCapture;
  const capture = new Promise((resolve, reject) => {
    resolveCapture = resolve;
    rejectCapture = reject;
  });
  const timer = setTimeout(() => rejectCapture(new Error(
    'Tempo esgotado. Entre na Gran e abra uma lista de questoes para iniciar a captura.',
  )), timeoutMs);

  const listener = async (request) => {
    if (!isGranQuestionsRequest(request)) return;
    const headers = await request.allHeaders();
    if (!headers.authorization) return;
    clearTimeout(timer);
    context.off('request', listener);
    resolveCapture({ url: request.url(), headers });
  };
  context.on('request', listener);

  console.log('Chrome aberto com perfil local dedicado.');
  console.log('Faca o login manualmente e abra a lista de questoes com os filtros desejados.');
  console.log('O coletor aguardara a primeira requisicao autorizada da lista.');
  await page.goto(GRAN_WEB_ORIGIN, { waitUntil: 'domcontentloaded' });
  return capture;
};

const buildSafeReplayHeaders = (headers) => {
  const safe = {};
  for (const name of ['accept', 'accept-language', 'authorization', 'origin', 'referer', 'user-agent']) {
    if (headers[name]) safe[name] = headers[name];
  }
  return safe;
};

const buildPageUrl = (templateUrl, pageNumber, perPage, year) => {
  const url = new URL(templateUrl);
  if (url.origin !== GRAN_API_ORIGIN || url.pathname !== GRAN_QUESTIONS_PATH) {
    throw new Error('A requisicao observada nao pertence ao endpoint permitido da Gran.');
  }
  url.searchParams.set('page', String(pageNumber));
  url.searchParams.set('perPage', String(perPage));
  if (year) {
    url.searchParams.delete('anos');
    url.searchParams.delete('anos[]');
    url.searchParams.append('anos[]', String(year));
  }
  return url.toString();
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const collectPages = async ({ context, template, startPage, perPage, maxPages, delayMs, year }) => {
  const rows = [];
  const diagnostics = [];
  let availablePages = 0;

  for (let offset = 0; offset < maxPages; offset += 1) {
    const pageNumber = startPage + offset;
    if (availablePages > 0 && pageNumber > availablePages) break;
    const url = buildPageUrl(template.url, pageNumber, perPage, year);
    const response = await context.request.get(url, {
      headers: buildSafeReplayHeaders(template.headers),
      timeout: 60_000,
      failOnStatusCode: false,
    });
    const status = response.status();
    if (status === 401 || status === 403) {
      throw new Error(`A sessao deixou de autorizar a coleta (HTTP ${status}). Faca login novamente.`);
    }
    if (status === 429) {
      diagnostics.push(`Coleta pausada por limite remoto na pagina ${pageNumber} (HTTP 429).`);
      console.warn('Limite remoto atingido. A coleta foi interrompida sem novas tentativas.');
      break;
    }
    if (status !== 200) throw new Error(`A Gran respondeu HTTP ${status} na pagina ${pageNumber}.`);

    const payload = await response.json();
    const pageRows = extractGranRows(payload);
    const pagination = extractGranPagination(payload);
    availablePages = pagination.pages || availablePages;
    rows.push(...pageRows);
    console.log(`Pagina ${pageNumber}: ${pageRows.length} questao(oes) recebida(s).`);
    if (pageRows.length === 0) break;
    if (offset + 1 < maxPages) await sleep(delayMs);
  }

  return { rows, diagnostics };
};

const main = async () => {
  const options = readArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options['confirm-authorized-access']) {
    throw new Error('Confirme o acesso autorizado com --confirm-authorized-access.');
  }

  const profileDirectory = path.resolve(options['profile-dir'] || defaultProfileDirectory());
  const outputFile = path.resolve(options.output || defaultOutputFile());
  const maxPages = toBoundedInteger(options['max-pages'], 1, 1, MAX_PAGES_PER_RUN, 'max-pages');
  const delayMs = toBoundedInteger(options['delay-ms'], 1500, 1000, 60_000, 'delay-ms');
  const timeoutMs = toBoundedInteger(options['capture-timeout'], 600_000, 30_000, 1_800_000, 'capture-timeout');

  await mkdir(profileDirectory, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDirectory, {
    channel: 'chrome',
    headless: false,
    viewport: null,
  });

  try {
    const pages = context.pages();
    const page = pages[0] || await context.newPage();
    const template = await captureAuthorizedRequest(context, page, timeoutMs);
    const observedUrl = new URL(template.url);
    const observedPage = Number(observedUrl.searchParams.get('page')) || 1;
    const observedPerPage = Number(observedUrl.searchParams.get('perPage')) || 20;
    const startPage = toBoundedInteger(options['start-page'], observedPage, 1, 1_000_000, 'start-page');
    const perPage = toBoundedInteger(options['per-page'], observedPerPage, 1, MAX_PER_PAGE, 'per-page');
    console.log('Sessao autorizada detectada. Credenciais mantidas somente em memoria.');

    const collected = await collectPages({
      context,
      template,
      startPage,
      perPage,
      maxPages,
      delayMs,
      year: options.year || '',
    });
    const payload = mapGranBatchToQuestionImport(collected.rows, {
      title: options.title || '',
      year: options.year || null,
    });
    payload.import.diagnostics.push(...collected.diagnostics);
    const errors = validateQuestionImportPayload(payload);
    if (errors.length) throw new Error(`JSON canonico invalido: ${errors.join('; ')}`);
    if (!payload.questions.length) throw new Error('Nenhuma questao foi coletada. O arquivo nao sera enviado.');

    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    console.log(`Coleta concluida: ${payload.questions.length} questao(oes), ${payload.contexts.length} contexto(s).`);
    console.log(`JSON para revisao: ${outputFile}`);
    console.log('Revise o arquivo antes de envia-lo pela ingestao privada.');
  } finally {
    await context.close();
  }
};

main().catch((error) => {
  console.error(`Falha no crawler local: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
