<?php
declare(strict_types=1);
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/questions/services/CompletedIngestionRecord.php';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$execute = in_array('--execute=COMPACT_COMPLETED_INGESTION', $argv, true);
$db = (new Database())->getConnection();
$maximum = (int) $db->query('SELECT COALESCE(MAX(id),0) FROM private_ingestion_jobs')->fetchColumn();
$cursor = 0;
$report = ['mode' => $execute ? 'execute' : 'dry-run', 'snapshot' => $maximum, 'scanned' => 0, 'changed' => 0, 'bytes_removed' => 0];
while (true) {
    $stmt = $db->prepare("SELECT id FROM private_ingestion_jobs WHERE status = 'done' AND id > :cursor AND id <= :maximum ORDER BY id LIMIT 50");
    $stmt->execute([':cursor' => $cursor, ':maximum' => $maximum]);
    $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
    if (!$ids) break;
    foreach ($ids as $id) {
        $cursor = (int) $id;
        $db->beginTransaction();
        try {
            $stmt = $db->prepare("SELECT request_id,payload_json,result_json FROM private_ingestion_jobs WHERE id=:id AND status='done' FOR UPDATE");
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) { $db->rollBack(); continue; }
            $report['scanned']++;
            $payload = json_decode($row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
            $result = json_decode($row['result_json'] ?? '{}', true, 512, JSON_THROW_ON_ERROR);
            $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR;
            $compactPayload = json_encode(CompletedIngestionRecord::payload($payload, $result), $flags);
            $compactResult = json_encode(CompletedIngestionRecord::result($result), $flags);
            $stmt = $db->prepare("SELECT response_json FROM private_ingestion_requests WHERE id=:id AND status='done' FOR UPDATE");
            $stmt->execute([':id' => $row['request_id']]);
            $response = $stmt->fetchColumn();
            $compactResponse = $response === false || $response === null ? $response : json_encode(CompletedIngestionRecord::result(json_decode($response, true, 512, JSON_THROW_ON_ERROR)), $flags);
            $saved = max(0, strlen($row['payload_json']) - strlen($compactPayload)) + max(0, strlen($row['result_json'] ?? '') - strlen($compactResult)) + max(0, strlen((string) $response) - strlen((string) $compactResponse));
            if ($saved > 0) {
                $report['changed']++;
                $report['bytes_removed'] += $saved;
                if ($execute) {
                    $stmt = $db->prepare("UPDATE private_ingestion_jobs SET payload_json=:payload,result_json=:result WHERE id=:id AND status='done'");
                    $stmt->execute([':payload' => $compactPayload, ':result' => $compactResult, ':id' => $id]);
                    if ($response !== false && $response !== null) {
                        $stmt = $db->prepare("UPDATE private_ingestion_requests SET response_json=:response WHERE id=:id AND status='done'");
                        $stmt->execute([':response' => $compactResponse, ':id' => $row['request_id']]);
                    }
                }
            }
            $execute ? $db->commit() : $db->rollBack();
        } catch (Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            fwrite(STDERR, 'Compaction stopped at job ' . $cursor . '; no payload logged.' . PHP_EOL);
            exit(1);
        }
    }
}
echo json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL;
