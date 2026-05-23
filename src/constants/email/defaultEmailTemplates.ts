import type { EmailTemplateModel } from '@types';

const DEFAULT_AUTH_EMAIL_TEMPLATES: EmailTemplateModel[] = [
  {
    key: 'auth_email_confirmation',
    name: 'Confirmacao de e-mail',
    description: 'Enviado apos cadastro para ativar a conta.',
    subject: 'Confirme sua conta - ConcursoMestre',
    htmlBody: '<p>Ola, <strong>{{name}}</strong>!</p><p>Confirme seu e-mail para ativar a conta e liberar todos os recursos.</p><p><a href="{{confirm_url}}" target="_blank" rel="noopener noreferrer">Confirmar e-mail</a></p>',
    textBody: 'Ola {{name}},\n\nConfirme seu e-mail: {{confirm_url}}\n\nEquipe ConcursoMestre',
    enabled: true,
  },
  {
    key: 'auth_email_confirmation_resend',
    name: 'Reenvio de confirmacao',
    description: 'Enviado quando o usuario solicita novo link de confirmacao.',
    subject: 'Confirme sua conta - ConcursoMestre',
    htmlBody: '<p>Ola, <strong>{{name}}</strong>!</p><p>Recebemos seu pedido de novo link de confirmacao.</p><p><a href="{{confirm_url}}" target="_blank" rel="noopener noreferrer">Confirmar e-mail</a></p>',
    textBody: 'Ola {{name}},\n\nNovo link de confirmacao: {{confirm_url}}\n\nEquipe ConcursoMestre',
    enabled: true,
  },
  {
    key: 'auth_password_reset',
    name: 'Redefinicao de senha',
    description: 'Enviado quando o usuario solicita recuperacao de senha.',
    subject: 'Redefina sua senha - ConcursoMestre',
    htmlBody: '<p>Ola, <strong>{{name}}</strong>!</p><p>Recebemos uma solicitacao para redefinir sua senha.</p><p><a href="{{reset_url}}" target="_blank" rel="noopener noreferrer">Redefinir senha</a></p>',
    textBody: 'Ola {{name}},\n\nUse este link para redefinir sua senha: {{reset_url}}\n\nEquipe ConcursoMestre',
    enabled: true,
  },
  {
    key: 'auth_welcome',
    name: 'Boas-vindas',
    description: 'Enviado apos confirmacao do e-mail.',
    subject: 'Bem-vindo ao ConcursoMestre',
    htmlBody: '<p>Ola <strong>{{name}}</strong>, sua conta foi ativada com sucesso.</p><p>Comece seus estudos agora: <a href="{{login_url}}" target="_blank" rel="noopener noreferrer">Acessar plataforma</a></p>',
    textBody: 'Ola {{name}},\n\nSua conta foi ativada com sucesso.\nAcesse: {{login_url}}\n\nEquipe ConcursoMestre',
    enabled: true,
  },
  {
    key: 'support_feedback_reply',
    name: 'Suporte - resposta',
    description: 'Enviado quando o admin responde um atendimento.',
    subject: 'Resposta do suporte - ConcursoMestre',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{intro}}</p><p><strong>Tema:</strong> {{reason}}</p><p><strong>Resposta:</strong></p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;white-space:pre-wrap;">{{reply_message_html}}</div>',
    textBody: 'Ola {{name}},\n\n{{intro}}\n\nTema: {{reason}}\n\nResposta:\n{{reply_message}}\n\nAcompanhe na plataforma: {{support_url}}',
    enabled: true,
  },
  {
    key: 'support_feedback_status',
    name: 'Suporte - mudanca de status',
    description: 'Enviado quando o status do atendimento muda.',
    subject: 'Status do seu atendimento - ConcursoMestre',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{status_intro}}</p><p><strong>Status atual:</strong> {{status_line}}</p><p><strong>Tema:</strong> {{reason}}</p>',
    textBody: 'Ola {{name}},\n\n{{status_intro}}\nStatus atual: {{status_line}}\nTema: {{reason}}\n\nAcompanhe na plataforma: {{support_url}}',
    enabled: true,
  },
  {
    key: 'support_report_decision',
    name: 'Denuncia - conclusao',
    description: 'Enviado quando a moderacao conclui uma denuncia.',
    subject: 'Conclusao da denuncia - ConcursoMestre',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{intro}}</p><p><strong>Alvo:</strong> {{target_label}}</p><p><strong>Motivo informado:</strong> {{reason}}</p><p><strong>Resposta:</strong></p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;white-space:pre-wrap;">{{admin_reason_html}}</div>{{evidence_block_html}}',
    textBody: 'Ola {{name}},\n\n{{intro}}\nAlvo: {{target_label}}\nMotivo informado: {{reason}}\n\nResposta:\n{{admin_reason}}\n\nAcompanhe na plataforma: {{support_url}}',
    enabled: true,
  },
  {
    key: 'marketing_campaign_message',
    name: 'Marketing - campanha automatica',
    description: 'Enviado por regras de campanha, como conta recente, inatividade, trial ou proximidade de assinatura.',
    subject: '{{title}}',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{message_html}}</p><p><a href="{{action_url}}" target="_blank" rel="noopener noreferrer">Ver campanha</a></p>',
    textBody: 'Ola {{name}},\n\n{{message}}\n\nAcesse: {{action_url}}',
    enabled: true,
  },
  {
    key: 'transaction_refund_completed',
    name: 'Transacao - reembolso concluido',
    description: 'Enviado quando um reembolso e processado.',
    subject: 'Reembolso processado - ConcursoMestre',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{content}}</p>',
    textBody: 'Ola {{name}},\n\nSeu reembolso foi processado.\nAcompanhe em: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'transaction_refund_retention_offer',
    name: 'Transacao - proposta de retencao',
    description: 'Enviado antes do estorno final com proposta de permanencia.',
    subject: 'Uma proposta para voce continuar com seu acesso',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{content}}</p>',
    textBody: 'Ola {{name}},\n\nTemos uma proposta para sua conta.\nAcesse: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'transaction_refund_request_admin',
    name: 'Financeiro - alerta de reembolso',
    description: 'Enviado para admin quando chega novo pedido de reembolso.',
    subject: 'Nova solicitacao de reembolso - ConcursoMestre',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{content}}</p>',
    textBody: 'Ola {{name}},\n\nNova solicitacao de reembolso recebida.\nAbrir painel: {{admin_url}}',
    enabled: true,
  },
  {
    key: 'subscription_welcome',
    name: 'Assinatura - boas-vindas',
    description: 'Enviado apos assinatura aprovada.',
    subject: 'Parabens pela sua assinatura',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{content}}</p>',
    textBody: 'Ola {{name}},\n\nSua assinatura foi confirmada.\nVeja detalhes em: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_payment_receipt',
    name: 'Assinatura - recibo',
    description: 'Enviado quando um pagamento recorrente e confirmado.',
    subject: 'Recibo do seu pagamento - ConcursoMestre',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{content}}</p>',
    textBody: 'Ola {{name}},\n\nSeu pagamento foi confirmado.\nRecibo: {{receipt_url}}',
    enabled: true,
  },
  {
    key: 'subscription_payment_failed',
    name: 'Assinatura - falha no pagamento',
    description: 'Enviado quando uma cobranca recorrente falha.',
    subject: 'Falha no pagamento da sua assinatura',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{content}}</p>',
    textBody: 'Ola {{name}},\n\nNao conseguimos concluir sua cobranca.\nRegularize em: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_renewal_reminder',
    name: 'Assinatura - lembrete de renovacao',
    description: 'Enviado 5 dias antes da renovacao automatica, apenas para ciclos maiores que 5 dias.',
    subject: 'Sua assinatura vai renovar em 5 dias',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{content}}</p>',
    textBody: 'Ola {{name}},\n\nSua assinatura vai renovar em breve.\nDetalhes em: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_renewal_tomorrow',
    name: 'Assinatura - renovacao amanha',
    description: 'Enviado um dia antes da renovacao automatica.',
    subject: 'Seu plano renovara amanha',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{content}}</p>',
    textBody: 'Ola {{name}},\n\nSeu plano renovara amanha.\nDetalhes em: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_refund_processed',
    name: 'Assinatura - estorno concluido',
    description: 'Enviado quando o estorno da assinatura e processado.',
    subject: 'Reembolso da assinatura processado',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{content}}</p>',
    textBody: 'Ola {{name}},\n\nSeu estorno foi processado.\nHistorico: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_cancellation_outcome',
    name: 'Assinatura - conclusao do cancelamento',
    description: 'Enviado com o resultado do cancelamento.',
    subject: 'Atualizacao do cancelamento da assinatura',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{content}}</p>',
    textBody: 'Ola {{name}},\n\nSeu cancelamento foi atualizado.\nAcompanhe: {{billing_url}}',
    enabled: true,
  },
  {
    key: 'subscription_refund_pending_admin',
    name: 'Assinatura - alerta admin de estorno pendente',
    description: 'Enviado para admin quando um estorno exige mediacao.',
    subject: 'Reembolso de assinatura pendente - ConcursoMestre',
    htmlBody: '<p>Ola <strong>{{name}}</strong>,</p><p>{{content}}</p>',
    textBody: 'Ola {{name}},\n\nHa um estorno de assinatura pendente.\nAbrir painel: {{admin_url}}',
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
