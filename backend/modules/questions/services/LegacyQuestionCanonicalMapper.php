<?php

declare(strict_types=1);

/**
 * Converts historical questions.data_json children into the canonical shape.
 * It is intentionally pure so the operational backfill can be tested without
 * touching production data.
 */
final class LegacyQuestionCanonicalMapper
{
    /**
     * @return array{options: array<int, array<string, mixed>>, editorials: array<int, array<string, string>>}
     */
    public static function map(array $row): array
    {
        $legacy = json_decode((string) ($row['data_json'] ?? ''), true);
        $legacy = is_array($legacy) ? $legacy : [];
        $items = is_array($legacy['alternatives'] ?? null)
            ? $legacy['alternatives']
            : (is_array($legacy['itens'] ?? null) ? $legacy['itens'] : []);

        $answerIndex = self::integerOrNull($row['resposta_correta_item_index'] ?? null)
            ?? self::integerOrNull($legacy['correctOptionIndex'] ?? null)
            ?? self::legacyAnswerIndex($legacy['resposta'] ?? null, count($items));

        $questionId = max(0, (int) ($row['id'] ?? 0));
        $options = [];
        foreach (array_values($items) as $index => $item) {
            if (!is_array($item)) {
                continue;
            }
            $label = trim((string) ($item['label'] ?? $item['rotulo'] ?? chr(65 + $index)));
            $label = $label !== '' ? $label : chr(65 + $index);
            $body = (string) ($item['text'] ?? $item['corpo'] ?? $item['body'] ?? '');
            $bodyClean = (string) ($item['textClean'] ?? $item['corpo_clean'] ?? $item['body_clean'] ?? strip_tags($body));
            $externalKey = trim((string) ($item['tempId'] ?? $item['external_key'] ?? ''));
            if ($externalKey === '') {
                $normalizedLabel = preg_replace('/[^a-z0-9]+/i', '_', $label) ?: (string) ($index + 1);
                $externalKey = 'legacy_q' . $questionId . '_alt_' . strtolower($normalizedLabel);
            }
            $options[] = [
                'external_key' => $externalKey,
                'display_order' => max(1, (int) ($item['order'] ?? $item['ordem'] ?? ($index + 1))),
                'label' => $label,
                'body' => $body,
                'body_clean' => $bodyClean,
                'is_correct' => $answerIndex !== null && $answerIndex === $index ? 1 : 0,
            ];
        }

        $editorialComments = is_array($legacy['editorialComments'] ?? null) ? $legacy['editorialComments'] : [];
        $teacher = trim((string) ($editorialComments['teacherComment'] ?? $legacy['teacherComment'] ?? $legacy['teacher_comment'] ?? ''));
        $detailed = trim((string) ($editorialComments['detailedComment'] ?? $legacy['detailedComment'] ?? $legacy['detailed_comment'] ?? ''));
        $editorials = [];
        if ($teacher !== '') {
            $editorials[] = ['editorial_type' => 'teacher_comment', 'body' => $teacher];
        }
        if ($detailed !== '') {
            $editorials[] = ['editorial_type' => 'detailed_analysis', 'body' => $detailed];
        }

        return ['options' => $options, 'editorials' => $editorials];
    }

    private static function integerOrNull(mixed $value): ?int
    {
        if ($value === null || $value === '' || !is_numeric($value)) {
            return null;
        }
        return (int) $value;
    }

    private static function legacyAnswerIndex(mixed $value, int $itemCount): ?int
    {
        if (!is_numeric($value)) {
            return null;
        }
        $numeric = (int) $value;
        if ($numeric >= 0 && $numeric < $itemCount) {
            return $numeric;
        }
        if ($numeric >= 1 && $numeric <= $itemCount) {
            return $numeric - 1;
        }
        return null;
    }
}
