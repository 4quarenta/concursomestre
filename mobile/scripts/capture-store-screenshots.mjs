import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileRoot = path.resolve(__dirname, '..');
const outputDir = path.join(mobileRoot, 'artifacts', 'screenshots');

const baseUrl = (process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const variant = process.env.EXPO_PUBLIC_SCREENSHOT_VARIANT || 'release-iphone';
const deviceName = process.env.SCREENSHOT_DEVICE || 'iPhone 14 Pro';
const screenshotEmail = process.env.SCREENSHOT_EMAIL || '';
const screenshotPassword = process.env.SCREENSHOT_PASSWORD || '';

const supportedVariants = new Set([
  'release-iphone',
  'release-android',
  'authenticated-ios',
  'authenticated-android',
]);

if (!supportedVariants.has(variant)) {
  throw new Error(`Variant de screenshot desconhecida: ${variant}`);
}

const device = devices[deviceName];
if (!device) {
  throw new Error(`Device Playwright desconhecido: ${deviceName}`);
}

const authenticatedVariant = variant.startsWith('authenticated-');

const releaseTargets = [
  { name: '01-login', route: '/login', readyText: 'Entrar' },
  { name: '02-questoes', route: '/questoes', readyText: 'Quest' },
  { name: '03-simulados', route: '/simulados', readyText: 'Simulado' },
  { name: '04-conta', route: '/conta', readyText: 'Conta' },
];

const authenticatedTargets = [
  { name: '01-questoes', route: '/questoes', readyText: 'Quest' },
  { name: '02-simulados', route: '/simulados', readyText: 'Simulado' },
  { name: '03-conta', route: '/conta', readyText: 'Conta' },
];

const targets = authenticatedVariant ? authenticatedTargets : releaseTargets;

const waitForAppToSettle = async (page, target) => {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 });

  if (target.readyText) {
    await page.getByText(new RegExp(target.readyText, 'i')).first().waitFor({
      state: 'visible',
      timeout: 12_000,
    }).catch(() => undefined);
  }

  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  }).catch(() => undefined);

  await page.waitForTimeout(1_200);
};

const assertNoFatalRenderError = async (page, route) => {
  const body = await page.locator('body').innerText().catch(() => '');
  const fatalMarkers = [
    'Application error',
    'Something went wrong',
    'Unexpected Application Error',
    'Cannot read properties of',
  ];

  const marker = fatalMarkers.find((item) => body.includes(item));
  if (marker) {
    throw new Error(`Falha de renderizacao detectada em ${route}: ${marker}`);
  }
};

const loginWithRealAccount = async (page) => {
  if (!screenshotEmail || !screenshotPassword) {
    throw new Error(
      'Variantes authenticated-* exigem SCREENSHOT_EMAIL e SCREENSHOT_PASSWORD.',
    );
  }

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.getByPlaceholder('voce@exemplo.com').fill(screenshotEmail);
  await page.getByPlaceholder('Sua senha').fill(screenshotPassword);
  await page.getByText('Entrar', { exact: true }).last().click();

  await page.waitForFunction(
    () => !window.location.pathname.toLowerCase().includes('/login'),
    undefined,
    { timeout: 20_000 },
  ).catch(async () => {
    const body = await page.locator('body').innerText().catch(() => '');
    throw new Error(`Login de screenshot nao concluiu. Tela atual: ${body.slice(0, 500)}`);
  });
};

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    ...device,
    locale: 'pt-BR',
    timezoneId: 'America/Fortaleza',
    colorScheme: 'light',
  });

  const page = await context.newPage();

  if (authenticatedVariant) {
    await loginWithRealAccount(page);
  }

  const manifest = [];

  for (const target of targets) {
    const url = `${baseUrl}${target.route}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForAppToSettle(page, target);
    await assertNoFatalRenderError(page, target.route);

    const filename = `${target.name}-${variant}.png`;
    const outputPath = path.join(outputDir, filename);

    await page.screenshot({
      path: outputPath,
      fullPage: false,
      animations: 'disabled',
    });

    manifest.push({
      filename,
      route: target.route,
      variant,
      device: deviceName,
      viewport: page.viewportSize(),
    });

    console.log(`Captured ${target.route} -> ${filename}`);
  }

  await fs.writeFile(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  await context.close();
} finally {
  await browser.close();
}

console.log(`Screenshot capture PASS (${variant}, ${deviceName})`);
