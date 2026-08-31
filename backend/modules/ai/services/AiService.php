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

require_once __DIR__ . '/../repositories/AiRepository.php';
require_once __DIR__ . '/../validators/AiValidator.php';
require_once __DIR__ . '/../../../config/env.php';

/**
 * Service do dominio de IA.
 * Centraliza chamadas autenticadas a provedores de LLM pelo backend.
 *
 * @since 1.0.0
 */
class AiService
{
    private const PROVIDER_GEMINI = 'gemini';
    private const PROVIDER_OPENAI = 'openai';
    private const PROVIDER_AUTO = 'auto';

    private const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
    private const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

    private const GEMINI_HOST = 'generativelanguage.googleapis.com';
    private const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
    private const OPENAI_HOST = 'api.openai.com';
    private const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
    private const NETWORK_RETRY_ATTEMPTS = 2;

    private const MODEL_FALLBACKS = [
        'gemini-3.5-flash',
        'gemini-3-flash',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-flash-latest',
        'gemini-2.0-flash',
    ];

    /**
     * Inicializa o service de IA com dependencias principais.
     *
     * @since 1.0.0
     */
    public function __construct(
        private readonly AiRepository $repository,
        private readonly AiValidator $validator
    ) {
    }

    /**
     * Executa uma solicitacao de IA autenticada pelo backend.
     * Mantem compatibilidade com o fluxo legado de texto simples.
     *
     * @since 1.0.0
     */
    public function generate(array $payload)
    {
        $data = $this->validator->validateGeneratePayload($payload);
        $provider = $this->resolveProvider((string) ($data['provider'] ?? ''));
        $isAutoProvider = $provider === self::PROVIDER_AUTO;

        if ($isAutoProvider) {
            $provider = $this->resolveOpenAiApiKey() !== '' ? self::PROVIDER_OPENAI : self::PROVIDER_GEMINI;
        }

        if ($provider === self::PROVIDER_OPENAI) {
            try {
                return $this->generateWithOpenAi($data);
            } catch (RuntimeException $exception) {
                if ($isAutoProvider && $this->isOpenAiQuotaFailure($exception->getMessage()) && $this->resolveGeminiApiKey() !== '') {
                    return $this->generateWithGemini($data);
                }

                if ($this->isOpenAiQuotaFailure($exception->getMessage())) {
                    throw new RuntimeException(
                        'AI Engine Error: OpenAI sem cota ou faturamento ativo para esta chave. ' .
                        'Ative billing/quota no painel da OpenAI, use outra chave ou altere o provedor de IA para Automatico/Gemini nas configuracoes.'
                    );
                }

                throw $exception;
            }
        }

        return $this->generateWithGemini($data);
    }

    /**
     * Executa geracao com Gemini, incluindo fallback de modelo para falhas comuns.
     *
     * @since 1.0.0
     */
    private function generateWithGemini(array $data)
    {
        $apiKey = $this->resolveGeminiApiKey();

        if ($apiKey === '') {
            throw new RuntimeException('Gemini API Key nao esta configurada no painel ou .env.');
        }

        $candidateModels = $this->resolveCandidateGeminiModels((string) ($data['model'] ?? ''));
        $lastException = null;

        foreach ($candidateModels as $index => $model) {
            $attemptData = $data;
            $attemptData['model'] = $model;

            try {
                return $this->executeGeminiGenerate($apiKey, $attemptData);
            } catch (RuntimeException $exception) {
                $lastException = $exception;
                $isLastAttempt = $index === count($candidateModels) - 1;

                if ($this->isGeminiQuotaFailure($exception->getMessage())) {
                    throw $exception;
                }

                if ($isLastAttempt || !$this->isRetryableModelFailure($exception->getMessage())) {
                    throw $exception;
                }
            }
        }

        throw $lastException ?? new RuntimeException('AI Engine Error: Nao foi possivel concluir a solicitacao Gemini.');
    }

    /**
     * Executa geracao com OpenAI/ChatGPT pelo endpoint Responses.
     *
     * @since 1.0.0
     */
    private function generateWithOpenAi(array $data)
    {
        $apiKey = $this->resolveOpenAiApiKey();

        if ($apiKey === '') {
            throw new RuntimeException('OpenAI API Key nao esta configurada no painel ou .env.');
        }

        $data['model'] = $this->resolveOpenAiModel((string) ($data['model'] ?? ''));

        return $this->executeOpenAiGenerate($apiKey, $data);
    }

    /**
     * Executa uma tentativa individual de geracao Gemini.
     *
     * @since 1.0.0
     */
    private function executeGeminiGenerate(string $apiKey, array $data)
    {
        $response = $this->performGeminiRequest($apiKey, $data);
        if ($response['http_code'] >= 400) {
            throw new RuntimeException('AI Engine Error: Gemini API Error (Code ' . $response['http_code'] . '): ' . $response['body']);
        }

        $result = json_decode((string) $response['body'], true);
        if (!is_array($result)) {
            throw new RuntimeException('AI Engine Error: Resposta Gemini invalida.');
        }

        $generatedText = $this->extractGeminiGeneratedText($result);
        if ($generatedText === '') {
            throw new RuntimeException('AI Engine Error: A API nao retornou texto no formato esperado.');
        }

        if (empty($data['isAdvancedRequest'])) {
            return $generatedText;
        }

        return [
            'text' => $generatedText,
            'provider' => self::PROVIDER_GEMINI,
            'model' => (string) $data['model'],
        ];
    }

    /**
     * Executa uma tentativa individual de geracao OpenAI.
     *
     * @since 1.0.0
     */
    private function executeOpenAiGenerate(string $apiKey, array $data)
    {
        $response = $this->performOpenAiRequest($apiKey, $data);
        if ($response['http_code'] >= 400) {
            throw new RuntimeException('AI Engine Error: OpenAI API Error (Code ' . $response['http_code'] . '): ' . $response['body']);
        }

        $result = json_decode((string) $response['body'], true);
        if (!is_array($result)) {
            throw new RuntimeException('AI Engine Error: Resposta OpenAI invalida.');
        }

        $generatedText = $this->extractOpenAiGeneratedText($result);
        if ($generatedText === '') {
            throw new RuntimeException('AI Engine Error: A OpenAI nao retornou texto no formato esperado.');
        }

        if (empty($data['isAdvancedRequest'])) {
            return $generatedText;
        }

        return [
            'text' => $generatedText,
            'provider' => self::PROVIDER_OPENAI,
            'model' => (string) $data['model'],
        ];
    }

    /**
     * Resolve qual provedor sera usado na chamada atual.
     *
     * @since 1.0.0
     */
    private function resolveProvider(string $requestedProvider): string
    {
        $provider = strtolower(trim($requestedProvider));
        if ($provider === '') {
            $provider = strtolower(trim((string) ($this->repository->findAiProvider() ?? '')));
        }
        if ($provider === '') {
            $provider = strtolower(trim((string) ($_ENV['AI_PROVIDER'] ?? getenv('AI_PROVIDER') ?? '')));
        }

        return in_array($provider, [self::PROVIDER_GEMINI, self::PROVIDER_OPENAI, self::PROVIDER_AUTO], true)
            ? $provider
            : self::PROVIDER_GEMINI;
    }

    /**
     * Monta a sequencia de modelos candidatos para cada tentativa Gemini.
     *
     * @since 1.0.0
     */
    private function resolveCandidateGeminiModels(string $requestedModel): array
    {
        $configuredModel = trim((string) ($this->repository->findGeminiModel() ?? ''));
        $environmentModel = trim((string) ($_ENV['GEMINI_MODEL'] ?? getenv('GEMINI_MODEL') ?? ''));
        $primaryModel = trim($requestedModel) !== ''
            ? trim($requestedModel)
            : ($configuredModel !== '' ? $configuredModel : ($environmentModel !== '' ? $environmentModel : self::DEFAULT_GEMINI_MODEL));

        return array_values(array_unique(array_filter([
            $primaryModel,
            ...self::MODEL_FALLBACKS,
        ], static fn ($model) => is_string($model) && trim($model) !== '')));
    }

    /**
     * Decide se vale tentar outro modelo apos uma falha conhecida.
     *
     * @since 1.0.0
     */
    private function isRetryableModelFailure(string $message): bool
    {
        $normalized = strtolower($message);

        return str_contains($normalized, 'code 503')
            || str_contains($normalized, '"status": "unavailable"')
            || str_contains($normalized, 'currently experiencing high demand')
            || str_contains($normalized, 'code 404')
            || str_contains($normalized, '"status": "not_found"');
    }

    /**
     * Detecta falhas de quota/rate-limit do Gemini. Nesses casos nao tentamos
     * outros modelos para evitar consumo extra e diagnósticos falsos.
     *
     * @since 1.0.0
     */
    private function isGeminiQuotaFailure(string $message): bool
    {
        $normalized = strtolower($message);

        return str_contains($normalized, 'code 429')
            || str_contains($normalized, 'resource_exhausted')
            || str_contains($normalized, 'quota exceeded')
            || str_contains($normalized, 'free_tier')
            || str_contains($normalized, 'rate limit');
    }

    /**
     * Detecta erro de conta/cota da OpenAI para devolver uma mensagem acionavel.
     */
    private function isOpenAiQuotaFailure(string $message): bool
    {
        $normalized = strtolower($message);

        return str_contains($normalized, 'insufficient_quota')
            || str_contains($normalized, 'exceeded your current quota')
            || str_contains($normalized, 'check your plan and billing')
            || str_contains($normalized, '"code": "insufficient_quota"');
    }

    /**
     * Resolve a chave Gemini pelo banco ou por variavel de ambiente.
     *
     * @since 1.0.0
     */
    private function resolveGeminiApiKey(): string
    {
        $configured = $this->repository->findGeminiApiKey();
        if (is_string($configured) && trim($configured) !== '') {
            return trim($configured);
        }

        return trim((string) ($_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?? ''));
    }

    /**
     * Resolve a chave OpenAI pelo banco ou por variavel de ambiente.
     *
     * @since 1.0.0
     */
    private function resolveOpenAiApiKey(): string
    {
        $configured = $this->repository->findOpenAiApiKey();
        if (is_string($configured) && trim($configured) !== '') {
            return trim($configured);
        }

        return trim((string) ($_ENV['OPENAI_API_KEY'] ?? getenv('OPENAI_API_KEY') ?? ''));
    }

    /**
     * Resolve o modelo OpenAI. Modelos Gemini enviados por chamadas antigas sao ignorados.
     *
     * @since 1.0.0
     */
    private function resolveOpenAiModel(string $requestedModel): string
    {
        $configured = trim((string) ($this->repository->findOpenAiModel() ?? ''));
        if ($configured !== '') {
            return $configured;
        }

        $envModel = trim((string) ($_ENV['OPENAI_MODEL'] ?? getenv('OPENAI_MODEL') ?? ''));
        if ($envModel !== '') {
            return $envModel;
        }

        $requestedModel = trim($requestedModel);
        if ($requestedModel !== '' && !str_starts_with(strtolower($requestedModel), 'gemini')) {
            return $requestedModel;
        }

        return self::DEFAULT_OPENAI_MODEL;
    }

    /**
     * Executa a chamada HTTP ao Gemini mantendo o payload centralizado.
     *
     * @since 1.0.0
     */
    private function performGeminiRequest(string $apiKey, array $data): array
    {
        $url = $this->resolveGeminiBaseUrl()
            . rawurlencode((string) $data['model'])
            . ':generateContent?key='
            . rawurlencode($apiKey);

        $parts = [];
        foreach ($data['attachments'] as $attachment) {
            $parts[] = [
                'inlineData' => [
                    'mimeType' => $attachment['mimeType'],
                    'data' => $attachment['data'],
                ],
            ];
        }

        $parts[] = [
            'text' => (string) $data['prompt'],
        ];

        $generationConfig = [
            'temperature' => (float) ($data['temperature'] ?? 0.1),
            'maxOutputTokens' => (int) ($data['maxOutputTokens'] ?? 8192),
        ];

        if (!empty($data['responseMimeType'])) {
            $generationConfig['responseMimeType'] = $data['responseMimeType'];
        }

        if (!empty($data['responseSchema'])) {
            $generationConfig['responseSchema'] = $data['responseSchema'];
        }

        $payload = [
            'contents' => [[
                'role' => 'user',
                'parts' => $parts,
            ]],
            'generationConfig' => $generationConfig,
        ];

        return $this->performJsonPostRequest(
            $url,
            $payload,
            ['Content-Type: application/json'],
            self::GEMINI_HOST,
            'Gemini',
            'Verifique DNS da VPS/XAMPP, firewall/antivirus, proxy corporativo e liberacao de saida HTTPS para a Google Generative Language API.',
            $this->resolveRequestTimeoutSeconds($data)
        );
    }

    /**
     * Executa a chamada HTTP ao OpenAI Responses API.
     *
     * @since 1.0.0
     */
    private function performOpenAiRequest(string $apiKey, array $data): array
    {
        $payload = [
            'model' => (string) $data['model'],
            'input' => $this->buildOpenAiInput($data),
            'max_output_tokens' => (int) ($data['maxOutputTokens'] ?? 8192),
        ];

        $format = $this->buildOpenAiTextFormat($data);
        if ($format !== null) {
            $payload['text'] = [
                'format' => $format,
            ];
        }

        return $this->performJsonPostRequest(
            $this->resolveOpenAiResponsesUrl(),
            $payload,
            [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ],
            self::OPENAI_HOST,
            'OpenAI',
            'Verifique DNS da VPS/XAMPP, firewall/antivirus, proxy corporativo e liberacao de saida HTTPS para a OpenAI API.',
            $this->resolveRequestTimeoutSeconds($data)
        );
    }

    /**
     * Monta input OpenAI com suporte a texto, imagem e PDF enviados pelo gateway.
     *
     * @since 1.0.0
     */
    private function buildOpenAiInput(array $data)
    {
        $attachments = $data['attachments'] ?? [];
        if (empty($attachments)) {
            return (string) $data['prompt'];
        }

        $content = [];
        foreach ($attachments as $index => $attachment) {
            $mimeType = (string) ($attachment['mimeType'] ?? '');
            $base64 = (string) ($attachment['data'] ?? '');
            $dataUrl = 'data:' . $mimeType . ';base64,' . $base64;

            if (str_starts_with($mimeType, 'image/')) {
                $content[] = [
                    'type' => 'input_image',
                    'image_url' => $dataUrl,
                ];
                continue;
            }

            if ($mimeType === 'application/pdf') {
                $content[] = [
                    'type' => 'input_file',
                    'filename' => 'attachment-' . ($index + 1) . '.pdf',
                    'file_data' => $dataUrl,
                ];
                continue;
            }
        }

        $content[] = [
            'type' => 'input_text',
            'text' => (string) $data['prompt'],
        ];

        return [[
            'role' => 'user',
            'content' => $content,
        ]];
    }

    /**
     * Converte o contrato JSON usado pelo Gemini para o formato aceito pela OpenAI.
     *
     * @since 1.0.0
     */
    private function buildOpenAiTextFormat(array $data): ?array
    {
        $responseSchema = $data['responseSchema'] ?? null;
        if (is_array($responseSchema)) {
            return [
                'type' => 'json_schema',
                'name' => 'concursomestre_response',
                'schema' => $this->normalizeResponseSchemaForOpenAi($responseSchema),
                'strict' => false,
            ];
        }

        if (($data['responseMimeType'] ?? '') === 'application/json') {
            return [
                'type' => 'json_object',
            ];
        }

        return null;
    }

    /**
     * Normaliza schemas Gemini, que usam tipos em maiusculo, para JSON Schema padrao.
     *
     * @since 1.0.0
     */
    private function normalizeResponseSchemaForOpenAi(array $schema): array
    {
        $normalized = [];

        foreach ($schema as $key => $value) {
            if ($key === 'type' && is_string($value)) {
                $normalized[$key] = strtolower($value);
                continue;
            }

            if ($key === 'properties' && is_array($value)) {
                $properties = [];
                foreach ($value as $propertyKey => $propertySchema) {
                    if (is_array($propertySchema)) {
                        $properties[$propertyKey] = $this->normalizeResponseSchemaForOpenAi($propertySchema);
                    }
                }
                $normalized[$key] = $properties;
                continue;
            }

            if ($key === 'items' && is_array($value)) {
                $normalized[$key] = $this->normalizeResponseSchemaForOpenAi($value);
                continue;
            }

            if (is_array($value)) {
                $normalized[$key] = $this->normalizeNestedSchemaValue($value);
                continue;
            }

            $normalized[$key] = $value;
        }

        if (empty($normalized['type'])) {
            $normalized['type'] = 'object';
        }

        return $normalized;
    }

    private function normalizeNestedSchemaValue(array $value): array
    {
        $isList = array_keys($value) === range(0, count($value) - 1);
        if ($isList) {
            return array_map(function ($item) {
                return is_array($item) ? $this->normalizeNestedSchemaValue($item) : $item;
            }, $value);
        }

        return $this->normalizeResponseSchemaForOpenAi($value);
    }

    /**
     * Executa um POST JSON com retry basico de rede.
     *
     * @since 1.0.0
     */
    private function performJsonPostRequest(
        string $url,
        array $payload,
        array $headers,
        string $host,
        string $providerLabel,
        string $hint,
        int $timeoutSeconds = 90
    ): array
    {
        $encodedPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encodedPayload)) {
            throw new RuntimeException("AI Engine Error: Nao foi possivel serializar o payload {$providerLabel}.");
        }

        $timeoutSeconds = max(30, min(300, $timeoutSeconds));
        $body = false;
        $httpCode = 0;
        $lastCurlError = '';
        $lastCurlErrno = 0;

        for ($attempt = 1; $attempt <= self::NETWORK_RETRY_ATTEMPTS; $attempt++) {
            @set_time_limit(max(120, $timeoutSeconds + 45));
            $curl = curl_init($url);
            curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($curl, CURLOPT_POST, true);
            curl_setopt($curl, CURLOPT_CONNECTTIMEOUT, 12);
            curl_setopt($curl, CURLOPT_TIMEOUT, $timeoutSeconds);
            curl_setopt($curl, CURLOPT_DNS_CACHE_TIMEOUT, 60);
            curl_setopt($curl, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
            curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($curl, CURLOPT_POSTFIELDS, $encodedPayload);

            $body = curl_exec($curl);
            $lastCurlErrno = (int) curl_errno($curl);
            $lastCurlError = (string) curl_error($curl);
            $httpCode = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);

            if ($body !== false) {
                break;
            }

            if (!$this->isRetryableNetworkError($lastCurlErrno, $lastCurlError) || $attempt >= self::NETWORK_RETRY_ATTEMPTS) {
                break;
            }

            usleep(250000 * $attempt);
        }

        if ($body === false) {
            throw new RuntimeException($this->buildProviderConnectionErrorMessage($providerLabel, $host, $lastCurlErrno, $lastCurlError, $hint));
        }

        return [
            'http_code' => $httpCode,
            'body' => (string) $body,
        ];
    }

    private function resolveRequestTimeoutSeconds(array $data): int
    {
        $configured = (int) ($data['requestTimeoutSeconds'] ?? 0);
        if ($configured > 0) {
            return max(30, min(300, $configured));
        }

        $maxOutputTokens = (int) ($data['maxOutputTokens'] ?? 8192);
        if ($maxOutputTokens >= 24000) {
            return 180;
        }

        if ($maxOutputTokens >= 12000) {
            return 150;
        }

        return 90;
    }

    /**
     * Permite trocar a base da API Gemini em ambiente controlado.
     */
    private function resolveGeminiBaseUrl(): string
    {
        $configured = trim((string) ($_ENV['GEMINI_API_BASE_URL'] ?? getenv('GEMINI_API_BASE_URL') ?? ''));
        if ($configured === '') {
            return self::GEMINI_BASE_URL;
        }

        return rtrim($configured, '/') . '/';
    }

    /**
     * Permite trocar a base da API OpenAI em ambiente controlado.
     */
    private function resolveOpenAiResponsesUrl(): string
    {
        $configured = trim((string) ($_ENV['OPENAI_RESPONSES_URL'] ?? getenv('OPENAI_RESPONSES_URL') ?? ''));
        if ($configured === '') {
            return self::OPENAI_RESPONSES_URL;
        }

        return $configured;
    }

    /**
     * Falhas de DNS/conexao podem ocorrer no XAMPP/Windows mesmo com a rede ativa.
     * Retentar uma vez reduz ruido sem esconder problemas reais de configuracao.
     */
    private function isRetryableNetworkError(int $errno, string $error): bool
    {
        $normalized = strtolower($error);

        return in_array($errno, [6, 7, 28, 35, 52, 56], true)
            || str_contains($normalized, 'could not resolve host')
            || str_contains($normalized, 'couldn\'t resolve host')
            || str_contains($normalized, 'failed to connect')
            || str_contains($normalized, 'operation timed out')
            || str_contains($normalized, 'timeout');
    }

    private function buildProviderConnectionErrorMessage(string $providerLabel, string $host, int $errno, string $error, string $hint): string
    {
        $resolvedIp = gethostbyname($host);
        $dnsStatus = ($resolvedIp !== $host && trim($resolvedIp) !== '')
            ? "DNS local resolveu {$host} para {$resolvedIp}, mas a conexao cURL falhou."
            : "O PHP/cURL nao conseguiu resolver {$host}.";

        return trim("AI Engine Error: {$providerLabel} indisponivel por falha de rede. {$dnsStatus} cURL {$errno}: {$error}. {$hint}");
    }

    /**
     * Extrai o texto final da resposta Gemini.
     *
     * @since 1.0.0
     */
    private function extractGeminiGeneratedText(array $result): string
    {
        $parts = $result['candidates'][0]['content']['parts'] ?? [];
        if (!is_array($parts)) {
            return '';
        }

        $chunks = [];
        foreach ($parts as $part) {
            if (is_array($part) && isset($part['text']) && is_string($part['text'])) {
                $chunks[] = $part['text'];
            }
        }

        return trim(implode("\n", $chunks));
    }

    /**
     * Extrai o texto final da resposta OpenAI.
     *
     * @since 1.0.0
     */
    private function extractOpenAiGeneratedText(array $result): string
    {
        if (isset($result['output_text']) && is_string($result['output_text'])) {
            return trim($result['output_text']);
        }

        $chunks = [];
        $output = $result['output'] ?? [];
        if (is_array($output)) {
            foreach ($output as $outputItem) {
                if (!is_array($outputItem)) {
                    continue;
                }

                $content = $outputItem['content'] ?? [];
                if (!is_array($content)) {
                    continue;
                }

                foreach ($content as $contentItem) {
                    if (!is_array($contentItem)) {
                        continue;
                    }

                    if (isset($contentItem['text']) && is_string($contentItem['text'])) {
                        $chunks[] = $contentItem['text'];
                    }
                }
            }
        }

        return trim(implode("\n", $chunks));
    }
}
