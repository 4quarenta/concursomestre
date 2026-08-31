import React from 'react';
import { CheckCircle2, Loader2, Save, XCircle } from 'lucide-react';

export type AdminQuestionAiGenerationKind = 'teacher' | 'detailed';

export type AdminQuestionAiGenerationStatus = 'pending' | 'running' | 'success' | 'error';

export interface AdminQuestionAiGenerationResult {
  id: string;
  label: string;
  status: AdminQuestionAiGenerationStatus;
  result?: string;
  error?: string;
  isSaved?: boolean;
  isSaving?: boolean;
}

interface AdminQuestionAiGenerationModalProps {
  isOpen: boolean;
  kind: AdminQuestionAiGenerationKind;
  progress: number;
  currentLabel: string;
  results: AdminQuestionAiGenerationResult[];
  hasUnsavedResults?: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave?: () => void;
}

const KIND_LABEL: Record<AdminQuestionAiGenerationKind, string> = {
  teacher: 'Comentário do professor',
  detailed: 'Análise detalhada',
};

const statusIcon = (item: AdminQuestionAiGenerationResult) => {
  if (item.status === 'running' || item.isSaving) {
    return <Loader2 size={15} className="animate-spin text-blue-600 dark:text-blue-300" />;
  }

  if (item.error) {
    return <XCircle size={15} className="text-red-600 dark:text-red-300" />;
  }

  if (item.status === 'success') {
    return <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-300" />;
  }

  if (item.status === 'error') {
    return <XCircle size={15} className="text-red-600 dark:text-red-300" />;
  }

  return <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />;
};

const AdminQuestionAiGenerationModal = ({
  isOpen,
  kind,
  progress,
  currentLabel,
  results,
  hasUnsavedResults = false,
  isSaving = false,
  onClose,
  onSave,
}: AdminQuestionAiGenerationModalProps) => {
  if (!isOpen) {
    return null;
  }

  const isRunning = results.some((item) => item.status === 'running' || item.status === 'pending');
  const completedCount = results.filter((item) => item.status === 'success').length;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-sm border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Geração IA
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{KIND_LABEL[kind]}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {isRunning ? currentLabel || 'Preparando questões selecionadas...' : `${completedCount} resultado(s) gerado(s).`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasUnsavedResults && !isRunning && (
              <button
                type="button"
                disabled={isSaving}
                onClick={onSave}
                className="inline-flex items-center gap-2 rounded-sm border border-blue-700 bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar resultado(s)
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Progresso</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-400"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="space-y-4">
            {results.map((item) => (
              <div
                key={item.id}
                className="rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  {statusIcon(item)}
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                  {item.status === 'success' && item.result && (
                    <span className={`ml-auto rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      item.isSaved
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}>
                      {item.isSaved ? 'Salvo' : item.isSaving ? 'Salvando' : 'Pendente'}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  {item.result ? (
                    <div className="space-y-3">
                      {item.error && (
                        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                          {item.error}
                        </p>
                      )}
                      <pre className="max-h-72 whitespace-pre-wrap rounded-sm bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200">
                        {item.result}
                      </pre>
                    </div>
                  ) : item.error ? (
                    <p className="text-sm font-medium text-red-600 dark:text-red-300">{item.error}</p>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {item.status === 'running' ? 'Gerando conteúdo...' : 'Aguardando processamento.'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminQuestionAiGenerationModal;
