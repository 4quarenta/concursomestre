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

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, Loader2, Mail, Save, Send, X } from 'lucide-react';
import type { EmailTemplateModel } from '@types';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';

const EMAIL_PREVIEW_VARIABLES: Record<string, string> = {
  action_url: 'https://concursomestre.com/app',
  admin_url: 'https://concursomestre.com/admin',
  app_url: 'https://concursomestre.com',
  billing_url: 'https://concursomestre.com/perfil/assinatura',
  confirm_url: 'https://concursomestre.com/confirmar-email',
  content: 'Mensagem principal do modelo com as informacoes importantes para o aluno.',
  email: 'aluno@exemplo.com',
  intro: 'Temos uma atualizacao sobre sua solicitacao.',
  login_url: 'https://concursomestre.com/login',
  message: 'Mensagem da campanha.',
  message_html: 'Mensagem da campanha com detalhes importantes.',
  name: 'Joao Silva',
  reason: 'Ajuda com acesso',
  receipt_url: 'https://concursomestre.com/recibo',
  reset_url: 'https://concursomestre.com/redefinir-senha',
  status_line: 'Em atendimento',
  status_intro: 'Seu atendimento foi atualizado.',
  support_url: 'https://concursomestre.com/suporte',
  title: 'Atualizacao ConcursoMestre',
  xp_bonus: '25',
};

const EMAIL_PREVIEW_BUTTONS: Record<string, string> = {
  action_url: 'Abrir',
  admin_url: 'Abrir painel',
  app_url: 'Acessar plataforma',
  billing_url: 'Abrir cobranca',
  confirm_url: 'Confirmar e-mail',
  login_url: 'Acessar plataforma',
  receipt_url: 'Ver recibo',
  reset_url: 'Redefinir senha',
  support_url: 'Abrir suporte',
};

const escapeEmailHtmlAttribute = (value: string): string => (
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
);

const isPublicEmailImageUrl = (value: string): boolean => /^https?:\/\/\S+$/i.test(value.trim());

const buildEmailLogoBlock = (emailLogoUrl = ''): string => {
  const normalizedLogoUrl = emailLogoUrl.trim();

  if (isPublicEmailImageUrl(normalizedLogoUrl)) {
    const safeLogoUrl = escapeEmailHtmlAttribute(normalizedLogoUrl);

    return `<img src="${safeLogoUrl}" width="48" alt="ConcursoMestre" style="display:block;width:auto;max-width:132px;height:auto;max-height:46px;border:0;outline:none;text-decoration:none;object-fit:contain;" />`;
  }

  return '<div style="width:42px;height:42px;border-radius:14px;background:#2563eb;color:#ffffff;text-align:center;line-height:42px;font-size:16px;font-weight:900;letter-spacing:0.02em;">CM</div>';
};

const applyEmailPreviewBranding = (html: string, emailLogoUrl = ''): string => {
  const logoBlock = buildEmailLogoBlock(emailLogoUrl);
  let nextHtml = html.replace(/\{\{\s*email_logo_block\s*\}\}/gi, logoBlock);

  if (isPublicEmailImageUrl(emailLogoUrl)) {
    nextHtml = nextHtml.replace(
      /<div\s+style=(["'])(?=[^"']*width:42px)(?=[^"']*height:42px)(?=[^"']*background:#2563eb)[^"']*\1>CM<\/div>/gi,
      logoBlock,
    );
  }

  return nextHtml;
};

const applyEmailPreviewVariables = (value: string): string => (
  value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => (
    EMAIL_PREVIEW_VARIABLES[key] || match
  ))
);

const isStandaloneEmailHtml = (html: string): boolean => {
  const trimmed = html.trim();
  if (/^(<!doctype\s+html|<html[\s>])/i.test(trimmed)) {
    return true;
  }

  return /<table\b[^>]*role=["']presentation["']/i.test(trimmed)
    && trimmed.includes('ConcursoMestre')
    && trimmed.includes('max-width');
};

const resolveEmailPreviewButton = (template: EmailTemplateModel): { label: string; url: string } | null => {
  const searchable = `${template.subject || ''} ${template.htmlBody || ''} ${template.textBody || ''}`;
  const key = Object.keys(EMAIL_PREVIEW_BUTTONS).find((candidate) => (
    searchable.includes(`{{${candidate}}}`) || searchable.includes(`{{ ${candidate} }}`)
  ));

  if (!key) {
    return null;
  }

  return {
    label: EMAIL_PREVIEW_BUTTONS[key],
    url: EMAIL_PREVIEW_VARIABLES[key],
  };
};

const buildEmailPreviewShell = (
  title: string,
  content: string,
  button: { label: string; url: string } | null,
  emailLogoUrl = '',
): string => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${title} - ConcursoMestre</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eef2f7;">
    <tr>
      <td align="center" style="padding:36px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe4ef;border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.10);">
          <tr>
            <td style="background:#111827;padding:0;color:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:26px 30px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="width:52px;vertical-align:middle;">
                          ${buildEmailLogoBlock(emailLogoUrl)}
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-size:12px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#93c5fd;">ConcursoMestre</p>
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
            <td style="padding:34px 32px 30px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#2563eb;">Comunicado</p>
              <h1 style="margin:0 0 18px;font-size:25px;line-height:1.24;font-weight:900;color:#0f172a;">${title}</h1>
              <div style="font-size:15px;line-height:1.75;color:#334155;">${content}</div>
              ${button ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:30px 0 10px;"><tr><td align="left"><a href="${button.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;border-radius:12px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;letter-spacing:0.04em;padding:14px 22px;box-shadow:0 12px 24px rgba(37,99,235,0.24);">${button.label}</a></td></tr></table>` : ''}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:28px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                <tr>
                  <td style="padding:14px 16px;font-size:12px;line-height:1.6;color:#64748b;">
                    Se voce nao reconhece esta mensagem, ignore este e-mail ou fale com nosso suporte.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:20px 32px;color:#64748b;font-size:12px;line-height:1.6;">
              <strong style="color:#334155;">Equipe ConcursoMestre</strong><br />
              Este e-mail foi enviado automaticamente pela plataforma. Por seguranca, nunca compartilhe sua senha.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const buildEmailPreviewHtml = (template: EmailTemplateModel, emailLogoUrl = ''): string => {
  const subject = applyEmailPreviewVariables(template.subject || 'ConcursoMestre');
  const htmlBody = applyEmailPreviewBranding(
    applyEmailPreviewVariables(template.htmlBody || '<p>Conteudo do e-mail.</p>'),
    emailLogoUrl,
  );

  if (isStandaloneEmailHtml(htmlBody)) {
    return /^(<!doctype\s+html|<html[\s>])/i.test(htmlBody.trim())
      ? htmlBody
      : `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0;">${htmlBody}</body></html>`;
  }

  return buildEmailPreviewShell(subject, htmlBody, resolveEmailPreviewButton(template), emailLogoUrl);
};

type AdminEmailTemplatesSectionProps = {
  templates: EmailTemplateModel[];
  onChange: (templates: EmailTemplateModel[]) => void;
  defaultTestEmail?: string;
  emailLogoUrl?: string;
  onSendTest?: (template: EmailTemplateModel, targetEmail: string) => Promise<string>;
};

const AdminEmailTemplatesSection: React.FC<AdminEmailTemplatesSectionProps> = ({
  templates,
  onChange,
  defaultTestEmail = '',
  emailLogoUrl = '',
  onSendTest,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmailTemplateModel | null>(null);
  const [testTargetEmail, setTestTargetEmail] = useState(defaultTestEmail);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const editingTemplate = useMemo(
    () => templates.find((template) => template.key === editingKey) || null,
    [editingKey, templates],
  );
  const previewHtml = useMemo(
    () => (draft ? buildEmailPreviewHtml(draft, emailLogoUrl) : ''),
    [draft, emailLogoUrl],
  );

  const allSelected = templates.length > 0 && selectedKeys.size === templates.length;

  const toggleSelectAll = () => {
    setSelectedKeys((current) => {
      if (current.size === templates.length) {
        return new Set();
      }
      return new Set(templates.map((template) => template.key));
    });
  };

  const toggleSelect = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const applyBulkStatus = (enabled: boolean) => {
    if (selectedKeys.size === 0) {
      return;
    }

    onChange(
      templates.map((template) => (
        selectedKeys.has(template.key)
          ? { ...template, enabled, updatedAt: new Date().toISOString() }
          : template
      )),
    );
  };

  const openEditor = (template: EmailTemplateModel) => {
    setEditingKey(template.key);
    setDraft({ ...template });
    setTestTargetEmail(defaultTestEmail);
    setTestResult(null);
  };

  const closeEditor = () => {
    setEditingKey(null);
    setDraft(null);
  };

  const saveTemplate = () => {
    if (!draft) {
      return;
    }

    onChange(
      templates.map((template) => (
        template.key === draft.key
          ? {
            ...template,
            ...draft,
            subject: String(draft.subject || '').trim(),
            htmlBody: String(draft.htmlBody || '').trim(),
            textBody: String(draft.textBody || '').trim(),
            updatedAt: new Date().toISOString(),
          }
          : template
      )),
    );
    closeEditor();
  };

  const sendTemplateTest = async () => {
    if (!draft || !onSendTest || testingKey) {
      return;
    }

    const targetEmail = testTargetEmail.trim();
    setTestingKey(draft.key);
    setTestResult(null);

    try {
      const message = await onSendTest(draft, targetEmail);
      setTestResult({ ok: true, message });
    } catch (error) {
      setTestResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Nao foi possivel enviar o teste do modelo.',
      });
    } finally {
      setTestingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className={ADMIN_SURFACE_CLASS}>
        <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <Mail size={18} className="text-sky-700 dark:text-sky-300" />
              Modelos de Email
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              Edite assunto e corpo dos emails oficiais da plataforma.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyBulkStatus(true)}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] uppercase tracking-[0.16em]`}
              disabled={selectedKeys.size === 0}
            >
              Ativar selecionados
            </button>
            <button
              type="button"
              onClick={() => applyBulkStatus(false)}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] uppercase tracking-[0.16em]`}
              disabled={selectedKeys.size === 0}
            >
              Desativar selecionados
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-sky-700"
                  />
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Modelo</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Assunto</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Atualizado</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {templates.map((template) => (
                <tr key={template.key} className="bg-white dark:bg-slate-900">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(template.key)}
                      onChange={() => toggleSelect(template.key)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-700"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{template.name}</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{template.description}</p>
                  </td>
                  <td className="max-w-[360px] px-4 py-3">
                    <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {template.subject}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${template.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                      {template.enabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {template.updatedAt ? new Date(template.updatedAt).toLocaleString() : 'Nunca'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEditor(template)}
                      className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] uppercase tracking-[0.16em]`}
                    >
                      <Edit3 size={13} />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingTemplate && draft && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditor();
            }
          }}
        >
          <div className="my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-h-[calc(100vh-2rem)]">
            <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex shrink-0 items-start justify-between gap-3`}>
              <div>
                <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">{editingTemplate.name}</h4>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{editingTemplate.key}</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-2">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Assunto</label>
                <input
                  value={draft.subject}
                  onChange={(event) => setDraft((current) => (current ? { ...current, subject: event.target.value } : current))}
                  className={`w-full ${ADMIN_FIELD_CLASS}`}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">HTML</label>
                    <textarea
                      value={draft.htmlBody}
                      onChange={(event) => setDraft((current) => (current ? { ...current, htmlBody: event.target.value } : current))}
                      className={`${ADMIN_TEXTAREA_CLASS} min-h-[230px]`}
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Texto puro</label>
                    <textarea
                      value={draft.textBody}
                      onChange={(event) => setDraft((current) => (current ? { ...current, textBody: event.target.value } : current))}
                      className={`${ADMIN_TEXTAREA_CLASS} min-h-[130px]`}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-950">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Previa do email</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Fragmentos simples recebem o layout profissional automaticamente.</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      HTML
                    </span>
                  </div>
                  <iframe
                    title={`Previa do modelo ${editingTemplate.name}`}
                    srcDoc={previewHtml}
                    className="h-[430px] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800"
                    sandbox=""
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Template ativo</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Desative para pausar o disparo desse email.</p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) => setDraft((current) => (current ? { ...current, enabled: event.target.checked } : current))}
                  className="h-4 w-4 rounded border-slate-300 text-sky-700"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                Placeholders disponiveis: {'{{name}}'}, {'{{email}}'}, {'{{email_logo_block}}'}, {'{{confirm_url}}'}, {'{{reset_url}}'}, {'{{login_url}}'}, {'{{app_url}}'}, {'{{xp_bonus}}'}, {'{{support_url}}'}, {'{{billing_url}}'}, {'{{admin_url}}'}, {'{{receipt_url}}'}, {'{{reason}}'}, {'{{status_line}}'}, {'{{content}}'}.
              </div>

              {onSendTest && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <div className="grid flex-1 gap-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Enviar teste para</label>
                      <input
                        type="email"
                        value={testTargetEmail}
                        onChange={(event) => setTestTargetEmail(event.target.value)}
                        className={`w-full ${ADMIN_FIELD_CLASS}`}
                        placeholder="admin@concursomestre.com"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void sendTemplateTest()}
                      disabled={testingKey === draft.key || testTargetEmail.trim() === ''}
                      className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-3 text-[10px] uppercase tracking-[0.16em]`}
                    >
                      {testingKey === draft.key ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      {testingKey === draft.key ? 'Enviando...' : 'Enviar teste'}
                    </button>
                  </div>
                  {testResult && (
                    <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-semibold ${
                      testResult.ok
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300'
                        : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/10 dark:text-rose-300'
                    }`}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>
              )}

              <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-slate-100 bg-white/95 px-4 pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:-mx-5 sm:px-5">
                <button type="button" onClick={closeEditor} className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.16em]`}>
                  Cancelar
                </button>
                <button type="button" onClick={saveTemplate} className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.16em]`}>
                  <Save size={13} />
                  Salvar modelo
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default AdminEmailTemplatesSection;
