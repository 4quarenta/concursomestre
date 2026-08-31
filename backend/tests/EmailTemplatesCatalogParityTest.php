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

declare(strict_types=1);

require_once 'C:/xampp/htdocs/questao-pro-backend/shared/utils/EmailTemplateResolver.php';

function assertEmailTemplateParity(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$frontendCatalogPath = 'C:/dev/concursomestre/src/constants/email/defaultEmailTemplates.ts';
$frontendContent = file_get_contents($frontendCatalogPath);
if ($frontendContent === false) {
    throw new RuntimeException('Nao foi possivel ler catalogo frontend de modelos de email.');
}

preg_match_all("/key:\\s*'([^']+)'/", $frontendContent, $matches);
$frontendKeys = array_values(array_unique($matches[1] ?? []));
sort($frontendKeys);

$backendKeys = array_keys(getSystemEmailTemplateCatalog());
sort($backendKeys);

assertEmailTemplateParity(
    $frontendKeys === $backendKeys,
    'Catalogo frontend/backend de modelos de email divergente. Frontend=' . implode(',', $frontendKeys) . ' Backend=' . implode(',', $backendKeys)
);

foreach (getSystemEmailTemplateDefaults() as $template) {
    assertEmailTemplateParity(trim((string) ($template['subject'] ?? '')) !== '', 'Modelo sem assunto: ' . ($template['key'] ?? '?'));
    assertEmailTemplateParity(trim((string) ($template['htmlBody'] ?? '')) !== '', 'Modelo sem HTML: ' . ($template['key'] ?? '?'));
    assertEmailTemplateParity(trim((string) ($template['textBody'] ?? '')) !== '', 'Modelo sem texto: ' . ($template['key'] ?? '?'));
}

assertEmailTemplateParity(
    in_array('marketing_campaign_message', $backendKeys, true),
    'Campanhas automaticas precisam de modelo editavel no painel admin.'
);

$wrappedFragment = wrapSystemEmailTemplateHtml(
    '<p>Ola, <strong>Joao</strong>!</p><p>Confirme sua conta.</p>',
    'Confirme sua conta - ConcursoMestre',
    ['confirm_url' => 'https://example.test/confirmar']
);

assertEmailTemplateParity(
    stripos($wrappedFragment, '<!DOCTYPE html>') !== false
        && stripos($wrappedFragment, 'ConcursoMestre') !== false
        && stripos($wrappedFragment, 'Confirmar e-mail') !== false,
    'Fragmentos de modelo de email devem receber o layout HTML profissional e CTA visual.'
);

$standaloneHtml = '<!DOCTYPE html><html><body><p>HTML proprio</p></body></html>';
assertEmailTemplateParity(
    wrapSystemEmailTemplateHtml($standaloneHtml, 'HTML proprio', []) === $standaloneHtml,
    'HTML completo informado pelo admin deve ser preservado sem wrapper adicional.'
);

fwrite(STDOUT, "Email templates catalog parity assertions passed.\n");
