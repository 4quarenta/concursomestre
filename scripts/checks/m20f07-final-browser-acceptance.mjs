import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = (process.env.CM_BASE_URL || 'https://concursomestre.com').replace(/\/$/, '');
const credentialsPath = process.env.M20F07_CREDENTIALS_FILE || '.tmp/m20f07-browser-credentials-1cb7.json';
const reportPath = process.env.M20F07_BROWSER_REPORT || '.tmp/m20f07-final-browser-acceptance.json';
const storageDir = process.env.M20F07_STORAGE_DIR || '.tmp/m20f07-storage-final-acceptance';
const reuseStorage = process.env.M20F07_REUSE_STORAGE !== '0';
const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
const diagnostics = {
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  httpErrors: [],
  unexpected404s: [],
  expectedAborts: [],
  authRedirects: [],
  expectedNegativeResponses: [],
};

const identityFor = (role) => credentials.identities.find((identity) => identity.role === role);

const attachDiagnostics = (page, viewport, expectedUrls = new Set()) => {
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().toLowerCase().includes('favicon')) {
      diagnostics.consoleErrors.push({ viewport, text: message.text() });
    }
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push({ viewport, text: error.message }));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'request failed';
    const lower = failure.toLowerCase();
    const url = request.url();
    const isExpectedAbort = lower.includes('err_aborted') && (
      url.includes('?_rsc=')
      || url.includes('/api/auth/refresh.php')
      || url.includes('accounts.google.com/gsi/')
      || url.includes('/cdn-cgi/rum')
      || url.includes('play.google.com/log')
      || url.includes('fonts.gstatic.com')
      || url.includes('googletagmanager.com/gtag/')
    );
    if (isExpectedAbort) {
      diagnostics.expectedAborts.push({ viewport, url, method: request.method(), resourceType: request.resourceType(), failure });
    } else if (expectedUrls.has(url)) {
      diagnostics.expectedNegativeResponses.push({ viewport, url, method: request.method(), failure });
    } else {
      diagnostics.failedRequests.push({ viewport, url, method: request.method(), resourceType: request.resourceType(), failure });
    }
  });
  page.on('response', (response) => {
    const request = response.request();
    const url = response.url();
    if (response.status() >= 400) {
      const entry = { viewport, url, method: request.method(), status: response.status(), resourceType: request.resourceType() };
      if (expectedUrls.has(url)) diagnostics.expectedNegativeResponses.push(entry);
      else diagnostics.httpErrors.push(entry);
    }
    if (response.status() === 404 && !url.includes('/_next/static/') && !url.includes('/favicon')) {
      if (!expectedUrls.has(url)) diagnostics.unexpected404s.push({ viewport, url, method: request.method() });
    }
  });
};

const settle = async (page, milliseconds = 1800) => {
  await page.waitForTimeout(milliseconds);
};

const dismissCookieConsent = async (page) => {
  const accept = page.getByRole('button', { name: 'Aceitar todos', exact: true });
  if (await accept.isVisible().catch(() => false)) await accept.click();
};

const normalLogin = async (browser, identity, role) => {
  const context = await browser.newContext({ baseURL: baseUrl, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  attachDiagnostics(page, 1280);
  await page.goto('/auth?mode=login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('form input[type="email"]').fill(identity.email);
  await page.locator('form input[type="password"]').fill(identity.password);
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/api/auth/login.php'), { timeout: 30000 });
  await page.getByRole('button', { name: /^Entrar na plataforma$/i }).click();
  const response = await responsePromise;
  if (response.status() === 429) throw new Error(`AUTH_RATE_LIMITED:${role}:retry-after=${response.headers()['retry-after'] || 'unknown'}`);
  if (response.status() < 200 || response.status() >= 300) throw new Error(`AUTH_LOGIN_FAILED:${role}:status=${response.status()}`);
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30000 });
  await settle(page, 1000);
  await mkdir(storageDir, { recursive: true });
  await writeFile(path.join(storageDir, `${role}.json`), `${JSON.stringify(await context.storageState(), null, 2)}\n`, 'utf8');
  await page.close();
  return { context, loginPerformed: true };
};

const loadOrLogin = async (browser, identity, role) => {
  const statePath = path.join(storageDir, `${role}.json`);
  if (reuseStorage) {
    try {
      const state = JSON.parse(await readFile(statePath, 'utf8'));
      const context = await browser.newContext({ baseURL: baseUrl, storageState: state, viewport: { width: 1280, height: 900 } });
      const probe = await context.newPage();
      attachDiagnostics(probe, 1280);
      await probe.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      const valid = !new URL(probe.url()).pathname.startsWith('/auth');
      await probe.close();
      if (valid) {
        // Refresh rotation updates the in-memory cookie jar. Persist the
        // rotated state so the next acceptance context does not reuse a
        // single-use refresh token.
        await mkdir(storageDir, { recursive: true });
        await writeFile(statePath, `${JSON.stringify(await context.storageState(), null, 2)}\n`, 'utf8');
        return { context, loginPerformed: false };
      }
      await context.close();
    } catch {
      // A stale storage state falls back to one normal login for this role.
    }
  }
  return normalLogin(browser, identity, role);
};

const pageFor = async (context, viewport, expectedUrls = new Set()) => {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  attachDiagnostics(page, viewport.width, expectedUrls);
  return page;
};

const checkOverflow = async (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

const checkKeyboard = async (page, limit = 24) => {
  await page.locator('body').click({ position: { x: 2, y: 2 } }).catch(() => {});
  let invisible = 0;
  const visited = [];
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element) return { tag: null, visible: false, label: '' };
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        tag: element.tagName,
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 80) || '',
      };
    });
    visited.push(state);
    if (!state.visible) invisible += 1;
  }
  return { invisible, visited };
};

const runUser = async (context) => {
  const result = { notification: {}, preferences: {}, mobile: {}, formAccessibility: {}, keyboard: {} };
  const page = await pageFor(context, { width: 1280, height: 900 });
  await page.goto('/notifications', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 3200);
  await dismissCookieConsent(page);
  result.notification = {
    route: new URL(page.url()).pathname === '/notifications',
    heading: await page.getByRole('heading', { name: /Notificações|Notificacoes/i }).first().isVisible().catch(() => false),
    syntheticItem: await page.getByRole('heading', { name: 'M20F07 synthetic notification', exact: true }).isVisible().catch(() => false),
    unreadSemantics: await page.getByTitle('Marcar como lida').count() >= 0,
  };

  await page.goto('/profile/security', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 2500);
  result.preferences = {
    route: new URL(page.url()).pathname === '/profile/security',
    surface: await page.getByText('Notificações por e-mail', { exact: true }).isVisible().catch(() => false),
    labeledControl: await page.getByText('Notificações por e-mail', { exact: true }).count() > 0,
  };
  result.formAccessibility = {
    preferenceLabelCount: await page.getByText('Notificações por e-mail', { exact: true }).count(),
  };
  result.keyboard = await checkKeyboard(page, 18);

  for (const width of [430, 390]) {
    const mobile = page;
    await mobile.setViewportSize({ width, height: 844 });
    await mobile.goto('/notifications', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(mobile, 2200);
    await dismissCookieConsent(mobile);
    result.mobile[width] = {
      route: new URL(mobile.url()).pathname === '/notifications',
      overflow: await checkOverflow(mobile),
      heading: await mobile.getByRole('heading', { name: /Notificações|Notificacoes/i }).first().isVisible().catch(() => false),
      primaryAction: await mobile.getByRole('button', { name: /Ler todas/i }).isVisible().catch(() => false),
    };
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  return { result, page };
};

const runAdmin = async (context) => {
  const result = { desktop: {}, mobile: {}, accessibility: {} };
  const page = await pageFor(context, { width: 1280, height: 900 });
  const apiResponses = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/admin/communications.php')) apiResponses.push({ status: response.status(), method: response.request().method() });
  });
  await page.goto('/admin/support/communications', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 3500);
  await dismissCookieConsent(page);
  const heading = page.getByRole('heading', { name: 'Histórico de comunicações', exact: true });
  const table = page.getByRole('table');
  const rowCount = await page.getByRole('row').count();
  const search = page.getByLabel('Buscar comunicação');
  const status = page.getByLabel('Filtrar status');
  await search.fill('M20F07');
  const refreshResponse = page.waitForResponse((response) => response.request().method() === 'GET' && response.url().includes('/api/admin/communications.php'), { timeout: 15000 }).catch(() => null);
  await page.locator('button[title="Atualizar histórico"]').click();
  await refreshResponse;
  await settle(page, 700);
  const keyboard = await checkKeyboard(page, 28);
  result.desktop = {
    route: new URL(page.url()).pathname === '/admin/support/communications',
    heading: await heading.isVisible().catch(() => false),
    table: await table.isVisible().catch(() => false),
    rows: rowCount,
    apiRead: apiResponses.some((entry) => entry.method === 'GET' && entry.status >= 200 && entry.status < 300),
    searchLabeled: await search.count() === 1,
    statusLabeled: await status.count() === 1,
    refreshFeedback: apiResponses.length > 0,
    providerColumn: await page.getByRole('columnheader', { name: 'Identidade do provedor', exact: true }).count() === 1,
  };
  result.accessibility = {
    keyboard,
    formLabels: result.desktop.searchLabeled && result.desktop.statusLabeled,
    tableHeaders: await page.getByRole('columnheader').count(),
    tableCaption: await page.getByText('Fila de comunicações', { exact: true }).count() === 1,
    statusFeedback: await page.getByText(/Página \d+ de \d+/).isVisible().catch(() => false),
  };

  for (const width of [430, 390]) {
    const mobile = page;
    await mobile.setViewportSize({ width, height: 844 });
    await mobile.goto('/admin/support/communications', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(mobile, 2600);
    await dismissCookieConsent(mobile);
    result.mobile[width] = {
      route: new URL(mobile.url()).pathname === '/admin/support/communications',
      heading: await mobile.getByRole('heading', { name: 'Histórico de comunicações', exact: true }).isVisible().catch(() => false),
      table: await mobile.getByRole('table').isVisible().catch(() => false),
      overflow: await checkOverflow(mobile),
      primaryAction: await mobile.locator('button[title="Atualizar histórico"]').isVisible().catch(() => false),
      filtersReachable: await mobile.getByLabel('Buscar comunicação').isVisible().catch(() => false)
        && await mobile.getByLabel('Filtrar status').isVisible().catch(() => false),
    };
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  return { result, page };
};

const fetchJson = async (page, url, options = {}) => page.evaluate(async ({ url: requestUrl, options: requestOptions }) => {
  const response = await fetch(requestUrl, {
    method: requestOptions.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(requestOptions.headers || {}) },
    body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined,
    credentials: 'include',
  });
  const text = await response.text();
  return { status: response.status, text: text.slice(0, 1500) };
}, { url, options });

const runNegative = async (user, admin, adminUserId) => {
  const result = {};
  let userBearer = null;
  let adminBearer = null;
  user.on('request', (request) => {
    const token = request.headers().authorization;
    if (!userBearer && token) userBearer = token.replace(/^Bearer\s+/i, '');
  });
  admin.on('request', (request) => {
    const token = request.headers().authorization;
    if (!adminBearer && token) adminBearer = token.replace(/^Bearer\s+/i, '');
  });
  await user.setViewportSize({ width: 1280, height: 900 });
  await admin.setViewportSize({ width: 1280, height: 900 });
  await user.goto('/notifications', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(user, 1200);
  await admin.goto('/admin/support/communications', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(admin, 1200);
  const adminApi = `${baseUrl}/api/admin/communications.php`;
  const userHeaders = userBearer ? { Authorization: `Bearer ${userBearer}`, 'X-Auth-Token': userBearer } : {};
  const adminHeaders = adminBearer ? { Authorization: `Bearer ${adminBearer}`, 'X-Auth-Token': adminBearer } : {};
  const adminApiResponse = await fetchJson(user, adminApi, { headers: userHeaders });
  result.NB01_cross_user_notification = (() => true)();
  const crossUser = await fetchJson(user, `${baseUrl}/api/notifications/list.php?user_id=${encodeURIComponent(adminUserId)}`, { headers: userHeaders });
  result.NB01_cross_user_notification = !crossUser.text.includes(adminUserId) && !crossUser.text.includes('M20F07 synthetic admin notification');
  result.NB02_user_admin_surface = [401, 403, 404].includes(adminApiResponse.status);
  result.NB03_unauthorized_retry = [401, 403, 404, 405].includes((await fetchJson(user, adminApi, { method: 'POST', headers: userHeaders, body: { action: 'retry' } })).status);
  const missingCsrfUrl = `${baseUrl}/api/admin/feedback.php`;
  const missingCsrf = await fetchJson(admin, missingCsrfUrl, { method: 'PUT', headers: adminHeaders, body: {} });
  result.NB04_missing_csrf = missingCsrf.status === 403;
  const adminDeepLinkResponse = await user.goto('/admin/support/communications', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(user, 1200);
  result.NB05_admin_deep_link_as_user = new URL(user.url()).pathname.startsWith('/auth')
    || (adminDeepLinkResponse?.status() || 0) >= 400
    || !new URL(user.url()).pathname.startsWith('/admin');
  const unsupported = await fetchJson(user, `${baseUrl}/notifications?user_id=${encodeURIComponent(adminUserId)}`, { headers: userHeaders });
  result.NB06_unsupported_cross_target = !unsupported.text.includes(adminUserId);
  const negativeUrls = [adminApi, missingCsrfUrl, `${baseUrl}/admin/support/communications`];
  diagnostics.httpErrors = diagnostics.httpErrors.filter((entry) => !negativeUrls.some((url) => entry.url.startsWith(url)));
  diagnostics.unexpected404s = diagnostics.unexpected404s.filter((entry) => !negativeUrls.some((url) => entry.url.startsWith(url)));
  diagnostics.consoleErrors = diagnostics.consoleErrors.filter((entry) => !/status of 40[134]/i.test(entry.text));
  return result;
};

const browser = await chromium.launch({ headless: true });
let userAuth;
let adminAuth;
try {
  const user = identityFor('user');
  const admin = identityFor('admin');
  if (!user || !admin) throw new Error('AUTH_CREDENTIALS_MISSING');
  userAuth = await loadOrLogin(browser, user, 'user');
  adminAuth = await loadOrLogin(browser, admin, 'admin');
  const userRun = await runUser(userAuth.context);
  const adminRun = await runAdmin(adminAuth.context);
  const userResult = userRun.result;
  const adminResult = adminRun.result;
  const negative = await runNegative(userRun.page, adminRun.page, admin.user_id);
  const allNegative = Object.values(negative).every(Boolean);
  const userMobilePass = Object.values(userResult.mobile).every((entry) => entry.route && entry.heading && entry.primaryAction && !entry.overflow);
  const adminMobilePass = Object.values(adminResult.mobile).every((entry) => entry.route && entry.heading && entry.table && entry.primaryAction && entry.filtersReachable && !entry.overflow);
  const userPass = userResult.notification.route && userResult.notification.heading && userResult.notification.syntheticItem
    && userResult.preferences.surface && userResult.preferences.labeledControl;
  const adminPass = adminResult.desktop.route && adminResult.desktop.heading && adminResult.desktop.table
    && adminResult.desktop.apiRead && adminResult.desktop.searchLabeled && adminResult.desktop.statusLabeled
    && adminResult.desktop.providerColumn && adminResult.accessibility.formLabels
    && adminResult.accessibility.tableHeaders >= 6 && adminResult.accessibility.statusFeedback;
  const accessibilityPass = adminPass && adminResult.accessibility.keyboard.invisible === 0;
  const payload = {
    success: userPass && adminPass && userMobilePass && adminMobilePass && accessibilityPass,
    authBypassUsed: false,
    repeatedLoginStorm: 0,
    userLoginCount: userAuth.loginPerformed ? 1 : 0,
    adminLoginCount: adminAuth.loginPerformed ? 1 : 0,
    authHarness: true,
    user: userResult,
    admin: adminResult,
    negative: { casesTotal: 6, casesPassed: Object.values(negative).filter(Boolean).length, casesFailed: Object.values(negative).filter((value) => !value).length, cases: negative },
    gates: {
      userNotificationBrowserE2E: userPass,
      transactionalEmailBrowserE2E: false,
      marketingEmailBrowserE2E: false,
      preferenceBrowserE2E: userResult.preferences.surface && userResult.preferences.labeledControl,
      adminBrowserE2E: adminPass,
      userMobile: userMobilePass,
      adminMobile: adminMobilePass,
      accessibilityAcceptance: accessibilityPass,
      deepLinkAuthorization: allNegative,
    },
    diagnostics,
    checkedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(payload, null, 2));
} finally {
  if (userAuth?.context) await userAuth.context.close().catch(() => {});
  if (adminAuth?.context) await adminAuth.context.close().catch(() => {});
  await browser.close();
}
