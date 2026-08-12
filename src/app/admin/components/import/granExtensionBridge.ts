'use client';

const PAGE_SOURCE = 'concursomestre-gran-page';
const EXTENSION_SOURCE = 'concursomestre-gran-extension';
const DEFAULT_TIMEOUT_MS = 50_000;
const PING_TIMEOUT_MS = 8_000;
const PING_RETRY_DELAY_MS = 250;
const EXTENSION_READY_TYPE = 'EXTENSION_READY';
const EXTENSION_READY_EVENT = 'concursomestre:gran-collector-ready';
const EXTENSION_DISCOVER_EVENT = 'concursomestre:gran-collector-discover';
const EXTENSION_MARKER_ATTRIBUTE = 'data-concursomestre-gran-collector';

type BridgeResponse<T> = {
  source: typeof EXTENSION_SOURCE;
  requestId: string;
  type: string;
  success: boolean;
  data?: T;
  message?: string | null;
};

export type GranCollectorStatus = {
  connected: boolean;
  expiresAt: number | null;
  version: string;
  captureState?: string;
  lastObservedAt?: number | null;
};

export type GranCollectorPresence = {
  detected: boolean;
  version: string;
};

export type GranCollectorResult = {
  status: number;
  requestUrl: string;
  json: Record<string, unknown>;
  examFiles: Record<string, {
    edital?: string;
    folhaDeProva?: string;
    gabarito?: string;
  }>;
  assetData?: Record<string, {
    sourceUrl?: string;
    base64?: string;
    mimeType?: string;
    size?: number;
    error?: string;
  }>;
  warnings?: string[];
};

export type GranTaxonomyCollectorResult = {
  kind: 'assunto_tree' | 'assunto' | 'banca' | 'orgao' | 'cargo' | 'carreira' | 'area';
  page: number;
  status: number;
  requestUrl: string;
  json: Record<string, unknown>;
};

export type GranTaxonomyBatchCollectorResult = {
  kind: GranTaxonomyCollectorResult['kind'];
  responses: GranTaxonomyCollectorResult[];
  requestCount: number;
  rootCount: number;
};

export type GranTaxonomyUpdateManifest = {
  taxonomyKind: GranTaxonomyCollectorResult['kind'];
  total: number;
  indexSignature: string | null;
  updatedAt: string | null;
  fingerprint: string;
  checkedAt: string;
};

export type GranTaxonomyUpdateCheckResult = {
  manifests: GranTaxonomyUpdateManifest[];
  requestCount: number;
};

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `gran_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const requestExtension = <T,>(
  type: 'PING' | 'COLLECT' | 'COLLECT_QUESTION' | 'COLLECT_TAXONOMY_PAGE' | 'COLLECT_TAXONOMY_BATCH' | 'CHECK_TAXONOMY_UPDATES',
  payload: Record<string, unknown> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<T> => new Promise((resolve, reject) => {
  if (typeof window === 'undefined') {
    reject(new Error('O coletor Gran esta disponivel somente no navegador.'));
    return;
  }
  const requestId = createRequestId();
  let settled = false;
  const finish = (callback: () => void) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    window.removeEventListener('message', handleMessage);
    signal?.removeEventListener('abort', handleAbort);
    callback();
  };
  const timer = window.setTimeout(() => {
    finish(() => reject(new Error(
      type === 'PING'
        ? 'Extensao do coletor nao detectada.'
        : 'A extensao nao respondeu dentro do tempo limite.',
    )));
  }, timeoutMs);

  const handleAbort = () => finish(() => reject(new DOMException('Operacao cancelada.', 'AbortError')));

  function handleMessage(event: MessageEvent<BridgeResponse<T>>) {
    if (
      event.source !== window
      || event.origin !== window.location.origin
      || event.data?.source !== EXTENSION_SOURCE
      || event.data?.requestId !== requestId
      || event.data?.type !== `${type}_RESULT`
    ) {
      return;
    }
    if (!event.data.success) {
      finish(() => reject(new Error(event.data.message || 'A extensao recusou a solicitacao.')));
      return;
    }
    finish(() => resolve(event.data.data as T));
  }

  if (signal?.aborted) {
    handleAbort();
    return;
  }
  window.addEventListener('message', handleMessage);
  signal?.addEventListener('abort', handleAbort, { once: true });
  window.postMessage({
    source: PAGE_SOURCE,
    type,
    requestId,
    ...payload,
  }, window.location.origin);
});

export const pingGranCollector = () => requestExtension<GranCollectorStatus>('PING', {}, PING_TIMEOUT_MS);

export const verifyGranCollector = async (): Promise<GranCollectorStatus> => {
  if (typeof window === 'undefined') throw new Error('O coletor Gran esta disponivel somente no navegador.');
  document.documentElement?.removeAttribute(EXTENSION_MARKER_ATTRIBUTE);
  window.dispatchEvent(new CustomEvent(EXTENSION_DISCOVER_EVENT));
  // Manifest V3 can wake the worker after the bridge is reinjected.
  // The marker confirms presence only; PING confirms the live connection.
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  try {
    return await pingGranCollector();
  } catch (firstError) {
    await new Promise((resolve) => window.setTimeout(resolve, PING_RETRY_DELAY_MS));
    window.dispatchEvent(new CustomEvent(EXTENSION_DISCOVER_EVENT));
    try {
      return await pingGranCollector();
    } catch {
      throw firstError;
    }
  }
};

const readCollectorMarker = (): GranCollectorPresence => {
  if (typeof document === 'undefined') return { detected: false, version: '' };
  const version = document.documentElement?.getAttribute(EXTENSION_MARKER_ATTRIBUTE)?.trim() || '';
  return { detected: version !== '', version };
};

export const detectGranCollector = (timeoutMs = 700): Promise<GranCollectorPresence> => new Promise((resolve) => {
  if (typeof window === 'undefined') {
    resolve({ detected: false, version: '' });
    return;
  }

  const marker = readCollectorMarker();
  if (marker.detected) {
    resolve(marker);
    return;
  }

  let settled = false;
  const finish = (presence: GranCollectorPresence) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    window.removeEventListener('message', handleMessage);
    window.removeEventListener(EXTENSION_READY_EVENT, handleReadyEvent);
    resolve(presence);
  };
  const handleMessage = (event: MessageEvent<{ source?: string; type?: string; version?: string }>) => {
    if (
      event.source === window
      && event.origin === window.location.origin
      && event.data?.source === EXTENSION_SOURCE
      && event.data?.type === EXTENSION_READY_TYPE
    ) {
      finish({ detected: true, version: String(event.data.version || '') });
    }
  };
  const handleReadyEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ version?: string }>).detail;
    finish({ detected: true, version: String(detail?.version || readCollectorMarker().version || '') });
  };
  const timer = window.setTimeout(() => finish(readCollectorMarker()), timeoutMs);

  window.addEventListener('message', handleMessage);
  window.addEventListener(EXTENSION_READY_EVENT, handleReadyEvent);
  window.dispatchEvent(new CustomEvent(EXTENSION_DISCOVER_EVENT));
});

export const collectGranQuestions = (url: string, signal?: AbortSignal) => requestExtension<GranCollectorResult>(
  'COLLECT',
  { url },
  DEFAULT_TIMEOUT_MS,
  signal,
);

export const collectGranQuestionById = (externalId: string, subjectSlug = '', signal?: AbortSignal) => requestExtension<GranCollectorResult>(
  'COLLECT_QUESTION',
  { externalId, subjectSlug },
  DEFAULT_TIMEOUT_MS,
  signal,
);

export const collectGranTaxonomyPage = (
  kind: GranTaxonomyCollectorResult['kind'],
  page: number,
  rootExternalIds: string[] = [],
) => requestExtension<GranTaxonomyCollectorResult>(
  'COLLECT_TAXONOMY_PAGE',
  { kind, page, rootExternalIds },
);

export const collectGranTaxonomyBatch = (
  kind: GranTaxonomyCollectorResult['kind'],
  rootExternalIds: string[] = [],
) => requestExtension<GranTaxonomyBatchCollectorResult>(
  'COLLECT_TAXONOMY_BATCH',
  { kind, rootExternalIds },
  10 * 60_000,
);

export const checkGranTaxonomyUpdates = () => requestExtension<GranTaxonomyUpdateCheckResult>(
  'CHECK_TAXONOMY_UPDATES',
  {},
  2 * 60_000,
);
