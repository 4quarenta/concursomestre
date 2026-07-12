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
 * Controller fino do slice oficial de questoes.
 * Recebe a entrada HTTP e delega a regra ao service.
 *
 * @since 1.0.0
 */
class QuestionsController
{
    /**
     * Injeta o service principal de questoes.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly QuestionsService $service)
    {
    }

    /**
     * Encaminha a resposta de uma questao.
     *
     * @since 1.0.0
     */
    public function submitAnswer(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        return $this->service->submitAnswer($authenticatedUserId, $isAdmin, $payload);
    }

    /**
     * Encaminha resposta usando o contrato v2 por identificador de alternativa.
     *
     * @since 1.0.0
     */
    public function submitAnswerV2(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        return $this->service->submitAnswerV2($authenticatedUserId, $isAdmin, $payload);
    }

    /**
     * Lista questoes para a tela principal.
     *
     * @since 1.0.0
     */
    public function listQuestions(
        ?string $authenticatedUserId,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis,
        array $query
    ): array {
        return $this->service->listQuestions(
            $authenticatedUserId,
            $canViewTeacherComments,
            $canViewDetailedAnalysis,
            $query
        );
    }

    /**
     * Lista questoes no contrato publico v2, leve e sem campos legados.
     *
     * @since 1.0.0
     */
    public function listQuestionsV2(?string $authenticatedUserId, array $query): array
    {
        return $this->service->listQuestionsV2($authenticatedUserId, $query);
    }

    /**
     * Carrega uma questao publica isolada para rotas indexaveis e compartilhamento.
     *
     * @since 1.0.0
     */
    public function getQuestionDetails(
        ?string $authenticatedUserId,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis,
        array $query
    ): array {
        return $this->service->getQuestionDetails(
            $authenticatedUserId,
            $canViewTeacherComments,
            $canViewDetailedAnalysis,
            $query
        );
    }

    /**
     * Carrega detalhe de pratica no contrato v2 sem gabarito/editoriais.
     *
     * @since 1.0.0
     */
    public function getQuestionPracticeV2(?string $authenticatedUserId, array $query): array
    {
        return $this->service->getQuestionPracticeV2($authenticatedUserId, $query);
    }

    /**
     * Carrega detalhe administrativo v2 com gabarito e editoriais.
     *
     * @since 1.0.0
     */
    public function getQuestionAdminV2(string $authenticatedUserId, bool $isAdmin, array $query): array
    {
        return $this->service->getQuestionAdminV2($authenticatedUserId, $isAdmin, $query);
    }

    /**
     * Aplica filtros avancados de questoes.
     *
     * @since 1.0.0
     */
    public function filterQuestions(
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis,
        array $query
    ): array {
        return $this->service->filterQuestions(
            $canViewTeacherComments,
            $canViewDetailedAnalysis,
            $query
        );
    }

    /**
     * Retorna estatisticas agregadas da questao.
     *
     * @since 1.0.0
     */
    public function getQuestionStats(array $query): array
    {
        return $this->service->getQuestionStats($query);
    }

    /**
     * Cria ou atualiza uma questao no fluxo admin.
     *
     * @since 1.0.0
     */
    public function saveQuestion(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        return $this->service->saveQuestion($authenticatedUserId, $isAdmin, $payload);
    }

    /**
     * Importa em lote questoes extraidas de PDF oficial.
     *
     * @since 1.0.0
     */
    public function bulkImportQuestions(string $authenticatedUserId, bool $isAdmin, array $payload, ?array $proofPdfFile = null): array
    {
        return $this->service->bulkImportQuestions($authenticatedUserId, $isAdmin, $payload, $proofPdfFile);
    }

    /**
     * Cria ou atualiza apenas o registro da prova importada.
     *
     * @since 1.0.0
     */
    public function createImportedExam(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        return $this->service->createImportedExam($authenticatedUserId, $isAdmin, $payload);
    }

    /**
     * Envia um arquivo oficial vinculado ao cadastro de prova.
     *
     * @since 1.0.0
     */
    public function uploadExamAttachment(string $authenticatedUserId, bool $isAdmin, ?array $file, string $kind): array
    {
        return $this->service->uploadExamAttachment($authenticatedUserId, $isAdmin, $file, $kind);
    }

    /**
     * Busca uma questao pronta para edicao.
     *
     * @since 1.0.0
     */
    public function getQuestionForEdit(string $authenticatedUserId, bool $isAdmin, array $query): array
    {
        return $this->service->getQuestionForEdit($authenticatedUserId, $isAdmin, $query);
    }

    /**
     * Remove uma questao pelo fluxo admin.
     *
     * @since 1.0.0
     */
    public function deleteQuestion(string $authenticatedUserId, bool $isAdmin, array $query): void
    {
        $this->service->deleteQuestion($authenticatedUserId, $isAdmin, $query);
    }

    /**
     * Lista contextos de questoes reutilizaveis.
     *
     * @since 1.0.0
     */
    public function listQuestionGroups(string $authenticatedUserId, bool $isAdmin, array $query): array
    {
        return $this->service->listQuestionGroups($authenticatedUserId, $isAdmin, $query);
    }

    /**
     * Cria ou atualiza um contexto de questoes.
     *
     * @since 1.0.0
     */
    public function saveQuestionGroup(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        return $this->service->saveQuestionGroup($authenticatedUserId, $isAdmin, $payload);
    }

    /**
     * Envia imagem para um contexto de questoes.
     *
     * @since 1.0.0
     */
    public function uploadQuestionGroupImage(string $authenticatedUserId, bool $isAdmin, ?array $file): array
    {
        return $this->service->uploadQuestionGroupImage($authenticatedUserId, $isAdmin, $file);
    }
    /**
     * Remove um contexto de questoes.
     *
     * @since 1.0.0
     */
    public function deleteQuestionGroup(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        return $this->service->deleteQuestionGroup($authenticatedUserId, $isAdmin, $payload);
    }
    /**
     * Consulta o historico de respostas da questao.
     *
     * @since 1.0.0
     */
    public function getQuestionHistory(?array $authenticatedUserPayload, array $query): array
    {
        return $this->service->getQuestionHistory($authenticatedUserPayload, $query);
    }

    /**
     * Reseta respostas do usuario para a questao.
     *
     * @since 1.0.0
     */
    public function resetAnswers(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        return $this->service->resetAnswers($authenticatedUserId, $isAdmin, $payload);
    }

    /**
     * Alterna o estado salvo da questao.
     *
     * @since 1.0.0
     */
    public function toggleSavedQuestion(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        return $this->service->toggleSavedQuestion($authenticatedUserId, $isAdmin, $payload);
    }
}
