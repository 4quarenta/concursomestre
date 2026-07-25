'use client';

import React from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '@services/api';
import {
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';
import {
  collectGranQuestions,
  pingGranCollector,
} from './granExtensionBridge';
import type { GranCollectorStatus } from './granExtensionBridge';

type GranQuestion = {
  tempId: string;
  filters?: {
    careers?: Array<{ id?: string | number | null; label?: string; slug?: string }>;
  };
};

export type GranImportPayload = {
  schemaVersion: 'question-import.v2';
  exam: {
    sourceKey?: string;
    externalId?: string | null;
    title?: string;
    agency?: string | null;
    organizations?: string[];
    roles?: string[];
    year?: number | null;
    files?: Array<{
      kind: 'edital' | 'prova' | 'gabarito';
      name: string;
      sourceUrl?: string;
      status?: string;
    }>;
    questionRange?: {
      start?: number | null;
      end?: number | null;
      total?: number | null;
    };
  };
  contexts: Array<{
    tempId: string;
    questionNumbers?: number[];
    [key: string]: unknown;
  }>;
  questions: GranQuestion[];
  [key: string]: unknown;
};

type GranFetchResult = {
  page: number;
  perPage: number;
  total: number;
  pages: number;
  requestUrl?: string;
  tokenExpiresAt?: string | null;
  questionCount: number;
  fileCount?: number;
  payloads: GranImportPayload[];
};

type GranJob = {
  jobId: number;
  status: 'pending' | 'processing' | 'done' | 'failed' | string;
  attempts: number;
  error?: string | null;
  createdAt?: string | null;
  result?: {
    createdQuestionIds?: Array<string | number>;
  } | null;
};

type AdminGranCrawlerSectionProps = {
  renderReviewQueue?: (payloads: GranImportPayload[]) => React.ReactNode;
};

type CollectorState = 'checking' | 'ready' | 'disconnected' | 'missing';

const ENDPOINT = 'admin/gran_crawler.php';
const GRAN_API_ENDPOINT = 'https://rota-api.grancursosonline.com.br/v1/elastic/questao';
const EXTENSION_DOWNLOAD_URL = '/downloads/concursomestre-coletor-gran-v1.0.6.zip';

const statusLabel: Record<string, string> = {
  pending: 'Na fila',
  processing: 'Processando',
  done: 'Concluído',
  failed: 'Falhou',
};

const readApiData = <T,>(response: { data?: unknown }): T => {
  const body = response.data as { data?: T } | T | undefined;
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Agora';
  const parsed = new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'));
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR');
};

const describeCollectorCaptureStatus = (status: GranCollectorStatus | null) => {
  switch (status?.captureState) {
    case 'origin_rejected':
      return 'A API foi acessada por uma origem diferente da página oficial da Gran.';
    case 'authorization_missing':
      return 'A API respondeu, mas a requisição observada não continha uma sessão autenticada.';
    case 'client_mismatch':
      return 'A sessão Gran apresentou identificadores divergentes. Saia e entre novamente na Gran.';
    case 'invalid_credential':
      return 'A credencial observada está inválida ou expirada. Autentique-se novamente na Gran.';
    case 'waiting':
    default:
      return 'Aguardando uma requisição autenticada da Gran. Recarregue uma página após o login.';
  }
};

const AdminGranCrawlerSection = ({
  renderReviewQueue,
}: AdminGranCrawlerSectionProps) => {
  const [granRequestUrl, setGranRequestUrl] = React.useState('');
  const [collectorState, setCollectorState] = React.useState<CollectorState>('checking');
  const [collectorStatus, setCollectorStatus] = React.useState<GranCollectorStatus | null>(null);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);
  const [year, setYear] = React.useState('');
  const [result, setResult] = React.useState<GranFetchResult | null>(null);
  const [jobs, setJobs] = React.useState<GranJob[]>([]);
  const [isFetching, setIsFetching] = React.useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isPageVisible, setIsPageVisible] = React.useState(true);
  const fetchAbortRef = React.useRef<AbortController | null>(null);
  const hasActiveJobs = jobs.some((job) => ['pending', 'processing'].includes(job.status));

  const checkCollector = React.useCallback(async (showFailure = false) => {
    setCollectorState('checking');
    try {
      const status = await pingGranCollector();
      setCollectorStatus(status);
      setCollectorState(status.connected ? 'ready' : 'disconnected');
      if (showFailure && !status.connected) setError(describeCollectorCaptureStatus(status));
      return status.connected;
    } catch {
      setCollectorStatus(null);
      setCollectorState('missing');
      if (showFailure) {
        setError('Extensão privada não detectada. Instale ou recarregue o coletor Gran.');
      }
      return false;
    }
  }, []);

  const loadJobs = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoadingJobs(true);
    try {
      const response = await apiClient.get(ENDPOINT);
      const data = readApiData<{ jobs?: GranJob[] }>(response);
      setJobs(Array.isArray(data?.jobs) ? data.jobs : []);
    } catch (requestError) {
      if (!silent) {
        setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar a fila.');
      }
    } finally {
      if (!silent) setIsLoadingJobs(false);
    }
  }, []);

  React.useEffect(() => {
    void Promise.resolve().then(() => loadJobs(true));
    void Promise.resolve().then(() => checkCollector());
    return () => fetchAbortRef.current?.abort();
  }, [checkCollector, loadJobs]);

  React.useEffect(() => {
    const handleVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setIsPageVisible(visible);
      if (visible) {
        void loadJobs(true);
        void checkCollector();
      }
    };
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkCollector, loadJobs]);

  React.useEffect(() => {
    if (!hasActiveJobs || !isPageVisible) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadJobs(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, isPageVisible, loadJobs]);

  const handleDirectUrlChange = React.useCallback((value: string) => {
    setGranRequestUrl(value);
    try {
      const parsed = new URL(value);
      const directPage = Number(parsed.searchParams.get('page'));
      const directPerPage = Number(parsed.searchParams.get('perPage'));
      if (Number.isInteger(directPage) && directPage >= 1 && directPage <= 1_000_000) {
        setPage(directPage);
      }
      if (Number.isInteger(directPerPage) && directPerPage >= 1 && directPerPage <= 50) {
        setPerPage(directPerPage);
      }
    } catch {
      // O backend apresenta a validação autoritativa ao consultar.
    }
  }, []);

  const updateDirectUrlPagination = React.useCallback((key: 'page' | 'perPage', value: number) => {
    setGranRequestUrl((current) => {
      if (!current.trim()) return current;
      try {
        const parsed = new URL(current);
        parsed.searchParams.set(key, String(value));
        return parsed.toString();
      } catch {
        return current;
      }
    });
  }, []);

  const handleFetch = React.useCallback(async (requestedPage?: number) => {
    if (collectorState !== 'ready') {
      const ready = await checkCollector(true);
      if (!ready) return;
    }

    const targetPage = requestedPage ?? page;
    let requestUrl = granRequestUrl.trim();
    if (!requestUrl) {
      const params = new URLSearchParams({
        perPage: String(perPage),
        page: String(targetPage),
        marcarResolvidas: '1',
        resolucao: 'TODAS',
        anulada: '0',
        desatualizada: '0',
        tiposProva: '1',
        sort: '[{"anos":"desc"},{"_score":"desc"}]',
      });
      if (year.trim()) params.append('anos[]', year.trim());
      requestUrl = `${GRAN_API_ENDPOINT}?${params.toString()}`;
      setGranRequestUrl(requestUrl);
    } else if (requestedPage !== undefined) {
      try {
        const parsed = new URL(requestUrl);
        parsed.searchParams.set('page', String(targetPage));
        requestUrl = parsed.toString();
        setGranRequestUrl(requestUrl);
      } catch {
        // O backend retorna mensagem segura para URL inválida.
      }
    }

    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setIsFetching(true);
    setError('');
    try {
      const collection = await collectGranQuestions(requestUrl);
      const response = await apiClient.post(ENDPOINT, {
        action: 'map',
        granResponse: collection.json,
        granExamFiles: collection.examFiles,
        granRequestUrl: collection.requestUrl,
        page: targetPage,
        perPage,
        year: year.trim(),
      }, { signal: controller.signal });
      const data = readApiData<GranFetchResult>(response);
      setResult(data);
      setPage(data.page);
      setPerPage(data.perPage);
      if (data.requestUrl) setGranRequestUrl(data.requestUrl);

    } catch (requestError: unknown) {
      if (controller.signal.aborted) return;
      const axiosError = requestError as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setError(axiosError.response?.data?.message || axiosError.message || 'Não foi possível consultar a Gran.');
    } finally {
      if (!controller.signal.aborted) setIsFetching(false);
    }
  }, [checkCollector, collectorState, granRequestUrl, page, perPage, year]);

  return (
    <div className="space-y-5">
      <section className={ADMIN_PAGE_PANEL_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Coleta autenticada
            </p>
            <h2 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">Crawler Gran</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Consulte as questões e revise cada prova diretamente nesta fila. A chamada Gran sai pelo
              seu Chrome; a plataforma recebe somente o JSON coletado, nunca a credencial.
            </p>
          </div>
          <a
            href="https://questoes.grancursosonline.com.br/"
            target="_blank"
            rel="noreferrer"
            className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-2 text-xs`}
          >
            Abrir Gran
          </a>
        </div>
      </section>

      <section className={`${ADMIN_PAGE_PANEL_CLASS} space-y-5`}>
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Extensão privada
          </span>
          <div className={`flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 ${
            collectorState === 'ready'
              ? 'border-emerald-200 bg-emerald-50'
              : collectorState === 'disconnected'
                ? 'border-amber-200 bg-amber-50'
                : 'border-slate-200 bg-slate-50'
          }`}
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
              {collectorState === 'checking'
                ? <Loader2 size={15} className="animate-spin" />
                : <PlugZap size={15} />}
              {collectorState === 'ready'
                ? `Conectada${collectorStatus?.version ? ` - v${collectorStatus.version}` : ''}`
                : collectorState === 'disconnected'
                  ? `Instalada${collectorStatus?.version ? ` - v${collectorStatus.version}` : ''}, aguardando sessão`
                  : collectorState === 'missing'
                    ? 'Não detectada'
                    : 'Verificando...'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void checkCollector(true)}
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-1.5 text-[10px]`}
              >
                <RefreshCw size={13} />
                Verificar
              </button>
              <a
                href={EXTENSION_DOWNLOAD_URL}
                download
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-1.5 text-[10px]`}
              >
                <Download size={13} />
                Baixar
              </a>
            </div>
          </div>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            Remova a versão anterior, baixe a v1.0.6 e carregue a nova pasta em
            {' '}
            <strong>chrome://extensions</strong>
            . Se já estiver logado, recarregue uma página da Gran; esta aba reconhecerá a sessão.
          </p>
        </div>

        <label className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            URL direta da consulta (opcional)
          </span>
          <input
            type="url"
            value={granRequestUrl}
            onChange={(event) => handleDirectUrlChange(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={8000}
            className="h-12 w-full rounded-md border border-slate-200 bg-white px-3 font-mono text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            placeholder="https://rota-api.grancursosonline.com.br/v1/elastic/questao?perPage=20&page=1&..."
          />
          <span className="block text-xs leading-5 text-slate-500 dark:text-slate-400">
            Cole a URL da busca feita na Gran para manter seus filtros. Somente a rota oficial de
            questões é aceita.
          </span>
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Página
            </span>
            <input
              type="number"
              min={1}
              value={page}
              onChange={(event) => {
                const nextPage = Math.max(1, Number(event.target.value) || 1);
                setPage(nextPage);
                updateDirectUrlPagination('page', nextPage);
              }}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Por página
            </span>
            <select
              value={perPage}
              onChange={(event) => {
                const nextPerPage = Number(event.target.value);
                setPerPage(nextPerPage);
                updateDirectUrlPagination('perPage', nextPerPage);
              }}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {[10, 20, 30, 50].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Ano opcional
            </span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={year}
              onChange={(event) => setYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="2026"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleFetch()}
            disabled={isFetching}
            className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-5 py-2.5 text-xs disabled:opacity-50`}
          >
            {isFetching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Carregar questões
          </button>
          <span className="inline-flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={15} className="text-emerald-600" />
            Host e rota fixos, sem redirects; credencial isolada na extensão
          </span>
        </div>
      </section>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
      {result ? (
        <section className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Fila de revisão
              </p>
              <h3 className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
                {result.payloads.length} prova(s) · {result.questionCount} questão(ões)
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {result.fileCount || 0} arquivo(s) oficial(is). Abra uma prova por vez para revisar os cards.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleFetch(Math.max(1, page - 1))}
                disabled={isFetching || page <= 1}
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-xs disabled:opacity-40`}
                aria-label="Página anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="min-w-24 text-center text-xs font-bold text-slate-600">
                Página {page}{result.pages ? ` de ${result.pages}` : ''}
              </span>
              <button
                type="button"
                onClick={() => void handleFetch(page + 1)}
                disabled={isFetching || (result.pages > 0 && page >= result.pages)}
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-xs disabled:opacity-40`}
                aria-label="Próxima página"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

        </section>
      ) : null}

      {result?.payloads.length && renderReviewQueue ? (
        <section>
          {renderReviewQueue(result.payloads)}
        </section>
      ) : null}

      <section className={`${ADMIN_PAGE_PANEL_CLASS} space-y-4`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Processamento
            </p>
            <h3 className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
              Histórico de processamento
            </h3>
          </div>
          <button
            type="button"
            onClick={() => void loadJobs()}
            disabled={isLoadingJobs}
            className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-xs`}
          >
            <RefreshCw size={14} className={isLoadingJobs ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
        {jobs.length ? (
          <div className="divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {jobs.map((job) => (
              <div
                key={job.jobId}
                className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Job #{job.jobId} · {statusLabel[job.status] || job.status}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(job.createdAt)} · {job.attempts} tentativa(s)
                  </p>
                  {job.error ? (
                    <p className="mt-1 text-xs font-semibold text-rose-600">{job.error}</p>
                  ) : null}
                </div>
                {job.status === 'done' ? (
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600">
                    <CheckCircle2 size={15} />
                    {job.result?.createdQuestionIds?.length || 0} questão(ões) criada(s)
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhum lote recente.</p>
        )}
      </section>
    </div>
  );
};

export default AdminGranCrawlerSection;
