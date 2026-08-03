<?php

declare(strict_types=1);

require_once __DIR__ . '/../../questions/services/PrivateQuestionIngestionService.php';
require_once __DIR__ . '/AdminGranTaxonomySyncService.php';

/**
 * Consulta a API conhecida da Gran e transforma o retorno em question-import.v2.
 *
 * O token externo existe apenas durante esta requisicao. Nenhuma URL arbitraria,
 * cookie ou credencial da Gran e gravada no banco ou nos logs da plataforma.
 */
final class AdminGranCrawlerService
{
    private const API_ENDPOINT = 'https://rota-api.grancursosonline.com.br/v1/elastic/questao';
    private const API_HOST = 'rota-api.grancursosonline.com.br';
    private const API_PATH = '/v1/elastic/questao';
    private const WEB_ORIGIN = 'https://questoes.grancursosonline.com.br';
    private const ASSET_ORIGIN = 'https://arquivos.infra-questoes.grancursosonline.com.br';
    private const MAX_REMOTE_RESPONSE_BYTES = 8_000_000;
    private const MAX_REQUEST_URL_BYTES = 8_000;
    private const MAX_QUESTIONS_PER_PAGE = 100;

    /** @var null|Closure(string,string,string):array{status:int,body:string} */
    private ?Closure $httpClient;

    /** @var array<string, array<string, mixed>> */
    private array $granTaxonomyIdentityCache = [];

    /** @var array<string, array<string, mixed>> */
    private array $granQuestionIdentityCache = [];

    /** @var array<string, array<string, mixed>> */
    private array $granExamIdentityCache = [];

    public function __construct(
        private readonly PDO $db,
        ?Closure $httpClient = null
    ) {
        $this->httpClient = $httpClient;
    }

    /**
     * Valida e converte a resposta recebida pela extensao privada.
     *
     * A credencial Gran nunca participa deste contrato. O backend recebe apenas
     * o JSON coletado no navegador de uma sessao administrativa autenticada.
     */
    public function mapBrowserResponse(array $input): array
    {
        $remotePayload = $input['granResponse'] ?? null;
        if (!is_array($remotePayload)) {
            throw new InvalidArgumentException('A extensao nao retornou um JSON Gran valido.');
        }

        $fallbackPage = max(1, min(1_000_000, (int) ($input['page'] ?? 1)));
        $fallbackPerPage = max(1, min(self::MAX_QUESTIONS_PER_PAGE, (int) ($input['perPage'] ?? 20)));
        $fallbackYear = trim((string) ($input['year'] ?? ''));
        if (
            $fallbackYear !== ''
            && (!ctype_digit($fallbackYear) || (int) $fallbackYear < 1900 || (int) $fallbackYear > 2200)
        ) {
            throw new InvalidArgumentException('Ano de busca invalido.');
        }

        $request = $this->resolveRequestUrl(
            $input,
            $fallbackPage,
            $fallbackPerPage,
            $fallbackYear
        );
        $rows = $this->extractRows($remotePayload);
        if ($rows === []) {
            throw new InvalidArgumentException('A resposta Gran nao contem questoes para esta pagina.');
        }
        $granExamFiles = $this->normalizeGranExamFiles($input['granExamFiles'] ?? []);

        $payloads = $this->mapQuestionImportPayloads($rows, [
            'year' => $request['year'] !== '' ? (int) $request['year'] : null,
            'extractionMode' => 'gran_browser_extension',
            'granExamFiles' => $granExamFiles,
            'collectionPage' => $request['page'],
            'collectionPerPage' => $request['perPage'],
            'collectionRequestUrl' => $request['url'],
        ]);

        return [
            'page' => $request['page'],
            'perPage' => $request['perPage'],
            'total' => $this->readPositiveInt(
                $remotePayload['data']['total'] ?? $remotePayload['total'] ?? 0
            ),
            'pages' => $this->readPositiveInt(
                $remotePayload['data']['pages']
                ?? $remotePayload['data']['totalPaginas']
                ?? $remotePayload['pages']
                ?? 0
            ),
            'requestUrl' => $request['url'],
            'tokenExpiresAt' => null,
            'questionCount' => $this->countPayloadQuestions($payloads),
            'fileCount' => array_sum(array_map(
                static fn (array $payload): int => count(
                    is_array($payload['exam']['files'] ?? null) ? $payload['exam']['files'] : []
                ),
                $payloads
            )),
            'payloads' => $payloads,
        ];
    }

    public function fetchPage(array $input): array
    {
        $token = $this->normalizeAccessToken((string) ($input['granAccessToken'] ?? ''));
        if ($token === '' || strlen($token) > 12_000 || preg_match('/[\r\n]/', $token) === 1) {
            throw new InvalidArgumentException('Informe uma credencial valida da sessao da Gran.');
        }

        $page = max(1, min(1_000_000, (int) ($input['page'] ?? 1)));
        $perPage = max(1, min(self::MAX_QUESTIONS_PER_PAGE, (int) ($input['perPage'] ?? 20)));
        $year = trim((string) ($input['year'] ?? ''));
        if ($year !== '' && (!ctype_digit($year) || (int) $year < 1900 || (int) $year > 2200)) {
            throw new InvalidArgumentException('Ano de busca invalido.');
        }

        $claims = $this->readJwtClaims($token);
        $expiration = isset($claims['exp']) && is_numeric($claims['exp'])
            ? (int) $claims['exp']
            : null;
        if ($expiration !== null && $expiration <= time()) {
            throw new DomainException('A sessao da Gran expirou. Gere uma nova credencial antes de continuar.');
        }
        $clientId = trim((string) ($claims['id'] ?? ''));
        if ($clientId === '' || strlen($clientId) > 200 || preg_match('/[\r\n]/', $clientId) === 1) {
            throw new InvalidArgumentException(
                'A credencial da Gran nao possui o identificador de cliente esperado. Gere uma nova sessao.'
            );
        }

        $request = $this->resolveRequestUrl($input, $page, $perPage, $year);
        $url = $request['url'];
        $page = $request['page'];
        $perPage = $request['perPage'];
        $year = $request['year'];
        $response = $this->requestGran($url, $token, $clientId);
        if ($response['status'] === 401 || $response['status'] === 403) {
            throw new DomainException('A Gran recusou a sessao informada. Autentique-se novamente na Gran.');
        }
        if ($response['status'] === 429) {
            throw new RuntimeException('A Gran limitou temporariamente as consultas. Aguarde antes de tentar novamente.');
        }
        if ($response['status'] < 200 || $response['status'] >= 300) {
            throw new RuntimeException('A Gran respondeu com HTTP ' . $response['status'] . '.');
        }

        $decoded = json_decode($response['body'], true);
        if (!is_array($decoded)) {
            throw new RuntimeException('A Gran respondeu com JSON invalido.');
        }

        $rows = $this->extractRows($decoded);
        $payloads = $this->mapQuestionImportPayloads($rows, [
            'year' => $year !== '' ? (int) $year : null,
        ]);

        return [
            'page' => $page,
            'perPage' => $perPage,
            'total' => $this->readPositiveInt($decoded['data']['total'] ?? $decoded['total'] ?? 0),
            'pages' => $this->readPositiveInt(
                $decoded['data']['pages']
                ?? $decoded['data']['totalPaginas']
                ?? $decoded['pages']
                ?? 0
            ),
            'requestUrl' => $url,
            'tokenExpiresAt' => $expiration !== null ? gmdate('c', $expiration) : null,
            'questionCount' => $this->countPayloadQuestions($payloads),
            'payloads' => $payloads,
        ];
    }

    /**
     * A URL direta pode alterar somente a query string. Protocolo, host e rota
     * permanecem fixos para impedir SSRF e envio da credencial a terceiros.
     *
     * @return array{url:string,page:int,perPage:int,year:string}
     */
    private function resolveRequestUrl(
        array $input,
        int $fallbackPage,
        int $fallbackPerPage,
        string $fallbackYear
    ): array {
        $directUrl = trim((string) ($input['granRequestUrl'] ?? ''));
        if ($directUrl === '') {
            $query = [
                'perPage' => $fallbackPerPage,
                'page' => $fallbackPage,
                'marcarResolvidas' => 1,
                'resolucao' => 'TODAS',
                'anulada' => 0,
                'desatualizada' => 0,
                'tiposProva' => 1,
                'sort' => '[{"anos":"desc"},{"_score":"desc"}]',
            ];
            if ($fallbackYear !== '') {
                $query['anos'] = [$fallbackYear];
            }

            return [
                'url' => self::API_ENDPOINT . '?' . http_build_query(
                    $query,
                    '',
                    '&',
                    PHP_QUERY_RFC3986
                ),
                'page' => $fallbackPage,
                'perPage' => $fallbackPerPage,
                'year' => $fallbackYear,
            ];
        }

        if (
            strlen($directUrl) > self::MAX_REQUEST_URL_BYTES
            || preg_match('/[\r\n]/', $directUrl) === 1
        ) {
            throw new InvalidArgumentException('A URL direta da Gran e invalida ou excede o limite seguro.');
        }

        $parts = parse_url($directUrl);
        if (!is_array($parts)) {
            throw new InvalidArgumentException('A URL direta da Gran e invalida.');
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));
        $path = (string) ($parts['path'] ?? '');
        $port = isset($parts['port']) ? (int) $parts['port'] : null;
        if (
            $scheme !== 'https'
            || $host !== self::API_HOST
            || $path !== self::API_PATH
            || ($port !== null && $port !== 443)
            || isset($parts['user'])
            || isset($parts['pass'])
            || isset($parts['fragment'])
        ) {
            throw new InvalidArgumentException(
                'Use somente a rota HTTPS oficial de questoes da Gran; altere apenas os filtros da URL.'
            );
        }

        $query = [];
        parse_str((string) ($parts['query'] ?? ''), $query);
        $queryEntryCount = 0;
        $this->validateDirectQuery($query, $queryEntryCount);
        foreach (array_keys($query) as $queryKey) {
            $normalizedKey = strtolower(rtrim((string) $queryKey, '[]'));
            if (in_array($normalizedKey, [
                'authorization',
                'access_token',
                'token',
                'cookie',
                'x-client-id',
            ], true)) {
                throw new InvalidArgumentException(
                    'Nao inclua credenciais na URL. Use o campo protegido de credencial da sessao.'
                );
            }
        }

        $page = $this->readBoundedQueryInteger($query['page'] ?? $fallbackPage, 1, 1_000_000, 'pagina');
        $perPage = $this->readBoundedQueryInteger(
            $query['perPage'] ?? $fallbackPerPage,
            1,
            self::MAX_QUESTIONS_PER_PAGE,
            'quantidade por pagina'
        );
        $query['page'] = $page;
        $query['perPage'] = $perPage;

        if (isset($query['sort'])) {
            if (!is_string($query['sort']) || strlen($query['sort']) > 2_000) {
                throw new InvalidArgumentException('O filtro de ordenacao da URL direta e invalido.');
            }
            $sort = json_decode($query['sort'], true);
            if (!is_array($sort) || json_last_error() !== JSON_ERROR_NONE) {
                throw new InvalidArgumentException('O filtro sort da URL direta deve conter JSON valido.');
            }
        }

        $year = $this->readSingleYearFilter($query['anos'] ?? null, $fallbackYear);

        return [
            'url' => self::API_ENDPOINT . '?' . http_build_query(
                $query,
                '',
                '&',
                PHP_QUERY_RFC3986
            ),
            'page' => $page,
            'perPage' => $perPage,
            'year' => $year,
        ];
    }

    private function validateDirectQuery(mixed $value, int &$entryCount, int $depth = 0): void
    {
        if ($depth > 4) {
            throw new InvalidArgumentException('A URL direta possui filtros aninhados demais.');
        }
        if (is_array($value)) {
            foreach ($value as $key => $entry) {
                $entryCount++;
                if ($entryCount > 120) {
                    throw new InvalidArgumentException('A URL direta possui filtros demais.');
                }
                $keyText = (string) $key;
                if (strlen($keyText) > 120 || preg_match('/[\r\n]/', $keyText) === 1) {
                    throw new InvalidArgumentException('A URL direta possui um filtro invalido.');
                }
                $this->validateDirectQuery($entry, $entryCount, $depth + 1);
            }
            return;
        }
        if (!is_scalar($value) && $value !== null) {
            throw new InvalidArgumentException('A URL direta possui um valor de filtro invalido.');
        }
        $text = (string) ($value ?? '');
        if (strlen($text) > 4_000 || preg_match('/[\r\n]/', $text) === 1) {
            throw new InvalidArgumentException('A URL direta possui um valor de filtro invalido.');
        }
    }

    private function readBoundedQueryInteger(mixed $value, int $minimum, int $maximum, string $label): int
    {
        if (is_array($value)) {
            $value = reset($value);
        }
        $text = trim((string) $value);
        if ($text === '' || !ctype_digit($text)) {
            throw new InvalidArgumentException('O filtro de ' . $label . ' da URL direta e invalido.');
        }
        $number = (int) $text;
        if ($number < $minimum || $number > $maximum) {
            throw new InvalidArgumentException('O filtro de ' . $label . ' da URL direta esta fora do limite.');
        }
        return $number;
    }

    private function readSingleYearFilter(mixed $value, string $fallbackYear): string
    {
        if ($value === null) {
            return $fallbackYear;
        }
        $values = is_array($value) ? array_values($value) : [$value];
        $years = array_values(array_unique(array_filter(array_map(
            static fn (mixed $entry): string => trim((string) $entry),
            $values
        ), static fn (string $entry): bool => (
            ctype_digit($entry) && (int) $entry >= 1900 && (int) $entry <= 2200
        ))));
        return count($years) === 1 ? $years[0] : '';
    }

    public function enqueue(array $input, string $actorUserId): array
    {
        return $this->enqueuePublication($input, $actorUserId);
    }

    public function enqueuePublication(array $input, string $actorUserId): array
    {
        $payloads = is_array($input['payloads'] ?? null) && array_is_list($input['payloads'])
            ? array_values(array_filter($input['payloads'], 'is_array'))
            : [];
        if ($payloads === [] && is_array($input['payload'] ?? null)) {
            $payloads = [$input['payload']];
        }
        if ($payloads === []) {
            throw new InvalidArgumentException('Envie ao menos um lote canonico por requisicao.');
        }
        $focus = is_array($input['focus'] ?? null) ? $input['focus'] : [];
        $focusName = trim((string) ($focus['name'] ?? $focus['label'] ?? ''));
        $normalizedFocus = $focusName !== '' ? [
            'id' => isset($focus['id']) && is_numeric($focus['id']) ? (int) $focus['id'] : null,
            'name' => $focusName,
            'slug' => trim((string) ($focus['slug'] ?? $this->slugify($focusName))),
        ] : null;
        $baseIdempotencyKey = trim((string) ($input['idempotencyKey'] ?? ''));
        $preparedPayloads = [];
        $questionCount = 0;

        foreach ($payloads as $payload) {
            if (($payload['schemaVersion'] ?? null) !== 'question-import.v2') {
                throw new InvalidArgumentException('Todos os lotes devem usar o contrato question-import.v2.');
            }
            $questions = is_array($payload['questions'] ?? null) ? $payload['questions'] : [];
            $questionCount += count($questions);
            if ($questionCount > 5000) {
                throw new InvalidArgumentException('A submissao aceita no maximo 5000 questoes.');
            }
            foreach ($questions as $questionIndex => $question) {
                if (!is_array($question)) {
                    continue;
                }
                $filters = is_array($question['filters'] ?? null) ? $question['filters'] : [];
                $questionFocuses = $filters['careers'] ?? $filters['carreiras'] ?? [];
                if ((!is_array($questionFocuses) || $questionFocuses === []) && $normalizedFocus !== null) {
                    $filters['careers'] = [[
                        'id' => $normalizedFocus['id'],
                        'label' => $normalizedFocus['name'],
                        'slug' => $normalizedFocus['slug'],
                    ]];
                    $question['filters'] = $filters;
                    $questions[$questionIndex] = $question;
                } elseif (!is_array($questionFocuses) || $questionFocuses === []) {
                    $number = $question['source']['questionNumber'] ?? ($questionIndex + 1);
                    throw new InvalidArgumentException(
                        'A questao ' . (string) $number . ' nao possui area/foco. Revise o item ou informe um foco de fallback.'
                    );
                }
            }
            $payload['questions'] = $questions;
            if ($normalizedFocus !== null) {
                $payload['focus'] = $normalizedFocus;
            } else {
                unset($payload['focus']);
            }
            $preparedPayloads[] = $payload;
        }
        return (new PrivateQuestionIngestionService($this->db))->enqueueBatchFromAdminSession(
            $preparedPayloads,
            $actorUserId,
            $baseIdempotencyKey
        );
    }

    public function listJobs(string $actorUserId, bool $canViewAll = false): array
    {
        return (new PrivateQuestionIngestionService($this->db))->listRecentJobs(
            $actorUserId,
            $canViewAll,
            20
        );
    }

    /** @return array<string,mixed> */
    public function bootstrap(string $actorUserId, bool $canViewAll = false): array
    {
        $ingestion = new PrivateQuestionIngestionService($this->db);
        return [
            'jobs' => $ingestion->listRecentJobs($actorUserId, $canViewAll, 20),
            'taxonomyStatus' => (new AdminGranTaxonomySyncService($this->db))->getStatus(),
            'publicationBatches' => $ingestion->listRecentBatches($actorUserId, $canViewAll, 20),
        ];
    }

    private function requestGran(string $url, string $token, string $clientId): array
    {
        if ($this->httpClient !== null) {
            return ($this->httpClient)($url, $token, $clientId);
        }
        if (!function_exists('curl_init')) {
            throw new RuntimeException('A extensao cURL nao esta disponivel no servidor.');
        }

        $body = '';
        $tooLarge = false;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => [
                'accept: application/json, text/plain, */*',
                'accept-language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'authorization: Bearer ' . $token,
                'origin: ' . self::WEB_ORIGIN,
                'priority: u=1, i',
                'referer: ' . self::WEB_ORIGIN . '/',
                'sec-ch-ua: "Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
                'sec-ch-ua-mobile: ?0',
                'sec-ch-ua-platform: "Windows"',
                'sec-fetch-dest: empty',
                'sec-fetch-mode: cors',
                'sec-fetch-site: same-site',
                'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    . 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
                'x-client-id: ' . $clientId,
            ],
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body, &$tooLarge): int {
                if (strlen($body) + strlen($chunk) > self::MAX_REMOTE_RESPONSE_BYTES) {
                    $tooLarge = true;
                    return 0;
                }
                $body .= $chunk;
                return strlen($chunk);
            },
        ]);

        $ok = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($tooLarge) {
            throw new RuntimeException('A resposta da Gran excedeu o limite seguro da plataforma.');
        }
        if ($ok === false || $error !== '') {
            throw new RuntimeException('Nao foi possivel consultar a Gran neste momento.');
        }

        return ['status' => $status, 'body' => $body];
    }

    private function extractRows(array $payload): array
    {
        foreach ([
            $payload['data']['rows'] ?? null,
            $payload['data']['items'] ?? null,
            $payload['rows'] ?? null,
            $payload['itens'] ?? null,
            $payload['items'] ?? null,
            $payload['results'] ?? null,
        ] as $candidate) {
            if (is_array($candidate)) {
                return array_values(array_filter($candidate, 'is_array'));
            }
        }
        return [];
    }

    /**
     * A busca da Gran pode misturar questoes de provas diferentes na mesma
     * pagina. Cada prova precisa permanecer um lote question-import.v2
     * independente, pois o importador canonico cria e vincula uma prova por
     * payload.
     */
    private function mapQuestionImportPayloads(array $rows, array $metadata): array
    {
        $this->granTaxonomyIdentityCache = [];
        $this->granQuestionIdentityCache = [];
        $this->granExamIdentityCache = [];
        $this->preloadGranTaxonomyIdentities($rows);
        $this->preloadGranQuestionIdentities($rows);
        $this->preloadGranExamIdentities($rows);

        $groups = [];

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $exam = $this->resolveRowExam($row, $metadata);
            $groupKey = (string) ($exam['sourceKey'] ?? '');
            if ($groupKey === '') {
                $groupKey = 'gran-exam-' . substr(hash(
                    'sha256',
                    json_encode($exam, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                ), 0, 20);
                $exam['sourceKey'] = $groupKey;
            }
            if (!isset($groups[$groupKey])) {
                $groups[$groupKey] = ['exam' => $exam, 'rows' => []];
            }
            $groups[$groupKey]['rows'][] = $row;
        }

        $payloads = [];
        foreach ($groups as $group) {
            $payloads[] = $this->mapQuestionImportPayload(
                $group['rows'],
                array_merge($metadata, ['exam' => $group['exam']])
            );
        }

        return $payloads;
    }

    private function countPayloadQuestions(array $payloads): int
    {
        return array_sum(array_map(
            static fn (array $payload): int => count(
                is_array($payload['questions'] ?? null) ? $payload['questions'] : []
            ),
            $payloads
        ));
    }

    /**
     * Carrega em poucas consultas os IDs locais já associados às identidades da
     * Gran. A tabela de identidades auxiliares é a fonte principal porque uma
     * taxonomia canônica pode representar mais de um ID histórico do provedor.
     */
    private function preloadGranTaxonomyIdentities(array $rows): void
    {
        $definitions = [
            ['type' => 'assunto', 'entityType' => 'assunto', 'keys' => ['assuntos']],
            ['type' => 'banca', 'entityType' => 'banca', 'keys' => ['bancas', 'banca']],
            ['type' => 'orgao', 'entityType' => 'orgao', 'keys' => ['orgaos', 'orgao']],
            ['type' => 'cargo', 'entityType' => 'cargo', 'keys' => ['cargos', 'cargo']],
            ['type' => 'carreira', 'entityType' => 'area', 'keys' => ['areas', 'area', 'focos', 'foco']],
            ['type' => 'carreira', 'entityType' => 'carreira', 'keys' => ['carreiras', 'carreira']],
        ];
        $externalIds = [];

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $sources = [$row, ...$this->extractProofCandidates($row)];
            foreach ($definitions as $definition) {
                foreach ($sources as $source) {
                    if (!is_array($source)) {
                        continue;
                    }
                    foreach ($definition['keys'] as $key) {
                        if (!array_key_exists($key, $source)) {
                            continue;
                        }
                        $values = $source[$key];
                        $values = is_array($values) && array_is_list($values) ? $values : [$values];
                        foreach ($values as $value) {
                            $externalId = $this->granTaxonomyExternalId($value, $definition['entityType']);
                            if ($externalId !== null) {
                                $externalIds[(string) $externalId] = true;
                            }
                        }
                    }
                }
            }
        }

        if ($externalIds === []) {
            return;
        }

        foreach (array_chunk(array_keys($externalIds), 500) as $chunkIndex => $chunk) {
            $placeholders = [];
            $bindings = [':gran_provider_' . $chunkIndex => 'gran'];
            foreach ($chunk as $index => $externalId) {
                $placeholder = ':gran_taxonomy_id_' . $chunkIndex . '_' . $index;
                $placeholders[] = $placeholder;
                $bindings[$placeholder] = $externalId;
            }

            try {
                $stmt = $this->db->prepare(
                    'SELECT i.filter_id AS local_id, i.filter_type, i.source_entity_type,
                            i.source_external_id, i.source_parent_external_id,
                            i.source_root_external_id, f.name, f.slug,
                            f.taxonomy_level, f.parent_id
                     FROM filter_source_identities i
                     INNER JOIN filters f ON f.id = i.filter_id
                     WHERE i.source_provider = :gran_provider_' . $chunkIndex . '
                       AND i.source_external_id IN (' . implode(', ', $placeholders) . ')'
                );
                $stmt->execute($bindings);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $identity) {
                    if (is_array($identity)) {
                        $this->cacheGranTaxonomyIdentity($identity);
                    }
                }
            } catch (Throwable) {
                // Compatibilidade temporária com ambientes que ainda não
                // aplicaram a tabela de identidades auxiliares.
            }

            try {
                $directBindings = [':gran_direct_provider_' . $chunkIndex => 'gran'];
                $directPlaceholders = [];
                foreach ($chunk as $index => $externalId) {
                    $placeholder = ':gran_direct_taxonomy_id_' . $chunkIndex . '_' . $index;
                    $directPlaceholders[] = $placeholder;
                    $directBindings[$placeholder] = $externalId;
                }
                $stmt = $this->db->prepare(
                    'SELECT id AS local_id, type AS filter_type, source_entity_type,
                            source_external_id, source_parent_external_id,
                            source_root_external_id, name, slug, taxonomy_level, parent_id
                     FROM filters
                     WHERE source_provider = :gran_direct_provider_' . $chunkIndex . '
                       AND source_external_id IN (' . implode(', ', $directPlaceholders) . ')'
                );
                $stmt->execute($directBindings);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $identity) {
                    if (is_array($identity)) {
                        $this->cacheGranTaxonomyIdentity($identity, false);
                    }
                }
            } catch (Throwable) {
                // O payload continua com a identidade externa e a publicação
                // aplicará a validação autoritativa antes de criar vínculos.
            }
        }
    }

    private function preloadGranQuestionIdentities(array $rows): void
    {
        $externalIds = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $externalId = $this->readText(
                $row['id_questao'] ?? null,
                $row['id'] ?? null,
                $row['question_id'] ?? null
            );
            if ($externalId !== '') {
                $externalIds[$externalId] = true;
            }
        }

        foreach (array_chunk(array_keys($externalIds), 500) as $chunkIndex => $chunk) {
            if ($chunk === []) {
                continue;
            }
            $placeholders = [];
            $bindings = [':gran_question_provider_' . $chunkIndex => 'gran'];
            foreach ($chunk as $index => $externalId) {
                $placeholder = ':gran_question_id_' . $chunkIndex . '_' . $index;
                $placeholders[] = $placeholder;
                $bindings[$placeholder] = $externalId;
            }
            try {
                $stmt = $this->db->prepare(
                    'SELECT id, source_external_id, publish_status, visibility_status
                     FROM questions
                     WHERE source_provider = :gran_question_provider_' . $chunkIndex . '
                       AND source_external_id IN (' . implode(', ', $placeholders) . ')'
                );
                $stmt->execute($bindings);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $question) {
                    $externalId = trim((string) ($question['source_external_id'] ?? ''));
                    if ($externalId !== '') {
                        $this->granQuestionIdentityCache[$externalId] = $question;
                    }
                }
            } catch (Throwable) {
                // Ambientes sem as colunas de identidade seguem funcionando;
                // a idempotência também é aplicada novamente ao publicar.
            }
        }
    }

    private function preloadGranExamIdentities(array $rows): void
    {
        $externalIds = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $proofs = $this->extractProofCandidates($row);
            if ($proofs === []) {
                $proofs = [$row];
            }
            foreach ($proofs as $proof) {
                $externalId = $this->readText(
                    $proof['id'] ?? null,
                    $proof['_id'] ?? null,
                    $proof['id_prova'] ?? null,
                    $proof['prova_id'] ?? null,
                    $proof['idProva'] ?? null,
                    $proof['provaId'] ?? null,
                    $proof['exam_id'] ?? null,
                    $proof['examId'] ?? null
                );
                if ($externalId !== '') {
                    $externalIds[$externalId] = true;
                }
            }
        }

        foreach (array_chunk(array_keys($externalIds), 500) as $chunkIndex => $chunk) {
            if ($chunk === []) {
                continue;
            }
            $placeholders = [];
            $bindings = [':gran_exam_provider_' . $chunkIndex => 'gran'];
            foreach ($chunk as $index => $externalId) {
                $placeholder = ':gran_exam_id_' . $chunkIndex . '_' . $index;
                $placeholders[] = $placeholder;
                $bindings[$placeholder] = $externalId;
            }
            try {
                $stmt = $this->db->prepare(
                    'SELECT id, source_external_id, status_editorial, visibility_status
                     FROM provas
                     WHERE source_provider = :gran_exam_provider_' . $chunkIndex . '
                       AND source_external_id IN (' . implode(', ', $placeholders) . ')'
                );
                $stmt->execute($bindings);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $exam) {
                    $externalId = trim((string) ($exam['source_external_id'] ?? ''));
                    if ($externalId !== '') {
                        $this->granExamIdentityCache[$externalId] = $exam;
                    }
                }
            } catch (Throwable) {
                // A prova ainda será reconciliada de forma autoritativa pelo
                // repositório no momento da publicação.
            }
        }
    }

    private function granTaxonomyExternalId(mixed $value, string $entityType): int|string|null
    {
        if (is_array($value)) {
            return $this->externalTaxonomyId(
                $value['id'] ?? $value['_id'] ?? $value['id_' . $entityType] ?? null
            );
        }

        return is_int($value) || is_float($value) || (is_string($value) && ctype_digit(trim($value)))
            ? $this->externalTaxonomyId($value)
            : null;
    }

    private function cacheGranTaxonomyIdentity(array $identity, bool $overwrite = true): void
    {
        $key = $this->granTaxonomyIdentityKey(
            (string) ($identity['filter_type'] ?? ''),
            (string) ($identity['source_entity_type'] ?? ''),
            $identity['source_external_id'] ?? null
        );
        if ($key === '' || (!$overwrite && isset($this->granTaxonomyIdentityCache[$key]))) {
            return;
        }
        $this->granTaxonomyIdentityCache[$key] = $identity;
    }

    private function granTaxonomyIdentityKey(string $type, string $entityType, mixed $externalId): string
    {
        $normalizedExternalId = $this->externalTaxonomyId($externalId);
        $type = trim($type);
        $entityType = trim($entityType);
        return $type !== '' && $entityType !== '' && $normalizedExternalId !== null
            ? $type . '|' . $entityType . '|' . (string) $normalizedExternalId
            : '';
    }

    private function granTaxonomyIdentity(string $type, string $entityType, mixed $externalId): ?array
    {
        $key = $this->granTaxonomyIdentityKey($type, $entityType, $externalId);
        return $key !== '' && isset($this->granTaxonomyIdentityCache[$key])
            ? $this->granTaxonomyIdentityCache[$key]
            : null;
    }

    private function mapQuestionImportPayload(array $rows, array $metadata): array
    {
        $questions = [];
        $contexts = [];
        $seen = [];
        $contextIndexes = [];
        $examMetadata = is_array($metadata['exam'] ?? null) ? $metadata['exam'] : [];
        $externalExamId = $this->readText(
            $examMetadata['externalId'] ?? null,
            $examMetadata['sourceId'] ?? null
        );
        $sourceExamKey = trim((string) ($examMetadata['sourceKey'] ?? ''));
        $examTempPrefix = substr(hash('sha256', $sourceExamKey !== '' ? $sourceExamKey : 'gran-exam'), 0, 10);

        foreach ($rows as $index => $row) {
            $externalId = $this->readText($row['id_questao'] ?? null, $row['id'] ?? null, $row['question_id'] ?? null);
            $identity = $externalId !== ''
                ? 'id:' . $externalId
                : 'hash:' . hash('sha256', json_encode([
                    $this->cleanText($row['enunciado'] ?? ''),
                    $row['itens'] ?? $row['alternativas'] ?? [],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            if (isset($seen[$identity])) {
                continue;
            }
            $seen[$identity] = true;

            $number = $this->readQuestionNumber($row);
            $sourcePage = $this->readPositiveInt($row['pagina'] ?? $row['page'] ?? $row['source_page'] ?? 0) ?: null;
            $tempId = 'gran_' . $examTempPrefix . '_q_'
                . $this->safeIdPart($externalId !== '' ? $externalId : (string) ($index + 1));
            $group = is_array($row['grupo_questao'] ?? null)
                ? $row['grupo_questao']
                : (is_array($row['grupoQuestao'] ?? null)
                    ? $row['grupoQuestao']
                    : (is_array($row['contexto'] ?? null)
                        ? $row['contexto']
                        : (is_array($row['grupo'] ?? null) ? $row['grupo'] : null)));
            $contextTempId = null;
            $contextClean = '';

            if ($group !== null) {
                $groupBody = $this->joinDistinctHtml([
                    $group['enunciado'] ?? $group['statement'] ?? '',
                    $group['texto'] ?? $group['body'] ?? $group['text'] ?? '',
                ]);
                $sanitizedGroupBody = $this->sanitizeRichText($groupBody);
                $inlineContextAssets = $this->extractInlineAssets(
                    $sanitizedGroupBody,
                    'gran_ctx_preview',
                    'context',
                    $sourcePage
                );
                $explicitContextAssets = $this->extractAssets(
                    $group,
                    'gran_ctx_preview',
                    'context',
                    $sourcePage
                );
                if ($this->cleanText($groupBody) !== '' || $inlineContextAssets !== [] || $explicitContextAssets !== []) {
                    $groupIdentity = $this->readText(
                        $group['id'] ?? null,
                        $group['id_grupo'] ?? null,
                        $group['grupo_id'] ?? null
                    );
                    $contextTempId = 'gran_ctx_' . $this->safeIdPart(
                        $groupIdentity !== ''
                            ? $groupIdentity
                            : substr(hash(
                                'sha256',
                                json_encode($group, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                            ), 0, 16)
                    );
                    if (!isset($contextIndexes[$contextTempId])) {
                        $inlineContextAssets = $this->extractInlineAssets(
                            $sanitizedGroupBody,
                            $contextTempId,
                            'context',
                            $sourcePage
                        );
                        $contextAssets = $this->deduplicateAssets(array_merge(
                            $inlineContextAssets,
                            $this->extractAssets($group, $contextTempId, 'context', $sourcePage)
                        ));
                        $contexts[] = [
                            'tempId' => $contextTempId,
                            'source' => [
                                'provider' => 'gran',
                                'externalId' => $groupIdentity !== '' ? $groupIdentity : null,
                            ],
                            'type' => 'shared',
                            'body' => $this->replaceInlineImagesWithMarkers(
                                $sanitizedGroupBody,
                                $inlineContextAssets
                            ),
                            'bodyClean' => $this->cleanText($groupBody),
                            'reference' => $this->readText(
                                $group['referencia'] ?? null,
                                $group['reference'] ?? null,
                                $group['fonte'] ?? null
                            ),
                            'sourcePage' => $sourcePage,
                            'assets' => $contextAssets,
                            'questionNumbers' => [],
                        ];
                        $contextIndexes[$contextTempId] = count($contexts) - 1;
                    }
                    if ($number !== null) {
                        $contexts[$contextIndexes[$contextTempId]]['questionNumbers'][] = $number;
                    }
                    $contextClean = (string) $contexts[$contextIndexes[$contextTempId]]['bodyClean'];
                }
            }

            $statement = $this->sanitizeRichText($this->readText(
                $row['enunciado'] ?? null,
                $row['statement'] ?? null
            ));
            $statementClean = $this->cleanText($this->readText(
                $row['enunciado_clean'] ?? null,
                $row['statement_clean'] ?? null,
                $row['statementClean'] ?? null,
                $statement
            ));
            $support = $this->resolveSupportText($row);
            if ($contextClean !== '' && $this->cleanText($support) === $contextClean) {
                $support = '';
            }
            $alternatives = $this->mapAlternatives($row, $tempId, $sourcePage);
            $statementAssets = $this->extractInlineAssets($statement, $tempId, 'statement', $sourcePage);
            $supportAssets = $this->extractInlineAssets(
                $support,
                $tempId . '_support',
                'support',
                $sourcePage
            );
            $supportAssets = $this->deduplicateAssets(array_merge(
                $supportAssets,
                $this->extractSupportAssets($row, $tempId . '_support', $sourcePage)
            ));
            $questionAssets = array_merge(
                $statementAssets,
                $supportAssets,
                $this->extractAssets($row, $tempId, 'statement', $sourcePage)
            );
            $questionAssets = $this->deduplicateAssets($questionAssets);
            $correctIds = $alternatives['correctIds'];
            $questionType = $this->resolveQuestionType($alternatives['items'], $row);
            $editorial = [];
            $teacher = $this->readText($row['comentario_professor'] ?? null, $row['comentario_texto'] ?? null);
            $detailed = $this->readText(
                $row['resolucao_texto'] ?? null,
                $row['texto_resolucao'] ?? null,
                $row['analise_detalhada'] ?? null
            );
            if ($teacher !== '') {
                $editorial[] = ['type' => 'teacher_comment', 'title' => '', 'body' => $this->sanitizeRichText($teacher), 'status' => 'draft'];
            }
            if ($detailed !== '') {
                $editorial[] = ['type' => 'detailed_analysis', 'title' => '', 'body' => $this->sanitizeRichText($detailed), 'status' => 'draft'];
            }

            $existingQuestion = $externalId !== ''
                ? ($this->granQuestionIdentityCache[$externalId] ?? null)
                : null;
            $existingQuestionId = is_array($existingQuestion) && is_numeric($existingQuestion['id'] ?? null)
                ? (int) $existingQuestion['id']
                : null;
            $existingPublicationStatus = strtolower(trim((string) (
                is_array($existingQuestion) ? ($existingQuestion['publish_status'] ?? '') : ''
            )));
            $alreadyPublished = $existingQuestionId !== null
                && in_array($existingPublicationStatus, ['published', 'publicado'], true);
            $existingVisibility = trim((string) (
                is_array($existingQuestion) ? ($existingQuestion['visibility_status'] ?? '') : ''
            ));
            $existingExam = $externalExamId !== ''
                ? ($this->granExamIdentityCache[$externalExamId] ?? null)
                : null;
            $existingExamId = is_array($existingExam) && is_numeric($existingExam['id'] ?? null)
                ? (int) $existingExam['id']
                : null;

            $question = [
                'tempId' => $tempId,
                'id' => $existingQuestionId,
                'source' => [
                    'origin' => 'exam',
                    'examId' => $existingExamId,
                    'questionNumber' => $number,
                    'contextTempId' => $contextTempId,
                    'sourcePage' => $sourcePage,
                    'externalId' => $externalId !== '' ? $externalId : null,
                    'externalExamId' => $externalExamId !== '' ? $externalExamId : null,
                    'sourceExamKey' => $sourceExamKey !== '' ? $sourceExamKey : null,
                    'provider' => 'gran',
                    'localQuestionId' => $existingQuestionId,
                    'alreadyPublished' => $alreadyPublished,
                    'publicationStatus' => $existingPublicationStatus !== ''
                        ? $existingPublicationStatus
                        : null,
                ],
                'content' => [
                    'statement' => $this->replaceInlineImagesWithMarkers($statement, $statementAssets),
                    'statementClean' => $statementClean,
                    'supportText' => $this->replaceInlineImagesWithMarkers($support, $supportAssets),
                    'reference' => $this->readText(
                        $row['referencia'] ?? null,
                        $row['reference'] ?? null,
                        $row['fonte'] ?? null
                    ),
                ],
                'assets' => $questionAssets,
                // IDs da Gran nunca sao IDs locais. Primeiro preservamos a
                // identidade externa; se a taxonomia ja foi sincronizada,
                // hidratamos somente o ID local correspondente.
                'filters' => $this->hydrateGranTaxonomyIds($this->mapFilters($row, $examMetadata)),
                'type' => $questionType,
                'difficulty' => $this->resolveDifficulty($row['dificuldade'] ?? null),
                'alternatives' => $alternatives['items'],
                'answer' => [
                    'mode' => count($correctIds) > 1 ? 'multiple' : 'single',
                    'raw' => count($correctIds) === 1
                        ? $this->findAlternativeLabel($alternatives['items'], $correctIds[0])
                        : '',
                    'correctAlternativeTempIds' => $correctIds,
                ],
                'editorial' => $editorial,
                'publication' => [
                    'status' => $alreadyPublished ? 'published' : 'draft',
                    'visibility' => $alreadyPublished && $existingVisibility !== ''
                        ? $existingVisibility
                        : 'private',
                    'scheduledAt' => null,
                ],
                'review' => [
                    'required' => !$alreadyPublished,
                    'status' => $alreadyPublished ? 'published' : 'pending',
                    'reasons' => [],
                ],
            ];
            $contextHasAssets = $contextTempId !== null
                && isset($contextIndexes[$contextTempId])
                && ($contexts[$contextIndexes[$contextTempId]]['assets'] ?? []) !== [];
            $question['review']['reasons'] = $alreadyPublished
                ? []
                : $this->reviewReasons($question, $contextHasAssets);
            $questions[] = $question;
        }

        foreach ($contexts as &$context) {
            $context['questionNumbers'] = array_values(array_unique($context['questionNumbers']));
            sort($context['questionNumbers']);
        }
        unset($context);

        $exam = $this->inferExam($questions, $metadata);
        return [
            'schemaVersion' => 'question-import.v2',
            'import' => [
                'sourceType' => 'authorized_admin_collection',
                'extractionMode' => (string) ($metadata['extractionMode'] ?? 'gran_admin_proxy'),
                'status' => 'draft',
                'collectionPage' => isset($metadata['collectionPage']) ? (int) $metadata['collectionPage'] : null,
                'collectionPerPage' => isset($metadata['collectionPerPage']) ? (int) $metadata['collectionPerPage'] : null,
                'collectionRequestUrl' => trim((string) ($metadata['collectionRequestUrl'] ?? '')) ?: null,
                'diagnostics' => [
                    sprintf('Coleta administrativa autorizada: %d questao(oes).', count($questions)),
                    'Todo item exige revisao editorial antes da publicacao.',
                ],
            ],
            'exam' => $exam,
            'contexts' => $contexts,
            'questions' => $questions,
        ];
    }

    private function mapAlternatives(array $row, string $questionTempId, ?int $sourcePage): array
    {
        $rawItems = is_array($row['itens'] ?? null) && $row['itens'] !== []
            ? $row['itens']
            : (is_array($row['alternativas'] ?? null)
                ? $row['alternativas']
                : (is_array($row['alternativas_questao'] ?? null) ? $row['alternativas_questao'] : []));
        $correctTokens = $this->correctAnswerTokens(
            $row['resposta']
            ?? $row['resposta_id']
            ?? $row['resposta_correta']
            ?? $row['item_correto']
            ?? $row['gabarito']
            ?? null
        );
        $items = [];
        $correctIds = [];

        foreach (array_values(array_filter($rawItems, 'is_array')) as $index => $raw) {
            $label = strtoupper($this->readText($raw['rotulo'] ?? null, $raw['label'] ?? null));
            if ($label === '') {
                $label = chr(65 + min(25, $index));
            }
            $tempId = $questionTempId . '_alt_' . strtolower($this->safeIdPart($label));
            $text = $this->sanitizeRichText($this->readText(
                $raw['corpo'] ?? null,
                $raw['texto_alternativa'] ?? null,
                $raw['texto'] ?? null,
                $raw['text'] ?? null
            ));
            $assets = $this->deduplicateAssets(array_merge(
                $this->extractInlineAssets($text, $tempId, 'alternative', $sourcePage),
                $this->extractAssets($raw, $tempId, 'alternative', $sourcePage)
            ));
            $rawId = $raw['id'] ?? $raw['id_item'] ?? $raw['alternative_id'] ?? null;
            $isCorrect = $this->isTruthyFlag($raw['is_correto'] ?? null)
                || $this->isTruthyFlag($raw['correto'] ?? null)
                || $this->isTruthyFlag($raw['isCorrect'] ?? null)
                || ($rawId !== null && in_array(strtoupper(trim((string) $rawId)), $correctTokens, true))
                || in_array($label, $correctTokens, true);
            if ($isCorrect) {
                $correctIds[] = $tempId;
            }
            $items[] = [
                'tempId' => $tempId,
                'order' => $index + 1,
                'label' => $label,
                'text' => $this->replaceInlineImagesWithMarkers($text, $assets),
                'textClean' => $this->cleanText($text),
                'assets' => $assets,
            ];
        }

        return ['items' => $items, 'correctIds' => $correctIds];
    }

    private function correctAnswerTokens(mixed $value): array
    {
        if (is_array($value) && !array_is_list($value)) {
            $value = $value['id']
                ?? $value['id_item']
                ?? $value['alternative_id']
                ?? $value['rotulo']
                ?? $value['label']
                ?? $value['resposta']
                ?? $value['valor']
                ?? [];
        }
        $values = is_array($value) ? $value : [$value];
        $tokens = [];
        foreach ($values as $entry) {
            if (is_array($entry)) {
                $tokens = array_merge($tokens, $this->correctAnswerTokens($entry));
                continue;
            }
            $token = strtoupper(trim((string) $entry));
            if ($token !== '') {
                $tokens[] = $token;
            }
        }
        return array_values(array_unique($tokens));
    }

    private function isTruthyFlag(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            return (int) $value === 1;
        }
        return in_array(strtolower(trim((string) $value)), ['true', 'sim', 'yes', 'correto', 'correct'], true);
    }

    private function mapFilters(array $row, array $examMetadata = []): array
    {
        $knowledgeTaxonomy = $this->mapGranKnowledgeTaxonomy($row);
        $taxonomySources = is_array($examMetadata['taxonomySources'] ?? null)
            ? $examMetadata['taxonomySources']
            : [];
        $boardValues = $row['bancas'] ?? $row['banca'] ?? [];
        if ($this->taxonomyLabelsFromValues($boardValues) === []) {
            $boardValues = $taxonomySources['bancas'] ?? [];
        }
        $organizationValues = $row['orgaos'] ?? $row['orgao'] ?? [];
        if ($this->taxonomyLabelsFromValues($organizationValues) === []) {
            $organizationValues = $taxonomySources['orgaos'] ?? [];
        }
        $roleValues = $row['cargos'] ?? $row['cargo'] ?? [];
        if ($this->taxonomyLabelsFromValues($roleValues) === []) {
            $roleValues = $taxonomySources['cargos'] ?? [];
        }

        return [
            'subjects' => $knowledgeTaxonomy['subjects'],
            'topics' => $knowledgeTaxonomy['topics'],
            'subtopics' => $knowledgeTaxonomy['subtopics'],
            'examBoards' => $this->mergeGranTaxonomyItems(
                $this->granTaxonomyItems($boardValues, 'banca'),
                $this->taxonomyItems(array_merge(
                    $this->taxonomyLabelsFromValues($boardValues),
                $this->normalizeStringList([$examMetadata['agency'] ?? null])
                ))
            ),
            'organizations' => $this->mergeGranTaxonomyItems(
                $this->granTaxonomyItems($organizationValues, 'orgao'),
                $this->taxonomyItems(array_merge(
                    $this->taxonomyLabelsFromValues($organizationValues),
                $this->normalizeStringList($examMetadata['organizations'] ?? [])
                ))
            ),
            'roles' => $this->mergeGranTaxonomyItems(
                $this->granTaxonomyItems($roleValues, 'cargo'),
                $this->taxonomyItems(array_merge(
                    $this->taxonomyLabelsFromValues($roleValues),
                $this->normalizeStringList($examMetadata['roles'] ?? [])
                ))
            ),
            // No contrato da Gran, area representa o foco de estudo. Carreira
            // e apenas fallback, nunca substitui uma area explicitamente vinda
            // da questao.
            'careers' => $this->mapGranFocusItems($row, $examMetadata),
            'years' => $this->taxonomyItems(
                array_merge(
                    is_array($row['anos'] ?? null) ? $row['anos'] : [$row['ano'] ?? null],
                    [$examMetadata['year'] ?? null]
                )
            ),
            'levels' => $this->taxonomyItems(array_filter([
                $this->resolveLevel($row),
                $examMetadata['level'] ?? null,
            ])),
            'examTypes' => $this->taxonomyItems(array_merge(
                $this->taxonomyLabelsFromValues($row['tipos_prova'] ?? $row['tiposProva'] ?? []),
                $this->normalizeStringList([$examMetadata['examType'] ?? null])
            )),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function mapGranFocusItems(array $row, array $examMetadata): array
    {
        $areaValues = $row['area'] ?? $row['areas'] ?? $row['foco'] ?? $row['focos'] ?? [];
        if ($this->taxonomyLabelsFromValues($areaValues) === []) {
            $taxonomySources = is_array($examMetadata['taxonomySources'] ?? null)
                ? $examMetadata['taxonomySources']
                : [];
            $areaValues = $taxonomySources['focos'] ?? [];
        }
        $areaItems = $this->granTaxonomyItems($areaValues, 'area');
        if ($areaItems !== []) {
            return $areaItems;
        }

        $careerValues = $row['carreira'] ?? $row['carreiras'] ?? [];
        $careerItems = $this->granTaxonomyItems($careerValues, 'carreira');
        if ($careerItems !== []) {
            return $careerItems;
        }

        return $this->taxonomyItems($this->normalizeStringList($examMetadata['focuses'] ?? []));
    }

    /** @return array<int, array<string, mixed>> */
    private function granTaxonomyItems(mixed $values, string $entityType): array
    {
        $values = is_array($values) && array_is_list($values) ? $values : [$values];
        $filterType = match ($entityType) {
            'banca' => 'banca',
            'orgao' => 'orgao',
            'cargo' => 'cargo',
            'area', 'carreira' => 'carreira',
            default => 'assunto',
        };
        $items = [];
        foreach ($values as $value) {
            $externalId = $this->granTaxonomyExternalId($value, $entityType);
            $canonical = $externalId !== null
                ? $this->granTaxonomyIdentity($filterType, $entityType, $externalId)
                : null;
            $label = $this->entityLabel($value);
            $canonicalName = is_array($canonical)
                ? trim((string) ($canonical['name'] ?? ''))
                : '';
            if ($canonicalName !== '') {
                $label = $canonicalName;
            }
            if ($label === '') {
                continue;
            }
            $item = [
                'id' => is_array($canonical) && is_numeric($canonical['local_id'] ?? null)
                    ? (int) $canonical['local_id']
                    : null,
                'label' => $label,
                'name' => $label,
                'slug' => is_array($canonical) && trim((string) ($canonical['slug'] ?? '')) !== ''
                    ? trim((string) $canonical['slug'])
                    : $this->slugify($label),
                'provider' => 'gran',
                'sourceEntityType' => $entityType,
            ];
            if ($externalId !== null) {
                $item['externalId'] = $externalId;
            }
            if (is_array($value)) {
                $externalSlug = $this->readText($value['slug'] ?? null);
                if ($externalSlug !== '') {
                    $item['externalSlug'] = $externalSlug;
                }
            }
            $items[] = $item;
        }

        return $this->mergeGranTaxonomyItems([], $items);
    }

    /** @return array<int, array<string, mixed>> */
    private function mergeGranTaxonomyItems(array ...$groups): array
    {
        $result = [];
        $seen = [];
        foreach ($groups as $group) {
            foreach ($group as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $externalId = $item['externalId'] ?? null;
                $key = $externalId !== null
                    ? 'gran:' . (string) ($item['sourceEntityType'] ?? '') . ':' . (string) $externalId
                    : 'label:' . $this->slugify((string) ($item['label'] ?? ''));
                $labelKey = 'label:' . $this->slugify((string) ($item['label'] ?? ''));
                if ($labelKey === 'label:' || isset($seen[$key]) || isset($seen[$labelKey])) {
                    continue;
                }
                $seen[$key] = true;
                $seen[$labelKey] = true;
                $result[] = $item;
            }
        }

        return $result;
    }

    /** @return array<string, array<int, array<string, mixed>>> */
    private function hydrateGranTaxonomyIds(array $filters): array
    {
        $definitions = [
            'subjects' => ['type' => 'assunto', 'entityType' => 'assunto'],
            'topics' => ['type' => 'assunto', 'entityType' => 'assunto'],
            'subtopics' => ['type' => 'assunto', 'entityType' => 'assunto'],
            'examBoards' => ['type' => 'banca', 'entityType' => 'banca'],
            'organizations' => ['type' => 'orgao', 'entityType' => 'orgao'],
            'roles' => ['type' => 'cargo', 'entityType' => 'cargo'],
            'careers' => ['type' => 'carreira', 'entityType' => 'area'],
        ];
        foreach ($definitions as $bucket => $definition) {
            if (!is_array($filters[$bucket] ?? null)) {
                continue;
            }
            foreach ($filters[$bucket] as $index => $item) {
                if (!is_array($item) || ($item['provider'] ?? null) !== 'gran') {
                    continue;
                }
                $externalId = $this->externalTaxonomyId($item['externalId'] ?? null);
                if ($externalId === null) {
                    continue;
                }
                $entityType = trim((string) ($item['sourceEntityType'] ?? $definition['entityType']));
                $identity = $this->granTaxonomyIdentity(
                    $definition['type'],
                    $entityType,
                    $externalId
                );
                if (is_array($identity) && is_numeric($identity['local_id'] ?? null)) {
                    $item['id'] = (int) $identity['local_id'];
                }
                $filters[$bucket][$index] = $item;
            }
        }

        return $filters;
    }

    /**
     * A Gran devolve materia, topicos e assuntos no mesmo array, sem garantir
     * ordem. A hierarquia deve ser reconstruida pelos IDs externos; esses IDs
     * nunca podem ser confundidos com IDs das taxonomias locais.
     *
     * @return array{subjects: array<int, array<string, mixed>>, topics: array<int, array<string, mixed>>, subtopics: array<int, array<string, mixed>>}
     */
    private function mapGranKnowledgeTaxonomy(array $row): array
    {
        $rawValues = $row['assuntos'] ?? [];
        $rawValues = is_array($rawValues) && array_is_list($rawValues) ? $rawValues : [$rawValues];
        $records = [];
        $recordsByExternalId = [];
        $hasHierarchyMetadata = false;

        foreach ($rawValues as $value) {
            if (!is_array($value)) {
                $externalId = $this->granTaxonomyExternalId($value, 'assunto');
                $canonical = $externalId !== null
                    ? $this->granTaxonomyIdentity('assunto', 'assunto', $externalId)
                    : null;
                $label = $this->entityLabel($value);
                $canonicalName = is_array($canonical)
                    ? trim((string) ($canonical['name'] ?? ''))
                    : '';
                if ($canonicalName !== '') {
                    $label = $canonicalName;
                }
                if ($label !== '') {
                    $record = ['nome' => $label];
                    if ($externalId !== null) {
                        $record['id'] = $externalId;
                    }
                    if (is_array($canonical)) {
                        $record['_localId'] = $canonical['local_id'] ?? null;
                        $record['taxonomy_level'] = $canonical['taxonomy_level'] ?? null;
                        $record['pai'] = $canonical['source_parent_external_id'] ?? null;
                        $record['assunto_raiz'] = $canonical['source_root_external_id'] ?? null;
                        $hasHierarchyMetadata = true;
                    }
                    $records[] = $record;
                    if ($externalId !== null) {
                        $recordsByExternalId[(string) $externalId] = $record;
                    }
                }
                continue;
            }

            $externalId = $this->granTaxonomyExternalId($value, 'assunto');
            $canonical = $externalId !== null
                ? $this->granTaxonomyIdentity('assunto', 'assunto', $externalId)
                : null;
            $label = $this->entityLabel($value);
            $canonicalName = is_array($canonical)
                ? trim((string) ($canonical['name'] ?? ''))
                : '';
            if ($canonicalName !== '') {
                $label = $canonicalName;
            }
            if ($label === '') {
                continue;
            }

            $value['nome'] = $label;
            if (is_array($canonical)) {
                $value['_localId'] = $canonical['local_id'] ?? null;
                foreach ([
                    'taxonomy_level' => 'taxonomy_level',
                    'pai' => 'source_parent_external_id',
                    'assunto_raiz' => 'source_root_external_id',
                ] as $targetKey => $canonicalKey) {
                    if (!array_key_exists($targetKey, $value) || $value[$targetKey] === null || $value[$targetKey] === '') {
                        $value[$targetKey] = $canonical[$canonicalKey] ?? null;
                    }
                }
            }
            $records[] = $value;
            if ($externalId !== null) {
                $recordsByExternalId[(string) $externalId] = $value;
            }
            if (
                array_key_exists('materia', $value)
                || array_key_exists('pai', $value)
                || array_key_exists('assunto_raiz', $value)
            ) {
                $hasHierarchyMetadata = true;
            }
        }

        $subjects = [];
        $topics = [];
        $subtopics = [];
        $unclassified = [];

        foreach ($records as $record) {
            $level = $this->resolveGranKnowledgeTaxonomyLevel($record, $hasHierarchyMetadata);
            if ($level === '') {
                $unclassified[] = $record;
                continue;
            }

            $item = $this->buildGranKnowledgeTaxonomyItem($record, $level, $recordsByExternalId);
            if ($item === null) {
                continue;
            }
            if ($level === 'materia') {
                $subjects[] = $item;
            } elseif ($level === 'topico') {
                $topics[] = $item;
            } else {
                $subtopics[] = $item;
            }
        }

        $legacySubject = $this->readText(
            $row['materia_questao'] ?? null,
            $this->entityLabel($row['disciplina'] ?? null),
            $this->entityLabel($row['materia'] ?? null),
            $row['materia_nome'] ?? null
        );
        $legacyTopics = $this->taxonomyLabelsFromValues(
            $row['topicos']
            ?? $row['topicos_questao']
            ?? $row['topics']
            ?? []
        );

        if (!$hasHierarchyMetadata) {
            $unclassifiedLabels = $this->taxonomyLabelsFromValues($unclassified);
            if ($legacyTopics === [] && $legacySubject !== '' && $unclassifiedLabels !== []) {
                $legacyTopics[] = (string) array_shift($unclassifiedLabels);
            } elseif ($legacySubject === '' && $legacyTopics === [] && $unclassifiedLabels !== []) {
                $legacySubject = (string) array_shift($unclassifiedLabels);
                if ($unclassifiedLabels !== []) {
                    $legacyTopics[] = (string) array_shift($unclassifiedLabels);
                }
            }
            $subtopics = $this->mergeKnowledgeTaxonomyItems(
                $subtopics,
                $this->knowledgeTaxonomyItemsFromLabels($unclassifiedLabels, 'assunto')
            );
        } else {
            $subtopics = $this->mergeKnowledgeTaxonomyItems(
                $subtopics,
                array_values(array_filter(array_map(
                    fn (array $record): ?array => $this->buildGranKnowledgeTaxonomyItem(
                        $record,
                        'assunto',
                        $recordsByExternalId
                    ),
                    $unclassified
                )))
            );
        }

        $subjects = $this->mergeKnowledgeTaxonomyItems(
            $subjects,
            $this->knowledgeTaxonomyItemsFromLabels($legacySubject !== '' ? [$legacySubject] : [], 'materia')
        );
        $topics = $this->mergeKnowledgeTaxonomyItems(
            $topics,
            $this->knowledgeTaxonomyItemsFromLabels($legacyTopics, 'topico')
        );

        return [
            'subjects' => $subjects,
            'topics' => $topics,
            'subtopics' => $subtopics,
        ];
    }

    private function resolveGranKnowledgeTaxonomyLevel(array $record, bool $hasHierarchyMetadata): string
    {
        $explicitLevel = $this->slugify($this->readText(
            $record['taxonomyLevel'] ?? null,
            $record['taxonomy_level'] ?? null,
            $record['nivel'] ?? null,
            $record['tipo'] ?? null
        ));
        if (
            $this->isTruthyFlag($record['materia'] ?? false)
            || in_array($explicitLevel, ['materia', 'disciplina', 'subject'], true)
        ) {
            return 'materia';
        }
        if (str_contains($explicitLevel, 'topico') || str_contains($explicitLevel, 'topic')) {
            return 'topico';
        }
        if (
            str_contains($explicitLevel, 'assunto')
            || str_contains($explicitLevel, 'subtopico')
            || str_contains($explicitLevel, 'subtopic')
        ) {
            return 'assunto';
        }

        $externalId = $this->externalTaxonomyId($record['id'] ?? null);
        $externalParentId = $this->externalTaxonomyId($record['pai'] ?? null);
        $externalRootId = $this->externalTaxonomyId($record['assunto_raiz'] ?? null);
        if (
            $externalId !== null
            && $externalRootId !== null
            && (string) $externalId === (string) $externalRootId
            && $externalParentId === null
        ) {
            return 'materia';
        }
        if (
            $externalParentId !== null
            && $externalRootId !== null
            && (string) $externalParentId === (string) $externalRootId
        ) {
            return 'topico';
        }
        if ($externalParentId !== null || ($externalId !== null && $externalRootId !== null)) {
            return 'assunto';
        }

        return $hasHierarchyMetadata ? 'assunto' : '';
    }

    /**
     * @param array<string, array<string, mixed>> $recordsByExternalId
     * @return array<string, mixed>|null
     */
    private function buildGranKnowledgeTaxonomyItem(
        array $record,
        string $level,
        array $recordsByExternalId
    ): ?array {
        $label = $this->entityLabel($record);
        if ($label === '') {
            return null;
        }

        $externalId = $this->externalTaxonomyId($record['id'] ?? null);
        $externalParentId = $this->externalTaxonomyId($record['pai'] ?? null);
        $externalRootId = $this->externalTaxonomyId($record['assunto_raiz'] ?? null);
        $parentRecord = $externalParentId !== null
            ? ($recordsByExternalId[(string) $externalParentId] ?? null)
            : null;
        $rootRecord = $externalRootId !== null
            ? ($recordsByExternalId[(string) $externalRootId] ?? null)
            : null;
        if (!is_array($parentRecord) && $externalParentId !== null) {
            $parentRecord = $this->granTaxonomyIdentity('assunto', 'assunto', $externalParentId);
        }
        if (!is_array($rootRecord) && $externalRootId !== null) {
            $rootRecord = $this->granTaxonomyIdentity('assunto', 'assunto', $externalRootId);
        }
        $parentName = is_array($parentRecord) ? $this->entityLabel($parentRecord) : '';
        $rootName = is_array($rootRecord) ? $this->entityLabel($rootRecord) : '';

        if ($level === 'topico' && $parentName === '') {
            $parentName = $rootName;
        } elseif ($level === 'assunto' && $parentName === '') {
            // O pai direto pode nao vir no recorte da questao. Nesse caso,
            // preservamos o ancestral conhecido sem inventar um topico.
            $parentName = $rootName;
        }

        $keywords = $this->normalizeStringList($record['palavrasChave'] ?? []);
        $item = [
            'id' => isset($record['_localId']) && is_numeric($record['_localId'])
                ? (int) $record['_localId']
                : null,
            'label' => $label,
            'name' => $label,
            'nome' => $label,
            'slug' => $this->slugify($label),
            'materia' => $level === 'materia',
            'taxonomyLevel' => $level,
            'taxonomy_level' => $level,
            'provider' => 'gran',
            'sourceEntityType' => 'assunto',
        ];
        foreach ([
            'externalId' => $externalId,
            'externalParentId' => $externalParentId,
            'externalRootId' => $externalRootId,
            'externalSlug' => $this->readText($record['slug'] ?? null),
            'parentName' => $parentName,
            'rootSubjectName' => $rootName,
        ] as $key => $value) {
            if ($value !== null && $value !== '') {
                $item[$key] = $value;
            }
        }
        if ($keywords !== []) {
            $item['palavrasChave'] = $keywords;
        }

        return $item;
    }

    private function externalTaxonomyId(mixed $value): int|string|null
    {
        if (is_int($value) && $value > 0) {
            return $value;
        }
        if (is_numeric($value) && (int) $value > 0) {
            return (int) $value;
        }
        $normalized = trim((string) $value);
        return $normalized !== '' ? $normalized : null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function knowledgeTaxonomyItemsFromLabels(array $labels, string $level): array
    {
        $items = [];
        foreach ($this->normalizeStringList($labels) as $label) {
            $items[] = [
                'id' => null,
                'label' => $label,
                'name' => $label,
                'nome' => $label,
                'slug' => $this->slugify($label),
                'materia' => $level === 'materia',
                'taxonomyLevel' => $level,
                'taxonomy_level' => $level,
            ];
        }
        return $items;
    }

    /**
     * @param array<int, array<string, mixed>> $primary
     * @param array<int, array<string, mixed>> $additional
     * @return array<int, array<string, mixed>>
     */
    private function mergeKnowledgeTaxonomyItems(array $primary, array $additional): array
    {
        $result = [];
        $seen = [];
        foreach (array_merge($primary, $additional) as $item) {
            $externalId = $item['externalId'] ?? null;
            $key = $externalId !== null
                ? 'external:' . (string) $externalId
                : 'label:' . $this->slugify((string) ($item['label'] ?? ''))
                    . ':level:' . (string) ($item['taxonomyLevel'] ?? '');
            if ($key === 'label::level:' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $result[] = $item;
        }
        return $result;
    }

    private function inferExam(array $questions, array $metadata): array
    {
        $resolved = is_array($metadata['exam'] ?? null) ? $metadata['exam'] : [];
        $first = $questions[0] ?? [];
        $filters = is_array($first['filters'] ?? null) ? $first['filters'] : [];
        $questionFocuses = [];
        foreach ($questions as $question) {
            if (!is_array($question)) {
                continue;
            }
            $questionFilters = is_array($question['filters'] ?? null) ? $question['filters'] : [];
            $questionFocuses = array_merge(
                $questionFocuses,
                $this->taxonomyLabelsFromValues($questionFilters['careers'] ?? [])
            );
        }
        $board = trim((string) ($resolved['agency'] ?? ($filters['examBoards'][0]['label'] ?? '')));
        $organizations = $this->normalizeStringList(
            $resolved['organizations'] ?? array_column($filters['organizations'] ?? [], 'label')
        );
        $roles = $this->normalizeStringList(
            $resolved['roles'] ?? array_column($filters['roles'] ?? [], 'label')
        );
        $years = array_column($filters['years'] ?? [], 'label');
        $levels = array_column($filters['levels'] ?? [], 'label');
        $year = isset($resolved['year']) && is_numeric($resolved['year'])
            ? (int) $resolved['year']
            : (isset($metadata['year']) && is_int($metadata['year'])
                ? $metadata['year']
                : (isset($years[0]) && is_numeric($years[0]) ? (int) $years[0] : null));
        $title = trim((string) ($resolved['title'] ?? ''));
        if ($title === '' && $board !== '' && $year !== null && $organizations !== [] && $roles !== []) {
            $title = implode(' - ', [$board, (string) $year, implode(' / ', $organizations), implode(' / ', $roles)]);
        }
        $numbers = array_values(array_filter(
            array_map(static fn (array $question) => $question['source']['questionNumber'] ?? null, $questions),
            'is_int'
        ));
        $booklet = is_array($resolved['booklet'] ?? null)
            ? array_merge(['type' => null, 'color' => null, 'name' => null], $resolved['booklet'])
            : ['type' => null, 'color' => null, 'name' => null];

        return [
            'id' => isset($resolved['id']) && is_numeric($resolved['id'])
                ? (int) $resolved['id']
                : null,
            'sourceKey' => trim((string) ($resolved['sourceKey'] ?? '')),
            'provider' => trim((string) ($resolved['provider'] ?? '')) ?: null,
            'externalId' => $resolved['externalId'] ?? null,
            'title' => $title,
            'agency' => $board !== '' ? $board : null,
            'organizations' => $organizations,
            'roles' => $roles,
            'focuses' => $this->normalizeStringList(array_merge(
                $this->normalizeStringList($resolved['focuses'] ?? []),
                $questionFocuses
            )),
            'year' => $year,
            'level' => $resolved['level'] ?? ($levels[0] ?? null),
            'examType' => $resolved['examType'] ?? null,
            'booklet' => $booklet,
            'files' => array_values(array_filter(
                is_array($resolved['files'] ?? null) ? $resolved['files'] : [],
                'is_array'
            )),
            'questionRange' => [
                'start' => $numbers !== [] ? min($numbers) : null,
                'end' => $numbers !== [] ? max($numbers) : null,
                'total' => count($questions),
            ],
        ];
    }

    private function resolveRowExam(array $row, array $metadata): array
    {
        $proofs = $this->extractProofCandidates($row);
        $proof = $proofs[0] ?? [];
        $externalId = $this->readText(
            $proof['id'] ?? null,
            $proof['_id'] ?? null,
            $proof['id_prova'] ?? null,
            $proof['prova_id'] ?? null,
            $proof['idProva'] ?? null,
            $proof['provaId'] ?? null,
            $proof['exam_id'] ?? null,
            $proof['examId'] ?? null,
            $row['id_prova'] ?? null,
            $row['prova_id'] ?? null,
            $row['idProva'] ?? null,
            $row['provaId'] ?? null,
            $row['exam_id'] ?? null,
            $row['examId'] ?? null
        );
        $title = $this->readExamTitle($proof);
        if ($title === '') {
            $title = $this->readText(
                $row['titulo_prova'] ?? null,
                $row['nome_prova'] ?? null,
                $row['exam_title'] ?? null
            );
        }

        $boardValues = $proof['bancas']
            ?? $proof['banca']
            ?? $proof['examBoards']
            ?? $row['bancas']
            ?? $row['banca']
            ?? [];
        $organizationValues = $proof['orgaos']
            ?? $proof['orgao']
            ?? $proof['organizations']
            ?? $row['orgaos']
            ?? $row['orgao']
            ?? [];
        $roleValues = $proof['cargos']
            ?? $proof['cargo']
            ?? $proof['roles']
            ?? $row['cargos']
            ?? $row['cargo']
            ?? [];
        $focusValues = $proof['areas']
            ?? $proof['area']
            ?? $proof['focos']
            ?? $proof['focuses']
            ?? $proof['carreiras']
            ?? [];
        $boards = $this->taxonomyLabelsFromValues($boardValues);
        $organizations = $this->taxonomyLabelsFromValues($organizationValues);
        $roles = $this->taxonomyLabelsFromValues($roleValues);
        $focuses = $this->taxonomyLabelsFromValues($focusValues);
        $year = $this->resolveExamYear($proof, $row, $metadata);
        $level = $this->entityLabel(
            $proof['nivel']
            ?? $proof['escolaridade']
            ?? $row['escolaridade']
            ?? $row['nivel']
            ?? null
        );
        $examTypes = $this->taxonomyLabelsFromValues(
            $proof['tipos_prova']
            ?? $proof['tipo_prova']
            ?? $proof['examTypes']
            ?? $row['tipos_prova']
            ?? $row['tiposProva']
            ?? []
        );
        $booklet = is_array($proof['caderno'] ?? null) ? $proof['caderno'] : [];
        $bookletType = $this->readText(
            $booklet['tipo'] ?? null,
            $proof['tipo_caderno'] ?? null,
            $proof['bookletType'] ?? null
        );
        $bookletColor = $this->readText(
            $booklet['cor'] ?? null,
            $proof['cor_caderno'] ?? null,
            $proof['bookletColor'] ?? null
        );
        $bookletName = $this->readText(
            $booklet['nome'] ?? null,
            $proof['nome_caderno'] ?? null,
            $proof['bookletName'] ?? null
        );
        $filesByExam = is_array($metadata['granExamFiles'] ?? null)
            ? $metadata['granExamFiles']
            : [];
        $files = $externalId !== '' && is_array($filesByExam[$externalId] ?? null)
            ? $filesByExam[$externalId]
            : [];

        if ($title === '' && $boards !== [] && $year !== null && $organizations !== [] && $roles !== []) {
            $title = implode(' - ', [
                $boards[0],
                (string) $year,
                implode(' / ', $organizations),
                implode(' / ', $roles),
            ]);
        }
        if ($title === '' && $externalId !== '') {
            $title = 'Gran - Prova ' . $externalId;
        }

        $sourceKey = $externalId !== ''
            ? 'gran:exam:' . $externalId
            : 'gran:exam:' . substr(hash('sha256', json_encode([
                'title' => $this->slugify($title),
                'board' => $boards,
                'organizations' => $organizations,
                'roles' => $roles,
                'year' => $year,
                'booklet' => [$bookletType, $bookletColor, $bookletName],
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)), 0, 24);

        $existingExam = $externalId !== '' ? ($this->granExamIdentityCache[$externalId] ?? null) : null;
        $existingExamId = is_array($existingExam) && is_numeric($existingExam['id'] ?? null)
            ? (int) $existingExam['id']
            : null;

        return [
            'id' => $existingExamId,
            'sourceKey' => $sourceKey,
            'provider' => 'gran',
            'externalId' => $externalId !== '' ? $externalId : null,
            'title' => $title,
            'agency' => $boards[0] ?? null,
            'organizations' => $organizations,
            'roles' => $roles,
            'focuses' => $focuses,
            'year' => $year,
            'level' => $level !== '' ? $level : null,
            'examType' => $examTypes[0] ?? null,
            'taxonomySources' => [
                'bancas' => $boardValues,
                'orgaos' => $organizationValues,
                'cargos' => $roleValues,
                'focos' => $focusValues,
            ],
            'booklet' => [
                'type' => $bookletType !== '' ? $bookletType : null,
                'color' => $bookletColor !== '' ? $bookletColor : null,
                'name' => $bookletName !== '' ? $bookletName : null,
            ],
            'files' => $files,
        ];
    }

    private function normalizeGranExamFiles(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }
        $keyMap = [
            'edital' => [
                'kind' => 'edital',
                'name' => 'Edital',
                'aliases' => ['edital', 'arquivoEdital', 'arquivo_edital'],
            ],
            'folhaDeProva' => [
                'kind' => 'prova',
                'name' => 'Prova',
                'aliases' => [
                    'folhaDeProva',
                    'folha_de_prova',
                    'prova',
                    'cadernoDeProva',
                    'caderno_de_prova',
                    'arquivoProva',
                    'arquivo_prova',
                ],
            ],
            'gabarito' => [
                'kind' => 'gabarito',
                'name' => 'Gabarito',
                'aliases' => ['gabarito', 'arquivoGabarito', 'arquivo_gabarito'],
            ],
        ];
        $normalized = [];
        foreach ($value as $externalExamId => $links) {
            $id = trim((string) $externalExamId);
            if ($id === '' || strlen($id) > 80 || preg_match('/^[a-zA-Z0-9_-]+$/', $id) !== 1 || !is_array($links)) {
                continue;
            }
            $candidate = is_array($links['data'] ?? null) ? $links['data'] : $links;
            $candidate = is_array($candidate['arquivos'] ?? null) ? $candidate['arquivos'] : $candidate;
            foreach ($keyMap as $remoteKey => $definition) {
                $remoteValue = null;
                foreach ($definition['aliases'] as $alias) {
                    if (array_key_exists($alias, $candidate)) {
                        $remoteValue = $candidate[$alias];
                        break;
                    }
                }
                $sourceUrl = is_array($remoteValue)
                    ? $this->readText(
                        $remoteValue['url'] ?? null,
                        $remoteValue['href'] ?? null,
                        $remoteValue['link'] ?? null,
                        $remoteValue['download'] ?? null,
                        $remoteValue['downloadUrl'] ?? null,
                        $remoteValue['download_url'] ?? null,
                        $remoteValue['arquivo'] ?? null
                    )
                    : trim((string) $remoteValue);
                if (!$this->isAllowedGranFileUrl($sourceUrl)) {
                    continue;
                }
                $normalized[$id][] = [
                    'kind' => $definition['kind'],
                    'name' => $definition['name'],
                    'sourceUrl' => $sourceUrl,
                    'sourceProvider' => 'gran',
                    'sourceExternalExamId' => $id,
                    'status' => 'pending_materialization',
                ];
            }
        }
        return $normalized;
    }

    private function isAllowedGranFileUrl(string $url): bool
    {
        if ($url === '' || strlen($url) > self::MAX_REQUEST_URL_BYTES || preg_match('/[\r\n]/', $url) === 1) {
            return false;
        }
        $parts = parse_url($url);
        return strtolower((string) ($parts['scheme'] ?? '')) === 'https'
            && strtolower((string) ($parts['host'] ?? '')) === 'arquivos.infra-questoes.grancursosonline.com.br'
            && (!isset($parts['port']) || (int) $parts['port'] === 443)
            && !isset($parts['user'])
            && !isset($parts['pass'])
            && !isset($parts['fragment'])
            && trim((string) ($parts['path'] ?? '')) !== '';
    }

    private function extractProofCandidates(array $row): array
    {
        $proofs = $row['provas'] ?? null;
        if (is_array($proofs) && array_is_list($proofs)) {
            $items = [];
            foreach ($proofs as $proof) {
                if (is_array($proof)) {
                    $items[] = $this->unwrapProofCandidate($proof);
                } elseif ((is_string($proof) || is_numeric($proof)) && trim((string) $proof) !== '') {
                    $items[] = ['id' => trim((string) $proof)];
                }
            }
            if ($items !== []) {
                return $items;
            }
        }
        foreach (['prova', 'exam', 'question_exam'] as $key) {
            if (is_array($row[$key] ?? null)) {
                return [$this->unwrapProofCandidate($row[$key])];
            }
        }
        return [[]];
    }

    private function unwrapProofCandidate(array $proof): array
    {
        foreach (['prova', 'exam', 'question_exam'] as $key) {
            if (is_array($proof[$key] ?? null)) {
                return $proof[$key];
            }
        }
        return $proof;
    }

    private function readExamTitle(array $proof): string
    {
        return $this->readText(
            $proof['titulo'] ?? null,
            $proof['title'] ?? null,
            $proof['nome'] ?? null,
            $proof['name'] ?? null,
            $proof['descricao'] ?? null,
            $proof['label'] ?? null
        );
    }

    private function resolveExamYear(array $proof, array $row, array $metadata): ?int
    {
        $values = [
            $proof['ano'] ?? null,
            $proof['year'] ?? null,
            is_array($row['anos'] ?? null) ? ($row['anos'][0] ?? null) : ($row['anos'] ?? null),
            $row['ano'] ?? null,
            $metadata['year'] ?? null,
        ];
        foreach ($values as $value) {
            if (is_array($value)) {
                $value = $this->entityLabel($value);
            }
            if (is_numeric($value) && (int) $value >= 1900 && (int) $value <= 2200) {
                return (int) $value;
            }
        }
        return null;
    }

    private function taxonomyLabelsFromValues(mixed $values): array
    {
        $values = is_array($values) && array_is_list($values) ? $values : [$values];
        $labels = [];
        foreach ($values as $value) {
            $label = $this->entityLabel($value);
            if ($label !== '') {
                $labels[] = $label;
            }
        }
        return $this->normalizeStringList($labels);
    }

    private function normalizeStringList(mixed $values): array
    {
        $values = is_array($values) ? $values : [$values];
        $result = [];
        $seen = [];
        foreach ($values as $value) {
            $label = trim((string) $value);
            $key = $this->slugify($label);
            if ($label === '' || $key === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $result[] = $label;
        }
        return $result;
    }

    private function resolveSupportText(array $row): string
    {
        $parts = [];
        foreach (is_array($row['textos_questao'] ?? null) ? $row['textos_questao'] : [] as $item) {
            if (is_array($item)) {
                $value = $this->readText($item['texto'] ?? null, $item['body'] ?? null, $item['text'] ?? null);
                if ($value !== '') {
                    $parts[] = $value;
                }
            }
        }
        if ($parts !== []) {
            return $this->joinDistinctHtml($parts);
        }
        return $this->sanitizeRichText($this->readText(
            $row['texto_questao'] ?? null,
            $row['texto_apoio'] ?? null,
            $row['texto_base'] ?? null,
            $row['supportText'] ?? null,
            $row['support_text'] ?? null,
            $row['introText'] ?? null,
            $row['intro_text'] ?? null
        ));
    }

    private function extractSupportAssets(array $row, string $prefix, ?int $sourcePage): array
    {
        $assets = [];
        foreach (is_array($row['textos_questao'] ?? null) ? $row['textos_questao'] : [] as $index => $item) {
            if (!is_array($item)) {
                continue;
            }
            $assets = array_merge(
                $assets,
                $this->extractAssets($item, $prefix . '_' . ($index + 1), 'support', $sourcePage)
            );
        }
        foreach (['imagens_apoio', 'supportImages', 'support_images'] as $key) {
            if (!is_array($row[$key] ?? null)) {
                continue;
            }
            $assets = array_merge(
                $assets,
                $this->extractAssets(['assets' => $row[$key]], $prefix, 'support', $sourcePage)
            );
        }
        return $this->deduplicateAssets($assets);
    }

    private function resolveLevel(array $row): string
    {
        $proof = is_array($row['provas'][0] ?? null)
            ? $this->unwrapProofCandidate($row['provas'][0])
            : (is_array($row['prova'] ?? null) ? $this->unwrapProofCandidate($row['prova']) : []);
        return $this->entityLabel(
            $row['escolaridade']
            ?? $row['nivel']
            ?? $row['nivel_questao']
            ?? $row['formacao']
            ?? $proof['nivel']
            ?? $proof['escolaridade']
            ?? $row['escolaridade_nome']
            ?? null
        );
    }

    private function taxonomyItems(mixed $values): array
    {
        $values = is_array($values) && array_is_list($values) ? $values : [$values];
        $result = [];
        $seen = [];
        foreach ($values as $value) {
            $label = $this->entityLabel($value);
            $slug = $this->slugify($label);
            if ($label === '' || $slug === '' || isset($seen[$slug])) {
                continue;
            }
            $seen[$slug] = true;
            $result[] = ['id' => null, 'label' => $label, 'slug' => $slug];
        }
        return $result;
    }

    private function entityLabel(mixed $value): string
    {
        if (is_string($value) || is_numeric($value)) {
            return trim((string) $value);
        }
        if (!is_array($value)) {
            return '';
        }
        return $this->readText(
            $value['sigla'] ?? null,
            $value['nome'] ?? null,
            $value['name'] ?? null,
            $value['descricao'] ?? null,
            $value['descrição'] ?? null,
            $value['label'] ?? null
        );
    }

    private function extractInlineAssets(string $html, string $prefix, string $usage, ?int $sourcePage): array
    {
        $assets = [];
        if (preg_match_all('/<img\b[^>]*\bsrc\s*=\s*(["\'])(.*?)\1[^>]*>/i', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $url = $this->resolveAssetUrl($match[2] ?? '');
                if ($url === '') {
                    continue;
                }
                $order = count($assets) + 1;
                $assets[] = [
                    'tempId' => $prefix . '_img_' . $order,
                    'type' => 'image',
                    'usage' => $usage,
                    'url' => $url,
                    'base64' => '',
                    'alt' => 'Imagem vinculada ao conteudo.',
                    'caption' => '',
                    'sourcePage' => $sourcePage,
                    'order' => $order,
                ];
            }
        }
        return $assets;
    }

    private function extractAssets(array $source, string $prefix, string $usage, ?int $sourcePage): array
    {
        $candidates = [];
        foreach ([
            $source['arquivo'] ?? null,
            $source['imagem'] ?? null,
            $source['image'] ?? null,
            $source['image_url'] ?? null,
            $source['url_imagem'] ?? null,
        ] as $candidate) {
            if ($candidate !== null) {
                $candidates[] = $candidate;
            }
        }
        foreach (['imagens', 'images', 'figuras', 'assets', 'arquivos'] as $key) {
            foreach (is_array($source[$key] ?? null) ? $source[$key] : [] as $candidate) {
                $candidates[] = $candidate;
            }
        }
        $assets = [];
        foreach ($candidates as $candidate) {
            $metadata = is_array($candidate) ? $candidate : [];
            $url = $this->resolveAssetUrl(is_array($candidate)
                ? $this->readText(
                    $candidate['caminho'] ?? null,
                    $candidate['url'] ?? null,
                    $candidate['src'] ?? null,
                    $candidate['path'] ?? null,
                    $candidate['arquivo'] ?? null
                )
                : (string) $candidate);
            if ($url === '') {
                continue;
            }
            $order = count($assets) + 1;
            $assets[] = [
                'tempId' => $prefix . '_asset_' . $order,
                'type' => 'image',
                'usage' => $usage,
                'url' => $url,
                'base64' => '',
                'alt' => $this->readText(
                    $metadata['alt'] ?? null,
                    $metadata['descricao'] ?? null,
                    $metadata['description'] ?? null,
                    'Imagem vinculada ao conteudo.'
                ),
                'caption' => $this->readText(
                    $metadata['legenda'] ?? null,
                    $metadata['caption'] ?? null
                ),
                'sourcePage' => $this->readPositiveInt(
                    $metadata['pagina'] ?? $metadata['page'] ?? $sourcePage ?? 0
                ) ?: $sourcePage,
                'order' => $order,
            ];
        }
        return $assets;
    }

    private function deduplicateAssets(array $assets): array
    {
        $result = [];
        $seen = [];
        foreach ($assets as $asset) {
            $url = (string) ($asset['url'] ?? '');
            if ($url === '' || isset($seen[$url])) {
                continue;
            }
            $seen[$url] = true;
            $asset['order'] = count($result) + 1;
            $result[] = $asset;
        }
        return $result;
    }

    private function replaceInlineImagesWithMarkers(string $html, array $assets): string
    {
        $index = 0;
        return (string) preg_replace_callback(
            '/<img\b[^>]*>/i',
            static function () use (&$index, $assets): string {
                $asset = $assets[$index] ?? null;
                $index++;
                return is_array($asset) ? '[image:' . $asset['tempId'] . ']' : '';
            },
            $html
        );
    }

    private function resolveAssetUrl(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }
        if (!preg_match('/^https:\/\//i', $value)) {
            if (preg_match('/^[a-z]+:/i', $value)) {
                return '';
            }
            $value = self::ASSET_ORIGIN . (str_starts_with($value, '/') ? '' : '/') . $value;
        }
        $parts = parse_url($value);
        $host = strtolower((string) ($parts['host'] ?? ''));
        if (($parts['scheme'] ?? '') !== 'https' || (
            $host !== 'grancursosonline.com.br'
            && !str_ends_with($host, '.grancursosonline.com.br')
        )) {
            return '';
        }
        return $value;
    }

    private function sanitizeRichText(mixed $value): string
    {
        $html = (string) $value;
        $html = preg_replace('/<!--[\s\S]*?-->/', '', $html) ?? '';
        $html = preg_replace(
            '/<(script|style|iframe|object|embed|form|input|button|meta|link)\b[^>]*>[\s\S]*?<\/\1\s*>/i',
            '',
            $html
        ) ?? '';
        $html = preg_replace('/\s+on[a-z]+\s*=\s*(["\']).*?\1/i', '', $html) ?? '';
        $html = preg_replace('/\s+(href|src)\s*=\s*(["\'])\s*javascript:.*?\2/i', '', $html) ?? '';
        return trim(strip_tags(
            $html,
            '<p><br><strong><b><em><i><u><ul><ol><li><blockquote><span><sub><sup><table><thead><tbody><tr><th><td><img>'
        ));
    }

    private function cleanText(mixed $value): string
    {
        $text = html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/[\t\r ]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/\n\s+/u', "\n", $text) ?? $text;
        return trim($text);
    }

    private function joinDistinctHtml(array $parts): string
    {
        $result = [];
        $seen = [];
        foreach ($parts as $part) {
            $sanitized = $this->sanitizeRichText($part);
            $clean = $this->cleanText($sanitized);
            if ($clean === '' || isset($seen[$clean])) {
                continue;
            }
            $seen[$clean] = true;
            $result[] = $sanitized;
        }
        return implode('<br><br>', $result);
    }

    private function readText(mixed ...$values): string
    {
        foreach ($values as $value) {
            if ((is_string($value) || is_numeric($value)) && trim((string) $value) !== '') {
                return trim((string) $value);
            }
        }
        return '';
    }

    private function readQuestionNumber(array $row): ?int
    {
        foreach (['numero_questao', 'numero', 'question_number', 'ordem'] as $key) {
            $number = (int) ($row[$key] ?? 0);
            if ($number > 0) {
                return $number;
            }
        }
        return null;
    }

    private function readPositiveInt(mixed $value): int
    {
        return max(0, (int) $value);
    }

    private function resolveDifficulty(mixed $value): string
    {
        $normalized = strtolower($this->slugify((string) $value));
        if ($normalized === '1' || str_contains($normalized, 'facil')) {
            return 'easy';
        }
        if ($normalized === '3' || str_contains($normalized, 'dificil')) {
            return 'hard';
        }
        return 'medium';
    }

    private function resolveQuestionType(array $alternatives, array $row): string
    {
        $raw = strtolower($this->cleanText($this->entityLabel(
            $row['tipo'] ?? $row['modalidade'] ?? $row['tipo_questao'] ?? ''
        )));
        $labels = array_map(
            fn (array $alternative): string => strtolower($this->cleanText($alternative['text'] ?? '')),
            $alternatives
        );
        if (
            str_contains($raw, 'certo')
            || str_contains($raw, 'errado')
            || (count($alternatives) === 2 && in_array('certo', $labels, true) && in_array('errado', $labels, true))
        ) {
            return 'true_false';
        }
        return 'single_choice';
    }

    private function reviewReasons(array $question, bool $contextHasAssets = false): array
    {
        $reasons = ['coleta_externa_requer_revisao'];
        if (trim((string) ($question['content']['statementClean'] ?? '')) === '') {
            $reasons[] = 'enunciado_ausente';
        }
        if (($question['alternatives'] ?? []) === []) {
            $reasons[] = 'alternativas_ausentes';
        }
        if (($question['answer']['correctAlternativeTempIds'] ?? []) === []) {
            $reasons[] = 'gabarito_ausente';
        }
        $hasAssets = ($question['assets'] ?? []) !== [] || $contextHasAssets;
        foreach (is_array($question['alternatives'] ?? null) ? $question['alternatives'] : [] as $alternative) {
            if (is_array($alternative) && ($alternative['assets'] ?? []) !== []) {
                $hasAssets = true;
                break;
            }
        }
        if ($hasAssets) {
            $reasons[] = 'asset_externo_requer_localizacao';
        }
        return $reasons;
    }

    private function findAlternativeLabel(array $alternatives, string $tempId): string
    {
        foreach ($alternatives as $alternative) {
            if (($alternative['tempId'] ?? null) === $tempId) {
                return (string) ($alternative['label'] ?? '');
            }
        }
        return '';
    }

    private function normalizeAccessToken(string $authorization): string
    {
        $authorization = trim($authorization);
        if (preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches) === 1) {
            return trim((string) $matches[1]);
        }
        return $authorization;
    }

    private function readJwtClaims(string $token): array
    {
        $parts = explode('.', $token);
        if (count($parts) < 2) {
            return [];
        }
        $payload = strtr($parts[1], '-_', '+/');
        $payload .= str_repeat('=', (4 - strlen($payload) % 4) % 4);
        $decoded = base64_decode($payload, true);
        $json = is_string($decoded) ? json_decode($decoded, true) : null;
        return is_array($json) ? $json : [];
    }

    private function slugify(string $value): string
    {
        $value = $this->cleanText($value);
        if (function_exists('iconv')) {
            $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
            if (is_string($converted)) {
                $value = $converted;
            }
        }
        $value = strtolower($value);
        $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
        return trim($value, '-');
    }

    private function safeIdPart(string $value): string
    {
        $value = $this->slugify($value);
        return $value !== '' ? $value : substr(hash('sha256', $value), 0, 16);
    }
}
