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
import { Filter, Globe, Link as LinkIcon, Save, X } from 'lucide-react';
import type { GlobalTaxonomies, TaxonomyItem } from '@types';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MODAL_FOOTER_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';

interface FilterTypeOption {
  key: string;
  label: string;
  hierarchical?: boolean;
}

type EditableTaxonomyItem = TaxonomyItem & {
  parent_id?: number | string | null;
  metadata?: Record<string, unknown>;
};

interface TaxonomyModalProps {
  editingFilterItem: { id?: number; item: EditableTaxonomyItem; originalName: string; type?: string } | null;
  activeFilterType: string;
  filterTypes: FilterTypeOption[];
  filterInput: string;
  filterSlug: string;
  filterDescription: string;
  filterWebsite: string;
  selectedParentId: number | string | null;
  taxonomies?: GlobalTaxonomies;
  onActiveFilterTypeChange: (value: string) => void;
  onFilterInputChange: (value: string) => void;
  onFilterSlugChange: (value: string) => void;
  onFilterDescriptionChange: (value: string) => void;
  onFilterWebsiteChange: (value: string) => void;
  onSelectedParentIdChange: (value: number | string | null) => void;
  onClose: () => void;
  onSave: () => void;
}

const TaxonomyModal = ({
  editingFilterItem,
  activeFilterType,
  filterTypes,
  filterInput,
  filterSlug,
  filterDescription,
  filterWebsite,
  selectedParentId,
  taxonomies,
  onActiveFilterTypeChange,
  onFilterInputChange,
  onFilterSlugChange,
  onFilterDescriptionChange,
  onFilterWebsiteChange,
  onSelectedParentIdChange,
  onClose,
  onSave,
}: TaxonomyModalProps) => {
  const currentType = editingFilterItem?.type || activeFilterType;
  const isKnowledgeTaxonomy = currentType === 'materia' || currentType === 'topico' || currentType === 'assunto';
  const requiresParent = currentType === 'topico' || currentType === 'assunto' || currentType === 'cargo';

  const getParentOptions = () => {
    if (!taxonomies) return [];

    const subjectTopicOptions = (taxonomies.subjectTopics?.length
      ? taxonomies.subjectTopics
      : (taxonomies.topics || []).filter((item) => item.taxonomyLevel === 'topico'));
    let list: TaxonomyItem[] = [];
    switch (currentType) {
      case 'banca':
        list = taxonomies.agencies || [];
        break;
      case 'orgao':
        list = taxonomies.organizations || [];
        break;
      case 'cargo':
        list = taxonomies.careers || [];
        break;
      case 'topico':
        list = taxonomies.subjects || [];
        break;
      case 'assunto':
        list = subjectTopicOptions;
        break;
      case 'carreira':
        list = taxonomies.careers || [];
        break;
      case 'area':
        list = taxonomies.areas || [];
        break;
      default:
        list = [];
    }

    return list.filter((item) => String(item.id) !== String(editingFilterItem?.id || ''));
  };

  const getParentLabel = () => {
    if (currentType === 'topico') return 'Materia raiz';
    if (currentType === 'assunto') return 'Topico raiz';
    if (currentType === 'cargo') return 'Foco raiz';
    return 'Filtro raiz / item pai';
  };

  const getParentHelper = () => {
    if (currentType === 'topico') return 'Todo topico precisa nascer dentro de uma materia.';
    if (currentType === 'assunto') return 'Todo assunto precisa nascer dentro de um topico.';
    if (currentType === 'cargo') return 'Todo cargo precisa estar vinculado a um foco.';
    return 'Use apenas quando esta taxonomia tiver um agrupador acima dela.';
  };

  const canSave = Boolean(filterInput.trim() && filterSlug.trim() && (!requiresParent || selectedParentId));

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className={`${ADMIN_MODAL_PANEL_CLASS} flex max-h-[92vh] w-full max-w-3xl flex-col shadow-2xl animate-scale-up`}>
        <header className={ADMIN_MODAL_HEADER_CLASS}>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
              <Filter size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingFilterItem ? 'Editar filtro' : 'Novo filtro'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Configure as propriedades da taxonomia.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-white dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Tipo de filtro</label>
              <select
                disabled={!!editingFilterItem}
                value={currentType}
                onChange={(event) => {
                  onActiveFilterTypeChange(event.target.value);
                  onSelectedParentIdChange(null);
                }}
                className={`${ADMIN_FIELD_CLASS} h-10 w-full disabled:opacity-50`}
              >
                {filterTypes
                  .filter((type) => type.key !== 'all')
                  .map((type) => (
                    <option key={type.key} value={type.key}>
                      {type.label}
                    </option>
                  ))}
              </select>
            </div>

            {isKnowledgeTaxonomy && (
              <div className="rounded-md border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
                Regra da base de estudos: Materia -&gt; Topico -&gt; Assunto.
                <span className="mt-1 block font-medium text-indigo-700 dark:text-indigo-300">
                  A materia e a area maior, o topico organiza o tema principal e o assunto aponta o conceito especifico cobrado na questao.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Nome / título</label>
              <input
                type="text"
                autoFocus
                value={filterInput}
                onChange={(event) => onFilterInputChange(event.target.value)}
                placeholder="Ex: Direito Administrativo, FGV..."
                className={`${ADMIN_FIELD_CLASS} w-full font-semibold`}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Slug (URL amigável)</label>
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-400">
                  <LinkIcon size={10} /> Automático
                </div>
              </div>
              <input
                type="text"
                value={filterSlug}
                onChange={(event) => onFilterSlugChange(event.target.value)}
                className={`${ADMIN_FIELD_CLASS} w-full font-mono font-semibold text-indigo-600 dark:text-indigo-400`}
              />
            </div>

            {currentType === 'banca' && (
              <>
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descrição (contexto)</label>
                  <textarea
                    value={filterDescription}
                    onChange={(event) => onFilterDescriptionChange(event.target.value)}
                    placeholder="Informações adicionais sobre esta banca..."
                    className={`${ADMIN_TEXTAREA_CLASS} h-24 resize-none`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Site oficial (URL)</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="url"
                      value={filterWebsite}
                      onChange={(event) => onFilterWebsiteChange(event.target.value)}
                      placeholder="https://exemplo.com.br"
                      className={`${ADMIN_FIELD_CLASS} w-full pl-10 font-medium`}
                    />
                  </div>
                </div>
              </>
            )}

            {currentType === 'materia' ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
                Materia e sempre raiz. Depois dela, cadastre topicos e, dentro dos topicos, os assuntos.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {getParentLabel()} {requiresParent ? '(obrigatorio)' : '(opcional)'}
                  </label>
                  <span className="text-[9px] font-bold uppercase text-slate-400">Hierarquia</span>
                </div>
                <select
                  value={selectedParentId || ''}
                  onChange={(event) => onSelectedParentIdChange(event.target.value ? Number(event.target.value) : null)}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                >
                  <option value="">{requiresParent ? 'Selecione a raiz' : 'Nenhum (item raiz)'}</option>
                  {getParentOptions().map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <p className="px-1 text-xs font-medium text-slate-500 dark:text-slate-400">{getParentHelper()}</p>
              </div>
            )}
          </div>
        </div>

        <footer className={ADMIN_MODAL_FOOTER_CLASS}>
          <div className="mx-auto flex max-w-3xl justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className={ADMIN_SECONDARY_BUTTON_CLASS}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              <Save size={16} /> {editingFilterItem ? 'Salvar alterações' : 'Criar item'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default TaxonomyModal;
