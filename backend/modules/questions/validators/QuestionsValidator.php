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
 * Validator oficial do slice de progresso de questes.
 */
require_once __DIR__ . '/../../../shared/security/UploadSecurity.php';

class QuestionsValidator
{
    /**
     * Valida o payload de resposta submetida pelo usurio.
      * @since 1.0.0
     */
    public function validateAnswerPayload(array $payload): array
    {
        $missing = [];
        if (!array_key_exists('question_id', $payload) && !array_key_exists('questionId', $payload)) {
            $missing[] = 'question_id';
        }
        if (!array_key_exists('selected_option', $payload) && !array_key_exists('selectedOption', $payload)) {
            $missing[] = 'selected_option';
        }
        if ($missing !== []) {
            throw new InvalidArgumentException('Incomplete data. Missing: ' . implode(', ', $missing));
        }

        $selectedOption = $payload['selected_option'] ?? $payload['selectedOption'];
        if (!is_numeric($selectedOption) || (int) $selectedOption < 0) {
            throw new InvalidArgumentException('Alternativa selecionada invalida.');
        }

        return [
            'requestedUserId' => $this->extractRequestedUserId($payload),
            'questionId' => $payload['question_id'] ?? $payload['questionId'],
            'selectedOption' => (int) $selectedOption,
            'timeTaken' => (int) ($payload['time_taken'] ?? $payload['timeTaken'] ?? 0),
            'simulationId' => ($payload['simulation_id'] ?? $payload['simulationId'] ?? null) ?: null,
        ];
    }

    /**
     * Valida o filtro de histrico por questo.
      * @since 1.0.0
     */
    public function validateHistoryQuery(array $query): array
    {
        $questionId = trim((string) ($query['question_id'] ?? $query['questionId'] ?? ''));
        if ($questionId === '') {
            throw new InvalidArgumentException('Question ID missing.');
        }

        return [
            'questionId' => $questionId,
            'requestedUserId' => $this->extractRequestedUserId($query),
        ];
    }

    /**
     * Valida os parametros da listagem principal de questes.
      * @since 1.0.0
     */
    public function validateListQuery(array $query): array
    {
        $page = (int) ($query['page'] ?? 1);
        $limit = (int) ($query['limit'] ?? 100);

        if ($page < 1) {
            $page = 1;
        }

        if ($limit < 1) {
            $limit = 10;
        }

        if ($limit > 500) {
            $limit = 500;
        }

        return [
            'page' => $page,
            'limit' => $limit,
            'offset' => ($page - 1) * $limit,
            'filters' => [
                'keyword' => trim((string) ($query['keyword'] ?? '')),
                'subject' => $this->normalizeListFilter($query['subject'] ?? $query['materia'] ?? null),
                'topic' => $this->normalizeListFilter($query['topic'] ?? $query['assunto'] ?? null),
                'difficulty' => $this->normalizeListFilter($query['difficulty'] ?? null),
                'agency' => $this->normalizeListFilter($query['agency'] ?? null),
                'organization' => $this->normalizeListFilter($query['organization'] ?? null),
                'year' => $this->normalizeListFilter($query['year'] ?? null),
                'level' => $this->normalizeListFilter($query['level'] ?? null),
                'role' => $this->normalizeListFilter($query['role'] ?? null),
                'career' => $this->normalizeListFilter($query['career'] ?? null),
                'modality' => $this->normalizeListFilter($query['modality'] ?? null),
                'questionIds' => $this->normalizeQuestionGroupIds($query['questionIds'] ?? $query['question_ids'] ?? $query['ids'] ?? null),
                'onlySaved' => $this->normalizeBooleanFilter($query['onlySaved'] ?? $query['only_saved'] ?? null),
                'hasTeacherComment' => $this->normalizeBooleanFilter($query['hasTeacherComment'] ?? $query['has_teacher_comment'] ?? null),
                'hasDetailedComment' => $this->normalizeBooleanFilter($query['hasDetailedComment'] ?? $query['has_detailed_comment'] ?? null),
                'excludeCanceled' => $this->normalizeBooleanFilter($query['excludeCanceled'] ?? $query['exclude_canceled'] ?? null),
                'excludeOutdated' => $this->normalizeBooleanFilter($query['excludeOutdated'] ?? $query['exclude_outdated'] ?? null),
                'excludeAnswered' => $this->normalizeBooleanFilter($query['excludeAnswered'] ?? $query['exclude_answered'] ?? null),
            ],
        ];
    }

    /**
     * Normaliza filtros multivalorados vindos da pratica.
     * @since 1.0.0
     */
    private function normalizeListFilter(mixed $value): array
    {
        $items = is_array($value) ? $value : explode(',', (string) ($value ?? ''));
        $normalized = [];
        foreach ($items as $item) {
            $text = trim((string) $item);
            if ($text === '' || strtolower($text) === 'all') {
                continue;
            }
            $normalized[$text] = $text;
        }

        return array_values($normalized);
    }

    /**
     * Normaliza flags booleanas sem confundir parametro ausente com false.
     * @since 1.0.0
     */
    private function normalizeBooleanFilter(mixed $value): bool
    {
        return in_array($value, [true, 1, '1', 'true', 'on', 'yes'], true);
    }

    /**
     * Valida os parametros do filtro administrativo de questes.
      * @since 1.0.0
     */
    public function validateFilterQuery(array $query): array
    {
        $page = (int) ($query['page'] ?? 1);
        $perPage = (int) ($query['per_page'] ?? $query['perPage'] ?? 20);
        $keyword = trim((string) ($query['keyword'] ?? ''));

        if ($page < 1) {
            $page = 1;
        }

        if ($perPage < 1) {
            $perPage = 20;
        }

        if ($perPage > 200) {
            $perPage = 200;
        }

        return [
            'page' => $page,
            'perPage' => $perPage,
            'offset' => ($page - 1) * $perPage,
            'keyword' => $keyword,
        ];
    }

    /**
     * Valida o identificador da questo para consulta de estatisticas.
      * @since 1.0.0
     */
    public function validateStatsQuery(array $query): array
    {
        $questionId = trim((string) ($query['question_id'] ?? $query['questionId'] ?? ''));
        if ($questionId === '') {
            throw new InvalidArgumentException('Missing question_id');
        }

        return [
            'questionId' => $questionId,
        ];
    }

    /**
     * Valida o id de questo em operaes administrativas.
      * @since 1.0.0
     */
    public function validateQuestionIdentityQuery(
        array $query,
        string $missingMessage = 'ID da questo no fornecido.'
    ): array {
        $questionId = trim((string) ($query['id'] ?? $query['question_id'] ?? $query['questionId'] ?? ''));
        if ($questionId === '') {
            throw new InvalidArgumentException($missingMessage);
        }

        return [
            'questionId' => $questionId,
        ];
    }

    /**
     * Valida o payload de criacao/edicao de questo.
      * @since 1.0.0
     */
    public function validateSavePayload(array $payload): array
    {
        $payload = $this->normalizeCanonicalQuestionPayload($payload);
        $statement = trim((string) ($payload['enunciado'] ?? ''));
        if ($statement === '') {
            throw new InvalidArgumentException('Dados invalidos.');
        }

        $publishStatus = $this->normalizePublishStatus(
            $payload['publishStatus']
            ?? $payload['publish_status']
            ?? $payload['publicationStatus']
            ?? $payload['publication_status']
            ?? $payload['editorialStatus']
            ?? $payload['editorial_status']
            ?? $payload['status']
            ?? 'published'
        );
        $visibilityStatus = $this->normalizeVisibilityStatus(
            $payload['visibilityStatus']
            ?? $payload['visibility_status']
            ?? $payload['visibility']
            ?? 'public'
        );
        $scheduledAt = $publishStatus === 'scheduled'
            ? $this->normalizeDateTimeForSql(
                $payload['scheduledAt']
                ?? $payload['scheduled_at']
                ?? $payload['publishAt']
                ?? $payload['publish_at']
                ?? null
            )
            : null;

        if ($publishStatus === 'scheduled' && $scheduledAt === null) {
            throw new InvalidArgumentException('Informe a data de publicacao programada.');
        }

        $publishedAt = $this->normalizeDateTimeForSql(
            $payload['publishedAt']
            ?? $payload['published_at']
            ?? $payload['publicationDate']
            ?? $payload['publication_date']
            ?? null
        );

        if ($publishStatus === 'published' && $publishedAt === null) {
            $publishedAt = date('Y-m-d H:i:s');
        }

        $groupPayload = is_array($payload['grupoQuestao'] ?? null) ? $payload['grupoQuestao'] : [];
        $groupId = $payload['grupoQuestaoId']
            ?? $payload['grupo_questao_id']
            ?? $payload['groupId']
            ?? $payload['group_id']
            ?? ($groupPayload['id'] ?? null);

        return [
            'id' => isset($payload['id']) && $payload['id'] !== '' ? (string) $payload['id'] : null,
            'enunciado' => $statement,
            'enunciado_clean' => trim((string) ($payload['enunciado_clean'] ?? strip_tags($statement))),
            'tipo' => $this->normalizeQuestionType($payload['tipo'] ?? 'multipla_escolha'),
            'dificuldade' => max(1, (int) ($payload['dificuldade'] ?? 1)),
            'intro_text' => (string) ($payload['introText'] ?? $payload['intro_text'] ?? ''),
            'reference_text' => (string) ($payload['referenceText'] ?? $payload['reference_text'] ?? ''),
            'prova_id' => $payload['provaId'] ?? $payload['prova_id'] ?? null,
            'grupo_questao_id' => is_numeric($groupId) && (int) $groupId > 0 ? (int) $groupId : null,
            'itens' => is_array($payload['itens'] ?? null) ? $payload['itens'] : [],
            'resposta' => $payload['resposta'] ?? null,
            'teacherComment' => (string) ($payload['teacherComment'] ?? ''),
            'detailedComment' => (string) ($payload['detailedComment'] ?? ''),
            'imageUrl' => (string) ($payload['imageUrl'] ?? ''),
            'source_page' => $payload['sourcePage'] ?? $payload['source_page'] ?? null,
            'question_number' => $payload['questionNumber'] ?? $payload['question_number'] ?? null,
            'support_context_key' => (string) ($payload['contextKey'] ?? $payload['supportContextKey'] ?? $payload['support_context_key'] ?? ''),
            'canonical_context_id' => is_numeric($payload['canonicalContextId'] ?? $payload['canonical_context_id'] ?? null)
                ? (int) ($payload['canonicalContextId'] ?? $payload['canonical_context_id'])
                : null,
            'figure_description' => (string) ($payload['figureDescription'] ?? $payload['figure_description'] ?? ''),
            'question_origin' => $this->normalizeQuestionOrigin(
                $payload['questionOrigin']
                ?? $payload['question_origin']
                ?? $payload['sourceType']
                ?? $payload['source_type']
                ?? null,
                !empty($payload['provaId'] ?? $payload['prova_id'] ?? null)
            ),
            'anulada' => !empty($payload['anulada']),
            'desatualizada' => !empty($payload['desatualizada']),
            'publish_status' => $publishStatus,
            'visibility_status' => $visibilityStatus,
            'scheduled_at' => $scheduledAt,
            'published_at' => $publishedAt,
            'needsReview' => !empty($payload['needsReview'] ?? $payload['needs_review'] ?? false),
            'statusReasons' => is_array($payload['statusReasons'] ?? null) ? $payload['statusReasons'] : [],
            'taxonomies' => [
                'banca' => is_array($payload['bancas'] ?? null) ? $payload['bancas'] : [],
                'orgao' => is_array($payload['orgaos'] ?? null) ? $payload['orgaos'] : [],
                'cargo' => is_array($payload['cargos'] ?? null) ? $payload['cargos'] : [],
                'assunto' => is_array($payload['assuntos'] ?? null) ? $payload['assuntos'] : [],
                'ano' => is_array($payload['anos'] ?? null) ? $payload['anos'] : [],
                'carreira' => is_array($payload['carreiras'] ?? null)
                    ? $payload['carreiras']
                    : (is_array($payload['focos'] ?? null) ? $payload['focos'] : []),
                'nivel' => is_array($payload['niveis'] ?? null)
                    ? $payload['niveis']
                    : (is_array($payload['levels'] ?? null) ? $payload['levels'] : []),
                'tipo_prova' => is_array($payload['tiposProva'] ?? null)
                    ? $payload['tiposProva']
                    : (is_array($payload['tipos_prova'] ?? null) ? $payload['tipos_prova'] : []),
                'modalidade' => is_array($payload['modalidades'] ?? null) ? $payload['modalidades'] : [],
            ],
            // The public request contract is kept intact for normalized
            // persistence. Legacy fields above only support older readers.
            'canonical' => is_array($payload['_canonical_contract'] ?? null)
                ? $payload['_canonical_contract']
                : null,
        ];
    }

    /**
     * Converte o contrato canonico do frontend para o formato interno legado.
     *
     * @since 1.0.0
     */
    private function normalizeCanonicalQuestionPayload(array $payload): array
    {
        $hasCanonicalShape = is_array($payload['content'] ?? null)
            || is_array($payload['source'] ?? null)
            || is_array($payload['filters'] ?? null)
            || is_array($payload['alternatives'] ?? null)
            || is_array($payload['answer'] ?? null)
            || is_array($payload['editorialComments'] ?? null)
            || is_array($payload['editorial'] ?? null)
            || is_array($payload['publication'] ?? null)
            || is_array($payload['review'] ?? null);

        if (!$hasCanonicalShape) {
            return $payload;
        }

        $canonicalContract = $payload;

        $content = is_array($payload['content'] ?? null) ? $payload['content'] : [];
        $source = is_array($payload['source'] ?? null) ? $payload['source'] : [];
        $filters = is_array($payload['filters'] ?? null) ? $payload['filters'] : [];
        $answer = is_array($payload['answer'] ?? null) ? $payload['answer'] : [];
        $editorialComments = is_array($payload['editorialComments'] ?? null) ? $payload['editorialComments'] : [];
        $editorials = is_array($payload['editorial'] ?? null) ? $payload['editorial'] : [];
        $publication = is_array($payload['publication'] ?? null) ? $payload['publication'] : [];
        $review = is_array($payload['review'] ?? null) ? $payload['review'] : [];
        $alternatives = is_array($payload['alternatives'] ?? null) ? $payload['alternatives'] : [];
        $assets = is_array($payload['assets'] ?? null) ? $payload['assets'] : [];

        $payload['enunciado'] = (string) ($content['statement'] ?? $payload['enunciado'] ?? '');
        $payload['enunciado_clean'] = (string) ($payload['enunciado_clean'] ?? strip_tags($payload['enunciado']));
        $payload['introText'] = (string) ($content['supportText'] ?? $content['support_text'] ?? $payload['introText'] ?? $payload['intro_text'] ?? '');
        $payload['referenceText'] = (string) ($content['reference'] ?? $content['referenceText'] ?? $content['reference_text'] ?? $payload['referenceText'] ?? $payload['reference_text'] ?? '');
        $payload['provaId'] = $source['examId'] ?? $source['exam_id'] ?? $payload['provaId'] ?? $payload['prova_id'] ?? null;
        $payload['grupoQuestaoId'] = $source['questionGroupId'] ?? $source['question_group_id'] ?? $payload['grupoQuestaoId'] ?? $payload['grupo_questao_id'] ?? null;
        $payload['contextTempId'] = $source['contextTempId']
            ?? $source['context_temp_id']
            ?? $payload['contextTempId']
            ?? $payload['context_temp_id']
            ?? null;
        $payload['questionOrigin'] = $source['origin'] ?? $payload['questionOrigin'] ?? $payload['question_origin'] ?? null;
        $payload['questionNumber'] = $source['questionNumber'] ?? $source['question_number'] ?? $payload['questionNumber'] ?? $payload['question_number'] ?? null;
        $payload['sourcePage'] = $source['sourcePage'] ?? $source['source_page'] ?? $payload['sourcePage'] ?? $payload['source_page'] ?? null;
        $payload['teacherComment'] = (string) ($this->resolveCanonicalEditorialBody($editorials, 'teacher_comment')
            ?? $editorialComments['teacherComment']
            ?? $editorialComments['teacher_comment']
            ?? $payload['teacherComment']
            ?? '');
        $payload['detailedComment'] = (string) ($this->resolveCanonicalEditorialBody($editorials, 'detailed_analysis')
            ?? $editorialComments['detailedComment']
            ?? $editorialComments['detailed_comment']
            ?? $payload['detailedComment']
            ?? '');
        $payload['tipo'] = $this->normalizeCanonicalQuestionType($payload['type'] ?? $payload['questionType'] ?? $payload['question_type'] ?? $payload['tipo'] ?? null);
        $payload['dificuldade'] = $this->normalizeCanonicalQuestionDifficulty($payload['difficulty'] ?? $payload['dificuldade'] ?? null);
        $payload['itens'] = $this->normalizeCanonicalAlternatives($alternatives);
        $payload['resposta'] = $this->normalizeCanonicalAnswer($answer, $payload['itens']);
        $payload['publishStatus'] = $publication['status'] ?? $payload['publishStatus'] ?? $payload['publish_status'] ?? 'published';
        $payload['visibilityStatus'] = $publication['visibility'] ?? $payload['visibilityStatus'] ?? $payload['visibility_status'] ?? 'public';
        $payload['scheduledAt'] = $publication['scheduledAt'] ?? $publication['scheduled_at'] ?? $payload['scheduledAt'] ?? $payload['scheduled_at'] ?? null;
        $payload['needsReview'] = !empty($review['required'] ?? $review['needsReview'] ?? $review['needs_review'] ?? false);
        $payload['statusReasons'] = is_array($review['reasons'] ?? null)
            ? $review['reasons']
            : (is_array($review['statusReasons'] ?? null) ? $review['statusReasons'] : ($payload['statusReasons'] ?? []));
        $payload['imageUrl'] = $payload['imageUrl'] ?? $this->resolveCanonicalImageUrl($assets);

        $payload['bancas'] = $this->normalizeCanonicalFilterItems($filters['examBoards'] ?? $filters['bancas'] ?? []);
        $payload['orgaos'] = $this->normalizeCanonicalFilterItems($filters['organizations'] ?? $filters['orgaos'] ?? []);
        $payload['cargos'] = $this->normalizeCanonicalFilterItems($filters['roles'] ?? $filters['cargos'] ?? []);
        $payload['carreiras'] = $this->normalizeCanonicalFilterItems($filters['careers'] ?? $filters['carreiras'] ?? []);
        $payload['anos'] = $this->normalizeCanonicalFilterItems($filters['years'] ?? $filters['anos'] ?? []);
        $payload['niveis'] = $this->normalizeCanonicalFilterItems($filters['levels'] ?? $filters['niveis'] ?? []);
        $payload['tiposProva'] = $this->normalizeCanonicalFilterItems($filters['examTypes'] ?? $filters['tiposProva'] ?? $filters['tipos_prova'] ?? []);
        $payload['assuntos'] = array_values(array_merge(
            $this->normalizeCanonicalFilterItems($filters['subjects'] ?? $filters['materias'] ?? [], ['materia' => true, 'taxonomyLevel' => 'materia', 'taxonomy_level' => 'materia']),
            $this->normalizeCanonicalFilterItems($filters['topics'] ?? $filters['topicos'] ?? [], ['materia' => false, 'taxonomyLevel' => 'topico', 'taxonomy_level' => 'topico']),
            $this->normalizeCanonicalFilterItems($filters['subtopics'] ?? $filters['assuntos'] ?? [], ['materia' => false, 'taxonomyLevel' => 'assunto', 'taxonomy_level' => 'assunto'])
        ));
        $payload['_canonical_contract'] = $canonicalContract;

        return $payload;
    }

    /**
     * Normaliza alternativas canonicas para o payload interno.
     *
     * @since 1.0.0
     */
    private function normalizeCanonicalAlternatives(array $alternatives): array
    {
        $items = [];

        foreach (array_values($alternatives) as $index => $alternative) {
            if (!is_array($alternative)) {
                continue;
            }

            $label = trim((string) ($alternative['label'] ?? chr(65 + $index)));
            $text = (string) ($alternative['text'] ?? $alternative['body'] ?? '');
            $order = (int) ($alternative['order'] ?? ($index + 1));

            $items[] = [
                'id' => $order,
                'ordem' => $order,
                'rotulo' => $label !== '' ? $label : chr(65 + $index),
                'corpo' => $text,
                'corpo_clean' => trim(strip_tags($text)),
                'canonical_id' => (string) ($alternative['tempId'] ?? $alternative['id'] ?? ''),
            ];
        }

        return $items;
    }

    /**
     * Normaliza gabarito canonico para a alternativa interna.
     *
     * @since 1.0.0
     */
    private function normalizeCanonicalAnswer(array $answer, array $items): mixed
    {
        $alternativeIds = is_array($answer['correctAlternativeTempIds'] ?? null)
            ? $answer['correctAlternativeTempIds']
            : [];
        $alternativeId = trim((string) ($answer['alternativeId'] ?? $answer['alternative_id'] ?? $alternativeIds[0] ?? ''));
        $value = $answer['raw'] ?? $answer['value'] ?? null;

        foreach ($items as $item) {
            if ($alternativeId !== '' && $alternativeId === (string) ($item['canonical_id'] ?? '')) {
                return $item['id'];
            }

            if ($value !== null && strtoupper((string) $value) === strtoupper((string) ($item['rotulo'] ?? ''))) {
                return $item['id'];
            }

            if ($value !== null && (string) $value === (string) ($item['id'] ?? '')) {
                return $item['id'];
            }
        }

        return $value;
    }

    /**
     * Normaliza o tipo de questao vindo do contrato canonico.
     *
     * @since 1.0.0
     */
    private function normalizeCanonicalQuestionType(mixed $type): string
    {
        $normalized = strtolower(trim((string) $type));

        if (in_array($normalized, ['true_false', 'boolean', 'certo_errado', 'certo ou errado'], true)) {
            return 'certo ou errado';
        }

        return 'multipla escolha';
    }

    /**
     * Normaliza dificuldade canonica para o enum numerico interno.
     *
     * @since 1.0.0
     */
    private function normalizeCanonicalQuestionDifficulty(mixed $difficulty): int
    {
        $normalized = strtolower(trim((string) $difficulty));

        if (in_array($normalized, ['1', 'easy', 'facil', 'fácil'], true)) {
            return 1;
        }

        if (in_array($normalized, ['3', 'hard', 'dificil', 'difícil'], true)) {
            return 3;
        }

        return 2;
    }

    /**
     * Finds one editorial body in the canonical editorial collection.
     */
    private function resolveCanonicalEditorialBody(array $editorials, string $type): ?string
    {
        foreach ($editorials as $editorial) {
            if (!is_array($editorial) || (string) ($editorial['type'] ?? '') !== $type) {
                continue;
            }

            return (string) ($editorial['body'] ?? '');
        }

        return null;
    }

    /**
     * Resolve a primeira imagem persistivel recebida no contrato canonico.
     *
     * @since 1.0.0
     */
    private function resolveCanonicalImageUrl(array $assets): string
    {
        foreach ($assets as $asset) {
            if (!is_array($asset)) {
                continue;
            }

            $url = trim((string) ($asset['url'] ?? ''));
            if ($url !== '') {
                return $url;
            }

            $base64 = trim((string) ($asset['base64'] ?? ''));
            if ($base64 !== '') {
                return $base64;
            }
        }

        return '';
    }

    /**
     * Normaliza filtros canonicos para a estrutura usada pelo repositório.
     *
     * @since 1.0.0
     */
    private function normalizeCanonicalFilterItems(mixed $values, array $extra = []): array
    {
        if (!is_array($values)) {
            return [];
        }

        $items = [];
        foreach ($values as $value) {
            if (is_array($value)) {
                $label = trim((string) ($value['label'] ?? $value['name'] ?? $value['nome'] ?? $value['sigla'] ?? ''));
                if ($label === '') {
                    continue;
                }

                $items[] = array_merge($value, [
                    'id' => $value['id'] ?? null,
                    'name' => $value['name'] ?? $value['nome'] ?? $label,
                    'nome' => $value['nome'] ?? $value['name'] ?? $label,
                    'sigla' => $value['sigla'] ?? $label,
                    'slug' => $value['slug'] ?? null,
                ], $extra);
                continue;
            }

            $label = trim((string) $value);
            if ($label === '') {
                continue;
            }

            $items[] = array_merge([
                'id' => null,
                'name' => $label,
                'nome' => $label,
                'sigla' => $label,
                'slug' => null,
            ], $extra);
        }

        return $items;
    }

    /**
     * Valida o arquivo PDF original usado pelo importador em massa.
     *
     * @since 1.0.0
     */
    public function validateExamPdfUpload(?array $file): ?array
    {
        if (!$file || !isset($file['error']) || (int) $file['error'] === UPLOAD_ERR_NO_FILE) {
            return null;
        }

        return UploadSecurity::validate($file, [
            'application/pdf' => ['extension' => 'pdf', 'maxSize' => 30 * 1024 * 1024],
        ], [
            'errorMessage' => 'Falha ao enviar o PDF da prova.',
            'emptyMessage' => 'O PDF da prova esta vazio.',
            'invalidTypeMessage' => 'Envie um arquivo PDF valido para a prova.',
        ]);
    }

    /**
     * Valida anexos manuais do cadastro de prova.
     *
     * @since 1.0.0
     */
    public function validateExamAttachmentUpload(?array $file): array
    {
        if (!$file || !isset($file['error']) || (int) $file['error'] === UPLOAD_ERR_NO_FILE) {
            throw new InvalidArgumentException('Arquivo da prova nao enviado.');
        }

        return UploadSecurity::validate($file, [
            'application/pdf' => ['extension' => 'pdf', 'maxSize' => 30 * 1024 * 1024],
            'image/jpeg' => ['extension' => 'jpg', 'maxSize' => 10 * 1024 * 1024],
            'image/png' => ['extension' => 'png', 'maxSize' => 10 * 1024 * 1024],
            'image/webp' => ['extension' => 'webp', 'maxSize' => 10 * 1024 * 1024],
        ], [
            'errorMessage' => 'Falha ao enviar o arquivo da prova.',
            'emptyMessage' => 'O arquivo da prova esta vazio.',
            'invalidTypeMessage' => 'Envie PDF, PNG, JPG ou WEBP.',
        ]);
    }

    /**
     * Valida o payload de contexto de questoes.
      * @since 1.0.0
     */
    public function validateQuestionGroupPayload(array $payload): array
    {
        $id = $payload['id'] ?? $payload['group_id'] ?? null;
        $text = trim((string) ($payload['body'] ?? $payload['texto'] ?? ''));
        if ($text === '') {
            $text = trim((string) (
                $payload['text']
                ?? $payload['richText']
                ?? $payload['rich_text']
                ?? $payload['enunciado']
                ?? $payload['statement']
                ?? ''
            ));
        }
        $assets = $this->normalizeQuestionContextAssets($payload['assets'] ?? []);
        $legacyImageUrl = trim((string) ($payload['image_url'] ?? $payload['imageUrl'] ?? ''));
        if ($assets === [] && $legacyImageUrl !== '') {
            $assets[] = [
                'id' => 'img_context_1',
                'type' => 'image',
                'usage' => 'context',
                'url' => $legacyImageUrl,
                'alt' => 'Imagem do contexto.',
                'order' => 1,
            ];
        }
        $questionIdsKey = null;
        foreach (['question_ids', 'questionIds', 'linked_question_ids', 'linkedQuestionIds'] as $key) {
            if (array_key_exists($key, $payload)) {
                $questionIdsKey = $key;
                break;
            }
        }

        if ($text === '' && $assets === []) {
            throw new InvalidArgumentException('Informe um texto ou imagem para o contexto.');
        }

        return [
            'id' => is_numeric($id) && (int) $id > 0 ? (int) $id : null,
            'texto' => $text,
            'assets' => $assets,
            'question_ids' => $questionIdsKey === null ? null : $this->normalizeQuestionGroupIds($payload[$questionIdsKey]),
            'canonical_context' => [
                'tempId' => trim((string) ($payload['tempId'] ?? $payload['contextKey'] ?? '')),
                'type' => trim((string) ($payload['type'] ?? 'shared')) ?: 'shared',
                'body' => $text,
                'bodyClean' => trim((string) ($payload['bodyClean'] ?? strip_tags($text))),
                'reference' => trim((string) ($payload['reference'] ?? '')),
                'sourcePage' => $payload['sourcePage'] ?? null,
                'assets' => $assets,
                'questionNumbers' => $payload['questionNumbers'] ?? [],
            ],
        ];
    }

    private function normalizeQuestionContextAssets(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $assets = [];
        foreach ($value as $index => $asset) {
            if (!is_array($asset)) {
                continue;
            }
            $url = trim((string) ($asset['url'] ?? ''));
            $base64 = trim((string) ($asset['base64'] ?? ''));
            if ($url === '' && $base64 === '') {
                continue;
            }
            $id = trim((string) ($asset['id'] ?? ''));
            if ($id === '') {
                $id = 'img_context_' . ((int) $index + 1);
            }
            $assets[$id] = [
                'id' => $id,
                'type' => 'image',
                'usage' => 'context',
                'url' => $url,
                'base64' => $base64,
                'alt' => trim((string) ($asset['alt'] ?? '')),
                'caption' => trim((string) ($asset['caption'] ?? '')),
                'sourcePage' => $asset['sourcePage'] ?? null,
                'order' => max(1, (int) ($asset['order'] ?? ((int) $index + 1))),
            ];
        }

        return array_values($assets);
    }
    /**
     * Valida a identidade de um contexto de questoes.
      * @since 1.0.0
     */
    public function validateQuestionGroupIdentity(array $payload): int
    {
        $id = $payload['id'] ?? $payload['group_id'] ?? $payload['groupId'] ?? null;
        if (!is_numeric($id) || (int) $id < 1) {
            throw new InvalidArgumentException('ID do contexto nao fornecido.');
        }

        return (int) $id;
    }

    /**
     * Valida a imagem enviada para um contexto de questoes.
     * @since 1.0.0
     */
    public function validateQuestionGroupImageUpload(?array $file): string
    {
        if (!$file || !isset($file['error'])) {
            throw new InvalidArgumentException('Imagem nao enviada.');
        }

        $upload = UploadSecurity::validate($file, [
            'image/jpeg' => ['extension' => 'jpg', 'maxSize' => 5 * 1024 * 1024],
            'image/png' => ['extension' => 'png', 'maxSize' => 5 * 1024 * 1024],
            'image/webp' => ['extension' => 'webp', 'maxSize' => 5 * 1024 * 1024],
            'image/gif' => ['extension' => 'gif', 'maxSize' => 5 * 1024 * 1024],
        ], [
            'errorMessage' => 'Falha ao enviar a imagem.',
            'emptyMessage' => 'A imagem enviada esta vazia.',
            'invalidTypeMessage' => 'Formato de imagem nao permitido.',
        ]);

        return $upload['extension'];
    }

    /**
     * Normaliza IDs de questoes vinculadas ao contexto.
     * @since 1.0.0
     */
    private function normalizeQuestionGroupIds(mixed $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        $items = is_array($value)
            ? $value
            : preg_split('/[\s,;]+/', (string) $value, -1, PREG_SPLIT_NO_EMPTY);
        $ids = [];

        foreach ($items ?: [] as $item) {
            if (!is_numeric($item) || (int) $item < 1) {
                throw new InvalidArgumentException('IDs das questoes vinculadas invalidos.');
            }
            $ids[(int) $item] = (int) $item;
        }

        return array_values($ids);
    }
    /**
     * Normaliza a origem editorial da questao.
     *
      * @since 1.0.0
     */
    private function normalizeQuestionOrigin(mixed $value, bool $hasProva = false): string
    {
        $normalized = strtolower(trim((string) $value));

        if (in_array($normalized, ['exam', 'concurso', 'prova', 'retirada_de_prova'], true)) {
            return 'exam';
        }

        if (in_array($normalized, ['platform', 'inedita', 'inédita', 'generated', 'gerada'], true)) {
            return 'platform';
        }

        return $hasProva ? 'exam' : 'platform';
    }

    /**
     * Valida payloads de reset e toggle save.
      * @since 1.0.0
     */
    public function validateScopedUserMutationPayload(array $payload, bool $requiresQuestionId = false): array
    {
        $normalized = [
            'requestedUserId' => $this->extractRequestedUserId($payload),
            'questionId' => null,
        ];

        if ($requiresQuestionId) {
            $questionId = $payload['question_id'] ?? $payload['questionId'] ?? null;
            if ($questionId === null || $questionId === '') {
                throw new InvalidArgumentException('Dados incompletos.');
            }
            $normalized['questionId'] = $questionId;
        }

        return $normalized;
    }

    /**
     * Resolve o escopo do usurio alvo respeitando administradores.
      * @since 1.0.0
     */
    public function resolveScopedUserId(
        string $authenticatedUserId,
        ?string $requestedUserId,
        bool $isAdmin
    ): string {
        if ($requestedUserId === null || $requestedUserId === '') {
            return $authenticatedUserId;
        }

        if ($requestedUserId === $authenticatedUserId) {
            return $authenticatedUserId;
        }

        if ($isAdmin) {
            return $requestedUserId;
        }

        throw new DomainException('Voc no pode consultar ou alterar o progresso de outro usurio.');
    }

    /**
     * Extrai o user_id legado quando presente.
      * @since 1.0.0
     */
    public function extractRequestedUserId(array $payload): ?string
    {
        $userId = trim((string) ($payload['user_id'] ?? $payload['userId'] ?? ''));
        return $userId !== '' ? $userId : null;
    }

    /**
     * Normaliza o tipo de questo para o enum persistido no banco.
      * @since 1.0.0
     */
    private function normalizeQuestionType(mixed $type): string
    {
        $normalized = strtolower(trim((string) $type));

        if ($normalized === 'certo ou errado' || $normalized === 'certo_errado') {
            return 'certo_errado';
        }

        return 'multipla_escolha';
    }

    /**
     * Normaliza o estado editorial salvo no painel.
     *
     * @since 1.0.0
     */
    private function normalizePublishStatus(mixed $status): string
    {
        $normalized = strtolower(trim((string) $status));

        if (in_array($normalized, ['draft', 'rascunho', 'pending', 'pendente'], true)) {
            return 'draft';
        }

        if (in_array($normalized, ['scheduled', 'programado'], true)) {
            return 'scheduled';
        }

        return 'published';
    }

    /**
     * Normaliza a visibilidade editorial da questao.
     *
     * @since 1.0.0
     */
    private function normalizeVisibilityStatus(mixed $status): string
    {
        $normalized = strtolower(trim((string) $status));

        if (in_array($normalized, ['elite', 'premium'], true)) {
            return 'elite';
        }

        if (in_array($normalized, ['internal', 'interno', 'private', 'privado'], true)) {
            return 'internal';
        }

        return 'public';
    }

    /**
     * Converte datas vindas do frontend para DATETIME SQL.
     *
     * @since 1.0.0
     */
    private function normalizeDateTimeForSql(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            $timestamp = (int) $value;
            if ($timestamp > 9999999999) {
                $timestamp = (int) floor($timestamp / 1000);
            }

            return date('Y-m-d H:i:s', $timestamp);
        }

        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }

        $timestamp = strtotime($raw);
        if ($timestamp === false) {
            return null;
        }

        return date('Y-m-d H:i:s', $timestamp);
    }
}
