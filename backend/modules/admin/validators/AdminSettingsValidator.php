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

require_once __DIR__ . '/../../../config/stripe.php';
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';

/**
 * Validador das configuracoes sistemicas.
 * Garante consistencia minima antes de persistir configuracoes globais.
 */
class AdminSettingsValidator
{
    /** @var array<int, string> */
    private array $allowedRobots = [
        'index,follow',
        'noindex,follow',
        'index,nofollow',
        'noindex,nofollow',
    ];

    /**
     * Valida o payload de atualizacao das configuracoes globais.
     *
     * @since 1.0.0
     */
    public function validateUpdatePayload(array $payload): array
    {
        if ($payload === []) {
            throw new InvalidArgumentException('Dados invalidos.');
        }

        foreach ([
            'smtpPass',
            'geminiApiKey',
            'openaiApiKey',
            'recaptchaSecretKey',
            'facebookAuthAppSecret',
            'stripeSecretKey',
            'stripeWebhookSecret',
        ] as $secretKey) {
            if (array_key_exists($secretKey, $payload) && $this->isMaskedSecretValue($payload[$secretKey])) {
                unset($payload[$secretKey]);
            }
        }

        if (isset($payload['siteName'])) {
            $payload['siteName'] = $this->sanitizeString($payload['siteName'], 120, 'Nome do site');
        }

        if (isset($payload['supportPhone'])) {
            $payload['supportPhone'] = $this->sanitizeString($payload['supportPhone'], 40, 'Telefone de suporte', true);
        }

        if (isset($payload['googleAnalyticsId'])) {
            $payload['googleAnalyticsId'] = $this->sanitizeString($payload['googleAnalyticsId'], 60, 'Google Analytics ID', true);
        }

        if (isset($payload['googleAuthClientId'])) {
            $payload['googleAuthClientId'] = $this->sanitizeString($payload['googleAuthClientId'], 255, 'Google OAuth Client ID', true);
        }

        if (isset($payload['facebookAuthAppId'])) {
            $payload['facebookAuthAppId'] = $this->validateFacebookAppId($payload['facebookAuthAppId']);
        }

        if (isset($payload['facebookAuthAppSecret'])) {
            $payload['facebookAuthAppSecret'] = $this->sanitizeString($payload['facebookAuthAppSecret'], 255, 'Facebook App Secret', true);
        }

        if (isset($payload['appleAuthClientId'])) {
            $payload['appleAuthClientId'] = $this->validateAppleClientId($payload['appleAuthClientId']);
        }

        if (isset($payload['appleAuthRedirectUri'])) {
            $payload['appleAuthRedirectUri'] = $this->validateAppleRedirectUri($payload['appleAuthRedirectUri']);
        }

        if (isset($payload['metaPixelId'])) {
            $payload['metaPixelId'] = $this->sanitizeString($payload['metaPixelId'], 60, 'Meta Pixel ID', true);
        }

        foreach ([
            'adsEnabled',
            'adsenseTestMode',
            'adPlacementTopEnabled',
            'adPlacementSidebarEnabled',
            'adPlacementBottomEnabled',
            'adPlacementInterstitialEnabled',
            'adPlacementNavigationPopEnabled',
        ] as $adsFlagKey) {
            if (array_key_exists($adsFlagKey, $payload)) {
                $payload[$adsFlagKey] = $this->normalizeBooleanValue($payload[$adsFlagKey]);
            }
        }

        if (isset($payload['adsenseClientId'])) {
            $payload['adsenseClientId'] = $this->validateAdsensePublisherId($payload['adsenseClientId']);
        }

        foreach ([
            'adsenseTopSlotId' => 'Slot AdSense do topo',
            'adsenseSidebarSlotId' => 'Slot AdSense lateral',
            'adsenseBottomSlotId' => 'Slot AdSense inferior',
        ] as $slotKey => $slotLabel) {
            if (isset($payload[$slotKey])) {
                $payload[$slotKey] = $this->validateAdsenseSlotId($payload[$slotKey], $slotLabel);
            }
        }

        if (isset($payload['facebookAdsId'])) {
            $payload['facebookAdsId'] = $this->sanitizeString($payload['facebookAdsId'], 80, 'Meta/Facebook Ads ID', true);
        }

        foreach ([
            'adBannerTop' => 'HTML do banner do topo',
            'adBannerSidebar' => 'HTML do banner lateral',
            'adBannerBottom' => 'HTML do banner inferior',
        ] as $bannerKey => $bannerLabel) {
            if (isset($payload[$bannerKey])) {
                $payload[$bannerKey] = $this->sanitizeLongSetting($payload[$bannerKey], 20000, $bannerLabel);
            }
        }

        if (isset($payload['adInterstitialSlotId'])) {
            $payload['adInterstitialSlotId'] = $this->sanitizeString($payload['adInterstitialSlotId'], 160, 'Slot interstitial', true);
        }

        if (isset($payload['adNavigationPopUrl'])) {
            $payload['adNavigationPopUrl'] = $this->sanitizeString($payload['adNavigationPopUrl'], 500, 'URL do pop de navegacao', true);
        }

        if (isset($payload['mailFromAddress'])) {
            $payload['mailFromAddress'] = $this->validateOptionalEmail($payload['mailFromAddress'], 'E-mail remetente');
        }

        if (isset($payload['legalContactEmail'])) {
            $payload['legalContactEmail'] = $this->validateOptionalEmail($payload['legalContactEmail'], 'E-mail juridico');
        }

        if (isset($payload['privacyContactEmail'])) {
            $payload['privacyContactEmail'] = $this->validateOptionalEmail($payload['privacyContactEmail'], 'E-mail de privacidade');
        }

        if (isset($payload['mailFromName'])) {
            $payload['mailFromName'] = $this->sanitizeString($payload['mailFromName'], 120, 'Nome do remetente', true);
        }

        if (isset($payload['emailLogoUrl'])) {
            $payload['emailLogoUrl'] = $this->validateOptionalHttpUrl($payload['emailLogoUrl'], 'Logo padrao dos e-mails');
        }

        if (isset($payload['smtpPort'])) {
            $port = (int) $payload['smtpPort'];
            if ($port < 1 || $port > 65535) {
                throw new InvalidArgumentException('Porta SMTP invalida.');
            }

            $payload['smtpPort'] = $port;
        }

        if (isset($payload['smtpSecure'])) {
            $smtpSecure = strtolower(trim((string) $payload['smtpSecure']));
            if (!in_array($smtpSecure, ['tls', 'ssl'], true)) {
                throw new InvalidArgumentException('Seguranca SMTP invalida.');
            }

            $payload['smtpSecure'] = $smtpSecure;
        }

        if (isset($payload['paymentCheckoutMode'])) {
            $checkoutMode = trim((string) $payload['paymentCheckoutMode']);
            if (!in_array($checkoutMode, ['internal', 'redirect'], true)) {
                throw new InvalidArgumentException('Modo de checkout invalido.');
            }

            $payload['paymentCheckoutMode'] = $checkoutMode;
        }

        if (isset($payload['aiProvider'])) {
            $aiProvider = strtolower(trim((string) $payload['aiProvider']));
            if (!in_array($aiProvider, ['gemini', 'openai', 'auto'], true)) {
                throw new InvalidArgumentException('Provedor de IA invalido.');
            }

            $payload['aiProvider'] = $aiProvider;
        }

        if (isset($payload['openAiModel'])) {
            $openAiModel = trim((string) $payload['openAiModel']);
            if ($openAiModel !== '' && preg_match('/^[A-Za-z0-9._-]+$/', $openAiModel) !== 1) {
                throw new InvalidArgumentException('Modelo OpenAI invalido.');
            }

            $payload['openAiModel'] = $openAiModel;
        }

        if (isset($payload['geminiModel'])) {
            $geminiModel = trim((string) $payload['geminiModel']);
            if ($geminiModel === '' || preg_match('/^gemini-[A-Za-z0-9._-]+$/', $geminiModel) !== 1) {
                throw new InvalidArgumentException('Modelo Gemini invalido.');
            }

            $payload['geminiModel'] = $geminiModel;
        }

        $publicStripeKey = trim((string) ($payload['stripePublishableKey'] ?? $payload['stripeKey'] ?? ''));
        if ($publicStripeKey !== '') {
            if (!isValidStripePublishableKey($publicStripeKey)) {
                throw new InvalidArgumentException('Stripe publishable key invalida.');
            }

            $payload['stripePublishableKey'] = $publicStripeKey;
            unset($payload['stripeKey']);
        }

        if (isset($payload['stripeSecretKey']) && trim((string) $payload['stripeSecretKey']) !== '') {
            $stripeSecretKey = trim((string) $payload['stripeSecretKey']);
            if (!isValidStripeSecretKey($stripeSecretKey)) {
                throw new InvalidArgumentException('Stripe secret key invalida.');
            }

            $payload['stripeSecretKey'] = $stripeSecretKey;
        }

        if (isset($payload['stripeWebhookSecret']) && trim((string) $payload['stripeWebhookSecret']) !== '') {
            $stripeWebhookSecret = trim((string) $payload['stripeWebhookSecret']);
            if (!isValidStripeWebhookSecret($stripeWebhookSecret)) {
                throw new InvalidArgumentException('Stripe webhook secret invalido.');
            }

            $payload['stripeWebhookSecret'] = $stripeWebhookSecret;
        }

        if (
            !empty($payload['stripePublishableKey'])
            && !empty($payload['stripeSecretKey'])
            && resolveStripeKeyMode((string) $payload['stripePublishableKey']) !== resolveStripeKeyMode((string) $payload['stripeSecretKey'])
        ) {
            throw new InvalidArgumentException('Chaves Stripe devem usar o mesmo modo test ou live.');
        }

        if (isset($payload['seo']) && is_array($payload['seo'])) {
            $payload['seo'] = $this->validateSeoSettings($payload['seo']);
        }

        if (isset($payload['landingPageContent']) && is_array($payload['landingPageContent'])) {
            $payload['landingPageContent'] = $this->validateLandingPageContent($payload['landingPageContent']);
        }

        if (isset($payload['landingPages']) && is_array($payload['landingPages'])) {
            $payload['landingPages'] = $this->validateLandingPages($payload['landingPages']);
        }

        if (isset($payload['limitedOfferCountdown']) && is_array($payload['limitedOfferCountdown'])) {
            $payload['limitedOfferCountdown'] = $this->validateLimitedOfferCountdown($payload['limitedOfferCountdown']);
        }

        if (isset($payload['legalCommentaryFeatureConfig']) && is_array($payload['legalCommentaryFeatureConfig'])) {
            $payload['legalCommentaryFeatureConfig'] = $this->validateLegalCommentaryFeatureConfig($payload['legalCommentaryFeatureConfig']);
        }

        if (isset($payload['emailTemplates']) && is_array($payload['emailTemplates'])) {
            $payload['emailTemplates'] = $this->validateEmailTemplates($payload['emailTemplates']);
        }

        if (isset($payload['coupons']) && is_array($payload['coupons'])) {
            $payload['coupons'] = $this->validateCoupons($payload['coupons']);
        }

        foreach ([
            'platformFeePercent' => [0.0, 100.0, 'Taxa da plataforma'],
            'referralCommissionPercent' => [0.0, 100.0, 'Comissao por indicacao'],
        ] as $key => [$minimum, $maximum, $label]) {
            if (array_key_exists($key, $payload)) {
                if (!is_numeric($payload[$key])) {
                    throw new InvalidArgumentException($label . ' invalida.');
                }
                $value = round((float) $payload[$key], 3);
                if ($value < $minimum || $value > $maximum) {
                    throw new InvalidArgumentException($label . ' deve ficar entre ' . $minimum . ' e ' . $maximum . '.');
                }
                $payload[$key] = $value;
            }
        }

        foreach ([
            'referralRefundGraceDays' => [0, 180, 'Carencia de reembolso'],
            'referralPayoutCycleDays' => [1, 90, 'Ciclo de repasse'],
            'referralPayoutDay' => [1, 28, 'Dia de repasse'],
        ] as $key => [$minimum, $maximum, $label]) {
            if (array_key_exists($key, $payload)) {
                $value = filter_var($payload[$key], FILTER_VALIDATE_INT);
                if ($value === false || $value < $minimum || $value > $maximum) {
                    throw new InvalidArgumentException($label . ' invalido.');
                }
                $payload[$key] = $value;
            }
        }

        return $payload;
    }

    /**
     * Valida o payload temporario usado no teste de SMTP.
     *
     * @since 1.0.0
     */
    public function validateSmtpTestPayload(array $payload): array
    {
        $smtpHost = trim((string) ($payload['smtpHost'] ?? ''));
        $smtpUser = trim((string) ($payload['smtpUser'] ?? ''));
        $smtpPort = (int) ($payload['smtpPort'] ?? 587);
        $smtpSecure = strtolower(trim((string) ($payload['smtpSecure'] ?? 'tls')));
        $mailFrom = trim((string) ($payload['mailFromAddress'] ?? $smtpUser));
        $mailFromName = trim((string) ($payload['mailFromName'] ?? 'ConcursoMestre'));
        $targetEmail = trim((string) ($payload['targetEmail'] ?? $mailFrom));
        $emailLogoUrl = $this->validateOptionalHttpUrl($payload['emailLogoUrl'] ?? '', 'Logo padrao dos e-mails');

        if ($smtpHost === '') {
            throw new InvalidArgumentException('Informe o host SMTP antes de testar.');
        }

        if ($smtpUser === '') {
            throw new InvalidArgumentException('Informe o usuario SMTP antes de testar.');
        }

        if ($smtpPort < 1 || $smtpPort > 65535) {
            throw new InvalidArgumentException('Porta SMTP invalida.');
        }

        if (!in_array($smtpSecure, ['tls', 'ssl'], true)) {
            throw new InvalidArgumentException('Seguranca SMTP invalida.');
        }

        if ($mailFrom !== '' && filter_var($mailFrom, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('E-mail remetente invalido.');
        }

        if ($targetEmail === '' || filter_var($targetEmail, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('E-mail de teste invalido.');
        }

        return [
            'smtpHost' => $smtpHost,
            'smtpPort' => $smtpPort,
            'smtpSecure' => $smtpSecure,
            'smtpUser' => $smtpUser,
            'smtpPass' => (string) ($payload['smtpPass'] ?? ''),
            'mailFromAddress' => $mailFrom !== '' ? $mailFrom : $smtpUser,
            'mailFromName' => $mailFromName !== '' ? $mailFromName : 'ConcursoMestre',
            'targetEmail' => $targetEmail,
            'emailLogoUrl' => $emailLogoUrl,
        ];
    }

    /**
     * Valida o modelo escolhido para envio operacional de teste.
     *
     * @since 1.0.0
     * @return array{templateKey:string,template:?array<string,mixed>}
     */
    public function validateEmailTemplateTestPayload(array $payload): array
    {
        $templatePayload = is_array($payload['template'] ?? null) ? $payload['template'] : null;
        $templateKey = trim((string) ($payload['templateKey'] ?? ($templatePayload['key'] ?? '')));
        $catalog = getSystemEmailTemplateCatalog();

        if ($templateKey === '' || !isset($catalog[$templateKey])) {
            throw new InvalidArgumentException('Modelo de e-mail invalido.');
        }

        $validatedTemplate = null;
        if ($templatePayload !== null) {
            $templatePayload['key'] = $templateKey;
            $validatedTemplates = $this->validateEmailTemplates([$templatePayload]);
            foreach ($validatedTemplates as $template) {
                if (is_array($template) && (($template['key'] ?? '') === $templateKey)) {
                    $validatedTemplate = $template;
                    break;
                }
            }
        }

        return [
            'templateKey' => $templateKey,
            'template' => $validatedTemplate,
        ];
    }

    /**
     * Valida o payload de diagnostico das integracoes administrativas.
     *
     * @since 1.0.0
     */
    public function validateIntegrationTestPayload(array $payload): array
    {
        $cleanSecret = fn(string $key): string => $this->isMaskedSecretValue($payload[$key] ?? '')
            ? ''
            : trim((string) ($payload[$key] ?? ''));

        return [
            'stripePublishableKey' => trim((string) ($payload['stripePublishableKey'] ?? $payload['stripeKey'] ?? '')),
            'stripeSecretKey' => $cleanSecret('stripeSecretKey'),
            'stripeWebhookSecret' => $cleanSecret('stripeWebhookSecret'),
            'recaptchaEnabled' => isset($payload['recaptchaEnabled']) ? (bool) $payload['recaptchaEnabled'] : false,
            'recaptchaSiteKey' => trim((string) ($payload['recaptchaSiteKey'] ?? '')),
            'recaptchaSecretKey' => $cleanSecret('recaptchaSecretKey'),
            'googleAuthClientId' => trim((string) ($payload['googleAuthClientId'] ?? '')),
            'facebookAuthAppId' => trim((string) ($payload['facebookAuthAppId'] ?? '')),
            'facebookAuthAppSecret' => $cleanSecret('facebookAuthAppSecret'),
            'appleAuthClientId' => trim((string) ($payload['appleAuthClientId'] ?? '')),
            'geminiApiKey' => $cleanSecret('geminiApiKey'),
            'openaiApiKey' => $cleanSecret('openaiApiKey'),
            'firebaseKey' => trim((string) (($payload['firebaseConfig']['apiKey'] ?? $payload['firebaseKey'] ?? ''))),
            'googleAnalyticsId' => trim((string) ($payload['googleAnalyticsId'] ?? '')),
            'metaPixelId' => trim((string) ($payload['metaPixelId'] ?? '')),
        ];
    }

    /**
     * Normaliza e valida o bloco oficial de SEO.
     *
     * @since 1.0.0
     */
    private function validateSeoSettings(array $seo): array
    {
        $global = (array) ($seo['global'] ?? []);
        $pages = (array) ($seo['pages'] ?? []);

        $validatedGlobal = [
            'site_title' => $this->sanitizeString($global['site_title'] ?? '', 65, 'SEO global > title', true),
            'meta_description' => $this->sanitizeString($global['meta_description'] ?? '', 170, 'SEO global > description', true),
            'canonical_base_url' => $this->validateOptionalUrl($global['canonical_base_url'] ?? '', 'SEO global > canonical'),
            'robots_default' => $this->validateRobots($global['robots_default'] ?? 'index,follow', false),
            'default_og_title' => $this->sanitizeString($global['default_og_title'] ?? '', 95, 'SEO global > OG title', true),
            'default_og_description' => $this->sanitizeString($global['default_og_description'] ?? '', 220, 'SEO global > OG description', true),
            'default_og_image' => $this->validateOptionalUrl($global['default_og_image'] ?? '', 'SEO global > OG image'),
            'default_twitter_title' => $this->sanitizeString($global['default_twitter_title'] ?? '', 95, 'SEO global > Twitter title', true),
            'default_twitter_description' => $this->sanitizeString($global['default_twitter_description'] ?? '', 220, 'SEO global > Twitter description', true),
            'default_twitter_image' => $this->validateOptionalUrl($global['default_twitter_image'] ?? '', 'SEO global > Twitter image'),
            'google_site_verification' => $this->sanitizeString($global['google_site_verification'] ?? '', 255, 'Google site verification', true),
            'bing_site_verification' => $this->sanitizeString($global['bing_site_verification'] ?? '', 255, 'Bing site verification', true),
            'noindex_non_production' => isset($global['noindex_non_production']) ? (bool) $global['noindex_non_production'] : true,
            'enable_sitemap' => isset($global['enable_sitemap']) ? (bool) $global['enable_sitemap'] : true,
            'enable_robots_txt_control' => isset($global['enable_robots_txt_control']) ? (bool) $global['enable_robots_txt_control'] : true,
        ];

        $validatedPages = [];
        foreach (['landing', 'plans', 'faq', 'changelog', 'privacy', 'terms'] as $pageKey) {
            $page = (array) ($pages[$pageKey] ?? []);
            $validatedPages[$pageKey] = [
                'title' => $this->sanitizeString($page['title'] ?? '', 65, "SEO {$pageKey} > title", true),
                'meta_description' => $this->sanitizeString($page['meta_description'] ?? '', 170, "SEO {$pageKey} > description", true),
                'canonical_url' => $this->validateOptionalUrl($page['canonical_url'] ?? '', "SEO {$pageKey} > canonical"),
                'og_title' => $this->sanitizeString($page['og_title'] ?? '', 95, "SEO {$pageKey} > OG title", true),
                'og_description' => $this->sanitizeString($page['og_description'] ?? '', 220, "SEO {$pageKey} > OG description", true),
                'og_image' => $this->validateOptionalUrl($page['og_image'] ?? '', "SEO {$pageKey} > OG image"),
                'robots_override' => $this->validateRobots($page['robots_override'] ?? null, true),
            ];
        }

        return [
            'global' => $validatedGlobal,
            'pages' => $validatedPages,
        ];
    }

    /**
     * Normaliza e valida o bloco editavel da homepage.
     *
     * @since 1.0.0
     */
    private function validateLandingPageContent(array $landingPageContent): array
    {
        $allowedFeatureIcons = [
            'ranking',
            'materials',
            'teacher-comments',
            'filters',
            'xray',
            'community',
            'simulations',
            'performance',
        ];
        $allowedSocialIcons = [
            'instagram',
            'youtube',
            'telegram',
            'whatsapp',
            'linkedin',
        ];
        $featureCards = is_array($landingPageContent['featureCards'] ?? null) ? $landingPageContent['featureCards'] : [];
        $socialLinks = is_array($landingPageContent['socialLinks'] ?? null) ? $landingPageContent['socialLinks'] : [];

        $validatedFeatureCards = [];
        foreach ($featureCards as $index => $featureCard) {
            if (!is_array($featureCard)) {
                continue;
            }

            $iconKey = trim((string) ($featureCard['iconKey'] ?? 'performance'));
            if (!in_array($iconKey, $allowedFeatureIcons, true)) {
                throw new InvalidArgumentException("Icone invalido para card da homepage na posicao {$index}.");
            }

            $validatedFeatureCards[] = [
                'id' => $this->sanitizeString($featureCard['id'] ?? "feature-{$index}", 80, "Card da homepage {$index} > id"),
                'title' => $this->sanitizeString($featureCard['title'] ?? '', 90, "Card da homepage {$index} > titulo"),
                'description' => $this->sanitizeString($featureCard['description'] ?? '', 280, "Card da homepage {$index} > descricao"),
                'iconKey' => $iconKey,
                'enabled' => isset($featureCard['enabled']) ? (bool) $featureCard['enabled'] : true,
                'order' => isset($featureCard['order']) ? max(0, min(9999, (int) $featureCard['order'])) : (($index + 1) * 10),
            ];
        }

        usort($validatedFeatureCards, static function (array $left, array $right): int {
            $leftOrder = (int) ($left['order'] ?? 9999);
            $rightOrder = (int) ($right['order'] ?? 9999);

            if ($leftOrder === $rightOrder) {
                return strcmp((string) ($left['title'] ?? ''), (string) ($right['title'] ?? ''));
            }

            return $leftOrder <=> $rightOrder;
        });

        $validatedSocialLinks = [];
        foreach ($socialLinks as $index => $socialLink) {
            if (!is_array($socialLink)) {
                continue;
            }

            $iconKey = trim((string) ($socialLink['iconKey'] ?? 'instagram'));
            if (!in_array($iconKey, $allowedSocialIcons, true)) {
                throw new InvalidArgumentException("Icone invalido para rede social da homepage na posicao {$index}.");
            }

            $validatedSocialLinks[] = [
                'id' => $this->sanitizeString($socialLink['id'] ?? "social-{$index}", 80, "Rede social {$index} > id"),
                'label' => $this->sanitizeString($socialLink['label'] ?? '', 60, "Rede social {$index} > titulo"),
                'handle' => $this->sanitizeString($socialLink['handle'] ?? '', 80, "Rede social {$index} > handle", true),
                'url' => $this->validateOptionalUrl($socialLink['url'] ?? '', "Rede social {$index} > URL"),
                'iconKey' => $iconKey,
                'enabled' => isset($socialLink['enabled']) ? (bool) $socialLink['enabled'] : false,
            ];
        }

        return [
            'featureCards' => $validatedFeatureCards,
            'socialLinks' => $validatedSocialLinks,
        ];
    }

    /**
     * Valida o cronometro oficial de oferta limitada exibido na home e no checkout.
     *
     * @since 1.0.0
     */
    private function validateLimitedOfferCountdown(array $limitedOfferCountdown): array
    {
        $enabled = isset($limitedOfferCountdown['enabled']) ? (bool) $limitedOfferCountdown['enabled'] : false;
        $endsAtRaw = trim((string) ($limitedOfferCountdown['endsAt'] ?? ''));

        if ($endsAtRaw === '') {
            if ($enabled) {
                throw new InvalidArgumentException('Informe a data final da oferta limitada.');
            }

            return [
                'enabled' => false,
                'endsAt' => '',
            ];
        }

        try {
            $endsAt = new DateTimeImmutable($endsAtRaw);
        } catch (Throwable $error) {
            throw new InvalidArgumentException('Data final da oferta limitada invalida.');
        }

        if ($enabled && $endsAt->getTimestamp() <= time()) {
            throw new InvalidArgumentException('A data final da oferta limitada deve estar no futuro.');
        }

        return [
            'enabled' => $enabled,
            'endsAt' => $endsAt->format(DateTimeInterface::ATOM),
        ];
    }

    private function validateLegalCommentaryFeatureConfig(array $featureConfig): array
    {
        return normalizeLegalCommentaryFeatureConfig($featureConfig);
    }

    /**
     * Valida os cupons comerciais salvos no painel financeiro.
     *
     * @since 1.0.0
     */
    private function validateCoupons(array $coupons): array
    {
        $validated = [];
        $seenCodes = [];

        foreach ($coupons as $index => $coupon) {
            if (!is_array($coupon)) {
                continue;
            }

            $code = strtoupper($this->sanitizeString($coupon['code'] ?? '', 40, "Cupom {$index} > codigo"));
            if ($code === '' || preg_match('/^[A-Z0-9_-]{2,40}$/', $code) !== 1) {
                throw new InvalidArgumentException("Cupom {$index} possui codigo invalido.");
            }

            if (isset($seenCodes[$code])) {
                throw new InvalidArgumentException("Cupom {$code} duplicado.");
            }
            $seenCodes[$code] = true;

            $discountPercentage = round(max(0, min(100, (float) ($coupon['discountPercentage'] ?? 0))), 2);
            $discountAmount = round(max(0, (float) ($coupon['discountAmount'] ?? 0)), 2);
            if ($discountPercentage <= 0 && $discountAmount <= 0) {
                throw new InvalidArgumentException("Cupom {$code} precisa ter desconto maior que zero.");
            }

            if ($discountPercentage > 0 && $discountAmount > 0) {
                throw new InvalidArgumentException("Cupom {$code} deve usar desconto percentual ou fixo, nao ambos.");
            }

            if ($discountAmount > 999999.99) {
                throw new InvalidArgumentException("Cupom {$code} possui desconto fixo excessivo.");
            }

            $targetType = strtolower(trim((string) ($coupon['targetType'] ?? 'all')));
            if (!in_array($targetType, ['all', 'plan', 'item'], true)) {
                throw new InvalidArgumentException("Cupom {$code} possui alvo invalido.");
            }

            $targetId = $targetType === 'all'
                ? null
                : $this->sanitizeString($coupon['targetId'] ?? '', 120, "Cupom {$code} > alvo", true);
            if ($targetType !== 'all' && $targetId === '') {
                throw new InvalidArgumentException("Cupom {$code} precisa informar o alvo.");
            }

            $expiresAt = isset($coupon['expiresAt'])
                ? trim((string) $coupon['expiresAt'])
                : '';
            if ($expiresAt !== '') {
                try {
                    $expiresAt = (new DateTimeImmutable($expiresAt))->format(DateTimeInterface::ATOM);
                } catch (Throwable $error) {
                    throw new InvalidArgumentException("Cupom {$code} possui data de expiracao invalida.");
                }
            }

            $allowedUserIds = $this->normalizeCouponAudience($coupon['allowedUserIds'] ?? $coupon['allowed_user_ids'] ?? []);
            $allowedUserEmails = $this->normalizeCouponAudience(
                $coupon['allowedUserEmails'] ?? $coupon['allowed_user_emails'] ?? [],
                true
            );

            foreach ($allowedUserEmails as $email) {
                if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                    throw new InvalidArgumentException("Cupom {$code} possui e-mail autorizado invalido.");
                }
            }

            $validated[] = [
                'code' => $code,
                'discountPercentage' => $discountPercentage,
                'discountAmount' => $discountAmount,
                'uses' => max(0, (int) ($coupon['uses'] ?? 0)),
                'maxUses' => max(0, min(1000000, (int) ($coupon['maxUses'] ?? 0))),
                'expiresAt' => $expiresAt !== '' ? $expiresAt : null,
                'autoApply' => $this->normalizeBooleanValue($coupon['autoApply'] ?? false),
                'targetType' => $targetType,
                'targetId' => $targetId,
                'newUsersOnly' => $this->normalizeBooleanValue($coupon['newUsersOnly'] ?? $coupon['new_users_only'] ?? false),
                'firstPurchaseOnly' => $this->normalizeBooleanValue($coupon['firstPurchaseOnly'] ?? $coupon['first_purchase_only'] ?? false),
                'allowedUserIds' => $allowedUserIds,
                'allowedUserEmails' => $allowedUserEmails,
            ];
        }

        return $validated;
    }

    /**
     * Normaliza listas de usuarios autorizados para cupons.
     *
     * @since 1.0.0
     */
    private function normalizeCouponAudience($value, bool $lowercase = false): array
    {
        if (is_string($value)) {
            $items = preg_split('/[\r\n,;]+/', $value) ?: [];
        } elseif (is_array($value)) {
            $items = $value;
        } else {
            $items = [];
        }

        $normalized = [];
        foreach ($items as $item) {
            $text = trim((string) $item);
            if ($text === '') {
                continue;
            }

            $normalized[] = $lowercase ? strtolower($text) : $text;
        }

        return array_values(array_unique($normalized));
    }

    /**
     * Valida o catalogo editavel de modelos de e-mail.
     *
     * @since 1.0.0
     */
    private function validateEmailTemplates(array $templates): array
    {
        $catalog = getSystemEmailTemplateCatalog();
        $allowedKeys = array_keys($catalog);
        $validated = [];
        $seenKeys = [];

        foreach ($templates as $index => $template) {
            if (!is_array($template)) {
                continue;
            }

            $key = $this->sanitizeString($template['key'] ?? '', 120, "Template de e-mail {$index} > key");
            if (!in_array($key, $allowedKeys, true)) {
                throw new InvalidArgumentException("Template de e-mail {$index} com chave nao suportada.");
            }

            if (isset($seenKeys[$key])) {
                throw new InvalidArgumentException("Template de e-mail {$index} com chave duplicada.");
            }
            $seenKeys[$key] = true;

            $name = $this->sanitizeString(
                $template['name'] ?? ($catalog[$key]['name'] ?? $key),
                120,
                "Template de e-mail {$index} > nome"
            );
            $description = $this->sanitizeString(
                $template['description'] ?? ($catalog[$key]['description'] ?? ''),
                240,
                "Template de e-mail {$index} > descricao",
                true
            );
            $subject = $this->sanitizeString(
                $template['subject'] ?? ($catalog[$key]['subject'] ?? ''),
                180,
                "Template de e-mail {$index} > assunto"
            );
            $htmlBody = $this->sanitizeTemplateBody(
                $template['htmlBody'] ?? ($catalog[$key]['htmlBody'] ?? ''),
                "Template de e-mail {$index} > HTML"
            );
            $textBody = $this->sanitizeTemplateBody(
                $template['textBody'] ?? ($catalog[$key]['textBody'] ?? ''),
                "Template de e-mail {$index} > texto"
            );

            if ($htmlBody === '' && $textBody === '') {
                throw new InvalidArgumentException("Template de e-mail {$index} precisa ter HTML ou texto.");
            }

            $validated[] = [
                'key' => $key,
                'name' => $name,
                'description' => $description,
                'subject' => $subject,
                'htmlBody' => $htmlBody,
                'textBody' => $textBody,
                'enabled' => array_key_exists('enabled', $template) ? (bool) $template['enabled'] : true,
                'updatedAt' => $this->validateOptionalDateTime($template['updatedAt'] ?? null),
            ];
        }

        return normalizeSystemEmailTemplates($validated);
    }

    /**
     * Sanitiza corpo de template de e-mail sem permitir payloads gigantes.
     *
     * @since 1.0.0
     */
    private function sanitizeTemplateBody($value, string $fieldLabel): string
    {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            return '';
        }

        if (mb_strlen($normalized) > 50000) {
            throw new InvalidArgumentException("{$fieldLabel} excede o limite de 50000 caracteres.");
        }

        return $normalized;
    }

    /**
     * Valida o modulo oficial de landing pages do marketing.
     *
     * @since 1.0.0
     */
    private function validateLandingPages(array $landingPages): array
    {
        $validated = [];
        $usedSlugs = [];

        foreach ($landingPages as $index => $landingPage) {
            if (!is_array($landingPage)) {
                continue;
            }

            $slug = $this->sanitizeSlug($landingPage['slug'] ?? '', "Landing {$index} > slug");
            if (in_array($slug, $usedSlugs, true)) {
                throw new InvalidArgumentException("Landing {$index} > slug duplicado.");
            }
            $usedSlugs[] = $slug;

            $validated[] = [
                'id' => $this->sanitizeString($landingPage['id'] ?? "landing-{$index}", 120, "Landing {$index} > id"),
                'title' => $this->sanitizeString($landingPage['title'] ?? '', 120, "Landing {$index} > titulo"),
                'slug' => $slug,
                'status' => $this->validateLandingStatus($landingPage['status'] ?? 'draft'),
                'pageType' => $this->validateLandingPageType($landingPage['pageType'] ?? 'plans'),
                'linkedPlanId' => $this->validateOptionalPositiveInteger($landingPage['linkedPlanId'] ?? null),
                'hero' => $this->validateLandingHero((array) ($landingPage['hero'] ?? []), $index),
                'planCards' => $this->validateLandingPlanCards((array) ($landingPage['planCards'] ?? []), $index),
                'authoritySection' => $this->validateLandingAuthoritySection((array) ($landingPage['authoritySection'] ?? []), $index),
                'valueMatrix' => $this->validateLandingValueMatrix((array) ($landingPage['valueMatrix'] ?? []), $index),
                'eliteSection' => $this->validateLandingEliteSection((array) ($landingPage['eliteSection'] ?? []), $index),
                'comparisonRows' => $this->validateLandingComparisonRows((array) ($landingPage['comparisonRows'] ?? []), $index),
                'objections' => $this->validateLandingObjections((array) ($landingPage['objections'] ?? []), $index),
                'guarantee' => $this->validateLandingGuarantee((array) ($landingPage['guarantee'] ?? []), $index),
                'faq' => $this->validateLandingFaq((array) ($landingPage['faq'] ?? []), $index),
                'finalCta' => $this->validateLandingFinalCta((array) ($landingPage['finalCta'] ?? []), $index),
                'seo' => $this->validateLandingSeo((array) ($landingPage['seo'] ?? []), $index),
                'createdAt' => $this->validateOptionalDateTime($landingPage['createdAt'] ?? null) ?? (new DateTimeImmutable())->format(DateTimeInterface::ATOM),
                'updatedAt' => $this->validateOptionalDateTime($landingPage['updatedAt'] ?? null) ?? (new DateTimeImmutable())->format(DateTimeInterface::ATOM),
            ];
        }

        return array_values($validated);
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingHero(array $hero, int $landingIndex): array
    {
        return [
            'eyebrow' => $this->sanitizeString($hero['eyebrow'] ?? '', 60, "Landing {$landingIndex} > hero > eyebrow"),
            'title' => $this->sanitizeString($hero['title'] ?? '', 180, "Landing {$landingIndex} > hero > titulo"),
            'description' => $this->sanitizeString($hero['description'] ?? '', 420, "Landing {$landingIndex} > hero > descricao"),
            'primaryCtaLabel' => $this->sanitizeString($hero['primaryCtaLabel'] ?? '', 60, "Landing {$landingIndex} > hero > CTA primario"),
            'secondaryCtaLabel' => $this->sanitizeString($hero['secondaryCtaLabel'] ?? '', 60, "Landing {$landingIndex} > hero > CTA secundario"),
            'proof' => $this->sanitizeString($hero['proof'] ?? '', 180, "Landing {$landingIndex} > hero > prova"),
        ];
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingPlanCards(array $planCards, int $landingIndex): array
    {
        $validated = [];

        foreach ($planCards as $cardIndex => $planCard) {
            if (!is_array($planCard)) {
                continue;
            }

            $validated[] = [
                'id' => $this->sanitizeString($planCard['id'] ?? "plan-card-{$cardIndex}", 120, "Landing {$landingIndex} > card {$cardIndex} > id"),
                'title' => $this->sanitizeString($planCard['title'] ?? '', 90, "Landing {$landingIndex} > card {$cardIndex} > titulo"),
                'planName' => $this->validateLandingPlanName($planCard['planName'] ?? 'Gratuito'),
                'badge' => $this->sanitizeString($planCard['badge'] ?? '', 60, "Landing {$landingIndex} > card {$cardIndex} > selo", true),
                'description' => $this->sanitizeString($planCard['description'] ?? '', 220, "Landing {$landingIndex} > card {$cardIndex} > descricao"),
                'ctaLabel' => $this->sanitizeString($planCard['ctaLabel'] ?? '', 60, "Landing {$landingIndex} > card {$cardIndex} > CTA"),
                'featured' => isset($planCard['featured']) ? (bool) $planCard['featured'] : false,
                'summaryBenefits' => $this->validateLandingStringList($planCard['summaryBenefits'] ?? [], 8, 140, "Landing {$landingIndex} > card {$cardIndex} > beneficios"),
            ];
        }

        return $validated;
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingAuthoritySection(array $section, int $landingIndex): array
    {
        $items = [];
        foreach ((array) ($section['items'] ?? []) as $itemIndex => $item) {
            if (!is_array($item)) {
                continue;
            }

            $items[] = [
                'title' => $this->sanitizeString($item['title'] ?? '', 90, "Landing {$landingIndex} > autoridade > item {$itemIndex} > titulo"),
                'description' => $this->sanitizeString($item['description'] ?? '', 220, "Landing {$landingIndex} > autoridade > item {$itemIndex} > descricao"),
            ];
        }

        return [
            'eyebrow' => $this->sanitizeString($section['eyebrow'] ?? '', 60, "Landing {$landingIndex} > autoridade > eyebrow"),
            'title' => $this->sanitizeString($section['title'] ?? '', 140, "Landing {$landingIndex} > autoridade > titulo"),
            'description' => $this->sanitizeString($section['description'] ?? '', 280, "Landing {$landingIndex} > autoridade > descricao"),
            'items' => $items,
        ];
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingValueMatrix(array $matrix, int $landingIndex): array
    {
        return [
            'eyebrow' => $this->sanitizeString($matrix['eyebrow'] ?? '', 60, "Landing {$landingIndex} > valor > eyebrow"),
            'title' => $this->sanitizeString($matrix['title'] ?? '', 140, "Landing {$landingIndex} > valor > titulo"),
            'whatYouDo' => $this->validateLandingStringList($matrix['whatYouDo'] ?? [], 12, 120, "Landing {$landingIndex} > valor > o que faz"),
            'whatYouReceive' => $this->validateLandingStringList($matrix['whatYouReceive'] ?? [], 12, 120, "Landing {$landingIndex} > valor > o que recebe"),
            'whatYouConquer' => $this->validateLandingStringList($matrix['whatYouConquer'] ?? [], 12, 120, "Landing {$landingIndex} > valor > o que conquista"),
        ];
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingEliteSection(array $section, int $landingIndex): array
    {
        return [
            'eyebrow' => $this->sanitizeString($section['eyebrow'] ?? '', 60, "Landing {$landingIndex} > elite > eyebrow"),
            'title' => $this->sanitizeString($section['title'] ?? '', 140, "Landing {$landingIndex} > elite > titulo"),
            'description' => $this->sanitizeString($section['description'] ?? '', 280, "Landing {$landingIndex} > elite > descricao"),
            'bullets' => $this->validateLandingStringList($section['bullets'] ?? [], 12, 140, "Landing {$landingIndex} > elite > bullets"),
            'ctaLabel' => $this->sanitizeString($section['ctaLabel'] ?? '', 60, "Landing {$landingIndex} > elite > CTA"),
        ];
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingComparisonRows(array $rows, int $landingIndex): array
    {
        $validated = [];

        foreach ($rows as $rowIndex => $row) {
            if (!is_array($row)) {
                continue;
            }

            $values = is_array($row['values'] ?? null) ? $row['values'] : [];
            $validated[] = [
                'id' => $this->sanitizeString($row['id'] ?? "comparison-row-{$rowIndex}", 120, "Landing {$landingIndex} > comparacao {$rowIndex} > id"),
                'label' => $this->sanitizeString($row['label'] ?? '', 90, "Landing {$landingIndex} > comparacao {$rowIndex} > label"),
                'values' => [
                    'Gratuito' => $this->sanitizeString($values['Gratuito'] ?? '', 80, "Landing {$landingIndex} > comparacao {$rowIndex} > Gratuito", true),
                    'Essencial' => $this->sanitizeString($values['Essencial'] ?? '', 80, "Landing {$landingIndex} > comparacao {$rowIndex} > Essencial", true),
                    'Pro' => $this->sanitizeString($values['Pro'] ?? '', 80, "Landing {$landingIndex} > comparacao {$rowIndex} > Pro", true),
                    'Elite' => $this->sanitizeString($values['Elite'] ?? '', 80, "Landing {$landingIndex} > comparacao {$rowIndex} > Elite", true),
                ],
            ];
        }

        return $validated;
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingObjections(array $items, int $landingIndex): array
    {
        $validated = [];

        foreach ($items as $itemIndex => $item) {
            if (!is_array($item)) {
                continue;
            }

            $validated[] = [
                'title' => $this->sanitizeString($item['title'] ?? '', 90, "Landing {$landingIndex} > objecao {$itemIndex} > titulo"),
                'description' => $this->sanitizeString($item['description'] ?? '', 220, "Landing {$landingIndex} > objecao {$itemIndex} > descricao"),
            ];
        }

        return $validated;
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingGuarantee(array $guarantee, int $landingIndex): array
    {
        return [
            'title' => $this->sanitizeString($guarantee['title'] ?? '', 90, "Landing {$landingIndex} > garantia > titulo"),
            'description' => $this->sanitizeString($guarantee['description'] ?? '', 220, "Landing {$landingIndex} > garantia > descricao"),
        ];
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingFaq(array $items, int $landingIndex): array
    {
        $validated = [];

        foreach ($items as $itemIndex => $item) {
            if (!is_array($item)) {
                continue;
            }

            $validated[] = [
                'id' => $this->sanitizeString($item['id'] ?? "faq-{$itemIndex}", 120, "Landing {$landingIndex} > faq {$itemIndex} > id"),
                'question' => $this->sanitizeString($item['question'] ?? '', 150, "Landing {$landingIndex} > faq {$itemIndex} > pergunta"),
                'answer' => $this->sanitizeString($item['answer'] ?? '', 420, "Landing {$landingIndex} > faq {$itemIndex} > resposta"),
            ];
        }

        return $validated;
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingFinalCta(array $finalCta, int $landingIndex): array
    {
        return [
            'title' => $this->sanitizeString($finalCta['title'] ?? '', 140, "Landing {$landingIndex} > CTA final > titulo"),
            'description' => $this->sanitizeString($finalCta['description'] ?? '', 260, "Landing {$landingIndex} > CTA final > descricao"),
            'primaryCtaLabel' => $this->sanitizeString($finalCta['primaryCtaLabel'] ?? '', 60, "Landing {$landingIndex} > CTA final > primario"),
            'secondaryCtaLabel' => $this->sanitizeString($finalCta['secondaryCtaLabel'] ?? '', 60, "Landing {$landingIndex} > CTA final > secundario"),
        ];
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingSeo(array $seo, int $landingIndex): array
    {
        return [
            'title' => $this->sanitizeString($seo['title'] ?? '', 95, "Landing {$landingIndex} > SEO > title"),
            'metaDescription' => $this->sanitizeString($seo['metaDescription'] ?? '', 220, "Landing {$landingIndex} > SEO > description"),
            'canonicalUrl' => $this->validateOptionalUrl($seo['canonicalUrl'] ?? '', "Landing {$landingIndex} > SEO > canonical"),
            'ogTitle' => $this->sanitizeString($seo['ogTitle'] ?? '', 95, "Landing {$landingIndex} > SEO > OG title", true),
            'ogDescription' => $this->sanitizeString($seo['ogDescription'] ?? '', 220, "Landing {$landingIndex} > SEO > OG description", true),
        ];
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingStringList($items, int $maxItems, int $maxLength, string $fieldLabel): array
    {
        if (!is_array($items)) {
            return [];
        }

        $validated = [];
        foreach (array_slice($items, 0, $maxItems) as $index => $item) {
            $normalized = $this->sanitizeString($item ?? '', $maxLength, "{$fieldLabel} {$index}");
            if ($normalized !== '') {
                $validated[] = $normalized;
            }
        }

        return $validated;
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingPlanName($value): string
    {
        $normalized = trim((string) $value);
        if (!in_array($normalized, ['Gratuito', 'Essencial', 'Pro', 'Elite'], true)) {
            throw new InvalidArgumentException('Plano da landing invalido.');
        }

        return $normalized;
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingStatus($value): string
    {
        $normalized = trim((string) $value);
        if (!in_array($normalized, ['draft', 'published'], true)) {
            throw new InvalidArgumentException('Status da landing invalido.');
        }

        return $normalized;
    }

    /**
     * @since 1.0.0
     */
    private function validateLandingPageType($value): string
    {
        $normalized = trim((string) $value);
        if ($normalized !== 'plans') {
            throw new InvalidArgumentException('Tipo de landing invalido.');
        }

        return $normalized;
    }

    /**
     * @since 1.0.0
     */
    private function validateOptionalPositiveInteger($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $normalized = (int) $value;
        if ($normalized <= 0) {
            throw new InvalidArgumentException('linkedPlanId invalido.');
        }

        return $normalized;
    }

    /**
     * @since 1.0.0
     */
    private function validateOptionalDateTime($value): ?string
    {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            return null;
        }

        try {
            return (new DateTimeImmutable($normalized))->format(DateTimeInterface::ATOM);
        } catch (Throwable $error) {
            throw new InvalidArgumentException('Data de landing invalida.');
        }
    }

    /**
     * @since 1.0.0
     */
    private function sanitizeSlug($value, string $fieldLabel): string
    {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            throw new InvalidArgumentException("{$fieldLabel} e obrigatorio.");
        }

        $normalized = preg_replace('/[^a-z0-9-]+/', '-', strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $normalized) ?: $normalized));
        $normalized = trim((string) $normalized, '-');

        if ($normalized === '' || mb_strlen($normalized) > 120) {
            throw new InvalidArgumentException("{$fieldLabel} invalido.");
        }

        return $normalized;
    }

    /**
     * Sanitiza uma string curta de configuracao.
     *
     * @since 1.0.0
     */
    private function sanitizeString($value, int $maxLength, string $fieldLabel, bool $allowEmpty = false): string
    {
        $normalized = trim((string) $value);

        if ($normalized === '') {
            if ($allowEmpty) {
                return '';
            }

            throw new InvalidArgumentException("{$fieldLabel} e obrigatorio.");
        }

        if (mb_strlen($normalized) > $maxLength) {
            throw new InvalidArgumentException("{$fieldLabel} excede o limite de {$maxLength} caracteres.");
        }

        return $normalized;
    }

    private function normalizeBooleanValue($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value !== 0;
        }

        $normalized = strtolower(trim((string) $value));
        return in_array($normalized, ['1', 'true', 'yes', 'on', 'ativo', 'active'], true);
    }

    private function validateAdsensePublisherId($value): string
    {
        $normalized = $this->sanitizeString($value, 40, 'ID da conta AdSense', true);
        if ($normalized === '') {
            return '';
        }

        if (preg_match('/^ca-pub-\d{8,32}$/', $normalized) !== 1) {
            throw new InvalidArgumentException('ID da conta AdSense invalido. Use o formato ca-pub-0000000000000000.');
        }

        return $normalized;
    }

    private function validateAdsenseSlotId($value, string $fieldLabel): string
    {
        $normalized = $this->sanitizeString($value, 40, $fieldLabel, true);
        if ($normalized === '') {
            return '';
        }

        if (preg_match('/^[A-Za-z0-9_-]{4,40}$/', $normalized) !== 1) {
            throw new InvalidArgumentException("{$fieldLabel} invalido.");
        }

        return $normalized;
    }

    private function sanitizeLongSetting($value, int $maxLength, string $fieldLabel): string
    {
        $normalized = trim((string) $value);
        if (mb_strlen($normalized) > $maxLength) {
            throw new InvalidArgumentException("{$fieldLabel} excede o limite de {$maxLength} caracteres.");
        }

        return $normalized;
    }

    /**
     * Identifica placeholders de segredo enviados por clientes antigos.
     *
     * @since 1.0.0
     */
    private function isMaskedSecretValue($value): bool
    {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            return false;
        }

        return preg_match('/^[*•·xX_-]{6,}$/u', $normalized) === 1
            || preg_match('/^_+hidden_+$/i', $normalized) === 1
            || preg_match('/^__masked__/i', $normalized) === 1;
    }

    /**
     * Valida um e-mail opcional.
     *
     * @since 1.0.0
     */
    private function validateOptionalEmail($value, string $fieldLabel): string
    {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            return '';
        }

        if (filter_var($normalized, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException("{$fieldLabel} invalido.");
        }

        return $normalized;
    }

    /**
     * Valida uma URL opcional.
     *
     * @since 1.0.0
     */
    private function validateOptionalUrl($value, string $fieldLabel): string
    {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            return '';
        }

        if (filter_var($normalized, FILTER_VALIDATE_URL) === false) {
            throw new InvalidArgumentException("{$fieldLabel} invalido.");
        }

        return $normalized;
    }

    /**
     * Valida uma URL publica HTTP/HTTPS opcional.
     *
     * @since 1.0.0
     */
    private function validateOptionalHttpUrl($value, string $fieldLabel): string
    {
        $normalized = $this->validateOptionalUrl($value, $fieldLabel);
        if ($normalized === '') {
            return '';
        }

        $scheme = strtolower((string) (parse_url($normalized, PHP_URL_SCHEME) ?: ''));
        if (!in_array($scheme, ['http', 'https'], true)) {
            throw new InvalidArgumentException("{$fieldLabel} deve usar http ou https.");
        }

        return $normalized;
    }

    /**
     * Valida o App ID publico da Meta/Facebook.
     *
     * @since 1.0.0
     */
    private function validateFacebookAppId($value): string
    {
        $normalized = $this->sanitizeString($value, 120, 'Facebook App ID', true);
        if ($normalized === '') {
            return '';
        }

        if (preg_match('/^[0-9]{6,30}$/', $normalized) !== 1) {
            throw new InvalidArgumentException('Facebook App ID invalido.');
        }

        return $normalized;
    }

    /**
     * Valida o Service ID usado pelo Sign in with Apple na web.
     *
     * @since 1.0.0
     */
    private function validateAppleClientId($value): string
    {
        $normalized = $this->sanitizeString($value, 255, 'Apple Client ID', true);
        if ($normalized === '') {
            return '';
        }

        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9.-]{2,254}$/', $normalized) !== 1) {
            throw new InvalidArgumentException('Apple Client ID invalido.');
        }

        return $normalized;
    }

    /**
     * Valida redirect URI opcional da Apple sem permitir protocolos executaveis.
     *
     * @since 1.0.0
     */
    private function validateAppleRedirectUri($value): string
    {
        $normalized = $this->validateOptionalUrl($value, 'Apple Redirect URI');
        if ($normalized === '') {
            return '';
        }

        $scheme = strtolower((string) parse_url($normalized, PHP_URL_SCHEME));
        if (!in_array($scheme, ['https', 'http'], true)) {
            throw new InvalidArgumentException('Apple Redirect URI deve usar HTTP ou HTTPS.');
        }

        return $normalized;
    }

    /**
     * Valida uma politica robots suportada.
     *
     * @since 1.0.0
     */
    private function validateRobots($value, bool $allowEmpty): ?string
    {
        $normalized = trim((string) $value);

        if ($normalized === '') {
            return $allowEmpty ? null : 'index,follow';
        }

        if (!in_array($normalized, $this->allowedRobots, true)) {
            throw new InvalidArgumentException('Politica de robots invalida.');
        }

        return $normalized;
    }
}
