<?php

declare(strict_types=1);

final class AssetUrlPolicy
{
    /** @param list<string> $allowedHosts */
    public function __construct(private readonly array $allowedHosts = [])
    {
    }

    public function validate(string $url): void
    {
        if (strlen($url) > 4000 || preg_match('/[\r\n\x00]/', $url) === 1) {
            throw new InvalidArgumentException('URL de asset invalida.');
        }
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        if (!in_array($scheme, ['https'], true) || $host === '' || isset($parts['user']) || isset($parts['pass'])) {
            throw new InvalidArgumentException('URL de asset nao permitida.');
        }
        if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
            throw new InvalidArgumentException('Host local de asset nao permitido.');
        }
        $hostForIp = trim($host, '[]');
        if (filter_var($hostForIp, FILTER_VALIDATE_IP) !== false && !filter_var($hostForIp, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            throw new InvalidArgumentException('Asset em rede privada nao permitido.');
        }
        if ($this->allowedHosts !== [] && !in_array($host, $this->allowedHosts, true)) {
            throw new InvalidArgumentException('Host de asset nao autorizado.');
        }
    }

    /** @param mixed $payload */
    public function validatePayloadAssets(mixed $payload): void
    {
        if (!is_array($payload)) {
            return;
        }
        foreach ($payload as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), ['url', 'sourceurl', 'remoteurl'], true) && is_string($value) && $value !== '') {
                $this->validate($value);
            }
            $this->validatePayloadAssets($value);
        }
    }

    /** @param list<string> $redirectChain */
    public function validateRedirectChain(array $redirectChain): void
    {
        if ($redirectChain === [] || count($redirectChain) > 10) {
            throw new InvalidArgumentException('Cadeia de redirect de asset invalida.');
        }
        foreach ($redirectChain as $url) {
            $this->validate($url);
        }
    }

    /** @param array<string,mixed> $asset */
    public function validateDownloadedAsset(array $asset, int $maxBytes = 100_000_000): void
    {
        $size = (int) ($asset['size'] ?? -1);
        $mime = strtolower(trim((string) ($asset['mimeType'] ?? '')));
        $hash = strtolower(trim((string) ($asset['sha256'] ?? '')));
        $allowed = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'application/rtf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/zip',
        ];
        if ($size < 0 || $size > max(1, $maxBytes) || !in_array($mime, $allowed, true) || preg_match('/^[a-f0-9]{64}$/', $hash) !== 1) {
            throw new InvalidArgumentException('Asset baixado nao atende a politica de seguranca.');
        }
        $temporaryPath = trim((string) ($asset['temporaryPath'] ?? ''));
        if ($temporaryPath !== '' && !is_file($temporaryPath)) {
            throw new InvalidArgumentException('Asset temporario indisponivel.');
        }
    }
}
