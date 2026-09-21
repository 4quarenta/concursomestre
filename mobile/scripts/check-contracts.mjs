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
if (!/list:\s*["']questions\/list\.php["']/.test(endpoints)) {
  failures.push('Questoes mobile devem usar o endpoint oficial questions/list.php.');
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
  'selected_option: answer.selectedOptionIndex',
  'A submissao mobile deve enviar somente a alternativa selecionada para correcao server-side.',
);

const simulationsService = read('backend/modules/simulations/services/SimulationsService.php');
requireText(
  simulationsService,
  '$correctOptionIndexes = $this->repository->findCorrectOptionIndexes($answerQuestionIds);',
  'Simulados devem buscar o gabarito no servidor.',
);
requireText(
  simulationsService,
  '$serverScore = (float) $correctCount;',
  'Score de simulado deve ser calculado no servidor.',
);
requireText(
  simulationsService,
  "'score' => $item['status'] === 'completed' ? (float) ($row['score'] ?? 0) : null",
  'Tentativas em andamento nao podem expor score parcial.',
);
requireText(
  simulationsService,
  "unset($question['correctOptionIndex'], $question['correct_option_index'], $question['resposta'], $question['resposta_correta']);",
  'Tentativas em andamento devem remover pistas de gabarito.',
);

if (failures.length > 0) {
  console.error('\nMobile security contract gate FAILED:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Mobile security contract gate PASS');
