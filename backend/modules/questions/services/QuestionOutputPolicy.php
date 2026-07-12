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
        'correctOptionIndex',
        'correct_option_index',
        'resposta_correta_item_index',
        'is_correct',
        'isCorrect',
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
        if (!$includeAnswerKey) {
            foreach (self::ANSWER_KEY_FIELDS as $field) {
                unset($question[$field]);
            }
        }

        foreach (self::TEACHER_EDITORIAL_FIELDS as $field) {
            if (!$canViewTeacherComments) {
                unset($question[$field]);
            }
        }

        foreach (self::DETAILED_EDITORIAL_FIELDS as $field) {
            if (!$canViewDetailedAnalysis) {
                unset($question[$field]);
            }
        }

        if (!isset($question['editorial']) || !is_array($question['editorial'])) {
            unset($question['editorial']);
            return $question;
        }

        $visibleEditorials = [];
        foreach ($question['editorial'] as $editorial) {
            if (!is_array($editorial)) {
                continue;
            }

            $type = (string) ($editorial['type'] ?? '');
            if ($type === 'teacher_comment' && $canViewTeacherComments) {
                $visibleEditorials[] = $editorial;
            }
            if ($type === 'detailed_analysis' && $canViewDetailedAnalysis) {
                $visibleEditorials[] = $editorial;
            }
        }

        if ($visibleEditorials === []) {
            unset($question['editorial']);
        } else {
            $question['editorial'] = $visibleEditorials;
        }

        return $question;
    }
}
