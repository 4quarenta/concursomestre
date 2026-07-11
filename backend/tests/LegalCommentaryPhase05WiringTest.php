<?php

declare(strict_types=1);

function phase05Assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$root = dirname(__DIR__);
$repositoryPath = $root . '/modules/legal_commentary/repositories/LegalCommentaryRepository.php';
$servicePath = $root . '/modules/legal_commentary/services/LegalCommentaryService.php';
$controllerPath = $root . '/modules/legal_commentary/controllers/LegalCommentaryController.php';
$routesPath = $root . '/modules/legal_commentary/routes.php';
$migrationPath = $root . '/database/migrations/20260711_020000_legal_commentary_canonical.php';
$readerAnnotationMigrationPath = $root . '/database/migrations/20260711_020010_legal_reader_annotations.php';
$notesEndpointPath = $root . '/api/legal-commentary/notes.php';
$readerAnnotationsEndpointPath = $root . '/api/legal-commentary/reader-annotations.php';

$repository = (string) file_get_contents($repositoryPath);
$service = (string) file_get_contents($servicePath);
$controller = (string) file_get_contents($controllerPath);
$routes = (string) file_get_contents($routesPath);

phase05Assert(str_contains($repository, 'SchemaReadiness::assertTablesAndColumns'), 'Runtime da Lei Comentada deve validar o schema sem executar DDL.');
phase05Assert(!str_contains($repository, '$this->ensureSchema();'), 'Nenhuma leitura/escrita da Lei Comentada pode executar o bootstrap de schema em runtime.');
phase05Assert(str_contains($repository, 'legal_user_notes'), 'Anotacoes do usuario devem possuir persistencia dedicada.');
phase05Assert(str_contains($repository, 'legal_user_reader_annotations'), 'Marcacoes ricas do leitor devem possuir persistencia dedicada.');
phase05Assert(str_contains($repository, 'function fetchUserNotes') && str_contains($repository, 'function saveUserNote'), 'Repositorio deve expor leitura e escrita de anotacoes.');
phase05Assert(str_contains($repository, 'function fetchReaderAnnotation') && str_contains($repository, 'function saveReaderAnnotation'), 'Repositorio deve expor leitura e escrita de marcacoes ricas.');
phase05Assert(str_contains($repository, "':official_status' => 'active'") && str_contains($repository, "'needs_review'"), 'Sincronizacao deve manter artigos ausentes para revisao, sem apaga-los.');
phase05Assert(!str_contains($repository, 'DROP COLUMN') && !str_contains($repository, 'DROP INDEX'), 'Migracao canonica nao pode conter remocoes destrutivas.');
phase05Assert(str_contains($service, 'function listUserNotes') && str_contains($service, 'function deleteUserNote'), 'Servico deve controlar o ciclo completo das anotacoes.');
phase05Assert(str_contains($service, 'function getReaderAnnotation') && str_contains($service, 'function deleteReaderAnnotation'), 'Servico deve controlar o ciclo completo das marcacoes ricas.');
phase05Assert(str_contains($controller, 'function handleNote'), 'Controller deve expor a operacao de anotacoes.');
phase05Assert(str_contains($controller, 'function handleReaderAnnotation'), 'Controller deve expor a operacao de marcacoes ricas.');
phase05Assert(str_contains($routes, 'function handleLegalCommentaryNotesRoute'), 'Rota autenticada de anotacoes deve existir.');
phase05Assert(str_contains($routes, 'function handleLegalCommentaryReaderAnnotationsRoute'), 'Rota autenticada de marcacoes ricas deve existir.');
phase05Assert(is_file($notesEndpointPath) && str_contains((string) file_get_contents($notesEndpointPath), 'handleLegalCommentaryNotesRoute'), 'Endpoint publico de anotacoes deve delegar para o modulo.');
phase05Assert(is_file($readerAnnotationsEndpointPath) && str_contains((string) file_get_contents($readerAnnotationsEndpointPath), 'handleLegalCommentaryReaderAnnotationsRoute'), 'Endpoint publico de marcacoes ricas deve delegar para o modulo.');
phase05Assert(is_file($migrationPath) && str_contains((string) file_get_contents($migrationPath), 'applySchemaMigration'), 'Schema canonico deve ser aplicado exclusivamente por migration explicita.');
phase05Assert(is_file($readerAnnotationMigrationPath) && str_contains((string) file_get_contents($readerAnnotationMigrationPath), 'applySchemaMigration'), 'Persistencia do leitor deve ser aplicada por migration explicita.');

echo "LegalCommentaryPhase05WiringTest OK\n";
