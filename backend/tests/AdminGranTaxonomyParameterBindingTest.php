<?php

declare(strict_types=1);

function adminGranTaxonomyParameterBindingAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$path = dirname(__DIR__) . '/modules/admin/services/AdminGranTaxonomySyncService.php';
$source = file_get_contents($path);
adminGranTaxonomyParameterBindingAssert(
    is_string($source),
    'Servico de sincronizacao de taxonomias indisponivel.'
);

preg_match(
    "/'UPDATE filters\\s+SET name = :name,(.*?)WHERE id = :id'/s",
    $source,
    $matches
);
$statement = $matches[0] ?? '';
adminGranTaxonomyParameterBindingAssert(
    $statement !== '',
    'UPDATE de taxonomia Gran nao localizado para validacao.'
);

preg_match_all('/:[a-z_]+/', $statement, $parameterMatches);
$parameters = $parameterMatches[0] ?? [];
$duplicates = array_keys(array_filter(
    array_count_values($parameters),
    static fn (int $count): bool => $count > 1
));
adminGranTaxonomyParameterBindingAssert(
    $duplicates === [],
    'UPDATE de taxonomia Gran reutiliza placeholder PDO: ' . implode(', ', $duplicates)
);
adminGranTaxonomyParameterBindingAssert(
    str_contains($statement, ':preserve_parent_condition')
        && str_contains($statement, ':preserve_level_for_materia')
        && str_contains($statement, ':preserve_level_for_taxonomy'),
    'UPDATE de taxonomia Gran deve usar bindings distintos para as condicoes CASE.'
);
foreach ([
    ':preserve_primary_source_provider',
    ':preserve_primary_source_entity_type',
    ':preserve_primary_source_external_id',
    ':preserve_parent_condition',
    ':preserve_level_for_materia',
    ':preserve_level_for_taxonomy',
    ':preserve_source_parent_hierarchy',
    ':preserve_source_root_hierarchy',
] as $binding) {
    adminGranTaxonomyParameterBindingAssert(
        str_contains($source, '$updatePayload = [') && str_contains($source, $binding),
        'Binding ausente no UPDATE de taxonomia Gran: ' . $binding
    );
}
adminGranTaxonomyParameterBindingAssert(
    str_contains($statement, 'source_parent_external_id = CASE WHEN :preserve_source_parent_hierarchy = 1')
        && str_contains($statement, 'source_root_external_id = CASE WHEN :preserve_source_root_hierarchy = 1'),
    'Catalogo plano nao pode apagar a hierarquia previamente importada da arvore oficial.'
);
adminGranTaxonomyParameterBindingAssert(
    str_contains($source, 'if ($existing !== null) {')
        && strpos($source, 'if ($existing !== null) {') < strpos($source, ':preserve_parent_condition'),
    'Bindings exclusivos do UPDATE devem ser adicionados somente depois da decisao de atualizar.'
);
adminGranTaxonomyParameterBindingAssert(
    str_contains($source, '$stmt->execute($updatePayload);')
        && !str_contains($source, '$stmt->execute($payload);\n            return [\'created\' => false'),
    'UPDATE de taxonomia Gran deve receber somente os bindings presentes no statement.'
);
adminGranTaxonomyParameterBindingAssert(
    str_contains($source, 'findCanonicalMatchByAcronym')
        && str_contains($source, "WHERE type = :type AND acronym = :acronym")
        && str_contains($source, '$existingBySourceIdentity === null'),
    'Banca e órgão devem reutilizar a taxonomia canônica encontrada pela sigla antes do INSERT.'
);
adminGranTaxonomyParameterBindingAssert(
    str_contains($source, '$acronym = null;')
        && str_contains($source, "COALESCE(:acronym, acronym)"),
    'Atualização com conflito de sigla deve preservar a sigla canônica já cadastrada.'
);

echo "AdminGranTaxonomyParameterBindingTest: PASS\n";
