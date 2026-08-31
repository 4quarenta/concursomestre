<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

// Keep subprocess output deterministic and prevent tests from reaching local
// infrastructure that is intentionally absent in an isolated CI workspace.
putenv('APP_ENV=test');
putenv('ENV_LOADER_SILENT=1');
putenv('MAIL_CONFIG_DISABLE_DATABASE=1');
$_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = 'test';
$_ENV['ENV_LOADER_SILENT'] = $_SERVER['ENV_LOADER_SILENT'] = '1';
$_ENV['MAIL_CONFIG_DISABLE_DATABASE'] = $_SERVER['MAIL_CONFIG_DISABLE_DATABASE'] = '1';

$root = dirname(__DIR__, 2);
$phpBinary = PHP_BINARY;

function ciCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function ciBoolOption(string $name, bool $fallback = false): bool
{
    $value = ciCliOption($name);
    if ($value === null) {
        return $fallback;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

function ciNormalizePath(string $path): string
{
    return str_replace('\\', '/', $path);
}

function ciPathIsSkipped(string $path): bool
{
    $normalized = ciNormalizePath($path);
    $skipFragments = [
        '/vendor/',
        '/storage/',
        '/runtime/',
        '/uploads/',
        '/.git/',
    ];

    foreach ($skipFragments as $fragment) {
        if (strpos($normalized, $fragment) !== false) {
            return true;
        }
    }

    return false;
}

function ciCollectPhpFiles(string $root): array
{
    $files = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $fileInfo) {
        if (!$fileInfo instanceof SplFileInfo || !$fileInfo->isFile()) {
            continue;
        }

        $path = $fileInfo->getPathname();
        if ($fileInfo->getExtension() !== 'php' || ciPathIsSkipped($path)) {
            continue;
        }

        $files[] = $path;
    }

    sort($files);

    return $files;
}

function ciRunCommand(array $command, string $cwd): array
{
    $escaped = array_map('escapeshellarg', $command);
    $output = [];
    $exitCode = 0;
    exec(implode(' ', $escaped) . ' 2>&1', $output, $exitCode);

    return [
        'ok' => $exitCode === 0,
        'exit_code' => $exitCode,
        'output' => implode("\n", $output),
        'cwd' => $cwd,
    ];
}

function ciRunPhpLint(string $phpBinary, array $files, string $root): array
{
    $failed = [];

    foreach ($files as $file) {
        $result = ciRunCommand([$phpBinary, '-l', $file], $root);
        if (!$result['ok']) {
            $failed[] = [
                'file' => ciNormalizePath(substr($file, strlen($root) + 1)),
                'output' => $result['output'],
            ];
        }
    }

    return [
        'ok' => count($failed) === 0,
        'checked' => count($files),
        'failed' => $failed,
    ];
}

function ciCriticalTests(): array
{
    return [
        'tests/AdminSettingsWiringTest.php',
        'tests/AiModuleWiringTest.php',
        'tests/BackupMysqlWiringTest.php',
        'tests/EmailTemplatesCatalogParityTest.php',
        'tests/GoogleAuthWiringTest.php',
        'tests/LegalCommentaryAdminWiringTest.php',
        'tests/MarketingAutomationWiringTest.php',
        'tests/OperationalLogAlertsWiringTest.php',
        'tests/OperationalLogMaintenanceWiringTest.php',
        'tests/ProductionLogAuditWiringTest.php',
        'tests/ProductionPreflightBehaviorTest.php',
        'tests/ProductionPreflightWiringTest.php',
        'tests/ProductionReadinessSuiteWiringTest.php',
        'tests/ProductionSmokeWiringTest.php',
        'tests/SecurityHeadersWiringTest.php',
        'tests/SocialAuthProvidersWiringTest.php',
        'tests/StagingHomologationGateWiringTest.php',
        'tests/StripeConfigurationWiringTest.php',
        'tests/SubscriptionsCheckoutWiringTest.php',
        'tests/SubscriptionsCronWiringTest.php',
        'tests/SubscriptionsTermDebtBehaviorTest.php',
        'tests/UploadSecurityWiringTest.php',
        'tests/VpsOperationsGateWiringTest.php',
    ];
}

/**
 * Discover every versioned top-level PHP test so --all-tests cannot silently
 * degrade into the smaller critical subset.
 *
 * @return list<string>
 */
function ciOperationalTests(): array
{
    return [
        'tests/BillingStripeOperationalValidationTest.php',
    ];
}

function ciAllTests(string $root, bool $includeOperational = false): array
{
    $files = glob($root . DIRECTORY_SEPARATOR . 'tests' . DIRECTORY_SEPARATOR . '*Test.php') ?: [];
    $tests = array_map(
        static fn (string $file): string => 'tests/' . basename($file),
        $files
    );
    if (!$includeOperational) {
        $tests = array_values(array_diff($tests, ciOperationalTests()));
    }
    sort($tests);

    return $tests;
}

function ciRunTests(string $phpBinary, string $root, array $tests): array
{
    $results = [];
    $failed = [];

    foreach ($tests as $relativePath) {
        $path = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
        if (!is_file($path)) {
            $failed[] = [
                'test' => $relativePath,
                'output' => 'Arquivo de teste nao encontrado.',
            ];
            continue;
        }

        $result = ciRunCommand([$phpBinary, $path], $root);
        $entry = [
            'test' => $relativePath,
            'ok' => $result['ok'],
            'exit_code' => $result['exit_code'],
            'output' => $result['output'],
        ];
        $results[] = $entry;

        if (!$result['ok']) {
            $failed[] = $entry;
        }
    }

    return [
        'ok' => count($failed) === 0,
        'checked' => count($tests),
        'failed' => $failed,
        'results' => $results,
    ];
}

$skipSyntax = ciBoolOption('skip-syntax', false);
$jsonOnly = ciBoolOption('json', false);
$reportFile = ciCliOption('report-file', '');
$testListOption = ciCliOption('tests', '');
$includeOperational = ciBoolOption('include-operational', false);
$tests = $testListOption !== ''
    ? array_values(array_filter(array_map('trim', explode(',', $testListOption))))
    : (ciBoolOption('all-tests', false) ? ciAllTests($root, $includeOperational) : ciCriticalTests());

$steps = [];

if (!$skipSyntax) {
    $steps['php_lint'] = ciRunPhpLint($phpBinary, ciCollectPhpFiles($root), $root);
} else {
    $steps['php_lint'] = [
        'ok' => true,
        'skipped' => true,
        'checked' => 0,
        'failed' => [],
    ];
}

$steps['critical_tests'] = ciRunTests($phpBinary, $root, $tests);

$payload = [
    'success' => $steps['php_lint']['ok'] && $steps['critical_tests']['ok'],
    'checked_at' => date(DateTimeInterface::ATOM),
    'steps' => $steps,
    'operational_tests' => [
        'included' => $includeOperational,
        'tests' => ciOperationalTests(),
        'instruction' => 'Execute com --include-operational=true apenas em banco isolado e provedor Stripe de teste.',
    ],
];

if ($reportFile !== '') {
    $reportFile = ciNormalizePath($reportFile);
    $directory = dirname($reportFile);
    if (!is_dir($directory)) {
        mkdir($directory, 0775, true);
    }
    file_put_contents($reportFile, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
}

if ($jsonOnly) {
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} else {
    echo 'PHP lint: ' . ($steps['php_lint']['ok'] ? 'OK' : 'FALHOU') . ' (' . $steps['php_lint']['checked'] . " arquivos)\n";
    echo 'Critical tests: ' . ($steps['critical_tests']['ok'] ? 'OK' : 'FALHOU') . ' (' . $steps['critical_tests']['checked'] . " testes)\n";

    foreach ($steps['php_lint']['failed'] as $failure) {
        fwrite(STDERR, '[php-lint] ' . $failure['file'] . ': ' . $failure['output'] . PHP_EOL);
    }

    foreach ($steps['critical_tests']['failed'] as $failure) {
        fwrite(STDERR, '[test] ' . $failure['test'] . ': ' . $failure['output'] . PHP_EOL);
    }
}

exit($payload['success'] ? 0 : 1);
