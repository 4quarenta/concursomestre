<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*/

declare(strict_types=1);

/**
 * Resolve o resultado de uma resposta usando exclusivamente o registro canônico
 * da questão. Nenhuma decisão de acerto pode depender do navegador.
 *
 * @since 1.0.0
 */
class QuestionAnswerEvaluator
{
    /**
     * @return array{selectedOptionIndex:int,correctOptionIndex:int,isCorrect:bool}
     */
    public function evaluate(array $question, int $selectedOptionIndex): array
    {
        $items = $this->extractItems($question);
        if ($items === []) {
            throw new DomainException('A questão não possui alternativas válidas para correção.');
        }

        if ($selectedOptionIndex < 0 || $selectedOptionIndex >= count($items)) {
            throw new InvalidArgumentException('Alternativa selecionada inválida.');
        }

        $correctOptionIndex = $this->resolveCorrectOptionIndex($question, $items);
        if ($correctOptionIndex < 0 || $correctOptionIndex >= count($items)) {
            throw new DomainException('O gabarito canônico desta questão é inválido.');
        }

        return [
            'selectedOptionIndex' => $selectedOptionIndex,
            'correctOptionIndex' => $correctOptionIndex,
            'isCorrect' => $selectedOptionIndex === $correctOptionIndex,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function extractItems(array $question): array
    {
        $data = [];
        if (is_string($question['data_json'] ?? null) && trim((string) $question['data_json']) !== '') {
            $decoded = json_decode((string) $question['data_json'], true);
            $data = is_array($decoded) ? $decoded : [];
        }

        $rawItems = $data['itens'] ?? $data['items'] ?? [];
        if (!is_array($rawItems)) {
            return [];
        }

        $items = [];
        foreach (array_values($rawItems) as $index => $item) {
            if (is_scalar($item)) {
                $body = trim((string) $item);
                if ($body !== '') {
                    $items[] = ['id' => $index + 1, 'rotulo' => chr(65 + $index), 'corpo' => $body];
                }
                continue;
            }

            if (!is_array($item)) {
                continue;
            }

            $body = trim((string) ($item['corpo'] ?? $item['body'] ?? $item['text'] ?? ''));
            $hasVisualAlternative = is_array($item['assets'] ?? null) && $item['assets'] !== [];
            if ($body === '' && !$hasVisualAlternative) {
                continue;
            }

            $items[] = [
                'id' => $item['id'] ?? ($index + 1),
                'rotulo' => (string) ($item['rotulo'] ?? $item['label'] ?? chr(65 + $index)),
                'corpo' => $body,
            ];
        }

        return $items;
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    private function resolveCorrectOptionIndex(array $question, array $items): int
    {
        $storedIndex = $question['resposta_correta_item_index'] ?? null;
        if (is_numeric($storedIndex)) {
            $index = (int) $storedIndex;
            if ($index >= 0 && $index < count($items)) {
                return $index;
            }
        }

        $data = [];
        if (is_string($question['data_json'] ?? null) && trim((string) $question['data_json']) !== '') {
            $decoded = json_decode((string) $question['data_json'], true);
            $data = is_array($decoded) ? $decoded : [];
        }

        if (array_key_exists('correctOptionIndex', $data) && is_numeric($data['correctOptionIndex'])) {
            $index = (int) $data['correctOptionIndex'];
            if ($index >= 0 && $index < count($items)) {
                return $index;
            }
        }

        $candidate = $data['resposta'] ?? $data['answer'] ?? null;
        if (is_numeric($candidate)) {
            $candidateNumber = (int) $candidate;
            foreach ($items as $index => $item) {
                if ((string) ($item['id'] ?? '') === (string) $candidateNumber) {
                    return $index;
                }
            }

            // Legacy payloads stored `resposta` as a one-based alternative index.
            if ($candidateNumber >= 1 && $candidateNumber <= count($items)) {
                return $candidateNumber - 1;
            }
        }

        $label = strtoupper(trim((string) $candidate));
        foreach ($items as $index => $item) {
            if ($label !== '' && ($label === strtoupper((string) ($item['rotulo'] ?? '')) || $label === strtoupper((string) ($item['id'] ?? '')))) {
                return $index;
            }
        }

        return -1;
    }
}
