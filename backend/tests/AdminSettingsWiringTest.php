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

function assertContainsText(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertNotContainsText(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsText(
    $base . '/api/settings.php',
    'handlePublicSettingsRoute',
    'Legacy public settings endpoint must delegate to the public settings module handler'
);

assertContainsText(
    $base . '/api/admin/settings.php',
    'handleAdminSettingsRoute',
    'Admin settings endpoint must delegate to the admin module settings handler'
);

assertContainsText(
    $base . '/router.php',
    "'settingsUpdate' => 'api/admin/settings.php'",
    'Router alias settingsUpdate must point to the official admin settings endpoint'
);

assertContainsText(
    $base . '/.htaccess',
    'RewriteRule ^api/settingsUpdate$ api/admin/settings.php [L]',
    'Root rewrite for settingsUpdate must point to admin/settings.php'
);

assertContainsText(
    $base . '/modules/settings/routes.php',
    'function handlePublicSettingsRoute',
    'Settings module must expose the public settings handler'
);

assertContainsText(
    $base . '/modules/admin/routes.php',
    'function handleAdminSettingsRoute',
    'Admin routes must expose the system settings handler'
);

assertContainsText(
    $base . '/modules/admin/routes.php',
    '$context = requireAdminSessionContext($db);',
    'Admin settings GET/POST flow must require an admin session before returning settings'
);

assertContainsText(
    $base . '/modules/admin/routes.php',
    '$payload = $controller->show([\'role\' => \'admin\', \'user_id\' => $adminUserId]);',
    'Admin settings GET must request the administrative settings projection explicitly'
);

assertContainsText(
    $base . '/modules/admin/routes.php',
    "test_email_template",
    'Admin settings route must expose an operational e-mail template test action'
);

assertContainsText(
    $base . '/modules/admin/controllers/AdminSettingsController.php',
    'function testEmailTemplate',
    'Admin settings controller must delegate e-mail template tests to the service'
);

assertContainsText(
    $base . '/modules/admin/services/AdminSettingsService.php',
    'function testEmailTemplate',
    'Admin settings service must implement e-mail template test delivery'
);

assertContainsText(
    $base . '/modules/admin/validators/AdminSettingsValidator.php',
    'function validateEmailTemplateTestPayload',
    'Admin settings validator must validate e-mail template test payloads'
);

assertContainsText(
    $base . '/modules/admin/services/AdminSettingsService.php',
    'wrapSystemEmailTemplateHtml($resolvedHtmlBody, $resolvedSubject, $variables)',
    'Draft e-mail template tests must use the same professional HTML wrapper as real deliveries'
);

assertContainsText(
    $base . '/shared/utils/MailConfiguration.php',
    'MAIL_CONFIG_DISABLE_DATABASE',
    'SMTP tests must be able to bypass persisted settings and use the payload being tested'
);

assertContainsText(
    $base . '/modules/admin/services/AdminSettingsService.php',
    'function commitSettingsTransaction',
    'Admin settings service must guard transaction commit for drivers that close successful write transactions'
);

assertContainsText(
    $base . '/modules/admin/services/AdminSettingsService.php',
    'Transaction already closed before commit',
    'Admin settings service must log a non-fatal closed transaction state instead of failing settings saves'
);

assertNotContainsText(
    $base . '/modules/admin/routes.php',
    '$controller->show(AuthMiddleware::optionalAuth())',
    'Admin settings route must not use optional auth for administrative settings'
);

fwrite(STDOUT, "Admin settings wiring assertions passed.\n");
