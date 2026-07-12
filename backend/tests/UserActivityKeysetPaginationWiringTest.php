<?php

declare(strict_types=1);

$repository = file_get_contents(__DIR__ . '/../modules/users/repositories/UsersRepository.php');
if ($repository === false) {
    fwrite(STDERR, "UserActivityKeysetPaginationWiringTest: FAIL - repositorio ausente\n");
    exit(1);
}

try {
    $extractMethod = static function (string $source, string $methodName): string {
        $start = strpos($source, 'function ' . $methodName . '(');
        if ($start === false) {
            throw new RuntimeException('Metodo ausente: ' . $methodName);
        }

        $brace = strpos($source, '{', $start);
        if ($brace === false) {
            throw new RuntimeException('Metodo sem bloco: ' . $methodName);
        }

        $depth = 0;
        for ($index = $brace, $length = strlen($source); $index < $length; $index++) {
            if ($source[$index] === '{') {
                $depth++;
            } elseif ($source[$index] === '}' && --$depth === 0) {
                return substr($source, $start, $index - $start + 1);
            }
        }

        throw new RuntimeException('Metodo nao fechado: ' . $methodName);
    };

    foreach ([
        'created_at < :cursor_created_at',
        'created_at = :cursor_created_at AND id < :cursor_id',
        'ORDER BY created_at DESC, id DESC',
        'LIMIT " . ($safeLimit + 1)',
    ] as $needle) {
        if (strpos($repository, $needle) === false) {
            throw new RuntimeException('Paginacao keyset incompleta: ' . $needle);
        }
    }

    foreach (['fetchUserCommentsById', 'fetchUserAnswersById'] as $methodName) {
        $method = $extractMethod($repository, $methodName);
        if (stripos($method, 'OFFSET') !== false) {
            throw new RuntimeException('Paginacao keyset nao pode codificar OFFSET: ' . $methodName);
        }
        if (strpos($method, 'LIMIT " . ($safeLimit + 1)') === false) {
            throw new RuntimeException('Paginacao precisa buscar um item extra para hasMore: ' . $methodName);
        }
    }

    $service = file_get_contents(__DIR__ . '/../modules/users/services/UsersService.php');
    if ($service === false || strpos($service, 'resolveCursorLimit($query[\'limit\'] ?? null, $defaultLimit, $maximumLimit)') === false) {
        throw new RuntimeException('Limite de pagina precisa ser validado pelo service.');
    }
    if (strpos($service, 'return max(1, min($limit, $maximum));') === false) {
        throw new RuntimeException('Limites 0 e acima do maximo precisam ser normalizados no server-side.');
    }

    fwrite(STDOUT, "UserActivityKeysetPaginationWiringTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'UserActivityKeysetPaginationWiringTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
