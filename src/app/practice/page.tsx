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


import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Difficulty } from '../../types';
import type { UserAnswer } from '../../types';
import { ChevronRight, ChevronLeft, ChevronDown, Search, RotateCcw, Loader2, X, BookmarkCheck, Check, CheckCircle, GraduationCap, Sparkles, AlertTriangle, ArrowLeft, ArrowUp } from 'lucide-react';
import QuestionCard from '../questions/components/QuestionCard';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import AuthModal from '../../components/shared/overlays/AuthModal';
import AdBanner from '../../components/shared/feedback/AdBanner';
import { getEffectivePlanName } from '@services/plans/planAccess';
import {
  ENEM_FOCUS_NAME,
  ENEM_SUBJECT_AREA_DESCRIPTIONS,
  ENEM_SUBJECT_AREA_OPTIONS,
  getEnemSubjectAreasForQuestion,
  injectEnemFocusOption,
  isEnemQuestion,
  normalizeCareerSelectorLabel,
} from '@services/filters';

const PAGE_SIZE = 10;

const DEFAULT_FILTERS = {
  keyword: '',
  subject: [] as string[],
  difficulty: [] as string[],
  agency: [] as string[],
  organization: [] as string[],
  year: [] as string[],
  level: [] as string[],
  topic: [] as string[],
  role: [] as string[],
  career: [] as string[],
  modality: [] as string[],
  onlySaved: false,
  hasTeacherComment: false,
  hasDetailedComment: false,
  excludeCanceled: false,
  excludeOutdated: false,
  excludeAnswered: false,
};

type SearchableFilterValue = string | string[];

type SearchableFilterOption = {
  value: string;
  label: string;
  helper?: string;
};

type SearchableFilterGroup = {
  label: string;
  selectable?: boolean;
  options: SearchableFilterOption[];
};

const MULTI_FILTER_KEYS = ['subject', 'difficulty', 'agency', 'organization', 'year', 'level', 'topic', 'role', 'career', 'modality'] as const;

const isMultiFilterKey = (key: string): key is typeof MULTI_FILTER_KEYS[number] => (
  (MULTI_FILTER_KEYS as readonly string[]).includes(key)
);

const toFilterValues = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => item && item !== 'All');
  }

  const rawValue = String(value || '').trim();
  return rawValue && rawValue !== 'All' ? [rawValue] : [];
};

const hasAnyFilterValue = (value: unknown) => toFilterValues(value).length > 0;

const filterHasValue = (value: unknown, option: string) => toFilterValues(value).includes(option);

const filterMatchesAny = (value: unknown, matcher: (selected: string) => boolean) => {
  const selectedValues = toFilterValues(value);
  return selectedValues.length === 0 || selectedValues.some(matcher);
};

const serializeFilterValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }

  return String(value || '');
};

const isVisibleFilterValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== 'All' && value !== '' && value !== false;
};

const formatQuestionCount = (count: number) => `${count} ${count === 1 ? 'Questão' : 'Questões'}`;

const normalizePracticeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const getPracticeTaxonomyName = (item: any) => String(item?.name || item?.nome || item?.descricao || item?.['descrição'] || '').trim();

const getPracticeTaxonomyId = (item: any) => String(item?.id ?? '').trim();

const getPracticeParentId = (item: any) => String(
  item?.parentId
    ?? item?.parent_id
    ?? item?.assunto_raiz
    ?? item?.pai
    ?? '',
).trim();

const getPracticeRootSubjectId = (item: any) => String(
  item?.rootSubjectId
    ?? item?.root_subject_id
    ?? item?.subjectId
    ?? item?.subject_id
    ?? '',
).trim();

const getPracticeRootSubjectName = (item: any) => String(
  item?.rootSubjectName
    ?? item?.root_subject_name
    ?? item?.subjectName
    ?? item?.subject_name
    ?? item?.materiaNome
    ?? item?.materia_nome
    ?? '',
).trim();

const getPracticeTaxonomyLevel = (item: any, taxonomies?: any) => {
  const rawLevel = normalizePracticeText(item?.taxonomyLevel || item?.taxonomy_level);
  if (rawLevel === 'topico' || rawLevel === 'assunto') {
    return rawLevel;
  }

  const itemId = getPracticeTaxonomyId(item);
  const itemName = getPracticeTaxonomyName(item);
  const found = [
    ...(taxonomies?.subjectTopics || []),
    ...(taxonomies?.specificSubjects || []),
    ...(taxonomies?.topics || []),
  ].find((taxonomy: any) => (
    (itemId && String(taxonomy?.id) === itemId)
    || (itemName && getPracticeTaxonomyName(taxonomy) === itemName)
  ));

  const foundLevel = normalizePracticeText(found?.taxonomyLevel || found?.taxonomy_level);
  if (foundLevel === 'topico' || foundLevel === 'assunto') {
    return foundLevel;
  }

  return found && getPracticeParentId(found) ? 'assunto' : 'topico';
};

const questionHasSubject = (question: any, subjectName: string) => {
  if (subjectName === 'All') return true;
  return (question?.assuntos || []).some((item: any) => Boolean(item?.materia) && getPracticeTaxonomyName(item) === subjectName);
};

const questionMatchesSubjects = (question: any, subjects: unknown) => (
  filterMatchesAny(subjects, (subjectName) => questionHasSubject(question, subjectName))
);

const buildSearchableOptionGroup = (label: string, options: string[]): SearchableFilterGroup[] => [{
  label,
  options: options.map((option) => ({
    value: option,
    label: option,
  })),
}];

const SearchableFilterSelect = ({
  label,
  value,
  onChange,
  groups,
  disabled = false,
  placeholder = 'Todos',
  searchPlaceholder = 'Busca rapida',
  helperText,
  disabledText,
  multiple = true,
}: {
  label: string;
  value: SearchableFilterValue;
  onChange: (value: SearchableFilterValue) => void;
  groups: SearchableFilterGroup[];
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  helperText?: string;
  disabledText?: string;
  multiple?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedValues = useMemo(() => toFilterValues(value), [value]);
  const allOptions = useMemo(() => groups.flatMap((group) => group.options), [groups]);

  const selectedLabelMap = useMemo(() => new Map(
    allOptions.map((option) => [option.value, option.label]),
  ), [allOptions]);

  const selectedLabel = selectedValues.length === 0
    ? placeholder
    : selectedValues.length === 1
      ? selectedLabelMap.get(selectedValues[0]) || selectedValues[0]
      : `${selectedValues.length} selecionados`;

  const filteredGroups = useMemo(() => {
    const normalizedQuery = normalizePracticeText(query);
    return groups
      .map((group) => ({
        ...group,
        options: normalizedQuery
          ? group.options.filter((option) => (
            normalizePracticeText(option.label).includes(normalizedQuery)
            || normalizePracticeText(option.helper).includes(normalizedQuery)
            || normalizePracticeText(group.label).includes(normalizedQuery)
          ))
          : group.options,
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!disabled) return;

    const frame = window.requestAnimationFrame(() => {
      setIsOpen(false);
      setQuery('');
    });

    return () => window.cancelAnimationFrame(frame);
  }, [disabled]);

  const handleSelect = (nextValue: string) => {
    if (nextValue === 'All') {
      onChange(multiple ? [] : 'All');
      setIsOpen(false);
      setQuery('');
      return;
    }

    if (!multiple) {
      onChange(nextValue);
      setIsOpen(false);
      setQuery('');
      return;
    }

    const nextValues = selectedValues.includes(nextValue)
      ? selectedValues.filter((item) => item !== nextValue)
      : [...selectedValues, nextValue];
    onChange(nextValues);
  };

  const handleGroupSelect = (group: SearchableFilterGroup) => {
    if (!multiple || !group.selectable) return;

    const groupValues = group.options.map((option) => option.value).filter(Boolean);
    if (groupValues.length === 0) return;

    const allGroupValuesSelected = groupValues.every((groupValue) => selectedValues.includes(groupValue));
    const nextValues = allGroupValuesSelected
      ? selectedValues.filter((selectedValue) => !groupValues.includes(selectedValue))
      : Array.from(new Set([...selectedValues, ...groupValues]));

    onChange(nextValues);
  };

  return (
    <div ref={containerRef} className="relative flex w-full flex-col gap-1.5">
      <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm font-medium outline-none transition-all ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-500' : 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-indigo-200 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-800'}`}
      >
        <span className="truncate">{disabled ? (disabledText || selectedLabel) : selectedLabel}</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {helperText ? (
        <p className="px-1 text-[10px] font-medium leading-4 text-slate-400 dark:text-slate-500">{helperText}</p>
      ) : null}

      {isOpen && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/40">
          <div className="relative border-b border-slate-100 dark:border-slate-800">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 w-full bg-transparent pl-3 pr-10 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
            />
            <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          </div>

          <div className="max-h-80 overflow-y-auto py-2">
            <button
              type="button"
              onClick={() => handleSelect('All')}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${selectedValues.length === 0 ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700'}`}>
                {selectedValues.length === 0 ? <Check size={11} /> : null}
              </span>
              {placeholder}
            </button>

            {filteredGroups.length > 0 ? filteredGroups.map((group) => (
              <div key={group.label} className="py-1">
                {group.selectable ? (
                  <button
                    type="button"
                    onClick={() => handleGroupSelect(group)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.18em] transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${
                      group.options.every((option) => selectedValues.includes(option.value))
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                        : group.options.some((option) => selectedValues.includes(option.value))
                          ? 'text-indigo-600 dark:text-indigo-300'
                          : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      group.options.every((option) => selectedValues.includes(option.value))
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : group.options.some((option) => selectedValues.includes(option.value))
                          ? 'border-indigo-400 bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60'
                          : 'border-slate-200 dark:border-slate-700'
                    }`}>
                      {group.options.every((option) => selectedValues.includes(option.value)) ? <Check size={11} /> : null}
                    </span>
                    {group.label}
                  </button>
                ) : (
                  <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{group.label}</p>
                )}
                {group.options.map((option) => (
                  <button
                    key={`${group.label}-${option.value}`}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedValues.includes(option.value) ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}
                  >
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selectedValues.includes(option.value) ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700'}`}>
                      {selectedValues.includes(option.value) ? <Check size={11} /> : null}
                    </span>
                    <span>
                      <span className="block font-semibold leading-5">{option.label}</span>
                      {option.helper ? <span className="mt-0.5 block text-[10px] font-medium text-slate-400 dark:text-slate-500">{option.helper}</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            )) : (
              <p className="px-3 py-5 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">Nenhum item encontrado.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

type FilterSelectProps = {
  label: string;
  value: SearchableFilterValue;
  onChange: (value: SearchableFilterValue) => void;
  options: unknown[];
  disabled?: boolean;
  helperText?: string;
};

const FilterSelect = ({ label, value, onChange, options, disabled = false, helperText }: FilterSelectProps) => (
  <SearchableFilterSelect
    label={label}
    value={value}
    onChange={onChange}
    groups={buildSearchableOptionGroup(String(label), (options || []).map(String))}
    disabled={disabled}
    helperText={helperText}
  />
);

type CheckboxFilterTone = 'amber' | 'emerald' | 'indigo' | 'red';

const CHECKBOX_FILTER_TONE_CLASSES: Record<CheckboxFilterTone, {
  checked: string;
  unchecked: string;
  boxChecked: string;
  boxUnchecked: string;
}> = {
  amber: {
    checked: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    unchecked: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
    boxChecked: 'bg-amber-600 border-amber-600',
    boxUnchecked: 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700',
  },
  emerald: {
    checked: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    unchecked: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
    boxChecked: 'bg-emerald-600 border-emerald-600',
    boxUnchecked: 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700',
  },
  indigo: {
    checked: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400',
    unchecked: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
    boxChecked: 'bg-indigo-600 border-indigo-600',
    boxUnchecked: 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700',
  },
  red: {
    checked: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
    unchecked: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
    boxChecked: 'bg-red-600 border-red-600',
    boxUnchecked: 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700',
  },
};

type CheckboxFilterProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  colorClass?: CheckboxFilterTone;
};

const CheckboxFilter = ({
  label,
  checked,
  onChange,
  icon: Icon,
  colorClass = 'indigo',
}: CheckboxFilterProps) => {
  const tone = CHECKBOX_FILTER_TONE_CLASSES[colorClass] || CHECKBOX_FILTER_TONE_CLASSES.indigo;

  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 transition-all select-none ${checked ? tone.checked : tone.unchecked}`}>
      <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? tone.boxChecked : tone.boxUnchecked}`}>
        {checked && <Check size={10} className="text-white" />}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {Icon && <Icon size={14} className="ml-1 opacity-50" />}
      <input type="checkbox" className="hidden" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
};

const sanitizePracticeFiltersForFocus = (nextFilters: typeof DEFAULT_FILTERS) => {
  if (!hasAnyFilterValue(nextFilters.subject) && hasAnyFilterValue(nextFilters.topic)) {
    nextFilters = {
      ...nextFilters,
      topic: [],
    };
  }

  if (!filterHasValue(nextFilters.career, ENEM_FOCUS_NAME)) {
    return nextFilters;
  }

  return {
    ...nextFilters,
    agency: [],
    organization: [],
    level: [],
    role: [],
    modality: [],
  };
};

const Practice: React.FC = () => {
  const { currentUser, toggleSavedQuestion } = useAuth();
  const {
    questions, userAnswers, userNotes, reports, systemSettings,
    submitAnswer: dispatchAnswer, reportError, addComment, likeComment, saveNote,
    ensureTaxonomiesLoaded
  } = useData();
  // URL query parameter for highlighting specific question or setting filters
  const searchParams = useSearchParams();
  const pathname = usePathname() || '/practice';
  const router = useRouter();
  const setSearchParams = useCallback((nextSearchParams: URLSearchParams | Record<string, string> | ((current: URLSearchParams) => URLSearchParams)) => {
    const nextParams = typeof nextSearchParams === 'function'
      ? nextSearchParams(new URLSearchParams(searchParams?.toString()))
      : new URLSearchParams(nextSearchParams as Record<string, string>);
    const queryString = nextParams.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);
  const highlightedQuestionId = searchParams.get('questionId');

  const initialFilters = useMemo(() => {
    const readMultiParam = (names: string[], normalizer: (value: string) => string = (value) => value) => {
      const values = names.flatMap((name) => {
        const repeatedValues = searchParams.getAll(name);
        const rawValues = repeatedValues.length > 0 ? repeatedValues : [searchParams.get(name) || ''];
        return rawValues.flatMap((item) => String(item || '').split(','));
      });

      return Array.from(new Set(
        values
          .map((item) => normalizer(item.trim()))
          .filter((item) => item && item !== 'All'),
      ));
    };

    return {
      ...DEFAULT_FILTERS,
      keyword: searchParams.get('keyword') || DEFAULT_FILTERS.keyword,
      subject: readMultiParam(['subject', 'materia']),
      difficulty: readMultiParam(['difficulty']),
      agency: readMultiParam(['agency']),
      organization: readMultiParam(['organization']),
      year: readMultiParam(['year']),
      level: readMultiParam(['level']),
      topic: readMultiParam(['topic', 'assunto']),
      role: readMultiParam(['role']),
      career: readMultiParam(['career'], normalizeCareerSelectorLabel),
      modality: readMultiParam(['modality']),
      onlySaved: searchParams.get('onlySaved') === 'true',
      hasTeacherComment: searchParams.get('hasTeacherComment') === 'true',
      hasDetailedComment: searchParams.get('hasDetailedComment') === 'true',
      excludeCanceled: searchParams.get('excludeCanceled') === 'true',
      excludeOutdated: searchParams.get('excludeOutdated') === 'true',
      excludeAnswered: searchParams.get('excludeAnswered') === 'true',
    };
  }, [searchParams]);

  const [filters, setFilters] = useState<any>(() => sanitizePracticeFiltersForFocus(initialFilters));
  const [pendingFilters, setPendingFilters] = useState<any>(() => sanitizePracticeFiltersForFocus(initialFilters)); // State for UI selection before submit
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterTimestamp, setFilterTimestamp] = useState(0); // Force reset on filter
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState({ title: '', description: '' });
  const [lastFetchedPage, setLastFetchedPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const pageRootRef = useRef<HTMLDivElement>(null);
  const focusQuestionRef = useRef<HTMLDivElement>(null);
  const scrollTargetRef = useRef<HTMLElement | Window | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const sanitizeFiltersForFocus = sanitizePracticeFiltersForFocus;

  const isEnemPendingFocus = filterHasValue(pendingFilters.career, ENEM_FOCUS_NAME);

  // Removido declarção duplicada do searchParams
  const filteredQuestions = useMemo(() => {
    let filtered = questions.filter(q => {
      const enemQuestion = isEnemQuestion(q);
      const enemSubjectAreas = getEnemSubjectAreasForQuestion(q);
      const selectedSubjects = toFilterValues(filters.subject);
      const selectedCareers = toFilterValues(filters.career);
      const isEnemFocus = selectedCareers.includes(ENEM_FOCUS_NAME);
      const matchSubject = selectedSubjects.length === 0
        || (
          isEnemFocus
            ? selectedSubjects.some((subjectName) => enemSubjectAreas.includes(subjectName as (typeof ENEM_SUBJECT_AREA_OPTIONS)[number]))
            : questionMatchesSubjects(q, selectedSubjects)
        );
      
      const difficultyMap: Record<string, number> = {
        'Muito Fácil': 1,
        'Fácil': 2,
        'Médio': 3,
        'Difícil': 4,
        'Muito Difícil': 5
      };
      
      const matchDifficulty = filterMatchesAny(filters.difficulty, (difficulty) => q.dificuldade === difficultyMap[difficulty]);
      const matchAgency = isEnemFocus || filterMatchesAny(filters.agency, (agency) => Boolean(q.bancas?.some(b => b.sigla === agency || b.nome === agency)));
      const matchOrganization = isEnemFocus || filterMatchesAny(filters.organization, (organization) => Boolean(q.orgaos?.some(o => o.sigla === organization || o.nome === organization)));
      const matchYear = filterMatchesAny(filters.year, (year) => Boolean(q.anos?.some(y => String(y) === year)));
      const matchLevel = isEnemFocus || filterMatchesAny(filters.level, (level) => q.level === level);
      const matchTopic = filterMatchesAny(filters.topic, (topic) => Boolean(q.assuntos?.some(a => getPracticeTaxonomyName(a) === topic)));
      const selectedNonEnemCareers = selectedCareers.filter((career) => career !== ENEM_FOCUS_NAME);
      const matchRoleMulti = isEnemFocus || filterMatchesAny(filters.role, (role) => Boolean(q.cargos?.some((cargo) => getPracticeTaxonomyName(cargo) === role)));
      const matchCareerMulti = selectedCareers.length === 0
        || (isEnemFocus && enemQuestion)
        || q.carreiras?.some(c => selectedNonEnemCareers.includes(normalizeCareerSelectorLabel(c?.nome)));
      const matchModality = isEnemFocus || filterMatchesAny(filters.modality, (modality) => q.tipo === (modality === 'Certo/Errado' ? 'certo ou errado' : 'multipla escolha'));
      const matchKeyword = !filters.keyword || (q.enunciado_clean || q.enunciado || '').toLowerCase().includes(filters.keyword.toLowerCase());
      const matchSaved = !filters.onlySaved || currentUser?.savedQuestionIds.includes(String(q.id));

      const matchTeacher = !filters.hasTeacherComment || !!q.hasTeacherComment || !!q.teacherComment;
      const matchDetailed = !filters.hasDetailedComment || !!q.hasDetailedComment || !!q.detailedComment;

      const matchCanceled = !(q.anulada || q.isCanceled) || !filters.excludeCanceled;
      const matchOutdated = !(q.desatualizada || q.isOutdated) || !filters.excludeOutdated;
      const matchExcludeAnswered = !filters.excludeAnswered || !userAnswers.some(a => Number(a.questionId) === Number(q.id));

      return matchSubject && matchDifficulty && matchKeyword && matchAgency && matchOrganization && matchYear && matchLevel && matchTopic && matchRoleMulti && matchCareerMulti && matchModality && matchSaved && matchTeacher && matchDetailed && matchCanceled && matchOutdated && matchExcludeAnswered;
    });

    if (highlightedQuestionId) {
      filtered = filtered.filter(q => String(q.id) === highlightedQuestionId);
    }

    return filtered;
  }, [filters, questions, currentUser?.savedQuestionIds, userAnswers, highlightedQuestionId]);

  const { totalQuestions, fetchMoreQuestions } = useData();

  const loadNextPage = useCallback(async () => {
    if (isLoadingMore || filteredQuestions.length >= totalQuestions) return;
    
    setIsLoadingMore(true);
    const nextPage = lastFetchedPage + 1;
    await fetchMoreQuestions(nextPage);
    setLastFetchedPage(nextPage);
    setIsLoadingMore(false);
  }, [isLoadingMore, lastFetchedPage, filteredQuestions.length, totalQuestions, fetchMoreQuestions]);

  const paginatedList = useMemo(() => filteredQuestions.slice(0, visibleCount), [filteredQuestions, visibleCount]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (viewMode === 'list') {
            if (visibleCount < filteredQuestions.length) {
              setVisibleCount(prev => prev + PAGE_SIZE);
            } else if (filteredQuestions.length < totalQuestions) {
              // Trigger backend fetch for more
              loadNextPage();
            }
        }
      }
    }, { threshold: 0.1 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [visibleCount, filteredQuestions.length, totalQuestions, viewMode, loadNextPage]);

  // Load more when reaching end of cards in focus mode
  useEffect(() => {
    if (viewMode !== 'card' || currentQuestionIndex < filteredQuestions.length - 1 || filteredQuestions.length >= totalQuestions) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      void loadNextPage();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentQuestionIndex, filteredQuestions.length, totalQuestions, viewMode, loadNextPage]);

  useEffect(() => {
    ensureTaxonomiesLoaded();
  }, [ensureTaxonomiesLoaded]);

  useEffect(() => {
    const resolveScrollableParent = (element: HTMLElement | null): HTMLElement | Window => {
      let parent = element?.parentElement ?? null;

      while (parent) {
        const style = window.getComputedStyle(parent);
        const isScrollable = /(auto|scroll)/.test(style.overflowY);
        if (isScrollable && parent.scrollHeight > parent.clientHeight + 4) {
          return parent;
        }
        parent = parent.parentElement;
      }

      return window;
    };

    const target = resolveScrollableParent(pageRootRef.current);
    scrollTargetRef.current = target;

    const getScrollTop = () => {
      if (target === window) return window.scrollY || document.documentElement.scrollTop || 0;
      return (target as HTMLElement).scrollTop;
    };

    const onScroll = () => {
      setShowBackToTop(getScrollTop() > 700);
    };

    onScroll();

    if (target === window) {
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }

    (target as HTMLElement).addEventListener('scroll', onScroll, { passive: true });
    return () => (target as HTMLElement).removeEventListener('scroll', onScroll);
  }, []);

  const handleBackToTop = useCallback(() => {
    const target = scrollTargetRef.current;
    if (!target || target === window) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    (target as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToFocusQuestion = useCallback(() => {
    window.requestAnimationFrame(() => {
      focusQuestionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, []);

  const handleAnswer = useCallback((ans: UserAnswer) => {
    if (!currentUser) {
      setAuthModalConfig({
        title: "Responda Já!",
        description: "Crie uma conta gratuita em segundos para salvar suas resoluções, ganhar XP e monitorar sua evolução."
      });
      setShowAuthModal(true);
      return;
    }
    if (!currentUser.emailVerified) {
      setAuthModalConfig({
        title: "Confirme seu E-mail",
        description: "Para responder questões e ganhar XP, você precisa confirmar seu e-mail. Verifique sua caixa de entrada."
      });
      setShowAuthModal(true);
      return;
    }
    dispatchAnswer(ans);
  }, [currentUser, dispatchAnswer]);

  const handleFilterChange = useCallback((key: string, value: any) => {
    setPendingFilters(prev => {
      let nextFilters = { ...prev, [key]: value };

      if (key === 'career') {
        const nextCareerValues = toFilterValues(value);
        const previousHadEnemFocus = filterHasValue(prev.career, ENEM_FOCUS_NAME);
        const nextHasEnemFocus = nextCareerValues.includes(ENEM_FOCUS_NAME);

        if (nextHasEnemFocus) {
          const allowedSubjectValues = toFilterValues(nextFilters.subject)
            .filter((subject) => ENEM_SUBJECT_AREA_OPTIONS.includes(subject as (typeof ENEM_SUBJECT_AREA_OPTIONS)[number]));
          nextFilters = sanitizeFiltersForFocus({
            ...nextFilters,
            subject: allowedSubjectValues,
            topic: [],
          });
        } else if (previousHadEnemFocus) {
          nextFilters = {
            ...nextFilters,
            subject: [],
            topic: [],
          };
        }
      }

      if (key === 'subject') {
        nextFilters = { ...nextFilters, topic: [] };
      }

      return nextFilters;
    });
  }, [sanitizeFiltersForFocus]);

  const applyFilters = useCallback(() => {
    setIsFiltering(true);
    setTimeout(() => {
      setFilters(sanitizeFiltersForFocus(pendingFilters));
      setFilterTimestamp((timestamp) => timestamp + 1);
      setVisibleCount(PAGE_SIZE);
      setCurrentQuestionIndex(0);
      setIsFiltering(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500);
  }, [pendingFilters, sanitizeFiltersForFocus]);

  const clearFilter = useCallback((key: string) => {
    let defaultValue: any = isMultiFilterKey(key) ? [] : 'All';
    if (['onlySaved', 'hasTeacherComment', 'hasDetailedComment', 'excludeCanceled', 'excludeOutdated', 'excludeAnswered'].includes(key)) defaultValue = false;

    // Update both pending and active to clear immediately/consistently or just pending?
    // User expects "RotateCcw" to clear all. Single clear currently acts on 'filters' in original code.
    // If we want manual submit, clearing a single chip should perhaps update pending?
    // But chips show *active* filters. So clearing them should probably re-trigger apply or update active directly.
    // Let's update both for immediate effect on chips.
    let newFilters = { ...filters, [key]: defaultValue };
    if (key === 'subject') {
      newFilters = {
        ...newFilters,
        topic: [],
      };
    }
    if (key === 'career' && filterHasValue(filters.career, ENEM_FOCUS_NAME)) {
      newFilters = {
        ...newFilters,
        subject: [],
        topic: [],
      };
    }
    newFilters = sanitizeFiltersForFocus(newFilters);
    setFilters(newFilters);
    setPendingFilters(prev => {
      let nextFilters = { ...prev, [key]: defaultValue };
      if (key === 'subject') {
        nextFilters = {
          ...nextFilters,
          topic: [],
        };
      }
      if (key === 'career' && filterHasValue(prev.career, ENEM_FOCUS_NAME)) {
        nextFilters = {
          ...nextFilters,
          subject: [],
          topic: [],
        };
      }
      return sanitizeFiltersForFocus(nextFilters);
    });
  }, [filters, sanitizeFiltersForFocus]);

  // if (!currentUser) return null; // Removed to allow guest access

  const enemQuestions = useMemo(() => questions.filter(isEnemQuestion), [questions]);

  const uniqueAgencies = useMemo(() => {
    if (systemSettings.taxonomies?.agencies?.length) return systemSettings.taxonomies.agencies.map((t: any) => t.sigla || t.name);
    return Array.from(new Set(questions.flatMap(q => q.bancas?.map(b => b.sigla) || []).filter(Boolean))) as string[];
  }, [questions, systemSettings.taxonomies?.agencies]);

  const uniqueOrganizations = useMemo(() => {
    if (systemSettings.taxonomies?.organizations?.length) return systemSettings.taxonomies.organizations.map((t: any) => t.sigla || t.name);
    return Array.from(new Set(questions.flatMap(q => q.orgaos?.map(o => o.sigla || o.nome) || []).filter(Boolean))) as string[];
  }, [questions, systemSettings.taxonomies?.organizations]);

  const uniqueSubjects = useMemo(() => {
    if (isEnemPendingFocus) {
      return [...ENEM_SUBJECT_AREA_OPTIONS];
    }

    if (systemSettings.taxonomies?.subjects?.length) return systemSettings.taxonomies.subjects.map((t: any) => t.name);
    return Array.from(new Set(questions.flatMap(q => q.assuntos?.filter(a => a.materia).map(a => a.nome) || []).filter(Boolean))) as string[];
  }, [isEnemPendingFocus, questions, systemSettings.taxonomies?.subjects]);

  const subjectOptionGroups = useMemo<SearchableFilterGroup[]>(() => [{
    label: isEnemPendingFocus ? 'Areas de conhecimento' : 'Materias',
    options: uniqueSubjects.map((subjectName) => ({
      value: subjectName,
      label: subjectName,
    })),
  }], [isEnemPendingFocus, uniqueSubjects]);

  const topicOptionGroups = useMemo<SearchableFilterGroup[]>(() => {
    const selectedSubjectValues = toFilterValues(pendingFilters.subject);

    if (selectedSubjectValues.length === 0) {
      return [];
    }

    if (isEnemPendingFocus) {
      const scopedEnemQuestions = enemQuestions.filter((question) => (
        getEnemSubjectAreasForQuestion(question).some((areaName) => selectedSubjectValues.includes(areaName))
      ));
      const options = Array.from(new Set(
        scopedEnemQuestions.flatMap((question) => question.assuntos?.filter((assunto) => !assunto.materia).map((assunto) => getPracticeTaxonomyName(assunto)) || []).filter(Boolean),
      )).sort((a, b) => a.localeCompare(b, 'pt-BR')).map((name) => ({ value: name, label: name }));

      return options.length ? [{ label: 'Assuntos ENEM', options }] : [];
    }

    const taxonomies: any = systemSettings.taxonomies || {};
    const subjects = taxonomies.subjects || [];
    const selectedSubjectIds = new Set(
      subjects
        .filter((subject: any) => selectedSubjectValues.includes(getPracticeTaxonomyName(subject)))
        .map((subject: any) => getPracticeTaxonomyId(subject))
        .filter(Boolean),
    );
    const subjectTopics = (taxonomies.subjectTopics?.length
      ? taxonomies.subjectTopics
      : (taxonomies.topics || []).filter((item: any) => getPracticeTaxonomyLevel(item, taxonomies) === 'topico')) || [];
    const specificSubjects = (taxonomies.specificSubjects?.length
      ? taxonomies.specificSubjects
      : (taxonomies.topics || []).filter((item: any) => getPracticeTaxonomyLevel(item, taxonomies) === 'assunto')) || [];
    const hasStructuredKnowledgeTaxonomies = subjectTopics.length > 0 || specificSubjects.length > 0;
    const topicById = new Map<string, any>();
    subjectTopics.forEach((topic: any) => {
      const topicId = getPracticeTaxonomyId(topic);
      if (topicId) topicById.set(topicId, topic);
    });

    const groups = new Map<string, SearchableFilterOption[]>();
    const seenOptions = new Set<string>();
    const selectableGroups = new Set<string>();
    const addOption = (groupLabel: string, optionName: string, helper?: string) => {
      const normalizedName = optionName.trim();
      if (!normalizedName || seenOptions.has(`${groupLabel}:${normalizedName}`)) {
        return;
      }

      seenOptions.add(`${groupLabel}:${normalizedName}`);
      groups.set(groupLabel, [
        ...(groups.get(groupLabel) || []),
        { value: normalizedName, label: normalizedName, helper },
      ]);
    };
    const serializeTopicGroups = () => Array.from(groups.entries())
      .map(([label, options]) => ({
        label,
        selectable: selectableGroups.has(label),
        options: options.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
      }))
      .sort((a, b) => {
        if (a.label === 'Topicos disponiveis') return 1;
        if (b.label === 'Topicos disponiveis') return -1;
        if (a.label === 'Sem topico') return 1;
        if (b.label === 'Sem topico') return -1;
        return a.label.localeCompare(b.label, 'pt-BR');
      });

    const selectedSubjectNameMatches = (name: string) => (
      Boolean(name)
      && selectedSubjectValues.some((selectedSubject) => normalizePracticeText(selectedSubject) === normalizePracticeText(name))
    );

    const topicBelongsToSelectedSubject = (topic: any) => {
      const parentId = String(getPracticeParentId(topic));
      const rootSubjectId = String(getPracticeRootSubjectId(topic));

      if (selectedSubjectIds.size > 0) {
        return selectedSubjectIds.has(parentId) || selectedSubjectIds.has(rootSubjectId);
      }

      return selectedSubjectNameMatches(getPracticeRootSubjectName(topic));
    };

    const specificSubjectBelongsToSelectedSubject = (subject: any) => {
      const parentId = String(getPracticeParentId(subject));
      const rootSubjectId = String(getPracticeRootSubjectId(subject));

      if (selectedSubjectIds.size > 0 && selectedSubjectIds.has(rootSubjectId)) {
        return true;
      }

      const parentTopic = topicById.get(parentId);
      if (parentTopic) {
        return topicBelongsToSelectedSubject(parentTopic);
      }

      if (selectedSubjectIds.size > 0) {
        return selectedSubjectIds.has(parentId);
      }

      return selectedSubjectNameMatches(getPracticeRootSubjectName(subject));
    };

    subjectTopics
      .filter(topicBelongsToSelectedSubject)
      .forEach((topic: any) => {
        const topicName = getPracticeTaxonomyName(topic);
        const topicId = getPracticeTaxonomyId(topic);
        const childSubjects = specificSubjects
          .filter((subject: any) => String(getPracticeParentId(subject)) === topicId)
          .filter(specificSubjectBelongsToSelectedSubject);

        childSubjects
          .forEach((subject: any) => addOption(topicName, getPracticeTaxonomyName(subject)));

        if (childSubjects.length > 0) {
          selectableGroups.add(topicName);
        }

        if (childSubjects.length === 0 && specificSubjects.length === 0) {
          addOption('Topicos disponiveis', topicName, 'Topico filho da materia selecionada');
        }
      });

    if (hasStructuredKnowledgeTaxonomies) {
      return serializeTopicGroups();
    }

    questions
      .filter((question) => questionMatchesSubjects(question, selectedSubjectValues))
      .flatMap((question) => question.assuntos?.filter((item: any) => !item?.materia) || [])
      .forEach((item: any) => {
        const itemName = getPracticeTaxonomyName(item);
        const itemId = getPracticeTaxonomyId(item);
        const matchedSpecificSubject = specificSubjects.find((subject: any) => (
          (
            (itemId && getPracticeTaxonomyId(subject) === itemId)
            || getPracticeTaxonomyName(subject) === itemName
          )
          && specificSubjectBelongsToSelectedSubject(subject)
        ));
        const matchedTopic = subjectTopics.find((topic: any) => (
          (
            (itemId && getPracticeTaxonomyId(topic) === itemId)
            || getPracticeTaxonomyName(topic) === itemName
          )
          && topicBelongsToSelectedSubject(topic)
        ));
        const level = getPracticeTaxonomyLevel(matchedSpecificSubject || matchedTopic || item, taxonomies);

        if (level === 'assunto') {
          const assuntoCandidate = matchedSpecificSubject || item;
          const parentTopic = topicById.get(getPracticeParentId(assuntoCandidate));
          const hasSelectedParent = matchedSpecificSubject
            || specificSubjectBelongsToSelectedSubject(assuntoCandidate)
            || !hasStructuredKnowledgeTaxonomies;

          if (!hasSelectedParent) {
            return;
          }

          addOption(parentTopic ? getPracticeTaxonomyName(parentTopic) : 'Assuntos vinculados', itemName);
          return;
        }

        const topicCandidate = matchedTopic || item;
        const hasSelectedRoot = matchedTopic
          || topicBelongsToSelectedSubject(topicCandidate)
          || !hasStructuredKnowledgeTaxonomies;

        if (hasSelectedRoot) {
          addOption('Topicos disponiveis', itemName, 'Topico filho da materia selecionada');
        }
      });

    return serializeTopicGroups();
  }, [
    enemQuestions,
    isEnemPendingFocus,
    pendingFilters.subject,
    questions,
    systemSettings.taxonomies,
  ]);

  const uniqueYears = useMemo(() => {
    const yearSource = isEnemPendingFocus ? enemQuestions : questions;
    if (!isEnemPendingFocus && systemSettings.taxonomies?.years?.length) return systemSettings.taxonomies.years.map(String);
    return Array.from(new Set(yearSource.flatMap(q => q.anos || []).map(String).filter(Boolean))) as string[];
  }, [enemQuestions, isEnemPendingFocus, questions, systemSettings.taxonomies?.years]);

  const uniqueRoles = useMemo(() => {
    if (systemSettings.taxonomies?.roles?.length) return systemSettings.taxonomies.roles.map((t: any) => t.descricao || t['descrição'] || t.name);
    return Array.from(new Set(questions.flatMap(q => q.cargos?.map(c => (c as any).descricao || (c as any)['descrição'] || (c as any).name) || []).filter(Boolean))) as string[];
  }, [questions, systemSettings.taxonomies?.roles]);

  const uniqueModalities = useMemo(() => {
    if (systemSettings.taxonomies?.modalities?.length) return systemSettings.taxonomies.modalities;
    return ['Múltipla Escolha', 'Certo/Errado'];
  }, [systemSettings.taxonomies?.modalities]);

  const uniqueCareers = useMemo(() => {
    const baseCareers = systemSettings.taxonomies?.careers?.length
      ? systemSettings.taxonomies.careers.map((t: any) => normalizeCareerSelectorLabel(t.name))
      : Array.from(new Set(questions.flatMap(q => q.carreiras?.map(c => normalizeCareerSelectorLabel(c.nome)) || []).filter(Boolean))) as string[];

    return injectEnemFocusOption(baseCareers);
  }, [questions, systemSettings.taxonomies?.careers]);

  const careerOptionGroups = useMemo(() => buildSearchableOptionGroup('Focos', uniqueCareers), [uniqueCareers]);
  const agencyOptionGroups = useMemo(() => buildSearchableOptionGroup('Bancas', uniqueAgencies), [uniqueAgencies]);
  const yearOptionGroups = useMemo(() => buildSearchableOptionGroup('Anos', uniqueYears), [uniqueYears]);
  const roleOptionGroups = useMemo(() => buildSearchableOptionGroup('Cargos', uniqueRoles), [uniqueRoles]);

  // Labels amigaveis para os chips
  const filterLabels: Record<string, string> = {
    subject: 'Matéria',
    difficulty: 'Dificuldade',
    agency: 'Banca',
    organization: 'Órgão',
    year: 'Ano',
    level: 'Nível',
    topic: 'Assunto',
    role: 'Cargo',
    career: 'Foco',
    onlySaved: 'Salvas',
    hasTeacherComment: 'Com. Professor',
    hasDetailedComment: 'Análise detalhada',
    excludeCanceled: 'Ocultar Anuladas',
    excludeOutdated: 'Ocultar Desatualizadas',
    excludeAnswered: 'Ocultar Resolvidas'
  };

  return (
    <div ref={pageRootRef} className="space-y-5 px-3 pb-16 animate-fade-in sm:px-4 md:px-0 md:pb-12">
      {/* Back Button when viewing specific question */}
      {highlightedQuestionId && (
        <button
          onClick={() => setSearchParams({})}
          className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-400 sm:px-6 sm:py-3 sm:text-sm"
        >
          <ArrowLeft size={18} />
          Voltar para lista de questões
        </button>
      )}

      {/* Painel de Filtros Principal - Hidden when viewing specific question */}
      {!highlightedQuestionId && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 md:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-colors duration-300">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Pesquisar por palavra-chave no enunciado..."
                value={pendingFilters.keyword}
                onChange={e => handleFilterChange('keyword', e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-medium text-sm text-slate-900 dark:text-slate-100 transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setPendingFilters(DEFAULT_FILTERS);
                  setLastFetchedPage(1);
                }}
                  className="h-12 px-4 text-slate-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title="Limpar todos os filtros"
              >
                <RotateCcw size={20} />
              </button>
              <button
                onClick={applyFilters}
                disabled={isFiltering}
                className="h-11 sm:h-12 px-5 sm:px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2 whitespace-nowrap text-xs disabled:opacity-70 disabled:cursor-wait"
              >
                {isFiltering ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {isFiltering ? 'Filtrando...' : 'Filtrar'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <SearchableFilterSelect
              label="Foco"
              value={pendingFilters.career}
              onChange={(v: any) => handleFilterChange('career', v)}
              groups={careerOptionGroups}
            />
            <SearchableFilterSelect
              label="Materia"
              value={pendingFilters.subject}
              onChange={(v: any) => handleFilterChange('subject', v)}
              groups={subjectOptionGroups}
              helperText={isEnemPendingFocus ? 'No foco ENEM, a materia usa as areas oficiais de conhecimento.' : undefined}
            />
            <FilterSelect label="Dificuldade" value={pendingFilters.difficulty} onChange={(v: any) => handleFilterChange('difficulty', v)} options={Object.values(Difficulty)} />
            <SearchableFilterSelect
              label="Banca"
              value={pendingFilters.agency}
              onChange={(v: any) => handleFilterChange('agency', v)}
              groups={agencyOptionGroups}
              disabled={isEnemPendingFocus}
              helperText={isEnemPendingFocus ? 'Desativado para ENEM.' : undefined}
            />
            <FilterSelect label="Órgão" value={pendingFilters.organization} onChange={(v: any) => handleFilterChange('organization', v)} options={uniqueOrganizations} disabled={isEnemPendingFocus} helperText={isEnemPendingFocus ? 'Desativado para ENEM.' : undefined} />
            <SearchableFilterSelect
              label="Ano"
              value={pendingFilters.year}
              onChange={(v: any) => handleFilterChange('year', v)}
              groups={yearOptionGroups}
            />
            <FilterSelect label="Nível" value={pendingFilters.level} onChange={(v: any) => handleFilterChange('level', v)} options={['Superior', 'Médio', 'Fundamental']} disabled={isEnemPendingFocus} helperText={isEnemPendingFocus ? 'Desativado para ENEM.' : undefined} />
            <SearchableFilterSelect
              label="Assunto"
              value={pendingFilters.topic}
              onChange={(v: any) => handleFilterChange('topic', v)}
              groups={topicOptionGroups}
              disabled={!hasAnyFilterValue(pendingFilters.subject)}
            />
            <SearchableFilterSelect
              label="Cargo"
              value={pendingFilters.role}
              onChange={(v: any) => handleFilterChange('role', v)}
              groups={roleOptionGroups}
              disabled={isEnemPendingFocus}
              helperText={isEnemPendingFocus ? 'Desativado para ENEM.' : undefined}
            />
            <FilterSelect label="Modalidade" value={pendingFilters.modality} onChange={(v: any) => handleFilterChange('modality', v)} options={uniqueModalities} disabled={isEnemPendingFocus} helperText={isEnemPendingFocus ? 'Desativado para ENEM.' : undefined} />
          </div>

          {isEnemPendingFocus ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Mapa ENEM</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {ENEM_SUBJECT_AREA_OPTIONS.map((areaName) => (
                  <div key={areaName} className="rounded-xl border border-indigo-100 bg-white/90 p-3">
                    <p className="text-xs font-black text-slate-900">{areaName}</p>
                    <p className="mt-2 text-[10px] font-medium leading-5 text-slate-500">
                      {ENEM_SUBJECT_AREA_DESCRIPTIONS[areaName].join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Checkbox Filters */}
          <div className="flex flex-col gap-4 pt-2">
            {/* Group 1: Exclusion */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Excluir questões:</span>
              <div className="flex flex-wrap gap-3">
                <CheckboxFilter
                  label="Anuladas"
                  checked={pendingFilters.excludeCanceled}
                  onChange={(v: boolean) => handleFilterChange('excludeCanceled', v)}
                  icon={X}
                  colorClass="red"
                />
                <CheckboxFilter
                  label="Desatualizadas"
                  checked={pendingFilters.excludeOutdated}
                  onChange={(v: boolean) => handleFilterChange('excludeOutdated', v)}
                  icon={AlertTriangle}
                  colorClass="amber"
                />
                <CheckboxFilter
                  label="Resolvidas"
                  checked={pendingFilters.excludeAnswered}
                  onChange={(v: boolean) => handleFilterChange('excludeAnswered', v)}
                  icon={CheckCircle}
                  colorClass="indigo"
                />
              </div>
            </div>

            {/* Group 2: Inclusion/Features */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">Apenas questões com:</span>
              <div className="flex flex-wrap gap-3">
                <CheckboxFilter
                  label="Salvas"
                  checked={pendingFilters.onlySaved}
                  onChange={(v: boolean) => handleFilterChange('onlySaved', v)}
                  icon={BookmarkCheck}
                  colorClass="emerald"
                />
                <CheckboxFilter
                  label="Comentário do Professor"
                  checked={pendingFilters.hasTeacherComment}
                  onChange={(v: boolean) => handleFilterChange('hasTeacherComment', v)}
                  icon={GraduationCap}
                  colorClass="amber"
                />
                <CheckboxFilter
                    label="Análise detalhada"
                  checked={pendingFilters.hasDetailedComment}
                  onChange={(v: boolean) => handleFilterChange('hasDetailedComment', v)}
                  icon={Sparkles}
                  colorClass="indigo"
                />
              </div>
            </div>
          </div>

          {/* Visualização de Filtros Ativos e Resultados */}
          <div className="pt-4 border-t border-slate-50 dark:border-slate-800/50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mr-1">Filtros:</span>
              {Object.entries(pendingFilters).filter(([, value]) => isVisibleFilterValue(value)).length > 0 ? (
                Object.entries(pendingFilters).map(([key, value]) => {
                  if (!isVisibleFilterValue(value)) return null;
                  return (
                    <div key={key} className={`px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 animate-scale-in border ${key === 'hasTeacherComment' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' : key === 'hasDetailedComment' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
                      <span className="opacity-60">{filterLabels[key] || key}:</span>
                      <span>{value === true ? 'Sim' : serializeFilterValue(value)}</span>
                      <button onClick={() => clearFilter(key)} className="hover:opacity-70 rounded-full p-0.5 transition-colors">
                        <X size={10} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <span className="text-xs text-slate-300 font-medium italic">Nenhum filtro aplicado</span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-black text-[10px] uppercase tracking-wider">
                <CheckCircle size={14} />
                {formatQuestionCount(filteredQuestions.length)}
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                <button
                  onClick={() => setViewMode('card')}
                  className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all ${viewMode === 'card' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                >Foco</button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                >Lista</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AdBanner type="top" className="my-2" />

      <div className="w-full space-y-6">
        {viewMode === 'card' ? (
          filteredQuestions.length > 0 ? (
            <div className="relative min-h-[400px]">
              {isFiltering && (
                <div className="absolute inset-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center rounded-3xl transition-all animate-fade-in">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={40} />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Filtrando questões...</span>
                  </div>
                </div>
              )}
              <div ref={focusQuestionRef} className="scroll-mt-4 md:scroll-mt-6">
                <QuestionCard
                  key={`${filteredQuestions[currentQuestionIndex].id}-${filterTimestamp}`}
                  question={filteredQuestions[currentQuestionIndex]}
                  isHighlighted={!!highlightedQuestionId}
                  onAnswerSubmit={handleAnswer}
                  onReportError={reportError}
                  onGuestAction={(action) => {
                    const titles: Record<string, string> = {
                      answer: "Responda Já!",
                      save: "Salve para Depois",
                      comment: "Participe da Comunidade",
                      note: "Faça Anotações",
                      report: "Ajude a Melhorar"
                    };
                    const descriptions: Record<string, string> = {
                      answer: "Crie uma conta gratuita em segundos para salvar suas resoluções, ganhar XP e monitorar sua evolução.",
                      save: "Crie seu próprio banco de questões favoritas para revisar quando quiser.",
                      comment: "Para comentar e tirar dúvidas com outros estudantes, você precisa estar conectado.",
                      note: "Organize seus estudos com anotações pessoais em cada questão.",
                      report: "Para reportar erros, você precisa estar logado."
                    };
                    setAuthModalConfig({
                      title: titles[action] || "Identifique-se",
                      description: descriptions[action] || "Faça login para acessar este recurso."
                    });
                    setShowAuthModal(true);
                  }}
                  onAddComment={(qId, text, pId) => {
                    if (!currentUser) {
                      setAuthModalConfig({
                        title: "Participe da Comunidade",
                        description: "Para comentar e tirar dúvidas com outros estudantes, você precisa estar conectado."
                      });
                      setShowAuthModal(true);
                      return;
                    }
                    if (!currentUser.emailVerified) {
                      setAuthModalConfig({
                        title: "Confirme seu E-mail",
                        description: "Para comentar e tirar dúvidas na comunidade, você precisa confirmar seu e-mail."
                      });
                      setShowAuthModal(true);
                      return;
                    }
                    addComment(Number(qId), { id: `c-${Date.now()}`, userId: currentUser.id, userName: currentUser.name, text, date: 'Agora', likes: 0, replies: [] }, pId);
                  }}
                  onLikeComment={(qId, cId) => likeComment(Number(qId), cId)}
                  indexDisplay={currentQuestionIndex + 1}
                  existingAnswer={userAnswers.find(a => a.questionId === filteredQuestions[currentQuestionIndex].id)}
                  isAlreadyReported={reports.some(r => r.questionId === filteredQuestions[currentQuestionIndex].id && r.status === 'pending')}
                    userPlan={getEffectivePlanName(currentUser)}
                  existingNote={userNotes.find(n => String(n.questionId) === String(filteredQuestions[currentQuestionIndex].id))}
                  onSaveNote={(qId, text) => saveNote(Number(qId), text)}
                  onToggleSave={(id) => {
                    if (!currentUser) {
                      setAuthModalConfig({
                        title: "Salve para Depois",
                        description: "Crie seu próprio banco de questões favoritas para revisar quando quiser."
                      });
                      setShowAuthModal(true);
                      return;
                    }
                    toggleSavedQuestion(id);
                  }}
                  isSaved={currentUser?.savedQuestionIds?.includes(String(filteredQuestions[currentQuestionIndex].id)) || false}
                  currentUserId={currentUser?.id || ''}
                  currentUserName={currentUser?.name || 'Visitante'}
                />
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 px-0 sm:px-2">
                  <button
                    onClick={() => {
                      setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1));
                      scrollToFocusQuestion();
                    }}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-[10px] sm:text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-all shadow-sm"
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.3em]">Questão {currentQuestionIndex + 1} / {filteredQuestions.length}</span>
                  <button
                    onClick={() => {
                      setCurrentQuestionIndex(Math.min(filteredQuestions.length - 1, currentQuestionIndex + 1));
                      scrollToFocusQuestion();
                    }}
                    disabled={currentQuestionIndex === filteredQuestions.length - 1}
                    className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-bold text-[10px] sm:text-xs uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-lg shadow-slate-200 dark:shadow-none"
                  >
                    Próxima <ChevronRight size={16} />
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 p-10 sm:p-14 md:p-20 text-center space-y-4 transition-colors duration-300">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full w-fit mx-auto text-slate-300 dark:text-slate-600"><Search size={48} /></div>
              <h3 className="text-xl font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nenhuma questão encontrada</h3>
              <p className="text-sm text-slate-400 dark:text-slate-600 max-w-xs mx-auto mb-6">Tente ajustar seus filtros para encontrar o que procura.</p>
              <button
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setPendingFilters(DEFAULT_FILTERS);
                  setLastFetchedPage(1);
                }}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                Limpar Filtros
              </button>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {paginatedList.map((q, i) => (
              <QuestionCard
                key={`${q.id}-${filterTimestamp}`}
                question={q}
                isHighlighted={highlightedQuestionId === String(q.id)}
                indexDisplay={i + 1}
                onAnswerSubmit={handleAnswer}
                onReportError={reportError}
                onGuestAction={(action) => {
                  const titles: Record<string, string> = {
                    answer: "Responda Já!",
                    save: "Salve para Depois",
                    comment: "Participe da Comunidade",
                    note: "Faça Anotações",
                    report: "Ajude a Melhorar"
                  };
                  const descriptions: Record<string, string> = {
                    answer: "Crie uma conta gratuita em segundos para salvar suas resoluções, ganhar XP e monitorar sua evolução.",
                    save: "Crie seu próprio banco de questões favoritas para revisar quando quiser.",
                    comment: "Para comentar e tirar dúvidas com outros estudantes, você precisa estar conectado.",
                    note: "Organize seus estudos com anotações pessoais em cada questão.",
                    report: "Para reportar erros, você precisa estar logado."
                  };
                  setAuthModalConfig({
                    title: titles[action] || "Identifique-se",
                    description: descriptions[action] || "Faça login para acessar este recurso."
                  });
                  setShowAuthModal(true);
                }}
                onAddComment={(qId, text, pId) => {
                  if (!currentUser) {
                    setAuthModalConfig({
                      title: "Participe da Comunidade",
                      description: "Para comentar e tirar dúvidas com outros estudantes, você precisa estar conectado."
                    });
                    setShowAuthModal(true);
                    return;
                  }
                  addComment(Number(qId), { id: `c-${Date.now()}`, userId: currentUser.id, userName: currentUser.name, text, date: 'Agora', likes: 0, replies: [] }, pId);
                }}
                onLikeComment={(qId, cId) => likeComment(Number(qId), cId)}
                onSaveNote={(qId, text) => saveNote(Number(qId), text)}
                onToggleSave={(id) => {
                  if (!currentUser) {
                    setAuthModalConfig({
                      title: "Salve para Depois",
                      description: "Crie seu próprio banco de questões favoritas para revisar quando quiser."
                    });
                    setShowAuthModal(true);
                    return;
                  }
                  toggleSavedQuestion(id);
                }}
                isSaved={currentUser?.savedQuestionIds?.includes(String(q.id)) || false}
                existingAnswer={userAnswers.find(a => a.questionId === q.id)}
                existingNote={userNotes.find(n => String(n.questionId) === String(q.id))}
                isAlreadyReported={reports.some(r => r.questionId === q.id && r.status === 'pending')}
                    userPlan={getEffectivePlanName(currentUser)}
                currentUserId={currentUser?.id || ''}
                currentUserName={currentUser?.name || 'Visitante'}
              />
            ))}
            <div ref={loaderRef} className="h-10 flex items-center justify-center">
              {(visibleCount < filteredQuestions.length || filteredQuestions.length < totalQuestions) && <Loader2 className="animate-spin text-indigo-400" size={24} />}
            </div>
          </div>
        )}
      </div>


      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title={authModalConfig.title}
        description={authModalConfig.description}
      />

      <button
        type="button"
        onClick={handleBackToTop}
        aria-label="Voltar ao topo"
        className={`fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/95 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-700 shadow-lg shadow-indigo-200/60 transition-all duration-300 dark:border-indigo-900/40 dark:bg-slate-900/95 dark:text-indigo-300 dark:shadow-none sm:bottom-6 sm:right-6 sm:px-4 sm:text-[11px] ${showBackToTop ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}
      >
        <ArrowUp size={14} />
        Topo
      </button>
    </div >
  );
};

export default Practice;



