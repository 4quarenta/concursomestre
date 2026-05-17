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
import type { Question, SystemSettings } from '@types';
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle2,
  Database,
  Edit3,
  FileCheck,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  PlayCircle,
  Save,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Zap,
} from 'lucide-react';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';

type GenerateSpecificType = 'teacher' | 'detailed';
type ExtractedQuestionPreview = Question & {
  correctOptionIndex?: number;
  role?: string;
  year?: string | number;
};

const getQuestionLevelText = (level: Question['nivel'] | Question['level']) => {
  if (level === null || level === undefined || level === '') return 'Superior';
  if (typeof level === 'string' || typeof level === 'number') return String(level);
  return String(level.nome || level.name || level.descricao || 'Superior');
};

interface AdminImportSectionProps {
  systemSettings: SystemSettings;
  onGeminiApiKeyChange: (value: string) => void;
  onSaveSettings: () => void;
  isSavingSettings?: boolean;
  qFile: File | null;
  onQFileChange: (file: File | null) => void;
  kFile: File | null;
  onKFileChange: (file: File | null) => void;
  extractWithComment: boolean;
  onExtractWithCommentChange: (value: boolean) => void;
  isProcessing: boolean;
  examProgress: number;
  keyProgress: number;
  onStartImport: () => void;
  logs: string[];
  extractedQuestions: Question[];
  isBulkGenerating: boolean;
  bulkProgress: number;
  onGenerateDetailedAll: () => void;
  onPublishAll: () => void | Promise<void>;
  onEditExtractedQuestion: (question: Question, index: number) => void;
  generatingSpecific: { index: number; type: GenerateSpecificType } | null;
  onGenerateSpecific: (index: number, type: GenerateSpecificType) => void;
}

const AdminImportSection = ({
  systemSettings,
  onGeminiApiKeyChange,
  onSaveSettings,
  isSavingSettings = false,
  qFile,
  onQFileChange,
  kFile,
  onKFileChange,
  extractWithComment,
  onExtractWithCommentChange,
  isProcessing,
  examProgress,
  keyProgress,
  onStartImport,
  logs,
  extractedQuestions,
  isBulkGenerating,
  bulkProgress,
  onGenerateDetailedAll,
  onPublishAll,
  onEditExtractedQuestion,
  generatingSpecific,
  onGenerateSpecific,
}: AdminImportSectionProps) => {
  return (
    <div className="space-y-6 animate-slide-up">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <div className={`${ADMIN_PAGE_PANEL_CLASS} space-y-6 p-6 transition-colors duration-300`}>
            <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
              <Database size={20} className="text-sky-700 dark:text-sky-300" />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Extracao Inteligente</h3>
            </div>

            <div className={`space-y-3 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  <Zap size={12} className={systemSettings.hasGeminiApiKeyConfigured || systemSettings.geminiApiKey ? 'text-emerald-500' : 'text-slate-400'} />
                  Gemini API Key
                </label>
                {systemSettings.hasGeminiApiKeyConfigured && (
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-500">
                    <CheckCircle2 size={10} /> Configurada
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={systemSettings.geminiApiKey || ''}
                  onChange={(event) => onGeminiApiKeyChange(event.target.value)}
                  placeholder={systemSettings.hasGeminiApiKeyConfigured ? 'Digite uma nova chave para substituir a atual' : 'Cole sua API Key aqui (AIza...)'}
                  className={`h-9 flex-1 text-xs font-medium ${ADMIN_FIELD_CLASS}`}
                />
                <button
                  type="button"
                  onClick={onSaveSettings}
                  disabled={isSavingSettings}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-9 px-3 text-sky-700 dark:text-sky-300`}
                >
                  {isSavingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                </button>
              </div>
              {!systemSettings.hasGeminiApiKeyConfigured && !systemSettings.geminiApiKey && (
                <p className="text-[9px] font-medium leading-tight text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={10} className="mr-1 inline" />
                  Necessario configurar uma chave valida para extrair questoes.
                </p>
              )}
              {systemSettings.hasGeminiApiKeyConfigured && !systemSettings.geminiApiKey && (
                <p className="text-[9px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                  A chave atual fica oculta por seguranca. Preencha o campo apenas para substituir.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="ml-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Arquivo da Prova <span className="font-black text-red-500">*</span>
                </label>
                <label className={`flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed transition-all ${qFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 bg-slate-50 hover:border-sky-700 dark:border-slate-700 dark:bg-slate-950/40'}`}>
                  <input type="file" accept=".pdf" className="hidden" onChange={(event) => onQFileChange(event.target.files?.[0] || null)} />
                  <UploadCloud size={24} className={qFile ? 'text-emerald-500' : 'text-slate-400'} />
                  <span className="mt-2 line-clamp-1 px-4 text-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    {qFile ? qFile.name : 'Selecionar Prova (PDF)'}
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                <label className="ml-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Gabarito Oficial <span className="font-black text-red-500">*</span>
                </label>
                <label className={`flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed transition-all ${kFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 bg-slate-50 hover:border-sky-700 dark:border-slate-700 dark:bg-slate-950/40'}`}>
                  <input type="file" accept=".pdf" className="hidden" onChange={(event) => onKFileChange(event.target.files?.[0] || null)} />
                  <FileCheck size={24} className={kFile ? 'text-emerald-500' : 'text-slate-400'} />
                  <span className="mt-2 line-clamp-1 px-4 text-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    {kFile ? kFile.name : 'Selecionar Gabarito (PDF)'}
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2 rounded-sm border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10">
                <input
                  type="checkbox"
                  checked={extractWithComment}
                  onChange={(event) => onExtractWithCommentChange(event.target.checked)}
                  className="h-4 w-4 rounded-sm text-amber-600 focus:ring-amber-500"
                />
                <label
                  onClick={() => onExtractWithCommentChange(!extractWithComment)}
                  className="cursor-pointer select-none text-xs font-bold text-amber-800 dark:text-amber-200"
                >
                  Extrair Comentario Resumido (Prof)
                </label>
              </div>
            </div>

            {isProcessing ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between items-end">
                    <span className="text-[9px] font-black uppercase text-sky-700 dark:text-sky-300">Progresso da Prova</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{examProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-sky-700 transition-all duration-500 dark:bg-sky-500" style={{ width: `${examProgress}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between items-end">
                    <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Progresso do Gabarito</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{keyProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-emerald-600 transition-all duration-500 dark:bg-emerald-500" style={{ width: `${keyProgress}%` }} />
                  </div>
                </div>
                <p className="animate-pulse text-center text-[10px] italic text-slate-400 dark:text-slate-500">Processando...</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={onStartImport}
                disabled={!qFile || !kFile}
                className={`${ADMIN_PRIMARY_BUTTON_CLASS} flex w-full items-center justify-center gap-3 py-4 font-black uppercase tracking-widest disabled:opacity-30`}
              >
                <PlayCircle size={20} /> Iniciar Importacao
              </button>
            )}
          </div>

          <div className="flex h-48 flex-col-reverse overflow-y-auto rounded-md border border-slate-800 bg-slate-900 p-6 font-mono text-[10px] text-emerald-400 shadow-inner transition-colors dark:border-slate-800 dark:bg-slate-950">
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="animate-fade-in opacity-80">{log}</div>
              ))}
              {isProcessing && <div className="animate-pulse">_</div>}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-8">
          {extractedQuestions.length > 0 ? (
            <div className="flex flex-1 flex-col space-y-4 animate-slide-up">
              <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-col items-center justify-between gap-4 md:flex-row`}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 rounded-sm border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <CheckCircle2 size={16} /> {extractedQuestions.length} Questoes Extraidas
                  </div>
                </div>
                <div className="flex w-full gap-2 md:w-auto">
                  <button
                    type="button"
                    onClick={onGenerateDetailedAll}
                    disabled={isBulkGenerating || isProcessing}
                    className="flex flex-1 items-center justify-center gap-2 rounded-sm border border-sky-300 bg-sky-50 px-4 py-2.5 text-[10px] font-black uppercase text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50 md:flex-none dark:border-sky-900/30 dark:bg-sky-900/20 dark:text-sky-300 dark:hover:bg-sky-900/30"
                  >
                    {isBulkGenerating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} Gerar Analise Detalhada (Todas)
                  </button>
                  <button
                    type="button"
                    onClick={onPublishAll}
                    disabled={isProcessing || isBulkGenerating}
                    className="flex flex-1 items-center justify-center gap-2 rounded-sm border border-emerald-700 bg-emerald-700 px-6 py-2.5 text-[10px] font-black uppercase text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 md:flex-none"
                  >
                    <CheckCircle2 size={16} /> Publicar Tudo
                  </button>
                </div>
              </div>

              {isBulkGenerating && (
                <div className={`${ADMIN_PAGE_PANEL_CLASS} animate-fade-in px-6 py-4`}>
                  <div className="mb-1 flex justify-between items-end">
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase text-sky-700 dark:text-sky-300">
                      <Sparkles size={12} /> Gerando Comentarios em Massa
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{bulkProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-sky-700 transition-all duration-300 dark:bg-sky-500" style={{ width: `${bulkProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="no-scrollbar flex-1 max-h-[800px] space-y-4 overflow-y-auto pr-2">
                {(extractedQuestions as ExtractedQuestionPreview[]).map((question, index) => (
                  <div key={index} className="group relative overflow-hidden rounded-sm border border-slate-300 bg-white p-6 transition-colors hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-700">
                    <div className="absolute left-0 top-0 h-full w-1 bg-slate-200 transition-colors group-hover:bg-sky-700 dark:bg-slate-800 dark:group-hover:bg-sky-500" />
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-900 text-xs font-black text-white dark:bg-sky-700">
                          {index + 1}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {question.bancas?.map((banca) => banca.sigla || banca.name).join(' / ') || 'Banca N/I'}
                          </span>
                          <span className="rounded-sm bg-sky-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                            {question.assuntos?.filter((subject) => subject.materia).map((subject) => subject.name).join(', ') || 'Materia N/I'}
                          </span>
                          <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            {question.assuntos?.filter((subject) => !subject.materia).map((subject) => subject.name).join(', ') || 'Assunto N/I'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(question.anulada || question.isCanceled) && <span className="rounded bg-red-100 px-2 py-0.5 text-[8px] font-black uppercase text-red-700 dark:bg-red-900/40 dark:text-red-400">Anulada</span>}
                        {(question.desatualizada || question.isOutdated) && <span className="rounded bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Desat.</span>}
                        <div className="rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-400">
                          Gabarito: {String.fromCharCode(65 + Number(question.correctOptionIndex || 0))}
                        </div>
                        <button
                          type="button"
                          onClick={() => onEditExtractedQuestion(question, index)}
                          className="rounded-sm border border-slate-300 bg-white p-1.5 text-slate-500 transition-colors hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:text-sky-300"
                          title="Editar Questao Extraida"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-3">
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <Briefcase size={12} />
                        <span className="text-[10px] font-bold uppercase">{question.cargos?.map((role) => role.descricao || role.name).join(', ') || question.role || 'Cargo Geral'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <Calendar size={12} />
                        <span className="text-[10px] font-bold uppercase">{question.anos?.join(', ') || question.year || '2024'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <Layers size={12} />
                        <span className="text-[10px] font-bold uppercase">{getQuestionLevelText(question.nivel || question.level)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                        <TrendingUp size={12} />
                        <span className="text-[10px] font-bold uppercase">{question.dificuldade === 1 ? 'Facil' : question.dificuldade === 3 ? 'Dificil' : 'Media'}</span>
                      </div>
                    </div>

                    {question.introText && (
                      <div className="mb-3 rounded-r-xl border-l-2 border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                        <p className="mb-1 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Texto de Apoio</p>
                        <p className="line-clamp-2 text-[11px] italic leading-relaxed text-slate-500 dark:text-slate-400">{question.introText}</p>
                      </div>
                    )}

                    <h4 className="mb-4 line-clamp-3 text-sm font-bold leading-relaxed text-slate-800 transition-all group-hover:line-clamp-none dark:text-slate-200">
                      {question.enunciado}
                    </h4>

                    <div className="flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => onGenerateSpecific(index, 'teacher')}
                        disabled={!!generatingSpecific || isBulkGenerating}
                        className="flex items-center gap-1.5 rounded-sm border border-amber-300 bg-amber-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
                      >
                        {generatingSpecific?.index === index && generatingSpecific.type === 'teacher' ? <Loader2 className="animate-spin" size={12} /> : <GraduationCap size={12} />}
                        {question.teacherComment ? 'Regerar Professor' : 'Gerar Professor'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onGenerateSpecific(index, 'detailed')}
                        disabled={!!generatingSpecific || isBulkGenerating}
                        className="flex items-center gap-1.5 rounded-sm border border-sky-300 bg-sky-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50 dark:border-sky-900/30 dark:bg-sky-900/20 dark:text-sky-300 dark:hover:bg-sky-900/30"
                      >
                        {generatingSpecific?.index === index && generatingSpecific.type === 'detailed' ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                        {question.detailedComment ? 'Regerar Detalhado' : 'Gerar Detalhado'}
                      </button>
                    </div>

                    {question.teacherComment && (
                      <div className="mt-4 animate-fade-in space-y-2 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800 opacity-80 group-hover:opacity-100 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200">
                        <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                          <BookOpen size={14} /> Comentario do Professor
                        </p>
                        <p className="font-medium italic leading-relaxed">{question.teacherComment}</p>
                      </div>
                    )}

                    {question.detailedComment && (
                      <div className="mt-2 animate-fade-in space-y-2 rounded-sm border border-sky-300 bg-sky-50 p-4 text-xs text-sky-800 opacity-80 group-hover:opacity-100 dark:border-sky-900/30 dark:bg-sky-900/10 dark:text-sky-200">
                        <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                          <Sparkles size={14} /> Analise Detalhada (IA)
                        </p>
                        <p className="line-clamp-3 font-medium italic leading-relaxed">{question.detailedComment}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center space-y-4 rounded-md border-2 border-dashed border-slate-200 bg-white p-20 text-center transition-colors dark:border-slate-800 dark:bg-slate-900">
              <div className="rounded-full bg-slate-50 p-8 text-slate-300 dark:bg-slate-800 dark:text-slate-700">
                <FileText size={80} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">Aguardando Arquivos</h3>
                <p className="mx-auto max-w-xs text-sm font-medium text-slate-400 dark:text-slate-500">
                  Faca o upload da Prova e do Gabarito para iniciar a extracao em massa com IA.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminImportSection;
