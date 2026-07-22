<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/services/LegacyQuestionCanonicalMapper.php';

function legacyMapperAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$mapped = LegacyQuestionCanonicalMapper::map([
    'id' => 42,
    'resposta_correta_item_index' => 1,
    'data_json' => json_encode([
        'itens' => [
            ['rotulo' => 'A', 'corpo' => '<p>Primeira</p>', 'corpo_clean' => 'Primeira'],
            ['rotulo' => 'B', 'corpo' => '<p>Segunda</p>', 'corpo_clean' => 'Segunda'],
        ],
        'teacherComment' => 'Comentario real.',
        'detailedComment' => 'Analise real.',
    ], JSON_UNESCAPED_UNICODE),
]);

legacyMapperAssert(count($mapped['options']) === 2, 'As alternativas legadas devem ser materializadas.');
legacyMapperAssert($mapped['options'][0]['external_key'] === 'legacy_q42_alt_a', 'A chave canonica deve ser deterministica.');
legacyMapperAssert($mapped['options'][0]['is_correct'] === 0, 'A alternativa A nao deve ser marcada como correta.');
legacyMapperAssert($mapped['options'][1]['is_correct'] === 1, 'A alternativa B deve preservar o gabarito persistido.');
legacyMapperAssert(count($mapped['editorials']) === 2, 'Os dois editoriais reais devem ser preservados.');

$empty = LegacyQuestionCanonicalMapper::map([
    'id' => 43,
    'data_json' => json_encode(['itens' => []]),
]);
legacyMapperAssert($empty['options'] === [], 'Nao deve inventar alternativas ausentes.');
legacyMapperAssert($empty['editorials'] === [], 'Nao deve inventar editoriais ausentes.');

fwrite(STDOUT, json_encode([
    'test' => 'LegacyQuestionCanonicalMapperTest',
    'status' => 'PASS',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
