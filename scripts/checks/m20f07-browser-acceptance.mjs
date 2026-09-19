import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = (process.env.CM_BASE_URL || 'https://concursomestre.com').replace(/\/$/, '');
const credentials = JSON.parse(await (await import('node:fs/promises')).readFile(process.env.M20F07_CREDENTIALS_FILE, 'utf8'));
const byRole = (role) => credentials.identities.find((identity) => identity.role === role);
const reportPath = process.env.M20F07_BROWSER_REPORT || '.tmp/m20f07-browser-acceptance.json';
const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [], unexpected404s: [] };

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
    if (response.status() !== 404) return;
    const url = response.url();
    if (!url.includes('/_next/static/') && !url.includes('/favicon')) {
      diagnostics.unexpected404s.push({ viewport, url, method: response.request().method() });
    }
  });
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
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 15000 });
  if (response.status() < 200 || response.status() >= 300) throw new Error(`login failed for ${identity.role}`);
  const storageState = await context.storageState();
  await context.close();
  return storageState;
};

const runUser = async (browser, storageState) => {
  const result = { notification: {}, preference: {}, mobile: {} };
  const desktop = await browser.newContext({ baseURL: baseUrl, storageState, viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  attachDiagnostics(page, 1280);
  await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
  const notificationTitle = page.getByRole('heading', { name: 'M20F07 synthetic notification', exact: true }).first();
  await notificationTitle.waitFor({ state: 'visible' });
  const unreadBefore = await page.getByTitle('Marcar como lida').count();
  const markReadResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/notifications/mark_read.php'));
  await notificationTitle.click();
  await markReadResponse;
  await page.reload({ waitUntil: 'domcontentloaded' });
  const unreadAfterReload = await page.getByTitle('Marcar como lida').count();
  result.notification = { rendered: true, unreadBefore, markedReadThroughUi: unreadBefore > 0, persistedReadAfterReload: unreadAfterReload === 0 };

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
    await page.waitForTimeout(1500);
    const mobileHeading = page.getByRole('heading', { name: /Notificações/i }).first();
    if (!(await mobileHeading.isVisible().catch(() => false))) {
      throw new Error(`mobile notifications not rendered at ${page.url()}: ${(await page.locator('body').innerText()).slice(0, 240)}`);
    }
    result.mobile[width] = {
      rendered: true,
      horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
      primaryActionReachable: await page.getByRole('button', { name: 'Ler todas' }).isVisible(),
    };
  }
  await desktop.close();
  return result;
};

const runAdmin = async (browser, storageState) => {
  const result = { routes: {}, mobile: {} };
  for (const route of ['/admin/panel/dashboard', '/admin/settings/logs', '/admin/support/comments']) {
    const page = await (await browser.newContext({ baseURL: baseUrl, storageState, viewport: { width: 1280, height: 900 } })).newPage();
    attachDiagnostics(page, 1280);
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    result.routes[route] = { authenticated: !new URL(page.url()).pathname.startsWith('/auth'), textLength: (await page.locator('body').innerText()).length };
    await page.context().close();
  }
  for (const width of [430, 390]) {
    const context = await browser.newContext({ baseURL: baseUrl, storageState, viewport: { width, height: 844 } });
    const page = await context.newPage();
    attachDiagnostics(page, width);
    await page.goto('/admin/support/comments', { waitUntil: 'domcontentloaded' });
    result.mobile[width] = { authenticated: !new URL(page.url()).pathname.startsWith('/auth'), horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1) };
    await context.close();
  }
  return result;
};

const browser = await chromium.launch({ headless: true });
try {
  const user = byRole('user');
  const admin = byRole('admin');
  const userStorage = await login(browser, user, { width: 1280, height: 900 });
  const adminStorage = await login(browser, admin, { width: 1280, height: 900 });
  const userResult = await runUser(browser, userStorage);
  const adminResult = await runAdmin(browser, adminStorage);
  const negative = await browser.newContext({ baseURL: baseUrl, storageState: userStorage, viewport: { width: 1280, height: 900 } });
  const negativePage = await negative.newPage();
  await negativePage.goto('/admin/settings/logs', { waitUntil: 'domcontentloaded' });
  const userAdminDenied = new URL(negativePage.url()).pathname.startsWith('/auth') || !new URL(negativePage.url()).pathname.startsWith('/admin');
  await negative.close();
  const payload = {
    success: userResult.notification.persistedReadAfterReload && userResult.preference.savedAndReloaded,
    authBypassUsed: false,
    user: userResult,
    admin: adminResult,
    negative: { userAdminDenied },
    diagnostics,
    checkedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(payload, null, 2));
} finally {
  await browser.close();
}
