<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$migration = file_get_contents($root . '/database/migrations/20260819_130000_public_simulations.php');
$rollback = file_get_contents($root . '/database/rollbacks/20260819_130000_public_simulations.sql');
$repository = file_get_contents($root . '/modules/simulations/public/PublicSimulationsRepository.php');
$projection = file_get_contents($root . '/modules/simulations/public/PublicSimulationProjection.php');
$service = file_get_contents($root . '/modules/simulations/public/PublicSimulationsService.php');
$reporter = file_get_contents($root . '/modules/seo/reports/PublicSimulationReadinessReporter.php');
$assert = static function (bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); };

$assert(str_contains($migration, 'CREATE TABLE IF NOT EXISTS public_simulations'), 'Canonical public simulation table missing.');
$assert(str_contains($migration, 'CREATE TABLE IF NOT EXISTS public_simulation_questions'), 'Explicit question composition missing.');
$assert(str_contains($migration, 'PRIMARY KEY (simulation_id, question_id)'), 'A question must not repeat inside one simulation.');
$assert(str_contains($migration, 'UNIQUE KEY uq_public_simulation_question_position (simulation_id, position)'), 'Question positions must be unique and deterministic.');
$assert(str_contains($migration, "DEFAULT 'draft'") && str_contains($migration, "DEFAULT 'internal'"), 'New simulations must fail closed.');
$assert(!preg_match('/\bINSERT\s+INTO|\bDELETE\s+FROM|\$db->exec\(["\']UPDATE\s/i', $migration), 'Migration must not backfill simulations.');
$assert(substr_count($migration, 'ON DELETE RESTRICT') >= 9, 'Simulation relations must be non-destructive.');
$assert(substr_count($rollback, 'DROP TABLE IF EXISTS') === 6, 'Rollback must remove only the six new tables.');
$assert(str_contains($repository, "publication_status = 'published'") && str_contains($repository, "visibility_status = 'public'"), 'Public repository must enforce publication and visibility.');
$assert(str_contains($repository, 'Unlisted is intentionally nonpublic') && str_contains($repository, 'explicit editorial promotion'), 'Unlisted and scheduled publication semantics must remain explicit.');
$assert(str_contains($repository, 'public_simulation_questions') && str_contains($repository, 'sq.position'), 'Composition and stable ordering must be explicit.');
$assert(!str_contains($repository, 'user_answers') && !str_contains($repository, 'FROM simulations '), 'Public catalog must not read attempts.');
$assert(str_contains($service, "['label' => 'Simulados'") && str_contains($service, "'/simulation'"), 'Canonical breadcrumbs and real practice route must be wired.');
$assert(!str_contains($projection, 'correctAnswer') && !str_contains($projection, 'user_id') && !str_contains($projection, 'score'), 'Projection leaked attempt or answer fields.');
$assert(!preg_match('/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bDROP\b/i', $reporter), 'Reporter must be read-only.');

require_once $root . '/modules/simulations/public/PublicSimulationReadinessValidator.php';
require_once $root . '/modules/simulations/public/PublicSimulationProjection.php';
$ready = PublicSimulationReadinessValidator::evaluate(['id'=>1,'slug'=>'simulado-publico','title'=>'Simulado Público','publication_status'=>'published','visibility_status'=>'public','question_count'=>1]);
$assert($ready['status'] === 'READY', 'One explicit public question is a functionally valid composition.');
$empty = PublicSimulationReadinessValidator::evaluate(['id'=>1,'slug'=>'simulado-publico','title'=>'Simulado Público','publication_status'=>'published','visibility_status'=>'public','question_count'=>0]);
$assert($empty['status'] === 'NOT_READY' && in_array('instance_readiness.invalid_definition', $empty['reasonCodes'], true), 'Zero-question definition must be NOT_READY without arbitrary volume threshold.');
$private = PublicSimulationReadinessValidator::evaluate(['id'=>1,'slug'=>'simulado-privado','title'=>'Privado','publication_status'=>'draft','visibility_status'=>'private','question_count'=>1]);
$assert(in_array('instance_readiness.publication_blocked', $private['reasonCodes'], true), 'Draft/private simulation must be blocked.');
$unavailable = PublicSimulationReadinessValidator::evaluate(['id'=>1,'slug'=>'simulado-indisponivel','title'=>'Indisponivel','publication_status'=>'published','visibility_status'=>'public','availability_status'=>'unavailable','question_count'=>1]);
$retired = PublicSimulationReadinessValidator::evaluate(['id'=>1,'slug'=>'simulado-historico','title'=>'Historico','publication_status'=>'published','visibility_status'=>'public','availability_status'=>'retired','question_count'=>1]);
$assert($unavailable['status'] === 'READY' && $retired['status'] === 'READY', 'Availability must control the CTA without erasing a valid historical landing.');
$payload = PublicSimulationProjection::detail(['simulation'=>['id'=>1,'slug'=>'publico','title'=>'Publico','publication_status'=>'published','visibility_status'=>'public'],'questionCount'=>1,'canonicalPath'=>'/simulados/publico','questions'=>[['id'=>1,'excerpt'=>'Texto público','position'=>1,'path'=>'/questoes/1/texto','correctAnswer'=>'SECRET','user_id'=>'user']], 'readiness'=>$ready]);
$encoded = json_encode($payload);
$assert(is_string($encoded) && !str_contains($encoded, 'SECRET') && !str_contains($encoded, 'user_id'), 'Projection allowlist leaked protected fields.');
echo "PublicSimulationsTest: PASS\n";
