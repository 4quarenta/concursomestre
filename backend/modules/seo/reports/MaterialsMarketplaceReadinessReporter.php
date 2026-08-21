<?php

declare(strict_types=1);

/** Relatorio agregado e somente leitura para a carga editorial de Materiais. */
final class MaterialsMarketplaceReadinessReporter
{
    public function __construct(private readonly PDO $db) {}

    /** @return array<string,mixed> */
    public function generate(): array
    {
        return [
            'generatedAt' => (new DateTimeImmutable('now'))->format(DATE_ATOM),
            'states' => $this->states(),
            'readiness' => $this->readiness(),
            'integrity' => $this->integrity(),
            'offers' => $this->offers(),
            'assets' => $this->assets(),
            'duplicateCanonicalSlugs' => $this->duplicateCanonicalSlugs(),
            'notes' => [
                'report_only' => true,
                'material_and_commercial_offer_are_distinct_concepts' => true,
                'volume_is_not_an_instance_readiness_gate' => true,
                'temporary_dataset_is_not_a_family_eligibility_gate' => true,
            ],
        ];
    }

    /** @return array<string,int> */
    private function readiness(): array
    {
        $materialReady = "status='approved' AND publication_status='published' AND visibility_status='public'
            AND rights_status='approved' AND archived_at IS NULL AND (scheduled_at IS NULL OR scheduled_at<=NOW())
            AND TRIM(title)<>'' AND BINARY slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$' AND CHAR_LENGTH(slug)<=190
            AND EXISTS (SELECT 1 FROM material_uploads upload WHERE upload.attached_material_id=materials.id AND upload.status='attached')";
        $listingReady = "({$materialReady}) AND (availability_status='included_in_plan'
            OR (availability_status='available' AND ((is_free=1 AND (price IS NULL OR price=0))
                OR (is_free=0 AND price>0 AND BINARY currency='BRL'))))";
        $sql = "SELECT COUNT(*) materials_total,
                    SUM(CASE WHEN {$materialReady} THEN 1 ELSE 0 END) materials_ready,
                    SUM(CASE WHEN NOT ({$materialReady}) THEN 1 ELSE 0 END) materials_not_ready,
                    SUM(CASE WHEN availability_status IN ('available','included_in_plan') THEN 1 ELSE 0 END) listing_candidates,
                    SUM(CASE WHEN {$listingReady} THEN 1 ELSE 0 END) listings_ready,
                    SUM(CASE WHEN availability_status IN ('available','included_in_plan') AND NOT ({$listingReady}) THEN 1 ELSE 0 END) listings_not_ready
                FROM materials";
        $row = $this->db->query($sql)->fetch(PDO::FETCH_ASSOC) ?: [];
        return array_map('intval', $row);
    }

    /** @return list<array<string,mixed>> */
    private function states(): array
    {
        $sql = "SELECT status, publication_status, visibility_status, rights_status,
                       availability_status, COUNT(*) total
                  FROM materials
              GROUP BY status, publication_status, visibility_status, rights_status, availability_status
              ORDER BY status, publication_status, visibility_status, rights_status, availability_status";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** @return array<string,int> */
    private function integrity(): array
    {
        $sql = "SELECT COUNT(*) total,
                    SUM(CASE WHEN TRIM(title)='' THEN 1 ELSE 0 END) missing_title,
                    SUM(CASE WHEN slug IS NULL OR BINARY slug NOT REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$' OR CHAR_LENGTH(slug)>190 THEN 1 ELSE 0 END) invalid_slug,
                    SUM(CASE WHEN publication_status='published' AND visibility_status='public' AND rights_status<>'approved' THEN 1 ELSE 0 END) public_without_approved_rights,
                    SUM(CASE WHEN publication_status='published' AND visibility_status='public' AND status<>'approved' THEN 1 ELSE 0 END) public_without_moderation_approval,
                    SUM(CASE WHEN availability_status='available' AND is_free=0 AND (price IS NULL OR price<=0 OR BINARY currency<>'BRL') THEN 1 ELSE 0 END) invalid_paid_offer,
                    SUM(CASE WHEN availability_status='unavailable' THEN 1 ELSE 0 END) unavailable_offers,
                    SUM(CASE WHEN is_free=1 AND price IS NOT NULL AND price<>0 THEN 1 ELSE 0 END) contradictory_free_price,
                    SUM(CASE WHEN preview_is_public=0 OR preview_url IS NULL OR TRIM(preview_url)='' THEN 1 ELSE 0 END) missing_public_preview,
                    SUM(CASE WHEN (cover_is_public=1 AND LOWER(TRIM(cover_url)) NOT LIKE 'https://%') OR (preview_is_public=1 AND LOWER(TRIM(preview_url)) NOT LIKE 'https://%') THEN 1 ELSE 0 END) unsafe_public_url_scheme,
                    SUM(CASE WHEN subject_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM filters subject WHERE subject.id=materials.subject_id AND subject.type='assunto') THEN 1 ELSE 0 END) invalid_subject_relation,
                    SUM(CASE WHEN topic_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM filters topic WHERE topic.id=materials.topic_id AND topic.type='assunto') THEN 1 ELSE 0 END) invalid_topic_relation
                FROM materials";
        $row = $this->db->query($sql)->fetch(PDO::FETCH_ASSOC) ?: [];
        return array_map('intval', $row);
    }

    /** @return list<array<string,mixed>> */
    private function offers(): array
    {
        $sql = "SELECT availability_status, is_free, currency, COUNT(*) total
                  FROM materials
              GROUP BY availability_status, is_free, currency
              ORDER BY availability_status, is_free, currency";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** @return array<string,int> */
    private function assets(): array
    {
        $sql = "SELECT
                    COUNT(*) materials_total,
                    SUM(CASE WHEN EXISTS (SELECT 1 FROM material_uploads upload WHERE upload.attached_material_id=materials.id AND upload.status='attached') THEN 1 ELSE 0 END) with_attached_asset,
                    SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM material_uploads upload WHERE upload.attached_material_id=materials.id AND upload.status='attached') THEN 1 ELSE 0 END) without_attached_asset,
                    SUM(CASE WHEN cover_is_public=1 AND (cover_url IS NULL OR TRIM(cover_url)='') THEN 1 ELSE 0 END) invalid_public_cover,
                    SUM(CASE WHEN preview_is_public=1 AND (preview_url IS NULL OR TRIM(preview_url)='') THEN 1 ELSE 0 END) invalid_public_preview
                FROM materials";
        $row = $this->db->query($sql)->fetch(PDO::FETCH_ASSOC) ?: [];
        $result = array_map('intval', $row);
        $result['orphan_attached_assets'] = (int) $this->db->query("SELECT COUNT(*) FROM material_uploads upload
            LEFT JOIN materials material ON material.id=upload.attached_material_id
            WHERE upload.status='attached' AND upload.attached_material_id IS NOT NULL AND material.id IS NULL")->fetchColumn();
        return $result;
    }

    /** @return list<array{slug:string,total:int}> */
    private function duplicateCanonicalSlugs(): array
    {
        $rows = $this->db->query("SELECT slug, COUNT(*) total FROM materials
            WHERE slug IS NOT NULL AND TRIM(slug)<>''
            GROUP BY slug HAVING COUNT(*)>1 ORDER BY total DESC,slug LIMIT 100")->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(static fn (array $row): array => [
            'slug' => (string) $row['slug'],
            'total' => (int) $row['total'],
        ], $rows);
    }
}
