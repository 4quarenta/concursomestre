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

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Crown,
  FileText,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  Timer,
  Trash2,
} from 'lucide-react';
import AuthModal from '../../components/shared/overlays/AuthModal';
import UpgradeModal from '../../components/shared/overlays/UpgradeModal';
import {
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useToast } from '@providers/ToastProvider';
import { isPlanAtLeast } from '@services/plans/planAccess';
import { studyScheduleService } from '@services/study-schedule';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import BetaFeaturePage from '../../components/shared/feedback/BetaFeaturePage';

type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type SubjectPriority = 'Alta' | 'Média' | 'Baixa';
type StudyStrategy = 'balanced' | 'weakness' | 'revision';

type StudySubject = {
  id: string;
  name: string;
  topics: string;
  priority: SubjectPriority;
  weeklyBlocks: number;
};

type StudyPlanForm = {
  objective: string;
  examDate: string;
  hoursPerDay: number;
  sessionMinutes: number;
  questionGoal: number;
  weekdays: WeekdayKey[];
  strategy: StudyStrategy;
  subjects: StudySubject[];
};

type StudySession = {
  id: string;
  weekNumber: number;
  dateLabel: string;
  weekdayLabel: string;
  subject: string;
  topic: string;
  kind: string;
  durationMinutes: number;
  questionGoal: number;
  priority: SubjectPriority;
};

type GeneratedStudyPlan = {
  id: string;
  generatedAt: string;
  form: StudyPlanForm;
  sessions: StudySession[];
  summary: {
    weeks: number;
    totalSessions: number;
    totalHours: number;
    totalQuestions: number;
    subjects: number;
  };
};

const PANEL_CLASS = PLATFORM_SURFACE_CARD_CLASS;
const INNER_PANEL_CLASS = 'rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50';
const FIELD_CLASS = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-500';
const TEXTAREA_CLASS = 'min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium leading-6 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-500';

const WEEKDAYS: Array<{ key: WeekdayKey; label: string; jsDay: number }> = [
  { key: 'mon', label: 'Seg', jsDay: 1 },
  { key: 'tue', label: 'Ter', jsDay: 2 },
  { key: 'wed', label: 'Qua', jsDay: 3 },
  { key: 'thu', label: 'Qui', jsDay: 4 },
  { key: 'fri', label: 'Sex', jsDay: 5 },
  { key: 'sat', label: 'Sáb', jsDay: 6 },
  { key: 'sun', label: 'Dom', jsDay: 0 },
];

const PRIORITY_WEIGHT: Record<SubjectPriority, number> = {
  Alta: 3,
  Média: 2,
  Baixa: 1,
};

const STRATEGY_LABELS: Record<StudyStrategy, string> = {
  balanced: 'Equilibrado',
  weakness: 'Priorizar pontos fracos',
  revision: 'Revisão antes da prova',
};

const DEFAULT_FORM: StudyPlanForm = {
  objective: '',
  examDate: '',
  hoursPerDay: 2,
  sessionMinutes: 50,
  questionGoal: 20,
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  strategy: 'balanced',
  subjects: [
    { id: 'subject-1', name: 'Português', topics: 'Interpretação de texto\nGramática', priority: 'Alta', weeklyBlocks: 2 },
    { id: 'subject-2', name: 'Direito Constitucional', topics: 'Direitos fundamentais\nOrganização do Estado', priority: 'Alta', weeklyBlocks: 2 },
    { id: 'subject-3', name: 'Direito Administrativo', topics: 'Atos administrativos\nLicitações', priority: 'Média', weeklyBlocks: 2 },
    { id: 'subject-4', name: 'Raciocínio Lógico', topics: 'Proposições\nPorcentagem', priority: 'Média', weeklyBlocks: 1 },
  ],
};

const normalizeText = (value: unknown) => String(value || '').trim();

const formatDateLabel = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

const getMonday = (date: Date) => {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diff);
  return current;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const getStorageKey = (userId?: string | null) => `concursomestre:cronograma:${userId || 'guest'}`;

const normalizePriority = (value: unknown): SubjectPriority => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('alta')) return 'Alta';
  if (normalized.includes('baixa')) return 'Baixa';
  return 'Média';
};

const cloneForm = (form: StudyPlanForm): StudyPlanForm => ({
  ...form,
  weekdays: [...form.weekdays],
  subjects: form.subjects.map((subject) => ({ ...subject, priority: normalizePriority(subject.priority) })),
});

const normalizeWeekdays = (value: unknown): WeekdayKey[] => {
  const valid = new Set(WEEKDAYS.map((weekday) => weekday.key));
  const weekdays = Array.isArray(value)
    ? value.filter((weekday): weekday is WeekdayKey => valid.has(weekday as WeekdayKey))
    : [];

  return weekdays.length > 0 ? Array.from(new Set(weekdays)) : [...DEFAULT_FORM.weekdays];
};

const normalizeStudyPlanForm = (value: unknown): StudyPlanForm => {
  const raw = value && typeof value === 'object' ? value as Partial<StudyPlanForm> : {};
  const subjects = Array.isArray(raw.subjects) && raw.subjects.length > 0
    ? raw.subjects.map((subject, index) => {
        const item = subject && typeof subject === 'object' ? subject as Partial<StudySubject> : {};
        return {
          id: normalizeText(item.id) || `subject-${index + 1}`,
          name: normalizeText(item.name),
          topics: String(item.topics || ''),
          priority: normalizePriority(item.priority),
          weeklyBlocks: Math.max(1, Math.min(8, Number(item.weeklyBlocks || 1))),
        };
      })
    : DEFAULT_FORM.subjects;

  const strategy = ['balanced', 'weakness', 'revision'].includes(String(raw.strategy))
    ? raw.strategy as StudyStrategy
    : DEFAULT_FORM.strategy;

  return {
    objective: normalizeText(raw.objective),
    examDate: normalizeText(raw.examDate),
    hoursPerDay: Math.max(0.5, Math.min(10, Number(raw.hoursPerDay || DEFAULT_FORM.hoursPerDay))),
    sessionMinutes: Math.max(25, Math.min(120, Number(raw.sessionMinutes || DEFAULT_FORM.sessionMinutes))),
    questionGoal: Math.max(0, Math.min(150, Number(raw.questionGoal || DEFAULT_FORM.questionGoal))),
    weekdays: normalizeWeekdays(raw.weekdays),
    strategy,
    subjects,
  };
};

const normalizeGeneratedPlan = (value: unknown): GeneratedStudyPlan | null => {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Partial<GeneratedStudyPlan>;
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map((session, index) => {
        const item = session && typeof session === 'object' ? session as Partial<StudySession> : {};
        return {
          id: normalizeText(item.id) || `session-${index + 1}`,
          weekNumber: Math.max(1, Number(item.weekNumber || 1)),
          dateLabel: normalizeText(item.dateLabel),
          weekdayLabel: normalizeText(item.weekdayLabel),
          subject: normalizeText(item.subject),
          topic: normalizeText(item.topic),
          kind: normalizeText(item.kind),
          durationMinutes: Math.max(1, Number(item.durationMinutes || DEFAULT_FORM.sessionMinutes)),
          questionGoal: Math.max(0, Number(item.questionGoal || 0)),
          priority: normalizePriority(item.priority),
        };
      })
    : [];

  const form = normalizeStudyPlanForm(raw.form);
  const summary = (raw.summary && typeof raw.summary === 'object' ? raw.summary : {}) as Partial<GeneratedStudyPlan['summary']>;
  const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const inferredWeeks = sessions.reduce((maxWeek, session) => Math.max(maxWeek, session.weekNumber), 0);

  return {
    id: normalizeText(raw.id) || `plan-${normalizeText(raw.generatedAt) || new Date().toISOString()}`,
    generatedAt: normalizeText(raw.generatedAt) || new Date().toISOString(),
    form,
    sessions,
    summary: {
      weeks: Math.max(1, Number(summary.weeks || inferredWeeks || 1)),
      totalSessions: Math.max(0, Number(summary.totalSessions || sessions.length)),
      totalHours: Math.max(0, Number(summary.totalHours || Math.round((totalMinutes / 60) * 10) / 10)),
      totalQuestions: Math.max(0, Number(summary.totalQuestions || sessions.reduce((sum, session) => sum + session.questionGoal, 0))),
      subjects: Math.max(0, Number(summary.subjects || form.subjects.filter((subject) => normalizeText(subject.name)).length)),
    },
  };
};

const readLocalSchedule = (userId?: string | null): { form: StudyPlanForm; generatedPlan: GeneratedStudyPlan | null } | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { form?: unknown; generatedPlan?: unknown };
    return {
      form: normalizeStudyPlanForm(parsed.form),
      generatedPlan: normalizeGeneratedPlan(parsed.generatedPlan),
    };
  } catch (error) {
    console.error('Failed to load local study schedule:', error);
    return null;
  }
};

const splitTopics = (value: string) => value
  .split(/\n|,/)
  .map((item) => item.trim())
  .filter(Boolean);

const calculateWeekCount = (examDate: string) => {
  if (!examDate) return 4;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${examDate}T12:00:00`);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (!Number.isFinite(diffDays) || diffDays <= 0) return 2;
  return Math.max(2, Math.min(12, Math.ceil(diffDays / 7)));
};

const buildSubjectPool = (subjects: StudySubject[]) => {
  const validSubjects = subjects.filter((subject) => normalizeText(subject.name));

  if (validSubjects.length === 0) {
    return [{ id: 'general', name: 'Revisão geral', topics: '', priority: 'Média' as SubjectPriority, weeklyBlocks: 1 }];
  }

  return validSubjects.flatMap((subject) => {
    const repeats = Math.max(1, Number(subject.weeklyBlocks || 1) + PRIORITY_WEIGHT[subject.priority]);
    return Array.from({ length: repeats }, () => subject);
  });
};

const resolveSessionKind = (strategy: StudyStrategy, subject: StudySubject, sequence: number) => {
  if (sequence > 0 && sequence % 9 === 0) return 'Simulado curto';
  if (strategy === 'revision') return sequence % 3 === 2 ? 'Revisão ativa' : 'Questões comentadas';
  if (strategy === 'weakness' && subject.priority === 'Alta') return 'Treino de ponto fraco';
  if (sequence % 4 === 1) return 'Teoria objetiva';
  if (sequence % 4 === 2) return 'Questões comentadas';
  return 'Revisão ativa';
};

const generateStudyPlan = (form: StudyPlanForm): GeneratedStudyPlan => {
  const sanitizedForm = cloneForm(form);
  const weekCount = calculateWeekCount(sanitizedForm.examDate);
  const selectedWeekdays = WEEKDAYS.filter((weekday) => sanitizedForm.weekdays.includes(weekday.key));
  const safeWeekdays = selectedWeekdays.length > 0 ? selectedWeekdays : WEEKDAYS.slice(0, 5);
  const blocksPerDay = Math.max(1, Math.min(3, Math.floor((Number(sanitizedForm.hoursPerDay || 1) * 60) / Number(sanitizedForm.sessionMinutes || 50))));
  const subjectPool = buildSubjectPool(sanitizedForm.subjects);
  const startOfWeek = getMonday(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessions: StudySession[] = [];
  let sequence = 0;

  for (let week = 0; week < weekCount; week += 1) {
    safeWeekdays.forEach((weekday) => {
      const date = addDays(startOfWeek, week * 7 + (weekday.jsDay === 0 ? 6 : weekday.jsDay - 1));
      if (date.getTime() < today.getTime()) return;

      for (let block = 0; block < blocksPerDay; block += 1) {
        const subject = subjectPool[sequence % subjectPool.length];
        const topics = splitTopics(subject.topics);
        const topic = topics.length > 0 ? topics[sequence % topics.length] : 'Assunto principal da matéria';

        sessions.push({
          id: `week-${week + 1}-${weekday.key}-${block + 1}`,
          weekNumber: week + 1,
          dateLabel: formatDateLabel(date),
          weekdayLabel: weekday.label,
          subject: subject.name,
          topic,
          kind: resolveSessionKind(sanitizedForm.strategy, subject, sequence),
          durationMinutes: Number(sanitizedForm.sessionMinutes || 50),
          questionGoal: Number(sanitizedForm.questionGoal || 0),
          priority: subject.priority,
        });
        sequence += 1;
      }
    });
  }

  const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);

  return {
    id: `plan-${new Date().toISOString()}`,
    generatedAt: new Date().toISOString(),
    form: sanitizedForm,
    sessions,
    summary: {
      weeks: weekCount,
      totalSessions: sessions.length,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      totalQuestions: sessions.reduce((sum, session) => sum + session.questionGoal, 0),
      subjects: sanitizedForm.subjects.filter((subject) => normalizeText(subject.name)).length,
    },
  };
};

const getPriorityClass = (priority: SubjectPriority) => {
  if (priority === 'Alta') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/20';
  if (priority === 'Média') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20';
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';
};

const MetricCard = ({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) => (
  <div className={`${PANEL_CLASS} px-4 py-3`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{helper}</p>
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        <Icon size={17} />
      </span>
    </div>
  </div>
);

const CronogramaPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { questions, systemSettings, ensureTaxonomiesLoaded } = useData();
  const { addToast } = useToast();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [form, setForm] = useState<StudyPlanForm>(() => cloneForm(DEFAULT_FORM));
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedStudyPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [saveSource, setSaveSource] = useState<'backend' | 'local' | null>(null);
  const hasEliteAccess = isPlanAtLeast(currentUser, 'Elite');
  const isAdminPreview = Boolean(currentUser?.isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'staff');
  const isFeatureEnabled = resolveSystemFeatureFlag(systemSettings, 'studyScheduleEnabled', true);

  React.useEffect(() => {
    if (!isFeatureEnabled && !isAdminPreview) return;
    void ensureTaxonomiesLoaded();
  }, [ensureTaxonomiesLoaded, isAdminPreview, isFeatureEnabled]);

  React.useEffect(() => {
    if ((!isFeatureEnabled && !isAdminPreview) || !hasEliteAccess || !currentUser?.id) return;

    let cancelled = false;
    const loadSchedule = async () => {
      setIsLoadingSchedule(true);

      try {
        const remoteSchedule = await studyScheduleService.get<StudyPlanForm, GeneratedStudyPlan>();
        if (cancelled) return;

        if (remoteSchedule?.form) {
          setForm(normalizeStudyPlanForm(remoteSchedule.form));
          setGeneratedPlan(normalizeGeneratedPlan(remoteSchedule.generatedPlan));
          setSaveSource('backend');
          return;
        }

        const localSchedule = readLocalSchedule(currentUser.id);
        if (!localSchedule || cancelled) {
          setSaveSource(null);
          return;
        }

        setForm(localSchedule.form);
        setGeneratedPlan(localSchedule.generatedPlan);
        setSaveSource('local');

        try {
          await studyScheduleService.save(localSchedule.form, localSchedule.generatedPlan);
          if (!cancelled && typeof window !== 'undefined') {
            window.localStorage.removeItem(getStorageKey(currentUser.id));
            setSaveSource('backend');
          }
        } catch (migrationError) {
          console.error('Failed to migrate local study schedule:', migrationError);
        }
      } catch (error) {
        console.error('Failed to load study schedule:', error);
        if (cancelled) return;

        const localSchedule = readLocalSchedule(currentUser.id);
        if (localSchedule) {
          setForm(localSchedule.form);
          setGeneratedPlan(localSchedule.generatedPlan);
          setSaveSource('local');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSchedule(false);
        }
      }
    };

    void loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, hasEliteAccess, isAdminPreview, isFeatureEnabled]);

  const subjectOptions = useMemo(() => {
    const taxonomySubjects = (systemSettings.taxonomies?.subjects || []).map((item) => normalizeText(item.name));
    const questionSubjects = questions.flatMap((question) => (
      (question.assuntos || [])
        .filter((assunto) => Boolean(assunto.materia))
        .map((assunto) => normalizeText(assunto.name || assunto.nome))
    ));

    return Array.from(new Set([...taxonomySubjects, ...questionSubjects].filter(Boolean))).sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }, [questions, systemSettings.taxonomies?.subjects]);

  const sessionsByWeek = useMemo(() => {
    const groups = new Map<number, StudySession[]>();
    (generatedPlan?.sessions || []).forEach((session) => {
      groups.set(session.weekNumber, [...(groups.get(session.weekNumber) || []), session]);
    });
    return Array.from(groups.entries()).sort(([left], [right]) => left - right);
  }, [generatedPlan?.sessions]);

  const updateForm = <K extends keyof StudyPlanForm>(field: K, value: StudyPlanForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateSubject = (id: string, updates: Partial<StudySubject>) => {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject) => subject.id === id ? { ...subject, ...updates } : subject),
    }));
  };

  const addSubject = () => {
    setForm((current) => ({
      ...current,
      subjects: [
        ...current.subjects,
        {
          id: `subject-${Date.now()}`,
          name: '',
          topics: '',
          priority: 'Média',
          weeklyBlocks: 1,
        },
      ],
    }));
  };

  const removeSubject = (id: string) => {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.length <= 1
        ? current.subjects
        : current.subjects.filter((subject) => subject.id !== id),
    }));
  };

  const toggleWeekday = (key: WeekdayKey) => {
    setForm((current) => {
      const exists = current.weekdays.includes(key);
      const weekdays = exists
        ? current.weekdays.filter((weekday) => weekday !== key)
        : [...current.weekdays, key];

      return { ...current, weekdays };
    });
  };

  const persistPlan = async (nextForm: StudyPlanForm, nextPlan: GeneratedStudyPlan | null): Promise<'backend' | 'local'> => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(getStorageKey(currentUser?.id), JSON.stringify({
        form: nextForm,
        generatedPlan: nextPlan,
        savedAt: new Date().toISOString(),
      }));
    }

    if (!currentUser?.id || !hasEliteAccess) {
      setSaveSource('local');
      return 'local';
    }

    try {
      setIsSavingSchedule(true);
      const savedSchedule = await studyScheduleService.save<StudyPlanForm, GeneratedStudyPlan>(nextForm, nextPlan);

      if (savedSchedule?.form) {
        setForm(normalizeStudyPlanForm(savedSchedule.form));
        setGeneratedPlan(normalizeGeneratedPlan(savedSchedule.generatedPlan));
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(getStorageKey(currentUser.id));
      }

      setSaveSource('backend');
      return 'backend';
    } catch (error) {
      console.error('Failed to persist study schedule:', error);
      setSaveSource('local');
      return 'local';
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const persistLocalPlan = (nextForm: StudyPlanForm, nextPlan: GeneratedStudyPlan | null) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(getStorageKey(currentUser?.id), JSON.stringify({
      form: nextForm,
      generatedPlan: nextPlan,
      savedAt: new Date().toISOString(),
    }));
  };

  const handleGeneratePlan = async () => {
    if (!form.subjects.some((subject) => normalizeText(subject.name))) {
      addToast('Adicione pelo menos uma matéria para gerar o cronograma.', 'warning');
      return;
    }

    setIsGenerating(true);
    await new Promise((resolve) => window.setTimeout(resolve, 250));

    try {
      const nextPlan = generateStudyPlan(form);
      setGeneratedPlan(nextPlan);
      const source = await persistPlan(form, nextPlan);
      addToast(
        source === 'backend'
          ? 'Cronograma gerado e salvo na sua conta.'
          : 'Cronograma gerado. Salvo localmente ate a conexao voltar.',
        source === 'backend' ? 'success' : 'warning'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    const source = await persistPlan(form, generatedPlan);
    addToast(
      source === 'backend'
        ? 'Rascunho do cronograma salvo na sua conta.'
        : 'Rascunho salvo localmente ate a conexao voltar.',
      source === 'backend' ? 'success' : 'warning'
    );
  };

  const handleReset = async () => {
    const nextForm = cloneForm(DEFAULT_FORM);
    setForm(nextForm);
    setGeneratedPlan(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(getStorageKey(currentUser?.id));
    }

    if (currentUser?.id && hasEliteAccess) {
      try {
        setIsSavingSchedule(true);
        await studyScheduleService.remove();
      } catch (error) {
        console.error('Failed to remove study schedule:', error);
        persistLocalPlan(nextForm, null);
        setSaveSource('local');
        addToast('Cronograma limpo neste dispositivo. Tente salvar novamente para sincronizar.', 'warning');
        return;
      } finally {
        setIsSavingSchedule(false);
      }
    }

    setSaveSource(null);
    addToast('Cronograma reiniciado.', 'info');
  };

  if (!isFeatureEnabled && !isAdminPreview) {
    return (
      <BetaFeaturePage
        title="Cronograma de estudos"
        description="Modulo de plano de estudos por disponibilidade, materias, revisoes e metas semanais."
        icon={CalendarDays}
        isEnabled={false}
        featureLabel="Cronograma"
      />
    );
  }

  if (!hasEliteAccess) {
    return (
      <>
        <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
          <header className="space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft size={14} />
              Voltar ao dashboard
            </Link>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                Recurso exclusivo Elite
              </p>
              <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Cronograma de estudos</h1>
              <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
                Crie um plano semanal com matérias, prioridades, revisões e blocos de questões.
              </p>
            </div>
          </header>

          <section className={`${PANEL_CLASS} overflow-hidden`}>
            <div className="grid gap-0 lg:grid-cols-[1fr,320px]">
              <div className="space-y-5 p-6 md:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <Lock size={24} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                    Monte seu plano de estudos no Elite
                  </h2>
                  <p className="max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                    O Cronograma organiza seus dias de estudo por prioridade, carga horária e metas de questões para manter a rotina mais objetiva.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!currentUser) {
                      setShowAuthModal(true);
                      return;
                    }

                    setShowUpgradeModal(true);
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-amber-600"
                >
                  <Crown size={15} />
                  Quero criar meu cronograma
                </button>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950/50 lg:border-l lg:border-t-0">
                <div className="grid gap-3">
                  {[
                    'Dias e carga horária',
                    'Matérias por prioridade',
                    'Metas de questões',
                    'Agenda semanal salva',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                      <Crown size={14} className="text-amber-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title="Entre para criar seu cronograma"
          description="Acesse sua conta para montar e salvar seu plano de estudos."
        />
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          requiredPlan="Elite"
          featureName="Cronograma de estudos"
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      <header className="space-y-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={14} />
          Voltar ao dashboard
        </Link>

        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <Crown size={13} />
              Exclusivo Elite
            </div>
            <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Cronograma de estudos</h1>
            <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
              Crie uma rotina semanal com matérias, revisões, blocos de questões e prioridades do seu concurso.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[560px] xl:grid-cols-4">
            <MetricCard label="Semanas" value={generatedPlan?.summary.weeks || '-'} helper="ciclo gerado" icon={CalendarDays} />
            <MetricCard label="Blocos" value={generatedPlan?.summary.totalSessions || '-'} helper="sessões de estudo" icon={BookOpenCheck} />
            <MetricCard label="Horas" value={generatedPlan ? `${generatedPlan.summary.totalHours}h` : '-'} helper="carga total" icon={Timer} />
            <MetricCard label="Questões" value={generatedPlan?.summary.totalQuestions || '-'} helper="meta planejada" icon={Target} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr),minmax(440px,1.05fr)]">
        <section className={`${PANEL_CLASS} overflow-hidden`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Criar plano</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Defina sua disponibilidade e as matérias que entram no ciclo.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Concurso ou objetivo</span>
                <input
                  value={form.objective}
                  onChange={(event) => updateForm('objective', event.target.value)}
                  className={FIELD_CLASS}
                  placeholder="Ex: TJ-SP, Polícia Civil, Receita Federal..."
                />
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Data da prova</span>
                <input
                  type="date"
                  value={form.examDate}
                  onChange={(event) => updateForm('examDate', event.target.value)}
                  className={FIELD_CLASS}
                />
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Estratégia</span>
                <select
                  value={form.strategy}
                  onChange={(event) => updateForm('strategy', event.target.value as StudyStrategy)}
                  className={FIELD_CLASS}
                >
                  {Object.entries(STRATEGY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Horas por dia</span>
                <input
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={form.hoursPerDay}
                  onChange={(event) => updateForm('hoursPerDay', Number(event.target.value || 1))}
                  className={FIELD_CLASS}
                />
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Minutos por bloco</span>
                <input
                  type="number"
                  min={25}
                  max={120}
                  step={5}
                  value={form.sessionMinutes}
                  onChange={(event) => updateForm('sessionMinutes', Number(event.target.value || 50))}
                  className={FIELD_CLASS}
                />
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Questões por bloco</span>
                <input
                  type="number"
                  min={0}
                  max={150}
                  step={5}
                  value={form.questionGoal}
                  onChange={(event) => updateForm('questionGoal', Number(event.target.value || 0))}
                  className={FIELD_CLASS}
                />
              </label>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Dias de estudo</span>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {WEEKDAYS.map((weekday) => {
                  const active = form.weekdays.includes(weekday.key);
                  return (
                    <button
                      key={weekday.key}
                      type="button"
                      onClick={() => toggleWeekday(weekday.key)}
                      className={`h-10 rounded-xl border text-xs font-black transition ${
                        active
                          ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      {weekday.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Matérias</h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Use prioridades para distribuir melhor o ciclo.</p>
                </div>
                <button
                  type="button"
                  onClick={addSubject}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200"
                >
                  <Plus size={14} />
                  Adicionar
                </button>
              </div>

              <datalist id="cronograma-subject-options">
                {subjectOptions.map((subject) => <option key={subject} value={subject} />)}
              </datalist>

              <div className="space-y-3">
                {form.subjects.map((subject, index) => (
                  <div key={subject.id} className={`${INNER_PANEL_CLASS} p-4`}>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),110px,105px,auto]">
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Matéria</span>
                        <input
                          list="cronograma-subject-options"
                          value={subject.name}
                          onChange={(event) => updateSubject(subject.id, { name: event.target.value })}
                          className={FIELD_CLASS}
                          placeholder={`Matéria ${index + 1}`}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Prioridade</span>
                        <select
                          value={subject.priority}
                          onChange={(event) => updateSubject(subject.id, { priority: event.target.value as SubjectPriority })}
                          className={FIELD_CLASS}
                        >
                          <option value="Alta">Alta</option>
                          <option value="Média">Média</option>
                          <option value="Baixa">Baixa</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Blocos</span>
                        <input
                          type="number"
                          min={1}
                          max={8}
                          value={subject.weeklyBlocks}
                          onChange={(event) => updateSubject(subject.id, { weeklyBlocks: Number(event.target.value || 1) })}
                          className={FIELD_CLASS}
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeSubject(subject.id)}
                          disabled={form.subjects.length <= 1}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-rose-500/10"
                          aria-label="Remover matéria"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <label className="mt-3 block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Assuntos principais</span>
                      <textarea
                        value={subject.topics}
                        onChange={(event) => updateSubject(subject.id, { topics: event.target.value })}
                        className={TEXTAREA_CLASS}
                        placeholder="Um assunto por linha. Ex: controle de constitucionalidade, atos administrativos..."
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row">
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={isGenerating || isSavingSchedule || isLoadingSchedule}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Gerar cronograma
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingSchedule || isLoadingSchedule}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
              >
                {isSavingSchedule ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {isSavingSchedule ? 'Salvando' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isSavingSchedule || isLoadingSchedule}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
              >
                <RotateCcw size={15} />
                Limpar
              </button>
            </div>
          </div>
        </section>

        <section className={`${PANEL_CLASS} overflow-hidden`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                <CalendarDays size={18} />
              </div>
              <div>
                <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Agenda gerada</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {isLoadingSchedule
                    ? 'Carregando seu cronograma salvo...'
                    : generatedPlan
                      ? `${STRATEGY_LABELS[generatedPlan.form.strategy]}${generatedPlan.form.objective ? ` para ${generatedPlan.form.objective}` : ''}.`
                      : 'Gere um cronograma para visualizar seus blocos semanais.'}
                </p>
              </div>
            </div>
          </div>

          {generatedPlan ? (
            <div className="max-h-[760px] space-y-5 overflow-y-auto p-5">
              <div className={`${INNER_PANEL_CLASS} p-4`}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="mt-0.5 text-emerald-500" />
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">Plano salvo</p>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {saveSource === 'local'
                          ? 'Salvo localmente ate a sincronizacao voltar.'
                          : 'Seu cronograma fica salvo na sua conta.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText size={18} className="mt-0.5 text-indigo-500" />
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{generatedPlan.summary.subjects} matérias</p>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Com blocos por prioridade e revisão.</p>
                    </div>
                  </div>
                </div>
              </div>

              {sessionsByWeek.map(([weekNumber, sessions]) => (
                <div key={weekNumber} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Semana {weekNumber}</h3>
                    <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      {sessions.length} blocos
                    </span>
                  </div>

                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <article key={session.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-xl bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
                                {session.weekdayLabel} {session.dateLabel}
                              </span>
                              <span className={`rounded-xl px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getPriorityClass(session.priority)}`}>
                                {session.priority}
                              </span>
                            </div>
                            <h4 className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">{session.subject}</h4>
                            <p className="mt-1 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{session.topic}</p>
                          </div>
                          <div className="shrink-0 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
                            <p>{session.kind}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                              {session.durationMinutes} min · {session.questionGoal} questões
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[520px] items-center justify-center p-8 text-center">
              <div className="max-w-sm">
                <AlertTriangle className="mx-auto text-slate-300 dark:text-slate-600" size={34} />
                <h3 className="mt-4 text-base font-black text-slate-900 dark:text-slate-100">Nenhum cronograma gerado</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                  Preencha sua disponibilidade, ajuste as matérias e clique em gerar cronograma.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CronogramaPage;
