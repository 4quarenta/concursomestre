<?php

declare(strict_types=1);

function granCheckpointAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$root = dirname(__DIR__);
$service = (string) file_get_contents($root . '/modules/admin/services/AdminGranCrawlerService.php');
$route = (string) file_get_contents($root . '/modules/admin/gran_crawler_routes.php');
$rateLimiter = (string) file_get_contents($root . '/shared/middleware/RateLimiter.php');
$migration = (string) file_get_contents($root . '/database/migrations/20260808_191500_gran_automatic_crawler_checkpoint.php');
$rollback = (string) file_get_contents($root . '/database/rollbacks/20260808_191500_gran_automatic_crawler_checkpoint.sql');

granCheckpointAssert(str_contains($migration, 'CREATE TABLE IF NOT EXISTS gran_automatic_crawler_checkpoints'), 'Migration do checkpoint ausente.');
granCheckpointAssert(str_contains($migration, 'actor_user_id VARCHAR(80) NOT NULL'), 'Checkpoint deve ser isolado por administrador.');
granCheckpointAssert(!str_contains(strtolower($migration), 'authorization'), 'Checkpoint nao pode armazenar credencial da Gran.');
granCheckpointAssert(str_contains($rollback, 'DROP TABLE IF EXISTS gran_automatic_crawler_checkpoints'), 'Rollback do checkpoint ausente.');
granCheckpointAssert(str_contains($service, 'public function getAutomaticCheckpoint'), 'Leitura do checkpoint ausente.');
granCheckpointAssert(str_contains($service, 'public function saveAutomaticCheckpoint'), 'Persistencia do checkpoint ausente.');
granCheckpointAssert(str_contains($service, 'public function clearAutomaticCheckpoint'), 'Limpeza do checkpoint ausente.');
granCheckpointAssert(str_contains($service, 'ON DUPLICATE KEY UPDATE'), 'Checkpoint precisa ser idempotente.');
granCheckpointAssert(str_contains($route, "'save_automatic_checkpoint'"), 'Rota de salvar checkpoint ausente.');
granCheckpointAssert(str_contains($route, "'clear_automatic_checkpoint'"), 'Rota de limpar checkpoint ausente.');
granCheckpointAssert(str_contains($rateLimiter, "'admin_crawler_mapping' => ['max' => 600, 'window' => 900]"), 'Perfil paginado do crawler ausente.');
granCheckpointAssert(str_contains($rateLimiter, "'admin_crawler_checkpoint' => ['max' => 1200, 'window' => 900]"), 'Perfil de checkpoint ausente.');
granCheckpointAssert(str_contains($route, "RateLimiter::enforceProfile('admin_crawler_mapping', \$actorUserId);"), 'Mapeamento deve usar perfil paginado.');
granCheckpointAssert(str_contains($route, "RateLimiter::enforceProfile('admin_crawler_checkpoint', \$actorUserId);"), 'Checkpoint deve usar perfil dedicado.');

echo "AdminGranAutomaticCheckpointWiringTest: PASS\n";
