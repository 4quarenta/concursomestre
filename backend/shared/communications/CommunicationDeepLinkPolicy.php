<?php

declare(strict_types=1);

/**
 * Normaliza links produzidos por comunicacoes para rotas internas seguras.
 * Autorizacao do recurso continua pertencendo ao destino; esta classe apenas
 * impede que uma comunicacao introduza redirecionamento externo ou esquema
 * executavel.
 */
final class CommunicationDeepLinkPolicy
{
    public function sanitize(?string $link): ?string
    {
        $value = trim((string) $link);
        if ($value === '') {
            return null;
        }

        if (preg_match('/[\x00-\x1F\x7F\\]/', $value) === 1) {
            throw new InvalidArgumentException('Deep link de comunicacao contem caracteres invalidos.');
        }

        $parts = parse_url($value);
        if ($parts === false) {
            throw new InvalidArgumentException('Deep link de comunicacao invalido.');
        }

        if (isset($parts['scheme']) || isset($parts['host']) || str_starts_with($value, '//')) {
            if (!$this->isConfiguredSameOrigin($parts)) {
                throw new InvalidArgumentException('Deep link externo nao e permitido.');
            }
            $value = (string) ($parts['path'] ?? '/');
            if (isset($parts['query'])) {
                $value .= '?' . $parts['query'];
            }
            if (isset($parts['fragment'])) {
                $value .= '#' . $parts['fragment'];
            }
        }

        if (!str_starts_with($value, '/') || str_starts_with($value, '//')) {
            throw new InvalidArgumentException('Deep link deve apontar para uma rota interna.');
        }

        $path = (string) (parse_url($value, PHP_URL_PATH) ?: '/');
        $allowed = [
            '/^\/(notifications|profile|support|practice|question|read|marketplace|checkout|subscription)(?:\/|$)/',
            '/^\/admin(?:\/|$)/',
        ];
        foreach ($allowed as $pattern) {
            if (preg_match($pattern, $path) === 1) {
                return $value;
            }
        }

        throw new InvalidArgumentException('Rota de deep link nao permitida.');
    }

    /**
     * Aplica contexto de destinatario sem substituir a autorizacao do destino.
     */
    public function authorize(?string $link, array $context): ?string
    {
        $safe = $this->sanitize($link);
        if ($safe === null) {
            return null;
        }

        $path = (string) (parse_url($safe, PHP_URL_PATH) ?: '/');
        $isAdmin = (bool) ($context['isAdmin'] ?? false);
        if (str_starts_with($path, '/admin/') && !$isAdmin) {
            throw new DomainException('Deep link administrativo exige sessao administrativa.');
        }

        parse_str((string) (parse_url($safe, PHP_URL_QUERY) ?: ''), $query);
        foreach (['user_id', 'userId', 'target_user_id'] as $key) {
            if (!isset($query[$key]) || (string) $query[$key] === '') {
                continue;
            }
            if (!$isAdmin && (string) $query[$key] !== (string) ($context['recipientUserId'] ?? '')) {
                throw new DomainException('Deep link de outro usuario nao e permitido.');
            }
        }

        return $safe;
    }

    private function isConfiguredSameOrigin(array $parts): bool
    {
        $host = strtolower(trim((string) ($parts['host'] ?? '')));
        $scheme = strtolower(trim((string) ($parts['scheme'] ?? '')));
        if ($host === '' || !in_array($scheme, ['http', 'https'], true)) {
            return false;
        }

        $configured = trim((string) (getenv('APP_URL') ?: getenv('APP_PUBLIC_URL') ?: ''));
        $configuredHost = $configured !== '' ? strtolower((string) parse_url($configured, PHP_URL_HOST)) : '';
        $allowedHosts = array_filter([$configuredHost, 'concursomestre.com', 'www.concursomestre.com', 'localhost', '127.0.0.1']);

        return in_array($host, $allowedHosts, true);
    }
}
