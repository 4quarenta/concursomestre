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

declare(strict_types=1);

require_once __DIR__ . '/../modules/feedback/validators/FeedbackValidator.php';

function assertFeedbackValidator(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$validator = new FeedbackValidator();

$payload = $validator->validateCreatePayload([
    'type' => 'testimonial',
    'reason' => 'Avaliar plataforma',
    'details' => 'A plataforma ajudou meu estudo diario.',
    'rating' => 5,
    'public_display_name' => 'Ana S.',
    'public_headline' => 'Aprovada em concurso municipal',
]);

assertFeedbackValidator($payload['type'] === 'platform-rating', 'Testimonial alias must be stored as platform rating.');
assertFeedbackValidator($payload['reason'] === 'Avaliar plataforma', 'Platform rating title must remain clean.');
assertFeedbackValidator($payload['publicRating'] === 5, 'Platform testimonial must keep public rating.');
assertFeedbackValidator($payload['publicDisplayName'] === 'Ana S.', 'Platform testimonial must keep display name.');
assertFeedbackValidator($payload['publicHeadline'] === 'Aprovada em concurso municipal', 'Platform testimonial must keep headline.');

$payload = $validator->validateCreatePayload([
    'type' => 'platform-rating',
    'reason' => 'Avaliar plataforma',
    'details' => 'Gostei do acompanhamento de desempenho.',
    'rating' => 4,
    'displayName' => 'Bruno T.',
    'achievement' => 'Estudante para tribunais',
]);

assertFeedbackValidator($payload['type'] === 'platform-rating', 'Platform rating alias must be accepted.');

try {
    $validator->validateCreatePayload([
        'type' => 'testimonial',
        'reason' => 'Avaliar plataforma',
        'details' => 'Gostei bastante da plataforma.',
        'rating' => 5,
        'public_display_name' => '',
        'public_headline' => 'Estudante',
    ]);

    throw new RuntimeException('Platform testimonial without display name should fail.');
} catch (InvalidArgumentException $e) {
    assertFeedbackValidator($e->getMessage() === 'Informe o nome que deve aparecer no depoimento.', 'Platform testimonial must require display name.');
}

try {
    $validator->validateCreatePayload([
        'type' => 'unsupported',
        'reason' => 'Teste',
        'details' => 'Mensagem valida para testar tipo invalido.',
    ]);

    throw new RuntimeException('Unsupported feedback type should fail.');
} catch (InvalidArgumentException $e) {
    assertFeedbackValidator($e->getMessage() === 'Tipo de feedback nao suportado.', 'Unsupported type must keep the expected error.');
}

fwrite(STDOUT, "Feedback validator assertions passed.\n");
