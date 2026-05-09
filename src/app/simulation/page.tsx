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


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Subject, SimulationSession, SimulationConfig, Question, TaxonomyItem, UserProfile } from '../../types';
import {
   PlayCircle, Clock, ChevronRight, BrainCircuit, Filter, Target, RotateCcw, LayoutGrid,
   ArrowRight, X, Search, ChevronDown, CheckCircle2, History, Timer, BarChart3, ChevronLeft, Zap, ArrowLeft,
   Calendar, Building2, Briefcase, GraduationCap, BookOpen, List, Eye, LucideIcon
} from 'lucide-react';
import QuestionCard from '../questions/components/QuestionCard';
import { useAuth } from '@providers/AuthProvider';
import { useConfirm } from '@providers/ModalProvider';
import { useToast } from '@providers/ToastProvider';
import { useStudyTrackerActions } from '@providers/StudyTrackerProvider';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { useTaxonomyActions } from '@/state/app-config/useTaxonomyActions';
import { useQuestionBankActions } from '@/state/question-bank/useQuestionBankActions';
import AuthModal from '../../components/shared/overlays/AuthModal';
import UpgradeModal from '../../components/shared/overlays/UpgradeModal';
import { normalizeQuestionRichHtml } from '@services/questions/questionHtmlSanitizer';
import { simulationsService, type StoredSimulationSession } from '@services/simulations';
import {
   ENEM_FOCUS_NAME,
   ENEM_SUBJECT_AREA_OPTIONS,
   getEnemSubjectAreasForQuestion,
   injectEnemFocusOption,
   isEnemQuestion,
   normalizeCareerSelectorLabel,
} from '@services/filters';

const SearchableMultiSelect: React.FC<{
   label: string;
   options: string[];
   selected: string[];
   onChange: (values: string[]) => void;
   placeholder?: string;
   icon: LucideIcon;
   disabled?: boolean;
}> = ({ label, options, selected, onChange, placeholder, icon: Icon, disabled = false }) => {
   const [isOpen, setIsOpen] = useState(false);
   const [search, setSearch] = useState('');
   const containerRef = useRef<HTMLDivElement>(null);
   const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()) && !selected.includes(opt));
   const toggleOption = (opt: string) => {
      if (disabled) return;
      onChange(selected.includes(opt) ? selected.filter(i => i !== opt) : [...selected, opt]);
   };

   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false); };
      document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   return (
      <div className="space-y-1.5 flex-1" ref={containerRef}>
         <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 transition-colors"><Icon size={12} className="text-indigo-500 dark:text-indigo-400" /> {label}</label>
         <div className="relative">
            <div onClick={() => { if (!disabled) setIsOpen(!isOpen); }} className={`min-h-[44px] w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-1.5 flex flex-wrap gap-2 items-center transition-all shadow-sm ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500'}`}>
               {selected.length === 0 ? <span className="text-slate-400 dark:text-slate-500 text-xs font-medium transition-colors">{placeholder || 'Selecionar...'}</span> : selected.map(item => (
                  <span key={item} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-800/30 animate-scale-in transition-colors">
                     {item} <X size={10} className="hover:text-indigo-900 dark:hover:text-indigo-200" onClick={(e) => { e.stopPropagation(); toggleOption(item); }} />
                  </span>
               ))}
               <ChevronDown size={14} className={`ml-auto text-slate-300 dark:text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && !disabled && (
               <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 space-y-3 animate-slide-down transition-colors">
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={14} />
                     <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className="w-full h-9 pl-9 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/10 font-medium text-slate-900 dark:text-slate-100 transition-colors" />
                  </div>
                  <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1">
                     {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                        <button key={opt} onClick={() => { toggleOption(opt); setSearch(''); }} className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors">{opt}</button>
                     )) : <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center py-2 transition-colors">Nenhum resultado</p>}
                  </div>
               </div>
            )}
         </div>
      </div>
   );
};

type SimulationTab = 'ready' | 'custom' | 'results';

type ReadySimulationPreset = {
   id: string;
   title: string;
   description: string;
   config: SimulationConfig;
   details: string[];
};

type SimulationConfigOverrides = Partial<Omit<SimulationConfig, 'filters'>> & {
   filters?: Partial<SimulationConfig['filters']>;
};

type SimulationAnswerValue = SimulationSession['answers'][string];
type SimulationAnswerObject = Exclude<SimulationAnswerValue, number | undefined>;
type SimulationCurrentUser = UserProfile & {
   billing?: {
      plan?: string;
   };
};
type SupportedUserPlan = 'Gratuito' | 'Essencial' | 'Pro' | 'Elite';

const readSimulationTimeMs = () => Date.now();

const getQuestionCorrectIndex = (question: Question) => {
   const correctItem = (question.itens || []).find((item, index) => Number(item.id) === Number(question.resposta) || index === Number(question.resposta));
   return (question.itens || []).indexOf(correctItem ?? null);
};

const getSimulationAnswerObject = (answer: SimulationAnswerValue): SimulationAnswerObject | null => {
   if (answer !== null && answer !== undefined && typeof answer === 'object') {
      return answer;
   }

   return null;
};

const getSimulationSelectedIndex = (answer: SimulationAnswerValue) => {
   const answerObject = getSimulationAnswerObject(answer);
   return answerObject ? Number(answerObject.index ?? -1) : typeof answer === 'number' ? Number(answer) : undefined;
};

const getSimulationAnswerState = (question: Question, answer: SimulationAnswerValue) => {
   const selectedOptionIndex = getSimulationSelectedIndex(answer);

   if (selectedOptionIndex === undefined || selectedOptionIndex < 0) {
      return {
         selectedOptionIndex: undefined,
         isCorrect: false,
      };
   }

   const answerObject = getSimulationAnswerObject(answer);
   return {
      selectedOptionIndex,
      isCorrect: answerObject ? Boolean(answerObject.is_correct) : selectedOptionIndex === getQuestionCorrectIndex(question),
   };
};

const getQuestionRoleLabel = (question: Question) => (
   question.cargos?.map((cargo) => cargo.descricao || cargo.descrição || cargo.name).find(Boolean) || ''
);

const getQuestionLevelLabel = (question: Question) => {
   if (typeof question.nivel === 'string') return question.nivel;
   if (typeof question.level === 'string') return question.level;
   return '';
};

const getTaxonomyNames = (items: TaxonomyItem[] | undefined, resolver: (item: TaxonomyItem) => string | undefined) => (
   (items || []).map(resolver).filter((value): value is string => Boolean(value)).sort()
);

const isEnemSubjectArea = (value: string) => (
   ENEM_SUBJECT_AREA_OPTIONS.includes(value as (typeof ENEM_SUBJECT_AREA_OPTIONS)[number])
);

const getCurrentUserPlan = (user: SimulationCurrentUser | null | undefined): SupportedUserPlan => {
   const plan = user?.billing?.plan || user?.plan;
   return plan === 'Essencial' || plan === 'Pro' || plan === 'Elite' ? plan : 'Gratuito';
};

const buildExistingSimulationAnswer = (question: Question, answer: SimulationAnswerValue, timestamp: number) => {
   const answerState = getSimulationAnswerState(question, answer);

   if (answerState.selectedOptionIndex === undefined) {
      return undefined;
   }

   return {
      questionId: Number(question.id),
      selectedOptionIndex: answerState.selectedOptionIndex,
      isCorrect: answerState.isCorrect,
      timestamp,
   };
};

const createSimulationConfig = (overrides: SimulationConfigOverrides = {}): SimulationConfig => {
   const base: SimulationConfig = {
      id: '',
      name: 'Treino de Performance',
      questionCount: 10,
      subjects: [],
      difficulty: 'All',
      timerEnabled: true,
      timerMinutes: 20,
      feedbackMode: 'after_all',
      filters: { careers: [], agencies: [], years: [], organizations: [], roles: [], levels: [], topics: [] },
   };

   return {
      ...base,
      ...overrides,
      filters: {
         ...base.filters,
         ...(overrides.filters || {}),
      },
   };
};

const getSimulationScore = (session: SimulationSession) => {
   if (typeof session.score === 'number') return session.score;

   return Object.values(session.answers || {}).filter((answer) => {
      const answerObject = getSimulationAnswerObject(answer);
      return answerObject ? Boolean(answerObject.is_correct) : false;
   }).length;
};

const getSimulationAccuracy = (session: SimulationSession) => {
   const total = session.questions?.length || 0;
   if (total === 0) return 0;

   return Math.round((getSimulationScore(session) / total) * 100);
};

const getConfiguredSimulationSeconds = (session: Pick<SimulationSession, 'config'> | null | undefined) => (
   Math.max(0, Math.round(Number(session?.config?.timerMinutes || 0) * 60))
);

const getActiveSimulationElapsedSeconds = (session: Pick<SimulationSession, 'config'> | null | undefined, currentTimeLeft: number) => {
   const configuredSeconds = getConfiguredSimulationSeconds(session);
   if (configuredSeconds <= 0) return 0;

   const safeTimeLeft = Math.max(0, Math.round(Number(currentTimeLeft || 0)));
   return Math.min(configuredSeconds, Math.max(0, configuredSeconds - safeTimeLeft));
};

const getSimulationDurationSeconds = (session: SimulationSession) => {
   const sessionWithLegacyDuration = session as SimulationSession & { duration_seconds?: number };
   const storedDuration = Number(sessionWithLegacyDuration.durationSeconds ?? sessionWithLegacyDuration.duration_seconds);
   if (Number.isFinite(storedDuration) && storedDuration > 0) {
      return Math.round(storedDuration);
   }

   if (session.endTime && session.startTime) {
      return Math.max(0, Math.round((session.endTime - session.startTime) / 1000));
   }

   const answerTime = Object.values(session.answers || {}).reduce<number>((total, answer) => {
      const answerObject = getSimulationAnswerObject(answer);
      const timeTaken = answerObject ? Number(answerObject.time_taken || 0) : 0;
      return total + (Number.isFinite(timeTaken) ? timeTaken : 0);
   }, 0);

   if (answerTime > 0) return Math.round(answerTime);

   return Math.max(0, Number(session.config?.timerMinutes || 0) * 60);
};

const formatSimulationDuration = (seconds: number) => {
   const safeSeconds = Math.max(0, Math.round(seconds || 0));
   const hours = Math.floor(safeSeconds / 3600);
   const minutes = Math.floor((safeSeconds % 3600) / 60);
   const remainingSeconds = safeSeconds % 60;

   if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
   if (minutes > 0) return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`;
   return `${remainingSeconds}s`;
};

const getSimulationDateLabel = (session: SimulationSession) => {
   const timestamp = session.endTime || session.startTime;
   if (!timestamp) return 'Sem data';

   return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
   });
};

const getQuestionSubjectLabel = (question: Question) => {
   return question.assuntos?.find((assunto) => assunto.materia)?.nome || question.assuntos?.[0]?.nome || 'Geral';
};

const isQuestionCorrectInSession = (session: SimulationSession, question: Question) => {
   const answer = (session.answers || {})[String(question.id)];
   return getSimulationAnswerState(question, answer).isCorrect;
};

const buildResultInsights = (session: SimulationSession, historicalAverage: number) => {
   const accuracy = getSimulationAccuracy(session);
   const duration = getSimulationDurationSeconds(session);
   const secondsPerQuestion = session.questions.length > 0 ? Math.round(duration / session.questions.length) : 0;
   const missedQuestions = session.questions.filter((question) => !isQuestionCorrectInSession(session, question));
   const missedBySubject = missedQuestions.reduce<Record<string, number>>((acc, question) => {
      const label = getQuestionSubjectLabel(question);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
   }, {});
   const weakestSubject = Object.entries(missedBySubject).sort((a, b) => b[1] - a[1])[0]?.[0];
   const comparison = historicalAverage > 0
      ? accuracy >= historicalAverage
         ? `${accuracy - historicalAverage} p.p. acima da sua média geral.`
         : `${historicalAverage - accuracy} p.p. abaixo da sua média geral.`
      : 'Este resultado inaugura sua base de comparação.';

   return [
      {
         title: 'Desempenho',
         value: `${accuracy}%`,
         description: comparison,
      },
      {
         title: 'Ritmo',
         value: formatSimulationDuration(secondsPerQuestion),
         description: 'Tempo médio por questão neste simulado.',
      },
      {
         title: 'Prioridade',
         value: weakestSubject || 'Manter ritmo',
         description: weakestSubject
            ? `Revise ${weakestSubject}; foi onde apareceram mais perdas.`
            : 'Sem erros registrados neste simulado.',
      },
   ];
};

const Simulation: React.FC = () => {
   const { currentUser: rawCurrentUser, addSimulation } = useAuth();
   const systemSettings = useAppConfigStore((store) => store.systemSettings);
   const { ensureTaxonomiesLoaded } = useTaxonomyActions();
   const { questions, ensureQuestionsLoaded } = useQuestionBankActions();
   const { addToast } = useToast();
   const confirmDialog = useConfirm();
   const { registerSimulationElapsed } = useStudyTrackerActions();
   const currentUser = rawCurrentUser as SimulationCurrentUser | null;

   const [activeSession, setActiveSession] = useState<SimulationSession | null>(null);
   const [step, setStep] = useState<'config' | 'active' | 'result' | 'review'>('config');
   const [currentIdx, setCurrentIdx] = useState(0);
   const [timeLeft, setTimeLeft] = useState(0);
   const [showPalette, setShowPalette] = useState(false);
   const [reviewIdx, setReviewIdx] = useState(0);
   const [showAuthModal, setShowAuthModal] = useState(false);
   const [authModalConfig, setAuthModalConfig] = useState({ title: '', description: '' });
   const [showUpgradeModal, setShowUpgradeModal] = useState(false);
   const searchParams = useSearchParams();
   const pathname = usePathname() || '/simulation';
   const router = useRouter();

   const [viewMode, setViewMode] = useState<'focus' | 'list'>('focus');
   const [simulationTab, setSimulationTab] = useState<SimulationTab>('ready');
   const [storedSimulations, setStoredSimulations] = useState<StoredSimulationSession[]>([]);
   const [referenceTimeMs, setReferenceTimeMs] = useState(0);

   const allAgencies = useMemo(() => Array.from(new Set(questions.flatMap(q => q.bancas?.map(b => b.sigla || b.nome) || []).filter(Boolean))).sort() as string[], [questions]);
   const allOrgs = useMemo(() => Array.from(new Set(questions.flatMap(q => q.orgaos || []).map(o => o.sigla || o.nome).filter(Boolean))).sort(), [questions]);
   const allRoles = useMemo(() => Array.from(new Set(questions.map(getQuestionRoleLabel).filter(Boolean))).sort(), [questions]);
   const allLevels = useMemo(() => Array.from(new Set(questions.map(getQuestionLevelLabel).filter(Boolean))).sort(), [questions]);

   const [config, setConfig] = useState<SimulationConfig>(() => createSimulationConfig());

   useEffect(() => {
      void ensureQuestionsLoaded();
   }, [ensureQuestionsLoaded]);

   const allTopics = useMemo(() => {
      const relevantQuestions = config.subjects.length > 0
         ? questions.filter((question) => question.assuntos?.some((assunto) => config.subjects.includes(assunto.nome as Subject)))
         : questions;
      return Array.from(new Set(relevantQuestions.flatMap(q => q.assuntos?.map(a => a.nome) || []).filter(Boolean))).sort();
   }, [questions, config.subjects]);

   const isEnemFocus = useMemo(
      () => config.filters.careers.some((career) => normalizeCareerSelectorLabel(career) === ENEM_FOCUS_NAME),
      [config.filters.careers],
   );

   const enemQuestions = useMemo(() => questions.filter(isEnemQuestion), [questions]);

   const simulationCareers = (() => {
      const baseCareers = systemSettings.taxonomies?.careers?.length
         ? getTaxonomyNames(systemSettings.taxonomies.careers, (career) => normalizeCareerSelectorLabel(career.name))
         : Array.from(new Set(questions.flatMap((question) => question.carreiras?.map((career) => normalizeCareerSelectorLabel(career.nome)) || []).filter(Boolean)));

      return injectEnemFocusOption(baseCareers);
   })();

   const simulationSubjects = (() => {
      if (isEnemFocus) return [...ENEM_SUBJECT_AREA_OPTIONS] as string[];

      if (systemSettings.taxonomies?.subjects?.length) {
         return getTaxonomyNames(systemSettings.taxonomies.subjects, (subject) => subject.name);
      }

      return Array.from(new Set(
         questions.flatMap((question) => question.assuntos?.filter((assunto) => assunto.materia).map((assunto) => assunto.nome) || []).filter(Boolean),
      )).sort();
   })();

   const simulationAgencies = (() => {
      if (systemSettings.taxonomies?.agencies?.length) {
         return getTaxonomyNames(systemSettings.taxonomies.agencies, (agency) => agency.slug || agency.name);
      }
      return allAgencies;
   })();

   const simulationOrgs = (() => {
      if (systemSettings.taxonomies?.organizations?.length) {
         return getTaxonomyNames(systemSettings.taxonomies.organizations, (organization) => organization.slug || organization.name);
      }
      return allOrgs;
   })();

   const simulationRoles = (() => {
      if (systemSettings.taxonomies?.roles?.length) {
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         return systemSettings.taxonomies.roles.map((role: any) => role.descricao || role['descrição'] || role.name).filter(Boolean).sort();
      }
      return allRoles;
   })();

   const simulationYears = (() => {
      if (!isEnemFocus && systemSettings.taxonomies?.years?.length) {
         return systemSettings.taxonomies.years.map(String).sort().reverse();
      }
      const sourceQuestions = isEnemFocus ? enemQuestions : questions;
      return Array.from(new Set(sourceQuestions.flatMap((question) => question.anos || []).map(String).filter(Boolean))).sort().reverse();
   })();

   const simulationTopics = (() => {
      if (isEnemFocus) {
         const scopedEnemQuestions = config.subjects.length > 0
            ? enemQuestions.filter((question) =>
               getEnemSubjectAreasForQuestion(question).some((area) => config.subjects.includes(area as Subject)),
            )
            : enemQuestions;

         return Array.from(new Set(
            scopedEnemQuestions.flatMap((question) => question.assuntos?.filter((assunto) => !assunto.materia).map((assunto) => assunto.nome) || []).filter(Boolean),
         )).sort();
      }

      if (systemSettings.taxonomies?.topics?.length) {
         let availableTopics = systemSettings.taxonomies.topics;
         if (config.subjects.length > 0) {
            const subjectIds = new Set(
               (systemSettings.taxonomies.subjects || [])
                  .filter((subject) => config.subjects.includes(subject.name as Subject))
                  .map((subject) => subject.id),
            );
            availableTopics = availableTopics.filter((topic) => !topic.parentId || subjectIds.has(topic.parentId));
         }
         return getTaxonomyNames(availableTopics, (topic) => topic.name);
      }

      return allTopics;
   })();

   const questionsById = useMemo(() => {
      return new Map(questions.map((question) => [Number(question.id), question]));
   }, [questions]);

   useEffect(() => {
      let isMounted = true;
      let frameId = 0;

      if (!currentUser?.id) {
         frameId = window.requestAnimationFrame(() => {
            setStoredSimulations([]);
         });
         return;
      }

      simulationsService.listSimulations()
         .then((sessions) => {
            if (isMounted) setStoredSimulations(sessions);
         })
         .catch((error) => {
            console.warn('Nao foi possivel carregar historico de simulados:', error);
            if (isMounted) setStoredSimulations([]);
         });

      return () => {
         isMounted = false;
         window.cancelAnimationFrame(frameId);
      };
   }, [currentUser?.id]);

   const completedSimulations = useMemo(() => {
      const hydratedStored = storedSimulations.map((session) => ({
         ...session,
         questions: session.questionIds
            .map((questionId) => questionsById.get(Number(questionId)))
            .filter(Boolean) as Question[],
      }));
      const localSessions = currentUser?.simulations || [];
      const byId = new Map<string, SimulationSession>();

      [...hydratedStored, ...localSessions].forEach((session: SimulationSession) => {
         if (session.status === 'completed' && session.questions?.length > 0) {
            byId.set(session.id, session);
         }
      });

      return Array.from(byId.values())
         .sort((a: SimulationSession, b: SimulationSession) => (b.endTime || b.startTime || 0) - (a.endTime || a.startTime || 0));
   }, [currentUser?.simulations, questionsById, storedSimulations]);

   useEffect(() => {
      let frameId = 0;

      frameId = window.requestAnimationFrame(() => {
         setReferenceTimeMs(readSimulationTimeMs());
      });

      return () => {
         window.cancelAnimationFrame(frameId);
      };
   }, [activeSession?.id, step, reviewIdx, currentIdx]);

   const simulationStats = useMemo(() => {
      const completedCount = completedSimulations.length;
      const averageAccuracy = completedCount > 0
         ? Math.round(completedSimulations.reduce((total: number, session: SimulationSession) => total + getSimulationAccuracy(session), 0) / completedCount)
         : 0;
      const averageDurationSeconds = completedCount > 0
         ? Math.round(completedSimulations.reduce((total: number, session: SimulationSession) => total + getSimulationDurationSeconds(session), 0) / completedCount)
         : 0;
      const bestAccuracy = completedCount > 0
         ? Math.max(...completedSimulations.map((session: SimulationSession) => getSimulationAccuracy(session)))
         : 0;

      return {
         completedCount,
         averageAccuracy,
         averageDurationSeconds,
         bestAccuracy,
      };
   }, [completedSimulations]);

   const readySimulationPresets = useMemo<ReadySimulationPreset[]>(() => {
      const presets: ReadySimulationPreset[] = [
         {
            id: 'quick-start',
            title: 'Aquecimento rápido',
            description: 'Uma bateria curta para entrar no ritmo sem configurar filtros.',
            config: createSimulationConfig({
               name: 'Aquecimento rápido',
               questionCount: 10,
               timerMinutes: 20,
            }),
            details: ['10 questões', '20 min', 'Resultado no final'],
         },
         {
            id: 'performance',
            title: 'Treino de performance',
            description: 'Simulado equilibrado para medir consistência e ritmo de prova.',
            config: createSimulationConfig({
               name: 'Treino de performance',
               questionCount: 20,
               timerMinutes: 45,
            }),
            details: ['20 questões', '45 min', 'Todas as matérias'],
         },
      ];

      const firstSubject = simulationSubjects[0];
      if (firstSubject) {
         presets.push({
            id: 'subject-focus',
            title: `Foco em ${firstSubject}`,
            description: 'Pratique uma área específica para encontrar gargalos com mais clareza.',
            config: createSimulationConfig({
               name: `Foco em ${firstSubject}`,
               questionCount: 20,
               subjects: [firstSubject as Subject],
               timerMinutes: 40,
            }),
            details: ['20 questões', '40 min', firstSubject],
         });
      }

      const firstAgency = simulationAgencies[0];
      if (firstAgency) {
         presets.push({
            id: 'agency-focus',
            title: `Banca ${firstAgency}`,
            description: 'Treino direcionado para o estilo de cobrança da banca selecionada.',
            config: createSimulationConfig({
               name: `Banca ${firstAgency}`,
               questionCount: 20,
               timerMinutes: 40,
               filters: { agencies: [firstAgency] },
            }),
            details: ['20 questões', '40 min', firstAgency],
         });
      }

      return presets.slice(0, 4);
   }, [simulationSubjects, simulationAgencies]);

   const historyInsights = useMemo(() => {
      if (simulationStats.completedCount === 0) {
         return [
            'Conclua seu primeiro simulado para liberar comparações de desempenho.',
            'Ao finalizar, você verá tendências de nota, ritmo e temas prioritários.',
         ];
      }

      const latest = completedSimulations[0];
      const latestAccuracy = latest ? getSimulationAccuracy(latest) : 0;
      const trend = latestAccuracy - simulationStats.averageAccuracy;
      const trendLabel = trend >= 0
         ? `Seu último resultado ficou ${trend} p.p. acima da média geral.`
         : `Seu último resultado ficou ${Math.abs(trend)} p.p. abaixo da média geral.`;

      return [
         trendLabel,
         `Seu melhor resultado registrado até agora é ${simulationStats.bestAccuracy}%.`,
         `Seu tempo médio por simulado está em ${formatSimulationDuration(simulationStats.averageDurationSeconds)}.`,
      ];
   }, [completedSimulations, simulationStats]);

   useEffect(() => {
      ensureTaxonomiesLoaded();
   }, [ensureTaxonomiesLoaded]);

   const isImmersiveEnabled = searchParams.get('immersive') === '1';

   const updateImmersiveMode = React.useCallback((enabled: boolean) => {
      const next = new URLSearchParams(searchParams?.toString());
         if (enabled) {
            next.set('immersive', '1');
         } else {
            next.delete('immersive');
         }
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
   }, [pathname, router, searchParams]);

   useEffect(() => {
      if (step === 'config' && isImmersiveEnabled) {
         updateImmersiveMode(false);
      }
   }, [step, isImmersiveEnabled, updateImmersiveMode]);

   // Verificar se o usuário pode criar sim personalizado (apenas Pro ou Elite)
   const canCreateCustomSim = Boolean(currentUser && currentUser.plan && currentUser.plan !== 'Gratuito' && currentUser.plan !== 'Essencial');

   const handleCreate = (overrideConfig?: SimulationConfig) => {
      if (currentUser && !currentUser.emailVerified) {
         setAuthModalConfig({
            title: "Confirme seu E-mail",
            description: "Para realizar simulados e testar seus conhecimentos, você precisa confirmar seu e-mail."
         });
         setShowAuthModal(true);
         return;
      }

      const activeConfig = overrideConfig || config;
      const activeIsEnemFocus = activeConfig.filters.careers.some((career) => normalizeCareerSelectorLabel(career) === ENEM_FOCUS_NAME);
      const filtered = questions.filter(q => {
         const matchSubject = activeConfig.subjects.length === 0 || (
            activeIsEnemFocus
               ? getEnemSubjectAreasForQuestion(q).some((area) => activeConfig.subjects.includes(area as Subject))
               : q.assuntos?.some((assunto) => activeConfig.subjects.includes(assunto.nome as Subject))
         );
         const matchAgency = activeIsEnemFocus || activeConfig.filters.agencies.length === 0 || q.bancas?.some(b => activeConfig.filters.agencies.includes(b.sigla || b.nome));
         const matchYear = activeConfig.filters.years.length === 0 || (q.anos && q.anos.some(y => activeConfig.filters.years.includes(String(y))));
         const matchOrg = activeIsEnemFocus || activeConfig.filters.organizations.length === 0 || q.orgaos?.some(o => activeConfig.filters.organizations.includes(o.sigla || o.nome));
         const matchRole = activeIsEnemFocus || activeConfig.filters.roles.length === 0 || q.cargos?.some((cargo) => activeConfig.filters.roles.includes(cargo.descricao || cargo.descrição || cargo.name || ''));
         const matchLevel = activeIsEnemFocus || activeConfig.filters.levels.length === 0 || activeConfig.filters.levels.includes(getQuestionLevelLabel(q));
         const matchTopic = activeConfig.filters.topics.length === 0 || q.assuntos?.some((assunto) => activeConfig.filters.topics.includes(assunto.nome as Subject));
         const matchCareer = activeConfig.filters.careers.length === 0
            || (
               activeIsEnemFocus
                  ? isEnemQuestion(q)
                  : q.carreiras?.some((career) => activeConfig.filters.careers.includes(normalizeCareerSelectorLabel(career?.nome)))
            );

         return matchSubject && matchAgency && matchYear && matchOrg && matchRole && matchLevel && matchTopic && matchCareer;
      });

      if (filtered.length === 0) return addToast("Nenhuma questao encontrada com esses filtros.", "warning");
      const finalQs = filtered.sort(() => Math.random() - 0.5).slice(0, activeConfig.questionCount);
      setConfig(activeConfig);
      const startedAt = readSimulationTimeMs();
      setActiveSession({ id: `sim-${startedAt}`, config: activeConfig, questions: finalQs, answers: {}, startTime: startedAt, status: 'in_progress' });
      setTimeLeft(activeConfig.timerMinutes * 60); setCurrentIdx(0); setStep('active');
      updateImmersiveMode(true);
   };

   const handleFinish = React.useCallback(() => {
      if (!activeSession) return;
      if (activeSession.status === 'completed') return;

      const finishedAt = readSimulationTimeMs();
      const elapsedSimulationSeconds = getActiveSimulationElapsedSeconds(activeSession, timeLeft);

      const results = activeSession.questions.map((question) => {
         const answerValue = activeSession.answers[String(question.id)];
         const selectedIndex = getSimulationSelectedIndex(answerValue);

         if (selectedIndex === undefined) return { isCorrect: false, index: undefined };

         const correctIndex = getQuestionCorrectIndex(question);
         return { isCorrect: selectedIndex === correctIndex, index: selectedIndex };
      });

      const score = results.filter(r => r.isCorrect && r.index !== undefined).length;

      const enrichedAnswers: SimulationSession['answers'] = {};
      activeSession.questions.forEach((question, i) => {
         const res = results[i];
         // Ensure we capture index even if it is 0
         if (res.index !== undefined) {
            const answerObject = getSimulationAnswerObject(activeSession.answers[String(question.id)]);

            enrichedAnswers[String(question.id)] = {
               index: res.index,
               is_correct: res.isCorrect ? 1 : 0,
               time_taken: answerObject?.time_taken || 0
            };
         }
      });

      const completed = {
         ...activeSession,
         status: 'completed' as const,
         endTime: finishedAt,
         durationSeconds: elapsedSimulationSeconds,
         score,
         answers: enrichedAnswers
      };

      registerSimulationElapsed(activeSession.id, elapsedSimulationSeconds);
      setActiveSession(completed);
      addSimulation(completed);
      setStep('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
   }, [activeSession, addSimulation, registerSimulationElapsed, timeLeft]);

   useEffect(() => {
      if (step !== 'active' || timeLeft <= 0) {
         return;
      }

      const timer = window.setInterval(() => {
         setTimeLeft((previous) => {
            if (previous <= 1) {
               window.clearInterval(timer);
               window.requestAnimationFrame(() => {
                  handleFinish();
               });
               return 0;
            }

            return previous - 1;
         });
      }, 1000);

      return () => clearInterval(timer);
   }, [handleFinish, step, timeLeft]);

   const handleBackToConfig = React.useCallback(() => {
      setStep('config');
      updateImmersiveMode(false);
   }, [updateImmersiveMode]);

   const confirmFinishSimulation = React.useCallback(async () => {
      const confirmed = await confirmDialog({
         title: 'Finalizar simulado?',
         description: 'Você pode revisar respostas agora e ver o resultado final.',
         confirmText: 'Finalizar',
         cancelText: 'Continuar',
         type: 'warning',
      });

      if (!confirmed) {
         return;
      }

      handleFinish();
   }, [confirmDialog, handleFinish]);

   const renderModals = () => (
      <>
         <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            title={authModalConfig.title}
            description={authModalConfig.description}
         />
         <UpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            requiredPlan="Pro"
            featureName="Simulados Personalizados"
         />
      </>
   );

   const handleStartReadyPreset = (preset: ReadySimulationPreset) => {
      if (!currentUser) {
         setAuthModalConfig({
            title: "Inicie seu Treino",
            description: "Entre na sua conta para fazer simulados prontos e salvar seus resultados.",
         });
         setShowAuthModal(true);
         return;
      }

      handleCreate(preset.config);
   };

   const renderSimulationStats = () => (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
         {[
            {
               label: 'Simulados realizados',
               value: simulationStats.completedCount.toString(),
               icon: History,
               helper: simulationStats.completedCount > 0 ? 'Histórico salvo' : 'Nenhum ainda',
            },
            {
               label: 'Média geral',
               value: `${simulationStats.averageAccuracy}%`,
               icon: BarChart3,
               helper: simulationStats.completedCount > 0 ? `Melhor: ${simulationStats.bestAccuracy}%` : 'Sem base ainda',
            },
            {
               label: 'Tempo médio',
               value: formatSimulationDuration(simulationStats.averageDurationSeconds),
               icon: Timer,
               helper: 'Por simulado concluído',
            },
         ].map((item) => {
            const Icon = item.icon;
            return (
               <div key={item.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm transition-colors">
                  <div className="flex items-start justify-between gap-3">
                     <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{item.label}</p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{item.value}</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">{item.helper}</p>
                     </div>
                     <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                        <Icon size={18} />
                     </div>
                  </div>
               </div>
            );
         })}
      </div>
   );

   const renderSimulationTabs = () => {
      const tabs: { id: SimulationTab; label: string; badge?: string }[] = [
         { id: 'ready', label: 'Simulados prontos' },
         { id: 'custom', label: 'Criar o próprio' },
         { id: 'results', label: 'Meus resultados', badge: simulationStats.completedCount > 0 ? String(simulationStats.completedCount) : undefined },
      ];

      return (
         <div className="grid grid-cols-1 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80 sm:grid-cols-3">
            {tabs.map((tab) => (
               <button
                  key={tab.id}
                  onClick={() => setSimulationTab(tab.id)}
                  className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-3 text-center text-[11px] font-black uppercase tracking-widest transition-all ${simulationTab === tab.id ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300'}`}
               >
                  {tab.label}
                  {tab.badge ? <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] text-white">{tab.badge}</span> : null}
               </button>
            ))}
         </div>
      );
   };

   const renderReadySimulations = () => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
         {readySimulationPresets.map((preset) => (
            <div key={preset.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm transition-colors">
               <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                     <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                           <PlayCircle size={22} />
                        </div>
                        <div>
                           <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{preset.title}</h3>
                           <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{preset.details.join(' · ')}</p>
                        </div>
                     </div>
                     <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{preset.description}</p>
                  </div>
                  <button
                     onClick={() => handleStartReadyPreset(preset)}
                     className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-200 transition-all hover:bg-indigo-600 dark:bg-indigo-600 dark:shadow-none dark:hover:bg-indigo-700"
                  >
                     Começar <ChevronRight size={15} />
                  </button>
               </div>
            </div>
         ))}
      </div>
   );

   const renderSimulationResults = () => {
      if (!currentUser) {
         return (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
               <History className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={34} />
               <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Entre para ver seus resultados</h3>
               <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">Seu histórico de simulados, médias e insights ficam salvos na conta.</p>
               <button
                  onClick={() => {
                     setAuthModalConfig({
                        title: 'Acesse sua conta',
                        description: 'Entre para visualizar seu histórico de simulados e acompanhar sua evolução.',
                     });
                     setShowAuthModal(true);
                  }}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-700"
               >
                  Entrar <ArrowRight size={14} />
               </button>
            </div>
         );
      }

      if (completedSimulations.length === 0) {
         return (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
               <BarChart3 className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={34} />
               <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Nenhum resultado ainda</h3>
               <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">Comece por um simulado pronto ou crie um próprio para gerar sua primeira análise.</p>
               <button
                  onClick={() => setSimulationTab('ready')}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700"
               >
                  Ver simulados <ArrowRight size={14} />
               </button>
            </div>
         );
      }

      return (
         <div className="space-y-5">
            <div className="space-y-4">
               {completedSimulations.map((session: SimulationSession) => {
                  const accuracy = getSimulationAccuracy(session);
                  const isAboveAverage = accuracy >= simulationStats.averageAccuracy;
                  return (
                     <div key={session.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm transition-colors">
                        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                           <div className="flex-1 space-y-3">
                              <div>
                                 <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{session.config?.name || 'Simulado concluído'}</h3>
                                 <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                                    {getSimulationDateLabel(session)} · {session.questions.length} questões · {formatSimulationDuration(getSimulationDurationSeconds(session))}
                                 </p>
                              </div>
                              <div>
                                 <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                                    <span>Sua nota</span>
                                    <span className={isAboveAverage ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}>{accuracy}%</span>
                                 </div>
                                 <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                    <div
                                       className={`h-full rounded-full ${isAboveAverage ? 'bg-gradient-to-r from-indigo-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-amber-500'}`}
                                       style={{ width: `${Math.min(100, Math.max(0, accuracy))}%` }}
                                    />
                                 </div>
                                 <p className={`mt-2 flex items-center gap-1.5 text-xs font-bold ${isAboveAverage ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    <CheckCircle2 size={13} />
                                    {isAboveAverage ? 'Acima da média geral' : 'Abaixo da média geral'}
                                 </p>
                              </div>
                           </div>
                           <div className="min-w-[110px] border-t border-slate-100 pt-4 text-left dark:border-slate-800 md:border-l md:border-t-0 md:pl-6 md:pt-0 md:text-center">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Média</p>
                              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{simulationStats.averageAccuracy}%</p>
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>

            <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5 transition-colors dark:border-indigo-900/40 dark:bg-indigo-900/20">
               <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400">
                     <BrainCircuit size={20} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-300">Insights</p>
                     <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-100">Leitura dos seus resultados</h3>
                  </div>
               </div>
               <div className="grid gap-3 md:grid-cols-3">
                  {historyInsights.map((insight) => (
                     <div key={insight} className="rounded-2xl bg-white p-4 text-xs font-bold leading-relaxed text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                        {insight}
                     </div>
                  ))}
               </div>
            </div>
         </div>
      );
   };

   if (systemSettings.features.simulationsEnabled === false) {
      return (
         <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-400 mb-6">
               <GraduationCap size={40} />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Simulados indisponiveis</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm font-medium">Esta funcionalidade foi desabilitada temporariamente pela administracao da plataforma.</p>
            <button
               onClick={() => window.history.back()}
               className="mt-8 flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-indigo-600 text-white text-xs font-black uppercase rounded-xl hover:scale-105 transition-all shadow-lg"
            >
               <ArrowLeft size={16} /> Voltar
            </button>
         </div>
      );
   }

   // if (!currentUser) return null; // Removed to allow guest access

   if (step === 'config') {
      return (
         <div className="w-full space-y-6 px-2 py-4 animate-fade-in sm:px-3 md:space-y-8 md:px-0 md:py-6">
            <header className="text-center space-y-2">
               <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="p-2 bg-indigo-600 dark:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-colors"><Timer size={20} /></div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">Simulados</h1>
               </div>
               <p className="text-slate-400 dark:text-slate-500 text-sm font-medium max-w-lg mx-auto transition-colors">Escolha um simulado pronto, crie seu próprio treino ou acompanhe seus resultados.</p>
            </header>

            {renderSimulationStats()}
            {renderSimulationTabs()}
            {simulationTab === 'ready' ? renderReadySimulations() : null}
            {simulationTab === 'results' ? renderSimulationResults() : null}

            {simulationTab === 'custom' ? (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-7 md:space-y-8 transition-colors">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SearchableMultiSelect
                     label="Foco"
                     icon={Target}
                     options={simulationCareers}
                     selected={config.filters.careers}
                     onChange={(values) => {
                        const hasEnem = values.includes(ENEM_FOCUS_NAME);
                        setConfig((prev) => ({
                           ...prev,
                           subjects: hasEnem
                              ? prev.subjects.filter((subject) => isEnemSubjectArea(subject))
                              : prev.subjects.filter((subject) => !isEnemSubjectArea(subject)),
                           filters: {
                              ...prev.filters,
                              careers: hasEnem ? [ENEM_FOCUS_NAME] : values.map((value) => normalizeCareerSelectorLabel(value)),
                              agencies: hasEnem ? [] : prev.filters.agencies,
                              organizations: hasEnem ? [] : prev.filters.organizations,
                              roles: hasEnem ? [] : prev.filters.roles,
                              levels: hasEnem ? [] : prev.filters.levels,
                           },
                        }));
                     }}
                     placeholder="Selecione o foco..."
                  />
                  <SearchableMultiSelect label="Matérias" icon={Target} options={simulationSubjects} selected={config.subjects} onChange={v => setConfig({ ...config, subjects: v as Subject[] })} placeholder={isEnemFocus ? 'Áreas do ENEM...' : 'Todas as matérias...'} />
                  <SearchableMultiSelect label="Bancas" icon={Filter} options={simulationAgencies} selected={config.filters.agencies} onChange={v => setConfig({ ...config, filters: { ...config.filters, agencies: v } })} placeholder={isEnemFocus ? 'Desativado para ENEM' : 'Todas as bancas...'} disabled={isEnemFocus} />
                  <SearchableMultiSelect label="Anos" icon={Calendar} options={simulationYears} selected={config.filters.years} onChange={v => setConfig({ ...config, filters: { ...config.filters, years: v } })} placeholder="Todos os anos..." />
                  <SearchableMultiSelect label="Orgaos" icon={Building2} options={simulationOrgs} selected={config.filters.organizations} onChange={v => setConfig({ ...config, filters: { ...config.filters, organizations: v } })} placeholder={isEnemFocus ? 'Desativado para ENEM' : 'Todos os orgaos...'} disabled={isEnemFocus} />
                  <SearchableMultiSelect label="Cargos" icon={Briefcase} options={simulationRoles} selected={config.filters.roles} onChange={v => setConfig({ ...config, filters: { ...config.filters, roles: v } })} placeholder={isEnemFocus ? 'Desativado para ENEM' : 'Todos os cargos...'} disabled={isEnemFocus} />
                  <SearchableMultiSelect label="Níveis" icon={GraduationCap} options={allLevels} selected={config.filters.levels} onChange={v => setConfig({ ...config, filters: { ...config.filters, levels: v } })} placeholder={isEnemFocus ? 'Desativado para ENEM' : 'Todos os níveis...'} disabled={isEnemFocus} />
                  <SearchableMultiSelect label="Assuntos (Tópicos)" icon={BookOpen} options={simulationTopics} selected={config.filters.topics} onChange={v => setConfig({ ...config, filters: { ...config.filters, topics: v } })} placeholder="Todos os tópicos..." />
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-6 border-t border-slate-50 dark:border-slate-800 transition-colors">
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Questões</label>
                     <select value={config.questionCount} onChange={e => setConfig({ ...config, questionCount: Number(e.target.value) })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 text-xs focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/10 outline-none transition-all cursor-pointer">
                        {[10, 20, 30, 60, 90].map(v => <option key={v} value={v}>{v} Itens</option>)}
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Tempo (Minutos)</label>
                     <input type="number" min="1" max="300" value={config.timerMinutes} onChange={e => setConfig({ ...config, timerMinutes: Number(e.target.value) })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 text-xs focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/10 outline-none transition-all transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">Modo de Resposta</label>
                     <select value={config.feedbackMode} onChange={e => setConfig({ ...config, feedbackMode: e.target.value as SimulationConfig['feedbackMode'] })} className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 text-xs focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/10 outline-none transition-all cursor-pointer transition-colors">
                        <option value="after_all">Resultado no Final</option>
                        <option value="instant">Feedback Instantâneo</option>
                     </select>
                  </div>
               </div>

               <button onClick={() => {
                  if (!currentUser) {
                     setAuthModalConfig({
                        title: "Inicie seu Treino",
                        description: "Para criar simulados personalizados e acompanhar sua evolução, acesse sua conta."
                     });
                     setShowAuthModal(true);
                     return;
                  }

                  // Feature Gating para simulados personalizados
                  const hasCustomFilters = config.subjects.length > 0 || config.filters.careers.length > 0 || config.filters.agencies.length > 0 || config.filters.years.length > 0;
                  if (hasCustomFilters && !canCreateCustomSim) {
                     setShowUpgradeModal(true);
                     return;
                  }

                  handleCreate();
               }} className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center gap-3 group transition-all">
                  Começar Agora <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
               </button>
            </div>
            ) : null}
            {renderModals()}
         </div>
      );
   }

   if (step === 'active' && activeSession) {
      const q = activeSession.questions[currentIdx];
      return (
         <div className="w-full pb-36 md:pb-32 animate-fade-in">
            <div className="sticky top-2 md:top-4 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 mb-6 md:mb-8 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center shadow-lg transition-colors">
               <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-3 sm:gap-4">
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                     <button
                        onClick={() => setViewMode('focus')}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${viewMode === 'focus' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Modo Foco"
                     >
                        <Eye size={18} />
                     </button>
                     <button
                        onClick={() => setViewMode('list')}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Modo Lista"
                     >
                        <List size={18} />
                     </button>
                  </div>
                  <button onClick={() => setShowPalette(!showPalette)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showPalette ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors'}`}>
                     <LayoutGrid size={18} />
                  </button>
                  <div className="hidden md:block">
                     <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Simulado</h2>
                     <p className="text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors">{viewMode === 'focus' ? `${currentIdx + 1} / ${activeSession.questions.length}` : 'Todos os itens'}</p>
                  </div>
               </div>
               <div className="flex w-full sm:w-auto items-center justify-between gap-3 sm:gap-4">
                  <div className={`px-4 sm:px-5 py-2 rounded-xl font-mono font-black text-base sm:text-lg shadow-inner flex items-center gap-2 transition-colors ${timeLeft < 300 ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 animate-pulse' : 'bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100'}`}>
                     <Clock size={16} className={timeLeft < 300 ? 'text-red-500 dark:text-red-400' : 'text-indigo-400 dark:text-indigo-500'} />
                     {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="flex items-center gap-2">
                     {isImmersiveEnabled && (
                        <button
                           onClick={() => updateImmersiveMode(false)}
                           className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                           title="Sair da tela cheia"
                        >
                           <X size={13} />
                           Sair da tela cheia
                        </button>
                     )}
                     <button onClick={() => void confirmFinishSimulation()} className="px-4 sm:px-5 py-2 bg-indigo-600 dark:bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-emerald-600 dark:hover:bg-emerald-500 shadow-md transition-all">Finalizar</button>
                  </div>
               </div>
            </div>

            {showPalette && (
               <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPalette(false)}>
                  <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl transition-colors animate-scale-in dark:border-slate-800 dark:bg-slate-900 sm:p-8" onClick={e => e.stopPropagation()}>
                     <div className="flex justify-between items-center mb-6">
                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Navegação da Prova</h4>
                        <button onClick={() => setShowPalette(false)} className="text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X size={20} /></button>
                     </div>
                     <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto no-scrollbar p-1">
                        {activeSession.questions.map((_, i) => (
                           <button
                              key={i}
                              onClick={() => { setCurrentIdx(i); setShowPalette(false); }}
                              className={`w-full aspect-square rounded-lg text-xs font-black transition-all border-2 transition-colors ${currentIdx === i ? 'bg-indigo-600 border-indigo-600 text-white shadow-md dark:shadow-none' : activeSession.answers[activeSession.questions[i].id] !== undefined ? 'bg-slate-900 dark:bg-slate-800 border-slate-900 dark:border-slate-700 text-white' : 'bg-white dark:bg-slate-850 border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 hover:border-indigo-200 dark:hover:border-indigo-900'}`}
                           >
                              {i + 1}
                           </button>
                        ))}
                     </div>
                  </div>
               </div>
            )}

            <div className="animate-slide-up w-full space-y-8 px-2 sm:px-3 md:space-y-12 md:px-0">
               {viewMode === 'focus' ? (
                  <>
                     <QuestionCard
                        question={q}
                        indexDisplay={currentIdx + 1}
                        mode="simulation"
                        hideFeedback={config.feedbackMode === 'after_all'}
                        onAnswerSubmit={(ans) => {
                           setActiveSession({
                              ...activeSession,
                              answers: {
                                 ...activeSession.answers,
                                 [q.id]: { index: ans.selectedOptionIndex, is_correct: ans.isCorrect, time_taken: ans.timeTaken }
                              }
                           });
                        }}
                        existingAnswer={buildExistingSimulationAnswer(q, activeSession.answers[String(q.id)], referenceTimeMs)}
                        userPlan={getCurrentUserPlan(currentUser)}
                     />

                     <div className="mt-8 flex flex-wrap items-center justify-between gap-3 px-0 sm:px-2">
                        <button onClick={() => { setCurrentIdx(Math.max(0, currentIdx - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentIdx === 0} className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-all flex items-center gap-2 transition-colors">
                           <ChevronLeft size={16} /> Anterior
                        </button>
                        <button onClick={() => { if (currentIdx === activeSession.questions.length - 1) { handleFinish(); } else { setCurrentIdx(currentIdx + 1); } window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-6 sm:px-10 py-2.5 sm:py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 dark:shadow-none hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all flex items-center gap-2">
                           {currentIdx === activeSession.questions.length - 1 ? 'Entregar Prova' : 'Próxima'} <ChevronRight size={16} />
                        </button>
                     </div>
                  </>
               ) : (
                  <div className="space-y-12">
                     {activeSession.questions.map((question, idx) => (
                        <div key={question.id} id={`q-${idx}`} className="scroll-mt-32">
                           <QuestionCard
                              question={question}
                              indexDisplay={idx + 1}
                              mode="simulation"
                              hideFeedback={config.feedbackMode === 'after_all'}
                              onAnswerSubmit={(ans) => {
                                 setActiveSession({
                                    ...activeSession,
                                   answers: {
                                      ...activeSession.answers,
                                      [question.id]: { index: ans.selectedOptionIndex, is_correct: ans.isCorrect, time_taken: ans.timeTaken }
                                   }
                                });
                              }}
                              existingAnswer={buildExistingSimulationAnswer(question, activeSession.answers[String(question.id)], referenceTimeMs)}
                              userPlan={getCurrentUserPlan(currentUser)}
                           />
                        </div>
                     ))}
                     <div className="flex justify-center pt-8">
                        <button onClick={() => void confirmFinishSimulation()} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all transform hover:scale-105 sm:px-12">
                           Finalizar e Ver Resultado
                        </button>
                     </div>
                  </div>
               )}
            </div>
            {renderModals()}
         </div>
      );
   }

   if (step === 'result' && activeSession) {
      const accuracy = Math.round((activeSession.score! / activeSession.questions.length) * 100);
      const durationSeconds = getSimulationDurationSeconds(activeSession);
      const resultInsights = buildResultInsights(activeSession, simulationStats.averageAccuracy);
      return (
         <div className="w-full space-y-6 px-2 py-4 animate-fade-in sm:px-3 md:space-y-8 md:px-0 md:py-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
               <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">Resultado Final</h1>
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-medium transition-colors">Confira seu desempenho detalhado neste simulado.</p>
               </div>
               <div className="flex items-center gap-2">
                  {isImmersiveEnabled && (
                     <button
                        onClick={() => updateImmersiveMode(false)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-indigo-400"
                        title="Sair da tela cheia"
                     >
                        <X size={13} />
                        Sair da tela cheia
                     </button>
                  )}
                  <button onClick={handleBackToConfig} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all">
                     <RotateCcw size={14} /> Novo Treino
                  </button>
               </div>
            </header>

            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 md:p-10 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-8 md:gap-10 transition-colors">
               <div className={`w-32 h-32 rounded-full border-[8px] flex flex-col items-center justify-center relative transition-colors ${accuracy >= 70 ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-amber-500 text-amber-600 dark:text-amber-400'}`}>
                  <div className="absolute inset-0 bg-current opacity-5 rounded-full" />
                  <span className="text-3xl font-black">{accuracy}%</span>
                  <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Acertos</span>
               </div>
               <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest transition-colors">Geral</p>
                     <p className="text-2xl font-black text-slate-800 dark:text-slate-100 transition-colors">{activeSession.score} / {activeSession.questions.length}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest transition-colors">Tempo Total</p>
                     <p className="text-2xl font-black text-slate-800 dark:text-slate-100 transition-colors">{formatSimulationDuration(durationSeconds)}</p>
                  </div>
                  <div className="col-span-2 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center gap-3 transition-colors">
                     <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm transition-colors"><Zap size={18} /></div>
                     <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                        {accuracy >= 70
                           ? "Excelente performance! Você está acima da média para este certame."
                           : "Bom treino! Foque em revisar as questões que errou para consolidar o aprendizado."}
                     </p>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-3 px-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                     <BrainCircuit size={18} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Insights do resultado</p>
                     <h3 className="text-base font-black text-slate-900 dark:text-slate-100">O que este simulado indica</h3>
                  </div>
               </div>
               <div className="grid gap-4 md:grid-cols-3">
                  {resultInsights.map((insight) => (
                     <div key={insight.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{insight.title}</p>
                        <p className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">{insight.value}</p>
                        <p className="mt-2 text-xs font-bold leading-relaxed text-slate-500 dark:text-slate-400">{insight.description}</p>
                     </div>
                  ))}
               </div>
            </div>

            <div className="space-y-4">
               <div className="flex justify-between items-center px-1">
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Revisão de Questões</h3>
                  <div className="flex items-center gap-2">
                     <button onClick={() => setViewMode('focus')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'focus' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Modo Foco"><List size={14} /></button>
                     <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Modo Lista"><LayoutGrid size={14} /></button>
                  </div>
               </div>
               <div className={`space-y-3 ${viewMode === 'list' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 space-y-0' : ''}`}>
                  {activeSession.questions.map((q, i) => {
                     // Correctly find if answer is right
                     const answerState = getSimulationAnswerState(q, activeSession.answers[String(q.id)]);
                     const selectedIndex = answerState.selectedOptionIndex;
                     const isCorrect = answerState.isCorrect;

                     return (
                        <button
                           key={q.id}
                           onClick={() => { setReviewIdx(i); setStep('review'); }}
                           className="w-full bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-indigo-300 dark:hover:border-indigo-600 transition-all text-left shadow-sm transition-colors"
                        >
                           <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-colors ${selectedIndex === undefined ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : isCorrect ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                 <div className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" dangerouslySetInnerHTML={{ __html: normalizeQuestionRichHtml(q.enunciado_clean || q.enunciado || 'Questao sem enunciado...') }} />
                                 <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium transition-colors truncate">{(q.assuntos && q.assuntos.length > 0) ? q.assuntos[0].nome : 'Geral'} ? {q.topic || 'Geral'}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded transition-colors ${selectedIndex === undefined ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : isCorrect ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{selectedIndex === undefined ? 'Em Branco' : isCorrect ? 'Acerto' : 'Erro'}</span>
                              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 dark:group-hover:text-indigo-500 transition-colors" />
                           </div>
                        </button>
                     );
                  })}
               </div>
            </div>
            {renderModals()}
         </div>
      );
   }

   if (step === 'review' && activeSession) {
      const q = activeSession.questions[reviewIdx];
      return (
         <div className="w-full px-2 pb-36 animate-fade-in sm:px-3 md:px-0 md:pb-32">
            <div className="sticky top-2 md:top-4 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 mb-6 md:mb-8 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center shadow-lg transition-colors">
               <button onClick={() => setStep('result')} className="flex items-center gap-2 px-3 sm:px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-[10px] font-black uppercase transition-all">
                  <ArrowLeft size={16} /> Voltar ao Resumo
               </button>
               <div className="flex items-center gap-2 sm:justify-center">
                  <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest transition-colors">Revisão</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors">{reviewIdx + 1} / {activeSession.questions.length}</span>
               </div>
               <div className="flex gap-2 sm:justify-end">
                  {isImmersiveEnabled && (
                     <button
                        onClick={() => updateImmersiveMode(false)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 transition-colors hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-indigo-400"
                        title="Sair da tela cheia"
                     >
                        <X size={12} />
                        Sair
                     </button>
                  )}
                  <button onClick={() => setReviewIdx(Math.max(0, reviewIdx - 1))} disabled={reviewIdx === 0} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-colors"><ChevronLeft size={18} /></button>
                  <button onClick={() => setReviewIdx(Math.min(activeSession.questions.length - 1, reviewIdx + 1))} disabled={reviewIdx === activeSession.questions.length - 1} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-colors"><ChevronRight size={18} /></button>
               </div>
            </div>

            <div className="animate-slide-up w-full px-2 sm:px-3 md:px-0">
               <QuestionCard
                  question={q}
                  indexDisplay={reviewIdx + 1}
                  mode="simulation"
                  hideFeedback={false}
                  onAnswerSubmit={() => { }}
                  existingAnswer={buildExistingSimulationAnswer(q, activeSession.answers[String(q.id)], referenceTimeMs)}
                  userPlan={getCurrentUserPlan(currentUser)}
               />
            </div>

            <div className="mt-8 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl p-5 sm:p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 transition-colors">
               <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0 transition-colors"><Zap size={28} /></div>
               <div>
                  <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-100 uppercase mb-1 transition-colors">Dica de Estudo</h4>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed font-medium transition-colors">Revise os fundamentos e veja os comentários para consolidar o aprendizado deste tópico sem distrações.</p>
               </div>
            </div>
            {renderModals()}
         </div>
      );
   }

   return (
      <>
         <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            title={authModalConfig.title}
            description={authModalConfig.description}
         />
         <UpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            requiredPlan="Pro"
            featureName="Simulados Personalizados"
         />
      </>
   );
};

export default Simulation;
