import type { EmailTemplateModel } from '@types';

type DefaultEmailHtmlInput = {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

const DEFAULT_EMAIL_LOGO_BLOCK = '{{email_logo_block}}';

const buildDefaultEmailHtml = ({
  title,
  body,
  ctaLabel,
  ctaUrl,
}: DefaultEmailHtmlInput) => `
<div style="margin:0;padding:0;background:#eef2f7;font-family:Inter,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#eef2f7;">
    <tr>
      <td align="center" style="padding:36px 14px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;border-collapse:collapse;overflow:hidden;border-radius:20px;background:#ffffff;border:1px solid #dbe4ef;box-shadow:0 18px 50px rgba(15,23,42,.10);">
          <tr>
            <td style="background:#111827;padding:0;color:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:26px 30px 22px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="width:52px;vertical-align:middle;">
                          ${DEFAULT_EMAIL_LOGO_BLOCK}
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-size:12px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#93c5fd;">ConcursoMestre</p>
                          <p style="margin:7px 0 0;font-size:13px;font-weight:600;color:#dbeafe;">Plataforma de estudos para concursos</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="height:4px;background:#2563eb;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 32px 30px;font-size:15px;line-height:1.75;color:#334155;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#2563eb;">Comunicado</p>
              <h1 style="margin:0 0 18px;font-size:25px;line-height:1.24;font-weight:900;color:#0f172a;">${title}</h1>
              ${body}
              ${ctaLabel && ctaUrl ? `<p style="margin:30px 0 10px;"><a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;border-radius:12px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:900;letter-spacing:.04em;padding:14px 22px;box-shadow:0 12px 24px rgba(37,99,235,.24);">${ctaLabel}</a></p>` : ''}
              <div style="margin-top:28px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;font-size:12px;line-height:1.6;color:#64748b;">Se você não reconhece esta mensagem, ignore este e-mail ou fale com nosso suporte.</div>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #e2e8f0;padding:20px 32px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;">
              <strong style="color:#334155;">Equipe ConcursoMestre</strong><br />
              Este e-mail foi enviado automaticamente pela plataforma.<br />
              <a href="{{app_url}}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none;">Acessar plataforma</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`.trim();

const DEFAULT_AUTH_EMAIL_TEMPLATES: EmailTemplateModel[] = [
  {
    key: 'auth_email_confirmation',
    name: 'Confirmacao de e-mail',
    description: 'Enviado apos cadastro para ativar a conta.',
    subject: 'Confirme sua conta - ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Confirme seu e-mail',
      body: '<p>Olá, <strong>{{name}}</strong>!</p><p>Confirme seu e-mail para ativar a conta e liberar todos os recursos.</p>',
      ctaLabel: 'Confirmar e-mail',
      ctaUrl: '{{confirm_url}}',
    }),
    textBody: 'Olá {{name}},\n\nConfirme seu e-mail: {{confirm_url}}\n\nEquipe ConcursoMestre',
    enabled: true,
  },
  {
    key: 'auth_email_confirmation_resend',
    name: 'Reenvio de confirmacao',
    description: 'Enviado quando o usuário solicita novo link de confirmação.',
    subject: 'Confirme sua conta - ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Novo link de confirmacao',
      body: '<p>Olá, <strong>{{name}}</strong>!</p><p>Recebemos seu pedido de novo link de confirmação.</p>',
      ctaLabel: 'Confirmar e-mail',
      ctaUrl: '{{confirm_url}}',
    }),
    textBody: 'Olá {{name}},\n\nNovo link de confirmação: {{confirm_url}}\n\nEquipe ConcursoMestre',
    enabled: true,
  },
  {
    key: 'auth_password_reset',
    name: 'Redefinicao de senha',
    description: 'Enviado quando o usuário solicita recuperação de senha.',
    subject: 'Redefina sua senha - ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Redefina sua senha',
      body: '<p>Olá, <strong>{{name}}</strong>!</p><p>Recebemos uma solicitação para redefinir sua senha.</p>',
      ctaLabel: 'Redefinir senha',
      ctaUrl: '{{reset_url}}',
    }),
    textBody: 'Olá {{name}},\n\nUse este link para redefinir sua senha: {{reset_url}}\n\nEquipe ConcursoMestre',
    enabled: true,
  },
  {
    key: 'auth_welcome',
    name: 'Boas-vindas',
    description: 'Enviado apos confirmacao do e-mail.',
    subject: 'Bem-vindo ao ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Bem-vindo ao ConcursoMestre',
      body: '<p>Olá <strong>{{name}}</strong>, sua conta foi ativada com sucesso.</p><p>Agora você já pode acompanhar seus estudos, questões, simulados e progresso.</p>',
      ctaLabel: 'Acessar plataforma',
      ctaUrl: '{{login_url}}',
    }),
    textBody: 'Olá {{name}},\n\nSua conta foi ativada com sucesso.\nAcesse: {{login_url}}\n\nEquipe ConcursoMestre',
    enabled: true,
  },
  {
    key: 'support_feedback_reply',
    name: 'Suporte - resposta',
    description: 'Enviado quando o admin responde um atendimento.',
    subject: 'Resposta do suporte - ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Resposta do suporte',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{intro}}</p><p><strong>Tema:</strong> {{reason}}</p><p><strong>Resposta:</strong></p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;white-space:pre-wrap;">{{reply_message_html}}</div>',
      ctaLabel: 'Abrir suporte',
      ctaUrl: '{{support_url}}',
    }),
    textBody: 'Olá {{name}},\n\n{{intro}}\n\nTema: {{reason}}\n\nResposta:\n{{reply_message}}\n\nAcompanhe na plataforma: {{support_url}}',
    enabled: true,
  },
  {
    key: 'support_feedback_status',
    name: 'Suporte - mudanca de status',
    description: 'Enviado quando o status do atendimento muda.',
    subject: 'Status do seu atendimento - ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Status do atendimento',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{status_intro}}</p><p><strong>Status atual:</strong> {{status_line}}</p><p><strong>Tema:</strong> {{reason}}</p>',
      ctaLabel: 'Acompanhar suporte',
      ctaUrl: '{{support_url}}',
    }),
    textBody: 'Olá {{name}},\n\n{{status_intro}}\nStatus atual: {{status_line}}\nTema: {{reason}}\n\nAcompanhe na plataforma: {{support_url}}',
    enabled: true,
  },
  {
    key: 'support_report_decision',
    name: 'Denúncia - conclusão',
    description: 'Enviado quando a moderação conclui uma denúncia.',
    subject: 'Conclusão da denúncia - ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Conclusão da denúncia',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{intro}}</p><p><strong>Alvo:</strong> {{target_label}}</p><p><strong>Motivo informado:</strong> {{reason}}</p><p><strong>Resposta:</strong></p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;white-space:pre-wrap;">{{admin_reason_html}}</div>{{evidence_block_html}}',
      ctaLabel: 'Abrir suporte',
      ctaUrl: '{{support_url}}',
    }),
    textBody: 'Olá {{name}},\n\n{{intro}}\nAlvo: {{target_label}}\nMotivo informado: {{reason}}\n\nResposta:\n{{admin_reason}}\n\nAcompanhe na plataforma: {{support_url}}',
    enabled: true,
  },
  {
    key: 'marketing_campaign_message',
    name: 'Marketing - campanha automatica',
    description: 'Enviado por regras de campanha, como conta recente, inatividade, trial ou proximidade de assinatura.',
    subject: '{{title}}',
    htmlBody: buildDefaultEmailHtml({
      title: '{{title}}',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{message_html}}</p>',
      ctaLabel: 'Ver campanha',
      ctaUrl: '{{action_url}}',
    }),
    textBody: 'Olá {{name}},\n\n{{message}}\n\nAcesse: {{action_url}}',
    enabled: true,
  },
  {
    key: 'transaction_refund_completed',
    name: 'Transação - reembolso concluído',
    description: 'Enviado quando um reembolso e processado.',
    subject: 'Reembolso processado - ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Reembolso processado',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Ver historico',
      ctaUrl: '{{billing_url}}',
    }),
    textBody: 'Olá {{name}},\n\nSeu reembolso foi processado.\nAcompanhe em: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'transaction_refund_retention_offer',
    name: 'Transacao - proposta de retencao',
    description: 'Enviado antes do estorno final com proposta de permanencia.',
    subject: 'Uma proposta para você continuar com seu acesso',
    htmlBody: buildDefaultEmailHtml({
      title: 'Uma proposta para você continuar',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Ver proposta',
      ctaUrl: '{{billing_url}}',
    }),
    textBody: 'Olá {{name}},\n\nTemos uma proposta para sua conta.\nAcesse: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'transaction_refund_request_admin',
    name: 'Financeiro - alerta de reembolso',
    description: 'Enviado para admin quando chega novo pedido de reembolso.',
    subject: 'Nova solicitação de reembolso - ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Nova solicitação de reembolso',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Abrir painel',
      ctaUrl: '{{admin_url}}',
    }),
    textBody: 'Olá {{name}},\n\nNova solicitação de reembolso recebida.\nAbrir painel: {{admin_url}}',
    enabled: true,
  },
  {
    key: 'subscription_welcome',
    name: 'Assinatura - boas-vindas',
    description: 'Enviado apos assinatura aprovada.',
    subject: 'Parabens pela sua assinatura',
    htmlBody: buildDefaultEmailHtml({
      title: 'Assinatura confirmada',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Gerenciar assinatura',
      ctaUrl: '{{billing_url}}',
    }),
    textBody: 'Olá {{name}},\n\nSua assinatura foi confirmada.\nVeja detalhes em: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_manual_gift',
    name: 'Assinatura - cortesia manual',
    description: 'Enviado quando o admin concede dias ou upgrade gratuito de cortesia.',
    subject: 'Você recebeu uma cortesia no ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Você ganhou uma cortesia',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>Você recebeu <strong>{{days_label}}</strong> grátis no <strong>{{plan_name}}</strong>.</p><p>Seu acesso está liberado até <strong>{{end_date}}</strong>.</p><p>Para continuar usando os benefícios depois desse período, cadastre um cartão. Ele só será usado na renovação.</p>',
      ctaLabel: 'Cadastrar cartão para renovar',
      ctaUrl: '{{billing_url}}',
    }),
    textBody: 'Olá {{name}},\n\nVocê recebeu {{days_label}} grátis no {{plan_name}}.\nAcesso ativo até: {{end_date}}\n\nPara continuar depois, cadastre um cartão: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_payment_receipt',
    name: 'Assinatura - recibo',
    description: 'Enviado quando um pagamento recorrente é confirmado.',
    subject: 'Recibo do seu pagamento - ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Pagamento confirmado',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Abrir recibo',
      ctaUrl: '{{receipt_url}}',
    }),
    textBody: 'Olá {{name}},\n\nSeu pagamento foi confirmado.\nRecibo: {{receipt_url}}',
    enabled: true,
  },
  {
    key: 'subscription_payment_failed',
    name: 'Assinatura - falha no pagamento',
    description: 'Enviado quando uma cobrança recorrente falha.',
    subject: 'Falha no pagamento da sua assinatura',
    htmlBody: buildDefaultEmailHtml({
      title: 'Falha no pagamento',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Atualizar pagamento',
      ctaUrl: '{{billing_url}}',
    }),
    textBody: 'Olá {{name}},\n\nNão conseguimos concluir sua cobrança.\nRegularize em: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_payment_method_update',
    name: 'Assinatura - atualizar pagamento',
    description: 'Enviado manualmente pelo financeiro quando há cartão vencido, ausente ou risco de cobrança.',
    subject: 'Atualize os dados de pagamento da sua assinatura',
    htmlBody: buildDefaultEmailHtml({
      title: 'Atualize seu pagamento',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>Identificamos que os dados de pagamento da sua assinatura precisam de atenção.</p><p><strong>Plano:</strong> {{plan_name}}</p><p><strong>Cartão:</strong> {{card_label}}</p><p><strong>Motivo:</strong> {{reason}}</p><p>Atualize ou troque o cartão salvo para evitar bloqueios nos simulados e materiais premium.</p>',
      ctaLabel: 'Atualizar pagamento',
      ctaUrl: '{{billing_url}}',
    }),
    textBody: 'Olá {{name}},\n\nIdentificamos que os dados de pagamento da sua assinatura precisam de atenção.\nPlano: {{plan_name}}\nCartão: {{card_label}}\nMotivo: {{reason}}\n\nAtualize em: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_renewal_reminder',
    name: 'Assinatura - lembrete de renovação',
    description: 'Enviado 5 dias antes da renovação automática, apenas para ciclos maiores que 5 dias.',
    subject: 'Sua assinatura vai renovar em 5 dias',
    htmlBody: buildDefaultEmailHtml({
      title: 'Renovação em 5 dias',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Ver detalhes',
      ctaUrl: '{{billing_url}}',
    }),
    textBody: 'Olá {{name}},\n\nSua assinatura vai renovar em breve.\nDetalhes em: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_renewal_tomorrow',
    name: 'Assinatura - renovação amanhã',
    description: 'Enviado um dia antes da renovação automática.',
    subject: 'Seu plano renovará amanhã',
    htmlBody: buildDefaultEmailHtml({
      title: 'Seu plano renovará amanhã',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Ver assinatura',
      ctaUrl: '{{billing_url}}',
    }),
    textBody: 'Olá {{name}},\n\nSeu plano renovará amanhã.\nDetalhes em: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_refund_processed',
    name: 'Assinatura - estorno concluído',
    description: 'Enviado quando o estorno da assinatura é processado.',
    subject: 'Reembolso da assinatura processado',
    htmlBody: buildDefaultEmailHtml({
      title: 'Reembolso da assinatura processado',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Ver historico',
      ctaUrl: '{{billing_url}}',
    }),
    textBody: 'Olá {{name}},\n\nSeu estorno foi processado.\nHistórico: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_cancellation_outcome',
    name: 'Assinatura - conclusão do cancelamento',
    description: 'Enviado com o resultado do cancelamento.',
    subject: 'Atualização do cancelamento da assinatura',
    htmlBody: buildDefaultEmailHtml({
      title: 'Cancelamento atualizado',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Acompanhar assinatura',
      ctaUrl: '{{billing_url}}',
    }),
    textBody: 'Olá {{name}},\n\nSeu cancelamento foi atualizado.\nAcompanhe: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_refund_pending_admin',
    name: 'Assinatura - alerta admin de estorno pendente',
    description: 'Enviado para admin quando um estorno exige mediação.',
    subject: 'Reembolso de assinatura pendente - ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Reembolso pendente',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Abrir painel',
      ctaUrl: '{{admin_url}}',
    }),
    textBody: 'Olá {{name}},\n\nHá um estorno de assinatura pendente.\nAbrir painel: {{admin_url}}',
    enabled: true,
  },
  {
    key: 'subscription_new_admin',
    name: 'Assinatura - alerta admin de nova assinatura',
    description: 'Enviado para admin quando uma nova assinatura Stripe é confirmada.',
    subject: 'Nova assinatura confirmada - ConcursoMestre',
    htmlBody: buildDefaultEmailHtml({
      title: 'Nova assinatura confirmada',
      body: '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
      ctaLabel: 'Abrir financeiro',
      ctaUrl: '{{admin_url}}',
    }),
    textBody: 'Olá {{name}},\n\nNova assinatura confirmada.\nAluno: {{buyer_name}}\nPlano: {{plan_name}}\nValor: {{amount_label}}\nInvoice: {{invoice_id}}\n\nAbrir financeiro: {{admin_url}}',
    enabled: true,
  },
];

const normalizeTemplateString = (value: unknown, fallback: string): string => {
  const normalized = String(value ?? '').trim();
  return normalized !== '' ? normalized : fallback;
};

export const normalizeEmailTemplates = (
  incoming?: EmailTemplateModel[] | null,
): EmailTemplateModel[] => {
  const mergedByKey = new Map<string, EmailTemplateModel>();

  DEFAULT_AUTH_EMAIL_TEMPLATES.forEach((template) => {
    mergedByKey.set(template.key, { ...template });
  });

  if (Array.isArray(incoming)) {
    incoming.forEach((candidate) => {
      if (!candidate || typeof candidate !== 'object') {
        return;
      }

      const key = String(candidate.key || '').trim();
      if (!key) {
        return;
      }

      const fallback = mergedByKey.get(key);
      mergedByKey.set(key, {
        key,
        name: normalizeTemplateString(candidate.name, fallback?.name || key),
        description: normalizeTemplateString(candidate.description, fallback?.description || ''),
        subject: normalizeTemplateString(candidate.subject, fallback?.subject || ''),
        htmlBody: normalizeTemplateString(candidate.htmlBody, fallback?.htmlBody || ''),
        textBody: normalizeTemplateString(candidate.textBody, fallback?.textBody || ''),
        enabled: candidate.enabled !== undefined ? Boolean(candidate.enabled) : (fallback?.enabled ?? true),
        updatedAt: candidate.updatedAt || fallback?.updatedAt,
      });
    });
  }

  return Array.from(mergedByKey.values());
};

export const DEFAULT_EMAIL_TEMPLATES = normalizeEmailTemplates();
