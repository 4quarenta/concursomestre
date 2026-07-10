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
 * Validador do dominio de estatisticas.
 * Centraliza a normalizacao de filtros e URLs do raio-x da banca.
 *
 * @since 1.0.0
 */
class StatisticsValidator
{
    /**
     * Normaliza os filtros do raio-x.
     *
     * @since 1.0.0
     */
    public function validateXrayQuery(array $query): array
    {
        $banca = trim((string) ($query['banca'] ?? ''));
        $cargo = trim((string) ($query['cargo'] ?? ''));
        $ano = trim((string) ($query['ano'] ?? ''));

        if ($banca === '') {
            throw new InvalidArgumentException('Banca is required');
        }

        if ($ano === 'All') {
            $ano = '';
        }

        return [
            'banca' => $banca,
            'cargo' => $cargo !== '' ? $cargo : null,
            'ano' => $ano !== '' ? $ano : null,
        ];
    }

    /**
     * Normaliza a URL da banca e garante um formato valido para scraping.
     *
     * @since 1.0.0
     */
    public function validateBancaInfoQuery(array $query): array
    {
        $rawUrl = trim((string) ($query['url'] ?? ''));
        if ($rawUrl === '') {
            throw new InvalidArgumentException('URL is required');
        }

        $normalizedUrl = $rawUrl;
        if (!preg_match('/^https?:\/\//i', $normalizedUrl)) {
            $normalizedUrl = 'https://' . $normalizedUrl;
        }

        if (!filter_var($normalizedUrl, FILTER_VALIDATE_URL)) {
            throw new InvalidArgumentException('Invalid URL format');
        }

        $parsedUrl = parse_url($normalizedUrl);
        if (!is_array($parsedUrl) || empty($parsedUrl['scheme']) || empty($parsedUrl['host'])) {
            throw new InvalidArgumentException('Invalid URL format');
        }

        return [
            'url' => $normalizedUrl,
            'baseUrl' => $parsedUrl['scheme'] . '://' . $parsedUrl['host'],
            'host' => strtolower((string) $parsedUrl['host']),
        ];
    }

    /**
     * Valida o alvo do agregado do usuario.
     *
     * @since 1.0.0
     */
    public function validateUserStatisticsQuery(array $query): string
    {
        $userId = trim((string) ($query['user_id'] ?? $query['userId'] ?? ''));
        if ($userId === '') {
            throw new InvalidArgumentException('User ID is required');
        }

        return $userId;
    }

    /**
     * Valida o alvo do agregado da questao.
     *
     * @since 1.0.0
     */
    public function validateQuestionStatisticsQuery(array $query): int
    {
        $questionId = $query['question_id'] ?? $query['questionId'] ?? null;
        if (!is_numeric($questionId) || (int) $questionId <= 0) {
            throw new InvalidArgumentException('Valid question ID is required');
        }

        return (int) $questionId;
    }

    /**
     * Valida o payload de encerramento da sessao de estudo.
     *
     * @since 1.0.0
     */
    public function validateStudySessionPayload(array $payload): array
    {
        $practiceSeconds = max(0, (int) ($payload['practice_seconds'] ?? $payload['practiceSeconds'] ?? 0));
        $simulationSeconds = max(0, (int) ($payload['simulation_seconds'] ?? $payload['simulationSeconds'] ?? 0));
        $readingSeconds = max(0, (int) ($payload['reading_seconds'] ?? $payload['readingSeconds'] ?? 0));
        $questionSeconds = max(0, $practiceSeconds + $simulationSeconds);
        $totalSeconds = max(0, $questionSeconds + $readingSeconds);

        if ($totalSeconds <= 0) {
            throw new InvalidArgumentException('Nada para registrar na sessao de estudo.');
        }

        $sourceContext = $payload['source_context'] ?? $payload['sourceContext'] ?? [];
        if (!is_array($sourceContext)) {
            $sourceContext = [];
        }

        return [
            'practice_seconds' => $practiceSeconds,
            'simulation_seconds' => $simulationSeconds,
            'reading_seconds' => $readingSeconds,
            'question_seconds' => $questionSeconds,
            'total_seconds' => $totalSeconds,
            'started_at' => $this->normalizeOptionalDate($payload['started_at'] ?? $payload['startedAt'] ?? null, 'started_at'),
            'ended_at' => $this->normalizeOptionalDate($payload['ended_at'] ?? $payload['endedAt'] ?? null, 'ended_at') ?? date('Y-m-d H:i:s'),
            'source_context' => $sourceContext,
        ];
    }

    /**
     * Resolve se o usuario autenticado pode consultar o usuario solicitado.
     *
     * @since 1.0.0
     */
    public function resolveScopedUserId(array $authenticatedUserPayload, string $requestedUserId): string
    {
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = (($authenticatedUserPayload['role'] ?? '') === 'admin');

        if ($authenticatedUserId === '') {
            throw new RuntimeException('Sessao invalida. Faca login novamente.');
        }

        if ($requestedUserId !== $authenticatedUserId && !$isAdmin) {
            throw new DomainException('Voce nao tem permissao para consultar este usuario.');
        }

        return $requestedUserId;
    }

    /**
     * Exige contexto administrativo para indicadores globais e instalacao.
     *
     * @since 1.0.0
     */
    public function assertAdminContext(array $authenticatedUserPayload): void
    {
        if ((($authenticatedUserPayload['role'] ?? '') !== 'admin')) {
            throw new DomainException('Acesso restrito ao admin.');
        }
    }

    /**
     * Normaliza datas opcionais recebidas do frontend.
     *
     * @since 1.0.0
     */
    private function normalizeOptionalDate(mixed $value, string $fieldName): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            $date = new DateTimeImmutable((string) $value);
        } catch (Throwable) {
            throw new InvalidArgumentException("Campo {$fieldName} invalido.");
        }

        return $date->format('Y-m-d H:i:s');
    }
}
