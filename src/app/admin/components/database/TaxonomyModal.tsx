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

interface FilterTypeOption {
  key: string;
  label: string;
  hierarchical?: boolean;
}

interface TaxonomyModalProps {
  editingFilterItem: { id?: number; item: any; originalName: string; type?: string } | null;
  activeFilterType: string;
  filterTypes: FilterTypeOption[];
  filterInput: string;
  filterSlug: string;
  filterDescription: string;
  filterWebsite: string;
  selectedParentId: number | null;
  taxonomies?: any;
  onActiveFilterTypeChange: (value: string) => void;
  onFilterInputChange: (value: string) => void;
  onFilterSlugChange: (value: string) => void;
  onFilterDescriptionChange: (value: string) => void;
  onFilterWebsiteChange: (value: string) => void;
  onSelectedParentIdChange: (value: number | null) => void;
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

  const getParentOptions = () => {
    if (!taxonomies) return [];

    let list: any[] = [];
    switch (currentType) {
      case 'banca':
        list = taxonomies.agencies || [];
        break;
      case 'orgao':
        list = taxonomies.organizations || [];
        break;
      case 'cargo':
        list = taxonomies.roles || [];
        break;
      case 'assunto':
        list = [...(taxonomies.subjects || []), ...(taxonomies.topics || [])];
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

    return list.filter((item: any) => item.id !== editingFilterItem?.id);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white animate-fade-in dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-8 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
            <Filter size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              {editingFilterItem ? 'Editar Filtro' : 'Novo Filtro'}
            </h3>
            <p className="text-xs font-medium text-slate-500">Configure as propriedades da taxonomia.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-2xl p-3 text-xs font-black uppercase tracking-widest text-slate-400 transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X size={20} /> Fechar
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 p-8">
          <div className="space-y-2">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Tipo de Filtro</label>
            <select
              disabled={!!editingFilterItem}
              value={currentType}
              onChange={(event) => onActiveFilterTypeChange(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
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

          <div className="space-y-2">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Nome / Título</label>
            <input
              type="text"
              autoFocus
              value={filterInput}
              onChange={(event) => onFilterInputChange(event.target.value)}
              placeholder="Ex: Direito Administrativo, FGV..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Slug (URL amigavel)</label>
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-400">
                <LinkIcon size={10} /> Automático
              </div>
            </div>
            <input
              type="text"
              value={filterSlug}
              onChange={(event) => onFilterSlugChange(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-mono font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400"
            />
          </div>

          {currentType === 'banca' && (
            <>
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descrição (Contexto)</label>
                <textarea
                  value={filterDescription}
                  onChange={(event) => onFilterDescriptionChange(event.target.value)}
                  placeholder="InformaÃ§Ãµes adicionais sobre esta banca..."
                  className="h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Site Oficial (URL)</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="url"
                    value={filterWebsite}
                    onChange={(event) => onFilterWebsiteChange(event.target.value)}
                    placeholder="https://exemplo.com.br"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Filtro Raiz / Item Pai (Opcional)</label>
              <span className="text-[9px] font-bold uppercase text-slate-400">Hierarquia</span>
            </div>
            <select
              value={selectedParentId || ''}
              onChange={(event) => onSelectedParentIdChange(event.target.value ? Number(event.target.value) : null)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Nenhum (Item Raiz)</option>
              {getParentOptions().map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-100 bg-slate-50/30 p-8 dark:border-slate-800 dark:bg-slate-800/20">
        <div className="mx-auto flex max-w-3xl justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!filterInput.trim() || !filterSlug.trim()}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={16} /> {editingFilterItem ? 'Salvar Alteracoes' : 'Criar Item'}
          </button>
        </div>
      </footer>
    </div>,
    document.body,
  );
};

export default TaxonomyModal;
