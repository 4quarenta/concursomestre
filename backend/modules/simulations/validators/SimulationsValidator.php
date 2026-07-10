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
 * Validador do dominio de simulados.
 * Normaliza o payload legado para o contrato oficial do modulo.
 *
 * @since 1.0.0
 */
class SimulationsValidator
{
    /**
     * Valida o payload da sessao de simulado e devolve estrutura normalizada.
     *
     * @since 1.0.0
     */
    public function validateSavePayload(array $payload): array
    {
        $id = trim((string) ($payload['id'] ?? ''));
        $status = trim((string) ($payload['status'] ?? ''));
        $score = $payload['score'] ?? null;
        $startTime = $payload['startTime'] ?? null;
        $endTime = $payload['endTime'] ?? null;
        $config = $payload['config'] ?? null;
        $answers = $payload['answers'] ?? [];

        if ($status === '' || !in_array($status, ['in_progress', 'completed'], true)) {
            throw new InvalidArgumentException('Status do simulado invalido.');
        }

        if (!is_numeric($score) && $score !== null) {
            throw new InvalidArgumentException('Pontuacao do simulado invalida.');
        }

        if (!is_numeric($startTime)) {
            throw new InvalidArgumentException('Horario inicial do simulado invalido.');
        }

        if ($endTime !== null && !is_numeric($endTime)) {
            throw new InvalidArgumentException('Horario final do simulado invalido.');
        }

        if (!is_array($config)) {
            throw new InvalidArgumentException('Configuracao do simulado invalida.');
        }

        if (!is_array($answers) && !is_object($answers)) {
            throw new InvalidArgumentException('Respostas do simulado invalidas.');
        }

        return [
            'id' => $id !== '' ? $id : 'sim-' . uniqid('', true),
            'status' => $status,
            'score' => $score !== null ? (float) $score : 0.0,
            'startTime' => (int) $startTime,
            'endTime' => $endTime !== null ? (int) $endTime : (int) $startTime,
            'config' => $config,
            'answers' => is_object($answers) ? get_object_vars($answers) : $answers,
        ];
    }

    /**
     * Valida se o payload nao tenta forjar outro user_id.
     *
     * @since 1.0.0
     */
    public function ensurePayloadUserMatchesSession(array $payload, string $authenticatedUserId): void
    {
        $requestedUserId = trim((string) ($payload['user_id'] ?? $payload['userId'] ?? ''));
        if ($requestedUserId !== '' && $requestedUserId !== $authenticatedUserId) {
            throw new DomainException('Nao e permitido salvar simulados para outro usuario.');
        }
    }
}
