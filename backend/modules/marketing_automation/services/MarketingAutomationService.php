<?php

declare(strict_types=1);

require_once __DIR__ . '/../repositories/MarketingAutomationRepository.php';
require_once __DIR__ . '/../../../config/notification_helper.php';
require_once __DIR__ . '/../../../shared/utils/Mailer.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';

/**
 * Executor das regras de campanha salvas no painel de marketing.
 *
 * @since 1.0.0
 */
class MarketingAutomationService
{
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
                $eventKey = $this->buildEventKey($campaignSlug, $rule);

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

        if (in_array($rule['channel'], ['notification', 'both'], true)) {
            $delivery['notification'] = createNotification(
                $this->repository->getConnection(),
                $userId,
                $title,
                $message,
                'info',
                'system',
                $actionUrl
            );
        }

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

            $delivery['email'] = Mailer::send(
                $email,
                $userName,
                $template['subject'],
                $template['htmlBody'],
                $template['textBody']
            );
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

    private function buildEventKey(string $campaignSlug, array $rule): string
    {
        return $campaignSlug . ':' . $rule['condition'];
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
