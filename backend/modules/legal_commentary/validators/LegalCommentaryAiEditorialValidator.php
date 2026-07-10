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
 * Regras editoriais para a geracao juridica da Lei Comentada.
 *
 * O foco aqui nao e "embelezar" o texto, e sim barrar saidas
 * burocraticas, genericas ou suspeitas antes de irem para o acervo.
 *
 * @since 1.0.0
 */
class LegalCommentaryAiEditorialValidator
{
    private const COMMENT_FORBIDDEN_PHRASES = [
        'o artigo estabelece',
        'o artigo dispoe',
        'o artigo dispõe',
        'tem como objetivo',
        'visa',
        'trata de',
        'cria mecanismos',
        'neste artigo',
        'este artigo',
        'vamos analisar',
        'prezados alunos',
        'caros alunos',
    ];

    private const PEDAGOGICAL_MARKERS = [
        'atencao',
        'atenção',
        'memorize',
        'pegadinha',
        'cuidado',
        'banca',
        'prova',
        'cai em prova',
        'ponto de prova',
        'ponto crucial',
        'confunde',
        'cobrado',
        'palavra-chave',
        'palavras-chave',
        'palavra chave',
        'palavras chave',
        'incide em prova',
        'costuma cair',
        'diferencie',
        'nao confunda',
        'não confunda',
        'mnem',
        'sigla',
    ];

    private const GENERIC_EDITORIAL_PHRASES = [
        'e importante para concursos',
        'é importante para concursos',
        'essencial para concursos',
        'deve ser analisado',
        'merece destaque',
        'tema relevante',
        'tema importante',
        'de forma geral',
        'de maneira geral',
        'em linhas gerais',
        'aplica-se ao caso concreto',
        'interpreta a lei',
        'protege direitos',
        'garante direitos',
    ];

    private const ALLOWED_COURTS = ['STF', 'STJ', 'TST', 'TCU', 'TRF', 'TJ'];
    private const SUMULA_ALLOWED_COURTS = ['STF', 'STJ', 'TST', 'TCU'];

    /**
     * @var string[]
     */
    private array $stopwords = [
        'a', 'o', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'por',
        'para', 'com', 'sem', 'sob', 'sobre', 'ao', 'aos', 'na', 'no', 'nas', 'nos',
        'um', 'uma', 'uns', 'umas', 'que', 'se', 'ou', 'como', 'mais', 'menos',
        'ser', 'sera', 'sera', 'sao', 'são', 'foi', 'ha', 'há', 'ja', 'já', 'lhe',
        'ele', 'ela', 'eles', 'elas', 'artigo', 'art', 'lei', 'caput', 'inciso',
        'paragrafo', 'parágrafo', 'paragrafos', 'parágrafos', 'dispositivo',
        'norma', 'texto', 'legal',
    ];

    public function normalizeComment(string $value): string
    {
        $value = $this->sanitizeInlineText($value);
        $sentences = $this->splitSentences($value);

        if (empty($sentences)) {
            return '';
        }

        return implode(' ', array_slice($sentences, 0, 3));
    }

    public function isValidComment(string $value, string $articleText): bool
    {
        $value = $this->normalizeComment($value);
        if ($value === '') {
            return false;
        }

        $sentences = $this->splitSentences($value);
        if (count($sentences) < 1 || count($sentences) > 3) {
            return false;
        }

        if (mb_strlen($value) < 35 || mb_strlen($value) > 360) {
            return false;
        }

        $normalized = $this->normalizeForCompare($value);
        foreach (self::COMMENT_FORBIDDEN_PHRASES as $phrase) {
            if (str_contains($normalized, $this->normalizeForCompare($phrase))
                && !$this->containsPedagogicalDensity($normalized)) {
                return false;
            }
        }

        foreach (self::GENERIC_EDITORIAL_PHRASES as $phrase) {
            if (str_contains($normalized, $this->normalizeForCompare($phrase))) {
                return false;
            }
        }

        if ($this->similarityRatio($value, $articleText) >= 0.78 && !$this->containsPedagogicalDensity($normalized)) {
            return false;
        }

        return true;
    }

    public function normalizeMacete(string $value): string
    {
        $value = html_entity_decode($value, ENT_QUOTES, 'UTF-8');
        $value = str_replace(["\r\n", "\r"], "\n", $value);
        $lines = preg_split('/\n+/u', trim($value)) ?: [];
        $normalizedLines = [];

        foreach ($lines as $line) {
            $line = preg_replace('/\s+/u', ' ', trim((string) $line)) ?: '';
            if ($line === '') {
                continue;
            }

            $line = preg_replace('/^macete\s*:\s*/iu', 'Pulo do gato: ', $line) ?: $line;
            $line = preg_replace('/^pulo do gato\s*:\s*/iu', 'Pulo do gato: ', $line) ?: $line;
            $line = preg_replace('/^como lembrar na prova\s*:\s*/iu', 'Como a banca confunde: ', $line) ?: $line;
            $line = preg_replace('/^como a banca confunde\s*:\s*/iu', 'Como a banca confunde: ', $line) ?: $line;
            $line = preg_replace('/^chave de prova\s*:\s*/iu', 'Chave de prova: ', $line) ?: $line;
            $normalizedLines[] = $line;
        }

        return trim(implode("\n", $normalizedLines));
    }

    public function buildMaceteBody(string $macete, string $howToRemember = '', string $keyPoint = ''): string
    {
        $macete = $this->sanitizeInlineText($macete);
        $howToRemember = $this->sanitizeInlineText($howToRemember);
        $keyPoint = $this->sanitizeInlineText($keyPoint);

        if ($macete !== '') {
            $macete = rtrim($macete, " \t\n\r\0\x0B.,;:!?");
            $body = 'Pulo do gato: ' . $macete;
            if ($howToRemember !== '') {
                $body .= "\nComo a banca confunde: " . $howToRemember;
            }

            return $body;
        }

        if ($keyPoint !== '') {
            return 'Chave de prova: ' . $keyPoint;
        }

        return '';
    }

    public function isValidMacete(string $value, string $articleText, string $comment): bool
    {
        $value = $this->normalizeMacete($value);
        if ($value === '') {
            return false;
        }

        if (preg_match('/^(?:Macete|Pulo do gato):\s*(.+?)(?:\n(?:Como lembrar na prova|Como a banca confunde):\s*(.+))?$/us', $value, $matches) === 1) {
            $mainMacete = $this->sanitizeInlineText((string) ($matches[1] ?? ''));
            $howToRemember = $this->sanitizeInlineText((string) ($matches[2] ?? ''));

            if ($mainMacete === '' || $howToRemember === '') {
                return false;
            }

            if ($this->countWords($mainMacete) > 12 || mb_strlen($mainMacete) > 110) {
                return false;
            }

            if ($this->looksLikeArtificialMnemonic($mainMacete)) {
                return false;
            }

            if (preg_match('/[.;!?]{1,}/u', $mainMacete) === 1) {
                return false;
            }

            if (mb_strlen($howToRemember) < 18 || mb_strlen($howToRemember) > 220) {
                return false;
            }

            if ($this->looksLikeArtificialMnemonic($howToRemember)) {
                return false;
            }

            $normalizedHowToRemember = $this->normalizeForCompare($howToRemember);
            foreach (self::GENERIC_EDITORIAL_PHRASES as $phrase) {
                if (str_contains($normalizedHowToRemember, $this->normalizeForCompare($phrase))) {
                    return false;
                }
            }

            if ($this->similarityRatio($mainMacete, $articleText) >= 0.68) {
                return false;
            }

            if ($comment !== '' && $this->similarityRatio($mainMacete, $comment) >= 0.72) {
                return false;
            }

            if ($this->similarityRatio($howToRemember, $articleText) >= 0.82) {
                return false;
            }

            if ($comment !== '' && $this->similarityRatio($howToRemember, $comment) >= 0.82) {
                return false;
            }

            return true;
        }

        if (preg_match('/^Chave de prova:\s*(.+)$/us', $value, $matches) !== 1) {
            return false;
        }

        $keyPoint = $this->sanitizeInlineText((string) ($matches[1] ?? ''));
        if ($keyPoint === '') {
            return false;
        }

        if ($this->countWords($keyPoint) < 4 || $this->countWords($keyPoint) > 22) {
            return false;
        }

        if ($this->looksLikeArtificialMnemonic($keyPoint)) {
            return false;
        }

        if (mb_strlen($keyPoint) < 24 || mb_strlen($keyPoint) > 180) {
            return false;
        }

        $normalized = $this->normalizeForCompare($keyPoint);
        foreach (self::GENERIC_EDITORIAL_PHRASES as $phrase) {
            if (str_contains($normalized, $this->normalizeForCompare($phrase))) {
                return false;
            }
        }

        if ($this->similarityRatio($keyPoint, $articleText) >= 0.78) {
            return false;
        }

        if ($comment !== '' && $this->similarityRatio($keyPoint, $comment) >= 0.8) {
            return false;
        }

        return true;
    }

    public function filterDoctrineEntries(array $entries, string $articleText): array
    {
        $approved = [];
        $seen = [];

        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $author = $this->sanitizeInlineText((string) ($entry['autor'] ?? $entry['author'] ?? ''));
            $understanding = $this->sanitizeInlineText((string) ($entry['entendimento'] ?? $entry['text'] ?? $entry['summary'] ?? ''));

            if ($author === '' || $understanding === '') {
                continue;
            }

            if (mb_strlen($understanding) < 20 || mb_strlen($understanding) > 240) {
                continue;
            }

            if ($this->looksGenericDoctrine($understanding, $articleText)) {
                continue;
            }

            $signature = $this->normalizeForCompare($author . '|' . $understanding);
            if (isset($seen[$signature])) {
                continue;
            }

            $seen[$signature] = true;
            $approved[] = [
                'autor' => $author,
                'entendimento' => $understanding,
                'target' => $this->normalizeTargetEntry($entry['target'] ?? []),
            ];
        }

        return array_slice($approved, 0, 5);
    }

    public function filterJurisprudenceEntries(array $entries, string $articleText, string $articleNumber = ''): array
    {
        $approved = [];
        $seen = [];
        $normalizedArticleNumber = $this->normalizeArticleNumber($articleNumber);

        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $court = strtoupper($this->sanitizeInlineText((string) ($entry['tribunal'] ?? $entry['court'] ?? '')));
            $process = $this->sanitizeInlineText((string) ($entry['processo'] ?? $entry['process'] ?? ''));
            $thesis = $this->sanitizeInlineText((string) ($entry['tese'] ?? $entry['summary'] ?? $entry['text'] ?? ''));

            if ($court === '' || !in_array($court, self::ALLOWED_COURTS, true)) {
                continue;
            }

            if ($thesis === '' || mb_strlen($thesis) < 20 || mb_strlen($thesis) > 260) {
                continue;
            }

            if ($this->looksGenericJurisprudence($thesis, $articleText)) {
                continue;
            }

            if ($this->referencesDifferentArticle($thesis, $normalizedArticleNumber)
                && !$this->hasExplicitConnectionToCurrentArticle($thesis)) {
                continue;
            }

            $signature = $this->normalizeForCompare($court . '|' . $process . '|' . $thesis);
            if (isset($seen[$signature])) {
                continue;
            }

            $seen[$signature] = true;
            $approved[] = [
                'tribunal' => $court,
                'processo' => $process,
                'tese' => $thesis,
                'target' => $this->normalizeTargetEntry($entry['target'] ?? []),
            ];
        }

        return array_slice($approved, 0, 5);
    }

    public function filterSumulaEntries(array $entries, string $articleText, string $lawNumber): array
    {
        $approved = [];
        $seen = [];
        $lawNumberDigits = preg_replace('/\D+/u', '', $lawNumber) ?: '';

        foreach ($entries as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $court = strtoupper($this->sanitizeInlineText((string) ($entry['tribunal'] ?? $entry['court'] ?? '')));
            $number = $this->sanitizeInlineText((string) ($entry['numero'] ?? $entry['number'] ?? ''));
            $enunciado = $this->sanitizeInlineText((string) ($entry['enunciado'] ?? $entry['text'] ?? ''));

            if ($court === '' || !in_array($court, self::SUMULA_ALLOWED_COURTS, true)) {
                continue;
            }

            if ($number === '' || preg_match('/^\d{1,4}$/', $number) !== 1) {
                continue;
            }

            if ($lawNumberDigits !== '' && preg_replace('/\D+/u', '', $number) === $lawNumberDigits) {
                continue;
            }

            if ($enunciado === '' || mb_strlen($enunciado) < 15 || mb_strlen($enunciado) > 220) {
                continue;
            }

            if ($this->looksGenericSumula($enunciado, $articleText)) {
                continue;
            }

            $signature = $this->normalizeForCompare($court . '|' . $number . '|' . $enunciado);
            if (isset($seen[$signature])) {
                continue;
            }

            $seen[$signature] = true;
            $approved[] = [
                'tribunal' => $court,
                'numero' => $number,
                'enunciado' => $enunciado,
                'target' => $this->normalizeTargetEntry($entry['target'] ?? []),
            ];
        }

        return array_slice($approved, 0, 5);
    }

    public function doctrineToStructuredEntries(array $entries): array
    {
        return array_values(array_filter(array_map(function (array $entry): array {
            $author = $this->sanitizeInlineText((string) ($entry['autor'] ?? ''));
            $understanding = $this->sanitizeInlineText((string) ($entry['entendimento'] ?? ''));
            if ($author === '' || $understanding === '') {
                return [];
            }

            return [
                'title' => 'Doutrina',
                'author' => $author,
                'body' => $author . ': ' . $understanding,
                'text' => $author . ': ' . $understanding,
                'target' => $this->normalizeTargetEntry($entry['target'] ?? []),
            ];
        }, $entries)));
    }

    private function normalizeTargetEntry($value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $kind = strtolower($this->sanitizeInlineText((string) ($value['kind'] ?? '')));
        $allowedKinds = ['article', 'section', 'caput', 'paragraph', 'inciso', 'alinea', 'item', 'note'];
        if (!in_array($kind, $allowedKinds, true)) {
            $kind = '';
        }

        return array_filter([
            'kind' => $kind,
            'label' => $this->sanitizeInlineText((string) ($value['label'] ?? '')),
            'blockId' => $this->sanitizeInlineText((string) ($value['blockId'] ?? '')),
        ], static fn ($item): bool => trim((string) $item) !== '');
    }

    public function sanitizeInlineText(string $value): string
    {
        $value = html_entity_decode($value, ENT_QUOTES, 'UTF-8');
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?: '';
        $value = preg_replace('/\s+([,.;:!?])/u', '$1', $value) ?: $value;
        return trim($value);
    }

    /**
     * @return string[]
     */
    private function splitSentences(string $value): array
    {
        $parts = preg_split('/(?<=[.!?])\s+/u', $this->sanitizeInlineText($value)) ?: [];
        return array_values(array_filter(array_map('trim', $parts), static fn ($item) => $item !== ''));
    }

    private function countWords(string $value): int
    {
        $parts = preg_split('/[\s\-\/]+/u', trim($value)) ?: [];
        return count(array_filter($parts, static fn ($item) => $item !== ''));
    }

    private function normalizeArticleNumber(string $value): string
    {
        $value = $this->normalizeForCompare($value);
        $value = preg_replace('/^art(?:igo)?/u', '', $value) ?: $value;
        $value = preg_replace('/[^0-9a-z]+/u', '', $value) ?: $value;
        return trim($value);
    }

    private function looksLikeArtificialMnemonic(string $value): bool
    {
        $value = $this->sanitizeInlineText($value);
        if ($value === '') {
            return false;
        }

        if (preg_match('/\b(?:[A-Z]{2,6}(?:[-\/][A-Z]{2,6}){1,}|(?:[A-Z]{2,6}\s+){2,}[A-Z]{2,6})\b/u', $value) === 1) {
            return true;
        }

        $tokens = preg_split('/[\s\-\/]+/u', $value) ?: [];
        $shortUppercaseTokens = 0;
        $meaningfulTokens = 0;

        foreach ($tokens as $token) {
            $token = trim((string) $token);
            if ($token === '') {
                continue;
            }

            $meaningfulTokens++;
            if (preg_match('/^[A-Z]{2,6}$/u', $token) === 1) {
                $shortUppercaseTokens++;
            }
        }

        if ($meaningfulTokens >= 3 && $shortUppercaseTokens >= 3) {
            return true;
        }

        $normalized = $this->normalizeForCompare($value);
        if (preg_match('/^(?:[a-z]{2,5}(?:-[a-z]{2,5}){2,})$/', $normalized) === 1) {
            return true;
        }

        return false;
    }

    private function containsPedagogicalDensity(string $normalizedValue): bool
    {
        foreach (self::PEDAGOGICAL_MARKERS as $marker) {
            if (str_contains($normalizedValue, $this->normalizeForCompare($marker))) {
                return true;
            }
        }

        return false;
    }

    private function looksGenericDoctrine(string $value, string $articleText): bool
    {
        $normalized = $this->normalizeForCompare($value);
        foreach (self::COMMENT_FORBIDDEN_PHRASES as $phrase) {
            if (str_contains($normalized, $this->normalizeForCompare($phrase))) {
                return true;
            }
        }

        foreach (self::GENERIC_EDITORIAL_PHRASES as $phrase) {
            if (str_contains($normalized, $this->normalizeForCompare($phrase))) {
                return true;
            }
        }

        return $this->similarityRatio($value, $articleText) >= 0.82;
    }

    private function looksGenericJurisprudence(string $value, string $articleText): bool
    {
        $normalized = $this->normalizeForCompare($value);
        foreach (self::GENERIC_EDITORIAL_PHRASES as $phrase) {
            if (str_contains($normalized, $this->normalizeForCompare($phrase))) {
                return true;
            }
        }

        if (str_contains($normalized, 'o tribunal entende') && !$this->containsPedagogicalDensity($normalized)) {
            return true;
        }

        return $this->similarityRatio($value, $articleText) >= 0.84;
    }

    private function hasExplicitConnectionToCurrentArticle(string $value): bool
    {
        $normalized = $this->normalizeForCompare($value);
        $markers = [
            'este artigo',
            'neste artigo',
            'este dispositivo',
            'neste dispositivo',
            'ao aplicar este artigo',
            'na interpretacao deste artigo',
            'na interpretacao deste dispositivo',
            'em conjunto com',
            'em complemento a este artigo',
            'em complemento deste artigo',
        ];

        foreach ($markers as $marker) {
            if (str_contains($normalized, $this->normalizeForCompare($marker))) {
                return true;
            }
        }

        return false;
    }

    private function referencesDifferentArticle(string $value, string $currentArticleNumber = ''): bool
    {
        $normalized = $this->normalizeForCompare($value);
        if (preg_match_all('/art(?:igo)?\.?\s*(\d+[a-z]?)/u', $normalized, $matches) !== 1) {
            return false;
        }

        foreach (($matches[1] ?? []) as $referencedNumber) {
            $normalizedReferenced = $this->normalizeArticleNumber((string) $referencedNumber);
            if ($normalizedReferenced === '') {
                continue;
            }

            if ($currentArticleNumber !== '' && $normalizedReferenced === $currentArticleNumber) {
                continue;
            }

            return true;
        }

        return false;
    }

    private function looksGenericSumula(string $value, string $articleText): bool
    {
        $normalized = $this->normalizeForCompare($value);
        if (str_contains($normalized, 'sumula') || str_contains($normalized, 'súmula')) {
            return true;
        }

        foreach (self::GENERIC_EDITORIAL_PHRASES as $phrase) {
            if (str_contains($normalized, $this->normalizeForCompare($phrase))) {
                return true;
            }
        }

        return $this->similarityRatio($value, $articleText) >= 0.84;
    }

    private function similarityRatio(string $left, string $right): float
    {
        $leftTokens = $this->tokenizeMeaningful($left);
        $rightTokens = $this->tokenizeMeaningful($right);

        if (empty($leftTokens) || empty($rightTokens)) {
            return 0.0;
        }

        $intersection = array_intersect($leftTokens, $rightTokens);
        $union = array_unique(array_merge($leftTokens, $rightTokens));

        if (empty($union)) {
            return 0.0;
        }

        return count($intersection) / count($union);
    }

    /**
     * @return string[]
     */
    private function tokenizeMeaningful(string $value): array
    {
        $normalized = $this->normalizeForCompare($value);
        $parts = preg_split('/[^a-z0-9]+/u', $normalized) ?: [];
        $parts = array_values(array_filter($parts, function ($item): bool {
            return $item !== ''
                && !in_array($item, $this->stopwords, true)
                && mb_strlen($item) >= 3;
        }));

        return array_values(array_unique($parts));
    }

    private function normalizeForCompare(string $value): string
    {
        $value = mb_strtolower($this->sanitizeInlineText($value), 'UTF-8');
        $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        return $transliterated !== false ? strtolower($transliterated) : strtolower($value);
    }
}
