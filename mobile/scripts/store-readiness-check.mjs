import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = process.cwd();
const repoRoot = path.resolve(mobileRoot, '..');
const failures = [];
const warnings = [];

const readRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const readMobile = (relativePath) => fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
const hasRepo = (relativePath) => fs.existsSync(path.join(repoRoot, relativePath));
const hasMobile = (relativePath) => fs.existsSync(path.join(mobileRoot, relativePath));
const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);

for (const file of [
  'eas.json',
  'src/config/publicLinks.ts',
  'src/features/account/screens/StoreAccountScreen.tsx',
  'app/(app)/(tabs)/conta.tsx',
]) {
  if (!hasMobile(file)) fail(`Arquivo obrigatorio de store ausente: mobile/${file}`);
}

for (const file of [
  'src/app/privacy/page.tsx',
  'src/app/terms/page.tsx',
  'src/app/support/page.tsx',
  'src/app/account-deletion/page.tsx',
]) {
  if (!hasRepo(file)) fail(`Recurso web obrigatorio ausente: ${file}`);
}

if (hasMobile('eas.json')) {
  const eas = JSON.parse(readMobile('eas.json'));
  const preview = eas?.build?.preview;
  const production = eas?.build?.production;

  if (preview?.distribution !== 'internal' || preview?.android?.buildType !== 'apk') {
    fail('EAS preview deve continuar gerando APK de distribuicao interna.');
  }
  if (preview?.env?.EXPO_PUBLIC_DISTRIBUTION_CHANNEL !== 'direct') {
    fail('EAS preview deve usar o canal direct.');
  }
  if (production?.distribution !== 'store') {
    fail('EAS production deve usar distribution=store.');
  }
  if (production?.env?.EXPO_PUBLIC_DISTRIBUTION_CHANNEL !== 'store') {
    fail('EAS production deve ativar EXPO_PUBLIC_DISTRIBUTION_CHANNEL=store.');
  }
  if (production?.android?.buildType !== 'app-bundle') {
    fail('EAS production Android deve gerar app-bundle.');
  }
  if (production?.env?.EXPO_PUBLIC_API_BASE_URL !== 'https://concursomestre.com/api/') {
    fail('EAS production deve usar a API publica HTTPS do ConcursoMestre.');
  }
}

if (hasMobile('app/(app)/(tabs)/conta.tsx')) {
  const accountRoute = readMobile('app/(app)/(tabs)/conta.tsx');
  if (!accountRoute.includes("EXPO_PUBLIC_DISTRIBUTION_CHANNEL === 'store'")) {
    fail('A tab Conta deve selecionar a superficie segura pelo canal store.');
  }
  if (!accountRoute.includes('StoreAccountScreen')) {
    fail('A tab Conta deve carregar StoreAccountScreen em builds de loja.');
  }
}

if (hasMobile('src/features/account/screens/StoreAccountScreen.tsx')) {
  const storeAccount = readMobile('src/features/account/screens/StoreAccountScreen.tsx');
  const forbidden = [
    'createStripePortalSession',
    'openBillingPortal',
    "router.push('/plans')",
    "router.push('/checkout')",
  ];

  for (const token of forbidden) {
    if (storeAccount.includes(token)) {
      fail(`StoreAccountScreen reintroduziu acao de pagamento externo proibida pelo gate: ${token}`);
    }
  }

  for (const required of [
    'updateRenewal(false)',
    'requestAccountDeletion',
    'PUBLIC_LINKS.privacy',
    'PUBLIC_LINKS.terms',
    'PUBLIC_LINKS.support',
    'PUBLIC_LINKS.accountDeletion',
  ]) {
    if (!storeAccount.includes(required)) {
      fail(`StoreAccountScreen perdeu requisito obrigatorio: ${required}`);
    }
  }
}

if (hasRepo('src/app/account-deletion/page.tsx')) {
  const deletionPage = readRepo('src/app/account-deletion/page.tsx');
  if (!deletionPage.includes('/profile/security')) {
    fail('Pagina publica de exclusao deve encaminhar ao fluxo web autenticado real.');
  }
  if (!deletionPage.includes('ConcursoMestre')) {
    fail('Pagina publica de exclusao deve identificar claramente o ConcursoMestre.');
  }
}

if (hasRepo('src/app/privacy/page.tsx') && readRepo('src/app/privacy/page.tsx').includes('24 de Maio de 2024')) {
  warn('Politica de Privacidade ainda exibe atualizacao de 24/05/2024; revisao juridica final continua pendente.');
}
if (hasRepo('src/app/terms/page.tsx') && readRepo('src/app/terms/page.tsx').includes('24 de Maio de 2024')) {
  warn('Termos de Uso ainda exibem atualizacao de 24/05/2024; revisao juridica final continua pendente.');
}

if (warnings.length > 0) {
  console.warn('\nStore readiness warnings:\n');
  for (const message of warnings) console.warn(`- ${message}`);
}

if (failures.length > 0) {
  console.error('\nStore readiness gate FAILED:\n');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log('\nStore readiness code gate PASS');
