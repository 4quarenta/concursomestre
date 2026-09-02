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

import React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import type { ErrorReport, Material } from '@types';
import { AlertTriangle, CheckCircle2, Eye, FileText, Image as ImageIcon, ShieldAlert, X, XCircle } from 'lucide-react';
import { buildMaterialAccessEndpoint, openAuthenticatedFile } from '@services/api';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';
import {
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';

interface ModerationTemplate {
  label: string;
  message: string;
}

interface MaterialModerationModalProps {
  material: Material;
  selectedReport: ErrorReport | null;
  moderationReason: string;
  onModerationReasonChange: (value: string) => void;
  moderationEvidence: string | null;
  onEvidenceSelected: (file: File | null) => void;
  onClearEvidence: () => void;
  templates: ModerationTemplate[];
  onApplyTemplate: (message: string) => void;
  onOpenAuthorProfile: (userId: string) => void;
  onOpenReporterProfile: (userId: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onHide: () => void;
  onBlock: () => void;
  pendingModerationAction: 'hide' | 'block' | null;
  actionLoading: 'approve' | 'hide' | 'block' | null;
  onCancelPendingAction: () => void;
  onConfirmPendingAction: () => void;
}

const MaterialModerationModal = ({
  material,
  selectedReport,
  moderationReason,
  onModerationReasonChange,
  moderationEvidence,
  onEvidenceSelected,
  onClearEvidence,
  templates,
  onApplyTemplate,
  onOpenAuthorProfile,
  onOpenReporterProfile,
  onClose,
  onApprove,
  onHide,
  onBlock,
  pendingModerationAction,
  actionLoading,
  onCancelPendingAction,
  onConfirmPendingAction,
}: MaterialModerationModalProps) => {
  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
        <div className={`${ADMIN_MODAL_PANEL_CLASS} flex max-h-[94vh] w-full max-w-6xl flex-col shadow-2xl animate-scale-up`}>
          <header className={ADMIN_MODAL_HEADER_CLASS}>
            <div>
              <span className="mb-2 inline-flex rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                Moderação
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{material.title}</h3>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">Por: {material.authorName}</p>
                <button
                  type="button"
                  onClick={() => onOpenAuthorProfile(material.authorId)}
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  <Eye size={12} /> Perfil admin
                </button>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-400 transition-colors hover:bg-white dark:hover:bg-slate-800">
              <XCircle size={20} />
            </button>
          </header>

          <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="space-y-5">
              {selectedReport && (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/10">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-700 dark:text-red-400">
                    <AlertTriangle size={14} /> Denúncia ativa
                  </div>
                  <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300">{selectedReport.reason}</p>
                  <p className="mt-2 text-sm leading-relaxed text-red-600 dark:text-red-200">&quot;{selectedReport.details}&quot;</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-red-500 dark:text-red-300">
                    <span>Por: {selectedReport.userName}</span>
                    <span>{new Date(selectedReport.timestamp).toLocaleDateString()}</span>
                    {selectedReport.userId ? (
                      <button
                        type="button"
                        onClick={() => onOpenReporterProfile(String(selectedReport.userId))}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:bg-slate-950 dark:text-red-300"
                      >
                        <Eye size={10} /> Ver perfil
                      </button>
                    ) : null}
                  </div>
                  {selectedReport.evidenceUrl ? (
                    <div className="mt-4 space-y-2">
                      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-red-400">
                        <ImageIcon size={12} /> Prova enviada
                      </p>
                      <Image
                        src={selectedReport.evidenceUrl}
                        alt="Prova do usuario"
                        width={640}
                        height={360}
                        unoptimized
                        className="max-h-48 w-auto rounded-md border border-red-200 bg-white object-contain dark:border-red-900/40 dark:bg-slate-950"
                      />
                    </div>
                  ) : null}
                </div>
              )}

              <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-5 p-5`}>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Preço</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">R$ {material.price.toFixed(2)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Ano</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{material.year}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Páginas</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{material.pageCount || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Vendas</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{material.salesCount}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Matéria</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{material.subjectText || material.subject}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Assunto</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{material.topic || 'Não especificado'}</p>
                  </div>
                </div>

                <div className="rounded-md border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900/30 dark:bg-indigo-900/10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 dark:text-indigo-300">Arquivo protegido</p>
                        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-200">Acesso controlado pela plataforma.</p>
                      </div>
                    </div>
                    {material.hasFile ? (
                      <button
                        type="button"
                        onClick={() => {
                          void openAuthenticatedFile(buildMaterialAccessEndpoint(material.id)).catch(() => undefined);
                        }}
                        className={ADMIN_PRIMARY_BUTTON_CLASS}
                      >
                        <FileText size={14} /> Abrir PDF
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descrição</p>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{material.description}</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Motivo / mensagem ao autor</label>
                {selectedReport ? (
                  <div className="flex flex-wrap gap-2">
                    {templates.map((template) => (
                      <button
                        key={`${selectedReport.id}-${template.label}`}
                        type="button"
                        onClick={() => onApplyTemplate(template.message)}
                        className={ADMIN_SECONDARY_BUTTON_CLASS}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {selectedReport ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Essa justificativa tambem sera enviada por email ao usuario relacionado a denuncia.
                  </p>
                ) : null}
                <textarea
                  value={moderationReason}
                  onChange={(event) => onModerationReasonChange(event.target.value)}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[140px]`}
                  placeholder="Justificativa da decisão..."
                />
              </div>

              <div className="space-y-3">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Imagem de prova (opcional)</label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className={ADMIN_SECONDARY_BUTTON_CLASS}>
                    <ImageIcon size={14} /> Anexar prova
                    <input type="file" className="hidden" onChange={(event) => onEvidenceSelected(event.target.files?.[0] || null)} />
                  </label>
                  {moderationEvidence ? (
                    <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300">
                      <CheckCircle2 size={16} />
                      <span>Arquivo pronto</span>
                      <button type="button" onClick={onClearEvidence} className="hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {selectedReport ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/10">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-700 dark:text-red-400">
                    <AlertTriangle size={14} /> Resumo da denúncia
                  </div>
                  <div className="mt-3 space-y-2 rounded-md border border-red-100 bg-white p-4 dark:border-red-900/20 dark:bg-slate-950">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedReport.reason}</p>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">&quot;{selectedReport.details}&quot;</p>
                  </div>
                </div>
              ) : null}

              <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-4 p-5`}>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Ações</p>

                <button
                  type="button"
                  onClick={onApprove}
                  disabled={actionLoading !== null}
                  className={`${ADMIN_PRIMARY_BUTTON_CLASS} w-full justify-center bg-emerald-600 hover:bg-emerald-700`}
                >
                  <CheckCircle2 size={16} /> {actionLoading === 'approve' ? 'Aprovando...' : 'Aprovar / manter ativo'}
                </button>

                <button
                  type="button"
                  onClick={onHide}
                  disabled={actionLoading !== null}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} w-full justify-center py-2.5 text-sm`}
                >
                  Ocultar temporariamente
                </button>

                <button
                  type="button"
                  onClick={onBlock}
                  disabled={actionLoading !== null}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <ShieldAlert size={16} /> Bloquear e solicitar contestação
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminConfirmDialog
        isOpen={pendingModerationAction !== null}
        title={pendingModerationAction === 'hide' ? 'Ocultar material' : 'Bloquear material'}
        description={
          pendingModerationAction === 'hide'
            ? 'O material será retirado da vitrine e a denúncia será resolvida com a justificativa preenchida.'
            : 'O material será bloqueado, o autor receberá a mensagem oficial e a denúncia será concluída.'
        }
        confirmLabel={pendingModerationAction === 'hide' ? 'Ocultar material' : 'Bloquear material'}
        loading={actionLoading === pendingModerationAction}
        onCancel={onCancelPendingAction}
        onConfirm={onConfirmPendingAction}
      />
    </>,
    document.body,
  );
};

export default MaterialModerationModal;
