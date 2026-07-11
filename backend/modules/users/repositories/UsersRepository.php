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
 * Repositorio do dominio de Usuarios.
 * Centraliza leituras e escritas relacionadas ao perfil autenticado.
 */
class UsersRepository
{
    private PDO $db;
    private bool $userProfileColumnsEnsured = false;

    /**
     * Injeta a conexao compartilhada usada pelos services de perfil, cartoes e rewards.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Expõe a conexão para helpers transversais de perfil/billing.
     *
     * @since 1.0.0
     */
    public function getDb(): PDO
    {
        return $this->db;
    }

    /**
     * Le o codigo de indicacao exibido no perfil e reaproveitado na montagem do link de convite.
     *
     * @since 1.0.0
     */
    public function getReferralCode(string $userId): ?string
    {
        $stmt = $this->db->prepare('SELECT referral_code FROM users WHERE id = :id');
        $stmt->execute([':id' => $userId]);
        $code = $stmt->fetchColumn();

        return $code ? (string) $code : null;
    }

    /**
     * Permite que rotas administrativas legadas retornem vazio com seguranca
     * em bases ainda Nao inicializadas.
      * @since 1.0.0
     */
    public function usersTableExists(): bool
    {
        $stmt = $this->db->query("SHOW TABLES LIKE 'users'");
        if (!$stmt) {
            return false;
        }

        return $stmt->fetchColumn() !== false;
    }

    /**
     * Confirma a existencia do Usuario autenticado antes de aplicar mutacoes sensiveis.
      * @since 1.0.0
     */
    public function userExistsById(string $userId): bool
    {
        $stmt = $this->db->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);

        return $stmt->fetchColumn() !== false;
    }

    /**
     * Persiste um codigo de indicacao novo para reuso em onboarding e rewards.
     *
     * @since 1.0.0
     */
    public function saveReferralCode(string $userId, string $code): void
    {
        $stmt = $this->db->prepare('UPDATE users SET referral_code = :code WHERE id = :id');
        $stmt->execute([
            ':code' => $code,
            ':id' => $userId,
        ]);
    }

    /**
     * Conta quantos indicados validos estao associados ao usuario para o painel de indicacoes.
     *
     * @since 1.0.0
     */
    public function countReferrals(string $userId): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM referrals WHERE referrer_id = :id');
        $stmt->execute([':id' => $userId]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Soma o valor historico de rewards ja convertidos para exibicao no perfil.
     *
     * @since 1.0.0
     */
    public function getTotalEarnedReferralRewards(string $userId): float
    {
        if (!$this->referralsRewardAmountColumnExists()) {
            return 0.0;
        }

        $stmt = $this->db->prepare("SELECT SUM(reward_amount) FROM referrals WHERE referrer_id = :id AND status = 'rewarded'");
        $stmt->execute([':id' => $userId]);
        $value = $stmt->fetchColumn();

        return $value !== false ? (float) $value : 0.0;
    }

    /**
     * Recupera o hash atual da senha para o fluxo de troca autenticada do perfil.
     *
     * @since 1.0.0
     */
    public function getPasswordHashById(string $userId): ?string
    {
        $stmt = $this->db->prepare('SELECT password_hash FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);
        $hash = $stmt->fetchColumn();

        return $hash ? (string) $hash : null;
    }

    /**
     * Atualiza o hash persistido depois da validacao feita no service.
     *
     * @since 1.0.0
     */
    public function updatePasswordHash(string $userId, string $passwordHash): void
    {
        $stmt = $this->db->prepare('UPDATE users SET password_hash = :password_hash, updated_at = NOW() WHERE id = :id');
        $stmt->execute([
            ':password_hash' => $passwordHash,
            ':id' => $userId,
        ]);
    }

    /**
     * Salva a URL final da foto usada no header, perfil e comentarios do app.
     *
     * @since 1.0.0
     */
    public function updatePhotoUrl(string $userId, ?string $photoUrl): void
    {
        $stmt = $this->db->prepare('UPDATE users SET photo_url = :photo_url, updated_at = NOW() WHERE id = :id');
        $stmt->execute([
            ':photo_url' => $photoUrl,
            ':id' => $userId,
        ]);
    }

    /**
     * Retorna o caminho atual da foto de perfil para remocao fisica segura.
     *
     * @since 1.0.0
     */
    public function findPhotoUrlById(string $userId): ?string
    {
        $stmt = $this->db->prepare('SELECT photo_url FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);
        $photoUrl = $stmt->fetchColumn();

        return $photoUrl ? (string) $photoUrl : null;
    }

    /**
     * Lista indicacoes pendentes cujo Usuario indicado ja passou da carencia minima.
      * @since 1.0.0
     */
    public function fetchPendingReferralRewards(int $graceDays): array
    {
        $days = max(0, $graceDays);
        $stmt = $this->db->prepare("
            SELECT
                r.id,
                r.referrer_id,
                r.referred_user_id,
                us.current_period_start
            FROM referrals r
            INNER JOIN user_subscriptions us
                ON r.referred_user_id = us.user_id
            WHERE r.status = 'pending'
              AND us.status = 'active'
              AND us.current_period_start <= DATE_SUB(NOW(), INTERVAL :days DAY)
        ");
        $stmt->bindValue(':days', $days, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Busca os dados minimos usados no calculo da recompensa recorrente de indicacao.
      * @since 1.0.0
     */
    public function findRewardUserSnapshotById(string $userId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, plan, subscription_end, name
            FROM users
            WHERE id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $userId]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /**
     * Atualiza o plano e a expiracao usada pela recompensa de indicacao.
      * @since 1.0.0
     */
    public function updateUserRewardPlan(string $userId, string $plan, string $subscriptionEnd): void
    {
        $stmt = $this->db->prepare("
            UPDATE users
            SET plan = :plan,
                subscription_end = :subscription_end
            WHERE id = :id
        ");
        $stmt->execute([
            ':plan' => $plan,
            ':subscription_end' => $subscriptionEnd,
            ':id' => $userId,
        ]);
    }

    /**
     * Soma XP ao Usuario recompensado sem expor SQL ao job legado.
      * @since 1.0.0
     */
    public function incrementUserXp(string $userId, int $amount): void
    {
        $stmt = $this->db->prepare('UPDATE users SET xp = xp + :amount WHERE id = :id');
        $stmt->bindValue(':amount', $amount, PDO::PARAM_INT);
        $stmt->bindValue(':id', $userId);
        $stmt->execute();
    }

    /**
     * Marca a indicacao como recompensada, com suporte a bases que possuem ou Nao `reward_amount`.
      * @since 1.0.0
     */
    public function markReferralRewarded(string $referralId, float $rewardAmount = 0.0): void
    {
        if ($this->referralsRewardAmountColumnExists()) {
            $stmt = $this->db->prepare("
                UPDATE referrals
                SET status = 'rewarded',
                    rewarded_at = NOW(),
                    reward_amount = :reward_amount
                WHERE id = :id
            ");
            $stmt->execute([
                ':reward_amount' => $rewardAmount,
                ':id' => $referralId,
            ]);

            return;
        }

        $stmt = $this->db->prepare("
            UPDATE referrals
            SET status = 'rewarded',
                rewarded_at = NOW()
            WHERE id = :id
        ");
        $stmt->execute([':id' => $referralId]);
    }

    /**
     * Insere notificacao de sistema associada ao fluxo de recompensa.
      * @since 1.0.0
     */
    public function insertNotification(array $payload): void
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';
        if (!isNotificationDeliveryEnabled(
            $this->db,
            (string) ($payload['title'] ?? ''),
            (string) ($payload['category'] ?? 'system')
        )) {
            return;
        }

        ensureNotificationTableSupportsCurrentContract($this->db);

        $stmt = $this->db->prepare("
            INSERT INTO notifications (
                id,
                user_id,
                title,
                message,
                category,
                type,
                link
            ) VALUES (
                :id,
                :user_id,
                :title,
                :message,
                :category,
                :type,
                :link
            )
        ");
        $stmt->execute([
            ':id' => $payload['id'],
            ':user_id' => $payload['user_id'],
            ':title' => $payload['title'],
            ':message' => $payload['message'],
            ':category' => $payload['category'],
            ':type' => $payload['type'],
            ':link' => $payload['link'],
        ]);
    }

    /**
     * Inicia transacao explicita para mutacoes compostas do perfil.
      * @since 1.0.0
     */
    public function beginTransaction(): void
    {
        if (!$this->db->inTransaction()) {
            $this->db->beginTransaction();
        }
    }

    /**
     * Finaliza a transacao atual quando todas as escritas do perfil forem aplicadas.
      * @since 1.0.0
     */
    public function commit(): void
    {
        if ($this->db->inTransaction()) {
            $this->db->commit();
        }
    }

    /**
     * Reverte a transacao atual para evitar persistencia parcial de dados.
      * @since 1.0.0
     */
    public function rollBack(): void
    {
        if ($this->db->inTransaction()) {
            $this->db->rollBack();
        }
    }

    /**
     * Exibe ao service se ja existe transacao aberta antes de iniciar mutacoes compostas.
     *
     * @since 1.0.0
     */
    public function inTransaction(): bool
    {
        return $this->db->inTransaction();
    }

    /**
     * Garante colunas basicas de perfil usadas pelo fluxo autenticado em bases legadas.
     *
     * @since 1.0.0
     */
    public function ensureUserProfileColumns(): void
    {
        if ($this->userProfileColumnsEnsured) {
            return;
        }

        $definitions = [
            'phone' => 'VARCHAR(30) DEFAULT NULL',
            'auth_provider' => "VARCHAR(50) NOT NULL DEFAULT 'email'",
            'google_sub' => 'VARCHAR(255) NULL',
            'facebook_id' => 'VARCHAR(255) NULL',
            'apple_sub' => 'VARCHAR(255) NULL',
        ];

        foreach ($definitions as $column => $definition) {
            $stmt = $this->db->query("SHOW COLUMNS FROM users LIKE '{$column}'");
            $exists = $stmt !== false && $stmt->fetchColumn() !== false;

            if ($exists) {
                continue;
            }

            $this->db->exec("ALTER TABLE users ADD COLUMN `{$column}` {$definition}");
        }

        $this->userProfileColumnsEnsured = true;
    }

    /**
     * Detecta drift de schema entre bases antigas e a versao documentada de referrals.
      * @since 1.0.0
     */
    private function referralsRewardAmountColumnExists(): bool
    {
        static $exists = null;

        if ($exists !== null) {
            return $exists;
        }

        $stmt = $this->db->query("SHOW COLUMNS FROM referrals LIKE 'reward_amount'");
        $exists = $stmt !== false && $stmt->fetchColumn() !== false;

        return $exists;
    }

    /**
     * Carrega o retrato principal do Usuario e das tabelas satelites ligadas ao perfil.
      * @since 1.0.0
     */
    public function findProfileRowById(string $userId): ?array
    {
        $this->ensureUserProfileColumns();

        $stmt = $this->db->prepare(
            "SELECT
                u.id,
                u.name,
                u.email,
                u.password_hash,
                u.role,
                u.plan,
                u.level,
                u.xp,
                u.reputation,
                u.email_verified,
                u.cpf,
                u.phone,
                u.target_exam,
                u.preferences,
                u.status,
                u.has_saved_card,
                u.two_factor_enabled,
                u.photo_url,
                u.google_sub AS google_id,
                u.facebook_id,
                u.referral_code,
                u.deletion_requested_at,
                a.zip_code,
                a.street,
                a.number,
                a.complement,
                a.neighborhood,
                a.city,
                a.state,
                b.bank_code,
                b.bank_name,
                b.agency,
                b.account,
                b.account_digit,
                b.holder_name,
                b.holder_document,
                b.account_type
            FROM users u
            LEFT JOIN addresses a ON u.id = a.user_id
            LEFT JOIN bank_accounts b ON u.id = b.user_id
            WHERE u.id = :id
            LIMIT 1"
        );
        $stmt->execute([':id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Conta comentarios do proprio Usuario para enriquecer o snapshot de sessao/perfil.
      * @since 1.0.0
     */
    public function countCommentsByUserId(string $userId): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM comments WHERE user_id = :id');
        $stmt->execute([':id' => $userId]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Lista os comentarios publicados pelo Usuario para o historico de atividade.
      * @since 1.0.0
     */
    public function fetchUserCommentsById(string $userId): array
    {
        $stmt = $this->db->prepare(
            "SELECT
                id,
                target_id,
                target_type,
                content,
                created_at
            FROM comments
            WHERE user_id = :id
            ORDER BY created_at DESC"
        );
        $stmt->execute([':id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Lista as anotacoes do Usuario com contexto basico de questao ou material.
      * @since 1.0.0
     */
    public function fetchUserNotesById(string $userId): array
    {
        $stmt = $this->db->prepare(
            "SELECT
                n.id,
                n.item_id,
                n.type,
                n.note_text,
                n.updated_at,
                q.enunciado_clean AS question_snippet,
                m.title AS material_title
            FROM user_notes n
            LEFT JOIN questions q ON n.item_id = q.id AND n.type = 'question'
            LEFT JOIN materials m ON n.item_id = m.id AND n.type = 'material'
            WHERE n.user_id = :id
            ORDER BY n.updated_at DESC"
        );
        $stmt->execute([':id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Creates or updates one private question note for its owner.
     * The unique user/item/type key makes this mutation idempotent.
     *
     * @since 1.0.0
     */
    public function upsertUserQuestionNote(string $userId, int $questionId, string $noteText): ?array
    {
        $stmt = $this->db->prepare(
            "INSERT INTO user_notes (id, user_id, item_id, type, note_text)
             VALUES (:id, :user_id, :item_id, 'question', :note_text)
             ON DUPLICATE KEY UPDATE
                 note_text = VALUES(note_text),
                 updated_at = CURRENT_TIMESTAMP"
        );
        $stmt->execute([
            ':id' => bin2hex(random_bytes(16)),
            ':user_id' => $userId,
            ':item_id' => (string) $questionId,
            ':note_text' => $noteText,
        ]);

        return $this->findUserNoteByItem($userId, (string) $questionId, 'question');
    }

    /**
     * Deletes a note by its logical owner/item key. Missing notes are harmless
     * because clearing a note must be idempotent from the interface.
     *
     * @since 1.0.0
     */
    public function deleteUserNoteByItem(string $userId, string $itemId, string $type): bool
    {
        $stmt = $this->db->prepare(
            'DELETE FROM user_notes WHERE user_id = :user_id AND item_id = :item_id AND type = :type'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':item_id' => $itemId,
            ':type' => $type,
        ]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Loads the note row returned to the frontend after a successful mutation.
     *
     * @since 1.0.0
     */
    private function findUserNoteByItem(string $userId, string $itemId, string $type): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT
                n.id,
                n.item_id,
                n.type,
                n.note_text,
                n.updated_at,
                q.enunciado_clean AS question_snippet,
                m.title AS material_title
             FROM user_notes n
             LEFT JOIN questions q ON n.item_id = q.id AND n.type = 'question'
             LEFT JOIN materials m ON n.item_id = m.id AND n.type = 'material'
             WHERE n.user_id = :user_id
               AND n.item_id = :item_id
               AND n.type = :type
             LIMIT 1"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':item_id' => $itemId,
            ':type' => $type,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Lista as respostas do Usuario para historico e progresso consolidado.
      * @since 1.0.0
     */
    public function fetchUserAnswersById(string $userId): array
    {
        $stmt = $this->db->prepare(
            "SELECT
                ua.id,
                ua.question_id,
                ua.is_correct,
                ua.selected_option_index,
                ua.created_at,
                ua.time_taken_seconds,
                ua.simulation_id,
                COALESCE(
                    MAX(CASE WHEN f.meta_materia = 1 THEN f.name END),
                    MAX(CASE WHEN parent_filter.meta_materia = 1 THEN parent_filter.name END),
                    MAX(CASE WHEN f.parent_id IS NULL THEN f.name END),
                    ''
                ) AS subject_name,
                GROUP_CONCAT(
                    DISTINCT CONCAT(
                        f.id,
                        '::',
                        f.name,
                        '::',
                        COALESCE(f.slug, ''),
                        '::',
                        COALESCE(f.parent_id, ''),
                        '::',
                        COALESCE(f.meta_materia, 0)
                    )
                    ORDER BY f.meta_materia DESC, f.parent_id IS NULL DESC, f.name
                    SEPARATOR '||'
                ) AS subject_filters
            FROM user_answers ua
            LEFT JOIN question_filters qf ON qf.question_id = ua.question_id
            LEFT JOIN filters f ON f.id = qf.filter_id AND f.type = 'assunto'
            LEFT JOIN filters parent_filter ON parent_filter.id = f.parent_id
            WHERE ua.user_id = :id
            GROUP BY
                ua.id,
                ua.question_id,
                ua.is_correct,
                ua.selected_option_index,
                ua.created_at,
                ua.time_taken_seconds,
                ua.simulation_id
            ORDER BY ua.created_at DESC"
        );
        $stmt->execute([':id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Lista Usuarios com o resumo de billing esperado pela area administrativa.
      * @since 1.0.0
     */
    public function fetchUsersAdminList(): array
    {
        $stmt = $this->db->prepare(
            "SELECT
                u.id,
                u.name,
                u.email,
                u.photo_url,
                u.role,
                u.status,
                u.plan AS user_plan,
                u.xp,
                u.level,
                u.reputation,
                u.target_exam,
                u.created_at,
                s.status AS subscription_status,
                s.current_period_end,
                s.plan_id,
                p.name AS plan_name,
                p.price AS plan_price,
                p.interval_unit AS plan_interval
            FROM users u
            LEFT JOIN user_subscriptions s
                ON u.id = s.user_id
               AND s.status = 'active'
            LEFT JOIN plans p
                ON s.plan_id = p.id
            WHERE COALESCE(u.status, 'active') NOT IN ('deleted', 'pending_deletion')
            ORDER BY u.created_at DESC"
        );
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Busca candidatos ao ranking publico de XP sem expor dados sensiveis.
      * @since 1.0.0
     */
    public function fetchPublicXpLeaderboardCandidates(int $limit = 200): array
    {
        $safeLimit = max(1, min(500, $limit));
        $stmt = $this->db->prepare(
            "SELECT
                u.id,
                u.name,
                u.photo_url,
                u.xp,
                u.level,
                u.reputation,
                u.target_exam,
                u.preferences,
                COALESCE(us.current_streak, 0) AS streak_days,
                COALESCE(ua.answered_questions, 0) AS answered_questions,
                COALESCE(ua.correct_answers, 0) AS correct_answers,
                (
                    SELECT GROUP_CONCAT(CONCAT_WS('::', ub.badge_key, ub.title) ORDER BY ub.awarded_at DESC SEPARATOR '||')
                    FROM user_badges ub
                    WHERE ub.user_id = u.id
                ) AS badges_summary
             FROM users u
             LEFT JOIN user_streaks us ON us.user_id = u.id
             LEFT JOIN (
                SELECT
                    user_id,
                    COUNT(*) AS answered_questions,
                    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_answers
                FROM user_answers
                GROUP BY user_id
             ) ua ON ua.user_id = u.id
             WHERE COALESCE(u.status, 'active') = 'active'
             ORDER BY COALESCE(u.xp, 0) DESC, COALESCE(u.level, 1) DESC, u.name ASC
             LIMIT :limit"
        );
        $stmt->bindValue(':limit', $safeLimit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Remove uma anotacao respeitando a ownership resolvida pelo service.
      * @since 1.0.0
     */
    public function deleteUserNoteById(string $userId, string $noteId): int
    {
        $stmt = $this->db->prepare(
            'DELETE FROM user_notes WHERE id = :id AND user_id = :user_id'
        );
        $stmt->execute([
            ':id' => $noteId,
            ':user_id' => $userId,
        ]);

        return $stmt->rowCount();
    }

    /**
     * Marca a conta como pendente de exclusao sem apagar dados imediatamente.
      * @since 1.0.0
     */
    public function markDeletionRequested(string $userId, string $reason): void
    {
        $stmt = $this->db->prepare(
            "UPDATE users
             SET status = 'pending_deletion',
                 deletion_requested_at = NOW(),
                 deletion_reason = :reason
             WHERE id = :id"
        );
        $stmt->execute([
            ':reason' => $reason,
            ':id' => $userId,
        ]);
    }

    /**
     * Busca um cartao salvo do Usuario para operacoes de remocao/default.
      * @since 1.0.0
     */
    public function findUserCardById(string $userId, string $cardId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT
                id,
                payment_provider,
                stripe_payment_method_id,
                provider_customer_id,
                mp_card_id,
                mp_customer_id,
                brand,
                last_four_digits,
                exp_month,
                exp_year,
                holder_name,
                is_default,
                locked_by_recurring,
                created_at
            FROM user_cards
            WHERE id = :card_id
              AND user_id = :user_id
            LIMIT 1"
        );
        $stmt->execute([
            ':card_id' => $cardId,
            ':user_id' => $userId,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /**
     * Remove um cartao salvo do Usuario autenticado.
      * @since 1.0.0
     */
    public function deleteUserCardById(string $userId, string $cardId): int
    {
        $stmt = $this->db->prepare(
            'DELETE FROM user_cards WHERE id = :card_id AND user_id = :user_id'
        );
        $stmt->execute([
            ':card_id' => $cardId,
            ':user_id' => $userId,
        ]);

        return $stmt->rowCount();
    }

    /**
     * Limpa o card padrao do Usuario independentemente do provedor.
      * @since 1.0.0
     */
    public function clearDefaultCards(string $userId): void
    {
        $stmt = $this->db->prepare(
            'UPDATE user_cards SET is_default = 0 WHERE user_id = :user_id'
        );
        $stmt->execute([':user_id' => $userId]);
    }

    /**
     * Marca um cartao especifico como padrao.
      * @since 1.0.0
     */
    public function markUserCardAsDefault(string $userId, string $cardId): int
    {
        $stmt = $this->db->prepare(
            'UPDATE user_cards SET is_default = 1 WHERE id = :card_id AND user_id = :user_id'
        );
        $stmt->execute([
            ':card_id' => $cardId,
            ':user_id' => $userId,
        ]);

        return $stmt->rowCount();
    }

    /**
     * Retorna o id do cartao mais recente para promover a padrao quando necessario.
      * @since 1.0.0
     */
    public function findLatestUserCardId(string $userId): ?string
    {
        $stmt = $this->db->prepare(
            "SELECT id
             FROM user_cards
             WHERE user_id = :user_id
             ORDER BY created_at DESC
             LIMIT 1"
        );
        $stmt->execute([':user_id' => $userId]);
        $cardId = $stmt->fetchColumn();

        return $cardId ? (string) $cardId : null;
    }

    /**
     * Conta quantos cartoes salvos o Usuario ainda possui.
      * @since 1.0.0
     */
    public function countUserCards(string $userId): int
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM user_cards WHERE user_id = :user_id');
        $stmt->execute([':user_id' => $userId]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Informa se o usuario possui uma assinatura recorrente ativa com renovacao habilitada.
      * @since 1.0.0
     */
    public function hasActiveAutoRenewingSubscription(string $userId): bool
    {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*)
             FROM user_subscriptions
             WHERE user_id = :user_id
               AND status IN ('active', 'trialing', 'past_due')
               AND auto_renew = 1
               AND (cancel_at_period_end IS NULL OR cancel_at_period_end = 0)"
        );
        $stmt->execute([':user_id' => $userId]);

        return (int) $stmt->fetchColumn() > 0;
    }

    /**
     * Lista usuarios com assinatura ativa e renovacao automatica para auditoria periodica de cartao.
      * @since 1.0.0
     */
    public function listActiveAutoRenewingSubscriptionUserIds(): array
    {
        $stmt = $this->db->query(
            "SELECT DISTINCT user_id
             FROM user_subscriptions
             WHERE status IN ('active', 'trialing', 'past_due')
               AND auto_renew = 1
               AND (cancel_at_period_end IS NULL OR cancel_at_period_end = 0)"
        );

        return array_values(array_filter(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN))));
    }

    /**
     * Procura cartao duplicado pelo espelho local usado no billing legado.
      * @since 1.0.0
     */
    public function findUserCardIdByBrandAndLastFour(string $userId, string $brand, string $lastFour): ?string
    {
        $stmt = $this->db->prepare(
            'SELECT id FROM user_cards WHERE user_id = :user_id AND brand = :brand AND last_four_digits = :last_four LIMIT 1'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':brand' => $brand,
            ':last_four' => $lastFour,
        ]);

        $cardId = $stmt->fetchColumn();
        return $cardId ? (string) $cardId : null;
    }

    /**
     * Insere um novo cartao legado/local no cofre do Usuario.
      * @since 1.0.0
     */
    public function insertLegacySavedCard(string $userId, array $cardData): string
    {
        $cardId = bin2hex(random_bytes(16));
        $stmt = $this->db->prepare(
            "INSERT INTO user_cards (
                id,
                user_id,
                payment_provider,
                mp_card_id,
                brand,
                last_four_digits,
                exp_month,
                exp_year,
                holder_name,
                is_default,
                locked_by_recurring
            ) VALUES (
                :id,
                :user_id,
                'mercado_pago',
                :mp_card_id,
                :brand,
                :last_four_digits,
                :exp_month,
                :exp_year,
                :holder_name,
                :is_default,
                0
            )"
        );
        $stmt->execute([
            ':id' => $cardId,
            ':user_id' => $userId,
            ':mp_card_id' => $cardData['mp_card_id'],
            ':brand' => $cardData['brand'],
            ':last_four_digits' => $cardData['last_four_digits'],
            ':exp_month' => $cardData['exp_month'],
            ':exp_year' => $cardData['exp_year'],
            ':holder_name' => $cardData['holder_name'],
            ':is_default' => $cardData['is_default'] ? 1 : 0,
        ]);

        return $cardId;
    }

    /**
     * Mantem o espelho legado `users.has_saved_card` sincronizado com o cofre.
      * @since 1.0.0
     */
    public function updateHasSavedCard(string $userId, bool $hasSavedCard): void
    {
        $stmt = $this->db->prepare(
            'UPDATE users SET has_saved_card = :has_saved_card WHERE id = :user_id'
        );
        $stmt->execute([
            ':has_saved_card' => $hasSavedCard ? 1 : 0,
            ':user_id' => $userId,
        ]);
    }

    /**
     * Busca a assinatura atual mais relevante do Usuario autenticado.
      * @since 1.0.0
     */
    public function findLatestSubscriptionSnapshot(string $userId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT
                us.*,
                p.name AS plan_name,
                p.price,
                p.interval_unit,
                p.interval_count,
                p.tier
            FROM user_subscriptions us
            JOIN plans p ON us.plan_id = p.id
            WHERE us.user_id = :uid
              AND us.status IN ('active', 'trialing', 'past_due')
            ORDER BY us.id DESC
            LIMIT 1"
        );
        $stmt->execute([':uid' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Busca o ultimo status de transacao de plano para expor pedido de reembolso pendente.
      * @since 1.0.0
     */
    public function findLatestPlanTransactionStatus(string $userId): ?string
    {
        $stmt = $this->db->prepare(
            "SELECT status
             FROM transactions
             WHERE user_id = :uid
               AND type = 'plan'
             ORDER BY created_at DESC
             LIMIT 1"
        );
        $stmt->execute([':uid' => $userId]);
        $status = $stmt->fetchColumn();

        return $status ? (string) $status : null;
    }

    /**
     * Recupera o cartao preferencial para checagens basicas de vencimento.
      * @since 1.0.0
     */
    public function findPreferredCardExpiry(string $userId): ?array
    {
        $queries = [
            "SELECT brand, last_four_digits, exp_month, exp_year
             FROM user_cards
             WHERE user_id = :uid
               AND locked_by_recurring = 1
             ORDER BY is_default DESC, created_at DESC
             LIMIT 1",
            "SELECT brand, last_four_digits, exp_month, exp_year
             FROM user_cards
             WHERE user_id = :uid
               AND is_default = 1
             LIMIT 1",
            "SELECT brand, last_four_digits, exp_month, exp_year
             FROM user_cards
             WHERE user_id = :uid
             LIMIT 1",
        ];

        foreach ($queries as $query) {
            $stmt = $this->db->prepare($query);
            $stmt->execute([':uid' => $userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (is_array($row)) {
                return $row;
            }
        }

        return null;
    }

    /**
     * Evita criar notificacoes repetidas para o mesmo alerta de cobranca.
      * @since 1.0.0
     */
    public function hasRecentNotification(string $userId, string $title, ?string $link, int $lookbackHours = 168): bool
    {
        $cutoff = date('Y-m-d H:i:s', time() - max(1, $lookbackHours) * 3600);

        $stmt = $this->db->prepare(
            "SELECT COUNT(*)
             FROM notifications
             WHERE user_id = :user_id
               AND title = :title
               AND ((link IS NULL AND :link IS NULL) OR link = :link)
               AND created_at >= :cutoff"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':title' => $title,
            ':link' => $link,
            ':cutoff' => $cutoff,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    }

    /**
     * Atualiza apenas os campos de Usuario realmente permitidos no perfil autenticado.
      * @since 1.0.0
     */
    public function updateUserFields(string $userId, array $fields): void
    {
        if ($fields === []) {
            return;
        }

        $this->ensureUserProfileColumns();

        $set = [];
        $params = [':id' => $userId];

        foreach ($fields as $column => $value) {
            $placeholder = ':' . $column;
            $set[] = $column . ' = ' . $placeholder;
            $params[$placeholder] = $value;
        }

        $set[] = 'updated_at = NOW()';

        $stmt = $this->db->prepare(
            'UPDATE users SET ' . implode(', ', $set) . ' WHERE id = :id'
        );
        $stmt->execute($params);
    }

    /**
     * Persiste o endereco em formato upsert para evitar logica SQL no service.
      * @since 1.0.0
     */
    public function upsertAddress(string $userId, array $address): void
    {
        $existsStmt = $this->db->prepare('SELECT user_id FROM addresses WHERE user_id = :id LIMIT 1');
        $existsStmt->execute([':id' => $userId]);
        $exists = (bool) $existsStmt->fetchColumn();

        if ($exists) {
            $stmt = $this->db->prepare(
                'UPDATE addresses
                 SET zip_code = :zip_code,
                     street = :street,
                     number = :number,
                     complement = :complement,
                     neighborhood = :neighborhood,
                     city = :city,
                     state = :state
                 WHERE user_id = :user_id'
            );
        } else {
            $stmt = $this->db->prepare(
                'INSERT INTO addresses (
                    user_id,
                    zip_code,
                    street,
                    number,
                    complement,
                    neighborhood,
                    city,
                    state
                ) VALUES (
                    :user_id,
                    :zip_code,
                    :street,
                    :number,
                    :complement,
                    :neighborhood,
                    :city,
                    :state
                )'
            );
        }

        $stmt->execute([
            ':user_id' => $userId,
            ':zip_code' => $address['zip_code'] ?? null,
            ':street' => $address['street'] ?? null,
            ':number' => $address['number'] ?? null,
            ':complement' => $address['complement'] ?? null,
            ':neighborhood' => $address['neighborhood'] ?? null,
            ':city' => $address['city'] ?? null,
            ':state' => $address['state'] ?? null,
        ]);
    }

    /**
     * Persiste os dados bancarios suportados hoje pelo schema transacional.
      * @since 1.0.0
     */
    public function upsertBankAccount(string $userId, array $bankAccount): void
    {
        $existsStmt = $this->db->prepare('SELECT user_id FROM bank_accounts WHERE user_id = :id LIMIT 1');
        $existsStmt->execute([':id' => $userId]);
        $exists = (bool) $existsStmt->fetchColumn();

        if ($exists) {
            $stmt = $this->db->prepare(
                'UPDATE bank_accounts
                 SET bank_code = :bank_code,
                     bank_name = :bank_name,
                     agency = :agency,
                     account = :account,
                     account_digit = :account_digit,
                     holder_name = :holder_name,
                     holder_document = :holder_document,
                     account_type = :account_type
                 WHERE user_id = :user_id'
            );
        } else {
            $stmt = $this->db->prepare(
                'INSERT INTO bank_accounts (
                    user_id,
                    bank_code,
                    bank_name,
                    agency,
                    account,
                    account_digit,
                    holder_name,
                    holder_document,
                    account_type
                ) VALUES (
                    :user_id,
                    :bank_code,
                    :bank_name,
                    :agency,
                    :account,
                    :account_digit,
                    :holder_name,
                    :holder_document,
                    :account_type
                )'
            );
        }

        $stmt->execute([
            ':user_id' => $userId,
            ':bank_code' => $bankAccount['bank_code'] ?? null,
            ':bank_name' => $bankAccount['bank_name'] ?? null,
            ':agency' => $bankAccount['agency'] ?? null,
            ':account' => $bankAccount['account'] ?? null,
            ':account_digit' => $bankAccount['account_digit'] ?? null,
            ':holder_name' => $bankAccount['holder_name'] ?? null,
            ':holder_document' => $bankAccount['holder_document'] ?? null,
            ':account_type' => $bankAccount['account_type'] ?? 'checking',
        ]);
    }
}
