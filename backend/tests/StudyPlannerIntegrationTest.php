<?php
declare(strict_types=1);
require_once __DIR__ . '/../modules/study_schedule/services/StudyPlannerService.php';
require_once __DIR__ . '/StudyPlanEngineTest.php';

// Run only against this dedicated disposable schema, never the application database.
$cnf = parse_ini_file($argv[1], true, INI_SCANNER_RAW)['client'];
$db = new PDO('mysql:host=' . ($cnf['host'] ?? 'localhost'), $cnf['user'], $cnf['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$database = 'cm_planner_test_' . bin2hex(random_bytes(5));
$db->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
try {
    $db->exec("USE `$database`");
    $db->exec('CREATE TABLE users (id VARCHAR(36) PRIMARY KEY, plan VARCHAR(30))');
    $db->exec("INSERT INTO users VALUES ('alice','Elite'),('bob','Elite'),('free','Gratuito')");
    $db->exec('CREATE TABLE user_study_schedules (user_id VARCHAR(36) PRIMARY KEY,form_json TEXT,plan_json TEXT,generated_at DATETIME,saved_at DATETIME,created_at DATETIME,updated_at DATETIME)');
    $db->exec('CREATE TABLE user_answers (id INT PRIMARY KEY,user_id VARCHAR(36),question_id INT,is_correct INT,created_at DATETIME)');
    $db->exec('CREATE TABLE user_answers_archive LIKE user_answers');
    $db->exec('CREATE TABLE question_filters (question_id INT,filter_id INT)');
    $db->exec('CREATE TABLE filters (id INT PRIMARY KEY,name VARCHAR(100),type VARCHAR(20),meta_materia INT,taxonomy_level VARCHAR(20))');
    $migration = require __DIR__ . '/../database/migrations/20261022_120000_study_planner.php';
    $migration($db); $migration($db);
    $alice = new StudyPlannerService($db, 'alice', false);
    $bob = new StudyPlannerService($db, 'bob', false);
    $config = $config ?? [];
    $config['startDate'] = (new DateTimeImmutable('today',new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
    $config['examDate'] = (new DateTimeImmutable('+60 days'))->format('Y-m-d');
    $result = $alice->write(['action'=>'create','config'=>$config]);
    $plan = $result['plan'];
    checkPlan(count($plan['sessions'])>0,'No sessions persisted');
    checkPlan($plan['sessions'][0]['ordinal']===0,'Session order lost');
    try { $bob->read(['id'=>$plan['id']]); throw new Exception('Cross-user read accepted'); } catch(OutOfBoundsException) {}
    try { (new StudyPlannerService($db,'free',false))->read([]); throw new Exception('Free access accepted'); } catch(DomainException) {}
    try { $alice->write(['action'=>'status','id'=>$plan['id'],'revision'=>0,'status'=>'paused']); throw new Exception('Stale revision accepted'); } catch(UnexpectedValueException) {}
    $session=$plan['sessions'][0];
    $payload=['action'=>'session','id'=>$plan['id'],'revision'=>$plan['revision'],'sessionId'=>$session['id'],'operation'=>'start'];
    $plan=$alice->write($payload)['plan'];
    $other=$alice->write(['action'=>'create','config'=>$config])['plan'];
    try { $alice->write(['action'=>'session','id'=>$other['id'],'revision'=>$other['revision'],'sessionId'=>$other['sessions'][0]['id'],'operation'=>'start']); throw new Exception('Concurrent plan activity accepted'); } catch(InvalidArgumentException) {}
    try { $alice->write(['action'=>'status','id'=>$plan['id'],'revision'=>$plan['revision'],'status'=>'archived']); throw new Exception('Running activity archived'); } catch(InvalidArgumentException) {}
    $payload['revision']=$plan['revision']; $payload['operation']='complete';
    $plan=$alice->write($payload)['plan'];
    checkPlan($plan['sessions'][0]['status']==='completed','Completion lost');
    $plan=$alice->write(['action'=>'revise','id'=>$plan['id'],'revision'=>$plan['revision'],'config'=>$config])['plan'];
    checkPlan(count(array_filter($plan['sessions'],fn($s)=>$s['id']===$session['id']&&$s['status']==='completed'))===1,'Revision erased completed session');
    $db->exec("INSERT INTO filters VALUES (1,'A','assunto',1,'materia')");
    $db->exec('INSERT INTO question_filters VALUES (1,1),(2,1)');
    $db->exec("INSERT INTO user_answers_archive VALUES (1,'alice',1,0,DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY))");
    $db->exec("INSERT INTO user_answers VALUES (2,'alice',1,1,UTC_TIMESTAMP()),(3,'alice',2,1,UTC_TIMESTAMP())");
    $stats=$alice->read(['id'=>$plan['id']])['performance']['A'];
    checkPlan($stats['total']===1&&$stats['correct']===1,'Repeat counted as first response');
    $admin=new StudyPlannerService($db,'alice',true);
    $config['sourceUrl']='https://example.com/edital';
    $admin->write(['action'=>'template','config'=>$config,'status'=>'published']);
    checkPlan(count($alice->read([])['templates'])===1,'Published template missing');
    checkPlan(count($bob->read([])['plans'])===0,'Private plans leaked');
    echo "Integration passed: persistence, ownership, entitlement, revisions, history preservation, archive deduplication, template publication.\n";
} finally { $db->exec("DROP DATABASE `$database`"); }
