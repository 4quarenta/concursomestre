<?php

declare(strict_types=1);

function assertLegalAcceptanceWiring(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$base = dirname(__DIR__);
$contractPath = dirname($base) . '/contracts/legal/legal-document-versions.v1.json';
$contract = json_decode((string) file_get_contents($contractPath), true);

assertLegalAcceptanceWiring(is_array($contract), 'Contrato legal compartilhado deve ser JSON valido.');
assertLegalAcceptanceWiring(($contract['schemaVersion'] ?? null) === 1, 'Contrato legal deve declarar schemaVersion 1.');
foreach (['terms_of_use', 'privacy_policy', 'checkout_adhesion_terms'] as $documentType) {
    assertLegalAcceptanceWiring(
        preg_match('/^\d{4}\.\d{2}$/', (string) ($contract['documents'][$documentType]['version'] ?? '')) === 1,
        'Documento legal sem versao deterministica: ' . $documentType
    );
    assertLegalAcceptanceWiring(
        preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($contract['documents'][$documentType]['effectiveDate'] ?? '')) === 1,
        'Documento legal sem data ISO: ' . $documentType
    );
}

$acceptance = file_get_contents($base . '/shared/legal/LegalAcceptance.php');
$version = file_get_contents($base . '/shared/legal/LegalDocumentVersion.php');
$migration = file_get_contents($base . '/database/migrations/20260902_120000_legal_document_acceptances.php');
$rollback = file_get_contents($base . '/database/rollbacks/20260902_120000_legal_document_acceptances.sql');
$authValidator = file_get_contents($base . '/modules/auth/validators/AuthValidator.php');
$authService = file_get_contents($base . '/modules/auth/services/AuthService.php');
$subscriptionsValidator = file_get_contents($base . '/modules/subscriptions/validators/SubscriptionsValidator.php');
$subscriptionsService = file_get_contents($base . '/modules/subscriptions/services/SubscriptionsService.php');

assertLegalAcceptanceWiring(str_contains($acceptance, 'hash_equals'), 'Aceite deve validar a versao vigente no servidor.');
assertLegalAcceptanceWiring(str_contains($acceptance, 'ON DUPLICATE KEY UPDATE id = id'), 'Aceite repetido deve ser idempotente sem substituir historico.');
assertLegalAcceptanceWiring(str_contains($version, 'legal-document-versions.v1.json'), 'Backend deve ler o contrato legal compartilhado.');
assertLegalAcceptanceWiring(str_contains($migration, 'CREATE TABLE IF NOT EXISTS legal_document_acceptances'), 'Migration deve criar o historico de aceites.');
assertLegalAcceptanceWiring(substr_count($migration, 'CREATE TABLE') === 1, 'Migration legal nao pode criar estruturas adicionais.');
assertLegalAcceptanceWiring(str_contains($migration, 'UNIQUE KEY uq_legal_acceptance_revision'), 'Historico deve impedir duplicacao da mesma revisao por usuario.');
assertLegalAcceptanceWiring(trim($rollback) === 'DROP TABLE IF EXISTS legal_document_acceptances;', 'Rollback deve atingir somente a tabela nova.');
assertLegalAcceptanceWiring(str_contains($authValidator, 'validateRegistrationAcceptance'), 'Cadastro deve validar aceite no validator do servidor.');
assertLegalAcceptanceWiring(substr_count($authService, "'terms_of_use'") >= 2, 'Cadastro tradicional e social devem registrar Termos de Uso.');
assertLegalAcceptanceWiring(substr_count($authService, "'privacy_policy'") >= 2, 'Cadastro tradicional e social devem registrar privacidade.');
assertLegalAcceptanceWiring(str_contains($subscriptionsValidator, 'checkout_adhesion_terms'), 'Checkout deve validar a versao dos Termos de adesao.');
assertLegalAcceptanceWiring(substr_count($subscriptionsService, 'LegalAcceptance::recordCheckout') >= 2, 'Checkout deve registrar aceite antes dos fluxos de cobranca.');

echo "Legal acceptance wiring PASS\n";
