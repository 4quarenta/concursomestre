<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../modules/admin/services/CmZipImportService.php';

header('Cache-Control: private, no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Content-Type: application/json; charset=UTF-8');

function cmZipRespond(int $code, array $body): never
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    if ((string)(getenv('CM_ZIP_IMPORT_ENABLED') ?: '') !== '1') {
        cmZipRespond(404, ['success'=>false,'message'=>'Importador temporario desativado.']);
    }
    $db=(new Database())->getConnection();
    // Auth, role admin (staff excluded), audit infrastructure and token validation.
    $ctx=requirePlatformAdminSessionContext($db);
    $service=new CmZipImportService($db,(string)$ctx['admin_user_id']);
    $method=strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method==='GET') {
        $id=trim((string)($_GET['runId'] ?? ''));
        cmZipRespond(200,['success'=>true,'data'=>$id!==''?$service->status($id):['enabled'=>true,'contracts'=>['cm-batch.v1','question-import.v2']]]);
    }
    if ($method!=='POST') cmZipRespond(405,['success'=>false,'message'=>'Metodo nao permitido.']);
    $action=trim((string)($_POST['action'] ?? ''));
    if ($action==='upload') {
        $data=$service->upload(is_array($_FILES['archive'] ?? null)?$_FILES['archive']:[]);
        logAdminAudit($db,(string)$ctx['admin_user_id'],'zip_import.upload','exam_import',$data['runId'],[
            'exams'=>count($data['inventory']['exams']??[]),
            'filesVerified'=>$data['inventory']['filesVerified']??0,
        ]);
        cmZipRespond(200,['success'=>true,'data'=>$data]);
    }
    $raw=(string)file_get_contents('php://input');
    if (strlen($raw)>20000) cmZipRespond(413,['success'=>false,'message'=>'Requisicao muito grande.']);
    $input=json_decode($raw,true);
    if (!is_array($input)) throw new InvalidArgumentException('Corpo JSON invalido.');
    $action=(string)($input['action']??'');
    $id=(string)($input['runId']??'');
    if ($action==='status') cmZipRespond(200,['success'=>true,'data'=>$service->status($id)]);
    if ($action==='preview') {
        @set_time_limit(240);
        $exam=(string)($input['examKey']??'');
        $data=$service->preview($id,$exam);
        cmZipRespond(200,['success'=>true,'data'=>$data]);
    }
    if ($action==='process') {
        @set_time_limit(240);
        $exam=(string)($input['examKey']??'');
        $allow=($input['allowUnverifiedPublication']??false)===true;
        $data=$service->process($id,$exam,$allow);
        logAdminAudit($db,(string)$ctx['admin_user_id'],'zip_import.process','exam_import',$exam,[
            'runId'=>$id,'status'=>$data['status']??'unknown',
            'created'=>$data['sentToCanonical']??0,
            'existing'=>$data['existingQuestions']??0,
        ]);
        cmZipRespond(200,['success'=>true,'data'=>$data]);
    }
    throw new InvalidArgumentException('Acao invalida.');
} catch (InvalidArgumentException | DomainException $e) {
    cmZipRespond($e instanceof DomainException?403:422,['success'=>false,'message'=>$e->getMessage()]);
} catch(Throwable $e) {
    error_log('[cm_zip_import] '.get_class($e).': '.$e->getMessage());
    cmZipRespond(500,['success'=>false,'message'=>'Falha no processamento. Confira os logs internos e a configuracao do importador.']);
}
