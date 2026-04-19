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
import { Subject, Difficulty, UserAnswer } from '../../types';
import { ChevronRight, ChevronLeft, Search, RotateCcw, Loader2, X, BookmarkCheck, Check, CheckCircle, GraduationCap, Sparkles, AlertTriangle, ArrowLeft, ArrowUp } from 'lucide-react';
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
  subject: 'All',
  difficulty: 'All',
  agency: 'All',
  organization: 'All',
  year: 'All',
  level: 'All',
  topic: 'All',
  role: 'All',
  career: 'All',
  modality: 'All',
  onlySaved: false,
  hasTeacherComment: false,
  hasDetailedComment: false,
  excludeCanceled: false,
  excludeOutdated: false,
  excludeAnswered: false,
};

const sanitizePracticeFiltersForFocus = (nextFilters: typeof DEFAULT_FILTERS) => {
  if (nextFilters.career !== ENEM_FOCUS_NAME) {
    return nextFilters;
  }

  return {
    ...nextFilters,
    agency: 'All',
    organization: 'All',
    level: 'All',
    role: 'All',
    modality: 'All',
  };
};

const Practice: React.FC = () => {
  const { currentUser, toggleSavedQuestion, addXp } = useAuth();
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

  const initialFilters = useMemo(() => ({
    ...DEFAULT_FILTERS,
    keyword: searchParams.get('keyword') || DEFAULT_FILTERS.keyword,
    subject: searchParams.get('subject') || searchParams.get('materia') || DEFAULT_FILTERS.subject,
    difficulty: searchParams.get('difficulty') || DEFAULT_FILTERS.difficulty,
    agency: searchParams.get('agency') || DEFAULT_FILTERS.agency,
    organization: searchParams.get('organization') || DEFAULT_FILTERS.organization,
    year: searchParams.get('year') || DEFAULT_FILTERS.year,
    level: searchParams.get('level') || DEFAULT_FILTERS.level,
    topic: searchParams.get('topic') || searchParams.get('assunto') || DEFAULT_FILTERS.topic,
    role: searchParams.get('role') || DEFAULT_FILTERS.role,
    career: normalizeCareerSelectorLabel(searchParams.get('career') || DEFAULT_FILTERS.career),
    modality: searchParams.get('modality') || DEFAULT_FILTERS.modality,
    onlySaved: searchParams.get('onlySaved') === 'true',
    hasTeacherComment: searchParams.get('hasTeacherComment') === 'true',
    hasDetailedComment: searchParams.get('hasDetailedComment') === 'true',
    excludeCanceled: searchParams.get('excludeCanceled') === 'true',
    excludeOutdated: searchParams.get('excludeOutdated') === 'true',
    excludeAnswered: searchParams.get('excludeAnswered') === 'true'
  }), [searchParams]);

  const [filters, setFilters] = useState(() => sanitizePracticeFiltersForFocus(initialFilters));
  const [pendingFilters, setPendingFilters] = useState(() => sanitizePracticeFiltersForFocus(initialFilters)); // State for UI selection before submit
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterTimestamp, setFilterTimestamp] = useState(Date.now()); // Force reset on filter
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState({ title: '', description: '' });
  const [lastFetchedPage, setLastFetchedPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const pageRootRef = useRef<HTMLDivElement>(null);
  const scrollTargetRef = useRef<HTMLElement | Window | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const sanitizeFiltersForFocus = sanitizePracticeFiltersForFocus;

  const isEnemPendingFocus = pendingFilters.career === ENEM_FOCUS_NAME;

  // Removido declarção duplicada do searchParams
  const filteredQuestions = useMemo(() => {
    let filtered = questions.filter(q => {
      const enemQuestion = isEnemQuestion(q);
      const enemSubjectAreas = getEnemSubjectAreasForQuestion(q);
      const isEnemFocus = filters.career === ENEM_FOCUS_NAME;
      const matchSubject = filters.subject === 'All'
        || (
          isEnemFocus
            ? enemSubjectAreas.includes(filters.subject as (typeof ENEM_SUBJECT_AREA_OPTIONS)[number])
            : q.assuntos?.some(a => a.nome === filters.subject || (a.materia && a.nome === filters.subject))
        );
      
      const difficultyMap: Record<string, number> = {
        'Muito Fácil': 1,
        'Fácil': 2,
        'Médio': 3,
        'Difícil': 4,
        'Muito Difícil': 5
      };
      
      const matchDifficulty = filters.difficulty === 'All' || q.dificuldade === difficultyMap[filters.difficulty];
      const matchAgency = isEnemFocus || filters.agency === 'All' || q.bancas?.some(b => b.sigla === filters.agency || b.nome === filters.agency);
      const matchOrganization = isEnemFocus || filters.organization === 'All' || q.orgaos?.some(o => o.sigla === filters.organization || o.nome === filters.organization);
      const matchYear = filters.year === 'All' || q.anos?.some(y => String(y) === filters.year);
      const matchLevel = isEnemFocus || filters.level === 'All' || q.level === filters.level;
      const matchTopic = filters.topic === 'All' || q.assuntos?.some(a => a.nome === filters.topic);
      const matchRole = isEnemFocus || filters.role === 'All' || q.cargos?.some(c => ((c as any).descricao || (c as any)['descrição'] || (c as any).name) === filters.role);
      const matchCareer = filters.career === 'All'
        || (
          isEnemFocus
            ? enemQuestion
            : q.carreiras?.some(c => normalizeCareerSelectorLabel(c?.nome) === normalizeCareerSelectorLabel(filters.career))
        );
      const matchModality = isEnemFocus || filters.modality === 'All' || q.tipo === (filters.modality === 'Certo/Errado' ? 'certo ou errado' : 'multipla escolha');
      const matchKeyword = !filters.keyword || (q.enunciado_clean || q.enunciado || '').toLowerCase().includes(filters.keyword.toLowerCase());
      const matchSaved = !filters.onlySaved || currentUser?.savedQuestionIds.includes(String(q.id));

      const matchTeacher = !filters.hasTeacherComment || !!q.hasTeacherComment || !!q.teacherComment;
      const matchDetailed = !filters.hasDetailedComment || !!q.hasDetailedComment || !!q.detailedComment;

      const matchCanceled = !(q.anulada || q.isCanceled) || !filters.excludeCanceled;
      const matchOutdated = !(q.desatualizada || q.isOutdated) || !filters.excludeOutdated;
      const matchExcludeAnswered = !filters.excludeAnswered || !userAnswers.some(a => Number(a.questionId) === Number(q.id));

      return matchSubject && matchDifficulty && matchKeyword && matchAgency && matchOrganization && matchYear && matchLevel && matchTopic && matchRole && matchCareer && matchModality && matchSaved && matchTeacher && matchDetailed && matchCanceled && matchOutdated && matchExcludeAnswered;
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

  const isFiltered = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'keyword') return value !== '';
      if (['onlySaved', 'hasTeacherComment', 'hasDetailedComment', 'excludeCanceled', 'excludeOutdated', 'excludeAnswered'].includes(key)) return value === true;
      return value !== 'All';
    });
  }, [filters]);

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
    if (viewMode === 'card' && currentQuestionIndex >= filteredQuestions.length - 1) {
        if (filteredQuestions.length < totalQuestions) {
            loadNextPage();
        }
    }
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
        if (value === ENEM_FOCUS_NAME) {
          nextFilters = sanitizeFiltersForFocus({
            ...nextFilters,
            subject: ENEM_SUBJECT_AREA_OPTIONS.includes(nextFilters.subject as (typeof ENEM_SUBJECT_AREA_OPTIONS)[number])
              ? nextFilters.subject
              : 'All',
            topic: 'All',
          });
        } else if (prev.career === ENEM_FOCUS_NAME) {
          nextFilters = {
            ...nextFilters,
            subject: ENEM_SUBJECT_AREA_OPTIONS.includes(nextFilters.subject as (typeof ENEM_SUBJECT_AREA_OPTIONS)[number])
              ? 'All'
              : nextFilters.subject,
            topic: 'All',
          };
        }
      }

      if (key === 'subject') {
        nextFilters = { ...nextFilters, topic: 'All' };
      }

      return nextFilters;
    });
  }, [sanitizeFiltersForFocus]);

  const applyFilters = useCallback(() => {
    setIsFiltering(true);
    setTimeout(() => {
      setFilters(sanitizeFiltersForFocus(pendingFilters));
      setFilterTimestamp(Date.now());
      setVisibleCount(PAGE_SIZE);
      setCurrentQuestionIndex(0);
      setIsFiltering(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500);
  }, [pendingFilters, sanitizeFiltersForFocus]);

  const clearFilter = useCallback((key: string) => {
    let defaultValue: any = 'All';
    if (['onlySaved', 'hasTeacherComment', 'hasDetailedComment', 'excludeCanceled', 'excludeOutdated', 'excludeAnswered'].includes(key)) defaultValue = false;

    // Update both pending and active to clear immediately/consistently or just pending?
    // User expects "RotateCcw" to clear all. Single clear currently acts on 'filters' in original code.
    // If we want manual submit, clearing a single chip should perhaps update pending?
    // But chips show *active* filters. So clearing them should probably re-trigger apply or update active directly.
    // Let's update both for immediate effect on chips.
    let newFilters = { ...filters, [key]: defaultValue };
    if (key === 'career' && filters.career === ENEM_FOCUS_NAME) {
      newFilters = {
        ...newFilters,
        subject: ENEM_SUBJECT_AREA_OPTIONS.includes(String(filters.subject) as (typeof ENEM_SUBJECT_AREA_OPTIONS)[number]) ? 'All' : newFilters.subject,
        topic: 'All',
      };
    }
    newFilters = sanitizeFiltersForFocus(newFilters);
    setFilters(newFilters);
    setPendingFilters(prev => {
      let nextFilters = { ...prev, [key]: defaultValue };
      if (key === 'career' && prev.career === ENEM_FOCUS_NAME) {
        nextFilters = {
          ...nextFilters,
          subject: ENEM_SUBJECT_AREA_OPTIONS.includes(String(prev.subject) as (typeof ENEM_SUBJECT_AREA_OPTIONS)[number]) ? 'All' : nextFilters.subject,
          topic: 'All',
        };
      }
      return sanitizeFiltersForFocus(nextFilters);
    });
  }, [filters, sanitizeFiltersForFocus]);

  const FilterSelect = ({ label, value, onChange, options, disabled = false, helperText }: any) => (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 tracking-wider">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className={`w-full h-11 px-3 text-sm border rounded-xl outline-none transition-all font-medium ${disabled ? 'bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer focus:ring-2 focus:ring-indigo-500/20'}`}
      >
        <option value="All">Todos</option>
        {options.map((opt: string, index: number) => <option key={`${label}-${opt}-${index}`} value={opt}>{opt}</option>)}
      </select>
      {helperText ? (
        <p className="px-1 text-[10px] font-medium leading-4 text-slate-400 dark:text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );

  const CheckboxFilter = ({ label, checked, onChange, icon: Icon, colorClass = 'indigo' }: any) => (
    <label className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all select-none ${checked ? `bg-${colorClass}-50 dark:bg-${colorClass}-900/20 border-${colorClass}-200 dark:border-${colorClass}-800 text-${colorClass}-700 dark:text-${colorClass}-400` : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? `bg-${colorClass}-600 border-${colorClass}-600` : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}>
        {checked && <Check size={10} className="text-white" />}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {Icon && <Icon size={14} className="ml-1 opacity-50" />}
      <input type="checkbox" className="hidden" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
  );

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

  const uniqueTopics = useMemo(() => {
    if (isEnemPendingFocus) {
      const scopedEnemQuestions = pendingFilters.subject === 'All'
        ? enemQuestions
        : enemQuestions.filter((question) => getEnemSubjectAreasForQuestion(question).includes(pendingFilters.subject as (typeof ENEM_SUBJECT_AREA_OPTIONS)[number]));

      return Array.from(new Set(
        scopedEnemQuestions.flatMap((question) => question.assuntos?.filter((assunto) => !assunto.materia).map((assunto) => assunto.nome) || []).filter(Boolean),
      )) as string[];
    }

    if (systemSettings.taxonomies?.topics?.length) {
      let availableTopics = systemSettings.taxonomies.topics;
      if (pendingFilters.subject !== 'All') {
        const subjectObj = systemSettings.taxonomies.subjects?.find((s: any) => s.name === pendingFilters.subject);
        if (subjectObj) {
          availableTopics = availableTopics.filter((t: any) => !t.parentId || t.parentId === subjectObj.id);
        }
      }
      return availableTopics.map((t: any) => t.name);
    }
    return Array.from(new Set(questions.flatMap(q => q.assuntos?.filter(a => !a.materia).map(a => a.nome) || []).filter(Boolean))) as string[];
  }, [enemQuestions, isEnemPendingFocus, pendingFilters.subject, questions, systemSettings.taxonomies?.subjects, systemSettings.taxonomies?.topics]);

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
            <FilterSelect label="Foco" value={pendingFilters.career} onChange={(v: any) => handleFilterChange('career', v)} options={uniqueCareers} />
            <FilterSelect
              label="Matéria"
              value={pendingFilters.subject}
              onChange={(v: any) => handleFilterChange('subject', v)}
              options={uniqueSubjects}
              helperText={isEnemPendingFocus ? 'No foco ENEM, a matéria usa as áreas oficiais de conhecimento.' : undefined}
            />
            <FilterSelect label="Dificuldade" value={pendingFilters.difficulty} onChange={(v: any) => handleFilterChange('difficulty', v)} options={Object.values(Difficulty)} />
            <FilterSelect label="Banca" value={pendingFilters.agency} onChange={(v: any) => handleFilterChange('agency', v)} options={uniqueAgencies} disabled={isEnemPendingFocus} helperText={isEnemPendingFocus ? 'Desativado para ENEM.' : undefined} />
            <FilterSelect label="Órgão" value={pendingFilters.organization} onChange={(v: any) => handleFilterChange('organization', v)} options={uniqueOrganizations} disabled={isEnemPendingFocus} helperText={isEnemPendingFocus ? 'Desativado para ENEM.' : undefined} />
            <FilterSelect label="Ano" value={pendingFilters.year} onChange={(v: any) => handleFilterChange('year', v)} options={uniqueYears} />
            <FilterSelect label="Nível" value={pendingFilters.level} onChange={(v: any) => handleFilterChange('level', v)} options={['Superior', 'Médio', 'Fundamental']} disabled={isEnemPendingFocus} helperText={isEnemPendingFocus ? 'Desativado para ENEM.' : undefined} />
            <FilterSelect label="Assunto" value={pendingFilters.topic} onChange={(v: any) => handleFilterChange('topic', v)} options={uniqueTopics} />
            <FilterSelect label="Cargo" value={pendingFilters.role} onChange={(v: any) => handleFilterChange('role', v)} options={uniqueRoles} disabled={isEnemPendingFocus} helperText={isEnemPendingFocus ? 'Desativado para ENEM.' : undefined} />
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
              {Object.entries(pendingFilters).filter(([k, v]) => v !== 'All' && v !== '' && v !== false).length > 0 ? (
                Object.entries(pendingFilters).map(([key, value]) => {
                  if (value === 'All' || value === '' || value === false) return null;
                  return (
                    <div key={key} className={`px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 animate-scale-in border ${key === 'hasTeacherComment' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' : key === 'hasDetailedComment' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
                      <span className="opacity-60">{filterLabels[key] || key}:</span>
                      <span>{value === true ? 'Sim' : value}</span>
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
                {totalQuestions > filteredQuestions.length ? `${filteredQuestions.length} de ${totalQuestions}` : filteredQuestions.length} Questões
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
              <div className="">
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
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-[10px] sm:text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-all shadow-sm"
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.3em]">Questão {currentQuestionIndex + 1} / {totalQuestions}</span>
                  <button
                    onClick={() => {
                      setCurrentQuestionIndex(Math.min(filteredQuestions.length - 1, currentQuestionIndex + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
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



