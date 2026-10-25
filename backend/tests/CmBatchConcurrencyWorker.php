<?php
declare(strict_types=1);
require_once __DIR__.'/../modules/questions/repositories/QuestionsRepository.php';
$schema=(string)($argv[1]??'');
if(!preg_match('/^cm_batch_test_[a-f0-9]{12}$/',$schema)) throw new InvalidArgumentException('Disposable schema required');
$db=new PDO('mysql:host=127.0.0.1;port=33317;dbname='.$schema.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec('SET SESSION innodb_lock_wait_timeout=10');
$db->beginTransaction();
try {
    $repository=new QuestionsRepository($db);
    $id=$repository->syncCmBatchQuestionOccurrence(1,30,['provider'=>'fixture','externalExamId'=>'C','questionNumber'=>'9','answerKey'=>'A','answerStatus'=>'unverified']);
    $repository->syncQuestionSourceIdentity(1,'fixture','shared-concurrent');
    $db->commit();
    echo $id;
} catch(Throwable $error) {
    if($db->inTransaction())$db->rollBack();
    throw $error;
}
