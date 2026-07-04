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

import React, { useRef, useState } from 'react';
import { PlusCircle, X } from 'lucide-react';

type SmartTagOptionObject = {
  id?: string | number;
  name?: string;
  nome?: string;
  sigla?: string;
  slug?: string;
  descricao?: string;
  'descrição'?: string;
};

interface SmartTagSelectorProps {
  label: string;
  options: Array<string | number | SmartTagOptionObject | null | undefined>;
  selected: Array<string | number | SmartTagOptionObject | null | undefined>;
  onChange: (values: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
  disabled?: boolean;
}

/**
 * Seletor inteligente de tags usado no cadastro/edição de questões.
 * Foi isolado do Admin.tsx e limpo de estados e hooks que não participavam
 * do comportamento real do componente.
 */
export const SmartTagSelector: React.FC<SmartTagSelectorProps> = ({
  label,
  options,
  selected,
  onChange,
  placeholder,
  multiple = true,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizeSearchValue = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const normalizeOptionValue = (value: SmartTagSelectorProps['options'][number]) => {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim();
    }

    if (value && typeof value === 'object') {
      const sigla = String(value.sigla ?? '').trim();
      const name = String(
        value.name
        ?? value.nome
        ?? value.descricao
        ?? value['descrição']
        ?? '',
      ).trim();

      if (sigla && name && normalizeSearchValue(sigla) !== normalizeSearchValue(name)) {
        return `${sigla} - ${name}`;
      }

      return name || sigla || String(value.id ?? '').trim();
    }

    return '';
  };

  const normalizeOptionSearchValue = (value: SmartTagSelectorProps['options'][number]) => {
    const label = normalizeOptionValue(value);
    if (!value || typeof value !== 'object') {
      return label;
    }

    return [
      label,
      value.name,
      value.nome,
      value.sigla,
      value.slug,
      value.descricao,
      value['descrição'],
      value.id,
    ]
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .join(' ');
  };

  const normalizedSelected = Array.from(
    new Set((selected || []).map(normalizeOptionValue).filter(Boolean)),
  );

  const normalizedOptionEntries = Array.from(
    (options || []).reduce((entries, option) => {
      const label = normalizeOptionValue(option);
      if (!label || entries.has(label)) {
        return entries;
      }

      entries.set(label, normalizeOptionSearchValue(option));
      return entries;
    }, new Map<string, string>()),
  ).map(([label, search]) => ({ label, search }));

  const normalizedOptions = normalizedOptionEntries.map((option) => option.label);

  const normalizedInput = inputValue.trim();
  const normalizedInputSearch = normalizeSearchValue(normalizedInput);

  const filteredOptions = normalizedOptionEntries.filter((option) => (
    normalizeSearchValue(option.search).includes(normalizedInputSearch) && !normalizedSelected.includes(option.label)
  ));

  const hasExactOption = normalizedOptions.some((option) => (
    normalizeSearchValue(option) === normalizedInputSearch
  ));
  const canCreateOption = normalizedInput.length >= 2
    && !hasExactOption
    && filteredOptions.length === 0;

  const handleAdd = (value: string) => {
    if (disabled) {
      return;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    if (multiple) {
      if (!normalizedSelected.includes(trimmedValue)) {
        onChange([...normalizedSelected, trimmedValue]);
      }
    } else {
      onChange([trimmedValue]);
    }

    setInputValue('');
    setIsOpen(false);
  };

  const handleRemove = (value: string) => {
    if (disabled) {
      return;
    }

    onChange(normalizedSelected.filter((selectedValue) => selectedValue !== value));
  };

  const slugPreview = normalizedInput
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return (
    <div className="space-y-1.5 flex-1" ref={containerRef}>
      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <div className={`min-h-[44px] p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all ${disabled ? 'opacity-60' : ''}`}>
          {normalizedSelected.map((selectedValue, index) => (
            <span
              key={`${selectedValue}-${index}`}
              className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-100 dark:border-indigo-900/50"
            >
              {selectedValue}
              <button
                type="button"
                onClick={() => handleRemove(selectedValue)}
                disabled={disabled}
                className="hover:text-indigo-900 disabled:cursor-not-allowed dark:hover:text-indigo-100 transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          <input
            type="text"
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && inputValue) {
                event.preventDefault();
                handleAdd(inputValue);
              }
            }}
            placeholder={normalizedSelected.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-900 dark:text-slate-100 min-w-[80px] px-2 disabled:cursor-not-allowed"
          />
        </div>

        {!disabled && isOpen && (normalizedInput || filteredOptions.length > 0) && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto no-scrollbar py-2">
            {filteredOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleAdd(option.label)}
                className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {option.label}
              </button>
            ))}

            {canCreateOption && (
              <button
                type="button"
                onClick={() => handleAdd(normalizedInput)}
                className="w-full text-left px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex flex-col gap-0.5"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle size={14} /> Adicionar &quot;{normalizedInput}&quot;
                </div>
                <div className="text-[10px] text-slate-400 font-normal ml-6 italic">
                  Slug: {slugPreview}
                </div>
              </button>
            )}

            {normalizedInput && filteredOptions.length === 0 && !canCreateOption && (
              <div className="px-4 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
                Digite pelo menos 2 caracteres para cadastrar uma nova taxonomia.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
