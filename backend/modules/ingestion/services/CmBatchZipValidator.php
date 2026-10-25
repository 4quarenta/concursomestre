<?php

declare(strict_types=1);

/**
 * Read-only validator for cm-batch.v1 archives. ZIP members are never extracted
 * to disk; hashes and binary signatures are checked while streams are read.
 */
final class CmBatchZipValidator
{
    private const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
    private const MAX_ENTRIES = 20000;
    private const MAX_EXPANDED_BYTES = 512 * 1024 * 1024;
    private const MAX_ENTRY_BYTES = 32 * 1024 * 1024;
    private const MAX_JSON_BYTES = 16 * 1024 * 1024;
    private const MAX_PATH_DEPTH = 12;

    public function validate(string $archivePath): array
    {
        if (!class_exists(ZipArchive::class)) {
            throw new RuntimeException('A extensao ZIP do PHP nao esta habilitada.');
        }
        if (!is_file($archivePath) || !is_readable($archivePath)) {
            throw new InvalidArgumentException('Arquivo ZIP inexistente ou sem permissao de leitura.');
        }
        $archiveBytes = filesize($archivePath);
        if (!is_int($archiveBytes) || $archiveBytes < 1 || $archiveBytes > self::MAX_ARCHIVE_BYTES) {
            throw new InvalidArgumentException('O ZIP deve ter entre 1 byte e 100 MB.');
        }

        $zip = new ZipArchive();
        if ($zip->open($archivePath, ZipArchive::RDONLY) !== true) {
            throw new InvalidArgumentException('Nao foi possivel abrir o arquivo como ZIP valido.');
        }

        try {
            return $this->validateArchive($zip, $archivePath, $archiveBytes);
        } finally {
            $zip->close();
        }
    }

    private function validateArchive(ZipArchive $zip, string $archivePath, int $archiveBytes): array
    {
        if ($zip->numFiles < 2 || $zip->numFiles > self::MAX_ENTRIES) {
            throw new InvalidArgumentException('Quantidade de arquivos fora do limite permitido.');
        }

        $manifestBytes = null;
        $declared = [];
        $entryNames = [];
        $totalExpandedBytes = 0;
        $mediaCount = 0;
        $fileInfo = new finfo(FILEINFO_MIME_TYPE);

        for ($index = 0; $index < $zip->numFiles; $index++) {
            $stat = $zip->statIndex($index);
            if (!is_array($stat)) {
                throw new InvalidArgumentException('O ZIP contem uma entrada que nao pode ser lida.');
            }
            $name = (string) ($stat['name'] ?? '');
            $normalizedName = $this->validateEntryName($name);
            if (isset($entryNames[$normalizedName])) {
                throw new InvalidArgumentException('O ZIP contem caminhos duplicados apos normalizacao: ' . $name);
            }
            $entryNames[$normalizedName] = true;

            $size = (int) ($stat['size'] ?? -1);
            $compressedSize = (int) ($stat['comp_size'] ?? -1);
            if ($size < 0 || $compressedSize < 0 || $size > self::MAX_ENTRY_BYTES) {
                throw new InvalidArgumentException('Tamanho de entrada ZIP invalido ou acima de 32 MB: ' . $name);
            }
            if ($size > 1024 * 1024 && $compressedSize > 0 && $size / $compressedSize > 500) {
                throw new InvalidArgumentException('A taxa de compressao da entrada e suspeita: ' . $name);
            }
            $totalExpandedBytes += $size;
            if ($totalExpandedBytes > self::MAX_EXPANDED_BYTES) {
                throw new InvalidArgumentException('O conteudo descompactado do ZIP excede 512 MB.');
            }

            $opsys = 0;
            $attributes = 0;
            if ($zip->getExternalAttributesIndex($index, $opsys, $attributes)
                && $opsys === ZipArchive::OPSYS_UNIX
                && (($attributes >> 16) & 0170000) === 0120000) {
                throw new InvalidArgumentException('Links simbolicos nao sao permitidos no ZIP: ' . $name);
            }

            $stream = $zip->getStream($name);
            if (!is_resource($stream)) {
                throw new InvalidArgumentException('Falha ao ler a entrada ZIP: ' . $name);
            }
            $hash = hash_init('sha256');
            $readBytes = 0;
            $prefix = '';
            $json = str_ends_with(strtolower($name), '.json') ? '' : null;
            try {
                while (!feof($stream)) {
                    $chunk = fread($stream, 65536);
                    if ($chunk === false) {
                        throw new InvalidArgumentException('Falha durante leitura do ZIP: ' . $name);
                    }
                    if ($chunk === '') {
                        continue;
                    }
                    $readBytes += strlen($chunk);
                    if ($readBytes > $size || $readBytes > self::MAX_ENTRY_BYTES) {
                        throw new InvalidArgumentException('Entrada ZIP expandiu alem do tamanho declarado: ' . $name);
                    }
                    hash_update($hash, $chunk);
                    if (strlen($prefix) < 8192) {
                        $prefix .= substr($chunk, 0, 8192 - strlen($prefix));
                    }
                    if (is_string($json)) {
                        if ($readBytes > self::MAX_JSON_BYTES) {
                            throw new InvalidArgumentException('Arquivo JSON acima de 16 MB: ' . $name);
                        }
                        $json .= $chunk;
                    }
                }
            } finally {
                fclose($stream);
            }
            if ($readBytes !== $size) {
                throw new InvalidArgumentException('Tamanho real difere do tamanho declarado no ZIP: ' . $name);
            }
            $sha256 = hash_final($hash);
            if ($name === 'manifest.json') {
                $manifestBytes = $json;
            } elseif (!is_string($json)) {
                $mediaCount++;
            }
            if (is_string($json)) $this->decodeJson($json, $name);
            unset($json);

            $actualMime = $prefix === '' ? 'application/x-empty' : (string) $fileInfo->buffer($prefix);
            if (!in_array($actualMime, ['application/json', 'text/plain', 'text/html', 'application/xml', 'text/xml'], true)
                && !$this->isSupportedBinaryMime($actualMime)) {
                throw new InvalidArgumentException('Tipo real de arquivo nao permitido no ZIP: ' . $name . ' (' . $actualMime . ').');
            }
            $declared[$normalizedName] = [
                'bytes' => $size,
                'sha256' => $sha256,
                'mimeType' => $actualMime,
                'compressedBytes' => $compressedSize,
            ];
        }

        if (!is_string($manifestBytes)) {
            throw new InvalidArgumentException('O arquivo manifest.json e obrigatorio na raiz do ZIP.');
        }
        $manifest = $this->decodeJson($manifestBytes, 'manifest.json');
        $this->assertManifest($manifest);

        $manifestFileMap = [];
        foreach ($manifest['files'] as $file) {
            $path = $this->validateEntryName((string) ($file['path'] ?? ''));
            if ($path === 'manifest.json' || isset($manifestFileMap[$path])) {
                throw new InvalidArgumentException('manifest.json possui caminho repetido ou referencia a si mesmo.');
            }
            $manifestFileMap[$path] = $file;
        }
        $actualPaths = array_keys($declared);
        $unmanifested = array_values(array_diff($actualPaths, array_merge(['manifest.json'], array_keys($manifestFileMap))));
        $missing = array_values(array_diff(array_keys($manifestFileMap), $actualPaths));
        if ($unmanifested !== [] || $missing !== []) {
            throw new InvalidArgumentException('Manifesto e ZIP divergem: existem arquivos nao declarados ou ausentes.');
        }

        foreach ($manifestFileMap as $path => $file) {
            $actual = $declared[$path];
            if ((int) ($file['bytes'] ?? -1) !== $actual['bytes']) {
                throw new InvalidArgumentException('Tamanho diverge do manifesto: ' . $path);
            }
            $expectedHash = strtolower((string) ($file['sha256'] ?? ''));
            if (!preg_match('/^[a-f0-9]{64}$/', $expectedHash) || !hash_equals($expectedHash, $actual['sha256'])) {
                throw new InvalidArgumentException('SHA-256 invalido ou divergente do manifesto: ' . $path);
            }
            $declaredMime = strtolower(trim((string) ($file['mimeType'] ?? '')));
            $jsonMime = str_ends_with(strtolower($path), '.json')
                && in_array($actual['mimeType'], ['application/json', 'text/plain'], true)
                && $declaredMime === 'application/json';
            if ($declaredMime !== '' && !$jsonMime && !$this->mimeMatches($declaredMime, $actual['mimeType'])) {
                throw new InvalidArgumentException('MIME declarado difere do conteudo: ' . $path);
            }
        }

        $warnings = [];
        $examSummary = [];
        $taxonomy = $this->decodeJson((string) $zip->getFromName('taxonomias-global.json'), 'taxonomias-global.json');
        if (($taxonomy['schemaVersion'] ?? null) !== 'cm-taxonomies.v1' || !is_array($taxonomy['taxonomies'] ?? null)) {
            throw new InvalidArgumentException('Contrato cm-taxonomies.v1 ausente ou invalido.');
        }
        foreach ($manifest['exams'] as $exam) {
            $externalKey = trim((string) ($exam['externalKey'] ?? ''));
            $base = $this->validateEntryName((string) ($exam['path'] ?? ''));
            if (!preg_match('/^[a-z0-9_-]+:[^\/]+$/i', $externalKey)) {
                throw new InvalidArgumentException('externalKey da prova invalida.');
            }
            $metadataPath = $base . '/metadados.json';
            $questionsPath = $base . '/questoes.json';
            $metadata = $this->decodeJson((string) $zip->getFromName($metadataPath), $metadataPath);
            $questionsDocument = $this->decodeJson((string) $zip->getFromName($questionsPath), $questionsPath);
            if (($metadata['schemaVersion'] ?? null) !== 'cm-exam-metadata.v1') {
                throw new InvalidArgumentException('Contrato cm-exam-metadata.v1 invalido em ' . $metadataPath);
            }
            if (($questionsDocument['schemaVersion'] ?? null) !== 'question-import.v2') {
                throw new InvalidArgumentException('Contrato question-import.v2 invalido em ' . $questionsPath);
            }
            foreach (['import', 'exam', 'contexts', 'questions'] as $requiredKey) {
                if (!array_key_exists($requiredKey, $questionsDocument)) {
                    throw new InvalidArgumentException('Campo obrigatorio ausente em ' . $questionsPath . ': ' . $requiredKey);
                }
            }
            if (!is_array($questionsDocument['questions']) || !is_array($questionsDocument['contexts'])) {
                throw new InvalidArgumentException('Questao/contexto deve ser lista em ' . $questionsPath);
            }
            $enrichmentPath=$base.'/enriquecimento.json';
            $enrichmentRaw=$zip->getFromName($enrichmentPath);
            if(is_string($enrichmentRaw)) {
                $enrichment=$this->decodeJson($enrichmentRaw,$enrichmentPath);
                if(($enrichment['schemaVersion']??null)!=='cm-question-enrichment.v1' || !is_array($enrichment['questionEnrichments']??null)) {
                    throw new InvalidArgumentException('Contrato cm-question-enrichment.v1 invalido em '.$enrichmentPath);
                }
                $knownQuestionIds=[];
                foreach($questionsDocument['questions'] as $question) if(is_array($question))$knownQuestionIds[(string)($question['tempId']??'')]=true;
                $enrichmentIds=[];
                foreach($enrichment['questionEnrichments'] as $entry) {
                    if(!is_array($entry))throw new InvalidArgumentException('Enriquecimento de questao invalido em '.$enrichmentPath);
                    $questionTempId=trim((string)($entry['questionTempId']??''));
                    if($questionTempId===''||!isset($knownQuestionIds[$questionTempId])||isset($enrichmentIds[$questionTempId])) {
                        throw new InvalidArgumentException('questionTempId de enriquecimento ausente, duplicado ou sem questao: '.$questionTempId);
                    }
                    if(isset($entry['examExternalKey']) && (string)$entry['examExternalKey']!==$externalKey) {
                        throw new InvalidArgumentException('examExternalKey de enriquecimento diverge em '.$enrichmentPath);
                    }
                    $enrichmentIds[$questionTempId]=true;
                    foreach(is_array($entry['sourceMappings']??null)?$entry['sourceMappings']:[] as $sourceMapping) {
                        if(!is_array($sourceMapping)||trim((string)($sourceMapping['provider']??''))===''||trim((string)($sourceMapping['externalId']??''))==='') {
                            throw new InvalidArgumentException('sourceMappings incompleto em '.$enrichmentPath.': '.$questionTempId);
                        }
                        if(mb_strlen((string)$sourceMapping['provider'])>80||mb_strlen((string)$sourceMapping['externalId'])>190) {
                            throw new InvalidArgumentException('Identidade de origem excede o limite em '.$enrichmentPath);
                        }
                    }
                }
            }
            $contextIds = [];
            foreach ($questionsDocument['contexts'] as $context) {
                if (!is_array($context)) throw new InvalidArgumentException('Contexto invalido em ' . $questionsPath);
                $contextId = trim((string) ($context['tempId'] ?? $context['id'] ?? ''));
                if ($contextId === '' || isset($contextIds[$contextId])) {
                    throw new InvalidArgumentException('tempId de contexto ausente ou duplicado em ' . $questionsPath);
                }
                $contextIds[$contextId] = true;
            }
            $questionCount = count($questionsDocument['questions']);
            $reviewCount = 0;
            $ids = [];
            $questionSamples = [];
            foreach ($questionsDocument['questions'] as $question) {
                if (!is_array($question)) {
                    throw new InvalidArgumentException('Item de questao invalido em ' . $questionsPath);
                }
                $tempId = trim((string) ($question['tempId'] ?? ''));
                if ($tempId === '' || isset($ids[$tempId])) {
                    throw new InvalidArgumentException('tempId ausente ou duplicado em ' . $questionsPath);
                }
                $ids[$tempId] = true;
                $source = is_array($question['source'] ?? null) ? $question['source'] : [];
                $contextId = trim((string) ($source['contextTempId'] ?? ''));
                if ($contextId !== '' && !isset($contextIds[$contextId])) {
                    throw new InvalidArgumentException('contextTempId sem correspondencia em ' . $questionsPath . ': ' . $contextId);
                }
                $alternatives = $question['alternatives'] ?? [];
                if (!is_array($alternatives)) throw new InvalidArgumentException('Alternativas invalidas em ' . $questionsPath . ': ' . $tempId);
                $alternativeIds = [];
                foreach ($alternatives as $alternative) {
                    if (!is_array($alternative)) throw new InvalidArgumentException('Alternativa invalida em ' . $questionsPath . ': ' . $tempId);
                    $alternativeId = trim((string) ($alternative['tempId'] ?? ''));
                    if ($alternativeId === '' || isset($alternativeIds[$alternativeId])) {
                        throw new InvalidArgumentException('tempId de alternativa ausente ou duplicado: ' . $tempId);
                    }
                    $alternativeIds[$alternativeId] = true;
                }
                $answer = is_array($question['answer'] ?? null) ? $question['answer'] : [];
                $correctIds = $answer['correctAlternativeTempIds'] ?? [];
                if (!is_array($correctIds)) throw new InvalidArgumentException('correctAlternativeTempIds invalido: ' . $tempId);
                foreach ($correctIds as $correctId) {
                    if (!is_string($correctId) || !isset($alternativeIds[$correctId])) {
                        throw new InvalidArgumentException('Gabarito aponta para alternativa inexistente: ' . $tempId);
                    }
                }
                $review = is_array($question['review'] ?? null) ? $question['review'] : [];
                if (($review['required'] ?? false) === true || ($review['status'] ?? '') !== 'approved') {
                    $reviewCount++;
                }
                if (count($questionSamples) < 5) {
                    $statement = (string) ($question['content']['statementClean'] ?? $question['content']['statement'] ?? '');
                    $statement = trim(html_entity_decode(strip_tags($statement), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                    $questionSamples[] = [
                        'tempId' => $tempId,
                        'questionNumber' => $question['source']['questionNumber'] ?? null,
                        'statement' => mb_substr($statement, 0, 260),
                        'type' => (string) ($question['type'] ?? ''),
                        'reviewStatus' => (string) ($review['status'] ?? 'pending'),
                        'answerStatus' => (string) (($question['answer']['status'] ?? '') ?: 'unverified'),
                    ];
                }
                $yearValues = $question['filters']['years'] ?? [];
                foreach (is_array($yearValues) ? $yearValues : [] as $year) {
                    $label = (int) (is_array($year) ? ($year['label'] ?? 0) : $year);
                    if ($label > 0 && $label !== (int) ($exam['correctYear'] ?? 0)) {
                        $warnings[] = [
                            'code' => 'question_year_differs_from_exam',
                            'examExternalKey' => $externalKey,
                            'questionTempId' => $tempId,
                            'questionYear' => $label,
                            'examCorrectYear' => (int) ($exam['correctYear'] ?? 0),
                        ];
                    }
                }
            }
            if ($questionCount !== (int) ($exam['expectedQuestions'] ?? -1)) {
                $warnings[] = ['code' => 'expected_question_count_mismatch', 'examExternalKey' => $externalKey,
                    'expected' => (int) ($exam['expectedQuestions'] ?? 0), 'actual' => $questionCount];
            }
            $documentYear = (int) ($questionsDocument['exam']['year'] ?? 0);
            if ($documentYear > 0 && $documentYear !== (int) ($exam['correctYear'] ?? 0)) {
                $warnings[] = ['code' => 'exam_year_differs_from_manifest', 'examExternalKey' => $externalKey,
                    'documentYear' => $documentYear, 'manifestCorrectYear' => (int) ($exam['correctYear'] ?? 0)];
            }
            $examSummary[] = [
                'externalKey' => $externalKey,
                'path' => $base,
                'correctYear' => (int) ($exam['correctYear'] ?? 0),
                'questionCount' => $questionCount,
                'expectedQuestions' => (int) ($exam['expectedQuestions'] ?? 0),
                'needsReview' => $reviewCount,
                'metadata' => $metadata['metadata'] ?? [],
                'provenance' => [
                    'source' => $metadata['source'] ?? [],
                    'identity' => $metadata['identity'] ?? [],
                    'questionImport' => $questionsDocument['import'] ?? [],
                ],
                'missingFields' => array_values(array_filter(
                    ['examTitle', 'bancaNome', 'ano', 'totalQuestoes', 'dataProva'],
                    static fn (string $field): bool => trim((string) ($metadata['metadata'][$field] ?? '')) === ''
                )),
                'questionSamples' => $questionSamples,
            ];
        }

        $validationReport = isset($declared['relatorio-validacao.json'])
            ? $this->decodeJson((string) $zip->getFromName('relatorio-validacao.json'), 'relatorio-validacao.json')
            : null;

        return [
            'valid' => true,
            'archiveSha256' => hash_file('sha256', $archivePath),
            'archiveBytes' => $archiveBytes,
            'batchId' => (string) $manifest['batchId'],
            'schemaVersion' => (string) $manifest['schemaVersion'],
            'datasetLabel' => (string) ($manifest['datasetLabel'] ?? ''),
            'yearsCovered' => array_values(array_map('intval', $manifest['yearsCovered'])),
            'entryCount' => $zip->numFiles,
            'expandedBytes' => $totalExpandedBytes,
            'mediaCount' => $mediaCount,
            'taxonomyCounts' => array_map(static fn ($items): int => is_array($items) ? count($items) : 0, $taxonomy['taxonomies']),
            'exams' => $examSummary,
            'questionCount' => array_sum(array_column($examSummary, 'questionCount')),
            'warningCount' => count($warnings),
            'warnings' => $warnings,
            'validationReport' => $validationReport,
        ];
    }

    private function assertManifest(array $manifest): void
    {
        if (($manifest['schemaVersion'] ?? null) !== 'cm-batch.v1') {
            throw new InvalidArgumentException('O ZIP precisa usar schemaVersion cm-batch.v1.');
        }
        foreach (['batchId', 'createdAt', 'datasetLabel', 'yearsCovered', 'sourceProviders', 'files', 'exams', 'validationSummary', 'generatorVersion'] as $key) {
            if (!array_key_exists($key, $manifest)) {
                throw new InvalidArgumentException('Campo obrigatorio ausente no manifesto: ' . $key);
            }
        }
        if (!is_array($manifest['files']) || !is_array($manifest['exams']) || !is_array($manifest['yearsCovered'])) {
            throw new InvalidArgumentException('Listas files, exams ou yearsCovered invalidas no manifesto.');
        }
        if (trim((string) $manifest['batchId']) === '' || strlen((string) $manifest['batchId']) > 190) {
            throw new InvalidArgumentException('batchId invalido.');
        }
    }

    private function validateEntryName(string $name): string
    {
        $normalized = str_replace('\\', '/', $name);
        if ($normalized === '' || str_starts_with($normalized, '/') || preg_match('/^[a-z]:/i', $normalized)) {
            throw new InvalidArgumentException('Caminho absoluto ou vazio nao permitido no ZIP.');
        }
        $segments = explode('/', $normalized);
        if (count($segments) > self::MAX_PATH_DEPTH) {
            throw new InvalidArgumentException('Profundidade de caminho ZIP excedida: ' . $name);
        }
        foreach ($segments as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..' || preg_match('/[\x00-\x1f\x7f]/', $segment)) {
                throw new InvalidArgumentException('Caminho inseguro no ZIP: ' . $name);
            }
        }
        return implode('/', $segments);
    }

    private function decodeJson(string $json, string $path): array
    {
        if ($json === '') {
            throw new InvalidArgumentException('Arquivo JSON obrigatorio ausente ou vazio: ' . $path);
        }
        try {
            $value = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new InvalidArgumentException('JSON invalido em ' . $path . ': ' . $error->getMessage(), 0, $error);
        }
        if (!is_array($value)) {
            throw new InvalidArgumentException('A raiz JSON deve ser objeto: ' . $path);
        }
        return $value;
    }

    private function isSupportedBinaryMime(string $mime): bool
    {
        if ($mime === 'image/svg+xml') {
            return false;
        }
        return str_starts_with($mime, 'image/')
            || in_array($mime, ['application/pdf', 'application/rtf', 'text/rtf', 'application/zip', 'application/octet-stream'], true);
    }

    private function mimeMatches(string $expected, string $actual): bool
    {
        if ($expected === $actual) {
            return true;
        }
        if (in_array($expected, ['image/jpg', 'image/pjpeg'], true) && $actual === 'image/jpeg') {
            return true;
        }
        return $expected === 'application/rtf' && in_array($actual, ['text/rtf', 'text/plain'], true);
    }
}
