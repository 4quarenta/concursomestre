<?php

declare(strict_types=1);

function granExtensionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$root = dirname(__DIR__, 2);
$extension = $root . '/browser-extension/gran-collector';
$manifest = json_decode((string) file_get_contents($extension . '/manifest.json'), true);
$worker = (string) file_get_contents($extension . '/service-worker.js');
$content = (string) file_get_contents($extension . '/content-script.js');
$popup = (string) file_get_contents($extension . '/popup.js');

granExtensionAssert(is_array($manifest), 'Manifesto da extensao deve ser JSON valido.');
granExtensionAssert(($manifest['manifest_version'] ?? null) === 3, 'Extensao deve usar Manifest V3.');
granExtensionAssert(($manifest['version'] ?? null) === '1.0.16', 'Pacote corrigido deve usar a versao 1.0.16.');
granExtensionAssert(
    ($manifest['host_permissions'] ?? []) === [
        'https://rota-api.grancursosonline.com.br/*',
        'https://questoes.grancursosonline.com.br/*',
        'https://concursomestre.com/*',
        'http://localhost:3000/*',
    ],
    'Permissoes remotas devem se limitar aos hosts oficiais da API e da pagina da Gran.'
);
granExtensionAssert(
    in_array('storage', $manifest['permissions'] ?? [], true)
    && in_array('webRequest', $manifest['permissions'] ?? [], true)
    && !in_array('cookies', $manifest['permissions'] ?? [], true)
    && !in_array('<all_urls>', $manifest['host_permissions'] ?? [], true),
    'Extensao nao deve acessar cookies nem hosts arbitrarios.'
);
foreach ([
    "url.origin !== GRAN_API_ORIGIN",
    "url.pathname !== GRAN_API_PATH",
    "redirect: 'error'",
    'MAX_RESPONSE_BYTES',
    'chrome.storage.session',
    "credentials: 'omit'",
    "authorization: `Bearer \${session.token}`",
    'chrome.webRequest.onBeforeSendHeaders',
    "urls: [`\${GRAN_API_ORIGIN}/*`]",
    'details.initiator !== GRAN_WEB_ORIGIN',
    "String(header.name || '').toLowerCase() === 'authorization'",
    'CAPTURE_STATUS_KEY',
    "state: 'authorization_missing'",
    "GRAN_EXAM_FILES_PATH_PREFIX = '/v1/provas/'",
    'collectExamFiles',
    'unwrapExamCandidate',
    "['prova', 'exam', 'question_exam']",
    'normalizeExamFileLinks',
    'cadernoDeProva',
    'arquivoGabarito',
    'examFiles: examFiles.files',
    'TAXONOMY_ENDPOINTS',
    "['_source[]', 'nome_completo']",
    "['_source[]', 'sigla']",
    "['_source[]', 'descricao']",
    "['_source[]', 'website']",
    "['_source[]', 'logo_url']",
    "'/v3/materia/arvore'",
    'assunto_tree:',
    'collectTaxonomyPage',
    'collectTaxonomyBatch',
    "'COLLECT_TAXONOMY_PAGE'",
    "'COLLECT_TAXONOMY_BATCH'",
    "'CHECK_TAXONOMY_UPDATES'",
    "params.set('perPage', '1')",
    'ensureCollectorBridgeInOpenTabs',
    'chrome.runtime.onInstalled.addListener',
    'chrome.runtime.onStartup.addListener',
] as $needle) {
    granExtensionAssert(str_contains($worker, $needle), 'Protecao ausente na extensao: ' . $needle);
}
granExtensionAssert(
    !str_contains($worker, 'storage.local')
    && !str_contains($worker, 'localStorage')
    && !str_contains($worker, 'console.log'),
    'Bearer nao pode ser persistido em disco nem escrito no console.'
);
granExtensionAssert(
    str_contains($worker, 'MAX_EXAM_FILE_REQUESTS')
    && str_contains($worker, 'EXAM_FILE_REQUEST_CONCURRENCY')
    && str_contains($worker, 'examFilesCache')
    && str_contains($worker, 'encodeURIComponent(examId)'),
    'Coleta de documentos deve ser limitada, deduplicada e formada somente por IDs numericos.'
);
granExtensionAssert(
    str_contains($worker, 'collectTaxonomyPage(message.kind, message.page, message.rootExternalIds)')
    && str_contains($worker, 'collectTaxonomyBatch(message.kind, message.rootExternalIds)')
    && !str_contains($worker, 'collectTaxonomyPage(message.url'),
    'Taxonomias devem usar somente a whitelist local da extensao, sem URL livre do painel.'
);
granExtensionAssert(
    str_contains($content, 'event.source !== window')
    && str_contains($content, 'event.origin !== window.location.origin')
    && str_contains($content, 'ALLOWED_TYPES')
    && str_contains($content, 'isAllowedCrawlerPage()')
    && str_contains($content, 'EXTENSION_MARKER_ATTRIBUTE')
    && str_contains($content, 'EXTENSION_DISCOVER_EVENT')
    && str_contains($content, 'announceReady')
    && str_contains($content, 'previousBridge.cleanup()')
    && str_contains($content, 'event.stopImmediatePropagation()')
    && in_array('https://concursomestre.com/*', $manifest['content_scripts'][0]['matches'] ?? [], true),
    'Content script deve acompanhar navegacao SPA, mas aceitar comandos somente na rota do crawler.'
);
granExtensionAssert(
    str_contains($worker, 'sender?.url || sender?.tab?.url')
    && str_contains($worker, 'url.pathname.startsWith(`${crawlerPath}/`)'),
    'Service worker deve reconhecer a rota canonica e suas variantes sem abrir acesso a outras paginas.'
);
granExtensionAssert(
    !str_contains($popup, 'localStorage') && !str_contains($popup, 'sessionStorage'),
    'Popup deve delegar armazenamento somente ao service worker.'
);
granExtensionAssert(
    !str_contains($popup, 'SAVE_SESSION')
    && !str_contains((string) file_get_contents($extension . '/popup.html'), '<textarea'),
    'Credencial deve ser capturada automaticamente, sem campo manual no popup.'
);

fwrite(STDOUT, "GranBrowserExtensionWiringTest: PASS\n");
