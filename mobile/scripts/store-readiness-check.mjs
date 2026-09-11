import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = process.cwd();
const repoRoot = path.resolve(mobileRoot, '..');
const failures = [];

const readRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const readMobile = (relativePath) => fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
const hasRepo = (relativePath) => fs.existsSync(path.join(repoRoot, relativePath));
const hasMobile = (relativePath) => fs.existsSync(path.join(mobileRoot, relativePath));
const fail = (message) => failures.push(message);

for (const file of [
  'eas.json',
  'src/config/publicLinks.ts',
  'src/features/account/screens/StoreAccountScreen.tsx',
  'app/(app)/(tabs)/conta.tsx',
  'DATA_SAFETY_DRAFT.md',
  'STORE_METADATA_DRAFT.md',
  'STORE_READINESS.md',
  'SUBMISSION_ROLLOUT_CHECKLIST.md',
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
  const androidSubmit = eas?.submit?.production?.android;

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
  if (Object.prototype.hasOwnProperty.call(production?.env || {}, 'EXPO_PUBLIC_SCREENSHOT_MODE')) {
    fail('EAS production nao pode definir EXPO_PUBLIC_SCREENSHOT_MODE.');
  }
  if (androidSubmit?.track !== 'internal') {
    fail('Primeira submissao Android deve permanecer na faixa internal ate o beta ser validado.');
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

if (hasMobile('DATA_SAFETY_DRAFT.md')) {
  const dataSafety = readMobile('DATA_SAFETY_DRAFT.md');
  for (const required of ['Google', 'Apple', 'dados']) {
    if (!dataSafety.toLowerCase().includes(required.toLowerCase())) {
      fail(`DATA_SAFETY_DRAFT.md perdeu contexto obrigatorio: ${required}`);
    }
  }
}

if (hasMobile('STORE_METADATA_DRAFT.md')) {
  const metadata = readMobile('STORE_METADATA_DRAFT.md');
  if (!metadata.includes('ConcursoMestre')) {
    fail('STORE_METADATA_DRAFT.md deve identificar claramente o produto.');
  }
}

if (hasMobile('SUBMISSION_ROLLOUT_CHECKLIST.md')) {
  const submission = readMobile('SUBMISSION_ROLLOUT_CHECKLIST.md');
  for (const required of ['Google Play', 'App Store', 'rollout']) {
    if (!submission.toLowerCase().includes(required.toLowerCase())) {
      fail(`Checklist de submissao perdeu requisito obrigatorio: ${required}`);
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

if (hasRepo('src/app/privacy/page.tsx')) {
  const privacy = readRepo('src/app/privacy/page.tsx');
  const obsoletePrivacyTokens = [
    '24 de Maio de 2024',
    'Pagar.me/Stripe',
    'dpo@concursomestre.ai',
    'A exclusão integral da sua conta remove suas notas sistêmicas, dados e correlações.',
  ];

  for (const token of obsoletePrivacyTokens) {
    if (privacy.includes(token)) {
      fail(`Politica de Privacidade reintroduziu conteudo legado ou absoluto: ${token}`);
    }
  }

  for (const required of [
    '10 de Setembro de 2026',
    '/account-deletion',
    '/profile/security',
    'A eliminação não é necessariamente instantânea',
    'Não vendemos dados pessoais',
  ]) {
    if (!privacy.includes(required)) {
      fail(`Politica de Privacidade perdeu salvaguarda obrigatoria: ${required}`);
    }
  }
}

if (hasRepo('src/app/terms/page.tsx')) {
  const terms = readRepo('src/app/terms/page.tsx');
  const obsoleteTermsTokens = [
    '24 de Maio de 2024',
    'juridico@concursomestre.ai',
    'de forma irrevogável e irretratável',
    'você tem até 7 dias corridos contados da primeira assinatura para exigir reembolso integral',
  ];

  for (const token of obsoleteTermsTokens) {
    if (terms.includes(token)) {
      fail(`Termos de Uso reintroduziram conteudo legado ou absoluto: ${token}`);
    }
  }

  for (const required of [
    '10 de Setembro de 2026',
    '/account-deletion',
    '/privacy',
    'não representa garantia de aprovação',
    'não é necessariamente instantânea',
  ]) {
    if (!terms.includes(required)) {
      fail(`Termos de Uso perderam salvaguarda obrigatoria: ${required}`);
    }
  }
}

if (failures.length > 0) {
  console.error('\nStore readiness gate FAILED:\n');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log('\nStore readiness code gate PASS');
