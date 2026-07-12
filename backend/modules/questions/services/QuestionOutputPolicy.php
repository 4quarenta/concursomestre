<?php

declare(strict_types=1);

/**
 * Aplica a fronteira entre o registro canônico da questão e cada resposta de
 * leitura. A política é deliberadamente executada no fim da serialização para
 * impedir que aliases legados ou campos novos revelem gabarito/editorial por
 * engano em endpoints públicos.
 */
final class QuestionOutputPolicy
{
    /** @var list<string> */
    private const ANSWER_KEY_FIELDS = [
        'answer',
        'resposta',
        'correct',
        'answerCorrect',
        'answer_correct',
        'correctOptionIndex',
        'correct_option_index',
        'resposta_correta_item_index',
        'correctAlternativeId',
        'correct_alternative_id',
        'correctAlternativeTempIds',
        'correct_alternative_temp_ids',
        'is_correct',
        'isCorrect',
    ];

    /** @var list<string> */
    private const RAW_INTERNAL_FIELDS = [
        'data_json',
        'dataJson',
        'raw_json',
        'rawJson',
    ];

    /** @var list<string> */
    private const TEACHER_EDITORIAL_FIELDS = [
        'teacherComment',
        'teacher_comment',
        'comentarioProfessor',
    ];

    /** @var list<string> */
    private const DETAILED_EDITORIAL_FIELDS = [
        'detailedComment',
        'detailed_comment',
        'analiseDetalhada',
    ];

    /** @var list<string> */
    private const EDITORIAL_COLLECTION_FIELDS = [
        'editorial',
        'questionEditorials',
        'question_editorials',
        'editorialComments',
    ];

    /**
     * @param array<string, mixed> $question
     * @return array<string, mixed>
     */
    public function forRead(
        array $question,
        bool $includeAnswerKey,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis
    ): array {
        return $this->sanitizeValue(
            $question,
            $includeAnswerKey,
            $canViewTeacherComments,
            $canViewDetailedAnalysis
        );
    }

    /**
     * Remove informacoes internas em qualquer profundidade da resposta. Isso
     * cobre contratos legados, agregados canonicos e futuros objetos aninhados
     * sem depender de o chamador lembrar cada alias manualmente.
     *
     * @return array<string|int, mixed>
     */
    private function sanitizeValue(
        array $value,
        bool $includeAnswerKey,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis
    ): array {
        $sanitized = [];

        foreach ($value as $key => $item) {
            if (!is_string($key)) {
                $sanitized[$key] = is_array($item)
                    ? $this->sanitizeValue($item, $includeAnswerKey, $canViewTeacherComments, $canViewDetailedAnalysis)
                    : $item;
                continue;
            }

            if ($this->matchesField($key, self::RAW_INTERNAL_FIELDS)) {
                continue;
            }

            if (!$includeAnswerKey && $this->matchesField($key, self::ANSWER_KEY_FIELDS)) {
                continue;
            }

            if (!$canViewTeacherComments && $this->matchesField($key, self::TEACHER_EDITORIAL_FIELDS)) {
                continue;
            }

            if (!$canViewDetailedAnalysis && $this->matchesField($key, self::DETAILED_EDITORIAL_FIELDS)) {
                continue;
            }

            if ($this->matchesField($key, self::EDITORIAL_COLLECTION_FIELDS)) {
                $editorials = $this->sanitizeEditorialCollection(
                    $item,
                    $includeAnswerKey,
                    $canViewTeacherComments,
                    $canViewDetailedAnalysis
                );
                if ($editorials !== []) {
                    $sanitized[$key] = $editorials;
                }
                continue;
            }

            $sanitized[$key] = is_array($item)
                ? $this->sanitizeValue($item, $includeAnswerKey, $canViewTeacherComments, $canViewDetailedAnalysis)
                : $item;
        }

        return $sanitized;
    }

    /**
     * @return list<array<string|int, mixed>>
     */
    private function sanitizeEditorialCollection(
        mixed $value,
        bool $includeAnswerKey,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis
    ): array {
        if (!is_array($value)) {
            return [];
        }

        $visible = [];
        foreach ($value as $editorial) {
            if (!is_array($editorial)) {
                continue;
            }

            $type = strtolower(trim((string) ($editorial['type'] ?? '')));
            if ($type === 'teacher_comment' && !$canViewTeacherComments) {
                continue;
            }
            if ($type === 'detailed_analysis' && !$canViewDetailedAnalysis) {
                continue;
            }
            if (!in_array($type, ['teacher_comment', 'detailed_analysis'], true)) {
                continue;
            }

            $visible[] = $this->sanitizeValue(
                $editorial,
                $includeAnswerKey,
                $canViewTeacherComments,
                $canViewDetailedAnalysis
            );
        }

        return $visible;
    }

    /**
     * @param list<string> $fields
     */
    private function matchesField(string $candidate, array $fields): bool
    {
        $candidate = strtolower($candidate);
        foreach ($fields as $field) {
            if ($candidate === strtolower($field)) {
                return true;
            }
        }

        return false;
    }
}
