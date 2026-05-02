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
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Briefcase,
  Calendar,
  Check,
  ChevronRight,
  Crown,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  Globe,
  History,
  Info,
  Layers3,
  Lightbulb,
  Loader2,
  Lock,
  PieChart as PieIcon,
  Search,
  Target,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import StableResponsiveContainer from '@/components/shared/charts/StableResponsiveContainer';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { PLATFORM_MAIN_CONTENT_WIDTH_CLASS } from '@constants/layout';
import AuthModal from '../../components/shared/overlays/AuthModal';
import UpgradeModal from '../../components/shared/overlays/UpgradeModal';
import { CHART_COLORS } from './constants';
import { bankAnalysisService } from '@services/bank-analysis';
import { getBenefitRequiredPlan, hasPlanBenefit, type CanonicalPlanName } from '@services/plans/planAccess';
import type {
  BankIntelLink,
  BankXrayPayload,
} from '@services/bank-analysis/bankAnalysisService';

type TaxonomyOption = {
  name?: string;
  nome?: string;
  sigla?: string;
  description?: string;
  website?: string;
};

type FlatTopic = {
  subject: string;
  topic: string;
  count: number;
  topicPercent: number;
  examShare: number;
};

type XrayDiagnosis = {
  confidence: {
    label: string;
    helper: string;
    toneClassName: string;
  };
  concentration: {
    value: number;
    label: string;
    helper: string;
  };
  difficulty: {
    score: number;
    label: string;
    helper: string;
  };
  context: {
    label: string;
    helper: string;
  };
  latestYear: string;
  yearsCovered: string[];
  topSubjectName: string;
  topSubjectPercent: number;
  topTopic: FlatTopic | null;
};

const PANEL_CLASS = 'rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const INNER_PANEL_CLASS = 'rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50';
const FIELD_CLASS = 'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-amber-500 dark:focus:bg-slate-900';

const normalizeText = (value: unknown) => String(value || '').trim();

const getTaxonomyName = (item: TaxonomyOption) => normalizeText(item.name || item.nome || item.sigla);

const getUniqueSorted = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort((left, right) => left.localeCompare(right, 'pt-BR'));

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(Number(value || 0))));

const formatPercent = (value: number) => `${clampPercent(value)}%`;

const readNumericYear = (value: unknown) => {
  const match = String(value || '').match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : 0;
};

const getDominantDatum = (items: Array<{ name: string; value: number }>) => (
  [...items].sort((left, right) => Number(right.value || 0) - Number(left.value || 0))[0] || null
);

const getDifficultyWeight = (name: string) => {
  const normalized = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (normalized.includes('dific')) return 3;
  if (normalized.includes('medio') || normalized.includes('media')) return 2;
  return 1;
};

const calculateDifficultyDiagnosis = (stats: BankXrayPayload): XrayDiagnosis['difficulty'] => {
  const total = stats.difficultyData.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (total <= 0) {
    return {
      score: 0,
      label: 'Sem leitura',
      helper: 'A base ainda nao trouxe dificuldade suficiente.',
    };
  }

  const score = stats.difficultyData.reduce((sum, item) => (
    sum + getDifficultyWeight(item.name) * Number(item.value || 0)
  ), 0) / total;
  const dominant = getDominantDatum(stats.difficultyData);

  if (score >= 2.25) {
    return {
      score,
      label: dominant?.name || 'Difícil',
      helper: 'Priorize revisão ativa, questões comentadas e erro recorrente.',
    };
  }

  if (score >= 1.65) {
    return {
      score,
      label: dominant?.name || 'Média',
      helper: 'A banca tende a misturar conceitos diretos com itens interpretativos.',
    };
  }

  return {
    score,
    label: dominant?.name || 'Fácil',
    helper: 'O ganho vem de volume, velocidade e atenção a detalhes do enunciado.',
  };
};

const flattenTopics = (stats: BankXrayPayload): FlatTopic[] => stats.detailedBreakdown
  .flatMap((subject) => (subject.topics || []).map((topic) => ({
    subject: subject.subject,
    topic: topic.topic,
    count: topic.count,
    topicPercent: Number(topic.percent || 0),
    examShare: Number(subject.percent || 0) * Number(topic.percent || 0) / 100,
  })))
  .sort((left, right) => right.examShare - left.examShare);

const buildDiagnosis = (stats: BankXrayPayload): XrayDiagnosis => {
  const total = Number(stats.total || 0);
  const topSubjects = stats.detailedBreakdown.slice(0, 3);
  const concentrationValue = topSubjects.reduce((sum, subject) => sum + Number(subject.percent || 0), 0);
  const flatTopics = flattenTopics(stats);
  const topSubject = stats.detailedBreakdown[0] || null;
  const yearsCovered = getUniqueSorted(
    stats.examList
      .map((exam) => String(readNumericYear(exam.year) || ''))
      .filter(Boolean),
  ).reverse();
  const latestYear = yearsCovered[0] || '-';

  const confidence = total >= 100
    ? {
        label: 'Alta confiabilidade',
        helper: 'Amostra suficiente para orientar prioridade de estudo.',
        toneClassName: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/20',
      }
    : total >= 40
      ? {
          label: 'Boa leitura',
          helper: 'Use como norte, validando com provas recentes.',
          toneClassName: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-500/20',
        }
      : {
          label: 'Amostra inicial',
          helper: 'Interprete como tendencia, nao como regra fechada.',
          toneClassName: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20',
        };

  const concentration = concentrationValue >= 70
    ? {
        value: concentrationValue,
        label: 'Cobrança concentrada',
        helper: 'Poucas matérias explicam boa parte da prova.',
      }
    : concentrationValue >= 45
      ? {
          value: concentrationValue,
          label: 'Cobrança equilibrada',
          helper: 'Ha prioridades claras, mas sem abandonar a base.',
        }
      : {
          value: concentrationValue,
          label: 'Cobrança pulverizada',
          helper: 'A banca espalha temas; organize revisão por blocos.',
        };

  const context = Number(stats.contextUsage || 0) >= 65
    ? {
        label: 'Alta contextualização',
        helper: 'Treine leitura do comando e seleção de dados relevantes.',
      }
    : Number(stats.contextUsage || 0) >= 35
      ? {
          label: 'Contexto moderado',
          helper: 'Mistura questões diretas com enunciados mais interpretativos.',
        }
      : {
          label: 'Questões mais diretas',
          helper: 'Atenção a literalidade, conceitos e exceções.',
        };

  return {
    confidence,
    concentration,
    difficulty: calculateDifficultyDiagnosis(stats),
    context,
    latestYear,
    yearsCovered,
    topSubjectName: topSubject?.subject || 'Sem matéria dominante',
    topSubjectPercent: Number(topSubject?.percent || 0),
    topTopic: flatTopics[0] || null,
  };
};

const buildStrategicInsights = (stats: BankXrayPayload, diagnosis: XrayDiagnosis) => {
  const insights = [
    {
      title: 'Prioridade real de estudo',
      body: diagnosis.topSubjectName !== 'Sem matéria dominante'
        ? `${diagnosis.topSubjectName} concentra ${formatPercent(diagnosis.topSubjectPercent)} da amostra analisada. Comece por ela antes de pulverizar revisão.`
        : 'Ainda nao ha uma matéria dominante para orientar a primeira trilha de estudo.',
      tone: 'indigo',
      icon: Target,
    },
    {
      title: 'Assunto de maior risco',
      body: diagnosis.topTopic
        ? `${diagnosis.topTopic.topic}, em ${diagnosis.topTopic.subject}, aparece como o ponto mais recorrente dentro do recorte.`
        : 'Quando houver mais filtros de assunto, este bloco passa a apontar o tema mais sensível.',
      tone: 'rose',
      icon: AlertTriangle,
    },
    {
      title: 'Como a banca cobra',
      body: `${stats.textStyle}. ${diagnosis.context.helper}`,
      tone: 'amber',
      icon: Gauge,
    },
    {
      title: 'Confiabilidade do recorte',
      body: `${diagnosis.confidence.label}: ${diagnosis.confidence.helper}`,
      tone: 'emerald',
      icon: Check,
    },
  ];

  if (diagnosis.latestYear !== '-') {
    insights.push({
      title: 'Recência da base',
      body: `A prova mais recente identificada no banco é de ${diagnosis.latestYear}. Priorize provas desse ciclo ao revisar.`,
      tone: 'slate',
      icon: Calendar,
    });
  }

  return insights;
};

const toneClasses: Record<string, {
  panel: string;
  icon: string;
  accent: string;
}> = {
  indigo: {
    panel: 'border-indigo-100 bg-indigo-50/70 dark:border-indigo-900/40 dark:bg-indigo-500/10',
    icon: 'bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-300',
    accent: 'text-indigo-700 dark:text-indigo-200',
  },
  rose: {
    panel: 'border-rose-100 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-500/10',
    icon: 'bg-white text-rose-600 dark:bg-slate-900 dark:text-rose-300',
    accent: 'text-rose-700 dark:text-rose-200',
  },
  amber: {
    panel: 'border-amber-100 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-500/10',
    icon: 'bg-white text-amber-600 dark:bg-slate-900 dark:text-amber-300',
    accent: 'text-amber-700 dark:text-amber-200',
  },
  emerald: {
    panel: 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-500/10',
    icon: 'bg-white text-emerald-600 dark:bg-slate-900 dark:text-emerald-300',
    accent: 'text-emerald-700 dark:text-emerald-200',
  },
  slate: {
    panel: 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50',
    icon: 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300',
    accent: 'text-slate-700 dark:text-slate-200',
  },
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  helper,
  tone = 'slate',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  helper: string;
  tone?: keyof typeof toneClasses;
}) => {
  const classes = toneClasses[tone];

  return (
    <div className={`${PANEL_CLASS} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{helper}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${classes.icon}`}>
          <Icon size={18} />
        </span>
      </div>
    </div>
  );
};

const SelectField = ({
  label,
  icon: Icon,
  value,
  disabled,
  children,
  onChange,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-1.5">
    <label className="ml-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors dark:text-slate-500">
      <Icon size={12} /> {label}
    </label>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={FIELD_CLASS}
    >
      {children}
    </select>
  </div>
);

const InsightCard = ({
  title,
  body,
  tone,
  icon: Icon,
}: {
  title: string;
  body: string;
  tone: keyof typeof toneClasses;
  icon: React.ElementType;
}) => {
  const classes = toneClasses[tone];

  return (
    <article className={`rounded-2xl border p-4 ${classes.panel}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${classes.icon}`}>
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <h3 className={`text-sm font-black ${classes.accent}`}>{title}</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">{body}</p>
        </div>
      </div>
    </article>
  );
};

const XrayLoadingState = ({
  loadingText,
  progress,
}: {
  loadingText: string;
  progress: number;
}) => (
  <div className={`${PANEL_CLASS} flex min-h-[360px] flex-col items-center justify-center p-8 text-center`}>
    <div className="relative">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
        <BrainCircuit size={46} />
      </div>
      <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin dark:border-indigo-900/30 dark:border-t-indigo-400" />
    </div>

    <div className="mt-7 w-full max-w-sm space-y-3">
      <h3 className="text-lg font-black text-slate-900 dark:text-white">{loadingText}</h3>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-amber-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{progress}%</p>
    </div>

    <div className="mt-6 flex flex-wrap justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
      <span className="inline-flex items-center gap-2"><Database size={12} /> Base de questões</span>
      <span className="inline-flex items-center gap-2"><Zap size={12} /> Agregação estatística</span>
    </div>
  </div>
);

const EmptyAnalysisState = () => (
  <div className={`${PANEL_CLASS} border-dashed px-6 py-20 text-center`}>
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600">
      <Search size={38} />
    </div>
    <h3 className="mt-6 text-lg font-black text-slate-800 dark:text-slate-200">Aguardando seleção</h3>
    <p className="mx-auto mt-2 max-w-md text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
      Selecione uma banca examinadora para iniciar o diagnóstico.
    </p>
  </div>
);

const NoDataState = () => (
  <div className={`${PANEL_CLASS} border-dashed px-6 py-14 text-center`}>
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-300">
      <AlertTriangle size={30} />
    </div>
    <h3 className="mt-5 text-lg font-black text-slate-900 dark:text-slate-100">Sem dados suficientes para este recorte</h3>
    <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
      Tente remover o filtro de cargo ou ano. O Raio-X precisa de questões vinculadas à banca para gerar uma leitura confiável.
    </p>
  </div>
);

const UpgradeState = ({
  currentUser,
  requiredPlan,
  showAuthModal,
  showUpgradeModal,
  onOpenAuth,
  onOpenUpgrade,
  onCloseAuth,
  onCloseUpgrade,
}: {
  currentUser: unknown;
  requiredPlan: CanonicalPlanName;
  showAuthModal: boolean;
  showUpgradeModal: boolean;
  onOpenAuth: () => void;
  onOpenUpgrade: () => void;
  onCloseAuth: () => void;
  onCloseUpgrade: () => void;
}) => (
  <div className={`${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} mx-auto space-y-6 px-3 pb-20 sm:px-4 md:px-6`}>
    <header>
      <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900 transition-colors dark:text-slate-100">
        <Zap className="text-amber-500 dark:text-amber-400" size={24} /> Raio-X da Banca
      </h1>
      <p className="mt-1 text-sm font-medium text-slate-500 transition-colors dark:text-slate-400">
        Diagnóstico estatístico de cobrança, foco e recorrência por banca examinadora.
      </p>
    </header>

    <div className={`${PANEL_CLASS} relative flex min-h-[360px] items-center justify-center overflow-hidden p-6`}>
      <div className="relative z-10 max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/50 bg-amber-100 text-amber-600 transition-colors dark:bg-amber-900/20 dark:text-amber-400">
          <Lock size={31} />
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 transition-colors dark:text-white">
          Recurso exclusivo {requiredPlan}
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 transition-colors dark:text-slate-400">
          Veja concentração por matéria, tópicos críticos, dificuldade dominante, recência da amostra e recomendações objetivas para estudar melhor.
        </p>
        <button
          type="button"
          onClick={() => {
            if (!currentUser) onOpenAuth();
            else onOpenUpgrade();
          }}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-amber-100 transition-colors hover:bg-amber-600 dark:bg-amber-600 dark:shadow-none dark:hover:bg-amber-700"
        >
          <Crown size={16} /> Desbloquear {requiredPlan}
        </button>
      </div>
      <div className="absolute inset-0 bg-slate-50 opacity-40 transition-colors dark:bg-slate-950" />
    </div>

    <AuthModal
      isOpen={showAuthModal}
      onClose={onCloseAuth}
      title="Desbloqueie o Raio-X"
      description="Entre para acessar análises estratégicas por banca e montar sua trilha de estudo."
    />
    <UpgradeModal
      isOpen={showUpgradeModal}
      onClose={onCloseUpgrade}
      requiredPlan={requiredPlan}
      featureName="Raio-X da Banca"
    />
  </div>
);

const BankInfoPanel = ({
  selectedAgency,
  bankDetails,
  bankScrapedInfo,
  isLoadingBankInfo,
  exams,
}: {
  selectedAgency: string;
  bankDetails: { description?: string; website?: string } | null;
  bankScrapedInfo: { emAndamento: BankIntelLink[]; realizados: BankIntelLink[] } | null;
  isLoadingBankInfo: boolean;
  exams: BankXrayPayload['examList'];
}) => {
  if (!bankDetails?.description && !bankDetails?.website && !bankScrapedInfo && exams.length === 0 && !isLoadingBankInfo) {
    return null;
  }

  return (
    <section className={`${PANEL_CLASS} overflow-hidden`}>
      <header className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/40 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
            <Info size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">Contexto da banca</h2>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{selectedAgency}</p>
          </div>
        </div>

        {bankDetails?.website ? (
          <a
            href={bankDetails.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
          >
            <Globe size={14} /> Site oficial <ExternalLink size={12} />
          </a>
        ) : null}
      </header>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {bankDetails?.description ? (
            <div className={INNER_PANEL_CLASS}>
              <p className="p-4 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">{bankDetails.description}</p>
            </div>
          ) : null}

          {exams.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-300">
                  <FileText size={14} /> Provas na base
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{exams.length} registros</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {exams.slice(0, 8).map((exam) => (
                  <div key={exam.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 transition-colors hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-900/50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[10px] font-black text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                      {exam.year || '-'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-slate-700 dark:text-slate-200" title={String(exam.name)}>{exam.name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prova identificada</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <IntelLinks
            title="Em andamento"
            icon={Activity}
            loading={isLoadingBankInfo}
            items={bankScrapedInfo?.emAndamento || []}
            emptyLabel="Nenhum concurso em andamento evidente."
            tone="emerald"
          />
          <IntelLinks
            title="Realizados"
            icon={History}
            loading={isLoadingBankInfo}
            items={bankScrapedInfo?.realizados || []}
            emptyLabel="Nenhum registro realizado evidente."
            tone="slate"
          />
        </div>
      </div>
    </section>
  );
};

const IntelLinks = ({
  title,
  icon: Icon,
  loading,
  items,
  emptyLabel,
  tone,
}: {
  title: string;
  icon: React.ElementType;
  loading: boolean;
  items: BankIntelLink[];
  emptyLabel: string;
  tone: keyof typeof toneClasses;
}) => {
  const classes = toneClasses[tone];

  return (
    <section>
      <h3 className={`mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest ${classes.accent}`}>
        <Icon size={14} /> {title}
      </h3>
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-4 text-slate-400 dark:bg-slate-800/30">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-xs font-bold">Buscando inteligência...</span>
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-2">
          {items.slice(0, 4).map((item, index) => (
            <a
              key={`${item.url}-${index}`}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl border border-slate-100 bg-white p-3 transition-colors hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-900/50"
            >
              <p className="line-clamp-2 text-[11px] font-bold leading-5 text-slate-600 dark:text-slate-300">{item.text}</p>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{emptyLabel}</p>
        </div>
      )}
    </section>
  );
};

const ExecutiveSummary = ({
  stats,
  diagnosis,
}: {
  stats: BankXrayPayload;
  diagnosis: XrayDiagnosis;
}) => {
  const insights = buildStrategicInsights(stats, diagnosis);

  return (
    <section className={`${PANEL_CLASS} overflow-hidden`}>
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Diagnóstico executivo</p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">O que a banca mostra na prática</h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                Leitura estatística do recorte selecionado, com prioridade, risco e confiabilidade da amostra.
              </p>
            </div>
            <span className={`inline-flex w-fit rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] ${diagnosis.confidence.toneClassName}`}>
              {diagnosis.confidence.label}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {insights.map((insight) => (
              <InsightCard
                key={insight.title}
                title={insight.title}
                body={insight.body}
                tone={insight.tone as keyof typeof toneClasses}
                icon={insight.icon}
              />
            ))}
          </div>
        </div>

        <aside className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60 xl:border-l xl:border-t-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Mapa rápido</p>
          <div className="mt-4 space-y-3">
            <QuickFact label="Matéria dominante" value={diagnosis.topSubjectName} helper={formatPercent(diagnosis.topSubjectPercent)} />
            <QuickFact label="Tópico sensível" value={diagnosis.topTopic?.topic || 'Sem tópico'} helper={diagnosis.topTopic?.subject || '-'} />
            <QuickFact label="Contexto" value={formatPercent(stats.contextUsage)} helper={diagnosis.context.label} />
            <QuickFact label="Estilo" value={stats.textStyle || '-'} helper="Pelo tamanho médio dos enunciados" />
          </div>
        </aside>
      </div>
    </section>
  );
};

const QuickFact = ({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) => (
  <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{label}</p>
    <p className="mt-1 line-clamp-2 text-sm font-black text-slate-900 dark:text-slate-100">{value}</p>
    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{helper}</p>
  </div>
);

const SubjectPriorityPanel = ({
  stats,
}: {
  stats: BankXrayPayload;
}) => (
  <section className={`${PANEL_CLASS} p-5`}>
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Prioridade de estudo</p>
        <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Matérias que mais explicam a prova</h2>
      </div>
      <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        <Layers3 size={13} /> Top {Math.min(stats.detailedBreakdown.length, 6)}
      </span>
    </div>

    <div className="mt-5 space-y-3">
      {stats.detailedBreakdown.slice(0, 6).map((subject, index) => (
        <article key={subject.subject} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[10px] font-black text-white" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}>
                  {index + 1}
                </span>
                <h3 className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{subject.subject}</h3>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {subject.total} questões no recorte, {formatPercent(subject.percent)} de incidência.
              </p>
            </div>
            <span className="w-fit rounded-xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
              Foco {formatPercent(subject.percent)}
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white dark:bg-slate-800">
            <div className="h-full rounded-full" style={{ width: `${clampPercent(subject.percent)}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(subject.topics || []).slice(0, 4).map((topic) => (
              <span key={`${subject.subject}-${topic.topic}`} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <span className="truncate">{topic.topic}</span>
                <strong className="shrink-0 text-indigo-600 dark:text-indigo-300">{formatPercent(topic.percent)}</strong>
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  </section>
);

const TopicRadarPanel = ({
  topics,
}: {
  topics: FlatTopic[];
}) => (
  <section className={`${PANEL_CLASS} p-5`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Radar de cobrança</p>
        <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Assuntos com maior peso estimado</h2>
      </div>
      <Target className="shrink-0 text-rose-500" size={22} />
    </div>

    <div className="mt-5 space-y-3">
      {topics.slice(0, 8).map((topic, index) => (
        <div key={`${topic.subject}-${topic.topic}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-black text-slate-900 dark:text-slate-100">{topic.topic}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{topic.subject}</p>
            </div>
            <span className="shrink-0 rounded-xl bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
              {formatPercent(topic.examShare)}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white dark:bg-slate-800">
            <div className="h-full rounded-full" style={{ width: `${clampPercent(topic.examShare)}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
          </div>
        </div>
      ))}
    </div>
  </section>
);

const ChartsPanel = ({
  stats,
}: {
  stats: BankXrayPayload;
}) => (
  <div className="grid gap-6 lg:grid-cols-2">
    <section className={`${PANEL_CLASS} p-5`}>
      <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
        <PieIcon size={16} className="text-slate-400" /> Distribuição por matéria
      </h2>
      <div className="h-72 min-w-0">
        <StableResponsiveContainer height={288}>
          <PieChart>
            <Pie
              data={stats.subjectData}
              cx="50%"
              cy="50%"
              dataKey="value"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={5}
              label={({ name, percent }) => `${name} ${(Number(percent || 0) * 100).toFixed(0)}%`}
            >
              {stats.subjectData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'rgba(15, 23, 42, 0.92)', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', fontSize: '12px' }} />
          </PieChart>
        </StableResponsiveContainer>
      </div>
    </section>

    <section className={`${PANEL_CLASS} p-5`}>
      <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
        <BarChart3 size={16} className="text-slate-400" /> Dificuldade observada
      </h2>
      <div className="h-72 min-w-0">
        <StableResponsiveContainer height={288}>
          <BarChart data={stats.difficultyData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'rgba(99,102,241,0.08)' }} contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'rgba(15, 23, 42, 0.92)', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', fontSize: '12px' }} />
            <Bar dataKey="value" fill="#6366f1" radius={[10, 10, 0, 0]} barSize={44} />
          </BarChart>
        </StableResponsiveContainer>
      </div>
    </section>
  </div>
);

const RecommendationPanel = ({
  recommendation,
}: {
  recommendation: string;
}) => {
  if (!recommendation) return null;

  return (
    <section className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-indigo-200 dark:from-indigo-900 dark:to-violet-950 dark:shadow-none md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-white/20 bg-white/10 backdrop-blur">
          <BrainCircuit size={32} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight">Recomendação estratégica</h2>
            <span className="w-fit rounded-full border border-amber-300 bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-950">
              Elite Intel
            </span>
          </div>
          <div className="prose prose-invert mt-4 max-w-none text-sm font-medium leading-relaxed opacity-95">
            <ReactMarkdown>{recommendation}</ReactMarkdown>
          </div>
          <div className="mt-5 flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-widest text-white/65">
            <span className="inline-flex items-center gap-2"><History size={14} /> Dados atualizados</span>
            <span className="inline-flex items-center gap-2"><Lightbulb size={14} /> Plano de ataque</span>
          </div>
        </div>
      </div>
    </section>
  );
};

const BankAnalysis: React.FC = () => {
  const { currentUser } = useAuth();
  const { systemSettings } = useData();
  const [selectedAgency, setSelectedAgency] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [stats, setStats] = useState<BankXrayPayload | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [progress, setProgress] = useState(0);
  const [bankDetails, setBankDetails] = useState<{ description?: string; website?: string } | null>(null);
  const [bankScrapedInfo, setBankScrapedInfo] = useState<{ emAndamento: BankIntelLink[]; realizados: BankIntelLink[] } | null>(null);
  const [isLoadingBankInfo, setIsLoadingBankInfo] = useState(false);

  const hasXRayAccess = hasPlanBenefit(currentUser, 'xray_banca', systemSettings.planEntitlements);
  const xrayRequiredPlan = getBenefitRequiredPlan('xray_banca', systemSettings.planEntitlements);

  const agencyOptions = useMemo<TaxonomyOption[]>(
    () => (Array.isArray(systemSettings?.taxonomies?.agencies) ? systemSettings.taxonomies.agencies : []) as TaxonomyOption[],
    [systemSettings],
  );

  const agencies = useMemo(
    () => getUniqueSorted(agencyOptions.map(getTaxonomyName)),
    [agencyOptions],
  );

  const roles = useMemo(() => {
    if (!selectedAgency) return [];
    const source = (Array.isArray(systemSettings?.taxonomies?.roles) ? systemSettings.taxonomies.roles : []) as TaxonomyOption[];
    return getUniqueSorted(source.map(getTaxonomyName));
  }, [selectedAgency, systemSettings]);

  const years = useMemo(() => {
    if (!selectedAgency) return [];
    const source = Array.isArray(systemSettings?.taxonomies?.years) ? systemSettings.taxonomies.years : [];
    return getUniqueSorted(source.map((year) => String(year))).reverse();
  }, [selectedAgency, systemSettings]);

  const diagnosis = useMemo(() => (stats && stats.total > 0 ? buildDiagnosis(stats) : null), [stats]);
  const topTopics = useMemo(() => (stats ? flattenTopics(stats) : []), [stats]);

  useEffect(() => {
    if (!selectedAgency || !hasXRayAccess) {
      setBankDetails(null);
      setBankScrapedInfo(null);
      setStats(null);
      setIsAnalyzing(false);
      return undefined;
    }

    let isActive = true;
    setIsAnalyzing(true);
    setProgress(0);
    setLoadingText('Conectando à base de questões...');
    setStats(null);

    const agencyData = agencyOptions.find((agency) => getTaxonomyName(agency) === selectedAgency);
    setBankDetails(agencyData ? { description: agencyData.description, website: agencyData.website } : null);
    setBankScrapedInfo(null);
    setIsLoadingBankInfo(Boolean(agencyData?.website));

    if (agencyData?.website) {
      bankAnalysisService.getBankIntel(agencyData.website)
        .then((data) => {
          if (!isActive) return;
          setBankScrapedInfo({ emAndamento: data.emAndamento || [], realizados: data.realizados || [] });
        })
        .catch((error) => {
          console.error('Failed fetching bank intel', error);
          if (isActive) setBankScrapedInfo({ emAndamento: [], realizados: [] });
        })
        .finally(() => {
          if (isActive) setIsLoadingBankInfo(false);
        });
    }

    const steps = [
      { pct: 20, text: 'Varrendo questões da banca...' },
      { pct: 45, text: 'Medindo concentração por matéria...' },
      { pct: 70, text: 'Cruzando tópicos, dificuldade e contexto...' },
      { pct: 90, text: 'Montando diagnóstico estratégico...' },
    ];
    let currentStep = 0;

    const interval = window.setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].pct);
        setLoadingText(steps[currentStep].text);
        currentStep += 1;
      }
    }, 450);

    bankAnalysisService.getXrayStats({
      banca: selectedAgency,
      cargo: selectedRole || undefined,
      ano: selectedYear !== 'All' ? selectedYear : undefined,
    }).then((data) => {
      if (!isActive) return;
      window.clearInterval(interval);
      setProgress(100);
      setLoadingText('Diagnóstico concluído');
      window.setTimeout(() => {
        if (!isActive) return;
        setStats(data);
        setIsAnalyzing(false);
      }, 350);
    }).catch((error) => {
      if (!isActive) return;
      console.error('Failed to fetch xray stats', error);
      window.clearInterval(interval);
      setLoadingText('Erro na análise.');
      window.setTimeout(() => {
        if (isActive) setIsAnalyzing(false);
      }, 900);
    });

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [agencyOptions, hasXRayAccess, selectedAgency, selectedRole, selectedYear]);

  if (!hasXRayAccess) {
    return (
      <UpgradeState
        currentUser={currentUser}
        requiredPlan={xrayRequiredPlan}
        showAuthModal={showAuthModal}
        showUpgradeModal={showUpgradeModal}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenUpgrade={() => setShowUpgradeModal(true)}
        onCloseAuth={() => setShowAuthModal(false)}
        onCloseUpgrade={() => setShowUpgradeModal(false)}
      />
    );
  }

  return (
    <div className={`${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} mx-auto space-y-6 px-3 pb-20 sm:px-4 md:px-6`}>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900 transition-colors dark:text-slate-100">
              <Zap className="text-amber-500 dark:text-amber-400" size={24} /> Raio-X da Banca
            </h1>
            <span className="rounded-xl border border-amber-200 bg-amber-100 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-amber-700 transition-colors dark:border-amber-800/50 dark:bg-amber-900/40 dark:text-amber-300">
              {xrayRequiredPlan}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-500 transition-colors dark:text-slate-400">
            Diagnóstico estatístico para entender o que cai, como cai e onde concentrar estudo.
          </p>
        </div>
      </header>

      <section className={`${PANEL_CLASS} p-4 md:p-5`}>
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField
            label="Banca"
            icon={Search}
            value={selectedAgency}
            onChange={(value) => {
              setSelectedAgency(value);
              setSelectedRole('');
              setSelectedYear('All');
            }}
          >
            <option value="">Selecione...</option>
            {agencies.map((agency) => <option key={agency} value={agency}>{agency}</option>)}
          </SelectField>
          <SelectField
            label="Cargo"
            icon={Briefcase}
            value={selectedRole}
            disabled={!selectedAgency}
            onChange={setSelectedRole}
          >
            <option value="">Geral, todos os cargos</option>
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </SelectField>
          <SelectField
            label="Período"
            icon={Calendar}
            value={selectedYear}
            disabled={!selectedAgency}
            onChange={setSelectedYear}
          >
            <option value="All">Todo o período</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </SelectField>
        </div>
      </section>

      {!selectedAgency ? (
        <EmptyAnalysisState />
      ) : isAnalyzing ? (
        <XrayLoadingState loadingText={loadingText} progress={progress} />
      ) : stats && stats.total > 0 && diagnosis ? (
        <div className="space-y-6 animate-slide-up">
          <ExecutiveSummary stats={stats} diagnosis={diagnosis} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Database} label="Amostra" value={stats.total} helper={diagnosis.confidence.helper} tone="indigo" />
            <MetricCard icon={Layers3} label="Concentração" value={formatPercent(diagnosis.concentration.value)} helper={diagnosis.concentration.label} tone="amber" />
            <MetricCard icon={Gauge} label="Dificuldade" value={diagnosis.difficulty.label} helper={diagnosis.difficulty.helper} tone="rose" />
            <MetricCard icon={History} label="Recência" value={diagnosis.latestYear} helper={`${diagnosis.yearsCovered.length || 0} ano(s) cobertos`} tone="emerald" />
          </div>

          <BankInfoPanel
            selectedAgency={selectedAgency}
            bankDetails={bankDetails}
            bankScrapedInfo={bankScrapedInfo}
            isLoadingBankInfo={isLoadingBankInfo}
            exams={stats.examList}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <SubjectPriorityPanel stats={stats} />
            <TopicRadarPanel topics={topTopics} />
          </div>

          <ChartsPanel stats={stats} />
          <RecommendationPanel recommendation={stats.recommendation} />

          <section className={`${PANEL_CLASS} p-5`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">Próximo passo recomendado</h2>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Monte uma bateria de questões com a banca selecionada e comece pelos assuntos do radar.
                  </p>
                </div>
              </div>
              <a
                href={`/practice?agency=${encodeURIComponent(selectedAgency)}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                Treinar essa banca <ChevronRight size={15} />
              </a>
            </div>
          </section>
        </div>
      ) : (
        <NoDataState />
      )}
    </div>
  );
};

export default BankAnalysis;
