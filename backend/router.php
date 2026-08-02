<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

/**
 * Roteador central da API.
 *
 * Objetivos desta versão:
 * - reutilizar a configuração oficial de CORS da aplicação
 * - manter compatibilidade com URLs achatadas legadas
 * - impedir que arquivos arbitrários dentro de /api sejam executados via fallback
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/shared/http/LegacyEndpointDeprecation.php';

/**
 * Normaliza o caminho requisitado depois de /api/.
 */
function resolveApiRoutePath(string $requestUri, string $base): string
{
    if (strpos($requestUri, $base) !== false) {
        $parts = explode($base, $requestUri, 2);
        return explode('?', $parts[1] ?? '')[0];
    }

    return basename((string) parse_url($requestUri, PHP_URL_PATH));
}

/**
 * Define quais caminhos legados ainda podem ser acessados por fallback.
 * Isso preserva compatibilidade sem reabrir scripts de teste/debug.
 */
function isAllowedLegacyApiPath(string $path): bool
{
    $normalizedPath = ltrim($path, '/');
    if ($normalizedPath === '') {
        return false;
    }

    if (!preg_match('/^[a-z0-9_\\/-]+(?:\\.php)?$/i', $normalizedPath)) {
        return false;
    }

    $normalizedWithoutExtension = preg_replace('/\\.php$/i', '', $normalizedPath);
    $blockedFragments = [
        'debug',
        'test',
        'check',
        'dump',
        'manual_fix',
        'db_check',
        'settings_debug',
        'temp',
    ];

    foreach ($blockedFragments as $blockedFragment) {
        if (stripos($normalizedWithoutExtension, $blockedFragment) !== false) {
            return false;
        }
    }

    $allowedPrefixes = [
        'auth/',
        'questions/',
        'comments/',
        'notifications/',
        'rankings/',
        'materials/',
        'simulations/',
        'users/',
        'reports/',
        'filters/',
        'transactions/',
        'subscriptions/',
        'feedback/',
        'admin/',
        'statistics/',
        'plans/',
        'payments/',
        'tasks/',
        'system/',
        'setup/',
    ];

    foreach ($allowedPrefixes as $allowedPrefix) {
        if (str_starts_with($normalizedWithoutExtension, $allowedPrefix)) {
            return true;
        }
    }

    return false;
}

$uri = (string) ($_SERVER['REQUEST_URI'] ?? '');
$base = '/questao-pro-backend/api/';
$path = resolveApiRoutePath($uri, $base);

$routes = [
    // Auth
    'authLogin' => 'api/auth/login.php',
    'authRegister' => 'api/auth/register.php',
    'authLogout' => 'api/auth/logout.php',
    'authRefresh' => 'api/auth/refresh.php',
    'authGoogle' => 'api/auth/google.php',
    'authUser' => 'api/auth/me.php',

    // Questions
    'questionsList' => 'api/questions/list.php',
    'questionsCreate' => 'api/questions/save.php',
    'questionsExamImport' => 'api/questions/exam_import.php',
    'questionsBulkImport' => 'api/questions/bulk_import.php',
    'questionsMultiBatchImport' => 'api/questions/multi_batch_import.php',
    'questionsSave' => 'api/questions/save.php',
    'questionsUpdate' => 'api/questions/update.php',
    'questionsDelete' => 'api/questions/delete.php',
    'questionsAnswer' => 'api/questions/answer.php',
    'questionsFilter' => 'api/questions/filter.php',
    'questionsStats' => 'api/questions/get_stats.php',
    'questionsHistory' => 'api/questions/history.php',
    'questionsToggleSave' => 'api/questions/toggle_save.php',
    'questionsResetAnswers' => 'api/questions/reset_answers.php',

    // Comments
    'commentsList' => 'api/comments/list.php',
    'commentsHandle' => 'api/comments/handle.php',
    'commentsAdd' => 'api/comments/add.php',
    'commentsLike' => 'api/comments/like.php',
    'commentsReport' => 'api/comments/report.php',

    // Notifications
    'notificationsList' => 'api/notifications/list.php',
    'notificationsMarkRead' => 'api/notifications/mark_read.php',
    'notificationsMarkAllRead' => 'api/notifications/mark_all_read.php',
    'notificationsDelete' => 'api/notifications/delete.php',
    'notificationsClearAll' => 'api/notifications/clear_all.php',
    'notificationsRestore' => 'api/notifications/restore.php',
    'notificationsPermanentDelete' => 'api/notifications/permanent-delete.php',
    'notificationsSend' => 'api/notifications/send.php',

    // Rankings
    'rankingsList' => 'api/rankings/list.php',
    'rankingsCreate' => 'api/rankings/create.php',
    'rankingsJoin' => 'api/rankings/join.php',
    'rankingsUpdate' => 'api/rankings/update.php',
    'rankingsDelete' => 'api/rankings/delete.php',

    // Materials
    'materialsList' => 'api/materials/list.php',
    'materialsCreate' => 'api/materials/create.php',
    'materialsUpdate' => 'api/materials/update.php',
    'materialsDelete' => 'api/materials/delete.php',
    'materialsModerate' => 'api/materials/moderate.php',
    'materialsRate' => 'api/materials/rate.php',

    // Marketplace
    'marketplaceList' => 'api/marketplace/list.php',
    'marketplacePurchase' => 'api/marketplace/purchase.php',
    'marketplaceCreate' => 'api/marketplace/create.php',
    'marketplaceUserTransactions' => 'api/marketplace/user-transactions.php',
    'marketplaceProcessTransaction' => 'api/marketplace/process-transaction.php',
    'marketplaceRefund' => 'api/marketplace/request-refund.php',
    'marketplaceMyMaterials' => 'api/marketplace/my-materials.php',

    // Simulations
    'simulationsList' => 'api/simulations/list.php',
    'simulationsCreate' => 'api/simulations/create.php',
    'simulationsSubmit' => 'api/simulations/submit.php',

    // Users
    'usersList' => 'api/users/list.php',
    'usersProfile' => 'api/users/profile.php',
    'usersUpdate' => 'api/users/update.php',
    'usersComments' => 'api/users/comments.php',

    // Reports
    'reportsCreate' => 'api/reports/handle.php',
    'reportsList' => 'api/reports/list.php',

    // Filters
    'filtersList' => 'api/filters/list.php',
    'adminFiltersList' => 'api/admin/filters/list.php',
    'filtersSave' => 'api/filters/save.php',
    'filtersDelete' => 'api/filters/delete.php',

    // Cache
    'cacheManage' => 'api/admin/cache.php',

    // Bank Analysis
    'bankAnalysisAnalyze' => 'api/bank-analysis/analyze.php',
    'bankAnalysisPatterns' => 'api/bank-analysis/patterns.php',

    // AI
    'aiGenerate' => 'api/ai/generate.php',

    // Transactions
    'transactionsList' => 'api/transactions/list.php',

    // Statistics legacy aliases
    'statistics/user' => 'api/statistics/user.php',
    'statistics/question' => 'api/statistics/question.php',
    'statistics/platform' => 'api/statistics/platform.php',

    // Settings
    'settings' => 'api/settings.php',
    'settingsUpdate' => 'api/admin/settings.php',
];

if (isset($routes[$path])) {
    $file = __DIR__ . '/' . $routes[$path];

    if (!file_exists($file)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => "Endpoint file not found: {$routes[$path]}"]);
        exit;
    }

    if (LegacyEndpointDeprecation::shouldReturnGone($path)) {
        http_response_code(410);
        echo json_encode(['success' => false, 'message' => 'Endpoint legado removido.']);
        exit;
    }
    LegacyEndpointDeprecation::mark($path, '/' . $routes[$path]);

    require_once $file;
    exit;
}

if (preg_match('#^statistics/(user|question)/([^/]+)$#', $path, $matches)) {
    $_GET[$matches[1] === 'user' ? 'user_id' : 'question_id'] = urldecode($matches[2]);
    require_once __DIR__ . '/api/statistics/' . $matches[1] . '.php';
    exit;
}

if (strpos($path, '/') !== false && isAllowedLegacyApiPath($path)) {
    $legacyFile = __DIR__ . '/api/' . preg_replace('/\\.php$/i', '', $path) . '.php';

    if (file_exists($legacyFile)) {
        require_once $legacyFile;
        exit;
    }
}

http_response_code(404);
echo json_encode(['success' => false, 'message' => "Route not found: {$path}"]);
