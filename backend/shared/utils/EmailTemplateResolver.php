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

require_once __DIR__ . '/Mailer.php';

/**
 * Catalogo oficial de templates de e-mail editaveis no painel admin.
 *
 * @since 1.0.0
 * @return array<string, array<string, mixed>>
 */
function getSystemEmailTemplateCatalog(): array
{
    static $catalog = null;
    if (is_array($catalog)) {
        return $catalog;
    }

    $catalog = [
        'auth_email_confirmation' => [
            'name' => 'Confirmacao de e-mail',
            'description' => 'Enviado apos cadastro para ativar a conta.',
            'subject' => 'Confirme sua conta - ConcursoMestre',
            'htmlBody' => '<p>Olá, <strong>{{name}}</strong>!</p><p>Confirme seu e-mail para ativar a conta.</p><p><a href="{{confirm_url}}" target="_blank" rel="noopener noreferrer">Confirmar e-mail</a></p>',
            'textBody' => "Olá {{name}},\n\nConfirme sua conta: {{confirm_url}}\n\nEquipe ConcursoMestre",
            'enabled' => true,
        ],
        'auth_email_confirmation_resend' => [
            'name' => 'Reenvio de confirmacao',
            'description' => 'Enviado quando o usuario pede novo link de confirmacao.',
            'subject' => 'Confirme sua conta - ConcursoMestre',
            'htmlBody' => '<p>Olá, <strong>{{name}}</strong>!</p><p>Segue seu novo link de confirmação.</p><p><a href="{{confirm_url}}" target="_blank" rel="noopener noreferrer">Confirmar e-mail</a></p>',
            'textBody' => "Olá {{name}},\n\nNovo link de confirmação: {{confirm_url}}\n\nEquipe ConcursoMestre",
            'enabled' => true,
        ],
        'auth_password_reset' => [
            'name' => 'Redefinicao de senha',
            'description' => 'Enviado quando o usuario solicita recuperacao de senha.',
            'subject' => 'Redefina sua senha - ConcursoMestre',
            'htmlBody' => '<p>Olá, <strong>{{name}}</strong>!</p><p>Recebemos uma solicitação para redefinir sua senha.</p><p><a href="{{reset_url}}" target="_blank" rel="noopener noreferrer">Redefinir senha</a></p>',
            'textBody' => "Olá {{name}},\n\nUse este link para redefinir sua senha: {{reset_url}}\n\nEquipe ConcursoMestre",
            'enabled' => true,
        ],
        'auth_welcome' => [
            'name' => 'Boas-vindas',
            'description' => 'Enviado apos confirmacao do e-mail.',
            'subject' => 'Bem-vindo ao ConcursoMestre',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>, sua conta foi ativada com sucesso.</p><p>Acesse a plataforma: <a href="{{login_url}}" target="_blank" rel="noopener noreferrer">Entrar</a></p>',
            'textBody' => "Olá {{name}},\n\nSua conta foi ativada com sucesso.\nAcesse: {{login_url}}\n\nEquipe ConcursoMestre",
            'enabled' => true,
        ],
        'support_feedback_reply' => [
            'name' => 'Suporte - resposta',
            'description' => 'Enviado quando o admin responde feedback/suporte.',
            'subject' => 'Resposta do suporte - ConcursoMestre',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{intro}}</p><p><strong>Tema:</strong> {{reason}}</p><p><strong>Resposta:</strong></p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;white-space:pre-wrap;">{{reply_message_html}}</div>',
            'textBody' => "Olá {{name}},\n\n{{intro}}\n\nTema: {{reason}}\n\nResposta:\n{{reply_message}}\n\nAcompanhe na plataforma: {{support_url}}",
            'enabled' => true,
        ],
        'support_feedback_status' => [
            'name' => 'Suporte - mudanca de status',
            'description' => 'Enviado quando o admin altera o status do atendimento.',
            'subject' => 'Status do seu atendimento - ConcursoMestre',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{status_intro}}</p><p><strong>Status atual:</strong> {{status_line}}</p><p><strong>Tema:</strong> {{reason}}</p>',
            'textBody' => "Olá {{name}},\n\n{{status_intro}}\nStatus atual: {{status_line}}\nTema: {{reason}}\n\nAcompanhe na plataforma: {{support_url}}",
            'enabled' => true,
        ],
        'support_report_decision' => [
            'name' => 'Denuncia - conclusao',
            'description' => 'Enviado quando a moderação conclui uma denúncia.',
            'subject' => 'Conclusão da denúncia - ConcursoMestre',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{intro}}</p><p><strong>Alvo:</strong> {{target_label}}</p><p><strong>Motivo informado:</strong> {{reason}}</p><p><strong>Resposta da moderação:</strong></p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;white-space:pre-wrap;">{{admin_reason_html}}</div>{{evidence_block_html}}',
            'textBody' => "Olá {{name}},\n\n{{intro}}\nAlvo: {{target_label}}\nMotivo informado: {{reason}}\n\nResposta da moderação:\n{{admin_reason}}\n\nAcompanhe na plataforma: {{support_url}}",
            'enabled' => true,
        ],
        'marketing_campaign_message' => [
            'name' => 'Marketing - campanha automatica',
            'description' => 'Enviado por regras de campanha, como conta recente, inatividade, trial ou proximidade de assinatura.',
            'subject' => '{{title}}',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{message_html}}</p><p><a href="{{action_url}}" target="_blank" rel="noopener noreferrer">Ver campanha</a></p>',
            'textBody' => "Olá {{name}},\n\n{{message}}\n\nAcesse: {{action_url}}",
            'enabled' => true,
        ],
        'transaction_refund_completed' => [
            'name' => 'Transacao - reembolso concluido',
            'description' => 'Enviado quando um reembolso e processado com sucesso.',
            'subject' => 'Reembolso processado - ConcursoMestre',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nSeu reembolso foi processado.\nAcompanhe em: {{billing_url}}",
            'enabled' => true,
        ],
        'transaction_refund_retention_offer' => [
            'name' => 'Transação - proposta de retenção',
            'description' => 'Enviado quando a equipe faz proposta antes do estorno final.',
            'subject' => 'Uma proposta para você continuar com seu acesso',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nTemos uma proposta para você continuar com acesso.\nAcesse: {{billing_url}}",
            'enabled' => true,
        ],
        'transaction_refund_request_admin' => [
            'name' => 'Financeiro - alerta de reembolso para admin',
            'description' => 'Enviado para admin quando chega nova solicitação de reembolso.',
            'subject' => 'Nova solicitação de reembolso - ConcursoMestre',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nNova solicitação de reembolso recebida.\nAbra o painel: {{admin_url}}",
            'enabled' => true,
        ],
        'subscription_welcome' => [
            'name' => 'Assinatura - boas-vindas',
            'description' => 'Enviado após assinatura aprovada.',
            'subject' => 'Parabéns pela sua assinatura',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nSua assinatura foi confirmada.\nVeja os detalhes em: {{billing_url}}",
            'enabled' => true,
        ],
        'subscription_manual_gift' => [
            'name' => 'Assinatura - cortesia manual',
            'description' => 'Enviado quando o admin concede dias ou upgrade gratuito de cortesia.',
            'subject' => 'Você recebeu uma cortesia no ConcursoMestre',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>Você recebeu <strong>{{days_label}}</strong> grátis no <strong>{{plan_name}}</strong>.</p><p>Seu acesso está liberado até <strong>{{end_date}}</strong>.</p><p>Para continuar usando os benefícios depois desse período, cadastre um cartão. Ele só será usado na renovação.</p>',
            'textBody' => "Olá {{name}},\n\nVocê recebeu {{days_label}} grátis no {{plan_name}}.\nAcesso ativo até: {{end_date}}\n\nPara continuar depois, cadastre um cartão: {{billing_url}}",
            'enabled' => true,
        ],
        'subscription_payment_receipt' => [
            'name' => 'Assinatura - recibo',
            'description' => 'Enviado quando um pagamento recorrente é confirmado.',
            'subject' => 'Recibo do seu pagamento - ConcursoMestre',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nSeu pagamento foi confirmado.\nRecibo: {{receipt_url}}",
            'enabled' => true,
        ],
        'subscription_payment_failed' => [
            'name' => 'Assinatura - falha no pagamento',
            'description' => 'Enviado quando uma cobrança recorrente falha.',
            'subject' => 'Falha no pagamento da sua assinatura',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nNão conseguimos concluir sua cobrança.\nRegularize em: {{billing_url}}",
            'enabled' => true,
        ],
        'subscription_payment_method_update' => [
            'name' => 'Assinatura - atualizar pagamento',
            'description' => 'Enviado manualmente pelo financeiro quando há cartão vencido, ausente ou risco de cobrança.',
            'subject' => 'Atualize os dados de pagamento da sua assinatura',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>Identificamos que os dados de pagamento da sua assinatura precisam de atenção.</p><p><strong>Plano:</strong> {{plan_name}}</p><p><strong>Cartão:</strong> {{card_label}}</p><p><strong>Motivo:</strong> {{reason}}</p><p>Atualize ou troque o cartão salvo para evitar bloqueios nos simulados e materiais premium.</p>',
            'textBody' => "Olá {{name}},\n\nIdentificamos que os dados de pagamento da sua assinatura precisam de atenção.\nPlano: {{plan_name}}\nCartão: {{card_label}}\nMotivo: {{reason}}\n\nAtualize em: {{billing_url}}",
            'enabled' => true,
        ],
        'subscription_renewal_reminder' => [
            'name' => 'Assinatura - lembrete de renovação',
            'description' => 'Enviado 5 dias antes da renovação automática, apenas para ciclos maiores que 5 dias.',
            'subject' => 'Sua assinatura vai renovar em 5 dias',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nSua assinatura vai renovar em breve.\nDetalhes em: {{billing_url}}",
            'enabled' => true,
        ],
        'subscription_renewal_tomorrow' => [
            'name' => 'Assinatura - renovação amanhã',
            'description' => 'Enviado um dia antes da renovação automática.',
            'subject' => 'Seu plano renovará amanhã',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nSeu plano renovará amanhã.\nDetalhes em: {{billing_url}}",
            'enabled' => true,
        ],
        'subscription_refund_processed' => [
            'name' => 'Assinatura - estorno concluído',
            'description' => 'Enviado quando o estorno da assinatura foi processado.',
            'subject' => 'Reembolso da assinatura processado',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nSeu estorno foi processado.\nHistórico: {{billing_url}}",
            'enabled' => true,
        ],
        'subscription_cancellation_outcome' => [
            'name' => 'Assinatura - conclusão do cancelamento',
            'description' => 'Enviado com o resultado do cancelamento solicitado.',
            'subject' => 'Atualização do cancelamento da assinatura',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nSeu cancelamento foi atualizado.\nAcompanhe: {{billing_url}}",
            'enabled' => true,
        ],
        'subscription_refund_pending_admin' => [
            'name' => 'Assinatura - alerta admin de estorno pendente',
            'description' => 'Enviado para admin quando um estorno de assinatura exige mediação.',
            'subject' => 'Reembolso de assinatura pendente - ConcursoMestre',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nHá um estorno de assinatura pendente de mediação.\nAbra: {{admin_url}}",
            'enabled' => true,
        ],
        'subscription_new_admin' => [
            'name' => 'Assinatura - alerta admin de nova assinatura',
            'description' => 'Enviado para admin quando uma nova assinatura Stripe é confirmada.',
            'subject' => 'Nova assinatura confirmada - ConcursoMestre',
            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
            'textBody' => "Olá {{name}},\n\nNova assinatura confirmada.\nAluno: {{buyer_name}}\nPlano: {{plan_name}}\nValor: {{amount_label}}\nInvoice: {{invoice_id}}\n\nAbrir financeiro: {{admin_url}}",
            'enabled' => true,
        ],
    ];

    return $catalog;
}

/**
 * Converte o catalogo em lista para persistencia em system_settings.emailTemplates.
 *
 * @since 1.0.0
 * @return array<int, array<string, mixed>>
 */
function getSystemEmailTemplateDefaults(): array
{
    $defaults = [];
    foreach (getSystemEmailTemplateCatalog() as $key => $item) {
        $defaults[] = [
            'key' => $key,
            'name' => (string) ($item['name'] ?? $key),
            'description' => (string) ($item['description'] ?? ''),
            'subject' => (string) ($item['subject'] ?? ''),
            'htmlBody' => (string) ($item['htmlBody'] ?? ''),
            'textBody' => (string) ($item['textBody'] ?? ''),
            'enabled' => array_key_exists('enabled', $item) ? (bool) $item['enabled'] : true,
        ];
    }

    return $defaults;
}

/**
 * Normaliza templates recebidos da base e garante consistencia de chaves.
 *
 * @since 1.0.0
 * @param mixed $templates
 * @return array<int, array<string, mixed>>
 */
function normalizeSystemEmailTemplates($templates): array
{
    $catalog = getSystemEmailTemplateCatalog();
    $resultByKey = [];

    foreach ($catalog as $key => $template) {
        $resultByKey[$key] = [
            'key' => $key,
            'name' => (string) ($template['name'] ?? $key),
            'description' => (string) ($template['description'] ?? ''),
            'subject' => trim((string) ($template['subject'] ?? '')),
            'htmlBody' => (string) ($template['htmlBody'] ?? ''),
            'textBody' => (string) ($template['textBody'] ?? ''),
            'enabled' => array_key_exists('enabled', $template) ? (bool) $template['enabled'] : true,
        ];
    }

    if (!is_array($templates)) {
        return array_values($resultByKey);
    }

    foreach ($templates as $row) {
        if (!is_array($row)) {
            continue;
        }

        $key = trim((string) ($row['key'] ?? ''));
        if ($key === '' || !isset($resultByKey[$key])) {
            continue;
        }

        $base = $resultByKey[$key];
        $subject = trim((string) ($row['subject'] ?? ''));
        $htmlBody = (string) ($row['htmlBody'] ?? '');
        $textBody = (string) ($row['textBody'] ?? '');

        $resultByKey[$key] = [
            'key' => $key,
            'name' => trim((string) ($row['name'] ?? $base['name'])) ?: $base['name'],
            'description' => trim((string) ($row['description'] ?? $base['description'])),
            'subject' => $subject !== '' ? $subject : $base['subject'],
            'htmlBody' => $htmlBody !== '' ? $htmlBody : $base['htmlBody'],
            'textBody' => $textBody !== '' ? $textBody : $base['textBody'],
            'enabled' => array_key_exists('enabled', $row) ? (bool) $row['enabled'] : (bool) $base['enabled'],
            'updatedAt' => isset($row['updatedAt']) ? (string) $row['updatedAt'] : null,
        ];
    }

    return array_values($resultByKey);
}

/**
 * Verifica se o HTML ja parece ser um layout de e-mail completo.
 *
 * @since 1.0.0
 */
function isSystemEmailTemplateStandaloneHtml(string $htmlBody): bool
{
    $value = ltrim($htmlBody);
    if ($value === '') {
        return false;
    }

    if (preg_match('/^(?:<!doctype\s+html>|<html[\s>])/i', $value) === 1) {
        return true;
    }

    $hasEmailTable = preg_match('/<table\b[^>]*role=[\'"]presentation[\'"]/i', $value) === 1;
    $hasBrandShell = stripos($value, 'ConcursoMestre') !== false && stripos($value, 'max-width') !== false;

    return $hasEmailTable && $hasBrandShell;
}

/**
 * Detecta a principal acao do template para transformar em CTA visual.
 *
 * @since 1.0.0
 * @param array<string, mixed> $variables
 * @return array{url:string,label:string}
 */
function resolveSystemEmailTemplateButton(array $variables): array
{
    $buttonCandidates = [
        'confirm_url' => 'Confirmar e-mail',
        'reset_url' => 'Redefinir senha',
        'billing_url' => 'Abrir cobrança',
        'receipt_url' => 'Ver recibo',
        'support_url' => 'Abrir suporte',
        'admin_url' => 'Abrir painel',
        'login_url' => 'Acessar plataforma',
        'app_url' => 'Acessar plataforma',
        'action_url' => 'Abrir',
    ];

    foreach ($buttonCandidates as $key => $label) {
        $url = trim((string) ($variables[$key] ?? ''));
        if ($url !== '') {
            return ['url' => $url, 'label' => $label];
        }
    }

    return ['url' => '', 'label' => ''];
}

/**
 * Resolve os placeholders de identidade visual dos e-mails.
 *
 * @since 1.0.0
 * @param mixed $overrideLogoUrl
 * @return array{email_logo_url:string,email_logo_block:string}
 */
function resolveSystemEmailBrandingVariables(?PDO $db = null, $overrideLogoUrl = null): array
{
    $normalizedOverride = Mailer::normalizeEmailLogoUrl((string) ($overrideLogoUrl ?? ''));
    $logoUrl = $normalizedOverride;

    if ($logoUrl === '') {
        try {
            $mailConfig = resolveMailConfiguration($db);
            $logoUrl = Mailer::normalizeEmailLogoUrl((string) ($mailConfig['emailLogoUrl'] ?? ''));
        } catch (Throwable $error) {
            error_log('[email_branding] ' . $error->getMessage());
            $logoUrl = '';
        }
    }

    return [
        'email_logo_url' => $logoUrl,
        'email_logo_block' => Mailer::emailLogoBlock($logoUrl),
    ];
}

/**
 * Aplica a logo configurada em templates novos e em modelos antigos que ainda
 * possuem o bloco visual "CM" salvo.
 *
 * @since 1.0.0
 * @param array<string, mixed> $variables
 */
function applySystemEmailBrandingToHtml(string $htmlBody, array $variables): string
{
    $logoBlock = (string) ($variables['email_logo_block'] ?? Mailer::emailLogoBlock(''));
    $logoUrl = Mailer::normalizeEmailLogoUrl((string) ($variables['email_logo_url'] ?? ''));
    $resolved = preg_replace('/\{\{\s*email_logo_block\s*\}\}/i', $logoBlock, $htmlBody) ?? $htmlBody;

    if ($logoUrl !== '') {
        $resolved = preg_replace(
            '/<div\s+style=([\'"])(?=[^\'"]*width:42px)(?=[^\'"]*height:42px)(?=[^\'"]*background:#2563eb)[^\'"]*\1>CM<\/div>/i',
            $logoBlock,
            $resolved
        ) ?? $resolved;
    }

    return $resolved;
}

/**
 * Aplica o layout visual padrao quando o modelo salvo e apenas um fragmento.
 *
 * @since 1.0.0
 * @param array<string, mixed> $variables
 */
function wrapSystemEmailTemplateHtml(string $htmlBody, string $subject, array $variables): string
{
    $brandedHtmlBody = applySystemEmailBrandingToHtml($htmlBody, $variables);
    $trimmed = trim($brandedHtmlBody);
    if ($trimmed === '' || isSystemEmailTemplateStandaloneHtml($trimmed)) {
        return $trimmed;
    }

    $button = resolveSystemEmailTemplateButton($variables);
    $title = trim($subject) !== '' ? trim($subject) : 'ConcursoMestre';
    $logoUrl = (string) ($variables['email_logo_url'] ?? '');

    return Mailer::htmlTemplate($title, $trimmed, $button['url'], $button['label'], $logoUrl);
}

/**
 * Resolve um template com fallback padrao e placeholders.
 *
 * @since 1.0.0
 * @param array<string, mixed> $defaults
 * @param array<string, mixed> $variables
 * @return array{enabled:bool,subject:string,htmlBody:string,textBody:string}
 */
function resolveSystemEmailTemplate(string $templateKey, array $defaults, array $variables = [], ?PDO $db = null): array
{
    $variables = array_merge($variables, resolveSystemEmailBrandingVariables($db, $variables['email_logo_url'] ?? null));
    $templatesByKey = [];
    foreach (loadSystemEmailTemplatesFromSettings($db) as $template) {
        if (!is_array($template)) {
            continue;
        }

        $key = trim((string) ($template['key'] ?? ''));
        if ($key === '') {
            continue;
        }

        $templatesByKey[$key] = $template;
    }

    $catalog = getSystemEmailTemplateCatalog();
    $catalogDefault = $catalog[$templateKey] ?? [];
    $configured = $templatesByKey[$templateKey] ?? [];

    $subject = trim((string) ($configured['subject'] ?? ($defaults['subject'] ?? ($catalogDefault['subject'] ?? ''))));
    $htmlBody = (string) ($configured['htmlBody'] ?? ($defaults['htmlBody'] ?? ($catalogDefault['htmlBody'] ?? '')));
    $textBody = (string) ($configured['textBody'] ?? ($defaults['textBody'] ?? ($catalogDefault['textBody'] ?? '')));
    $enabled = array_key_exists('enabled', $configured)
        ? (bool) $configured['enabled']
        : (array_key_exists('enabled', $defaults) ? (bool) $defaults['enabled'] : (bool) ($catalogDefault['enabled'] ?? true));

    if ($textBody === '' && $htmlBody !== '') {
        $textBody = Mailer::htmlToText($htmlBody);
    }

    $resolvedSubject = applySystemEmailTemplateVariables($subject, $variables);
    $resolvedHtmlBody = applySystemEmailTemplateVariablesForHtml($htmlBody, $variables);
    $resolvedTextBody = applySystemEmailTemplateVariables($textBody, $variables);

    return [
        'enabled' => $enabled,
        'subject' => $resolvedSubject,
        'htmlBody' => wrapSystemEmailTemplateHtml($resolvedHtmlBody, $resolvedSubject, $variables),
        'textBody' => $resolvedTextBody,
    ];
}

/**
 * Carrega templates salvos em system_settings.emailTemplates e aplica defaults.
 *
 * @since 1.0.0
 * @return array<int, array<string, mixed>>
 */
function loadSystemEmailTemplatesFromSettings(?PDO $db = null): array
{
    if (!isset($GLOBALS['__system_email_template_cache']) || !is_array($GLOBALS['__system_email_template_cache'])) {
        $GLOBALS['__system_email_template_cache'] = [];
    }

    try {
        $connection = $db instanceof PDO ? $db : resolveSystemEmailTemplateConnection();
        if (!$connection instanceof PDO) {
            return getSystemEmailTemplateDefaults();
        }

        $cacheKey = 'pdo-' . spl_object_id($connection);
        if (isset($GLOBALS['__system_email_template_cache'][$cacheKey])) {
            return $GLOBALS['__system_email_template_cache'][$cacheKey];
        }

        $stmt = $connection->prepare("SELECT value_json FROM system_settings WHERE key_name = 'emailTemplates' LIMIT 1");
        $stmt->execute();
        $rawValue = $stmt->fetchColumn();

        if (!is_string($rawValue) || trim($rawValue) === '') {
            $GLOBALS['__system_email_template_cache'][$cacheKey] = getSystemEmailTemplateDefaults();
            return $GLOBALS['__system_email_template_cache'][$cacheKey];
        }

        $decoded = json_decode($rawValue, true);
        $GLOBALS['__system_email_template_cache'][$cacheKey] = normalizeSystemEmailTemplates($decoded);

        return $GLOBALS['__system_email_template_cache'][$cacheKey];
    } catch (Throwable $error) {
        error_log('[email_templates] ' . $error->getMessage());
        return getSystemEmailTemplateDefaults();
    }
}

/**
 * Limpa cache local de templates (apos persistencia em settings).
 *
 * @since 1.0.0
 */
function resetSystemEmailTemplateCache(): void
{
    $GLOBALS['__system_email_template_cache'] = [];
}

/**
 * @since 1.0.0
 */
function resolveSystemEmailTemplateConnection(): ?PDO
{
    try {
        require_once dirname(__DIR__, 2) . '/config/database.php';
        $database = new Database();
        return $database->getConnection();
    } catch (Throwable $error) {
        error_log('[email_templates_connection] ' . $error->getMessage());
        return null;
    }
}

/**
 * Aplica placeholders no formato {{key}}.
 *
 * @since 1.0.0
 * @param array<string, mixed> $variables
 */
function applySystemEmailTemplateVariables(string $value, array $variables): string
{
    if ($value === '' || $variables === []) {
        return $value;
    }

    $resolved = $value;
    foreach ($variables as $key => $variableValue) {
        $resolved = str_replace('{{' . $key . '}}', (string) $variableValue, $resolved);
    }

    return $resolved;
}

/**
 * Aplica placeholders no corpo HTML preservando quebras de linha de textos
 * longos e escapando valores simples.
 *
 * @since 1.0.0
 * @param array<string, mixed> $variables
 */
function applySystemEmailTemplateVariablesForHtml(string $value, array $variables): string
{
    if ($value === '' || $variables === []) {
        return $value;
    }

    $resolved = $value;
    foreach ($variables as $key => $variableValue) {
        $resolved = str_replace(
            '{{' . $key . '}}',
            formatSystemEmailVariableForHtml((string) $key, (string) $variableValue),
            $resolved
        );
    }

    return $resolved;
}

/**
 * Formata placeholders para uso seguro no corpo HTML.
 */
function formatSystemEmailVariableForHtml(string $key, string $value): string
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return '';
    }

    if (preg_match('/_html$/i', $key) === 1 || preg_match('/<[^>]+>/', $trimmed) === 1) {
        return preg_replace('/<(script|style|iframe|object|embed|link|meta)\b[^>]*>.*?<\/\1>/is', '', $trimmed) ?? $trimmed;
    }

    $safe = htmlspecialchars($trimmed, ENT_QUOTES, 'UTF-8');
    $multilineKeys = [
        'content',
        'message',
        'reply_message',
        'admin_reason',
        'details',
        'status_intro',
        'intro',
    ];

    return in_array($key, $multilineKeys, true) ? nl2br($safe) : $safe;
}

