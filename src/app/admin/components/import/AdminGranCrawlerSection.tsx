'use client';

import React from 'react';
import {
  AlertTriangle,
  Ban,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Loader2,
  Pencil,
  Play,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { apiClient } from '@services/api';
import {
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';
import {
  collectGranTaxonomyBatch,
  collectGranQuestions,
  collectGranQuestionById,
  checkGranTaxonomyUpdates,
  detectGranCollector,
  verifyGranCollector,
} from './granExtensionBridge';
import type { GranCollectorStatus, GranTaxonomyCollectorResult } from './granExtensionBridge';
import { partitionGranReviewPayloads } from './granCrawlerReviewUtils';
import { splitGranTaxonomyResponses } from './granTaxonomySyncUtils';
import { buildGranQuestionQueryUrl, readGranQuestionQueryControls } from './granCrawlerUrl';
import AdminConfirmDialog from '../ui/AdminConfirmDialog';

type GranQuestion = {
  tempId: string;
  source?: {
    questionNumber?: number | string | null;
    externalId?: number | string | null;
    provider?: string | null;
    contextTempId?: number | string | null;
    localQuestionId?: number | string | null;
    alreadyPublished?: boolean;
    publicationStatus?: string | null;
  };
  publication?: {
    status?: string | null;
  };
  filters?: {
    careers?: Array<{ id?: string | number | null; label?: string; slug?: string }>;
  };
};

export type GranImportPayload = {
  schemaVersion: 'question-import.v2';
  import?: {
    sourceType?: string;
    extractionMode?: string;
    collectionPage?: number | null;
    collectionPerPage?: number | null;
    collectionYear?: number | null;
    collectionRequestUrl?: string | null;
    [key: string]: unknown;
  };
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

export type GranPublicationBatch = {
  batchId: string;
  displayName?: string;
  collectionPages?: number[];
  collectionYears?: number[];
  status: string;
  questionCount: number;
  jobCount: number;
  pending: number;
  processing: number;
  published: number;
  duplicates: number;
  failures: number;
  questionKeys?: string[];
  questionStatuses?: Record<string, 'queued' | 'processing' | 'published' | 'duplicate' | 'failed'>;
  questionErrors?: Record<string, { code?: string; message?: string }>;
  error?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

type AdminGranCrawlerSectionProps = {
  renderReviewQueue?: (
    payloads: GranImportPayload[],
    context: {
      publicationBatches: GranPublicationBatch[];
      onPublicationQueued: () => void;
    },
  ) => React.ReactNode;
};

type CollectorState = 'checking' | 'ready' | 'disconnected' | 'missing';

type GranCrawlerBootstrapData = {
  taxonomyStatus?: Record<string, GranTaxonomyStatus>;
  currentBatch?: GranPublicationBatch | null;
  automaticCheckpoint?: GranAutomaticCheckpoint | null;
  failureHistory?: GranFailureHistoryPage;
  failureRetention?: GranFailureRetention;
};

type GranPublicationFailure = {
  failureId: number;
  sourceKey: string;
  provider: string;
  externalQuestionId?: string | null;
  questionNumber?: string | null;
  examTitle?: string | null;
  subjectSlug?: string | null;
  batchId?: number | null;
  code: string;
  message: string;
  status: 'open' | 'retrying' | 'resolved' | 'ignored';
  attemptCount: number;
  firstFailedAt?: string | null;
  lastFailedAt?: string | null;
  resolvedAt?: string | null;
};

type GranFailureHistoryPage = {
  items: GranPublicationFailure[];
  total: number;
  openCount: number;
  retryingCount: number;
  nextCursor?: number | null;
};

type GranFailureRetention = {
  payloadRetentionDays: number;
  recordRetentionDays: number;
  payloadsEligible: number;
  recordsEligible: number;
  totalEligible: number;
  payloadCutoff?: string;
  recordCutoff?: string;
};

type AutomaticCrawlerProgress = {
  phase: 'idle' | 'collecting' | 'publishing' | 'waiting' | 'completed' | 'error';
  year: number;
  page: number;
  totalPages: number | null;
  questionsCollected: number;
  message: string;
};

type GranAutomaticCheckpoint = {
  runKey: string;
  requestUrl: string;
  perPage: number;
  year: number;
  page: number;
  totalPages?: number | null;
  status: 'running' | 'paused' | 'error';
  lastBatchId?: string | null;
  lastError?: string | null;
  updatedAt?: string | null;
};

type AutomaticPublicationFlight = {
  batch: GranPublicationBatch;
  year: number;
  page: number;
  totalPages: number | null;
};

type GranAutomaticEnqueueResult = {
  page: number;
  perPage: number;
  total: number;
  pages: number;
  requestUrl: string;
  questionCount: number;
  fileCount: number;
  batch: GranPublicationBatch;
};

type GranPublicationProgress = Pick<GranPublicationBatch,
  'batchId' | 'status' | 'questionCount' | 'jobCount' | 'pending' | 'processing'
  | 'published' | 'duplicates' | 'failures' | 'error' | 'completedAt'>;

const ENDPOINT = 'admin/gran_crawler.php';
const EXTENSION_DOWNLOAD_URL = '/downloads/concursomestre-coletor-gran-v1.0.21.zip';
const MAX_GRAN_QUESTIONS_PER_PAGE = 1000;
const GRAN_LAST_YEAR_STORAGE_KEY = 'admin.granCrawler.lastYear';
const BOOTSTRAP_CACHE_MS = 60_000;
const COLLECTOR_STATUS_CACHE_MS = 30_000;
const AUTOMATIC_BATCH_STATUS_POLL_MS = 12_000;
const ACTIVE_BATCH_STATUS_REFRESH_MS = 15_000;
const TAXONOMY_CHECK_FRESH_MS = 6 * 60 * 60 * 1000;
const MAX_AUTOMATIC_IN_FLIGHT_BATCHES = 2;

/**
 * A mesma pagina da Gran pode ser retomada depois de uma atualizacao do
 * coletor, por exemplo quando uma imagem protegida passou a ser capturada em
 * base64. A chave precisa representar o conteudo enviado, nao apenas pagina e
 * ano, para que o lote antigo nao bloqueie a retomada com um payload novo.
 */
function fingerprintAutomaticInput(input: unknown): string {
  const source = JSON.stringify(input);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

let bootstrapCache: { data: GranCrawlerBootstrapData; fetchedAt: number } | null = null;
let bootstrapRequest: Promise<GranCrawlerBootstrapData> | null = null;
let bootstrapAbortController: AbortController | null = null;
let collectorStatusCache: { status: GranCollectorStatus; checkedAt: number } | null = null;

const GRAN_TAXONOMY_STEPS: Array<{ kind: GranTaxonomyCollectorResult['kind']; label: string }> = [
  { kind: 'assunto_tree', label: 'árvore de matérias, tópicos e assuntos' },
  { kind: 'assunto', label: 'catálogo complementar de assuntos' },
  { kind: 'banca', label: 'bancas' },
  { kind: 'orgao', label: 'órgãos' },
  { kind: 'carreira', label: 'carreiras' },
  { kind: 'area', label: 'áreas/focos' },
  { kind: 'cargo', label: 'cargos' },
];

type GranTaxonomyCategory = {
  key: 'assunto' | 'banca' | 'orgao' | 'cargo' | 'carreira' | 'area';
  label: string;
  description: string;
  steps: GranTaxonomyCollectorResult['kind'][];
};

type GranTaxonomyStatus = {
  filterType: string;
  records: number;
  metadataRecords: number;
  pending: number;
  synchronized: boolean;
  ready: boolean;
  updateAvailable?: boolean;
  checkedAt?: string | null;
  syncedAt?: string | null;
};

const GRAN_TAXONOMY_CATEGORIES: GranTaxonomyCategory[] = [
  {
    key: 'assunto',
    label: 'Materias, topicos e assuntos',
    description: 'Arvore curricular usada para classificar cada questao.',
    steps: ['assunto_tree', 'assunto'],
  },
  { key: 'banca', label: 'Bancas', description: 'Organizadoras das provas.', steps: ['banca'] },
  { key: 'orgao', label: 'Orgaos', description: 'Instituicoes e entidades publicas.', steps: ['orgao'] },
  { key: 'cargo', label: 'Cargos', description: 'Cargos e funcoes das provas.', steps: ['cargo'] },
  { key: 'carreira', label: 'Carreiras', description: 'Carreiras para os filtros da plataforma.', steps: ['carreira'] },
  { key: 'area', label: 'Areas e focos', description: 'A area da Gran e o foco de estudo local.', steps: ['area'] },
];

type TaxonomySyncSummary = {
  processed: number;
  created: number;
  updated: number;
  pending: number;
  resolved: number;
};

type TaxonomyCheckSummary = {
  checkedCatalogs: number;
  changedCategories: number;
  currentCategories: number;
  checkedAt: string;
};

const statusLabel: Record<string, string> = {
  pending: 'Aguardando worker',
  processing: 'Processando',
  done: 'Concluído',
  failed: 'Falhou',
  partial: 'Concluído com pendências',
};

const questionStatusLabel: Record<string, string> = {
  queued: 'Aguardando',
  processing: 'Processando',
  published: 'Publicada',
  duplicate: 'Já existente',
  failed: 'Falhou',
};

const formatQuestionKey = (key: string, index: number) => {
  const granMatch = key.match(/^gran:question:(.+)$/i);
  if (granMatch?.[1]) return `#${index + 1} - Q${granMatch[1]}`;
  return `#${index + 1} - ${key}`;
};

const readApiData = <T,>(response: { data?: unknown }): T => {
  const body = response.data as { data?: T } | T | undefined;
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
};

const cancelGranCrawlerBootstrap = () => {
  bootstrapAbortController?.abort();
  bootstrapAbortController = null;
  bootstrapRequest = null;
};

const fetchGranCrawlerBootstrap = async (
  force = false,
  signal?: AbortSignal,
): Promise<GranCrawlerBootstrapData> => {
  const now = Date.now();
  if (!force && bootstrapCache && now - bootstrapCache.fetchedAt < BOOTSTRAP_CACHE_MS) {
    return bootstrapCache.data;
  }
  if (bootstrapRequest) return bootstrapRequest;

  const controller = new AbortController();
  bootstrapAbortController = controller;
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  bootstrapRequest = apiClient.get(ENDPOINT, { signal: controller.signal })
    .then((response) => {
      const data = readApiData<GranCrawlerBootstrapData>(response) || {};
      bootstrapCache = { data, fetchedAt: Date.now() };
      return data;
    })
    .finally(() => {
      signal?.removeEventListener('abort', abort);
      if (bootstrapAbortController === controller) {
        bootstrapAbortController = null;
        bootstrapRequest = null;
      }
    });
  return bootstrapRequest;
};

const isTaxonomyVerificationFresh = (
  statuses: Record<string, GranTaxonomyStatus>,
  keys: GranTaxonomyCategory['key'][],
) => keys.length > 0 && keys.every((key) => {
  const checkedAt = statuses[key]?.checkedAt;
  if (!checkedAt) return false;
  const isoValue = checkedAt.replace(' ', 'T') + (checkedAt.includes('Z') ? '' : 'Z');
  const timestamp = new Date(isoValue).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp < TAXONOMY_CHECK_FRESH_MS;
});

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Agora';
  const parsed = new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'));
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR');
};

const formatCollectionPages = (pages?: number[]) => {
  const normalized = Array.from(new Set((pages || []).filter((page) => Number.isInteger(page) && page > 0)))
    .sort((left, right) => left - right);
  if (normalized.length === 0) return 'Página não registrada';
  return normalized.length === 1 ? `Página ${normalized[0]}` : `Páginas ${normalized.join(', ')}`;
};

const countGranPayloadQuestions = (payloads: GranImportPayload[]) => payloads.reduce(
  (total, payload) => total + (Array.isArray(payload.questions) ? payload.questions.length : 0),
  0,
);

const mergeGranPayloadsByQuestion = (
  current: GranImportPayload[],
  incoming: GranImportPayload[],
): GranImportPayload[] => {
  const seen = new Set<string>();
  const merged: GranImportPayload[] = [];
  [...incoming, ...current].forEach((payload) => {
    const questions = payload.questions.filter((question) => {
      const externalId = String(question.source?.externalId || '').trim();
      const key = externalId ? `gran:${externalId}` : String(question.tempId || '').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (questions.length > 0) merged.push({ ...payload, questions });
  });
  return merged;
};

const delayWithSignal = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, milliseconds);
  signal.addEventListener('abort', () => {
    window.clearTimeout(timer);
    reject(new DOMException('Operacao cancelada.', 'AbortError'));
  }, { once: true });
});

const readRateLimitRetryDelay = (error: unknown, fallbackMilliseconds = 15_000) => {
  const response = (error as {
    response?: {
      status?: number;
      headers?: Record<string, string | number | undefined>;
      data?: { retry_after?: unknown; message?: unknown };
    };
    message?: unknown;
  })?.response;
  const message = String(response?.data?.message || (error as { message?: unknown })?.message || '');
  const isRateLimited = response?.status === 429 || /\b429\b|too many requests|limitou temporariamente/i.test(message);
  if (!isRateLimited) return null;
  const headerValue = response?.headers?.['retry-after'];
  const bodyValue = response?.data?.retry_after;
  const seconds = Number(headerValue ?? bodyValue);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(120_000, Math.max(3_000, Math.ceil(seconds) * 1_000));
  }
  return fallbackMilliseconds;
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

const collectorConnectionLabel = (state: CollectorState, status: GranCollectorStatus | null) => {
  const version = status?.version ? ` - v${status.version}` : '';
  if (state === 'ready') return `Conectada${version}`;
  if (state === 'missing') return 'Não instalada';
  if (state === 'checking') return 'Verificando...';
  if (status?.captureState === 'invalid_credential') return `Sessão Gran expirada${version}`;
  if (status?.captureState === 'authorization_missing' || status?.captureState === 'waiting') {
    return `Instalada sem sessão Gran${version}`;
  }
  return `Instalada sem conexão${version}`;
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
  const [automaticMode, setAutomaticMode] = React.useState(false);
  const [automaticProgress, setAutomaticProgress] = React.useState<AutomaticCrawlerProgress>({
    phase: 'idle',
    year: 0,
    page: 1,
    totalPages: null,
    questionsCollected: 0,
    message: 'Modo automatico desativado.',
  });
  const [automaticCheckpoint, setAutomaticCheckpoint] = React.useState<GranAutomaticCheckpoint | null>(null);
  const [result, setResult] = React.useState<GranFetchResult | null>(null);
  const [currentBatch, setCurrentBatch] = React.useState<GranPublicationBatch | null>(null);
  const [failureHistory, setFailureHistory] = React.useState<GranFailureHistoryPage>({
    items: [],
    total: 0,
    openCount: 0,
    retryingCount: 0,
    nextCursor: null,
  });
  const [failureRetention, setFailureRetention] = React.useState<GranFailureRetention | null>(null);
  const [purgeDiagnosticsConfirmOpen, setPurgeDiagnosticsConfirmOpen] = React.useState(false);
  const [isLoadingFailures, setIsLoadingFailures] = React.useState(false);
  const [failureActionId, setFailureActionId] = React.useState<number | 'all' | 'retention' | null>(null);
  const [showProcessingDetails, setShowProcessingDetails] = React.useState(false);
  const [taxonomyExpanded, setTaxonomyExpanded] = React.useState(false);
  const [isCheckingTaxonomyUpdates, setIsCheckingTaxonomyUpdates] = React.useState(false);
  const [isFetching, setIsFetching] = React.useState(false);
  const [isLoadingProcessing, setIsLoadingProcessing] = React.useState(false);
  const [syncingTaxonomyKey, setSyncingTaxonomyKey] = React.useState<string | null>(null);
  const [isLoadingTaxonomyStatus, setIsLoadingTaxonomyStatus] = React.useState(true);
  const [taxonomyStatuses, setTaxonomyStatuses] = React.useState<Record<string, GranTaxonomyStatus>>({});
  const [taxonomyProgress, setTaxonomyProgress] = React.useState('');
  const [taxonomySummary, setTaxonomySummary] = React.useState<TaxonomySyncSummary | null>(null);
  const [taxonomyCheckSummary, setTaxonomyCheckSummary] = React.useState<TaxonomyCheckSummary | null>(null);
  const [error, setError] = React.useState('');
  const fetchAbortRef = React.useRef<AbortController | null>(null);
  const bootstrapAbortRef = React.useRef<AbortController | null>(null);
  const automaticAbortRef = React.useRef<AbortController | null>(null);
  const automaticCheckpointRef = React.useRef<GranAutomaticCheckpoint | null>(null);
  const isMountedRef = React.useRef(false);
  const publicationBatches = React.useMemo(() => currentBatch ? [currentBatch] : [], [currentBatch]);
  const hasActiveJobs = currentBatch !== null && ['pending', 'processing'].includes(currentBatch.status);
  const currentBatchQuestionDetails = React.useMemo(() => {
    if (!currentBatch) return [];
    const keys = currentBatch.questionKeys || [];
    const statuses = currentBatch.questionStatuses || {};
    const errors = currentBatch.questionErrors || {};
    return keys.map((key, index) => ({
      key,
      index,
      status: statuses[key] || 'queued',
      error: errors[key]?.message || null,
    }));
  }, [currentBatch]);
  const reviewQueues = React.useMemo(
    () => partitionGranReviewPayloads(result?.payloads || []),
    [result?.payloads],
  );

  const checkCollector = React.useCallback(async (showFailure = false, force = false) => {
    if (!force && collectorStatusCache && Date.now() - collectorStatusCache.checkedAt < COLLECTOR_STATUS_CACHE_MS) {
      const cached = collectorStatusCache.status;
      setCollectorStatus(cached);
      setCollectorState(cached.connected ? 'ready' : 'disconnected');
      if (showFailure && !cached.connected) setError(describeCollectorCaptureStatus(cached));
      return cached.connected;
    }
    setCollectorState('checking');
    const presencePromise = detectGranCollector();
    try {
      const status = await verifyGranCollector();
      collectorStatusCache = { status, checkedAt: Date.now() };
      setCollectorStatus(status);
      setCollectorState(status.connected ? 'ready' : 'disconnected');
      if (showFailure && !status.connected) setError(describeCollectorCaptureStatus(status));
      return status.connected;
    } catch {
      const presence = await presencePromise;
      const disconnectedStatus: GranCollectorStatus | null = presence.detected ? {
        connected: false,
        expiresAt: null,
        version: presence.version,
        captureState: 'bridge_unavailable',
      } : null;
      setCollectorStatus(disconnectedStatus);
      collectorStatusCache = disconnectedStatus
        ? { status: disconnectedStatus, checkedAt: Date.now() }
        : null;
      setCollectorState(presence.detected ? 'disconnected' : 'missing');
      if (showFailure) setError(presence.detected
        ? 'A extensão está instalada, mas não respondeu ao PING. Atualize a extensão ou reconecte a sessão Gran.'
        : 'Extensão privada não detectada. Instale ou recarregue o coletor Gran.');
      return false;
    }
  }, []);

  const loadBootstrap = React.useCallback(async (
    silent = false,
    hydrateTaxonomies = false,
    force = false,
    signal?: AbortSignal,
  ): Promise<GranCrawlerBootstrapData | null> => {
    if (!silent && isMountedRef.current) setIsLoadingProcessing(true);
    try {
      const data = await fetchGranCrawlerBootstrap(force, signal);
      if (signal?.aborted || !isMountedRef.current) return null;
      setCurrentBatch(data?.currentBatch && typeof data.currentBatch === 'object' ? data.currentBatch : null);
      const checkpoint = data?.automaticCheckpoint && typeof data.automaticCheckpoint === 'object'
        ? data.automaticCheckpoint
        : null;
      setAutomaticCheckpoint(checkpoint);
      automaticCheckpointRef.current = checkpoint;
      if (checkpoint && !automaticAbortRef.current) {
        setGranRequestUrl(checkpoint.requestUrl);
        setPerPage(checkpoint.perPage);
        setYear(String(checkpoint.year));
        setPage(checkpoint.page);
        setAutomaticProgress({
          phase: checkpoint.status === 'error' ? 'error' : 'idle',
          year: checkpoint.year,
          page: checkpoint.page,
          totalPages: checkpoint.totalPages || null,
          questionsCollected: 0,
          message: checkpoint.status === 'error' && checkpoint.lastError
            ? `Interrompido na pagina ${checkpoint.page}${checkpoint.totalPages ? ` de ${checkpoint.totalPages}` : ''} de ${checkpoint.year}: ${checkpoint.lastError}`
            : `Progresso salvo: pagina ${checkpoint.page}${checkpoint.totalPages ? ` de ${checkpoint.totalPages}` : ''} de ${checkpoint.year}. Ative para continuar.`,
        });
      }
      if (data?.failureHistory && Array.isArray(data.failureHistory.items)) {
        const activeItems = data.failureHistory.items.filter((failure) => (
          failure.status === 'open' || failure.status === 'retrying'
        ));
        setFailureHistory({
          ...data.failureHistory,
          items: activeItems,
          total: data.failureHistory.total || activeItems.length,
          openCount: data.failureHistory.openCount || activeItems.filter((failure) => failure.status === 'open').length,
          retryingCount: data.failureHistory.retryingCount || activeItems.filter((failure) => failure.status === 'retrying').length,
        });
      }
      if (data?.failureRetention && typeof data.failureRetention === 'object') {
        setFailureRetention(data.failureRetention);
      }
      if (hydrateTaxonomies && data?.taxonomyStatus && typeof data.taxonomyStatus === 'object') {
        setTaxonomyStatuses(data.taxonomyStatus);
        setIsLoadingTaxonomyStatus(false);
      }
      return data;
    } catch (requestError) {
      if (!silent && !signal?.aborted && isMountedRef.current) {
        setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar a fila.');
      }
      return null;
    } finally {
      if (!silent && !signal?.aborted && isMountedRef.current) setIsLoadingProcessing(false);
    }
  }, []);

  const loadTaxonomyStatus = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoadingTaxonomyStatus(true);
    const data = await loadBootstrap(true, true, true);
    if (!silent) setIsLoadingTaxonomyStatus(false);
    return data?.taxonomyStatus && typeof data.taxonomyStatus === 'object' ? data.taxonomyStatus : null;
  }, [loadBootstrap]);

  React.useEffect(() => {
    isMountedRef.current = true;
    const bootstrapController = new AbortController();
    bootstrapAbortRef.current = bootstrapController;
    const hydrationTimer = window.setTimeout(() => {
      const savedYear = window.localStorage.getItem(GRAN_LAST_YEAR_STORAGE_KEY)?.trim() || '';
      if (/^\d{4}$/.test(savedYear) && Number(savedYear) >= 1900 && Number(savedYear) <= 2200) {
        setYear(savedYear);
      }
    }, 0);
    void Promise.resolve().then(() => loadBootstrap(true, true, false, bootstrapController.signal));
    void Promise.resolve().then(() => checkCollector());
    return () => {
      isMountedRef.current = false;
      window.clearTimeout(hydrationTimer);
      bootstrapController.abort();
      bootstrapAbortRef.current = null;
      cancelGranCrawlerBootstrap();
      fetchAbortRef.current?.abort();
      automaticAbortRef.current?.abort();
    };
  }, [checkCollector, loadBootstrap]);

  const refreshCurrentProcessing = React.useCallback(async () => {
    await loadBootstrap(false, false, true);
  }, [loadBootstrap]);

  const handleDirectUrlChange = React.useCallback((value: string) => {
    setGranRequestUrl(value);
    try {
      const controls = readGranQuestionQueryControls(value);
      if (controls.page) setPage(controls.page);
      if (controls.perPage) setPerPage(controls.perPage);
      if (controls.year !== undefined) setYear(controls.year);
    } catch {
      // O backend apresenta a validação autoritativa ao consultar.
    }
  }, []);

  const updateDirectUrlPagination = React.useCallback((key: 'page' | 'perPage', value: number) => {
    setGranRequestUrl((current) => {
      if (!current.trim()) return current;
      try {
        return buildGranQuestionQueryUrl(current, {
          page: key === 'page' ? value : page,
          perPage: key === 'perPage' ? value : perPage,
          year,
        });
      } catch {
        return current;
      }
    });
  }, [page, perPage, year]);

  const collectMappedPage = React.useCallback(async (
    targetPage: number,
    targetYear: string,
    signal: AbortSignal,
  ): Promise<GranFetchResult> => {
    const requestUrl = buildGranQuestionQueryUrl(granRequestUrl, {
      page: targetPage,
      perPage,
      year: targetYear,
    });
    const collection = await collectGranQuestions(requestUrl, signal);
    const response = await apiClient.post(ENDPOINT, {
      action: 'map',
      granResponse: collection.json,
      granExamFiles: collection.examFiles,
      granAssetData: collection.assetData || {},
      granRequestUrl: collection.requestUrl,
      page: targetPage,
      perPage,
      year: targetYear,
    }, { signal });
    return readApiData<GranFetchResult>(response);
  }, [granRequestUrl, perPage]);

  const collectAndEnqueueAutomaticPage = React.useCallback(async (
    targetPage: number,
    targetYear: string,
    runKey: string,
    signal: AbortSignal,
  ): Promise<GranAutomaticEnqueueResult> => {
    const requestUrl = buildGranQuestionQueryUrl(granRequestUrl, {
      page: targetPage,
      perPage,
      year: targetYear,
    });
    const collection = await collectGranQuestions(requestUrl, signal);
    const idempotencyKey = `gran-auto-${runKey}-${targetYear}-${targetPage}-${fingerprintAutomaticInput({
      response: collection.json,
      assets: collection.assetData || {},
      files: collection.examFiles || {},
    })}`;
    const response = await apiClient.post(ENDPOINT, {
      action: 'map_and_enqueue_publication',
      granResponse: collection.json,
      granExamFiles: collection.examFiles,
      granAssetData: collection.assetData || {},
      granRequestUrl: collection.requestUrl,
      page: targetPage,
      perPage,
      year: targetYear,
      idempotencyKey,
    }, { signal });
    return readApiData<GranAutomaticEnqueueResult>(response);
  }, [granRequestUrl, perPage]);

  const saveAutomaticCheckpoint = React.useCallback(async (
    checkpoint: Omit<GranAutomaticCheckpoint, 'runKey' | 'updatedAt'> & { runKey?: string },
    signal?: AbortSignal,
  ): Promise<GranAutomaticCheckpoint> => {
    const response = await apiClient.post(ENDPOINT, {
      action: 'save_automatic_checkpoint',
      ...checkpoint,
    }, signal ? { signal } : undefined);
    const saved = readApiData<GranAutomaticCheckpoint>(response);
    setAutomaticCheckpoint(saved);
    automaticCheckpointRef.current = saved;
    bootstrapCache = null;
    return saved;
  }, []);

  const clearAutomaticCheckpoint = React.useCallback(async () => {
    await apiClient.post(ENDPOINT, { action: 'clear_automatic_checkpoint' });
    setAutomaticCheckpoint(null);
    automaticCheckpointRef.current = null;
    bootstrapCache = null;
  }, []);

  const handleFetch = React.useCallback(async (requestedPage?: number) => {
    if (collectorState !== 'ready') {
      const ready = await checkCollector(true);
      if (!ready) return;
    }

    const targetPage = requestedPage ?? page;
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setIsFetching(true);
    setError('');
    try {
      const data = await collectMappedPage(targetPage, year.trim(), controller.signal);
      setResult(data);
      setPage(data.page);
      setPerPage(data.perPage);
      if (data.requestUrl) setGranRequestUrl(data.requestUrl);
      const savedYear = year.trim();
      if (savedYear) window.localStorage.setItem(GRAN_LAST_YEAR_STORAGE_KEY, savedYear);
      else window.localStorage.removeItem(GRAN_LAST_YEAR_STORAGE_KEY);

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
  }, [checkCollector, collectMappedPage, collectorState, page, year]);

  const loadFailureHistory = React.useCallback(async (
    cursor?: number | null,
  ) => {
    setIsLoadingFailures(true);
    try {
      const response = await apiClient.post(ENDPOINT, {
        action: 'list_publication_failures',
        status: 'active',
        limit: 50,
        cursor: cursor || undefined,
      });
      const data = readApiData<GranFailureHistoryPage>(response);
      const activeItems = (data.items || []).filter((failure) => (
        failure.status === 'open' || failure.status === 'retrying'
      ));
      setFailureHistory((current) => ({
        items: cursor ? [...current.items, ...activeItems] : activeItems,
        total: data.total || 0,
        openCount: data.openCount || 0,
        retryingCount: data.retryingCount || 0,
        nextCursor: data.nextCursor || null,
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel carregar as falhas.');
    } finally {
      setIsLoadingFailures(false);
    }
  }, []);

  const handleModerateFailure = React.useCallback(async (failure: GranPublicationFailure) => {
    setFailureActionId(failure.failureId);
    setError('');
    try {
      const response = await apiClient.post(ENDPOINT, {
        action: 'get_publication_failure',
        failureId: failure.failureId,
      });
      const detail = readApiData<GranPublicationFailure & { payload?: GranImportPayload | null }>(response);
      let payload = detail.payload || null;
      if (!payload && failure.externalQuestionId) {
        const ready = collectorState === 'ready' || await checkCollector(true, true);
        if (!ready) throw new Error('Conecte a extensao Gran para recuperar esta questao antiga.');
        const collection = await collectGranQuestionById(
          failure.externalQuestionId,
          failure.subjectSlug || '',
        );
        const mappedResponse = await apiClient.post(ENDPOINT, {
          action: 'map',
          granResponse: collection.json,
          granExamFiles: collection.examFiles,
          granAssetData: collection.assetData || {},
          page: 1,
          perPage: 1,
        });
        payload = readApiData<GranFetchResult>(mappedResponse).payloads?.[0] || null;
      }
      if (!payload) {
        throw new Error('O rascunho desta falha nao esta disponivel para moderacao.');
      }
      setResult((current) => {
        const payloads = mergeGranPayloadsByQuestion(current?.payloads || [], [payload as GranImportPayload]);
        return {
          page: current?.page || page,
          perPage: current?.perPage || perPage,
          total: current?.total || 0,
          pages: current?.pages || 0,
          questionCount: countGranPayloadQuestions(payloads),
          fileCount: current?.fileCount || 0,
          payloads,
        };
      });
      window.requestAnimationFrame(() => {
        document.querySelector('[aria-label="Fila unificada de revisao do Gran"]')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel abrir a questao para moderacao.');
    } finally {
      setFailureActionId(null);
    }
  }, [checkCollector, collectorState, page, perPage]);

  const handleRetryFailures = React.useCallback(async (failures: GranPublicationFailure[]) => {
    const failureIds = Array.from(new Set(failures
      .filter((failure) => failure.status === 'open')
      .map((failure) => failure.failureId)));
    if (failureIds.length === 0) return;
    const actionId = failureIds.length === 1 ? failureIds[0] : 'all';
    setFailureActionId(actionId);
    setError('');
    try {
      const response = await apiClient.post(ENDPOINT, {
        action: 'retry_publication_failures',
        failureIds,
      });
      const batch = readApiData<GranPublicationBatch>(response);
      setCurrentBatch(batch);
      setFailureHistory((current) => ({
        ...current,
        items: current.items.map((item) => failureIds.includes(item.failureId)
          ? { ...item, status: 'retrying' }
          : item),
        openCount: Math.max(0, current.openCount - failureIds.length),
        retryingCount: current.retryingCount + failureIds.length,
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel reenviar as questoes selecionadas.');
    } finally {
      setFailureActionId(null);
    }
  }, []);

  const handleRetryFailure = React.useCallback(async (failure: GranPublicationFailure) => {
    await handleRetryFailures([failure]);
  }, [handleRetryFailures]);

  const handleRetryAllFailures = React.useCallback(async () => {
    await handleRetryFailures(failureHistory.items);
  }, [failureHistory.items, handleRetryFailures]);

  const handleIgnoreFailure = React.useCallback(async (failure: GranPublicationFailure) => {
    setFailureActionId(failure.failureId);
    setError('');
    try {
      await apiClient.post(ENDPOINT, {
        action: 'ignore_publication_failure',
        failureId: failure.failureId,
      });
      setFailureHistory((current) => ({
        ...current,
        items: current.items.filter((item) => item.failureId !== failure.failureId),
        total: Math.max(0, current.total - 1),
        openCount: Math.max(0, current.openCount - (failure.status === 'open' ? 1 : 0)),
        retryingCount: Math.max(0, current.retryingCount - (failure.status === 'retrying' ? 1 : 0)),
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel ignorar a falha.');
    } finally {
      setFailureActionId(null);
    }
  }, []);

  const handleIgnoreAllFailures = React.useCallback(async () => {
    const activeFailureCount = failureHistory.items.filter((failure) => (
      failure.status === 'open' || failure.status === 'retrying'
    )).length;
    if (activeFailureCount === 0) return;

    setFailureActionId('all');
    setError('');
    try {
      await apiClient.post(ENDPOINT, { action: 'ignore_all_publication_failures' });
      setFailureHistory({
        items: [],
        total: 0,
        openCount: 0,
        retryingCount: 0,
        nextCursor: null,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel ignorar as falhas pendentes.');
    } finally {
      setFailureActionId(null);
    }
  }, [failureHistory.items]);

  const refreshFailureRetention = React.useCallback(async () => {
    const response = await apiClient.post(ENDPOINT, {
      action: 'publication_failure_retention_preview',
    });
    setFailureRetention(readApiData<GranFailureRetention>(response));
  }, []);

  const handlePurgeFailureDiagnostics = React.useCallback(async () => {
    const totalEligible = failureRetention?.totalEligible || 0;
    if (totalEligible === 0) return;
    const payloadDays = failureRetention?.payloadRetentionDays || 30;
    const recordDays = failureRetention?.recordRetentionDays || 90;

    setFailureActionId('retention');
    setError('');
    try {
      const response = await apiClient.post(ENDPOINT, {
        action: 'purge_publication_failure_diagnostics',
      });
      const result = readApiData<{
        payloadsPurged?: number;
        recordsPurged?: number;
        payloadRetentionDays?: number;
        recordRetentionDays?: number;
      }>(response);
      setFailureRetention({
        payloadRetentionDays: result.payloadRetentionDays || payloadDays,
        recordRetentionDays: result.recordRetentionDays || recordDays,
        payloadsEligible: 0,
        recordsEligible: 0,
        totalEligible: 0,
      });
      await loadFailureHistory();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel limpar os diagnosticos encerrados.');
    } finally {
      setFailureActionId(null);
      setPurgeDiagnosticsConfirmOpen(false);
    }
  }, [failureRetention, loadFailureHistory]);

  const waitForPublicationBatch = React.useCallback(async (
    initialBatch: GranPublicationBatch,
    signal: AbortSignal,
  ): Promise<GranPublicationBatch> => {
    let batch = initialBatch;
    while (['pending', 'processing'].includes(batch.status)) {
      await delayWithSignal(AUTOMATIC_BATCH_STATUS_POLL_MS, signal);
      const response = await apiClient.post(ENDPOINT, {
        action: 'publication_batch_progress',
        batchId: batch.batchId,
      }, { signal });
      batch = {
        ...batch,
        ...readApiData<GranPublicationProgress>(response),
      };
      setCurrentBatch(batch);
    }
    return batch;
  }, []);

  React.useEffect(() => {
    if (!currentBatch || automaticMode || !['pending', 'processing'].includes(currentBatch.status)) {
      return undefined;
    }

    const controller = new AbortController();
    let timer: number | null = null;
    const refreshProgress = async () => {
      if (controller.signal.aborted || document.visibilityState !== 'visible') return;
      try {
        const response = await apiClient.post(ENDPOINT, {
          action: 'publication_batch_progress',
          batchId: currentBatch.batchId,
        }, { signal: controller.signal });
        const progress = readApiData<GranPublicationProgress>(response);
        if (!controller.signal.aborted) {
          setCurrentBatch((existing) => (
            existing?.batchId === currentBatch.batchId
              ? { ...existing, ...progress }
              : existing
          ));
        }
      } catch {
        // O worker continua independente da tela; uma falha de observacao nao pode interromper a fila.
      } finally {
        if (!controller.signal.aborted && document.visibilityState === 'visible') {
          timer = window.setTimeout(refreshProgress, ACTIVE_BATCH_STATUS_REFRESH_MS);
        }
      }
    };

    timer = window.setTimeout(refreshProgress, ACTIVE_BATCH_STATUS_REFRESH_MS);
    return () => {
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [automaticMode, currentBatch?.batchId, currentBatch?.status]);

  const stopAutomaticMode = React.useCallback((message = 'Modo automatico interrompido pelo administrador.') => {
    const checkpoint = automaticCheckpointRef.current;
    automaticAbortRef.current?.abort();
    automaticAbortRef.current = null;
    setAutomaticMode(false);
    setAutomaticProgress((current) => ({ ...current, phase: 'idle', message }));
    if (checkpoint) {
      void saveAutomaticCheckpoint({
        requestUrl: checkpoint.requestUrl,
        runKey: checkpoint.runKey,
        perPage: checkpoint.perPage,
        year: checkpoint.year,
        page: checkpoint.page,
        totalPages: checkpoint.totalPages || null,
        status: 'paused',
        lastBatchId: checkpoint.lastBatchId || null,
        lastError: null,
      }).catch(() => {
        // O checkpoint ja existe; uma falha de atualizacao nao pode impedir a interrupcao local.
      });
    }
  }, [saveAutomaticCheckpoint]);

  const startAutomaticMode = React.useCallback(async () => {
    if (automaticAbortRef.current) return;
    const startYear = automaticCheckpoint?.year ?? Number(year);
    if (!Number.isInteger(startYear) || startYear < 1900 || startYear > new Date().getFullYear()) {
      setError('Informe um ano entre 1900 e o ano atual para iniciar o modo automatico.');
      return;
    }
    const ready = collectorState === 'ready' || await checkCollector(true, true);
    if (!ready) return;

    const controller = new AbortController();
    automaticAbortRef.current = controller;
    setAutomaticMode(true);
    setError('');
    let checkpoint: GranAutomaticCheckpoint | null = automaticCheckpoint;
    let cursorYear = checkpoint?.year || startYear;
    let cursorPage = checkpoint?.page || Math.max(1, page);
    const inFlightBatches: AutomaticPublicationFlight[] = [];
    let failedFlight: AutomaticPublicationFlight | null = null;
    const finalYear = new Date().getFullYear();

    try {
      checkpoint = checkpoint || await saveAutomaticCheckpoint({
        requestUrl: buildGranQuestionQueryUrl(granRequestUrl, {
          page: cursorPage,
          perPage,
          year: String(cursorYear),
        }),
        perPage,
        year: cursorYear,
        page: cursorPage,
        totalPages: null,
        status: 'running',
        lastBatchId: null,
        lastError: null,
      }, controller.signal);
      const waitForOldestPublication = async () => {
        const flight = inFlightBatches.shift();
        if (!flight) return;
        setAutomaticProgress({
          phase: 'waiting',
          year: flight.year,
          page: flight.page,
          totalPages: flight.totalPages,
          questionsCollected: flight.batch.questionCount,
          message: `Confirmando publicacao da pagina ${flight.page} de ${flight.totalPages || '?'} (ano ${flight.year}).`,
        });
        const processedBatch = await waitForPublicationBatch(flight.batch, controller.signal);
        if (processedBatch.status === 'failed') {
          failedFlight = flight;
          throw new Error(processedBatch.error || `A publicacao da pagina ${flight.page} falhou.`);
        }
        await loadFailureHistory();
      };
      while (!controller.signal.aborted && cursorYear <= finalYear) {
        const displayedTotal = checkpoint.totalPages || null;
        setAutomaticProgress({
          phase: 'collecting',
          year: cursorYear,
          page: cursorPage,
          totalPages: displayedTotal,
          questionsCollected: 0,
          message: `Coletando pagina ${cursorPage} de ${displayedTotal || '?'} (ano ${cursorYear}).`,
        });
        let data: GranAutomaticEnqueueResult | null = null;
        for (let attempt = 1; !controller.signal.aborted && attempt <= 5; attempt += 1) {
          try {
            data = await collectAndEnqueueAutomaticPage(
              cursorPage,
              String(cursorYear),
              checkpoint.runKey,
              controller.signal,
            );
            break;
          } catch (requestError) {
            const retryDelay = readRateLimitRetryDelay(requestError);
            if (retryDelay === null || attempt === 5) throw requestError;
            const retrySeconds = Math.ceil(retryDelay / 1_000);
            setAutomaticProgress({
              phase: 'waiting',
              year: cursorYear,
              page: cursorPage,
              totalPages: displayedTotal,
              questionsCollected: 0,
              message: `Limite temporario recebido na pagina ${cursorPage} de ${displayedTotal || '?'} (ano ${cursorYear}). Nova tentativa em ${retrySeconds}s (${attempt}/5).`,
            });
            await delayWithSignal(retryDelay, controller.signal);
          }
        }
        if (!data) break;
        const pageQuestionCount = data.questionCount;
        const knownPageCount = data.pages > 0
          ? data.pages
          : data.total > 0
            ? Math.ceil(data.total / Math.max(1, data.perPage || checkpoint.perPage))
            : 0;
        const exhaustedYear = pageQuestionCount === 0
          || (knownPageCount > 0 && cursorPage >= knownPageCount)
          || (knownPageCount === 0 && pageQuestionCount < checkpoint.perPage);

        if (pageQuestionCount > 0) {
          setAutomaticProgress({
            phase: 'publishing',
            year: cursorYear,
            page: cursorPage,
            totalPages: knownPageCount || null,
            questionsCollected: pageQuestionCount,
            message: `Publicando pagina ${cursorPage} de ${knownPageCount || '?'} (ano ${cursorYear}): ${pageQuestionCount} questoes.`,
          });
          const batch = data.batch;
          setCurrentBatch(batch);
          inFlightBatches.push({
            batch,
            year: cursorYear,
            page: cursorPage,
            totalPages: knownPageCount || null,
          });
          setAutomaticProgress((current) => ({
            ...current,
            phase: 'publishing',
            message: `Pagina ${cursorPage} de ${knownPageCount || '?'} enviada. Coletando a proxima enquanto esta publica.`,
          }));
        }

        const nextYear = exhaustedYear ? cursorYear + 1 : cursorYear;
        const nextPage = exhaustedYear ? 1 : cursorPage + 1;
        checkpoint = await saveAutomaticCheckpoint({
          requestUrl: buildGranQuestionQueryUrl(checkpoint.requestUrl, {
            page: nextPage,
            perPage: checkpoint.perPage,
            year: String(nextYear),
          }),
          runKey: checkpoint.runKey,
          perPage: checkpoint.perPage,
          year: nextYear,
          page: nextPage,
          totalPages: exhaustedYear ? null : knownPageCount || null,
          status: 'running',
          lastBatchId: data.batch.batchId,
          lastError: null,
        }, controller.signal);
        cursorYear = nextYear;
        cursorPage = nextPage;
        if (exhaustedYear) {
          setYear(String(cursorYear));
        }
        if (cursorYear <= finalYear) {
          setYear(String(cursorYear));
          setPage(cursorPage);
          window.localStorage.setItem(GRAN_LAST_YEAR_STORAGE_KEY, String(cursorYear));
          if (inFlightBatches.length >= MAX_AUTOMATIC_IN_FLIGHT_BATCHES) {
            await waitForOldestPublication();
          }
          await delayWithSignal(400, controller.signal);
        }
      }

      if (!controller.signal.aborted) {
        while (inFlightBatches.length > 0) {
          await waitForOldestPublication();
        }
        await clearAutomaticCheckpoint();
        setAutomaticMode(false);
        setAutomaticProgress({
          phase: 'completed',
          year: Math.min(cursorYear, finalYear),
          page: cursorPage,
          totalPages: null,
          questionsCollected: 0,
          message: `Coleta automatica concluida ate ${finalYear}.`,
        });
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        const message = requestError instanceof Error ? requestError.message : 'O modo automatico foi interrompido.';
        const checkpointYear = failedFlight?.year || cursorYear;
        const checkpointPage = failedFlight?.page || cursorPage;
        const checkpointTotalPages = failedFlight?.totalPages || checkpoint?.totalPages || null;
        if (checkpoint) try {
          await saveAutomaticCheckpoint({
            requestUrl: buildGranQuestionQueryUrl(checkpoint.requestUrl, {
              page: checkpointPage,
              perPage: checkpoint.perPage,
              year: String(checkpointYear),
            }),
            runKey: checkpoint.runKey,
            perPage: checkpoint.perPage,
            year: checkpointYear,
            page: checkpointPage,
            totalPages: checkpointTotalPages,
            status: 'error',
            lastBatchId: checkpoint.lastBatchId || null,
            lastError: message,
          });
        } catch {
          // A mensagem primária de falha não pode ser escondida por uma falha de checkpoint.
        }
        setError(message);
        setAutomaticMode(false);
        setAutomaticProgress((current) => ({ ...current, phase: 'error', message }));
      }
    } finally {
      if (automaticAbortRef.current === controller) automaticAbortRef.current = null;
    }
  }, [
    checkCollector,
    automaticCheckpoint,
    clearAutomaticCheckpoint,
    collectAndEnqueueAutomaticPage,
    collectorState,
    granRequestUrl,
    loadFailureHistory,
    page,
    perPage,
    saveAutomaticCheckpoint,
    waitForPublicationBatch,
    year,
  ]);

  const finalizeCargoRelationsInChunks = React.useCallback(async (pendingOnly = false) => {
    let cursor = 0;
    let processed = 0;
    let resolved = 0;
    let pending = 0;
    let total = 0;
    let hasMore = true;

    for (let batch = 1; hasMore && batch <= 1000; batch += 1) {
      setTaxonomyProgress(
        total > 0
          ? `Consolidando vinculos de cargos: ${Math.min(processed, total)} de ${total}.`
          : 'Consolidando o primeiro lote de vinculos de cargos.',
      );
      const response = await apiClient.post(
        ENDPOINT,
        {
          action: 'finalize_cargo_taxonomy_relations',
          cursor,
          limit: 1000,
          pendingOnly,
        },
        { timeout: 80_000 },
      );
      const chunk = readApiData<{
        processed?: number;
        resolved?: number;
        pending?: number;
        total?: number;
        nextCursor?: number | null;
        hasMore?: boolean;
      }>(response);
      const chunkProcessed = Number(chunk?.processed || 0);
      const nextCursor = Number(chunk?.nextCursor || 0);
      hasMore = chunk?.hasMore === true;
      processed += chunkProcessed;
      resolved += Number(chunk?.resolved || 0);
      pending = Number(chunk?.pending || 0);
      total = Number(chunk?.total || total);

      if (hasMore && (chunkProcessed === 0 || nextCursor <= cursor)) {
        throw new Error('A consolidacao de cargos nao avancou para o proximo lote.');
      }
      if (nextCursor > cursor) cursor = nextCursor;
    }

    if (hasMore) {
      throw new Error('A consolidacao de cargos excedeu o limite seguro de lotes.');
    }
    setTaxonomyProgress(`Vinculos de cargos consolidados: ${processed} de ${total}.`);
    return { processed, resolved, pending, total };
  }, []);

  const handleCheckTaxonomyUpdates = React.useCallback(async (showFailure = true) => {
    setIsCheckingTaxonomyUpdates(true);
    setError('');
    try {
      if (collectorState !== 'ready' && !(await checkCollector(showFailure, true))) return null;
      const remote = await checkGranTaxonomyUpdates();
      const response = await apiClient.post(ENDPOINT, {
        action: 'check_taxonomy_updates',
        manifests: remote.manifests,
      });
      const data = readApiData<{
        taxonomies?: Record<string, GranTaxonomyStatus>;
        summary?: TaxonomyCheckSummary;
      }>(response);
      const statuses = data?.taxonomies && typeof data.taxonomies === 'object' ? data.taxonomies : {};
      const changedCategories = data?.summary?.changedCategories
        ?? Object.values(statuses).filter((status) => status.updateAvailable === true).length;
      const checkedCatalogs = data?.summary?.checkedCatalogs ?? remote.requestCount;
      const currentCategories = data?.summary?.currentCategories
        ?? Math.max(0, Object.keys(statuses).length - changedCategories);
      const summary = {
        checkedCatalogs,
        changedCategories,
        currentCategories,
        checkedAt: data?.summary?.checkedAt ?? new Date().toISOString(),
      };
      setTaxonomyStatuses(statuses);
      setTaxonomyCheckSummary(summary);
      return statuses;
    } catch (requestError) {
      if (showFailure) {
        setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel verificar as taxonomias.');
      }
      return null;
    } finally {
      setIsCheckingTaxonomyUpdates(false);
    }
  }, [checkCollector, collectorState]);

  const handleTaxonomySync = React.useCallback(async (
    _steps: GranTaxonomyCollectorResult['kind'][],
    syncKey: string,
  ) => {
    const selectedCategories = syncKey === 'pending'
      ? GRAN_TAXONOMY_CATEGORIES
      : GRAN_TAXONOMY_CATEGORIES.filter((category) => category.key === syncKey);
    let effectiveStatuses = taxonomyStatuses;
    if (!isTaxonomyVerificationFresh(effectiveStatuses, selectedCategories.map((category) => category.key))) {
      setTaxonomyProgress('Verificando atualizacoes antes de sincronizar.');
      const checkedStatuses = await handleCheckTaxonomyUpdates(true);
      if (!checkedStatuses) return;
      effectiveStatuses = checkedStatuses;
    }
    const effectiveSteps = selectedCategories.flatMap((category) => {
      const status = effectiveStatuses[category.key];
      return status?.ready && status.updateAvailable !== true ? [] : category.steps;
    });
    if (effectiveSteps.length === 0) {
      setTaxonomyProgress('Todos os catalogos selecionados ja estao sincronizados.');
      return;
    }
    const subjectStatus = effectiveStatuses.assunto;
    const shouldRecoverSubjectRoots = effectiveSteps.some((step) => step === 'assunto_tree' || step === 'assunto')
      && subjectStatus?.synchronized === true
      && subjectStatus.pending > 0;
    const cargoStatus = effectiveStatuses.cargo;
    const canFinalizeCargoLocally = effectiveSteps.includes('cargo')
      && cargoStatus?.synchronized === true
      && cargoStatus.pending > 0
      && cargoStatus.records > 0
      && cargoStatus.metadataRecords >= cargoStatus.records;
    const requiresCollector = effectiveSteps.some((step) => {
      const category = GRAN_TAXONOMY_CATEGORIES.find((candidate) => candidate.steps.includes(step));
      return !(category?.key === 'cargo' && canFinalizeCargoLocally);
    });

    if (requiresCollector && collectorState !== 'ready') {
      setTaxonomyProgress('Verificando a conexao com a extensao privada.');
      const ready = await checkCollector(true);
      if (!ready) {
        setTaxonomyProgress('');
        return;
      }
    }

    setSyncingTaxonomyKey(syncKey);
    setError('');
    setTaxonomySummary(null);
    setTaxonomyProgress('Preparando a sincronizacao das taxonomias pendentes.');
    const summary: TaxonomySyncSummary = { processed: 0, created: 0, updated: 0, pending: 0, resolved: 0 };
    try {
      let subjectHierarchyFinalized = false;
      let cargoRelationsFinalized = false;

      if (canFinalizeCargoLocally) {
        setTaxonomyProgress('Reconciliando os vinculos pendentes dos cargos com os catalogos ja importados.');
        const finalized = await finalizeCargoRelationsInChunks(true);
        summary.resolved += finalized.resolved;
        summary.pending = finalized.pending;
        cargoRelationsFinalized = true;
      }

      if (shouldRecoverSubjectRoots) {
        for (let round = 0; round < 12; round += 1) {
          setTaxonomyProgress(
            round === 0
              ? 'Localizando somente os pais e raizes realmente ausentes.'
              : 'Completando o proximo nivel ausente da hierarquia.',
          );
          const gapsResponse = await apiClient.post(ENDPOINT, { action: 'taxonomy_hierarchy_gaps' });
          const gaps = readApiData<{ rootExternalIds?: unknown[] }>(gapsResponse);
          const missingExternalIds = Array.from(new Set(
            (Array.isArray(gaps?.rootExternalIds) ? gaps.rootExternalIds : [])
              .map((value) => String(value).trim())
              .filter((value) => /^\d+$/.test(value)),
          ));
          if (missingExternalIds.length === 0) break;

          setTaxonomyProgress(`Consultando ${missingExternalIds.length} no(s) ausente(s) em um unico lote.`);
          const collection = await collectGranTaxonomyBatch('assunto_tree', missingExternalIds);
          const rootResponse = await apiClient.post(ENDPOINT, {
            action: 'resolve_subject_taxonomy_pending',
            requestedExternalIds: missingExternalIds,
            granResponses: collection.responses.map((item) => item.json),
          });
          const recovered = readApiData<{
            recovery?: { found?: number; created?: number; updated?: number };
            finalized?: { resolved?: number; pending?: number };
            nextMissingExternalIds?: unknown[];
          }>(rootResponse);
          const found = Number(recovered?.recovery?.found || 0);
          summary.processed += found;
          summary.created += Number(recovered?.recovery?.created || 0);
          summary.updated += Number(recovered?.recovery?.updated || 0);
          summary.resolved = Number(recovered?.finalized?.resolved || 0);
          summary.pending = Number(recovered?.finalized?.pending || 0);
          const nextMissing = Array.isArray(recovered?.nextMissingExternalIds)
            ? recovered.nextMissingExternalIds.map((value) => String(value))
            : [];
          if (summary.pending === 0 || nextMissing.length === 0) break;
          if (found === 0 || nextMissing.join(',') === missingExternalIds.join(',')) {
            throw new Error('A Gran nao retornou os pais pendentes solicitados.');
          }
        }
        subjectHierarchyFinalized = true;
      }

      const synchronizeStep = async (
        step: { kind: GranTaxonomyCollectorResult['kind']; label: string },
      ) => {
        setTaxonomyProgress(`Coletando ${step.label} em paginas de ate 1.000 itens.`);
        const collection = await collectGranTaxonomyBatch(step.kind);
        const collectedPages: GranTaxonomyCollectorResult[] = [...collection.responses];
        const responseBatches = splitGranTaxonomyResponses(collectedPages.map((item) => item.json));
        for (let index = 0; index < responseBatches.length; index += 1) {
          setTaxonomyProgress(
            `Gravando ${step.label}: lote ${index + 1} de ${responseBatches.length}.`,
          );
          const response = await apiClient.post(ENDPOINT, {
            action: 'sync_taxonomy_batch',
            taxonomyKind: step.kind,
            granResponses: responseBatches[index],
            finalizeRelations: false,
          }, { timeout: 120_000 });
          const data = readApiData<{
            processed?: number; created?: number; updated?: number; pending?: number;
          }>(response);
          summary.processed += Number(data?.processed || 0);
          summary.created += Number(data?.created || 0);
          summary.updated += Number(data?.updated || 0);
          summary.pending = Math.max(summary.pending, Number(data?.pending || 0));
        }
        await apiClient.post(ENDPOINT, {
          action: 'mark_taxonomy_synced',
          taxonomyKind: step.kind,
        });
      };

      for (const step of GRAN_TAXONOMY_STEPS.filter((candidate) => effectiveSteps.includes(candidate.kind))) {
        const category = GRAN_TAXONOMY_CATEGORIES.find((candidate) => candidate.steps.includes(step.kind));
        if (shouldRecoverSubjectRoots && category?.key === 'assunto') {
          continue;
        }
        if (cargoRelationsFinalized && category?.key === 'cargo') {
          continue;
        }
        await synchronizeStep(step);
      }

      setTaxonomyProgress('Consolidando a hierarquia de matérias, tópicos e assuntos.');
      const shouldFinalizeCargoRelations = effectiveSteps.some((step) => (
        step === 'cargo' || step === 'carreira' || step === 'area' || step === 'orgao'
      ));
      if (!cargoRelationsFinalized && shouldFinalizeCargoRelations) {
        setTaxonomyProgress('Consolidando os vinculos de cargos, carreiras, orgaos e niveis uma unica vez.');
        const finalized = await finalizeCargoRelationsInChunks(false);
        summary.resolved += finalized.resolved;
        if (effectiveSteps.includes('cargo')) summary.pending = finalized.pending;
        cargoRelationsFinalized = true;
      }

      if (!subjectHierarchyFinalized && (effectiveSteps.includes('assunto_tree') || effectiveSteps.includes('assunto'))) {
        const finalizeResponse = await apiClient.post(ENDPOINT, { action: 'finalize_taxonomy_sync' });
        const finalized = readApiData<{ resolved?: number; pending?: number }>(finalizeResponse);
        summary.resolved = Number(finalized?.resolved || 0);
        // Pendencias por pagina sao transitorias: somente a conciliacao final
        // representa uma relacao realmente ausente na arvore local.
        summary.pending = Number(finalized?.pending || 0);
      }
      const refreshedStatuses = await loadTaxonomyStatus(true);
      if (refreshedStatuses) {
        const relevantCategoryKeys = Array.from(new Set(
          effectiveSteps
            .map((step) => GRAN_TAXONOMY_CATEGORIES.find((category) => category.steps.includes(step))?.key)
            .filter((key): key is GranTaxonomyCategory['key'] => Boolean(key)),
        ));
        summary.pending = relevantCategoryKeys.reduce(
          (total, key) => total + Number(refreshedStatuses[key]?.pending || 0),
          0,
        );
      }
      setTaxonomySummary({ ...summary });
      if (summary.pending > 0) {
        setTaxonomyProgress('');
        setError(
          `${summary.pending} relação${summary.pending === 1 ? '' : 'ões'} ainda não foi retornada pela árvore da Gran. `
          + 'O catálogo continua marcado como pendente e nenhuma questão com essa hierarquia deve ser publicada.',
        );
      } else {
        setTaxonomyProgress('Taxonomias sincronizadas. As próximas questões usarão os IDs locais corretos.');
      }
    } catch (requestError: unknown) {
      const axiosError = requestError as { response?: { data?: { message?: string } }; message?: string };
      setTaxonomyProgress('');
      setError(axiosError.response?.data?.message || axiosError.message || 'Não foi possível sincronizar as taxonomias da Gran.');
    } finally {
      setSyncingTaxonomyKey(null);
    }
  }, [checkCollector, collectorState, finalizeCargoRelationsInChunks, handleCheckTaxonomyUpdates, loadTaxonomyStatus, taxonomyStatuses]);

  const pendingTaxonomySteps = GRAN_TAXONOMY_CATEGORIES.flatMap((category) => {
    const status = taxonomyStatuses[category.key];
    return status?.ready && status.updateAvailable !== true ? [] : category.steps;
  });

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
              {collectorConnectionLabel(collectorState, collectorStatus)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void checkCollector(true, true)}
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
            Remova a versão anterior, baixe a v1.0.21 e carregue a nova pasta em
            {' '}
            <strong>chrome://extensions</strong>
            . O botão Verificar reconhece a extensão sem recarregar esta página. A sessão Gran precisa estar válida.
          </p>
        </div>

        <div className="rounded-md border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <button type="button" onClick={() => setTaxonomyExpanded((current) => !current)} className="text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">
                Taxonomias canônicas
              </p>
              {taxonomyExpanded ? <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                Sincronize a árvore de matérias, tópicos e assuntos e os catálogos de banca, órgão,
                cargo, carreira e área/foco antes de publicar questões da Gran.
              </p> : null}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCheckTaxonomyUpdates()}
                disabled={isCheckingTaxonomyUpdates || syncingTaxonomyKey !== null}
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} shrink-0 px-4 py-2 text-xs disabled:opacity-50`}
              >
                <RefreshCw size={15} className={isCheckingTaxonomyUpdates ? 'animate-spin' : ''} />
                Verificar atualizacoes
              </button>
              <button
              type="button"
              onClick={() => void handleTaxonomySync(pendingTaxonomySteps, 'pending')}
              disabled={syncingTaxonomyKey !== null || isLoadingTaxonomyStatus || pendingTaxonomySteps.length === 0}
              className={`${ADMIN_PRIMARY_BUTTON_CLASS} shrink-0 px-4 py-2 text-xs disabled:opacity-50`}
            >
              {syncingTaxonomyKey === 'pending' || isLoadingTaxonomyStatus
                ? <Loader2 size={15} className="animate-spin" />
                : pendingTaxonomySteps.length > 0
                  ? <RefreshCw size={15} />
                  : <CheckCircle2 size={15} />}
              {pendingTaxonomySteps.length > 0 ? 'Sincronizar' : 'Tudo sincronizado'}
              </button>
            </div>
          </div>
          {taxonomyCheckSummary ? (
            <p
              className="mt-3 rounded-md border border-indigo-200 bg-white/70 px-3 py-2 text-xs font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-slate-950/30 dark:text-indigo-300"
              data-testid="gran-taxonomy-check-result"
            >
              {taxonomyCheckSummary.checkedCatalogs} catalogos verificados.
              {' '}
              {taxonomyCheckSummary.changedCategories > 0
                ? `${taxonomyCheckSummary.changedCategories} categoria(s) possuem atualizacoes e ${taxonomyCheckSummary.currentCategories} estao em dia.`
                : 'Todas as categorias estao atualizadas.'}
              {' '}
              Verificado em {new Date(taxonomyCheckSummary.checkedAt).toLocaleString('pt-BR')}.
            </p>
          ) : null}
          {taxonomyExpanded ? <>
          {taxonomyProgress ? <p className="mt-3 text-xs font-semibold text-indigo-700 dark:text-indigo-300">{taxonomyProgress}</p> : null}
          {collectorState !== 'ready' ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              A sincronizacao depende da extensao privada conectada. Instale ou atualize o coletor e recarregue esta pagina.
            </p>
          ) : null}
          {taxonomySummary ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {taxonomySummary.processed} registros lidos, {taxonomySummary.created} criados, {taxonomySummary.updated} atualizados,
              {' '}{taxonomySummary.resolved} relações consolidadas{taxonomySummary.pending ? ` e ${taxonomySummary.pending} pendências de hierarquia.` : '.'}
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {GRAN_TAXONOMY_CATEGORIES.map((category) => {
              const status = taxonomyStatuses[category.key];
              const isSyncing = syncingTaxonomyKey === category.key || syncingTaxonomyKey === 'pending';
              const stateLabel = isLoadingTaxonomyStatus
                ? 'Verificando'
                : status?.ready
                  ? status.updateAvailable ? 'Atualizacao disponivel' : 'Sincronizada'
                  : status?.synchronized
                    ? `${status.pending} pendencia${status.pending === 1 ? '' : 's'}`
                    : 'Nao sincronizada';
              const stateClass = status?.ready
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-300'
                : status?.synchronized
                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-300'
                  : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';

              return (
                <div key={category.key} className={`rounded-md border p-3 ${stateClass}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black">{category.label}</p>
                      <p className="mt-1 text-[11px] leading-4 opacity-80">{category.description}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-wide dark:bg-slate-950/30">
                      {stateLabel}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold">
                      {isLoadingTaxonomyStatus ? 'Consultando catalogo...' : `${status?.records ?? 0} registros Gran`}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleTaxonomySync(
                        status?.ready && status.updateAvailable !== true ? [] : category.steps,
                        category.key,
                      )}
                      disabled={syncingTaxonomyKey !== null || isLoadingTaxonomyStatus
                        || (status?.ready === true && status.updateAvailable !== true)}
                      className={`${ADMIN_SECONDARY_BUTTON_CLASS} shrink-0 px-3 py-1.5 text-[10px] disabled:opacity-50`}
                    >
                      {isSyncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      {status?.ready
                        ? status.updateAvailable ? 'Atualizar' : 'Em dia'
                        : status?.synchronized ? 'Resolver pendencias' : 'Sincronizar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </> : null}
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
            <input
              type="number"
              min={1}
              max={MAX_GRAN_QUESTIONS_PER_PAGE}
              step={1}
              value={perPage}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                const nextPerPage = Math.max(
                  1,
                  Math.min(MAX_GRAN_QUESTIONS_PER_PAGE, Number.isFinite(parsed) ? Math.trunc(parsed) : 1),
                );
                setPerPage(nextPerPage);
                updateDirectUrlPagination('perPage', nextPerPage);
              }}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              aria-describedby="gran-per-page-help"
            />
            <span id="gran-per-page-help" className="block text-[11px] text-slate-500">
              Informe de 1 a {MAX_GRAN_QUESTIONS_PER_PAGE} questoes.
            </span>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Ano opcional
            </span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={year}
              onChange={(event) => {
                const nextYear = event.target.value.replace(/\D/g, '').slice(0, 4);
                setYear(nextYear);
                if (granRequestUrl.trim() && (nextYear === '' || nextYear.length === 4)) {
                  try {
                    setGranRequestUrl(buildGranQuestionQueryUrl(granRequestUrl, { page, perPage, year: nextYear }));
                  } catch {
                    // A validacao autoritativa aparece ao consultar.
                  }
                }
              }}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="2026"
            />
          </label>
        </div>

        <div className="rounded-md border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900/60 dark:bg-sky-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
                <Bot size={18} className="text-sky-600" />
                Modo automatico
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
                Publica enquanto coleta a pagina seguinte, mantendo no maximo duas paginas em processamento.
                Ao terminar um ano, continua na pagina 1 do ano seguinte; o proximo ponto fica salvo no servidor.
              </p>
              <p className="mt-2 text-xs font-semibold text-sky-800 dark:text-sky-300">
                {automaticProgress.message}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <p className="max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">
                A quantidade total de paginas vem da resposta da Gran. Cada pagina gera seu proprio lote, sem acumular uma fila ilimitada.
              </p>
              {automaticCheckpoint && !automaticMode ? (
                <button
                  type="button"
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-11 px-4 text-xs`}
                  onClick={() => void clearAutomaticCheckpoint().then(() => {
                    setAutomaticProgress({
                      phase: 'idle',
                      year: 0,
                      page: 1,
                      totalPages: null,
                      questionsCollected: 0,
                      message: 'Progresso automatico descartado.',
                    });
                  }).catch((requestError) => {
                    setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel descartar o progresso salvo.');
                  })}
                >
                  Descartar progresso
                </button>
              ) : null}
              <label className={`${automaticMode ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-700 hover:bg-sky-800'} inline-flex h-11 min-w-44 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-xs font-black text-white transition-colors`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={automaticMode}
                  onChange={() => {
                    if (automaticMode) stopAutomaticMode();
                    else void startAutomaticMode();
                  }}
                  aria-label="Ativar ou desativar modo automatico"
                />
                {automaticMode ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                {automaticMode ? 'Interromper automatico' : automaticCheckpoint ? 'Retomar automatico' : 'Ativar automatico'}
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleFetch()}
            disabled={isFetching || automaticMode}
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
                {reviewQueues.pendingQuestionCount} para revisar
                {reviewQueues.publishedQuestionCount > 0
                  ? ` · ${reviewQueues.publishedQuestionCount} já publicada(s)`
                  : ''}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {result.fileCount || 0} arquivo(s) oficial(is). As paginas carregadas permanecem nesta fila ate voce limpa-la.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-xs`}
                title="Limpar a fila acumulada"
              >
                <Trash2 size={15} />
                Limpar fila
              </button>
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

      {(result?.payloads?.length || 0) > 0 && renderReviewQueue ? (
        <section>
          {renderReviewQueue(result?.payloads || [], {
            publicationBatches,
            onPublicationQueued: () => void refreshCurrentProcessing(),
          })}
        </section>
      ) : null}

      {currentBatch ? (
        <section
          className={`${ADMIN_PAGE_PANEL_CLASS} space-y-3`}
          data-testid="gran-current-processing"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Publicação
              </p>
              <h3 className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
                {hasActiveJobs ? 'Processamento atual' : 'Último processamento'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => void refreshCurrentProcessing()}
              disabled={isLoadingProcessing}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-xs disabled:opacity-50`}
            >
              <RefreshCw size={14} className={isLoadingProcessing ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>

          <div className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <strong className="text-slate-800 dark:text-slate-100">
                {currentBatch.displayName || `${formatCollectionPages(currentBatch.collectionPages)} · ${currentBatch.questionCount} questões`}
              </strong>
              <span className="font-bold text-slate-500 dark:text-slate-400">
                {statusLabel[currentBatch.status] || currentBatch.status}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-sky-600 transition-[width]"
                style={{
                  width: `${currentBatch.questionCount > 0
                    ? Math.min(100, Math.round((
                      (currentBatch.published + currentBatch.duplicates + currentBatch.failures)
                      / currentBatch.questionCount
                    ) * 100))
                    : 0}%`,
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{currentBatch.published} publicadas</span>
              <span>{currentBatch.duplicates} já existentes</span>
              <span>{currentBatch.pending} aguardando</span>
              <span>{currentBatch.processing} processando</span>
              <span>{currentBatch.failures} falhas</span>
              <span>Iniciado em {formatDateTime(currentBatch.createdAt)}</span>
            </div>
            {currentBatch.error ? (
              <p className="mt-2 text-xs font-semibold text-rose-600">{currentBatch.error}</p>
            ) : null}

            {currentBatchQuestionDetails.length > 0 ? (
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowProcessingDetails((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 text-left text-xs font-bold text-slate-700 dark:text-slate-200"
                  aria-expanded={showProcessingDetails}
                >
                  <span>Detalhes das {currentBatchQuestionDetails.length} questões</span>
                  {showProcessingDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showProcessingDetails ? (
                  <div className="mt-3 max-h-80 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
                    {currentBatchQuestionDetails.map((detail) => (
                      <div
                        key={detail.key}
                        className="grid gap-1 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0 dark:border-slate-800 md:grid-cols-[minmax(12rem,1fr)_9rem_minmax(16rem,2fr)]"
                      >
                        <strong className="break-all text-slate-700 dark:text-slate-200">
                          {formatQuestionKey(detail.key, detail.index)}
                        </strong>
                        <span className={detail.status === 'failed'
                          ? 'font-bold text-rose-600'
                          : detail.status === 'published'
                            ? 'font-bold text-emerald-600'
                            : 'font-bold text-slate-500'}
                        >
                          {questionStatusLabel[detail.status] || detail.status}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {detail.error
                            || (detail.status === 'failed' ? 'Falha sem detalhe registrado.' : null)
                            || (detail.status === 'duplicate' ? 'A questão já existia na plataforma.' : null)
                            || (detail.status === 'published' ? 'Publicada neste processamento.' : '-')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className={`${ADMIN_PAGE_PANEL_CLASS} space-y-4`} data-testid="gran-publication-failure-history">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-500">
              Falhas de publicacao
            </p>
            <h3 className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
              Questoes com erro pendente ({failureHistory.total})
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Abra o rascunho para editar ou tente publicar novamente sem refazer a coleta inteira.
              Depois de publicada, a questao e removida automaticamente desta lista.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRetryAllFailures()}
              disabled={failureHistory.openCount === 0 || failureActionId !== null}
              className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-3 py-2 text-[10px] disabled:opacity-50`}
            >
              {failureActionId === 'all' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Tentar todas ({failureHistory.openCount})
            </button>
            <button
              type="button"
              onClick={() => void handleIgnoreAllFailures()}
              disabled={failureHistory.total === 0 || failureActionId !== null}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] text-slate-500 disabled:opacity-50`}
              title="Remove todas as falhas abertas da fila operacional, sem apagar diagnosticos ou questoes."
            >
              {failureActionId === 'all' ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
              Ignorar todas ({failureHistory.total})
            </button>
            <button
              type="button"
              onClick={() => void loadFailureHistory()}
              disabled={isLoadingFailures}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] disabled:opacity-50`}
            >
              <RefreshCw size={13} className={isLoadingFailures ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-slate-700 dark:bg-slate-950/30 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-bold text-slate-700 dark:text-slate-200">Higiene do historico</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Falhas abertas e em nova tentativa ficam preservadas. Rascunhos resolvidos/ignorados perdem o JSON completo apos {failureRetention?.payloadRetentionDays || 30} dias;
              o registro resumido e removido apos {failureRetention?.recordRetentionDays || 90} dias.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
              {failureRetention?.totalEligible || 0} elegivel(is)
            </span>
            <button
              type="button"
              onClick={() => setPurgeDiagnosticsConfirmOpen(true)}
              disabled={!failureRetention?.totalEligible || failureActionId !== null}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] text-slate-600 disabled:opacity-50`}
              title="Remove apenas diagnosticos resolvidos ou ignorados que passaram da retencao."
            >
              {failureActionId === 'retention' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Limpar diagnosticos antigos
            </button>
            <button
              type="button"
              onClick={() => void refreshFailureRetention()}
              disabled={failureActionId !== null}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] disabled:opacity-50`}
              title="Atualiza somente a contagem de diagnosticos elegiveis."
            >
              <RefreshCw size={13} />
              Verificar
            </button>
          </div>
        </div>

        {failureHistory.items.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-xs font-semibold text-slate-500 dark:border-slate-700">
            Nenhuma falha de publicacao registrada neste filtro.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
            {failureHistory.items.map((failure) => {
              const isActing = failureActionId === failure.failureId;
              return (
                <article
                  key={failure.failureId}
                  className="border-b border-slate-100 p-4 last:border-b-0 dark:border-slate-800"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertTriangle size={15} className="text-rose-600" />
                        <strong className="text-sm text-slate-900 dark:text-slate-100">
                          {failure.externalQuestionId ? `Q${failure.externalQuestionId}` : failure.sourceKey}
                        </strong>
                        <span className={`rounded-sm px-2 py-1 text-[10px] font-black uppercase ${failure.status === 'retrying'
                          ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}
                        >
                          {failure.status === 'retrying' ? 'Nova tentativa' : 'Pendente'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {failure.attemptCount} tentativa(s)
                        </span>
                      </div>
                      {failure.examTitle ? (
                        <p className="mt-2 truncate text-xs font-bold text-slate-600 dark:text-slate-300">
                          {failure.examTitle}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs leading-5 text-rose-700 dark:text-rose-300">
                        {failure.message}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Codigo: {failure.code} · ultima falha em {formatDateTime(failure.lastFailedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleModerateFailure(failure)}
                        disabled={isActing}
                        className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] disabled:opacity-50`}
                      >
                        {isActing ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />}
                        Moderar e editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRetryFailure(failure)}
                        disabled={isActing || failure.status === 'retrying'}
                        className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-3 py-2 text-[10px] disabled:opacity-50`}
                      >
                        {isActing || failure.status === 'retrying'
                          ? <Loader2 size={13} className="animate-spin" />
                          : <RefreshCw size={13} />}
                        Tentar novamente
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleIgnoreFailure(failure)}
                        disabled={isActing}
                        className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] text-slate-500 disabled:opacity-50`}
                        title="Remove apenas esta falha da lista operacional; a questao e o diagnostico continuam preservados."
                      >
                        {isActing ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                        Ignorar
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{failureHistory.items.length} de {failureHistory.total} falha(s) exibida(s)</span>
          {failureHistory.nextCursor ? (
            <button
              type="button"
              onClick={() => void loadFailureHistory(failureHistory.nextCursor)}
              disabled={isLoadingFailures}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] disabled:opacity-50`}
            >
              {isLoadingFailures ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
              Carregar mais
            </button>
          ) : null}
        </div>
      </section>

      <AdminConfirmDialog
        isOpen={purgeDiagnosticsConfirmOpen}
        title="Limpar diagnósticos antigos"
        description={`Serão removidos ${failureRetention?.totalEligible || 0} diagnóstico(s) encerrado(s): snapshots com mais de ${failureRetention?.payloadRetentionDays || 30} dias e registros com mais de ${failureRetention?.recordRetentionDays || 90} dias. Falhas abertas, novas tentativas e questões publicadas não serão alteradas.`}
        confirmLabel="Limpar diagnósticos"
        loading={failureActionId === 'retention'}
        onCancel={() => setPurgeDiagnosticsConfirmOpen(false)}
        onConfirm={() => void handlePurgeFailureDiagnostics()}
      />
    </div>
  );
};

export default AdminGranCrawlerSection;
