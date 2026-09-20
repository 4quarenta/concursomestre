import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = (process.env.CM_BASE_URL || 'https://concursomestre.com').replace(/\/$/, '');
const credentialsPath = process.env.M20F07_CREDENTIALS_FILE || '.tmp/m20f07-browser-credentials.json';
const credentials = JSON.parse(await (await import('node:fs/promises')).readFile(credentialsPath, 'utf8'));
const byRole = (role) => credentials.identities.find((identity) => identity.role === role);
const reportPath = process.env.M20F07_BROWSER_REPORT || '.tmp/m20f07-browser-acceptance-final.json';
const storageDir = process.env.M20F07_STORAGE_DIR || '.tmp/m20f07-storage-final';
const reuseStorage = process.env.M20F07_REUSE_STORAGE === '1' || process.env.M20F07_REUSE_STORAGE === undefined;
const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [], unexpected404s: [], httpErrors: [], authRedirects: [] };

const attachDiagnostics = (page, viewport) => {
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().toLowerCase().includes('favicon')) {
      diagnostics.consoleErrors.push({ viewport, text: message.text() });
    }
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push({ viewport, text: error.message }));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'request failed';
    const isExpectedRscAbort = request.resourceType() === 'fetch'
      && failure.toLowerCase().includes('err_aborted')
      && request.url().includes('?_rsc=');
    if (!isExpectedRscAbort) {
      diagnostics.failedRequests.push({ viewport, url: request.url(), method: request.method(), resourceType: request.resourceType(), failure });
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      diagnostics.httpErrors.push({
        viewport,
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
        resourceType: response.request().resourceType(),
        retryAfter: response.headers()['retry-after'] || null,
      });
    }
    if (response.status() !== 404) return;
    const url = response.url();
    if (!url.includes('/_next/static/') && !url.includes('/favicon')) {
      diagnostics.unexpected404s.push({ viewport, url, method: response.request().method() });
    }
  });
};

const dismissCookieConsent = async (page) => {
  const accept = page.getByRole('button', { name: 'Aceitar todos', exact: true });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
    await page.waitForTimeout(250);
  }
};

const login = async (browser, identity, viewport) => {
  const context = await browser.newContext({ baseURL: baseUrl, viewport });
  const page = await context.newPage();
  attachDiagnostics(page, viewport.width);
  await page.goto('/auth?mode=login', { waitUntil: 'domcontentloaded' });
  await page.locator('form input[type="email"]').fill(identity.email);
  await page.locator('form input[type="password"]').fill(identity.password);
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/api/auth/login.php'));
  await page.getByRole('button', { name: /^Entrar na plataforma$/i }).click();
  const response = await responsePromise;
  if (response.status() === 429) {
    const retryAfter = response.headers()['retry-after'] || 'unknown';
    await context.close();
    throw new Error(`AUTH_RATE_LIMITED:${identity.role}:retry-after=${retryAfter}`);
  }
  if ([401, 403].includes(response.status())) {
    await context.close();
    throw new Error(`AUTH_REJECTED:${identity.role}:status=${response.status()}`);
  }
  if (response.status() < 200 || response.status() >= 300) {
    await context.close();
    throw new Error(`AUTH_LOGIN_FAILED:${identity.role}:status=${response.status()}`);
  }
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 15000 }).catch(async () => {
    diagnostics.authRedirects.push({ role: identity.role, url: page.url(), classification: 'APPLICATION_REDIRECT_OR_EXPIRED_SESSION' });
    throw new Error(`AUTH_REDIRECT_UNCLASSIFIED:${identity.role}:${page.url()}`);
  });
  if (new URL(page.url()).pathname.startsWith('/auth')) {
    diagnostics.authRedirects.push({ role: identity.role, url: page.url(), classification: 'APPLICATION_REDIRECT_OR_EXPIRED_SESSION' });
    await context.close();
    throw new Error(`AUTH_REDIRECT_UNCLASSIFIED:${identity.role}:${page.url()}`);
  }
  const storageState = await context.storageState();
  await mkdir(storageDir, { recursive: true });
  await writeFile(path.join(storageDir, `${identity.role}.json`), `${JSON.stringify(storageState, null, 2)}\n`, 'utf8');
  await context.close();
  return storageState;
};

const loadOrLogin = async (browser, identity, viewport) => {
  const statePath = path.join(storageDir, `${identity.role}.json`);
  if (reuseStorage) {
    try {
      return { storageState: JSON.parse(await (await import('node:fs/promises')).readFile(statePath, 'utf8')), loginPerformed: false };
    } catch {
      // A missing or invalid state must fall back to one normal login.
    }
  }
  return { storageState: await login(browser, identity, viewport), loginPerformed: true };
};

const runUser = async (browser, storageState) => {
  const result = { notification: {}, preference: {}, mobile: {} };
  const desktop = await browser.newContext({ baseURL: baseUrl, storageState, viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  attachDiagnostics(page, 1280);
  await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
  await dismissCookieConsent(page);
  const notificationTitle = page.getByRole('heading', { name: 'M20F07 synthetic notification', exact: true }).first();
  const notificationRendered = await notificationTitle.isVisible({ timeout: 15000 }).catch(() => false);
  if (notificationRendered) {
    const unreadBefore = await page.getByTitle('Marcar como lida').count();
    const markReadResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/notifications/mark_read.php'));
    await notificationTitle.click();
    await markReadResponse;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissCookieConsent(page);
    const unreadAfterReload = await page.getByTitle('Marcar como lida').count();
    result.notification = { rendered: true, unreadBefore, markedReadThroughUi: unreadBefore > 0, persistedReadAfterReload: unreadAfterReload === 0 };
  } else {
    result.notification = { rendered: false, url: page.url(), title: await page.title(), body: (await page.locator('body').innerText().catch(() => '')).slice(0, 400) };
  }

  await page.goto('/profile/personal', { waitUntil: 'domcontentloaded' });
  const preferenceText = page.getByText('Notificações por e-mail', { exact: true });
  const preferenceVisible = await preferenceText.count() > 0;
  let preferenceSaved = false;
  if (preferenceVisible) {
    const row = preferenceText.locator('xpath=../..');
    await row.locator('div.cursor-pointer').click();
    const updateResponse = page.waitForResponse((response) => ['POST', 'PUT', 'PATCH'].includes(response.request().method()) && /users|profile|auth/i.test(response.url()));
    await page.getByRole('button', { name: 'Salvar Tudo' }).click();
    const response = await updateResponse;
    preferenceSaved = response.status() >= 200 && response.status() < 300;
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  result.preference = { surfaceVisible: preferenceVisible, savedAndReloaded: preferenceSaved };

  for (const width of [430, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await dismissCookieConsent(page);
    await page.waitForTimeout(1500);
    const mobileHeading = page.getByRole('heading', { name: /Notificações/i }).first();
    const rendered = await mobileHeading.isVisible().catch(() => false);
    result.mobile[width] = {
      rendered,
      url: page.url(),
      title: await page.title(),
      body: (await page.locator('body').innerText().catch(() => '')).slice(0, 400),
      horizontalOverflow: rendered ? await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1) : null,
      primaryActionReachable: rendered ? await page.getByRole('button', { name: 'Ler todas' }).isVisible() : false,
    };
  }
  await desktop.close();
  return result;
};

const runAdmin = async (browser, storageState) => {
  const result = { routes: {}, mobile: {} };
  const context = await browser.newContext({ baseURL: baseUrl, storageState, viewport: { width: 1280, height: 900 } });
  for (const route of ['/admin/panel/dashboard', '/admin/settings/logs', '/admin/support/comments']) {
    const page = await context.newPage();
    attachDiagnostics(page, 1280);
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await dismissCookieConsent(page);
    const authenticated = !new URL(page.url()).pathname.startsWith('/auth');
    if (!authenticated) diagnostics.authRedirects.push({ role: 'admin', route, url: page.url(), classification: 'SESSION_INVALIDATED_OR_AUTH_REDIRECT' });
    result.routes[route] = { authenticated, textLength: (await page.locator('body').innerText()).length };
    await page.close();
  }
  for (const width of [430, 390]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 844 });
    attachDiagnostics(page, width);
    await page.goto('/admin/support/comments', { waitUntil: 'domcontentloaded' });
    await dismissCookieConsent(page);
    const authenticated = !new URL(page.url()).pathname.startsWith('/auth');
    if (!authenticated) diagnostics.authRedirects.push({ role: 'admin', width, url: page.url(), classification: 'SESSION_INVALIDATED_OR_AUTH_REDIRECT' });
    result.mobile[width] = { authenticated, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1) };
    await page.close();
  }
  await context.close();
  return result;
};

const browser = await chromium.launch({ headless: true });
try {
  const user = byRole('user');
  const admin = byRole('admin');
  if (!user || !admin) throw new Error('AUTH_CREDENTIALS_MISSING:expected user and admin identities');
  const userAuth = await loadOrLogin(browser, user, { width: 1280, height: 900 });
  const adminAuth = await loadOrLogin(browser, admin, { width: 1280, height: 900 });
  const userStorage = userAuth.storageState;
  const adminStorage = adminAuth.storageState;
  const userResult = await runUser(browser, userStorage);
  const adminResult = await runAdmin(browser, adminStorage);
  const negative = await browser.newContext({ baseURL: baseUrl, storageState: userStorage, viewport: { width: 1280, height: 900 } });
  const negativePage = await negative.newPage();
  let negativeRouteStatus = null;
  negativePage.on('response', (response) => {
    if (response.request().resourceType() === 'document' && response.url().includes('/admin/settings/logs')) {
      negativeRouteStatus = response.status();
    }
  });
  await negativePage.goto('/admin/settings/logs', { waitUntil: 'domcontentloaded' });
  await dismissCookieConsent(negativePage);
  const userAdminDenied = new URL(negativePage.url()).pathname.startsWith('/auth')
    || !new URL(negativePage.url()).pathname.startsWith('/admin')
    || (negativeRouteStatus !== null && negativeRouteStatus >= 400);
  await negative.close();
  const payload = {
    success: userResult.notification.persistedReadAfterReload && userResult.preference.savedAndReloaded,
    authBypassUsed: false,
    userLoginCount: userAuth.loginPerformed ? 1 : 0,
    adminLoginCount: adminAuth.loginPerformed ? 1 : 0,
    authFailureClassification: diagnostics.authRedirects.length === 0 && diagnostics.httpErrors.every((entry) => ![401, 403, 429].includes(entry.status)) ? 'PASS' : 'CLASSIFIED_FAILURES_PRESENT',
    unclassifiedAuthRedirects: diagnostics.authRedirects.length,
    user: userResult,
    admin: adminResult,
    negative: { userAdminDenied, routeStatus: negativeRouteStatus },
    diagnostics,
    checkedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(payload, null, 2));
} finally {
  await browser.close();
}
