<?php

declare(strict_types=1);

function assertPhase07Contains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertPhase07NotContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content !== false && strpos($content, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__);
$service = $base . '/modules/materials/services/MaterialsService.php';
$repository = $base . '/modules/materials/repositories/MaterialsRepository.php';
$routes = $base . '/modules/materials/routes.php';
$transactions = $base . '/modules/transactions/services/TransactionsService.php';
$migration = $base . '/database/migrations/20260711_040000_marketplace_content_security.php';

assertPhase07Contains($service, "'private://materials/'", 'PDF uploads must use an opaque private storage key');
assertPhase07Contains($service, 'resolveOwnedPendingMaterialUpload', 'Material creation must validate upload ownership');
assertPhase07Contains($service, 'attachPendingMaterialUpload', 'A private upload must be attached atomically only once');
assertPhase07Contains($service, 'Envie o PDF pelo fluxo seguro', 'PDF materials must not be created without a private upload');
assertPhase07Contains($service, "'hasFile'", 'Public material DTO must expose only file availability');
assertPhase07NotContains($service, "'pdfPassword' =>", 'Public material DTO must not expose PDF passwords');
assertPhase07NotContains($routes, "\$_POST['password']", 'Upload route must not accept password fields');
assertPhase07Contains($repository, 'material_moderation_events', 'Moderation decisions must have an append-only history');
assertPhase07Contains($transactions, 'Este material ainda nao esta disponivel para compra.', 'Only approved materials may be acquired');
assertPhase07Contains($transactions, 'Nao e permitido comprar o proprio material', 'Authors must not purchase their own material');
assertPhase07Contains($transactions, 'incrementCouponUsage($this->db, (string) $couponResult[\'coupon\'][\'code\'], true)', 'Free marketplace coupons must enforce usage limits atomically');
assertPhase07Contains($migration, "JSON_REMOVE(files_json, '$.pdfPassword', '$.password')", 'Migration must remove recoverable PDF passwords');
assertPhase07Contains($migration, 'material_uploads', 'Migration must persist private upload metadata');

fwrite(STDOUT, "Marketplace Phase 07 content security assertions passed.\n");
