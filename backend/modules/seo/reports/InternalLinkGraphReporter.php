<?php

declare(strict_types=1);

/** Audita contratos e integridade relacional sem alterar o dataset. */
final class InternalLinkGraphReporter
{
    /** @param array<string,mixed> $contract */
    public function __construct(
        private readonly PDO $db,
        private readonly array $contract,
        private readonly array $productionMap,
    ) {}

    /** @return array<string,mixed> */
    public function generate(): array
    {
        $contract = $this->contractAudit();
        return [
            'generatedAt' => (new DateTimeImmutable('now'))->format(DATE_ATOM),
            'contract' => $contract,
            'relationIntegrity' => $this->relationIntegrity(),
            'graph' => [
                'approvedRelations' => $contract['relationMatrix'],
                'rejectedInferences' => $this->contract['rejectedInferences'] ?? [],
            ],
            'reporterCapabilities' => [
                'contract_and_authority_matrix' => 'runtime',
                'relation_integrity' => 'read_only_database',
                'orphan_and_target_integrity' => 'fixture_and_harness; real dataset gate required',
                'breadcrumb_integrity' => 'fixture_and_harness; real dataset gate required',
                'structured_data_integrity' => 'fixture_and_harness; real dataset gate required',
            ],
            'realDataGates' => $this->contract['futureGates'] ?? [],
            'notes' => [
                'read_only' => true,
                'temporary_dataset_is_not_a_family_eligibility_gate' => true,
                'sitemap_is_not_an_orphan_substitute' => true,
            ],
        ];
    }

    /** @return array<string,mixed> */
    private function contractAudit(): array
    {
        $pageFamilies = [];
        foreach ($this->productionMap['families'] ?? [] as $family) {
            $pageFamilies[(string) ($family['familyId'] ?? '')] = $family;
        }
        $graphFamilies = [];
        $errors = [];
        foreach ($this->contract['families'] ?? [] as $family) {
            $id = (string) ($family['familyId'] ?? '');
            if ($id === '' || isset($graphFamilies[$id])) $errors[] = 'duplicate_or_empty_family:' . $id;
            $graphFamilies[$id] = $family;
            if (!isset($pageFamilies[$id])) $errors[] = 'family_missing_from_page_map:' . $id;
            $routePatterns = is_array($pageFamilies[$id]['routePatterns'] ?? null)
                ? $pageFamilies[$id]['routePatterns']
                : [];
            if (isset($pageFamilies[$id]) && !in_array((string) ($family['canonicalRoute'] ?? ''), $routePatterns, true)) {
                $errors[] = 'canonical_route_mismatch:' . $id;
            }
        }
        $relationMatrix = [];
        foreach ($this->contract['approvedRelations'] ?? [] as $relation) {
            $source = (string) ($relation['sourceFamily'] ?? '');
            $target = (string) ($relation['targetFamily'] ?? '');
            $brokenContract = !isset($graphFamilies[$source]) || !isset($graphFamilies[$target]);
            if ($brokenContract) {
                $errors[] = 'relation_family_missing:' . $source . '->' . $target;
            }
            if (trim((string) ($relation['authority'] ?? '')) === '') {
                $errors[] = 'relation_authority_missing:' . (string) ($relation['relation'] ?? '');
            }
            $targetPolicy = $pageFamilies[$target] ?? [];
            $relationMatrix[] = [
                ...$relation,
                'targetCanonicalRoute' => $graphFamilies[$target]['canonicalRoute'] ?? null,
                'targetReadinessRule' => $targetPolicy['instanceReadinessRule'] ?? null,
                'targetFamilyEligibility' => $targetPolicy['familyEligibility'] ?? null,
                'targetProductionIndexability' => $targetPolicy['targetProductionIndexability'] ?? null,
                'targetSitemapStatus' => $targetPolicy['sitemapTarget'] ?? null,
                'knownAliasOrRedirectTarget' => false,
                'brokenContract' => $brokenContract,
            ];
        }
        if (count($graphFamilies) !== 44) $errors[] = 'family_count_mismatch:' . count($graphFamilies);
        if (count($relationMatrix) !== 67) $errors[] = 'relation_count_mismatch:' . count($relationMatrix);
        if (count($this->contract['rejectedInferences'] ?? []) !== 9) {
            $errors[] = 'rejected_inference_count_mismatch:' . count($this->contract['rejectedInferences'] ?? []);
        }
        return [
            'status' => $errors === [] ? 'PASS' : 'FAIL',
            'familyCount' => count($graphFamilies),
            'relationCount' => count($relationMatrix),
            'rejectedInferenceCount' => count($this->contract['rejectedInferences'] ?? []),
            'relationMatrix' => $relationMatrix,
            'errors' => $errors,
        ];
    }

    /** @return list<array<string,mixed>> */
    private function relationIntegrity(): array
    {
        $definitions = [
            ['contest_organizations', 'contest_id', 'contests', 'organization_filter_id', 'filters'],
            ['contest_positions', 'contest_id', 'contests', 'role_filter_id', 'filters'],
            ['contest_exams', 'contest_id', 'contests', 'prova_id', 'provas'],
            ['public_simulation_contests', 'simulation_id', 'public_simulations', 'contest_id', 'contests'],
            ['public_simulation_exams', 'simulation_id', 'public_simulations', 'prova_id', 'provas'],
        ];
        $output = [];
        foreach ($definitions as [$relation, $sourceKey, $sourceTable, $targetKey, $targetTable]) {
            if (!$this->tableExists($relation) || !$this->tableExists($sourceTable) || !$this->tableExists($targetTable)) {
                $output[] = ['relation' => $relation, 'status' => 'NOT_EVALUATED', 'reason' => 'schema_absent'];
                continue;
            }
            $sql = sprintf(
                'SELECT COUNT(*) total, '
                . 'SUM(CASE WHEN source.id IS NULL THEN 1 ELSE 0 END) orphan_source, '
                . 'SUM(CASE WHEN target.id IS NULL THEN 1 ELSE 0 END) orphan_target '
                . 'FROM `%s` relation_row '
                . 'LEFT JOIN `%s` source ON source.id=relation_row.`%s` '
                . 'LEFT JOIN `%s` target ON target.id=relation_row.`%s`',
                $relation,
                $sourceTable,
                $sourceKey,
                $targetTable,
                $targetKey,
            );
            $row = $this->db->query($sql)->fetch(PDO::FETCH_ASSOC) ?: [];
            $output[] = [
                'relation' => $relation,
                'status' => ((int) ($row['orphan_source'] ?? 0) + (int) ($row['orphan_target'] ?? 0)) === 0 ? 'PASS' : 'FAIL',
                'total' => (int) ($row['total'] ?? 0),
                'orphanSource' => (int) ($row['orphan_source'] ?? 0),
                'orphanTarget' => (int) ($row['orphan_target'] ?? 0),
            ];
        }
        return $output;
    }

    private function tableExists(string $table): bool
    {
        $statement = $this->db->prepare(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=:table_name'
        );
        $statement->execute(['table_name' => $table]);
        return (int) $statement->fetchColumn() === 1;
    }

    /**
     * @param list<array<string,mixed>> $nodes
     * @param list<array<string,mixed>> $links
     * @param list<array<string,mixed>> $pages
     * @return array<string,mixed>
     */
    public static function auditFixture(array $nodes, array $links, array $pages, array $limits = []): array
    {
        $byId = [];
        foreach ($nodes as $node) $byId[(string) ($node['id'] ?? '')] = $node;
        $incoming = [];
        $broken = $nonpublic = $aliases = $redirects = $duplicates = [];
        $seen = [];
        $relationCounts = [];
        foreach ($links as $link) {
            if (($link['structural'] ?? true) !== true) continue;
            $source = (string) ($link['source'] ?? '');
            $target = (string) ($link['target'] ?? '');
            $key = $source . '|' . $target . '|' . (string) ($link['href'] ?? '');
            if (isset($seen[$key])) $duplicates[] = $key;
            $seen[$key] = true;
            if (!isset($byId[$source]) || !isset($byId[$target])) {
                $broken[] = $key;
                continue;
            }
            $incoming[$target] = true;
            if (($byId[$target]['public'] ?? false) !== true) $nonpublic[] = $key;
            if (($byId[$target]['alias'] ?? false) === true) $aliases[] = $key;
            if (($link['redirect'] ?? false) === true) $redirects[] = $key;
            $relation = (string) ($link['relation'] ?? 'unknown');
            $relationCounts[$source . '|' . $relation] = ($relationCounts[$source . '|' . $relation] ?? 0) + 1;
        }
        $excessive = [];
        foreach ($relationCounts as $key => $total) {
            [, $relation] = explode('|', $key, 2);
            if (isset($limits[$relation]) && $total > (int) $limits[$relation]) $excessive[$key] = $total;
        }
        $orphans = [];
        foreach ($nodes as $node) {
            $id = (string) ($node['id'] ?? '');
            $family = (string) ($node['family'] ?? '');
            if (($node['ready'] ?? false) === true && ($node['indexable'] ?? false) === true
                && ($node['public'] ?? false) === true && ($node['orphanCandidate'] ?? true) === true
                && !str_ends_with($family, '_hub') && $family !== 'home' && !isset($incoming[$id])) {
                $orphans[] = $id;
            }
        }
        $breadcrumbMismatch = $breadcrumbErrors = $schemaErrors = [];
        foreach ($pages as $page) {
            $id = (string) ($page['id'] ?? 'page');
            $visual = is_array($page['visualBreadcrumb'] ?? null) ? $page['visualBreadcrumb'] : [];
            $jsonLd = is_array($page['jsonLdBreadcrumb'] ?? null) ? $page['jsonLdBreadcrumb'] : [];
            $expectedBreadcrumb = is_array($page['expectedBreadcrumb'] ?? null) ? $page['expectedBreadcrumb'] : null;
            if (($page['breadcrumbRequired'] ?? false) === true && ($visual === [] || $jsonLd === [])) {
                $breadcrumbErrors[] = $id . ':missing_breadcrumb';
            }
            if ($visual !== $jsonLd) {
                $breadcrumbMismatch[] = $id;
                $breadcrumbErrors[] = $id . ':visual_jsonld_divergence';
            }
            if ($expectedBreadcrumb !== null && $visual !== $expectedBreadcrumb) {
                $breadcrumbErrors[] = $id . ':wrong_parent_or_order';
            }
            $visualPaths = array_map(static fn ($crumb): string => explode('|', (string) $crumb, 2)[1] ?? '', $visual);
            if (count($visualPaths) !== count(array_unique($visualPaths))) {
                $breadcrumbErrors[] = $id . ':duplicate_crumb';
            }
            if (($page['breadcrumbCanonical'] ?? true) !== true) {
                $breadcrumbErrors[] = $id . ':noncanonical_crumb';
            }
            $canonical = (string) ($page['canonical'] ?? '');
            if ($canonical !== '' && $visualPaths !== [] && end($visualPaths) !== $canonical) {
                $breadcrumbErrors[] = $id . ':current_canonical_mismatch';
            }

            $types = is_array($page['schemaTypes'] ?? null) ? $page['schemaTypes'] : [];
            $expectedTypes = is_array($page['expectedSchemaTypes'] ?? null) ? $page['expectedSchemaTypes'] : [];
            $allowedTypes = is_array($page['allowedSchemaTypes'] ?? null) ? $page['allowedSchemaTypes'] : $types;
            if (count($types) !== count(array_unique($types))) $schemaErrors[] = $id . ':duplicate_schema';
            foreach (array_diff($expectedTypes, $types) as $type) $schemaErrors[] = $id . ':missing_schema:' . $type;
            foreach (array_diff($types, $allowedTypes) as $type) $schemaErrors[] = $id . ':unsupported_schema:' . $type;
            if (($page['jsonValid'] ?? true) !== true) $schemaErrors[] = $id . ':invalid_json';
            if (($page['privateMarker'] ?? false) === true) $schemaErrors[] = $id . ':private_marker';
            if (($page['schemaCanonical'] ?? true) !== true) $schemaErrors[] = $id . ':noncanonical_url';
            if (($page['visibleDataMapping'] ?? true) !== true) $schemaErrors[] = $id . ':invalid_visible_data_mapping';
        }
        return [
            'orphans' => array_values(array_unique($orphans)),
            'brokenLinks' => array_values(array_unique($broken)),
            'nonpublicTargets' => array_values(array_unique($nonpublic)),
            'aliasTargets' => array_values(array_unique($aliases)),
            'redirectTargets' => array_values(array_unique($redirects)),
            'duplicateLinks' => array_values(array_unique($duplicates)),
            'excessiveLinks' => $excessive,
            'breadcrumbMismatches' => array_values(array_unique($breadcrumbMismatch)),
            'breadcrumbErrors' => array_values(array_unique($breadcrumbErrors)),
            'schemaErrors' => array_values(array_unique($schemaErrors)),
        ];
    }
}
