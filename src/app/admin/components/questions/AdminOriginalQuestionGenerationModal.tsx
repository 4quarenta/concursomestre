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
import { BookOpen, CheckCircle2, FileClock, Loader2, Save, Search, Sparkles, UploadCloud, XCircle } from 'lucide-react';
import type { Question } from '@types';
import type { OriginalQuestionModality } from '@services/questions';
import MathRichText from '@/components/shared/math/MathRichText';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MODAL_FOOTER_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';

export type AdminOriginalQuestionGenerationStatus = 'pending' | 'running' | 'review' | 'saving' | 'success' | 'error';

export interface AdminOriginalQuestionGenerationResult {
  id: string;
  label: string;
  status: AdminOriginalQuestionGenerationStatus;
  publicationDecision?: 'draft' | 'published';
  filterIssues?: string[];
  subject?: string;
  preview?: string;
  question?: Question;
  error?: string;
}

interface AdminOriginalQuestionGenerationModalProps {
  isOpen: boolean;
  agencyOptions: string[];
  subjectOptions: string[];
  selectedAgency: string;
  selectedSubject: string;
  selectedModality: OriginalQuestionModality;
  quantity: number;
  isProcessing: boolean;
  progress: number;
  currentLabel: string;
  results: AdminOriginalQuestionGenerationResult[];
  error?: string;
  isSavingDrafts?: boolean;
  onAgencyChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onModalityChange: (value: OriginalQuestionModality) => void;
  onQuantityChange: (value: number) => void;
  onGenerate: () => void;
  onPublicationDecisionChange: (id: string, value: 'draft' | 'published') => void;
  onSaveDrafts: () => void;
  onClose: () => void;
}

const statusIcon = (status: AdminOriginalQuestionGenerationStatus) => {
  if (status === 'running' || status === 'pending' || status === 'saving') {
    return <Loader2 size={15} className="animate-spin text-sky-700 dark:text-sky-300" />;
  }

  if (status === 'success' || status === 'review') {
    return <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-300" />;
  }

  return <XCircle size={15} className="text-red-600 dark:text-red-300" />;
};

const getEntityLabel = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return String(
      item.sigla
      ?? item.name
      ?? item.nome
      ?? item.descricao
      ?? item['descri\u00e7\u00e3o']
      ?? '',
    ).trim();
  }

  return '';
};

const formatEntities = (values: unknown[] | undefined, fallback = '') => {
  const labels = Array.from(new Set((values || []).map(getEntityLabel).filter(Boolean)));
  return labels.length > 0 ? labels.join(', ') : fallback;
};

const getCorrectAlternative = (question?: Question) => {
  const itens = Array.isArray(question?.itens) ? question.itens : [];
  return itens.find((item) => Number(item.id) === Number(question?.resposta))
    || itens[Math.max(0, Number(question?.resposta || 1) - 1)]
    || null;
};

const getStatusLabel = (status: AdminOriginalQuestionGenerationStatus) => {
  if (status === 'review') return 'Revisar';
  if (status === 'saving') return 'Salvando';
  if (status === 'success') return 'Rascunho';
  if (status === 'error') return 'Erro';
  return 'Gerando';
};

const AdminOriginalQuestionGenerationModal = ({
  isOpen,
  agencyOptions,
  subjectOptions,
  selectedAgency,
  selectedSubject,
  selectedModality,
  quantity,
  isProcessing,
  progress,
  currentLabel,
  results,
  error,
  isSavingDrafts = false,
  onAgencyChange,
  onSubjectChange,
  onModalityChange,
  onQuantityChange,
  onGenerate,
  onPublicationDecisionChange,
  onSaveDrafts,
  onClose,
}: AdminOriginalQuestionGenerationModalProps) => {
  const [agencySearch, setAgencySearch] = React.useState('');
  const [subjectSearch, setSubjectSearch] = React.useState('');
  const [isAgencyOpen, setIsAgencyOpen] = React.useState(false);
  const [isSubjectOpen, setIsSubjectOpen] = React.useState(false);
  const agencyInputValue = agencySearch || selectedAgency;
  const subjectInputValue = subjectSearch || selectedSubject;

  const filteredAgencies = React.useMemo(() => {
    const normalizedSearch = agencyInputValue.trim().toLowerCase();
    const uniqueOptions = Array.from(new Set((agencyOptions || []).map(String).filter(Boolean)));

    if (!normalizedSearch) {
      return uniqueOptions.slice(0, 12);
    }

    return uniqueOptions
      .filter((agency) => agency.toLowerCase().includes(normalizedSearch))
      .slice(0, 12);
  }, [agencyOptions, agencyInputValue]);

  const filteredSubjects = React.useMemo(() => {
    const normalizedSearch = subjectInputValue.trim().toLowerCase();
    const uniqueOptions = Array.from(new Set((subjectOptions || []).map(String).filter(Boolean)));

    if (!normalizedSearch) {
      return uniqueOptions.slice(0, 12);
    }

    return uniqueOptions
      .filter((subject) => subject.toLowerCase().includes(normalizedSearch))
      .slice(0, 12);
  }, [subjectOptions, subjectInputValue]);

  if (!isOpen) {
    return null;
  }

  const canGenerate = selectedAgency.trim().length > 0 && quantity > 0 && !isProcessing;
  const completedCount = results.filter((item) => item.status === 'success').length;
  const reviewCount = results.filter((item) => item.status === 'review').length;
  const invalidReviewCount = results.filter((item) => item.status === 'review' && (item.filterIssues || []).length > 0).length;
  const publishCount = results.filter((item) => item.status === 'review' && item.publicationDecision === 'published').length;
  const draftCount = results.filter((item) => item.status === 'review' && item.publicationDecision !== 'published').length;
  const canSaveDrafts = reviewCount > 0 && invalidReviewCount === 0 && !isProcessing && !isSavingDrafts;

  const handleSelectAgency = (agency: string) => {
    onAgencyChange(agency);
    setAgencySearch(agency);
    setIsAgencyOpen(false);
  };

  const handleUseTypedAgency = () => {
    const typedAgency = agencyInputValue.trim();
    if (!typedAgency) return;
    handleSelectAgency(typedAgency);
  };

  const handleSelectSubject = (subject: string) => {
    onSubjectChange(subject);
    setSubjectSearch(subject);
    setIsSubjectOpen(false);
  };

  const handleUseTypedSubject = () => {
    const typedSubject = subjectInputValue.trim();
    if (!typedSubject) return;
    handleSelectSubject(typedSubject);
  };

  const handleClearSubject = () => {
    onSubjectChange('');
    setSubjectSearch('');
    setIsSubjectOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className={`${ADMIN_MODAL_PANEL_CLASS} flex max-h-[88vh] w-full max-w-4xl flex-col shadow-2xl`}>
        <div className={ADMIN_MODAL_HEADER_CLASS}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Geração IA
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Questões inéditas</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {currentLabel || 'Gere um lote novo seguindo o perfil da banca selecionada.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className={ADMIN_SECONDARY_BUTTON_CLASS}
          >
            Fechar
          </button>
        </div>

        <div className="grid gap-4 border-b border-slate-300 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[1fr_1fr_220px_140px_auto] md:items-end">
          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Banca
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
              <input
                type="text"
                value={agencyInputValue}
                disabled={isProcessing}
                onChange={(event) => {
                  setAgencySearch(event.target.value);
                  onAgencyChange('');
                  setIsAgencyOpen(true);
                }}
                onFocus={() => setIsAgencyOpen(true)}
                placeholder="Buscar banca..."
                className={`${ADMIN_FIELD_CLASS} h-10 w-full pl-9 text-sm font-semibold`}
              />

              {isAgencyOpen && !isProcessing ? (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-sm border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="max-h-64 overflow-y-auto py-1">
                    {filteredAgencies.map((agency) => (
                      <button
                        key={agency}
                        type="button"
                        onClick={() => handleSelectAgency(agency)}
                        className="w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {agency}
                      </button>
                    ))}

                    {agencyInputValue.trim() && !filteredAgencies.includes(agencyInputValue.trim()) ? (
                      <button
                        type="button"
                        onClick={handleUseTypedAgency}
                        className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-sky-700 hover:bg-sky-50 dark:border-slate-800 dark:text-sky-300 dark:hover:bg-slate-800"
                      >
                        <Sparkles size={14} />
                        Usar {agencyInputValue.trim()}
                      </button>
                    ) : null}

                    {filteredAgencies.length === 0 && !agencyInputValue.trim() ? (
                      <p className="px-3 py-4 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                        Nenhuma banca cadastrada.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Materia opcional
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
              <input
                type="text"
                value={subjectInputValue}
                disabled={isProcessing}
                onChange={(event) => {
                  setSubjectSearch(event.target.value);
                  onSubjectChange('');
                  setIsSubjectOpen(true);
                }}
                onFocus={() => setIsSubjectOpen(true)}
                placeholder="Ex: Direito Administrativo"
                className={`${ADMIN_FIELD_CLASS} h-10 w-full pl-9 pr-20 text-sm font-semibold`}
              />
              {selectedSubject ? (
                <button
                  type="button"
                  onClick={handleClearSubject}
                  disabled={isProcessing}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  Limpar
                </button>
              ) : null}

              {isSubjectOpen && !isProcessing ? (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-sm border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="max-h-64 overflow-y-auto py-1">
                    {filteredSubjects.map((subject) => (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => handleSelectSubject(subject)}
                        className="w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {subject}
                      </button>
                    ))}

                    {subjectInputValue.trim() && !filteredSubjects.includes(subjectInputValue.trim()) ? (
                      <button
                        type="button"
                        onClick={handleUseTypedSubject}
                        className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-sky-700 hover:bg-sky-50 dark:border-slate-800 dark:text-sky-300 dark:hover:bg-slate-800"
                      >
                        <Sparkles size={14} />
                        Usar {subjectInputValue.trim()}
                      </button>
                    ) : null}

                    {filteredSubjects.length === 0 && !subjectInputValue.trim() ? (
                      <p className="px-3 py-4 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                        Nenhuma materia cadastrada.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Modalidade
            </label>
            <div className="inline-flex h-10 w-full overflow-hidden rounded-sm border border-slate-300 bg-white text-xs font-bold dark:border-slate-700 dark:bg-slate-900">
              {([
                ['multipla escolha', 'Múltipla escolha'],
                ['certo ou errado', 'Certo/Errado'],
              ] as Array<[OriginalQuestionModality, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={isProcessing}
                  onClick={() => onModalityChange(value)}
                  className={`flex-1 px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    selectedModality === value
                      ? 'bg-sky-700 text-white dark:bg-sky-500 dark:text-slate-950'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Quantidade
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={quantity}
              disabled={isProcessing}
              onChange={(event) => onQuantityChange(Number(event.target.value))}
              className={`${ADMIN_FIELD_CLASS} h-10 w-full text-sm font-semibold`}
            />
          </div>

          <button
            type="button"
            disabled={!canGenerate}
            onClick={onGenerate}
            className={`${ADMIN_PRIMARY_BUTTON_CLASS} h-10 justify-center`}
          >
            {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Gerar para revisao
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Progresso</span>
            <span>{Math.max(0, Math.min(100, progress))}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-sky-700 transition-all duration-300 dark:bg-sky-400"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <p className="mb-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : null}

          {results.length === 0 ? (
            <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Selecione uma banca e a quantidade para criar questoes ineditas.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((item) => {
                const question = item.question;
                const correctAlternative = getCorrectAlternative(question);

                return (
                <div
                  key={item.id}
                  className="rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30"
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    {statusIcon(item.status)}
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                    {item.status === 'review' ? (
                      <div className="ml-auto inline-flex overflow-hidden rounded-sm border border-slate-300 bg-white text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => onPublicationDecisionChange(item.id, 'draft')}
                          disabled={isProcessing}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 transition-colors ${
                            item.publicationDecision !== 'published'
                              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          <FileClock size={13} />
                          Rascunho
                        </button>
                        <button
                          type="button"
                          onClick={() => onPublicationDecisionChange(item.id, 'published')}
                          disabled={isProcessing || (item.filterIssues || []).length > 0}
                          className={`inline-flex items-center gap-1.5 border-l border-slate-300 px-2.5 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 ${
                            item.publicationDecision === 'published'
                              ? 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          <UploadCloud size={13} />
                          Publicar
                        </button>
                      </div>
                    ) : null}
                    {['review', 'saving', 'success'].includes(item.status) ? (
                      <span className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        item.status === 'review'
                          ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      }`}>
                        {item.status === 'review' && item.publicationDecision === 'published'
                          ? 'Publicar'
                          : item.status === 'success' && item.publicationDecision === 'published'
                            ? 'Publicado'
                            : getStatusLabel(item.status)}
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-4 p-4">
                    {item.error ? (
                      <p className="text-sm font-medium text-red-600 dark:text-red-300">{item.error}</p>
                    ) : question ? (
                      <>
                        {(item.filterIssues || []).length > 0 ? (
                          <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                            Filtros obrigatorios pendentes: {(item.filterIssues || []).join(', ')}.
                          </p>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Foco: {formatEntities(question.carreiras, '-')}
                          </span>
                          <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Materia: {formatEntities((question.assuntos || []).filter((taxonomy) => Boolean((taxonomy as { materia?: unknown })?.materia)), '-')}
                          </span>
                          <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Dificuldade: {getEntityLabel(question.difficulty || question.dificuldade) || '-'}
                          </span>
                          <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Banca: {formatEntities(question.bancas, selectedAgency || '-')}
                          </span>
                          <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Órgão: {formatEntities(question.orgaos, '-')}
                          </span>
                          <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Ano: {Array.isArray(question.anos) && question.anos.length > 0 ? question.anos.join(', ') : '-'}
                          </span>
                          <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Nivel: {getEntityLabel(question.level || question.nivel) || '-'}
                          </span>
                          <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Assunto: {formatEntities((question.assuntos || []).filter((taxonomy) => !Boolean((taxonomy as { materia?: unknown })?.materia)), '-')}
                          </span>
                          <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Cargo: {formatEntities(question.cargos, '-')}
                          </span>
                          <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Modalidade: {getEntityLabel(question.tipo) || '-'}
                          </span>
                        </div>

                        {question.introText ? (
                          <div className="rounded-sm border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                            <MathRichText content={question.introText} />
                          </div>
                        ) : null}

                        <div className="rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/20">
                          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            Enunciado
                          </p>
                          <MathRichText content={question.enunciado || question.enunciado_clean} className="text-sm leading-7 text-slate-800 dark:text-slate-200" />
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            Alternativas
                          </p>
                          {(question.itens || []).map((option) => {
                            const isCorrect = Number(option.id) === Number(question.resposta);
                            return (
                              <div
                                key={option.id}
                                className={`flex gap-3 rounded-sm border px-3 py-2 text-sm ${
                                  isCorrect
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300'
                                }`}
                              >
                                <span className="shrink-0 font-black">{option.rotulo}</span>
                                <MathRichText content={option.corpo || option.corpo_clean} className="min-w-0 flex-1" />
                              </div>
                            );
                          })}
                        </div>

                        <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
                          Gabarito: {correctAlternative ? `${correctAlternative.rotulo} - ${correctAlternative.corpo_clean || correctAlternative.corpo}` : 'Não identificado'}
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div>
                            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                              <Sparkles size={13} /> Comentário do professor
                            </p>
                            <MathRichText
                              content={question.teacherComment}
                              className="rounded-sm border border-amber-200 bg-amber-50/60 p-3 text-sm leading-7 text-slate-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-slate-200"
                            />
                          </div>
                          <div>
                            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
                              <BookOpen size={13} /> Análise detalhada
                            </p>
                            <MathRichText
                              content={question.detailedComment}
                              disableCallouts
                              className="rounded-sm border border-indigo-200 bg-indigo-50/50 p-3 text-sm leading-7 text-slate-700 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-slate-200"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1">
                        {item.subject ? (
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            {item.subject}
                          </p>
                        ) : null}
                        <p className="line-clamp-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                          {item.preview || 'Aguardando geração.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={`${ADMIN_MODAL_FOOTER_CLASS} flex items-center justify-between gap-3`}>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {completedCount > 0
              ? `${completedCount} questão(ões) criada(s).`
              : reviewCount > 0
                ? `${publishCount} para publicar, ${draftCount} em rascunho${invalidReviewCount > 0 ? `, ${invalidReviewCount} com filtro pendente` : ''}.`
                : 'As questões geradas ficam em revisão até você escolher publicar ou manter em rascunho.'}
          </span>
          <div className="flex items-center gap-2">
            {reviewCount > 0 ? (
              <button
                type="button"
                onClick={onSaveDrafts}
                disabled={!canSaveDrafts}
                className={ADMIN_PRIMARY_BUTTON_CLASS}
              >
                {isSavingDrafts ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar revisao
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className={ADMIN_SECONDARY_BUTTON_CLASS}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOriginalQuestionGenerationModal;
