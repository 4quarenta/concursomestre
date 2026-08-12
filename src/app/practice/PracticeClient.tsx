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
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Difficulty } from '../../types';
import type { UserAnswer } from '../../types';
import { ChevronRight, ChevronLeft, ChevronDown, Search, RotateCcw, Loader2, X, BookmarkCheck, Check, CheckCircle, GraduationCap, Sparkles, AlertTriangle, ArrowLeft, ArrowUp } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import AdBanner from '../../components/shared/feedback/AdBanner';
import {
  getAccessPlanName,
  getBenefitPlanLabel,
  getBenefitRequiredPlan,
  getEffectivePlanName,
  getNextPlanForHigherUsageLimit,
  getPlanUsageLimitForPlanName,
  hasPlanBenefit,
  isPlanUsageUnlimitedForPlanName,
  type CanonicalPlanName,
} from '@services/plans/planAccess';
import { incrementDailyUsageCount, readDailyUsageCount } from '@services/plans/clientUsageQuota';
import { questionService } from '@services/questions';
import { reportsService } from '@services/reports';
import { commentService } from '@services/comments';
import { clientLog } from '@services/monitoring/clientLog';
import { notificationService } from '@services/notifications';
import {
  ENEM_FOCUS_NAME,
  ENEM_SUBJECT_AREA_DESCRIPTIONS,
  ENEM_SUBJECT_AREA_OPTIONS,
  getEnemSubjectAreasForQuestion,
  injectEnemFocusOption,
  isEnemQuestion,
  normalizeCareerSelectorLabel,
} from '@services/filters';
import type { Assunto, Banca, Cargo, ErrorReport, Orgao, PlanBenefitKey, QuestaoComentario, Question } from '@types';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { useTaxonomyActions } from '@/state/app-config/useTaxonomyActions';
import { useQuestionBankActions } from '@/state/question-bank/useQuestionBankActions';
import { useQuestionBankStore } from '@/state/question-bank/questionBankStore';
import { useUserProgressActions } from '@/state/user-progress/useUserProgressActions';
import { useUserProgressStore } from '@/state/user-progress/userProgressStore';
import { useAdminDataStore } from '@/state/admin-data/adminDataStore';
import type { PracticeInitialQuestionPage } from './practiceTypes';

const QuestionCard = dynamic(() => import('../questions/components/QuestionCard'), {
  loading: () => (
    <div
      aria-hidden="true"
      className="pointer-events-none min-h-72 animate-pulse rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    />
  ),
});
const AuthModal = dynamic(() => import('../../components/shared/overlays/AuthModal'), { ssr: false });
const UpgradeModal = dynamic(() => import('@/components/shared/overlays/UpgradeModal'), { ssr: false });

const PAGE_SIZE = 10;
const PRACTICE_PROGRESS_BOOTSTRAP_DELAY_MS = 3200;

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
  excludeCorrect: false,
  excludeWrong: false,
  onlyCorrect: false,
  onlyWrong: false,
};

type PracticeFilters = typeof DEFAULT_FILTERS;
type PracticeFilterKey = keyof PracticeFilters;
type PracticeFilterValue = PracticeFilters[PracticeFilterKey];
type PracticeTaxonomyLevel = 'topico' | 'assunto';

type PracticeCareerItem = {
  id?: number | string;
  nome?: string;
  name?: string;
};

type PracticeTaxonomyItem = Partial<Assunto & Banca & Cargo & Orgao> & {
  parentId?: number | string | null;
  parent_id?: number | string | null;
  rootSubjectId?: number | string | null;
  root_subject_id?: number | string | null;
  subjectId?: number | string | null;
  subject_id?: number | string | null;
  rootSubjectName?: string;
  root_subject_name?: string;
  subjectName?: string;
  subject_name?: string;
  materiaNome?: string;
  materia_nome?: string;
  taxonomyLevel?: string;
  taxonomy_level?: string;
  descrição?: string;
};

type PracticeTaxonomies = {
  agencies?: PracticeTaxonomyItem[];
  organizations?: PracticeTaxonomyItem[];
  subjects?: PracticeTaxonomyItem[];
  subjectTopics?: PracticeTaxonomyItem[];
  specificSubjects?: PracticeTaxonomyItem[];
  topics?: PracticeTaxonomyItem[];
  roles?: PracticeTaxonomyItem[];
  careers?: PracticeCareerItem[];
  modalities?: string[];
  years?: Array<string | number>;
};

type PracticeQuestion = Question & {
  carreiras?: PracticeCareerItem[];
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
const BOOLEAN_FILTER_KEYS = ['onlySaved', 'hasTeacherComment', 'hasDetailedComment', 'excludeCanceled', 'excludeOutdated', 'excludeAnswered', 'excludeCorrect', 'excludeWrong', 'onlyCorrect', 'onlyWrong'] as const;
const PRACTICE_FILTER_BENEFITS: Partial<Record<PracticeFilterKey, PlanBenefitKey>> = {
  keyword: 'practice.filter_keyword',
  subject: 'practice.filter_subject',
  difficulty: 'practice.filter_difficulty',
  agency: 'practice.filter_bank',
  organization: 'practice.filter_organization',
  year: 'practice.filter_year',
  level: 'practice.filter_level',
  topic: 'practice.filter_topic',
  role: 'practice.filter_role',
  modality: 'practice.filter_modality',
  onlySaved: 'practice.filter_saved',
  hasTeacherComment: 'practice.filter_teacher_comment',
  hasDetailedComment: 'practice.filter_detailed_analysis',
  excludeCorrect: 'practice.filter_answered_correct',
  excludeWrong: 'practice.filter_answered_wrong',
  onlyCorrect: 'practice.filter_answered_correct',
  onlyWrong: 'practice.filter_answered_wrong',
};

const PRACTICE_FILTER_FEATURE_LABELS: Partial<Record<PracticeFilterKey, string>> = {
  keyword: 'pesquisa por palavra-chave',
  subject: 'filtro por matéria',
  difficulty: 'filtro por dificuldade',
  agency: 'filtro por banca',
  organization: 'filtro por órgão',
  year: 'filtro por ano',
  level: 'filtro por nível',
  topic: 'filtro por assunto',
  role: 'filtro por cargo',
  modality: 'filtro por modalidade',
  onlySaved: 'questões salvas',
  hasTeacherComment: 'filtro com comentário do professor',
  hasDetailedComment: 'filtro com análise detalhada',
  excludeCorrect: 'filtro para ocultar questões que acertei',
  excludeWrong: 'filtro para ocultar questões que errei',
  onlyCorrect: 'filtro de questões que acertei',
  onlyWrong: 'filtro de questões que errei',
};

const isMultiFilterKey = (key: string): key is typeof MULTI_FILTER_KEYS[number] => (
  (MULTI_FILTER_KEYS as readonly string[]).includes(key)
);

const isBooleanFilterKey = (key: string): key is typeof BOOLEAN_FILTER_KEYS[number] => (
  (BOOLEAN_FILTER_KEYS as readonly string[]).includes(key)
);

const toFilterValues = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => item && item !== 'All');
  }

  const rawValue = String(value || '').trim();
  return rawValue && rawValue !== 'All' ? [rawValue] : [];
};

const hasAnyFilterValue = (value: unknown) => toFilterValues(value).length > 0;

const resetPracticeFilterValue = <K extends PracticeFilterKey>(key: K): PracticeFilters[K] => DEFAULT_FILTERS[key];

const sanitizePracticeFiltersForPlan = (
  nextFilters: PracticeFilters,
  canUseBenefit: (benefitKey: PlanBenefitKey) => boolean,
): PracticeFilters => {
  return (Object.keys(PRACTICE_FILTER_BENEFITS) as PracticeFilterKey[]).reduce((acc, key) => {
    const benefitKey = PRACTICE_FILTER_BENEFITS[key];
    if (benefitKey && !canUseBenefit(benefitKey)) {
      return {
        ...acc,
        [key]: resetPracticeFilterValue(key),
      };
    }

    return acc;
  }, nextFilters);
};

const filterHasValue = (value: unknown, option: string) => {
  const normalizedOption = normalizePracticeText(option);
  return toFilterValues(value).some((item) => normalizePracticeText(item) === normalizedOption);
};

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

const hasVisiblePracticeFilters = (filters: PracticeFilters) => Object.values(filters).some((value) => isVisibleFilterValue(value));

const formatQuestionCount = (count: number) => `${count} ${count === 1 ? 'Questão' : 'Questões'}`;

const serializePracticeQueryValue = (value: unknown) => toFilterValues(value).join(',');

const buildPracticeQuestionQueryParams = (filters: PracticeFilters) => {
  const params: Record<string, string | boolean> = {};

  if (filters.keyword.trim()) params.keyword = filters.keyword.trim();
  for (const key of MULTI_FILTER_KEYS) {
    const value = serializePracticeQueryValue(filters[key]);
    if (value) {
      params[key] = value;
    }
  }
  for (const key of BOOLEAN_FILTER_KEYS) {
    if (filters[key]) {
      params[key] = true;
    }
  }

  return params;
};

const readQuestionIdParams = (searchParams: Pick<URLSearchParams, 'get' | 'getAll'>) => {
  const values = ['questionIds', 'question_ids', 'ids'].flatMap((name) => {
    const repeatedValues = searchParams.getAll(name);
    const rawValues = repeatedValues.length > 0 ? repeatedValues : [searchParams.get(name) || ''];
    return rawValues.flatMap((item) => String(item || '').split(/[,\s;]+/));
  });

  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
};

const normalizePracticeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const getPracticeTaxonomyName = (item: PracticeTaxonomyItem | null | undefined) => String(
  item?.name || item?.nome || item?.descricao || item?.descrição || item?.['descrição'] || '',
).trim();

const getPracticeTaxonomyId = (item: PracticeTaxonomyItem | null | undefined) => String(item?.id ?? '').trim();

const getPracticeParentId = (item: PracticeTaxonomyItem | null | undefined) => String(
  item?.parentId
    ?? item?.parent_id
    ?? item?.assunto_raiz
    ?? item?.pai
    ?? '',
).trim();

const getPracticeRootSubjectId = (item: PracticeTaxonomyItem | null | undefined) => String(
  item?.rootSubjectId
    ?? item?.root_subject_id
    ?? item?.subjectId
    ?? item?.subject_id
    ?? '',
).trim();

const getPracticeRootSubjectName = (item: PracticeTaxonomyItem | null | undefined) => String(
  item?.rootSubjectName
    ?? item?.root_subject_name
    ?? item?.subjectName
    ?? item?.subject_name
    ?? item?.materiaNome
    ?? item?.materia_nome
    ?? '',
).trim();

const getPracticeTaxonomyLevel = (item: PracticeTaxonomyItem | null | undefined, taxonomies?: PracticeTaxonomies): PracticeTaxonomyLevel => {
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
  ].find((taxonomy) => (
    (itemId && String(taxonomy?.id) === itemId)
    || (itemName && getPracticeTaxonomyName(taxonomy) === itemName)
  ));

  const foundLevel = normalizePracticeText(found?.taxonomyLevel || found?.taxonomy_level);
  if (foundLevel === 'topico' || foundLevel === 'assunto') {
    return foundLevel;
  }

  return found && getPracticeParentId(found) ? 'assunto' : 'topico';
};

const questionHasSubject = (question: Question, subjectName: string) => {
  if (subjectName === 'All') return true;
  return (question?.assuntos || []).some((item) => Boolean(item?.materia) && getPracticeTaxonomyName(item) === subjectName);
};

const questionMatchesSubjects = (question: Question, subjects: unknown) => (
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
  onDisabledClick,
  multiple = true,
  variant = 'default',
  popoverAlign = 'auto',
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
  onDisabledClick?: () => void;
  multiple?: boolean;
  variant?: 'default' | 'taxonomy-tree';
  popoverAlign?: 'auto' | 'start' | 'end';
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [resolvedPopoverAlign, setResolvedPopoverAlign] = useState<'start' | 'end'>('start');
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

  const openMenu = () => {
    if (popoverAlign !== 'auto') {
      setResolvedPopoverAlign(popoverAlign);
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      const panelWidth = Math.min(544, window.innerWidth - 32);
      setResolvedPopoverAlign(rect && rect.left + panelWidth > window.innerWidth - 16 ? 'end' : 'start');
    }
    setIsOpen(true);
  };

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
        aria-disabled={disabled}
        onClick={() => {
          if (disabled) {
            onDisabledClick?.();
            return;
          }
          if (isOpen) {
            setIsOpen(false);
          } else {
            openMenu();
          }
        }}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm font-medium outline-none transition-all ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-500' : 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-800'}`}
      >
        <span className="min-w-0 flex-1 truncate">{disabled ? (disabledText || selectedLabel) : selectedLabel}</span>
        {!disabled && multiple && selectedValues.length > 0 ? (
          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-black tabular-nums text-white">
            {selectedValues.length}
          </span>
        ) : null}
        <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {helperText ? (
        <p className="px-1 text-[10px] font-medium leading-4 text-slate-400 dark:text-slate-500">{helperText}</p>
      ) : null}

      {isOpen && !disabled ? (
        <div className={`absolute top-full z-50 mt-2 w-[min(34rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/40 ${resolvedPopoverAlign === 'end' ? 'right-0' : 'left-0'}`}>
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

          <div className="max-h-[min(32rem,60vh)] overflow-y-auto py-2">
            <button
              type="button"
              onClick={() => handleSelect('All')}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${selectedValues.length === 0 ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700'}`}>
                {selectedValues.length === 0 ? <Check size={11} /> : null}
              </span>
              {placeholder}
            </button>

            {filteredGroups.length > 0 ? filteredGroups.map((group) => (
              <div key={group.label} className={variant === 'taxonomy-tree' ? 'px-2 py-1.5' : 'py-1'}>
                {group.selectable ? (
                  <button
                    type="button"
                    onClick={() => handleGroupSelect(group)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${variant === 'taxonomy-tree' ? 'text-sm font-bold tracking-normal' : 'text-[10px] font-black uppercase tracking-[0.18em]'} ${
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
                  <p className={`px-3 py-2 text-slate-400 dark:text-slate-500 ${variant === 'taxonomy-tree' ? 'text-sm font-bold tracking-normal text-slate-700 dark:text-slate-200' : 'text-[10px] font-black uppercase tracking-[0.18em]'}`}>{group.label}</p>
                )}
                <div className={variant === 'taxonomy-tree' && group.options.length > 0 ? 'ml-5 border-l border-slate-200 py-0.5 dark:border-slate-700' : ''}>
                  {group.options.map((option) => (
                    <button
                      key={`${group.label}-${option.value}`}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${variant === 'taxonomy-tree' ? 'relative rounded-lg before:absolute before:left-0 before:top-1/2 before:h-px before:w-3 before:bg-slate-200 before:content-[\'\'] dark:before:bg-slate-700' : ''} ${selectedValues.includes(option.value) ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selectedValues.includes(option.value) ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700'}`}>
                        {selectedValues.includes(option.value) ? <Check size={11} /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block break-normal font-semibold leading-5">{option.label}</span>
                        {option.helper ? <span className="mt-0.5 block text-[10px] font-medium leading-4 text-slate-400 dark:text-slate-500">{option.helper}</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
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
  onDisabledClick?: () => void;
};

const FilterSelect = ({ label, value, onChange, options, disabled = false, helperText, onDisabledClick }: FilterSelectProps) => (
  <SearchableFilterSelect
    label={label}
    value={value}
    onChange={onChange}
    groups={buildSearchableOptionGroup(String(label), (options || []).map(String))}
    disabled={disabled}
    helperText={helperText}
    onDisabledClick={onDisabledClick}
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
  disabled?: boolean;
  disabledTitle?: string;
  onDisabledClick?: () => void;
};

const CheckboxFilter = ({
  label,
  checked,
  onChange,
  icon: Icon,
  colorClass = 'indigo',
  disabled = false,
  disabledTitle,
  onDisabledClick,
}: CheckboxFilterProps) => {
  const tone = CHECKBOX_FILTER_TONE_CLASSES[colorClass] || CHECKBOX_FILTER_TONE_CLASSES.indigo;

  return (
    <label
      title={disabled ? disabledTitle : undefined}
      onClick={(event) => {
        if (!disabled) return;
        event.preventDefault();
        onDisabledClick?.();
      }}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 transition-all select-none ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'} ${checked ? tone.checked : tone.unchecked}`}
    >
      <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? tone.boxChecked : tone.boxUnchecked}`}>
        {checked && <Check size={10} className="text-white" />}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {Icon && <Icon size={14} className="ml-1 opacity-50" />}
      <input type="checkbox" className="hidden" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
};

const sanitizePracticeFiltersForFocus = (nextFilters: PracticeFilters): PracticeFilters => {
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

type PracticeProps = {
  initialQuestionPage?: PracticeInitialQuestionPage;
};

const Practice: React.FC<PracticeProps> = ({ initialQuestionPage }) => {
  const { currentUser, isLoading: authIsLoading, toggleSavedQuestion, updateUser } = useAuth();
  const { addToast } = useToast();
  const systemSettings = useAppConfigStore((store) => store.systemSettings);
  const canUsePracticeBenefit = useCallback(
    (benefitKey: PlanBenefitKey) => hasPlanBenefit(currentUser, benefitKey, systemSettings.planEntitlements),
    [currentUser, systemSettings.planEntitlements],
  );
  const isPracticeFilterLocked = useCallback((key: PracticeFilterKey) => {
    const benefitKey = PRACTICE_FILTER_BENEFITS[key];
    return Boolean(benefitKey && !canUsePracticeBenefit(benefitKey));
  }, [canUsePracticeBenefit]);
  const getLockedFilterHelperText = useCallback((key: PracticeFilterKey, fallback?: string) => {
    const benefitKey = PRACTICE_FILTER_BENEFITS[key];
    if (!benefitKey || !isPracticeFilterLocked(key)) {
      return fallback;
    }

    return `Disponível no ${getBenefitPlanLabel(benefitKey, systemSettings.planEntitlements)}.`;
  }, [isPracticeFilterLocked, systemSettings.planEntitlements]);
  const sanitizeFiltersForCurrentPlan = useCallback(
    (nextFilters: PracticeFilters) => sanitizePracticeFiltersForPlan(nextFilters, canUsePracticeBenefit),
    [canUsePracticeBenefit],
  );
  const reports = useAdminDataStore((store) => store.reports);
  const addLocalReport = useAdminDataStore((store) => store.addReport);
  const { ensureTaxonomiesLoaded } = useTaxonomyActions();
  const {
    questions: storedQuestions,
    totalQuestions: storedTotalQuestions,
    hasMoreQuestions: storedHasMoreQuestions,
    isQuestionsLoaded,
    ensureQuestionsLoaded,
    fetchMoreQuestions,
  } = useQuestionBankActions();
  const questions = isQuestionsLoaded ? storedQuestions : (initialQuestionPage?.questions || storedQuestions);
  const totalQuestions = isQuestionsLoaded
    ? storedTotalQuestions
    : (initialQuestionPage?.total || storedTotalQuestions || questions.length);
  const hasMoreQuestions = isQuestionsLoaded
    ? storedHasMoreQuestions
    : Boolean(initialQuestionPage?.pageInfo.hasMore);
  const replaceQuestionBank = useQuestionBankStore((store) => store.replaceQuestionBank);
  const applyQuestionAnswer = useQuestionBankStore((store) => store.applyAnswer);
  const addQuestionComment = useQuestionBankStore((store) => store.addQuestionComment);
  const likeQuestionComment = useQuestionBankStore((store) => store.likeQuestionComment);
  const {
    userAnswers,
    userNotes,
    saveNote,
    ensureUserProgressLoaded,
  } = useUserProgressActions();
  const upsertUserAnswer = useUserProgressStore((store) => store.upsertUserAnswer);
  const lastCommentTimeRef = useRef<number>(0);
  const currentUserId = currentUser?.id ?? null;
  const currentUserName = currentUser?.name ?? '';
  const currentAccessPlanName = getAccessPlanName(currentUser);
  const commentsPerDayLimit = getPlanUsageLimitForPlanName(
    currentAccessPlanName,
    'comments_per_day',
    systemSettings.planUsageLimits,
  );
  const commentsPerDayUnlimited = isPlanUsageUnlimitedForPlanName(
    currentAccessPlanName,
    'comments_per_day',
    systemSettings.planUsageLimits,
  );
  const hasReachedDailyCommentLimit = useCallback(() => {
    if (commentsPerDayUnlimited || commentsPerDayLimit === null) {
      return false;
    }

    return readDailyUsageCount(currentUserId, 'comments_per_day') >= commentsPerDayLimit;
  }, [commentsPerDayLimit, commentsPerDayUnlimited, currentUserId]);
  const showCommentLimitToast = useCallback(() => {
    const nextPlan = getNextPlanForHigherUsageLimit(currentAccessPlanName, 'comments_per_day', systemSettings.planUsageLimits);
    addToast(`Você atingiu o limite diário de comentários. Mais comentários ficam disponíveis no Plano ${nextPlan} ou superior.`, 'warning');
  }, [addToast, currentAccessPlanName, systemSettings.planUsageLimits]);

  const dispatchAnswer = useCallback(async (answer: Omit<UserAnswer, 'isCorrect' | 'correctOptionIndex'>) => {
    if (!currentUserId) {
      throw new Error('Sessão necessária para registrar a resposta.');
    }

    const result = await questionService.submitUserAnswer(answer);
    if (!result.answer) {
      throw new Error(result.message || 'O servidor não devolveu a correção da resposta.');
    }

    const canonicalAnswer: UserAnswer = {
      ...answer,
      selectedOptionIndex: result.answer.selectedOptionIndex,
      correctOptionIndex: result.answer.correctOptionIndex,
      isCorrect: result.answer.isCorrect,
    };
    applyQuestionAnswer(canonicalAnswer.questionId, canonicalAnswer.isCorrect);
    upsertUserAnswer(canonicalAnswer);

    const progressPatch = {
      ...(result.newXp !== undefined ? { xp: result.newXp } : {}),
      ...(result.newLevel !== undefined ? { level: result.newLevel } : {}),
    };
    if (Object.keys(progressPatch).length > 0) {
      void updateUser(progressPatch);
    }

    return canonicalAnswer;
  }, [applyQuestionAnswer, currentUserId, updateUser, upsertUserAnswer]);

  const reportError = useCallback((report: Omit<ErrorReport, 'id' | 'status' | 'timestamp'>) => {
    const duplicate = reports.find((currentReport) => (
      currentReport.userName === report.userName
      && currentReport.status === 'pending'
      && (
        (currentReport.targetType === 'question' && report.targetType === 'question' && currentReport.questionId === report.questionId)
        || (currentReport.targetType === 'material' && report.targetType === 'material' && currentReport.materialId === report.materialId)
        || (currentReport.targetType === 'comment' && report.targetType === 'comment' && currentReport.commentId === report.commentId)
      )
    ));

    if (duplicate) {
      addToast('Já existe uma denúncia pendente para este item.', 'warning');
      return;
    }

    if (!currentUserId) {
      addToast('Faça login para enviar uma denúncia.', 'warning');
      return;
    }

    const targetId = report.targetType === 'question'
      ? report.questionId
      : report.targetType === 'material'
        ? report.materialId
        : report.commentId;

    if (!targetId) {
      addToast('Alvo da denúncia inválido.', 'error');
      return;
    }

    void reportsService.createReport({
      reporterId: currentUserId,
      targetType: report.targetType,
      targetId,
      reason: report.reason,
      details: report.details,
      evidenceUrl: report.evidenceUrl,
    }).then((result) => {
      if (result.duplicate) {
        addToast(result.message || 'Já existe uma denúncia pendente para este item.', 'warning');
        return;
      }

      if (result.newXp !== undefined || result.newLevel !== undefined) {
        void updateUser({
          ...(result.newXp !== undefined ? { xp: result.newXp } : {}),
          ...(result.newLevel !== undefined ? { level: result.newLevel } : {}),
        });
      }

      const reportId = result.id || `rep-${Date.now()}`;
      addLocalReport({
        ...report,
        userId: currentUserId,
        id: reportId,
        status: 'pending',
        timestamp: Date.now(),
      });

      void notificationService.sendNotification(
        'admin',
        'Nova denúncia',
        `O usuário ${report.userName} reportou um problema.`,
        'warning',
        'moderation',
        undefined,
        undefined,
        'report_received',
      );

      addToast(
        result.xpGain
          ? `${result.message || 'Denúncia enviada com sucesso!'} +${result.xpGain} XP.`
          : result.message || 'Denúncia enviada com sucesso!',
        'success',
      );
    }).catch((error) => {
      clientLog.warn('Failed to create report:', error);
      addToast((error as Error).message || 'Erro ao enviar denúncia.', 'error');
    });
  }, [addLocalReport, addToast, currentUserId, reports, updateUser]);

  const addComment = useCallback((questionId: number, comment: QuestaoComentario, parentId?: string) => {
    const now = Date.now();
    if (now - lastCommentTimeRef.current < 5000) {
      addToast('Aguarde alguns segundos antes de comentar novamente.', 'warning');
      return;
    }
    if (hasReachedDailyCommentLimit()) {
      showCommentLimitToast();
      return;
    }
    lastCommentTimeRef.current = now;

    commentService.addComment({
      questionId: String(questionId),
      content: comment.text,
      userId: currentUserId || comment.userId,
      userName: currentUserName || comment.userName,
      userAvatar: currentUser?.photoUrl,
      userPlan: currentUser?.planDisplayName || currentUser?.plan,
      userRole: currentUser?.role,
      parentId,
      targetType: 'question',
    }).then((result) => {
      if (result.comment) {
        addQuestionComment(questionId, result.comment, parentId);
      }

      if (result.requiresModeration) {
        void notificationService.sendNotification(
          'admin',
          'Comentário aguardando moderação',
          `${currentUserName || comment.userName || 'Usuário'} enviou comentário na questão #${questionId}.`,
          'warning',
          'moderation',
          undefined,
          undefined,
          'comment_pending_admin',
        );
      }

      if (result.newXp !== undefined || result.newLevel !== undefined) {
        void updateUser({
          ...(result.newXp !== undefined ? { xp: result.newXp } : {}),
          ...(result.newLevel !== undefined ? { level: result.newLevel } : {}),
        });
      }

      if (result.xpGain) {
        addToast(`Comentário registrado. +${result.xpGain} XP.`, 'success');
      }
      incrementDailyUsageCount(currentUserId, 'comments_per_day');
    }).catch((error) => {
      clientLog.warn('Failed to save comment:', error);
      addToast((error as Error).message || 'Erro de conexão ao salvar comentário.', 'error');
    });
  }, [
    addQuestionComment,
    addToast,
    currentUser?.photoUrl,
    currentUser?.plan,
    currentUser?.planDisplayName,
    currentUserId,
    currentUserName,
    hasReachedDailyCommentLimit,
    showCommentLimitToast,
    updateUser,
  ]);

  const likeComment = useCallback((questionId: number, commentId: string) => {
    likeQuestionComment(questionId, commentId);

    if (!currentUserId) {
      addToast('Faça login para curtir.', 'warning');
      return Promise.resolve();
    }

    return commentService.likeComment(commentId, currentUserId)
      .then((result) => {
        if (result.newXp !== undefined || result.newLevel !== undefined) {
          void updateUser({
            ...(result.newXp !== undefined ? { xp: result.newXp } : {}),
            ...(result.newLevel !== undefined ? { level: result.newLevel } : {}),
          });
        }
      })
      .catch((error) => {
        clientLog.warn('Failed to save like:', error);
        addToast((error as Error).message || 'Erro de conexão ao curtir comentário.', 'error');
      });
  }, [addToast, currentUserId, likeQuestionComment, updateUser]);

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
  const scopedQuestionIds = useMemo(() => readQuestionIdParams(searchParams), [searchParams]);
  const scopedQuestionIdSet = useMemo(() => new Set(scopedQuestionIds), [scopedQuestionIds]);

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

    const parsedFilters: PracticeFilters = {
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
      excludeCorrect: searchParams.get('excludeCorrect') === 'true',
      excludeWrong: searchParams.get('excludeWrong') === 'true',
      onlyCorrect: searchParams.get('onlyCorrect') === 'true',
      onlyWrong: searchParams.get('onlyWrong') === 'true',
    };

    return sanitizeFiltersForCurrentPlan(parsedFilters);
  }, [sanitizeFiltersForCurrentPlan, searchParams]);

  const [filters, setFilters] = useState<PracticeFilters>(() => sanitizePracticeFiltersForFocus(initialFilters));
  const [pendingFilters, setPendingFilters] = useState<PracticeFilters>(() => sanitizePracticeFiltersForFocus(initialFilters)); // State for UI selection before submit
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterTimestamp, setFilterTimestamp] = useState(0); // Force reset on filter
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState({ title: '', description: '' });
  const [lockedFilterModal, setLockedFilterModal] = useState<{
    featureName: string;
    requiredPlan: CanonicalPlanName;
  } | null>(null);
  const [lastFetchedPage, setLastFetchedPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState('');
  const [savedQuestionOverrides, setSavedQuestionOverrides] = useState<Record<string, boolean>>({});
  const hasBootstrappedQuestionsRef = useRef('');
  const bootstrapRequestIdRef = useRef(0);
  const hasHydratedInitialPageRef = useRef(false);
  const hasAppliedPreferredViewRef = useRef(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loadMoreRequestRef = useRef(false);
  const pageRootRef = useRef<HTMLDivElement>(null);
  const focusQuestionRef = useRef<HTMLDivElement>(null);
  const scrollTargetRef = useRef<HTMLElement | Window | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const resolveQuestionSavedState = useCallback((question: Question): boolean => {
    const questionId = String(question.id);
    if (Object.prototype.hasOwnProperty.call(savedQuestionOverrides, questionId)) {
      return savedQuestionOverrides[questionId];
    }

    return Boolean(
      question.isSaved
      || currentUser?.savedQuestionIds?.includes(questionId),
    );
  }, [currentUser?.savedQuestionIds, savedQuestionOverrides]);

  const handleToggleQuestionSave = useCallback(async (question: Question): Promise<void> => {
    if (!currentUser) {
      setAuthModalConfig({
        title: 'Salve para Depois',
        description: 'Crie seu próprio banco de questões favoritas para revisar quando quiser.',
      });
      setShowAuthModal(true);
      return;
    }

    const questionId = String(question.id);
    const previousSavedState = resolveQuestionSavedState(question);
    const desiredSavedState = !previousSavedState;
    setSavedQuestionOverrides((current) => ({ ...current, [questionId]: desiredSavedState }));

    const succeeded = await toggleSavedQuestion(questionId, desiredSavedState);
    if (!succeeded) {
      setSavedQuestionOverrides((current) => ({ ...current, [questionId]: previousSavedState }));
    }
  }, [currentUser, resolveQuestionSavedState, toggleSavedQuestion]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFilters((currentFilters) => sanitizeFiltersForCurrentPlan(currentFilters));
      setPendingFilters((currentFilters) => sanitizeFiltersForCurrentPlan(currentFilters));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [sanitizeFiltersForCurrentPlan]);

  useEffect(() => {
    if (!currentUser?.id || hasAppliedPreferredViewRef.current) {
      return;
    }

    const preferredView = currentUser.preferences?.defaultPracticeView;
    if (preferredView === 'list' || preferredView === 'card') {
      hasAppliedPreferredViewRef.current = true;
      const frameId = window.requestAnimationFrame(() => setViewMode(preferredView));
      return () => window.cancelAnimationFrame(frameId);
    }
  }, [currentUser?.id, currentUser?.preferences?.defaultPracticeView]);

  const handleOpenQuestionNote = useCallback(async (questionId: string) => {
    if (!currentUser?.id) {
      setAuthModalConfig({
        title: "Faça Anotações",
        description: "Organize seus estudos com anotações pessoais em cada questão.",
      });
      setShowAuthModal(true);
      return;
    }

    if (!questionId) {
      return;
    }

    await ensureUserProgressLoaded(false, {
      includeAnswers: false,
      includeNotes: true,
      includeComments: false,
    });
  }, [currentUser?.id, ensureUserProgressLoaded]);

  useEffect(() => {
    hasBootstrappedQuestionsRef.current = '';
  }, [currentUser?.id]);

  const sanitizeFiltersForFocus = sanitizePracticeFiltersForFocus;

  const isEnemPendingFocus = filterHasValue(pendingFilters.career, ENEM_FOCUS_NAME);
  const practiceTaxonomies = useMemo<PracticeTaxonomies>(
    () => (systemSettings.taxonomies as unknown as PracticeTaxonomies | undefined) || {},
    [systemSettings.taxonomies],
  );

  const questionQueryParams = useMemo(() => ({
    ...buildPracticeQuestionQueryParams(filters),
    ...(scopedQuestionIds.length > 0 ? { questionIds: scopedQuestionIds.join(',') } : {}),
  }), [filters, scopedQuestionIds]);
  const questionQueryKey = useMemo(() => JSON.stringify(questionQueryParams), [questionQueryParams]);
  const questionBootstrapKey = useMemo(
    () => `${currentUser?.id || 'guest'}:${currentUser?.role || 'guest'}:${questionQueryKey}`,
    [currentUser?.id, currentUser?.role, questionQueryKey],
  );
  useEffect(() => {
    setLoadMoreError('');
  }, [questionBootstrapKey]);
  const filteredQuestions = useMemo(() => {
    let filtered = questions.filter(q => {
      const enemQuestion = isEnemQuestion(q);
      const enemSubjectAreas = getEnemSubjectAreasForQuestion(q);
      const selectedSubjects = toFilterValues(filters.subject);
      const selectedCareers = toFilterValues(filters.career);
      const isEnemFocus = filterHasValue(selectedCareers, ENEM_FOCUS_NAME);
      // Taxonomy, editorial, publication and server-supported state filters
      // are authoritative in the API response. Reapplying them in the client
      // can discard valid rows while a newly fetched page is being reconciled
      // with the store. ENEM is the only local predicate because it is a
      // virtual focus assembled from multiple canonical taxonomies.
      const applyLocalServerPredicates = isEnemFocus;
      const matchSubject = !applyLocalServerPredicates || selectedSubjects.length === 0
        || (isEnemFocus
          ? selectedSubjects.some((subjectName) => enemSubjectAreas.includes(subjectName as (typeof ENEM_SUBJECT_AREA_OPTIONS)[number]))
          : questionMatchesSubjects(q, selectedSubjects));
      
      const difficultyMap: Record<string, number> = {
        'Muito Fácil': 1,
        'Fácil': 2,
        'Médio': 3,
        'Difícil': 4,
        'Muito Difícil': 5
      };
      
      const matchDifficulty = !applyLocalServerPredicates || filterMatchesAny(filters.difficulty, (difficulty) => q.dificuldade === difficultyMap[difficulty]);
      const matchAgency = !applyLocalServerPredicates || isEnemFocus || filterMatchesAny(filters.agency, (agency) => Boolean(q.bancas?.some(b => b.sigla === agency || b.nome === agency)));
      const matchOrganization = !applyLocalServerPredicates || isEnemFocus || filterMatchesAny(filters.organization, (organization) => Boolean(q.orgaos?.some(o => o.sigla === organization || o.nome === organization)));
      const matchYear = !applyLocalServerPredicates || filterMatchesAny(filters.year, (year) => Boolean(q.anos?.some(y => String(y) === year)));
      const matchLevel = !applyLocalServerPredicates || isEnemFocus || filterMatchesAny(filters.level, (level) => q.level === level);
      const matchTopic = !applyLocalServerPredicates || filterMatchesAny(filters.topic, (topic) => Boolean(q.assuntos?.some(a => getPracticeTaxonomyName(a) === topic)));
      const selectedNonEnemCareers = selectedCareers.filter((career) => !filterHasValue([career], ENEM_FOCUS_NAME));
      const matchRoleMulti = !applyLocalServerPredicates || isEnemFocus || filterMatchesAny(filters.role, (role) => Boolean(q.cargos?.some((cargo) => getPracticeTaxonomyName(cargo) === role)));
      const matchCareerMulti = !applyLocalServerPredicates || selectedCareers.length === 0
        || (isEnemFocus && enemQuestion)
        || q.carreiras?.some(c => selectedNonEnemCareers.includes(normalizeCareerSelectorLabel(c?.nome)));
      const matchModality = !applyLocalServerPredicates || isEnemFocus || filterMatchesAny(filters.modality, (modality) => q.tipo === (modality === 'Certo/Errado' ? 'certo ou errado' : 'multipla escolha'));
      const matchKeyword = !applyLocalServerPredicates || !filters.keyword || (q.enunciado_clean || q.enunciado || '').toLowerCase().includes(filters.keyword.toLowerCase());
      const matchScopedQuestion = !applyLocalServerPredicates || scopedQuestionIdSet.size === 0
        || scopedQuestionIdSet.has(String(q.id || ''))
        || scopedQuestionIdSet.has(String(q.hashId || ''))
        || scopedQuestionIdSet.has(String(q.hash || ''));
      const matchSaved = !applyLocalServerPredicates || !filters.onlySaved || currentUser?.savedQuestionIds.includes(String(q.id));

      const matchTeacher = !applyLocalServerPredicates || !filters.hasTeacherComment || !!q.hasTeacherComment || !!q.teacherComment;
      const matchDetailed = !applyLocalServerPredicates || !filters.hasDetailedComment || !!q.hasDetailedComment || !!q.detailedComment;

      const matchCanceled = !applyLocalServerPredicates || !(q.anulada || q.isCanceled) || !filters.excludeCanceled;
      const matchOutdated = !applyLocalServerPredicates || !(q.desatualizada || q.isOutdated) || !filters.excludeOutdated;
      const previousAnswer = userAnswers.find(a => Number(a.questionId) === Number(q.id));
      const matchExcludeAnswered = !applyLocalServerPredicates || !filters.excludeAnswered || !previousAnswer;
      const matchExcludeCorrect = !filters.excludeCorrect || previousAnswer?.isCorrect !== true;
      const matchExcludeWrong = !filters.excludeWrong || previousAnswer?.isCorrect !== false;
      const matchOnlyCorrect = !filters.onlyCorrect || previousAnswer?.isCorrect === true;
      const matchOnlyWrong = !filters.onlyWrong || previousAnswer?.isCorrect === false;

      return matchScopedQuestion && matchSubject && matchDifficulty && matchKeyword && matchAgency && matchOrganization && matchYear && matchLevel && matchTopic && matchRoleMulti && matchCareerMulti && matchModality && matchSaved && matchTeacher && matchDetailed && matchCanceled && matchOutdated && matchExcludeAnswered && matchExcludeCorrect && matchExcludeWrong && matchOnlyCorrect && matchOnlyWrong;
    });

    if (highlightedQuestionId) {
      filtered = filtered.filter(q => String(q.id) === highlightedQuestionId);
    }

    if (!highlightedQuestionId && scopedQuestionIdSet.size === 0 && filtered.length === 0 && questions.length > 0 && !hasVisiblePracticeFilters(filters)) {
      return questions;
    }

    return filtered;
  }, [filters, questions, currentUser?.savedQuestionIds, userAnswers, highlightedQuestionId, scopedQuestionIdSet]);

  const hasActiveFilters = useMemo(() => hasVisiblePracticeFilters(filters) || scopedQuestionIds.length > 0, [filters, scopedQuestionIds.length]);

  const resolvedQuestions = useMemo(() => {
    if (highlightedQuestionId) {
      return filteredQuestions;
    }

    if (!hasActiveFilters && filteredQuestions.length === 0 && questions.length > 0) {
      return questions;
    }

    return filteredQuestions;
  }, [filteredQuestions, hasActiveFilters, highlightedQuestionId, questions]);

  const displayedQuestionTotal = useMemo(() => {
    if (scopedQuestionIds.length > 0) {
      return resolvedQuestions.length;
    }

    if (!highlightedQuestionId) {
      return totalQuestions || resolvedQuestions.length;
    }

    return resolvedQuestions.length;
  }, [highlightedQuestionId, resolvedQuestions.length, scopedQuestionIds.length, totalQuestions]);

  const loadNextPage = useCallback(async () => {
    if (loadMoreRequestRef.current || !hasMoreQuestions) return;

    loadMoreRequestRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError('');
    try {
      const nextPage = lastFetchedPage + 1;
      const loadedCount = await fetchMoreQuestions(nextPage, questionQueryParams);
      if (loadedCount > 0) {
        setLastFetchedPage(nextPage);
        setVisibleCount((current) => current + PAGE_SIZE);
      }
    } catch (error) {
      clientLog.warn('Failed to load the next practice page', error);
      setLoadMoreError('Não foi possível carregar mais questões.');
    } finally {
      loadMoreRequestRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchMoreQuestions, hasMoreQuestions, lastFetchedPage, questionQueryParams]);

  const paginatedList = useMemo(() => resolvedQuestions.slice(0, visibleCount), [resolvedQuestions, visibleCount]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (viewMode === 'list') {
            if (visibleCount < resolvedQuestions.length) {
              setVisibleCount(prev => prev + PAGE_SIZE);
            } else if (hasMoreQuestions && !loadMoreError) {
              // Trigger backend fetch for more
              void loadNextPage();
            }
        }
      }
    }, { threshold: 0.1 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMoreQuestions, loadMoreError, loadNextPage, resolvedQuestions.length, viewMode, visibleCount]);

  // Load more when reaching end of cards in focus mode
  useEffect(() => {
    if (viewMode !== 'card' || currentQuestionIndex < resolvedQuestions.length - 1 || !hasMoreQuestions) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      void loadNextPage();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentQuestionIndex, hasMoreQuestions, loadNextPage, resolvedQuestions.length, viewMode]);

  useEffect(() => {
    if (currentQuestionIndex < resolvedQuestions.length) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setCurrentQuestionIndex(resolvedQuestions.length > 0 ? Math.max(0, resolvedQuestions.length - 1) : 0);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentQuestionIndex, resolvedQuestions.length]);

  useEffect(() => {
    void ensureTaxonomiesLoaded(false, 'practice');
  }, [ensureTaxonomiesLoaded]);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    const shouldLoadAnswersImmediately = filters.excludeAnswered
      || filters.excludeCorrect
      || filters.excludeWrong
      || filters.onlyCorrect
      || filters.onlyWrong;
    if (shouldLoadAnswersImmediately) {
      void ensureUserProgressLoaded(false, {
        includeAnswers: true,
        includeNotes: false,
        includeComments: false,
      });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void ensureUserProgressLoaded(false, {
        includeAnswers: true,
        includeNotes: false,
        includeComments: false,
      });
    }, PRACTICE_PROGRESS_BOOTSTRAP_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    currentUser?.id,
    ensureUserProgressLoaded,
    filters.excludeAnswered,
    filters.excludeCorrect,
    filters.excludeWrong,
    filters.onlyCorrect,
    filters.onlyWrong,
  ]);

  useEffect(() => {
    if (hasBootstrappedQuestionsRef.current === questionBootstrapKey) {
      return;
    }

    if (
      !authIsLoading
      && !currentUser?.id
      && !hasActiveFilters
      && initialQuestionPage
      && initialQuestionPage.questions.length > 0
      && !hasHydratedInitialPageRef.current
    ) {
      hasHydratedInitialPageRef.current = true;
      hasBootstrappedQuestionsRef.current = questionBootstrapKey;
      replaceQuestionBank('guest:guest', {
        questions: initialQuestionPage.questions,
        totalQuestions: initialQuestionPage.total || initialQuestionPage.questions.length,
        hasMoreQuestions: initialQuestionPage.pageInfo.hasMore,
        nextQuestionCursor: initialQuestionPage.pageInfo.nextCursor,
      });
      setLastFetchedPage(1);
      setVisibleCount(PAGE_SIZE);
      setCurrentQuestionIndex(0);
      return;
    }

    hasBootstrappedQuestionsRef.current = questionBootstrapKey;
    const requestId = bootstrapRequestIdRef.current + 1;
    bootstrapRequestIdRef.current = requestId;

    const bootstrapQuestions = async () => {
      setIsLoadingMore(true);

      try {
        await ensureQuestionsLoaded(false, questionQueryParams);
        if (bootstrapRequestIdRef.current === requestId) {
          setLastFetchedPage(1);
          setVisibleCount(PAGE_SIZE);
          setCurrentQuestionIndex(0);
        }
      } finally {
        if (bootstrapRequestIdRef.current === requestId) {
          setIsLoadingMore(false);
        }
      }
    };

    void bootstrapQuestions();
  }, [
    authIsLoading,
    currentUser?.id,
    ensureQuestionsLoaded,
    hasActiveFilters,
    initialQuestionPage,
    questionBootstrapKey,
    questionQueryParams,
    replaceQuestionBank,
  ]);

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

  const handleAnswer = useCallback((ans: Omit<UserAnswer, 'isCorrect' | 'correctOptionIndex'>) => {
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
    return dispatchAnswer(ans);
  }, [currentUser, dispatchAnswer]);

  const handleFilterChange = useCallback((key: PracticeFilterKey, value: PracticeFilterValue) => {
    if (isPracticeFilterLocked(key)) {
      return;
    }

    setPendingFilters(prev => {
      let nextFilters = { ...prev, [key]: value } as PracticeFilters;

      if (key === 'career') {
        const nextCareerValues = toFilterValues(value);
        const previousHadEnemFocus = filterHasValue(prev.career, ENEM_FOCUS_NAME);
        const nextHasEnemFocus = filterHasValue(nextCareerValues, ENEM_FOCUS_NAME);

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

      if (key === 'onlyCorrect' && value === true) {
        nextFilters = { ...nextFilters, onlyWrong: false };
      }

      if (key === 'onlyWrong' && value === true) {
        nextFilters = { ...nextFilters, onlyCorrect: false };
      }

      return nextFilters;
    });
  }, [isPracticeFilterLocked, sanitizeFiltersForFocus]);

  const openLockedFilterUpgrade = useCallback((key: PracticeFilterKey, fallbackMessage?: string) => {
    const benefitKey = PRACTICE_FILTER_BENEFITS[key];
    if (!benefitKey || !isPracticeFilterLocked(key)) {
      if (fallbackMessage) {
        addToast(fallbackMessage, 'info');
      }
      return;
    }

    setLockedFilterModal({
      featureName: PRACTICE_FILTER_FEATURE_LABELS[key] || 'este filtro',
      requiredPlan: getBenefitRequiredPlan(benefitKey, systemSettings.planEntitlements) as CanonicalPlanName,
    });
  }, [addToast, isPracticeFilterLocked, systemSettings.planEntitlements]);

  const applyFilters = useCallback(() => {
    setIsFiltering(true);
    setTimeout(() => {
      const nextFilters = sanitizeFiltersForCurrentPlan(sanitizeFiltersForFocus(pendingFilters));
      setFilters(nextFilters);
      setPendingFilters(nextFilters);
      setFilterTimestamp((timestamp) => timestamp + 1);
      setVisibleCount(PAGE_SIZE);
      setCurrentQuestionIndex(0);
      setLastFetchedPage(1);
      void ensureQuestionsLoaded(true, buildPracticeQuestionQueryParams(nextFilters))
        .finally(() => setIsFiltering(false));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500);
  }, [ensureQuestionsLoaded, pendingFilters, sanitizeFiltersForCurrentPlan, sanitizeFiltersForFocus]);

  const clearFilter = useCallback((key: PracticeFilterKey) => {
    let defaultValue: PracticeFilterValue = isMultiFilterKey(key) ? [] : key === 'keyword' ? '' : 'All';
    if (isBooleanFilterKey(key)) defaultValue = false;

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
    const agencies = practiceTaxonomies.agencies || [];
    if (agencies.length) return agencies.map((t) => t.sigla || t.name).filter(Boolean) as string[];
    return Array.from(new Set(questions.flatMap(q => q.bancas?.map(b => b.sigla) || []).filter(Boolean))) as string[];
  }, [practiceTaxonomies, questions]);

  const uniqueOrganizations = useMemo(() => {
    const organizations = practiceTaxonomies.organizations || [];
    if (organizations.length) return organizations.map((t) => t.sigla || t.name).filter(Boolean) as string[];
    return Array.from(new Set(questions.flatMap(q => q.orgaos?.map(o => o.sigla || o.nome) || []).filter(Boolean))) as string[];
  }, [practiceTaxonomies, questions]);

  const uniqueSubjects = useMemo(() => {
    if (isEnemPendingFocus) {
      return [...ENEM_SUBJECT_AREA_OPTIONS];
    }

    const subjects = practiceTaxonomies.subjects || [];
    if (subjects.length) return subjects.map((t) => t.name).filter(Boolean) as string[];
    return Array.from(new Set(questions.flatMap(q => q.assuntos?.filter(a => a.materia).map(a => a.nome) || []).filter(Boolean))) as string[];
  }, [isEnemPendingFocus, practiceTaxonomies, questions]);

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

    const taxonomies = practiceTaxonomies;
    const subjects = taxonomies.subjects || [];
    const selectedSubjectIds = new Set(
      subjects
        .filter((subject) => selectedSubjectValues.includes(getPracticeTaxonomyName(subject)))
        .map((subject) => getPracticeTaxonomyId(subject))
        .filter(Boolean),
    );
    const subjectTopics = (taxonomies.subjectTopics?.length
      ? taxonomies.subjectTopics
      : (taxonomies.topics || []).filter((item) => getPracticeTaxonomyLevel(item, taxonomies) === 'topico')) || [];
    const specificSubjects = (taxonomies.specificSubjects?.length
      ? taxonomies.specificSubjects
      : (taxonomies.topics || []).filter((item) => getPracticeTaxonomyLevel(item, taxonomies) === 'assunto')) || [];
    const hasStructuredKnowledgeTaxonomies = subjectTopics.length > 0 || specificSubjects.length > 0;
    const topicById = new Map<string, PracticeTaxonomyItem>();
    subjectTopics.forEach((topic) => {
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

    const topicBelongsToSelectedSubject = (topic: PracticeTaxonomyItem) => {
      const parentId = String(getPracticeParentId(topic));
      const rootSubjectId = String(getPracticeRootSubjectId(topic));

      if (selectedSubjectIds.size > 0) {
        return selectedSubjectIds.has(parentId) || selectedSubjectIds.has(rootSubjectId);
      }

      return selectedSubjectNameMatches(getPracticeRootSubjectName(topic));
    };

    const specificSubjectBelongsToSelectedSubject = (subject: PracticeTaxonomyItem) => {
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
      .forEach((topic) => {
        const topicName = getPracticeTaxonomyName(topic);
        const topicId = getPracticeTaxonomyId(topic);
        const childSubjects = specificSubjects
          .filter((subject) => String(getPracticeParentId(subject)) === topicId)
          .filter(specificSubjectBelongsToSelectedSubject);

        childSubjects
          .forEach((subject) => addOption(topicName, getPracticeTaxonomyName(subject)));

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
      .flatMap((question) => question.assuntos?.filter((item) => !item?.materia) || [])
      .forEach((item) => {
        const itemName = getPracticeTaxonomyName(item);
        const itemId = getPracticeTaxonomyId(item);
        const matchedSpecificSubject = specificSubjects.find((subject) => (
          (
            (itemId && getPracticeTaxonomyId(subject) === itemId)
            || getPracticeTaxonomyName(subject) === itemName
          )
          && specificSubjectBelongsToSelectedSubject(subject)
        ));
        const matchedTopic = subjectTopics.find((topic) => (
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
    practiceTaxonomies,
  ]);

  const uniqueYears = useMemo(() => {
    const yearSource = isEnemPendingFocus ? enemQuestions : questions;
    if (!isEnemPendingFocus && practiceTaxonomies.years?.length) return practiceTaxonomies.years.map(String);
    return Array.from(new Set(yearSource.flatMap(q => q.anos || []).map(String).filter(Boolean))) as string[];
  }, [enemQuestions, isEnemPendingFocus, practiceTaxonomies, questions]);

  const uniqueRoles = useMemo(() => {
    const roles = practiceTaxonomies.roles || [];
    if (roles.length) return roles.map((t) => t.descricao || t['descrição'] || t.name).filter(Boolean) as string[];
    return Array.from(new Set(questions.flatMap(q => q.cargos?.map(c => c.descricao || c['descrição'] || c.name) || []).filter(Boolean))) as string[];
  }, [practiceTaxonomies, questions]);

  const uniqueModalities = useMemo(() => {
    if (practiceTaxonomies.modalities?.length) return practiceTaxonomies.modalities;
    return ['Múltipla Escolha', 'Certo/Errado'];
  }, [practiceTaxonomies]);

  const uniqueCareers = useMemo(() => {
    const baseCareers = practiceTaxonomies.careers?.length
      ? practiceTaxonomies.careers.map((t) => normalizeCareerSelectorLabel(t.name || t.nome || '')).filter(Boolean)
      : Array.from(new Set(questions.flatMap(q => ((q as PracticeQuestion).carreiras || []).map(c => normalizeCareerSelectorLabel(c.nome || c.name || ''))).filter(Boolean))) as string[];

    return injectEnemFocusOption(baseCareers);
  }, [practiceTaxonomies, questions]);

  const careerOptionGroups = useMemo(() => buildSearchableOptionGroup('Focos', uniqueCareers), [uniqueCareers]);
  const agencyOptionGroups = useMemo(() => buildSearchableOptionGroup('Bancas', uniqueAgencies), [uniqueAgencies]);
  const yearOptionGroups = useMemo(() => buildSearchableOptionGroup('Anos', uniqueYears), [uniqueYears]);
  const roleOptionGroups = useMemo(() => buildSearchableOptionGroup('Cargos', uniqueRoles), [uniqueRoles]);
  const formatFilterChipValue = useCallback((key: string, value: unknown) => {
    if (key !== 'topic') {
      return serializeFilterValue(value);
    }

    const selectedValues = toFilterValues(value);
    if (selectedValues.length === 0) {
      return '';
    }

    const selectedKeys = new Set(selectedValues.map((item) => normalizePracticeText(item)));
    const consumedKeys = new Set<string>();
    const groupedLabels: string[] = [];

    topicOptionGroups.forEach((group) => {
      if (!group.selectable || group.options.length === 0) {
        return;
      }

      const optionKeys = Array.from(new Set(
        group.options
          .map((option) => normalizePracticeText(option.value))
          .filter(Boolean),
      ));

      if (optionKeys.length > 0 && optionKeys.every((optionKey) => selectedKeys.has(optionKey))) {
        groupedLabels.push(group.label);
        optionKeys.forEach((optionKey) => consumedKeys.add(optionKey));
      }
    });

    selectedValues.forEach((item) => {
      if (!consumedKeys.has(normalizePracticeText(item))) {
        groupedLabels.push(item);
      }
    });

    return groupedLabels.join(', ');
  }, [topicOptionGroups]);

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
    excludeAnswered: 'Ocultar Resolvidas',
    excludeCorrect: 'Ocultar Acertei',
    excludeWrong: 'Ocultar Errei',
    onlyCorrect: 'Acertei',
    onlyWrong: 'Errei',
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
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-colors duration-300">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Pesquisar por palavra-chave no enunciado..."
                value={pendingFilters.keyword}
                onChange={e => handleFilterChange('keyword', e.target.value)}
                disabled={isPracticeFilterLocked('keyword')}
                title={getLockedFilterHelperText('keyword')}
                className="w-full h-12 pl-12 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-medium text-sm text-slate-900 dark:text-slate-100 transition-all disabled:cursor-not-allowed disabled:opacity-60"
              />
              {isPracticeFilterLocked('keyword') ? (
                <button
                  type="button"
                  aria-label="Desbloquear pesquisa por palavra-chave"
                  onClick={() => openLockedFilterUpgrade('keyword')}
                  className="absolute inset-0 rounded-2xl"
                />
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setPendingFilters(DEFAULT_FILTERS);
                  setLastFetchedPage(1);
                  void ensureQuestionsLoaded(true, {});
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
              onChange={(v) => handleFilterChange('career', v)}
              groups={careerOptionGroups}
            />
            <SearchableFilterSelect
              label="Materia"
              value={pendingFilters.subject}
              onChange={(v) => handleFilterChange('subject', v)}
              groups={subjectOptionGroups}
              variant="taxonomy-tree"
              disabled={isPracticeFilterLocked('subject')}
              helperText={getLockedFilterHelperText('subject', isEnemPendingFocus ? 'No foco ENEM, a matéria usa as áreas oficiais de conhecimento.' : undefined)}
              onDisabledClick={() => openLockedFilterUpgrade('subject')}
            />
            <FilterSelect label="Dificuldade" value={pendingFilters.difficulty} onChange={(v) => handleFilterChange('difficulty', v)} options={Object.values(Difficulty)} disabled={isPracticeFilterLocked('difficulty')} helperText={getLockedFilterHelperText('difficulty')} onDisabledClick={() => openLockedFilterUpgrade('difficulty')} />
            <SearchableFilterSelect
              label="Banca"
              value={pendingFilters.agency}
              onChange={(v) => handleFilterChange('agency', v)}
              groups={agencyOptionGroups}
              disabled={isEnemPendingFocus || isPracticeFilterLocked('agency')}
              helperText={getLockedFilterHelperText('agency', isEnemPendingFocus ? 'Desativado para ENEM.' : undefined)}
              onDisabledClick={() => openLockedFilterUpgrade('agency', isEnemPendingFocus ? 'No foco ENEM, a banca é fixa e este filtro fica desativado.' : undefined)}
            />
            <FilterSelect label="Órgão" value={pendingFilters.organization} onChange={(v) => handleFilterChange('organization', v)} options={uniqueOrganizations} disabled={isEnemPendingFocus || isPracticeFilterLocked('organization')} helperText={getLockedFilterHelperText('organization', isEnemPendingFocus ? 'Desativado para ENEM.' : undefined)} onDisabledClick={() => openLockedFilterUpgrade('organization', isEnemPendingFocus ? 'No foco ENEM, órgão não se aplica a essa seleção.' : undefined)} />
            <SearchableFilterSelect
              label="Ano"
              value={pendingFilters.year}
              onChange={(v) => handleFilterChange('year', v)}
              groups={yearOptionGroups}
              disabled={isPracticeFilterLocked('year')}
              helperText={getLockedFilterHelperText('year')}
              onDisabledClick={() => openLockedFilterUpgrade('year')}
            />
            <FilterSelect label="Nível" value={pendingFilters.level} onChange={(v) => handleFilterChange('level', v)} options={['Superior', 'Médio', 'Fundamental']} disabled={isEnemPendingFocus || isPracticeFilterLocked('level')} helperText={getLockedFilterHelperText('level', isEnemPendingFocus ? 'Desativado para ENEM.' : undefined)} onDisabledClick={() => openLockedFilterUpgrade('level', isEnemPendingFocus ? 'No foco ENEM, nível não se aplica a essa seleção.' : undefined)} />
            <SearchableFilterSelect
              label="Assunto"
              value={pendingFilters.topic}
              onChange={(v) => handleFilterChange('topic', v)}
              groups={topicOptionGroups}
              variant="taxonomy-tree"
              disabled={!hasAnyFilterValue(pendingFilters.subject) || isPracticeFilterLocked('topic')}
              helperText={getLockedFilterHelperText('topic', !hasAnyFilterValue(pendingFilters.subject) ? 'Selecione uma matéria antes de filtrar por assunto.' : undefined)}
              onDisabledClick={() => openLockedFilterUpgrade('topic', !hasAnyFilterValue(pendingFilters.subject) ? 'Selecione uma matéria antes de filtrar por assunto.' : undefined)}
            />
            <SearchableFilterSelect
              label="Cargo"
              value={pendingFilters.role}
              onChange={(v) => handleFilterChange('role', v)}
              groups={roleOptionGroups}
              disabled={isEnemPendingFocus || isPracticeFilterLocked('role')}
              helperText={getLockedFilterHelperText('role', isEnemPendingFocus ? 'Desativado para ENEM.' : undefined)}
              onDisabledClick={() => openLockedFilterUpgrade('role', isEnemPendingFocus ? 'No foco ENEM, cargo não se aplica a essa seleção.' : undefined)}
            />
            <FilterSelect label="Modalidade" value={pendingFilters.modality} onChange={(v) => handleFilterChange('modality', v)} options={uniqueModalities} disabled={isEnemPendingFocus || isPracticeFilterLocked('modality')} helperText={getLockedFilterHelperText('modality', isEnemPendingFocus ? 'Desativado para ENEM.' : undefined)} onDisabledClick={() => openLockedFilterUpgrade('modality', isEnemPendingFocus ? 'No foco ENEM, modalidade não se aplica a essa seleção.' : undefined)} />
          </div>

          {isEnemPendingFocus ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 shadow-sm shadow-indigo-100/50 transition-colors dark:border-indigo-400/20 dark:bg-indigo-950/20 dark:shadow-none">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-200">Mapa ENEM</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {ENEM_SUBJECT_AREA_OPTIONS.map((areaName) => (
                  <div key={areaName} className="rounded-xl border border-indigo-100 bg-white/90 p-3 transition-colors dark:border-indigo-400/15 dark:bg-slate-950/55">
                    <p className="text-xs font-black text-slate-900 dark:text-white">{areaName}</p>
                    <p className="mt-2 text-[10px] font-semibold leading-5 text-slate-500 dark:text-slate-300">
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
                <CheckboxFilter
                  label="Acertei"
                  checked={pendingFilters.excludeCorrect}
                  onChange={(v: boolean) => handleFilterChange('excludeCorrect', v)}
                  icon={CheckCircle}
                  colorClass="emerald"
                  disabled={isPracticeFilterLocked('excludeCorrect')}
                  disabledTitle={getLockedFilterHelperText('excludeCorrect')}
                  onDisabledClick={() => openLockedFilterUpgrade('excludeCorrect')}
                />
                <CheckboxFilter
                  label="Errei"
                  checked={pendingFilters.excludeWrong}
                  onChange={(v: boolean) => handleFilterChange('excludeWrong', v)}
                  icon={X}
                  colorClass="red"
                  disabled={isPracticeFilterLocked('excludeWrong')}
                  disabledTitle={getLockedFilterHelperText('excludeWrong')}
                  onDisabledClick={() => openLockedFilterUpgrade('excludeWrong')}
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
                  disabled={isPracticeFilterLocked('onlySaved')}
                  disabledTitle={getLockedFilterHelperText('onlySaved')}
                  onDisabledClick={() => openLockedFilterUpgrade('onlySaved')}
                />
                <CheckboxFilter
                  label="Acertei"
                  checked={pendingFilters.onlyCorrect}
                  onChange={(v: boolean) => handleFilterChange('onlyCorrect', v)}
                  icon={CheckCircle}
                  colorClass="emerald"
                  disabled={isPracticeFilterLocked('onlyCorrect')}
                  disabledTitle={getLockedFilterHelperText('onlyCorrect')}
                  onDisabledClick={() => openLockedFilterUpgrade('onlyCorrect')}
                />
                <CheckboxFilter
                  label="Errei"
                  checked={pendingFilters.onlyWrong}
                  onChange={(v: boolean) => handleFilterChange('onlyWrong', v)}
                  icon={X}
                  colorClass="red"
                  disabled={isPracticeFilterLocked('onlyWrong')}
                  disabledTitle={getLockedFilterHelperText('onlyWrong')}
                  onDisabledClick={() => openLockedFilterUpgrade('onlyWrong')}
                />
                <CheckboxFilter
                  label="Comentário do Professor"
                  checked={pendingFilters.hasTeacherComment}
                  onChange={(v: boolean) => handleFilterChange('hasTeacherComment', v)}
                  icon={GraduationCap}
                  colorClass="amber"
                  disabled={isPracticeFilterLocked('hasTeacherComment')}
                  disabledTitle={getLockedFilterHelperText('hasTeacherComment')}
                  onDisabledClick={() => openLockedFilterUpgrade('hasTeacherComment')}
                />
                <CheckboxFilter
                    label="Análise detalhada"
                  checked={pendingFilters.hasDetailedComment}
                  onChange={(v: boolean) => handleFilterChange('hasDetailedComment', v)}
                  icon={Sparkles}
                  colorClass="indigo"
                  disabled={isPracticeFilterLocked('hasDetailedComment')}
                  disabledTitle={getLockedFilterHelperText('hasDetailedComment')}
                  onDisabledClick={() => openLockedFilterUpgrade('hasDetailedComment')}
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
                      <span>{value === true ? 'Sim' : formatFilterChipValue(key, value)}</span>
                      <button onClick={() => clearFilter(key as PracticeFilterKey)} className="hover:opacity-70 rounded-full p-0.5 transition-colors">
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
                {formatQuestionCount(displayedQuestionTotal)}
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
          resolvedQuestions.length > 0 ? (
            <div className="relative min-h-[400px]">
              {isFiltering && (
                <div className="absolute inset-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center rounded-2xl transition-all animate-fade-in">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={40} />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Filtrando questões...</span>
                  </div>
                </div>
              )}
                <div ref={focusQuestionRef} className="scroll-mt-4 md:scroll-mt-6">
                  <QuestionCard
                  key={`${resolvedQuestions[currentQuestionIndex].id}-${filterTimestamp}`}
                  question={resolvedQuestions[currentQuestionIndex]}
                  isHighlighted={!!highlightedQuestionId}
                  onAnswerSubmit={handleAnswer}
                  onReportError={reportError}
                  onGuestAction={(action) => {
                    const titles: Record<string, string> = {
                      answer: "Responda Já!",
                      'verify-email': "Confirme seu E-mail",
                      save: "Salve para Depois",
                      comment: "Participe da Comunidade",
                      note: "Faça Anotações",
                      report: "Ajude a Melhorar"
                    };
                    const descriptions: Record<string, string> = {
                      answer: "Crie uma conta gratuita em segundos para salvar suas resoluções, ganhar XP e monitorar sua evolução.",
                      'verify-email': "Para responder questões e ganhar XP, você precisa confirmar seu e-mail. Verifique sua caixa de entrada.",
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
                  existingAnswer={userAnswers.find(a => a.questionId === resolvedQuestions[currentQuestionIndex].id)}
                  isAlreadyReported={reports.some(r => r.questionId === resolvedQuestions[currentQuestionIndex].id && r.status === 'pending')}
                    userPlan={getEffectivePlanName(currentUser)}
                  existingNote={userNotes.find(n => String(n.questionId) === String(resolvedQuestions[currentQuestionIndex].id))}
                  onSaveNote={(qId, text) => saveNote(Number(qId), text)}
                  onOpenNote={handleOpenQuestionNote}
                  onToggleSave={() => {
                    void handleToggleQuestionSave(resolvedQuestions[currentQuestionIndex]);
                  }}
                  isSaved={resolveQuestionSavedState(resolvedQuestions[currentQuestionIndex])}
                  currentUserId={currentUser?.id || ''}
                  currentUserName={currentUser?.name || 'Visitante'}
                />
                <nav
                  aria-label="Navegação entre questões"
                  className="mt-4 grid grid-cols-2 items-center gap-2 px-0 sm:mt-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-3 sm:px-2"
                >
                  <button
                    type="button"
                    aria-label="Ir para a questão anterior"
                    onClick={() => {
                      setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1));
                      scrollToFocusQuestion();
                    }}
                    disabled={currentQuestionIndex === 0}
                    className="col-start-1 row-start-2 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-400 sm:row-start-1 sm:h-12 sm:w-auto sm:gap-2 sm:px-6 sm:text-xs sm:tracking-widest"
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  <span
                    aria-live="polite"
                    className="col-span-2 col-start-1 row-start-1 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 sm:col-span-1 sm:col-start-2 sm:tracking-[0.24em]"
                  >
                    Questão {currentQuestionIndex + 1} de {displayedQuestionTotal}
                  </span>
                  <button
                    type="button"
                    aria-label="Ir para a próxima questão"
                    onClick={() => {
                      setCurrentQuestionIndex(Math.min(resolvedQuestions.length - 1, currentQuestionIndex + 1));
                      scrollToFocusQuestion();
                    }}
                    disabled={currentQuestionIndex === resolvedQuestions.length - 1}
                    className="col-start-2 row-start-2 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-35 dark:bg-indigo-600 dark:hover:bg-indigo-700 sm:col-start-3 sm:row-start-1 sm:h-12 sm:w-auto sm:gap-2 sm:px-6 sm:text-xs sm:tracking-widest"
                  >
                    Próxima <ChevronRight size={16} />
                  </button>
                </nav>
              </div>

            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-10 sm:p-14 md:p-20 text-center space-y-4 transition-colors duration-300">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full w-fit mx-auto text-slate-300 dark:text-slate-600"><Search size={48} /></div>
              <h3 className="text-xl font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nenhuma questão encontrada</h3>
              <p className="text-sm text-slate-400 dark:text-slate-600 max-w-xs mx-auto mb-6">Tente ajustar seus filtros para encontrar o que procura.</p>
              <button
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setPendingFilters(DEFAULT_FILTERS);
                  setLastFetchedPage(1);
                  void ensureQuestionsLoaded(true, {});
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
                    'verify-email': "Confirme seu E-mail",
                    save: "Salve para Depois",
                    comment: "Participe da Comunidade",
                    note: "Faça Anotações",
                    report: "Ajude a Melhorar"
                  };
                  const descriptions: Record<string, string> = {
                    answer: "Crie uma conta gratuita em segundos para salvar suas resoluções, ganhar XP e monitorar sua evolução.",
                    'verify-email': "Para responder questões e ganhar XP, você precisa confirmar seu e-mail. Verifique sua caixa de entrada.",
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
                onOpenNote={handleOpenQuestionNote}
                onToggleSave={() => {
                  void handleToggleQuestionSave(q);
                }}
                isSaved={resolveQuestionSavedState(q)}
                existingAnswer={userAnswers.find(a => a.questionId === q.id)}
                existingNote={userNotes.find(n => String(n.questionId) === String(q.id))}
                isAlreadyReported={reports.some(r => r.questionId === q.id && r.status === 'pending')}
                    userPlan={getEffectivePlanName(currentUser)}
                currentUserId={currentUser?.id || ''}
                currentUserName={currentUser?.name || 'Visitante'}
              />
            ))}
            <div ref={loaderRef} className="flex min-h-12 items-center justify-center py-1" aria-live="polite">
              {isLoadingMore ? (
                <Loader2 aria-label="Carregando mais questões" className="animate-spin text-indigo-500" size={24} />
              ) : loadMoreError ? (
                <button
                  type="button"
                  onClick={() => void loadNextPage()}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-indigo-200 bg-white px-4 text-xs font-bold text-indigo-600 transition-colors hover:border-indigo-400 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
                >
                  Tentar carregar novamente
                </button>
              ) : null}
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

      {lockedFilterModal ? (
        <UpgradeModal
          isOpen
          onClose={() => setLockedFilterModal(null)}
          requiredPlan={lockedFilterModal.requiredPlan}
          featureName={lockedFilterModal.featureName}
        />
      ) : null}

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




