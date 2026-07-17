<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../modules/questions/private_ingestion_routes.php';

$db = (new Database())->getConnection();
handlePrivateQuestionIngestionRoute($db);
