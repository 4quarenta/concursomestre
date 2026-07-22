<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$migration = (string) file_get_contents($root . '/database/migrations/20260722_010000_filter_organization_identity.php');
$repository = (string) file_get_contents($root . '/modules/filters/repositories/FiltersRepository.php');
$service = (string) file_get_contents($root . '/modules/filters/services/FiltersService.php');
$validator = (string) file_get_contents($root . '/modules/filters/validators/FiltersValidator.php');
$adminAssetService = (string) file_get_contents($root . '/modules/admin/services/AdminBrandAssetsService.php');
$frontendRoot = dirname($root) . '/src/app/admin/components/database/';
$modal = (string) file_get_contents($frontendRoot . 'TaxonomyModal.tsx');
$workflow = (string) file_get_contents($frontendRoot . 'useAdminTaxonomyWorkflow.ts');

$assertContains = static function (string $haystack, string $needle, string $message): void {
    if (!str_contains($haystack, $needle)) {
        throw new RuntimeException($message);
    }
};

foreach (['acronym VARCHAR(40)', 'uq_filters_type_acronym', 'question_filters', 'prova_filters', 'CBM-PB', 'PM-PB'] as $needle) {
    $assertContains($migration, $needle, "Migration de identidade nao contem {$needle}.");
}
foreach (['findCanonicalMatch', 'acronymExists', 'normalized_alias', 'acronym = :acronym'] as $needle) {
    $assertContains($repository, $needle, "Repository canonico nao contem {$needle}.");
}
foreach (['normalizeAcronym', "'sigla' => \$row['acronym']", 'Taxonomia existente reutilizada'] as $needle) {
    $assertContains($service, $needle, "Service de filtros nao contem {$needle}.");
}
$assertContains($validator, 'A sigla deve ter no maximo 40 caracteres.', 'Validator nao limita sigla.');
$assertContains($validator, '/uploads/admin-assets/taxonomy-logo/', 'Validator nao aceita o upload protegido da taxonomia.');
$assertContains($adminAssetService, 'taxonomy-logo', 'Upload protegido nao aceita logo de taxonomia.');
foreach (['Sigla do órgão', 'Selecionar imagem', 'taxonomy-logo'] as $needle) {
    $assertContains($modal . $workflow, $needle, "UI de orgaos nao contem {$needle}.");
}

echo "FilterOrganizationIdentityWiringTest passed\n";
