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

type AdminEmailTemplatesSectionProps = {
  templates: EmailTemplateModel[];
  onChange: (templates: EmailTemplateModel[]) => void;
  defaultTestEmail?: string;
  onSendTest?: (template: EmailTemplateModel, targetEmail: string) => Promise<string>;
};

const AdminEmailTemplatesSection: React.FC<AdminEmailTemplatesSectionProps> = ({
  templates,
  onChange,
  defaultTestEmail = '',
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex items-start justify-between gap-3`}>
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

            <div className="space-y-4 p-5">
              <div className="grid gap-2">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Assunto</label>
                <input
                  value={draft.subject}
                  onChange={(event) => setDraft((current) => (current ? { ...current, subject: event.target.value } : current))}
                  className={`w-full ${ADMIN_FIELD_CLASS}`}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">HTML</label>
                <textarea
                  value={draft.htmlBody}
                  onChange={(event) => setDraft((current) => (current ? { ...current, htmlBody: event.target.value } : current))}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[170px]`}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Texto puro</label>
                <textarea
                  value={draft.textBody}
                  onChange={(event) => setDraft((current) => (current ? { ...current, textBody: event.target.value } : current))}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[120px]`}
                />
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
                Placeholders disponiveis: {'{{name}}'}, {'{{email}}'}, {'{{confirm_url}}'}, {'{{reset_url}}'}, {'{{login_url}}'}, {'{{app_url}}'}, {'{{xp_bonus}}'}, {'{{support_url}}'}, {'{{billing_url}}'}, {'{{admin_url}}'}, {'{{receipt_url}}'}, {'{{reason}}'}, {'{{status_line}}'}, {'{{content}}'}.
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

              <div className="flex items-center justify-end gap-2 pt-2">
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
