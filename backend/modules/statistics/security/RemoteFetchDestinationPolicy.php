<?php

declare(strict_types=1);

/**
 * Server-owned destination authority for remote board analysis fetches.
 */
final class RemoteFetchDestinationPolicy
{
    private const DEFAULT_ALLOWED_HOSTS = [
        'ibfc.org.br',
        'www.ibfc.org.br',
        'ibfc.selecao.net.br',
    ];

    /** @var callable(string): list<string> */
    private $resolver;

    /** @var list<string> */
    private array $allowedHosts;

    /**
     * @param callable(string): list<string>|null $resolver
     * @param list<string>|null $allowedHosts
     */
    public function __construct(?callable $resolver = null, ?array $allowedHosts = null)
    {
        $this->resolver = $resolver ?? static function (string $host): array {
            if (!function_exists('dns_get_record')) {
                return [];
            }

            $records = @dns_get_record($host, DNS_A | DNS_AAAA);
            if (!is_array($records)) {
                return [];
            }

            $addresses = [];
            foreach ($records as $record) {
                foreach (['ip', 'ipv6'] as $field) {
                    $address = trim((string) ($record[$field] ?? ''));
                    if ($address !== '') {
                        $addresses[] = $address;
                    }
                }
            }

            return array_values(array_unique($addresses));
        };

        $configuredHosts = $allowedHosts;
        if ($configuredHosts === null && function_exists('getEnvString')) {
            $configured = trim(getEnvString('STATISTICS_BANCA_ALLOWED_HOSTS', ''));
            $configuredHosts = $configured === '' ? null : explode(',', $configured);
        }

        $this->allowedHosts = $this->normalizeAllowedHosts($configuredHosts ?? self::DEFAULT_ALLOWED_HOSTS);
    }

    /** @return array{url: string, baseUrl: string, host: string} */
    public function validateUrl(string $rawUrl): array
    {
        $url = trim($rawUrl);
        if ($url === '' || preg_match('/[\x00-\x20\x7f]/', $url) === 1) {
            throw new InvalidArgumentException('URL remota invalida.');
        }

        $parts = parse_url($url);
        if (!is_array($parts)) {
            throw new InvalidArgumentException('URL remota invalida.');
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));
        if ($scheme !== 'https' || $host === '') {
            throw new InvalidArgumentException('O destino remoto exige HTTPS.');
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new InvalidArgumentException('URL remota com credenciais nao permitida.');
        }

        $port = $parts['port'] ?? null;
        if ($port !== null && (int) $port !== 443) {
            throw new InvalidArgumentException('Porta remota nao permitida.');
        }

        $hostForIp = trim($host, '[]');
        if (filter_var($hostForIp, FILTER_VALIDATE_IP) !== false) {
            throw new InvalidArgumentException('IP literal remoto nao permitido.');
        }

        if (!in_array($host, $this->allowedHosts, true)) {
            throw new InvalidArgumentException('Destino remoto nao autorizado.');
        }

        $path = (string) ($parts['path'] ?? '/');
        if ($path === '') {
            $path = '/';
        }

        $normalizedUrl = 'https://' . $host . $path;
        if (array_key_exists('query', $parts)) {
            $normalizedUrl .= '?' . (string) $parts['query'];
        }

        return [
            'url' => $normalizedUrl,
            'baseUrl' => 'https://' . $host,
            'host' => $host,
        ];
    }

    /** @return array{url: string, baseUrl: string, host: string, addresses: list<string>, resolve: list<string>} */
    public function prepare(string $rawUrl): array
    {
        $destination = $this->validateUrl($rawUrl);
        $addresses = array_values(array_unique(($this->resolver)($destination['host'])));
        if ($addresses === []) {
            throw new InvalidArgumentException('Destino remoto sem resolucao publica segura.');
        }

        foreach ($addresses as $address) {
            if (!$this->isPublicAddress($address)) {
                throw new InvalidArgumentException('Destino remoto resolve para rede nao publica.');
            }
        }

        return [
            ...$destination,
            'addresses' => $addresses,
            'resolve' => array_map(
                static fn(string $address): string => $destination['host'] . ':443:' . $address,
                $addresses,
            ),
        ];
    }

    /** @return list<string> */
    public function allowedHosts(): array
    {
        return $this->allowedHosts;
    }

    /** @param list<string> $hosts @return list<string> */
    private function normalizeAllowedHosts(array $hosts): array
    {
        $normalized = [];
        foreach ($hosts as $host) {
            $candidate = strtolower(rtrim(trim((string) $host), '.'));
            if ($candidate === '' || str_contains($candidate, '*') || filter_var($candidate, FILTER_VALIDATE_IP) !== false) {
                continue;
            }
            $normalized[] = $candidate;
        }

        return array_values(array_unique($normalized));
    }

    private function isPublicAddress(string $address): bool
    {
        $packed = @inet_pton($address);
        if ($packed === false) {
            return false;
        }

        if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return false;
        }

        if (strlen($packed) === 4) {
            $octets = array_values(unpack('C4', $packed));
            $first = $octets[0];
            $second = $octets[1];
            if ($first === 0 || $first === 10 || $first === 127 || $first >= 224) {
                return false;
            }
            if ($first === 100 && $second >= 64 && $second <= 127) {
                return false;
            }
            if ($first === 169 && $second === 254) {
                return false;
            }
            if ($first === 172 && $second >= 16 && $second <= 31) {
                return false;
            }
            if ($first === 192 && in_array($second, [0, 168], true)) {
                return false;
            }
            if ($first === 198 && ($second === 18 || $second === 19 || ($second === 51 && $octets[2] === 100))) {
                return false;
            }
            if ($first === 203 && $second === 0 && $octets[2] === 113) {
                return false;
            }
            return true;
        }

        $firstByte = ord($packed[0]);
        $secondByte = ord($packed[1]);
        if (($firstByte & 0xfe) === 0xfc || ($firstByte === 0xfe && ($secondByte & 0xc0) === 0x80)) {
            return false;
        }
        if ($firstByte === 0xff || ($firstByte === 0x20 && $secondByte === 0x01 && ord($packed[2]) === 0x0d && ord($packed[3]) === 0xb8)) {
            return false;
        }
        if ($packed === str_repeat("\0", 16) || $packed === str_repeat("\0", 15) . "\1") {
            return false;
        }
        if (substr($packed, 0, 12) === str_repeat("\0", 10) . "\xff\xff") {
            return $this->isPublicAddress(inet_ntop(substr($packed, -4)) ?: '');
        }
        return true;
    }
}
