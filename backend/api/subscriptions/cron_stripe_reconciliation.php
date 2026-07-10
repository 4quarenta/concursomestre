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

require_once __DIR__ . '/../../config/cron_lock.php';

requireCronSecretForRequestOrRespond();
$cronLock = acquireCronLockOrRespond('subscriptions_stripe_reconciliation');
register_shutdown_function([$cronLock, 'release']);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/subscriptions/routes.php';

$database = new Database();
$db = $database->getConnection();

handleSubscriptionsStripeReconciliationCronRoute($db);
