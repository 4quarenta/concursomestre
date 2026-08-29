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

require_once __DIR__ . '/../repositories/AdminSettingsRepository.php';
require_once __DIR__ . '/../validators/AdminSettingsValidator.php';
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../shared/utils/Mailer.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';
require_once __DIR__ . '/../../subscriptions/services/SubscriptionsService.php';
require_once __DIR__ . '/../../subscriptions/repositories/SubscriptionsRepository.php';
require_once __DIR__ . '/../../subscriptions/validators/SubscriptionsValidator.php';
require_once __DIR__ . '/../../settings/services/PublicSettingsProjection.php';

/**
 * Service das configuracoes sistemicas.
 * Centraliza leitura publica saneada, testes operacionais e escrita administrativa.
 */
class AdminSettingsService
{
    private PDO $db;
    private AdminSettingsRepository $repository;
    private AdminSettingsValidator $validator;
    private string $envPath;
    private string $logFilePath;

    /**
     * Inicializa o service com dependencias de configuracao.
     *
     * @since 1.0.0
     */
    public function __construct(
        PDO $db,
        AdminSettingsRepository $repository,
        AdminSettingsValidator $validator,
        ?string $envPath = null,
        ?string $logFilePath = null
    ) {
        $this->db = $db;
        $this->repository = $repository;
        $this->validator = $validator;
        $this->envPath = $envPath ?: dirname(__DIR__, 3) . '/.env';
        $this->logFilePath = $logFilePath ?: dirname(__DIR__, 3) . '/storage/logs/settings.log';
    }

    /**
     * Retorna as configuracoes do sistema com saneamento publico quando necessario.
     *
     * @since 1.0.0
     */
    public function getSettings(?array $authPayload): array
    {
        $settings = $this->repository->fetchAllSystemSettings();

        $envStripePublishableKey = $_ENV['STRIPE_PUBLISHABLE_KEY'] ?? getenv('STRIPE_PUBLISHABLE_KEY') ?? null;
        $envStripeSecretKey = $_ENV['STRIPE_SECRET_KEY'] ?? getenv('STRIPE_SECRET_KEY') ?? null;
        $envStripeWebhookSecret = $_ENV['STRIPE_WEBHOOK_SECRET'] ?? getenv('STRIPE_WEBHOOK_SECRET') ?? null;
        $envGeminiApiKey = $_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?? null;
        $envGeminiModel = $_ENV['GEMINI_MODEL'] ?? getenv('GEMINI_MODEL') ?? null;
        $envOpenAiApiKey = $_ENV['OPENAI_API_KEY'] ?? getenv('OPENAI_API_KEY') ?? null;
        $envOpenAiModel = $_ENV['OPENAI_MODEL'] ?? getenv('OPENAI_MODEL') ?? null;
        $envAiProvider = $_ENV['AI_PROVIDER'] ?? getenv('AI_PROVIDER') ?? null;
        $envSmtpPass = $_ENV['SMTP_PASS'] ?? getenv('SMTP_PASS') ?? null;
        $envGoogleClientId = $_ENV['GOOGLE_CLIENT_ID'] ?? getenv('GOOGLE_CLIENT_ID') ?? getenv('GOOGLE_OAUTH_CLIENT_ID') ?? null;
        $envFacebookAppId = $_ENV['FACEBOOK_APP_ID'] ?? getenv('FACEBOOK_APP_ID') ?? getenv('META_APP_ID') ?? null;
        $envFacebookAppSecret = $_ENV['FACEBOOK_APP_SECRET'] ?? getenv('FACEBOOK_APP_SECRET') ?? getenv('META_APP_SECRET') ?? null;
        $envAppleClientId = $_ENV['APPLE_CLIENT_ID'] ?? getenv('APPLE_CLIENT_ID') ?? getenv('APPLE_SERVICE_ID') ?? null;
        $envRecaptchaSecretKey = $_ENV['RECAPTCHA_SECRET_KEY'] ?? getenv('RECAPTCHA_SECRET_KEY') ?? null;

        if (!empty($envStripePublishableKey)) {
            $settings['stripePublishableKey'] = $envStripePublishableKey;
        } elseif (!empty($settings['stripeKey'])) {
            $settings['stripePublishableKey'] = $settings['stripeKey'];
        }

        if (!empty($envGoogleClientId)) {
            $settings['googleAuthClientId'] = $envGoogleClientId;
        }

        if (!empty($envFacebookAppId)) {
            $settings['facebookAuthAppId'] = $envFacebookAppId;
        }

        if (!empty($envAppleClientId)) {
            $settings['appleAuthClientId'] = $envAppleClientId;
        }

        $settings['paymentProvider'] = 'stripe';
        $settings['paymentCheckoutMode'] = !empty($settings['paymentCheckoutMode']) ? $settings['paymentCheckoutMode'] : 'internal';
        $settings['cardVaultProvider'] = 'stripe';
        $settings['stripePaymentMethods'] = normalizeStripePaymentMethodsConfig($settings['stripePaymentMethods'] ?? null);
        $recaptchaFlagEnabled = array_key_exists('recaptchaEnabled', $settings) ? (bool) $settings['recaptchaEnabled'] : false;
        $resolvedAiProvider = strtolower(trim((string) ($settings['aiProvider'] ?? $envAiProvider ?? 'gemini')));
        $settings['aiProvider'] = in_array($resolvedAiProvider, ['gemini', 'openai', 'auto'], true)
            ? $resolvedAiProvider
            : 'gemini';
        $settings['geminiModel'] = !empty($settings['geminiModel'] ?? null)
            ? (string) $settings['geminiModel']
            : (!empty($envGeminiModel) ? (string) $envGeminiModel : 'gemini-3.5-flash');
        $settings['openAiModel'] = !empty($settings['openAiModel'] ?? null)
            ? (string) $settings['openAiModel']
            : (!empty($envOpenAiModel) ? (string) $envOpenAiModel : 'gpt-4o-mini');
        $settings['hasStripeSecretConfigured'] = !empty($envStripeSecretKey) || !empty($settings['stripeSecretKey'] ?? null);
        $settings['hasStripeWebhookConfigured'] = !empty($envStripeWebhookSecret) || !empty($settings['stripeWebhookSecret'] ?? null);
        $settings['hasGeminiApiKeyConfigured'] = !empty($settings['geminiApiKey'] ?? null) || !empty($envGeminiApiKey);
        $settings['hasOpenAiApiKeyConfigured'] = !empty($settings['openaiApiKey'] ?? null) || !empty($envOpenAiApiKey);
        $settings['hasRecaptchaSecretConfigured'] = !empty($envRecaptchaSecretKey);
        $settings['recaptchaEnabled'] = $recaptchaFlagEnabled
            && !empty($settings['recaptchaSiteKey'] ?? null)
            && $settings['hasRecaptchaSecretConfigured'];
        $settings['hasGoogleAuthClientConfigured'] = !empty($envGoogleClientId) || !empty($settings['googleAuthClientId'] ?? null);
        $settings['hasFacebookAuthConfigured'] = (!empty($envFacebookAppId) || !empty($settings['facebookAuthAppId'] ?? null))
            && (!empty($envFacebookAppSecret) || !empty($settings['facebookAuthAppSecret'] ?? null));
        $settings['hasAppleAuthConfigured'] = !empty($envAppleClientId) || !empty($settings['appleAuthClientId'] ?? null);
        $settings['hasSmtpPasswordConfigured'] = !empty($settings['smtpPass'] ?? null) || !empty($envSmtpPass);
        $settings['appMode'] = !empty($settings['appMode'])
            ? $settings['appMode']
            : (($_ENV['APP_ENV'] ?? getenv('APP_ENV') ?? 'development') === 'production' ? 'production' : 'development');
        $settings['seo'] = $this->mergeSeoDefaults($settings['seo'] ?? []);
        $settings['limitedOfferCountdown'] = $this->mergeLimitedOfferCountdownDefaults(is_array($settings['limitedOfferCountdown'] ?? null) ? $settings['limitedOfferCountdown'] : []);
        $settings['landingPageContent'] = $this->mergeLandingPageContentDefaults(is_array($settings['landingPageContent'] ?? null) ? $settings['landingPageContent'] : []);
        $settings['landingPages'] = is_array($settings['landingPages'] ?? null) ? array_values($settings['landingPages']) : null;
        $settings['planEntitlements'] = normalizePlanEntitlementsConfig(is_array($settings['planEntitlements'] ?? null) ? $settings['planEntitlements'] : null);
        $settings['planUsageLimits'] = normalizePlanUsageLimitsConfig(is_array($settings['planUsageLimits'] ?? null) ? $settings['planUsageLimits'] : null);
        $settings['legalCommentaryFeatureConfig'] = $this->mergeLegalCommentaryFeatureConfigDefaults(is_array($settings['legalCommentaryFeatureConfig'] ?? null) ? $settings['legalCommentaryFeatureConfig'] : []);
        $settings['emailTemplates'] = normalizeSystemEmailTemplates($settings['emailTemplates'] ?? null);
        $settings = $this->syncFeatureAliases($settings);

        $settings = $this->maskSecretValues($settings);

        if (($authPayload['role'] ?? '') !== 'admin') {
            $settings = $this->sanitizeSettingsForPublic($settings);
        }

        return $settings;
    }

    /**
     * Persiste configuracoes administrativas e atualiza env quando necessario.
     *
     * @since 1.0.0
     */
    public function updateSettings(array $payload): array
    {
        $data = $this->validator->validateUpdatePayload($payload);
        $data = $this->normalizeFeatureSettingsPayload($data);
        $this->log('POST Request Start. Payload keys: ' . implode(', ', array_keys($data)));

        $shouldSyncStripeRenewalProjection = isset($data['pricing'], $data['planDetails'])
            && is_array($data['pricing'])
            && is_array($data['planDetails']);
        $stripeRenewalSync = null;
        $this->db->beginTransaction();

        try {
            if ($shouldSyncStripeRenewalProjection) {
                $this->persistPlanConfiguration($data['pricing'], $data['planDetails']);
            }

            $envUpdates = [];
            $this->persistSpecialSettings($data, $envUpdates);
            $this->persistGenericSettings($data);

            if (array_key_exists('appMode', $data)) {
                $this->updateAppEnv((string) $data['appMode']);
            }

            if ($envUpdates !== []) {
                updateEnvFileValues($envUpdates, $this->envPath);
                $this->log('Updated payment environment keys: ' . implode(', ', array_keys($envUpdates)));
            }

            $this->commitSettingsTransaction();
            resetSystemEmailTemplateCache();

            if ($shouldSyncStripeRenewalProjection) {
                $stripeRenewalSync = $this->syncStripeRenewalProjectionAfterPlanPricingUpdate();
            }

            return [
                'message' => 'Configuracoes salvas com sucesso.',
                'data' => $this->getSettings(['role' => 'admin']),
                'audit_action' => 'settings.update',
                'audit_entity_type' => 'system_settings',
                'audit_entity_id' => null,
                'audit_metadata' => [
                    'updated_keys' => array_keys($data),
                    'updated_env_keys' => array_keys($envUpdates),
                    'stripe_renewal_sync' => $stripeRenewalSync,
                ],
            ];
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            $this->log('CRITICAL ERROR: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Finaliza a transacao de settings sem quebrar o salvamento quando um driver
     * ja encerrou a transacao apos escritas bem-sucedidas.
     */
    private function commitSettingsTransaction(): void
    {
        if ($this->db->inTransaction()) {
            $this->db->commit();
            $this->log('Transaction committed successfully.');
            return;
        }

        $this->log('Transaction already closed before commit; continuing after successful writes.');
    }

    /**
     * Executa um envio de teste com os dados atuais do SMTP.
     *
     * @since 1.0.0
     */
    public function testSmtp(array $payload): array
    {
        $smtpData = $this->validator->validateSmtpTestPayload($payload);
        $smtpData['smtpPass'] = $this->resolveSmtpPassword((string) $smtpData['smtpPass']);

        $message = 'SMTP validado com sucesso.';
        $this->withTemporaryMailEnvironment([
            'SMTP_HOST' => $smtpData['smtpHost'],
            'SMTP_PORT' => (string) $smtpData['smtpPort'],
            'SMTP_SECURE' => $smtpData['smtpSecure'],
            'SMTP_USER' => $smtpData['smtpUser'],
            'SMTP_PASS' => $smtpData['smtpPass'],
            'MAIL_FROM_ADDRESS' => $smtpData['mailFromAddress'],
            'MAIL_FROM_NAME' => $smtpData['mailFromName'],
            'APP_ENV' => (string) ($payload['appMode'] ?? 'production'),
            'MAIL_CONFIG_DISABLE_DATABASE' => '1',
        ], function () use ($smtpData, &$message): void {
            Mailer::send(
                $smtpData['targetEmail'],
                'Administrador',
                'Teste SMTP - ConcursoMestre',
                '<p>Teste de SMTP executado pelo painel administrativo.</p>',
                'Teste de SMTP executado pelo painel administrativo.'
            );

            $message = 'SMTP testado com sucesso.';
        });

        $this->log('SMTP test executed for ' . $smtpData['targetEmail']);

        return [
            'message' => $message,
            'data' => [
                'target_email' => $smtpData['targetEmail'],
                'host' => $smtpData['smtpHost'],
                'port' => $smtpData['smtpPort'],
                'secure' => $smtpData['smtpSecure'],
            ],
            'audit_action' => 'settings.test_smtp',
            'audit_entity_type' => 'system_settings',
            'audit_entity_id' => null,
            'audit_metadata' => [
                'host' => $smtpData['smtpHost'],
                'port' => $smtpData['smtpPort'],
                'target_email' => $smtpData['targetEmail'],
            ],
        ];
    }

    /**
     * Envia um teste real usando o modelo de e-mail escolhido no painel.
     *
     * @since 1.0.0
     */
    public function testEmailTemplate(array $payload): array
    {
        $smtpData = $this->validator->validateSmtpTestPayload($payload);
        $smtpData['smtpPass'] = $this->resolveSmtpPassword((string) $smtpData['smtpPass']);
        $templateData = $this->validator->validateEmailTemplateTestPayload($payload);
        $variables = $this->buildEmailTemplateTestVariables($smtpData['targetEmail'], (string) ($smtpData['emailLogoUrl'] ?? ''));
        $template = $this->resolveEmailTemplateForTest($templateData, $variables);
        $templateName = (string) ($template['name'] ?? $templateData['templateKey']);

        $message = 'Modelo de e-mail testado com sucesso.';
        $this->withTemporaryMailEnvironment([
            'SMTP_HOST' => $smtpData['smtpHost'],
            'SMTP_PORT' => (string) $smtpData['smtpPort'],
            'SMTP_SECURE' => $smtpData['smtpSecure'],
            'SMTP_USER' => $smtpData['smtpUser'],
            'SMTP_PASS' => $smtpData['smtpPass'],
            'MAIL_FROM_ADDRESS' => $smtpData['mailFromAddress'],
            'MAIL_FROM_NAME' => $smtpData['mailFromName'],
            'EMAIL_LOGO_URL' => (string) ($smtpData['emailLogoUrl'] ?? ''),
            'APP_ENV' => (string) ($payload['appMode'] ?? 'production'),
            'MAIL_CONFIG_DISABLE_DATABASE' => '1',
        ], function () use ($smtpData, $template, $templateName, &$message): void {
            Mailer::send(
                $smtpData['targetEmail'],
                'Administrador',
                '[TESTE] ' . (string) $template['subject'],
                (string) $template['htmlBody'],
                (string) $template['textBody']
            );

            $message = "Modelo '{$templateName}' enviado com sucesso.";
        });

        $this->log('Email template test executed for ' . $smtpData['targetEmail'] . ' using ' . $templateData['templateKey']);

        return [
            'message' => $message,
            'data' => [
                'target_email' => $smtpData['targetEmail'],
                'template_key' => $templateData['templateKey'],
                'template_name' => $templateName,
                'host' => $smtpData['smtpHost'],
                'port' => $smtpData['smtpPort'],
                'secure' => $smtpData['smtpSecure'],
            ],
            'audit_action' => 'settings.test_email_template',
            'audit_entity_type' => 'system_settings',
            'audit_entity_id' => null,
            'audit_metadata' => [
                'template_key' => $templateData['templateKey'],
                'target_email' => $smtpData['targetEmail'],
                'host' => $smtpData['smtpHost'],
                'port' => $smtpData['smtpPort'],
            ],
        ];
    }

    /**
     * Executa uma leitura operacional das integracoes configuradas.
     *
     * @since 1.0.0
     */
    public function testIntegrations(array $payload): array
    {
        $integrationData = $this->validator->validateIntegrationTestPayload($payload);
        $persisted = $this->getSettings(['role' => 'admin']);
        $stripePaymentMethods = normalizeStripePaymentMethodsConfig($payload['stripePaymentMethods'] ?? ($persisted['stripePaymentMethods'] ?? null));
        $enabledStripePaymentMethods = array_values(array_filter(
            $stripePaymentMethods['methods'],
            static fn(array $method): bool => !empty($method['enabled'])
        ));
        $enabledStripePaymentMethodLabels = array_map(
            static fn(array $method): string => (string) ($method['label'] ?? $method['id'] ?? ''),
            $enabledStripePaymentMethods
        );

        $checks = [
            'stripe_publishable_key' => [
                'label' => 'Stripe publishable key',
                'status' => $integrationData['stripePublishableKey'] !== '' || !empty($persisted['stripePublishableKey']) ? 'ok' : 'warning',
                'detail' => $integrationData['stripePublishableKey'] !== '' || !empty($persisted['stripePublishableKey'])
                    ? 'Chave publica presente.'
                    : 'Chave publica nao configurada.',
            ],
            'stripe_secret_key' => [
                'label' => 'Stripe secret key',
                'status' => $integrationData['stripeSecretKey'] !== '' || !empty($persisted['hasStripeSecretConfigured']) ? 'ok' : 'critical',
                'detail' => $integrationData['stripeSecretKey'] !== '' || !empty($persisted['hasStripeSecretConfigured'])
                    ? 'Segredo Stripe configurado.'
                    : 'Segredo Stripe ausente.',
            ],
            'stripe_webhook' => [
                'label' => 'Stripe webhook secret',
                'status' => $integrationData['stripeWebhookSecret'] !== '' || !empty($persisted['hasStripeWebhookConfigured']) ? 'ok' : 'critical',
                'detail' => $integrationData['stripeWebhookSecret'] !== '' || !empty($persisted['hasStripeWebhookConfigured'])
                    ? 'Webhook Stripe configurado.'
                    : 'Webhook Stripe ausente.',
            ],
            'stripe_payment_methods' => [
                'label' => 'Formas de pagamento Stripe',
                'status' => count($enabledStripePaymentMethods) > 0 ? 'ok' : 'critical',
                'detail' => count($enabledStripePaymentMethods) > 0
                    ? 'Metodos ativos: ' . implode(', ', $enabledStripePaymentMethodLabels) . '.'
                    : 'Nenhum metodo de pagamento Stripe ativo.',
            ],
            'recaptcha' => [
                'label' => 'reCAPTCHA',
                'status' => !$integrationData['recaptchaEnabled'] || ($integrationData['recaptchaSiteKey'] !== '' && ($integrationData['recaptchaSecretKey'] !== '' || !empty($persisted['hasRecaptchaSecretConfigured'])))
                    ? 'ok'
                    : 'warning',
                'detail' => !$integrationData['recaptchaEnabled']
                    ? 'Integracao opcional desativada.'
                    : (($integrationData['recaptchaSiteKey'] !== '' && ($integrationData['recaptchaSecretKey'] !== '' || !empty($persisted['hasRecaptchaSecretConfigured'])))
                        ? 'Chaves reCAPTCHA presentes.'
                        : 'Chaves reCAPTCHA incompletas.'),
            ],
            'google_oauth' => [
                'label' => 'Google OAuth',
                'status' => $integrationData['googleAuthClientId'] !== '' || !empty($persisted['hasGoogleAuthClientConfigured'])
                    ? 'ok'
                    : 'warning',
                'detail' => $integrationData['googleAuthClientId'] !== '' || !empty($persisted['hasGoogleAuthClientConfigured'])
                    ? 'Google OAuth configurado.'
                    : 'Google OAuth ausente.',
            ],
            'facebook_oauth' => [
                'label' => 'Facebook OAuth',
                'status' => (($integrationData['facebookAuthAppId'] !== '' || !empty($persisted['facebookAuthAppId']))
                    && ($integrationData['facebookAuthAppSecret'] !== '' || !empty($persisted['hasFacebookAuthConfigured'])))
                    ? 'ok'
                    : 'warning',
                'detail' => (($integrationData['facebookAuthAppId'] !== '' || !empty($persisted['facebookAuthAppId']))
                    && ($integrationData['facebookAuthAppSecret'] !== '' || !empty($persisted['hasFacebookAuthConfigured'])))
                    ? 'Facebook OAuth configurado.'
                    : 'Facebook OAuth incompleto.',
            ],
            'apple_oauth' => [
                'label' => 'Apple OAuth',
                'status' => $integrationData['appleAuthClientId'] !== '' || !empty($persisted['hasAppleAuthConfigured'])
                    ? 'ok'
                    : 'warning',
                'detail' => $integrationData['appleAuthClientId'] !== '' || !empty($persisted['hasAppleAuthConfigured'])
                    ? 'Apple OAuth configurado.'
                    : 'Apple OAuth ausente.',
            ],
            'gemini' => [
                'label' => 'Gemini',
                'status' => $integrationData['geminiApiKey'] !== '' || !empty($persisted['hasGeminiApiKeyConfigured']) ? 'ok' : 'warning',
                'detail' => $integrationData['geminiApiKey'] !== '' || !empty($persisted['hasGeminiApiKeyConfigured']) ? 'Chave Gemini presente.' : 'Chave Gemini ausente.',
            ],
            'openai' => [
                'label' => 'OpenAI / ChatGPT',
                'status' => $integrationData['openaiApiKey'] !== '' || !empty($persisted['hasOpenAiApiKeyConfigured']) ? 'ok' : 'warning',
                'detail' => $integrationData['openaiApiKey'] !== '' || !empty($persisted['hasOpenAiApiKeyConfigured']) ? 'Chave OpenAI presente.' : 'Chave OpenAI ausente.',
            ],
            'firebase' => [
                'label' => 'Firebase',
                'status' => $integrationData['firebaseKey'] !== '' ? 'ok' : 'warning',
                'detail' => $integrationData['firebaseKey'] !== '' ? 'Chave Firebase presente.' : 'Chave Firebase ausente.',
            ],
            'analytics' => [
                'label' => 'Analytics',
                'status' => $integrationData['googleAnalyticsId'] !== '' ? 'ok' : 'warning',
                'detail' => $integrationData['googleAnalyticsId'] !== '' ? 'Google Analytics configurado.' : 'Google Analytics ausente.',
            ],
            'pixel' => [
                'label' => 'Meta Pixel',
                'status' => $integrationData['metaPixelId'] !== '' ? 'ok' : 'warning',
                'detail' => $integrationData['metaPixelId'] !== '' ? 'Meta Pixel configurado.' : 'Meta Pixel ausente.',
            ],
        ];

        $criticalCount = 0;
        $warningCount = 0;
        foreach ($checks as $check) {
            if ($check['status'] === 'critical') {
                $criticalCount++;
            } elseif ($check['status'] === 'warning') {
                $warningCount++;
            }
        }

        $message = $criticalCount > 0
            ? 'Integracoes com falhas criticas.'
            : ($warningCount > 0 ? 'Integracoes verificadas com pendencias.' : 'Integracoes verificadas com sucesso.');

        $this->log('Integration diagnostics executed. critical=' . $criticalCount . ' warning=' . $warningCount);

        return [
            'message' => $message,
            'data' => [
                'checks' => $checks,
                'critical_count' => $criticalCount,
                'warning_count' => $warningCount,
            ],
            'audit_action' => 'settings.test_integrations',
            'audit_entity_type' => 'system_settings',
            'audit_entity_id' => null,
            'audit_metadata' => [
                'critical_count' => $criticalCount,
                'warning_count' => $warningCount,
            ],
        ];
    }

    /**
     * Salva configuracoes de planos e precos no banco.
     *
     * @since 1.0.0
     */
    private function persistPlanConfiguration(array $pricing, array $planDetails): void
    {
        $basePlans = ['Gratuito', 'Essencial', 'Pro', 'Elite'];
        $tiers = ['Gratuito' => 1, 'Essencial' => 2, 'Pro' => 3, 'Elite' => 4];
        $normalizedPricing = $this->normalizePlanPricingSettings($pricing);
        $normalizedPlanDetails = $this->normalizePlanDetailsSettings($planDetails);

        $this->repository->upsertSystemSetting('pricing', $normalizedPricing);
        $this->repository->upsertSystemSetting('planDetails', $normalizedPlanDetails);

        foreach ($basePlans as $baseName) {
            if (!isset($normalizedPricing[$baseName], $normalizedPlanDetails[$baseName])) {
                continue;
            }

            $priceConfig = (array) $normalizedPricing[$baseName];
            $featureConfig = (array) $normalizedPlanDetails[$baseName];
            $featuresJson = json_encode($featureConfig['features'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $planTier = $tiers[$baseName] ?? 1;
            $description = isset($priceConfig['description']) ? (string) $priceConfig['description'] : null;

            $monthlyName = $baseName === 'Gratuito' ? 'Gratuito' : "{$baseName} - Mensal";
            $monthlyPrice = $baseName === 'Gratuito' ? 0 : ($priceConfig['monthly'] ?? 0);
            $this->upsertChargeablePlanSafely($monthlyName, $description, $monthlyPrice, 'month', 1, $planTier, $featuresJson, $baseName);

            if ($baseName === 'Gratuito') {
                continue;
            }

            $this->upsertChargeablePlanSafely("{$baseName} - Trimestral", $description, $priceConfig['quarterly'] ?? 0, 'month', 3, $planTier, $featuresJson, $baseName);
            $this->upsertChargeablePlanSafely("{$baseName} - Anual", $description, $priceConfig['annual'] ?? 0, 'year', 1, $planTier, $featuresJson, $baseName);
        }

        $this->log('Plans (pricing/details) upserted successfully.');
    }

    /**
     * Impede que planos pagos sejam publicados como gratuitos por campos vazios no painel.
     *
     * @since 1.0.0
     */
    private function upsertChargeablePlanSafely(
        string $name,
        ?string $description,
        $price,
        string $intervalUnit,
        int $intervalCount,
        int $tier,
        string $featuresJson,
        string $baseName
    ): void {
        $normalizedPrice = round((float) $price, 2);

        if ($baseName !== 'Gratuito' && $normalizedPrice <= 0) {
            $this->repository->deactivatePlanByName($name);
            $this->log("Plan '{$name}' was not activated because its chargeable price is zero.");
            return;
        }

        $this->repository->upsertPlan($name, $description, $normalizedPrice, $intervalUnit, $intervalCount, $tier, $featuresJson);
    }

    /**
     * Recalcula as renovacoes Stripe usando o preco vigente dos planos.
     * Evita que assinaturas antigas continuem cobrando valores defasados.
     *
     * @since 1.0.0
     */
    private function syncStripeRenewalProjectionAfterPlanPricingUpdate(): array
    {
        try {
            $subscriptionsService = new SubscriptionsService(
                $this->db,
                new SubscriptionsRepository($this->db),
                new SubscriptionsValidator()
            );
            $summary = $subscriptionsService->syncStripeRenewalProjectionsAfterPricingChange();
            $this->log(sprintf(
                'Stripe renewal price sync after plan update: configured=%s checked=%d synced=%d errors=%d',
                !empty($summary['configured']) ? 'yes' : 'no',
                (int) ($summary['checked'] ?? 0),
                (int) ($summary['synced'] ?? 0),
                (int) ($summary['errors'] ?? 0)
            ));

            return $summary;
        } catch (Throwable $e) {
            $this->log('Stripe renewal price sync warning: ' . $e->getMessage());

            return [
                'configured' => false,
                'checked' => 0,
                'synced' => 0,
                'errors' => 1,
                'warning' => $e->getMessage(),
            ];
        }
    }

    /**
     * Normaliza o bloco de precificacao administrativa antes de persistir.
     *
     * @since 1.0.0
     */
    private function normalizePlanPricingSettings(array $pricing): array
    {
        $normalized = [];
        $persistedPricing = getSystemSettingValue($this->db, 'pricing', []);
        $catalogFallbacks = $this->fetchPlanPriceFallbacksFromCatalog();

        foreach (['Gratuito', 'Essencial', 'Pro', 'Elite'] as $planName) {
            $current = is_array($pricing[$planName] ?? null) ? $pricing[$planName] : [];
            $persisted = is_array($persistedPricing[$planName] ?? null) ? $persistedPricing[$planName] : [];
            $monthly = $this->resolvePlanPriceSetting($current, $persisted, $catalogFallbacks, $planName, 'monthly');
            $quarterlyDiscountPercent = max(0, round((float) ($current['quarterlyDiscountPercent'] ?? 0), 2));
            $annualDiscountPercent = max(0, round((float) ($current['annualDiscountPercent'] ?? 0), 2));
            $quarterly = $this->resolvePlanPriceSetting($current, $persisted, $catalogFallbacks, $planName, 'quarterly');
            $annual = $this->resolvePlanPriceSetting($current, $persisted, $catalogFallbacks, $planName, 'annual');

            if ($planName !== 'Gratuito') {
                if ($monthly <= 0) {
                    $monthly = $this->defaultMonthlyPriceForPlan($planName);
                }

                if ($monthly > 0) {
                    $quarterly = round($monthly * 3 * (1 - min(100, $quarterlyDiscountPercent) / 100), 2);
                    $annual = round($monthly * 12 * (1 - min(100, $annualDiscountPercent) / 100), 2);
                }

                if ($quarterly <= 0 && $monthly > 0) {
                    $quarterly = round($monthly * 3, 2);
                }

                if ($annual <= 0 && $monthly > 0) {
                    $annual = round($monthly * 12, 2);
                }
            }

            $normalized[$planName] = [
                'monthly' => $planName === 'Gratuito' ? 0 : max(0, round($monthly, 2)),
                'quarterly' => $planName === 'Gratuito' ? 0 : max(0, round($quarterly, 2)),
                'annual' => $planName === 'Gratuito' ? 0 : max(0, round($annual, 2)),
                'quarterlyDiscountPercent' => $quarterlyDiscountPercent,
                'annualDiscountPercent' => $annualDiscountPercent,
                'description' => trim((string) ($current['description'] ?? '')),
            ];
        }

        return $normalized;
    }

    /**
     * Resolve um preco usando payload, settings salvas, catalogo atual e defaults nessa ordem.
     *
     * @since 1.0.0
     */
    private function resolvePlanPriceSetting(
        array $current,
        array $persisted,
        array $catalogFallbacks,
        string $planName,
        string $cycle
    ): float {
        $incomingValue = $this->normalizePositivePrice($current[$cycle] ?? null);
        if ($incomingValue > 0) {
            return $incomingValue;
        }

        $persistedValue = $this->normalizePositivePrice($persisted[$cycle] ?? null);
        if ($persistedValue > 0) {
            return $persistedValue;
        }

        return $this->normalizePositivePrice($catalogFallbacks[$planName][$cycle] ?? null);
    }

    private function normalizePositivePrice($value): float
    {
        if (!is_numeric($value)) {
            return 0.0;
        }

        return max(0.0, round((float) $value, 2));
    }

    /**
     * Le precos positivos ja existentes para evitar zerar catalogos em producao.
     *
     * @since 1.0.0
     */
    private function fetchPlanPriceFallbacksFromCatalog(): array
    {
        $fallbacks = [
            'Gratuito' => ['monthly' => 0.0, 'quarterly' => 0.0, 'annual' => 0.0],
            'Essencial' => ['monthly' => 0.0, 'quarterly' => 0.0, 'annual' => 0.0],
            'Pro' => ['monthly' => 0.0, 'quarterly' => 0.0, 'annual' => 0.0],
            'Elite' => ['monthly' => 0.0, 'quarterly' => 0.0, 'annual' => 0.0],
        ];

        try {
            $stmt = $this->db->query('SELECT name, price, interval_unit, interval_count FROM plans WHERE price > 0');
            $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
        } catch (Throwable $e) {
            $this->log('Plan price fallback read failed: ' . $e->getMessage());
            return $fallbacks;
        }

        foreach ($rows as $row) {
            $planName = canonicalUserPlanValue((string) ($row['name'] ?? ''));
            if (!isset($fallbacks[$planName]) || $planName === 'Gratuito') {
                continue;
            }

            $cycle = $this->billingCycleFromCatalogRow((string) ($row['interval_unit'] ?? ''), (int) ($row['interval_count'] ?? 1));
            if ($cycle === null || $fallbacks[$planName][$cycle] > 0) {
                continue;
            }

            $fallbacks[$planName][$cycle] = $this->normalizePositivePrice($row['price'] ?? 0);
        }

        foreach (['Essencial', 'Pro', 'Elite'] as $planName) {
            $monthly = $fallbacks[$planName]['monthly'] > 0
                ? $fallbacks[$planName]['monthly']
                : $this->defaultMonthlyPriceForPlan($planName);

            if ($fallbacks[$planName]['monthly'] <= 0) {
                $fallbacks[$planName]['monthly'] = $monthly;
            }

            if ($fallbacks[$planName]['quarterly'] <= 0 && $monthly > 0) {
                $fallbacks[$planName]['quarterly'] = round($monthly * 3, 2);
            }

            if ($fallbacks[$planName]['annual'] <= 0 && $monthly > 0) {
                $fallbacks[$planName]['annual'] = round($monthly * 12, 2);
            }
        }

        return $fallbacks;
    }

    private function billingCycleFromCatalogRow(string $intervalUnit, int $intervalCount): ?string
    {
        $unit = strtolower(trim($intervalUnit));
        $count = max(1, $intervalCount);

        if ($unit === 'year' || ($unit === 'month' && $count >= 12)) {
            return 'annual';
        }

        if ($unit === 'month' && $count === 3) {
            return 'quarterly';
        }

        if ($unit === 'month' && $count === 1) {
            return 'monthly';
        }

        return null;
    }

    private function defaultMonthlyPriceForPlan(string $planName): float
    {
        return match ($planName) {
            'Essencial' => 19.90,
            'Pro' => 29.90,
            'Elite' => 33.27,
            default => 0.0,
        };
    }

    /**
     * Normaliza nomes exibidos, ativacao comercial e features dos planos.
     *
     * @since 1.0.0
     */
    private function normalizePlanDetailsSettings(array $planDetails): array
    {
        $normalized = [];

        foreach (['Gratuito', 'Essencial', 'Pro', 'Elite'] as $planName) {
            $current = is_array($planDetails[$planName] ?? null) ? $planDetails[$planName] : [];
            $displayName = trim((string) ($current['displayName'] ?? ''));
            $color = trim((string) ($current['color'] ?? ''));

            $normalizedPlan = [
                'displayName' => $displayName !== '' ? $displayName : $planName,
                'enabled' => array_key_exists('enabled', $current) ? (bool) $current['enabled'] : true,
                'features' => $this->normalizePlanFeatureList($current['features'] ?? []),
            ];

            if ($color !== '') {
                $normalizedPlan['color'] = $color;
            }

            if (array_key_exists('popular', $current)) {
                $normalizedPlan['popular'] = (bool) $current['popular'];
            }

            $normalized[$planName] = $normalizedPlan;
        }

        return $normalized;
    }

    /**
     * Padroniza a lista de beneficios para manter o JSON auditavel.
     *
     * @since 1.0.0
     *
     * @param mixed $features
     */
    private function normalizePlanFeatureList($features): array
    {
        if (!is_array($features)) {
            return [];
        }

        $normalized = [];
        foreach ($features as $feature) {
            if (!is_array($feature)) {
                continue;
            }

            $text = trim((string) ($feature['text'] ?? ''));
            if ($text === '') {
                continue;
            }

            $normalized[] = [
                'text' => $text,
                'included' => array_key_exists('included', $feature) ? (bool) $feature['included'] : false,
            ];
        }

        return $normalized;
    }

    /**
     * Resolve a senha SMTP sem expor o valor salvo no payload de leitura.
     *
     * @since 1.0.0
     */
    private function resolveSmtpPassword(string $incomingPassword): string
    {
        if ($incomingPassword !== '') {
            return $incomingPassword;
        }

        $environmentPassword = trim((string) ($_ENV['SMTP_PASS'] ?? getenv('SMTP_PASS') ?? ''));
        if ($environmentPassword !== '') {
            return $environmentPassword;
        }

        $settings = $this->repository->fetchAllSystemSettings();
        $storedPassword = trim((string) ($settings['smtpPass'] ?? ''));

        if ($storedPassword !== '') {
            return $storedPassword;
        }

        return '';
    }

    /**
     * Salva configuracoes especiais e coleta atualizacoes de env.
     *
     * @since 1.0.0
     */
    private function persistSpecialSettings(array $data, array &$envUpdates): void
    {
        if (array_key_exists('paymentProvider', $data)) {
            $this->repository->upsertSystemSetting('paymentProvider', 'stripe');
        }

        if (array_key_exists('paymentCheckoutMode', $data)) {
            $this->repository->upsertSystemSetting('paymentCheckoutMode', normalizePaymentCheckoutMode((string) $data['paymentCheckoutMode']));
        }

        if (array_key_exists('cardVaultProvider', $data)) {
            $this->repository->upsertSystemSetting('cardVaultProvider', 'stripe');
        }

        if (array_key_exists('stripePaymentMethods', $data)) {
            $this->repository->upsertSystemSetting('stripePaymentMethods', normalizeStripePaymentMethodsConfig($data['stripePaymentMethods']));
        }

        $publicStripeKey = $data['stripePublishableKey'] ?? $data['stripeKey'] ?? null;
        if (!empty($publicStripeKey)) {
            $this->repository->upsertSystemSetting('stripePublishableKey', $publicStripeKey);
            $envUpdates['STRIPE_PUBLISHABLE_KEY'] = (string) $publicStripeKey;
        }

        if (!empty($data['stripeSecretKey'] ?? null)) {
            $envUpdates['STRIPE_SECRET_KEY'] = (string) $data['stripeSecretKey'];
        }

        if (!empty($data['stripeWebhookSecret'] ?? null)) {
            $envUpdates['STRIPE_WEBHOOK_SECRET'] = (string) $data['stripeWebhookSecret'];
        }

        if (!empty($data['geminiApiKey'] ?? null)) {
            $envUpdates['GEMINI_API_KEY'] = (string) $data['geminiApiKey'];
        }

        if (!empty($data['openaiApiKey'] ?? null)) {
            $envUpdates['OPENAI_API_KEY'] = (string) $data['openaiApiKey'];
        }

        if (!empty($data['recaptchaSecretKey'] ?? null)) {
            $envUpdates['RECAPTCHA_SECRET_KEY'] = (string) $data['recaptchaSecretKey'];
        }

        if (!empty($data['googleAuthClientId'] ?? null)) {
            $googleClientId = trim((string) $data['googleAuthClientId']);
            $this->repository->upsertSystemSetting('googleAuthClientId', $googleClientId);
            $envUpdates['GOOGLE_CLIENT_ID'] = $googleClientId;
        }

        if (!empty($data['facebookAuthAppId'] ?? null)) {
            $facebookAppId = trim((string) $data['facebookAuthAppId']);
            $this->repository->upsertSystemSetting('facebookAuthAppId', $facebookAppId);
            $envUpdates['FACEBOOK_APP_ID'] = $facebookAppId;
        }

        if (!empty($data['facebookAuthAppSecret'] ?? null)) {
            $envUpdates['FACEBOOK_APP_SECRET'] = (string) $data['facebookAuthAppSecret'];
        }

        if (!empty($data['appleAuthClientId'] ?? null)) {
            $appleClientId = trim((string) $data['appleAuthClientId']);
            $this->repository->upsertSystemSetting('appleAuthClientId', $appleClientId);
            $envUpdates['APPLE_CLIENT_ID'] = $appleClientId;
        }

        if (array_key_exists('appleAuthRedirectUri', $data)) {
            $this->repository->upsertSystemSetting('appleAuthRedirectUri', trim((string) ($data['appleAuthRedirectUri'] ?? '')));
        }

        if (!empty($data['smtpPass'] ?? null)) {
            $envUpdates['SMTP_PASS'] = (string) $data['smtpPass'];
        }
    }

    /**
     * Salva configuracoes genericas que nao exigem tratamento especial.
     *
     * @since 1.0.0
     */
    private function persistGenericSettings(array $data): void
    {
        $skipKeys = [
            'pricing',
            'planDetails',
            'geminiApiKey',
            'openaiApiKey',
            'recaptchaSecretKey',
            'facebookAuthAppSecret',
            'smtpPass',
            'stripeSecretKey',
            'stripeWebhookSecret',
            'stripeKey',
            'paymentProvider',
            'paymentCheckoutMode',
            'cardVaultProvider',
            'stripePaymentMethods',
            'hasStripeSecretConfigured',
            'hasStripeWebhookConfigured',
            'hasGeminiApiKeyConfigured',
            'hasOpenAiApiKeyConfigured',
            'hasRecaptchaSecretConfigured',
            'hasGoogleAuthClientConfigured',
            'hasFacebookAuthConfigured',
            'hasAppleAuthConfigured',
            'hasSmtpPasswordConfigured',
        ];
        $featureKeys = [];

        if (isset($data['features']) && is_array($data['features'])) {
            foreach (array_keys($data['features']) as $featureKey) {
                if (is_string($featureKey) && $featureKey !== '') {
                    $featureKeys[] = $featureKey;
                }
            }
        }

        foreach ($data as $key => $value) {
            if (!is_string($key)) {
                continue;
            }

            if ($key === 'features' && is_array($value)) {
                foreach ($value as $featureKey => $featureValue) {
                    if (is_string($featureKey)) {
                        $this->repository->upsertSystemSetting($featureKey, $featureValue);
                    }
                }
            }

            if ($key !== 'features' && in_array($key, $featureKeys, true)) {
                continue;
            }

            if (in_array($key, $skipKeys, true)) {
                continue;
            }

            $this->repository->upsertSystemSetting($key, $value);
        }
    }

    /**
     * Atualiza o APP_ENV no arquivo .env conforme modo escolhido.
     *
     * @since 1.0.0
     */
    private function updateAppEnv(string $appMode): void
    {
        $normalizedMode = $appMode === 'production' ? 'production' : 'development';
        updateEnvFileValues(['APP_ENV' => $normalizedMode], $this->envPath);
        $this->log("Updated .env APP_ENV to {$normalizedMode}");
    }

    /**
     * Remove valores crus de segredos antes de devolver settings ao frontend.
     *
     * @since 1.0.0
     */
    private function maskSecretValues(array $settings): array
    {
        unset(
            $settings['geminiApiKey'],
            $settings['openaiApiKey'],
            $settings['recaptchaSecretKey'],
            $settings['facebookAuthAppSecret'],
            $settings['smtpPass'],
            $settings['stripeSecretKey'],
            $settings['stripeWebhookSecret']
        );

        return $settings;
    }

    /**
     * Remove informacoes sensiveis das configuracoes publicas.
     *
     * @since 1.0.0
     */
    private function sanitizeSettingsForPublic(array $settings): array
    {
        return PublicSettingsProjection::project($settings);
    }

    private function mergeLegalCommentaryFeatureConfigDefaults(array $featureConfig): array
    {
        return normalizeLegalCommentaryFeatureConfig($featureConfig);
    }

    /**
     * Mescla defaults oficiais do bloco SEO.
     *
     * @since 1.0.0
     */
    private function mergeSeoDefaults(array $seo): array
    {
        $defaults = [
            'global' => [
                'site_title' => '',
                'meta_description' => '',
                'canonical_base_url' => '',
                'robots_default' => 'index,follow',
                'default_og_title' => '',
                'default_og_description' => '',
                'default_og_image' => '',
                'default_twitter_title' => '',
                'default_twitter_description' => '',
                'default_twitter_image' => '',
                'google_site_verification' => '',
                'bing_site_verification' => '',
                'noindex_non_production' => true,
                'enable_sitemap' => true,
                'enable_robots_txt_control' => true,
            ],
            'pages' => [],
        ];

        foreach (['landing', 'plans', 'faq', 'changelog', 'privacy', 'terms'] as $pageKey) {
            $defaults['pages'][$pageKey] = [
                'title' => '',
                'meta_description' => '',
                'canonical_url' => '',
                'og_title' => '',
                'og_description' => '',
                'og_image' => '',
                'robots_override' => null,
            ];
        }

        $merged = $defaults;
        $merged['global'] = array_merge($defaults['global'], (array) ($seo['global'] ?? []));

        foreach ($defaults['pages'] as $pageKey => $pageDefaults) {
            $merged['pages'][$pageKey] = array_merge($pageDefaults, (array) (($seo['pages'] ?? [])[$pageKey] ?? []));
        }

        return $merged;
    }

    /**
     * Mescla defaults oficiais do countdown de oferta limitada.
     *
     * @since 1.0.0
     */
    private function mergeLimitedOfferCountdownDefaults(array $limitedOfferCountdown): array
    {
        $enabled = array_key_exists('enabled', $limitedOfferCountdown)
            ? (filter_var($limitedOfferCountdown['enabled'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (bool) $limitedOfferCountdown['enabled'])
            : false;
        $endsAt = trim((string) ($limitedOfferCountdown['endsAt'] ?? ''));

        if ($endsAt !== '') {
            try {
                $endsAt = (new DateTimeImmutable($endsAt))->format(DateTimeInterface::ATOM);
            } catch (Throwable $error) {
                $endsAt = '';
            }
        }

        return [
            'enabled' => $enabled,
            'endsAt' => $endsAt,
        ];
    }

    /**
     * Mescla defaults oficiais do bloco editavel da homepage.
     *
     * @since 1.0.0
     */
    private function mergeLandingPageContentDefaults(array $landingPageContent): array
    {
        $defaults = [
            'featureCards' => [
                [
                    'id' => 'banco-de-questoes',
                    'title' => 'Banco de questoes com direcao',
                    'description' => 'Pratique por banca, assunto, ano e foco para estudar exatamente o que mais aproxima voce da prova.',
                    'iconKey' => 'filters',
                    'enabled' => true,
                    'order' => 10,
                ],
                [
                    'id' => 'simulados-com-metrica',
                    'title' => 'Simulados para medir nivel real',
                    'description' => 'Saia do achismo com simulados que mostram ritmo, acerto e onde sua revisao precisa ficar mais forte.',
                    'iconKey' => 'simulations',
                    'enabled' => true,
                    'order' => 20,
                ],
                [
                    'id' => 'revisao-com-contexto',
                    'title' => 'Revisao com comentarios e materiais',
                    'description' => 'Volte aos erros com comentarios, leitura e materiais de apoio no mesmo fluxo, sem estudo solto.',
                    'iconKey' => 'teacher-comments',
                    'enabled' => true,
                    'order' => 30,
                ],
                [
                    'id' => 'desempenho-e-pontos-fracos',
                    'title' => 'Desempenho para ajustar a rota',
                    'description' => 'Veja onde voce erra mais, o que precisa revisar e como estudar com mais controle ate a prova.',
                    'iconKey' => 'performance',
                    'enabled' => true,
                    'order' => 40,
                ],
                [
                    'id' => 'ranking-competitivo',
                    'title' => 'Ranking para entender seu nivel',
                    'description' => 'Compare seu desempenho com outros candidatos e tenha uma leitura mais real do seu nivel competitivo.',
                    'iconKey' => 'ranking',
                    'enabled' => true,
                    'order' => 50,
                ],
                [
                    'id' => 'rotina-sem-improviso',
                    'title' => 'Rotina integrada sem improviso',
                    'description' => 'Centralize questoes, leitura, simulados e acompanhamento sem depender de varias ferramentas paralelas.',
                    'iconKey' => 'materials',
                    'enabled' => true,
                    'order' => 60,
                ],
            ],
            'socialLinks' => [
                [
                    'id' => 'instagram',
                    'label' => 'Instagram',
                    'handle' => '@concursomestre',
                    'url' => '',
                    'iconKey' => 'instagram',
                    'enabled' => false,
                ],
                [
                    'id' => 'youtube',
                    'label' => 'YouTube',
                    'handle' => 'Canal oficial',
                    'url' => '',
                    'iconKey' => 'youtube',
                    'enabled' => false,
                ],
                [
                    'id' => 'telegram',
                    'label' => 'Telegram',
                    'handle' => 'Comunidade oficial',
                    'url' => '',
                    'iconKey' => 'telegram',
                    'enabled' => false,
                ],
            ],
        ];

        $merged = $defaults;
        $featureCards = isset($landingPageContent['featureCards']) && is_array($landingPageContent['featureCards'])
            ? $landingPageContent['featureCards']
            : [];
        $socialLinks = isset($landingPageContent['socialLinks']) && is_array($landingPageContent['socialLinks'])
            ? $landingPageContent['socialLinks']
            : [];

        if ($featureCards !== []) {
            $merged['featureCards'] = array_map(function ($feature) {
                $featurePayload = is_array($feature) ? $feature : [];

                return [
                    'id' => isset($featurePayload['id']) && trim((string) $featurePayload['id']) !== '' ? trim((string) $featurePayload['id']) : 'feature-' . bin2hex(random_bytes(4)),
                    'title' => trim((string) ($featurePayload['title'] ?? 'Novo diferencial')),
                    'description' => trim((string) ($featurePayload['description'] ?? 'Descreva como esse recurso ajuda o aluno a estudar melhor e evoluir mais rapido.')),
                    'iconKey' => trim((string) ($featurePayload['iconKey'] ?? 'performance')),
                    'enabled' => !array_key_exists('enabled', $featurePayload) || !empty($featurePayload['enabled']),
                    'order' => isset($featurePayload['order']) ? (int) $featurePayload['order'] : 999,
                ];
            }, $featureCards);
            usort($merged['featureCards'], static function (array $left, array $right): int {
                $leftOrder = (int) ($left['order'] ?? 999);
                $rightOrder = (int) ($right['order'] ?? 999);

                if ($leftOrder === $rightOrder) {
                    return strcmp((string) ($left['title'] ?? ''), (string) ($right['title'] ?? ''));
                }

                return $leftOrder <=> $rightOrder;
            });
        }

        if ($socialLinks !== []) {
            $merged['socialLinks'] = array_map(function ($socialLink) {
                $socialPayload = is_array($socialLink) ? $socialLink : [];

                return [
                    'id' => isset($socialPayload['id']) && trim((string) $socialPayload['id']) !== '' ? trim((string) $socialPayload['id']) : 'social-' . bin2hex(random_bytes(4)),
                    'label' => trim((string) ($socialPayload['label'] ?? 'Rede social')),
                    'handle' => trim((string) ($socialPayload['handle'] ?? '')),
                    'url' => trim((string) ($socialPayload['url'] ?? '')),
                    'iconKey' => trim((string) ($socialPayload['iconKey'] ?? 'instagram')),
                    'enabled' => !empty($socialPayload['enabled']),
                ];
            }, $socialLinks);
        }

        return $merged;
    }

    /**
     * Mantem o payload de features consistente entre o bloco aninhado e aliases planos legados.
     *
     * @since 1.0.0
     */
    private function syncFeatureAliases(array $settings): array
    {
        $featurePayload = is_array($settings['features'] ?? null) ? $settings['features'] : [];

        foreach ($featurePayload as $featureKey => $featureValue) {
            if (!is_string($featureKey) || $featureKey === '') {
                continue;
            }

            $normalizedValue = filter_var($featureValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            $settings['features'][$featureKey] = $normalizedValue ?? (bool) $featureValue;
            $settings[$featureKey] = $settings['features'][$featureKey];
        }

        return $settings;
    }

    /**
     * Normaliza o bloco de feature flags e espelha aliases planos conhecidos.
     *
     * @since 1.0.0
     */
    private function normalizeFeatureSettingsPayload(array $payload): array
    {
        $knownFeatureKeys = [
            'practiceEnabled',
            'marketplaceEnabled',
            'rankingsEnabled',
            'annotatedLawsEnabled',
            'flashcardsEnabled',
            'communityEnabled',
            'supportDonationsEnabled',
            'aiCommentsEnabled',
            'bulkImportEnabled',
            'reportsEnabled',
            'notificationsEnabled',
            'simulationsEnabled',
            'studyScheduleEnabled',
            'maintenanceMode',
            'registrationEnabled',
            'landingPagePromoEnabled',
            'xRayEnabled',
            'loginRequired',
            'partnerRegistrationEnabled',
            'recurringEnabled',
            'subscriptionsEnabled',
            'autoRefundEnabled',
        ];

        $incomingFeatures = is_array($payload['features'] ?? null) ? $payload['features'] : [];
        $normalizedFeatures = [];

        foreach ($knownFeatureKeys as $featureKey) {
            $hasNestedValue = array_key_exists($featureKey, $incomingFeatures);
            $hasFlatValue = array_key_exists($featureKey, $payload);

            if (!$hasNestedValue && !$hasFlatValue) {
                continue;
            }

            $candidate = $hasNestedValue ? $incomingFeatures[$featureKey] : $payload[$featureKey];
            $normalizedValue = filter_var($candidate, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            $normalizedFeatures[$featureKey] = $normalizedValue ?? (bool) $candidate;
        }

        if ($normalizedFeatures === []) {
            return $payload;
        }

        $payload['features'] = array_merge($incomingFeatures, $normalizedFeatures);

        foreach ($normalizedFeatures as $featureKey => $featureValue) {
            $payload[$featureKey] = $featureValue;
        }

        return $payload;
    }

    /**
     * Monta placeholders seguros para teste operacional de modelos de e-mail.
     *
     * @since 1.0.0
     * @return array<string, string>
     */
    private function buildEmailTemplateTestVariables(string $targetEmail, string $emailLogoUrl = ''): array
    {
        $appUrl = rtrim(getEnvString('APP_URL', 'http://localhost:3000'), '/');
        $plainReply = 'Esta e uma resposta de teste enviada pelo painel administrativo.';
        $htmlReply = nl2br(htmlspecialchars($plainReply, ENT_QUOTES, 'UTF-8'));
        $content = 'Este e um envio de teste do modelo selecionado. Use esta mensagem para validar assunto, corpo, placeholders e entrega SMTP antes de publicar alteracoes.';

        return array_merge([
            'name' => 'Administrador',
            'email' => $targetEmail,
            'confirm_url' => $appUrl . '/confirm-email?token=teste',
            'reset_url' => $appUrl . '/reset-password?token=teste',
            'login_url' => $appUrl . '/auth',
            'app_url' => $appUrl,
            'xp_bonus' => '25',
            'support_url' => $appUrl . '/support',
            'billing_url' => $appUrl . '/profile?tab=subscription',
            'admin_url' => $appUrl . '/admin/panel/dashboard',
            'receipt_url' => $appUrl . '/profile?tab=transactions',
            'reason' => 'Teste operacional',
            'status_line' => 'Resolvido',
            'content' => $content,
            'intro' => 'Este e um exemplo de mensagem gerada pelo suporte.',
            'status_intro' => 'O status deste atendimento foi atualizado para teste.',
            'reply_message' => $plainReply,
            'reply_message_html' => $htmlReply,
            'target_label' => 'Questao de teste',
            'admin_reason' => $plainReply,
            'admin_reason_html' => $htmlReply,
            'evidence_block_html' => '',
        ], resolveSystemEmailBrandingVariables($this->db, $emailLogoUrl));
    }

    /**
     * Resolve o template de teste a partir do rascunho enviado pelo painel ou do modelo salvo.
     *
     * @since 1.0.0
     * @param array{templateKey:string,template:?array<string,mixed>} $templateData
     * @param array<string, string> $variables
     * @return array{name:string,enabled:bool,subject:string,htmlBody:string,textBody:string}
     */
    private function resolveEmailTemplateForTest(array $templateData, array $variables): array
    {
        $templateKey = (string) $templateData['templateKey'];
        $draftTemplate = is_array($templateData['template'] ?? null) ? $templateData['template'] : null;

        if ($draftTemplate !== null) {
            $htmlBody = (string) ($draftTemplate['htmlBody'] ?? '');
            $textBody = (string) ($draftTemplate['textBody'] ?? '');
            $resolvedSubject = applySystemEmailTemplateVariables((string) ($draftTemplate['subject'] ?? ''), $variables);
            $resolvedHtmlBody = applySystemEmailBrandingToHtml(applySystemEmailTemplateVariablesForHtml($htmlBody, $variables), $variables);
            $resolvedTextBody = applySystemEmailTemplateVariables($textBody, $variables);

            if ($textBody === '' && $htmlBody !== '') {
                $textBody = Mailer::htmlToText($htmlBody);
                $resolvedTextBody = applySystemEmailTemplateVariables($textBody, $variables);
            }

            return [
                'name' => (string) ($draftTemplate['name'] ?? $templateKey),
                'enabled' => array_key_exists('enabled', $draftTemplate) ? (bool) $draftTemplate['enabled'] : true,
                'subject' => $resolvedSubject,
                'htmlBody' => wrapSystemEmailTemplateHtml($resolvedHtmlBody, $resolvedSubject, $variables),
                'textBody' => $resolvedTextBody,
            ];
        }

        $resolved = resolveSystemEmailTemplate($templateKey, [], $variables, $this->db);
        $catalog = getSystemEmailTemplateCatalog();

        return [
            'name' => (string) ($catalog[$templateKey]['name'] ?? $templateKey),
            'enabled' => (bool) ($resolved['enabled'] ?? true),
            'subject' => (string) ($resolved['subject'] ?? ''),
            'htmlBody' => (string) ($resolved['htmlBody'] ?? ''),
            'textBody' => (string) ($resolved['textBody'] ?? ''),
        ];
    }

    /**
     * Executa um bloco com variaveis SMTP temporarias.
     *
     * @since 1.0.0
     * @param array<string, string> $envValues
     */
    private function withTemporaryMailEnvironment(array $envValues, callable $callback): void
    {
        $previousValues = [];

        foreach ($envValues as $key => $value) {
            $previousValues[$key] = getenv($key);
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }

        try {
            $callback();
        } finally {
            foreach ($previousValues as $key => $previousValue) {
                if ($previousValue === false || $previousValue === null) {
                    putenv($key);
                    unset($_ENV[$key]);
                    continue;
                }

                putenv($key . '=' . $previousValue);
                $_ENV[$key] = (string) $previousValue;
            }
        }
    }

    /**
     * Registra log simples das operacoes administrativas.
     *
     * @since 1.0.0
     */
    private function log(string $message): void
    {
        $logDirectory = dirname($this->logFilePath);
        if (!is_dir($logDirectory)) {
            mkdir($logDirectory, 0775, true);
        }

        file_put_contents($this->logFilePath, '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL, FILE_APPEND);
    }
}
