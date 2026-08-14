/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.CM_BASE_URL || 'http://localhost:3000';
const LOGIN_EMAIL = process.env.CM_LOGIN_EMAIL || 'admin@concursomestre.com';
const LOGIN_PASSWORD = process.env.CM_LOGIN_PASSWORD || 'Admin@123456';
const LOGIN_PASSWORD_CANDIDATES_ENV = (process.env.CM_LOGIN_PASSWORD_CANDIDATES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const LOGIN_PASSWORD_CANDIDATES = Array.from(new Set([
  ...LOGIN_PASSWORD_CANDIDATES_ENV,
  LOGIN_PASSWORD,
  '123456',
  'Admin@123456',
])).filter(Boolean);
const DEFAULT_TARGET_ROUTES = ['/dashboard', '/questoes', '/admin/panel/dashboard'];
const TARGET_ROUTES = (process.env.CM_TARGET_ROUTES || '')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);
const ROUTES_TO_MEASURE = TARGET_ROUTES.length > 0 ? TARGET_ROUTES : DEFAULT_TARGET_ROUTES;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_PATH = path.resolve(SCRIPT_DIR, '..', '..', 'docs', 'reports', 'artifacts', 'hard-refresh-baseline-latest.json');
const OUTPUT_PATH = process.env.CM_BASELINE_OUTPUT_PATH || DEFAULT_OUTPUT_PATH;

/**
 * Remove parametros volateis para comparar repeticao real de requests.
 * @since 1.0.0
 */
const normalizeUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    const dropParams = new Set(['_', '_rsc', 'ts', 't', 'cacheBust', 'cache_bust']);
    const kept = [];
    for (const [key, value] of parsed.searchParams.entries()) {
      if (dropParams.has(key)) continue;
      kept.push([key, value]);
    }
    kept.sort(([a], [b]) => a.localeCompare(b));
    const query = kept.length > 0
      ? `?${kept.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}`
      : '';
    return `${parsed.pathname}${query}`;
  } catch {
    return rawUrl;
  }
};

/**
 * Soma valores numericos de um array.
 * @since 1.0.0
 */
const sum = (values) => values.reduce((acc, value) => acc + value, 0);

/**
 * Aguarda um resultado de autenticacao no frontend (sucesso ou erro).
 * @since 1.0.0
 */
const waitForAuthAttemptOutcome = async (page, loginResponse) => {
  if (loginResponse && loginResponse.status >= 200 && loginResponse.status < 300) {
    try {
      await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 7000 });
      return { ok: true, reason: 'api-success-navigated' };
    } catch {
      // Alguns ambientes autenticam e demoram para redirecionar.
    }

    try {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
      if (!page.url().includes('/auth')) {
        return { ok: true, reason: 'api-success-session-active' };
      }
    } catch {
      // Cai no fluxo padrao de diagnostico abaixo.
    }
  }

  try {
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 8000 });
    return { ok: true, reason: 'navigated' };
  } catch {
    // Se nao navegou, coletamos o estado da tela para decidir se vale nova tentativa.
  }

  const pageText = await page.evaluate(() => document.body?.innerText || '');
  const normalized = pageText.toLowerCase();

  if (
    normalized.includes('verificacao de seguranca')
    || normalized.includes('reCAPTCHA'.toLowerCase())
    || normalized.includes('verificação de segurança'.toLowerCase())
  ) {
    return { ok: false, reason: 'captcha-loading', snippet: pageText.slice(0, 280) };
  }

  if (
    normalized.includes('invalid email or password')
    || normalized.includes('e-mail ou senha invalidos')
    || normalized.includes('e-mail ou senha inválidos')
    || normalized.includes('email ou senha invalidos')
    || normalized.includes('email ou senha inválidos')
    || normalized.includes('preencha e-mail e senha')
    || normalized.includes('senha incorreta')
    || normalized.includes('credenciais')
    || normalized.includes('falha')
    || normalized.includes('erro')
  ) {
    return { ok: false, reason: 'credentials-or-validation', snippet: pageText.slice(0, 280) };
  }

  return { ok: false, reason: 'unknown', snippet: pageText.slice(0, 280) };
};

/**
 * Realiza login e devolve storage state para reaproveitar sessao.
 * @since 1.0.0
 */
const loginAndCaptureState = async (browser) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/auth?mode=login`, { waitUntil: 'domcontentloaded' });
  const emailInput = page.locator('form input[type="email"]').first();
  const passwordInput = page.locator('form input[type="password"]').first();
  const strictSubmitButton = page.getByRole('button', { name: /^Entrar na plataforma$/i });
  const fallbackSubmitButton = page.locator('form button[type="submit"]').first();
  const submitButton = (await strictSubmitButton.count()) > 0
    ? strictSubmitButton.first()
    : fallbackSubmitButton;

  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });

  let loginSucceeded = false;
  const failedAttempts = [];

  for (const candidatePassword of LOGIN_PASSWORD_CANDIDATES) {
    if (!candidatePassword) {
      continue;
    }

    await emailInput.fill(LOGIN_EMAIL);
    await passwordInput.fill(candidatePassword);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const loginResponsePromise = page
        .waitForResponse(
          (response) => response.request().method() === 'POST' && response.url().includes('/api/auth/login.php'),
          { timeout: 12000 },
        )
        .then(async (response) => {
          let bodySnippet = '';
          try {
            bodySnippet = (await response.text()).slice(0, 220);
          } catch {
            bodySnippet = '';
          }

          return {
            status: response.status(),
            bodySnippet,
          };
        })
        .catch(() => null);

      await submitButton.click();
      const loginResponse = await loginResponsePromise;
      // Curta janela para que validacoes async (captcha/script) estabilizem antes de decidir.
      await page.waitForTimeout(900);
      const outcome = await waitForAuthAttemptOutcome(page, loginResponse);

      if (outcome.ok) {
        loginSucceeded = true;
        break;
      }

      failedAttempts.push({
        password: candidatePassword,
        reason: outcome.reason,
        snippet: outcome.snippet || '',
        loginStatus: loginResponse?.status ?? null,
        loginBodySnippet: loginResponse?.bodySnippet ?? '',
      });

      if (outcome.reason !== 'captcha-loading') {
        break;
      }

      await page.waitForTimeout(1500);
    }

    if (loginSucceeded) {
      break;
    }
  }

  if (!loginSucceeded || page.url().includes('/auth')) {
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    const attemptsSummary = failedAttempts
      .slice(-4)
      .map((item) => `[${item.password}] ${item.reason}`)
      .join(' | ');
    throw new Error(`Falha no login tecnico para auditoria. URL atual: ${page.url()}. Tentativas: ${attemptsSummary || 'nenhuma'}. Trecho: ${bodyText.slice(0, 260)}`);
  }

  const state = await context.storageState();
  await context.close();
  return state;
};

/**
 * Mede reload de uma rota com sessao autenticada.
 * @since 1.0.0
 */
const measureRoute = async (browser, storageState, route) => {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState,
  });
  const page = await context.newPage();
  const requestEvents = [];

  page.on('requestfinished', async (request) => {
    const response = await request.response();
    if (!response) return;
    requestEvents.push({
      type: request.resourceType(),
      method: request.method(),
      status: response.status(),
      url: request.url(),
      normalizedUrl: normalizeUrl(request.url()),
      contentLength: 0,
    });
  });

  page.on('requestfailed', (request) => {
    requestEvents.push({
      type: request.resourceType(),
      method: request.method(),
      status: 0,
      url: request.url(),
      normalizedUrl: normalizeUrl(request.url()),
      contentLength: 0,
      failed: true,
    });
  });

  await page.goto(route, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1200);

  requestEvents.length = 0;
  await page.evaluate(() => {
    performance.clearResourceTimings();
  });

  await page.reload({ waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1000);

  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const navJson = nav
      ? {
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          loadMs: Math.round(nav.loadEventEnd - nav.startTime),
          transferSize: Number(nav.transferSize || 0),
          encodedBodySize: Number(nav.encodedBodySize || 0),
          decodedBodySize: Number(nav.decodedBodySize || 0),
        }
      : null;
    const resourcesJson = resources.map((entry) => ({
      name: entry.name,
      transferSize: Number(entry.transferSize || 0),
      encodedBodySize: Number(entry.encodedBodySize || 0),
      decodedBodySize: Number(entry.decodedBodySize || 0),
      initiatorType: entry.initiatorType,
    }));

    return { navigation: navJson, resources: resourcesJson };
  });

  const resourceTransfer = sum(perf.resources.map((entry) => entry.transferSize));
  const resourceEncoded = sum(perf.resources.map((entry) => entry.encodedBodySize));
  const resourceDecoded = sum(perf.resources.map((entry) => entry.decodedBodySize));
  const navTransfer = perf.navigation?.transferSize || 0;
  const navEncoded = perf.navigation?.encodedBodySize || 0;
  const navDecoded = perf.navigation?.decodedBodySize || 0;
  const totalTransferBytes = navTransfer + resourceTransfer;
  const totalEncodedBytes = navEncoded + resourceEncoded;
  const totalDecodedBytes = navDecoded + resourceDecoded;

  const xhrFetch = requestEvents.filter((event) => event.type === 'fetch' || event.type === 'xhr');
  const duplicateMap = new Map();
  for (const event of xhrFetch) {
    if (event.method === 'OPTIONS') continue;
    const key = `${event.method} ${event.normalizedUrl}`;
    duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1);
  }
  const duplicateRequests = [...duplicateMap.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ request: key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const xhrFetchSummaryMap = new Map();
  for (const event of xhrFetch) {
    if (event.method === 'OPTIONS') continue;
    const key = `${event.method} ${event.normalizedUrl}`;
    xhrFetchSummaryMap.set(key, (xhrFetchSummaryMap.get(key) || 0) + 1);
  }
  const xhrFetchSummary = [...xhrFetchSummaryMap.entries()]
    .map(([request, count]) => ({ request, count }))
    .sort((a, b) => b.count - a.count || a.request.localeCompare(b.request))
    .slice(0, 80);

  const statusCounts = requestEvents.reduce((acc, event) => {
    const key = String(event.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const failedMap = new Map();
  for (const event of requestEvents) {
    if (!event.failed && event.status !== 0) continue;
    const key = `${event.method} ${event.normalizedUrl}`;
    failedMap.set(key, (failedMap.get(key) || 0) + 1);
  }
  const failedRequests = [...failedMap.entries()]
    .map(([request, count]) => ({ request, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const result = {
    route,
    finalUrl: page.url(),
    totals: {
      requests: requestEvents.length,
      xhrFetchRequests: xhrFetch.length,
      transferBytes: totalTransferBytes,
      encodedBytes: totalEncodedBytes,
      decodedBytes: totalDecodedBytes,
      domContentLoadedMs: perf.navigation?.domContentLoadedMs ?? null,
      loadMs: perf.navigation?.loadMs ?? null,
    },
    statusCounts,
    duplicateRequests,
    failedRequests,
    xhrFetchSummary,
  };

  await context.close();
  return result;
};

/**
 * Executa medicao completa das rotas-alvo de hard refresh autenticado.
 * @since 1.0.0
 */
const run = async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const results = [];

    for (const route of ROUTES_TO_MEASURE) {
      // Cada rota recebe sessao nova para evitar efeito colateral de rotacao
      // de refresh token entre contexts de medicao.
      const storageState = await loginAndCaptureState(browser);
      const measured = await measureRoute(browser, storageState, route);
      results.push(measured);
    }

    const payload = {
      success: true,
      baseUrl: BASE_URL,
      measuredAt: new Date().toISOString(),
      routes: results,
    };

    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(payload, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      success: false,
      baseUrl: BASE_URL,
      measuredAt: new Date().toISOString(),
      error: message,
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
};

await run();
