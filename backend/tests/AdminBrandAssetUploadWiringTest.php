<?php

declare(strict_types=1);

$base = dirname(__DIR__);
$route = (string) file_get_contents($base . '/modules/admin/routes.php');
$service = (string) file_get_contents($base . '/modules/admin/services/AdminBrandAssetsService.php');
$bridge = (string) file_get_contents($base . '/api/admin/brand_asset_upload.php');
$uploadsPolicy = (string) file_get_contents($base . '/uploads/.htaccess');

foreach (['requirePlatformAdminSessionContext', 'logAdminAudit', 'handleAdminBrandAssetUploadRoute'] as $needle) {
    if (!str_contains($route, $needle)) {
        throw new RuntimeException("Admin asset route must contain {$needle}.");
    }
}

foreach (['UploadSecurity::validate', 'image/png', 'image/jpeg', 'image/webp', 'random_bytes', 'move_uploaded_file', '4096'] as $needle) {
    if (!str_contains($service, $needle)) {
        throw new RuntimeException("Admin asset upload must enforce {$needle}.");
    }
}

if (!str_contains($bridge, 'handleAdminBrandAssetUploadRoute($db);')) {
    throw new RuntimeException('Admin asset bridge must delegate to the protected module route.');
}
if (!str_contains($uploadsPolicy, 'php_flag engine off') || !str_contains($uploadsPolicy, 'RemoveHandler')) {
    throw new RuntimeException('Public upload storage must disable script execution.');
}

$frontendRoot = dirname($base) . '/src/app/admin/components/settings/';
$uploadComponent = (string) file_get_contents($frontendRoot . 'AdminBrandAssetUpload.tsx');
$settings = (string) file_get_contents($frontendRoot . 'AdminSettings.tsx');
$seo = (string) file_get_contents($frontendRoot . 'AdminSeoSettingsSection.tsx');
foreach (['email-logo', 'og-image'] as $purpose) {
    if (!str_contains($uploadComponent . $settings . $seo, $purpose)) {
        throw new RuntimeException("Admin UI must expose {$purpose} upload.");
    }
}

if (str_contains($seo, 'uploadQuestionContextImage')) {
    throw new RuntimeException('SEO images must not reuse question-context upload endpoints.');
}

echo "AdminBrandAssetUploadWiringTest passed\n";
