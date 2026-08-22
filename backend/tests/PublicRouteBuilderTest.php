<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/routes/PublicRouteBuilder.php';
require_once dirname(__DIR__) . '/modules/seo/services/SeoSlugService.php';

function publicRouteAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $policy = new StructuralRoutePolicy();
    $builder = new PublicRouteBuilder($policy);
    $defaultBuilder = new PublicRouteBuilder();
    $slugs = new SeoSlugService();

    publicRouteAssert($builder->questionsIndex() === '/questoes', 'Hub de questoes incorreto.');
    publicRouteAssert($defaultBuilder->questionsIndex() === '/questoes', 'Builder default divergente.');
    publicRouteAssert(
        $builder->questionDetail(123, $slugs->slug('Art. 5º - Ação & Controle', 'questao', 123))
            === '/questoes/123/art-5o-acao-e-controle',
        'Rota normativa da questao incorreta.'
    );
    publicRouteAssert(
        $builder->questionsIndex([
            'materia' => ['direito-constitucional', 'direito-administrativo'],
            'onlySaved' => 'true',
            'questionId' => 42,
        ]) === '/questoes?materia=direito-constitucional&materia=direito-administrativo&onlySaved=true&questionId=42',
        'Parametros repetidos da pratica nao foram preservados.'
    );
    publicRouteAssert(
        $builder->examDetail('slug-persistido-com-mais-de-80-caracteres-sem-normalizacao-adicional-1234567890')
            === '/provas/slug-persistido-com-mais-de-80-caracteres-sem-normalizacao-adicional-1234567890',
        'Slug persistido da prova foi alterado.'
    );
    publicRouteAssert(
        $builder->examsIndex(['ano' => 2026, 'regiao' => 'Nordeste', 'estado' => 'PB'])
            === '/provas?ano=2026&regiao=Nordeste&estado=PB',
        'Filtros publicos de provas foram alterados.'
    );
    publicRouteAssert(
        $builder->disciplinesIndex() === '/disciplinas'
            && $builder->disciplineDetail('direito-constitucional') === '/disciplinas/direito-constitucional',
        'Builder de disciplina incorreto.'
    );
    publicRouteAssert(
        $builder->topicDetail('controle-de-constitucionalidade') === '/topicos/controle-de-constitucionalidade'
            && $builder->subjectDetail('controle-concentrado') === '/assuntos/controle-concentrado',
        'Builders de topico/assunto divergentes.'
    );
    publicRouteAssert(
        $builder->boardsIndex() === '/bancas'
            && $builder->boardDetail('cebraspe') === '/bancas/cebraspe',
        'Builder PHP de banca divergente.'
    );
    publicRouteAssert(
        $builder->organizationsIndex(['letra' => 'P']) === '/orgaos?letra=P'
            && $builder->organizationDetail('policia-federal') === '/orgaos/policia-federal',
        'Builder PHP de orgao divergente.'
    );
    publicRouteAssert(
        $builder->careersIndex(['letra' => 'F']) === '/carreiras?letra=F'
            && $builder->careerDetail('carreira-fiscal') === '/carreiras/carreira-fiscal',
        'Builder PHP de carreira divergente.'
    );
    publicRouteAssert(
        $builder->positionsIndex(['busca' => 'auditor']) === '/cargos?busca=auditor'
            && $builder->positionDetail('auditor-fiscal') === '/cargos/auditor-fiscal',
        'Builder PHP de cargo divergente.'
    );
    publicRouteAssert(
        $builder->simulationsIndex() === '/simulados'
            && $builder->simulationDetail('simulado-publico') === '/simulados/simulado-publico',
        'Builder PHP de simulado publico divergente.'
    );
    publicRouteAssert(
        $builder->blogIndex() === '/blog'
            && $builder->blogArticleDetail('noticia-publica') === '/blog/noticia-publica'
            && $builder->blogCategoryDetail('editais') === '/blog/categoria/editais'
            && $builder->blogTagDetail('nordeste') === '/blog/tag/nordeste'
            && $builder->blogAuthorDetail(7) === '/blog/autor/7',
        'Builders PHP das taxonomias do blog divergentes.'
    );
    publicRouteAssert(
        in_array('/practice', $policy->patterns('questions_hub', true), true)
            && in_array('/questions', $policy->patterns('questions_hub', true), true),
        'Aliases antigos de questoes nao estao declarados na policy.'
    );

    $rejected = false;
    try {
        $builder->questionsIndex(['pagina' => 2]);
    } catch (InvalidArgumentException) {
        $rejected = true;
    }
    publicRouteAssert($rejected, 'Paginacao de questoes foi ativada indevidamente.');

    echo "PublicRouteBuilderTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, "PublicRouteBuilderTest: FAIL - " . $error->getMessage() . "\n");
    exit(1);
}
