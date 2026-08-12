'use client';

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

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { normalizeCareerSelectorLabel } from '@services/filters';
import type { TaxonomyItem } from '@types';

export type StudyFocusLoadStatus = 'loading' | 'ready' | 'error';

interface StudyFocusModalProps {
  careers: TaxonomyItem[];
  isOpen: boolean;
  loadStatus: StudyFocusLoadStatus;
  selectedFocus: string;
  onClose: () => void;
  onRetry: () => void;
  onSelect: (focus: string) => Promise<void>;
}

const normalizeOptionKey = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

const FOCUSES_PER_PAGE = 12;

const StudyFocusModal: React.FC<StudyFocusModalProps> = ({
  careers,
  isOpen,
  loadStatus,
  selectedFocus,
  onClose,
  onRetry,
  onSelect,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const options = useMemo(() => {
    const seenLabels = new Set<string>();
    return careers
      .map((item) => ({
        id: String(item.id || item.slug || item.name || ''),
        label: normalizeCareerSelectorLabel(item.name || ''),
      }))
      .filter((item) => {
        const normalizedLabel = normalizeOptionKey(item.label);
        if (!normalizedLabel || seenLabels.has(normalizedLabel)) return false;
        seenLabels.add(normalizedLabel);
        return true;
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
  }, [careers]);

  const filteredOptions = useMemo(() => {
    const normalizedSearch = normalizeOptionKey(search);
    return normalizedSearch
      ? options.filter((option) => normalizeOptionKey(option.label).includes(normalizedSearch))
      : options;
  }, [options, search]);
  const pageCount = Math.max(1, Math.ceil(filteredOptions.length / FOCUSES_PER_PAGE));
  const visibleOptions = useMemo(
    () => filteredOptions.slice((page - 1) * FOCUSES_PER_PAGE, page * FOCUSES_PER_PAGE),
    [filteredOptions, page],
  );

  useEffect(() => setPage(1), [search]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setPage(1);
    }
  }, [isOpen]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm transition-all animate-in fade-in">
      <div role="dialog" aria-modal="true" aria-labelledby="study-focus-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl duration-300 animate-in zoom-in slide-in-from-bottom-4 dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <h3 id="study-focus-title" className="text-lg font-black text-slate-900 dark:text-slate-100">Escolha seu foco</h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Selecione um foco cadastrado nas taxonomias da plataforma.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </header>

        <div className="p-6">
          {loadStatus === 'loading' ? (
            <div className="flex min-h-36 items-center justify-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400"><Loader2 size={18} className="animate-spin" />Carregando focos...</div>
          ) : loadStatus === 'error' ? (
            <div className="flex min-h-36 flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Não foi possível carregar os focos cadastrados.</p>
              <button type="button" onClick={onRetry} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-indigo-950/30">Tentar novamente</button>
            </div>
          ) : options.length === 0 ? (
            <div className="flex min-h-36 items-center justify-center text-center text-sm font-bold text-slate-500 dark:text-slate-400">Nenhum foco está cadastrado nas taxonomias.</div>
          ) : (
            <div className="space-y-4">
              <label className="relative block">
                <span className="sr-only">Buscar foco</span>
                <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar foco"
                  autoFocus
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
                />
              </label>
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Focos disponíveis</h4>
                <span className="text-[10px] font-bold text-slate-400">{filteredOptions.length} resultado(s)</span>
              </div>
              <div className="max-h-[42vh] overflow-y-auto pr-1 no-scrollbar">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleOptions.map((focus) => {
                  const isSelected = selectedFocus === focus.label;
                  return (
                    <button type="button" key={focus.id} onClick={() => void onSelect(focus.label)} className={`group flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/40' : 'border-transparent bg-slate-50 hover:border-slate-200 dark:bg-slate-800/50 dark:hover:border-slate-700'}`}>
                      <span className={`text-sm font-bold ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>{focus.label}</span>
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full ${isSelected ? 'bg-indigo-600' : 'bg-slate-200 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-slate-700'}`}>
                        <ChevronRight size={12} className={isSelected ? 'text-white' : 'text-slate-400'} />
                      </div>
                    </button>
                  );
                })}
                </div>
                {visibleOptions.length === 0 ? (
                  <div className="flex min-h-32 items-center justify-center text-center text-sm font-bold text-slate-500 dark:text-slate-400">Nenhum foco corresponde à busca.</div>
                ) : null}
              </div>
              {pageCount > 1 ? (
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Página anterior" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400"><ChevronLeft size={17} /></button>
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">Página {page} de {pageCount}</span>
                  <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Próxima página" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400"><ChevronRight size={17} /></button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <footer className="bg-slate-50 p-6 text-center dark:bg-slate-800/30">
          <p className="text-[10px] font-medium tracking-wide text-slate-400 dark:text-slate-500">ISSO AJUDARÁ A PERSONALIZAR SUAS RECOMENDAÇÕES E RANKINGS.</p>
        </footer>
      </div>
    </div>
  );
};

export default StudyFocusModal;
