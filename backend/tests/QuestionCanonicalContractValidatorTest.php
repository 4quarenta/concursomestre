<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/questions/validators/QuestionsValidator.php';

function assertCanonicalQuestionContract(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$validator = new QuestionsValidator();
$payload = [
    'id' => null,
    'source' => [
        'origin' => 'exam',
        'examId' => 41,
        'questionNumber' => 7,
        'contextTempId' => 'ctx_7',
        'sourcePage' => 3,
    ],
    'content' => [
        'statement' => 'Assinale a alternativa correta.',
        'statementClean' => 'Assinale a alternativa correta.',
        'supportText' => 'Texto de apoio.',
        'reference' => 'Fonte segura.',
    ],
    'assets' => [],
    'filters' => [
        'subjects' => [['label' => 'Direito Penal', 'slug' => 'direito-penal']],
        'topics' => [['label' => 'Teoria do crime', 'slug' => 'teoria-do-crime']],
        'subtopics' => [['label' => 'Tipicidade', 'slug' => 'tipicidade']],
        'examBoards' => [['id' => 1, 'label' => 'IBFC', 'slug' => 'ibfc']],
        'organizations' => [['label' => 'PM-PB', 'slug' => 'pm-pb']],
        'roles' => [['label' => 'Soldado', 'slug' => 'soldado']],
        'careers' => [['label' => 'Policial', 'slug' => 'policial']],
        'years' => [['label' => '2026', 'slug' => '2026']],
        'levels' => [['label' => 'Medio', 'slug' => 'medio']],
        'examTypes' => [['label' => 'Concurso', 'slug' => 'concurso']],
    ],
    'type' => 'single_choice',
    'difficulty' => 'medium',
    'alternatives' => [
        ['tempId' => 'alt_a', 'order' => 1, 'label' => 'A', 'text' => 'Alternativa A.', 'assets' => []],
        ['tempId' => 'alt_b', 'order' => 2, 'label' => 'B', 'text' => 'Alternativa B.', 'assets' => []],
    ],
    'answer' => ['mode' => 'single', 'raw' => 'B', 'correctAlternativeTempIds' => ['alt_b']],
    'editorial' => [
        ['type' => 'teacher_comment', 'title' => '', 'body' => 'Comentario do professor.', 'status' => 'draft'],
        ['type' => 'detailed_analysis', 'title' => '', 'body' => 'Analise detalhada.', 'status' => 'draft'],
    ],
    'publication' => ['status' => 'draft', 'visibility' => 'public', 'scheduledAt' => null],
    'review' => ['required' => true, 'status' => 'pending', 'reasons' => ['manual_review']],
];

$result = $validator->validateSavePayload($payload);
assertCanonicalQuestionContract($result['enunciado'] === 'Assinale a alternativa correta.', 'Statement canonico deve alimentar o enunciado.');
assertCanonicalQuestionContract($result['teacherComment'] === 'Comentario do professor.', 'Editorial teacher_comment deve ser preservado.');
assertCanonicalQuestionContract($result['detailedComment'] === 'Analise detalhada.', 'Editorial detailed_analysis deve ser preservado.');
assertCanonicalQuestionContract($result['resposta'] === 2, 'correctAlternativeTempIds deve resolver a alternativa correta.');
assertCanonicalQuestionContract($result['canonical_context_id'] === null, 'Contexto temporario nao deve ser tratado como ID numerico.');
assertCanonicalQuestionContract(is_array($result['canonical']) && ($result['canonical']['source']['contextTempId'] ?? null) === 'ctx_7', 'Contrato canonico completo deve ser preservado.');
assertCanonicalQuestionContract(
    ($result['canonical']['editorial'][0]['type'] ?? '') === 'teacher_comment'
    && ($result['canonical']['editorial'][0]['body'] ?? '') === 'Comentario do professor.',
    'O contrato canonico deve materializar o comentario do professor para a persistencia canonica.'
);
assertCanonicalQuestionContract(
    ($result['canonical']['editorial'][1]['type'] ?? '') === 'detailed_analysis'
    && ($result['canonical']['editorial'][1]['body'] ?? '') === 'Analise detalhada.',
    'O contrato canonico deve materializar a analise detalhada para a persistencia canonica.'
);
assertCanonicalQuestionContract(count($result['taxonomies']['banca']) === 1, 'examBoards deve ser normalizado para taxonomia de banca.');

$contextOnly = $validator->validateSavePayload([
    'enunciado' => '',
    'itens' => [
        ['rotulo' => 'A', 'corpo' => 'Alternativa A'],
        ['rotulo' => 'B', 'corpo' => 'Alternativa B'],
    ],
    'resposta' => 1,
], [
    'texto' => 'Texto associado compartilhado pelas questoes do grupo.',
    'assets' => [],
]);
assertCanonicalQuestionContract(
    $contextOnly['enunciado'] === '',
    'Uma questao com texto associado valido deve preservar o enunciado individual vazio.'
);

try {
    $validator->validateSavePayload([
        'enunciado' => '',
        'itens' => [
            ['rotulo' => 'A', 'corpo' => 'Alternativa A'],
            ['rotulo' => 'B', 'corpo' => 'Alternativa B'],
        ],
        'resposta' => 1,
    ]);
    throw new RuntimeException('Questao sem enunciado e sem contexto deveria ser rejeitada.');
} catch (InvalidArgumentException $error) {
    assertCanonicalQuestionContract(
        $error->getMessage() === 'Dados invalidos.',
        'A excecao de contexto nao pode liberar questoes sem qualquer conteudo.'
    );
}

foreach ([
    ['carreiras', [], 'carreira'],
    ['careers', [], 'area'],
    ['carreiras', ['sourceEntityType' => 'area'], 'area'],
    ['careers', ['sourceEntityType' => 'carreira'], 'carreira'],
    ['carreiras', ['source_entity_type' => 'area'], 'area'],
] as [$bucket, $identity, $expectedType]) {
    $question = $payload;
    unset($question['filters']['careers']);
    $question['filters'][$bucket] = [array_merge([
        'label' => 'Educacao', 'provider' => 'gran', 'externalId' => 7,
    ], $identity)];
    $validated = $validator->validateSavePayload($question);
    assertCanonicalQuestionContract(
        ($validated['taxonomies']['carreira'][0]['sourceEntityType'] ?? '') === $expectedType,
        "Gran {$bucket} must preserve its external namespace ({$expectedType})."
    );
    assertCanonicalQuestionContract(
        $validated['taxonomies']['carreira'][0]['externalId'] === 7,
        'Provider identity must not be replaced by a name or local ID.'
    );
}

fwrite(STDOUT, "Question canonical contract validator assertions passed.\n");
