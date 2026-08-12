<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Esta tarefa so pode ser executada via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/questions/services/GranQuestionAssetMaterializer.php';
require_once __DIR__ . '/../../modules/questions/services/QuestionPublicPageCache.php';

$apply = in_array('--apply', $argv, true);
$limit = 250;
$afterId = 0;
foreach ($argv as $argument) {
    if (preg_match('/^--limit=(\d+)$/', $argument, $matches) === 1) {
        $limit = max(1, min(1000, (int) $matches[1]));
    }
    if (preg_match('/^--after-id=(\d+)$/', $argument, $matches) === 1) {
        $afterId = max(0, (int) $matches[1]);
    }
}

$db = (new Database())->getConnection();
$materializer = new GranQuestionAssetMaterializer();
$stmt = $db->prepare(
    "SELECT id, public_url, storage_path, metadata_json
     FROM question_assets
     WHERE id > :after_id
       AND public_url LIKE 'https://arquivos.infra-questoes.grancursosonline.com.br/%'
     ORDER BY id ASC
     LIMIT {$limit}"
);
$stmt->bindValue(':after_id', $afterId, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

$result = [
    'mode' => $apply ? 'apply' : 'dry-run',
    'canonicalAssetsExamined' => count($rows),
    'canonicalAssetsMaterialized' => 0,
    'questionSnapshotsMaterialized' => 0,
    'legacyContextsMaterialized' => 0,
    'failures' => [],
    'lastAssetId' => $afterId,
];
$update = $db->prepare(
    'UPDATE question_assets
     SET public_url = :public_url,
         storage_path = :storage_path,
         metadata_json = :metadata_json,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = :id
       AND public_url = :expected_url'
);

foreach ($rows as $row) {
    $assetId = (int) ($row['id'] ?? 0);
    $sourceUrl = trim((string) ($row['public_url'] ?? ''));
    $result['lastAssetId'] = max($result['lastAssetId'], $assetId);
    if (!$apply) {
        continue;
    }
    try {
        $asset = $materializer->materializeAsset([
            'url' => $sourceUrl,
            'storagePath' => $row['storage_path'] ?? null,
        ]);
        $existingMetadata = json_decode((string) ($row['metadata_json'] ?? ''), true);
        $metadata = is_array($existingMetadata) ? $existingMetadata : [];
        foreach (['mimeType', 'size', 'storageDriver', 'sourceProvider', 'sourceUrlHash', 'status', 'materializedAt'] as $key) {
            if (array_key_exists($key, $asset)) {
                $metadata[$key] = $asset[$key];
            }
        }
        $update->execute([
            ':public_url' => (string) ($asset['url'] ?? ''),
            ':storage_path' => (string) ($asset['storagePath'] ?? ''),
            ':metadata_json' => json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            ':id' => $assetId,
            ':expected_url' => $sourceUrl,
        ]);
        if ($update->rowCount() === 1) {
            $result['canonicalAssetsMaterialized']++;
        }
    } catch (Throwable $exception) {
        $result['failures'][] = [
            'assetId' => $assetId,
            'message' => $exception->getMessage(),
        ];
    }
}

$questionSnapshots = $db->query(
    "SELECT id, data_json
     FROM questions
     WHERE data_json LIKE '%arquivos.infra-questoes.grancursosonline.com.br%'
     ORDER BY id ASC
     LIMIT {$limit}"
)->fetchAll(PDO::FETCH_ASSOC) ?: [];
$updateQuestionSnapshot = $db->prepare(
    'UPDATE questions SET data_json = :data_json, updated_at = CURRENT_TIMESTAMP WHERE id = :id'
);
foreach ($questionSnapshots as $row) {
    if (!$apply) {
        continue;
    }
    try {
        $data = json_decode((string) ($row['data_json'] ?? ''), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($data)) {
            continue;
        }
        $sourceUrl = trim((string) ($data['imageUrl'] ?? $data['image_url'] ?? ''));
        if ($sourceUrl === '') {
            continue;
        }
        $asset = $materializer->materializeAsset(['url' => $sourceUrl]);
        $data['imageUrl'] = (string) ($asset['url'] ?? '');
        unset($data['image_url']);
        $updateQuestionSnapshot->execute([
            ':data_json' => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            ':id' => (int) $row['id'],
        ]);
        $result['questionSnapshotsMaterialized'] += $updateQuestionSnapshot->rowCount();
    } catch (Throwable $exception) {
        $result['failures'][] = [
            'questionId' => (int) ($row['id'] ?? 0),
            'message' => $exception->getMessage(),
        ];
    }
}

$legacyContexts = $db->query(
    "SELECT id, image_url, assets_json
     FROM questions_groups
     WHERE assets_json LIKE '%arquivos.infra-questoes.grancursosonline.com.br%'
        OR image_url LIKE 'https://arquivos.infra-questoes.grancursosonline.com.br/%'
     ORDER BY id ASC
     LIMIT {$limit}"
)->fetchAll(PDO::FETCH_ASSOC) ?: [];
$updateLegacyContext = $db->prepare(
    'UPDATE questions_groups
     SET image_url = :image_url, assets_json = :assets_json, updated_at = CURRENT_TIMESTAMP
     WHERE id = :id'
);
foreach ($legacyContexts as $row) {
    if (!$apply) {
        continue;
    }
    try {
        $assets = json_decode((string) ($row['assets_json'] ?? ''), true);
        $assets = is_array($assets) ? $assets : [];
        $materializedAssets = [];
        foreach ($assets as $asset) {
            if (is_array($asset)) {
                $materializedAssets[] = $materializer->materializeAsset($asset);
            }
        }
        $imageUrl = trim((string) ($row['image_url'] ?? ''));
        if ($imageUrl !== '' && str_starts_with($imageUrl, 'https://arquivos.infra-questoes.grancursosonline.com.br/')) {
            $imageUrl = (string) ($materializer->materializeAsset(['url' => $imageUrl])['url'] ?? '');
        }
        if ($imageUrl === '' && isset($materializedAssets[0]['url'])) {
            $imageUrl = (string) $materializedAssets[0]['url'];
        }
        $updateLegacyContext->execute([
            ':image_url' => $imageUrl !== '' ? $imageUrl : null,
            ':assets_json' => json_encode($materializedAssets, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            ':id' => (int) $row['id'],
        ]);
        $result['legacyContextsMaterialized'] += $updateLegacyContext->rowCount();
    } catch (Throwable $exception) {
        $result['failures'][] = [
            'contextId' => (int) ($row['id'] ?? 0),
            'message' => $exception->getMessage(),
        ];
    }
}

$result['remainingExternalReferences'] = (int) $db->query(
    "SELECT
        (SELECT COUNT(*) FROM question_assets WHERE public_url LIKE 'https://arquivos.infra-questoes.grancursosonline.com.br/%')
      + (SELECT COUNT(*) FROM questions WHERE data_json LIKE '%arquivos.infra-questoes.grancursosonline.com.br%')
      + (SELECT COUNT(*) FROM questions_groups WHERE assets_json LIKE '%arquivos.infra-questoes.grancursosonline.com.br%' OR image_url LIKE 'https://arquivos.infra-questoes.grancursosonline.com.br/%')"
)->fetchColumn();

if ($apply && (
    $result['canonicalAssetsMaterialized'] > 0
    || $result['questionSnapshotsMaterialized'] > 0
    || $result['legacyContextsMaterialized'] > 0
)) {
    QuestionPublicPageCache::fromEnvironment()->invalidate();
}
$result['finishedAt'] = gmdate('c');
fwrite(STDOUT, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
