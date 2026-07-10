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

require_once __DIR__ . '/../../../shared/utils/Mailer.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';

/**
 * Servico transversal do modulo admin para comunicacao automatica com usuarios.
 * Centraliza templates e assuntos de email gerados por feedback e denuncias.
 */
class AdminUserCommunicationService
{
    /**
     * Envia o email disparado quando o admin responde uma conversa de feedback.
     *
     * @since 1.0.0
     */
    public function sendFeedbackReplyEmail(array $thread, string $replyMessage): void
    {
        $email = trim((string) ($thread['user_email'] ?? ''));
        if ($email === '') {
            return;
        }

        $userName = trim((string) ($thread['user_name'] ?? 'Aluno'));
        $type = trim((string) ($thread['type'] ?? 'support'));
        $reason = trim((string) ($thread['reason'] ?? 'Atendimento'));
        $meta = $this->resolveFeedbackEmailMeta($type);
        $appUrl = $this->resolveAppUrl() . '/notifications';

        $content = sprintf(
            '<p>Ola <strong>%s</strong>,</p>
            <p>%s</p>
            <p><strong>Tema do atendimento:</strong> %s</p>
            <p><strong>Resposta da equipe:</strong></p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;white-space:pre-wrap;">%s</div>
            <p style="margin-top:20px;">Se precisar complementar o caso, voce pode responder direto pela plataforma.</p>',
            htmlspecialchars($userName, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($meta['intro'], ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($reason, ENT_QUOTES, 'UTF-8'),
            nl2br(htmlspecialchars($replyMessage, ENT_QUOTES, 'UTF-8'))
        );

        $plainText = "Ola {$userName},\n\n"
            . $meta['intro'] . "\n\n"
            . "Tema do atendimento: {$reason}\n\n"
            . "Resposta da equipe:\n{$replyMessage}\n\n"
            . "Acompanhe a conversa pela plataforma.";

        $template = resolveSystemEmailTemplate(
            'support_feedback_reply',
            [
                'subject' => $meta['replySubject'],
                'htmlBody' => Mailer::htmlTemplate($meta['replyTitle'], $content, $appUrl, 'Abrir plataforma'),
                'textBody' => $plainText,
            ],
            [
                'name' => $userName,
                'email' => $email,
                'intro' => $meta['intro'],
                'reason' => $reason,
                'reply_message' => $replyMessage,
                'reply_message_html' => nl2br(htmlspecialchars($replyMessage, ENT_QUOTES, 'UTF-8')),
                'support_url' => $appUrl,
                'app_url' => $this->resolveAppUrl(),
            ]
        );

        if ($template['enabled']) {
            Mailer::send(
                $email,
                $userName,
                $template['subject'],
                $template['htmlBody'],
                $template['textBody']
            );
        }
    }

    /**
     * Envia o email disparado quando o admin altera o status de um feedback.
     *
     * @since 1.0.0
     */
    public function sendFeedbackStatusEmail(array $thread, string $status): void
    {
        $email = trim((string) ($thread['user_email'] ?? ''));
        if ($email === '' || $status === 'new') {
            return;
        }

        $userName = trim((string) ($thread['user_name'] ?? 'Aluno'));
        $type = trim((string) ($thread['type'] ?? 'support'));
        $reason = trim((string) ($thread['reason'] ?? 'Atendimento'));
        $meta = $this->resolveFeedbackEmailMeta($type);
        $statusLine = $status === 'resolved'
            ? 'Seu atendimento foi marcado como resolvido pela equipe.'
            : 'Seu atendimento foi aberto e esta em analise pela equipe.';

        $content = sprintf(
            '<p>Ola <strong>%s</strong>,</p>
            <p>%s</p>
            <p><strong>Status atual:</strong> %s</p>
            <p><strong>Tema do atendimento:</strong> %s</p>',
            htmlspecialchars($userName, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($meta['statusIntro'], ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($statusLine, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($reason, ENT_QUOTES, 'UTF-8')
        );

        $plainText = "Ola {$userName},\n\n"
            . $meta['statusIntro'] . "\n"
            . "Status atual: {$statusLine}\n"
            . "Tema do atendimento: {$reason}\n";

        $supportUrl = $this->resolveAppUrl() . '/notifications';
        $template = resolveSystemEmailTemplate(
            'support_feedback_status',
            [
                'subject' => $meta['statusSubjectPrefix'] . ': ' . $reason,
                'htmlBody' => Mailer::htmlTemplate('Atualizacao do seu atendimento', $content, $supportUrl, 'Ver atualizacao'),
                'textBody' => $plainText,
            ],
            [
                'name' => $userName,
                'email' => $email,
                'status_intro' => $meta['statusIntro'],
                'status_line' => $statusLine,
                'reason' => $reason,
                'support_url' => $supportUrl,
                'app_url' => $this->resolveAppUrl(),
            ]
        );

        if ($template['enabled']) {
            Mailer::send(
                $email,
                $userName,
                $template['subject'],
                $template['htmlBody'],
                $template['textBody']
            );
        }
    }

    /**
     * Envia o email disparado quando o admin conclui a moderação de uma denúncia.
     *
     * @since 1.0.0
     */
    public function sendReportDecisionEmail(array $report, string $action, string $adminReason, ?string $evidenceUrl): void
    {
        $email = trim((string) ($report['reporter_email'] ?? ''));
        if ($email === '') {
            return;
        }

        $userName = trim((string) ($report['reporter_name'] ?? 'Aluno'));
        $targetType = (string) ($report['target_type'] ?? 'item');
        $targetLabel = $this->resolveReportTargetLabel($targetType);
        $reason = trim((string) ($report['reason'] ?? 'denúncia enviada'));
        $meta = $this->resolveReportEmailMeta($targetType, $action);

        $evidenceBlock = '';
        if ($evidenceUrl) {
            $safeEvidenceUrl = htmlspecialchars($evidenceUrl, ENT_QUOTES, 'UTF-8');
            $evidenceBlock = "<p><strong>Prova da decisão:</strong> <a href=\"{$safeEvidenceUrl}\">abrir anexo</a></p>";
        }

        $content = sprintf(
            '<p>Olá <strong>%s</strong>,</p>
            <p>%s</p>
            <p><strong>Tipo de alvo:</strong> %s</p>
            <p><strong>Motivo informado por você:</strong> %s</p>
            <p><strong>Resposta da moderação:</strong></p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;white-space:pre-wrap;">%s</div>
            %s',
            htmlspecialchars($userName, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($meta['intro'], ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($targetLabel, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($reason, ENT_QUOTES, 'UTF-8'),
            nl2br(htmlspecialchars($adminReason, ENT_QUOTES, 'UTF-8')),
            $evidenceBlock
        );

        $plainText = "Olá {$userName},\n\n"
            . $meta['intro'] . "\n"
            . "Tipo de alvo: {$targetLabel}\n"
            . "Motivo informado por você: {$reason}\n\n"
            . "Resposta da moderação:\n{$adminReason}\n\n";

        if ($evidenceUrl) {
            $plainText .= "Prova da decisão: {$evidenceUrl}\n";
        }

        $supportUrl = $this->resolveAppUrl() . '/notifications';
        $template = resolveSystemEmailTemplate(
            'support_report_decision',
            [
                'subject' => $meta['subject'],
                'htmlBody' => Mailer::htmlTemplate($meta['title'], $content, $supportUrl, $meta['buttonLabel']),
                'textBody' => $plainText,
            ],
            [
                'name' => $userName,
                'email' => $email,
                'intro' => $meta['intro'],
                'target_label' => $targetLabel,
                'reason' => $reason,
                'admin_reason' => $adminReason,
                'admin_reason_html' => nl2br(htmlspecialchars($adminReason, ENT_QUOTES, 'UTF-8')),
                'evidence_block_html' => $evidenceBlock,
                'support_url' => $supportUrl,
                'app_url' => $this->resolveAppUrl(),
            ]
        );

        if ($template['enabled']) {
            Mailer::send(
                $email,
                $userName,
                $template['subject'],
                $template['htmlBody'],
                $template['textBody']
            );
        }
    }

    /**
     * Resolve textos de email conforme o tipo do feedback.
     *
     * @since 1.0.0
     */
    private function resolveFeedbackEmailMeta(string $type): array
    {
        return match ($type) {
            'bug' => [
                'intro' => 'Nosso time tecnico analisou o bug que voce reportou e enviou uma atualizacao.',
                'statusIntro' => 'Estamos atualizando o andamento do bug que voce reportou.',
                'replySubject' => 'Atualizacao sobre o bug reportado - ConcursoMestre',
                'replyTitle' => 'Resposta sobre o bug reportado',
                'statusSubjectPrefix' => 'Status do bug reportado',
            ],
            'suggestion' => [
                'intro' => 'Sua sugestao foi analisada pelo time de produto e ja temos uma resposta para voce.',
                'statusIntro' => 'Estamos atualizando o andamento da sua sugestao.',
                'replySubject' => 'Resposta sobre sua sugestao - ConcursoMestre',
                'replyTitle' => 'Resposta sobre sua sugestao',
                'statusSubjectPrefix' => 'Status da sua sugestao',
            ],
            'cancellation' => [
                'intro' => 'Seu pedido relacionado a cancelamento foi analisado e temos uma resposta oficial.',
                'statusIntro' => 'Estamos atualizando o andamento da sua solicitacao de cancelamento.',
                'replySubject' => 'Atualizacao sobre sua solicitacao de cancelamento - ConcursoMestre',
                'replyTitle' => 'Resposta sobre cancelamento',
                'statusSubjectPrefix' => 'Status da sua solicitacao de cancelamento',
            ],
            'report' => [
                'intro' => 'Sua mensagem relacionada a denuncia recebeu uma resposta da equipe.',
                'statusIntro' => 'Estamos atualizando o andamento da sua solicitacao relacionada a denuncia.',
                'replySubject' => 'Resposta sobre sua denuncia - ConcursoMestre',
                'replyTitle' => 'Resposta sobre sua denuncia',
                'statusSubjectPrefix' => 'Status da sua denuncia',
            ],
            default => [
                'intro' => 'Nossa equipe de suporte analisou sua mensagem e respondeu o atendimento.',
                'statusIntro' => 'Estamos atualizando o andamento do seu atendimento.',
                'replySubject' => 'Resposta do suporte - ConcursoMestre',
                'replyTitle' => 'Resposta do suporte',
                'statusSubjectPrefix' => 'Status do seu atendimento',
            ],
        };
    }

    /**
     * Traduz o alvo da denúncia para um texto amigável no email.
     *
     * @since 1.0.0
     */
    private function resolveReportTargetLabel(string $targetType): string
    {
        return match ($targetType) {
            'question' => 'questão',
            'material' => 'material',
            'comment' => 'comentário',
            'law_section' => 'Lei Comentada',
            default => 'item da plataforma',
        };
    }

    /**
     * Resolve assunto e texto-base do email conforme alvo e decisão da denúncia.
     *
     * @since 1.0.0
     */
    private function resolveReportEmailMeta(string $targetType, string $action): array
    {
        $targetNoun = match ($targetType) {
            'question' => 'questão',
            'material' => 'material',
            'comment' => 'comentário',
            'law_section' => 'Lei Comentada',
            default => 'conteúdo',
        };

        if ($action === 'resolved') {
            return [
                'subject' => "Denúncia aceita sobre {$targetNoun} - ConcursoMestre",
                'title' => 'Resultado da moderação da sua denúncia',
                'buttonLabel' => 'Acompanhar denúncia',
                'intro' => "Sua denúncia sobre {$targetNoun} foi aceita pela moderação e a equipe já aplicou a tratativa cabível.",
            ];
        }

        return [
            'subject' => "Denúncia analisada sobre {$targetNoun} - ConcursoMestre",
            'title' => 'Conclusão da análise da sua denúncia',
            'buttonLabel' => 'Ver conclusão',
            'intro' => "Sua denúncia sobre {$targetNoun} foi analisada pela moderação, mas não encontramos elementos suficientes para confirmar a irregularidade neste momento.",
        ];
    }

    /**
     * Resolve a URL base do app para links dos emails.
     *
     * @since 1.0.0
     */
    private function resolveAppUrl(): string
    {
        $appUrl = getenv('APP_URL');
        if (is_string($appUrl) && trim($appUrl) !== '') {
            return rtrim(trim($appUrl), '/');
        }

        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        if (str_contains($host, 'localhost')) {
            return 'http://localhost:3000';
        }

        $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
        return $protocol . '://' . $host;
    }
}
