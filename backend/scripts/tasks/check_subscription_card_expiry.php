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

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

include_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/modules/users/repositories/UsersRepository.php';

$database = new Database();
$db = $database->getConnection();
$repository = new UsersRepository($db);
$timezone = new DateTimeZone('America/Sao_Paulo');
$now = new DateTimeImmutable('now', $timezone);
$currentMonth = (int) $now->format('m');
$currentYear = (int) $now->format('Y');
$link = '/profile/personal';
$summary = [
    'checked' => 0,
    'expired' => 0,
    'expiring' => 0,
    'notified' => 0,
];

/**
 * Monta o identificador do cartao sem expor dado sensivel.
 *
 * @since 1.0.0
 */
function buildSubscriptionCardLabel(array $card): string
{
    $brand = strtoupper(trim((string) ($card['brand'] ?? '')));
    $lastFour = trim((string) ($card['last_four_digits'] ?? ''));

    if ($brand === '' && $lastFour === '') {
        return '';
    }

    if ($brand === '') {
        return 'final ' . $lastFour;
    }

    if ($lastFour === '') {
        return $brand;
    }

    return $brand . ' final ' . $lastFour;
}

/**
 * Insere notificacao deduplicada para alertas de cartao da assinatura.
 *
 * @since 1.0.0
 */
function notifySubscriptionCardIssue(
    UsersRepository $repository,
    string $userId,
    string $title,
    string $message,
    string $type,
    string $link
): bool {
    if ($repository->hasRecentNotification($userId, $title, $link, 168)) {
        return false;
    }

    $repository->insertNotification([
        'id' => 'not-' . uniqid('', true),
        'user_id' => $userId,
        'title' => $title,
        'message' => $message,
        'category' => 'system',
        'type' => $type,
        'link' => $link,
    ]);

    return true;
}

foreach ($repository->listActiveAutoRenewingSubscriptionUserIds() as $userId) {
    $summary['checked']++;
    $card = $repository->findPreferredCardExpiry($userId);
    if (!$card) {
        continue;
    }

    $expMonth = (int) ($card['exp_month'] ?? 0);
    $expYear = (int) ($card['exp_year'] ?? 0);
    if ($expMonth < 1 || $expMonth > 12 || $expYear < 2000) {
        continue;
    }

    $cardLabel = buildSubscriptionCardLabel($card);
    $isExpired = $expYear < $currentYear || ($expYear === $currentYear && $expMonth < $currentMonth);
    $monthsUntilExpiry = (($expYear - $currentYear) * 12) + ($expMonth - $currentMonth);

    if ($isExpired) {
        $summary['expired']++;
        $message = $cardLabel === ''
            ? 'Seu cartao da assinatura expirou. Atualize seus dados para manter o acesso aos simulados e materiais.'
            : "O cartao {$cardLabel} da sua assinatura expirou. Atualize seus dados para manter o acesso aos simulados e materiais.";
        if (notifySubscriptionCardIssue($repository, $userId, 'Cartao expirado', $message, 'error', $link)) {
            $summary['notified']++;
        }
        continue;
    }

    if ($monthsUntilExpiry <= 1) {
        $summary['expiring']++;
        $message = $cardLabel === ''
            ? 'O cartao da sua assinatura esta proximo de vencer. Atualize-o para evitar falhas na renovacao.'
            : "O cartao {$cardLabel} da sua assinatura esta proximo de vencer. Atualize-o para evitar falhas na renovacao.";
        if (notifySubscriptionCardIssue($repository, $userId, 'Cartao proximo do vencimento', $message, 'warning', $link)) {
            $summary['notified']++;
        }
    }
}

echo json_encode([
    'success' => true,
    'checked_at' => $now->format(DateTimeInterface::ATOM),
    'timezone' => 'America/Sao_Paulo',
    'summary' => $summary,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
