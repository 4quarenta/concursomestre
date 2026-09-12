<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*/

/** Service oficial do dominio de simulados. */
class SimulationsService
{
    public function __construct(
        private readonly SimulationsRepository $repository,
        private readonly SimulationsValidator $validator
    ) {
    }

    public function saveSimulation(array $payload, array $authenticatedUserPayload): array
    {
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($authenticatedUserId === '') throw new RuntimeException('Sessao invalida. Faca login novamente.');

        $this->validator->ensurePayloadUserMatchesSession($payload, $authenticatedUserId);
        $normalized = $this->validator->validateSavePayload($payload);
        $config = $normalized['config'];
        $questionIds = $this->extractQuestionIds($payload['questions'] ?? []);
        $configQuestionIds = is_array($config['questionIds'] ?? null) ? array_values(array_filter(array_map('intval', $config['questionIds']))) : [];
        $answerQuestionIds = array_values(array_filter(array_map('intval', array_keys($normalized['answers'])), static fn (int $id): bool => $id > 0));
        $questionIds = array_values(array_unique(array_merge($questionIds, $configQuestionIds, $answerQuestionIds)));
        if ($questionIds !== []) $config['questionIds'] = $questionIds;

        $correctOptionIndexes = $this->repository->findCorrectOptionIndexes($answerQuestionIds);
        $normalizedAnswers = [];
        $answeredCount = 0;
        $correctCount = 0;
        $answerResults = [];

        foreach ($normalized['answers'] as $questionId => $answerPayload) {
            $questionKey = (string) (int) $questionId;
            if ($questionKey === '0') continue;
            $normalizedAnswer = $this->normalizeAnswerPayload($answerPayload);
            $selectedOptionIndex = $normalizedAnswer['selected_option_index'];
            if ($selectedOptionIndex === null) continue;
            if ($selectedOptionIndex < 0) throw new InvalidArgumentException('Alternativa selecionada invalida.');
            if (!array_key_exists($questionKey, $correctOptionIndexes)) throw new InvalidArgumentException('Nao foi possivel validar o gabarito da questao ' . $questionKey . '.');

            $correctIndex = (int) $correctOptionIndexes[$questionKey];
            $isCorrect = $selectedOptionIndex === $correctIndex;
            $answeredCount++;
            if ($isCorrect) $correctCount++;
            $normalizedAnswers[$questionKey] = ['selected_option_index' => $selectedOptionIndex, 'is_correct' => $isCorrect ? 1 : 0, 'time_taken_seconds' => $normalizedAnswer['time_taken_seconds']];
            $answerResults[$questionKey] = ['selectedOptionIndex' => $selectedOptionIndex, 'isCorrect' => $isCorrect, 'correctOptionIndex' => $correctIndex];
        }

        $serverScore = (float) $correctCount;
        $simulationName = trim((string) ($config['name'] ?? 'Simulado'));
        $configJson = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($configJson === false) throw new InvalidArgumentException('Nao foi possivel serializar a configuracao do simulado.');

        $this->repository->upsertSimulation(['id' => $normalized['id'], 'user_id' => $authenticatedUserId, 'name' => $simulationName, 'status' => $normalized['status'], 'score' => $serverScore, 'startTime' => $normalized['startTime'], 'endTime' => $normalized['endTime'], 'configJson' => $configJson]);
        $this->repository->deleteSimulationAnswers($authenticatedUserId, $normalized['id']);
        foreach ($normalizedAnswers as $questionId => $answer) {
            $this->repository->upsertSimulationAnswer(['user_id' => $authenticatedUserId, 'question_id' => $questionId, 'simulation_id' => $normalized['id'], 'selected_option_index' => $answer['selected_option_index'], 'is_correct' => $answer['is_correct'], 'time_taken_seconds' => $answer['time_taken_seconds']]);
        }

        $gamification = ['applied' => false, 'badge_awarded' => false, 'xp' => 0];
        if ($normalized['status'] === 'completed' && $answeredCount > 0) $gamification = $this->repository->applySimulationCompletedGamification($authenticatedUserId, $normalized['id'], $simulationName, $answeredCount, $correctCount);
        $progressSnapshot = $this->repository->findUserProgressSnapshot($authenticatedUserId);

        return ['id' => $normalized['id'], 'status' => $normalized['status'], 'score' => $serverScore, 'answeredCount' => $answeredCount, 'correctCount' => $correctCount, 'results' => $answerResults, 'gamification' => $gamification, 'new_xp' => isset($progressSnapshot['xp']) ? (int) $progressSnapshot['xp'] : null, 'new_level' => isset($progressSnapshot['level']) ? (int) $progressSnapshot['level'] : null, 'newXp' => isset($progressSnapshot['xp']) ? (int) $progressSnapshot['xp'] : null, 'newLevel' => isset($progressSnapshot['level']) ? (int) $progressSnapshot['level'] : null];
    }

    public function listSimulations(array $authenticatedUserPayload): array
    {
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($authenticatedUserId === '') throw new RuntimeException('Sessao invalida. Faca login novamente.');

        $rows = $this->repository->listSimulationsByUserId($authenticatedUserId);
        $answersBySimulation = $this->repository->listSimulationAnswersByUserId($authenticatedUserId);
        $allQuestionIds = [];
        $prepared = [];

        foreach ($rows as $row) {
            $id = (string) ($row['id'] ?? '');
            $status = (string) ($row['status'] ?? 'completed');
            $answers = $answersBySimulation[$id] ?? [];
            $answerQuestionIds = array_map(static fn (array $answer): int => (int) ($answer['question_id'] ?? 0), $answers);
            $answersPayload = [];
            foreach ($answers as $answer) {
                $questionId = (string) ($answer['question_id'] ?? '');
                if ($questionId === '') continue;
                $answersPayload[$questionId] = [
                    'index' => isset($answer['selected_option_index']) ? (int) $answer['selected_option_index'] : null,
                    'time_taken' => isset($answer['time_taken_seconds']) ? (int) $answer['time_taken_seconds'] : 0,
                ];
            }

            $config = [];
            if (!empty($row['config_json'])) {
                $decoded = json_decode((string) $row['config_json'], true);
                $config = is_array($decoded) ? $decoded : [];
            }
            $allowInstantFeedback = $status === 'in_progress' && (($config['feedbackMode'] ?? 'after_all') === 'instant');
            if ($status === 'completed' || $allowInstantFeedback) {
                foreach ($answers as $answer) {
                    $questionId = (string) ($answer['question_id'] ?? '');
                    if ($questionId !== '' && isset($answersPayload[$questionId])) {
                        $answersPayload[$questionId]['is_correct'] = (bool) ($answer['is_correct'] ?? false);
                    }
                }
            }

            $configQuestionIds = is_array($config['questionIds'] ?? null) ? array_map('intval', $config['questionIds']) : [];
            $questionIds = array_values(array_unique(array_filter(array_merge($configQuestionIds, $answerQuestionIds))));
            $allQuestionIds = array_merge($allQuestionIds, $questionIds);
            $prepared[] = compact('row', 'id', 'status', 'answersPayload', 'config', 'questionIds', 'allowInstantFeedback');
        }

        $reviewQuestions = $this->repository->findReviewQuestionsByIds(array_values(array_unique($allQuestionIds)));
        $simulations = array_map(function (array $item) use ($reviewQuestions): array {
            $row = $item['row'];
            $questions = [];
            foreach ($item['questionIds'] as $questionId) {
                $key = (string) $questionId;
                if (!isset($reviewQuestions[$key])) continue;
                $question = $reviewQuestions[$key];
                if ($item['status'] !== 'completed') {
                    $question = $this->toExamQuestion($question);
                }
                $questions[] = $question;
            }

            return [
                'id' => $item['id'],
                'name' => (string) ($row['name'] ?? ($item['config']['name'] ?? 'Simulado')),
                'config' => $item['config'],
                'questionIds' => $item['questionIds'],
                'questionCount' => count($item['questionIds']),
                'questions' => $questions,
                'answers' => $item['answersPayload'],
                'startTime' => !empty($row['start_time']) ? strtotime((string) $row['start_time']) * 1000 : 0,
                'endTime' => !empty($row['end_time']) ? strtotime((string) $row['end_time']) * 1000 : null,
                'status' => $item['status'],
                'score' => $item['status'] === 'completed' ? (float) ($row['score'] ?? 0) : null,
            ];
        }, $prepared);

        return ['simulations' => $simulations];
    }

    /** Remove qualquer pista de gabarito de uma questao usada em tentativa ativa. */
    private function toExamQuestion(array $question): array
    {
        unset($question['correctOptionIndex'], $question['correct_option_index'], $question['resposta'], $question['resposta_correta']);
        if (isset($question['itens']) && is_array($question['itens'])) {
            $question['itens'] = array_map(static function ($item) {
                if (!is_array($item)) return $item;
                foreach (['correct', 'isCorrect', 'is_correct', 'correta', 'isAnswer', 'is_answer'] as $key) unset($item[$key]);
                return $item;
            }, $question['itens']);
        }
        return $question;
    }

    private function normalizeAnswerPayload(mixed $answerPayload): array
    {
        if (is_array($answerPayload)) return ['selected_option_index' => isset($answerPayload['index']) ? (int) $answerPayload['index'] : null, 'time_taken_seconds' => isset($answerPayload['time_taken']) ? max(0, (int) $answerPayload['time_taken']) : 0];
        if (is_object($answerPayload)) return ['selected_option_index' => isset($answerPayload->index) ? (int) $answerPayload->index : null, 'time_taken_seconds' => isset($answerPayload->time_taken) ? max(0, (int) $answerPayload->time_taken) : 0];
        return ['selected_option_index' => $answerPayload !== null ? (int) $answerPayload : null, 'time_taken_seconds' => 0];
    }

    private function extractQuestionIds(mixed $questions): array
    {
        if (!is_array($questions)) return [];
        $ids = [];
        foreach ($questions as $question) {
            $id = is_array($question) ? ($question['id'] ?? null) : (is_object($question) ? ($question->id ?? null) : null);
            if (is_numeric($id)) $ids[] = (int) $id;
        }
        return array_values(array_unique(array_filter($ids)));
    }
}
