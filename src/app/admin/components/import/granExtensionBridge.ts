'use client';

const PAGE_SOURCE = 'concursomestre-gran-page';
const EXTENSION_SOURCE = 'concursomestre-gran-extension';
const DEFAULT_TIMEOUT_MS = 50_000;

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

export type GranCollectorResult = {
  status: number;
  requestUrl: string;
  json: Record<string, unknown>;
  examFiles: Record<string, {
    edital?: string;
    folhaDeProva?: string;
    gabarito?: string;
  }>;
  warnings?: string[];
};

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `gran_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const requestExtension = <T,>(
  type: 'PING' | 'COLLECT',
  payload: Record<string, unknown> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> => new Promise((resolve, reject) => {
  if (typeof window === 'undefined') {
    reject(new Error('O coletor Gran esta disponivel somente no navegador.'));
    return;
  }
  const requestId = createRequestId();
  const timer = window.setTimeout(() => {
    window.removeEventListener('message', handleMessage);
    reject(new Error(
      type === 'PING'
        ? 'Extensao do coletor nao detectada.'
        : 'A extensao nao respondeu dentro do tempo limite.',
    ));
  }, timeoutMs);

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
    window.clearTimeout(timer);
    window.removeEventListener('message', handleMessage);
    if (!event.data.success) {
      reject(new Error(event.data.message || 'A extensao recusou a solicitacao.'));
      return;
    }
    resolve(event.data.data as T);
  }

  window.addEventListener('message', handleMessage);
  window.postMessage({
    source: PAGE_SOURCE,
    type,
    requestId,
    ...payload,
  }, window.location.origin);
});

export const pingGranCollector = () => requestExtension<GranCollectorStatus>('PING', {}, 2500);

export const collectGranQuestions = (url: string) => requestExtension<GranCollectorResult>(
  'COLLECT',
  { url },
);
