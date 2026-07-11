<?php

require_once __DIR__ . '/../shared/database/SchemaReadiness.php';

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

require_once __DIR__ . '/env.php';

function normalizePaymentProvider(?string $provider): string
{
    $normalized = strtolower(trim((string) $provider));

    if (in_array($normalized, ['manual_admin', 'admin_manual', 'manual'], true)) {
        return 'manual_admin';
    }

    if (in_array($normalized, ['stripe'], true)) {
        return 'stripe';
    }

    if (in_array($normalized, ['mercado_pago', 'mercadopago', 'mercado livre', 'mercado_livre', 'mercado pago'], true)) {
        return 'mercado_pago';
    }

    return 'stripe';
}

function isChargeablePaymentProvider(?string $provider): bool
{
    return in_array(normalizePaymentProvider($provider), ['stripe', 'mercado_pago'], true);
}

function paymentProviderSupportsRemoteCancellation(?string $provider): bool
{
    return normalizePaymentProvider($provider) === 'stripe';
}

function normalizePaymentCheckoutMode(?string $mode): string
{
    $normalized = strtolower(trim((string) $mode));

    if (in_array($normalized, ['redirect', 'hosted', 'external'], true)) {
        return 'redirect';
    }

    return 'internal';
}

function normalizeCardVaultProvider(?string $provider): string
{
    $normalized = strtolower(trim((string) $provider));

    return $normalized === 'local' ? 'stripe' : 'stripe';
}

function getSystemSettingValue(PDO $db, string $key, $default = null)
{
    $stmt = $db->prepare("SELECT value_json FROM system_settings WHERE key_name = :key LIMIT 1");
    $stmt->execute([':key' => $key]);
    $value = $stmt->fetchColumn();

    if ($value === false) {
        return $default;
    }

    $decoded = json_decode($value, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        return $decoded;
    }

    return $value;
}

function getConfiguredPaymentProvider(PDO $db): string
{
    $setting = getSystemSettingValue($db, 'paymentProvider', 'stripe');
    return normalizePaymentProvider(is_string($setting) ? $setting : 'stripe');
}

function getConfiguredPaymentCheckoutMode(PDO $db): string
{
    $setting = getSystemSettingValue($db, 'paymentCheckoutMode', 'internal');
    return normalizePaymentCheckoutMode(is_string($setting) ? $setting : 'internal');
}

function getConfiguredCardVaultProvider(PDO $db): string
{
    $setting = getSystemSettingValue($db, 'cardVaultProvider', 'stripe');
    return normalizeCardVaultProvider(is_string($setting) ? $setting : 'stripe');
}

function defaultStripePaymentMethodsConfig(): array
{
    return [
        'methods' => [
            [
                'id' => 'card',
                'label' => 'Cartão',
                'stripeType' => 'card',
                'enabled' => true,
                'checkoutSupported' => true,
                'recurringSupported' => true,
                'removable' => false,
                'description' => 'Cartão de crédito via Stripe. Método principal do checkout interno e da recorrência.',
            ],
            [
                'id' => 'pix',
                'label' => 'PIX',
                'stripeType' => 'pix',
                'enabled' => false,
                'checkoutSupported' => true,
                'recurringSupported' => false,
                'removable' => false,
                'description' => 'PIX depende de capability ativa na Stripe e não substitui a recorrência por cartão.',
            ],
            [
                'id' => 'boleto',
                'label' => 'Boleto',
                'stripeType' => 'boleto',
                'enabled' => false,
                'checkoutSupported' => false,
                'recurringSupported' => false,
                'removable' => false,
                'description' => 'Disponível na Stripe para fluxos compatíveis, mas não está implementado no checkout interno de assinatura.',
            ],
            [
                'id' => 'apple_pay',
                'label' => 'Apple Pay',
                'stripeType' => 'card_wallet',
                'enabled' => false,
                'checkoutSupported' => false,
                'recurringSupported' => false,
                'removable' => false,
                'description' => 'Carteira Stripe baseada em cartão. Requer Payment Element ou fluxo wallet compatível.',
            ],
            [
                'id' => 'google_pay',
                'label' => 'Google Pay',
                'stripeType' => 'card_wallet',
                'enabled' => false,
                'checkoutSupported' => false,
                'recurringSupported' => false,
                'removable' => false,
                'description' => 'Carteira Stripe baseada em cartão. Requer Payment Element ou fluxo wallet compatível.',
            ],
        ],
    ];
}

function normalizeStripePaymentMethodId($value): string
{
    $normalized = strtolower(trim((string) $value));
    $normalized = preg_replace('/[^a-z0-9_:-]+/', '_', $normalized) ?: '';

    return $normalized;
}

function normalizeStripePaymentMethodsConfig($config): array
{
    $defaults = defaultStripePaymentMethodsConfig();
    $incomingMethods = is_array($config) && isset($config['methods']) && is_array($config['methods'])
        ? $config['methods']
        : [];
    $incomingById = [];

    foreach ($incomingMethods as $method) {
        if (!is_array($method)) {
            continue;
        }

        $id = normalizeStripePaymentMethodId($method['id'] ?? '');
        if ($id !== '') {
            $incomingById[$id] = $method;
        }
    }

    $normalizedMethods = [];
    $defaultIds = [];
    foreach ($defaults['methods'] as $defaultMethod) {
        $id = (string) $defaultMethod['id'];
        $defaultIds[] = $id;
        $method = $incomingById[$id] ?? [];
        $normalizedMethods[] = [
            'id' => $id,
            'label' => trim((string) ($method['label'] ?? $defaultMethod['label'])),
            'stripeType' => trim((string) ($method['stripeType'] ?? $defaultMethod['stripeType'])),
            'enabled' => array_key_exists('enabled', $method) ? (bool) $method['enabled'] : (bool) $defaultMethod['enabled'],
            'checkoutSupported' => array_key_exists('checkoutSupported', $method) ? (bool) $method['checkoutSupported'] : (bool) $defaultMethod['checkoutSupported'],
            'recurringSupported' => array_key_exists('recurringSupported', $method) ? (bool) $method['recurringSupported'] : (bool) $defaultMethod['recurringSupported'],
            'removable' => false,
            'description' => trim((string) ($method['description'] ?? $defaultMethod['description'])),
        ];
    }

    foreach ($incomingMethods as $method) {
        if (!is_array($method)) {
            continue;
        }

        $id = normalizeStripePaymentMethodId($method['id'] ?? '');
        if ($id === '' || in_array($id, $defaultIds, true)) {
            continue;
        }

        $label = trim((string) ($method['label'] ?? ''));
        $stripeType = trim((string) ($method['stripeType'] ?? ''));
        if ($label === '' || $stripeType === '') {
            continue;
        }

        $normalizedMethods[] = [
            'id' => $id,
            'label' => substr($label, 0, 80),
            'stripeType' => substr($stripeType, 0, 60),
            'enabled' => !empty($method['enabled']),
            'checkoutSupported' => !empty($method['checkoutSupported']),
            'recurringSupported' => !empty($method['recurringSupported']),
            'removable' => true,
            'description' => substr(trim((string) ($method['description'] ?? 'Método customizado.')), 0, 240),
        ];
    }

    return ['methods' => $normalizedMethods];
}

function getConfiguredStripePaymentMethods(PDO $db): array
{
    $setting = getSystemSettingValue($db, 'stripePaymentMethods', defaultStripePaymentMethodsConfig());
    return normalizeStripePaymentMethodsConfig($setting);
}

function isStripePaymentMethodEnabled(PDO $db, string $methodId): bool
{
    $normalizedMethodId = normalizeStripePaymentMethodId($methodId);
    foreach (getConfiguredStripePaymentMethods($db)['methods'] as $method) {
        if (($method['id'] ?? '') === $normalizedMethodId) {
            return !empty($method['enabled']);
        }
    }

    return false;
}

function getPlatformFeePercent(PDO $db): float
{
    $configured = getSystemSettingValue($db, 'platformFeePercent', 20);
    $value = is_numeric($configured) ? (float) $configured : 20.0;

    if ($value < 0) {
        return 0.0;
    }

    if ($value > 100) {
        return 100.0;
    }

    return $value;
}

function canonicalUserPlanValue(?string $planName): string
{
    $normalized = strtolower(trim((string) $planName));

    if ($normalized === '') {
        return 'Gratuito';
    }

    if (strpos($normalized, 'elite') !== false) {
        return 'Elite';
    }

    if (strpos($normalized, 'pro') !== false) {
        return 'Pro';
    }

    if (strpos($normalized, 'essencial') !== false) {
        return 'Essencial';
    }

    if (strpos($normalized, 'gratuito') !== false || strpos($normalized, 'free') !== false) {
        return 'Gratuito';
    }

    return 'Gratuito';
}

function canonicalPlanTier(?string $planName, $fallbackTier = null): int
{
    $canonical = canonicalUserPlanValue($planName);

    switch ($canonical) {
        case 'Elite':
            return 4;
        case 'Pro':
            return 3;
        case 'Essencial':
            return 2;
        case 'Gratuito':
            return 1;
    }

    if (is_numeric($fallbackTier)) {
        $tier = (int) $fallbackTier;

        if ($tier >= 1 && $tier <= 4) {
            return $tier;
        }

        if ($tier >= 0 && $tier <= 3) {
            return $tier + 1;
        }
    }

    return 1;
}

function billingCycleFromInterval(?string $intervalUnit, $intervalCount = null): string
{
    $unit = strtolower(trim((string) $intervalUnit));
    $count = is_numeric($intervalCount) ? (int) $intervalCount : 1;

    if ($unit === 'year' || ($unit === 'month' && $count >= 12)) {
        return 'annual';
    }

    if ($unit === 'month' && $count === 3) {
        return 'quarterly';
    }

    return 'monthly';
}

function hasActivePlanAccess(?string $status): bool
{
    $normalized = strtolower(trim((string) $status));
    return in_array($normalized, ['active', 'trialing'], true);
}

function defaultPlanEntitlements(): array
{
    $defaults = [
        'Gratuito' => [
            'unlimited_questions' => ['enabled' => true],
            'basic_statistics' => ['enabled' => true],
            'community_comments' => ['enabled' => true],
            'no_ads' => ['enabled' => false],
            'teacher_comments' => ['enabled' => false],
            'detailed_analysis' => ['enabled' => false],
            'ai_explanations' => ['enabled' => false],
            'error_notebook' => ['enabled' => false],
            'exclusive_simulations' => ['enabled' => false],
            'xray_banca' => ['enabled' => false],
            'mentor_chat' => ['enabled' => false],
            'priority_support' => ['enabled' => false],
            'early_access' => ['enabled' => false],
            'lei.comentario_basico' => ['enabled' => true],
            'lei.doutrina' => ['enabled' => false],
            'lei.macete' => ['enabled' => false],
            'lei.como_cai' => ['enabled' => false],
            'lei.jurisprudencia' => ['enabled' => false],
            'lei.sumulas' => ['enabled' => false],
            'lei.frequencia' => ['enabled' => false],
            'lei.questoes' => ['enabled' => false],
            'lei.flashcards' => ['enabled' => false],
            'lei.raiox' => ['enabled' => false],
            'lei.anotacoes' => ['enabled' => false],
            'lei.conexoes' => ['enabled' => false],
            'lei.modo_foco' => ['enabled' => true],
            'lei.favoritos' => ['enabled' => false],
            'lei.solicitar_comentario' => ['enabled' => false],
        ],
        'Essencial' => [
            'unlimited_questions' => ['enabled' => true],
            'basic_statistics' => ['enabled' => true],
            'community_comments' => ['enabled' => true],
            'no_ads' => ['enabled' => true],
            'teacher_comments' => ['enabled' => false],
            'detailed_analysis' => ['enabled' => false],
            'ai_explanations' => ['enabled' => false],
            'error_notebook' => ['enabled' => false],
            'exclusive_simulations' => ['enabled' => false],
            'xray_banca' => ['enabled' => false],
            'mentor_chat' => ['enabled' => false],
            'priority_support' => ['enabled' => false],
            'early_access' => ['enabled' => false],
            'lei.comentario_basico' => ['enabled' => true],
            'lei.doutrina' => ['enabled' => false],
            'lei.macete' => ['enabled' => false],
            'lei.como_cai' => ['enabled' => false],
            'lei.jurisprudencia' => ['enabled' => false],
            'lei.sumulas' => ['enabled' => false],
            'lei.frequencia' => ['enabled' => false],
            'lei.questoes' => ['enabled' => false],
            'lei.flashcards' => ['enabled' => false],
            'lei.raiox' => ['enabled' => false],
            'lei.anotacoes' => ['enabled' => false],
            'lei.conexoes' => ['enabled' => false],
            'lei.modo_foco' => ['enabled' => true],
            'lei.favoritos' => ['enabled' => true],
            'lei.solicitar_comentario' => ['enabled' => true],
        ],
        'Pro' => [
            'unlimited_questions' => ['enabled' => true],
            'basic_statistics' => ['enabled' => true],
            'community_comments' => ['enabled' => true],
            'no_ads' => ['enabled' => true],
            'teacher_comments' => ['enabled' => true],
            'detailed_analysis' => ['enabled' => false],
            'ai_explanations' => ['enabled' => true],
            'error_notebook' => ['enabled' => true],
            'exclusive_simulations' => ['enabled' => true],
            'xray_banca' => ['enabled' => false],
            'mentor_chat' => ['enabled' => false],
            'priority_support' => ['enabled' => false],
            'early_access' => ['enabled' => false],
            'lei.comentario_basico' => ['enabled' => true],
            'lei.doutrina' => ['enabled' => true],
            'lei.macete' => ['enabled' => false],
            'lei.como_cai' => ['enabled' => true],
            'lei.jurisprudencia' => ['enabled' => false],
            'lei.sumulas' => ['enabled' => false],
            'lei.frequencia' => ['enabled' => false],
            'lei.questoes' => ['enabled' => true],
            'lei.flashcards' => ['enabled' => false],
            'lei.raiox' => ['enabled' => false],
            'lei.anotacoes' => ['enabled' => true],
            'lei.conexoes' => ['enabled' => false],
            'lei.modo_foco' => ['enabled' => true],
            'lei.favoritos' => ['enabled' => true],
            'lei.solicitar_comentario' => ['enabled' => true],
        ],
        'Elite' => [
            'unlimited_questions' => ['enabled' => true],
            'basic_statistics' => ['enabled' => true],
            'community_comments' => ['enabled' => true],
            'no_ads' => ['enabled' => true],
            'teacher_comments' => ['enabled' => true],
            'detailed_analysis' => ['enabled' => true],
            'ai_explanations' => ['enabled' => true],
            'error_notebook' => ['enabled' => true],
            'exclusive_simulations' => ['enabled' => true],
            'xray_banca' => ['enabled' => true],
            'mentor_chat' => ['enabled' => true],
            'priority_support' => ['enabled' => true],
            'early_access' => ['enabled' => true],
            'lei.comentario_basico' => ['enabled' => true],
            'lei.doutrina' => ['enabled' => true],
            'lei.macete' => ['enabled' => true],
            'lei.como_cai' => ['enabled' => true],
            'lei.jurisprudencia' => ['enabled' => true],
            'lei.sumulas' => ['enabled' => true],
            'lei.frequencia' => ['enabled' => true],
            'lei.questoes' => ['enabled' => true],
            'lei.flashcards' => ['enabled' => true],
            'lei.raiox' => ['enabled' => true],
            'lei.anotacoes' => ['enabled' => true],
            'lei.conexoes' => ['enabled' => true],
            'lei.modo_foco' => ['enabled' => true],
            'lei.favoritos' => ['enabled' => true],
            'lei.solicitar_comentario' => ['enabled' => true],
        ],
    ];

    $granularBenefitKeys = [
        'module.dashboard',
        'module.practice',
        'module.lei_comentada',
        'module.flashcards',
        'module.simulations',
        'module.xray',
        'module.schedule',
        'module.marketplace',
        'practice.filter_keyword',
        'practice.filter_subject',
        'practice.filter_difficulty',
        'practice.filter_bank',
        'practice.filter_organization',
        'practice.filter_year',
        'practice.filter_level',
        'practice.filter_role',
        'practice.filter_modality',
        'practice.filter_topic',
        'practice.filter_saved',
        'practice.filter_teacher_comment',
        'practice.filter_detailed_analysis',
        'practice.filter_answered_correct',
        'practice.filter_answered_wrong',
        'question.resolve',
        'question.answer_key',
        'question.detailed_analysis',
        'question.save',
        'question.notes',
        'question.share',
        'question.full_statistics',
        'ads.adsense_banner',
        'ads.facebook_banner',
        'ads.between_questions',
        'ads.in_comments',
        'ads.web_interstitial',
        'ads.navigation_pop',
        'ads.internal_sponsorships',
        'ads.reduced',
        'lei.comentario_basico',
        'lei.doutrina',
        'lei.macete',
        'lei.como_cai',
        'lei.jurisprudencia',
        'lei.sumulas',
        'lei.questoes',
        'lei.raiox',
        'lei.anotacoes',
        'lei.modo_foco',
        'lei.favoritos',
        'lei.solicitar_comentario',
    ];

    foreach ($defaults as $planName => $planDefaults) {
        foreach ($granularBenefitKeys as $benefitKey) {
            $defaults[$planName][$benefitKey] = ['enabled' => false];
        }
    }

    $enabledByPlan = [
        'Gratuito' => [
            'module.practice',
            'module.lei_comentada',
            'module.simulations',
            'module.marketplace',
            'practice.filter_keyword',
            'practice.filter_subject',
            'practice.filter_difficulty',
            'practice.filter_bank',
            'question.resolve',
            'question.answer_key',
            'teacher_comments',
            'lei.comentario_basico',
            'lei.modo_foco',
            'ads.adsense_banner',
            'ads.facebook_banner',
            'ads.between_questions',
            'ads.in_comments',
            'ads.web_interstitial',
            'ads.navigation_pop',
            'ads.internal_sponsorships',
        ],
        'Essencial' => [
            'module.practice',
            'module.lei_comentada',
            'module.simulations',
            'module.marketplace',
            'practice.filter_keyword',
            'practice.filter_subject',
            'practice.filter_difficulty',
            'practice.filter_bank',
            'practice.filter_organization',
            'practice.filter_year',
            'practice.filter_level',
            'practice.filter_role',
            'practice.filter_modality',
            'practice.filter_topic',
            'practice.filter_saved',
            'practice.filter_teacher_comment',
            'practice.filter_answered_correct',
            'practice.filter_answered_wrong',
            'question.resolve',
            'question.answer_key',
            'teacher_comments',
            'question.save',
            'question.notes',
            'question.share',
            'question.full_statistics',
            'lei.comentario_basico',
            'lei.modo_foco',
            'lei.favoritos',
            'lei.solicitar_comentario',
            'ads.adsense_banner',
            'ads.facebook_banner',
            'ads.internal_sponsorships',
            'ads.reduced',
        ],
        'Pro' => [
            'module.practice',
            'module.lei_comentada',
            'module.flashcards',
            'module.simulations',
            'module.marketplace',
            'practice.filter_keyword',
            'practice.filter_subject',
            'practice.filter_difficulty',
            'practice.filter_bank',
            'practice.filter_organization',
            'practice.filter_year',
            'practice.filter_level',
            'practice.filter_role',
            'practice.filter_modality',
            'practice.filter_topic',
            'practice.filter_saved',
            'practice.filter_teacher_comment',
            'practice.filter_detailed_analysis',
            'practice.filter_answered_correct',
            'practice.filter_answered_wrong',
            'question.resolve',
            'question.answer_key',
            'teacher_comments',
            'question.detailed_analysis',
            'question.save',
            'question.notes',
            'question.share',
            'question.full_statistics',
            'lei.comentario_basico',
            'lei.doutrina',
            'lei.macete',
            'lei.como_cai',
            'lei.questoes',
            'lei.anotacoes',
            'lei.modo_foco',
            'lei.favoritos',
            'lei.solicitar_comentario',
        ],
        'Elite' => array_values(array_filter($granularBenefitKeys, static fn($benefitKey) => strpos($benefitKey, 'ads.') !== 0)),
    ];

    foreach ($enabledByPlan as $planName => $benefitKeys) {
        foreach ($benefitKeys as $benefitKey) {
            $defaults[$planName][$benefitKey] = ['enabled' => true];
        }
    }

    $defaults['Essencial']['no_ads'] = ['enabled' => false];
    $defaults['Essencial']['teacher_comments'] = ['enabled' => true];
    $defaults['Essencial']['error_notebook'] = ['enabled' => true];
    $defaults['Pro']['detailed_analysis'] = ['enabled' => true];

    return $defaults;
}

function normalizePlanEntitlementsConfig($rawEntitlements): array
{
    $defaults = defaultPlanEntitlements();

    if (!is_array($rawEntitlements)) {
        return $defaults;
    }

    foreach ($rawEntitlements as $planName => &$planEntitlements) {
        if (!is_array($planEntitlements) || !array_key_exists('question.basic_explanation', $planEntitlements)) {
            continue;
        }

        $legacyValue = $planEntitlements['question.basic_explanation'];
        $legacyEnabled = is_bool($legacyValue) ? $legacyValue : !empty($legacyValue['enabled']);
        $currentTeacherValue = $planEntitlements['teacher_comments'] ?? null;
        $currentTeacherEnabled = is_bool($currentTeacherValue)
            ? $currentTeacherValue
            : (!empty($currentTeacherValue['enabled']));

        if ($legacyEnabled && !$currentTeacherEnabled) {
            $planEntitlements['teacher_comments'] = ['enabled' => true];
        }

        unset($planEntitlements['question.basic_explanation']);
    }
    unset($planEntitlements);

    foreach ($defaults as $planName => $planBenefits) {
        if (!isset($rawEntitlements[$planName]) || !is_array($rawEntitlements[$planName])) {
            $rawEntitlements[$planName] = $planBenefits;
            continue;
        }

        foreach ($planBenefits as $benefitKey => $defaultValue) {
            if (!array_key_exists($benefitKey, $rawEntitlements[$planName])) {
                $rawEntitlements[$planName][$benefitKey] = $defaultValue;
                continue;
            }

            $rawValue = $rawEntitlements[$planName][$benefitKey];
            if (is_bool($rawValue)) {
                $rawEntitlements[$planName][$benefitKey] = ['enabled' => $rawValue];
                continue;
            }

            $rawEntitlements[$planName][$benefitKey] = [
                'enabled' => !empty($rawValue['enabled']),
            ];
        }
    }

    return $rawEntitlements;
}

function defaultPlanUsageLimits(): array
{
    return [
        'Gratuito' => [
            'questions_per_day' => ['mode' => 'limited', 'value' => 20],
            'comments_per_day' => ['mode' => 'limited', 'value' => 3],
            'simulations_per_week' => ['mode' => 'limited', 'value' => 1],
            'simulations_per_month' => ['mode' => 'limited', 'value' => 1],
            'ai_explanations_per_day' => ['mode' => 'limited', 'value' => 0],
            'saved_questions_limit' => ['mode' => 'limited', 'value' => 50],
            'lei_related_questions_limit' => ['mode' => 'limited', 'value' => 0],
            'lei_flashcards_limit' => ['mode' => 'limited', 'value' => 0],
            'lei_annotations_limit' => ['mode' => 'limited', 'value' => 0],
            'lei_favorites_limit' => ['mode' => 'limited', 'value' => 0],
            'ad_interstitial_answer_interval' => ['mode' => 'limited', 'value' => 1],
        ],
        'Essencial' => [
            'questions_per_day' => ['mode' => 'unlimited', 'value' => null],
            'comments_per_day' => ['mode' => 'limited', 'value' => 10],
            'simulations_per_week' => ['mode' => 'limited', 'value' => 5],
            'simulations_per_month' => ['mode' => 'limited', 'value' => 5],
            'ai_explanations_per_day' => ['mode' => 'limited', 'value' => 0],
            'saved_questions_limit' => ['mode' => 'limited', 'value' => 200],
            'lei_related_questions_limit' => ['mode' => 'limited', 'value' => 0],
            'lei_flashcards_limit' => ['mode' => 'limited', 'value' => 0],
            'lei_annotations_limit' => ['mode' => 'limited', 'value' => 0],
            'lei_favorites_limit' => ['mode' => 'limited', 'value' => 25],
            'ad_interstitial_answer_interval' => ['mode' => 'limited', 'value' => 0],
        ],
        'Pro' => [
            'questions_per_day' => ['mode' => 'unlimited', 'value' => null],
            'comments_per_day' => ['mode' => 'unlimited', 'value' => null],
            'simulations_per_week' => ['mode' => 'unlimited', 'value' => null],
            'simulations_per_month' => ['mode' => 'unlimited', 'value' => null],
            'ai_explanations_per_day' => ['mode' => 'limited', 'value' => 25],
            'saved_questions_limit' => ['mode' => 'limited', 'value' => 1000],
            'lei_related_questions_limit' => ['mode' => 'unlimited', 'value' => null],
            'lei_flashcards_limit' => ['mode' => 'limited', 'value' => 0],
            'lei_annotations_limit' => ['mode' => 'limited', 'value' => 100],
            'lei_favorites_limit' => ['mode' => 'limited', 'value' => 100],
            'ad_interstitial_answer_interval' => ['mode' => 'limited', 'value' => 0],
        ],
        'Elite' => [
            'questions_per_day' => ['mode' => 'unlimited', 'value' => null],
            'comments_per_day' => ['mode' => 'unlimited', 'value' => null],
            'simulations_per_week' => ['mode' => 'unlimited', 'value' => null],
            'simulations_per_month' => ['mode' => 'unlimited', 'value' => null],
            'ai_explanations_per_day' => ['mode' => 'unlimited', 'value' => null],
            'saved_questions_limit' => ['mode' => 'unlimited', 'value' => null],
            'lei_related_questions_limit' => ['mode' => 'unlimited', 'value' => null],
            'lei_flashcards_limit' => ['mode' => 'unlimited', 'value' => null],
            'lei_annotations_limit' => ['mode' => 'unlimited', 'value' => null],
            'lei_favorites_limit' => ['mode' => 'unlimited', 'value' => null],
            'ad_interstitial_answer_interval' => ['mode' => 'limited', 'value' => 0],
        ],
    ];
}

function defaultLegalCommentaryFeatureConfig(): array
{
    return [
        'lei.comentario_basico' => ['fallbackMode' => 'preview'],
        'lei.doutrina' => ['fallbackMode' => 'preview'],
        'lei.macete' => ['fallbackMode' => 'preview'],
        'lei.como_cai' => ['fallbackMode' => 'preview'],
        'lei.jurisprudencia' => ['fallbackMode' => 'preview'],
        'lei.sumulas' => ['fallbackMode' => 'preview'],
        'lei.frequencia' => ['fallbackMode' => 'locked'],
        'lei.questoes' => ['fallbackMode' => 'preview'],
        'lei.flashcards' => ['fallbackMode' => 'preview'],
        'lei.raiox' => ['fallbackMode' => 'locked'],
        'lei.anotacoes' => ['fallbackMode' => 'locked'],
        'lei.conexoes' => ['fallbackMode' => 'preview'],
        'lei.modo_foco' => ['fallbackMode' => 'locked'],
        'lei.favoritos' => ['fallbackMode' => 'locked'],
        'lei.solicitar_comentario' => ['fallbackMode' => 'locked'],
    ];
}

function normalizeLegalCommentaryFeatureConfig($rawConfig): array
{
    $defaults = defaultLegalCommentaryFeatureConfig();

    if (!is_array($rawConfig)) {
        return $defaults;
    }

    foreach ($defaults as $featureKey => $defaultValue) {
        $incoming = $rawConfig[$featureKey] ?? null;
        $fallbackMode = is_array($incoming) ? (string) ($incoming['fallbackMode'] ?? '') : '';

        if (!in_array($fallbackMode, ['preview', 'locked', 'hidden'], true)) {
            $fallbackMode = (string) $defaultValue['fallbackMode'];
        }

        $defaults[$featureKey] = [
            'fallbackMode' => $fallbackMode,
        ];
    }

    return $defaults;
}

function normalizePlanUsageLimitsConfig($rawLimits): array
{
    $defaults = defaultPlanUsageLimits();

    if (!is_array($rawLimits)) {
        return $defaults;
    }

    foreach ($defaults as $planName => $planLimits) {
        if (!isset($rawLimits[$planName]) || !is_array($rawLimits[$planName])) {
            $rawLimits[$planName] = $planLimits;
            continue;
        }

        foreach ($planLimits as $limitKey => $defaultValue) {
            if (!array_key_exists($limitKey, $rawLimits[$planName]) || !is_array($rawLimits[$planName][$limitKey])) {
                $rawLimits[$planName][$limitKey] = $defaultValue;
                continue;
            }

            $mode = (($rawLimits[$planName][$limitKey]['mode'] ?? '') === 'limited') ? 'limited' : 'unlimited';
            $rawLimits[$planName][$limitKey] = [
                'mode' => $mode,
                'value' => $mode === 'limited'
                    ? max(0, (int) ($rawLimits[$planName][$limitKey]['value'] ?? 0))
                    : null,
            ];
        }
    }

    return $rawLimits;
}

function getConfiguredPlanEntitlements(PDO $db): array
{
    $setting = getSystemSettingValue($db, 'planEntitlements', null);
    return normalizePlanEntitlementsConfig(is_array($setting) ? $setting : null);
}

function getConfiguredPlanUsageLimits(PDO $db): array
{
    $setting = getSystemSettingValue($db, 'planUsageLimits', null);
    return normalizePlanUsageLimitsConfig(is_array($setting) ? $setting : null);
}

function getConfiguredLegalCommentaryFeatureConfig(PDO $db): array
{
    $setting = getSystemSettingValue($db, 'legalCommentaryFeatureConfig', null);
    return normalizeLegalCommentaryFeatureConfig(is_array($setting) ? $setting : null);
}

function planHasBenefit(?string $planName, string $benefitKey, ?array $configuredEntitlements = null): bool
{
    $entitlements = normalizePlanEntitlementsConfig($configuredEntitlements);
    $canonicalPlan = canonicalUserPlanValue($planName);

    return !empty($entitlements[$canonicalPlan][$benefitKey]['enabled']);
}

function getBenefitRequiredPlanName(string $benefitKey, ?array $configuredEntitlements = null): string
{
    $entitlements = normalizePlanEntitlementsConfig($configuredEntitlements);

    foreach (['Gratuito', 'Essencial', 'Pro', 'Elite'] as $planName) {
        if (!empty($entitlements[$planName][$benefitKey]['enabled'])) {
            return $planName;
        }
    }

    return 'Elite';
}

function getPlanUsageLimitValueForPlanName(?string $planName, string $limitKey, ?array $configuredLimits = null)
{
    $limits = normalizePlanUsageLimitsConfig($configuredLimits);
    $canonicalPlan = canonicalUserPlanValue($planName);
    $planLimits = $limits[$canonicalPlan] ?? [];
    $limit = $planLimits[$limitKey] ?? ['mode' => 'limited', 'value' => 0];

    if (($limit['mode'] ?? 'limited') !== 'limited') {
        return null;
    }

    return max(0, (int) ($limit['value'] ?? 0));
}

function getEffectiveUserAccessPlanName(PDO $db, string $userId): string
{
    $snapshot = getUserAccessPlanSnapshot($db, $userId);

    if (empty($snapshot['exists']) || !hasActivePlanAccess($snapshot['status'] ?? null)) {
        return 'Gratuito';
    }

    return canonicalUserPlanValue($snapshot['plan_name'] ?? $snapshot['fallback_plan'] ?? null);
}

function getPlanUsageLimitRequiredPlanName(string $limitKey, int $currentUsage, ?array $configuredLimits = null): string
{
    $limits = normalizePlanUsageLimitsConfig($configuredLimits);

    foreach (['Gratuito', 'Essencial', 'Pro', 'Elite'] as $planName) {
        $limit = $limits[$planName][$limitKey] ?? ['mode' => 'limited', 'value' => 0];
        if (($limit['mode'] ?? 'limited') !== 'limited') {
            return $planName;
        }

        if ($currentUsage < max(0, (int) ($limit['value'] ?? 0))) {
            return $planName;
        }
    }

    return 'Elite';
}

function getPlanUsageLimitLabel(string $limitKey): string
{
    return match ($limitKey) {
        'questions_per_day' => 'Limite de questoes por dia',
        'comments_per_day' => 'Limite de comentarios por dia',
        'saved_questions_limit' => 'Limite de questoes salvas',
        'lei_favorites_limit' => 'Limite de favoritos da lei comentada',
        default => 'Limite de uso',
    };
}

function planUsageTableExists(PDO $db, string $table): bool
{
    $allowedTables = ['user_answers', 'comments', 'legal_user_comments', 'user_saved_questions', 'legal_user_favorites'];
    if (!in_array($table, $allowedTables, true)) {
        return false;
    }

    $stmt = $db->prepare('SHOW TABLES LIKE :table_name');
    $stmt->execute([':table_name' => $table]);

    return $stmt->fetchColumn() !== false;
}

function planUsageColumnExists(PDO $db, string $table, string $column): bool
{
    $allowedColumns = ['user_id', 'created_at'];
    if (!planUsageTableExists($db, $table) || !in_array($column, $allowedColumns, true)) {
        return false;
    }

    $stmt = $db->prepare("SHOW COLUMNS FROM {$table} LIKE :column_name");
    $stmt->execute([':column_name' => $column]);

    return $stmt->fetchColumn() !== false;
}

function countPlanUsageRows(PDO $db, string $table, string $userId, bool $todayOnly = false): int
{
    if (!planUsageTableExists($db, $table)) {
        return 0;
    }

    if (!planUsageColumnExists($db, $table, 'user_id')) {
        return 0;
    }

    $where = 'user_id = :user_id';
    if ($todayOnly) {
        if (!planUsageColumnExists($db, $table, 'created_at')) {
            return 0;
        }

        $where .= ' AND created_at >= CURDATE()';
    }

    $stmt = $db->prepare("SELECT COUNT(*) FROM {$table} WHERE {$where}");
    $stmt->execute([':user_id' => $userId]);

    return (int) ($stmt->fetchColumn() ?: 0);
}

function getCurrentUserPlanUsage(PDO $db, string $userId, string $limitKey): int
{
    return match ($limitKey) {
        'questions_per_day' => countPlanUsageRows($db, 'user_answers', $userId, true),
        'comments_per_day' => countPlanUsageRows($db, 'comments', $userId, true)
            + countPlanUsageRows($db, 'legal_user_comments', $userId, true),
        'saved_questions_limit' => countPlanUsageRows($db, 'user_saved_questions', $userId, false),
        'lei_favorites_limit' => countPlanUsageRows($db, 'legal_user_favorites', $userId, false),
        default => 0,
    };
}

function enforceUserPlanUsageLimitAvailable(PDO $db, string $userId, string $limitKey): array
{
    $planName = getEffectiveUserAccessPlanName($db, $userId);
    $configuredLimits = getConfiguredPlanUsageLimits($db);
    $limitValue = getPlanUsageLimitValueForPlanName($planName, $limitKey, $configuredLimits);
    $currentUsage = getCurrentUserPlanUsage($db, $userId, $limitKey);

    if ($limitValue === null || $currentUsage < $limitValue) {
        return [
            'allowed' => true,
            'plan' => $planName,
            'limit' => $limitValue,
            'current' => $currentUsage,
        ];
    }

    $requiredPlan = getPlanUsageLimitRequiredPlanName($limitKey, $currentUsage, $configuredLimits);
    $message = sprintf(
        '%s atingido para o seu plano. Disponivel no Plano %s ou superior.',
        getPlanUsageLimitLabel($limitKey),
        $requiredPlan
    );

    throw new DomainException($message);
}

function isPlanCommerciallyEnabled(PDO $db, ?string $planName): bool
{
    $canonicalPlan = canonicalUserPlanValue($planName);
    $planDetails = getSystemSettingValue($db, 'planDetails', null);

    if (!is_array($planDetails) || !isset($planDetails[$canonicalPlan]) || !is_array($planDetails[$canonicalPlan])) {
        return true;
    }

    if (!array_key_exists('enabled', $planDetails[$canonicalPlan])) {
        return true;
    }

    return (bool) $planDetails[$canonicalPlan]['enabled'];
}

function getUserAccessPlanSnapshot(PDO $db, string $userId): array
{
    $userStmt = $db->prepare("SELECT id, role, plan FROM users WHERE id = :user_id LIMIT 1");
    $userStmt->execute([':user_id' => $userId]);
    $userRow = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$userRow) {
        return [
            'exists' => false,
            'is_admin' => false,
            'plan_name' => 'Gratuito',
            'status' => 'inactive',
        ];
    }

    $subscriptionStmt = $db->prepare("
        SELECT us.status, p.name AS plan_name
        FROM user_subscriptions us
        INNER JOIN plans p ON p.id = us.plan_id
        WHERE us.user_id = :user_id
          AND us.status IN ('active', 'trialing')
        ORDER BY us.id DESC
        LIMIT 1
    ");
    $subscriptionStmt->execute([':user_id' => $userId]);
    $subscriptionRow = $subscriptionStmt->fetch(PDO::FETCH_ASSOC);

    return [
        'exists' => true,
        'is_admin' => ($userRow['role'] ?? '') === 'admin',
        'plan_name' => $subscriptionRow['plan_name'] ?? 'Gratuito',
        'status' => $subscriptionRow['status'] ?? 'inactive',
        'fallback_plan' => canonicalUserPlanValue($userRow['plan'] ?? null),
    ];
}

function userHasPlanBenefit(PDO $db, string $userId, string $benefitKey): bool
{
    $snapshot = getUserAccessPlanSnapshot($db, $userId);
    $entitlements = getConfiguredPlanEntitlements($db);

    if (!$snapshot['exists']) {
        return false;
    }

    if (!empty($snapshot['is_admin'])) {
        return true;
    }

    if (!hasActivePlanAccess($snapshot['status'] ?? null)) {
        return planHasBenefit('Gratuito', $benefitKey, $entitlements);
    }

    return planHasBenefit($snapshot['plan_name'] ?? null, $benefitKey, $entitlements);
}

function getAppBaseUrl(): string
{
    $url = $_ENV['APP_URL'] ?? getenv('APP_URL') ?? 'http://localhost:3000';
    return rtrim($url, '/');
}

function buildAppHashRoute(string $path, array $query = []): string
{
    $normalizedPath = '/' . ltrim($path, '/');
    $queryString = $query ? ('?' . http_build_query($query)) : '';

    return getAppBaseUrl() . '/#' . $normalizedPath . $queryString;
}

function updateEnvFileValues(array $updates, ?string $envPath = null): void
{
    $envPath = $envPath ?: dirname(__DIR__) . '/.env';

    if (!file_exists($envPath)) {
        throw new RuntimeException("Arquivo .env nao encontrado em {$envPath}");
    }

    $content = file_get_contents($envPath);
    if ($content === false) {
        throw new RuntimeException('Nao foi possivel ler o arquivo .env.');
    }

    foreach ($updates as $key => $value) {
        if ($value === null) {
            continue;
        }

        $safeValue = str_replace(["\r", "\n"], '', (string) $value);
        $pattern = '/^' . preg_quote($key, '/') . '=.*$/m';

        if (preg_match($pattern, $content)) {
            $content = preg_replace($pattern, $key . '=' . $safeValue, $content);
        } else {
            $content .= PHP_EOL . $key . '=' . $safeValue;
        }

        putenv("{$key}={$safeValue}");
        $_ENV[$key] = $safeValue;
        $_SERVER[$key] = $safeValue;
    }

    file_put_contents($envPath, $content);
}

function paymentProviderColumnExists(PDO $db, string $table, string $column): bool
{
    $database = $db->query('SELECT DATABASE()')->fetchColumn();

    $stmt = $db->prepare("
        SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = :schema
          AND TABLE_NAME = :table
          AND COLUMN_NAME = :column
    ");

    $stmt->execute([
        ':schema' => $database,
        ':table' => $table,
        ':column' => $column,
    ]);

    return (int) $stmt->fetchColumn() > 0;
}

function paymentProviderTableExists(PDO $db, string $table): bool
{
    $database = $db->query('SELECT DATABASE()')->fetchColumn();

    $stmt = $db->prepare("
        SELECT COUNT(*)
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = :schema
          AND TABLE_NAME = :table
    ");

    $stmt->execute([
        ':schema' => $database,
        ':table' => $table,
    ]);

    return (int) $stmt->fetchColumn() > 0;
}

function paymentProviderIndexExists(PDO $db, string $table, string $index): bool
{
    $database = $db->query('SELECT DATABASE()')->fetchColumn();

    $stmt = $db->prepare("
        SELECT COUNT(*)
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = :schema
          AND TABLE_NAME = :table
          AND INDEX_NAME = :index_name
    ");

    $stmt->execute([
        ':schema' => $database,
        ':table' => $table,
        ':index_name' => $index,
    ]);

    return (int) $stmt->fetchColumn() > 0;
}

function addColumnIfMissing(PDO $db, string $table, string $column, string $definition): void
{
    if (!paymentProviderColumnExists($db, $table, $column)) {
        $db->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
    }
}

function modifyColumnIfExists(PDO $db, string $table, string $column, string $definition): void
{
    if (paymentProviderColumnExists($db, $table, $column)) {
        $db->exec("ALTER TABLE {$table} MODIFY COLUMN {$column} {$definition}");
    }
}

function backfillColumnIfBothExist(PDO $db, string $table, string $targetColumn, string $sourceColumn): void
{
    if (
        paymentProviderColumnExists($db, $table, $targetColumn)
        && paymentProviderColumnExists($db, $table, $sourceColumn)
    ) {
        $db->exec("
            UPDATE {$table}
            SET {$targetColumn} = {$sourceColumn}
            WHERE ({$targetColumn} IS NULL OR {$targetColumn} = '')
              AND {$sourceColumn} IS NOT NULL
              AND {$sourceColumn} <> ''
        ");
    }
}

function addIndexIfMissing(PDO $db, string $table, string $index, string $columns): void
{
    if (!paymentProviderIndexExists($db, $table, $index)) {
        $db->exec("ALTER TABLE {$table} ADD INDEX {$index} ({$columns})");
    }
}

function addUniqueIndexIfMissing(PDO $db, string $table, string $index, string $columns): void
{
    if (!paymentProviderIndexExists($db, $table, $index)) {
        $db->exec("ALTER TABLE {$table} ADD UNIQUE INDEX {$index} ({$columns})");
    }
}

function addUniqueIndexIfNoDuplicates(PDO $db, string $table, string $index, string $column): void
{
    if (paymentProviderIndexExists($db, $table, $index)) {
        return;
    }

    $db->exec("
        UPDATE {$table}
        SET {$column} = NULL
        WHERE {$column} = ''
    ");

    $stmt = $db->query("
        SELECT {$column}, COUNT(*) AS total
        FROM {$table}
        WHERE {$column} IS NOT NULL
          AND {$column} <> ''
        GROUP BY {$column}
        HAVING total > 1
        LIMIT 1
    ");
    if ($stmt && $stmt->fetch(PDO::FETCH_ASSOC)) {
        error_log("[payment_provider] unique index {$index} not created because {$table}.{$column} has duplicates.");
        return;
    }

    $db->exec("ALTER TABLE {$table} ADD UNIQUE INDEX {$index} ({$column})");
}

function dropIndexIfExists(PDO $db, string $table, string $index): void
{
    if (paymentProviderIndexExists($db, $table, $index)) {
        $db->exec("ALTER TABLE {$table} DROP INDEX {$index}");
    }
}

function ensurePaymentProviderSchema(PDO $db): void
{
    static $schemaEnsured = false;

    if ($schemaEnsured) {
        return;
    }

    SchemaReadiness::assertTablesAndColumns($db, 'pagamentos e assinaturas', [
        'users' => ['stripe_customer_id'],
        'plans' => ['stripe_product_id'],
        'user_cards' => ['payment_provider', 'stripe_payment_method_id', 'provider_customer_id'],
        'user_subscriptions' => [
            'payment_provider', 'provider_subscription_id', 'provider_customer_id',
            'provider_checkout_session_id', 'provider_current_period_start',
            'provider_current_period_end', 'provider_last_webhook_event_at',
            'cancel_at_period_end', 'antifraud_blocked', 'renewal_iteration',
            'superseded_by_subscription_id', 'next_renewal_amount',
            'next_renewal_date', 'next_renewal_snapshot_json',
        ],
        'transactions' => [
            'user_subscription_id', 'plan_id', 'plan_name', 'payment_provider',
            'provider_payment_intent_id', 'provider_invoice_id',
            'provider_refund_id', 'provider_refund_details_json', 'refunded_amount',
            'refunded_at', 'installments', 'payer_email', 'type',
        ],
        'coupon_reservations' => [
            'coupon_code', 'user_id', 'checkout_attempt_id', 'provider',
            'status', 'expires_at', 'consumed_at', 'released_at',
        ],
    ]);

    $schemaEnsured = true;
}

function backfillTransactionPlanMetadata(PDO $db): void
{
    // Legacy data repair is intentionally a CLI migration concern. Updating
    // plan metadata from a read endpoint can select an unrelated historical
    // subscription when a user changed plans more than once.
}
