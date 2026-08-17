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

require_once dirname(__DIR__) . '/modules/legal_commentary/projections/PublicLegalCommentaryProjection.php';
require_once dirname(__DIR__) . '/modules/seo/services/PublicSeoEnvelopeService.php';

function publicLawAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/** @param mixed $value */
function publicLawContainsForbiddenKey(mixed $value): bool
{
    $forbidden = [
        'syncLogs', 'isAdmin', 'reportedCount', 'previousText',
        'avoidRepetitionNote', 'teacherComments', 'examTips',
    ];

    if (!is_array($value)) {
        return false;
    }

    foreach ($value as $key => $item) {
        if (is_string($key) && in_array($key, $forbidden, true)) {
            return true;
        }
        if (publicLawContainsForbiddenKey($item)) {
            return true;
        }
    }

    return false;
}

try {
    $fixture = require __DIR__ . '/fixtures/legal-commentary/protected-law-detail.v1.php';
    $projection = (new PublicLegalCommentaryProjection())->project($fixture, false);
    $encoded = json_encode($projection, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

    foreach ([
        'SECRET_EDITORIAL_SENTINEL_123',
        'SECRET_SUMMARY_SENTINEL_456',
        'SECRET_BLOCK_SENTINEL_789',
        'SECRET_DOCTRINE_SENTINEL_321',
        'SECRET_JURISPRUDENCE_SENTINEL_654',
        'SECRET_SUMULA_SENTINEL_852',
        'SECRET_TIP_SENTINEL_741',
        'SECRET_PREVIOUS_TEXT_SENTINEL_987',
        'SECRET_ADMIN_SENTINEL_963',
    ] as $sentinel) {
        publicLawAssert(!str_contains($encoded, $sentinel), 'Payload anonimo expos ' . $sentinel . '.');
    }

    publicLawAssert(!publicLawContainsForbiddenKey($projection), 'Payload anonimo expos propriedade privada.');
    publicLawAssert(($projection['articles'][0]['text'] ?? null) === 'Texto legal publico.', 'Texto legal publico foi removido.');
    publicLawAssert(($projection['sectionEditorials'][0]['hasContent'] ?? false) === true, 'Disponibilidade editorial deve permanecer visivel.');
    publicLawAssert(($projection['sectionEditorials'][0]['access'] ?? null) === 'locked', 'Editorial anonimo deve permanecer bloqueado.');

    $authenticatedWithoutPlan = (new PublicLegalCommentaryProjection())->project($fixture, true);
    $authenticatedWithoutPlanEncoded = json_encode($authenticatedWithoutPlan, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    foreach (['SECRET_EDITORIAL_SENTINEL_123', 'SECRET_SUMMARY_SENTINEL_456', 'SECRET_BLOCK_SENTINEL_789'] as $sentinel) {
        publicLawAssert(!str_contains($authenticatedWithoutPlanEncoded, $sentinel), 'Usuario sem plano recebeu ' . $sentinel . '.');
    }

    $publicEnvelope = (new PublicSeoEnvelopeService())->attachLaw($projection);
    $publicEnvelopeEncoded = json_encode($publicEnvelope, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    foreach (['SECRET_EDITORIAL_SENTINEL_123', 'SECRET_SUMMARY_SENTINEL_456', 'SECRET_BLOCK_SENTINEL_789'] as $sentinel) {
        publicLawAssert(!str_contains($publicEnvelopeEncoded, $sentinel), 'Envelope SEO expos ' . $sentinel . '.');
    }
    publicLawAssert(
        ($publicEnvelope['seoFacts']['content']['commentaryExcerpt'] ?? null) === '',
        'SeoFacts da lei deve manter o editorial protegido vazio.'
    );

    $authorizedFixture = $fixture;
    foreach (['lei.comentario_basico', 'lei.doutrina', 'lei.macete', 'lei.jurisprudencia', 'lei.sumulas', 'lei.raiox'] as $featureKey) {
        $authorizedFixture['features'][$featureKey]['enabled'] = true;
        $authorizedFixture['features'][$featureKey]['mode'] = 'full';
    }
    $authorized = (new PublicLegalCommentaryProjection())->project($authorizedFixture, true);
    $authorizedEncoded = json_encode($authorized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

    publicLawAssert(str_contains($authorizedEncoded, 'SECRET_EDITORIAL_SENTINEL_123'), 'Fluxo autorizado perdeu o comentario editorial.');
    publicLawAssert(str_contains($authorizedEncoded, 'SECRET_DOCTRINE_SENTINEL_321'), 'Fluxo autorizado perdeu a doutrina.');
    publicLawAssert(!str_contains($authorizedEncoded, 'SECRET_ADMIN_SENTINEL_963'), 'Fluxo autorizado expos diagnostico administrativo.');
    publicLawAssert(!str_contains($authorizedEncoded, 'SECRET_PREVIOUS_TEXT_SENTINEL_987'), 'Fluxo autorizado expos historico interno do bloco legal.');

    $routesSource = (string) file_get_contents(dirname(__DIR__) . '/modules/legal_commentary/routes.php');
    $projectPosition = strpos($routesSource, 'PublicLegalCommentaryProjection())->project');
    $envelopePosition = strpos($routesSource, 'attachLaw($publicLaw)');
    publicLawAssert($projectPosition !== false && $envelopePosition !== false && $projectPosition < $envelopePosition, 'Endpoint deve projetar antes de anexar o envelope SEO.');
    publicLawAssert(str_contains($routesSource, 'Cache-Control: private, no-store'), 'Endpoint contextual deve impedir cache compartilhado.');

    echo "LegalCommentaryPublicProjectionSecurityTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'LegalCommentaryPublicProjectionSecurityTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
