<?php
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/study_schedule/planner_routes.php';
handleStudyPlannerRoute((new Database())->getConnection());
