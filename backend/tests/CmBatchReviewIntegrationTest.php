<?php
declare(strict_types=1);
require_once __DIR__ . '/../modules/ingestion/services/CmBatchTaxonomyReviewService.php';
require_once __DIR__ . '/../modules/ingestion/services/CmBatchImportService.php';
require_once __DIR__ . '/../modules/questions/repositories/QuestionsRepository.php';
require_once __DIR__ . '/../modules/ingestion/services/CmBatchFieldAuditService.php';
require_once __DIR__ . '/../modules/ingestion/services/CmBatchQueueService.php';

// Dedicated loopback-only disposable instance, never application credentials.
$db = new PDO('mysql:host=127.0.0.1;port=33317;charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
$schema = 'cm_batch_test_' . bin2hex(random_bytes(6));
$db->exec("CREATE DATABASE `$schema` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
try {
    $db->exec("USE `$schema`");
    $db->exec('CREATE TABLE questions (id INT PRIMARY KEY, source_provider VARCHAR(80), source_external_id VARCHAR(190), source_exam_key VARCHAR(191), tipo VARCHAR(80), enunciado LONGTEXT, intro_text LONGTEXT, reference_text LONGTEXT, data_json JSON, import_fingerprint CHAR(64), grupo_questao_id INT NULL, support_context_key VARCHAR(120) NULL, has_image TINYINT NOT NULL DEFAULT 0) ENGINE=InnoDB');
    $db->exec('CREATE TABLE questions_groups (id INT PRIMARY KEY, enunciado LONGTEXT, texto LONGTEXT, image_url VARCHAR(500), assets_json JSON) ENGINE=InnoDB');
    $db->exec('CREATE TABLE provas (id INT PRIMARY KEY) ENGINE=InnoDB');
    $db->exec('CREATE TABLE prova_cadernos (id INT AUTO_INCREMENT PRIMARY KEY, prova_id INT, nome VARCHAR(190), tipo VARCHAR(80), cor VARCHAR(80), metadata_json JSON, UNIQUE KEY uq_booklet (prova_id,nome)) ENGINE=InnoDB');
    $db->exec('CREATE TABLE question_provas (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, question_id INT, prova_id INT, caderno_id INT, numero_na_prova INT, metadata_json JSON, UNIQUE KEY uq_question_prova_caderno (question_id, prova_id, caderno_id)) ENGINE=InnoDB');
    $db->exec('CREATE TABLE filters (id INT AUTO_INCREMENT PRIMARY KEY, type VARCHAR(40), name VARCHAR(255), slug VARCHAR(255), parent_id INT NULL, taxonomy_level VARCHAR(40)) ENGINE=InnoDB');
    $db->exec('ALTER TABLE filters ADD meta_materia TINYINT NOT NULL DEFAULT 0, ADD meta_carreira TINYINT NOT NULL DEFAULT 0');
    $db->exec('CREATE TABLE filter_source_identities (filter_id INT, filter_type VARCHAR(40), source_provider VARCHAR(40), source_entity_type VARCHAR(40), source_external_id VARCHAR(120), source_parent_external_id VARCHAR(120), source_root_external_id VARCHAR(120), UNIQUE KEY uq_source(filter_type,source_provider,source_entity_type,source_external_id)) ENGINE=InnoDB');
    $migrate = require __DIR__ . '/../database/migrations/20261025_010000_cm_batch_import.php';
    $migrate($db);
    $migrate($db);
    $db->exec("INSERT INTO filters (id,type,name,slug,parent_id,taxonomy_level) VALUES (41,'assunto','Lingua Portuguesa','lingua-portuguesa',NULL,'materia'),(42,'assunto','Direito','direito',NULL,'materia'),(73,'assunto','Interpretacao','interpretacao',41,'topico'),(74,'assunto','Interpretacao','interpretacao-direito',42,'topico')");
    $jobId = '11111111-1111-4111-8111-111111111111';
    $entities = [
        ['category'=>'subjects','key'=>'portuguese','name'=>'Portugues','parentKey'=>null,'canonicalId'=>41,'status'=>'matched_existing','reason'=>'exact_name_and_parent'],
        ['category'=>'topics','key'=>'interpretation','name'=>'Interpretacao','parentKey'=>'portuguese','canonicalId'=>null,'status'=>'needs_review','reason'=>'no_verified_local_match','sourceMappings'=>[['provider'=>'fixture','externalId'=>'topic-1']],'sourceEntity'=>['parentExternalId'=>'subject-1','rootExternalId'=>'subject-1']],
    ];
    $plan = json_encode(['taxonomy'=>['entities'=>$entities]], JSON_THROW_ON_ERROR);
    $insert = $db->prepare("INSERT INTO cm_batch_import_jobs (job_id,batch_id,archive_sha256,source_provider,dataset_label,archive_path,status,manifest_json,dry_run_json,actor_user_id) VALUES (?,'test',?,'fixture','test','private.zip','needs_review','{}',?,'admin')");
    $insert->execute([$jobId, str_repeat('a',64),$plan]);
    $insert = $db->prepare("INSERT INTO cm_batch_taxonomy_resolutions (job_id,taxonomy_type,provider,external_id,external_key,resolution_status) VALUES (?,?,'fixture',?,?,'needs_review')");
    foreach ($entities as $entity) $insert->execute([$jobId,$entity['category'],$entity['key'],$entity['key']]);
    $review = new CmBatchTaxonomyReviewService($db,'admin');
    $candidates = $review->candidates($jobId,'topics','interpretation','Interpretacao');
    if (count($candidates)!==1 || (int)$candidates[0]['id']!==73) throw new RuntimeException('Candidate search crossed parent scope');
    $input = ['jobId'=>$jobId,'planHash'=>hash('sha256',$plan),'category'=>'topics','key'=>'interpretation','operation'=>'link','canonicalId'=>74,'reason'=>'Conferido no documento oficial'];
    try { $review->decide($input); throw new RuntimeException('Wrong-parent decision accepted'); } catch (DomainException) {}
    if ((int)$db->query('SELECT COUNT(*) FROM cm_batch_field_audit')->fetchColumn()!==0) throw new RuntimeException('Rejected decision persisted audit');
    $input['canonicalId']=73;
    $review->decide($input);
    $job = (new CmBatchImportService($db,'admin'))->getJob($jobId);
    if ($job['plan']['taxonomy']['entities'][1]['canonicalId']!==73) throw new RuntimeException('Decision not persisted');
    if ((int)$db->query("SELECT filter_id FROM filter_source_identities WHERE source_external_id='topic-1'")->fetchColumn()!==73) throw new RuntimeException('Verified source identity not persisted');
    try { $review->decide($input); throw new RuntimeException('Stale plan accepted'); } catch (DomainException) {}
    $input = array_merge($input,['planHash'=>$job['planHash'],'category'=>'subjects','key'=>'portuguese','canonicalId'=>42]);
    $review->decide($input);
    $job = (new CmBatchImportService($db,'admin'))->getJob($jobId);
    if ($job['plan']['taxonomy']['entities'][1]['canonicalId']!==null) throw new RuntimeException('Child retained invalid canonical ID');
    if ((int)$db->query('SELECT COUNT(*) FROM filters')->fetchColumn()!==4) throw new RuntimeException('Review changed canonical records');
    if ((int)$db->query('SELECT COUNT(*) FROM cm_batch_field_audit')->fetchColumn()!==2) throw new RuntimeException('Audit count wrong');
    $db->exec('ALTER TABLE filters ADD source_provider VARCHAR(40) NULL, ADD source_entity_type VARCHAR(40) NULL, ADD source_external_id VARCHAR(120) NULL, ADD source_parent_external_id VARCHAR(120) NULL, ADD source_root_external_id VARCHAR(120) NULL');
    $db->exec("UPDATE filters SET source_provider='gran',source_entity_type='assunto',source_external_id='403587' WHERE id=41");
    $db->exec("UPDATE filters SET source_provider='gran',source_entity_type='assunto',source_external_id='403701',source_parent_external_id='403587',source_root_external_id='403587' WHERE id=73");
    $taxonomyDocument=['taxonomies'=>[
        'subjects'=>[['key'=>'subject:403587','name'=>'Língua Portuguesa','slug'=>'lingua-portuguesa','parentKey'=>null,'sourceMappings'=>[['provider'=>'gran','externalId'=>'403587']]]],
        'topics'=>[['key'=>'topic:403701','name'=>'Interpretação','slug'=>'interpretacao','parentKey'=>'subject:403587','sourceMappings'=>[['provider'=>'gran','externalId'=>'403701']]]],
    ]];
    $importService=new CmBatchImportService($db,'admin');
    $taxonomyMethod=new ReflectionMethod($importService,'resolveTaxonomiesConservatively');
    $taxonomyPlan=$taxonomyMethod->invoke($importService,$taxonomyDocument);
    if($taxonomyPlan['counts']['matched_existing']!==2 || $taxonomyPlan['entities'][0]['canonicalId']!==41 || $taxonomyPlan['entities'][1]['canonicalId']!==73)throw new RuntimeException('Direct filters.source_external_id identity did not resolve through taxonomy parent scope');
    $linkMethod=new ReflectionMethod($importService,'planQuestionTaxonomyLinks');
    $questionTaxonomy=['filters'=>['subjects'=>[['label'=>'Língua Portuguesa','slug'=>'lingua-portuguesa']],'topics'=>[['label'=>'Interpretação','slug'=>'interpretacao']]]];
    $completeTaxonomy=$linkMethod->invoke($importService,$questionTaxonomy,$taxonomyPlan,[41,73]);
    if($completeTaxonomy['status']!=='unchanged' || $completeTaxonomy['missingCanonicalFilterIds']!==[])throw new RuntimeException('Existing canonical taxonomy links were not recognized');
    $missingTaxonomy=$linkMethod->invoke($importService,$questionTaxonomy,$taxonomyPlan,[41]);
    if($missingTaxonomy['status']!=='enrich_existing' || $missingTaxonomy['missingCanonicalFilterIds']!==[73])throw new RuntimeException('Missing canonical taxonomy relation was not planned for enrichment');
    $db->exec("INSERT INTO filters (id,type,name,slug,parent_id,taxonomy_level) VALUES (75,'banca','FUNECE IEPRO','funece-iepro',NULL,NULL)");
    $questionTaxonomy['filters']['examBoards']=[['label'=>'FUNECE IEPRO','slug'=>'funece-iepro']];
    $filterLookupMethod=new ReflectionMethod($importService,'loadTaxonomyFilterLookup');
    $filterLookup=$filterLookupMethod->invoke($importService);
    $exactLocalFallback=$linkMethod->invoke($importService,$questionTaxonomy,$taxonomyPlan,[41,73],$filterLookup);
    $expectedLocalFilterIds=array_map(static fn(array $filter):int=>(int)$filter['id'],$exactLocalFallback['expectedCanonicalFilters']??[]);
    if(!in_array(75,$expectedLocalFilterIds,true) || in_array(['category'=>'examBoards','label'=>'FUNECE IEPRO','reason'=>'no_resolved_canonical_taxonomy'],$exactLocalFallback['unresolved']??[],true))throw new RuntimeException('Unique exact local taxonomy match was not reused when absent from batch global catalog');
    echo "Taxonomy reconciliation: PASS (direct external IDs, parent scope, no duplicate IDs, missing relation detected)\n";
    $db->exec('ALTER TABLE filters ADD description TEXT NULL, ADD website VARCHAR(500) NULL');
    $ledger = new CmBatchFieldAuditService($db,'admin');
    $db->beginTransaction();
    $merge = $ledger->enrichTaxonomy($jobId,41,'description','Descricao verificada',[['reviewer'=>'admin','document'=>'fixture']]);
    $replay = $ledger->enrichTaxonomy($jobId,41,'description','Descricao verificada',[['reviewer'=>'admin','document'=>'fixture']]);
    if ($merge['auditId'] !== $replay['auditId']) throw new RuntimeException('Merge replay duplicated ledger');
    $empty = $ledger->enrichTaxonomy($jobId,41,'description','',[]);
    if ($empty['action'] !== 'unchanged') throw new RuntimeException('Empty metadata erased value');
    $proposal = $ledger->enrichTaxonomy($jobId,41,'description','Texto IA',[]);
    if ($proposal['action'] !== 'needs_review') throw new RuntimeException('Unverified text replaced reviewed content');
    $ledger->undo($merge['auditId'],$jobId);
    $db->commit();
    if ($db->query('SELECT description FROM filters WHERE id=41')->fetchColumn()!==null) throw new RuntimeException('Selective undo did not restore null');
    $db->beginTransaction();
    $merge = $ledger->enrichTaxonomy($jobId,42,'description','Outra descricao',[['reviewer'=>'admin']]);
    $db->exec("UPDATE filters SET description='Edicao posterior' WHERE id=42");
    try { $ledger->undo($merge['auditId'],$jobId); throw new RuntimeException('Undo overwrote later manual edit'); } catch (DomainException) {}
    $db->commit();
    if ($db->query('SELECT description FROM filters WHERE id=42')->fetchColumn()!=='Edicao posterior') throw new RuntimeException('Manual edit lost');
    echo "Field ledger: PASS (fill missing, replay, preserve empty/AI, selective undo, later edit conflict)\n";
    $db->exec("INSERT INTO questions (id,source_provider,source_external_id,import_fingerprint) VALUES (1,'fixture','q1',REPEAT('b',64))");
    $db->exec('INSERT INTO provas VALUES (10),(20)');
    $repository = new QuestionsRepository($db);
    $occurrenceA = ['provider'=>'fixture','externalExamId'=>'A','questionNumber'=>'12','answerKey'=>'A','answerStatus'=>'definitive'];
    $occurrenceB = ['provider'=>'fixture','externalExamId'=>'B','questionNumber'=>'35','answerKey'=>'B','answerStatus'=>'definitive'];
    $db->beginTransaction();
    $idA = $repository->syncCmBatchQuestionOccurrence(1,10,$occurrenceA,$jobId);
    $idB = $repository->syncCmBatchQuestionOccurrence(1,20,$occurrenceB,$jobId);
    $db->commit();
    for ($repeat=0;$repeat<2;$repeat++) {
        $db->beginTransaction();
        if ($repository->syncCmBatchQuestionOccurrence(1,10,$occurrenceA,$jobId)!==$idA) throw new RuntimeException('Occurrence replay changed identity');
        $repository->syncCmBatchQuestionOccurrence(1,20,$occurrenceB,$jobId);
        $db->commit();
    }
    if ((int)$db->query('SELECT COUNT(*) FROM questions')->fetchColumn()!==1 || (int)$db->query('SELECT COUNT(*) FROM question_provas')->fetchColumn()!==2) throw new RuntimeException('Q1/Q2 failed: duplicate canonical content or occurrence');
    $db->beginTransaction();
    $repository->syncCmBatchQuestionOccurrence(1,10,array_merge($occurrenceA,['answerKey'=>'C','answerStatus'=>'preliminary']),$jobId);
    $db->commit();
    $answer = $db->query('SELECT answer_key,answer_status FROM question_provas WHERE id=' . $idA)->fetch(PDO::FETCH_ASSOC);
    if ($answer!==['answer_key'=>'A','answer_status'=>'definitive']) throw new RuntimeException('Definitive answer overwritten');
    if ((int)$db->query("SELECT COUNT(*) FROM question_prova_answer_history WHERE answer_status='conflict'")->fetchColumn()!==1) throw new RuntimeException('Conflicting answer history missing');
    if ($db->query('SELECT answer_key FROM question_provas WHERE id=' . $idB)->fetchColumn()!=='B') throw new RuntimeException('Answer crossed occurrences');
    echo "CmBatchReviewIntegrationTest: PASS (migration twice, scoped candidates, rollback, stale plan, child invalidation, audit)\n";
    echo "Occurrence integration: PASS (one canonical, two exams, replay, definitive answer protection, conflict history)\n";
    $db->exec('INSERT INTO provas VALUES (30)');
    $workers=[];
    for($i=0;$i<2;$i++) {
        $pipes=[];
        $process=proc_open([PHP_BINARY,__DIR__.'/CmBatchConcurrencyWorker.php',$schema],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
        if(!is_resource($process))throw new RuntimeException('Unable to start concurrent database worker');
        fclose($pipes[0]);
        $workers[]=[$process,$pipes];
    }
    $workerIds=[];
    foreach($workers as [$process,$pipes]) {
        $output=stream_get_contents($pipes[1]);
        $error=stream_get_contents($pipes[2]);
        fclose($pipes[1]);fclose($pipes[2]);
        if(proc_close($process)!==0)throw new RuntimeException('Concurrent worker failed: '.$error);
        $workerIds[]=trim($output);
    }
    if($workerIds[0]!==$workerIds[1] || (int)$db->query('SELECT COUNT(*) FROM question_provas WHERE prova_id=30')->fetchColumn()!==1)throw new RuntimeException('Concurrent occurrence duplicated');
    if((int)$db->query("SELECT COUNT(*) FROM question_source_identities WHERE source_external_id='shared-concurrent'")->fetchColumn()!==1)throw new RuntimeException('Concurrent source identity duplicated');
    echo "Concurrency: PASS (two independent PHP/MySQL connections, single occurrence/source identity)\n";
    if (isset($argv[1])) {
        $started = microtime(true);
        $summary = (new CmBatchZipValidator())->validate($argv[1]);
        $service = new CmBatchImportService($db, 'admin');
        $previewMethod = new ReflectionMethod($service, 'buildConservativePreview');
        $preview = $previewMethod->invoke($service, $argv[1], $summary);
        if ($preview['questions']['total']!==440 || count($preview['exams'])!==7) throw new RuntimeException('Real batch counts incorrect');
        $granSourceItem = null;
        foreach ($preview['questions']['items'] as $item) {
            if ($item['externalQuestionId'] !== null && $item['enrichment']['sourceMappings'][0]['provider'] === 'gran') {
                $granSourceItem = $item;
                break;
            }
        }
        if ($granSourceItem === null) throw new RuntimeException('Gran external ID was not read from question enrichment');
        $seed = $db->prepare('INSERT INTO questions (id,source_provider,source_external_id,import_fingerprint) VALUES (900001,\'gran\',?,?)');
        $seed->execute([$granSourceItem['externalQuestionId'],$granSourceItem['fingerprint']]);
        $legacyPreview = $previewMethod->invoke($service, $argv[1], $summary);
        $legacyMatch = array_values(array_filter($legacyPreview['questions']['items'], static fn(array $item):bool => $item['externalQuestionId'] === $granSourceItem['externalQuestionId']));
        if (count($legacyMatch)!==1 || $legacyMatch[0]['action']!=='conflict' || $legacyMatch[0]['reconciliation']!=='conflict' || $legacyMatch[0]['canonicalQuestionId']!==null) {
            throw new RuntimeException('An external ID and matching hash must not bypass content verification');
        }
        $db->prepare('UPDATE questions SET import_fingerprint=? WHERE id=900001')->execute([str_repeat('f',64)]);
        $conflictPreview = $previewMethod->invoke($service, $argv[1], $summary);
        $legacyConflict = array_values(array_filter($conflictPreview['questions']['items'], static fn(array $item):bool => $item['externalQuestionId'] === $granSourceItem['externalQuestionId']));
        if (count($legacyConflict)!==1 || $legacyConflict[0]['action']!=='conflict' || $legacyConflict[0]['canonicalQuestionId']!==null) {
            throw new RuntimeException('An external ID with no matching canonical content must remain blocked');
        }

        $zip = new ZipArchive();
        if ($zip->open($argv[1], ZipArchive::RDONLY) !== true) throw new RuntimeException('Unable to reopen batch ZIP for content reconciliation test');
        $contentFixture = null;
        foreach ($summary['exams'] as $exam) {
            $prefix = rtrim((string)$exam['path'],'/');
            $doc = json_decode((string)$zip->getFromName($prefix.'/questoes.json'),true,512,JSON_THROW_ON_ERROR);
            $enrichment = json_decode((string)$zip->getFromName($prefix.'/enriquecimento.json'),true,512,JSON_THROW_ON_ERROR);
            $byTemp=[];
            foreach($enrichment['questionEnrichments']??[] as $entry) $byTemp[(string)($entry['questionTempId']??'')]=$entry;
            foreach($doc['questions'] as $incoming) {
                $ctx=trim((string)($incoming['source']['contextTempId']??''));
                $assets=$incoming['assets']??[];
                foreach($incoming['alternatives']??[] as $alternative) $assets=array_merge($assets,$alternative['assets']??[]);
                $entry=$byTemp[(string)($incoming['tempId']??'')]??[];
                $external='';
                foreach($entry['sourceMappings']??[] as $mapping) if(strtolower((string)($mapping['provider']??''))==='gran') $external=(string)($mapping['externalId']??'');
                if($ctx==='' && $assets===[] && $external!=='' && $external!==$granSourceItem['externalQuestionId']) { $contentFixture=['exam'=>$exam,'question'=>$incoming,'externalId'=>$external]; break 2; }
            }
        }
        $zip->close();
        if($contentFixture===null) throw new RuntimeException('No media-free, context-free fixture found for exact content reconciliation');
        $incoming=$contentFixture['question'];
        $items=[];
        foreach($incoming['alternatives']??[] as $alternative) $items[]=['ordem'=>(int)($alternative['order']??count($items)+1),'rotulo'=>(string)($alternative['label']??''),'corpo'=>(string)($alternative['text']??'')];
        $storedData=['itens'=>$items,'imageUrl'=>'','referenceText'=>(string)($incoming['content']['reference']??''),'sourceExamKey'=>(string)$contentFixture['exam']['externalKey']];
        $insert=$db->prepare('INSERT INTO questions (id,source_provider,source_external_id,source_exam_key,tipo,enunciado,intro_text,reference_text,data_json,import_fingerprint,has_image) VALUES (?,\'gran\',?,?,?,?,?,?,?,?,0)');
        $insert->execute([900002,'content-existing',(string)$contentFixture['exam']['externalKey'],(string)$incoming['type'],(string)($incoming['content']['statement']??''),(string)($incoming['content']['supportText']??''),(string)($incoming['content']['reference']??''),json_encode($storedData,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),str_repeat('e',64)]);
        $divergentData=$storedData;
        if(($divergentData['itens'][0]['corpo']??'')!=='')$divergentData['itens'][0]['corpo'].=' [alternativa divergente]';
        $insert->execute([900003,'content-near-match',(string)$contentFixture['exam']['externalKey'],(string)$incoming['type'],(string)($incoming['content']['statement']??''),(string)($incoming['content']['supportText']??''),(string)($incoming['content']['reference']??''),json_encode($divergentData,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),str_repeat('d',64)]);
        $contentPreview=$previewMethod->invoke($service,$argv[1],$summary);
        $contentMatch=array_values(array_filter($contentPreview['questions']['items'],static fn(array $item):bool=>$item['externalQuestionId']===$contentFixture['externalId']));
        if(count($contentMatch)!==1 || $contentMatch[0]['canonicalQuestionId']!==900002 || $contentMatch[0]['reconciliation']!=='link_existing') throw new RuntimeException('Unique full-content candidate should link despite another same-statement candidate with different alternatives');
        $uece = array_values(array_filter($preview['exams'], static fn(array $exam):bool => str_contains($exam['externalKey'],'26558')));
        if (count($uece)!==1 || $uece[0]['correctYear']!==2017) throw new RuntimeException('Official year lost');
        echo json_encode(['realZip'=>'PASS','granSourceExternalId'=>'PASS (legacy link + divergent fingerprint conflict)','actions'=>$preview['questions']['actions'],'seconds'=>round(microtime(true)-$started,3),'peakMemoryBytes'=>memory_get_peak_usage(true)], JSON_THROW_ON_ERROR) . "\n";
        $blocked = array_values(array_filter($preview['questions']['items'], static fn(array $item):bool => $item['action']==='blocked'));
        echo json_encode(['blockedSamples'=>array_map(static fn(array $item):array => ['exam'=>$item['examExternalKey'],'question'=>$item['tempId'],'error'=>$item['identityError']], array_slice($blocked,0,3))], JSON_THROW_ON_ERROR) . "\n";
        $queuePlan=json_encode(['taxonomy'=>['entities'=>[
            ['category'=>'subjects','key'=>'new-subject','name'=>'Nova Materia','status'=>'creation_proposed','action'=>'needs_review','sourceMappings'=>[['provider'=>'fixture','externalId'=>'subject-new']],'sourceEntity'=>['slug'=>'nova-materia']],
        ]],'exams'=>[],'questions'=>['items'=>[
            ['action'=>'create'],['action'=>'blocked'],
        ]]],JSON_THROW_ON_ERROR);
        $stmt=$db->prepare('UPDATE cm_batch_import_jobs SET dry_run_json=?,archive_path=?,archive_sha256=? WHERE job_id=?');
        $stmt->execute([$queuePlan,$argv[1],hash_file('sha256',$argv[1]),$jobId]);
        $stmt=$db->prepare("INSERT INTO cm_batch_taxonomy_resolutions (job_id,taxonomy_type,provider,external_id,external_key,resolution_status) VALUES (?,'subjects','fixture','subject-new','new-subject','creation_proposed')");
        $stmt->execute([$jobId]);
        $stmt=$db->prepare("INSERT INTO cm_batch_import_items (job_id,entity_type,external_key,action,status) VALUES (?,'question','queue-fixture','create','planned')");
        $stmt->execute([$jobId]);
        $stmt=$db->prepare("INSERT INTO cm_batch_import_items (job_id,entity_type,external_key,action,status) VALUES (?,'question','queue-blocked-fixture','blocked','planned')");
        $stmt->execute([$jobId]);
        $queue=new CmBatchQueueService($db,'admin');
        $queue->approve($jobId,hash('sha256',$queuePlan),hash_file('sha256',$argv[1]));
        $createdId=(int)$db->query("SELECT id FROM filters WHERE slug='nova-materia'")->fetchColumn();
        if($createdId<1 || (int)$db->query("SELECT filter_id FROM filter_source_identities WHERE source_external_id='subject-new'")->fetchColumn()!==$createdId)throw new RuntimeException('Approved taxonomy proposal was not created and mapped');
        $blockedStatus=$db->query("SELECT status FROM cm_batch_import_items WHERE job_id=".$db->quote($jobId)." AND external_key='queue-blocked-fixture'")->fetchColumn();
        if($blockedStatus!=='blocked')throw new RuntimeException('Blocked item entered the import queue');
        $queue->transition($jobId,'pause');
        $result=$queue->processOne($jobId,static function():array { throw new RuntimeException('Paused worker ran'); });
        if($result['status']!=='paused') throw new RuntimeException('Pause ignored');
        $queue->transition($jobId,'resume');
        $queue->processOne($jobId,static function(array $job,array $item,PDO $connection):array {
            $connection->exec("UPDATE filters SET description='Must roll back' WHERE id=41");
            throw new DomainException('Invalid fixture');
        });
        if($db->query('SELECT description FROM filters WHERE id=41')->fetchColumn()!==null) throw new RuntimeException('Failed executor left canonical writes');
        $queue->transition($jobId,'retry');
        $result=$queue->processOne($jobId,static function(array $job,array $item,PDO $connection):array {
            $connection->exec("UPDATE filters SET description='Committed with checkpoint' WHERE id=41");
            return ['canonicalId'=>41];
        });
        if($result['status']!=='completed') throw new RuntimeException('Queue not completed');
        $result=$queue->processOne($jobId,static function():array { throw new RuntimeException('Completed item repeated'); });
        if($result['status']!=='completed') throw new RuntimeException('Completed replay failed');
        echo "Queue: PASS (approval binding, selective blocked-item skip, pause/resume, atomic rollback, retry, checkpoint replay)\n";
    }
} finally {
    $db->exec("DROP DATABASE `$schema`");
}
