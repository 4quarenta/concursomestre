<?php

require_once __DIR__ . '/../repositories/AdminReportWorkbenchRepository.php';
require_once __DIR__ . '/AdminUserCommunicationService.php';
require_once __DIR__ . '/../../ai/services/AiService.php';
require_once __DIR__ . '/../../ai/repositories/AiRepository.php';
require_once __DIR__ . '/../../ai/validators/AiValidator.php';
require_once __DIR__ . '/../../../config/notification_helper.php';
require_once __DIR__ . '/../../../shared/utils/SimpleCache.php';

/**
 * Orquestra revisao, rascunho, geracao e aplicacao contextual.
 */
class AdminReportWorkbenchService
{
    private const NON_FINAL_ACTIONS = [
        'request_more_information' => 'awaiting_user',
        'forward_to_teacher' => 'awaiting_teacher',
        'forward_to_legal_review' => 'awaiting_legal_review',
        'forward_to_manual_review' => 'awaiting_manual_review',
        'forward_to_technical_team' => 'awaiting_technical_team',
    ];

    private const ACTION_LABELS = [
        'change_question_answer' => 'Alterar gabarito',
        'annul_question' => 'Anular questão',
        'edit_question_statement' => 'Corrigir enunciado',
        'fix_question_formatting' => 'Aplicar correção de formatação',
        'update_question_classification' => 'Atualizar classificação',
        'replace_question_media' => 'Substituir mídia',
        'remove_question_media' => 'Remover mídia',
        'mark_question_outdated' => 'Marcar como desatualizada',
        'archive_question' => 'Arquivar questão',
        'update_legal_text' => 'Atualizar texto legal',
        'edit_legal_text' => 'Editar texto legal',
        'fix_legal_formatting' => 'Corrigir formatação do texto legal',
        'create_new_comment' => 'Aprovar e publicar novo comentário',
        'replace_existing_comment' => 'Substituir comentário existente',
        'append_existing_comment' => 'Complementar comentário existente',
        'edit_comment' => 'Editar comentário',
        'remove_comment' => 'Remover comentário',
        'hide_comment' => 'Ocultar comentário',
        'mark_comment_spam' => 'Marcar como spam',
        'warn_user' => 'Advertir usuário',
        'keep_current_content' => 'Manter conteúdo atual',
        'reject_report' => 'Rejeitar denúncia',
        'reject_request' => 'Rejeitar solicitação',
        'request_more_information' => 'Solicitar mais informações',
        'forward_to_teacher' => 'Encaminhar ao professor',
        'forward_to_legal_review' => 'Encaminhar à revisão jurídica',
        'forward_to_manual_review' => 'Encaminhar à revisão manual',
        'forward_to_technical_team' => 'Encaminhar ao suporte técnico',
    ];

    public function __construct(
        private readonly AdminReportWorkbenchRepository $repository,
        private readonly AdminUserCommunicationService $communicationService
    ) {
    }

    public function review(string $moderatorUserId, string $reportId): array
    {
        $this->repository->ensureInfrastructure();
        $report = $this->repository->findReport($reportId);
        if (!$report) {
            throw new OutOfBoundsException('Denúncia ou solicitação não encontrada.');
        }

        $reasonSlug = ReportReasonCatalog::normalizeReasonSlug(
            (string) ($report['reason'] ?? ''),
            (string) ($report['reason_slug'] ?? '')
        );
        $targetType = (string) ($report['target_type'] ?? '');
        $target = $this->repository->loadTarget($report);
        $actions = array_map(
            fn (string $actionSlug): array => $this->describeAction($actionSlug, $target, $reasonSlug),
            ReportReasonCatalog::allowedActions($targetType, $reasonSlug)
        );

        if (!$target['exists']) {
            $actions = array_values(array_filter(
                $actions,
                static fn (array $action): bool => in_array(
                    $action['slug'],
                    ['keep_current_content', 'request_more_information', 'forward_to_manual_review', 'reject_report'],
                    true
                )
            ));
        }

        return [
            'report' => $this->normalizeReport($report, $reasonSlug),
            'target' => $this->withoutRaw($target),
            'configuration' => [
                'title' => ReportReasonCatalog::title($targetType, $reasonSlug),
                'reportType' => ReportReasonCatalog::reportTypeForReason($reasonSlug),
                'reasonSlug' => $reasonSlug,
                'actions' => $actions,
            ],
            'draft' => $this->repository->findDraft($reportId, $moderatorUserId),
            'history' => $this->repository->listHistory($reportId),
        ];
    }

    public function saveDraft(string $moderatorUserId, array $payload): array
    {
        $this->repository->ensureInfrastructure();
        $reportId = trim((string) ($payload['report_id'] ?? ''));
        if ($reportId === '') {
            throw new InvalidArgumentException('Identificador do atendimento ausente.');
        }
        if (!$this->repository->findReport($reportId)) {
            throw new OutOfBoundsException('Denúncia ou solicitação não encontrada.');
        }

        $this->repository->saveDraft(
            $reportId,
            $moderatorUserId,
            trim((string) ($payload['action_slug'] ?? '')),
            is_array($payload['changes'] ?? null) ? $payload['changes'] : [],
            trim((string) ($payload['user_response'] ?? '')),
            trim((string) ($payload['internal_note'] ?? ''))
        );

        return ['saved' => true, 'reportId' => $reportId];
    }

    public function generateSuggestion(string $moderatorUserId, array $payload): array
    {
        $this->repository->ensureInfrastructure();
        $reportId = trim((string) ($payload['report_id'] ?? ''));
        $kind = trim((string) ($payload['kind'] ?? 'teacher_comment'));
        $report = $this->repository->findReport($reportId);
        if (!$report) {
            throw new OutOfBoundsException('Denúncia ou solicitação não encontrada.');
        }

        $target = $this->repository->loadTarget($report);
        if (!$target['exists']) {
            throw new OutOfBoundsException('O alvo precisa existir para gerar uma sugestão.');
        }

        $reasonSlug = ReportReasonCatalog::normalizeReasonSlug(
            (string) ($report['reason'] ?? ''),
            (string) ($report['reason_slug'] ?? '')
        );
        $prompt = $this->buildAiPrompt($report, $target, $reasonSlug, $kind);
        $ai = new AiService(
            new AiRepository($this->repository->connection()),
            new AiValidator()
        );
        $generated = $ai->generate([
            'prompt' => $prompt,
            'provider' => 'auto',
            'temperature' => 0.2,
            'maxOutputTokens' => 8192,
        ]);
        $text = is_array($generated) ? trim((string) ($generated['text'] ?? '')) : trim((string) $generated);
        if ($text === '') {
            throw new RuntimeException('A IA não retornou uma sugestão aproveitável.');
        }

        return [
            'kind' => $kind,
            'text' => $text,
            'generatedAt' => gmdate('c'),
            'moderatorId' => $moderatorUserId,
        ];
    }

    public function apply(string $moderatorUserId, array $payload): array
    {
        $this->repository->ensureInfrastructure();
        $reportIds = $this->normalizeReportIds($payload);
        $actionSlug = trim((string) ($payload['action_slug'] ?? ''));
        $changes = is_array($payload['changes'] ?? null) ? $payload['changes'] : [];
        $justification = trim((string) ($payload['justification'] ?? ''));
        $userResponse = trim((string) ($payload['user_response'] ?? ''));
        $internalNote = trim((string) ($payload['internal_note'] ?? ''));

        if ($actionSlug === '') {
            throw new InvalidArgumentException('Escolha uma ação de moderação.');
        }
        if ($userResponse === '') {
            throw new InvalidArgumentException('A resposta ao usuário é obrigatória.');
        }

        $db = $this->repository->connection();
        $db->beginTransaction();
        $historyIds = [];
        $reports = [];

        try {
            foreach ($reportIds as $reportId) {
                $report = $this->repository->findReport($reportId, true);
                if (!$report) {
                    throw new OutOfBoundsException("Atendimento {$reportId} não encontrado.");
                }
                if (!in_array((string) ($report['status'] ?? ''), ['pending'], true)) {
                    throw new DomainException("O atendimento {$reportId} já foi concluído.");
                }
                $reports[] = $report;
            }

            $primary = $reports[0];
            $targetType = (string) ($primary['target_type'] ?? '');
            $targetId = (string) ($primary['target_id'] ?? '');
            $reasonSlug = ReportReasonCatalog::normalizeReasonSlug(
                (string) ($primary['reason'] ?? ''),
                (string) ($primary['reason_slug'] ?? '')
            );

            foreach ($reports as $report) {
                $reportReasonSlug = ReportReasonCatalog::normalizeReasonSlug(
                    (string) ($report['reason'] ?? ''),
                    (string) ($report['reason_slug'] ?? '')
                );
                if (
                    (string) ($report['target_type'] ?? '') !== $targetType
                    || (string) ($report['target_id'] ?? '') !== $targetId
                    || $reportReasonSlug !== $reasonSlug
                ) {
                    throw new InvalidArgumentException('Somente atendimentos do mesmo alvo e motivo podem ser concluídos em conjunto.');
                }
            }

            if (!ReportReasonCatalog::isActionAllowed($targetType, $reasonSlug, $actionSlug)) {
                throw new InvalidArgumentException('A ação escolhida não é compatível com este motivo.');
            }
            $this->validateAction($actionSlug, $changes, $justification);

            $targetBefore = $this->repository->loadTarget($primary, true);
            if (!$targetBefore['exists'] && $this->actionMutatesTarget($actionSlug)) {
                throw new OutOfBoundsException((string) ($targetBefore['error'] ?? 'O alvo não foi encontrado.'));
            }

            $targetAfter = $this->applyTargetAction($actionSlug, $targetBefore, $changes);
            [$statusAfter, $workflowStatus, $resolved] = $this->resolveWorkflow($actionSlug);

            foreach ($reports as $report) {
                $this->repository->updateReportDecision(
                    (string) $report['id'],
                    $statusAfter,
                    $workflowStatus,
                    $actionSlug,
                    $justification,
                    $userResponse,
                    $internalNote,
                    $moderatorUserId,
                    $resolved
                );
                $historyIds[(string) $report['id']] = $this->repository->insertHistory([
                    'report_id' => (string) $report['id'],
                    'target_type' => $targetType,
                    'target_id' => $targetId,
                    'reason_slug' => $reasonSlug,
                    'action_slug' => $actionSlug,
                    'moderator_user_id' => $moderatorUserId,
                    'status_before' => (string) ($report['status'] ?? 'pending'),
                    'status_after' => $statusAfter,
                    'content_before' => $this->withoutRaw($targetBefore),
                    'content_after' => $this->withoutRaw($targetAfter),
                    'justification' => $justification,
                    'internal_note' => $internalNote,
                    'user_response' => $userResponse,
                    'version_id' => null,
                ]);
                $this->repository->deleteDraft((string) $report['id']);
            }

            $db->commit();

            if ($this->actionMutatesTarget($actionSlug)) {
                $this->clearApplicationCache();
            }

            $emailResults = $this->deliverResults($reports, $statusAfter, $userResponse, $historyIds);

            return [
                'actionSlug' => $actionSlug,
                'status' => $statusAfter,
                'workflowStatus' => $workflowStatus,
                'target' => $this->withoutRaw($targetAfter),
                'historyIds' => $historyIds,
                'emailResults' => $emailResults,
            ];
        } catch (Throwable $exception) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $exception;
        }
    }

    private function applyTargetAction(string $actionSlug, array $target, array $changes): array
    {
        if (!$this->actionMutatesTarget($actionSlug)) {
            return $target;
        }

        return match ($actionSlug) {
            'change_question_answer' => $this->repository->updateQuestion((string) $target['id'], [
                'answerIndex' => $changes['answerIndex'] ?? null,
                ...$this->optionalQuestionCommentChanges($changes),
            ]),
            'annul_question' => $this->repository->updateQuestion((string) $target['id'], [
                'annulled' => true,
                ...$this->optionalQuestionCommentChanges($changes),
            ]),
            'edit_question_statement', 'fix_question_formatting' => $this->repository->updateQuestion(
                (string) $target['id'],
                array_filter([
                    'statement' => $changes['statement'] ?? null,
                    'supportText' => $changes['supportText'] ?? null,
                    'referenceText' => $changes['referenceText'] ?? null,
                ], static fn ($value) => $value !== null)
            ),
            'update_question_classification' => $this->repository->updateQuestionFilters(
                (string) $target['id'],
                is_array($changes['filterIds'] ?? null) ? $changes['filterIds'] : []
            ),
            'replace_question_media' => $this->repository->updateQuestion((string) $target['id'], [
                'imageUrl' => trim((string) ($changes['imageUrl'] ?? '')),
            ]),
            'remove_question_media' => $this->repository->updateQuestion((string) $target['id'], ['imageUrl' => '']),
            'mark_question_outdated' => $this->repository->updateQuestion((string) $target['id'], ['outdated' => true]),
            'archive_question' => $this->repository->updateQuestion((string) $target['id'], ['publishStatus' => 'draft']),
            'create_new_comment', 'replace_existing_comment', 'append_existing_comment' => (
                $target['type'] === 'question'
                    ? $this->repository->updateQuestion((string) $target['id'], $this->questionCommentChanges($actionSlug, $target, $changes))
                    : $this->repository->updateLegalTarget($target, $this->legalCommentChanges($actionSlug, $changes))
            ),
            'update_legal_text', 'edit_legal_text', 'fix_legal_formatting' => $this->repository->updateLegalTarget($target, [
                'officialText' => $changes['officialText'] ?? '',
            ]),
            'edit_comment' => $this->repository->updateComment((string) $target['id'], [
                'content' => $changes['content'] ?? '',
            ]),
            'hide_comment' => $this->repository->updateComment((string) $target['id'], ['moderationStatus' => 'pending']),
            'remove_comment' => (
                $target['type'] === 'comment'
                    ? $this->repository->updateComment((string) $target['id'], ['moderationStatus' => 'trash'])
                    : $this->repository->updateLegalTarget($target, [
                        'teacherCommentAction' => 'remove',
                        'teacherCommentId' => $changes['teacherCommentId'] ?? 0,
                    ])
            ),
            'mark_comment_spam' => $this->repository->updateComment((string) $target['id'], ['moderationStatus' => 'spam']),
            default => throw new InvalidArgumentException('A ação selecionada ainda não possui aplicador transacional.'),
        };
    }

    private function describeAction(string $actionSlug, array $target, string $reasonSlug): array
    {
        $fields = match ($actionSlug) {
            'change_question_answer' => ['answerIndex', 'justification', 'commentResolution'],
            'annul_question' => ['justification', 'commentResolution'],
            'edit_question_statement', 'fix_question_formatting' => ['statement', 'supportText', 'referenceText'],
            'update_question_classification' => ['filterIds'],
            'replace_question_media' => ['imageUrl'],
            'update_legal_text', 'edit_legal_text', 'fix_legal_formatting' => ['officialText'],
            'create_new_comment' => ['teacherComment'],
            'replace_existing_comment', 'append_existing_comment' => ['teacherCommentId', 'teacherComment'],
            'edit_comment' => ['content'],
            'remove_comment' => $target['type'] === 'law_section' ? ['teacherCommentId'] : [],
            'request_more_information', 'reject_report', 'reject_request' => ['justification'],
            default => [],
        };

        return [
            'slug' => $actionSlug,
            'label' => self::ACTION_LABELS[$actionSlug] ?? ucwords(str_replace('_', ' ', $actionSlug)),
            'fields' => $fields,
            'mutatesTarget' => $this->actionMutatesTarget($actionSlug),
            'finalizes' => !isset(self::NON_FINAL_ACTIONS[$actionSlug]),
            'destructive' => in_array($actionSlug, [
                'annul_question',
                'archive_question',
                'remove_question_media',
                'remove_comment',
                'mark_comment_spam',
            ], true),
            'reasonSlug' => $reasonSlug,
        ];
    }

    private function validateAction(string $actionSlug, array $changes, string $justification): void
    {
        if (
            in_array($actionSlug, [
                'change_question_answer',
                'annul_question',
                'reject_report',
                'reject_request',
                'request_more_information',
                'remove_comment',
            ], true)
            && $justification === ''
        ) {
            throw new InvalidArgumentException('Informe a justificativa desta decisão.');
        }

        if ($actionSlug === 'change_question_answer' && !array_key_exists('answerIndex', $changes)) {
            throw new InvalidArgumentException('Selecione o novo gabarito.');
        }
    }

    private function actionMutatesTarget(string $actionSlug): bool
    {
        return in_array($actionSlug, [
            'change_question_answer',
            'annul_question',
            'edit_question_statement',
            'fix_question_formatting',
            'update_question_classification',
            'replace_question_media',
            'remove_question_media',
            'mark_question_outdated',
            'archive_question',
            'update_legal_text',
            'edit_legal_text',
            'fix_legal_formatting',
            'create_new_comment',
            'replace_existing_comment',
            'append_existing_comment',
            'edit_comment',
            'remove_comment',
            'hide_comment',
            'mark_comment_spam',
        ], true);
    }

    private function resolveWorkflow(string $actionSlug): array
    {
        if (isset(self::NON_FINAL_ACTIONS[$actionSlug])) {
            return ['pending', self::NON_FINAL_ACTIONS[$actionSlug], false];
        }
        if (in_array($actionSlug, ['keep_current_content', 'reject_report', 'reject_request'], true)) {
            return ['ignored', 'closed', true];
        }

        return ['resolved', 'completed', true];
    }

    private function questionCommentChanges(string $actionSlug, array $target, array $changes): array
    {
        $next = trim((string) ($changes['teacherComment'] ?? ''));
        if ($next === '') {
            throw new InvalidArgumentException('Revise o comentário antes de publicar.');
        }
        if ($actionSlug === 'append_existing_comment') {
            $current = trim((string) ($target['current']['teacherComment'] ?? ''));
            $next = $current !== '' ? $current . "\n\n" . $next : $next;
        }

        return ['teacherComment' => $next];
    }

    private function legalCommentChanges(string $actionSlug, array $changes): array
    {
        return [
            'teacherCommentAction' => match ($actionSlug) {
                'create_new_comment' => 'create',
                'replace_existing_comment' => 'replace',
                'append_existing_comment' => 'append',
                default => '',
            },
            'teacherCommentId' => $changes['teacherCommentId'] ?? 0,
            'teacherComment' => $changes['teacherComment'] ?? '',
            'teacherCommentTitle' => $changes['teacherCommentTitle'] ?? 'Comentário do professor',
            'authorName' => 'Equipe ConcursoMestre',
        ];
    }

    private function optionalQuestionCommentChanges(array $changes): array
    {
        $mode = (string) ($changes['commentResolution'] ?? 'keep');
        return match ($mode) {
            'replace' => ['teacherComment' => (string) ($changes['teacherComment'] ?? '')],
            'remove' => ['teacherComment' => ''],
            default => [],
        };
    }

    private function buildAiPrompt(array $report, array $target, string $reasonSlug, string $kind): string
    {
        $current = $target['current'] ?? [];
        $context = json_encode($current, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

        return <<<PROMPT
Você atua como professor e editor jurídico da plataforma ConcursoMestre.

Tarefa: produzir uma sugestão de {$kind} para revisão humana, sem publicar automaticamente.
Motivo do atendimento: {$reasonSlug}
Relato do usuário: {$report['details']}

Conteúdo real e contexto hierárquico atualmente salvo:
{$context}

Regras:
- escreva em português brasileiro correto;
- preserve o sentido jurídico e não invente fonte;
- foque em concursos públicos;
- explique conceito, aplicação prática, pegadinha de prova e conclusão;
- se já houver comentário, evite repetição e produza complemento quando solicitado;
- retorne somente o texto editorial sugerido, sem JSON e sem prefácio.
PROMPT;
    }

    private function deliverResults(array $reports, string $status, string $userResponse, array $historyIds): array
    {
        $results = [];
        foreach ($reports as $report) {
            $reportId = (string) $report['id'];
            try {
                if (!empty($report['reporter_id'])) {
                    createNotification(
                        $this->repository->connection(),
                        (string) $report['reporter_id'],
                        $status === 'resolved' ? 'Solicitação concluída' : 'Solicitação atualizada',
                        $userResponse,
                        $status === 'resolved' ? 'success' : 'info',
                        'report',
                        '/profile?tab=support'
                    );
                }
                $this->communicationService->sendReportDecisionEmail(
                    $report,
                    $status,
                    $userResponse,
                    ($report['evidence_url'] ?? null) ?: null
                );
                $this->repository->updateHistoryEmailResult($historyIds[$reportId], 'sent', null);
                $results[$reportId] = ['status' => 'sent'];
            } catch (Throwable $exception) {
                $error = mb_substr($exception->getMessage(), 0, 1000);
                $this->repository->updateHistoryEmailResult($historyIds[$reportId], 'failed', $error);
                $results[$reportId] = ['status' => 'failed', 'error' => $error];
                error_log('[AdminReportWorkbenchService] Falha ao comunicar decisao: ' . $error);
            }
        }

        return $results;
    }

    private function clearApplicationCache(): void
    {
        try {
            (new SimpleCache(__DIR__ . '/../../../storage/cache', true))->clearAll();
        } catch (Throwable $exception) {
            error_log('[AdminReportWorkbenchService] Falha ao invalidar cache: ' . $exception->getMessage());
        }
    }

    private function normalizeReportIds(array $payload): array
    {
        $ids = $payload['report_ids'] ?? [$payload['report_id'] ?? ''];
        if (!is_array($ids)) {
            $ids = [$ids];
        }
        $ids = array_values(array_unique(array_filter(
            array_map(static fn ($id): string => trim((string) $id), $ids),
            static fn (string $id): bool => $id !== ''
        )));
        if ($ids === []) {
            throw new InvalidArgumentException('Nenhum atendimento foi informado.');
        }
        if (count($ids) > 50) {
            throw new InvalidArgumentException('O limite de atendimentos agrupados foi excedido.');
        }

        return $ids;
    }

    private function normalizeReport(array $report, string $reasonSlug): array
    {
        return [
            'id' => (string) $report['id'],
            'reportType' => ReportReasonCatalog::reportTypeForReason($reasonSlug),
            'reason' => (string) ($report['reason'] ?? ''),
            'reasonSlug' => $reasonSlug,
            'details' => (string) ($report['details'] ?? ''),
            'status' => (string) ($report['status'] ?? 'pending'),
            'workflowStatus' => (string) ($report['workflow_status'] ?? 'pending'),
            'priority' => (string) ($report['priority'] ?? 'medium'),
            'targetType' => (string) ($report['target_type'] ?? ''),
            'targetId' => (string) ($report['target_id'] ?? ''),
            'reporter' => [
                'id' => (string) ($report['reporter_id'] ?? ''),
                'name' => (string) ($report['reporter_name'] ?? 'Usuário'),
                'email' => ($report['reporter_email'] ?? null) ?: null,
                'role' => ($report['reporter_role'] ?? null) ?: null,
            ],
            'evidenceUrl' => ($report['evidence_url'] ?? null) ?: null,
            'createdAt' => $report['created_at'] ?? null,
        ];
    }

    private function withoutRaw(array $target): array
    {
        unset($target['raw']);
        return $target;
    }
}
