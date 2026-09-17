<?php

declare(strict_types=1);

require_once __DIR__ . '/CommunicationPolicy.php';

/**
 * Denominador versionado dos eventos de comunicacao suportados no lancamento.
 * A lista descreve responsabilidade e politica; nao recria estado dos dominios.
 */
final class CommunicationEventCatalog
{
    /** @return array<string, array<string, mixed>> */
    public static function all(): array
    {
        return [
            'auth.email.confirmation' => self::transactional(['email'], 'auth_email_confirmation', 'account'),
            'auth.email.confirmation.resend' => self::transactional(['email'], 'auth_email_confirmation_resend', 'account'),
            'auth.account.welcome' => self::transactional(['email'], 'auth_welcome', 'account'),
            'auth.password.reset' => self::transactional(['email'], 'auth_password_reset', 'account'),
            'support.feedback.reply' => self::transactional(['in_app', 'email'], 'support_feedback_reply', 'support'),
            'support.feedback.status' => self::transactional(['in_app', 'email'], 'support_feedback_status', 'support'),
            'support.report.decision' => self::transactional(['in_app', 'email'], 'support_report_decision', 'moderation'),
            'billing.refund.completed' => self::transactional(['in_app', 'email'], 'transaction_refund_completed', 'billing'),
            'billing.refund.requested' => self::transactional(['email'], 'transaction_refund_request_admin', 'billing'),
            'billing.refund.retention_offer.created' => self::transactional(['in_app', 'email'], 'transaction_refund_retention_offer', 'refund_retention'),
            'billing.subscription.welcome' => self::transactional(['in_app', 'email'], 'subscription_welcome', 'billing'),
            'billing.subscription.payment_receipt' => self::transactional(['in_app', 'email'], 'subscription_payment_receipt', 'billing'),
            'billing.subscription.payment_failed' => self::transactional(['in_app', 'email'], 'subscription_payment_failed', 'billing'),
            'billing.subscription.renewal_reminder' => self::transactional(['email'], 'subscription_renewal_reminder', 'billing'),
            'billing.subscription.cancellation' => self::transactional(['email'], 'subscription_cancellation_outcome', 'billing'),
            'billing.subscription.admin_refund_pending' => self::transactional(['email'], 'subscription_refund_pending_admin', 'billing'),
            'billing.subscription.admin_transaction' => self::transactional(['email'], 'subscription_new_admin', 'billing'),
            'billing.subscription.refund_processed' => self::transactional(['email'], 'subscription_refund_processed', 'billing'),
            'billing.subscription.payment_method_update' => self::transactional(['email'], 'subscription_payment_method_update', 'billing'),
            'benefit.applied' => self::transactional(['in_app', 'email'], 'subscription_manual_gift', 'benefit'),
            'benefit.refund.completed' => self::transactional(['email'], 'transaction_refund_completed', 'benefit'),
            'benefit.refund.retention' => self::transactional(['email'], 'transaction_refund_retention_offer', 'refund_retention'),
            'support.platform_rating.created' => self::transactional(['email'], 'platform_rating_admin', 'support'),
            'moderation.report.created' => self::transactional(['email'], 'report_created_admin', 'moderation'),
            'marketing.campaign.message' => self::marketing(['in_app', 'email'], 'marketing_campaign_message', 'marketing'),
            'system.admin.alert' => self::transactional(['in_app'], null, 'system'),
        ];
    }

    private static function transactional(array $channels, ?string $template, string $category): array
    {
        return [
            'deliveryClass' => CommunicationPolicy::CLASS_TRANSACTIONAL,
            'channels' => $channels,
            'category' => $category,
            'mandatory' => true,
            'preferenceBehavior' => 'mandatory',
            'template' => $template,
        ];
    }

    private static function marketing(array $channels, string $template, string $category): array
    {
        return [
            'deliveryClass' => CommunicationPolicy::CLASS_MARKETING,
            'channels' => $channels,
            'category' => $category,
            'mandatory' => false,
            'preferenceBehavior' => 'opt_in_and_campaign_policy',
            'template' => $template,
        ];
    }
}
