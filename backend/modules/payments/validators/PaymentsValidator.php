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

require_once __DIR__ . '/../../../config/env.php';

/**
 * Validator do dominio de pagamentos.
 * Mantem entrada, sanitizacao e regras minimas fora do controller.
 *
 * @since 1.0.0
 */
class PaymentsValidator
{
    /**
     * Normaliza os parametros da consulta de parcelamento.
     *
     * @since 1.0.0
     */
    public function validateInstallmentsQuery(array $query): array
    {
        $amount = round((float) ($query['amount'] ?? 0), 2);
        $bin = preg_replace('/\D+/', '', (string) ($query['bin'] ?? ''));
        $paymentMethodId = trim((string) ($query['payment_method_id'] ?? ''));

        return [
            'amount' => $amount,
            'bin' => $bin !== '' ? substr($bin, 0, 6) : '',
            'payment_method_id' => $paymentMethodId,
        ];
    }

    /**
     * Valida o payload da compra avulsa do material.
     * O valor e o usuario final nao sao confiados ao cliente.
     *
     * @since 1.0.0
     */
    public function validateMaterialPaymentPayload(array $payload, string $authenticatedUserId): array
    {
        $normalizedUserId = trim($authenticatedUserId);
        if ($normalizedUserId === '') {
            throw new RuntimeException('Sessao invalida. Faca login novamente.');
        }

        $payloadUserId = trim((string) ($payload['user_id'] ?? ''));
        if ($payloadUserId !== '' && $payloadUserId !== $normalizedUserId) {
            throw new InvalidArgumentException('O usuario autenticado nao corresponde ao payload enviado.');
        }

        $token = trim((string) ($payload['token'] ?? ''));
        if ($token === '') {
            throw new InvalidArgumentException('O token do cartao e obrigatorio.');
        }

        $materialId = trim((string) ($payload['material_id'] ?? ''));
        if ($materialId === '') {
            throw new InvalidArgumentException('O material informado e obrigatorio.');
        }

        $paymentMethodId = trim((string) ($payload['payment_method_id'] ?? ''));
        if ($paymentMethodId === '') {
            throw new InvalidArgumentException('O metodo de pagamento informado e obrigatorio.');
        }

        $installments = (int) ($payload['installments'] ?? 0);
        if ($installments < 1) {
            throw new InvalidArgumentException('A quantidade de parcelas deve ser maior que zero.');
        }

        $payerIdentificationType = strtoupper(trim((string) ($payload['payer']['identification']['type'] ?? 'CPF')));
        if ($payerIdentificationType === '') {
            $payerIdentificationType = 'CPF';
        }

        $payerIdentificationNumber = preg_replace('/\D+/', '', (string) ($payload['payer']['identification']['number'] ?? ''));

        return [
            'user_id' => $normalizedUserId,
            'token' => $token,
            'material_id' => $materialId,
            'payment_method_id' => $paymentMethodId,
            'installments' => $installments,
            'payer_identification_type' => $payerIdentificationType,
            'payer_identification_number' => $payerIdentificationNumber,
        ];
    }

    /**
     * Valida o payload do checkout legado de materiais.
     *
     * @since 1.0.0
     */
    public function validateCreatePreferencePayload(array $payload, string $authenticatedUserId): array
    {
        $normalizedUserId = trim($authenticatedUserId);
        if ($normalizedUserId === '') {
            throw new RuntimeException('Sessao invalida. Faca login novamente.');
        }

        $payloadUserId = trim((string) ($payload['userId'] ?? $payload['user_id'] ?? ''));
        if ($payloadUserId !== '' && $payloadUserId !== $normalizedUserId) {
            throw new InvalidArgumentException('O usuario autenticado nao corresponde ao payload enviado.');
        }

        $materialId = trim((string) ($payload['materialId'] ?? $payload['material_id'] ?? ''));
        if ($materialId === '') {
            throw new InvalidArgumentException('O material informado e obrigatorio.');
        }

        return [
            'user_id' => $normalizedUserId,
            'material_id' => $materialId,
        ];
    }

    /**
     * Valida a abertura do onboarding Stripe Connect sem confiar em userId do cliente.
     *
     * @since 1.0.0
     */
    public function validateCreateConnectAccountPayload(array $payload, string $authenticatedUserId): array
    {
        $normalizedUserId = trim($authenticatedUserId);
        if ($normalizedUserId === '') {
            throw new RuntimeException('Sessao invalida. Faca login novamente.');
        }

        $payloadUserId = trim((string) ($payload['userId'] ?? $payload['user_id'] ?? ''));
        if ($payloadUserId !== '' && $payloadUserId !== $normalizedUserId) {
            throw new InvalidArgumentException('Nao e permitido criar onboarding para outro usuario.');
        }

        return [
            'user_id' => $normalizedUserId,
            'refresh_url' => $this->validateOptionalAbsoluteUrl($payload['refreshUrl'] ?? $payload['refresh_url'] ?? null, 'refreshUrl'),
            'return_url' => $this->validateOptionalAbsoluteUrl($payload['returnUrl'] ?? $payload['return_url'] ?? null, 'returnUrl'),
        ];
    }

    /**
     * Valida a consulta de verificacao do PaymentIntent do Stripe.
     *
     * @since 1.0.0
     */
    public function validateVerifyPaymentQuery(array $query): array
    {
        $paymentIntentId = trim((string) ($query['payment_intent'] ?? ''));
        if ($paymentIntentId === '') {
            throw new InvalidArgumentException('Payment Intent ID required');
        }

        return [
            'payment_intent' => $paymentIntentId,
        ];
    }

    /**
     * Mantem URLs de retorno opcionais validas antes de mandar ao Stripe.
     *
     * @since 1.0.0
     */
    private function validateOptionalAbsoluteUrl($value, string $fieldName): string
    {
        $url = trim((string) $value);
        if ($url === '') {
            return '';
        }

        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            throw new InvalidArgumentException("O campo {$fieldName} precisa ser uma URL valida.");
        }

        if (!$this->isAllowedPlatformReturnUrl($url)) {
            throw new InvalidArgumentException("O campo {$fieldName} precisa apontar para uma origem autorizada da plataforma.");
        }

        return $url;
    }

    /**
     * Restringe URLs de retorno Stripe a origens operadas pela plataforma.
     *
     * @since 1.0.0
     */
    private function isAllowedPlatformReturnUrl(string $url): bool
    {
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        if ($scheme === '' || $host === '') {
            return false;
        }

        if (isProductionEnv() && $scheme !== 'https') {
            return false;
        }

        $allowedOrigins = [];
        $appUrl = getEnvString('APP_URL');
        if ($appUrl !== '') {
            $allowedOrigins[] = $appUrl;
        }

        foreach (array_filter(array_map('trim', explode(',', getEnvString('CORS_ALLOWED_ORIGINS')))) as $origin) {
            $allowedOrigins[] = $origin;
        }

        foreach ($allowedOrigins as $origin) {
            $allowedScheme = strtolower((string) parse_url($origin, PHP_URL_SCHEME));
            $allowedHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
            $allowedPort = parse_url($origin, PHP_URL_PORT);
            $urlPort = parse_url($url, PHP_URL_PORT);

            if ($allowedHost === '' || $allowedHost !== $host) {
                continue;
            }

            if ($allowedScheme !== '' && $allowedScheme !== $scheme) {
                continue;
            }

            if ($allowedPort !== null && $urlPort !== $allowedPort) {
                continue;
            }

            return true;
        }

        return false;
    }
}
