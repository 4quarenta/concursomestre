import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const backendRootCandidates = [
  path.join(repoRoot, 'backend'),
  path.resolve(repoRoot, '..', 'concursomestre', 'backend'),
];
const backendRoot = backendRootCandidates.find((candidate) => fs.existsSync(path.join(candidate, 'modules/questions/services/QuestionOutputPolicy.php')))
  || backendRootCandidates.find((candidate) => fs.existsSync(candidate))
  || backendRootCandidates[0];
const readBackend = (relativePath) => fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');

const failures = [];
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) failures.push(message);
};

const endpoints = read('mobile/src/api/endpoints.ts');
const authFlowService = read('mobile/src/services/auth/authFlowService.ts');
const registerScreen = read('mobile/src/screens/auth/RegisterScreen.tsx');
const registerService = read('mobile/src/services/auth/authFlowService.ts');
const mobileLegalVersions = read('mobile/src/services/legal/legalDocumentVersion.ts');
const canonicalLegalVersions = JSON.parse(read('contracts/legal/legal-document-versions.v1.json'));
const externalUrlService = read('mobile/src/services/navigation/externalUrlService.ts');
const appErrorBoundary = read('mobile/src/components/AppErrorBoundary.tsx');
requireText(
  appErrorBoundary,
  'if (__DEV__)',
  'Error Boundary mobile nao deve emitir detalhes de erro em builds de producao.',
);
for (const [field, message] of [
  ["cpf: string;", 'Cadastro mobile deve enviar o CPF exigido pelo contrato oficial.'],
  ["phone: string;", 'Cadastro mobile deve enviar o telefone exigido pelo contrato oficial.'],
  ["termsAccepted: true;", 'Cadastro mobile deve enviar aceite explícito dos termos.'],
  ["privacyAccepted: true;", 'Cadastro mobile deve enviar aceite explícito da política de privacidade.'],
]) {
  requireText(registerService, field, message);
}
for (const [field, message] of [
  ['label="CPF"', 'Cadastro mobile deve solicitar CPF antes de chamar a API.'],
  ['label="Telefone com DDD"', 'Cadastro mobile deve solicitar telefone antes de chamar a API.'],
  ['accessibilityRole="checkbox"', 'Aceite legal mobile deve ser explícito e acessível.'],
  ['isValidCpf(normalizedCpf)', 'Cadastro mobile deve validar o CPF antes do envio.'],
]) {
  requireText(registerScreen, field, message);
}
for (const [documentKey, constantName] of [
  ['terms_of_use', 'TERMS_OF_USE_VERSION'],
  ['privacy_policy', 'PRIVACY_POLICY_VERSION'],
]) {
  const version = canonicalLegalVersions.documents[documentKey]?.version;
  if (!version || !mobileLegalVersions.includes(`export const ${constantName} = "${version}";`)) {
    failures.push(`Versao legal mobile divergente ou ausente: ${documentKey}.`);
  }
}
requireText(
  externalUrlService,
  'TRUSTED_EXTERNAL_HOSTS',
  'Links externos mobile devem possuir allowlist de hosts confiáveis.',
);
requireText(
  externalUrlService,
  'parsed.protocol !== "https:"',
  'Links externos mobile devem exigir HTTPS.',
);
for (const mobileFile of [
  'mobile/src/features/content/screens/LearningHubScreens.tsx',
  'mobile/src/features/content/screens/NotificationsScreen.tsx',
  'mobile/src/features/content/screens/LawDetailScreen.tsx',
  'mobile/src/features/account/screens/AccountScreen.tsx',
  'mobile/src/features/account/screens/StoreAccountScreen.tsx',
  'mobile/src/screens/auth/LoginScreen.tsx',
  'mobile/src/screens/auth/RegisterScreen.tsx',
]) {
  const source = read(mobileFile);
  if (!source.includes('assertAllowedExternalUrl')) {
    failures.push(`Abertura externa sem allowlist: ${mobileFile}`);
  }
}
for (const [endpoint, message] of [
  ['forgotPassword: "auth/forgot-password.php"', 'Recuperacao de senha mobile deve usar o endpoint oficial.'],
  ['resetPassword: "auth/reset-password.php"', 'Redefinicao de senha mobile deve usar o endpoint oficial.'],
  ['confirmEmail: "auth/confirm-email.php"', 'Confirmacao de e-mail mobile deve usar o endpoint oficial.'],
]) {
  requireText(endpoints, endpoint, message);
}
for (const [method, message] of [
  ['async forgotPassword(', 'Servico mobile deve expor recuperacao de senha.'],
  ['async resetPassword(', 'Servico mobile deve expor redefinicao de senha.'],
  ['async confirmEmail(', 'Servico mobile deve expor confirmacao de e-mail.'],
]) {
  requireText(authFlowService, method, message);
}
if (!/list:\s*["']questions\/list\.php["']/.test(endpoints)) {
  failures.push('Questoes mobile devem usar o endpoint oficial questions/list.php.');
}
if (!/user:\s*["']statistics\/user\.php["']/.test(endpoints)) {
  failures.push('Estatisticas mobile devem usar o endpoint oficial statistics/user.php.');
}
const statisticsService = read('mobile/src/services/statistics/statisticsService.ts');
if (!statisticsService.includes('apiClient.get<any>(ENDPOINTS.statistics.user')) {
  failures.push('Estatisticas mobile devem chamar o endpoint canônico sem concatenar o ID na rota.');
}
if (!statisticsService.includes('user_id: normalizedUserId')) {
  failures.push('Estatisticas mobile devem enviar user_id na query oficial.');
}

const questionsService = readBackend('modules/questions/services/QuestionsService.php');
requireText(
  questionsService,
  'return $this->outputPolicy->forRead(',
  'A listagem de questoes deve passar pela politica de saida sanitizada.',
);
const outputPolicyPath = 'modules/questions/services/QuestionOutputPolicy.php';
const mobileListPath = 'api/questions/mobile_list.php';
const outputPolicy = fs.existsSync(path.join(backendRoot, outputPolicyPath))
  ? readBackend(outputPolicyPath)
  : readBackend(mobileListPath);
requireText(
  outputPolicy,
  fs.existsSync(path.join(backendRoot, outputPolicyPath))
    ? 'if (!$includeAnswerKey && $this->matchesField($key, self::ANSWER_KEY_FIELDS))'
    : "unset($question['resposta'], $question['correctOptionIndex']);",
  'A listagem sem gabarito deve remover os campos de resposta antes da resposta.',
);

const questionClientService = read('mobile/src/services/questions/questionService.ts');
if (/\bis_correct\s*:/.test(questionClientService)) {
  failures.push('O cliente mobile nao pode enviar is_correct na submissao de questoes.');
}
requireText(
  questionClientService,
  'selectedAlternativeId,',
  'A submissao mobile deve enviar somente a alternativa selecionada para correcao server-side.',
);
if (!/submit:\s*["']v2\/questions\/answer\.php["']/.test(endpoints)) {
  failures.push('A submissao mobile deve usar o endpoint v2 idempotente.');
}

const simulationsService = read('backend/modules/simulations/services/SimulationsService.php');
const usesCanonicalQuestionEvaluator = simulationsService.includes(
  '$this->questionsRepository->findQuestionAnswerKeysByIds($answerQuestionIds)',
) && simulationsService.includes(
  "$this->answerEvaluator->evaluate($question, (int) $normalizedAnswer['selected_option_index'])",
);
const usesRepositoryAnswerKeys = simulationsService.includes(
  '$correctOptionIndexes = $this->repository->findCorrectOptionIndexes($answerQuestionIds);',
);
if (!usesCanonicalQuestionEvaluator && !usesRepositoryAnswerKeys) {
  failures.push('Simulados devem buscar o gabarito no servidor.');
}
if (!simulationsService.includes("'score' => $correctCount")
  && !simulationsService.includes('$serverScore = (float) $correctCount;')) {
  failures.push('Score de simulado deve ser calculado no servidor.');
}
requireText(
  simulationsService,
  "'score' => $item['status'] === 'completed' ? (float) ($row['score'] ?? 0) : null",
  'Tentativas em andamento nao podem expor score parcial.',
);
const stripsActiveAttemptAnswerKeys = simulationsService.includes('private function toExamQuestion')
  && ['correctOptionIndex', 'correct_option_index', 'resposta', 'resposta_correta']
    .every((field) => simulationsService.includes(`$question['${field}']`));
if (!stripsActiveAttemptAnswerKeys) {
  failures.push('Tentativas em andamento devem remover pistas de gabarito.');
}

if (failures.length > 0) {
  console.error('\nMobile security contract gate FAILED:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Mobile security contract gate PASS');
