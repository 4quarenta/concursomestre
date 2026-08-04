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
  checkGranTaxonomyUpdates,
  detectGranCollector,
  verifyGranCollector,
} from './granExtensionBridge';
import type { GranCollectorStatus, GranTaxonomyCollectorResult } from './granExtensionBridge';
import { mergeGranReviewPayloads, partitionGranReviewPayloads } from './granCrawlerReviewUtils';
import { splitGranTaxonomyResponses } from './granTaxonomySyncUtils';
import { buildGranQuestionQueryUrl, readGranQuestionQueryControls } from './granCrawlerUrl';

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
  status: string;
  questionCount: number;
  jobCount: number;
  pending: number;
  processing: number;
  published: number;
  duplicates: number;
  failures: number;
  questionKeys?: string[];
  questionStatuses?: Record<string, 'queued' | 'processing' | 'published' | 'failed'>;
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
};

const ENDPOINT = 'admin/gran_crawler.php';
const EXTENSION_DOWNLOAD_URL = '/downloads/concursomestre-coletor-gran-v1.0.15.zip';
const MAX_GRAN_QUESTIONS_PER_PAGE = 100;
const BOOTSTRAP_CACHE_MS = 60_000;
const COLLECTOR_STATUS_CACHE_MS = 30_000;
const TAXONOMY_CHECK_FRESH_MS = 6 * 60 * 60 * 1000;

let bootstrapCache: { data: GranCrawlerBootstrapData; fetchedAt: number } | null = null;
let bootstrapRequest: Promise<GranCrawlerBootstrapData> | null = null;
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

const fetchGranCrawlerBootstrap = async (force = false): Promise<GranCrawlerBootstrapData> => {
  const now = Date.now();
  if (!force && bootstrapCache && now - bootstrapCache.fetchedAt < BOOTSTRAP_CACHE_MS) {
    return bootstrapCache.data;
  }
  if (bootstrapRequest) return bootstrapRequest;

  bootstrapRequest = apiClient.get(ENDPOINT)
    .then((response) => {
      const data = readApiData<GranCrawlerBootstrapData>(response) || {};
      bootstrapCache = { data, fetchedAt: Date.now() };
      return data;
    })
    .finally(() => {
      bootstrapRequest = null;
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
  const [result, setResult] = React.useState<GranFetchResult | null>(null);
  const [currentBatch, setCurrentBatch] = React.useState<GranPublicationBatch | null>(null);
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
  const [isPageVisible, setIsPageVisible] = React.useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  const fetchAbortRef = React.useRef<AbortController | null>(null);
  const publicationBatches = React.useMemo(() => currentBatch ? [currentBatch] : [], [currentBatch]);
  const hasActiveJobs = currentBatch !== null && ['pending', 'processing'].includes(currentBatch.status);
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
  ): Promise<GranCrawlerBootstrapData | null> => {
    if (!silent) setIsLoadingProcessing(true);
    try {
      const data = await fetchGranCrawlerBootstrap(force);
      setCurrentBatch(data?.currentBatch && typeof data.currentBatch === 'object' ? data.currentBatch : null);
      if (hydrateTaxonomies && data?.taxonomyStatus && typeof data.taxonomyStatus === 'object') {
        setTaxonomyStatuses(data.taxonomyStatus);
        setIsLoadingTaxonomyStatus(false);
      }
      return data;
    } catch (requestError) {
      if (!silent) {
        setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar a fila.');
      }
      return null;
    } finally {
      if (!silent) setIsLoadingProcessing(false);
    }
  }, []);

  const loadTaxonomyStatus = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoadingTaxonomyStatus(true);
    const data = await loadBootstrap(true, true, true);
    if (!silent) setIsLoadingTaxonomyStatus(false);
    return data?.taxonomyStatus && typeof data.taxonomyStatus === 'object' ? data.taxonomyStatus : null;
  }, [loadBootstrap]);

  React.useEffect(() => {
    void Promise.resolve().then(() => loadBootstrap(true, true));
    void Promise.resolve().then(() => checkCollector());
    return () => fetchAbortRef.current?.abort();
  }, [checkCollector, loadBootstrap]);

  React.useEffect(() => {
    const handleVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setIsPageVisible(visible);
      if (visible && hasActiveJobs) void loadBootstrap(true, false, true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [hasActiveJobs, loadBootstrap]);

  React.useEffect(() => {
    if (!hasActiveJobs || !isPageVisible) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadBootstrap(true, false, true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, isPageVisible, loadBootstrap]);

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

  const handleFetch = React.useCallback(async (requestedPage?: number) => {
    if (collectorState !== 'ready') {
      const ready = await checkCollector(true);
      if (!ready) return;
    }

    const targetPage = requestedPage ?? page;
    let requestUrl = '';
    try {
      requestUrl = buildGranQuestionQueryUrl(granRequestUrl, { page: targetPage, perPage, year });
      setGranRequestUrl(requestUrl);
    } catch (urlError) {
      setError(urlError instanceof Error ? urlError.message : 'A URL da consulta e invalida.');
      return;
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
      setResult((current) => {
        if (!current) return data;
        const merged = mergeGranReviewPayloads(current.payloads, data.payloads, 5000);
        if (merged.limitReached && merged.added < data.questionCount) {
          setError('A fila atingiu o limite de 5.000 questoes. Publique ou limpe a fila antes de continuar.');
        }
        return { ...data, payloads: merged.payloads, questionCount: merged.total };
      });
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
            Remova a versão anterior, baixe a v1.0.15 e carregue a nova pasta em
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

      {reviewQueues.pendingPayloads.length > 0 && renderReviewQueue ? (
        <section>
          {renderReviewQueue(reviewQueues.pendingPayloads, {
            publicationBatches,
            onPublicationQueued: () => void refreshCurrentProcessing(),
          })}
        </section>
      ) : null}

      {reviewQueues.publishedPayloads.length > 0 && renderReviewQueue ? (
        <details className={ADMIN_PAGE_PANEL_CLASS}>
          <summary className="cursor-pointer select-none text-sm font-black text-slate-800 dark:text-slate-100">
            Questões já publicadas ({reviewQueues.publishedQuestionCount})
          </summary>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Ocultas por padrão e somente para conferência. Elas não entram novamente na publicação.
          </p>
          <div className="mt-4">
            {renderReviewQueue(reviewQueues.publishedPayloads, {
              publicationBatches,
              onPublicationQueued: () => void refreshCurrentProcessing(),
            })}
          </div>
        </details>
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
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default AdminGranCrawlerSection;
