<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cron_lock.php';
require_once __DIR__ . '/../../modules/legal_commentary/routes.php';

requireCronSecretForRequestOrRespond();
$cronLock = acquireCronLockOrRespond('legal_commentary_sync_updates', 900);
register_shutdown_function([$cronLock, 'release']);

$database = new Database();
$db = $database->getConnection();

handleLegalCommentaryCronSyncUpdatesRoute($db);
