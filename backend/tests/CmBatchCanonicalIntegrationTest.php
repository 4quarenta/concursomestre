<?php
declare(strict_types=1);
require_once __DIR__.'/../modules/questions/repositories/QuestionsRepository.php';
require_once __DIR__.'/../modules/questions/validators/QuestionsValidator.php';
require_once __DIR__.'/../modules/questions/services/QuestionsRewardService.php';
require_once __DIR__.'/../modules/questions/services/QuestionsService.php';

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
    $exam2017=$repository->saveCmBatchExam(array_merge($examRecord,['nome'=>'FUNECE','slug'=>'funece','ano'=>2017]),'gran','26558','',$job);
    $db->commit();
    if($examA===$examB || $examA!==$examRepeat)throw new RuntimeException('Exam identity conflated titles or duplicated replay');
    if((int)$db->query('SELECT ano FROM provas WHERE id='.$exam2017)->fetchColumn()!==2017)throw new RuntimeException('Actual exam year lost');
    if((int)$db->query("SELECT COUNT(*) FROM provas WHERE id IN ($examA,$examB,$exam2017) AND status_editorial='draft' AND visibility_status='internal'")->fetchColumn()!==3)throw new RuntimeException('Exam auto published');
    $db->beginTransaction();
    try {
        $repository->saveCmBatchExam(array_merge($examRecord,['ano'=>1998]),'gran','26558','',$job);
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
    echo "CmBatchCanonicalIntegrationTest: PASS (direct Gran source_external_id lookup, canonical options/editorial, N:N, private drafts, no active unverified answer)\n";
} finally {
    if($db->inTransaction())$db->rollBack();
    $db->exec("DROP DATABASE `$schema`");
}
