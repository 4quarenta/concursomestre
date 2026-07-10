<?php

/**
 * Catalogo central de motivos e acoes contextuais da moderacao.
 *
 * O catalogo aceita rotulos legados, mas sempre devolve um slug estavel.
 */
final class ReportReasonCatalog
{
    private const LEGACY_ALIASES = [
        'gabarito errado' => 'wrong_answer',
        'gabarito incorreto' => 'wrong_answer',
        'erro de digitacao' => 'wrong_statement',
        'enunciado incorreto' => 'wrong_statement',
        'problema de formatacao' => 'formatting',
        'erro de formatacao' => 'formatting',
        'materia incorreta' => 'wrong_classification',
        'classificacao incorreta' => 'wrong_classification',
        'desatualizada anulada' => 'outdated_or_annulled',
        'questao desatualizada' => 'outdated_or_annulled',
        'imagem com erro' => 'media_problem',
        'imagem ou midia com problema' => 'media_problem',
        'texto legal incorreto' => 'wrong_legal_text',
        'comentario do professor incorreto' => 'wrong_teacher_comment',
        'doutrina incorreta' => 'wrong_doctrine',
        'jurisprudencia ou sumula incorreta' => 'wrong_precedent',
        'conteudo desatualizado' => 'outdated_content',
        'solicitar aprofundamento' => 'request_deepening',
        'solicitar comentario' => 'request_comment',
        'solicitar comentario do professor' => 'request_comment',
        'gerar comentario' => 'request_comment',
        'complementar comentario existente' => 'request_comment_complement',
        'gerar exemplo pratico' => 'request_practical_example',
        'gerar macete' => 'request_exam_tip',
        'gerar resumo' => 'request_summary',
        'gerar jurisprudencia relacionada' => 'request_precedent',
        'gerar doutrina relacionada' => 'request_doctrine',
        'informacao incorreta' => 'incorrect_information',
        'conteudo incompleto' => 'incomplete_content',
        'fora do contexto' => 'out_of_context',
        'linguagem inadequada' => 'inappropriate_language',
        'spam ou publicidade' => 'spam',
        'revisao do professor' => 'teacher_review',
        'solicitar revisao do professor' => 'teacher_review',
        'outro' => 'other',
    ];

    private const QUESTION_ACTIONS = [
        'wrong_answer' => [
            'change_question_answer',
            'annul_question',
            'keep_current_content',
            'request_more_information',
            'forward_to_teacher',
            'reject_report',
        ],
        'wrong_statement' => [
            'edit_question_statement',
            'keep_current_content',
            'request_more_information',
            'forward_to_teacher',
            'reject_report',
        ],
        'formatting' => [
            'fix_question_formatting',
            'edit_question_statement',
            'keep_current_content',
            'forward_to_teacher',
            'reject_report',
        ],
        'wrong_classification' => [
            'update_question_classification',
            'keep_current_content',
            'forward_to_teacher',
            'reject_report',
        ],
        'outdated_or_annulled' => [
            'edit_question_statement',
            'change_question_answer',
            'annul_question',
            'mark_question_outdated',
            'archive_question',
            'keep_current_content',
            'forward_to_teacher',
        ],
        'media_problem' => [
            'replace_question_media',
            'remove_question_media',
            'keep_current_content',
            'forward_to_teacher',
        ],
        'request_comment' => [
            'create_new_comment',
            'replace_existing_comment',
            'append_existing_comment',
            'keep_current_content',
            'forward_to_teacher',
            'reject_request',
        ],
    ];

    private const LAW_ACTIONS = [
        'wrong_legal_text' => [
            'update_legal_text',
            'edit_legal_text',
            'keep_current_content',
            'forward_to_legal_review',
            'reject_report',
        ],
        'wrong_teacher_comment' => [
            'replace_existing_comment',
            'append_existing_comment',
            'remove_comment',
            'keep_current_content',
            'forward_to_teacher',
        ],
        'wrong_doctrine' => [
            'append_existing_comment',
            'keep_current_content',
            'forward_to_legal_review',
        ],
        'wrong_precedent' => [
            'append_existing_comment',
            'keep_current_content',
            'forward_to_legal_review',
        ],
        'outdated_content' => [
            'update_legal_text',
            'edit_legal_text',
            'keep_current_content',
            'forward_to_legal_review',
        ],
        'formatting' => [
            'fix_legal_formatting',
            'edit_legal_text',
            'keep_current_content',
            'forward_to_legal_review',
        ],
        'request_deepening' => [
            'append_existing_comment',
            'forward_to_teacher',
            'keep_current_content',
            'reject_request',
        ],
        'request_comment' => [
            'create_new_comment',
            'replace_existing_comment',
            'append_existing_comment',
            'keep_current_content',
            'forward_to_teacher',
            'reject_request',
        ],
        'request_comment_complement' => [
            'append_existing_comment',
            'replace_existing_comment',
            'keep_current_content',
            'forward_to_teacher',
            'reject_request',
        ],
        'request_practical_example' => [
            'append_existing_comment',
            'forward_to_teacher',
            'reject_request',
        ],
        'request_exam_tip' => [
            'append_existing_comment',
            'forward_to_teacher',
            'reject_request',
        ],
        'request_summary' => [
            'append_existing_comment',
            'forward_to_teacher',
            'reject_request',
        ],
        'request_precedent' => [
            'append_existing_comment',
            'forward_to_legal_review',
            'reject_request',
        ],
        'request_doctrine' => [
            'append_existing_comment',
            'forward_to_legal_review',
            'reject_request',
        ],
    ];

    private const COMMENT_ACTIONS = [
        'incorrect_information' => [
            'edit_comment',
            'hide_comment',
            'remove_comment',
            'keep_current_content',
            'forward_to_teacher',
        ],
        'incomplete_content' => [
            'edit_comment',
            'append_existing_comment',
            'keep_current_content',
            'forward_to_teacher',
        ],
        'out_of_context' => [
            'edit_comment',
            'hide_comment',
            'remove_comment',
            'keep_current_content',
        ],
        'inappropriate_language' => [
            'edit_comment',
            'hide_comment',
            'remove_comment',
            'warn_user',
            'keep_current_content',
        ],
        'spam' => [
            'mark_comment_spam',
            'remove_comment',
            'warn_user',
            'keep_current_content',
        ],
        'teacher_review' => [
            'forward_to_teacher',
            'keep_current_content',
            'remove_comment',
        ],
    ];

    public static function normalizeReasonSlug(string $reason, ?string $storedSlug = null): string
    {
        $stored = self::slugify((string) $storedSlug);
        if ($stored !== '' && self::isKnownSlug($stored)) {
            return $stored;
        }

        $normalized = self::normalizeLabel($reason);
        if (isset(self::LEGACY_ALIASES[$normalized])) {
            return self::LEGACY_ALIASES[$normalized];
        }

        foreach (self::LEGACY_ALIASES as $label => $slug) {
            if ($label !== '' && str_contains($normalized, $label)) {
                return $slug;
            }
        }

        return 'other';
    }

    public static function reportTypeForReason(string $reasonSlug): string
    {
        return str_starts_with($reasonSlug, 'request_') ? 'request' : 'error';
    }

    public static function allowedActions(string $targetType, string $reasonSlug): array
    {
        $catalog = match ($targetType) {
            'question' => self::QUESTION_ACTIONS,
            'law_section' => self::LAW_ACTIONS,
            'comment' => self::COMMENT_ACTIONS,
            default => [],
        };

        return $catalog[$reasonSlug] ?? [
            'keep_current_content',
            'request_more_information',
            'forward_to_manual_review',
            'reject_report',
        ];
    }

    public static function title(string $targetType, string $reasonSlug): string
    {
        if (str_starts_with($reasonSlug, 'request_')) {
            return match ($reasonSlug) {
                'request_comment', 'request_comment_complement' => 'Solicitação de comentário',
                'request_deepening' => 'Solicitação de aprofundamento',
                'request_exam_tip' => 'Solicitação de macete',
                'request_precedent' => 'Solicitação de jurisprudência relacionada',
                'request_doctrine' => 'Solicitação de doutrina relacionada',
                default => 'Analisar solicitação editorial',
            };
        }

        return match ($reasonSlug) {
            'wrong_answer' => 'Revisar gabarito da questão',
            'wrong_statement' => 'Revisar enunciado da questão',
            'formatting' => 'Corrigir formatação do conteúdo',
            'wrong_classification' => 'Revisar classificação da questão',
            'outdated_or_annulled' => 'Revisar atualização da questão',
            'media_problem' => 'Revisar imagem ou mídia',
            'wrong_legal_text' => 'Revisar texto legal',
            'wrong_teacher_comment' => 'Revisar comentário do professor',
            'wrong_doctrine' => 'Revisar doutrina',
            'wrong_precedent' => 'Revisar jurisprudência ou súmula',
            'spam' => 'Revisar comentário denunciado',
            default => 'Analisar apontamento',
        };
    }

    public static function isActionAllowed(string $targetType, string $reasonSlug, string $actionSlug): bool
    {
        return in_array($actionSlug, self::allowedActions($targetType, $reasonSlug), true);
    }

    private static function isKnownSlug(string $slug): bool
    {
        return in_array($slug, array_values(self::LEGACY_ALIASES), true);
    }

    private static function normalizeLabel(string $value): string
    {
        $value = trim(mb_strtolower($value));
        $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $ascii = $transliterated !== false ? $transliterated : $value;
        $ascii = preg_replace('/[^a-z0-9]+/', ' ', strtolower($ascii)) ?? '';

        return trim(preg_replace('/\s+/', ' ', $ascii) ?? '');
    }

    private static function slugify(string $value): string
    {
        return str_replace(' ', '_', self::normalizeLabel($value));
    }
}
