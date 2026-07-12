<?php

declare(strict_types=1);

putenv('JWT_SECRET=phase02-test-secret');
$_ENV['JWT_SECRET'] = 'phase02-test-secret';

require_once __DIR__ . '/../shared/pagination/SignedKeysetCursor.php';

function phase02CursorAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $first = SignedKeysetCursor::encode('users.answers', '2026-07-12 10:00:00', 'a-1');
    $second = SignedKeysetCursor::encode('users.answers', '2026-07-12 10:00:00', 'a-2');

    phase02CursorAssert($first !== $second, 'IDs diferentes no mesmo created_at precisam manter cursor distinto.');
    phase02CursorAssert(
        SignedKeysetCursor::decode($first, 'users.answers') === ['createdAt' => '2026-07-12 10:00:00', 'id' => 'a-1'],
        'Cursor valido deve preservar created_at e id.'
    );

    foreach ([substr($first, 0, -1) . 'x', $first] as $index => $cursor) {
        try {
            SignedKeysetCursor::decode($cursor, $index === 0 ? 'users.answers' : 'notifications.list');
            throw new RuntimeException('Cursor adulterado ou de outro escopo foi aceito.');
        } catch (InvalidArgumentException) {
            // Comportamento esperado.
        }
    }

    fwrite(STDOUT, "SignedKeysetCursorTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'SignedKeysetCursorTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
