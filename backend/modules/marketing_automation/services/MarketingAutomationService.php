<?php

declare(strict_types=1);

require_once __DIR__ . '/../repositories/MarketingAutomationRepository.php';
require_once __DIR__ . '/../../../config/notification_helper.php';
require_once __DIR__ . '/../../../shared/utils/Mailer.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';
require_once __DIR__ . '/../../../shared/communications/CommunicationService.php';
require_once __DIR__ . '/../../marketing/services/MarketingCampaignService.php';
require_once __DIR__ . '/../../marketing/repositories/MarketingCampaignRepository.php';

/**
 * Executor das regras de campanha salvas no painel de marketing.
 *
 * @since 1.0.0
 */
class MarketingAutomationService
{
    private ?MarketingCampaignService $campaignService = null;

    private const ALLOWED_CONDITIONS = [
        'recent_signup',
        'near_subscription',
        'inactive_7_days',
        'trial_ending',
        'saved_questions',
        'elite_upgrade',
    ];

    private const ALLOWED_CHANNELS = ['email', 'notification', 'both'];

    public function __construct(private readonly MarketingAutomationRepository $repository)
    {
    }

    public function run(array $options = []): array
    {
        $dryRun = (bool) ($options['dry_run'] ?? true);
        $limit = max(1, min(500, (int) ($options['limit'] ?? 100)));
        $campaignId = trim((string) ($options['campaign_id'] ?? ''));
        if ($campaignId !== '') {
            return $this->runCampaignScope(
                $campaignId,
                trim((string) ($options['after_user_id'] ?? '')) ?: null,
                $dryRun,
                $limit
            );
        }
        $promotion = $this->repository->fetchActivePromotion();

        if (!$promotion) {
            return [
                'success' => true,
                'dry_run' => $dryRun,
                'message' => 'Nenhuma campanha ativa encontrada.',
                'summary' => $this->emptySummary(),
                'rules' => [],
            ];
        }

        $campaignSlug = $this->normalizeSlug((string) ($promotion['slug'] ?? $promotion['name'] ?? 'campanha'));
        $actionUrl = $this->normalizeActionUrl(
            $promotion['notificationActionUrl'] ?? null,
            $campaignSlug !== '' ? '/promo/' . $campaignSlug : '/planos'
        );
        $rules = $this->normalizeRules($promotion['automationRules'] ?? []);
        $summary = $this->emptySummary();
        $ruleResults = [];

        foreach ($rules as $rule) {
            $users = $this->repository->findEligibleUsers($rule['condition'], $rule['delay_hours'], $limit);
            $result = [
                'rule_id' => $rule['id'],
                'condition' => $rule['condition'],
                'channel' => $rule['channel'],
                'eligible' => count($users),
                'claimed' => 0,
                'sent' => 0,
                'duplicates' => 0,
                'failed' => 0,
                'dry_run' => $dryRun,
            ];

            foreach ($users as $user) {
                $userId = trim((string) ($user['id'] ?? ''));
                if ($userId === '') {
                    continue;
                }

                $summary['eligible']++;
                $eventKey = $this->buildEventKey($campaignSlug, $rule, $userId);

                if ($dryRun) {
                    $result['claimed']++;
                    $summary['claimed']++;
                    continue;
                }

                if (!$this->repository->claimEvent($campaignSlug, $rule['id'], $rule['condition'], $userId, $eventKey, $rule['channel'])) {
                    $result['duplicates']++;
                    $summary['duplicates']++;
                    continue;
                }

                $result['claimed']++;
                $summary['claimed']++;

                try {
                    $delivery = $this->deliverRule($user, $rule, $promotion, $actionUrl);
                    if (($delivery['notification'] ?? false) || ($delivery['email'] ?? false)) {
                        $this->repository->markEventSent($campaignSlug, $rule['id'], $userId, $eventKey, $delivery);
                        $result['sent']++;
                        $summary['sent']++;
                    } else {
                        $this->repository->markEventSkipped($campaignSlug, $rule['id'], $userId, $eventKey, 'Nenhum canal habilitado para envio.');
                        $summary['skipped']++;
                    }
                } catch (Throwable $e) {
                    $this->repository->markEventFailed($campaignSlug, $rule['id'], $userId, $eventKey, $e->getMessage());
                    $result['failed']++;
                    $summary['failed']++;
                }
            }

            $ruleResults[] = $result;
        }

        return [
            'success' => true,
            'dry_run' => $dryRun,
            'campaign' => [
                'name' => (string) ($promotion['name'] ?? ''),
                'slug' => $campaignSlug,
            ],
            'summary' => $summary,
            'rules' => $ruleResults,
        ];
    }

    private function runCampaignScope(string $campaignId, ?string $afterUserId, bool $dryRun, int $limit): array
    {
        $campaignService = $this->campaignService();
        $batch = $campaignService->workerCampaignBatch($campaignId, $afterUserId, $limit);
        $campaign = $batch['campaign'];
        $summary = $this->emptySummary();
        $summary['eligible'] = count($batch['users']);
        $results = [
            'eligible' => count($batch['users']), 'claimed' => 0, 'sent' => 0,
            'duplicates' => 0, 'failed' => 0, 'skipped' => 0,
        ];

        if ($batch['suppressionReason'] !== null) {
            $summary['skipped'] = 1;
            $results['skipped'] = 1;
        }

        $content = is_array($campaign['content_json'] ?? null) ? $campaign['content_json'] : [];
        $subject = trim((string) ($content['headline'] ?? ''));
        $message = trim((string) ($content['description'] ?? ''));
        if ($batch['users'] !== [] && ($subject === '' || $message === '')) {
            throw new InvalidArgumentException('Campanha de e-mail precisa de assunto e conteudo.');
        }

        $campaignKey = $this->normalizeSlug((string) $campaign['id']);
        foreach ($batch['users'] as $user) {
            $userId = trim((string) ($user['id'] ?? ''));
            if ($userId === '') {
                continue;
            }
            $eventKey = 'campaign-email:' . substr(hash('sha256', $campaignId . '|' . $userId), 0, 64);
            if ($dryRun) {
                $results['claimed']++;
                $summary['claimed']++;
                continue;
            }
            if (!$this->repository->claimEvent($campaignKey, 'campaign-email', 'campaign_email', $userId, $eventKey, 'email')) {
                $results['duplicates']++;
                $summary['duplicates']++;
                continue;
            }
            $results['claimed']++;
            $summary['claimed']++;

            try {
                $audienceDecision = $campaignService->workerRecipientEligibility($campaignId, $userId);
                if (!$audienceDecision['eligible']) {
                    $this->repository->markEventSkipped($campaignKey, 'campaign-email', $userId, $eventKey, (string) $audienceDecision['reason']);
                    $results['skipped']++;
                    $summary['skipped']++;
                    continue;
                }
                $policy = new CommunicationPolicy($this->repository->getConnection());
                if (!$policy->allows(CommunicationPolicy::CLASS_MARKETING, CommunicationPolicy::CHANNEL_EMAIL, $userId)) {
                    $this->repository->markEventSkipped($campaignKey, 'campaign-email', $userId, $eventKey, 'MARKETING_EMAIL_PREFERENCE_DISABLED');
                    $results['skipped']++;
                    $summary['skipped']++;
                    continue;
                }

                $delivery = $this->deliverCampaignEmail($campaign, $user, $subject, $message);
                if ($delivery['email']) {
                    $this->repository->markEventSent($campaignKey, 'campaign-email', $userId, $eventKey, $delivery);
                    $results['sent']++;
                    $summary['sent']++;
                } else {
                    $this->repository->markEventSkipped($campaignKey, 'campaign-email', $userId, $eventKey, 'EMAIL_DELIVERY_NOT_QUEUED');
                    $results['skipped']++;
                    $summary['skipped']++;
                }
            } catch (Throwable $e) {
                $this->repository->markEventFailed($campaignKey, 'campaign-email', $userId, $eventKey, $e->getMessage());
                $results['failed']++;
                $summary['failed']++;
            }
        }

        return [
            'success' => $summary['failed'] === 0,
            'dry_run' => $dryRun,
            'campaign' => [
                'id' => (string) $campaign['id'],
                'name' => (string) $campaign['name'],
                'segment_id' => $campaign['segment_id'] ?? null,
                'audience_scope' => ($campaign['segment_id'] ?? null) === null ? 'ALL_ELIGIBLE' : 'SELECTED_CANONICAL_SEGMENT',
                'suppression_reason' => $batch['suppressionReason'],
            ],
            'summary' => $summary,
            'rules' => [[
                'rule_id' => 'campaign-email',
                'condition' => 'campaign_email',
                'channel' => 'email',
                ...$results,
                'dry_run' => $dryRun,
            ]],
            'next_cursor' => $batch['nextCursor'],
            'has_more' => $batch['hasMore'],
        ];
    }

    private function campaignService(): MarketingCampaignService
    {
        if ($this->campaignService === null) {
            $this->campaignService = new MarketingCampaignService(
                new MarketingCampaignRepository($this->repository->getConnection())
            );
        }
        return $this->campaignService;
    }

    private function deliverCampaignEmail(array $campaign, array $user, string $subject, string $message): array
    {
        $userId = trim((string) ($user['id'] ?? ''));
        $email = trim((string) ($user['email'] ?? ''));
        if ($userId === '' || $email === '') {
            return ['email' => false, 'action_url' => '/planos'];
        }

        $name = trim((string) ($user['name'] ?? 'Aluno'));
        $campaignName = trim((string) ($campaign['name'] ?? ''));
        $personalizedSubject = $this->personalize($subject, $user, ['name' => $campaignName]);
        $personalizedMessage = $this->personalize($message, $user, ['name' => $campaignName]);
        $landingSlug = trim((string) ($campaign['landing_slug'] ?? ''));
        $actionUrl = $landingSlug !== '' ? '/promo/' . rawurlencode($landingSlug) : '/planos';
        $template = resolveSystemEmailTemplate(
            'marketing_campaign_message',
            [
                'subject' => $personalizedSubject,
                'htmlBody' => Mailer::htmlTemplate(
                    $personalizedSubject,
                    '<p>{{message_html}}</p>',
                    '{{action_url}}',
                    'Ver campanha'
                ),
                'textBody' => "{{message}}\n\nAcesse: {{action_url}}",
            ],
            [
                'name' => $name,
                'title' => $personalizedSubject,
                'message' => $personalizedMessage,
                'message_html' => nl2br(htmlspecialchars($personalizedMessage, ENT_QUOTES, 'UTF-8')),
                'campaign' => $campaignName,
                'action_url' => $this->absoluteAppUrl($actionUrl),
            ],
            $this->repository->getConnection()
        );

        $result = CommunicationService::fromDatabase($this->repository->getConnection())->publish([
            'eventType' => 'marketing.campaign.message',
            'idempotencyKey' => 'marketing:campaign:' . $campaign['id'] . ':' . substr(hash('sha256', $userId), 0, 64),
            'deliveryClass' => CommunicationPolicy::CLASS_MARKETING,
            'recipientUserId' => $userId,
            'recipientEmail' => $email,
            'channels' => [CommunicationPolicy::CHANNEL_EMAIL],
            'title' => $personalizedSubject,
            'message' => $personalizedMessage,
            'type' => 'info',
            'category' => 'marketing',
            'link' => $actionUrl,
            'entityType' => 'marketing_campaign',
            'entityId' => (string) $campaign['id'],
            'payload' => [
                'campaignId' => (string) $campaign['id'],
                'campaign' => $campaignName,
                'recipientName' => $name,
                'emailSubject' => $template['subject'],
                'emailHtml' => $template['htmlBody'],
                'emailText' => $template['textBody'],
                'templateKey' => 'marketing_campaign_message',
                'actionUrl' => $actionUrl,
            ],
        ]);
        return [
            'email' => in_array($result['channels'][CommunicationPolicy::CHANNEL_EMAIL] ?? null, ['queued', 'processed'], true),
            'action_url' => $actionUrl,
            'intent_id' => $result['intentId'] ?? null,
        ];
    }

    private function normalizeRules($rules): array
    {
        if (!is_array($rules)) {
            return [];
        }

        $normalized = [];
        foreach ($rules as $rule) {
            if (!is_array($rule) || empty($rule['enabled'])) {
                continue;
            }

            $condition = trim((string) ($rule['condition'] ?? ''));
            $channel = trim((string) ($rule['channel'] ?? 'notification'));
            $subject = $this->normalizeText($rule['subject'] ?? '');
            $message = $this->normalizeText($rule['message'] ?? '');

            if (!in_array($condition, self::ALLOWED_CONDITIONS, true) || !in_array($channel, self::ALLOWED_CHANNELS, true)) {
                continue;
            }

            if ($subject === '' || $message === '') {
                continue;
            }

            $normalized[] = [
                'id' => $this->normalizeRuleId($rule['id'] ?? $condition),
                'condition' => $condition,
                'channel' => $channel,
                'delay_hours' => max(0, min(720, (int) ($rule['delayHours'] ?? 0))),
                'subject' => $subject,
                'message' => $message,
            ];
        }

        return $normalized;
    }

    private function deliverRule(array $user, array $rule, array $promotion, string $actionUrl): array
    {
        $delivery = [
            'notification' => false,
            'email' => false,
            'action_url' => $actionUrl,
        ];

        $userId = (string) ($user['id'] ?? '');
        $userName = trim((string) ($user['name'] ?? 'Aluno'));
        $email = trim((string) ($user['email'] ?? ''));
        $title = $this->personalize($rule['subject'], $user, $promotion);
        $message = $this->personalize($rule['message'], $user, $promotion);

        $channels = [];
        if (in_array($rule['channel'], ['notification', 'both'], true)) {
            $channels[] = CommunicationPolicy::CHANNEL_IN_APP;
        }

        $emailPayload = [];
        if (in_array($rule['channel'], ['email', 'both'], true) && $email !== '') {
            $absoluteActionUrl = $this->absoluteAppUrl($actionUrl);
            $messageHtml = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
            $template = resolveSystemEmailTemplate(
                'marketing_campaign_message',
                [
                    'subject' => $title,
                    'htmlBody' => Mailer::htmlTemplate(
                        $title,
                        '<p>{{message_html}}</p>',
                        '{{action_url}}',
                        'Ver campanha'
                    ),
                    'textBody' => "{{message}}\n\nAcesse: {{action_url}}",
                ],
                [
                    'name' => $userName,
                    'title' => $title,
                    'message' => $message,
                    'message_html' => $messageHtml,
                    'campaign' => trim((string) ($promotion['name'] ?? '')),
                    'action_url' => $absoluteActionUrl,
                ],
                $this->repository->getConnection()
            );

            $channels[] = CommunicationPolicy::CHANNEL_EMAIL;
            $emailPayload = [
                'recipientName' => $userName,
                'emailSubject' => $template['subject'],
                'emailHtml' => $template['htmlBody'],
                'emailText' => $template['textBody'],
            ];
        }

        if ($channels !== []) {
            $result = CommunicationService::fromDatabase($this->repository->getConnection())->publish([
                'eventType' => 'marketing.campaign.message',
                'idempotencyKey' => 'marketing:' . $userId . ':' . $this->buildEventKey(
                    $this->normalizeSlug((string) ($promotion['slug'] ?? $promotion['name'] ?? 'campanha')),
                    $rule,
                    $userId
                ),
                'deliveryClass' => CommunicationPolicy::CLASS_MARKETING,
                'recipientUserId' => $userId,
                'recipientEmail' => $email,
                'channels' => $channels,
                'title' => $title,
                'message' => $message,
                'type' => 'info',
                'category' => 'system',
                'link' => $actionUrl,
                'payload' => array_merge([
                    'campaign' => trim((string) ($promotion['name'] ?? '')),
                    'actionUrl' => $actionUrl,
                ], $emailPayload),
            ]);
            $delivery['notification'] = ($result['channels'][CommunicationPolicy::CHANNEL_IN_APP] ?? null) === 'processed';
            $delivery['email'] = in_array($result['channels'][CommunicationPolicy::CHANNEL_EMAIL] ?? null, ['queued', 'processed'], true);
        }

        return $delivery;
    }

    private function personalize(string $text, array $user, array $promotion): string
    {
        return strtr($text, [
            '{{nome}}' => trim((string) ($user['name'] ?? '')),
            '{{plano}}' => trim((string) ($user['plan'] ?? '')),
            '{{campanha}}' => trim((string) ($promotion['name'] ?? '')),
        ]);
    }

    private function buildEventKey(string $campaignSlug, array $rule, string $userId): string
    {
        return $campaignSlug . ':' . $rule['condition'] . ':' . $userId;
    }

    private function emptySummary(): array
    {
        return [
            'eligible' => 0,
            'claimed' => 0,
            'sent' => 0,
            'duplicates' => 0,
            'skipped' => 0,
            'failed' => 0,
        ];
    }

    private function normalizeRuleId($value): string
    {
        $id = preg_replace('/[^a-zA-Z0-9_.:-]+/', '-', trim((string) $value));
        return $id !== '' ? substr($id, 0, 120) : 'rule';
    }

    private function normalizeSlug(string $value): string
    {
        $value = strtolower(trim($value));
        $value = preg_replace('/[^a-z0-9-]+/', '-', $value);
        $value = trim((string) $value, '-');
        return $value !== '' ? substr($value, 0, 120) : 'campanha';
    }

    private function normalizeText($value): string
    {
        $text = strip_tags((string) $value);
        $text = preg_replace('/[\x00-\x1F\x7F]+/', ' ', $text);
        return trim((string) $text);
    }

    private function normalizeActionUrl($value, string $fallback): string
    {
        $candidate = $this->normalizeText($value);
        if ($candidate === '') {
            return $fallback;
        }

        if (str_starts_with($candidate, '/') && !str_starts_with($candidate, '//')) {
            $path = strtolower(strtok($candidate, '?#') ?: '/');
            if ($path === '/admin' || str_starts_with($path, '/admin/') || $path === '/api' || str_starts_with($path, '/api/')) {
                return $fallback;
            }

            return $candidate;
        }

        if (preg_match('/^https:\/\//i', $candidate)) {
            return $candidate;
        }

        return $fallback;
    }

    private function absoluteAppUrl(string $actionUrl): string
    {
        if (preg_match('/^https?:\/\//i', $actionUrl)) {
            return $actionUrl;
        }

        $appUrl = rtrim((string) ($_ENV['APP_URL'] ?? getenv('APP_URL') ?? 'http://localhost:3000'), '/');
        return $appUrl . '/' . ltrim($actionUrl, '/');
    }
}
