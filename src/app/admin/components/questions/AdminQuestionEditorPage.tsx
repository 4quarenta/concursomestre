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
import { flushSync } from 'react-dom';
import { AlertCircle, AlertTriangle, Check, Image as ImageIcon, Loader2, Plus, Save, Search, Sparkles, Trash2 } from 'lucide-react';
import type { Prova, Question } from '@types';
import { SmartTagSelector } from '../database/SmartTagSelector';
import { buildProvaSearchText, formatProvaLabel, normalizeProvaRecord } from '../exams/examBankUtils';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';
import AdminPublishStateBadge, { resolveAdminPublishState } from '../shared/AdminPublishStateBadge';

interface AdminQuestionEditorPageProps {
  manualQ: any;
  setManualQ: React.Dispatch<React.SetStateAction<any>>;
  editingQuestion: Question | null;
  editingExtractedIndex: number | null;
  existingAgencies: string[];
  existingOrgaos: string[];
  existingSubjects: string[];
  existingTopics: string[];
  existingSubjectTopics?: string[];
  existingSpecificSubjects?: string[];
  existingYears: Array<string | number>;
  existingRoles: string[];
  existingProvas: Prova[];
  isGeneratingTeacher: boolean;
  isGeneratingDetailed: boolean;
  onGenerateTeacherComment: () => void;
  onGenerateDetailedComment: () => void;
  onClose: () => void;
  onSave: () => void;
  reportContext?: React.ReactNode;
}

const getRoleDisplayLabel = (value: any) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (value && typeof value === 'object') {
    return String(
      value.descricao
      ?? value['descrição']
      ?? value.name
      ?? value.nome
      ?? value.sigla
      ?? '',
    ).trim();
  }

  return '';
};

const mergeProvaSources = (primary: Prova[], fallback: any[]) => {
  const provaMap = new Map<string, Prova>();

  [...primary, ...fallback]
    .map((item) => normalizeProvaRecord(item))
    .filter(Boolean)
    .forEach((item) => {
      provaMap.set(String((item as Prova).id), item as Prova);
    });

  return Array.from(provaMap.values()).sort((left, right) => {
    if (right.ano !== left.ano) {
      return right.ano - left.ano;
    }

    return left.nome.localeCompare(right.nome, 'pt-BR');
  });
};

const normalizeDateTimeLocalValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number') {
    const timestamp = value > 9999999999 ? value : value * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
  }

  const raw = String(value).trim();
  if (!raw) return '';

  const mysqlDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (mysqlDateTime) return `${mysqlDateTime[1]}T${mysqlDateTime[2]}`;

  const mysqlDate = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (mysqlDate) return `${mysqlDate[1]}T00:00`;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
};

const formatPublicationDate = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR');
};

const AdminQuestionEditorPage = ({
  manualQ,
  setManualQ,
  editingQuestion,
  editingExtractedIndex,
  existingAgencies,
  existingOrgaos,
  existingSubjects,
  existingTopics,
  existingSubjectTopics,
  existingSpecificSubjects,
  existingYears,
  existingRoles,
  existingProvas,
  isGeneratingTeacher,
  isGeneratingDetailed,
  onGenerateTeacherComment,
  onGenerateDetailedComment,
  onClose,
  onSave,
  reportContext,
}: AdminQuestionEditorPageProps) => {
  const updateManualQ = (patch: Record<string, unknown>) => {
    setManualQ((prev: any) => ({ ...prev, ...patch }));
  };

  const [provaSearch, setProvaSearch] = React.useState('');
  const [isProvaSearchOpen, setIsProvaSearchOpen] = React.useState(false);
  const MULTIPLE_CHOICE_LABEL = 'Múltipla Escolha';
  const MID_LEVEL_LABEL = 'Médio';
  const publishState = resolveAdminPublishState(manualQ as Record<string, any>);
  const visibilityValue = String(manualQ.visibilityStatus || 'public');
  const publicationDateValue = normalizeDateTimeLocalValue(
    publishState === 'scheduled'
      ? manualQ.scheduledAt
      : manualQ.publishedAt || manualQ.createdAt || manualQ.scheduledAt,
  );
  const publicationDateLabel = formatPublicationDate(publicationDateValue);
  const topicOptions = existingSubjectTopics?.length ? existingSubjectTopics : existingTopics;
  const assuntoOptions = existingSpecificSubjects?.length ? existingSpecificSubjects : existingTopics;
  const manualItems = manualQ.itens || [];
  const manualTitle =
    editingExtractedIndex !== null
      ? `Revisar Questão Extraída #${editingExtractedIndex + 1}`
      : editingQuestion
        ? 'Editar questão'
        : 'Adicionar nova questão';

  const provaList = React.useMemo(
    () => mergeProvaSources(existingProvas || [], Array.isArray(manualQ.provas) ? manualQ.provas : []),
    [existingProvas, manualQ.provas],
  );

  const selectedProva = manualQ.provaId
    ? provaList.find((item: any) => String(item.id) === String(manualQ.provaId))
    : null;

  const filteredProvas = React.useMemo(() => {
    const normalizedSearch = provaSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return provaList.slice(0, 12);
    }

    return provaList
      .filter((item) => buildProvaSearchText(item).includes(normalizedSearch))
      .slice(0, 12);
  }, [provaList, provaSearch]);

  React.useEffect(() => {
    if (selectedProva) {
      setProvaSearch(formatProvaLabel(selectedProva));
      return;
    }

    if (!manualQ.provaId) {
      setProvaSearch('');
    }
  }, [manualQ.provaId, selectedProva]);

  const handleTypeChange = (newType: string) => {
    setManualQ((prev: any) => {
      const currentItems = prev.itens || [];
      const newItens =
        newType === 'Certo/Errado'
          ? [
              { id: 1, rotulo: 'C', corpo: 'Certo', corpo_clean: 'Certo' },
              { id: 2, rotulo: 'E', corpo: 'Errado', corpo_clean: 'Errado' },
            ]
          : currentItems.length === 2 && currentItems[0]?.corpo === 'Certo'
            ? [
                { id: 1, rotulo: 'A', corpo: '', corpo_clean: '' },
                { id: 2, rotulo: 'B', corpo: '', corpo_clean: '' },
                { id: 3, rotulo: 'C', corpo: '', corpo_clean: '' },
                { id: 4, rotulo: 'D', corpo: '', corpo_clean: '' },
                { id: 5, rotulo: 'E', corpo: '', corpo_clean: '' },
              ]
            : currentItems;

      return {
        ...prev,
        modality: newType,
        itens: newItens,
        tipo: newType === 'Certo/Errado' ? 'certo ou errado' : 'multipla escolha',
      };
    });
  };

  const handleImageSelected = (file: File | null) => {
    if (!file) return;
    updateManualQ({ imageUrl: URL.createObjectURL(file) });
  };

  const handleAddOption = () => {
    setManualQ((prev: any) => ({
      ...prev,
      itens: [
        ...(prev.itens || []),
        {
          id: Date.now(),
          rotulo: String.fromCharCode(65 + (prev.itens?.length || 0)),
          corpo: '',
          corpo_clean: '',
        },
      ],
    }));
  };

  const handleOptionChange = (index: number, value: string) => {
    setManualQ((prev: any) => {
      const nextItems = [...(prev.itens || [])];
      nextItems[index] = {
        ...nextItems[index],
        corpo: value,
        corpo_clean: value.replace(/<[^>]*>?/gm, ''),
      };

      return { ...prev, itens: nextItems };
    });
  };

  const handleOptionDelete = (index: number) => {
    setManualQ((prev: any) => ({
      ...prev,
      itens: (prev.itens || []).filter((_: any, itemIndex: number) => itemIndex !== index),
    }));
  };

  const handleSelectProva = (prova: Prova) => {
    updateManualQ({
      provaId: prova.id,
      provas: [prova],
    });
    setProvaSearch(formatProvaLabel(prova));
    setIsProvaSearchOpen(false);
  };

  const handleClearProva = () => {
    updateManualQ({
      provaId: '',
      provas: [],
    });
    setProvaSearch('');
    setIsProvaSearchOpen(false);
  };

  const handlePersistWithPatch = (patch: Record<string, unknown>) => {
    flushSync(() => {
      setManualQ((prev: any) => ({ ...prev, ...patch }));
    });
    onSave();
  };

  const publishActionLabel = publishState === 'scheduled'
    ? 'Programar questão'
    : editingQuestion
      ? 'Atualizar questão'
      : 'Publicar questão';

  return (
    <div className="flex w-full flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between`}>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{manualTitle}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Estruture o conteúdo, contexto editorial e sinais de publicação da questão.
                </p>
              </div>

              <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                Voltar
              </button>
            </div>
          </div>

          {reportContext ? (
            <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
              <div className="p-5">{reportContext}</div>
            </div>
          ) : null}

          {(manualQ.anulada || manualQ.desatualizada) ? (
            <div className="space-y-2">
              {manualQ.anulada ? (
                <div className="flex items-center gap-3 rounded-sm border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                  <AlertCircle size={18} />
                  Esta questão será exibida como anulada.
                </div>
              ) : null}
              {manualQ.desatualizada ? (
                <div className="flex items-center gap-3 rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangle size={18} />
                  Esta questão será exibida como desatualizada.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Classificação e contexto</p>
            </div>
            <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-2">
              <SmartTagSelector
                label="Banca(s)"
                options={existingAgencies}
                selected={(manualQ.bancas || []).map((item: any) => (typeof item === 'string' ? item : item.sigla || item.name))}
                onChange={(value) => updateManualQ({ bancas: value })}
                placeholder="Ex: Cebraspe, FGV..."
              />
              <SmartTagSelector
                label="Órgão(s)"
                options={existingOrgaos}
                selected={(manualQ.orgaos || []).map((item: any) => (typeof item === 'string' ? item : item.name))}
                onChange={(value) => updateManualQ({ orgaos: value })}
                placeholder="Ex: TJ-SP, PF..."
              />
              <SmartTagSelector
                label="Matéria(s)"
                options={existingSubjects}
                selected={(manualQ.subjects || []).map((item: any) => (typeof item === 'string' ? item : item.name))}
                onChange={(value) => updateManualQ({ subjects: value })}
                placeholder="Ex: Direito Administrativo..."
              />
              <SmartTagSelector
                label="Topico(s)"
                options={topicOptions}
                selected={(manualQ.topics || []).map((item: any) => (typeof item === 'string' ? item : item.name))}
                onChange={(value) => updateManualQ({ topics: value })}
                placeholder="Ex: Leis especiais..."
              />
              <SmartTagSelector
                label="Assunto(s)"
                options={assuntoOptions}
                selected={(manualQ.assuntos || []).map((item: any) => (typeof item === 'string' ? item : item.name))}
                onChange={(value) => updateManualQ({ assuntos: value })}
                placeholder="Ex: Lei Maria da Penha..."
              />
              <SmartTagSelector
                label="Ano"
                options={existingYears}
                selected={(manualQ.anos || []).map(String)}
                onChange={(value) => updateManualQ({ anos: value })}
                placeholder="2025"
                multiple
              />
              <SmartTagSelector
                label="Cargo(s)"
                options={existingRoles}
                selected={(manualQ.cargos || []).map(getRoleDisplayLabel).filter(Boolean)}
                onChange={(value) => updateManualQ({ cargos: value })}
                placeholder="Ex: Analista Judiciário..."
              />
            </div>
          </div>

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Enunciado e alternativas</p>
            </div>
            <div className="space-y-6 p-5">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Texto de apoio</label>
                <textarea
                  value={manualQ.introText || ''}
                  onChange={(event) => updateManualQ({ introText: event.target.value })}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[100px] font-medium`}
                  placeholder="Insira textos auxiliares aqui..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Enunciado principal (HTML)</label>
                <textarea
                  required
                  value={manualQ.enunciado || ''}
                  onChange={(event) => updateManualQ({
                    enunciado: event.target.value,
                    enunciado_clean: event.target.value.replace(/<[^>]*>?/gm, ''),
                  })}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[180px] text-base font-semibold`}
                  placeholder="Qual o comando da questão? Aceita HTML."
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className={ADMIN_SECONDARY_BUTTON_CLASS}>
                  <ImageIcon size={16} />
                  Upload de imagem
                  <input type="file" className="hidden" onChange={(event) => handleImageSelected(event.target.files?.[0] || null)} />
                </label>
                {manualQ.imageUrl ? (
                  <div className="inline-flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <Check size={14} />
                    Imagem anexada
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Alternativas</label>
                  <button type="button" onClick={handleAddOption} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                    <Plus size={14} />
                    Adicionar alternativa
                  </button>
                </div>

                <div className="grid gap-3">
                  {manualItems.map((item: any, index: number) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => updateManualQ({ resposta: index + 1 })}
                        className={`flex h-10 w-10 items-center justify-center rounded-sm border text-sm font-bold transition-colors ${
                          manualQ.resposta === index + 1
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 bg-white text-slate-500 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                        }`}
                      >
                        {item.rotulo}
                      </button>
                      <input
                        type="text"
                        value={item.corpo}
                        onChange={(event) => handleOptionChange(index, event.target.value)}
                        className={`${ADMIN_FIELD_CLASS} h-10 flex-1`}
                        placeholder={`Corpo da alternativa ${item.rotulo}...`}
                      />
                      <button
                        type="button"
                        onClick={() => handleOptionDelete(index)}
                        className="rounded-sm border border-slate-300 bg-white p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-rose-900/20 dark:hover:text-rose-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Comentários editoriais</p>
            </div>
            <div className="grid gap-6 p-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Comentário do professor</label>
                  <button
                    type="button"
                    onClick={onGenerateTeacherComment}
                    disabled={isGeneratingTeacher}
                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                  >
                    {isGeneratingTeacher ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                    Gerar com IA
                  </button>
                </div>
                <textarea
                  value={manualQ.teacherComment || ''}
                  onChange={(event) => updateManualQ({ teacherComment: event.target.value })}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[180px]`}
                  placeholder="Breve comentário ou dica do professor..."
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Análise detalhada</label>
                  <button
                    type="button"
                    onClick={onGenerateDetailedComment}
                    disabled={isGeneratingDetailed}
                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                  >
                    {isGeneratingDetailed ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                    Gerar com IA
                  </button>
                </div>
                <textarea
                  value={manualQ.detailedComment || ''}
                  onChange={(event) => updateManualQ({ detailedComment: event.target.value })}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[220px]`}
                  placeholder="Análise alternativa por alternativa..."
                />
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-6 xl:sticky xl:top-6 xl:w-80">
          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Publicar</p>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handlePersistWithPatch({ publishStatus: 'draft' })}
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  Salvar rascunho
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  className={`${ADMIN_PRIMARY_BUTTON_CLASS} justify-center`}
                >
                  <Save size={14} />
                  {publishActionLabel}
                </button>
              </div>

              <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Status</span>
                  <AdminPublishStateBadge state={publishState} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Estado editorial</label>
                  <select
                    value={manualQ.publishStatus || 'published'}
                    onChange={(event) => updateManualQ({ publishStatus: event.target.value })}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                  >
                    <option value="published">Publicado</option>
                    <option value="draft">Rascunho</option>
                    <option value="scheduled">Programado</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Visibilidade</label>
                  <select
                    value={visibilityValue}
                    onChange={(event) => updateManualQ({ visibilityStatus: event.target.value })}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                  >
                    <option value="public">Pública</option>
                    <option value="elite">Exclusiva Elite</option>
                    <option value="internal">Interna</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Publicação</label>
                  <input
                    type="datetime-local"
                    value={publicationDateValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateManualQ(
                        publishState === 'scheduled'
                          ? { scheduledAt: value }
                          : { publishedAt: value },
                      );
                    }}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                  />
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {publicationDateLabel
                      ? `${publishState === 'scheduled' ? 'Programada para' : 'Publicada em'} ${publicationDateLabel}`
                      : editingQuestion
                        ? 'Ainda sem data de publicacao registrada.'
                        : 'A data sera registrada ao publicar.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => updateManualQ({ anulada: !manualQ.anulada })}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} w-full justify-center ${manualQ.anulada ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300' : ''}`}
                >
                  {manualQ.anulada ? 'Questão anulada' : 'Marcar como anulada'}
                </button>
                <button
                  type="button"
                  onClick={() => updateManualQ({ desatualizada: !manualQ.desatualizada })}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} w-full justify-center ${manualQ.desatualizada ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300' : ''}`}
                >
                  {manualQ.desatualizada ? 'Questão desatualizada' : 'Marcar como desatualizada'}
                </button>
              </div>
            </div>
          </div>

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Configuração rápida</p>
            </div>
            <div className="space-y-4 p-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Tipo da questão</label>
                <select
                  value={manualQ.modality || (manualItems.length === 2 ? 'Certo/Errado' : MULTIPLE_CHOICE_LABEL)}
                  onChange={(event) => handleTypeChange(event.target.value)}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                >
                  <option value={MULTIPLE_CHOICE_LABEL}>Múltipla escolha</option>
                  <option value="Certo/Errado">Certo/Errado</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Dificuldade</label>
                <select
                  value={manualQ.difficulty}
                  onChange={(event) => updateManualQ({ difficulty: Number(event.target.value) })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                >
                  <option value={1}>Fácil</option>
                  <option value={2}>Médio</option>
                  <option value={3}>Difícil</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Escolaridade</label>
                <select
                  value={manualQ.level}
                  onChange={(event) => updateManualQ({ level: event.target.value })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                >
                  <option value="Superior">Superior</option>
                  <option value={MID_LEVEL_LABEL}>Médio</option>
                  <option value="Fundamental">Fundamental</option>
                </select>
              </div>
            </div>
          </div>

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Prova vinculada</p>
            </div>
            <div className="space-y-4 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                <input
                  type="text"
                  value={provaSearch}
                  onChange={(event) => {
                    setProvaSearch(event.target.value);
                    setIsProvaSearchOpen(true);
                  }}
                  onFocus={() => setIsProvaSearchOpen(true)}
                  placeholder="Busque por nome, banca, órgão ou ID"
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full pl-10 pr-20`}
                />
                {manualQ.provaId ? (
                  <button
                    type="button"
                    onClick={handleClearProva}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Limpar
                  </button>
                ) : null}

                {isProvaSearchOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-sm border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="max-h-72 overflow-y-auto">
                      {filteredProvas.map((prova) => (
                        <button
                          key={prova.id}
                          type="button"
                          onClick={() => handleSelectProva(prova)}
                          className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{prova.nome}</p>
                            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                              #{prova.id} {prova.ano ? `- ${prova.ano}` : ''} {prova.banca?.sigla ? `- ${prova.banca.sigla}` : ''}
                            </p>
                          </div>
                        </button>
                      ))}

                      {filteredProvas.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                          Nenhuma prova encontrada.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {selectedProva ? (
                <div className="rounded-sm border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-900/40 dark:bg-sky-900/20">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedProva.nome}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    #{selectedProva.id} {selectedProva.ano ? `- ${selectedProva.ano}` : ''} {selectedProva.banca?.sigla ? `- ${selectedProva.banca.sigla}` : ''}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma prova vinculada no momento.
                </p>
              )}
            </div>
          </div>
        </aside>
    </div>
  );
};

export default AdminQuestionEditorPage;
