<?php
declare(strict_types=1);
require_once __DIR__.'/../modules/questions/repositories/QuestionsRepository.php';
require_once __DIR__.'/../modules/questions/validators/QuestionsValidator.php';
require_once __DIR__.'/../modules/questions/services/QuestionsRewardService.php';
require_once __DIR__.'/../modules/questions/services/QuestionsService.php';
require_once __DIR__.'/../modules/ingestion/services/CmBatchQueueService.php';

$schemaFile=$argv[1]??'';
if(!is_file($schemaFile))throw new InvalidArgumentException('Provide schema-only fixture');
$db=new PDO('mysql:host=127.0.0.1;port=33317;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$schema='cm_batch_test_'.bin2hex(random_bytes(6));
$db->exec("CREATE DATABASE `$schema` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$testStorage=sys_get_temp_dir().DIRECTORY_SEPARATOR.$schema;
mkdir($testStorage,0700);
putenv('SITEMAP_OUTPUT_DIR='.$testStorage);
try {
    $db->exec("USE `$schema`");
    // Local XAMPP is MariaDB; keep table definitions, adapt MySQL 8-only collation for this test.
    $db->exec(str_replace('utf8mb4_0900_ai_ci','utf8mb4_unicode_ci',file_get_contents($schemaFile)));
    $migration=require __DIR__.'/../database/migrations/20261025_010000_cm_batch_import.php';
    $migration($db);
    $db->exec("INSERT INTO provas (id,nome,slug,ano) VALUES (1,'A','fixture-a',1998),(2,'B','fixture-b',1998)");
    $db->exec("INSERT INTO filters (id,type,name,slug,meta_materia,taxonomy_level) VALUES (1,'assunto','Portugues','fixture-portuguese',1,'materia')");
    $repository=new QuestionsRepository($db);
    $job='11111111-1111-4111-8111-111111111111';
    $examRecord=['nome'=>'ESAF - Analista - Reservas','slug'=>'esaf-analista-reservas','ano'=>1998];
    $db->beginTransaction();
    $examA=$repository->saveCmBatchExam($examRecord,'gran','4622','',$job);
    $examB=$repository->saveCmBatchExam($examRecord,'gran','4623','',$job);
    $examRepeat=$repository->saveCmBatchExam($examRecord,'gran','4622','',$job);
    $exam2017=$repository->saveCmBatchExam(array_merge($examRecord,['nome'=>'FUNECE','slug'=>'funece','ano'=>2017]),'gran','26559','',$job);
    $db->commit();
    if($examA===$examB || $examA!==$examRepeat)throw new RuntimeException('Exam identity conflated titles or duplicated replay');
    if((int)$db->query('SELECT ano FROM provas WHERE id='.$exam2017)->fetchColumn()!==2017)throw new RuntimeException('Actual exam year lost');
    if((int)$db->query("SELECT COUNT(*) FROM provas WHERE id IN ($examA,$examB,$exam2017) AND status_editorial='draft' AND visibility_status='internal'")->fetchColumn()!==3)throw new RuntimeException('Exam auto published');
    $db->beginTransaction();
    try {
        $repository->saveCmBatchExam(array_merge($examRecord,['ano'=>1998]),'gran','26559','',$job);
        throw new RuntimeException('Conflicting exam year accepted');
    } catch(DomainException $expected) {
        $db->rollBack();
    }
    $db->exec("UPDATE provas SET source_provider='legacy',source_external_id='A',status_editorial='published',visibility_status='public' WHERE id=1");
    $db->beginTransaction();
    $legacy=$repository->saveCmBatchExam($examRecord,'legacy','A','',$job);
    $db->commit();
    if($legacy!==1 || $db->query('SELECT status_editorial FROM provas WHERE id=1')->fetchColumn()!=='published')throw new RuntimeException('Legacy exam identity or reviewed status lost');
    $service=new QuestionsService($repository,new QuestionsValidator(),new QuestionsRewardService($repository),$db);
    $question=['tempId'=>'q1','content'=>['statement'=>'<p>Quanto vale 2<sup>3</sup>?</p>'],'type'=>'single_choice','difficulty'=>'easy','assets'=>[],
        'source'=>['questionNumber'=>12],'filters'=>[],
        'alternatives'=>[['tempId'=>'a','label'=>'A','order'=>1,'text'=>'8'],['tempId'=>'b','label'=>'B','order'=>2,'text'=>'6']],
        'answer'=>['raw'=>'A','correctAlternativeTempIds'=>['a']],
        'editorial'=>[['type'=>'teacher_comment','body'=>'Comentario ainda nao conferido','status'=>'published']],
        'review'=>['required'=>true],'publication'=>['status'=>'published','visibility'=>'public']];
    $job='11111111-1111-4111-8111-111111111111';
    $occurrence=['provider'=>'gran','externalExamId'=>'A','externalQuestionId'=>'q1','questionNumber'=>'12','answerKey'=>'A'];
    $db->beginTransaction();
    $first=$service->importCmBatchDraftQuestion('admin',$job,1,$question,[],[],['subjects'=>[1]],$occurrence);
    $db->commit();
    $removeAuxiliaryIdentity=$db->prepare('DELETE FROM question_source_identities WHERE question_id=?');
    $removeAuxiliaryIdentity->execute([$first['canonicalId']]);
    $db->beginTransaction();
    $second=$service->importCmBatchDraftQuestion('admin',$job,2,$question,[],[],['subjects'=>[1]],array_merge($occurrence,['externalExamId'=>'B','questionNumber'=>'35','answerKey'=>'B']));
    $db->commit();
    if($first['canonicalId']!==$second['canonicalId'])throw new RuntimeException('Canonical question was copied');
    if((int)$db->query('SELECT COUNT(*) FROM questions')->fetchColumn()!==1)throw new RuntimeException('More than one canonical question');
    if((int)$db->query('SELECT COUNT(*) FROM question_provas')->fetchColumn()!==2)throw new RuntimeException('Wrong number of occurrences');
    $row=$db->query('SELECT publish_status,visibility_status,resposta_correta_item_index FROM questions')->fetch(PDO::FETCH_ASSOC);
    if($row['publish_status']!=='draft'||$row['visibility_status']!=='internal'||(int)$row['resposta_correta_item_index']!==-1)throw new RuntimeException('Unreviewed answer or publication leaked');
    if((int)$db->query('SELECT SUM(is_correct) FROM question_options')->fetchColumn()!==0)throw new RuntimeException('Unverified canonical answer persisted');
    $source=$db->query("SELECT source_provider,source_external_id FROM questions WHERE id=".(int)$first['canonicalId'])->fetch(PDO::FETCH_ASSOC);
    if($source!==['source_provider'=>'gran','source_external_id'=>'q1'])throw new RuntimeException('Gran identity was not stored on the canonical question');
    if($db->query('SELECT status FROM question_editorials')->fetchColumn()!=='draft')throw new RuntimeException('Editorial auto approved');
    $question['editorial']=[['type'=>'teacher_comment','body'=>'Replacement must not overwrite'],['type'=>'detailed_analysis','body'=>'Missing analysis added']];
    for($i=0;$i<2;$i++) {
        $db->beginTransaction();
        $enriched=$service->importCmBatchDraftQuestion('admin',$job,1,$question,[],[],['subjects'=>[1]],$occurrence);
        $db->commit();
        if($enriched['canonicalId']!==$first['canonicalId'])throw new RuntimeException('Enrichment copied question');
    }
    if($db->query("SELECT body FROM question_editorials WHERE editorial_type='teacher_comment'")->fetchColumn()!=='Comentario ainda nao conferido')throw new RuntimeException('Existing comment overwritten');
    if($db->query("SELECT body FROM question_editorials WHERE editorial_type='detailed_analysis'")->fetchColumn()!=='Missing analysis added')throw new RuntimeException('Missing analysis not added');
    if((int)$db->query('SELECT COUNT(*) FROM question_editorials')->fetchColumn()!==2)throw new RuntimeException('Editorial replay duplicated rows');
    $legacyMetadata=json_encode(['source'=>'bulk_import_pdf','sourceProvider'=>'gran','sourceExternalId'=>'26558']);
    $stmt=$db->prepare("INSERT INTO provas (nome,slug,ano,source_provider,source_external_id,status_editorial,visibility_status,metadata_json) VALUES ('FUNECE - Civil - 1998','legacy-funece',1998,'gran','26558','published','public',?)");
    $stmt->execute([$legacyMetadata]);$legacyExam=(int)$db->lastInsertId();
    $corrected=['nome'=>'FUNECE - Civil - 2017','ano'=>2017,'updated_by_user_id'=>'admin','metadata_json'=>json_encode(['sourceDocument'=>[
        'source'=>['provider'=>'gran','externalExamId'=>'26558','catalogNameOriginal'=>'FUNECE - Civil - 1998'],
        'identity'=>['originalYear'=>1998,'canonicalYear'=>2017], 'metadata'=>['dataProva'=>'2017-02-12'],
        'evidence'=>[['field'=>'dataProva','value'=>'2017-02-12','source'=>'Official answer sheet page 7','status'=>'verified']],
    ]])];
    $unverified=$corrected;$unverified['metadata_json']='{}';
    $db->beginTransaction();
    try {$repository->saveCmBatchExam($unverified,'gran','26558','',$job);throw new RuntimeException('Unverified year overwritten');}
    catch(DomainException){$db->rollBack();}
    for($i=0;$i<2;$i++){
        $db->beginTransaction();$repaired=$repository->saveCmBatchExam($corrected,'gran','26558','',$job);$db->commit();
        if($repaired!==$legacyExam)throw new RuntimeException('Legacy exam duplicated');
    }
    $exam=$db->query('SELECT ano,status_editorial,visibility_status FROM provas WHERE id='.$legacyExam)->fetch(PDO::FETCH_ASSOC);
    if((int)$exam['ano']!==2017||$exam['status_editorial']!=='published'||$exam['visibility_status']!=='public')throw new RuntimeException('Repair changed publication or failed to repair year');
    if((int)$db->query("SELECT COUNT(*) FROM cm_batch_field_audit WHERE merge_reason='repair_legacy_catalog_year_from_verified_exam_date'")->fetchColumn()!==2)throw new RuntimeException('Repair audit missing or duplicated');
    $archive=tempnam(sys_get_temp_dir(),'cm-dependency-');file_put_contents($archive,'fixture');
    try {
        $stmt=$db->prepare("INSERT INTO cm_batch_import_jobs (job_id,batch_id,archive_sha256,source_provider,dataset_label,archive_path,status,manifest_json,dry_run_json,actor_user_id,approved_by_user_id,approved_at) VALUES (?,'dependency',?,'gran','Dependency test',?,'completed','{}','{}','admin','admin',CURRENT_TIMESTAMP)");
        $stmt->execute([$job,hash_file('sha256',$archive),$archive]);
        $insert=$db->prepare("INSERT INTO cm_batch_import_items (job_id,entity_type,external_key,action,status,diagnostics_json) VALUES (?,?,?,?,?,?)");
        $insert->execute([$job,'exam','gran:26558','link','blocked',json_encode(['message'=>'Ano oficial diverge da prova existente.'])]);
        $insert->execute([$job,'question','gran:26558:q14','enrich','blocked',json_encode(['message'=>'Prova ainda nao foi materializada; o checkpoint da prova precisa concluir primeiro.'])]);
        $insert->execute([$job,'question','gran:26558:conflict','blocked','blocked',json_encode(['message'=>'gran_external_id_content_conflict'])]);
        $insert->execute([$job,'question','gran:26558:done','link','done','{}']);
        $queue=new CmBatchQueueService($db,'admin');$queue->transition($job,'retry_dependencies');
        if((int)$db->query("SELECT COUNT(*) FROM cm_batch_import_items WHERE status='planned'")->fetchColumn()!==2)throw new RuntimeException('Wrong dependency retry scope');
        $queue->processOne($job,static function(array $job,array $item)use($legacyExam):array{
            if($item['entity_type']!=='exam')throw new RuntimeException('Child scheduled before exam');
            return ['canonicalId'=>$legacyExam];
        });
        $queue->processOne($job,static function(array $job,array $item)use($first):array{
            if($item['external_key']!=='gran:26558:q14')throw new RuntimeException('Conflict or completed item retried');
            return ['canonicalId'=>$first['canonicalId']];
        });
        if((int)$db->query("SELECT COUNT(*) FROM cm_batch_import_items WHERE status='blocked'")->fetchColumn()!==1)throw new RuntimeException('Content conflict unblocked');
    } finally {unlink($archive);}
    echo "CmBatchCanonicalIntegrationTest: PASS (Gran identity, N:N, additive editorial, legacy year repair audit/replay, dependency retry ordering, conflict preservation)\n";
} finally {
    if($db->inTransaction())$db->rollBack();
    $db->exec("DROP DATABASE `$schema`");
}
