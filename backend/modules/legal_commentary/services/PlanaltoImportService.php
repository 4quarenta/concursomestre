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

require_once __DIR__ . '/../repositories/LegalCommentaryRepository.php';

/**
 * Sincronizador oficial do Portal do Planalto para o modulo Lei Comentada.
 *
 * @since 1.0.0
 */
class PlanaltoImportService
{
    private const PLANALTO_HOSTS = ['www.planalto.gov.br', 'planalto.gov.br'];

    private const CATALOG_SOURCES = [
        [
            'id' => 'constituicao',
            'label' => 'Constituicao',
            'description' => 'Texto constitucional vigente no Portal do Planalto.',
            'sortOrder' => 10,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/Constituicao/Constituicao.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/constituicao/'],
            'documentLabel' => 'Constituicao Federal',
            'mode' => 'single',
        ],
        [
            'id' => 'codigos',
            'label' => 'Codigos',
            'description' => 'Codigos federais consolidados.',
            'sortOrder' => 20,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/Codigos/quadro_cod.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/'],
            'mode' => 'flat',
        ],
        [
            'id' => 'leis-ordinarias',
            'label' => 'Leis Ordinarias',
            'description' => 'Leis ordinarias do acervo oficial.',
            'sortOrder' => 30,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/LEIS/_Lei-Ordinaria.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/leis/', '/ccivil_03/_ato'],
            'includePatterns' => ['/leis/', '/lei/'],
            'excludePrefixes' => ['/ccivil_03/leis/lcp/', '/ccivil_03/leis/ldl/', '/ccivil_03/leis/lim/'],
            'excludePatterns' => ['/lcp/', '/ldl/', '/mpv/', '/dnn/', '/decreto/'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'leis-delegadas',
            'label' => 'Leis Delegadas',
            'description' => 'Leis delegadas publicadas no acervo oficial.',
            'sortOrder' => 40,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/LEIS/Ldl/Quadro_LDL.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/leis/ldl/', '/ccivil_03/_ato'],
            'includePatterns' => ['/ldl/'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'leis-complementares',
            'label' => 'Leis Complementares',
            'description' => 'Leis complementares do Portal do Planalto.',
            'sortOrder' => 50,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/LEIS/LCP/Quadro_Lcp.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/leis/lcp/', '/ccivil_03/_ato'],
            'includePatterns' => ['/lcp/'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'decretos',
            'label' => 'Decretos',
            'description' => 'Decretos numerados do Poder Executivo.',
            'sortOrder' => 60,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/decreto/_Dec_ano.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/decreto/', '/ccivil_03/_ato'],
            'includePatterns' => ['/decreto/'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'decretos-nao-numerados',
            'label' => 'Decretos nao numerados',
            'description' => 'Decretos nao numerados do acervo oficial.',
            'sortOrder' => 70,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/DNN/quadro/_Dnn_ano.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/dnn/', '/ccivil_03/_ato'],
            'includePatterns' => ['/dnn/'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'decretos-leis',
            'label' => 'Decretos-Leis',
            'description' => 'Decretos-leis do acervo oficial.',
            'sortOrder' => 80,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/Decreto-Lei/principal_ano.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/decreto-lei/'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'medidas-provisorias',
            'label' => 'Medidas Provisorias',
            'description' => 'Medidas provisorias organizadas por periodo.',
            'sortOrder' => 90,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/MPV/Principal.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/mpv/', '/ccivil_03/_ato'],
            'includePatterns' => ['/mpv/'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'mensagens-veto-total',
            'label' => 'Mensagens de veto total',
            'description' => 'Mensagens de veto total publicadas no acervo oficial.',
            'sortOrder' => 95,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/VETO_TOTAL/principal_ano.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/veto_total/'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'projetos-lei',
            'label' => 'Projetos de Lei',
            'description' => 'Projetos de lei em tramites registrados no acervo presidencial.',
            'sortOrder' => 100,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/Projetos/Quadros/principal.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/projetos/'],
            'includePatterns' => ['/pl/', 'quadro_pl/'],
            'excludePatterns' => ['/plp/', '/pln/', '/pec/'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'projetos-lei-complementar',
            'label' => 'Projetos de Lei Complementar',
            'description' => 'Projetos de lei complementar por ano.',
            'sortOrder' => 110,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/Projetos/Quadros/principal.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/projetos/'],
            'includePatterns' => ['/plp/', 'quadro_plp/'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'projetos-lei-congresso',
            'label' => 'Projetos de Lei do Congresso Nacional',
            'description' => 'Projetos de lei do Congresso Nacional por ano.',
            'sortOrder' => 120,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/Projetos/Quadros/principal.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/projetos/'],
            'includePatterns' => ['/pln/', 'quadro_pln/'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'pec',
            'label' => 'PEC',
            'description' => 'Propostas de Emenda a Constituicao por ano.',
            'sortOrder' => 130,
            'entryUrls' => [
                'https://www.planalto.gov.br/ccivil_03/Projetos/Quadros/principal.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/projetos/'],
            'includePatterns' => ['/pec/', '_quadro_emenda_constitucional_'],
            'mode' => 'crawl',
        ],
        [
            'id' => 'pareceres-agu',
            'label' => 'Pareceres da AGU',
            'description' => 'Pareceres e precedentes selecionados da AGU.',
            'sortOrder' => 140,
            'entryUrls' => [
                'https://www.planalto.gov.br/CCIVIL_03/AGU/QuadroAGUdsp.htm',
            ],
            'allowPrefixes' => ['/ccivil_03/agu/'],
            'mode' => 'crawl',
        ],
    ];

    private const CLASSIFICATION_RULES = [
        [
            'keywords' => ['constituicao da republica federativa do brasil', 'constituicao federal'],
            'areaSlug' => 'constitucional',
            'subjectName' => 'Direito Constitucional',
            'defaultTopic' => 'Direitos e Garantias Fundamentais',
            'shortTitle' => 'Constituição Federal',
            'acronym' => 'CF/88',
            'number' => 'CF/88',
            'year' => '1988',
            'date' => '1988-10-05',
        ],
        [
            'keywords' => ['codigo penal militar'],
            'areaSlug' => 'penal',
            'subjectName' => 'Direito Penal Militar',
            'defaultTopic' => 'Código Penal Militar',
            'shortTitle' => 'Código Penal Militar',
            'acronym' => 'CPM',
            'number' => 'Decreto-Lei 1.001',
            'year' => '1969',
        ],
        [
            'keywords' => ['codigo de processo penal militar'],
            'areaSlug' => 'processual-penal',
            'subjectName' => 'Direito Processual Penal Militar',
            'defaultTopic' => 'Código de Processo Penal Militar',
            'shortTitle' => 'Código de Processo Penal Militar',
            'acronym' => 'CPPM',
            'number' => 'Decreto-Lei 1.002',
            'year' => '1969',
        ],
        [
            'keywords' => ['codigo de processo penal', 'del3689'],
            'areaSlug' => 'processual-penal',
            'subjectName' => 'Direito Processual Penal',
            'defaultTopic' => 'Código de Processo Penal',
            'shortTitle' => 'Código de Processo Penal',
            'acronym' => 'CPP',
            'number' => 'Decreto-Lei 3.689',
            'year' => '1941',
        ],
        [
            'keywords' => ['codigo penal', 'del2848'],
            'areaSlug' => 'penal',
            'subjectName' => 'Direito Penal',
            'defaultTopic' => 'Código Penal',
            'shortTitle' => 'Código Penal',
            'acronym' => 'CP',
            'number' => 'Decreto-Lei 2.848',
            'year' => '1940',
        ],
        [
            'keywords' => ['codigo de processo civil', 'l13105'],
            'areaSlug' => 'processual',
            'subjectName' => 'Direito Processual Civil',
            'defaultTopic' => 'Código de Processo Civil',
            'shortTitle' => 'Código de Processo Civil',
            'acronym' => 'CPC',
            'number' => 'Lei 13.105',
            'year' => '2015',
        ],
        [
            'keywords' => ['codigo civil', 'l10406'],
            'areaSlug' => 'civil',
            'subjectName' => 'Direito Civil',
            'defaultTopic' => 'Código Civil',
            'shortTitle' => 'Código Civil',
            'acronym' => 'CC',
            'number' => 'Lei 10.406',
            'year' => '2002',
        ],
        [
            'keywords' => ['codigo tributario nacional', 'l5172'],
            'areaSlug' => 'tributario',
            'subjectName' => 'Direito Tributário',
            'defaultTopic' => 'Código Tributário Nacional',
            'shortTitle' => 'Código Tributário Nacional',
            'acronym' => 'CTN',
            'number' => 'Lei 5.172',
            'year' => '1966',
        ],
        [
            'keywords' => ['consolidacao das leis do trabalho', 'del5452'],
            'areaSlug' => 'trabalho',
            'subjectName' => 'Direito do Trabalho',
            'defaultTopic' => 'CLT',
            'shortTitle' => 'CLT',
            'acronym' => 'CLT',
            'number' => 'Decreto-Lei 5.452',
            'year' => '1943',
        ],
        [
            'keywords' => ['codigo eleitoral', 'l4737'],
            'areaSlug' => 'eleitoral',
            'subjectName' => 'Direito Eleitoral',
            'defaultTopic' => 'Código Eleitoral',
            'shortTitle' => 'Código Eleitoral',
            'acronym' => 'CE',
            'number' => 'Lei 4.737',
            'year' => '1965',
        ],
        [
            'keywords' => ['lei de execucao penal', 'l7210'],
            'areaSlug' => 'legislacao-especial',
            'subjectName' => 'Legislação Extravagante',
            'defaultTopic' => 'Lei de Execução Penal',
            'shortTitle' => 'Lei de Execução Penal',
            'acronym' => 'LEP',
            'number' => 'Lei 7.210',
            'year' => '1984',
        ],
        [
            'keywords' => ['estatuto da crianca e do adolescente', 'l8069'],
            'areaSlug' => 'legislacao-especial',
            'subjectName' => 'Legislação Extravagante',
            'defaultTopic' => 'ECA',
            'shortTitle' => 'ECA',
            'acronym' => 'ECA',
            'number' => 'Lei 8.069',
            'year' => '1990',
        ],
        [
            'keywords' => ['estatuto do idoso', 'l10741'],
            'areaSlug' => 'legislacao-especial',
            'subjectName' => 'Legislação Extravagante',
            'defaultTopic' => 'Estatuto do Idoso',
            'shortTitle' => 'Estatuto do Idoso',
            'acronym' => 'EI',
            'number' => 'Lei 10.741',
            'year' => '2003',
        ],
        [
            'keywords' => ['maria da penha', 'l11340'],
            'areaSlug' => 'legislacao-especial',
            'subjectName' => 'Legislação Extravagante',
            'defaultTopic' => 'Lei Maria da Penha',
            'shortTitle' => 'Lei Maria da Penha',
            'acronym' => 'LMP',
            'number' => 'Lei 11.340',
            'year' => '2006',
        ],
        [
            'keywords' => ['abuso de autoridade', 'l13869'],
            'areaSlug' => 'legislacao-especial',
            'subjectName' => 'Legislação Extravagante',
            'defaultTopic' => 'Lei de Abuso de Autoridade',
            'shortTitle' => 'Lei de Abuso de Autoridade',
            'acronym' => 'Lei 13.869',
            'number' => 'Lei 13.869',
            'year' => '2019',
        ],
        [
            'keywords' => ['crimes de tortura', 'define os crimes de tortura', 'l9455'],
            'areaSlug' => 'legislacao-especial',
            'subjectName' => 'Legislação Extravagante',
            'defaultTopic' => 'Lei de Tortura',
            'shortTitle' => 'Lei de Tortura',
            'acronym' => 'Lei 9.455',
            'number' => 'Lei 9.455',
            'year' => '1997',
        ],
        [
            'keywords' => ['estatuto da pessoa com deficiencia', 'l13146'],
            'areaSlug' => 'direitos-humanos',
            'subjectName' => 'Direitos Humanos',
            'defaultTopic' => 'Estatuto da Pessoa com Deficiência',
            'shortTitle' => 'Estatuto da Pessoa com Deficiência',
            'acronym' => 'EPD',
            'number' => 'Lei 13.146',
            'year' => '2015',
        ],
        [
            'keywords' => ['lei de improbidade administrativa', 'l8429'],
            'areaSlug' => 'administrativo',
            'subjectName' => 'Direito Administrativo',
            'defaultTopic' => 'Lei de Improbidade Administrativa',
            'shortTitle' => 'Lei de Improbidade Administrativa',
            'acronym' => 'LIA',
            'number' => 'Lei 8.429',
            'year' => '1992',
        ],
        [
            'keywords' => ['estatuto dos servidores publicos civis da uniao', 'l8112', 'regime juridico dos servidores publicos civis da uniao'],
            'areaSlug' => 'administrativo',
            'subjectName' => 'Direito Administrativo',
            'defaultTopic' => 'Lei 8.112/90',
            'shortTitle' => 'Lei 8.112/90',
            'acronym' => 'Lei 8.112',
            'number' => 'Lei 8.112',
            'year' => '1990',
        ],
        [
            'keywords' => ['lei de licitacoes e contratos administrativos', 'l14133'],
            'areaSlug' => 'administrativo',
            'subjectName' => 'Direito Administrativo',
            'defaultTopic' => 'Lei 14.133/21',
            'shortTitle' => 'Lei 14.133/21',
            'acronym' => 'Lei 14.133',
            'number' => 'Lei 14.133',
            'year' => '2021',
        ],
        [
            'keywords' => ['processo administrativo', 'administracao publica federal', 'l9784'],
            'areaSlug' => 'administrativo',
            'subjectName' => 'Direito Administrativo',
            'defaultTopic' => 'Lei 9.784/99',
            'shortTitle' => 'Lei 9.784/99',
            'acronym' => 'Lei 9.784',
            'number' => 'Lei 9.784',
            'year' => '1999',
        ],
        [
            'keywords' => ['codigo de defesa do consumidor', 'l8078'],
            'areaSlug' => 'civil',
            'subjectName' => 'Direito Civil',
            'defaultTopic' => 'Código de Defesa do Consumidor',
            'shortTitle' => 'Código de Defesa do Consumidor',
            'acronym' => 'CDC',
            'number' => 'Lei 8.078',
            'year' => '1990',
        ],
        [
            'keywords' => ['codigo florestal', 'l12651'],
            'areaSlug' => 'ambiental',
            'subjectName' => 'Direito Ambiental',
            'defaultTopic' => 'Código Florestal',
            'shortTitle' => 'Código Florestal',
            'acronym' => 'CFlo',
            'number' => 'Lei 12.651',
            'year' => '2012',
        ],
    ];

    private PDO $db;
    private LegalCommentaryRepository $repository;

    public function __construct(PDO $db, LegalCommentaryRepository $repository)
    {
        $this->db = $db;
        $this->repository = $repository;
    }

    public function getCatalogSources(): array
    {
        $sources = array_map(static function (array $source): array {
            return [
                'id' => $source['id'],
                'label' => $source['label'],
                'description' => $source['description'],
                'sortOrder' => $source['sortOrder'],
            ];
        }, self::CATALOG_SOURCES);

        usort($sources, static fn (array $left, array $right): int => ((int) $left['sortOrder']) <=> ((int) $right['sortOrder']));
        return $sources;
    }

    public function buildCatalog(array $selectedSourceIds = []): array
    {
        $documents = [];

        foreach ($this->resolveCatalogSources($selectedSourceIds) as $source) {
            foreach ($this->collectCatalogDocumentsForSource($source) as $item) {
                $documents[$item['url']] = $item;
            }
        }

        $items = array_values($documents);
        usort($items, static function (array $left, array $right): int {
            $order = ((int) ($left['sourceOrder'] ?? 0)) <=> ((int) ($right['sourceOrder'] ?? 0));
            if ($order !== 0) {
                return $order;
            }

            return strcmp((string) ($left['label'] ?? ''), (string) ($right['label'] ?? ''));
        });

        return array_map(static function (array $item): array {
            return [
                'url' => $item['url'],
                'label' => $item['label'],
                'sourceId' => $item['sourceId'],
                'sourceLabel' => $item['sourceLabel'],
            ];
        }, $items);
    }

    private function buildCatalogLegacy(): array
    {
        $visited = [];
        $queued = [];
        $queue = [];
        $documents = [];

        foreach ($queue as $item) {
            $queued[$item] = true;
        }

        $indexVisits = 0;

        while (!empty($queue) && $indexVisits < 140 && count($documents) < 4000) {
            $indexUrl = array_shift($queue);
            if (!$indexUrl || isset($visited[$indexUrl])) {
                continue;
            }

            $visited[$indexUrl] = true;
            $indexVisits += 1;

            try {
                $html = $this->fetchHtml($indexUrl);
                foreach ($this->extractLinksFromHtml($indexUrl, $html) as $link) {
                    if ($this->isIndexUrl($link) && !isset($visited[$link]) && !isset($queued[$link])) {
                        $queue[] = $link;
                        $queued[$link] = true;
                        continue;
                    }

                    if (!$this->isLawDocumentUrl($link)) {
                        continue;
                    }

                    if (!isset($documents[$link])) {
                        $documents[$link] = [
                            'url' => $link,
                            'label' => $this->guessCatalogLabel($link),
                        ];
                    }
                }
            } catch (Throwable $e) {
                continue;
            }
        }

        $items = array_values($documents);
        usort($items, fn ($a, $b) => strcmp((string) $a['label'], (string) $b['label']));

        array_unshift($items, [
            'url' => 'https://www.planalto.gov.br/ccivil_03/Constituicao/Constituicao.htm',
            'label' => 'Constituição Federal',
        ]);

        $deduped = [];
        $seen = [];
        foreach ($items as $item) {
            if (!isset($seen[$item['url']])) {
                $deduped[] = $item;
                $seen[$item['url']] = true;
            }
        }

        return $deduped;
    }

    private function resolveCatalogSources(array $selectedSourceIds): array
    {
        if (empty($selectedSourceIds)) {
            return $this->getOrderedCatalogSources();
        }

        $wanted = [];
        foreach ($selectedSourceIds as $sourceId) {
            $normalized = trim((string) $sourceId);
            if ($normalized !== '') {
                $wanted[$normalized] = true;
            }
        }

        return array_values(array_filter(
            $this->getOrderedCatalogSources(),
            static fn (array $source): bool => isset($wanted[$source['id']])
        ));
    }

    private function getOrderedCatalogSources(): array
    {
        $sources = self::CATALOG_SOURCES;
        usort($sources, static fn (array $left, array $right): int => ((int) $left['sortOrder']) <=> ((int) $right['sortOrder']));
        return $sources;
    }

    private function collectCatalogDocumentsForSource(array $source): array
    {
        $documents = [];
        $mode = (string) ($source['mode'] ?? 'crawl');

        if ($mode === 'single') {
            foreach ($source['entryUrls'] ?? [] as $entryUrl) {
                $normalizedUrl = $this->normalizePlanaltoUrl((string) $entryUrl);
                $documents[$normalizedUrl] = $this->buildCatalogDocument($normalizedUrl, $source);
            }

            return array_values($documents);
        }

        if ($mode === 'flat') {
            foreach ($source['entryUrls'] ?? [] as $entryUrl) {
                $normalizedUrl = $this->normalizePlanaltoUrl((string) $entryUrl);

                try {
                    $html = $this->fetchHtml($normalizedUrl);
                    foreach ($this->extractLinksFromHtml($normalizedUrl, $html) as $link) {
                        if (!$this->urlMatchesSourceScope($link, $source) || $this->isIndexUrl($link) || !$this->isLawDocumentUrl($link)) {
                            continue;
                        }

                        if (!isset($documents[$link])) {
                            $documents[$link] = $this->buildCatalogDocument($link, $source);
                        }
                    }
                } catch (Throwable $e) {
                    continue;
                }
            }

            return array_values($documents);
        }

        $visited = [];
        $queued = [];
        $queue = [];

        foreach ($source['entryUrls'] ?? [] as $entryUrl) {
            $normalizedUrl = $this->normalizePlanaltoUrl((string) $entryUrl);
            if (!isset($queued[$normalizedUrl])) {
                $queue[] = $normalizedUrl;
                $queued[$normalizedUrl] = true;
            }
        }

        $indexVisits = 0;

        while (!empty($queue) && $indexVisits < 180 && count($documents) < 4000) {
            $indexUrl = array_shift($queue);
            if (!$indexUrl || isset($visited[$indexUrl])) {
                continue;
            }

            $visited[$indexUrl] = true;
            $indexVisits += 1;

            try {
                $html = $this->fetchHtml($indexUrl);
                foreach ($this->extractLinksFromHtml($indexUrl, $html) as $link) {
                    if (!$this->urlMatchesSourceScope($link, $source)) {
                        continue;
                    }

                    if ($this->isIndexUrl($link)) {
                        if (!isset($visited[$link]) && !isset($queued[$link])) {
                            $queue[] = $link;
                            $queued[$link] = true;
                        }
                        continue;
                    }

                    if (!$this->isLawDocumentUrl($link)) {
                        continue;
                    }

                    if (!isset($documents[$link])) {
                        $documents[$link] = $this->buildCatalogDocument($link, $source);
                    }
                }
            } catch (Throwable $e) {
                continue;
            }
        }

        return array_values($documents);
    }

    private function buildCatalogDocument(string $url, array $source): array
    {
        $label = trim((string) ($source['documentLabel'] ?? ''));
        if ($label === '') {
            $label = $this->guessCatalogLabel($url);
        }

        return [
            'url' => $url,
            'label' => $label,
            'sourceId' => $source['id'],
            'sourceLabel' => $source['label'],
            'sourceOrder' => (int) ($source['sortOrder'] ?? 0),
        ];
    }

    private function urlMatchesSourceScope(string $url, array $source): bool
    {
        $path = strtolower((string) parse_url($url, PHP_URL_PATH));
        if ($path === '') {
            return false;
        }

        $allowPrefixes = array_map('strtolower', $source['allowPrefixes'] ?? []);
        if (!empty($allowPrefixes)) {
            $allowed = false;
            foreach ($allowPrefixes as $prefix) {
                if (str_starts_with($path, $prefix)) {
                    $allowed = true;
                    break;
                }
            }

            if (!$allowed) {
                return false;
            }
        }

        foreach (array_map('strtolower', $source['excludePrefixes'] ?? []) as $prefix) {
            if (str_starts_with($path, $prefix)) {
                return false;
            }
        }

        $includePatterns = array_map('strtolower', $source['includePatterns'] ?? []);
        if (!empty($includePatterns)) {
            $matched = false;
            foreach ($includePatterns as $pattern) {
                if ($pattern !== '' && str_contains($path, $pattern)) {
                    $matched = true;
                    break;
                }
            }

            if (!$matched) {
                return false;
            }
        }

        foreach (array_map('strtolower', $source['excludePatterns'] ?? []) as $pattern) {
            if ($pattern !== '' && str_contains($path, $pattern)) {
                return false;
            }
        }

        return true;
    }

    public function importFromUrl(string $url, bool $persist = false): array
    {
        $normalizedUrl = $this->normalizePlanaltoUrl($url);
        $html = $this->fetchHtml($normalizedUrl);
        $preferred = $this->resolvePreferredDocument($normalizedUrl, $html);

        $importedLaw = $this->parseLawDocument($preferred['url'], $preferred['html']);
        $existingId = $this->repository->findLawIdByOfficialUrl($importedLaw['officialUrl']);
        $existingLaw = $existingId ? $this->repository->fetchLawDetail((string) $existingId, null, false) : null;

        $mergedLaw = $this->mergeImportedLawWithExisting($importedLaw, $existingLaw);
        $syncStats = $this->calculateSyncStats($existingLaw, $mergedLaw);

        if (!$persist) {
            return [
                'law' => $mergedLaw,
                'persisted' => false,
                'created' => $existingLaw === null,
                'sourceUrl' => $mergedLaw['officialUrl'],
                'sync' => $syncStats,
            ];
        }

        $saved = $this->repository->saveAdminPayload($mergedLaw);
        $syncStats = $this->calculateSyncStats($existingLaw, $saved);
        $message = ($syncStats['insertedArticles'] + $syncStats['changedArticles'] + $syncStats['revokedArticles']) > 0
            ? 'Lei sincronizada automaticamente a partir do Portal do Planalto com alteracoes registradas.'
            : 'Lei sincronizada automaticamente a partir do Portal do Planalto sem alteracoes.';

        $this->repository->recordSyncOutcome(
            $existingLaw,
            $saved,
            $saved['officialUrl'] ?? $mergedLaw['officialUrl'],
            $preferred['html'],
            $syncStats
        );

        $this->repository->recordSyncLog(
            isset($saved['id']) ? (int) $saved['id'] : null,
            'success',
            $message,
            $saved['officialUrl'] ?? $mergedLaw['officialUrl'],
            $syncStats['insertedArticles'],
            $syncStats['changedArticles'],
            $syncStats['revokedArticles']
        );

        return [
            'law' => $saved,
            'persisted' => true,
            'created' => $existingLaw === null,
            'sourceUrl' => $saved['officialUrl'] ?? $mergedLaw['officialUrl'],
            'sync' => $syncStats,
        ];
    }

    public function syncLawById(string $identifier): array
    {
        $existingLaw = $this->repository->fetchLawDetail($identifier, null, false);
        if (!$existingLaw) {
            throw new RuntimeException('Lei nao encontrada.', 404);
        }

        $officialUrl = trim((string) ($existingLaw['officialUrl'] ?? ''));
        if ($officialUrl === '') {
            throw new InvalidArgumentException('A lei nao possui URL oficial cadastrada.');
        }

        try {
            return $this->importFromUrl($officialUrl, true);
        } catch (Throwable $e) {
            $this->repository->recordSyncFailure((int) $existingLaw['id'], $officialUrl, $e);
            throw $e;
        }
    }

    public function syncImportedLaws(int $limit = 10): array
    {
        $candidates = $this->repository->fetchSyncCandidates($limit);
        $results = [];
        $summary = [
            'checked' => 0,
            'updated' => 0,
            'unchanged' => 0,
            'failed' => 0,
            'insertedArticles' => 0,
            'changedArticles' => 0,
            'revokedArticles' => 0,
        ];

        foreach ($candidates as $candidate) {
            $identifier = (string) ($candidate['id'] ?? '');
            $summary['checked'] += 1;

            try {
                $result = $this->syncLawById($identifier);
                $sync = $result['sync'] ?? [];
                $hasChanges = ((int) ($sync['insertedArticles'] ?? 0)
                    + (int) ($sync['changedArticles'] ?? 0)
                    + (int) ($sync['revokedArticles'] ?? 0)) > 0;

                $summary[$hasChanges ? 'updated' : 'unchanged'] += 1;
                $summary['insertedArticles'] += (int) ($sync['insertedArticles'] ?? 0);
                $summary['changedArticles'] += (int) ($sync['changedArticles'] ?? 0);
                $summary['revokedArticles'] += (int) ($sync['revokedArticles'] ?? 0);
                $results[] = [
                    'lawId' => $identifier,
                    'title' => $result['law']['shortTitle'] ?? $candidate['short_title'] ?? $candidate['title'] ?? '',
                    'sourceUrl' => $result['sourceUrl'] ?? $candidate['official_url'] ?? '',
                    'status' => $hasChanges ? 'updated' : 'unchanged',
                    'sync' => $sync,
                ];
            } catch (Throwable $error) {
                $summary['failed'] += 1;
                $this->repository->recordSyncFailure((int) $identifier, (string) ($candidate['official_url'] ?? ''), $error);
                $results[] = [
                    'lawId' => $identifier,
                    'title' => $candidate['short_title'] ?? $candidate['title'] ?? '',
                    'sourceUrl' => $candidate['official_url'] ?? '',
                    'status' => 'failed',
                    'message' => $error->getMessage(),
                ];
            }
        }

        return [
            'summary' => $summary,
            'results' => $results,
        ];
    }

    private function fetchHtml(string $url): string
    {
        $html = '';

        try {
            $html = $this->fetchHtmlWithCurl($url);
        } catch (Throwable $e) {
            $html = '';
        }

        if (trim($html) !== '') {
            return $this->normalizeEncoding($html);
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => implode("\r\n", [
                    'User-Agent: ConcursoMestre-LegalSync/1.0',
                    'Accept: text/html,application/xhtml+xml',
                ]),
                'timeout' => 30,
                'ignore_errors' => true,
            ],
        ]);

        $html = @file_get_contents($url, false, $context);
        if (!is_string($html) || trim($html) === '') {
            throw new RuntimeException('Nao foi possivel carregar a URL do Planalto.');
        }

        return $this->normalizeEncoding($html);
    }

    private function fetchHtmlWithCurl(string $url): string
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException('Nao foi possivel carregar a URL do Planalto.');
        }

        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0 Safari/537.36',
            CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml'],
            CURLOPT_TIMEOUT => 30,
            CURLOPT_ENCODING => '',
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_PROXY => '',
            CURLOPT_NOPROXY => '*',
        ]);

        $html = curl_exec($handle);
        $error = curl_error($handle);
        $statusCode = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        curl_close($handle);

        if (!is_string($html) || trim($html) === '' || $statusCode < 200 || $statusCode >= 400) {
            throw new RuntimeException($error !== '' ? $error : 'Nao foi possivel carregar a URL do Planalto.');
        }

        return $html;
    }

    private function normalizeEncoding(string $html): string
    {
        if (str_starts_with($html, "\xFF\xFE")) {
            return mb_convert_encoding(substr($html, 2), 'UTF-8', 'UTF-16LE');
        }

        if (str_starts_with($html, "\xFE\xFF")) {
            return mb_convert_encoding(substr($html, 2), 'UTF-8', 'UTF-16BE');
        }

        if (substr_count(substr($html, 0, 300), "\x00") > 30) {
            $utf16 = substr($html, 0, 2) === "\x00<" ? 'UTF-16BE' : 'UTF-16LE';
            return mb_convert_encoding($html, 'UTF-8', $utf16);
        }

        $encoding = 'UTF-8';
        if (preg_match('/charset\s*=\s*([a-zA-Z0-9\-_]+)/i', $html, $matches)) {
            $encoding = strtoupper(trim($matches[1]));
        } else {
            $detected = mb_detect_encoding($html, ['UTF-8', 'UTF-16LE', 'UTF-16BE', 'WINDOWS-1252', 'ISO-8859-1'], true);
            if (is_string($detected) && $detected !== '') {
                $encoding = strtoupper($detected);
            }
        }

        if (!in_array($encoding, ['UTF-8', 'UTF-16LE', 'UTF-16BE', 'ISO-8859-1', 'WINDOWS-1252'], true)) {
            $encoding = 'UTF-8';
        }

        if ($encoding === 'UTF-8' && !mb_check_encoding($html, 'UTF-8')) {
            $encoding = 'WINDOWS-1252';
        }

        if ($encoding !== 'UTF-8') {
            $html = mb_convert_encoding($html, 'UTF-8', $encoding);
        }

        if (!mb_check_encoding($html, 'UTF-8') && function_exists('iconv')) {
            $normalized = @iconv('UTF-8', 'UTF-8//IGNORE', $html);
            if (is_string($normalized) && $normalized !== '') {
                $html = $normalized;
            }
        }

        return $html;
    }

    private function resolvePreferredDocument(string $url, string $html): array
    {
        if (preg_match('/Texto\s+compilado/i', $html) && preg_match('/<a[^>]+href="([^"]*compilado[^"]*)"/i', $html, $matches)) {
            $candidate = $this->resolveAbsoluteUrl($url, $matches[1]);
            if ($candidate !== $url && $this->isPlanaltoUrl($candidate)) {
                try {
                    return [
                        'url' => $candidate,
                        'html' => $this->fetchHtml($candidate),
                    ];
                } catch (Throwable $e) {
                    // Mantem o HTML original se a versao compilada falhar.
                }
            }
        }

        return [
            'url' => $url,
            'html' => $html,
        ];
    }

    private function parseLawDocument(string $url, string $html): array
    {
        $lines = $this->extractReadableLines($html);
        $metadataLine = $this->extractMetadataLine($lines, $url);
        $ementa = $this->extractEmentaComplete($lines);
        $preamble = $this->extractPreamble($lines, $metadataLine, $ementa);
        $structuredArticles = $this->parseArticlesFromElements($this->extractLegalStructure($html));
        $lineArticles = $this->parseArticles($lines);
        $articles = $this->chooseBestParsedArticles($structuredArticles, $lineArticles);
        $classification = $this->classifyLaw($metadataLine, $ementa, $url);

        $lastSyncedAt = (new DateTimeImmutable('now'))->format(DateTime::ATOM);
        $aliases = array_values(array_filter(array_unique([
            $classification['shortTitle'],
            $classification['acronym'],
            $classification['topicName'],
            $metadataLine,
        ])));

        $legalAreaId = (string) $this->repository->resolveAreaIdBySlug($classification['areaSlug']);
        $lawTopicName = $this->buildLawTopicName($classification);
        $taxonomyAssignment = $this->assignTaxonomiesToArticles(
            $articles,
            $classification['subjectName'],
            $lawTopicName,
            $classification['topicName']
        );
        $articles = $taxonomyAssignment['articles'];
        $sections = $taxonomyAssignment['sections'] ?? [];
        $subjectFilterId = $taxonomyAssignment['subjectId'] ?? null;
        $lawTopicFilterId = $taxonomyAssignment['lawTopicId'] ?? null;

        return [
            'id' => '',
            'areaId' => $subjectFilterId !== null ? (string) $subjectFilterId : $legalAreaId,
            'legalAreaId' => $legalAreaId,
            'lawTopicFilterId' => $lawTopicFilterId !== null ? (string) $lawTopicFilterId : null,
            'area' => [
                'id' => $subjectFilterId !== null ? (string) $subjectFilterId : $legalAreaId,
                'legalAreaId' => $legalAreaId,
                'slug' => $classification['areaSlug'],
                'name' => $classification['subjectName'],
            ],
            'slug' => $this->buildLawSlug($classification['shortTitle'], $classification['number'], $classification['year']),
            'acronym' => $classification['acronym'],
            'title' => $classification['title'],
            'shortTitle' => $classification['shortTitle'],
            'number' => $classification['number'],
            'year' => $classification['year'],
            'date' => $classification['date'],
            'aliases' => $aliases,
            'description' => $ementa ?: $classification['title'],
            'summary' => $ementa ?: $classification['title'],
            'preamble' => $preamble,
            'ementa' => $ementa ?: $classification['title'],
            'status' => 'active',
            'officialUrl' => $url,
            'sourceName' => 'Portal do Planalto',
            'lastSyncedAt' => $lastSyncedAt,
            'lastUpdatedAt' => null,
            'isRecentlyUpdated' => false,
            'accessCount' => 0,
            'articleCount' => count($articles),
            'commentedArticleCount' => 0,
            'jurisprudenceCount' => 0,
            'examTipCount' => 0,
            'sections' => $sections,
            'articles' => $articles,
            'teacherComments' => [],
            'jurisprudence' => [],
            'examTips' => [],
            'userComments' => [],
            'updates' => [],
            'sumulas' => [],
        ];
    }

    private function extractLegalStructure(string $html): array
    {
        $document = $this->loadHtmlDocument($html);
        if (!$document instanceof DOMDocument) {
            return [];
        }

        $xpath = new DOMXPath($document);
        $nodes = $xpath->query('//body//*[self::p or self::div or self::center or self::blockquote or self::li or self::td or self::h1 or self::h2 or self::h3 or self::h4 or self::h5 or self::h6 or self::span or self::font]');
        if (!$nodes instanceof DOMNodeList) {
            return [];
        }

        $elements = [];
        foreach ($nodes as $node) {
            if (!$node instanceof DOMElement) {
                continue;
            }

            $nodeName = strtolower($node->nodeName);
            if (in_array($nodeName, ['span', 'font'], true) && $this->hasStructuralAncestor($node)) {
                continue;
            }
            if (in_array($nodeName, ['div', 'center'], true) && $this->hasStructuralChild($node)) {
                continue;
            }
            if ($this->isRemovedNode($node)) {
                continue;
            }

            $text = $this->normalizeLegalText($this->collectVisibleText($node));
            if ($text === '' || $this->isNoiseLine($text)) {
                continue;
            }

            $element = [
                'text' => $text,
                'anchor' => $this->extractFirstAnchor($node),
                'centered' => $this->isCenteredNode($node),
            ];

            foreach ($this->expandLegalStructureElement($element) as $expandedElement) {
                $elements[] = $expandedElement;
            }
        }

        return $this->compactLegalStructure($elements);
    }

    private function chooseBestParsedArticles(array $structuredArticles, array $lineArticles): array
    {
        if (empty($structuredArticles)) {
            return $lineArticles;
        }

        if (empty($lineArticles)) {
            return $structuredArticles;
        }

        $structuredCount = count($structuredArticles);
        $lineCount = count($lineArticles);

        // Algumas paginas antigas do Planalto tem HTML malformado em tabelas/fontes.
        // Quando o DOM fica artificialmente curto, o parser por linhas preserva o acervo.
        if ($lineCount > max($structuredCount + 25, (int) floor($structuredCount * 1.45))) {
            return $lineArticles;
        }

        return $structuredArticles;
    }

    private function expandLegalStructureElement(array $element): array
    {
        $text = trim((string) ($element['text'] ?? ''));
        if ($text === '') {
            return [];
        }

        $parts = $this->splitCombinedHierarchyText($text);
        if (count($parts) <= 1) {
            return [$element];
        }

        return array_map(static function (string $part) use ($element): array {
            return [
                ...$element,
                'text' => $part,
            ];
        }, $parts);
    }

    private function splitCombinedHierarchyText(string $text): array
    {
        [$cleanText] = $this->splitOfficialNotes($text);
        $cleanText = $this->normalizeLegalText($cleanText);
        if ($cleanText === '') {
            return [];
        }

        $pattern = '/\b(PARTE\s+(?:GERAL|ESPECIAL|FINAL|[A-Z0-9IVXLCDM]+)|LIVRO\s+[A-Z0-9IVXLCDM]+|T[\x{00CD}I]TULO\s+[A-Z0-9IVXLCDM]+|CAP[\x{00CD}I]TULO\s+[A-Z0-9IVXLCDM]+|SE[\x{00C7}C][\x{00C3}A]O\s+[A-Z0-9IVXLCDM]+|SUBSE[\x{00C7}C][\x{00C3}A]O\s+[A-Z0-9IVXLCDM]+)/iu';
        if (!preg_match_all($pattern, $cleanText, $matches, PREG_OFFSET_CAPTURE)) {
            return [$text];
        }

        $markers = $matches[1] ?? [];
        if (empty($markers) || (int) ($markers[0][1] ?? 0) > 3) {
            return [$text];
        }

        $parts = [];
        $markerCount = count($markers);
        for ($index = 0; $index < $markerCount; $index += 1) {
            $marker = trim((string) ($markers[$index][0] ?? ''));
            $markerOffset = (int) ($markers[$index][1] ?? 0);
            $markerEnd = $markerOffset + strlen((string) ($markers[$index][0] ?? ''));
            $nextOffset = $index + 1 < $markerCount ? (int) ($markers[$index + 1][1] ?? strlen($cleanText)) : strlen($cleanText);
            $name = $this->normalizeLegalText(substr($cleanText, $markerEnd, max(0, $nextOffset - $markerEnd)));

            if ($marker !== '') {
                $parts[] = $marker;
            }

            if ($name !== '' && !$this->isNoiseLine($name)) {
                $parts[] = $name;
            }
        }

        $parts = array_values(array_filter(array_map(
            fn (string $part): string => $this->normalizeLegalText($part),
            $parts
        )));

        return empty($parts) ? [$text] : $parts;
    }

    private function compactLegalStructure(array $elements): array
    {
        $result = [];
        $anchorIndex = [];

        foreach ($elements as $element) {
            $anchor = trim((string) ($element['anchor'] ?? ''));
            if ($anchor === '') {
                $result[] = $element;
                continue;
            }

            if (!isset($anchorIndex[$anchor])) {
                $anchorIndex[$anchor] = count($result);
                $result[] = $element;
                continue;
            }

            $previousIndex = $anchorIndex[$anchor];
            $previousText = (string) ($result[$previousIndex]['text'] ?? '');
            $currentText = (string) ($element['text'] ?? '');

            if ($currentText === $previousText) {
                continue;
            }

            if (mb_strlen($currentText, 'UTF-8') < mb_strlen($previousText, 'UTF-8') && str_contains($previousText, $currentText)) {
                $result[$previousIndex] = $element;
                continue;
            }

            if (str_contains($currentText, $previousText)) {
                continue;
            }

            $result[] = $element;
        }

        return array_values($result);
    }

    private function loadHtmlDocument(string $html): ?DOMDocument
    {
        libxml_use_internal_errors(true);

        $document = new DOMDocument('1.0', 'UTF-8');
        $loaded = @$document->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NOWARNING | LIBXML_NOERROR | LIBXML_NONET);
        libxml_clear_errors();

        return $loaded ? $document : null;
    }

    private function hasStructuralAncestor(DOMNode $node): bool
    {
        $parent = $node->parentNode;
        while ($parent instanceof DOMElement) {
            $name = strtolower($parent->nodeName);
            if (in_array($name, ['p', 'div', 'center', 'blockquote', 'li', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], true)) {
                return true;
            }

            $parent = $parent->parentNode;
        }

        return false;
    }

    private function hasStructuralChild(DOMElement $node): bool
    {
        foreach ($node->childNodes as $child) {
            if (!$child instanceof DOMElement) {
                continue;
            }

            if ($this->isStructuralElement($child)) {
                return true;
            }
        }

        return false;
    }

    private function isStructuralElement(DOMNode $node): bool
    {
        return $node instanceof DOMElement
            && in_array(strtolower($node->nodeName), ['p', 'div', 'center', 'blockquote', 'li', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], true);
    }

    private function isRemovedNode(DOMNode $node): bool
    {
        $cursor = $node;
        while ($cursor instanceof DOMElement) {
            $name = strtolower($cursor->nodeName);
            $style = strtolower((string) $cursor->getAttribute('style'));
            $className = strtolower((string) $cursor->getAttribute('class'));

            if (in_array($name, ['strike', 's', 'del'], true)) {
                return true;
            }
            if (str_contains($style, 'line-through') || str_contains($style, 'text-decoration:line-through')) {
                return true;
            }
            if (preg_match('/\b(revogado|obsolete|old-text)\b/i', $className)) {
                return true;
            }

            $cursor = $cursor->parentNode;
        }

        return false;
    }

    private function collectVisibleText(DOMNode $node): string
    {
        if ($this->isRemovedNode($node)) {
            return '';
        }

        if ($node->nodeType === XML_TEXT_NODE || $node->nodeType === XML_CDATA_SECTION_NODE) {
            return (string) $node->nodeValue;
        }

        if ($node instanceof DOMElement && strtolower($node->nodeName) === 'br') {
            return "\n";
        }

        $parts = [];
        foreach ($node->childNodes as $child) {
            if ($this->isStructuralElement($node) && $this->isStructuralElement($child)) {
                continue;
            }

            $text = $this->collectVisibleText($child);
            if (trim($text) !== '') {
                $parts[] = $text;
            }
        }

        return implode(' ', $parts);
    }

    private function extractFirstAnchor(DOMNode $node): ?string
    {
        if ($node instanceof DOMElement && strtolower($node->nodeName) === 'a') {
            $anchor = trim((string) ($node->getAttribute('name') ?: $node->getAttribute('id')));
            if ($anchor !== '') {
                return $anchor;
            }
        }

        foreach ($node->childNodes as $child) {
            $anchor = $this->extractFirstAnchor($child);
            if ($anchor !== null) {
                return $anchor;
            }
        }

        return null;
    }

    private function isCenteredNode(DOMElement $node): bool
    {
        $name = strtolower($node->nodeName);
        $align = strtolower((string) $node->getAttribute('align'));
        $style = strtolower((string) $node->getAttribute('style'));

        if ($name === 'center' || $align === 'center' || str_contains($style, 'text-align:center') || str_contains($style, 'text-align: center')) {
            return true;
        }

        $parent = $node->parentNode;
        while ($parent instanceof DOMElement) {
            $parentName = strtolower($parent->nodeName);
            if ($parentName === 'center' || strtolower((string) $parent->getAttribute('align')) === 'center') {
                return true;
            }

            $parent = $parent->parentNode;
        }

        return false;
    }

    private function normalizeLegalText(string $value): string
    {
        $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $value = str_replace(["\x1C", "\x1D"], '"', $value);
        $value = preg_replace('/[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}]/u', ' ', (string) $value);
        $value = preg_replace('/\x{00A0}/u', ' ', (string) $value);
        $value = preg_replace('/[ \t\r\n]+/u', ' ', (string) $value);

        return trim((string) $value);
    }

    private function isNoiseLine(string $text): bool
    {
        $comparable = $this->normalizeComparable($text);
        $noise = [
            'presidencia da republica',
            'casa civil',
            'subchefia para assuntos juridicos',
            'texto compilado',
            'mensagem de veto',
            'vigencia',
            'vide',
            'revogado',
        ];

        return in_array($comparable, $noise, true);
    }

    private function parseArticlesFromElements(array $elements): array
    {
        $articles = [];
        $currentArticle = null;
        $pendingHierarchyType = null;
        $currentHierarchy = $this->emptyHierarchy();
        $pendingArticleTitle = '';
        $pendingArticleTitleNotes = [];

        $totalElements = count($elements);
        for ($index = 0; $index < $totalElements; $index += 1) {
            $element = $elements[$index];
            $text = trim((string) ($element['text'] ?? ''));
            if ($text === '') {
                continue;
            }

            $hierarchyMarker = $this->parseHierarchyMarker($text);
            if ($hierarchyMarker !== null) {
                if ($currentArticle !== null) {
                    $this->refreshArticleDerivedFields($currentArticle);
                    $articles[] = $currentArticle;
                    $currentArticle = null;
                }

                $this->applyHierarchyMarker($currentHierarchy, $hierarchyMarker['type'], $hierarchyMarker['label']);
                $pendingHierarchyType = $hierarchyMarker['type'];
                if (($hierarchyMarker['name'] ?? '') !== '') {
                    $this->applyHierarchyName($currentHierarchy, $hierarchyMarker['type'], $hierarchyMarker['name']);
                    $pendingHierarchyType = null;
                }
                continue;
            }

            if ($pendingHierarchyType !== null && $currentArticle === null) {
                $parsedBlock = $this->parseBlockLine($text);
                [$pendingHierarchyText] = $this->splitOfficialNotes($text);
                if (preg_match('/^-\s*([A-Z])$/u', $pendingHierarchyText, $suffixMatch)) {
                    $labelKey = $pendingHierarchyType . 'Label';
                    $currentHierarchy[$labelKey] = trim((string) ($currentHierarchy[$labelKey] ?? '')) . '-' . $suffixMatch[1];
                    continue;
                }
                if (
                    !$this->isArticleStartElement($text)
                    && $parsedBlock === null
                    && $pendingHierarchyText !== ''
                ) {
                    $this->applyHierarchyName($currentHierarchy, $pendingHierarchyType, $text);
                    $pendingHierarchyType = null;
                    continue;
                }
            }

            // No Planalto, epigrafes como "Anterioridade da Lei" aparecem antes do artigo.
            // Elas sao diferentes dos marcadores estruturais Titulo/Capitulo ja tratados acima.
            if ($this->isLikelyArticleHeading($text)) {
                $nextElement = $this->findNextRelevantElement($elements, $index + 1);
                if ($nextElement !== null && $this->isArticleStartElement((string) ($nextElement['text'] ?? ''))) {
                    if ($currentArticle !== null) {
                        $this->refreshArticleDerivedFields($currentArticle);
                        $articles[] = $currentArticle;
                        $currentArticle = null;
                    }

                    [$headingText, $headingNotes] = $this->splitOfficialNotes($text);
                    $pendingArticleTitle = $headingText;
                    $pendingArticleTitleNotes = $headingNotes;
                    continue;
                }
            }

            if ($this->isArticleStartElement($text, $matches)) {
                if ($currentArticle !== null) {
                    $this->refreshArticleDerivedFields($currentArticle);
                    $articles[] = $currentArticle;
                }

                $number = $this->normalizeArticleNumber((string) $matches[1]);
                [$caputText, $notes] = $this->splitOfficialNotes($this->cleanArticleCaputText((string) ($matches[2] ?? '')));
                $currentArticle = $this->createArticleDraft(
                    $number,
                    $caputText,
                    $currentHierarchy,
                    $element['anchor'] ?? null,
                    $notes,
                    $pendingArticleTitle,
                    $pendingArticleTitleNotes
                );
                $pendingHierarchyType = null;
                $pendingArticleTitle = '';
                $pendingArticleTitleNotes = [];
                continue;
            }

            if ($currentArticle !== null) {
                $this->appendElementToArticle($currentArticle, $element);
            }
        }

        if ($currentArticle !== null) {
            $this->refreshArticleDerivedFields($currentArticle);
            $articles[] = $currentArticle;
        }

        return $this->deduplicateParsedArticles($articles);
    }

    private function findNextRelevantElement(array $elements, int $startIndex): ?array
    {
        $total = count($elements);
        for ($cursor = $startIndex; $cursor < $total; $cursor += 1) {
            $text = trim((string) ($elements[$cursor]['text'] ?? ''));
            if ($text === '') {
                continue;
            }

            [$legalText] = $this->splitOfficialNotes($text);
            if ($legalText === '') {
                continue;
            }

            return $elements[$cursor];
        }

        return null;
    }

    private function isLikelyArticleHeading(string $text): bool
    {
        [$legalText] = $this->splitOfficialNotes($text);
        $legalText = $this->normalizeLegalText($legalText);
        if ($legalText === '') {
            return false;
        }

        if ($this->isArticleStartElement($legalText) || $this->parseHierarchyMarker($legalText) !== null || $this->parseBlockLine($legalText) !== null) {
            return false;
        }

        $normalized = $this->normalizeComparable($legalText);
        if ($normalized === '' || str_starts_with($normalized, 'nota') || str_starts_with($normalized, 'redacao dada')) {
            return false;
        }

        if (preg_match('/[.;:]$/u', $legalText)) {
            return false;
        }

        $wordCount = preg_match_all('/[\p{L}\d]+/u', $legalText);
        return $wordCount > 0 && $wordCount <= 12 && mb_strlen($legalText, 'UTF-8') <= 120;
    }

    private function emptyHierarchy(): array
    {
        return [
            'partLabel' => null,
            'part' => null,
            'bookLabel' => null,
            'book' => null,
            'titleLabel' => null,
            'title' => null,
            'chapterLabel' => null,
            'chapter' => null,
            'sectionLabel' => null,
            'section' => null,
            'subsectionLabel' => null,
            'subsection' => null,
        ];
    }

    private function parseHierarchyMarker(string $text): ?array
    {
        [$cleanText] = $this->splitOfficialNotes($text);
        $cleanText = $this->normalizeLegalText($cleanText);
        if ($cleanText === '') {
            return null;
        }

        $hierarchyOrdinal = '(?:[IVXLCDM]+|\d+)(?:-[A-Z])?';
        $patterns = [
            'part' => '/^(PARTE)\s+(GERAL|ESPECIAL|FINAL|UNICA|' . $hierarchyOrdinal . ')(?:\s*[-\x{2013}\x{2014}]?\s+(.+))?$/iu',
            'book' => '/^(LIVRO)\s+(' . $hierarchyOrdinal . ')(?:\s*[-\x{2013}\x{2014}]?\s+(.+))?$/iu',
            'title' => '/^(T[\x{00CD}I]TULO)\s+(' . $hierarchyOrdinal . ')(?:\s*[-\x{2013}\x{2014}]?\s+(.+))?$/iu',
            'chapter' => '/^(CAP[\x{00CD}I]TULO)\s+(' . $hierarchyOrdinal . ')(?:\s*[-\x{2013}\x{2014}]?\s+(.+))?$/iu',
            'section' => '/^(SE[\x{00C7}C][\x{00C3}A]O)\s+(' . $hierarchyOrdinal . ')(?:\s*[-\x{2013}\x{2014}]?\s+(.+))?$/iu',
            'subsection' => '/^(SUBSE[\x{00C7}C][\x{00C3}A]O)\s+(' . $hierarchyOrdinal . ')(?:\s*[-\x{2013}\x{2014}]?\s+(.+))?$/iu',
        ];

        foreach ($patterns as $type => $pattern) {
            if (!preg_match($pattern, $cleanText, $matches)) {
                continue;
            }

            $label = trim($matches[1] . ' ' . $matches[2]);
            $name = trim((string) ($matches[3] ?? ''));
            if (preg_match('/^-\s*([A-Z])$/u', $name, $suffixMatch)) {
                $label .= '-' . $suffixMatch[1];
                $name = '';
            }

            return [
                'type' => $type,
                'label' => $this->normalizeLegalText($label),
                'name' => $this->normalizeLegalText($name),
            ];
        }

        return null;
    }

    private function applyHierarchyMarker(array &$hierarchy, string $type, string $label): void
    {
        $labelKey = $type . 'Label';
        $hierarchy[$labelKey] = $label;
        $hierarchy[$type] = null;

        $descendants = match ($type) {
            'part' => ['book', 'title', 'chapter', 'section', 'subsection'],
            'book' => ['title', 'chapter', 'section', 'subsection'],
            'title' => ['chapter', 'section', 'subsection'],
            'chapter' => ['section', 'subsection'],
            'section' => ['subsection'],
            default => [],
        };

        foreach ($descendants as $descendant) {
            $hierarchy[$descendant . 'Label'] = null;
            $hierarchy[$descendant] = null;
        }
    }

    private function applyHierarchyName(array &$hierarchy, string $type, string $name): void
    {
        $hierarchy[$type] = $this->normalizeLegalText($name);
    }

    private function isArticleStartElement(string $text, ?array &$matches = null): bool
    {
        if (!preg_match('/^Art\.?\s*([0-9]+(?:\.[0-9]+)*(?:\s*[\x{00BA}\x{00B0}o])?(?:-[A-Z])?)\.?\s*(.*)$/u', ltrim($text), $found)) {
            return false;
        }

        $matches = $found;
        return true;
    }

    private function normalizeArticleNumber(string $number): string
    {
        $ordinal = html_entity_decode('&#186;', ENT_QUOTES, 'UTF-8');
        $number = trim($number);
        $number = preg_replace('/(\d+(?:\.\d+)*)\s+([\x{00BA}\x{00B0}o])(?=(?:-[A-Z])?$)/u', '$1$2', $number) ?: $number;
        $number = preg_replace('/(?<=\d)(?:\x{00B0}|o)(?=(?:-[A-Z])?$)/u', $ordinal, $number) ?: $number;

        return $number;
    }

    private function cleanArticleCaputText(string $text): string
    {
        $text = $this->normalizeLegalText($text);
        return $this->normalizeLegalText((string) preg_replace('/^[-\x{2013}\x{2014}]\s*/u', '', $text));
    }

    private function createArticleDraft(
        string $number,
        string $caputText,
        array $hierarchy,
        ?string $anchor,
        array $notes,
        string $articleTitle = '',
        array $articleTitleNotes = []
    ): array
    {
        $slug = 'art-' . $this->slugify($number);
        $allNotes = array_values(array_unique(array_merge($articleTitleNotes, $notes)));
        $article = [
            'id' => '',
            'lawId' => '',
            'slug' => $slug,
            'number' => $number,
            'title' => $this->normalizeLegalText($articleTitle),
            'text' => '',
            'paragraphs' => [],
            'jurisprudenceNotes' => [],
            'syllabi' => [],
            'doctrine' => [],
            'relatedQuestionCount' => 0,
            'hierarchy' => $hierarchy,
            'blocks' => [],
            'officialAnchor' => $anchor !== null && $anchor !== '' ? '#' . $anchor : '#art' . preg_replace('/[^0-9A-Z]+/i', '', $number),
            '_caputBlockId' => null,
            '_currentParagraphBlockId' => null,
            '_currentIncisoBlockId' => null,
            '_currentAlineaBlockId' => null,
            '_lastLegalBlockId' => null,
            '_blockIds' => [],
        ];

        $caputBlockId = $this->addArticleBlock($article, 'caput', 'Art. ' . $number, $caputText, null, $anchor, $allNotes);
        $article['_caputBlockId'] = $caputBlockId;
        $article['_lastLegalBlockId'] = $caputBlockId;
        $this->addOfficialNoteBlocks($article, $allNotes, $caputBlockId, $anchor);

        return $article;
    }

    private function appendElementToArticle(array &$article, array $element): void
    {
        $text = trim((string) ($element['text'] ?? ''));
        if ($text === '') {
            return;
        }

        [$legalText, $notes] = $this->splitOfficialNotes($text);
        $parsedBlock = $legalText !== '' ? $this->parseBlockLine($legalText) : null;
        $anchor = $element['anchor'] ?? null;

        if ($parsedBlock !== null) {
            $parentBlockId = $this->resolveParentBlockId($article, $parsedBlock['kind']);
            $blockId = $this->addArticleBlock(
                $article,
                $parsedBlock['kind'],
                $parsedBlock['label'],
                $parsedBlock['text'],
                $parentBlockId,
                $anchor,
                $notes
            );
            $this->updateArticleBlockCursors($article, $parsedBlock['kind'], $blockId);
            $this->addOfficialNoteBlocks($article, $notes, $blockId, $anchor);
            return;
        }

        if ($legalText !== '') {
            $this->appendToLastLegalBlock($article, $legalText, $notes);
        }

        $parentBlockId = $article['_lastLegalBlockId'] ?? $article['_caputBlockId'] ?? null;
        $this->addOfficialNoteBlocks($article, $notes, $parentBlockId, $anchor);
    }

    private function parseBlockLine(string $text): ?array
    {
        $text = trim($text);

        if (preg_match('/^(Par\S*grafo\s+\S*nico\.?|\x{00A7}+\s*\d+[\x{00BA}\x{00B0}o]?(?:-[A-Z])?)\.?\s*(.*)$/iu', $text, $matches)) {
            return [
                'kind' => 'paragraph',
                'label' => $this->normalizeBlockLabel('paragraph', $matches[1]),
                'text' => $this->normalizeLegalText(preg_replace('/^\.\s*/u', '', (string) ($matches[2] ?? '')) ?: ''),
            ];
        }

        if (preg_match('/^([IVXLCDM]+)\s*[-\x{2013}\x{2014}]\s*(.*)$/u', $text, $matches)) {
            return [
                'kind' => 'inciso',
                'label' => trim($matches[1]),
                'text' => $this->normalizeLegalText($matches[2] ?? ''),
            ];
        }

        if (preg_match('/^([a-z])\)\s*(.*)$/u', $text, $matches)) {
            return [
                'kind' => 'alinea',
                'label' => trim($matches[1]) . ')',
                'text' => $this->normalizeLegalText($matches[2] ?? ''),
            ];
        }

        if (preg_match('/^(\d+)\s*[-.)]\s*(.*)$/u', $text, $matches)) {
            return [
                'kind' => 'item',
                'label' => trim($matches[1]),
                'text' => $this->normalizeLegalText($matches[2] ?? ''),
            ];
        }

        return null;
    }

    private function normalizeBlockLabel(string $kind, string $label): string
    {
        $label = $this->normalizeLegalText($label);
        $label = rtrim($label, '.');
        if ($kind === 'paragraph') {
            $label = $this->normalizeArticleNumber($label);
        }

        return $label;
    }

    private function resolveParentBlockId(array $article, string $kind): ?string
    {
        if ($kind === 'paragraph') {
            return $article['_caputBlockId'] ?? null;
        }

        if ($kind === 'inciso') {
            $paragraphId = $article['_currentParagraphBlockId'] ?? null;
            return $paragraphId ?: ($article['_caputBlockId'] ?? null);
        }

        if ($kind === 'alinea') {
            return $article['_currentIncisoBlockId']
                ?? $article['_currentParagraphBlockId']
                ?? $article['_caputBlockId']
                ?? null;
        }

        if ($kind === 'item') {
            return $article['_currentAlineaBlockId']
                ?? $article['_currentIncisoBlockId']
                ?? $article['_currentParagraphBlockId']
                ?? $article['_caputBlockId']
                ?? null;
        }

        return $article['_lastLegalBlockId'] ?? null;
    }

    private function updateArticleBlockCursors(array &$article, string $kind, string $blockId): void
    {
        if ($kind === 'paragraph') {
            $article['_currentParagraphBlockId'] = $blockId;
            $article['_currentIncisoBlockId'] = null;
            $article['_currentAlineaBlockId'] = null;
        } elseif ($kind === 'inciso') {
            $article['_currentIncisoBlockId'] = $blockId;
            $article['_currentAlineaBlockId'] = null;
        } elseif ($kind === 'alinea') {
            $article['_currentAlineaBlockId'] = $blockId;
        }

        if ($kind !== 'note') {
            $article['_lastLegalBlockId'] = $blockId;
        }
    }

    private function addArticleBlock(array &$article, string $kind, string $label, string $text, ?string $parentBlockId, ?string $anchor, array $notes = []): string
    {
        $baseId = $kind === 'caput' ? 'caput' : $this->slugify($kind . '-' . $label);
        $id = $baseId;
        $counter = 2;
        while (isset($article['_blockIds'][$id])) {
            $id = $baseId . '-' . $counter;
            $counter += 1;
        }
        $article['_blockIds'][$id] = true;

        $block = [
            'id' => $id,
            'kind' => $kind,
            'label' => $label,
            'text' => $this->normalizeLegalText($text),
        ];

        if ($parentBlockId !== null && $parentBlockId !== '') {
            $block['parentBlockId'] = $parentBlockId;
        }
        if ($anchor !== null && $anchor !== '') {
            $block['anchor'] = $anchor;
        }
        if (!empty($notes)) {
            $block['notes'] = array_values($notes);
            $block['sourceNote'] = implode(' ', $notes);
        }

        $article['blocks'][] = $block;
        return $id;
    }

    private function appendToLastLegalBlock(array &$article, string $text, array $notes = []): void
    {
        $lastBlockId = $article['_lastLegalBlockId'] ?? null;
        if ($lastBlockId === null) {
            $lastBlockId = $this->addArticleBlock($article, 'caput', 'Art. ' . (string) ($article['number'] ?? ''), $text, null, null, $notes);
            $article['_caputBlockId'] = $lastBlockId;
            $article['_lastLegalBlockId'] = $lastBlockId;
            return;
        }

        foreach ($article['blocks'] as &$block) {
            if (($block['id'] ?? '') !== $lastBlockId) {
                continue;
            }

            $block['text'] = $this->normalizeLegalText(trim((string) ($block['text'] ?? '') . ' ' . $text));
            if (!empty($notes)) {
                $existingNotes = $block['notes'] ?? [];
                $block['notes'] = array_values(array_unique(array_merge($existingNotes, $notes)));
                $block['sourceNote'] = implode(' ', $block['notes']);
            }
            unset($block);
            return;
        }
        unset($block);
    }

    private function addOfficialNoteBlocks(array &$article, array $notes, ?string $parentBlockId, ?string $anchor): void
    {
        $existingNotes = [];
        foreach ($article['blocks'] ?? [] as $block) {
            if (($block['kind'] ?? '') !== 'note') {
                continue;
            }

            $key = $this->normalizeComparable((string) ($block['text'] ?? '')) . '|' . (string) ($block['parentBlockId'] ?? '');
            $existingNotes[$key] = true;
        }

        foreach ($notes as $note) {
            $key = $this->normalizeComparable((string) $note) . '|' . (string) ($parentBlockId ?? '');
            if (isset($existingNotes[$key])) {
                continue;
            }

            $existingNotes[$key] = true;
            $this->addArticleBlock($article, 'note', 'Nota', $note, $parentBlockId, $anchor);
        }
    }

    private function splitOfficialNotes(string $text): array
    {
        $notes = [];
        $legalText = $text;

        if (preg_match_all('/\([^()]{3,260}\)/u', $text, $matches)) {
            foreach ($matches[0] as $note) {
                $comparable = $this->normalizeComparable($note);
                $isOfficialNote = str_contains($comparable, 'redacao dada')
                    || str_contains($comparable, 'incluido')
                    || str_contains($comparable, 'alterado')
                    || str_contains($comparable, 'revogado')
                    || str_contains($comparable, 'renumerado')
                    || str_contains($comparable, 'vide')
                    || str_contains($comparable, 'vigencia')
                    || str_contains($comparable, 'regulamento')
                    || str_contains($comparable, 'producao de efeito');

                if (!$isOfficialNote) {
                    continue;
                }

                $cleanNote = $this->normalizeLegalText($note);
                if ($cleanNote !== '') {
                    $notes[] = $cleanNote;
                    $legalText = str_replace($note, ' ', $legalText);
                }
            }
        }

        return [
            $this->normalizeLegalText($legalText),
            array_values(array_unique($notes)),
        ];
    }

    private function refreshArticleDerivedFields(array &$article): void
    {
        $paragraphs = [];
        foreach ($article['blocks'] as $block) {
            if (($block['kind'] ?? '') !== 'paragraph') {
                continue;
            }

            $paragraphs[] = [
                'number' => (string) ($block['label'] ?? ''),
                'text' => (string) ($block['text'] ?? ''),
            ];
        }

        $article['paragraphs'] = $paragraphs;
        $article['text'] = $this->flattenArticleBlocks($article['blocks']);
        if (trim((string) ($article['title'] ?? '')) === '') {
            $article['title'] = $this->inferArticleTitle($article['text'], $article['hierarchy'] ?? []);
        }

        unset(
            $article['_caputBlockId'],
            $article['_currentParagraphBlockId'],
            $article['_currentIncisoBlockId'],
            $article['_currentAlineaBlockId'],
            $article['_lastLegalBlockId'],
            $article['_blockIds']
        );
    }

    private function deduplicateParsedArticles(array $articles): array
    {
        $result = [];
        $seen = [];

        foreach ($articles as $article) {
            $slug = (string) ($article['slug'] ?? '');
            if ($slug === '') {
                $slug = 'art-' . $this->slugify((string) ($article['number'] ?? count($result) + 1));
                $article['slug'] = $slug;
            }

            if (isset($seen[$slug])) {
                $previousIndex = (int) $seen[$slug];
                if (isset($result[$previousIndex]) && $this->isSameArticleScope($result[$previousIndex], $article)) {
                    $article['slug'] = $slug;
                    $result[$previousIndex] = $article;
                    continue;
                }

                $hierarchy = $article['hierarchy'] ?? [];
                $suffixSource = implode('-', array_filter([
                    (string) ($hierarchy['part'] ?? $hierarchy['partLabel'] ?? ''),
                    (string) ($hierarchy['book'] ?? $hierarchy['bookLabel'] ?? ''),
                    (string) ($hierarchy['title'] ?? $hierarchy['titleLabel'] ?? ''),
                    (string) ($hierarchy['chapter'] ?? $hierarchy['chapterLabel'] ?? ''),
                    (string) ($article['title'] ?? ''),
                    'duplicado-' . (count($result) + 1),
                ]));

                $baseSlug = $slug . '-' . $this->slugify($suffixSource);
                $candidate = $baseSlug;
                $counter = 2;
                while (isset($seen[$candidate])) {
                    $candidate = $baseSlug . '-' . $counter;
                    $counter += 1;
                }

                $slug = $candidate;
                $article['slug'] = $slug;
            }

            $seen[$slug] = count($result);
            $result[] = $article;
        }

        return $result;
    }

    private function isSameArticleScope(array $firstArticle, array $secondArticle): bool
    {
        $firstHierarchy = $firstArticle['hierarchy'] ?? [];
        $secondHierarchy = $secondArticle['hierarchy'] ?? [];
        $keys = [
            'partLabel',
            'part',
            'bookLabel',
            'book',
            'titleLabel',
            'title',
            'chapterLabel',
            'chapter',
            'sectionLabel',
            'section',
            'subsectionLabel',
            'subsection',
        ];

        foreach ($keys as $key) {
            if ($this->normalizeComparable((string) ($firstHierarchy[$key] ?? '')) !== $this->normalizeComparable((string) ($secondHierarchy[$key] ?? ''))) {
                return false;
            }
        }

        return true;
    }

    private function extractReadableLines(string $html): array
    {
        $html = $this->stripRemovedMarkup($html);
        $sanitized = preg_replace('/<script[\s\S]*?<\/script>/i', "\n", $html);
        $sanitized = preg_replace('/<style[\s\S]*?<\/style>/i', "\n", (string) $sanitized);
        $sanitized = preg_replace('/<(br|\/p|\/div|\/tr|\/li|\/blockquote|\/table|\/h[1-6]|\/center)[^>]*>/i', "\n", (string) $sanitized);
        $sanitized = preg_replace('/<(p|div|tr|li|blockquote|table|h[1-6]|center)[^>]*>/i', "\n", (string) $sanitized);
        $sanitized = html_entity_decode(strip_tags((string) $sanitized), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $sanitized = str_replace(["\x1C", "\x1D"], '"', (string) $sanitized);
        $sanitized = preg_replace('/[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}]/u', ' ', (string) $sanitized);
        $sanitized = preg_replace('/\x{00A0}/u', ' ', (string) $sanitized);
        $sanitized = preg_replace('/[ \t]+/u', ' ', (string) $sanitized);
        $lines = preg_split('/\R+/u', (string) $sanitized) ?: [];

        $result = [];
        foreach ($lines as $line) {
            $cleanLine = trim((string) $line);
            if ($cleanLine === '') {
                continue;
            }

            if (preg_match('/^(Presid[êe]ncia da Rep[úu]blica|Casa Civil|Subchefia para Assuntos Jur[ií]dicos|Texto compilado|Vide|Vig[êe]ncia|Revogado|Mensagem de veto)$/iu', $cleanLine)) {
                continue;
            }

            $result[] = $cleanLine;
        }

        return $result;
    }

    private function stripRemovedMarkup(string $html): string
    {
        $clean = preg_replace('/<(strike|s|del)\b[^>]*>[\s\S]*?<\/\1>/iu', "\n", $html);
        $clean = preg_replace('/<([a-z0-9]+)\b(?=[^>]*(?:text-decoration\s*:\s*line-through|line-through|class\s*=\s*["\'][^"\']*\brevogado\b))[^>]*>[\s\S]*?<\/\1>/iu', "\n", (string) $clean);

        return is_string($clean) ? $clean : $html;
    }

    private function extractMetadataLine(array $lines, string $url): string
    {
        $fallback = '';
        foreach (array_slice($lines, 0, 60, true) as $index => $line) {
            if (preg_match('/^(CONSTITUI[ÇC][AÃ]O|LEI|DECRETO-LEI|DECRETO|C[ÓO]DIGO|ESTATUTO|CONSOLIDA[ÇC][AÃ]O)/iu', $line)) {
                if ($fallback === '') {
                    $fallback = $line;
                }

                $nextLine = trim((string) ($lines[$index + 1] ?? ''));
                if (
                    !preg_match('/\d{4}/u', $line)
                    && (
                        preg_match('/^(?:DE\s+)?\d{1,2}\s+DE\s+\p{L}+(?:\s+\p{L}+)*(?:\s+DE)?\s+\d{4}/iu', $nextLine)
                        || preg_match('/^DE\s+\d{4}$/iu', $nextLine)
                    )
                ) {
                    $line = trim($line . ', ' . $nextLine);
                }

                if (preg_match('/\d{4}/u', $line)) {
                    return $this->normalizeTitleCase($line);
                }
            }
        }

        if ($fallback !== '') {
            return $this->normalizeTitleCase($fallback);
        }

        return $this->guessCatalogLabel($url);
    }

    private function extractEmenta(array $lines): string
    {
        foreach (array_slice($lines, 0, 120) as $line) {
            if (preg_match('/^(Disp[õo]e|Institui|Regulamenta|Consolida|Altera|Define|Estabelece|Cria|Organiza)/iu', $line)) {
                return $this->normalizeSentence($line);
            }
        }

        return '';
    }

    private function extractEmentaComplete(array $lines): string
    {
        $startIndex = null;
        $firstLine = '';

        foreach (array_slice($lines, 0, 180, true) as $index => $line) {
            $trimmed = trim((string) $line);
            if ($trimmed === '') {
                continue;
            }

            if (preg_match('/^EMENTA\s*[:\-]?\s*(.*)$/iu', $trimmed, $matches)) {
                $startIndex = (int) $index;
                $firstLine = trim((string) ($matches[1] ?? ''));
                break;
            }

            $normalized = $this->normalizeComparable($trimmed);
            if (preg_match('/^(dispoe|institui|regulamenta|consolida|altera|define|estabelece|cria|organiza)\b/u', $normalized)) {
                $startIndex = (int) $index;
                $firstLine = $trimmed;
                break;
            }
        }

        if ($startIndex === null) {
            return '';
        }

        $ementaLines = [];
        if ($firstLine !== '') {
            $ementaLines[] = $this->normalizeSentence($firstLine);
        }

        $maxIndex = min(count($lines) - 1, $startIndex + 28);
        for ($cursor = $startIndex + 1; $cursor <= $maxIndex; $cursor += 1) {
            $nextLine = trim((string) ($lines[$cursor] ?? ''));
            if ($nextLine === '') {
                if (!empty($ementaLines)) {
                    break;
                }
                continue;
            }

            if ($this->isArticleStartLine($nextLine)) {
                break;
            }

            $normalized = $this->normalizeComparable($nextLine);
            if ($normalized === '') {
                continue;
            }

            if (
                preg_match('/^(preambulo|titulo\s+[ivxlcdm]+|capitulo\s+[ivxlcdm]+|secao\s+[ivxlcdm]+)\b/u', $normalized)
                || str_starts_with($normalized, 'o presidente da republica')
                || str_starts_with($normalized, 'faco saber')
                || str_starts_with($normalized, 'o congresso nacional decreta')
                || str_starts_with($normalized, 'nos, representantes do povo brasileiro')
                || str_starts_with($normalized, 'brasilia')
                || $normalized === 'texto compilado'
            ) {
                break;
            }

            $ementaLines[] = $this->normalizeSentence($nextLine);
        }

        if (empty($ementaLines)) {
            return '';
        }

        return $this->normalizeSentence(implode(' ', $ementaLines));
    }

    private function extractPreamble(array $lines, string $metadataLine, string $ementa): string
    {
        if (empty($lines)) {
            return '';
        }

        $metadataComparable = $this->normalizeComparable($metadataLine);
        $ementaComparable = $this->normalizeComparable($ementa);
        $preambleLines = [];

        foreach (array_slice($lines, 0, 220) as $line) {
            $trimmed = trim((string) $line);
            if ($trimmed === '') {
                continue;
            }

            if ($this->isArticleStartLine($trimmed)) {
                break;
            }

            $normalized = $this->normalizeComparable($trimmed);
            if ($normalized === '' || $normalized === $metadataComparable || $normalized === $ementaComparable) {
                continue;
            }

            if (preg_match('/^(bras[ií]lia|rio de janeiro)\b/iu', $trimmed)) {
                continue;
            }

            if (preg_match('/^\d{1,2}\s+de\s+\p{L}+/iu', $trimmed)) {
                continue;
            }

            if (
                str_contains($normalized, 'faco saber que o congresso nacional decreta')
                || str_contains($normalized, 'faco saber que o congresso nacional aprovou')
                || str_contains($normalized, 'o presidente da republica')
                || str_contains($normalized, 'o congresso nacional decreta')
                || str_contains($normalized, 'nos, representantes do povo brasileiro')
            ) {
                $preambleLines[] = $this->normalizeSentence($trimmed);
            }

            if (!empty($preambleLines) && count($preambleLines) >= 4) {
                break;
            }
        }

        if (empty($preambleLines)) {
            return '';
        }

        $preamble = trim(implode(' ', $preambleLines));
        if (mb_strlen($preamble) > 1200) {
            $preamble = trim(mb_substr($preamble, 0, 1197)) . '...';
        }

        return $preamble;
    }

    private function parseArticles(array $lines): array
    {
        $articles = [];
        $currentHierarchy = $this->emptyHierarchy();
        $pendingArticleTitle = '';
        $pendingArticleTitleNotes = [];

        $totalLines = count($lines);
        for ($index = 0; $index < $totalLines; $index += 1) {
            $line = $lines[$index];

            $hierarchyUpdate = $this->resolveHierarchyLine($lines, $index);
            if ($hierarchyUpdate !== null) {
                $type = $hierarchyUpdate['type'];
                $this->applyHierarchyMarker($currentHierarchy, $type, $hierarchyUpdate['label']);
                if (($hierarchyUpdate['name'] ?? '') !== '') {
                    $this->applyHierarchyName($currentHierarchy, $type, $hierarchyUpdate['name']);
                }

                $pendingArticleTitle = '';
                $pendingArticleTitleNotes = [];
                $index += $hierarchyUpdate['skip'];
                continue;
            }

            if ($this->isLikelyArticleHeading($line)) {
                $nextLine = $this->findNextRelevantLine($lines, $index + 1);
                if ($nextLine !== null && $this->isArticleStartLine($nextLine)) {
                    [$headingText, $headingNotes] = $this->splitOfficialNotes($line);
                    $pendingArticleTitle = $headingText;
                    $pendingArticleTitleNotes = $headingNotes;
                    continue;
                }
            }

            if (!$this->isArticleStartLine($line, $matches)) {
                continue;
            }

            $articleNumber = $this->normalizeArticleNumber($matches[1]);
            $articleLines = [$line];

            $cursor = $index + 1;
            while ($cursor < $totalLines) {
                $nextLine = $lines[$cursor];
                $nextRelevantAfterLine = $this->isLikelyArticleHeading($nextLine)
                    ? $this->findNextRelevantLine($lines, $cursor + 1)
                    : null;

                if (
                    $this->resolveHierarchyLine($lines, $cursor) !== null
                    || $this->isArticleStartLine($nextLine)
                    || ($nextRelevantAfterLine !== null && $this->isArticleStartLine($nextRelevantAfterLine))
                ) {
                    break;
                }

                $articleLines[] = $nextLine;
                $cursor += 1;
            }

            $articles[] = $this->buildArticlePayload(
                $articleNumber,
                $articleLines,
                $currentHierarchy,
                $pendingArticleTitle,
                $pendingArticleTitleNotes
            );
            $pendingArticleTitle = '';
            $pendingArticleTitleNotes = [];
            $index = $cursor - 1;
        }

        return $articles;
    }

    private function findNextRelevantLine(array $lines, int $startIndex): ?string
    {
        $totalLines = count($lines);
        for ($cursor = $startIndex; $cursor < $totalLines; $cursor += 1) {
            $line = trim((string) ($lines[$cursor] ?? ''));
            if ($line === '') {
                continue;
            }

            [$legalText] = $this->splitOfficialNotes($line);
            if ($legalText === '') {
                continue;
            }

            return $line;
        }

        return null;
    }

    private function isArticleStartLine(string $line, ?array &$matches = null): bool
    {
        $normalized = ltrim($line);

        if (!preg_match('/^Art\.?\s*([0-9]+(?:\.[0-9]+)*(?:\s*[\x{00BA}\x{00B0}o])?(?:-[A-Z])?)/u', $normalized, $found)) {
            return false;
        }

        $matches = $found;
        return true;
    }

    private function resolveHierarchyLine(array $lines, int $index): ?array
    {
        $line = $lines[$index] ?? '';
        $marker = $this->parseHierarchyMarker($line);
        if ($marker === null) {
            return null;
        }

        $name = (string) ($marker['name'] ?? '');
        $skip = 0;

        if ($name === '') {
            $nameParts = [];
            $totalLines = count($lines);
            for ($cursor = $index + 1; $cursor < $totalLines && $cursor <= $index + 4; $cursor += 1) {
                $nextLine = trim((string) ($lines[$cursor] ?? ''));
                if ($nextLine === '') {
                    break;
                }

                if ($this->parseHierarchyMarker($nextLine) !== null || $this->isArticleStartLine($nextLine) || $this->parseBlockLine($nextLine) !== null) {
                    break;
                }

                $nextRelevantAfterLine = $this->isLikelyArticleHeading($nextLine)
                    ? $this->findNextRelevantLine($lines, $cursor + 1)
                    : null;
                if (!empty($nameParts) && $nextRelevantAfterLine !== null && $this->isArticleStartLine($nextRelevantAfterLine)) {
                    break;
                }

                [$nextName] = $this->splitOfficialNotes($nextLine);
                if ($nextName === '' || $this->isNoiseLine($nextName)) {
                    break;
                }

                if (empty($nameParts) && preg_match('/^-\s*([A-Z])$/u', $nextName, $suffixMatch)) {
                    $marker['label'] .= '-' . $suffixMatch[1];
                    $skip += 1;
                    continue;
                }

                $nameParts[] = $nextName;
                $skip += 1;

                if (preg_match('/[.;:]$/u', $nextName)) {
                    break;
                }
            }

            if (!empty($nameParts)) {
                $name = implode(' ', $nameParts);
            }
        }

        return [
            'type' => $marker['type'],
            'label' => $marker['label'],
            'name' => $this->normalizeLegalText($name),
            'skip' => $skip,
        ];
    }

    private function buildArticlePayload(
        string $articleNumber,
        array $articleLines,
        array $hierarchy,
        string $articleTitle = '',
        array $articleTitleNotes = []
    ): array
    {
        $firstLine = array_shift($articleLines) ?: '';
        $caputText = trim((string) preg_replace('/^Art\.?\s*[0-9]+(?:\.[0-9]+)*(?:\s*[\x{00BA}\x{00B0}o])?(?:-[A-Z])?\.?\s*/u', '', $firstLine));
        [$caputText, $caputNotes] = $this->splitOfficialNotes($this->cleanArticleCaputText($caputText));
        $caputNotes = array_values(array_unique(array_merge($articleTitleNotes, $caputNotes)));
        $blocks = [];
        $paragraphs = [];

        if ($caputText !== '') {
            $caputBlock = [
                'id' => 'caput',
                'kind' => 'caput',
                'label' => 'Art. ' . $articleNumber,
                'text' => $this->normalizeSentence($caputText),
            ];

            if (!empty($caputNotes)) {
                $caputBlock['notes'] = $caputNotes;
                $caputBlock['sourceNote'] = implode(' ', $caputNotes);
            }

            $blocks[] = $caputBlock;
        }

        foreach ($articleLines as $line) {
            if (preg_match('/^(Par[áa]grafo [úu]nico\.|§+\s*\d+[º°o]?(?:-[A-Z])?)\s*(.*)$/iu', $line, $matches)) {
                $label = $this->normalizeSentence($matches[1]);
                $text = $this->normalizeSentence(preg_replace('/^\.\s*/u', '', (string) ($matches[2] ?: $line)) ?: $line);
                $paragraphs[] = ['number' => $label, 'text' => $text];
                $blocks[] = [
                    'id' => $this->slugify($label),
                    'kind' => 'paragraph',
                    'label' => $label,
                    'text' => $text,
                ];
                continue;
            }

            if (preg_match('/^([IVXLCDM]+)\s*[--]\s*(.*)$/u', $line, $matches)) {
                $blocks[] = [
                    'id' => $this->slugify($matches[1]),
                    'kind' => 'inciso',
                    'label' => $matches[1],
                    'text' => $this->normalizeSentence($matches[2]),
                ];
                continue;
            }

            if (preg_match('/^([a-z])\)\s*(.*)$/u', $line, $matches)) {
                $blocks[] = [
                    'id' => $this->slugify($matches[1]),
                    'kind' => 'alinea',
                    'label' => $matches[1] . ')',
                    'text' => $this->normalizeSentence($matches[2]),
                ];
                continue;
            }

            if (preg_match('/^(\d+)\s*[-.)]\s*(.*)$/u', $line, $matches)) {
                $blocks[] = [
                    'id' => $this->slugify($matches[1]),
                    'kind' => 'item',
                    'label' => $matches[1],
                    'text' => $this->normalizeSentence($matches[2]),
                ];
                continue;
            }

            if (!empty($blocks)) {
                $lastIndex = count($blocks) - 1;
                $blocks[$lastIndex]['text'] = trim($blocks[$lastIndex]['text'] . ' ' . $this->normalizeSentence($line));
            } else {
                $blocks[] = [
                    'id' => 'caput',
                    'kind' => 'caput',
                    'label' => 'Art. ' . $articleNumber,
                    'text' => $this->normalizeSentence($line),
                ];
            }
        }

        $officialText = $this->flattenArticleBlocks($blocks);

        return [
            'id' => '',
            'lawId' => '',
            'slug' => 'art-' . $this->slugify($articleNumber),
            'number' => $articleNumber,
            'title' => $this->normalizeLegalText($articleTitle) ?: $this->inferArticleTitle($officialText, $hierarchy),
            'text' => $officialText,
            'paragraphs' => $paragraphs,
            'jurisprudenceNotes' => [],
            'syllabi' => [],
            'doctrine' => [],
            'relatedQuestionCount' => 0,
            'hierarchy' => $hierarchy,
            'blocks' => $blocks,
            'officialAnchor' => '#art' . preg_replace('/\D+/', '', $articleNumber),
        ];
    }

    private function inferArticleTitle(string $officialText, array $hierarchy): string
    {
        if (preg_match('/\b(?:O|A)\s+art\.?\s*([0-9]+(?:[º°o]|-[A-Z])?)\s+(.+?)\s+passa(?:m)?\s+a\s+vigorar/iu', $officialText, $matches)) {
            $target = trim((string) preg_replace('/\s+/', ' ', $matches[2]));
            $target = preg_replace('/^do\s+/iu', 'do ', (string) $target) ?: $target;
            $target = preg_replace('/^da\s+/iu', 'da ', (string) $target) ?: $target;
            $target = preg_replace('/\s+com\s+as\s+seguintes\s+alteracoes:?$/iu', '', (string) $target) ?: $target;
            $target = preg_replace('/\s+com\s+a\s+seguinte\s+redacao:?$/iu', '', (string) $target) ?: $target;

            return trim(trim('Altera o art. ' . $matches[1] . ' ' . $target), " \t\n\r\0\x0B,.;:");
        }

        return '';
    }

    private function flattenArticleBlocks(array $blocks): string
    {
        $parts = [];

        foreach ($blocks as $block) {
            if (($block['kind'] ?? '') === 'note') {
                continue;
            }

            $label = trim((string) ($block['label'] ?? ''));
            $text = trim((string) ($block['text'] ?? ''));

            if ($label === '' && $text === '') {
                continue;
            }

            $parts[] = trim($label . ' ' . $text);
        }

        return $this->normalizeSentence(implode("\n", $parts));
    }

    private function assignTaxonomiesToArticles(
        array $articles,
        string $subjectName,
        string $lawTopicName,
        string $fallbackTopic
    ): array
    {
        $result = [];
        $sectionsBySlug = [];
        $sections = [];
        $rootTaxonomy = $this->repository->ensureLegalTaxonomyHierarchy($subjectName, $lawTopicName, null, null);
        $subjectId = $rootTaxonomy['subjectId'] ?? null;
        $lawTopicId = $rootTaxonomy['lawTopicId'] ?? null;
        $taxonomyCache = [];

        foreach ($articles as $articleIndex => $article) {
            $hierarchy = $article['hierarchy'] ?? [];
            $subtopicName = $this->resolveArticleSubtopic($hierarchy);
            $assuntoName = $this->resolveArticleAssunto($hierarchy, $fallbackTopic, $subtopicName);

            if ($subtopicName !== '' && $assuntoName !== '') {
                $sameComparable = $this->normalizeComparable($subtopicName) === $this->normalizeComparable($assuntoName);
                if ($sameComparable) {
                    $assuntoName = '';
                }
            }

            $cacheKey = implode('|', [
                $this->normalizeComparable($subjectName),
                $this->normalizeComparable($lawTopicName),
                $this->normalizeComparable($subtopicName),
                $this->normalizeComparable($assuntoName),
            ]);

            if (!isset($taxonomyCache[$cacheKey])) {
                $taxonomyCache[$cacheKey] = $this->repository->ensureLegalTaxonomyHierarchy(
                    $subjectName,
                    $lawTopicName,
                    $subtopicName !== '' ? $subtopicName : null,
                    $assuntoName !== '' ? $assuntoName : null
                );
            }

            $taxonomy = $taxonomyCache[$cacheKey];
            $sectionSlug = $this->buildNormalizedSectionKey($hierarchy, $subtopicName, $assuntoName, $articleIndex);
            if (!isset($sectionsBySlug[$sectionSlug])) {
                $sectionsBySlug[$sectionSlug] = count($sections);
                $titleLabel = trim((string) ($hierarchy['titleLabel'] ?? ''));
                $titleName = trim((string) ($hierarchy['title'] ?? ''));
                $chapterLabel = trim((string) ($hierarchy['chapterLabel'] ?? ''));
                $chapterName = trim((string) ($hierarchy['chapter'] ?? ''));
                $displayTitle = $this->buildSectionDisplayTitle($titleLabel, $titleName, $chapterLabel, $chapterName, $lawTopicName, count($sections));

                $sections[] = [
                    'id' => $sectionSlug,
                    'slug' => $sectionSlug,
                    'displayTitle' => $displayTitle,
                    'title' => $displayTitle,
                    'titleLabel' => $titleLabel,
                    'titleName' => $titleName,
                    'chapterLabel' => $chapterLabel,
                    'chapterName' => $chapterName,
                    'subtopicFilterId' => isset($taxonomy['subtopicId']) && $taxonomy['subtopicId'] !== null ? (string) $taxonomy['subtopicId'] : null,
                    'assuntoFilterId' => isset($taxonomy['assuntoId']) && $taxonomy['assuntoId'] !== null ? (string) $taxonomy['assuntoId'] : null,
                    'fromArticle' => (string) ($article['number'] ?? ''),
                    'toArticle' => (string) ($article['number'] ?? ''),
                    'articleCount' => 0,
                    'sortOrder' => count($sections),
                ];
            }

            $sectionIndex = $sectionsBySlug[$sectionSlug];
            $sections[$sectionIndex]['toArticle'] = (string) ($article['number'] ?? $sections[$sectionIndex]['toArticle']);
            $sections[$sectionIndex]['articleCount'] = ((int) ($sections[$sectionIndex]['articleCount'] ?? 0)) + 1;

            $article['sectionId'] = $sectionSlug;
            $article['assuntoFilterId'] = isset($taxonomy['assuntoId']) && $taxonomy['assuntoId'] !== null ? (string) $taxonomy['assuntoId'] : null;
            unset($article['hierarchy']);

            $result[] = $article;
        }

        return [
            'articles' => $result,
            'sections' => $sections,
            'subjectId' => $subjectId,
            'lawTopicId' => $lawTopicId,
        ];
    }

    private function buildNormalizedSectionKey(array $hierarchy, string $subtopicName, string $assuntoName, int $articleIndex): string
    {
        $parts = [
            (string) ($hierarchy['titleLabel'] ?? ''),
            (string) ($hierarchy['title'] ?? ''),
            (string) ($hierarchy['chapterLabel'] ?? ''),
            (string) ($hierarchy['chapter'] ?? ''),
        ];
        $uniqueParts = [];
        $seen = [];
        foreach ($parts as $part) {
            $part = trim($part);
            if ($part === '') {
                continue;
            }
            $key = $this->normalizeComparable($part);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $uniqueParts[] = $part;
        }
        $base = trim(implode(' ', $uniqueParts));

        return substr($this->slugify($base !== '' ? $base : 'capitulo-unico'), 0, 140);
    }

    private function buildSectionDisplayTitle(
        string $titleLabel,
        string $titleName,
        string $chapterLabel,
        string $chapterName,
        string $lawTopicName,
        int $index
    ): string {
        $chapterParts = array_values(array_filter([$chapterLabel, $chapterName]));
        if (!empty($chapterParts)) {
            return implode(' - ', $chapterParts);
        }

        $titleParts = array_values(array_filter([$titleLabel, $titleName]));
        if (!empty($titleParts)) {
            return implode(' - ', $titleParts);
        }

        return 'CAPITULO UNICO - ' . $lawTopicName;
    }

    private function buildLawTopicName(array $classification): string
    {
        $shortTitle = trim((string) ($classification['shortTitle'] ?? $classification['title'] ?? ''));
        $year = trim((string) ($classification['year'] ?? ''));

        if ($shortTitle === '') {
            return 'Lei';
        }

        if ($year !== '' && !str_contains($shortTitle, $year)) {
            return trim($shortTitle . ' de ' . $year);
        }

        return $shortTitle;
    }

    private function resolveArticleSubtopic(array $hierarchy): string
    {
        foreach (['title'] as $key) {
            $value = $this->buildHierarchyTaxonomyLabel(
                (string) ($hierarchy[$key . 'Label'] ?? ''),
                (string) ($hierarchy[$key] ?? '')
            );

            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private function resolveArticleAssunto(array $hierarchy, string $fallbackTopic, string $resolvedSubtopic = ''): string
    {
        foreach (['chapter'] as $key) {
            $value = $this->buildHierarchyTaxonomyLabel(
                (string) ($hierarchy[$key . 'Label'] ?? ''),
                (string) ($hierarchy[$key] ?? '')
            );

            if ($value !== '') {
                return $value;
            }
        }

        // Se a norma possui apenas Titulo/Livro/Parte, isso ja foi usado como subtópico.
        // Nao criamos assunto artificial para evitar poluir os filtros e vinculos de questoes.
        if ($resolvedSubtopic !== '') {
            return '';
        }

        // Fallback minimo apenas para normas sem estrutura hierarquica detectavel.
        // Mantem os artigos ligados ao tópico da lei sem inventar capítulo.
        return '';
    }

    private function buildHierarchyTaxonomyLabel(string $label, string $name): string
    {
        $label = $this->normalizeTopicText($label, false);
        $name = $this->normalizeTopicText($name, false);

        return $name !== '' ? $name : $label;
    }

    private function normalizeArticleHierarchyLabels(array $hierarchy, string $subtopicName, string $assuntoName): array
    {
        $hierarchy = array_merge($this->emptyHierarchy(), $hierarchy);

        if ($subtopicName !== '') {
            $hierarchy['resolvedSubtopic'] = $subtopicName;
        }

        if ($assuntoName !== '') {
            $hierarchy['resolvedAssunto'] = $assuntoName;
        }

        return $hierarchy;
    }

    private function normalizeTopicText(string $value, bool $stripLeadingPreposition = true): string
    {
        $value = trim((string) $value);
        $value = preg_replace('/\s+/u', ' ', $value) ?: $value;
        $value = trim($value, " \t\n\r\0\x0B-–—");

        if ($stripLeadingPreposition) {
            $value = trim((string) preg_replace('/^(Do|Da|Dos|Das)\s+/iu', '', $value));
        }

        if ($value === '') {
            return '';
        }

        return $this->normalizeTitleCase($value);
    }

    private function classifyLaw(string $metadataLine, string $ementa, string $url): array
    {
        $metadataComparable = $this->normalizeComparable($metadataLine);
        $ementaComparable = $this->normalizeComparable($ementa);
        $urlComparable = $this->normalizeComparable($url);
        $haystack = trim($metadataComparable . ' ' . $ementaComparable . ' ' . $urlComparable);

        if ($this->isConstitutionDocument($metadataLine, $url)) {
            return [
                'areaSlug' => 'constitucional',
                'subjectName' => 'Direito Constitucional',
                'topicName' => 'Constituição Federal de 1988',
                'title' => 'Constituição Federal de 1988',
                'shortTitle' => 'Constituição Federal',
                'acronym' => 'CF/88',
                'number' => 'CF/88',
                'year' => '1988',
                'date' => '1988-10-05',
            ];
        }

        $bestRule = null;
        $bestScore = 0;
        foreach (self::CLASSIFICATION_RULES as $rule) {
            if (($rule['shortTitle'] ?? '') === 'Constituição Federal') {
                continue;
            }

            $score = $this->scoreClassificationRule($rule, $metadataComparable, $ementaComparable, $urlComparable);
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestRule = $rule;
            }
        }

        if ($bestRule !== null && $bestScore >= 40) {
            return $this->buildKnownLawClassification($bestRule, $metadataLine);
        }

        $genericNumberYear = $this->extractNumberAndYear($metadataLine, '');
        $shortTitle = $this->guessShortTitle($metadataLine, $ementa, $url, $genericNumberYear['number']);
        $areaSlug = $this->guessGenericAreaSlug($haystack);
        $subjectName = $this->subjectNameFromArea($areaSlug);

        return [
            'areaSlug' => $areaSlug,
            'subjectName' => $subjectName,
            'topicName' => $shortTitle,
            'title' => $shortTitle,
            'shortTitle' => $shortTitle,
            'acronym' => $this->buildAcronym($shortTitle),
            'number' => $genericNumberYear['number'] ?: $shortTitle,
            'year' => $genericNumberYear['year'] ?: '',
            'date' => $genericNumberYear['date'] ?? '',
        ];
    }

    private function isConstitutionDocument(string $metadataLine, string $url): bool
    {
        $metadata = $this->normalizeComparable($metadataLine);
        $path = strtolower((string) parse_url($url, PHP_URL_PATH));
        $path = str_replace('\\', '/', $path);

        return (str_contains($path, '/constituicao/constituicao') || str_contains($path, '/constituicao.htm'))
            && (str_starts_with($metadata, 'constituicao') || str_contains($metadata, 'constituicao da republica'));
    }

    private function scoreClassificationRule(array $rule, string $metadataComparable, string $ementaComparable, string $urlComparable): int
    {
        $score = 0;
        foreach ($rule['keywords'] ?? [] as $keyword) {
            $needle = $this->normalizeComparable($this->sanitizeStaticText((string) $keyword));
            if ($needle === '') {
                continue;
            }

            if (str_contains($urlComparable, $needle)) {
                $score += 90;
            }
            if (str_contains($metadataComparable, $needle)) {
                $score += 80;
            }
            if (str_contains($ementaComparable, $needle)) {
                $score += $this->isWeakCitationKeyword($needle) ? 10 : 45;
            }
        }

        return $score;
    }

    private function isWeakCitationKeyword(string $keyword): bool
    {
        return in_array($keyword, [
            'constituicao federal',
            'constituicao da republica federativa do brasil',
            'codigo penal',
            'codigo de processo penal',
            'codigo civil',
            'codigo de processo civil',
            'codigo tributario nacional',
            'lei de execucao penal',
        ], true);
    }

    private function buildKnownLawClassification(array $rule, string $metadataLine): array
    {
        $numberYear = $this->extractNumberAndYear($metadataLine, $rule['number'] ?? '');
        $fallbackNumber = $this->sanitizeStaticText((string) ($rule['number'] ?? $rule['shortTitle'] ?? ''));
        $fallbackDigits = preg_replace('/\D+/', '', $fallbackNumber);
        $extractedDigits = preg_replace('/\D+/', '', (string) ($numberYear['number'] ?? ''));

        if ($fallbackDigits !== '' && $extractedDigits !== '' && $fallbackDigits !== $extractedDigits) {
            $numberYear['number'] = $fallbackNumber;
            $numberYear['year'] = (string) ($rule['year'] ?? $numberYear['year'] ?? '');
            $numberYear['date'] = (string) ($rule['date'] ?? $numberYear['date'] ?? '');
        }

        return [
            'areaSlug' => $rule['areaSlug'],
            'subjectName' => $this->sanitizeStaticText($rule['subjectName']),
            'topicName' => $this->sanitizeStaticText($rule['defaultTopic']),
            'title' => $this->sanitizeStaticText($rule['shortTitle']),
            'shortTitle' => $this->sanitizeStaticText($rule['shortTitle']),
            'acronym' => $rule['acronym'] ?? null,
            'number' => $numberYear['number'] ?: $fallbackNumber,
            'year' => $numberYear['year'] ?: ($rule['year'] ?? ''),
            'date' => $rule['date'] ?? ($numberYear['date'] ?? ''),
        ];
    }

    private function extractNumberAndYear(string $metadataLine, string $fallbackNumber): array
    {
        $result = [
            'number' => $fallbackNumber,
            'year' => '',
            'date' => '',
        ];

        if (preg_match('/(?:LEI\s+COMPLEMENTAR|LEI\s+DELEGADA|DECRETO-LEI|DECRETO|LEI)\s*N?\s*[ººO°o\.]*\s*([\d\.]+)/iu', $metadataLine, $matches)) {
            $result['number'] = preg_replace('/\.+/', '.', trim($matches[1]));
        }

        if (preg_match('/(\d{1,2}\s+DE\s+[A-ZÇ]+(?:,?\s+DE)?\s+\d{4})/iu', $metadataLine, $matches)) {
            $result['date'] = $this->parseBrazilianDateToIso($matches[1]);
        }

        if (preg_match('/(\d{4})/u', $metadataLine, $matches)) {
            $result['year'] = $matches[1];
        }

        return $result;
    }

    private function parseBrazilianDateToIso(string $date): string
    {
        $normalized = $this->normalizeComparable($date);
        $months = [
            'janeiro' => '01',
            'fevereiro' => '02',
            'marco' => '03',
            'abril' => '04',
            'maio' => '05',
            'junho' => '06',
            'julho' => '07',
            'agosto' => '08',
            'setembro' => '09',
            'outubro' => '10',
            'novembro' => '11',
            'dezembro' => '12',
        ];

        if (!preg_match('/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/u', $normalized, $matches)) {
            return '';
        }

        $month = $months[$matches[2]] ?? null;
        if ($month === null) {
            return '';
        }

        return sprintf('%s-%s-%02d', $matches[3], $month, (int) $matches[1]);
    }

    private function guessShortTitle(string $metadataLine, string $ementa, string $url, string $number): string
    {
        foreach ([
            'estatuto da criança e do adolescente' => 'ECA',
            'estatuto da crianca e do adolescente' => 'ECA',
            'código penal' => 'Código Penal',
            'codigo penal' => 'Código Penal',
            'código de processo penal' => 'Código de Processo Penal',
            'codigo de processo penal' => 'Código de Processo Penal',
            'código civil' => 'Código Civil',
            'codigo civil' => 'Código Civil',
            'código de processo civil' => 'Código de Processo Civil',
            'codigo de processo civil' => 'Código de Processo Civil',
            'código tributário nacional' => 'Código Tributário Nacional',
            'codigo tributario nacional' => 'Código Tributário Nacional',
        ] as $needle => $title) {
            if (str_contains($this->normalizeComparable($metadataLine . ' ' . $ementa . ' ' . $url), $this->normalizeComparable($this->sanitizeStaticText($needle)))) {
                return $this->sanitizeStaticText($title);
            }
        }

        if ($ementa !== '' && preg_match('/estatuto\s+[^.]+/iu', $ementa, $matches)) {
            return $this->normalizeTitleCase($matches[0]);
        }

        if ($number !== '') {
            return 'Lei ' . $number;
        }

        return 'Lei importada';
    }

    private function guessGenericAreaSlug(string $haystack): string
    {
        if (str_contains($haystack, 'tribut')) {
            return 'tributario';
        }
        if (str_contains($haystack, 'eleitoral')) {
            return 'eleitoral';
        }
        if (str_contains($haystack, 'trabalho') || str_contains($haystack, 'trabalhista') || str_contains($haystack, 'clt')) {
            return 'trabalho';
        }
        if (str_contains($haystack, 'ambiental') || str_contains($haystack, 'florestal')) {
            return 'ambiental';
        }
        if (str_contains($haystack, 'penal') && str_contains($haystack, 'processo')) {
            return 'processual-penal';
        }
        if (str_contains($haystack, 'penal')) {
            return 'penal';
        }
        if (str_contains($haystack, 'processo civil')) {
            return 'processual';
        }
        if (str_contains($haystack, 'civil') || str_contains($haystack, 'consumidor')) {
            return 'civil';
        }
        if (str_contains($haystack, 'administr')) {
            return 'administrativo';
        }
        if (str_contains($haystack, 'constitui')) {
            return 'constitucional';
        }

        return 'legislacao-especial';
    }

    private function subjectNameFromArea(string $areaSlug): string
    {
        return match ($areaSlug) {
            'constitucional' => 'Direito Constitucional',
            'penal' => 'Direito Penal',
            'administrativo' => 'Direito Administrativo',
            'civil' => 'Direito Civil',
            'tributario' => 'Direito Tributário',
            'processual' => 'Direito Processual Civil',
            'processual-penal' => 'Direito Processual Penal',
            'trabalho' => 'Direito do Trabalho',
            'ambiental' => 'Direito Ambiental',
            'eleitoral' => 'Direito Eleitoral',
            'direitos-humanos' => 'Direitos Humanos',
            default => 'Legislação Extravagante',
        };
    }

    private function buildAcronym(string $shortTitle): ?string
    {
        $normalized = $this->normalizeComparable($shortTitle);
        $map = [
            'constituicao federal' => 'CF/88',
            'codigo penal' => 'CP',
            'codigo de processo penal' => 'CPP',
            'codigo civil' => 'CC',
            'codigo de processo civil' => 'CPC',
            'codigo tributario nacional' => 'CTN',
            'eca' => 'ECA',
            'clt' => 'CLT',
        ];

        foreach ($map as $name => $acronym) {
            if (str_contains($normalized, $name)) {
                return $acronym;
            }
        }

        return null;
    }

    private function buildLawSlug(string $shortTitle, string $number, string $year): string
    {
        $base = $shortTitle !== '' ? $shortTitle : ('lei-' . $number);
        if ($year !== '' && !str_contains($base, $year)) {
            $base .= '-' . $year;
        }

        return $this->slugify($base);
    }

    private function mergeImportedLawWithExisting(array $importedLaw, ?array $existingLaw): array
    {
        if ($existingLaw === null) {
            return $importedLaw;
        }

        $existingArticlesByNumber = [];
        $existingArticlesBySlug = [];
        foreach ($existingLaw['articles'] ?? [] as $article) {
            $existingArticlesByNumber[(string) ($article['number'] ?? '')] = $article;
            $existingSlug = trim((string) ($article['slug'] ?? ''));
            if ($existingSlug !== '') {
                $existingArticlesBySlug[$existingSlug] = $article;
            }
        }

        $mergedArticles = [];
        $articleIdMap = [];
        foreach ($importedLaw['articles'] as $article) {
            $number = (string) ($article['number'] ?? '');
            $slug = trim((string) ($article['slug'] ?? ''));
            $existingArticle = ($slug !== '' ? ($existingArticlesBySlug[$slug] ?? null) : null)
                ?? $existingArticlesByNumber[$number]
                ?? null;

            if ($existingArticle) {
                $article['id'] = $existingArticle['id'];
                $article['assuntoFilterId'] = $article['assuntoFilterId'] ?: ($existingArticle['assuntoFilterId'] ?? null);
                $article['relatedQuestionCount'] = $existingArticle['relatedQuestionCount'] ?? $article['relatedQuestionCount'];
                if (!empty($existingArticle['title']) && empty($article['title'])) {
                    $article['title'] = $existingArticle['title'];
                }
                $articleIdMap[(string) $existingArticle['id']] = (string) $existingArticle['id'];
            }

            $mergedArticles[] = $article;
        }

        $teacherComments = array_map(function ($comment) use ($articleIdMap) {
            return $comment;
        }, $existingLaw['teacherComments'] ?? []);

        $jurisprudence = array_map(function ($item) use ($articleIdMap) {
            return $item;
        }, $existingLaw['jurisprudence'] ?? []);

        $examTips = array_map(function ($item) use ($articleIdMap) {
            return $item;
        }, $existingLaw['examTips'] ?? []);

        $sumulas = [];
        foreach ($existingLaw['articles'] ?? [] as $article) {
            foreach ($article['syllabi'] ?? [] as $sumula) {
                $sumulas[] = [
                    ...$sumula,
                    'id' => $sumula['id'] ?? $this->slugify(($article['id'] ?? '') . '-' . ($sumula['number'] ?? '')),
                    'articleId' => $article['id'],
                ];
            }
        }

        return [
            ...$importedLaw,
            'id' => $existingLaw['id'],
            'slug' => $this->shouldReplaceExistingLawSlug($existingLaw, $importedLaw)
                ? $importedLaw['slug']
                : ($existingLaw['slug'] ?: $importedLaw['slug']),
            'accessCount' => $existingLaw['accessCount'] ?? 0,
            'progressPercent' => $existingLaw['progressPercent'] ?? 0,
            'teacherComments' => $teacherComments,
            'jurisprudence' => $jurisprudence,
            'examTips' => $examTips,
            'sumulas' => $sumulas,
            'articles' => $mergedArticles,
        ];
    }

    private function shouldReplaceExistingLawSlug(array $existingLaw, array $importedLaw): bool
    {
        $existingSlug = trim((string) ($existingLaw['slug'] ?? ''));
        if ($existingSlug === '') {
            return true;
        }

        $existingTitle = $this->normalizeComparable((string) ($existingLaw['shortTitle'] ?? $existingLaw['title'] ?? ''));
        $importedTitle = $this->normalizeComparable((string) ($importedLaw['shortTitle'] ?? $importedLaw['title'] ?? ''));
        if ($existingTitle === $importedTitle || $importedTitle === '') {
            return false;
        }

        $existingNumber = $this->normalizeComparable((string) ($existingLaw['number'] ?? ''));
        $importedNumber = $this->normalizeComparable((string) ($importedLaw['number'] ?? ''));
        $looksLikeConstitution = str_contains($this->normalizeComparable($existingSlug), 'constituic')
            || $existingNumber === 'cf 88'
            || $existingTitle === 'constituicao federal';

        return $looksLikeConstitution && $importedTitle !== 'constituicao federal' && $importedNumber !== 'cf 88';
    }

    private function calculateSyncStats(?array $existingLaw, array $savedLaw): array
    {
        if ($existingLaw === null) {
            return [
                'insertedArticles' => count($savedLaw['articles'] ?? []),
                'changedArticles' => 0,
                'revokedArticles' => 0,
            ];
        }

        $before = [];
        foreach ($existingLaw['articles'] ?? [] as $article) {
            $key = $this->articleSyncKey($article);
            if ($key !== '') {
                $before[$key] = $this->hashArticleBlocks($article['blocks'] ?? []);
            }
        }

        $afterKeys = [];
        $inserted = 0;
        $changed = 0;
        foreach ($savedLaw['articles'] ?? [] as $article) {
            $key = $this->articleSyncKey($article);
            if ($key === '') {
                continue;
            }

            $afterKeys[$key] = true;
            $hash = $this->hashArticleBlocks($article['blocks'] ?? []);

            if (!isset($before[$key])) {
                $inserted += 1;
            } elseif ($before[$key] !== $hash) {
                $changed += 1;
            }
        }

        $revoked = 0;
        foreach (array_keys($before) as $key) {
            if (!isset($afterKeys[$key])) {
                $revoked += 1;
            }
        }

        return [
            'insertedArticles' => $inserted,
            'changedArticles' => $changed,
            'revokedArticles' => $revoked,
        ];
    }

    private function hashArticleBlocks(array $blocks): string
    {
        $value = [];
        foreach ($blocks as $block) {
            $value[] = trim(
                (string) ($block['kind'] ?? '') . '|' .
                (string) ($block['marker'] ?? '') . '|' .
                (string) ($block['label'] ?? '') . '|' .
                (string) ($block['text'] ?? '')
            );
        }

        return hash('sha256', implode(' | ', $value));
    }

    private function articleSyncKey(array $article): string
    {
        $slug = trim((string) ($article['slug'] ?? ''));
        if ($slug !== '') {
            return $slug;
        }

        return trim((string) ($article['number'] ?? $article['article_number'] ?? ''));
    }

    private function extractLinksFromHtml(string $baseUrl, string $html): array
    {
        $links = [];
        libxml_use_internal_errors(true);

        $document = new DOMDocument();
        if (@$document->loadHTML($html)) {
            foreach ($document->getElementsByTagName('a') as $anchor) {
                $href = trim((string) $anchor->getAttribute('href'));
                if ($href === '') {
                    continue;
                }

                $resolved = $this->resolveAbsoluteUrl($baseUrl, $href);
                if ($resolved !== null && $this->isPlanaltoUrl($resolved)) {
                    $links[] = $resolved;
                }
            }
        }

        libxml_clear_errors();
        return array_values(array_unique($links));
    }

    private function resolveAbsoluteUrl(string $baseUrl, string $href): ?string
    {
        $href = trim($href);
        if ($href === '' || str_starts_with($href, '#') || str_starts_with($href, 'mailto:') || str_starts_with($href, 'javascript:')) {
            return null;
        }

        if (preg_match('/^https?:\/\//i', $href)) {
            if (!$this->isPlanaltoUrl($href)) {
                return null;
            }
            return $this->normalizePlanaltoUrl($href);
        }

        $base = parse_url($baseUrl);
        if (!$base || empty($base['scheme']) || empty($base['host'])) {
            return null;
        }

        $path = $base['path'] ?? '/';
        $directory = preg_replace('/\/[^\/]*$/', '/', $path) ?: '/';

        if (str_starts_with($href, '/')) {
            return $this->normalizePlanaltoUrl($base['scheme'] . '://' . $base['host'] . $href);
        }

        $fullPath = $directory . $href;
        $segments = [];
        foreach (explode('/', $fullPath) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                array_pop($segments);
                continue;
            }
            $segments[] = $segment;
        }

        return $this->normalizePlanaltoUrl($base['scheme'] . '://' . $base['host'] . '/' . implode('/', $segments));
    }

    private function isPlanaltoUrl(string $url): bool
    {
        $parts = parse_url($url);
        if (!$parts || empty($parts['host'])) {
            return false;
        }

        return in_array(strtolower((string) $parts['host']), self::PLANALTO_HOSTS, true);
    }

    private function normalizePlanaltoUrl(string $url): string
    {
        $parts = parse_url(trim($url));
        if (!$parts || empty($parts['host']) || !in_array(strtolower((string) $parts['host']), self::PLANALTO_HOSTS, true)) {
            throw new InvalidArgumentException('A importacao aceita apenas URLs oficiais do Portal do Planalto.');
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? 'https'));
        $host = strtolower((string) $parts['host']);
        $path = preg_replace('/\/+/', '/', (string) ($parts['path'] ?? '/')) ?: '/';

        return $scheme . '://' . $host . $path;
    }

    private function isIndexUrl(string $url): bool
    {
        $path = strtolower((string) parse_url($url, PHP_URL_PATH));

        return str_contains($path, 'quadro')
            || str_contains($path, 'principal')
            || preg_match('/_leis\d{4}\.htm$/', $path)
            || preg_match('/_quadro.*\.htm$/', $path)
            || preg_match('/\/\d{4}\.htm$/', $path);
    }

    private function isLawDocumentUrl(string $url): bool
    {
        $path = strtolower((string) parse_url($url, PHP_URL_PATH));

        if (!preg_match('/\.htm$/', $path)) {
            return false;
        }

        if ($this->isIndexUrl($url)) {
            return false;
        }

        $noise = [
            'resenha',
            'consulta',
            'portaria',
            'manual',
            'cartilha',
            'revogada',
            'boletins',
            'indicetematico',
            'mp4',
            '.doc',
            '.pdf',
        ];

        foreach ($noise as $term) {
            if (str_contains($path, $term)) {
                return false;
            }
        }

        return str_contains($path, '/ccivil_03/');
    }

    private function guessCatalogLabel(string $url): string
    {
        $path = (string) parse_url($url, PHP_URL_PATH);
        $filename = preg_replace('/\.htm$/i', '', basename($path));
        $filename = preg_replace('/([a-z])(\d)/i', '$1 $2', (string) $filename);
        $filename = preg_replace('/[_\-]+/', ' ', (string) $filename);
        $filename = preg_replace('/\s+/', ' ', (string) $filename);

        return $this->normalizeTitleCase($filename ?: 'Lei do Planalto');
    }

    private function normalizeComparable(string $value): string
    {
        $value = strtr($value, $this->latinAccentMap());
        $value = mb_strtolower(trim($value), 'UTF-8');
        $transliterated = @iconv('UTF-8', 'ASCII//TRANSLIT', $value);
        $value = $transliterated !== false ? $transliterated : $value;
        $value = preg_replace('/[^a-z0-9\s]+/', ' ', $value) ?: $value;
        $value = preg_replace('/\s+/', ' ', $value) ?: $value;

        return trim($value);
    }

    private function sanitizeStaticText(string $value): string
    {
        return strtr($value, [
            hex2bin('c383c2a1') => 'a',
            hex2bin('c383c2a0') => 'a',
            hex2bin('c383c2a2') => 'a',
            hex2bin('c383c2a3') => 'a',
            hex2bin('c383c2a4') => 'a',
            hex2bin('c383c2a9') => 'e',
            hex2bin('c383c2aa') => 'e',
            hex2bin('c383c2ad') => 'i',
            hex2bin('c383c2b3') => 'o',
            hex2bin('c383c2b4') => 'o',
            hex2bin('c383c2b5') => 'o',
            hex2bin('c383c2ba') => 'u',
            hex2bin('c383c2bc') => 'u',
            hex2bin('c383c2a7') => 'c',
            hex2bin('c383c281') => 'A',
            hex2bin('c383c280') => 'A',
            hex2bin('c383c282') => 'A',
            hex2bin('c383c283') => 'A',
            hex2bin('c383c289') => 'E',
            hex2bin('c383c28a') => 'E',
            hex2bin('c383c28d') => 'I',
            hex2bin('c383c293') => 'O',
            hex2bin('c383c294') => 'O',
            hex2bin('c383c295') => 'O',
            hex2bin('c383c29a') => 'U',
            hex2bin('c383c287') => 'C',
            hex2bin('c382c2ba') => 'o',
            hex2bin('c382c2b0') => 'o',
            hex2bin('c3a2e282ace2809c') => '-',
            hex2bin('c3a2e282ace2809d') => '-',
            hex2bin('c3a2e282ace284a2') => "'",
            hex2bin('c3a2e282acc593') => '"',
            hex2bin('c3a2e282ace29d') => '"',
        ]);
    }

    private function normalizeTitleCase(string $value): string
    {
        $value = preg_replace('/\s+/', ' ', trim($value)) ?: $value;
        return mb_convert_case($value, MB_CASE_TITLE, 'UTF-8');
    }

    private function normalizeSentence(string $value): string
    {
        return preg_replace('/\s+/', ' ', trim($value)) ?: trim($value);
    }

    private function slugify(string $value): string
    {
        $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if (class_exists('Transliterator')) {
            $transliterator = Transliterator::create('Any-Latin; Latin-ASCII; [:Nonspacing Mark:] Remove; Lower()');
            $value = $transliterator ? $transliterator->transliterate($value) : $value;
        } else {
            $value = strtr($value, $this->latinAccentMap());
            $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        }
        $value = strtolower((string) preg_replace('/[^A-Za-z0-9]+/', '-', $value));
        return trim($value, '-') ?: 'planalto-law';
    }

    private function latinAccentMap(): array
    {
        return [
            html_entity_decode('&#193;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#192;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#194;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#195;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#196;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#197;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#225;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#224;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#226;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#227;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#228;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#229;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#201;', ENT_QUOTES, 'UTF-8') => 'E',
            html_entity_decode('&#200;', ENT_QUOTES, 'UTF-8') => 'E',
            html_entity_decode('&#202;', ENT_QUOTES, 'UTF-8') => 'E',
            html_entity_decode('&#203;', ENT_QUOTES, 'UTF-8') => 'E',
            html_entity_decode('&#233;', ENT_QUOTES, 'UTF-8') => 'e',
            html_entity_decode('&#232;', ENT_QUOTES, 'UTF-8') => 'e',
            html_entity_decode('&#234;', ENT_QUOTES, 'UTF-8') => 'e',
            html_entity_decode('&#235;', ENT_QUOTES, 'UTF-8') => 'e',
            html_entity_decode('&#205;', ENT_QUOTES, 'UTF-8') => 'I',
            html_entity_decode('&#204;', ENT_QUOTES, 'UTF-8') => 'I',
            html_entity_decode('&#206;', ENT_QUOTES, 'UTF-8') => 'I',
            html_entity_decode('&#207;', ENT_QUOTES, 'UTF-8') => 'I',
            html_entity_decode('&#237;', ENT_QUOTES, 'UTF-8') => 'i',
            html_entity_decode('&#236;', ENT_QUOTES, 'UTF-8') => 'i',
            html_entity_decode('&#238;', ENT_QUOTES, 'UTF-8') => 'i',
            html_entity_decode('&#239;', ENT_QUOTES, 'UTF-8') => 'i',
            html_entity_decode('&#211;', ENT_QUOTES, 'UTF-8') => 'O',
            html_entity_decode('&#210;', ENT_QUOTES, 'UTF-8') => 'O',
            html_entity_decode('&#212;', ENT_QUOTES, 'UTF-8') => 'O',
            html_entity_decode('&#213;', ENT_QUOTES, 'UTF-8') => 'O',
            html_entity_decode('&#214;', ENT_QUOTES, 'UTF-8') => 'O',
            html_entity_decode('&#243;', ENT_QUOTES, 'UTF-8') => 'o',
            html_entity_decode('&#242;', ENT_QUOTES, 'UTF-8') => 'o',
            html_entity_decode('&#244;', ENT_QUOTES, 'UTF-8') => 'o',
            html_entity_decode('&#245;', ENT_QUOTES, 'UTF-8') => 'o',
            html_entity_decode('&#246;', ENT_QUOTES, 'UTF-8') => 'o',
            html_entity_decode('&#218;', ENT_QUOTES, 'UTF-8') => 'U',
            html_entity_decode('&#217;', ENT_QUOTES, 'UTF-8') => 'U',
            html_entity_decode('&#219;', ENT_QUOTES, 'UTF-8') => 'U',
            html_entity_decode('&#220;', ENT_QUOTES, 'UTF-8') => 'U',
            html_entity_decode('&#250;', ENT_QUOTES, 'UTF-8') => 'u',
            html_entity_decode('&#249;', ENT_QUOTES, 'UTF-8') => 'u',
            html_entity_decode('&#251;', ENT_QUOTES, 'UTF-8') => 'u',
            html_entity_decode('&#252;', ENT_QUOTES, 'UTF-8') => 'u',
            html_entity_decode('&#199;', ENT_QUOTES, 'UTF-8') => 'C',
            html_entity_decode('&#231;', ENT_QUOTES, 'UTF-8') => 'c',
            html_entity_decode('&#209;', ENT_QUOTES, 'UTF-8') => 'N',
            html_entity_decode('&#241;', ENT_QUOTES, 'UTF-8') => 'n',
        ];
    }
}
