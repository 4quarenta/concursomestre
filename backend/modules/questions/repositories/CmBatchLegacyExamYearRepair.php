<?php
declare(strict_types=1);

/** Narrow repair for a legacy PDF import that used the catalog year instead of the exam date. */
final class CmBatchLegacyExamYearRepair
{
    public static function apply(PDO $db, array $existing, array $incoming, string $provider, string $externalId, string $jobId): array
    {
        $old = json_decode((string)($existing['metadata_json'] ?? ''), true) ?: [];
        $new = json_decode((string)($incoming['metadata_json'] ?? ''), true) ?: [];
        $document = $new['sourceDocument'] ?? [];
        $identity = $document['identity'] ?? [];
        $source = $document['source'] ?? [];
        $date = (string)($document['metadata']['dataProva'] ?? '');
        $oldYear = (int)$existing['ano'];
        $newYear = (int)$incoming['ano'];
        $verifiedDate = false;
        foreach ($document['evidence'] ?? [] as $evidence) {
            if (($evidence['field'] ?? '') === 'dataProva' && ($evidence['status'] ?? '') === 'verified'
                && ($evidence['value'] ?? '') === $date && trim((string)($evidence['source'] ?? '')) !== '') $verifiedDate = true;
        }
        $expectedTitle = preg_replace('/\b'.preg_quote((string)$oldYear, '/').'\s*$/u', (string)$newYear, (string)$existing['nome']);
        $validDate = preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $parts) === 1
            && checkdate((int)$parts[2], (int)$parts[3], (int)$parts[1]) && (int)$parts[1] === $newYear;
        if (($old['source'] ?? '') !== 'bulk_import_pdf' || ($old['sourceProvider'] ?? '') !== $provider
            || (string)($old['sourceExternalId'] ?? '') !== $externalId
            || ($source['provider'] ?? '') !== $provider || (string)($source['externalExamId'] ?? '') !== $externalId
            || (int)($identity['originalYear'] ?? 0) !== $oldYear || (int)($identity['canonicalYear'] ?? 0) !== $newYear
            || ($source['catalogNameOriginal'] ?? '') !== $existing['nome']
            || $expectedTitle !== ($incoming['nome'] ?? '') || !$validDate || !$verifiedDate) {
            throw new DomainException('Ano oficial diverge da prova existente: ID CM '.(int)$existing['id'].', cadastrado '.$oldYear.', recebido '.$newYear.'. Evidencia insuficiente para corrigir automaticamente.');
        }
        // A subsequent human/batch edit must not be overwritten by this legacy repair.
        $history = $db->prepare("SELECT COUNT(*) FROM cm_batch_field_audit WHERE entity_type='exam' AND canonical_entity_id=:id AND field_name IN ('ano','nome') AND status='applied'");
        $history->execute([':id'=>(string)$existing['id']]);
        if ((int)$history->fetchColumn() > 0) throw new DomainException('Ano da prova possui alteracao auditada posterior; revisao necessaria.');
        $audit = $db->prepare("INSERT INTO cm_batch_field_audit (job_id,entity_type,canonical_entity_id,field_name,before_json,after_json,source_evidence_json,actor_user_id,merge_reason,status) VALUES (:job,'exam',:id,:field,:before,:after,:evidence,:actor,'repair_legacy_catalog_year_from_verified_exam_date','applied')");
        foreach (['ano'=>$newYear,'nome'=>$incoming['nome']] as $field=>$value) {
            $audit->execute([':job'=>$jobId, ':id'=>(string)$existing['id'], ':field'=>$field,
                ':before'=>json_encode($existing[$field], JSON_THROW_ON_ERROR), ':after'=>json_encode($value, JSON_THROW_ON_ERROR),
                ':evidence'=>json_encode($document['evidence'], JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),
                ':actor'=>(string)($incoming['updated_by_user_id'] ?? 'system')]);
            $existing[$field] = $value;
        }
        $db->prepare('UPDATE provas SET ano=:year,nome=:name WHERE id=:id')->execute([':year'=>$newYear, ':name'=>$incoming['nome'], ':id'=>$existing['id']]);
        return $existing;
    }
}
