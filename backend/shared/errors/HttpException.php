<?php

declare(strict_types=1);

/** Excecao HTTP com status e codigo publico estaveis. */
class HttpException extends RuntimeException
{
    public function __construct(
        string $message,
        private readonly int $statusCode,
        private readonly string $errorCode,
        ?Throwable $previous = null
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }
}

final class MethodNotAllowedException extends HttpException
{
    /** @param list<string> $allowedMethods */
    public function __construct(private readonly array $allowedMethods)
    {
        parent::__construct('Metodo nao permitido.', 405, 'method_not_allowed');
    }

    /** @return list<string> */
    public function allowedMethods(): array
    {
        return $this->allowedMethods;
    }
}

final class UnauthorizedException extends HttpException
{
    public function __construct(string $message = 'Sessao invalida ou expirada.')
    {
        parent::__construct($message, 401, 'unauthorized');
    }
}

final class RecaptchaValidationException extends HttpException
{
    public function __construct(string $message)
    {
        parent::__construct($message, 422, 'recaptcha_validation_failed');
    }
}

final class RecaptchaUnavailableException extends HttpException
{
    public function __construct(string $message, ?Throwable $previous = null)
    {
        parent::__construct($message, 503, 'recaptcha_unavailable', $previous);
    }
}

final class AiProviderException extends HttpException
{
    public function __construct(string $message, ?Throwable $previous = null)
    {
        parent::__construct($message, 503, 'ai_unavailable', $previous);
    }
}

final class StripeWebhookConfigurationException extends HttpException
{
    public function __construct(string $message = 'Webhook Stripe nao configurado.')
    {
        parent::__construct($message, 500, 'stripe_webhook_not_configured');
    }
}
