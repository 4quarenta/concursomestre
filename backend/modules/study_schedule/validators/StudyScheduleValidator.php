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
 * Valida e normaliza o snapshot do cronograma salvo pelo aluno.
 *
 * @since 1.0.0
 */
class StudyScheduleValidator
{
    private const MAX_FORM_BYTES = 40000;
    private const MAX_PLAN_BYTES = 250000;
    private const MAX_STRING_LENGTH = 5000;
    private const MAX_ARRAY_ITEMS = 500;
    private const MAX_DEPTH = 8;

    /**
     * Normaliza o payload de salvamento do cronograma.
     *
     * @since 1.0.0
     */
    public function validateSavePayload(array $payload): array
    {
        $form = $payload['form'] ?? null;
        if (!is_array($form)) {
            throw new InvalidArgumentException('Informe os dados do formulario do cronograma.');
        }

        $generatedPlan = $payload['generatedPlan'] ?? $payload['generated_plan'] ?? null;
        if ($generatedPlan !== null && !is_array($generatedPlan)) {
            throw new InvalidArgumentException('O plano gerado precisa ser um objeto valido.');
        }

        $normalizedForm = $this->sanitizeValue($form);
        if (!is_array($normalizedForm)) {
            throw new InvalidArgumentException('Formulario do cronograma invalido.');
        }

        $normalizedPlan = null;
        if ($generatedPlan !== null) {
            $normalizedPlan = $this->sanitizeValue($generatedPlan);
            if (!is_array($normalizedPlan)) {
                throw new InvalidArgumentException('Plano gerado invalido.');
            }
        }

        $this->assertJsonSize($normalizedForm, self::MAX_FORM_BYTES, 'formulario');
        if ($normalizedPlan !== null) {
            $this->assertJsonSize($normalizedPlan, self::MAX_PLAN_BYTES, 'plano gerado');
        }

        return [
            'form' => $normalizedForm,
            'generated_plan' => $normalizedPlan,
            'generated_at' => $this->normalizeDateTime($payload['generatedAt'] ?? $payload['generated_at'] ?? null),
        ];
    }

    /**
     * Remove tags, caracteres de controle e limites perigosos de profundidade/tamanho.
     *
     * @since 1.0.0
     */
    private function sanitizeValue($value, int $depth = 0)
    {
        if ($depth > self::MAX_DEPTH) {
            return null;
        }

        if (is_string($value)) {
            $clean = strip_tags($value);
            $clean = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $clean);
            $clean = trim($clean);

            if (function_exists('mb_substr')) {
                return mb_substr($clean, 0, self::MAX_STRING_LENGTH, 'UTF-8');
            }

            return substr($clean, 0, self::MAX_STRING_LENGTH);
        }

        if (is_bool($value) || is_int($value) || is_float($value) || $value === null) {
            return $value;
        }

        if (is_array($value)) {
            $normalized = [];
            $count = 0;

            foreach ($value as $key => $item) {
                if ($count >= self::MAX_ARRAY_ITEMS) {
                    break;
                }

                $normalizedKey = is_int($key)
                    ? $key
                    : preg_replace('/[^a-zA-Z0-9_\-]/', '', (string) $key);

                if ($normalizedKey === '') {
                    continue;
                }

                $normalized[$normalizedKey] = $this->sanitizeValue($item, $depth + 1);
                $count++;
            }

            return $normalized;
        }

        return null;
    }

    /**
     * Garante que o snapshot nao vai virar armazenamento sem limite.
     *
     * @since 1.0.0
     */
    private function assertJsonSize(array $value, int $maxBytes, string $label): void
    {
        $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            throw new InvalidArgumentException('Nao foi possivel serializar o ' . $label . '.');
        }

        if (strlen($encoded) > $maxBytes) {
            throw new InvalidArgumentException('O ' . $label . ' excede o tamanho permitido.');
        }
    }

    /**
     * Normaliza datas ISO vindas do frontend para MySQL.
     *
     * @since 1.0.0
     */
    private function normalizeDateTime($value): ?string
    {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '') {
            return null;
        }

        $timestamp = strtotime($raw);
        if ($timestamp === false) {
            return null;
        }

        return gmdate('Y-m-d H:i:s', $timestamp);
    }
}
