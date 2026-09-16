<?php

declare(strict_types=1);

/**
 * Politica server-side para decidir se uma intent pode usar um canal.
 * Comunicacoes transacionais nao podem ser desligadas por preferencia de marketing.
 */
final class CommunicationPolicy
{
    public const CHANNEL_IN_APP = 'in_app';
    public const CHANNEL_EMAIL = 'email';
    public const CLASS_TRANSACTIONAL = 'transactional';
    public const CLASS_MARKETING = 'marketing';

    public function __construct(private readonly PDO $db)
    {
    }

    public function allows(string $deliveryClass, string $channel, ?string $userId = null): bool
    {
        $deliveryClass = trim($deliveryClass);
        $channel = trim($channel);
        if (!in_array($deliveryClass, [self::CLASS_TRANSACTIONAL, self::CLASS_MARKETING], true)) {
            return false;
        }
        if (!in_array($channel, [self::CHANNEL_IN_APP, self::CHANNEL_EMAIL], true)) {
            return false;
        }

        if ($deliveryClass === self::CLASS_TRANSACTIONAL) {
            return true;
        }

        if ($userId === null || trim($userId) === '') {
            return true;
        }

        $stmt = $this->db->prepare(
            'SELECT enabled FROM communication_preferences
             WHERE user_id = :user_id AND delivery_class = :delivery_class
               AND channel = :channel LIMIT 1'
        );
        $stmt->execute([
            ':user_id' => trim($userId),
            ':delivery_class' => $deliveryClass,
            ':channel' => $channel,
        ]);
        $value = $stmt->fetchColumn();

        return $value === false || (int) $value === 1;
    }
}
