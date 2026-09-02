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
import { AlertCircle, AlertTriangle, Check, Image as ImageIcon, Loader2, Plus, Save, Search, Sparkles, Trash2, X } from 'lucide-react';
import type { Prova, Question } from '@types';
import { SmartTagSelector } from '../database/SmartTagSelector';
import { buildProvaSearchText, formatProvaLabel } from '../exams/examBankUtils';
import {
  getQuestionOptionLabel,
  getRoleDisplayLabel,
  createQuestionImageAsset,
  isQuestionTaxonomyRecord,
  insertQuestionImageMarker,
  readQuestionImageFileAsDataUrl,
  removeQuestionImageMarker,
  type ManualQuestionItem,
  type ManualQuestionPatch,
  type ManualQuestionSetter,
  type ManualQuestionState,
  mergeProvaSources,
} from './questionEditorShared';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MODAL_FOOTER_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';

interface ManualQuestionModalProps {
  manualQ: ManualQuestionState;
  setManualQ: ManualQuestionSetter;
  editingQuestion: Question | null;
  editingExtractedIndex: number | null;
  existingAgencies: string[];
  existingOrgaos: string[];
  existingSubjects: string[];
  existingTopics: string[];
  existingYears: Array<string | number>;
  existingRoles: string[];
  existingProvas: Prova[];
  isGeneratingTeacher: boolean;
  isGeneratingDetailed: boolean;
  onGenerateTeacherComment: () => void;
  onGenerateDetailedComment: () => void;
  onClose: () => void;
  onSave: () => void;
  presentation?: 'modal' | 'page';
  reportContext?: React.ReactNode;
}

const ManualQuestionModal = ({
  manualQ,
  setManualQ,
  editingQuestion,
  editingExtractedIndex,
  existingAgencies,
  existingOrgaos,
  existingSubjects,
  existingTopics,
  existingYears,
  existingRoles,
  existingProvas,
  isGeneratingTeacher,
  isGeneratingDetailed,
  onGenerateTeacherComment,
  onGenerateDetailedComment,
  onClose,
  onSave,
  presentation = 'modal',
  reportContext,
}: ManualQuestionModalProps) => {
  const updateManualQ = (patch: ManualQuestionPatch) => {
    setManualQ((prev) => ({ ...prev, ...patch }));
  };

  const [provaSearch, setProvaSearch] = React.useState('');
  const [isProvaSearchOpen, setIsProvaSearchOpen] = React.useState(false);
  const [imageUploadError, setImageUploadError] = React.useState('');

  const MULTIPLE_CHOICE_LABEL = 'Múltipla Escolha';
  const MID_LEVEL_LABEL = 'Médio';

  const handleTypeChange = (newType: string) => {
    setManualQ((prev) => {
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

  const handleImageSelected = async (file: File | null, usage: 'statement' | 'support' = 'statement') => {
    if (!file) return;

    let url = '';
    try {
      url = await readQuestionImageFileAsDataUrl(file);
      setImageUploadError('');
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : 'Nao foi possivel carregar a imagem.');
      return;
    }
    setManualQ((prev) => {
      const asset = createQuestionImageAsset({
        assets: prev.assets,
        usage,
        url,
        alt: usage === 'support' ? 'Imagem do texto de apoio.' : 'Imagem do enunciado.',
      });
      const assets = [...(prev.assets || []), asset];

      return {
        ...prev,
        assets,
        imageUrl: usage === 'statement' && !prev.imageUrl ? url : prev.imageUrl,
        enunciado: usage === 'statement' ? insertQuestionImageMarker(prev.enunciado || '', asset.id) : prev.enunciado,
        enunciado_clean: usage === 'statement'
          ? insertQuestionImageMarker(prev.enunciado_clean || '', asset.id)
          : prev.enunciado_clean,
        introText: usage === 'support' ? insertQuestionImageMarker(prev.introText || '', asset.id) : prev.introText,
      };
    });
  };

  const handleAlternativeImageSelected = async (index: number, file: File | null) => {
    if (!file) return;

    let url = '';
    try {
      url = await readQuestionImageFileAsDataUrl(file);
      setImageUploadError('');
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : 'Nao foi possivel carregar a imagem.');
      return;
    }
    setManualQ((prev) => {
      const current = prev.itens?.[index];
      if (!current) {
        return prev;
      }

      const asset = createQuestionImageAsset({
        assets: prev.assets,
        usage: 'alternative',
        url,
        label: current.rotulo,
        alt: `Imagem da alternativa ${current.rotulo}.`,
      });
      const nextItems = [...(prev.itens || [])];
      const nextBody = insertQuestionImageMarker(current.corpo || '', asset.id);
      nextItems[index] = {
        ...current,
        corpo: nextBody,
        corpo_clean: nextBody.replace(/<[^>]*>?/gm, ''),
      };

      return {
        ...prev,
        assets: [...(prev.assets || []), asset],
        itens: nextItems,
      };
    });
  };

  const handleRemoveAsset = (assetId: string | undefined) => {
    if (!assetId) {
      return;
    }

    setManualQ((prev) => ({
      ...prev,
      assets: (prev.assets || []).filter((asset) => asset.id !== assetId),
      imageUrl: (prev.assets || []).find((asset) => asset.id === assetId)?.url === prev.imageUrl ? '' : prev.imageUrl,
      enunciado: removeQuestionImageMarker(prev.enunciado || '', assetId),
      enunciado_clean: removeQuestionImageMarker(prev.enunciado_clean || '', assetId),
      introText: removeQuestionImageMarker(prev.introText || '', assetId),
      itens: (prev.itens || []).map((item) => {
        const nextBody = removeQuestionImageMarker(item.corpo || '', assetId);
        return {
          ...item,
          corpo: nextBody,
          corpo_clean: nextBody.replace(/<[^>]*>?/gm, ''),
        };
      }),
    }));
  };

  const handleAddOption = () => {
    setManualQ((prev) => ({
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
    setManualQ((prev) => {
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
    setManualQ((prev) => ({
      ...prev,
      itens: (prev.itens || []).filter((_item: ManualQuestionItem, itemIndex: number) => itemIndex !== index),
    }));
  };

  const manualItems = manualQ.itens || [];
  const questionAssets = manualQ.assets || [];
  const manualTitle =
    editingExtractedIndex !== null
      ? `Revisar Questão Extraida #${editingExtractedIndex + 1}`
      : editingQuestion
        ? 'Editar Questão'
        : 'Adicionar Nova Questão';

  const provaList = React.useMemo(
    () => mergeProvaSources(existingProvas || [], Array.isArray(manualQ.provas) ? manualQ.provas : []),
    [existingProvas, manualQ.provas],
  );
  const selectedProva = manualQ.provaId
    ? provaList.find((item) => String(item.id) === String(manualQ.provaId))
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
    const frameId = window.requestAnimationFrame(() => {
      if (selectedProva) {
        setProvaSearch(formatProvaLabel(selectedProva));
        return;
      }

      if (!manualQ.provaId) {
        setProvaSearch('');
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [manualQ.provaId, selectedProva]);

  const handleSelectProva = (prova: Prova) => {
    updateManualQ({
      questionOrigin: 'exam',
      question_origin: 'exam',
      provaId: prova.id,
      provas: [prova],
    });
    setProvaSearch(formatProvaLabel(prova));
    setIsProvaSearchOpen(false);
  };

  const handleClearProva = () => {
    updateManualQ({
      questionOrigin: 'platform',
      question_origin: 'platform',
      provaId: '',
      provas: [],
    });
    setProvaSearch('');
    setIsProvaSearchOpen(false);
  };

  const editorFrame = (
    <div className={presentation === 'page'
      ? 'flex min-h-[100dvh] flex-col overflow-hidden bg-slate-50 dark:bg-slate-950'
      : 'fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-slate-50 animate-in fade-in slide-in-from-bottom-4 duration-300 dark:bg-slate-950'}
    >
      <div className={`${presentation === 'page' ? '' : 'm-4'} ${ADMIN_MODAL_PANEL_CLASS} flex flex-1 flex-col overflow-hidden`}>
        {imageUploadError ? (
          <div role="alert" className="mx-5 mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertCircle size={18} />
            <span>{imageUploadError}</span>
          </div>
        ) : null}
        <div className={ADMIN_MODAL_HEADER_CLASS}>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{manualTitle}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gerencie o conteúdo e os filtros inteligentes para garantir a qualidade.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="mr-6 flex gap-2">
              <button
                type="button"
                onClick={() => updateManualQ({ anulada: !manualQ.anulada })}
                className={`rounded-sm border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                  manualQ.anulada
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-slate-300 bg-white text-slate-500 hover:border-red-400 dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                {manualQ.anulada ? 'Questão Anulada' : 'Anular Questão'}
              </button>
              <button
                type="button"
                onClick={() => updateManualQ({ desatualizada: !manualQ.desatualizada })}
                className={`rounded-sm border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                  manualQ.desatualizada
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-slate-300 bg-white text-slate-500 hover:border-amber-400 dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                {manualQ.desatualizada ? 'Desatualizada' : 'Marcar Desatualizada'}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-sm bg-slate-100 text-slate-400 transition-all hover:text-slate-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {reportContext ? (
          <div className="border-b border-slate-300 bg-slate-100 px-5 py-4 dark:border-slate-700 dark:bg-slate-950/50">
            {reportContext}
          </div>
        ) : null}

        <div className="no-scrollbar flex-1 overflow-y-auto space-y-6 bg-slate-50 p-5 dark:bg-slate-950">
          {(manualQ.anulada || manualQ.desatualizada) && (
            <div className="flex flex-col gap-2">
              {manualQ.anulada && (
                <div className="flex items-center gap-3 rounded-sm border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle size={18} /> Esta questão será exibida como ANULADA para os alunos.
                </div>
              )}
              {manualQ.desatualizada && (
                <div className="flex items-center gap-3 rounded-sm border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400">
                  <AlertTriangle size={18} /> Esta questão será exibida como DESATUALIZADA.
                </div>
              )}
            </div>
          )}

          <div className={`grid grid-cols-1 gap-6 p-5 md:grid-cols-2 ${ADMIN_MUTED_SURFACE_CLASS}`}>
            <SmartTagSelector
              label="Banca(s)"
              options={existingAgencies}
              selected={(manualQ.bancas || [])
                .map((item) => (isQuestionTaxonomyRecord(item) ? String(item.sigla ?? item.name ?? item.nome ?? '') : String(item ?? '').trim()))
                .filter(Boolean)}
              onChange={(value) => updateManualQ({ bancas: value })}
              placeholder="Ex: Cebraspe, FGV..."
            />
            <SmartTagSelector
              label="Órgão(s)"
              options={existingOrgaos}
              selected={(manualQ.orgaos || []).map(getQuestionOptionLabel).filter(Boolean)}
              onChange={(value) => updateManualQ({ orgaos: value })}
              placeholder="Ex: TJ-SP, PF, Receita Federal..."
            />
            <SmartTagSelector
              label="Materia(s)"
              options={existingSubjects}
              selected={(manualQ.subjects || []).map(getQuestionOptionLabel).filter(Boolean)}
              onChange={(value) => updateManualQ({ subjects: value })}
              placeholder="Ex: Direito Administrativo..."
            />
            <SmartTagSelector
              label="Assunto(s) / Topicos"
              options={existingTopics}
              selected={(manualQ.assuntos || []).map(getQuestionOptionLabel).filter(Boolean)}
              onChange={(value) => updateManualQ({ assuntos: value })}
              placeholder="Ex: Crase, Atos..."
            />

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Buscar prova vinculada</label>
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
                    placeholder="Digite nome, banca, órgão, cargo, ano ou ID"
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full pl-10 pr-24 font-semibold`}
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    {manualQ.provaId ? (
                      <button
                        type="button"
                        onClick={handleClearProva}
                        className="rounded-sm border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Limpar
                      </button>
                    ) : null}
                    {manualQ.provaId ? (
                      <span className="rounded-sm border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300">
                        #{manualQ.provaId}
                      </span>
                    ) : null}
                  </div>

                  {isProvaSearchOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-sm border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                      <div className="max-h-72 overflow-y-auto">
                        {filteredProvas.map((prova) => (
                          <button
                            key={prova.id}
                            type="button"
                            onClick={() => handleSelectProva(prova)}
                            className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition-all last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                          >
                            <div>
                              <p className="text-sm font-black text-slate-900 dark:text-slate-100">{prova.nome}</p>
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                #{prova.id} {prova.ano ? `- ${prova.ano}` : ''} {prova.banca?.sigla ? `- ${prova.banca.sigla}` : ''} {prova.orgao?.sigla ? `- ${prova.orgao.sigla}` : ''}
                              </p>
                              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {prova.cargo?.descricao || prova.cargo?.['descrição'] || 'Sem cargo definido'}
                              </p>
                            </div>
                            {String(prova.id) === String(manualQ.provaId || '') ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
                                Vinculada
                              </span>
                            ) : null}
                          </button>
                        ))}

                        {filteredProvas.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                            Nenhuma prova encontrada para a busca atual.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
              <SmartTagSelector
                label="Ano"
                options={existingYears}
                selected={(manualQ.anos || []).map(String)}
                onChange={(value) => updateManualQ({ anos: value })}
                  placeholder="2024"
                  multiple={true}
                />
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">ID da prova</label>
                  <input
                    type="text"
                    value={manualQ.provaId || ''}
                    onChange={(event) => updateManualQ({ provaId: event.target.value })}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                    placeholder="ID manual, se necessario"
                  />
                </div>
              </div>
              </div>
            {manualQ.provaId && (
              <div className="md:col-span-2 rounded-sm border border-sky-200 bg-sky-50/70 p-4 text-slate-700 dark:border-sky-900/40 dark:bg-sky-900/10 dark:text-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
                  Prova vinculada
                </p>
                {selectedProva ? (
                  <div className="mt-3 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Nome</p>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{selectedProva.nome || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Banca</p>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{selectedProva.banca?.sigla || selectedProva.banca?.nome || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Órgão</p>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{selectedProva.orgao?.sigla || selectedProva.orgao?.nome || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Cargo</p>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {selectedProva.cargo?.descricao || selectedProva.cargo?.['descri\u00e7\u00e3o'] || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Ano</p>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{selectedProva.ano || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Nivel</p>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{selectedProva.nivel || '-'}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Prova não encontrada para este ID. Verifique se o cadastro existe no banco de provas.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Dificuldade</label>
                <select
                  value={manualQ.difficulty}
                  onChange={(event) => updateManualQ({ difficulty: Number(event.target.value) })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                >
                  <option value={1}>Facil</option>
                  <option value={2}>Medio</option>
                  <option value={3}>Dificil</option>
                </select>
              </div>
            </div>

            <SmartTagSelector
              label="Cargo(s)"
              options={existingRoles}
              selected={(manualQ.cargos || []).map(getRoleDisplayLabel).filter(Boolean)}
              onChange={(value) => updateManualQ({ cargos: value })}
              placeholder="Ex: Analista Judiciario..."
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Tipo da Questão</label>
                <select
                  value={manualQ.modality || (manualItems.length === 2 ? 'Certo/Errado' : MULTIPLE_CHOICE_LABEL)}
                  onChange={(event) => handleTypeChange(event.target.value)}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                >
                  <option value={MULTIPLE_CHOICE_LABEL}>Múltipla escolha</option>
                  <option value="Certo/Errado">Certo/Errado</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Escolaridade (Nivel)</label>
                <select
                  value={manualQ.level}
                  onChange={(event) => updateManualQ({ level: event.target.value })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                >
                  <option value="Superior">Superior</option>
                  <option value={MID_LEVEL_LABEL}>Medio</option>
                  <option value="Fundamental">Fundamental</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Texto de Apoio (Opcional)</label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <ImageIcon size={13} />
                  Imagem no apoio
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      handleImageSelected(event.target.files?.[0] || null, 'support');
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              <textarea
                value={manualQ.introText || ''}
                onChange={(event) => updateManualQ({ introText: event.target.value })}
                className={`${ADMIN_TEXTAREA_CLASS} min-h-[100px] font-medium`}
                placeholder="Insira textos auxiliares aqui..."
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Enunciado Principal (HTML)</label>
              <textarea
                required
                value={manualQ.enunciado || ''}
                onChange={(event) =>
                  updateManualQ({
                    enunciado: event.target.value,
                    enunciado_clean: event.target.value.replace(/<[^>]*>?/gm, ''),
                  })
                }
                className={`${ADMIN_TEXTAREA_CLASS} min-h-[140px] text-base font-semibold`}
                placeholder="Qual o comando da questão? Aceita HTML."
              />
            </div>

            <div className="flex items-center gap-4">
              <label className={ADMIN_SECONDARY_BUTTON_CLASS}>
                <ImageIcon size={18} className="text-indigo-500" /> Imagem no enunciado
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    handleImageSelected(event.target.files?.[0] || null, 'statement');
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              {questionAssets.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {questionAssets.map((asset) => (
                    <span
                      key={asset.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400"
                    >
                      <Check size={14} />
                      {asset.id}
                      <button type="button" onClick={() => handleRemoveAsset(asset.id)} className="hover:text-red-500">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs font-semibold text-slate-400">Nenhuma imagem vinculada.</div>
              )}
            </div>

            <div className="space-y-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Alternativas</label>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  <Plus size={14} /> Adicionar Alternativa
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {manualItems.map((item: ManualQuestionItem, index: number) => (
                  <div key={item.id} className="group flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => updateManualQ({ resposta: index + 1 })}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 font-black transition-all ${
                        manualQ.resposta === index + 1
                          ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-none'
                          : 'border-slate-200 bg-white text-slate-400 hover:border-emerald-200 dark:border-slate-800 dark:bg-slate-900'
                      }`}
                    >
                      {item.rotulo}
                    </button>
                    <input
                      type="text"
                      value={item.corpo}
                      onChange={(event) => handleOptionChange(index, event.target.value)}
                      className={`${ADMIN_FIELD_CLASS} h-10 flex-1 text-xs font-medium`}
                      placeholder={`Corpo da alternativa ${item.rotulo}...`}
                    />
                    <label className="flex h-10 cursor-pointer items-center justify-center rounded-sm border border-slate-300 bg-white px-3 text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      <ImageIcon size={15} />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          handleAlternativeImageSelected(index, event.target.files?.[0] || null);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleOptionDelete(index)}
                      className="p-2 text-slate-300 opacity-0 transition-colors group-hover:opacity-100 hover:text-red-500 dark:text-slate-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 border-t border-slate-200 pt-8 dark:border-slate-800 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Comentário do Professor</label>
                  <button
                    type="button"
                    onClick={onGenerateTeacherComment}
                    disabled={isGeneratingTeacher}
                    className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 transition-colors hover:text-indigo-700 disabled:opacity-60 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    {isGeneratingTeacher ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />} Gerar com IA
                  </button>
                </div>
                <textarea
                  value={manualQ.teacherComment || ''}
                  onChange={(event) => updateManualQ({ teacherComment: event.target.value })}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[120px] bg-slate-50 font-medium dark:bg-slate-950/40`}
                  placeholder="Breve comentário ou dica do professor..."
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Análise Detalhada (IA)</label>
                  <button
                    type="button"
                    onClick={onGenerateDetailedComment}
                    disabled={isGeneratingDetailed}
                    className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 transition-colors hover:text-indigo-700 disabled:opacity-60 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    {isGeneratingDetailed ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />} Gerar com IA
                  </button>
                </div>
                <textarea
                  value={manualQ.detailedComment || ''}
                  onChange={(event) => updateManualQ({ detailedComment: event.target.value })}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[150px] border-sky-200 bg-sky-50/60 font-medium dark:border-sky-900/30 dark:bg-sky-900/10`}
                  placeholder="Análise alternativa por alternativa..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className={`${ADMIN_MODAL_FOOTER_CLASS} flex justify-end gap-3`}>
          <button
            type="button"
            onClick={onClose}
            className={ADMIN_SECONDARY_BUTTON_CLASS}
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={onSave}
            className={ADMIN_PRIMARY_BUTTON_CLASS}
          >
            <Save size={18} /> {editingExtractedIndex !== null ? 'Atualizar Revisao' : 'Salvar Questão'}
          </button>
        </div>
      </div>
    </div>
  );

  if (presentation === 'page') {
    return editorFrame;
  }

  return createPortal(editorFrame, document.body);
};

export default ManualQuestionModal;


