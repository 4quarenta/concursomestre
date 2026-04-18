'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Briefcase,
  Calendar,
  ExternalLink,
  FileText,
  Globe,
  History,
  Info,
  Loader2,
  Lock,
  Search,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import FeaturePlaceholderPage from '@/components/shared/FeaturePlaceholderPage';
import { readApiErrorMessage } from '@/lib/browserApi';
import {
  bankAnalysisService,
  type BankIntelPayload,
  type BankXrayPayload,
} from '@/services/bank-analysis/bankAnalysisService';
import {
  getBenefitRequiredPlan,
  getEffectivePlanDisplayName,
  hasPlanBenefit,
} from '@/services/plans/planAccess';
import type { SystemSettings, TaxonomyItem } from '@/types';

type XRayPageClientProps = {
  systemSettings: SystemSettings;
};

const ANALYSIS_STEPS = [
  { pct: 20, text: 'Conectando a base de provas...' },
  { pct: 45, text: 'Lendo padroes da banca...' },
  { pct: 70, text: 'Separando incidencias por materia...' },
  { pct: 90, text: 'Montando recomendacao estrategica...' },
] as const;

const CHART_COLORS = ['#0f766e', '#0ea5e9', '#e11d48', '#f59e0b', '#6366f1', '#16a34a'] as const;

const ALL_YEARS = 'All';

function formatPercent(value: number) {
  return `${Math.max(0, Math.round(value))}%`;
}

function DistributionSection({
  eyebrow,
  items,
  title,
}: {
  eyebrow: string;
  items: Array<{ name: string; value: number }>;
  title: string;
}) {
  const maxValue = useMemo(
    () => Math.max(...items.map((item) => item.value), 1),
    [items],
  );

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          {eyebrow}
        </p>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">{title}</h2>
      </div>

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">{item.name}</span>
                <span className="font-black text-slate-500 dark:text-slate-400">{item.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max((item.value / maxValue) * 100, 8)}%`,
                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Ainda nao houve retorno suficiente para esta distribuicao.
        </div>
      )}
    </section>
  );
}

function RecommendationBlock({ recommendation }: { recommendation: string }) {
  const paragraphs = useMemo(
    () => recommendation.split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean),
    [recommendation],
  );

  if (!paragraphs.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
          <Sparkles size={18} />
        </div>
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
            Recomendacao estrategica
          </p>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
            O que priorizar a partir do perfil da banca
          </h2>
          <div className="space-y-3 text-sm font-medium leading-7 text-slate-700 dark:text-slate-300">
            {paragraphs.map((paragraph, index) => (
              <p key={`${paragraph.slice(0, 24)}-${index}`} className="whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function XRayPageClient({ systemSettings }: XRayPageClientProps) {
  const { currentUser, isLoading } = useAuthSession();
  const [selectedAgency, setSelectedAgency] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedYear, setSelectedYear] = useState(ALL_YEARS);
  const [stats, setStats] = useState<BankXrayPayload | null>(null);
  const [bankIntel, setBankIntel] = useState<BankIntelPayload | null>(null);
  const [isLoadingBankIntel, setIsLoadingBankIntel] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingText, setLoadingText] = useState('Aguardando parametros da analise...');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  const featureEnabled = systemSettings.features.xRayEnabled !== false;
  const requiredPlan = getBenefitRequiredPlan('xray_banca', systemSettings.planEntitlements);
  const hasAccess = hasPlanBenefit(currentUser, 'xray_banca', systemSettings.planEntitlements);

  const agencies = useMemo(
    () => (systemSettings.taxonomies?.agencies || [])
      .map((item) => item.name)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [systemSettings.taxonomies?.agencies],
  );

  const roles = useMemo(
    () => (systemSettings.taxonomies?.roles || [])
      .map((item) => item.name)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [systemSettings.taxonomies?.roles],
  );

  const years = useMemo(
    () => (systemSettings.taxonomies?.years || [])
      .map((value) => String(value))
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left, 'pt-BR')),
    [systemSettings.taxonomies?.years],
  );

  const selectedAgencyDetails = useMemo<TaxonomyItem | null>(
    () => systemSettings.taxonomies?.agencies?.find((item) => item.name === selectedAgency) || null,
    [selectedAgency, systemSettings.taxonomies?.agencies],
  );

  useEffect(() => {
    if (!selectedAgency || !hasAccess) {
      setStats(null);
      setBankIntel(null);
      setErrorMessage('');
      setIsAnalyzing(false);
      setIsLoadingBankIntel(false);
      setProgress(0);
      setLoadingText('Aguardando parametros da analise...');
      return;
    }

    let cancelled = false;
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    let finishTimeout: ReturnType<typeof setTimeout> | null = null;

    setStats(null);
    setBankIntel(null);
    setErrorMessage('');
    setIsAnalyzing(true);
    setProgress(0);
    setLoadingText(ANALYSIS_STEPS[0].text);

    progressInterval = setInterval(() => {
      setProgress((currentProgress) => {
        const nextStep = ANALYSIS_STEPS.find((step) => step.pct > currentProgress);
        if (!nextStep) {
          return currentProgress;
        }

        setLoadingText(nextStep.text);
        return nextStep.pct;
      });
    }, 550);

    const runIntelRequest = async () => {
      if (!selectedAgencyDetails?.website) {
        return;
      }

      setIsLoadingBankIntel(true);

      try {
        const intel = await bankAnalysisService.getBankIntel(selectedAgencyDetails.website);
        if (!cancelled) {
          setBankIntel(intel);
        }
      } catch {
        if (!cancelled) {
          setBankIntel({ emAndamento: [], realizados: [] });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBankIntel(false);
        }
      }
    };

    const runStatsRequest = async () => {
      try {
        const nextStats = await bankAnalysisService.getXrayStats({
          banca: selectedAgency,
          cargo: selectedRole || undefined,
          ano: selectedYear !== ALL_YEARS ? selectedYear : undefined,
        });

        if (cancelled) {
          return;
        }

        if (progressInterval) {
          clearInterval(progressInterval);
        }

        setProgress(100);
        setLoadingText('Analise concluida.');

        finishTimeout = setTimeout(() => {
          if (cancelled) {
            return;
          }

          setStats(nextStats);
          setIsAnalyzing(false);
        }, 280);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (progressInterval) {
          clearInterval(progressInterval);
        }

        setErrorMessage(readApiErrorMessage(error, 'Nao foi possivel carregar o Raio-X desta banca agora.'));
        setLoadingText('Falha ao finalizar a analise.');
        setIsAnalyzing(false);
      }
    };

    void Promise.all([runIntelRequest(), runStatsRequest()]);

    return () => {
      cancelled = true;

      if (progressInterval) {
        clearInterval(progressInterval);
      }

      if (finishTimeout) {
        clearTimeout(finishTimeout);
      }
    };
  }, [hasAccess, retryToken, selectedAgency, selectedAgencyDetails?.website, selectedRole, selectedYear]);

  if (!featureEnabled) {
    return (
      <FeaturePlaceholderPage
        title="Raio-X da banca"
        description="Modulo reservado para leitura de padroes por banca, cargo e periodo."
        icon={Zap}
        isEnabled={false}
        featureLabel="Raio-X da banca"
        backHref="/"
      />
    );
  }

  if (isLoading) {
    return (
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 className="animate-spin" size={18} />
            <span className="text-sm font-medium">Validando seu acesso ao modulo de Raio-X...</span>
          </div>
        </div>
      </section>
    );
  }

  if (!currentUser || !hasAccess) {
    const currentPlan = getEffectivePlanDisplayName(currentUser);

    return (
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-600 dark:text-amber-300">
            Inteligencia por banca
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            Raio-X da banca
          </h1>
          <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
            Entenda estilo de prova, distribuicao por materia, historico de bancas e prioridades de estudo a partir do banco real de questoes.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
              <Lock size={24} />
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                Acesso controlado
              </p>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                Este modulo faz parte do plano {requiredPlan}
              </h2>
              <p className="text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                O motor de Raio-X consolida incidencia por materia, recorte por cargo, periodo e sinais historicos da banca para orientar seu plano de revisao.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {!currentUser ? (
                <Link
                  href="/auth?next=%2Fx-ray"
                  className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-amber-600"
                >
                  Entrar para desbloquear
                </Link>
              ) : null}
              <Link
                href="/planos?feature=xray"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Ver planos
              </Link>
            </div>
          </section>

          <aside className="space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm dark:border-emerald-900/30 dark:bg-emerald-950/20 md:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
              O que voce recebe
            </p>
            <ul className="space-y-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-3">
                <BarChart3 className="mt-0.5 text-emerald-600 dark:text-emerald-300" size={16} />
                Distribuicao por materia e nivel de dificuldade com leitura imediata.
              </li>
              <li className="flex items-start gap-3">
                <Target className="mt-0.5 text-emerald-600 dark:text-emerald-300" size={16} />
                Prioridades tematicas para decidir onde revisar primeiro.
              </li>
              <li className="flex items-start gap-3">
                <FileText className="mt-0.5 text-emerald-600 dark:text-emerald-300" size={16} />
                Historico de provas e sinais publicos da banca selecionada.
              </li>
            </ul>
            <div className="rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3 text-xs font-bold text-slate-700 dark:border-emerald-900/30 dark:bg-slate-900/70 dark:text-slate-200">
              {currentUser
                ? `Seu plano atual: ${currentPlan}`
                : 'Sem sessao ativa no momento.'}
            </div>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-600 dark:text-amber-300">
            Inteligencia por banca
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Raio-X da banca
            </h1>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-300">
              Plano {requiredPlan}
            </span>
          </div>
          <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
            Selecione a banca, refine o recorte por cargo e periodo e veja onde seu estudo precisa ganhar precisao.
          </p>
        </div>
      </header>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3">
        <label className="space-y-2">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            <Search size={13} />
            Banca
          </span>
          <select
            value={selectedAgency}
            onChange={(event) => {
              setSelectedAgency(event.target.value);
              setSelectedRole('');
              setSelectedYear(ALL_YEARS);
            }}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Selecione...</option>
            {agencies.map((agency) => (
              <option key={agency} value={agency}>
                {agency}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            <Briefcase size={13} />
            Cargo
          </span>
          <select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value)}
            disabled={!selectedAgency}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Geral</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            <Calendar size={13} />
            Periodo
          </span>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            disabled={!selectedAgency}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value={ALL_YEARS}>Todo o periodo</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </section>

      {!selectedAgency ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            <Search size={28} />
          </div>
          <h2 className="mt-5 text-xl font-black text-slate-900 dark:text-slate-100">
            Aguardando a banca para iniciar a analise
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
            Assim que voce escolher a banca, o sistema vai montar o panorama de incidencia, historico de provas e recomendacao de estudo.
          </p>
        </section>
      ) : null}

      {selectedAgency && isAnalyzing ? (
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-14 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
              <BrainCircuit size={40} />
              <div className="absolute inset-0 rounded-full border-4 border-amber-200 border-t-emerald-500 animate-spin dark:border-amber-900/40 dark:border-t-emerald-400" />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                Processamento em andamento
              </p>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">{loadingText}</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Cruzando dados de questoes, provas e sinais da banca {selectedAgency}.
              </p>
            </div>
            <div className="w-full max-w-md space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-sky-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {progress}%
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {selectedAgency && errorMessage && !isAnalyzing ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50/80 px-6 py-8 shadow-sm dark:border-rose-900/30 dark:bg-rose-950/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-700 dark:text-rose-300">
                Falha ao carregar
              </p>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                Nao consegui concluir o Raio-X desta banca agora
              </h2>
              <p className="text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {errorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRetryToken((current) => current + 1)}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Tentar novamente
            </button>
          </div>
        </section>
      ) : null}

      {selectedAgency && stats && !isAnalyzing ? (
        <div className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    Sobre a banca
                  </p>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                    {selectedAgency}
                  </h2>
                  {selectedAgencyDetails?.description ? (
                    <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                      {selectedAgencyDetails.description}
                    </p>
                  ) : null}
                </div>

                {selectedAgencyDetails?.website ? (
                  <a
                    href={selectedAgencyDetails.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Globe size={14} />
                    Site oficial
                    <ExternalLink size={13} />
                  </a>
                ) : null}
              </div>

              {stats.examList.length > 0 ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">
                      <FileText size={13} />
                      Historico de provas
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {stats.examList.length} provas identificadas
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {stats.examList.map((exam) => (
                      <article
                        key={String(exam.id)}
                        className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          {exam.year}
                        </p>
                        <p className="mt-2 text-sm font-bold leading-6 text-slate-800 dark:text-slate-100">
                          {exam.name}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                  <BarChart3 size={13} />
                  Total analisado
                </p>
                <p className="mt-4 text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {stats.total}
                </p>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
                  <Info size={13} />
                  Estilo de prova
                </p>
                <p className="mt-4 text-lg font-black leading-7 text-slate-900 dark:text-slate-100">
                  {stats.textStyle}
                </p>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-rose-600 dark:text-rose-300">
                  <Target size={13} />
                  Contextualizacao
                </p>
                <p className="mt-4 text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {formatPercent(stats.contextUsage)}
                </p>
              </article>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <DistributionSection
              eyebrow="Incidencia por materia"
              title="Distribuicao geral"
              items={stats.subjectData}
            />

            <DistributionSection
              eyebrow="Leitura de dificuldade"
              title="Nivel de dificuldade"
              items={stats.difficultyData}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  O que mais cai
                </p>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                  Raio-X tematico
                </h2>
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Priorize as faixas com maior incidencia dentro de cada materia.
              </p>
            </div>

            {stats.detailedBreakdown.length > 0 ? (
              <div className="mt-5 space-y-4">
                {stats.detailedBreakdown.map((subject, subjectIndex) => (
                  <article
                    key={`${subject.subject}-${subjectIndex}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[subjectIndex % CHART_COLORS.length] }}
                          />
                          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                            {subject.subject}
                          </h3>
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          {subject.total} questoes analisadas
                        </p>
                      </div>

                      <span className="rounded-full border border-slate-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        {formatPercent(subject.percent)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {subject.topics.map((topic, topicIndex) => (
                        <div
                          key={`${subject.subject}-${topic.topic}-${topicIndex}`}
                          className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                              {topic.topic}
                            </p>
                            <span className="text-xs font-black text-slate-500 dark:text-slate-400">
                              {formatPercent(topic.percent)}
                            </span>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.max(Math.min(topic.percent, 100), 6)}%`,
                                backgroundColor: CHART_COLORS[subjectIndex % CHART_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                A analise ainda nao retornou o recorte tematico desta banca.
              </div>
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <RecommendationBlock recommendation={stats.recommendation} />

            <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Sinais publicos
                </p>
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  Inteligencia complementar da banca
                </h2>
              </div>

              {isLoadingBankIntel ? (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  <Loader2 className="animate-spin" size={16} />
                  Buscando historico publico desta banca...
                </div>
              ) : null}

              <div className="space-y-4">
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
                    <Activity size={13} />
                    Em andamento
                  </p>
                  {bankIntel?.emAndamento?.length ? (
                    <div className="space-y-2">
                      {bankIntel.emAndamento.map((item, index) => (
                        <a
                          key={`${item.url}-${index}`}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/70 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-emerald-900/40 dark:hover:bg-emerald-950/20"
                        >
                          {item.text}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Nenhum sinal publico em andamento foi identificado agora.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    <History size={13} />
                    Realizados ou anteriores
                  </p>
                  {bankIntel?.realizados?.length ? (
                    <div className="space-y-2">
                      {bankIntel.realizados.map((item, index) => (
                        <a
                          key={`${item.url}-${index}`}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                        >
                          {item.text}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Nenhum historico complementar foi encontrado nesta consulta.
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </section>
        </div>
      ) : null}
    </section>
  );
}
