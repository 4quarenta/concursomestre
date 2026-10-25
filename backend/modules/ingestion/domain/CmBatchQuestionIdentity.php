<?php

declare(strict_types=1);

/** Content identity for safe exact-match reuse across exam occurrences. */
final class CmBatchQuestionIdentity
{
    /**
     * @param array<string,string> $assetSha256ByPath
     * @param list<array<string,mixed>> $contexts
     */
    public static function fingerprint(array $question, array $contexts = [], array $assetSha256ByPath = []): string
    {
        $contextByKey = [];
        foreach ($contexts as $context) {
            if (!is_array($context)) {
                continue;
            }
            $key = trim((string) ($context['tempId'] ?? $context['id'] ?? $context['contextKey'] ?? ''));
            if ($key !== '') {
                $contextByKey[$key] = $context;
            }
        }

        $source = is_array($question['source'] ?? null) ? $question['source'] : [];
        $contextKey = trim((string) ($source['contextTempId'] ?? $source['questionGroupId'] ?? ''));
        $context = $contextKey !== '' ? ($contextByKey[$contextKey] ?? null) : null;
        if ($contextKey !== '' && $context === null) {
            throw new InvalidArgumentException('Contexto nao localizado: ' . $contextKey);
        }
        $content = is_array($question['content'] ?? null) ? $question['content'] : [];
        $tempAssetHashes = self::assetHashesByTemporaryId($question, $context, $assetSha256ByPath);
        $statement = self::normalizeText((string) ($content['statement'] ?? $content['statementClean'] ?? ''), $assetSha256ByPath, $tempAssetHashes);
        $support = self::normalizeText((string) ($content['supportText'] ?? ''), $assetSha256ByPath, $tempAssetHashes);
        $reference = self::normalizeText((string) ($content['reference'] ?? ''), $assetSha256ByPath, $tempAssetHashes);
        $contextBody = is_array($context)
            ? self::normalizeText((string) ($context['body'] ?? $context['texto'] ?? $context['text'] ?? ''), $assetSha256ByPath, $tempAssetHashes)
            : '';

        $alternatives = [];
        foreach (array_values(is_array($question['alternatives'] ?? null) ? $question['alternatives'] : []) as $index => $alternative) {
            if (!is_array($alternative)) {
                continue;
            }
            $alternatives[] = [
                'sort' => (int) ($alternative['order'] ?? ($index + 1)),
                'index' => $index,
                'label' => self::normalizeText((string) ($alternative['label'] ?? '')),
                'body' => self::normalizeText((string) ($alternative['text'] ?? $alternative['textClean'] ?? ''), $assetSha256ByPath, $tempAssetHashes),
                'assets' => self::assetIdentities($alternative['assets'] ?? [], $assetSha256ByPath),
            ];
        }
        usort($alternatives, static fn (array $left, array $right): int => [$left['sort'], $left['index']] <=> [$right['sort'], $right['index']]);
        $alternatives = array_map(static function (array $item): array {
            unset($item['sort'], $item['index']);
            return $item;
        }, $alternatives);

        $identity = [
            'type' => strtolower(trim((string) ($question['type'] ?? ''))),
            'statement' => $statement,
            'support' => $support,
            'reference' => $reference,
            'context' => $contextBody,
            'contextAssets' => is_array($context)
                ? self::assetIdentities($context['assets'] ?? [], $assetSha256ByPath)
                : [],
            'assets' => self::assetIdentities($question['assets'] ?? [], $assetSha256ByPath),
            'alternatives' => $alternatives,
        ];
        $serialized = json_encode($identity, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        return hash('sha256', $serialized);
    }

    private static function normalizeText(string $value, array $assetSha256ByPath = [], array $tempAssetHashes = []): string
    {
        $value = preg_replace_callback('/\[image:([^\]\r\n]+)\]/i', static function (array $match) use ($tempAssetHashes): string {
            $marker = trim($match[1]);
            if (preg_match('/^[a-f0-9]{64}$/i', $marker) === 1) return '[image:sha256:' . strtolower($marker) . ']';
            $hash = strtolower((string) ($tempAssetHashes[$marker] ?? ''));
            if (preg_match('/^[a-f0-9]{64}$/', $hash) !== 1) {
                throw new InvalidArgumentException('Marcador de imagem sem asset binario verificado: ' . $marker);
            }
            return '[image:sha256:' . $hash . ']';
        }, $value) ?? $value;
        $document = new DOMDocument('1.0', 'UTF-8');
        $previousErrors = libxml_use_internal_errors(true);
        try {
            $document->loadHTML('<?xml encoding="UTF-8"><html><body>' . $value . '</body></html>', LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
            $body = $document->getElementsByTagName('body')->item(0);
            $value = $body ? self::textIdentity($body, $assetSha256ByPath) : '';
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previousErrors);
        }
        $value = str_replace(["\r\n", "\r", "\n", "\t", "\u{00A0}"], ' ', $value);
        if (class_exists(Normalizer::class)) {
            $normalized = Normalizer::normalize($value, Normalizer::FORM_C);
            if (is_string($normalized)) {
                $value = $normalized;
            }
        }
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);
        return $value;
    }

    private static function textIdentity(DOMNode $node, array $assetHashes): string
    {
        // Escape reserved delimiters so literal text cannot impersonate structure.
        if ($node instanceof DOMText) return str_replace(['\\', '[', ']'], ['\\\\', '\\[', '\\]'], $node->data);
        if (!$node instanceof DOMElement) return '';
        $tag = strtolower($node->tagName);
        if (in_array($tag, ['script','style','iframe','object','embed','svg'], true)) {
            throw new InvalidArgumentException('Conteudo ativo ou figura vetorial requer revisao: ' . $tag);
        }
        if ($tag === 'img') {
            $path = $node->getAttribute('src');
            $hash = strtolower((string)($assetHashes[$path] ?? ''));
            if (preg_match('/^[a-f0-9]{64}$/', $hash) !== 1) throw new InvalidArgumentException('Imagem inline sem hash verificado: ' . $path);
            return '[image:' . $hash . ']';
        }
        $value = '';
        foreach ($node->childNodes as $child) $value .= self::textIdentity($child, $assetHashes);
        // Formula and table structure carries meaning even when plain text is identical.
        if (in_array($tag, ['sup','sub','math','mfrac','msqrt','mroot','msup','msub','msubsup','mover','munder','mtable','mtr','mtd','tr','td','th'], true)) {
            $attributes = [];
            foreach ($node->attributes as $attribute) {
                $attributes[strtolower($attribute->name)] = $attribute->value;
            }
            ksort($attributes, SORT_STRING);
            $encodedAttributes = $attributes === [] ? '' : ':' . base64_encode(json_encode($attributes, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
            return '[' . $tag . $encodedAttributes . ']' . $value . '[/' . $tag . ']';
        }
        return in_array($tag, ['p','div','br','li','section','blockquote'], true) ? ' ' . $value . ' ' : $value;
    }

    /** @param mixed $assets @param array<string,string> $assetSha256ByPath @return list<string> */
    private static function assetIdentities(mixed $assets, array $assetSha256ByPath): array
    {
        if (!is_array($assets)) {
            return [];
        }
        $identities = [];
        foreach ($assets as $asset) {
            if (!is_array($asset)) {
                continue;
            }
            $path = trim((string) ($asset['path'] ?? $asset['sourcePath'] ?? $asset['source_path'] ?? $asset['url'] ?? $asset['src'] ?? ''));
            // Only hashes verified against archive bytes establish media identity.
            $hash = $path !== '' ? strtolower((string) ($assetSha256ByPath[$path] ?? '')) : '';
            if ($hash !== '' && preg_match('/^[a-f0-9]{64}$/', $hash)) {
                $identities[] = 'sha256:' . $hash;
                continue;
            }
            throw new InvalidArgumentException('Midia sem hash binario verificado: ' . ($path !== '' ? $path : 'missing-reference'));
        }
        return $identities;
    }

    /** @return array<string,string> */
    private static function assetHashesByTemporaryId(array $question, ?array $context, array $assetSha256ByPath): array
    {
        $assets = is_array($question['assets'] ?? null) ? $question['assets'] : [];
        foreach (is_array($question['alternatives'] ?? null) ? $question['alternatives'] : [] as $alternative) {
            if (is_array($alternative) && is_array($alternative['assets'] ?? null)) $assets = array_merge($assets, $alternative['assets']);
        }
        if (is_array($context) && is_array($context['assets'] ?? null)) $assets = array_merge($assets, $context['assets']);
        $resolved = [];
        foreach ($assets as $asset) {
            if (!is_array($asset)) continue;
            $tempId = trim((string) ($asset['tempId'] ?? $asset['id'] ?? ''));
            if ($tempId === '') continue;
            $path = trim((string) ($asset['path'] ?? $asset['sourcePath'] ?? $asset['source_path'] ?? $asset['url'] ?? $asset['src'] ?? ''));
            $hash = strtolower((string) ($assetSha256ByPath[$path] ?? ''));
            if (preg_match('/^[a-f0-9]{64}$/', $hash) !== 1) {
                throw new InvalidArgumentException('Asset temporario sem hash binario verificado: ' . $tempId);
            }
            if (isset($resolved[$tempId]) && !hash_equals($resolved[$tempId], $hash)) {
                throw new InvalidArgumentException('ID temporario de asset ambiguo: ' . $tempId);
            }
            $resolved[$tempId] = $hash;
        }
        return $resolved;
    }
}
