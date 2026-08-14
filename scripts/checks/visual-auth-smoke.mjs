#!/usr/bin/env node

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

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_REPORT_PATH = path.resolve(ROOT_DIR, '.tmp', 'visual-auth-smoke-latest.json');
const DEFAULT_SCREENSHOT_DIR = path.resolve(ROOT_DIR, '.tmp', 'visual-auth-smoke');

const readArgValue = (name, fallback = undefined) => {
  const prefix = `--${name}=`;
  const raw = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : fallback;
};

const readBoolArg = (name, fallback = false) => {
  const raw = readArgValue(name);
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
};

const splitCsv = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const BASE_URL = (readArgValue('base-url', process.env.CM_BASE_URL || 'http://localhost:3000') || '').replace(/\/$/, '');
const STRICT = readBoolArg('strict', process.env.CM_VISUAL_SMOKE_STRICT === 'true');
const DRY_RUN = readBoolArg('dry-run', false);
const TIMEOUT_MS = Number(readArgValue('timeout-ms', process.env.CM_VISUAL_SMOKE_TIMEOUT_MS || '15000'));
const REPORT_PATH = path.resolve(readArgValue('report-file', process.env.CM_VISUAL_SMOKE_REPORT_FILE || DEFAULT_REPORT_PATH));
const SCREENSHOT_DIR = path.resolve(readArgValue('screenshot-dir', process.env.CM_VISUAL_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR));
const DEFAULT_STUDENT_ROUTES = ['/dashboard', '/questoes', '/profile', '/lei-comentada'];
const DEFAULT_ADMIN_ROUTES = ['/admin/panel/dashboard', '/admin/settings/logs', '/admin/support/comments', '/admin/operation/lei-comentada'];
const STUDENT_ROUTES = splitCsv(readArgValue('student-routes', process.env.CM_VISUAL_SMOKE_STUDENT_ROUTES)).length > 0
  ? splitCsv(readArgValue('student-routes', process.env.CM_VISUAL_SMOKE_STUDENT_ROUTES))
  : DEFAULT_STUDENT_ROUTES;
const ADMIN_ROUTES = splitCsv(readArgValue('admin-routes', process.env.CM_VISUAL_SMOKE_ADMIN_ROUTES)).length > 0
  ? splitCsv(readArgValue('admin-routes', process.env.CM_VISUAL_SMOKE_ADMIN_ROUTES))
  : DEFAULT_ADMIN_ROUTES;
const FORBIDDEN_TEXT = [
  'Hydration failed',
  'Erro de conexao com o servidor',
  'Erro de conexão com o servidor',
  'Network Error: No response from server',
  'Carregando editor da questao',
  'Carregando editor da questão',
  'Carregando secoes da lei',
  'Carregando seções da lei',
  'Carregando Lei Comentada',
  ...splitCsv(readArgValue('forbidden-text', process.env.CM_VISUAL_SMOKE_FORBIDDEN_TEXT)),
].filter(Boolean);

const roles = [
  {
    key: 'student',
    label: 'Aluno',
    email: readArgValue('student-email', process.env.CM_STUDENT_EMAIL || process.env.CM_LOGIN_EMAIL || ''),
    password: readArgValue('student-password', process.env.CM_STUDENT_PASSWORD || process.env.CM_LOGIN_PASSWORD || ''),
    routes: STUDENT_ROUTES,
    required: STRICT || readBoolArg('student-required', process.env.CM_VISUAL_SMOKE_STUDENT_REQUIRED === 'true'),
  },
  {
    key: 'admin',
    label: 'Admin',
    email: readArgValue('admin-email', process.env.CM_ADMIN_EMAIL || process.env.CM_LOGIN_EMAIL || ''),
    password: readArgValue('admin-password', process.env.CM_ADMIN_PASSWORD || process.env.CM_LOGIN_PASSWORD || ''),
    routes: ADMIN_ROUTES,
    required: STRICT || readBoolArg('admin-required', process.env.CM_VISUAL_SMOKE_ADMIN_REQUIRED === 'true'),
  },
];

const isLocalHost = (hostname) => {
  const host = String(hostname || '').toLowerCase();
  return host === ''
    || host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || host.endsWith('.local')
    || host.endsWith('.test');
};

const validateBaseUrl = () => {
  try {
    const parsed = new URL(BASE_URL);
    if (STRICT && parsed.protocol !== 'https:') {
      return { ok: false, message: 'Em modo strict, CM_BASE_URL precisa usar HTTPS.' };
    }

    if (STRICT && isLocalHost(parsed.hostname)) {
      return { ok: false, message: 'Em modo strict, CM_BASE_URL nao pode ser localhost ou dominio local.' };
    }

    return { ok: true, message: 'Base URL valida para o modo atual.' };
  } catch {
    return { ok: false, message: 'CM_BASE_URL invalida.' };
  }
};

const safeFileName = (value) => String(value)
  .replace(/^https?:\/\//, '')
  .replace(/[^a-z0-9_-]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 120) || 'route';

const writeReport = async (payload) => {
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const visibleText = async (page) => {
  try {
    return await page.locator('body').innerText({ timeout: 3000 });
  } catch {
    return '';
  }
};

const waitForAuthOutcome = async (page, loginResponse) => {
  if (loginResponse && loginResponse.status >= 200 && loginResponse.status < 300) {
    try {
      await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 8000 });
      return { ok: true, reason: 'api-success-navigated' };
    } catch {
      // Continua para checar sessao ativa.
    }
  }

  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    if (!new URL(page.url()).pathname.startsWith('/auth')) {
      return { ok: true, reason: 'session-active' };
    }
  } catch {
    // Continua para diagnostico textual.
  }

  const text = (await visibleText(page)).slice(0, 400);
  return { ok: false, reason: 'login-not-confirmed', snippet: text };
};

const loginAndCaptureState = async (browser, role) => {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  try {
    await page.goto('/auth?mode=login', { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    const emailInput = page.locator('form input[type="email"]').first();
    const passwordInput = page.locator('form input[type="password"]').first();
    const strictSubmitButton = page.getByRole('button', { name: /^Entrar na plataforma$/i });
    const fallbackSubmitButton = page.locator('form button[type="submit"]').first();
    const submitButton = (await strictSubmitButton.count()) > 0
      ? strictSubmitButton.first()
      : fallbackSubmitButton;

    await emailInput.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await passwordInput.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await submitButton.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await emailInput.fill(role.email);
    await passwordInput.fill(role.password);

    const loginResponsePromise = page
      .waitForResponse(
        (response) => response.request().method() === 'POST' && response.url().includes('/api/auth/login.php'),
        { timeout: TIMEOUT_MS },
      )
      .then((response) => ({ status: response.status(), url: response.url() }))
      .catch(() => null);

    await submitButton.click();
    const loginResponse = await loginResponsePromise;
    await page.waitForTimeout(1000);
    const outcome = await waitForAuthOutcome(page, loginResponse);
    if (!outcome.ok) {
      throw new Error(`Login ${role.key} nao confirmado: ${outcome.reason}. ${outcome.snippet || ''}`);
    }

    const storageState = await context.storageState();
    return { ok: true, storageState, reason: outcome.reason };
  } finally {
    await context.close();
  }
};

const shouldIgnoreConsoleMessage = (text) => {
  const normalized = String(text || '').toLowerCase();
  return normalized.includes('favicon')
    || normalized.includes('could not establish connection. receiving end does not exist')
    || normalized.includes('resizeobserver loop');
};

const inspectRoute = async (browser, role, storageState, route) => {
  const context = await browser.newContext({ baseURL: BASE_URL, storageState });
  const page = await context.newPage();
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    const text = message.text();
    if (shouldIgnoreConsoleMessage(text)) return;

    if (message.type() === 'error') {
      consoleErrors.push(text);
    } else if (message.type() === 'warning') {
      consoleWarnings.push(text);
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      errorText: failure?.errorText || 'request failed',
    });
  });

  const startedAt = Date.now();
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: TIMEOUT_MS }).catch(() => undefined);
    await page.waitForTimeout(1200);

    const currentUrl = new URL(page.url());
    const text = await visibleText(page);
    const forbiddenFound = FORBIDDEN_TEXT.filter((needle) => text.includes(needle));
    const screenshotPath = path.join(SCREENSHOT_DIR, `${role.key}-${safeFileName(route)}.png`);
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const protectedRouteRedirectedToAuth = currentUrl.pathname.startsWith('/auth');
    const tooLittleContent = text.trim().length < 80;
    const hardErrors = [
      ...consoleErrors,
      ...pageErrors,
      ...failedRequests
        .filter((request) => !request.url.includes('/_next/static/') && !request.url.includes('/favicon'))
        .map((request) => `${request.method} ${request.url}: ${request.errorText}`),
    ];

    const ok = !protectedRouteRedirectedToAuth
      && !tooLittleContent
      && forbiddenFound.length === 0
      && hardErrors.length === 0;

    return {
      ok,
      role: role.key,
      route,
      finalUrl: page.url(),
      durationMs: Date.now() - startedAt,
      screenshotPath,
      textLength: text.trim().length,
      protectedRouteRedirectedToAuth,
      forbiddenFound,
      consoleErrors,
      consoleWarnings: consoleWarnings.slice(0, 20),
      pageErrors,
      failedRequests: failedRequests.slice(0, 20),
    };
  } catch (error) {
    return {
      ok: false,
      role: role.key,
      route,
      finalUrl: page.url(),
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      consoleErrors,
      pageErrors,
      failedRequests: failedRequests.slice(0, 20),
    };
  } finally {
    await context.close();
  }
};

const buildPlan = () => {
  const baseUrlValidation = validateBaseUrl();
  const rolePlans = roles.map((role) => ({
    key: role.key,
    label: role.label,
    routes: role.routes,
    required: role.required,
    hasCredentials: Boolean(role.email && role.password),
    email: role.email ? role.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') : '',
  }));

  return {
    baseUrl: BASE_URL,
    strict: STRICT,
    timeoutMs: TIMEOUT_MS,
    reportPath: REPORT_PATH,
    screenshotDir: SCREENSHOT_DIR,
    baseUrlValidation,
    roles: rolePlans,
    forbiddenText: FORBIDDEN_TEXT,
  };
};

const run = async () => {
  const plan = buildPlan();
  const missingRequiredCredentials = plan.roles.filter((role) => role.required && !role.hasCredentials);
  const precheckOk = plan.baseUrlValidation.ok && missingRequiredCredentials.length === 0;

  if (DRY_RUN || !precheckOk) {
    const payload = {
      success: precheckOk,
      status: precheckOk ? 'planned' : 'blocked_precheck',
      dryRun: DRY_RUN,
      plan,
      missingRequiredCredentials,
      checkedAt: new Date().toISOString(),
    };
    await writeReport(payload);
    const output = JSON.stringify(payload, null, 2);
    if (precheckOk) {
      console.log(output);
      return;
    }

    console.error(output);
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const roleResults = [];

  try {
    for (const role of roles) {
      if (!role.email || !role.password) {
        roleResults.push({
          role: role.key,
          ok: !role.required,
          skipped: true,
          required: role.required,
          reason: 'Credenciais nao configuradas.',
          routes: [],
        });
        continue;
      }

      let login;
      try {
        login = await loginAndCaptureState(browser, role);
      } catch (error) {
        roleResults.push({
          role: role.key,
          ok: false,
          required: role.required,
          login: {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          routes: [],
        });
        continue;
      }

      const routes = [];
      for (const route of role.routes) {
        routes.push(await inspectRoute(browser, role, login.storageState, route));
      }

      roleResults.push({
        role: role.key,
        ok: routes.every((routeResult) => routeResult.ok),
        required: role.required,
        login: { ok: true, reason: login.reason },
        routes,
      });
    }
  } finally {
    await browser.close();
  }

  const failedRoles = roleResults.filter((roleResult) => !roleResult.ok && roleResult.required);
  const payload = {
    success: failedRoles.length === 0,
    status: failedRoles.length === 0 ? 'ok' : 'failed',
    dryRun: false,
    plan,
    roles: roleResults,
    checkedAt: new Date().toISOString(),
  };

  await writeReport(payload);
  const output = JSON.stringify(payload, null, 2);
  if (payload.success) {
    console.log(output);
    return;
  }

  console.error(output);
  process.exitCode = 1;
};

await run();
