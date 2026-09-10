import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const failures = [];
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) failures.push(message);
};

const endpoints = read('mobile/src/api/endpoints.ts');
requireText(
  endpoints,
  "list: 'questions/mobile_list.php'",
  'Questoes mobile devem usar o endpoint sanitizado questions/mobile_list.php.',
);

const mobileQuestionList = read('backend/api/questions/mobile_list.php');
requireText(
  mobileQuestionList,
  "unset($question['resposta'], $question['correctOptionIndex']);",
  'A listagem mobile deve remover resposta/correctOptionIndex antes da resposta.',
);
requireText(
  mobileQuestionList,
  "unset($question['userAnswer'], $question['resolvida']);",
  'exam_mode deve remover resposta anterior do usuario.',
);

const questionService = read('mobile/src/services/questions/questionService.ts');
if (/\bis_correct\s*:/.test(questionService)) {
  failures.push('O cliente mobile nao pode enviar is_correct na submissao de questoes.');
}
requireText(
  questionService,
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
