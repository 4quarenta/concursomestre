<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/questions/editorial_feedback_routes.php';

$database = new Database();
$db = $database->getConnection();

handleQuestionEditorialFeedbackRoute($db);
