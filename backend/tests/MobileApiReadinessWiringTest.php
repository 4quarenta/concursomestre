<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/http/Request.php';
require_once __DIR__ . '/../modules/questions/services/QuestionOutputPolicy.php';

function mobileApiAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function mobileApiRead(string $relativePath): string
{
    $contents = file_get_contents(dirname(__DIR__) . '/../' . $relativePath);
    if (!is_string($contents)) {
        throw new RuntimeException('Arquivo ausente: ' . $relativePath);
    }

    return $contents;
}

$authRoutes = mobileApiRead('backend/modules/auth/routes.php');
$authService = mobileApiRead('backend/modules/auth/services/AuthService.php');
$authSession = mobileApiRead('backend/shared/auth/AuthSession.php');
$questionRoutes = mobileApiRead('backend/modules/questions/routes.php');
$cors = mobileApiRead('backend/config/cors.php');
$mobileClient = mobileApiRead('mobile/src/api/client.ts');
$mobileSession = mobileApiRead('mobile/src/storage/sessionStorage.ts');
$mobileEndpoints = mobileApiRead('mobile/src/api/endpoints.ts');
$mobileQuestions = mobileApiRead('mobile/src/services/questions/questionService.ts');
$mobileProvider = mobileApiRead('mobile/src/providers/AuthProvider.tsx');
$mobileApp = mobileApiRead('mobile/app.json');

foreach (['handleAuthLoginRoute', 'handleAuthRegisterRoute', 'handleAuthLogoutRoute', 'handleAuthRefreshRoute', 'handleAuthVerifyTwoFactorRoute'] as $handler) {
    $offset = strpos($authRoutes, 'function ' . $handler);
    mobileApiAssert($offset !== false, 'Handler mobile ausente: ' . $handler);
    $slice = substr($authRoutes, $offset, 1800);
    mobileApiAssert(str_contains($slice, "requireAuthRequestMethod('POST')"), $handler . ' deve ser POST-only.');
}

mobileApiAssert(str_contains($authRoutes, "'concursomestre-mobile'"), 'Contrato nativo precisa de negociacao explicita.');
mobileApiAssert(str_contains($authRoutes, "HTTP_ORIGIN") && str_contains($authRoutes, "=== ''"), 'Contrato nativo deve falhar fechado para origem de browser.');
mobileApiAssert(str_contains($authRoutes, 'readNativeMobileAuthCredentials'), 'Refresh/logout nativo precisam validar credenciais explicitas.');
mobileApiAssert(str_contains($authService, 'refreshNativeAccessToken'), 'Service deve usar refresh nativo autoritativo.');
mobileApiAssert(str_contains($authSession, 'bool $setBrowserCookies = true'), 'Nucleo deve separar cookies web do transporte nativo.');
mobileApiAssert(str_contains($authSession, 'function refreshNativeAccessToken'), 'Refresh nativo deve reutilizar rotacao/reuse detection.');
mobileApiAssert(str_contains($authSession, 'revokeSessionFamily'), 'Logout/reuse devem revogar a familia de sessao.');

foreach (['handleQuestionsV2ListRoute' => 'GET', 'handleQuestionsV2ShowRoute' => 'GET', 'handleQuestionsV2AdminShowRoute' => 'GET', 'handleQuestionsV2AnswerRoute' => 'POST'] as $handler => $method) {
    $offset = strpos($questionRoutes, 'function ' . $handler);
    mobileApiAssert($offset !== false, 'Handler v2 ausente: ' . $handler);
    $slice = substr($questionRoutes, $offset, 1700);
    mobileApiAssert(str_contains($slice, "!== '{$method}'"), $handler . ' deve restringir o metodo ' . $method . '.');
}

$policy = new QuestionOutputPolicy();
$publicQuestion = $policy->forRead([
    'id' => 10,
    'alternatives' => [
        ['id' => 100, 'text' => 'A', 'isCorrect' => true],
        ['id' => 101, 'text' => 'B', 'is_correct' => false],
    ],
    'answer' => ['correctAlternativeId' => 100],
    'correctOptionIndex' => 0,
    'teacherComment' => 'protegido',
    'raw_json' => '{"answer":100}',
], false, false, false);
$publicJson = json_encode($publicQuestion, JSON_THROW_ON_ERROR);
foreach (['answer', 'correctAlternativeId', 'correctOptionIndex', 'isCorrect', 'is_correct', 'teacherComment', 'raw_json'] as $forbidden) {
    mobileApiAssert(!str_contains($publicJson, $forbidden), 'DTO publico vazou ' . $forbidden . '.');
}

mobileApiAssert(!str_contains($cors, 'Access-Control-Allow-Origin: *'), 'CORS autenticado nao pode usar wildcard.');
mobileApiAssert(str_contains($cors, "Cache-Control: no-store, private"), 'Requests autenticadas precisam de no-store.');
mobileApiAssert(str_contains($cors, 'X-Client-Platform'), 'Preflight deve conhecer o header de contrato do cliente.');
mobileApiAssert(str_contains($cors, 'Idempotency-Key'), 'Preflight deve permitir chave idempotente.');

foreach (['REFRESH_TOKEN_KEY', 'CSRF_TOKEN_KEY', 'SecureStore.setItemAsync', 'SecureStore.deleteItemAsync'] as $expected) {
    mobileApiAssert(str_contains($mobileSession, $expected), 'SecureStore mobile incompleto: ' . $expected);
}
mobileApiAssert(str_contains($mobileClient, 'refreshInFlight'), 'Refresh mobile deve ser single-flight.');
mobileApiAssert(str_contains($mobileClient, 'await sessionStorage.clearSession();'), 'Falha autenticada deve limpar a sessao nativa.');
mobileApiAssert(str_contains($mobileClient, "'X-Client-Platform': 'concursomestre-mobile'"), 'Cliente mobile deve negociar contrato nativo.');
mobileApiAssert(str_contains($mobileClient, 'refreshToken') && str_contains($mobileClient, 'csrfToken'), 'Cliente mobile deve rotacionar credenciais completas.');
mobileApiAssert((bool) preg_match('/submit:\s*["\']v2\\/questions\\/answer\\.php["\']/', $mobileEndpoints), 'Resposta mobile deve usar endpoint v2 idempotente.');
mobileApiAssert(str_contains($mobileQuestions, 'Math.min(50, pageSize)') && !str_contains($mobileQuestions, 'while (allRows.length < total)'), 'Carga mobile de questoes deve ser limitada por request.');
mobileApiAssert(str_contains($mobileProvider, 'verifyTwoFactor'), 'Mobile deve concluir 2FA no backend.');
mobileApiAssert(!str_contains($mobileApp, 'localhost'), 'Build mobile nao pode conter endpoint localhost.');

Request::setRawBodyForTesting('{malformed');
try {
    Request::json();
    throw new RuntimeException('JSON malformado foi aceito.');
} catch (InvalidArgumentException) {
}

Request::setRawBodyForTesting('["unexpected"]');
try {
    Request::json();
    throw new RuntimeException('Lista JSON foi aceita como objeto.');
} catch (InvalidArgumentException) {
}
Request::setRawBodyForTesting(null);

$apiFiles = [];
$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator(dirname(__DIR__) . '/api', FilesystemIterator::SKIP_DOTS)
);
foreach ($iterator as $file) {
    if ($file->isFile() && strtolower($file->getExtension()) === 'php') {
        $apiFiles[] = $file->getPathname();
    }
}
mobileApiAssert(count($apiFiles) >= 280, 'Inventario HTTP perdeu bridges sem revisao explicita.');

fwrite(STDOUT, "MobileApiReadinessWiringTest: PASS (" . count($apiFiles) . " PHP endpoints)\n");
