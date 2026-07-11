<?php

declare(strict_types=1);

$root = dirname(__DIR__);

function phase08Assert(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}\n");
        exit(1);
    }

    fwrite(STDOUT, "[OK] {$message}\n");
}

$routes = (string) file_get_contents($root . '/modules/users/routes.php');
$controller = (string) file_get_contents($root . '/modules/users/controllers/UsersController.php');
$service = (string) file_get_contents($root . '/modules/users/services/UsersService.php');
$repository = (string) file_get_contents($root . '/modules/users/repositories/UsersRepository.php');
$validator = (string) file_get_contents($root . '/modules/users/validators/UsersValidator.php');

phase08Assert(str_contains($routes, "if (\$method === 'POST')") || str_contains($routes, "if (\$method !== 'POST')"), 'Notes route handles POST mutations.');
phase08Assert(str_contains($routes, 'validateQuestionNotePayload'), 'Notes route validates question note payloads.');
phase08Assert(str_contains($controller, 'saveUserQuestionNote'), 'Users controller exposes question note mutation.');
phase08Assert(str_contains($service, 'saveUserQuestionNote'), 'Users service owns question note mutation.');
phase08Assert(str_contains($repository, 'upsertUserQuestionNote'), 'Question notes use an idempotent repository upsert.');
phase08Assert(str_contains($repository, 'ON DUPLICATE KEY UPDATE'), 'Question note upsert updates the existing logical note.');
phase08Assert(str_contains($validator, 'validateQuestionNotePayload'), 'Question note validation is centralized.');

fwrite(STDOUT, "Phase 08 frontend contract wiring checks passed.\n");
