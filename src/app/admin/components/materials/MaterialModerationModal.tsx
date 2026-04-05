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
import type { ErrorReport, Material } from '@types';
import { AlertTriangle, CheckCircle2, Eye, FileText, Image as ImageIcon, Lock, ShieldAlert, X, XCircle } from 'lucide-react';

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
}: MaterialModerationModalProps) => {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-white animate-in fade-in slide-in-from-bottom-4 duration-300 dark:bg-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden p-8 no-scrollbar md:p-12">
        <header className="flex justify-between items-start">
          <div>
            <span className="mb-2 block w-fit rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              Moderacao
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{material.title}</h3>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Por: {material.authorName}</p>
              <button
                type="button"
                onClick={() => onOpenAuthorProfile(material.authorId)}
                className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <Eye size={10} /> Perfil Admin
              </button>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
            <XCircle size={20} className="text-slate-400 dark:text-slate-500" />
          </button>
        </header>

        {selectedReport && (
          <div className="space-y-2 rounded-2xl border border-red-100 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-700">
              <AlertTriangle size={14} /> Denuncia: {selectedReport.reason}
            </div>
            <p className="text-xs italic leading-relaxed text-red-600/80">"{selectedReport.details}"</p>
            <div className="mt-2 flex items-center gap-2 border-t border-red-100/50 pt-2 text-[10px] font-bold text-red-500">
              <div className="flex items-center gap-2">
                <span>Reportado por: {selectedReport.userName}</span>
                <button
                  type="button"
                  onClick={() => selectedReport.userId && onOpenReporterProfile(selectedReport.userId)}
                  className="rounded bg-red-100 px-1.5 py-0.5 text-[8px] font-black uppercase text-red-700 hover:bg-red-200"
                >
                  <Eye size={8} /> Ver Perfil
                </button>
              </div>
              <span>â€¢</span>
              <span>{new Date(selectedReport.timestamp).toLocaleDateString()}</span>
            </div>
            {selectedReport.evidenceUrl && (
              <div className="mt-2 border-t border-red-100/50 pt-2">
                <p className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase text-red-400">
                  <ImageIcon size={10} /> Prova do Usuario:
                </p>
                <img src={selectedReport.evidenceUrl} alt="Prova do Usuario" className="max-h-32 rounded-xl border border-red-200 bg-white object-contain" />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 overflow-y-auto pr-2 no-scrollbar lg:grid-cols-2">
          <div className="space-y-6">
            <div className="space-y-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Preco</p>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">R$ {material.price.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ano</p>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">{material.year}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Paginas</p>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">{material.pageCount || '?'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vendas</p>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">{material.salesCount}</p>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-200/50 pt-4 dark:border-slate-800/50">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Materia</p>
                    <p className="text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300">{material.subjectText || material.subject}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Assunto</p>
                    <p className="text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300">{material.topic || 'Nao especificado'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-indigo-100/50 bg-indigo-50/50 p-4 dark:border-indigo-900/20 dark:bg-indigo-900/10">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                      <Lock size={16} />
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400">Senha do PDF</p>
                      <p className="text-sm font-mono font-black text-indigo-700 dark:text-indigo-300">{material.pdfPassword || 'Sem Senha'}</p>
                    </div>
                  </div>
                  {material.fileUrl && (
                    <a
                      href={material.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-700"
                    >
                      <FileText size={14} /> Abrir PDF
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Descricao</p>
                <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-400">{material.description}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo / Mensagem ao Autor</label>
                {selectedReport && (
                  <div className="flex flex-wrap gap-2">
                    {templates.map((template) => (
                      <button
                        key={`${selectedReport.id}-${template.label}`}
                        type="button"
                        onClick={() => onApplyTemplate(template.message)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                )}
                {selectedReport && (
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    A justificativa enviada aqui tambem sera disparada por e-mail automatico para o usuario que abriu a denuncia.
                  </p>
                )}
                <textarea
                  value={moderationReason}
                  onChange={(event) => onModerationReasonChange(event.target.value)}
                  className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium outline-none transition-all focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="Justificativa da decisao..."
                />
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Imagem de Prova (Opcional)</label>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-indigo-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800">
                    <ImageIcon size={18} className="text-indigo-500" /> Anexar Prova
                    <input type="file" className="hidden" onChange={(event) => onEvidenceSelected(event.target.files?.[0] || null)} />
                  </label>
                  {moderationEvidence && (
                    <div className="animate-fade-in flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-emerald-700 dark:border-emerald-900/10 dark:bg-emerald-900/20 dark:text-emerald-400">
                      <CheckCircle2 size={16} />
                      <span className="text-[10px] font-black uppercase">Pronto</span>
                      <button type="button" onClick={onClearEvidence} className="ml-2 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {selectedReport && (
              <div className="space-y-4 rounded-[2rem] border border-red-100 bg-red-50 p-6 dark:border-red-900/20 dark:bg-red-900/10">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-400">
                  <AlertTriangle size={16} /> Denuncia Ativa
                </div>
                <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
                  <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">{selectedReport.reason}</p>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">"{selectedReport.details}"</p>
                </div>

                {selectedReport.evidenceUrl && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1 text-[9px] font-black uppercase text-red-400">
                      <ImageIcon size={10} /> Prova enviada:
                    </p>
                    <img src={selectedReport.evidenceUrl} alt="Prova" className="max-h-48 w-full rounded-xl border border-red-200 bg-white object-cover dark:border-red-900 dark:bg-slate-900" />
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] font-bold text-red-400">
                  <span>Por: {selectedReport.userName}</span>
                  <span>{new Date(selectedReport.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            <div className="mt-auto space-y-4 rounded-[2.5rem] border border-slate-200 bg-slate-100 p-6 dark:border-slate-800 dark:bg-slate-900">
              <p className="px-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Escolha a acao definitiva para este conteudo
              </p>

              <button
                type="button"
                onClick={onApprove}
                className="flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-emerald-500 py-5 text-[11px] font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-500/10 transition-all hover:bg-emerald-600"
              >
                <CheckCircle2 size={18} /> Aprovar / Manter Ativo
              </button>

              <button
                type="button"
                onClick={onHide}
                className="w-full rounded-[1.5rem] border border-slate-200 bg-white py-4 text-[11px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                Ocultar Temporario
              </button>

              <button
                type="button"
                onClick={onBlock}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-xs font-black uppercase text-white shadow-lg shadow-red-200 transition-all hover:bg-red-600"
              >
                <ShieldAlert size={16} /> Bloquear e Solicitar Contestacao
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MaterialModerationModal;
