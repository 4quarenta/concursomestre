<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/storage/ObjectStorage.php';

/**
 * Temporary, admin-only, resumable importer of cm-batch.v1 archives.
 * No archive entry is extracted to an executable/public directory.
 * Canonical QuestionsService remains the only question writer.
 */
final class CmZipImportService
{
    private const MAX_UPLOAD_BYTES = 157286400; // 150 MiB; PHP web server limits must agree.
    private const MAX_UNCOMPRESSED_BYTES = 805306368;
    private const MAX_ENTRIES = 12000;
    private const MAX_ENTRY_BYTES = 33554432;
    private const MAX_RATIO = 400;
    private const RUN_TTL = 172800;

    public function __construct(private readonly PDO $db, private readonly string $actor)
    {
        if ($actor === '') throw new RuntimeException('Administrador invalido.');
    }

    private function root(): string
    {
        // backend/storage/private_zip_import; backend .htaccess blocks access to archives.
        $path = dirname(__DIR__, 3) . '/storage/private_zip_import';
        if (!is_dir($path) && !mkdir($path, 0700, true) && !is_dir($path)) {
            throw new RuntimeException('Nao foi possivel criar o armazenamento privado.');
        }
        @chmod($path, 0700);
        $deny = $path . '/.htaccess';
        if (!is_file($deny)) file_put_contents($deny, "Require all denied\nDeny from all\n");
        return $path;
    }

    private function readJson(ZipArchive $zip, string $path, int $max = 12000000): array
    {
        $stat = $zip->statName($path);
        if ($stat === false || $stat['size'] > $max) throw new InvalidArgumentException('JSON ausente ou excessivo: ' . $path);
        $raw = $zip->getFromName($path);
        if (!is_string($raw)) throw new RuntimeException('Leitura do JSON falhou: ' . $path);
        $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($data)) throw new InvalidArgumentException('Estrutura JSON invalida: ' . $path);
        return $data;
    }

    private function validateZip(ZipArchive $zip): array
    {
        if ($zip->numFiles < 2 || $zip->numFiles > self::MAX_ENTRIES) {
            throw new InvalidArgumentException('Quantidade de arquivos ZIP fora do limite.');
        }
        $total = 0;
        $archivePaths=[];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $s = $zip->statIndex($i);
            if ($s === false) throw new InvalidArgumentException('Indice ZIP invalido.');
            $path = (string)$s['name'];
            if (isset($archivePaths[$path])) throw new InvalidArgumentException('Arquivo duplicado no ZIP.');
            $archivePaths[$path]=true;
            if ($path === '' || str_contains($path, "\0") || str_contains($path, '\\')
                || str_starts_with($path, '/') || preg_match('#(^|/)\.\.?(/|$)#', $path)
                || preg_match('/^[A-Za-z]:/', $path)) {
                throw new InvalidArgumentException('Caminho inseguro dentro do ZIP.');
            }
            if (!$zip->getExternalAttributesIndex($i, $zipOps, $attrs)) { $zipOps = 0; $attrs = 0; }
            $unixMode = ((int)$attrs >> 16) & 0170000;
            if ($unixMode === 0120000) throw new InvalidArgumentException('ZIP nao pode conter links simbolicos.');
            $size = (int)$s['size'];
            if ($size > self::MAX_ENTRY_BYTES) throw new InvalidArgumentException('Arquivo individual excede limite: ' . $path);
            $total += $size;
            if ($total > self::MAX_UNCOMPRESSED_BYTES) throw new InvalidArgumentException('ZIP descompactado excede limite.');
            if ($size > 1000000 && $size / max(1, (int)$s['comp_size']) > self::MAX_RATIO) {
                throw new InvalidArgumentException('Taxa de compressao suspeita.');
            }
        }
        $m = $this->readJson($zip, 'manifest.json', 2000000);
        if (($m['schemaVersion'] ?? '') !== 'cm-batch.v1') throw new InvalidArgumentException('O ZIP exige manifest cm-batch.v1.');
        if (empty($m['exams']) || !is_array($m['exams']) || count($m['exams']) > 2000) {
            throw new InvalidArgumentException('Manifesto sem lista valida de provas.');
        }
        $seen = [];
        $summaries = [];
        foreach ($m['exams'] as $exam) {
            $key = (string)($exam['externalKey'] ?? '');
            $prefix = (string)($exam['path'] ?? '');
            if (!preg_match('/^gran:[0-9]{1,12}$/', $key) || isset($seen[$key])
                || !preg_match('#^provas/(?:gran:)?[0-9]{1,12}$#', $prefix)) {
                throw new InvalidArgumentException('Identidade de prova invalida ou duplicada.');
            }
            $seen[$key] = true;
            $meta = $this->readJson($zip, $prefix . '/metadados.json');
            $q = $this->readJson($zip, $prefix . '/questoes.json');
            $questions = $q['questions'] ?? [];
            $actual = is_array($questions) ? count($questions) : -1;
            if ($actual < 0 || $actual !== (int)($exam['expectedQuestions'] ?? -1)
                || ($q['schemaVersion'] ?? '') !== 'question-import.v2') {
                throw new InvalidArgumentException('Quantidade/contrato de questoes divergente em ' . $key);
            }
            if (($meta['identity']['externalKey'] ?? '') !== $key || ($q['exam']['sourceKey'] ?? '') !== $key) {
                throw new InvalidArgumentException('Identidade conflitante nos arquivos de ' . $key);
            }
            $year = (int)($meta['identity']['canonicalYear'] ?? 0);
            if ($year < 1900 || $year > 2200 || $year !== (int)($exam['correctYear'] ?? 0)) {
                throw new InvalidArgumentException('Ano divergente na prova ' . $key);
            }
            $summaries[] = ['externalKey'=>$key,'path'=>$prefix,'year'=>$year,'questions'=>$actual,
                'title'=>(string)($meta['metadata']['examTitle'] ?? $q['exam']['title'] ?? '')];
        }
        $hashes = [];
        foreach (is_array($m['files'] ?? null) ? $m['files'] : [] as $f) {
            if (!is_array($f) || !isset($f['path'], $f['sha256'])) continue;
            $hashes[(string)$f['path']] = strtolower((string)$f['sha256']);
        }
        // Every archive entry (except the manifest itself) must have an integrity record.
        foreach (array_keys($archivePaths) as $path) {
            if ($path !== 'manifest.json' && !str_ends_with($path,'/') && !isset($hashes[$path])) {
                throw new InvalidArgumentException('Arquivo nao listado no manifesto: ' . $path);
            }
        }
        // Verify all manifest-listed members, not just JSON entrypoints.
        foreach ($hashes as $path => $expected) {
            if (!preg_match('/^[a-f0-9]{64}$/', $expected)) throw new InvalidArgumentException('SHA-256 invalido em ' . $path);
            $stream = $zip->getStream($path);
            if ($stream === false) throw new InvalidArgumentException('Arquivo ausente segundo manifesto: ' . $path);
            $h = hash_init('sha256');
            while (!feof($stream)) {
                $bytes = fread($stream, 65536);
                if ($bytes === false) { fclose($stream); throw new RuntimeException('Falha lendo arquivo.'); }
                hash_update($h, $bytes);
            }
            fclose($stream);
            if (!hash_equals($expected, hash_final($h))) throw new InvalidArgumentException('Checksum incorreto: ' . $path);
        }
        return ['batchId'=>(string)($m['batchId'] ?? ''),'exams'=>$summaries,'filesVerified'=>count($hashes)];
    }

    private function cleanupExpiredRuns(): void
    {
        $directory=$this->root();
        foreach (glob($directory.'/*.json') ?: [] as $path) {
            $stem=basename($path,'.json');
            if (!preg_match('/^[a-f0-9]{32}$/',$stem)) continue;
            $state=json_decode((string)@file_get_contents($path),true);
            if (is_array($state) && time()-(int)($state['createdAt']??0)<=self::RUN_TTL) continue;
            @unlink($directory.'/'.$stem.'.zip');
            @unlink($directory.'/'.$stem.'.lock');
            @unlink($path);
        }
    }

    public function upload(array $file): array
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file((string)($file['tmp_name'] ?? ''))) {
            throw new InvalidArgumentException('Upload ZIP invalido ou bloqueado pelo PHP.');
        }
        $this->cleanupExpiredRuns();
        $activeBytes=0;
        foreach (glob($this->root().'/*.zip') ?: [] as $existingArchive) $activeBytes+=(int)@filesize($existingArchive);
        $size = (int)($file['size'] ?? 0);
        if ($activeBytes+$size > 805306368) throw new RuntimeException('Limite de armazenamento privado temporario atingido.');
        if ($size < 100 || $size > self::MAX_UPLOAD_BYTES) throw new InvalidArgumentException('Tamanho ZIP fora do limite.');
        $tmp = (string)$file['tmp_name'];
        $zip = new ZipArchive();
        if ($zip->open($tmp, ZipArchive::RDONLY) !== true) throw new InvalidArgumentException('Arquivo ZIP nao reconhecido.');
        try { $meta = $this->validateZip($zip); } finally { $zip->close(); }
        $id = bin2hex(random_bytes(16));
        $dir = $this->root();
        $destination = $dir . '/' . $id . '.zip';
        if (!move_uploaded_file($tmp, $destination)) throw new RuntimeException('Nao foi possivel armazenar ZIP privado.');
        @chmod($destination, 0600);
        $run = ['id'=>$id, 'owner'=>$this->actor, 'createdAt'=>time(), 'archiveHash'=>hash_file('sha256',$destination),
            'meta'=>$meta,'results'=>[]];
        $this->writeState($run);
        return ['runId'=>$id,'inventory'=>$meta,'limitBytes'=>self::MAX_UPLOAD_BYTES];
    }

    private function statePath(string $id): string
    {
        if (!preg_match('/^[a-f0-9]{32}$/', $id)) throw new InvalidArgumentException('Execucao invalida.');
        return $this->root() . '/' . $id . '.json';
    }
    private function readState(string $id): array
    {
        $path = $this->statePath($id);
        $data = is_file($path) ? json_decode((string)file_get_contents($path), true) : null;
        if (!is_array($data) || ($data['owner'] ?? '') !== $this->actor || time()-(int)($data['createdAt'] ?? 0) > self::RUN_TTL) {
            throw new DomainException('Execucao nao encontrada, expirada ou sem permissao.');
        }
        return $data;
    }
    private function writeState(array $state): void
    {
        $path = $this->statePath((string)$state['id']);
        $tmp = $path . '.tmp.' . bin2hex(random_bytes(4));
        file_put_contents($tmp, json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), LOCK_EX);
        @chmod($tmp,0600);
        if (!rename($tmp,$path)) throw new RuntimeException('Falha ao registrar checkpoint.');
    }
    public function status(string $id): array
    {
        $state = $this->readState($id);
        return ['runId'=>$id,'inventory'=>$state['meta'],'previews'=>$state['previews']??[],'results'=>$state['results']];
    }

    private function archive(array $run): ZipArchive
    {
        $path = $this->root() . '/' . $run['id'] . '.zip';
        if (!is_file($path) || !hash_equals((string)$run['archiveHash'], (string)hash_file('sha256',$path))) {
            throw new RuntimeException('ZIP ausente ou alterado desde a validacao.');
        }
        $zip = new ZipArchive();
        if ($zip->open($path,ZipArchive::RDONLY) !== true) throw new RuntimeException('ZIP invalido.');
        return $zip;
    }

    private function programDetails(ZipArchive $zip, string $prefix, array $metadata): array
    {
        $existing = $metadata['conteudoProgramaticoDetalhado'] ?? [];
        if (is_array($existing) && $existing !== []) return $this->normalizePrograms($existing);
        $path = $prefix . '/enriquecimento_programatico_taxonomia.json';
        if ($zip->locateName($path) === false) return [];
        $document = $this->readJson($zip,$path);
        return $this->normalizePrograms($document['conteudoProgramaticoDetalhado'] ?? []);
    }
    private function normalizePrograms(mixed $raw): array
    {
        if (!is_array($raw)) return [];
        $out=[];$positions=[];
        foreach ($raw as $d) {
            if (!is_array($d)) continue;
            $name = trim((string)($d['disciplina'] ?? $d['materia'] ?? ''));
            if ($name === '') continue;
            $section=trim((string)($d['secao'] ?? $d['topico'] ?? ''));
            $key=strtolower($name.'|'.$section);
            if (!isset($positions[$key])) {
                $positions[$key]=count($out);
                $out[]=['disciplina'=>$name,'secao'=>$section,'temas'=>[]];
            }
            $idx=$positions[$key];$topics=[];
            foreach (is_array($d['temas'] ?? null) ? $d['temas'] : [] as $t) {
                if (is_array($t)) {
                    $val=trim((string)($t['assunto']??$t['rotulo_normalizado']??$t['nome']??$t['topico']??''));
                    if ($val!=='' && is_array($t['assuntos']??null)) foreach($t['assuntos'] as $a) { $a=trim((string)(is_array($a)?($a['nome']??$a['assunto']??''):$a));if($a!=='')$topics[]=$a; }
                    if ($val!=='') $topics[]=$val;
                } else { $val=trim((string)$t);if($val!=='')$topics[]=$val; }
            }
            // Legacy materia/topico/assunto rows are flat rather than nested.
            $legacy=$d['assunto']??$d['topico']??'';
            if (is_array($legacy)) foreach($legacy as $v) { $v=trim((string)(is_array($v)?($v['nome']??$v['assunto']??''):$v));if($v!=='')$topics[]=$v; }
            elseif (trim((string)$legacy)!=='') $topics[]=trim((string)$legacy);
            $out[$idx]['temas']=array_values(array_unique(array_merge($out[$idx]['temas'],$topics)));
        }
        return $out;
    }

    /** Read-only database inventory. The only write is the private resumable preview state, never SQL. */
    public function preview(string $id, string $externalKey): array
    {
        $state=$this->readState($id);$selected=null;
        foreach($state['meta']['exams'] as $exam) if(($exam['externalKey']??'')===$externalKey)$selected=$exam;
        if(!$selected)throw new InvalidArgumentException('Prova fora do inventario validado.');
        $zip=$this->archive($state);
        try {
            $prefix=(string)$selected['path'];$meta=$this->readJson($zip,$prefix.'/metadados.json');
            $payload=$this->readJson($zip,$prefix.'/questoes.json');
            $externalId=substr($externalKey,5);$ids=[];
            foreach(($payload['questions']??[]) as $q) {
                $src=$q['source']??[];$qid=(string)($src['externalQuestionId']??$src['externalId']??$q['id']??'');
                if($qid==='')throw new InvalidArgumentException('Questao sem identidade externa.');$ids[$qid]=true;
            }
            if(count($ids)!==(int)$selected['questions'])throw new InvalidArgumentException('Identidades de questoes duplicadas ou quantidade divergente.');
            $proof=$this->db->prepare('SELECT id,ano,metadata_json FROM provas WHERE source_provider=:provider AND source_external_id=:external_id ORDER BY id LIMIT 2');
            $proof->execute([':provider'=>'gran',':external_id'=>$externalId]);$proofRows=$proof->fetchAll(PDO::FETCH_ASSOC);$row=$proofRows[0]??null;
            $existing=[];$duplicateQuestionIds=[];foreach(array_chunk(array_keys($ids),200) as $chunk){$qs=implode(',',array_fill(0,count($chunk),'?'));$st=$this->db->prepare("SELECT source_external_id,COUNT(*) AS n FROM questions WHERE source_provider='gran' AND source_external_id IN ({$qs}) GROUP BY source_external_id");$st->execute($chunk);foreach($st->fetchAll(PDO::FETCH_ASSOC) as $found){$qid=(string)$found['source_external_id'];$existing[$qid]=true;if((int)$found['n']>1)$duplicateQuestionIds[]=$qid;}}
            $program=$this->programDetails($zip,$prefix,$meta);
            $docs=$meta['documents']??[];$maps=$zip->locateName($prefix.'/asset-mappings.json')===false?[]:$this->readJson($zip,$prefix.'/asset-mappings.json');
            $missing=count($ids)-count($existing);$proofYear=$row?(int)$row['ano']:null;
            $blocked=count($proofRows)>1||count($duplicateQuestionIds)>0||($row && $proofYear!==(int)$selected['year'])||(!$row&&$missing===0);
            $oldMeta=$row?json_decode((string)($row['metadata_json']??'{}'),true):[];if(!is_array($oldMeta))$oldMeta=[];
            $result=['status'=>$blocked?'blocked':'ready','externalKey'=>$externalKey,'title'=>$selected['title'],'year'=>$selected['year'],
                'expectedQuestions'=>count($ids),'existingQuestions'=>count($existing),'missingQuestions'=>$missing,'examExists'=>(bool)$row,
                'existingExamYear'=>$proofYear,'duplicateExamRecords'=>max(0,count($proofRows)-1),'duplicateQuestionIds'=>$duplicateQuestionIds,
                'programDisciplines'=>count($program),'programThemes'=>array_sum(array_map(fn($d)=>count($d['temas']),$program)),
                'documentEntries'=>is_array($docs)?count($docs):0,'assetEntries'=>count($maps['assets']??[]),
                'existingMetadataKeys'=>count(array_filter($oldMeta,fn($v)=>$v!==null&&$v!==''&&$v!==[])),
                'questionIdsHash'=>hash('sha256',implode("\n",array_keys($ids))),
                'message'=>$blocked?(count($proofRows)>1?'Mais de um registro de prova usa esta identidade externa.':(count($duplicateQuestionIds)>0?'Há IDs externos de questão duplicados no banco.':($row?'Ano da prova existente diverge do manifesto.':'Prova ausente e todas as questões já existem; não é seguro criar a prova por este fluxo.'))):
                    ($missing?'Há questões ausentes. Processar exige confirmação explícita de publicação.':'Todas as questões do ZIP já existem; nenhuma questão será enviada ao importador canônico.')];
            $state['previews'][$externalKey]=$result;
            $this->writeState($state);
            return $result;
        } finally {$zip->close();}
    }

    private function assertFreshPreview(array $state, string $externalKey, bool $allowPublicUnverified): array
    {
        $preview=$state['previews'][$externalKey]??null;
        if(!is_array($preview)||($preview['status']??'')!=='ready')throw new DomainException('Gere uma prévia sem gravação para esta prova antes de processar.');
        $fresh=$this->preview((string)$state['id'],$externalKey);
        foreach(['status','existingQuestions','missingQuestions','examExists','existingExamYear','questionIdsHash'] as $key) if(($fresh[$key]??null)!==($preview[$key]??null))throw new DomainException('Os dados mudaram desde a prévia. Gere uma nova prévia antes de processar.');
        if(($fresh['missingQuestions']??0)>0&&!$allowPublicUnverified)throw new DomainException('A prévia identificou questões ausentes; marque a confirmação expressa para permitir a publicação pelo serviço canônico.');
        return $fresh;
    }

    /** Metadata is additive, never overwrites a nonempty existing value. */
    private function mergeExistingMetadata(array $existing, array $incoming): array
    {
        foreach ($incoming as $k=>$v) {
            if (!array_key_exists($k,$existing) || $existing[$k] === null || $existing[$k] === '' || $existing[$k] === []) {
                $existing[$k]=$v;
            }
        }
        return $existing;
    }

    private function syncMetadata(string $externalId, array $meta, array $program, array $source, array $programEvidence, array $documentEvidence): array
    {
        $stmt = $this->db->prepare('SELECT id,ano,metadata_json,data_prova,inscricoes_inicio,inscricoes_fim FROM provas WHERE source_provider = :provider AND source_external_id = :external_id LIMIT 1 FOR UPDATE');
        $stmt->execute([':provider'=>'gran',':external_id'=>$externalId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new RuntimeException('A prova nao foi localizada apos a importacao canonica.');
        $old = json_decode((string)($row['metadata_json'] ?? '{}'), true);
        if (!is_array($old)) $old=[];
        $programFlat=[];
        foreach ($program as $d) foreach ($d['temas'] as $theme) {
            $programFlat[]=['materia'=>$d['disciplina'],'topico'=>$theme,'assunto'=>'','secao'=>$d['secao']];
        }
        $incoming = [
            'conteudoProgramatico'=>array_values(array_unique(array_column($program,'disciplina'))),
            'programmaticContent'=>array_values(array_unique(array_column($program,'disciplina'))),
            'conteudoProgramaticoDetalhado'=>$program,
            'programmaticContentDetailed'=>$programFlat,
            'programmaticContentStatus'=>(string)($programEvidence['status_extracao'] ?? 'edital_nao_localizado'),
            'programmaticContentFonte'=>$programEvidence['fonte_programa'] ?? null,
            'programmaticContentIntegralVerificado'=>false,
            'valorInscricao'=>$meta['metadata']['valorInscricao'] ?? null,
            'nivel'=>$meta['metadata']['nivel'] ?? null,
            'tipoCaderno'=>$meta['metadata']['tipoCaderno'] ?? null,
            'corCaderno'=>$meta['metadata']['corCaderno'] ?? null,
            'orgaos'=>$meta['metadata']['orgaos'] ?? [],
            'cargos'=>$meta['metadata']['cargos'] ?? [],
            'focos'=>$meta['metadata']['focos'] ?? [],
            'requisitosDetalhados'=>$meta['requisitosDetalhados'] ?? [],
            'remuneracoesDetalhadas'=>$meta['remuneracoesDetalhadas'] ?? [],
            'vagasDetalhadas'=>$meta['vagasDetalhadas'] ?? [],
            'etapas'=>$meta['etapas'] ?? [],
            'zipProgramEvidence'=>$programEvidence,
            'zipSource'=>[
                'documentEvidence'=>$documentEvidence,
                'source'=>$source, 'identity'=>$meta['identity'] ?? [],
                'rawExamMetadata'=>$meta['metadata'] ?? [],
                'documents'=>$meta['documents'] ?? [], 'review'=>$meta['review'] ?? [],
                'evidence'=>$meta['evidence'] ?? [], 'historicalChanges'=>$meta['historicalChanges'] ?? [],
            ],
        ];
        $combined = $this->mergeExistingMetadata($old,$incoming);
        $original=$meta['metadata']??[];
        $dateFields=[
            'data_prova'=>$original['dataProva']??null,
            'inscricoes_inicio'=>$original['dataInscricaoInicio']??null,
            'inscricoes_fim'=>$original['dataInscricaoFim']??null,
        ];
        foreach ($dateFields as $field=>$date) {
            if (!is_string($date) || !preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/',$date)) $dateFields[$field]=null;
        }
        $update=$this->db->prepare('UPDATE provas SET metadata_json=:metadata, data_prova=COALESCE(data_prova,:exam_date), inscricoes_inicio=COALESCE(inscricoes_inicio,:start_date), inscricoes_fim=COALESCE(inscricoes_fim,:end_date) WHERE id=:id');
        $update->execute([
            ':metadata'=>json_encode($combined,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),
            ':id'=>$row['id'],':exam_date'=>$dateFields['data_prova'],
            ':start_date'=>$dateFields['inscricoes_inicio'],':end_date'=>$dateFields['inscricoes_fim'],
        ]);
        return ['id'=>(int)$row['id'], 'year'=>(int)$row['ano'], 'programDisciplines'=>count($program), 'programThemes'=>array_sum(array_map(fn($d)=>count($d['temas']),$program))];
    }

    /** Resolve/create canonical matter/topic and link to the exam's booklet; existing links stay intact. */
    private function linkProgram(array $exam, array $program): array
    {
        if ($program === []) return ['linked'=>0,'created'=>0];
        $eid = (int)$exam['id'];
        $find=$this->db->prepare('SELECT id FROM prova_cadernos WHERE prova_id=:p ORDER BY ordem,id LIMIT 1');
        $find->execute([':p'=>$eid]);
        $bookletId=(int)$find->fetchColumn();
        if (!$bookletId) {
            $this->db->prepare('INSERT INTO prova_cadernos (prova_id,nome,ordem,metadata_json) VALUES (:p,:n,1,:j)')->execute([
                ':p'=>$eid,':n'=>'Caderno original',':j'=>json_encode(['origin'=>'zip-import'])]);
            $bookletId=(int)$this->db->lastInsertId();
        }
        $created=0; $linked=0;
        $link=$this->db->prepare('INSERT IGNORE INTO prova_caderno_filters (caderno_id,filter_id,role,ordem) VALUES (:c,:f,"assunto",:o)');
        foreach ($program as $i=>$d) {
            $matter=$this->findOrCreateFilter('materia',$d['disciplina'],null,$created);
            $link->execute([':c'=>$bookletId,':f'=>$matter,':o'=>$i+1]); $linked += $link->rowCount();
            foreach ($d['temas'] as $j=>$name) {
                $topic=$this->findOrCreateFilter('topico',$name,$matter,$created);
                $link->execute([':c'=>$bookletId,':f'=>$topic,':o'=>1000+$i*100+$j+1]); $linked += $link->rowCount();
            }
        }
        return ['linked'=>$linked,'created'=>$created];
    }
    private function findOrCreateFilter(string $level, string $name, ?int $parent, int &$created): int
    {
        $type='assunto';
        $slug = 'cm-zip-' . ($level==='materia'?'m':'t') . '-' . substr(hash('sha256',($parent??'root').'|'.$name),0,28);
        // Prefer exact existing canonical name ONLY for root matter and direct-child topic.
        $sql = $level==='materia'
            ? "SELECT id FROM filters WHERE type='assunto' AND name=:n AND (taxonomy_level='materia' OR meta_materia=1) LIMIT 2"
            : "SELECT id FROM filters WHERE type='assunto' AND name=:n AND parent_id=:p AND taxonomy_level='topico' LIMIT 2";
        $q=$this->db->prepare($sql);
        $args=$level==='materia'?[':n'=>$name]:[':n'=>$name,':p'=>$parent];
        $q->execute($args); $ids=$q->fetchAll(PDO::FETCH_COLUMN);
        if (count($ids)===1) return (int)$ids[0];
        $existing=$this->db->prepare('SELECT id FROM filters WHERE type="assunto" AND slug=:s LIMIT 1');
        $existing->execute([':s'=>$slug]);$id=(int)$existing->fetchColumn(); if ($id) return $id;
        $insert=$this->db->prepare('INSERT INTO filters (type,name,slug,parent_id,description,keywords_json,taxonomy_level,meta_materia) VALUES ("assunto",:n,:s,:p,:d,:k,:l,:m)');
        $insert->execute([':n'=>$name,':s'=>$slug,':p'=>$parent,':d'=>'Taxonomia provisoria extraida de pacote ZIP; revisar hierarquia. ',':k'=>json_encode([$name],JSON_UNESCAPED_UNICODE),':l'=>$level,':m'=>$level==='materia'?1:0]);
        $created++;
        return (int)$this->db->lastInsertId();
    }

    private function storeArchiveAssets(ZipArchive $zip, string $prefix, array $questions, array $maps, string $externalId): array
    {
        $replacements=[]; $stored=0; $missing=[];
        $mimeByExt=['gif'=>'image/gif','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','webp'=>'image/webp'];
        foreach ($maps['assets'] ?? [] as $a) {
            if (!is_array($a)) continue;
            $local=ltrim((string)($a['localPath'] ?? ''),'/');
            if ($local==='' || str_contains($local,'..') || str_contains($local,'\\')) continue;
            $full=$prefix.'/'.$local;
            $info=$zip->statName($full);
            if (!$info || (int)$info['size']>10000000) { $missing[]=$local; continue; }
            $ext=strtolower(pathinfo($local,PATHINFO_EXTENSION));
            if (!isset($mimeByExt[$ext])) continue;
            $bytes=$zip->getFromName($full);
            if (!is_string($bytes) || !getimagesizefromstring($bytes)) { $missing[]=$local;continue; }
            $sha=hash('sha256',$bytes);
            if (isset($a['sha256']) && $a['sha256']!==$sha) { $missing[]=$local;continue; }
            $file=(new ObjectStorage())->storeBytes($bytes,"questions/import-gran/{$externalId}/{$sha}.{$ext}",$mimeByExt[$ext]);
            $stored++;
            foreach (['originalUrl','original_url','localPath'] as $field) {
                if (isset($a[$field]) && is_string($a[$field]) && $a[$field]!=='') {
                    $replacements[$a[$field]]=$file['url'];
                }
            }
        }
        if ($replacements) {
            foreach ($questions as &$q) {
                $raw=json_encode($q,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
                foreach ($replacements as $old=>$new) $raw=str_replace($old,$new,$raw);
                $q=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
            }
            unset($q);
        }
        return [$questions,['stored'=>$stored,'missing'=>$missing,'urls'=>$replacements,'sourceQuestions'=>$questions]];
    }

    /** Store supplied source-enrichment evidence without overwriting the existing question JSON. */
    private function persistEnrichment(ZipArchive $zip, string $prefix): array
    {
        $path=$prefix.'/enriquecimento.json';
        if ($zip->locateName($path)===false) return ['saved'=>0,'skipped'=>0];
        $dataset=$this->readJson($zip,$path,16000000);
        $saved=0;$skipped=0;
        foreach (($dataset['questionEnrichments'] ?? []) as $item) {
            if (!is_array($item)) continue;
            $ids=[];
            foreach (($item['sourceMappings']??[]) as $source) {
                if (($source['provider']??'')==='gran' && isset($source['externalId'])) $ids[]=(string)$source['externalId'];
            }
            if (!$ids) {$skipped++;continue;}
            $q=$this->db->prepare('SELECT id, data_json FROM questions WHERE source_provider="gran" AND source_external_id=:external LIMIT 1');
            $q->execute([':external'=>$ids[0]]);
            $row=$q->fetch(PDO::FETCH_ASSOC);
            if (!$row) {$skipped++;continue;}
            $existing=(string)($row['data_json']??'');
            $json=$existing!==''?json_decode($existing,true):[];
            if (!is_array($json)) {$skipped++;continue;} // Never destroy legacy JSON.
            if (isset($json['cmZipEnrichment'])) continue;
            $json['cmZipEnrichment']=$item;
            $stmt=$this->db->prepare('UPDATE questions SET data_json=:json WHERE id=:id');
            $stmt->execute([':json'=>json_encode($json,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),':id'=>$row['id']]);
            $saved++;
        }
        return ['saved'=>$saved,'skipped'=>$skipped];
    }

    private function persistCanonicalAssetLinks(array $assetMap, array $uploaded): array
    {
        $linked=0;$skipped=0;
        $questionMap=[];
        foreach (($assetMap['assets']??[]) as $a) {
            if (!is_array($a)) continue;
            $temp=(string)($a['questionTempId']??'');
            if ($temp==='') continue;
            $questionMap[$temp][]=$a;
        }
        foreach ($uploaded['sourceQuestions'] as $q) {
            $temp=(string)($q['tempId']??'');
            $src=$q['source']??[];
            $sid=(string)($src['externalQuestionId']??$src['externalId']??$q['id']??'');
            if (!$sid || !isset($questionMap[$temp])) continue;
            $stmt=$this->db->prepare('SELECT id FROM questions WHERE source_provider="gran" AND source_external_id=:s LIMIT 1');
            $stmt->execute([':s'=>$sid]);$id=(int)$stmt->fetchColumn();
            if ($id<=0) {$skipped+=count($questionMap[$temp]);continue;}
            foreach ($questionMap[$temp] as $a) {
                $srcUrl=(string)($a['originalUrl']??'');
                $public=(string)($uploaded['urls'][$srcUrl]??'');
                if ($public==='') {$skipped++;continue;}
                $key='cmzip-'.substr(hash('sha256',$sid.'|'.(string)($a['sha256']??$srcUrl)),0,44);
                $lookup=$this->db->prepare('SELECT id FROM question_assets WHERE question_id=:id AND (external_key=:k OR public_url=:url) LIMIT 1');
                $lookup->execute([':id'=>$id,':k'=>$key,':url'=>$public]);
                if ($lookup->fetchColumn()) continue;
                $scope=(string)($a['scope']??'statement');
                $optionId=null;
                $usage='statement';
                if (preg_match('/^alternative:([A-Z])$/', $scope, $match)) {
                    $lookupOption=$this->db->prepare('SELECT id FROM question_options WHERE question_id=:q AND label=:label LIMIT 1');
                    $lookupOption->execute([':q'=>$id,':label'=>$match[1]]);
                    $optionId=$lookupOption->fetchColumn();
                    if (!$optionId) { $skipped++;continue; }
                    $usage='option';
                }
                $this->db->prepare('INSERT INTO question_assets (question_id, option_id, external_key, asset_type, usage_type, public_url, alt_text, metadata_json) VALUES (:q,:o,:k,"image",:scope,:url,:alt,:meta)')->execute([
                    ':q'=>$id,':o'=>$optionId?:null,':k'=>$key,':scope'=>$usage,
                    ':url'=>$public,':alt'=>'Imagem da questao original',
                    ':meta'=>json_encode(['source'=>'cm-zip','originalUrl'=>$srcUrl,'sha256'=>$a['sha256']??null,'scope'=>$scope],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
                ]);
                $linked++;
            }
        }
        return ['linked'=>$linked,'skipped'=>$skipped];
    }

    private function storeDocuments(ZipArchive $zip, string $prefix, array $exam, array $metadata, string $externalId): array
    {
        $stored=0;$skipped=0;
        foreach (($metadata['documents']??[]) as $d) {
            if (!is_array($d)) continue;
            $path=(string)($d['path']??'');
            if (!str_starts_with($path,$prefix.'/') || str_contains($path,'..')) {$skipped++;continue;}
            $s=$zip->statName($path);
            if (!$s || (int)$s['size']>30000000 || !str_ends_with(strtolower($path),'.pdf')) {$skipped++;continue;}
            $bytes=$zip->getFromName($path);
            if (!is_string($bytes) || !str_starts_with($bytes,'%PDF-')) {$skipped++;continue;}
            $sha=hash('sha256',$bytes);
            if (!empty($d['sha256']) && !hash_equals((string)$d['sha256'],$sha)) {$skipped++;continue;}
            $url=(new ObjectStorage())->storeBytes($bytes,"exams/import-gran/{$externalId}/{$sha}.pdf",'application/pdf')['url'];
            $exists=$this->db->prepare('SELECT id FROM prova_arquivos WHERE prova_id=:p AND caminho=:url LIMIT 1');
            $exists->execute([':p'=>$exam['id'],':url'=>$url]);if ($exists->fetchColumn()) continue;
            $kind=(string)($d['kind']??'');
            $classified=in_array($kind,['prova','gabarito','edital'],true) && ($d['verifiedContentType']??false)===true;
            if (!$classified) $kind='outro';
            $visibility=$classified?'public':'internal';
            $stmt=$this->db->prepare('SELECT COALESCE(MAX(versao),0)+1 FROM prova_arquivos WHERE prova_id=:p AND tipo=:k');
            $stmt->execute([':p'=>$exam['id'],':k'=>$kind]);$version=(int)$stmt->fetchColumn();
            $insert=$this->db->prepare('INSERT INTO prova_arquivos (prova_id,tipo,nome_original,caminho,mime_type,tamanho,versao,visibility_status,uploaded_by_user_id,metadata_json) VALUES (:p,:k,:n,:url,"application/pdf",:size,:v,:visibility,:admin,:meta)');
            $insert->execute([':p'=>$exam['id'],':k'=>$kind,':n'=>(string)($d['fileName']??basename($path)),':url'=>$url,':size'=>strlen($bytes),':v'=>$version,':visibility'=>$visibility,':admin'=>$this->actor,':meta'=>json_encode(['source'=>'zip_import','sha256'=>$sha,'original'=>$d],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
            $stored++;
        }
        return ['stored'=>$stored,'skipped'=>$skipped];
    }

    public function process(string $id, string $externalKey, bool $allowPublicUnverified): array
    {
        $state=$this->readState($id);
        $selected=null;
        foreach ($state['meta']['exams'] as $e) if ($e['externalKey']===$externalKey) $selected=$e;
        if (!$selected) throw new InvalidArgumentException('Prova fora do inventario validado.');
        if (isset($state['results'][$externalKey]) && ($state['results'][$externalKey]['status'] ?? '')==='done') return $state['results'][$externalKey];
        $lock=fopen($this->root().'/'.$id.'.lock','c');
        if (!$lock || !flock($lock,LOCK_EX|LOCK_NB)) throw new RuntimeException('Outra importacao deste lote esta em andamento.');
        try {
            $state=$this->readState($id);
            if (isset($state['results'][$externalKey]) && ($state['results'][$externalKey]['status'] ?? '')==='done') return $state['results'][$externalKey];
            $this->assertFreshPreview($state,$externalKey,$allowPublicUnverified);
            $zip=$this->archive($state);
            try {
                $prefix=$selected['path'];
                $meta=$this->readJson($zip,$prefix.'/metadados.json');
                $payload=$this->readJson($zip,$prefix.'/questoes.json');
                $extra=$zip->locateName($prefix.'/enriquecimento_programatico_taxonomia.json')===false?[]:$this->readJson($zip,$prefix.'/enriquecimento_programatico_taxonomia.json');
                $maps=$zip->locateName($prefix.'/asset-mappings.json')===false?[]:$this->readJson($zip,$prefix.'/asset-mappings.json');
                $evidence=$zip->locateName($prefix.'/evidencias.json')===false?[]:$this->readJson($zip,$prefix.'/evidencias.json');
                $program=$this->programDetails($zip,$prefix,$meta);
                $externalId=substr($externalKey,5);
                $check=$this->db->prepare('SELECT id,ano FROM provas WHERE source_provider="gran" AND source_external_id=:e LIMIT 1');
                $check->execute([':e'=>$externalId]);$prior=$check->fetch(PDO::FETCH_ASSOC)?:null;
                if ($prior && (int)$prior['ano'] !== (int)$selected['year']) throw new RuntimeException('Ano existente diverge do manifesto; revisar antes de aplicar.');
                $questionIds=[];
                foreach ($payload['questions'] as $q) {
                    $source=$q['source']??[];
                    $sid=(string)($source['externalQuestionId']??$source['externalId']??$q['id']??'');
                    if ($sid==='') throw new InvalidArgumentException('Questao sem identidade externa.');
                    $questionIds[$sid]=true;
                }
                if (count($questionIds)!==count($payload['questions'])) throw new InvalidArgumentException('Identidades de questoes duplicadas neste caderno.');
                $existing=[];
                $ids=array_keys($questionIds);
                foreach (array_chunk($ids,200) as $chunk) {
                    $placeholders=implode(',',array_fill(0,count($chunk),'?'));
                    $stmt=$this->db->prepare("SELECT source_external_id FROM questions WHERE source_provider='gran' AND source_external_id IN ({$placeholders})");
                    $stmt->execute($chunk);
                    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $v) $existing[(string)$v]=true;
                }
                $allSourceQuestions=$payload['questions'];
                $missing=[];
                foreach ($payload['questions'] as $q) {
                    $src=$q['source']??[];$sid=(string)($src['externalQuestionId']??$src['externalId']??$q['id']??'');
                    if (!isset($existing[$sid])) $missing[]=$q;
                }
                $importResult=['created'=>0,'duplicatesSkipped'=>0,'itemFailures'=>[]];
                $assetResult=['stored'=>0,'missing'=>[],'urls'=>[],'sourceQuestions'=>$allSourceQuestions];
                if (!$missing || $allowPublicUnverified) {
                    [$withUrls,$assetResult]=$this->storeArchiveAssets($zip,$prefix,$allSourceQuestions,$maps,$externalId);
                    $missingById=[];
                    foreach ($withUrls as $item) {
                        $sid=(string)(($item['source']??[])['externalQuestionId']??($item['source']??[])['externalId']??$item['id']??'');
                        if (!isset($existing[$sid])) $missingById[]=$item;
                    }
                    $missing=$missingById;
                }
                if ($missing) {
                    if (!$allowPublicUnverified) throw new DomainException('O backend canonico publica questoes. Confirme expressamente a publicacao dos itens novos, incluindo gabaritos nao verificados.');
                    $payload['questions']=$missing;
                    $payload['exam']['provider']='gran';
                    $payload['exam']['externalId']=$externalId;
                    $payload['exam']['year']=(int)$selected['year'];
                    $payload['import']['sourceType']='gran';
                    $payload['import']['sourceProvider']='gran';
                    // Reuse the actual canonical writer. It manages question children and identities.
                    require_once dirname(__DIR__,3).'/modules/questions/routes.php';
                    $importResult=buildQuestionsController($this->db)->bulkImportQuestionBatches($this->actor,true,[
                        'schemaVersion'=>'question-import.v2','batches'=>[['clientKey'=>$externalKey,'payload'=>$payload]]
                    ]);
                    $failures=$importResult['itemFailures']??$importResult['item_failures']??[];
                    if ($failures) throw new RuntimeException('Importacao canonica retornou pendencias: '.count($failures));
                }
                // Empty metadata-only exam: create a draft record, without exposing questions.
                if (!$prior && !$missing) throw new RuntimeException('Prova sem registros existentes e sem questoes novas.');
                $this->db->beginTransaction();
                try {
                    $exam=$this->syncMetadata($externalId,$meta,$program,$meta['source']??[],$extra,$evidence);
                    $linked=$this->linkProgram($exam,$program);
                    $enrichment=$this->persistEnrichment($zip,$prefix);
                    $assetLinks=$this->persistCanonicalAssetLinks($maps,$assetResult);
                    $documents=$this->storeDocuments($zip,$prefix,$exam,$meta,$externalId);
                    $this->db->commit();
                } catch(Throwable $e) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $e; }
                $result=['status'=>'done','externalKey'=>$externalKey,'exam'=>$exam,'links'=>$linked,
                    'existingQuestions'=>count($existing),'sentToCanonical'=>count($missing),
                    'canonicalResult'=>$importResult,
                    'enrichment'=>$enrichment,'assetLinks'=>$assetLinks,'documents'=>$documents,
                    'assets'=>['stored'=>$assetResult['stored'],'missing'=>$assetResult['missing']],
                    'warnings'=>array_values(array_filter([
                        count($program)===0?'Programa nao localizado: pendencia documental':null,
                        !empty($assetResult['missing'])?'Imagens nao encontradas no pacote':null,
                        'Gabaritos e comentarios nao foram automaticamente homologados',
                    ]))];
            } finally { $zip->close(); }
            $state['results'][$externalKey]=$result;
            $this->writeState($state);
            return $result;
        } catch(Throwable $e) {
            $state=$this->readState($id);
            $state['results'][$externalKey]=['status'=>'error','externalKey'=>$externalKey,'message'=>$e->getMessage()];
            $this->writeState($state);
            throw $e;
        } finally {flock($lock,LOCK_UN);fclose($lock);}
    }
}
