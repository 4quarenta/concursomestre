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

require_once __DIR__ . '/notification_helper.php';

/**
 * Helper transversal para recompensas idempotentes de XP, reputacao e badges.
 * O ledger evita duplicidade em webhooks, retries e moderacoes repetidas.
 *
 * @since 1.0.0
 */
function ensureGamificationSupportSchema(PDO $db): void
{
    ensureGamificationUserColumn($db, 'xp', "ALTER TABLE users ADD COLUMN xp INT DEFAULT 0");
    ensureGamificationUserColumn($db, 'level', "ALTER TABLE users ADD COLUMN level INT DEFAULT 1");
    ensureGamificationUserColumn($db, 'reputation', "ALTER TABLE users ADD COLUMN reputation INT DEFAULT 0");

    $db->exec("
        CREATE TABLE IF NOT EXISTS user_badges (
            user_id VARCHAR(64) NOT NULL,
            badge_key VARCHAR(80) NOT NULL,
            title VARCHAR(160) NOT NULL,
            description VARCHAR(255) NULL,
            awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, badge_key),
            INDEX idx_user_badges_awarded_at (awarded_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS user_gamification_events (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            event_key VARCHAR(180) NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            event_name VARCHAR(80) NOT NULL,
            xp_delta INT NOT NULL DEFAULT 0,
            reputation_delta INT NOT NULL DEFAULT 0,
            badge_key VARCHAR(80) NULL,
            metadata_json TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_user_gamification_event_key (event_key),
            INDEX idx_user_gamification_user_created (user_id, created_at),
            INDEX idx_user_gamification_event_name (event_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    ensureGamificationEventColumn($db, 'badge_key', "ALTER TABLE user_gamification_events ADD COLUMN badge_key VARCHAR(80) NULL AFTER reputation_delta");
    ensureGamificationEventColumn($db, 'metadata_json', "ALTER TABLE user_gamification_events ADD COLUMN metadata_json TEXT NULL AFTER badge_key");
}

function ensureGamificationUserColumn(PDO $db, string $column, string $alterSql): void
{
    $stmt = $db->prepare("
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = :column
    ");
    $stmt->execute([':column' => $column]);

    if ((int) $stmt->fetchColumn() === 0) {
        $db->exec($alterSql);
    }
}

function ensureGamificationEventColumn(PDO $db, string $column, string $alterSql): void
{
    $stmt = $db->prepare("
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'user_gamification_events'
          AND COLUMN_NAME = :column
    ");
    $stmt->execute([':column' => $column]);

    if ((int) $stmt->fetchColumn() === 0) {
        $db->exec($alterSql);
    }
}

function gamificationHelperReadSystemSetting(PDO $db, string $key, $fallback = null)
{
    try {
        $stmt = $db->prepare('SELECT value_json FROM system_settings WHERE key_name = :key LIMIT 1');
        $stmt->execute([':key' => $key]);
        $rawValue = $stmt->fetchColumn();

        if ($rawValue === false) {
            return $fallback;
        }

        $decoded = json_decode((string) $rawValue, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $rawValue;
    } catch (Throwable $e) {
        return $fallback;
    }
}

function gamificationHelperBoolean($value, bool $fallback = true): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return (int) $value !== 0;
    }

    if (is_string($value)) {
        $normalized = strtolower(trim($value));
        if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
            return true;
        }
        if (in_array($normalized, ['0', 'false', 'no', 'off', ''], true)) {
            return false;
        }
    }

    return $fallback;
}

function isGamificationEventEnabled(PDO $db, string $eventName): bool
{
    $effect = resolveGamificationEventEffect($db, $eventName, 0, 0);

    return (bool) $effect['enabled'];
}

function findGamificationRule(array $settings, string $eventName): ?array
{
    $rules = is_array($settings['rules'] ?? null) ? $settings['rules'] : [];
    $normalizedEventName = strtolower(trim($eventName));

    foreach ($rules as $rule) {
        if (!is_array($rule)) {
            continue;
        }

        $candidateEvent = strtolower(trim((string) ($rule['eventName'] ?? '')));
        $candidateKey = strtolower(trim((string) ($rule['key'] ?? '')));
        if ($candidateEvent === $normalizedEventName || $candidateKey === $normalizedEventName) {
            return $rule;
        }
    }

    return null;
}

/**
 * Resolve se o evento esta ativo e quais deltas devem ser aplicados.
 * Regras simples usam o XP configurado no admin; regras com maxXp preservam valores
 * calculados pelo dominio, respeitando teto e base configuravel.
 *
 * @return array{enabled:bool,xp_delta:int,reputation_delta:int,configured:bool}
 */
function resolveGamificationEventEffect(PDO $db, string $eventName, int $xpDelta, int $reputationDelta): array
{
    $settings = gamificationHelperReadSystemSetting($db, 'gamification', []);
    if (!is_array($settings)) {
        return [
            'enabled' => true,
            'xp_delta' => $xpDelta,
            'reputation_delta' => $reputationDelta,
            'configured' => false,
        ];
    }

    if (!gamificationHelperBoolean($settings['enabled'] ?? true, true)) {
        return [
            'enabled' => false,
            'xp_delta' => 0,
            'reputation_delta' => 0,
            'configured' => false,
        ];
    }

    $rule = findGamificationRule($settings, $eventName);
    if (!is_array($rule)) {
        return [
            'enabled' => true,
            'xp_delta' => $xpDelta,
            'reputation_delta' => $reputationDelta,
            'configured' => false,
        ];
    }

    if (!gamificationHelperBoolean($rule['enabled'] ?? true, true)) {
        return [
            'enabled' => false,
            'xp_delta' => 0,
            'reputation_delta' => 0,
            'configured' => true,
        ];
    }

    $resolvedXp = $xpDelta;
    if (array_key_exists('xp', $rule) && is_numeric($rule['xp'])) {
        $configuredXp = (int) $rule['xp'];
        $hasMaxXp = array_key_exists('maxXp', $rule) && is_numeric($rule['maxXp']);
        if ($hasMaxXp) {
            $maxXp = max(0, (int) $rule['maxXp']);
            if ($xpDelta > 0 && $xpDelta <= $configuredXp) {
                $resolvedXp = min($configuredXp, $maxXp);
            } elseif ($xpDelta > 0) {
                $resolvedXp = min($xpDelta, $maxXp);
            } else {
                $resolvedXp = $xpDelta;
            }
        } else {
            $resolvedXp = $configuredXp;
        }
    }

    $resolvedReputation = $reputationDelta;
    if (array_key_exists('reputation', $rule) && is_numeric($rule['reputation'])) {
        $resolvedReputation = (int) $rule['reputation'];
    }

    return [
        'enabled' => true,
        'xp_delta' => $resolvedXp,
        'reputation_delta' => $resolvedReputation,
        'configured' => true,
    ];
}

/**
 * Registra um evento de gamificacao uma unica vez e aplica seus efeitos.
 *
 * @return array{applied:bool,badge_awarded:bool}
 */
function grantGamificationEvent(
    PDO $db,
    string $userId,
    string $eventName,
    string $eventKey,
    int $xpDelta = 0,
    int $reputationDelta = 0,
    ?array $badge = null,
    ?array $metadata = null
): array {
    $userId = trim($userId);
    $eventName = trim($eventName);
    $eventKey = trim($eventKey);

    if ($userId === '' || $eventName === '' || $eventKey === '') {
        return ['applied' => false, 'badge_awarded' => false];
    }

    $effect = resolveGamificationEventEffect($db, $eventName, $xpDelta, $reputationDelta);
    if (!$effect['enabled']) {
        return ['applied' => false, 'badge_awarded' => false, 'disabled' => true];
    }
    $xpDelta = (int) $effect['xp_delta'];
    $reputationDelta = (int) $effect['reputation_delta'];

    ensureGamificationSupportSchema($db);

    $badgeKey = is_array($badge) ? trim((string) ($badge['key'] ?? '')) : '';
    $stmt = $db->prepare("
        INSERT IGNORE INTO user_gamification_events (
            event_key,
            user_id,
            event_name,
            xp_delta,
            reputation_delta,
            badge_key,
            metadata_json
        ) VALUES (
            :event_key,
            :user_id,
            :event_name,
            :xp_delta,
            :reputation_delta,
            :badge_key,
            :metadata_json
        )
    ");
    $stmt->execute([
        ':event_key' => $eventKey,
        ':user_id' => $userId,
        ':event_name' => $eventName,
        ':xp_delta' => $xpDelta,
        ':reputation_delta' => $reputationDelta,
        ':badge_key' => $badgeKey !== '' ? $badgeKey : null,
        ':metadata_json' => $metadata ? json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
    ]);

    if ($stmt->rowCount() <= 0) {
        return ['applied' => false, 'badge_awarded' => false];
    }

    if ($xpDelta !== 0 || $reputationDelta !== 0) {
        $update = $db->prepare("
            UPDATE users
            SET xp = GREATEST(0, COALESCE(xp, 0) + :xp_delta),
                level = FLOOR(GREATEST(0, COALESCE(xp, 0) + :xp_delta) / 1000) + 1,
                reputation = LEAST(100, GREATEST(0, COALESCE(reputation, 0) + :reputation_delta))
            WHERE id = :user_id
        ");
        $update->execute([
            ':xp_delta' => $xpDelta,
            ':reputation_delta' => $reputationDelta,
            ':user_id' => $userId,
        ]);
    }

    $badgeAwarded = false;
    if ($badgeKey !== '') {
        $badgeAwarded = grantGamificationBadge(
            $db,
            $userId,
            $badgeKey,
            (string) ($badge['title'] ?? $badgeKey),
            (string) ($badge['description'] ?? '')
        );
    }

    return ['applied' => true, 'badge_awarded' => $badgeAwarded];
}

function grantGamificationBadge(PDO $db, string $userId, string $badgeKey, string $title, string $description = ''): bool
{
    ensureGamificationSupportSchema($db);

    $stmt = $db->prepare("
        INSERT IGNORE INTO user_badges (user_id, badge_key, title, description, awarded_at)
        VALUES (:user_id, :badge_key, :title, :description, NOW())
    ");
    $stmt->execute([
        ':user_id' => $userId,
        ':badge_key' => $badgeKey,
        ':title' => $title,
        ':description' => $description,
    ]);

    return $stmt->rowCount() > 0;
}

function applyMarketplaceSaleGamification(
    PDO $db,
    string $buyerId,
    string $sellerId,
    string $materialId,
    string $materialTitle,
    string $referenceId
): void {
    $materialId = trim($materialId);
    $referenceId = trim($referenceId) !== '' ? trim($referenceId) : $materialId;
    $materialTitle = trim($materialTitle) !== '' ? trim($materialTitle) : 'Material';

    $buyerReward = grantGamificationEvent(
        $db,
        $buyerId,
        'marketplace_purchase_completed',
        'marketplace_purchase:' . $buyerId . ':' . $referenceId,
        25,
        0,
        [
            'key' => 'first_material_purchase',
            'title' => 'Primeiro material adquirido',
            'description' => 'Voce adicionou seu primeiro material a biblioteca.',
        ],
        ['material_id' => $materialId, 'material_title' => $materialTitle]
    );

    if (!empty($buyerReward['badge_awarded'])) {
        createNotification(
            $db,
            $buyerId,
            'Badge desbloqueado',
            'Primeiro material adquirido: sua biblioteca ja comecou a crescer.',
            'success',
            'system',
            '/profile?tab=achievements'
        );
    }

    if ($sellerId === '' || $sellerId === $buyerId) {
        return;
    }

    $sellerReward = grantGamificationEvent(
        $db,
        $sellerId,
        'marketplace_sale_completed',
        'marketplace_sale:' . $sellerId . ':' . $referenceId,
        50,
        2,
        [
            'key' => 'first_marketplace_sale',
            'title' => 'Primeira venda no marketplace',
            'description' => 'Seu primeiro material foi vendido na plataforma.',
        ],
        ['material_id' => $materialId, 'material_title' => $materialTitle]
    );

    if (!empty($sellerReward['badge_awarded'])) {
        createNotification(
            $db,
            $sellerId,
            'Badge desbloqueado',
            'Primeira venda no marketplace: seu conteudo ja chegou a um aluno.',
            'success',
            'system',
            '/profile?tab=achievements'
        );
    }
}

function applyMaterialModerationGamification(
    PDO $db,
    string $authorId,
    string $materialId,
    string $status,
    ?string $previousStatus,
    string $materialTitle
): void {
    if ($authorId === '' || $materialId === '' || $status !== 'approved' || $previousStatus === 'approved') {
        return;
    }

    $reward = grantGamificationEvent(
        $db,
        $authorId,
        'marketplace_material_approved',
        'material_approved:' . $materialId,
        30,
        1,
        [
            'key' => 'first_material_approved',
            'title' => 'Primeiro material aprovado',
            'description' => 'Um material seu passou pela curadoria do marketplace.',
        ],
        ['material_id' => $materialId, 'material_title' => $materialTitle]
    );

    if (!empty($reward['badge_awarded'])) {
        createNotification(
            $db,
            $authorId,
            'Badge desbloqueado',
            'Primeiro material aprovado: sua vitrine esta oficialmente no ar.',
            'success',
            'system',
            '/profile?tab=achievements'
        );
    }
}

function applyMarketplaceRefundGamification(
    PDO $db,
    string $buyerId,
    string $sellerId,
    string $transactionId,
    string $materialTitle
): void {
    if ($sellerId === '' || $sellerId === $buyerId || $transactionId === '') {
        return;
    }

    grantGamificationEvent(
        $db,
        $sellerId,
        'marketplace_refund_processed',
        'marketplace_refund:' . $transactionId,
        0,
        -2,
        null,
        ['material_title' => $materialTitle]
    );
}

function notifyAppliedXpReward(
    PDO $db,
    string $userId,
    string $title,
    string $message,
    string $category = 'system',
    ?string $link = '/levels',
    ?string $ruleKey = null
): void {
    createNotification($db, $userId, $title, $message, 'success', $category, $link, $ruleKey);
}

function applyProfilePhotoGamification(PDO $db, string $userId): void
{
    $reward = grantGamificationEvent(
        $db,
        $userId,
        'profile_photo_uploaded',
        'profile_photo_uploaded:' . $userId,
        10,
        0,
        [
            'key' => 'profile_photo_uploaded',
            'title' => 'Perfil com foto',
            'description' => 'Voce personalizou sua foto de perfil.',
        ],
        ['source' => 'profile_photo_upload']
    );

    if (!empty($reward['applied'])) {
        notifyAppliedXpReward(
            $db,
            $userId,
            'Perfil atualizado',
            'Voce ganhou +10 XP por adicionar uma foto ao perfil.',
            'system',
            '/profile?tab=achievements',
            'profile_updated'
        );
    }
}

function applyProfileCompletionGamification(PDO $db, string $userId, array $profile): void
{
    $filledFields = 0;
    foreach (['name', 'email', 'phone', 'cpf', 'target_exam', 'photo_url'] as $field) {
        if (trim((string) ($profile[$field] ?? '')) !== '') {
            $filledFields++;
        }
    }

    if ($filledFields < 5) {
        return;
    }

    $reward = grantGamificationEvent(
        $db,
        $userId,
        'profile_completed',
        'profile_completed:' . $userId,
        40,
        1,
        [
            'key' => 'profile_completed',
            'title' => 'Perfil completo',
            'description' => 'Seu perfil esta completo para uma experiencia mais personalizada.',
        ],
        ['filled_fields' => $filledFields]
    );

    if (!empty($reward['applied'])) {
        notifyAppliedXpReward(
            $db,
            $userId,
            'Perfil completo',
            'Voce ganhou +40 XP por completar seus dados principais.',
            'system',
            '/profile?tab=achievements',
            'profile_completed'
        );
    }
}

function applyReportSubmissionGamification(PDO $db, string $userId, string $reportId, string $targetType, string $targetId): void
{
    $reward = grantGamificationEvent(
        $db,
        $userId,
        'report_submitted',
        'report_submitted:' . $reportId,
        2,
        0,
        [
            'key' => 'first_report_submitted',
            'title' => 'Primeira denuncia enviada',
            'description' => 'Voce ajudou a sinalizar um problema para moderacao.',
        ],
        [
            'report_id' => $reportId,
            'target_type' => $targetType,
            'target_id' => $targetId,
        ]
    );

    if (!empty($reward['applied'])) {
        notifyAppliedXpReward(
            $db,
            $userId,
            'Denuncia recebida',
            'Recebemos sua denuncia. Voce ganhou +2 XP pela contribuicao inicial.',
            'report',
            '/notifications',
            'report_received'
        );
    }
}

function applyFeedbackGamification(
    PDO $db,
    string $userId,
    string $feedbackId,
    string $type,
    string $reason = '',
    ?int $publicRating = null
): void {
    $normalizedType = strtolower(trim($type));
    $normalizedReason = strtolower(trim($reason));
    $isPlatformRating = $publicRating !== null || str_contains($normalizedReason, 'avaliar plataforma');

    if ($isPlatformRating) {
        $eventName = 'platform_rating_submitted';
        $xp = 20;
        $badge = [
            'key' => 'first_platform_rating',
            'title' => 'Avaliacao enviada',
            'description' => 'Voce avaliou a plataforma e ajudou a melhorar a experiencia.',
        ];
        $title = 'Avaliacao recebida';
        $message = 'Obrigado pela avaliacao. Voce ganhou +20 XP por ajudar a plataforma a evoluir.';
    } elseif ($normalizedType === 'suggestion') {
        $eventName = 'suggestion_submitted';
        $xp = 8;
        $badge = [
            'key' => 'first_suggestion_submitted',
            'title' => 'Primeira sugestao enviada',
            'description' => 'Voce sugeriu uma melhoria para a comunidade.',
        ];
        $title = 'Sugestao recebida';
        $message = 'Sua sugestao entrou no mural. Voce ganhou +8 XP por contribuir.';
    } else {
        $eventName = 'support_feedback_submitted';
        $xp = 4;
        $badge = [
            'key' => 'first_support_contact',
            'title' => 'Primeiro contato com suporte',
            'description' => 'Voce usou a central de suporte para falar com a equipe.',
        ];
        $title = 'Atendimento aberto';
        $message = 'Recebemos sua mensagem. Voce ganhou +4 XP por interagir com a plataforma.';
    }

    $reward = grantGamificationEvent(
        $db,
        $userId,
        $eventName,
        $eventName . ':' . $feedbackId,
        $xp,
        $isPlatformRating || $normalizedType === 'suggestion' ? 1 : 0,
        $badge,
        [
            'feedback_id' => $feedbackId,
            'type' => $type,
            'reason' => $reason,
            'public_rating' => $publicRating,
        ]
    );

    if (!empty($reward['applied'])) {
        $ruleKey = $isPlatformRating
            ? 'platform_rating'
            : ($normalizedType === 'suggestion' ? 'suggestion_received' : 'support_opened');
        notifyAppliedXpReward($db, $userId, $title, $message, 'system', '/support', $ruleKey);
    }
}

function applyFeedbackReplyGamification(PDO $db, string $userId, string $feedbackId, string $threadId): void
{
    $reward = grantGamificationEvent(
        $db,
        $userId,
        'support_thread_reply',
        'support_thread_reply:' . $feedbackId,
        2,
        0,
        null,
        [
            'feedback_id' => $feedbackId,
            'thread_id' => $threadId,
        ]
    );

    if (!empty($reward['applied'])) {
        notifyAppliedXpReward(
            $db,
            $userId,
            'Resposta registrada',
            'Voce ganhou +2 XP por manter a conversa de suporte atualizada.',
            'system',
            '/support',
            'support_reply'
        );
    }
}

function applyFeedbackVoteGamification(PDO $db, string $userId, string $feedbackId, ?string $voteValue): void
{
    if (!in_array($voteValue, ['like', 'dislike'], true)) {
        return;
    }

    grantGamificationEvent(
        $db,
        $userId,
        'public_suggestion_vote',
        'public_suggestion_vote:' . $userId . ':' . $feedbackId,
        1,
        0,
        null,
        [
            'feedback_id' => $feedbackId,
            'vote' => $voteValue,
        ]
    );
}

function applyLegalFavoriteGamification(PDO $db, string $userId, string $targetType, string $targetId): void
{
    $reward = grantGamificationEvent(
        $db,
        $userId,
        'legal_favorite_added',
        'legal_favorite:' . $userId . ':' . $targetType . ':' . $targetId,
        3,
        0,
        [
            'key' => 'first_legal_favorite',
            'title' => 'Primeiro favorito na lei comentada',
            'description' => 'Voce salvou um item da lei comentada para revisar depois.',
        ],
        [
            'target_type' => $targetType,
            'target_id' => $targetId,
        ]
    );

    if (!empty($reward['applied'])) {
        notifyAppliedXpReward(
            $db,
            $userId,
            'Favorito salvo',
            'Voce ganhou +3 XP por organizar sua revisao na lei comentada.',
            'system',
            '/lei-comentada',
            'legal_favorite'
        );
    }
}

function applyLegalArticleReadGamification(PDO $db, string $userId, string $lawId, string $articleId, int $progressPercent): void
{
    grantGamificationEvent(
        $db,
        $userId,
        'legal_article_read',
        'legal_article_read:' . $userId . ':' . $articleId,
        2,
        0,
        [
            'key' => 'first_legal_article_read',
            'title' => 'Primeiro artigo lido',
            'description' => 'Voce iniciou a leitura da lei comentada.',
        ],
        [
            'law_id' => $lawId,
            'article_id' => $articleId,
            'progress_percent' => $progressPercent,
        ]
    );

    $milestones = [
        25 => 10,
        50 => 20,
        75 => 30,
        100 => 50,
    ];

    foreach ($milestones as $threshold => $xp) {
        if ($progressPercent < $threshold) {
            continue;
        }

        $reward = grantGamificationEvent(
            $db,
            $userId,
            'legal_reading_progress_milestone',
            'legal_progress:' . $userId . ':' . $lawId . ':' . $threshold,
            $xp,
            $threshold >= 50 ? 1 : 0,
            $threshold === 100 ? [
                'key' => 'first_completed_law_reading',
                'title' => 'Lei lida por completo',
                'description' => 'Voce concluiu a leitura de uma lei comentada.',
            ] : null,
            [
                'law_id' => $lawId,
                'progress_percent' => $threshold,
            ]
        );

        if (!empty($reward['applied'])) {
            notifyAppliedXpReward(
                $db,
                $userId,
                'Progresso na lei comentada',
                'Voce chegou a ' . $threshold . '% de leitura e ganhou +' . $xp . ' XP.',
                'system',
                '/lei-comentada',
                'legal_progress'
            );
        }
    }
}

function applyLegalUserCommentGamification(PDO $db, string $userId, string $commentId, string $articleId): void
{
    $reward = grantGamificationEvent(
        $db,
        $userId,
        'legal_comment_submitted',
        'legal_comment_submitted:' . $commentId,
        4,
        0,
        [
            'key' => 'first_legal_comment',
            'title' => 'Primeiro comentario na lei',
            'description' => 'Voce participou da discussao da lei comentada.',
        ],
        [
            'comment_id' => $commentId,
            'article_id' => $articleId,
        ]
    );

    if (!empty($reward['applied'])) {
        notifyAppliedXpReward(
            $db,
            $userId,
            'Comentario enviado',
            'Seu comentario na lei comentada foi enviado para moderacao. Voce ganhou +4 XP.',
            'social',
            '/lei-comentada',
            'legal_comment'
        );
    }
}

?>
