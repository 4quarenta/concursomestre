import fs from 'node:fs';
import path from 'node:path';

const mobileRoot = process.cwd();
const repoRoot = path.resolve(mobileRoot, '..');
const failures = [];

const fail = (message) => failures.push(message);
const exists = (relativePath) => fs.existsSync(path.join(repoRoot, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const requireFile = (relativePath, message) => {
  if (!exists(relativePath)) fail(message || `Arquivo obrigatorio ausente: ${relativePath}`);
};

const requireText = (relativePath, expected, message) => {
  if (!exists(relativePath)) {
    fail(`Nao foi possivel validar ${relativePath}: arquivo ausente.`);
    return;
  }
  if (!read(relativePath).includes(expected)) fail(message);
};

const forbidFile = (relativePath, message) => {
  if (exists(relativePath)) fail(message || `Bridge legada ainda presente: ${relativePath}`);
};

const appJsonPath = path.join(mobileRoot, 'app.json');
if (!fs.existsSync(appJsonPath)) {
  fail('mobile/app.json ausente.');
} else {
  const app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')).expo;

  if (app?.name !== 'ConcursoMestre') fail('Nome nativo deve permanecer ConcursoMestre.');
  if (app?.scheme !== 'concursomestre') fail('Deep link scheme esperado: concursomestre.');
  if (!/^\d+\.\d+\.\d+$/.test(String(app?.version || ''))) {
    fail('Versao nativa deve usar SemVer numerico (x.y.z).');
  }
  if (app?.android?.package !== 'com.concursomestre.mobile') {
    fail('Android package esperado: com.concursomestre.mobile.');
  }
  if (!Number.isInteger(app?.android?.versionCode) || app.android.versionCode < 1) {
    fail('Android versionCode deve ser inteiro positivo.');
  }
  if (app?.ios?.bundleIdentifier !== 'com.concursomestre.mobile') {
    fail('iOS bundleIdentifier esperado: com.concursomestre.mobile.');
  }
  if (!/^\d+$/.test(String(app?.ios?.buildNumber || ''))) {
    fail('iOS buildNumber deve ser numerico.');
  }

  const serialized = JSON.stringify(app);
  if (/localhost|127\.0\.0\.1|10\.0\.2\.2/i.test(serialized)) {
    fail('app.json nao pode embutir endpoint local para builds distribuiveis.');
  }
}

// Superficie obrigatoria do MVP.
[
  'mobile/app/(app)/(tabs)/questoes.tsx',
  'mobile/app/(app)/(tabs)/simulados.tsx',
  'mobile/app/(app)/(tabs)/conta.tsx',
  'mobile/app/(app)/simulados/novo.tsx',
  'mobile/app/(app)/simulados/executar.tsx',
  'mobile/app/(app)/simulados/historico/[simulationId].tsx',
  'mobile/app/(auth)/login.tsx',
  'mobile/app/(auth)/cadastro.tsx',
  'mobile/app/+not-found.tsx',
].forEach((file) => requireFile(file));

// Recursos publicos exigidos para distribuicao e suporte.
[
  'src/app/privacy/page.tsx',
  'src/app/terms/page.tsx',
  'src/app/support/page.tsx',
  'src/app/account-deletion/page.tsx',
].forEach((file) => requireFile(file));

// Bridges antigas nao podem voltar ao bundle publicavel.
[
  'mobile/app/(app)/SimulationRun.tsx',
  'mobile/app/(app)/MainTabs.tsx',
  'mobile/app/(app)/Checkout.tsx',
].forEach((file) => forbidFile(file));

requireText(
  'mobile/app/_layout.tsx',
  '<Stack.Protected guard={Boolean(user)}>',
  'O grupo autenticado deve permanecer protegido por sessao.',
);
requireText(
  'mobile/app/_layout.tsx',
  '<Stack.Protected guard={!user}>',
  'O grupo publico deve permanecer protegido contra usuario ja autenticado.',
);
requireText(
  'mobile/src/config/runtime.ts',
  "!normalized.toLowerCase().startsWith('https://')",
  'Build distribuivel deve rejeitar API sem HTTPS.',
);
requireText(
  'mobile/src/config/runtime.ts',
  'EXPO_PUBLIC_API_BASE_URL',
  'Runtime deve exigir configuracao explicita da API fora de desenvolvimento.',
);

// Links publicos devem permanecer HTTPS e no dominio oficial.
for (const [key, route] of Object.entries({
  privacy: '/privacy',
  terms: '/terms',
  support: '/support',
  accountDeletion: '/account-deletion',
})) {
  requireText(
    'mobile/src/config/publicLinks.ts',
    `${key}: \`${'${PUBLIC_WEB_BASE_URL}'}${route}\``,
    `Link publico ${key} deve permanecer configurado no dominio oficial.`,
  );
}
requireText(
  'mobile/src/config/publicLinks.ts',
  "PUBLIC_WEB_BASE_URL = 'https://concursomestre.com'",
  'Links publicos devem usar HTTPS no dominio oficial do ConcursoMestre.',
);
requireText(
  'mobile/src/screens/auth/LoginScreen.tsx',
  'PUBLIC_LINKS.privacy',
  'Privacidade deve estar acessivel antes do login.',
);
requireText(
  'mobile/src/screens/auth/LoginScreen.tsx',
  'PUBLIC_LINKS.support',
  'Suporte deve estar acessivel antes do login.',
);
requireText(
  'mobile/src/screens/auth/RegisterScreen.tsx',
  'PUBLIC_LINKS.terms',
  'Termos devem estar acessiveis no cadastro.',
);
requireText(
  'mobile/src/screens/auth/RegisterScreen.tsx',
  'PUBLIC_LINKS.privacy',
  'Privacidade deve estar acessivel no cadastro.',
);

// As rotas ativas devem apontar para as features novas.
requireText(
  'mobile/app/(app)/(tabs)/questoes.tsx',
  'QuestionsScreenV2',
  'A tab Questoes deve continuar usando QuestionsScreenV2.',
);
requireText(
  'mobile/app/(app)/(tabs)/conta.tsx',
  'AccountScreen',
  'A tab Conta deve continuar usando a feature nova de Conta.',
);
requireText(
  'mobile/app/(app)/simulados/executar.tsx',
  'SimulationRun',
  'A rota canonica de execucao do simulado deve continuar ligada ao runner atual.',
);

if (failures.length > 0) {
  console.error('\nMobile RC smoke gate FAILED:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Mobile RC smoke gate PASS');
