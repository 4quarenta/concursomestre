<?php

declare(strict_types=1);

/**
 * Contrato publico explicito das configuracoes usadas pelo navegador.
 *
 * A projecao e propositalmente allowlisted. Configuracoes administrativas,
 * diagnosticos, segredos, catalogos e dados de setup nunca devem atravessar
 * este limite, mesmo quando novas chaves forem adicionadas em system_settings.
 */
final class PublicSettingsProjection
{
    public const CONTRACT_VERSION = 'public-settings.v1';

    public static function project(array $settings): array
    {
        $landingPages = is_array($settings['landingPages'] ?? null)
            ? array_values(array_filter(
                $settings['landingPages'],
                static fn($page): bool => is_array($page) && (($page['status'] ?? 'draft') === 'published')
            ))
            : [];

        return [
            'contractVersion' => self::CONTRACT_VERSION,
            'branding' => self::pick($settings, [
                'appName',
                'siteName',
                'emailLogoUrl',
                'supportPhone',
                'legalContactEmail',
                'privacyContactEmail',
                'dailyMotivationMarkdown',
            ]),
            'features' => self::pick(
                is_array($settings['features'] ?? null) ? $settings['features'] : [],
                [
                    'practiceEnabled',
                    'marketplaceEnabled',
                    'rankingsEnabled',
                    'referralEnabled',
                    'annotatedLawsEnabled',
                    'flashcardsEnabled',
                    'communityEnabled',
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
                    'sameTierCycleChangeEnabled',
                ]
            ),
            'plans' => self::pick($settings, [
                'pricing',
                'planDetails',
                'planEntitlements',
                'planUsageLimits',
            ]),
            'commerce' => self::pick($settings, [
                'paymentProvider',
                'paymentCheckoutMode',
                'cardVaultProvider',
                'stripePaymentMethods',
                'stripePublishableKey',
            ]),
            'marketing' => array_merge(
                self::pick($settings, [
                    'activeTheme',
                    'activePromotion',
                    'limitedOfferCountdown',
                    'landingPageContent',
                ]),
                [
                    'landingPages' => $landingPages,
                    'coupons' => self::publicAutoCoupons($settings['coupons'] ?? []),
                ]
            ),
            'advertising' => self::pick($settings, [
                'adsEnabled',
                'adsenseTestMode',
                'adsenseClientId',
                'adsTxtContent',
                'adsenseTopSlotId',
                'adsenseSidebarSlotId',
                'adsenseBottomSlotId',
                'adPlacementTopEnabled',
                'adPlacementSidebarEnabled',
                'adPlacementBottomEnabled',
                'adPlacementInterstitialEnabled',
                'adPlacementNavigationPopEnabled',
                'adBannerTop',
                'adBannerSidebar',
                'adBannerBottom',
                'adInterstitialSlotId',
                'adNavigationPopUrl',
            ]),
            'authentication' => [
                'recaptcha' => self::rename($settings, [
                    'recaptchaEnabled' => 'enabled',
                    'recaptchaSiteKey' => 'siteKey',
                ]),
                'google' => self::rename($settings, [
                    'googleAuthClientId' => 'clientId',
                ]),
                'facebook' => self::rename($settings, [
                    'facebookAuthAppId' => 'appId',
                ]),
                'apple' => self::rename($settings, [
                    'appleAuthClientId' => 'clientId',
                    'appleAuthRedirectUri' => 'redirectUri',
                ]),
            ],
            'analytics' => self::pick($settings, [
                'googleAnalyticsId',
                'facebookAdsId',
                'metaPixelId',
            ]),
            'content' => self::pick($settings, [
                'legalCommentaryFeatureConfig',
            ]),
            'engagement' => self::pick($settings, [
                'gamification',
                'notificationSettings',
            ]),
        ];
    }

    private static function pick(array $source, array $keys): array
    {
        $result = [];
        foreach ($keys as $key) {
            if (array_key_exists($key, $source)) {
                $result[$key] = $source[$key];
            }
        }
        return $result;
    }

    private static function rename(array $source, array $mapping): array
    {
        $result = [];
        foreach ($mapping as $sourceKey => $targetKey) {
            if (array_key_exists($sourceKey, $source)) {
                $result[$targetKey] = $source[$sourceKey];
            }
        }
        return $result;
    }

    /**
     * Publica somente campanhas automaticas que podem ser exibidas sem
     * conhecer o usuario. Audiencias privadas permanecem exclusivamente no
     * contrato administrativo e na validacao autoritativa do checkout.
     */
    private static function publicAutoCoupons(mixed $coupons): array
    {
        if (!is_array($coupons)) {
            return [];
        }

        $now = time();
        $result = [];
        foreach ($coupons as $coupon) {
            if (!is_array($coupon) || !self::toBoolean($coupon['autoApply'] ?? $coupon['auto_apply'] ?? false)) {
                continue;
            }

            $restrictedIds = $coupon['allowedUserIds'] ?? $coupon['allowed_user_ids'] ?? [];
            $restrictedEmails = $coupon['allowedUserEmails'] ?? $coupon['allowed_user_emails'] ?? [];
            if (
                self::toBoolean($coupon['newUsersOnly'] ?? $coupon['new_users_only'] ?? false)
                || self::toBoolean($coupon['firstPurchaseOnly'] ?? $coupon['first_purchase_only'] ?? false)
                || self::hasAudience($restrictedIds)
                || self::hasAudience($restrictedEmails)
            ) {
                continue;
            }

            $expiresAt = trim((string) ($coupon['expiresAt'] ?? $coupon['expires_at'] ?? ''));
            if ($expiresAt !== '') {
                $expiresTimestamp = strtotime($expiresAt);
                if ($expiresTimestamp !== false && $expiresTimestamp < $now) {
                    continue;
                }
            }

            $maxUses = max(0, (int) ($coupon['maxUses'] ?? $coupon['max_uses'] ?? 0));
            $uses = max(0, (int) ($coupon['uses'] ?? $coupon['used_count'] ?? 0));
            if ($maxUses > 0 && $uses >= $maxUses) {
                continue;
            }

            $publicCoupon = self::pick($coupon, [
                'code',
                'discountPercentage',
                'discountAmount',
                'expiresAt',
                'targetType',
                'targetId',
            ]);
            $publicCoupon['autoApply'] = true;
            $result[] = $publicCoupon;
        }

        return $result;
    }

    private static function hasAudience(mixed $value): bool
    {
        if (is_array($value)) {
            return count(array_filter($value, static fn($item): bool => trim((string) $item) !== '')) > 0;
        }

        return trim((string) $value) !== '';
    }

    private static function toBoolean(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value) || is_float($value)) {
            return (int) $value === 1;
        }
        if (is_string($value)) {
            return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true);
        }

        return false;
    }
}
