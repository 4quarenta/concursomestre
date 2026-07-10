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
 * Validator do dominio de IA.
 * Mantem sanitizacao basica e limites do payload fora da rota.
 *
 * @since 1.0.0
 */
class AiValidator
{
    /**
     * Valida o payload oficial do gateway de IA.
     *
     * @since 1.0.0
     */
    public function validateGeneratePayload(array $payload): array
    {
        $prompt = trim((string) ($payload['prompt'] ?? ''));
        if ($prompt === '') {
            throw new InvalidArgumentException('Prompt is missing.');
        }

        if (mb_strlen($prompt) > 50000) {
            throw new InvalidArgumentException('O prompt excede o tamanho maximo permitido.');
        }

        $provider = strtolower(trim((string) ($payload['provider'] ?? '')));
        if ($provider !== '' && !in_array($provider, ['gemini', 'openai', 'auto'], true)) {
            throw new InvalidArgumentException('Provedor de IA invalido.');
        }

        $model = trim((string) ($payload['model'] ?? ''));
        if ($model !== '' && preg_match('/^[A-Za-z0-9._-]+$/', $model) !== 1) {
            throw new InvalidArgumentException('Modelo de IA invalido.');
        }

        $responseMimeType = trim((string) ($payload['responseMimeType'] ?? ''));
        if ($responseMimeType !== '' && preg_match('#^[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+$#', $responseMimeType) !== 1) {
            throw new InvalidArgumentException('responseMimeType invalido.');
        }

        $attachments = [];
        $attachmentsPayload = $payload['attachments'] ?? [];
        if ($attachmentsPayload !== null) {
            if (!is_array($attachmentsPayload)) {
                throw new InvalidArgumentException('attachments deve ser uma lista valida.');
            }

            if (count($attachmentsPayload) > 6) {
                throw new InvalidArgumentException('Quantidade de anexos acima do limite suportado.');
            }

            foreach ($attachmentsPayload as $attachment) {
                if (!is_array($attachment)) {
                    throw new InvalidArgumentException('Cada anexo deve ser um objeto valido.');
                }

                $mimeType = trim((string) ($attachment['mimeType'] ?? ''));
                $data = preg_replace('/\s+/', '', (string) ($attachment['data'] ?? '')) ?? '';

                if ($mimeType === '' || preg_match('#^[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+$#', $mimeType) !== 1) {
                    throw new InvalidArgumentException('mimeType invalido em attachments.');
                }

                if ($data === '' || preg_match('/^[A-Za-z0-9+\/=]+$/', $data) !== 1) {
                    throw new InvalidArgumentException('Conteudo base64 invalido em attachments.');
                }

                if (strlen($data) > 15 * 1024 * 1024) {
                    throw new InvalidArgumentException('Anexo excede o tamanho maximo permitido.');
                }

                $attachments[] = [
                    'mimeType' => $mimeType,
                    'data' => $data,
                ];
            }
        }

        $responseSchema = null;
        if (array_key_exists('responseSchema', $payload) && $payload['responseSchema'] !== null) {
            if (!is_array($payload['responseSchema'])) {
                throw new InvalidArgumentException('responseSchema deve ser um objeto JSON valido.');
            }

            $encodedSchema = json_encode($payload['responseSchema'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($encodedSchema === false || strlen($encodedSchema) > 40000) {
                throw new InvalidArgumentException('responseSchema excede o limite suportado.');
            }

            $responseSchema = $payload['responseSchema'];
        }

        $isAdvancedRequest = !empty($attachments)
            || $responseMimeType !== ''
            || $responseSchema !== null
            || array_key_exists('model', $payload);

        $maxOutputTokens = (int) ($payload['maxOutputTokens'] ?? 8192);
        if ($maxOutputTokens < 1024) {
            $maxOutputTokens = 1024;
        }
        if ($maxOutputTokens > 32768) {
            $maxOutputTokens = 32768;
        }

        $temperature = (float) ($payload['temperature'] ?? 0.1);
        if ($temperature < 0) {
            $temperature = 0.0;
        }
        if ($temperature > 1) {
            $temperature = 1.0;
        }

        $requestTimeoutSeconds = (int) ($payload['requestTimeoutSeconds'] ?? 0);
        if ($requestTimeoutSeconds > 0) {
            $requestTimeoutSeconds = max(30, min(300, $requestTimeoutSeconds));
        }

        return [
            'prompt' => $prompt,
            'provider' => $provider,
            'model' => $model,
            'attachments' => $attachments,
            'responseMimeType' => $responseMimeType,
            'responseSchema' => $responseSchema,
            'maxOutputTokens' => $maxOutputTokens,
            'temperature' => $temperature,
            'requestTimeoutSeconds' => $requestTimeoutSeconds,
            'isAdvancedRequest' => $isAdvancedRequest,
        ];
    }
}
