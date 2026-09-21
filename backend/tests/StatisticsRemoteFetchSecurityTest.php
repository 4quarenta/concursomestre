<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/statistics/security/RemoteFetchDestinationPolicy.php';
require_once dirname(__DIR__) . '/modules/statistics/validators/StatisticsValidator.php';
require_once dirname(__DIR__) . '/modules/statistics/services/StatisticsService.php';

function assertRemoteFetchSecurity(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$dns = [
    'approved.example' => ['93.184.216.34'],
    'public.example' => ['93.184.216.34'],
    'private.example' => ['10.0.0.1'],
    'mixed.example' => ['93.184.216.34', '192.168.1.1'],
    'ipv6-loopback.example' => ['::1'],
    'ipv6-private.example' => ['fd00::1'],
];

$policy = new RemoteFetchDestinationPolicy(
    static fn(string $host): array => $dns[$host] ?? [],
    ['approved.example', 'public.example', 'private.example', 'mixed.example', 'ipv6-loopback.example', 'ipv6-private.example'],
);

$valid = $policy->validateUrl('HTTPS://APPROVED.EXAMPLE./path?q=1#fragment');
assertRemoteFetchSecurity($valid['url'] === 'https://approved.example/path?q=1', 'Approved URL must be normalized without fragment.');
assertRemoteFetchSecurity($valid['baseUrl'] === 'https://approved.example', 'Base URL must use the canonical host.');

foreach ([
    'http://approved.example',
    'https://approved.example:8443',
    'https://user@approved.example',
    'https://user:pass@approved.example',
    'https://127.0.0.1',
    'https://127.1',
    'https://[::1]',
    'https://0.0.0.0',
    'https://approved.example.evil.test',
    'https://evilapproved.example',
    'file:///etc/passwd',
    'ftp://approved.example',
    'gopher://approved.example',
    'data:text/html,blocked',
] as $url) {
    try {
        $policy->validateUrl($url);
        throw new RuntimeException('URL should be rejected: ' . $url);
    } catch (InvalidArgumentException) {
        // Expected policy denial.
    }
}

assertRemoteFetchSecurity($policy->prepare('https://public.example')['addresses'] === ['93.184.216.34'], 'Public DNS address must be allowed.');
foreach (['private.example', 'mixed.example', 'ipv6-loopback.example', 'ipv6-private.example', 'missing.example'] as $host) {
    try {
        $policy->prepare('https://' . $host);
        throw new RuntimeException('Unsafe DNS result should be rejected: ' . $host);
    } catch (InvalidArgumentException) {
        // Expected policy denial.
    }
}

$service = (new ReflectionClass(StatisticsService::class))->newInstanceWithoutConstructor();
$redirectResolver = new ReflectionMethod(StatisticsService::class, 'resolveRemoteRedirect');
$redirectResolver->setAccessible(true);
$approvedRedirect = $redirectResolver->invoke($service, 'https://approved.example/start', '/next');
assertRemoteFetchSecurity($policy->prepare($approvedRedirect)['host'] === 'approved.example', 'Relative approved redirect must retain the approved host.');

foreach (['https://private.example/secret', 'http://approved.example/downgrade', '//evilapproved.example/private'] as $location) {
    $redirect = $redirectResolver->invoke($service, 'https://approved.example/start', $location);
    try {
        $policy->prepare($redirect);
        throw new RuntimeException('Redirect destination should be rejected: ' . $location);
    } catch (InvalidArgumentException) {
        // Expected policy denial.
    }
}

$validator = new StatisticsValidator($policy);
try {
    $validator->validateBancaInfoQuery(['url' => 'http://approved.example']);
    throw new RuntimeException('The statistics validator must reject HTTP.');
} catch (InvalidArgumentException) {
    // Expected policy denial.
}

$serviceSource = file_get_contents(dirname(__DIR__) . '/modules/statistics/services/StatisticsService.php');
assertRemoteFetchSecurity(is_string($serviceSource), 'Statistics service source must be readable.');
assertRemoteFetchSecurity(!str_contains($serviceSource, 'CURLOPT_FOLLOWLOCATION, true'), 'Unrestricted redirect following must be absent.');
assertRemoteFetchSecurity(!str_contains($serviceSource, 'CURLOPT_SSL_VERIFYPEER, false'), 'TLS peer verification must not be disabled.');
assertRemoteFetchSecurity(!str_contains($serviceSource, 'CURLOPT_SSL_VERIFYHOST, false'), 'TLS hostname verification must not be disabled.');
assertRemoteFetchSecurity(str_contains($serviceSource, 'CURLOPT_SSL_VERIFYPEER => true'), 'TLS peer verification must be enabled.');
assertRemoteFetchSecurity(str_contains($serviceSource, 'CURLOPT_SSL_VERIFYHOST => 2'), 'TLS hostname verification must be enabled.');
assertRemoteFetchSecurity(str_contains($serviceSource, 'CURLOPT_FOLLOWLOCATION => false'), 'Redirect following must be explicitly disabled.');
assertRemoteFetchSecurity(str_contains($serviceSource, "CURLOPT_RESOLVE => \$destination['resolve']"), 'Validated DNS addresses must pin the connection.');
assertRemoteFetchSecurity(!str_contains($serviceSource, 'CURLOPT_COOKIEJAR'), 'Cookie jars must not persist across requests.');
assertRemoteFetchSecurity(str_contains($serviceSource, 'CURLOPT_WRITEFUNCTION'), 'Remote response size must be bounded during transfer.');

fwrite(STDOUT, "Statistics remote-fetch security assertions passed.\n");
