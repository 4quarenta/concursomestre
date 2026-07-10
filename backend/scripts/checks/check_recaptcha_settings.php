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

require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/shared/security/Recaptcha.php';

/**
 * Script operacional para verificar a configuração de reCAPTCHA fora da area pública.
 */
$database = new Database();
$db = $database->getConnection();

$enabled = isRecaptchaEnabled($db);
$secret = getRecaptchaSecretKey($db);
$maskedSecret = strlen($secret) > 8
    ? substr($secret, 0, 4) . str_repeat('*', max(strlen($secret) - 8, 0)) . substr($secret, -4)
    : str_repeat('*', strlen($secret));

fwrite(STDOUT, 'recaptcha_enabled=' . ($enabled ? 'true' : 'false') . PHP_EOL);
fwrite(STDOUT, 'recaptcha_secret=' . $maskedSecret . PHP_EOL);
