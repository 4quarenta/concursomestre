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

    private function metadataHasValue(mixed $value): bool
    {
        return $value !== null && $value !== '' && $value !== [];
    }

    private function incomingExamMetadata(array $meta, array $program, array $source, array $programEvidence, array $documentEvidence): array
    {
        $flat=[];
        foreach ($program as $discipline) foreach ($discipline['temas'] as $theme) {
            $flat[]=['materia'=>$discipline['disciplina'],'topico'=>$theme,'assunto'=>'','secao'=>$discipline['secao']];
        }
        return [
            'conteudoProgramatico'=>array_values(array_unique(array_column($program,'disciplina'))),
            'programmaticContent'=>array_values(array_unique(array_column($program,'disciplina'))),
            'conteudoProgramaticoDetalhado'=>$program,
            'programmaticContentDetailed'=>$flat,
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
                'source'=>$source,'identity'=>$meta['identity'] ?? [],
                'rawExamMetadata'=>$meta['metadata'] ?? [],
                'documents'=>$meta['documents'] ?? [],'review'=>$meta['review'] ?? [],
                'evidence'=>$meta['evidence'] ?? [],'historicalChanges'=>$meta['historicalChanges'] ?? [],
            ],
        ];
    }

    private function previewExamMetadata(array $existing, array $incoming): array
    {
        $willAdd=[];$willPreserve=[];$emptyInZip=[];
        foreach ($incoming as $field=>$value) {
            if (!$this->metadataHasValue($value)) {$emptyInZip[]=$field;continue;}
            if ($this->metadataHasValue($existing[$field] ?? null)) $willPreserve[]=$field;
            else $willAdd[]=$field;
        }
        return ['willAdd'=>$willAdd,'willPreserve'=>$willPreserve,'emptyInZip'=>$emptyInZip];
    }

    private function taxonomySlug(string $level, string $name, ?int $parent): string
    {
        return 'cm-zip-' . ($level==='materia'?'m':'t') . '-' . substr(hash('sha256',($parent??'root').'|'.$name),0,28);
    }

    private function previewTaxonomy(array $program, ?int $proofId): array
    {
        $disciplines=[];$topics=[];$ambiguous=[];
        foreach ($program as $item) {
            $name=trim((string)$item['disciplina']);
            if ($name==='' || isset($disciplines[$name])) continue;
            $find=$this->db->prepare("SELECT id FROM filters WHERE type='assunto' AND name=:n AND (taxonomy_level='materia' OR meta_materia=1) ORDER BY id LIMIT 2");
            $find->execute([':n'=>$name]);$matches=array_map('intval',$find->fetchAll(PDO::FETCH_COLUMN));
            if (count($matches)===1) $disciplines[$name]=['name'=>$name,'state'=>'exists','id'=>$matches[0]];
            else {
                $slug=$this->taxonomySlug('materia',$name,null);
                $bySlug=$this->db->prepare('SELECT id FROM filters WHERE type="assunto" AND slug=:s LIMIT 1');$bySlug->execute([':s'=>$slug]);$slugId=(int)$bySlug->fetchColumn();
                if ($slugId) $disciplines[$name]=['name'=>$name,'state'=>'exists_by_import_slug','id'=>$slugId,'canonicalMatches'=>count($matches)];
                elseif (count($matches)>1) {$disciplines[$name]=['name'=>$name,'state'=>'ambiguous','canonicalMatches'=>count($matches)];$ambiguous[]='Matéria: '.$name;}
                else $disciplines[$name]=['name'=>$name,'state'=>'create'];
            }
        }
        foreach ($program as $item) {
            $matterName=trim((string)$item['disciplina']);$matter=$disciplines[$matterName]??null;
            if (!$matter) continue;
            foreach (($item['temas']??[]) as $rawName) {
                $name=trim((string)$rawName);if($name==='')continue;
                $key=$matterName."\0".$name;if(isset($topics[$key]))continue;
                if (($matter['state']??'')==='create') {$topics[$key]=['name'=>$name,'discipline'=>$matterName,'state'=>'create_with_discipline'];continue;}
                if (($matter['state']??'')==='ambiguous') {$topics[$key]=['name'=>$name,'discipline'=>$matterName,'state'=>'blocked_by_ambiguous_discipline'];continue;}
                $parent=(int)$matter['id'];
                $find=$this->db->prepare("SELECT id FROM filters WHERE type='assunto' AND name=:n AND parent_id=:p AND taxonomy_level='topico' ORDER BY id LIMIT 2");
                $find->execute([':n'=>$name,':p'=>$parent]);$matches=array_map('intval',$find->fetchAll(PDO::FETCH_COLUMN));
                if(count($matches)===1)$topics[$key]=['name'=>$name,'discipline'=>$matterName,'state'=>'exists','id'=>$matches[0]];
                else {
                    $slug=$this->taxonomySlug('topico',$name,$parent);
                    $bySlug=$this->db->prepare('SELECT id FROM filters WHERE type="assunto" AND slug=:s LIMIT 1');$bySlug->execute([':s'=>$slug]);$slugId=(int)$bySlug->fetchColumn();
                    if($slugId)$topics[$key]=['name'=>$name,'discipline'=>$matterName,'state'=>'exists_by_import_slug','id'=>$slugId,'canonicalMatches'=>count($matches)];
                    elseif(count($matches)>1){$topics[$key]=['name'=>$name,'discipline'=>$matterName,'state'=>'ambiguous','canonicalMatches'=>count($matches)];$ambiguous[]='Tópico '.$matterName.' / '.$name;}
                    else $topics[$key]=['name'=>$name,'discipline'=>$matterName,'state'=>'create'];
                }
            }
        }
        $bookletId=null;$bookletState='not_needed';
        if ($program!==[] && $proofId!==null) {
            $booklet=$this->db->prepare('SELECT id FROM prova_cadernos WHERE prova_id=:p ORDER BY ordem,id LIMIT 1');$booklet->execute([':p'=>$proofId]);
            $value=$booklet->fetchColumn();$bookletId=$value===false?null:(int)$value;$bookletState=$bookletId===null?'create':'exists';
        } elseif ($program!==[]) $bookletState='create_after_exam';
        $linkIds=[];
        foreach($disciplines as $item)if(isset($item['id']))$linkIds[(int)$item['id']]=true;
        foreach($topics as $item)if(isset($item['id']))$linkIds[(int)$item['id']]=true;
        $existingLinks=[];
        if($bookletId!==null&&$linkIds){$ids=array_keys($linkIds);foreach(array_chunk($ids,400) as $chunk){$marks=implode(',',array_fill(0,count($chunk),'?'));$q=$this->db->prepare("SELECT filter_id FROM prova_caderno_filters WHERE caderno_id=? AND role='assunto' AND filter_id IN ({$marks})");$q->execute(array_merge([$bookletId],$chunk));foreach($q->fetchAll(PDO::FETCH_COLUMN) as $fid)$existingLinks[(int)$fid]=true;}}
        $wanted=count($disciplines)+count($topics);$already=0;
        foreach($disciplines as $item)if(isset($item['id'])&&isset($existingLinks[(int)$item['id']]))$already++;
        foreach($topics as $item)if(isset($item['id'])&&isset($existingLinks[(int)$item['id']]))$already++;
        return ['booklet'=>['state'=>$bookletState,'id'=>$bookletId],'disciplines'=>array_values($disciplines),'topics'=>array_values($topics),
            'links'=>['wanted'=>$wanted,'existing'=>$already,'willCreate'=>max(0,$wanted-$already)],'ambiguous'=>$ambiguous];
    }

    private function previewQuestionEnrichment(ZipArchive $zip, string $prefix): array
    {
        $path=$prefix.'/enriquecimento.json';
        if($zip->locateName($path)===false)return ['total'=>0,'willAdd'=>0,'alreadyPresent'=>0,'skipped'=>0,'items'=>[]];
        $dataset=$this->readJson($zip,$path,16000000);$items=$dataset['questionEnrichments']??[];
        $records=[];$ids=[];
        foreach(is_array($items)?$items:[] as $index=>$item){
            if(!is_array($item)){$records[$index]=['status'=>'invalid'];continue;}
            $external='';
            foreach(($item['sourceMappings']??[]) as $source)if(($source['provider']??'')==='gran'&&isset($source['externalId'])){$external=(string)$source['externalId'];break;}
            if($external===''){$records[$index]=['status'=>'no_mapping'];continue;}
            $records[$index]=['status'=>'pending','externalId'=>$external];$ids[$external]=true;
        }
        $questions=[];
        foreach(array_chunk(array_keys($ids),200) as $chunk){$marks=implode(',',array_fill(0,count($chunk),'?'));$query=$this->db->prepare("SELECT id,source_external_id,data_json FROM questions WHERE source_provider='gran' AND source_external_id IN ({$marks}) ORDER BY id");$query->execute($chunk);foreach($query->fetchAll(PDO::FETCH_ASSOC) as $row){$key=(string)$row['source_external_id'];$questions[$key]??=$row;}}
        $scheduled=[];$counts=['willAdd'=>0,'alreadyPresent'=>0,'skipped'=>0];
        foreach($records as $index=>$record){
            $status=$record['status'];$external=(string)($record['externalId']??'');
            if($status==='pending'){
                if(!isset($questions[$external]))$status='question_missing';
                else{$raw=(string)($questions[$external]['data_json']??'');$json=$raw!==''?json_decode($raw,true):[];
                    if(!is_array($json))$status='existing_json_invalid';
                    elseif(isset($json['cmZipEnrichment'])||isset($scheduled[$external]))$status='already_present';
                    else{$status='will_add';$scheduled[$external]=true;}}
            }
            if($status==='will_add')$counts['willAdd']++;
            elseif($status==='already_present')$counts['alreadyPresent']++;
            else $counts['skipped']++;
        }
        return ['total'=>count(is_array($items)?$items:[]),...$counts];
    }

    /** Keep ZIP images on the same content-addressed path used by Gran ingestion. */
    private function zipImageFormat(string $bytes): ?array
    {
        $info=@getimagesizefromstring($bytes);
        if(!is_array($info))return null;
        $formats=[
            IMAGETYPE_GIF=>['extension'=>'gif','mimeType'=>'image/gif'],
            IMAGETYPE_JPEG=>['extension'=>'jpg','mimeType'=>'image/jpeg'],
            IMAGETYPE_PNG=>['extension'=>'png','mimeType'=>'image/png'],
        ];
        if(defined('IMAGETYPE_WEBP'))$formats[IMAGETYPE_WEBP]=['extension'=>'webp','mimeType'=>'image/webp'];
        return $formats[(int)($info[2]??0)]??null;
    }

    /** Index locally stored files already attached to a proof by their actual bytes. */
    private function existingExamFilesBySha(int $proofId, ObjectStorage $storage): array
    {
        $query=$this->db->prepare('SELECT caminho,tipo,metadata_json FROM prova_arquivos WHERE prova_id=:p');
        $query->execute([':p'=>$proofId]);$files=[];
        foreach($query->fetchAll(PDO::FETCH_ASSOC) as $row){
            $url=(string)($row['caminho']??'');$key=$storage->storageKeyFromPublicUrl($url);
            if($key===null)continue;
            $sha=$storage->sha256($key);
            if($sha===null)continue;
            $files[$sha]??=['url'=>$url,'type'=>(string)($row['tipo']??'')];
        }
        return $files;
    }

    private function previewDocuments(ZipArchive $zip, string $prefix, array $meta, array $maps, ?int $proofId, string $externalId): array
    {
        $documents=$meta['documents']??[];if(!is_array($documents))$documents=[];
        $assetPaths=[];foreach(($maps['assets']??[]) as $asset)if(is_array($asset)&&isset($asset['localPath']))$assetPaths[$prefix.'/'.ltrim((string)$asset['localPath'],'/')]=true;
        $storage=new ObjectStorage();$existingUrls=[];$existingFilesBySha=[];
        if($proofId!==null){$q=$this->db->prepare('SELECT caminho FROM prova_arquivos WHERE prova_id=:p');$q->execute([':p'=>$proofId]);foreach($q->fetchAll(PDO::FETCH_COLUMN) as $url)$existingUrls[(string)$url]=true;$existingFilesBySha=$this->existingExamFilesBySha($proofId,$storage);}
        $out=[];
        foreach($documents as $doc){
            if(!is_array($doc))continue;
            $path=(string)($doc['path']??'');$file=(string)($doc['fileName']??basename($path));$kind=(string)($doc['kind']??'');$verified=($doc['verifiedContentType']??false)===true;
            $state='will_skip';$reason='Formato documental não suportado pelo vínculo de arquivos da prova.';$shaValid=false;$storageStatus='not_applicable';$visibility='not_applicable';$resolvedKind='';
            $safe=str_starts_with($path,$prefix.'/')&&!str_contains($path,'..');$stat=$safe?$zip->statName($path):false;
            if(!$safe)$reason='Caminho do documento inválido.';
            elseif(!$stat)$reason='Arquivo não existe no ZIP.';
            elseif((int)$stat['size']>30000000)$reason='Arquivo supera o limite de 30 MiB.';
            elseif(!str_ends_with(strtolower($path),'.pdf')){if(isset($assetPaths[$path])){$state='asset_only';$reason='Este item não será anexado como documento de prova; ele aparece em asset-mappings e será verificado na seção de imagens das questões.';}else $reason='O processador de arquivos da prova só vincula PDFs; este item não será anexado como prova, gabarito ou edital.';}
            else{
                $bytes=$zip->getFromName($path);
                if(!is_string($bytes)||!str_starts_with($bytes,'%PDF-'))$reason='Conteúdo não possui assinatura PDF válida.';
                else{
                    $sha=hash('sha256',$bytes);$shaValid=empty($doc['sha256'])||hash_equals((string)$doc['sha256'],$sha);
                    if(!$shaValid)$reason='SHA-256 declarado no documento diverge do conteúdo.';
                    else{
                        $verifiedKind=$verified&&in_array($kind,['prova','gabarito','edital'],true);
                        $resolvedKind=$verifiedKind?$kind:'outro';$visibility=$verifiedKind?'public':'internal';
                        $key="exams/import-gran/{$externalId}/{$sha}.pdf";$url=$storage->publicUrl($key);
                        $storageExists=$storage->exists($key);$storageStatus=$storageExists===true?'already_in_storage':($storageExists===false?'will_upload':'remote_storage_not_checked');
                        $matchingFile=$existingFilesBySha[$sha]??null;
                        if(isset($existingUrls[$url])||($matchingFile!==null&&$matchingFile['type']===$resolvedKind)){$state='already_linked';$storageStatus='already_in_storage';$reason='Este PDF já está anexado à prova com o mesmo conteúdo; nenhum item duplicado será criado.';}
                        else{$state='will_link';if($matchingFile!==null){$url=$matchingFile['url'];$storageStatus='already_in_storage';$reason='O mesmo PDF já está armazenado e será reutilizado no vínculo.';}else{$reason=$verifiedKind?'Tipo documental verificado; será vinculado como '.$resolvedKind.'.':'Tipo não verificado; será salvo apenas como arquivo interno “outro”, sem apresentá-lo como prova, gabarito ou edital oficial.';}}
                    }
                }
            }
            $out[]=['fileName'=>$file,'path'=>$path,'declaredType'=>$kind?:'não informado','verifiedType'=>$verified,
                'resolvedType'=>$resolvedKind?:null,'visibility'=>$visibility,'sizeBytes'=>(int)($stat['size']??0),'sha256Valid'=>$shaValid,
                'state'=>$state,'storageState'=>$storageStatus,'reason'=>$reason];
        }
        return $out;
    }

    private function previewAssets(ZipArchive $zip, string $prefix, array $maps, array $sourceQuestions): array
    {
        $assets=$maps['assets']??[];if(!is_array($assets))$assets=[];
        $questionsByTemp=[];$questionIds=[];
        foreach($sourceQuestions as $question){$temp=(string)($question['tempId']??'');$source=$question['source']??[];$external=(string)($source['externalQuestionId']??$source['externalId']??$question['id']??'');if($temp!==''&&$external!==''){$questionsByTemp[$temp]=$external;$questionIds[$external]=true;}}
        $dbQuestions=[];
        foreach(array_chunk(array_keys($questionIds),200) as $chunk){$marks=implode(',',array_fill(0,count($chunk),'?'));$q=$this->db->prepare("SELECT id,source_external_id FROM questions WHERE source_provider='gran' AND source_external_id IN ({$marks}) ORDER BY id");$q->execute($chunk);foreach($q->fetchAll(PDO::FETCH_ASSOC) as $row)$dbQuestions[(string)$row['source_external_id']]=(int)$row['id'];}
        $storage=new ObjectStorage();$mime=['gif'=>'image/gif','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','webp'=>'image/webp'];$out=[];
        foreach($assets as $asset){
            if(!is_array($asset))continue;
            $local=ltrim((string)($asset['localPath']??''),'/');$temp=(string)($asset['questionTempId']??'');$external=$questionsByTemp[$temp]??'';
            $state='will_skip';$reason='Mapeamento de questão ausente.';$shaValid=false;$objectState='not_applicable';$linkState='not_applicable';
            if($local!==''&&!str_contains($local,'..')&&!str_contains($local,'\\')){
                $full=$prefix.'/'.$local;$stat=$zip->statName($full);$ext=strtolower(pathinfo($local,PATHINFO_EXTENSION));
                if(!$stat||(int)$stat['size']>10000000)$reason='Imagem ausente ou maior que 10 MiB.';
                elseif(!isset($mime[$ext]))$reason='Formato de imagem não suportado.';
                else{$bytes=$zip->getFromName($full);$format=is_string($bytes)?$this->zipImageFormat($bytes):null;$actual=is_string($bytes)?hash('sha256',$bytes):'';$shaValid=is_string($bytes)&&$format!==null&&(!isset($asset['sha256'])||hash_equals((string)$asset['sha256'],$actual));
                    if(!$shaValid)$reason='Conteúdo de imagem inválido ou SHA-256 divergente.';
                    elseif($external===''||!isset($dbQuestions[$external]))$reason='Questão de destino não encontrada; nenhum vínculo será criado.';
                    else{$canonicalExt=(string)$format['extension'];$key='question-assets/gran/'.substr($actual,0,2)."/{$actual}.{$canonicalExt}";$url=$storage->publicUrl($key);$storageExists=$storage->exists($key);$objectState=$storageExists===true?'already_in_storage':($storageExists===false?'will_upload':'remote_storage_not_checked');
                        $scope=(string)($asset['scope']??'statement');$optionId=null;
                        if(preg_match('/^alternative:([A-Z])$/',$scope,$match)){$option=$this->db->prepare('SELECT id FROM question_options WHERE question_id=:q AND label=:label LIMIT 1');$option->execute([':q'=>$dbQuestions[$external],':label'=>$match[1]]);$optionId=$option->fetchColumn();if(!$optionId)$reason='A alternativa de destino não existe; a imagem não será vinculada.';}
                        if($reason==='Mapeamento de questão ausente.'){$assetKey='cmzip-'.substr(hash('sha256',$external.'|'.(string)($asset['sha256']??($asset['originalUrl']??''))),0,44);$exists=$this->db->prepare('SELECT id FROM question_assets WHERE question_id=:q AND (external_key=:k OR public_url=:url) LIMIT 1');$exists->execute([':q'=>$dbQuestions[$external],':k'=>$assetKey,':url'=>$url]);$linkState=$exists->fetchColumn()?'already_linked':'will_link';$state=$linkState==='already_linked'?'already_linked':'will_link';$reason=$linkState==='already_linked'?'Imagem e vínculo já cadastrados; armazenamento usará a mesma chave determinística.':'Imagem válida; será armazenada e vinculada à questão existente.';}
                    }
                }
            }
            $out[]=['fileName'=>$local,'questionExternalId'=>$external?:null,'scope'=>(string)($asset['scope']??'statement'),'state'=>$state,
                'storageState'=>$objectState,'linkState'=>$linkState,'sha256Valid'=>$shaValid,'reason'=>$reason];
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
            if($this->db->inTransaction())throw new RuntimeException('A conexao possui uma transacao anterior; nao e seguro gerar a pre-visualizacao.');
            $this->db->exec('SET TRANSACTION READ ONLY');
            $this->db->beginTransaction();
            $prefix=(string)$selected['path'];$meta=$this->readJson($zip,$prefix.'/metadados.json');
            $payload=$this->readJson($zip,$prefix.'/questoes.json');
            $externalId=substr($externalKey,5);$ids=[];
            foreach(($payload['questions']??[]) as $q) {
                $src=$q['source']??[];$qid=(string)($src['externalQuestionId']??$src['externalId']??$q['id']??'');
                if($qid==='')throw new InvalidArgumentException('Questao sem identidade externa.');$ids[$qid]=true;
            }
            if(count($ids)!==(int)$selected['questions'])throw new InvalidArgumentException('Identidades de questoes duplicadas ou quantidade divergente.');
            $proof=$this->db->prepare('SELECT id,ano,metadata_json,data_prova,inscricoes_inicio,inscricoes_fim FROM provas WHERE source_provider=:provider AND source_external_id=:external_id ORDER BY id LIMIT 2');
            $proof->execute([':provider'=>'gran',':external_id'=>$externalId]);$proofRows=$proof->fetchAll(PDO::FETCH_ASSOC);$row=$proofRows[0]??null;
            $existing=[];$duplicateQuestionIds=[];foreach(array_chunk(array_keys($ids),200) as $chunk){$qs=implode(',',array_fill(0,count($chunk),'?'));$st=$this->db->prepare("SELECT source_external_id,COUNT(*) AS n FROM questions WHERE source_provider='gran' AND source_external_id IN ({$qs}) GROUP BY source_external_id");$st->execute($chunk);foreach($st->fetchAll(PDO::FETCH_ASSOC) as $found){$qid=(string)$found['source_external_id'];$existing[$qid]=true;if((int)$found['n']>1)$duplicateQuestionIds[]=$qid;}}
            $program=$this->programDetails($zip,$prefix,$meta);
            $docs=$meta['documents']??[];$maps=$zip->locateName($prefix.'/asset-mappings.json')===false?[]:$this->readJson($zip,$prefix.'/asset-mappings.json');
            $missing=count($ids)-count($existing);$proofYear=$row?(int)$row['ano']:null;
            $oldMeta=$row?json_decode((string)($row['metadata_json']??'{}'),true):[];if(!is_array($oldMeta))$oldMeta=[];
            $source=$meta['source']??[];
            $programEvidence=$zip->locateName($prefix.'/enriquecimento_programatico_taxonomia.json')===false?[]:$this->readJson($zip,$prefix.'/enriquecimento_programatico_taxonomia.json');
            $documentEvidence=$zip->locateName($prefix.'/evidencias.json')===false?[]:$this->readJson($zip,$prefix.'/evidencias.json');
            $incomingMeta=$this->incomingExamMetadata($meta,$program,$source,$programEvidence,$documentEvidence);
            $proofMetadata=$this->previewExamMetadata($oldMeta,$incomingMeta);
            $datePlan=['willAdd'=>[],'willPreserve'=>[],'emptyInZip'=>[]];
            foreach(['data_prova'=>'dataProva','inscricoes_inicio'=>'dataInscricaoInicio','inscricoes_fim'=>'dataInscricaoFim'] as $column=>$sourceField){
                $date=$meta['metadata'][$sourceField]??null;
                if(!is_string($date)||!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/',$date)){$datePlan['emptyInZip'][]=$column;continue;}
                if(!empty($row[$column]))$datePlan['willPreserve'][]=$column;else $datePlan['willAdd'][]=$column;
            }
            $taxonomy=$this->previewTaxonomy($program,$row?(int)$row['id']:null);
            $questionMetadata=$this->previewQuestionEnrichment($zip,$prefix);
            $documentPlan=$this->previewDocuments($zip,$prefix,$meta,$maps,$row?(int)$row['id']:null,$externalId);
            $assetPlan=$this->previewAssets($zip,$prefix,$maps,$payload['questions']??[]);
            $proofPlan=['state'=>$row?'exists':'create_if_missing_questions','id'=>$row?(int)$row['id']:null,'year'=>$proofYear,
                'metadata'=>$proofMetadata,'dates'=>$datePlan];
            $blocked=count($proofRows)>1||count($duplicateQuestionIds)>0||($row && $proofYear!==(int)$selected['year'])||(!$row&&$missing===0)||$taxonomy['ambiguous']!==[];
            $plan=['proof'=>$proofPlan,'taxonomy'=>$taxonomy,'questionMetadata'=>$questionMetadata,'documents'=>$documentPlan,'assets'=>$assetPlan];
            $planHash=hash('sha256',json_encode($plan,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
            $docCounts=['willLink'=>0,'alreadyLinked'=>0,'willSkip'=>0,'assetOnly'=>0,'internal'=>0,'verifiedOfficial'=>0];foreach($documentPlan as $item){if($item['state']==='will_link')$docCounts['willLink']++;elseif($item['state']==='already_linked')$docCounts['alreadyLinked']++;elseif($item['state']==='asset_only')$docCounts['assetOnly']++;else$docCounts['willSkip']++;if(($item['resolvedType']??null)==='outro')$docCounts['internal']++;elseif(in_array(($item['resolvedType']??''),['prova','gabarito','edital'],true))$docCounts['verifiedOfficial']++;}
            $assetCounts=['willLink'=>0,'alreadyLinked'=>0,'willSkip'=>0];foreach($assetPlan as $item){if($item['state']==='will_link')$assetCounts['willLink']++;elseif($item['state']==='already_linked')$assetCounts['alreadyLinked']++;else$assetCounts['willSkip']++;}
            $message=$taxonomy['ambiguous']!==[]?'Taxonomias com nomes duplicados foram encontradas; revise antes de processar.':
                ($missing?'Há questões ausentes. Processar exige confirmação explícita de publicação.':'Todas as questões já existem; o conteúdo delas será preservado e nenhuma será enviada ao importador canônico.');
            if($docCounts['willSkip']>0||array_filter($documentPlan,fn($item)=>$item['resolvedType']==='outro'))$message.=' Há documentos que serão ignorados ou mantidos como arquivos internos; confira os detalhes.';
            $result=['status'=>$blocked?'blocked':'ready','externalKey'=>$externalKey,'title'=>$selected['title'],'year'=>$selected['year'],
                'expectedQuestions'=>count($ids),'existingQuestions'=>count($existing),'missingQuestions'=>$missing,'examExists'=>(bool)$row,
                'existingExamYear'=>$proofYear,'duplicateExamRecords'=>max(0,count($proofRows)-1),'duplicateQuestionIds'=>$duplicateQuestionIds,
                'programDisciplines'=>count($program),'programThemes'=>array_sum(array_map(fn($d)=>count($d['temas']),$program)),
                'documentEntries'=>count(is_array($docs)?$docs:[]),'assetEntries'=>count($maps['assets']??[]),
                'existingMetadataKeys'=>count(array_filter($oldMeta,fn($v)=>$v!==null&&$v!==''&&$v!==[])),
                'questionIdsHash'=>hash('sha256',implode("\n",array_keys($ids))),
                'planHash'=>$planHash,'proof'=>$proofPlan,'questionMetadata'=>$questionMetadata,'taxonomy'=>$taxonomy,
                'documents'=>$documentPlan,'documentActions'=>$docCounts,'assets'=>$assetPlan,'assetActions'=>$assetCounts,
                'message'=>$blocked?(count($proofRows)>1?'Mais de um registro de prova usa esta identidade externa.':(count($duplicateQuestionIds)>0?'Há IDs externos de questão duplicados no banco.':($row&&$proofYear!==(int)$selected['year']?'Ano da prova existente diverge do manifesto.':($taxonomy['ambiguous']!==[]?'Taxonomias ambíguas: revise os filtros duplicados antes de processar.':'Prova ausente e todas as questões já existem; não é seguro criar a prova por este fluxo.')))):$message];
            $this->db->rollBack();
            $state['previews'][$externalKey]=$result;
            $this->writeState($state);
            return $result;
        } catch(Throwable $e) {
            if($this->db->inTransaction())$this->db->rollBack();
            throw $e;
        } finally {$zip->close();}
    }

    private function assertFreshPreview(array $state, string $externalKey, bool $allowPublicUnverified): array
    {
        $preview=$state['previews'][$externalKey]??null;
        if(!is_array($preview)||($preview['status']??'')!=='ready')throw new DomainException('Gere uma prévia sem gravação para esta prova antes de processar.');
        $fresh=$this->preview((string)$state['id'],$externalKey);
        foreach(['status','existingQuestions','missingQuestions','examExists','existingExamYear','questionIdsHash','planHash'] as $key) if(($fresh[$key]??null)!==($preview[$key]??null))throw new DomainException('Os dados mudaram desde a prévia. Gere uma nova prévia antes de processar.');
        if(($fresh['missingQuestions']??0)>0&&!$allowPublicUnverified)throw new DomainException('A prévia identificou questões ausentes; marque a confirmação expressa para permitir a publicação pelo serviço canônico.');
        return $fresh;
    }

    /** Metadata is additive, never overwrites a nonempty existing value. */
    private function mergeExistingMetadata(array $existing, array $incoming): array
    {
        foreach ($incoming as $k=>$v) {
            if ($this->metadataHasValue($v) && (!array_key_exists($k,$existing) || !$this->metadataHasValue($existing[$k]))) {
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
        $incoming=$this->incomingExamMetadata($meta,$program,$source,$programEvidence,$documentEvidence);
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
        $slug = $this->taxonomySlug($level,$name,$parent);
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

    private function storeArchiveAssets(ZipArchive $zip, string $prefix, array $questions, array $maps): array
    {
        $replacements=[]; $stored=0; $missing=[];$storage=new ObjectStorage();
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
            if (!is_string($bytes) || !($format=$this->zipImageFormat($bytes))) { $missing[]=$local;continue; }
            $sha=hash('sha256',$bytes);
            if (isset($a['sha256']) && $a['sha256']!==$sha) { $missing[]=$local;continue; }
            $key='question-assets/gran/'.substr($sha,0,2)."/{$sha}.{$format['extension']}";
            if($storage->exists($key)===true)$file=['url'=>$storage->publicUrl($key)];
            else{$file=$storage->storeBytes($bytes,$key,$format['mimeType']);$stored++;}
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
        $stored=0;$skipped=0;$storage=new ObjectStorage();$existingFilesBySha=$this->existingExamFilesBySha((int)$exam['id'],$storage);
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
            $kind=(string)($d['kind']??'');
            $classified=in_array($kind,['prova','gabarito','edital'],true) && ($d['verifiedContentType']??false)===true;
            if (!$classified) $kind='outro';
            $existingFile=$existingFilesBySha[$sha]??null;
            if($existingFile!==null&&$existingFile['type']===$kind){$skipped++;continue;}
            $url=$existingFile['url']??$storage->storeBytes($bytes,"exams/import-gran/{$externalId}/{$sha}.pdf",'application/pdf')['url'];
            $exists=$this->db->prepare('SELECT id FROM prova_arquivos WHERE prova_id=:p AND caminho=:url LIMIT 1');
            $exists->execute([':p'=>$exam['id'],':url'=>$url]);if ($exists->fetchColumn()) continue;
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
                    [$withUrls,$assetResult]=$this->storeArchiveAssets($zip,$prefix,$allSourceQuestions,$maps);
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
