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
require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

/**
 * Repositorio das mutacoes administrativas de usuario.
 * Centraliza o acesso a dados para evitar SQL espalhado no endpoint legado.
 */
class AdminUserActionsRepository
{
    private PDO $db;
    private bool $userProfileColumnsEnsured = false;

    /**
     * Inicializa o repositorio com a conexao PDO.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Garante colunas usadas pelo editor administrativo de usuario em bases antigas.
     *
     * @since 1.0.0
     */
    public function ensureUserProfileColumns(): void
    {
        if ($this->userProfileColumnsEnsured) {
            return;
        }
        SchemaReadiness::assertTablesAndColumns($this->db, 'acoes administrativas de usuario', [
            'users' => ['id', 'name', 'email', 'cpf', 'phone', 'target_exam', 'reputation', 'status', 'role', 'referral_code'],
        ]);

        $this->userProfileColumnsEnsured = true;
    }

    /**
     * Busca a assinatura ativa de um usuario.
     *
     * @since 1.0.0
     */
    public function findActiveSubscriptionByUserId(string $userId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT us.*, p.name AS plan_name, p.price AS plan_price
            FROM user_subscriptions us
            LEFT JOIN plans p ON p.id = us.plan_id
            WHERE us.user_id = :user_id
              AND us.status = 'active'
            ORDER BY us.id DESC
            LIMIT 1
        ");
        $stmt->execute([':user_id' => $userId]);

        $subscription = $stmt->fetch(PDO::FETCH_ASSOC);

        return $subscription ?: null;
    }

    /**
     * Atualiza a data final da assinatura informada.
     *
     * @since 1.0.0
     */
    public function updateSubscriptionEndDate(int $subscriptionId, string $newEndDate): void
    {
        $stmt = $this->db->prepare("
            UPDATE user_subscriptions
            SET current_period_end = :end_date,
                updated_at = NOW()
            WHERE id = :id
        ");
        $stmt->execute([
            ':end_date' => $newEndDate,
            ':id' => $subscriptionId,
        ]);
    }

    /**
     * Estende uma assinatura como concessao gratuita do admin.
     *
     * Ao virar manual_admin, a linha deixa de participar dos crons, webhooks e
     * projecoes de cobranca Stripe. O usuario ganha apenas o periodo concedido.
     *
     * @since 1.0.0
     */
    public function extendSubscriptionAsManualGrant(int $subscriptionId, string $newEndDate, string $status = 'active'): void
    {
        $normalizedStatus = in_array($status, ['active', 'canceled'], true) ? $status : 'active';

        $stmt = $this->db->prepare("
            UPDATE user_subscriptions
            SET status = :status,
                payment_provider = 'manual_admin',
                provider_subscription_id = NULL,
                provider_customer_id = NULL,
                provider_checkout_session_id = NULL,
                provider_current_period_start = NULL,
                provider_current_period_end = NULL,
                provider_last_webhook_event_at = NULL,
                provider_schedule_id = NULL,
                auto_renew = 0,
                cancel_at_period_end = 1,
                current_period_end = :end_date,
                next_renewal_amount = NULL,
                next_renewal_date = NULL,
                next_renewal_price_source = NULL,
                next_renewal_cycle_label = NULL,
                next_renewal_snapshot_json = NULL,
                renewal_reminder_sent_for = NULL,
                renewal_reminder_sent_at = NULL,
                updated_at = NOW()
            WHERE id = :id
        ");
        $stmt->execute([
            ':status' => $normalizedStatus,
            ':end_date' => $newEndDate,
            ':id' => $subscriptionId,
        ]);
    }

    /**
     * Retorna os dados de um plano pelo ID.
     *
     * @since 1.0.0
     */
    public function findPlanById(int $planId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM plans WHERE id = :plan_id LIMIT 1');
        $stmt->execute([':plan_id' => $planId]);

        $plan = $stmt->fetch(PDO::FETCH_ASSOC);

        return $plan ?: null;
    }

    /**
     * Lista os planos usados pelo seletor manual do admin.
     *
     * @since 1.0.0
     */
    public function fetchAvailablePlans(): array
    {
        $stmt = $this->db->query("
            SELECT id, name, price, interval_count, interval_unit, active
            FROM plans
            ORDER BY price ASC, id ASC
        ");

        return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    }

    /**
     * Busca um usuario pelo e-mail para impedir duplicidade no cadastro admin.
     *
     * @since 1.0.0
     */
    public function findUserByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare('SELECT id, email FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);

        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Busca o snapshot administrativo minimo do usuario.
     *
     * @since 1.0.0
     */
    public function findUserById(string $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT id, name, email, role, status FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);

        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Conta administradores ativos fora do usuario informado.
     *
     * @since 1.0.0
     */
    public function countActiveAdminsExcluding(string $userId): int
    {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*)
             FROM users
             WHERE role = 'admin'
               AND id <> :id
               AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion', 'banned')"
        );
        $stmt->execute([':id' => $userId]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Cria um usuario pelo painel administrativo com defaults seguros.
     *
     * @since 1.0.0
     */
    public function createUserProfile(array $payload): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO users (
                id,
                name,
                email,
                password_hash,
                role,
                plan,
                level,
                xp,
                reputation,
                status,
                email_verified,
                referral_code,
                cpf,
                phone,
                target_exam,
                preferences,
                created_at,
                updated_at
            ) VALUES (
                :id,
                :name,
                :email,
                :password_hash,
                :role,
                'Gratuito',
                1,
                0,
                :reputation,
                :status,
                1,
                :referral_code,
                :cpf,
                :phone,
                :target_exam,
                :preferences,
                NOW(),
                NOW()
            )
        ");

        $stmt->execute([
            ':id' => $payload['id'],
            ':name' => $payload['name'],
            ':email' => $payload['email'],
            ':password_hash' => $payload['password_hash'],
            ':role' => $payload['role'],
            ':reputation' => $payload['reputation'],
            ':status' => $payload['status'],
            ':referral_code' => $payload['referral_code'],
            ':cpf' => $payload['cpf'],
            ':phone' => $payload['phone'],
            ':target_exam' => $payload['target_exam'],
            ':preferences' => $payload['preferences'],
        ]);
    }

    /**
     * Cancela assinaturas ativas antes de aplicar um upgrade manual.
     *
     * @since 1.0.0
     */
    public function cancelActiveSubscriptionsByUserId(string $userId): void
    {
        $stmt = $this->db->prepare("
            UPDATE user_subscriptions
            SET status = 'canceled',
                auto_renew = 0,
                cancel_at_period_end = 0,
                current_period_end = CASE
                    WHEN current_period_end IS NULL OR current_period_end > NOW() THEN NOW()
                    ELSE current_period_end
                END,
                provider_current_period_end = CASE
                    WHEN provider_current_period_end IS NULL OR provider_current_period_end > NOW() THEN NOW()
                    ELSE provider_current_period_end
                END,
                updated_at = NOW()
            WHERE user_id = :user_id
              AND status = 'active'
        ");
        $stmt->execute([':user_id' => $userId]);
    }

    /**
     * Cria uma assinatura manual com status ativo.
     *
     * @since 1.0.0
     */
    public function createManualSubscription(string $userId, int $planId, string $start, string $end): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO user_subscriptions (
                user_id,
                plan_id,
                status,
                current_period_start,
                current_period_end,
                created_at,
                updated_at,
                payment_provider,
                auto_renew,
                cancel_at_period_end
            ) VALUES (
                :user_id,
                :plan_id,
                'active',
                :current_period_start,
                :current_period_end,
                NOW(),
                NOW(),
                'manual_admin',
                0,
                1
            )
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':plan_id' => $planId,
            ':current_period_start' => $start,
            ':current_period_end' => $end,
        ]);
    }

    /**
     * Atualiza o snapshot de plano salvo no perfil do usuario.
     *
     * @since 1.0.0
     */
    public function updateUserPlanSnapshot(string $userId, string $planName, int $planId, string $subscriptionEnd): void
    {
        $stmt = $this->db->prepare("
            UPDATE users
            SET plan = :plan_name,
                current_plan_id = :plan_id,
                subscription_end = :subscription_end,
                updated_at = NOW()
            WHERE id = :user_id
        ");
        $stmt->execute([
            ':plan_name' => $planName,
            ':plan_id' => $planId,
            ':subscription_end' => $subscriptionEnd,
            ':user_id' => $userId,
        ]);
    }

    /**
     * Remove administrativamente o usuario sem apagar historico transacional.
     *
     * @since 1.0.0
     */
    public function softDeleteUserById(string $userId, string $reason): void
    {
        $stmt = $this->db->prepare(
            "UPDATE users
             SET status = 'deleted',
                 plan = 'Gratuito',
                 current_plan_id = NULL,
                 subscription_end = NULL,
                 deletion_requested_at = NOW(),
                 deletion_reason = :reason,
                 updated_at = NOW()
             WHERE id = :id"
        );
        $stmt->execute([
            ':reason' => $reason,
            ':id' => $userId,
        ]);
    }

    /**
     * Busca uma transacao pelo ID para estorno.
     *
     * @since 1.0.0
     */
    public function findTransactionById(int $transactionId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM transactions WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $transactionId]);

        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);

        return $transaction ?: null;
    }

    /**
     * Busca a transacao e bloqueia a linha para mutacoes financeiras idempotentes.
     *
     * @since 1.0.0
     */
    public function findTransactionByIdForUpdate(int $transactionId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM transactions WHERE id = :id LIMIT 1 FOR UPDATE');
        $stmt->execute([':id' => $transactionId]);

        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);

        return $transaction ?: null;
    }

    /**
     * Atualiza campos basicos do perfil do usuario.
     *
     * @since 1.0.0
     */
    public function updateUserProfile(string $userId, array $payload): void
    {
        $fields = [
            'name = :name',
            'email = :email',
            'cpf = :cpf',
            'phone = :phone',
            'target_exam = :target_exam',
            'role = :role',
        ];

        $params = [
            ':name' => $payload['name'],
            ':email' => $payload['email'],
            ':cpf' => $payload['cpf'],
            ':phone' => $payload['phone'],
            ':target_exam' => $payload['target_exam'],
            ':role' => $payload['role'],
            ':id' => $userId,
        ];

        if (array_key_exists('status', $payload)) {
            $fields[] = 'status = :status';
            $params[':status'] = $payload['status'];
        }

        if (array_key_exists('reputation', $payload)) {
            $fields[] = 'reputation = :reputation';
            $params[':reputation'] = $payload['reputation'];
        }

        $stmt = $this->db->prepare("
            UPDATE users
            SET " . implode(', ', $fields) . ",
                updated_at = NOW()
            WHERE id = :id
        ");
        $stmt->execute($params);
    }

    /**
     * Atualiza status e reputacao do usuario quando fornecidos.
     *
     * @since 1.0.0
     */
    public function updateUserStatusFields(string $userId, array $payload): void
    {
        $fields = [];
        $params = [':id' => $userId];

        if (array_key_exists('status', $payload)) {
            $fields[] = 'status = :status';
            $params[':status'] = $payload['status'];
        }

        if (array_key_exists('reputation', $payload)) {
            $fields[] = 'reputation = :reputation';
            $params[':reputation'] = $payload['reputation'];
        }

        if (empty($fields)) {
            return;
        }

        $fields[] = 'updated_at = NOW()';

        $stmt = $this->db->prepare("
            UPDATE users
            SET " . implode(', ', $fields) . "
            WHERE id = :id
        ");
        $stmt->execute($params);
    }


    /**
     * Remove dados operacionais e conteudos criados pelo usuario removido.
     * Mantem registros financeiros, assinaturas, cupons e auditoria.
     *
     * @since 1.0.0
     * @return array<string, int|string>
     */
    public function cleanupUserOwnedNonFinancialData(string $userId): array
    {
        $summary = [
            'deleted_rows' => 0,
            'updated_rows' => 0,
            'skipped' => 0,
            'errors' => 0,
        ];

        $this->detachLegalCommentChildren($userId, $summary);
        $this->detachCommentChildren($userId, $summary);
        $this->deleteLegalReportsForUserComments($userId, $summary);
        $this->deleteLikesForUserComments($userId, $summary);
        $this->deleteReportsForUserComments($userId, $summary);
        $this->deleteFeedbackThreadChildren($userId, $summary);

        $deleteSpecs = [
            ['table' => 'auth_sessions', 'column' => 'user_id'],
            ['table' => 'email_verifications', 'column' => 'user_id'],
            ['table' => 'notifications', 'column' => 'user_id'],
            ['table' => 'addresses', 'column' => 'user_id'],
            ['table' => 'analytics_lifecycle_events', 'column' => 'user_id'],
            ['table' => 'bank_accounts', 'column' => 'user_id'],
            ['table' => 'comment_likes', 'column' => 'user_id'],
            ['table' => 'comments', 'column' => 'user_id'],
            ['table' => 'legal_comment_reports', 'column' => 'user_id'],
            ['table' => 'legal_content_reactions', 'column' => 'user_id'],
            ['table' => 'legal_user_favorites', 'column' => 'user_id'],
            ['table' => 'legal_user_progress', 'column' => 'user_id'],
            ['table' => 'legal_user_comments', 'column' => 'user_id'],
            ['table' => 'material_ratings', 'column' => 'user_id'],
            ['table' => 'marketing_automation_events', 'column' => 'user_id'],
            ['table' => 'question_editorial_feedback', 'column' => 'user_id'],
            ['table' => 'ranking_entries', 'column' => 'user_id'],
            ['table' => 'reports', 'column' => 'reporter_id'],
            ['table' => 'simulations', 'column' => 'user_id'],
            ['table' => 'study_sessions', 'column' => 'user_id'],
            ['table' => 'subject_statistics', 'column' => 'user_id'],
            ['table' => 'user_answers', 'column' => 'user_id'],
            ['table' => 'user_badges', 'column' => 'user_id'],
            ['table' => 'user_bookmarks', 'column' => 'user_id'],
            ['table' => 'user_cards', 'column' => 'user_id'],
            ['table' => 'user_feedback_votes', 'column' => 'user_id'],
            ['table' => 'user_feedback', 'column' => 'user_id'],
            ['table' => 'user_gamification_events', 'column' => 'user_id'],
            ['table' => 'user_highlights', 'column' => 'user_id'],
            ['table' => 'user_notes', 'column' => 'user_id'],
            ['table' => 'user_saved_questions', 'column' => 'user_id'],
            ['table' => 'user_statistics', 'column' => 'user_id'],
            ['table' => 'user_streaks', 'column' => 'user_id'],
            ['table' => 'user_study_schedules', 'column' => 'user_id'],
        ];

        foreach ($deleteSpecs as $spec) {
            $summary['deleted_rows'] += $this->deleteRowsByColumnIfExists(
                (string) $spec['table'],
                (string) $spec['column'],
                $userId,
                $summary
            );
        }

        $summary['updated_rows'] += $this->markAuthoredMaterialsUnavailable($userId, $summary);

        return $summary;
    }

    /**
     * Remove respostas de atendimento ligadas a solicitacoes do usuario.
     *
     * @since 1.0.0
     */
    private function deleteFeedbackThreadChildren(string $userId, array &$summary): void
    {
        if (!$this->tableHasColumn('user_feedback', 'user_id') || !$this->tableHasColumn('user_feedback', 'parent_id')) {
            $summary['skipped']++;
            return;
        }

        try {
            $stmt = $this->db->prepare(
                'DELETE child FROM user_feedback child
                 INNER JOIN user_feedback parent ON parent.id = child.parent_id
                 WHERE parent.user_id = :user_id'
            );
            $stmt->execute([':user_id' => $userId]);
            $summary['deleted_rows'] += $stmt->rowCount();
        } catch (Throwable $error) {
            $summary['errors']++;
        }
    }

    /**
     * Evita filhos orfaos em comentarios da lei antes de remover comentarios do usuario.
     *
     * @since 1.0.0
     */
    private function detachLegalCommentChildren(string $userId, array &$summary): void
    {
        if (!$this->tableHasColumn('legal_user_comments', 'user_id') || !$this->tableHasColumn('legal_user_comments', 'parent_comment_id')) {
            $summary['skipped']++;
            return;
        }

        try {
            $stmt = $this->db->prepare(
                'UPDATE legal_user_comments child
                 INNER JOIN legal_user_comments parent ON parent.id = child.parent_comment_id
                 SET child.parent_comment_id = NULL,
                     child.updated_at = NOW()
                 WHERE parent.user_id = :user_id'
            );
            $stmt->execute([':user_id' => $userId]);
            $summary['updated_rows'] += $stmt->rowCount();
        } catch (Throwable $error) {
            $summary['errors']++;
        }
    }

    /**
     * Evita filhos orfaos em comentarios comuns antes de remover comentarios do usuario.
     *
     * @since 1.0.0
     */
    private function detachCommentChildren(string $userId, array &$summary): void
    {
        if (!$this->tableHasColumn('comments', 'user_id') || !$this->tableHasColumn('comments', 'parent_id')) {
            $summary['skipped']++;
            return;
        }

        try {
            $stmt = $this->db->prepare(
                'UPDATE comments child
                 INNER JOIN comments parent ON parent.id = child.parent_id
                 SET child.parent_id = NULL
                 WHERE parent.user_id = :user_id'
            );
            $stmt->execute([':user_id' => $userId]);
            $summary['updated_rows'] += $stmt->rowCount();
        } catch (Throwable $error) {
            $summary['errors']++;
        }
    }

    /**
     * Remove denuncias vinculadas aos comentarios de Lei Comentada do usuario removido.
     *
     * @since 1.0.0
     */
    private function deleteLegalReportsForUserComments(string $userId, array &$summary): void
    {
        if (
            !$this->tableHasColumn('legal_comment_reports', 'comment_id')
            || !$this->tableHasColumn('legal_user_comments', 'id')
            || !$this->tableHasColumn('legal_user_comments', 'user_id')
        ) {
            $summary['skipped']++;
            return;
        }

        try {
            $stmt = $this->db->prepare(
                'DELETE report FROM legal_comment_reports report
                 INNER JOIN legal_user_comments comment ON comment.id = report.comment_id
                 WHERE comment.user_id = :user_id'
            );
            $stmt->execute([':user_id' => $userId]);
            $summary['deleted_rows'] += $stmt->rowCount();
        } catch (Throwable $error) {
            $summary['errors']++;
        }
    }

    /**
     * Remove curtidas/descurtidas recebidas em comentarios comuns do usuario removido.
     *
     * @since 1.0.0
     */
    private function deleteLikesForUserComments(string $userId, array &$summary): void
    {
        if (
            !$this->tableHasColumn('comment_likes', 'comment_id')
            || !$this->tableHasColumn('comments', 'id')
            || !$this->tableHasColumn('comments', 'user_id')
        ) {
            $summary['skipped']++;
            return;
        }

        try {
            $stmt = $this->db->prepare(
                'DELETE reaction FROM comment_likes reaction
                 INNER JOIN comments comment ON comment.id = reaction.comment_id
                 WHERE comment.user_id = :user_id'
            );
            $stmt->execute([':user_id' => $userId]);
            $summary['deleted_rows'] += $stmt->rowCount();
        } catch (Throwable $error) {
            $summary['errors']++;
        }
    }

    /**
     * Remove denuncias abertas sobre comentarios comuns do usuario removido.
     *
     * @since 1.0.0
     */
    private function deleteReportsForUserComments(string $userId, array &$summary): void
    {
        if (
            !$this->tableHasColumn('reports', 'target_id')
            || !$this->tableHasColumn('comments', 'id')
            || !$this->tableHasColumn('comments', 'user_id')
        ) {
            $summary['skipped']++;
            return;
        }

        try {
            $hasTargetType = $this->tableHasColumn('reports', 'target_type');
            $targetTypeClause = $hasTargetType ? "AND report.target_type = 'comment'" : '';
            $stmt = $this->db->prepare(
                "DELETE report FROM reports report
                 INNER JOIN comments comment ON CAST(comment.id AS CHAR) = CAST(report.target_id AS CHAR)
                 WHERE comment.user_id = :user_id
                 {$targetTypeClause}"
            );
            $stmt->execute([':user_id' => $userId]);
            $summary['deleted_rows'] += $stmt->rowCount();
        } catch (Throwable $error) {
            $summary['errors']++;
        }
    }

    /**
     * Remove material do catalogo quando o autor foi removido sem apagar historico financeiro.
     *
     * @since 1.0.0
     */
    private function markAuthoredMaterialsUnavailable(string $userId, array &$summary): int
    {
        if (!$this->tableHasColumn('materials', 'author_id') || !$this->tableHasColumn('materials', 'status')) {
            $summary['skipped']++;
            return 0;
        }

        try {
            $stmt = $this->db->prepare(
                "UPDATE materials
                 SET status = 'rejected',
                     rejection_reason = COALESCE(NULLIF(rejection_reason, ''), 'Autor removido administrativamente.')
                 WHERE author_id = :user_id"
            );
            $stmt->execute([':user_id' => $userId]);

            return $stmt->rowCount();
        } catch (Throwable $error) {
            $summary['errors']++;
            return 0;
        }
    }

    /**
     * Apaga linhas de uma tabela somente quando ela e a coluna existem.
     *
     * @since 1.0.0
     */
    private function deleteRowsByColumnIfExists(string $table, string $column, string $userId, array &$summary): int
    {
        if (!$this->tableHasColumn($table, $column)) {
            $summary['skipped']++;
            return 0;
        }

        try {
            $stmt = $this->db->prepare("DELETE FROM `{$table}` WHERE `{$column}` = :user_id");
            $stmt->execute([':user_id' => $userId]);

            return $stmt->rowCount();
        } catch (Throwable $error) {
            $summary['errors']++;
            return 0;
        }
    }

    /**
     * Confere existencia de coluna antes de executar limpeza em bases heterogeneas.
     *
     * @since 1.0.0
     */
    private function tableHasColumn(string $table, string $column): bool
    {
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([
            ':table_name' => $table,
            ':column_name' => $column,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    }
    /**
     * Retorna as colunas atuais da tabela users.
     *
     * @since 1.0.0
     * @return array<int, string>
     */
    private function getUserColumns(): array
    {
        $stmt = $this->db->query('DESCRIBE users');
        $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

        return array_values(array_filter(array_map(
            static fn (array $row): string => (string) ($row['Field'] ?? ''),
            $rows ?: []
        )));
    }

    /**
     * Retorna metadados de uma coluna da tabela users.
     *
     * @since 1.0.0
     */
    private function getUserColumn(string $columnName): ?array
    {
        $stmt = $this->db->prepare('SHOW COLUMNS FROM users LIKE :column_name');
        $stmt->execute([':column_name' => $columnName]);
        $column = $stmt->fetch(PDO::FETCH_ASSOC);

        return $column ?: null;
    }

}
