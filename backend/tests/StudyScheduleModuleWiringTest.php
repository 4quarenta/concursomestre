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

declare(strict_types=1);

function assertContainsStudySchedule(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

foreach (['get', 'save', 'delete'] as $endpoint) {
    assertContainsStudySchedule(
        $base . '/api/study-schedule/' . $endpoint . '.php',
        '/modules/study_schedule/routes.php',
        'Study schedule endpoint must delegate to official module routes'
    );
}

assertContainsStudySchedule(
    $base . '/modules/study_schedule/routes.php',
    'function handleStudyScheduleGetRoute',
    'Study schedule routes must expose get handler'
);

assertContainsStudySchedule(
    $base . '/modules/study_schedule/routes.php',
    'function handleStudyScheduleSaveRoute',
    'Study schedule routes must expose save handler'
);

assertContainsStudySchedule(
    $base . '/modules/study_schedule/routes.php',
    'function handleStudyScheduleDeleteRoute',
    'Study schedule routes must expose delete handler'
);

assertContainsStudySchedule(
    $base . '/modules/study_schedule/services/StudyScheduleService.php',
    'Cronograma de estudos e exclusivo do plano Elite.',
    'Study schedule service must enforce Elite-only access server-side'
);

assertContainsStudySchedule(
    $base . '/modules/study_schedule/repositories/StudyScheduleRepository.php',
    'SchemaReadiness::assertTablesAndColumns',
    'Study schedule repository must require a migrated schema without provisioning storage during requests'
);

assertContainsStudySchedule(
    $base . '/database/schema.sql',
    'CREATE TABLE IF NOT EXISTS user_study_schedules',
    'Database schema must include study schedule table'
);

assertContainsStudySchedule(
    $base . '/database/migrations/20260711_000200_runtime_schema_foundation.php',
    'user_study_schedules',
    'Study schedule migration must exist in the versioned migration runner'
);

fwrite(STDOUT, "Study schedule module wiring assertions passed.\n");
