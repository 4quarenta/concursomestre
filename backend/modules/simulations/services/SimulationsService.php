<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

/**
 * Service oficial do dominio de simulados.
 * Orquestra a persistencia da sessao e das respostas derivadas.
 *
 * @since 1.0.0
 */
class SimulationsService
{
    /**
     * Registra dependencias do dominio de simulados.
     *
     * @since 1.0.0
     */
    public function __construct(
        private readonly SimulationsRepository $repository,
        private readonly SimulationsValidator $validator
    ) {
    }

    /**
     * Persiste o simulado do usuario autenticado e suas respostas.
     *
     * @since 1.0.0
     */
    public function saveSimulation(array $payload, array $authenticatedUserPayload): array
    {
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($authenticatedUserId === '') {
            throw new RuntimeException('Sessao invalida. Faca login novamente.');
        }

        $this->validator->ensurePayloadUserMatchesSession($payload, $authenticatedUserId);
        $normalized = $this->validator->validateSavePayload($payload);

        $config = $normalized['config'];
        $questionIds = $this->extractQuestionIds($payload['questions'] ?? []);
        if ($questionIds !== []) {
            $config['questionIds'] = $questionIds;
        }

        $simulationName = trim((string) ($config['name'] ?? 'Simulado'));
        $configJson = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($configJson === false) {
            throw new InvalidArgumentException('Nao foi possivel serializar a configuracao do simulado.');
        }

        $this->repository->upsertSimulation([
            'id' => $normalized['id'],
            'user_id' => $authenticatedUserId,
            'name' => $simulationName,
            'status' => $normalized['status'],
            'score' => $normalized['score'],
            'startTime' => $normalized['startTime'],
            'endTime' => $normalized['endTime'],
            'configJson' => $configJson,
        ]);

        $this->repository->deleteSimulationAnswers($authenticatedUserId, $normalized['id']);

        $answeredCount = 0;
        $correctCount = 0;
        foreach ($normalized['answers'] as $questionId => $answerPayload) {
            $normalizedAnswer = $this->normalizeAnswerPayload($answerPayload);
            $answeredCount++;
            if (!empty($normalizedAnswer['is_correct'])) {
                $correctCount++;
            }

            $this->repository->upsertSimulationAnswer([
                'user_id' => $authenticatedUserId,
                'question_id' => (string) $questionId,
                'simulation_id' => $normalized['id'],
                'selected_option_index' => $normalizedAnswer['selected_option_index'],
                'is_correct' => $normalizedAnswer['is_correct'],
                'time_taken_seconds' => $normalizedAnswer['time_taken_seconds'],
            ]);
        }

        $gamification = ['applied' => false, 'badge_awarded' => false, 'xp' => 0];
        if ($normalized['status'] === 'completed' && $answeredCount > 0) {
            $gamification = $this->repository->applySimulationCompletedGamification(
                $authenticatedUserId,
                $normalized['id'],
                $simulationName,
                $answeredCount,
                $correctCount
            );
        }
        $progressSnapshot = $this->repository->findUserProgressSnapshot($authenticatedUserId);

        return [
            'id' => $normalized['id'],
            'status' => $normalized['status'],
            'gamification' => $gamification,
            'new_xp' => isset($progressSnapshot['xp']) ? (int) $progressSnapshot['xp'] : null,
            'new_level' => isset($progressSnapshot['level']) ? (int) $progressSnapshot['level'] : null,
            'newXp' => isset($progressSnapshot['xp']) ? (int) $progressSnapshot['xp'] : null,
            'newLevel' => isset($progressSnapshot['level']) ? (int) $progressSnapshot['level'] : null,
        ];
    }

    /**
     * Lista o historico de simulados do usuario autenticado.
     *
     * @since 1.0.0
     */
    public function listSimulations(array $authenticatedUserPayload): array
    {
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($authenticatedUserId === '') {
            throw new RuntimeException('Sessao invalida. Faca login novamente.');
        }

        $rows = $this->repository->listSimulationsByUserId($authenticatedUserId);
        $answersBySimulation = $this->repository->listSimulationAnswersByUserId($authenticatedUserId);

        $simulations = array_map(
            static function (array $row) use ($answersBySimulation): array {
                $id = (string) ($row['id'] ?? '');
                $answers = $answersBySimulation[$id] ?? [];
                $answerQuestionIds = array_map(
                    static fn (array $answer): int => (int) ($answer['question_id'] ?? 0),
                    $answers
                );

                $answersPayload = [];
                foreach ($answers as $answer) {
                    $questionId = (string) ($answer['question_id'] ?? '');
                    if ($questionId === '') {
                        continue;
                    }

                    $answersPayload[$questionId] = [
                        'index' => isset($answer['selected_option_index']) ? (int) $answer['selected_option_index'] : null,
                        'is_correct' => (bool) ($answer['is_correct'] ?? false),
                        'time_taken' => isset($answer['time_taken_seconds']) ? (int) $answer['time_taken_seconds'] : 0,
                    ];
                }

                $config = [];
                if (!empty($row['config_json'])) {
                    $decoded = json_decode((string) $row['config_json'], true);
                    $config = is_array($decoded) ? $decoded : [];
                }
                $configQuestionIds = is_array($config['questionIds'] ?? null)
                    ? array_map('intval', $config['questionIds'])
                    : [];
                $questionIds = array_values(array_unique(array_filter(array_merge($configQuestionIds, $answerQuestionIds))));

                return [
                    'id' => $id,
                    'config' => $config,
                    'questionIds' => $questionIds,
                    'answers' => $answersPayload,
                    'startTime' => !empty($row['start_time']) ? strtotime((string) $row['start_time']) * 1000 : 0,
                    'endTime' => !empty($row['end_time']) ? strtotime((string) $row['end_time']) * 1000 : null,
                    'status' => $row['status'] ?? 'completed',
                    'score' => isset($row['score']) ? (float) $row['score'] : 0,
                ];
            },
            $rows
        );

        return [
            'simulations' => $simulations,
        ];
    }

    /**
     * Normaliza uma resposta de simulado aceita no contrato legado.
     *
     * @since 1.0.0
     */
    private function normalizeAnswerPayload(mixed $answerPayload): array
    {
        if (is_array($answerPayload)) {
            return [
                'selected_option_index' => isset($answerPayload['index']) ? (int) $answerPayload['index'] : null,
                'is_correct' => isset($answerPayload['is_correct']) ? (int) ((bool) $answerPayload['is_correct']) : 0,
                'time_taken_seconds' => isset($answerPayload['time_taken']) ? (int) $answerPayload['time_taken'] : 0,
            ];
        }

        if (is_object($answerPayload)) {
            return [
                'selected_option_index' => isset($answerPayload->index) ? (int) $answerPayload->index : null,
                'is_correct' => isset($answerPayload->is_correct) ? (int) ((bool) $answerPayload->is_correct) : 0,
                'time_taken_seconds' => isset($answerPayload->time_taken) ? (int) $answerPayload->time_taken : 0,
            ];
        }

        return [
            'selected_option_index' => $answerPayload !== null ? (int) $answerPayload : null,
            'is_correct' => 0,
            'time_taken_seconds' => 0,
        ];
    }

    /**
     * Extrai IDs de questoes do payload completo para permitir revisao posterior.
     *
     * @since 1.0.0
     */
    private function extractQuestionIds(mixed $questions): array
    {
        if (!is_array($questions)) {
            return [];
        }

        $ids = [];
        foreach ($questions as $question) {
            $id = null;
            if (is_array($question)) {
                $id = $question['id'] ?? null;
            } elseif (is_object($question)) {
                $id = $question->id ?? null;
            }

            if (is_numeric($id)) {
                $ids[] = (int) $id;
            }
        }

        return array_values(array_unique(array_filter($ids)));
    }
}
