<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

function adminPlanCatalogRenewalAssertContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        fwrite(STDERR, $message . ' [' . $path . ']' . PHP_EOL);
        exit(1);
    }
}

$base = dirname(__DIR__) . '';

adminPlanCatalogRenewalAssertContains(
    $base . '/modules/admin/repositories/AdminPlanCatalogRepository.php',
    'public function getDb(): PDO',
    'Repositorio do catalogo precisa expor a conexao para sincronizar efeitos financeiros'
);

adminPlanCatalogRenewalAssertContains(
    $base . '/modules/admin/repositories/AdminPlanCatalogRepository.php',
    'private function ensureOperationalColumns(): void',
    'Repositorio do catalogo precisa garantir colunas operacionais do plano teste'
);

adminPlanCatalogRenewalAssertContains(
    $base . '/modules/admin/services/AdminPlanCatalogService.php',
    'syncStripeRenewalsAfterCatalogChange',
    'Atualizacao do catalogo de planos precisa recalcular proximas renovacoes Stripe'
);

adminPlanCatalogRenewalAssertContains(
    $base . '/modules/admin/services/AdminPlanCatalogService.php',
    'syncStripeRenewalProjectionsAfterPricingChange',
    'Catalogo deve delegar para o sincronizador oficial de renovacoes'
);

adminPlanCatalogRenewalAssertContains(
    $base . '/modules/admin/repositories/AdminPlanCatalogRepository.php',
    "'can_toggle_active' => (bool) (\$supportsActiveToggle && \$isTestPlan)",
    'Somente o plano de teste deve poder alternar ativo/inativo no catalogo'
);

fwrite(STDOUT, "Admin plan catalog renewal sync wiring assertions passed.\n");
