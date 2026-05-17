<?php

declare(strict_types=1);

$backendRoot = 'C:/xampp/htdocs/questao-pro-backend';

require_once $backendRoot . '/config/database.php';
require_once $backendRoot . '/modules/legal_commentary/services/PlanaltoImportService.php';
require_once $backendRoot . '/modules/legal_commentary/repositories/LegalCommentaryRepository.php';

$urls = [
    'CF88' => 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
    'LMP' => 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm',
    'ABUSO' => 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13869.htm',
    'TORTURA' => 'https://www.planalto.gov.br/ccivil_03/leis/l9455.htm',
    'CC' => 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm',
    'PA' => 'https://www.planalto.gov.br/ccivil_03/leis/l9784.htm',
    'CP' => 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm',
    'CPP' => 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689.htm',
    'CLT' => 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm',
    'CTN' => 'https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm',
    'CPC' => 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm',
    'LICITACOES' => 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
    '8112' => 'https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm',
    'IMPROBIDADE' => 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm',
    'CDC' => 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
    'ECA' => 'https://www.planalto.gov.br/ccivil_03/leis/l8069.htm',
    'LEI_ELEICOES' => 'https://www.planalto.gov.br/ccivil_03/leis/l9504.htm',
    'LINDB' => 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657compilado.htm',
    'LGPD' => 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',
    'LAI' => 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm',
    'LC95' => 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp95.htm',
    'DEC1171' => 'https://www.planalto.gov.br/ccivil_03/decreto/d1171.htm',
];

$requiredLawFields = [
    'slug',
    'areaId',
    'lawTopicFilterId',
    'title',
    'shortTitle',
    'number',
    'officialUrl',
    'sourceName',
    'ementa',
    'articles',
];

$db = (new Database())->getConnection();
$service = new PlanaltoImportService($db, new LegalCommentaryRepository($db));
$failures = [];
$dumpElementsFor = null;
$dumpArticlesFor = null;
$dumpMetadataFor = null;
$dumpDuplicatesFor = null;
foreach (array_slice($argv, 1) as $arg) {
    if (str_starts_with($arg, '--dump-elements=')) {
        $dumpElementsFor = substr($arg, strlen('--dump-elements='));
    }
    if (str_starts_with($arg, '--dump-articles=')) {
        $dumpArticlesFor = substr($arg, strlen('--dump-articles='));
    }
    if (str_starts_with($arg, '--dump-metadata=')) {
        $dumpMetadataFor = substr($arg, strlen('--dump-metadata='));
    }
    if (str_starts_with($arg, '--dump-duplicates=')) {
        $dumpDuplicatesFor = substr($arg, strlen('--dump-duplicates='));
    }
}

if ($dumpElementsFor !== null && isset($urls[$dumpElementsFor])) {
    $reflection = new ReflectionClass($service);
    $fetchHtml = $reflection->getMethod('fetchHtml');
    $fetchHtml->setAccessible(true);
    $extractLegalStructure = $reflection->getMethod('extractLegalStructure');
    $extractLegalStructure->setAccessible(true);
    $html = $fetchHtml->invoke($service, $urls[$dumpElementsFor]);
    $elements = $extractLegalStructure->invoke($service, $html);
    foreach (array_slice($elements, 0, 220) as $index => $element) {
        echo $index . ': ' . ($element['text'] ?? '') . PHP_EOL;
    }
    exit(0);
}

if ($dumpMetadataFor !== null && isset($urls[$dumpMetadataFor])) {
    $reflection = new ReflectionClass($service);
    $fetchHtml = $reflection->getMethod('fetchHtml');
    $fetchHtml->setAccessible(true);
    $extractReadableLines = $reflection->getMethod('extractReadableLines');
    $extractReadableLines->setAccessible(true);
    $extractMetadataLine = $reflection->getMethod('extractMetadataLine');
    $extractMetadataLine->setAccessible(true);
    $extractNumberAndYear = $reflection->getMethod('extractNumberAndYear');
    $extractNumberAndYear->setAccessible(true);
    $html = $fetchHtml->invoke($service, $urls[$dumpMetadataFor]);
    $lines = $extractReadableLines->invoke($service, $html);
    $metadata = $extractMetadataLine->invoke($service, $lines, $urls[$dumpMetadataFor]);
    var_export([
        'metadata' => $metadata,
        'numberYear' => $extractNumberAndYear->invoke($service, $metadata, ''),
        'lines' => array_slice($lines, 0, 12),
    ]);
    echo PHP_EOL;
    exit(0);
}

if ($dumpDuplicatesFor !== null && isset($urls[$dumpDuplicatesFor])) {
    $result = $service->importFromUrl($urls[$dumpDuplicatesFor], false);
    $byNumber = [];
    foreach (($result['law']['articles'] ?? []) as $article) {
        $number = (string) ($article['number'] ?? '');
        $byNumber[$number][] = $article;
    }
    foreach ($byNumber as $number => $items) {
        if (count($items) < 2) {
            continue;
        }
        echo 'Art. ' . $number . ' => ' . count($items) . PHP_EOL;
        foreach ($items as $article) {
            $hierarchy = is_array($article['hierarchy'] ?? null) ? $article['hierarchy'] : [];
            echo '  slug=' . ($article['slug'] ?? '') . ' sub=' . ($hierarchy['resolvedSubtopic'] ?? '') . ' ass=' . ($hierarchy['resolvedAssunto'] ?? '') . ' text=' . mb_substr((string) ($article['text'] ?? ''), 0, 100) . PHP_EOL;
        }
    }
    exit(0);
}

if ($dumpArticlesFor !== null && isset($urls[$dumpArticlesFor])) {
    $result = $service->importFromUrl($urls[$dumpArticlesFor], false);
    foreach (($result['law']['articles'] ?? []) as $index => $article) {
        $hierarchy = is_array($article['hierarchy'] ?? null) ? $article['hierarchy'] : [];
        echo sprintf(
            "%03d Art. %-8s title=%s sub=%s ass=%s text=%s\n",
            $index + 1,
            (string) ($article['number'] ?? ''),
            (string) ($article['title'] ?? ''),
            (string) ($hierarchy['resolvedSubtopic'] ?? ''),
            (string) ($hierarchy['resolvedAssunto'] ?? ''),
            mb_substr((string) ($article['text'] ?? ''), 0, 90)
        );
    }
    exit(0);
}

foreach ($urls as $key => $url) {
    try {
        $result = $service->importFromUrl($url, false);
        $law = $result['law'] ?? [];
        $articles = is_array($law['articles'] ?? null) ? $law['articles'] : [];
        $warnings = [];

        foreach ($requiredLawFields as $field) {
            $value = $law[$field] ?? null;
            if ($value === null || $value === '' || (is_array($value) && empty($value))) {
                $warnings[] = 'law_missing_' . $field;
            }
        }

        $slugs = [];
        foreach ($articles as $index => $article) {
            $slug = trim((string) ($article['slug'] ?? ''));
            if ($slug === '') {
                $warnings[] = 'article_' . ($index + 1) . '_missing_slug';
            } elseif (isset($slugs[$slug])) {
                $warnings[] = 'duplicate_slug_' . $slug;
            }
            $slugs[$slug] = true;

            if (trim((string) ($article['number'] ?? '')) === '') {
                $warnings[] = 'article_' . ($index + 1) . '_missing_number';
            }
            if (trim((string) ($article['text'] ?? '')) === '') {
                $warnings[] = 'article_' . ($index + 1) . '_missing_text';
            }
            if (empty($article['blocks']) || !is_array($article['blocks'])) {
                $warnings[] = 'article_' . ($index + 1) . '_missing_blocks';
            }

            $title = trim((string) ($article['title'] ?? ''));
            if ($title !== '' && preg_match('/^\d{3,}$/', $title)) {
                $warnings[] = 'article_' . ($index + 1) . '_numeric_title_' . $title;
            }
        }

        if (!empty($warnings)) {
            $failures[$key] = array_values(array_unique($warnings));
        }

        echo sprintf(
            "%-14s artigos=%4d numero=%-24s topico=%-8s avisos=%s\n",
            $key,
            count($articles),
            (string) ($law['number'] ?? ''),
            (string) ($law['lawTopicFilterId'] ?? ''),
            empty($warnings) ? 'OK' : implode(';', array_slice(array_unique($warnings), 0, 8))
        );

        foreach (array_slice($articles, 0, 2) as $article) {
            $hierarchy = is_array($article['hierarchy'] ?? null) ? $article['hierarchy'] : [];
            echo sprintf(
                "  Art. %-6s titulo=%s | sub=%s | assunto=%s\n",
                (string) ($article['number'] ?? ''),
                (string) ($article['title'] ?? ''),
                (string) ($hierarchy['resolvedSubtopic'] ?? ''),
                (string) ($hierarchy['resolvedAssunto'] ?? '')
            );
        }
    } catch (Throwable $error) {
        $failures[$key] = ['exception=' . $error->getMessage()];
        echo sprintf("%-14s ERRO %s\n", $key, $error->getMessage());
    }
}

echo 'SUMMARY_FAILS=' . json_encode($failures, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;

exit(empty($failures) ? 0 : 1);
