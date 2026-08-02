const GRAN_API_ORIGIN = 'https://rota-api.grancursosonline.com.br';
const GRAN_API_PATH = '/v1/elastic/questao';
const GRAN_EXAM_FILES_PATH_PREFIX = '/v1/provas/';
const GRAN_WEB_ORIGIN = 'https://questoes.grancursosonline.com.br';
const MAX_URL_LENGTH = 8000;
const MAX_RESPONSE_BYTES = 8_000_000;
const REQUEST_TIMEOUT_MS = 45_000;
const SESSION_TOKEN_KEY = 'granSession';
const CAPTURE_STATUS_KEY = 'granCaptureStatus';
const HEADER_RULE_ID = 44001;
const MAX_EXAM_FILE_REQUESTS = 50;
const EXAM_FILE_REQUEST_CONCURRENCY = 4;
const examFilesCache = new Map();
const TAXONOMY_PAGE_SIZE = 1000;
const MAX_TAXONOMY_ROOTS_PER_REQUEST = 25;
const MAX_TAXONOMY_ROOTS_PER_BATCH = 5000;
const MAX_TAXONOMY_PAGES_PER_BATCH = 500;

// A pagina administrativa nunca envia URL livre para sincronizar taxonomias.
// Cada tipo possui uma rota e um conjunto de parametros imutaveis auditaveis.
const TAXONOMY_ENDPOINTS = Object.freeze({
  assunto_tree: {
    path: '/v3/materia/arvore',
    perPage: TAXONOMY_PAGE_SIZE,
    params: [
      ['sort', 'indiceOrdenacao'], ['materia', '0'], ['comQuestoes', '1'],
      ['_source[]', 'id'], ['_source[]', 'nome'], ['_source[]', 'assunto_raiz'],
      ['_source[]', 'pai'], ['_source[]', 'indice'], ['_source[]', 'nivel'], ['_source[]', 'filhos'],
      ['_source[]', 'nome_clean'], ['_source[]', 'palavrasChave'], ['_source[]', 'slug'],
      ['_source[]', 'materia'], ['_source[]', 'oab'], ['_source[]', 'timestamp'],
      ['_source[]', 'maisBuscado'], ['_source[]', 'maisBuscadoPosicao'],
      ['_source[]', 'qtdQuestoes'], ['_source[]', 'qtdQuestoesNaoAcumulado'],
      ['_source[]', 'index'],
    ],
  },
  assunto: {
    path: '/v1/elastic/assunto', perPage: TAXONOMY_PAGE_SIZE,
    params: [
      ['_source[]', 'id'], ['_source[]', 'nome'], ['_source[]', 'nome_clean'],
      ['_source[]', 'assunto_raiz'], ['_source[]', 'pai'], ['_source[]', 'filhos'],
      ['_source[]', 'materia'], ['_source[]', 'oab'], ['_source[]', 'palavrasChave'],
      ['_source[]', 'qtdQuestoes'], ['_source[]', 'qtdQuestoesNaoAcumulado'],
      ['_source[]', 'maisBuscado'], ['_source[]', 'maisBuscadoPosicao'],
      ['_source[]', 'slug'], ['_source[]', 'timestamp'], ['_source[]', 'index'],
    ],
  },
  cargo: { path: '/v1/elastic/cargo', perPage: TAXONOMY_PAGE_SIZE, params: [] },
  orgao: { path: '/v1/elastic/orgao', perPage: TAXONOMY_PAGE_SIZE, params: [] },
  carreira: { path: '/v1/elastic/carreira', perPage: TAXONOMY_PAGE_SIZE, params: [] },
  banca: {
    path: '/v1/elastic/banca',
    perPage: TAXONOMY_PAGE_SIZE,
    params: [
      ['_source[]', 'id'], ['_source[]', 'nome'], ['_source[]', 'nome_clean'],
      ['_source[]', 'nome_completo'], ['_source[]', 'razao_social'],
      ['_source[]', 'sigla'], ['_source[]', 'acronym'], ['_source[]', 'abreviacao'],
      ['_source[]', 'descricao'], ['_source[]', 'description'],
      ['_source[]', 'site'], ['_source[]', 'website'], ['_source[]', 'site_url'],
      ['_source[]', 'url_site'], ['_source[]', 'logo'], ['_source[]', 'logo_url'],
      ['_source[]', 'imagem'], ['_source[]', 'image'],
      ['_source[]', 'palavrasChave'], ['_source[]', 'palavras_chave'], ['_source[]', 'aliases'],
      ['_source[]', 'oab'], ['_source[]', 'inedita'], ['_source[]', 'tiposProva'],
      ['_source[]', 'qtdConcursos'], ['_source[]', 'qtdProvas'],
      ['_source[]', 'qtdQuestoes'], ['_source[]', 'qtdComentarios'],
      ['_source[]', 'maisBuscado'], ['_source[]', 'maisBuscadoPosicao'],
      ['_source[]', 'slug'], ['_source[]', 'timestamp'], ['_source[]', 'index'],
    ],
  },
  // Gran chama foco de estudo de area; localmente ele e salvo como carreira/foco.
  area: { path: '/v1/elastic/area', perPage: TAXONOMY_PAGE_SIZE, params: [] },
});

const ALLOWED_PAGE_ORIGINS = new Set([
  'https://concursomestre.com',
  'http://localhost:3000',
]);
const CRAWLER_TAB_PATTERNS = [
  'https://concursomestre.com/admin/operation/gran-crawler*',
  'http://localhost:3000/admin/operation/gran-crawler*',
];

const base64UrlDecode = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return atob(normalized + padding);
};

const readTokenClaims = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('A credencial Gran nao possui formato JWT valido.');
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    throw new Error('Nao foi possivel ler a credencial Gran.');
  }
};

const normalizeToken = (value) => String(value || '')
  .trim()
  .replace(/^Bearer\s+/i, '');

const validateToken = (value) => {
  const token = normalizeToken(value);
  if (!token || token.length > 12000 || /[\r\n]/.test(token)) {
    throw new Error('Informe uma credencial valida da sessao Gran.');
  }
  const claims = readTokenClaims(token);
  const clientId = String(claims.id || '').trim();
  if (!clientId || clientId.length > 200 || /[\r\n]/.test(clientId)) {
    throw new Error('A credencial nao possui o identificador de cliente esperado.');
  }
  const expiresAt = Number(claims.exp || 0);
  if (expiresAt > 0 && expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error('A sessao Gran expirou. Informe uma nova credencial.');
  }
  return { token, clientId, expiresAt: expiresAt || null };
};

const validateGranUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw.length > MAX_URL_LENGTH || /[\r\n]/.test(raw)) {
    throw new Error('A URL da consulta Gran e invalida.');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('A URL da consulta Gran e invalida.');
  }
  if (
    url.protocol !== 'https:'
    || url.origin !== GRAN_API_ORIGIN
    || url.pathname !== GRAN_API_PATH
    || url.username
    || url.password
    || url.hash
  ) {
    throw new Error('Use somente a rota oficial de questoes da Gran.');
  }
  for (const key of url.searchParams.keys()) {
    if (['authorization', 'access_token', 'token', 'cookie', 'x-client-id'].includes(key.toLowerCase())) {
      throw new Error('Nao inclua credenciais na URL da consulta.');
    }
  }
  return url.toString();
};

const isAllowedSender = (sender) => {
  try {
    const url = new URL(sender?.url || sender?.tab?.url || '');
    const crawlerPath = '/admin/operation/gran-crawler';
    return sender?.id === chrome.runtime.id
      && ALLOWED_PAGE_ORIGINS.has(url.origin)
      && (url.pathname === crawlerPath || url.pathname.startsWith(`${crawlerPath}/`));
  } catch {
    return false;
  }
};

const installHeaderRule = async () => {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [HEADER_RULE_ID],
    addRules: [{
      id: HEADER_RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Origin', operation: 'set', value: GRAN_WEB_ORIGIN },
          { header: 'Referer', operation: 'set', value: `${GRAN_WEB_ORIGIN}/` },
        ],
      },
      condition: {
        urlFilter: `|${GRAN_API_ORIGIN}/`,
        resourceTypes: ['xmlhttprequest'],
      },
    }],
  });
};

const readBodyWithLimit = async (response) => {
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new Error('A resposta da Gran excedeu o limite seguro.');
    }
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('A resposta da Gran excedeu o limite seguro.');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
};

const getSession = async () => {
  const stored = await chrome.storage.session.get(SESSION_TOKEN_KEY);
  if (!stored[SESSION_TOKEN_KEY]) return null;
  try {
    return validateToken(stored[SESSION_TOKEN_KEY].token);
  } catch {
    await chrome.storage.session.remove(SESSION_TOKEN_KEY);
    return null;
  }
};

const fetchGranJson = async (requestUrl, session) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      referrer: `${GRAN_WEB_ORIGIN}/`,
      referrerPolicy: 'strict-origin-when-cross-origin',
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        authorization: `Bearer ${session.token}`,
        'x-client-id': session.clientId,
      },
      signal: controller.signal,
    });
    const body = await readBodyWithLimit(response);
    if (response.status === 401 || response.status === 403) {
      await clearSession();
      throw new Error('A Gran recusou a sessao. Conecte uma nova credencial na extensao.');
    }
    if (response.status === 429) {
      throw new Error('A Gran limitou temporariamente as consultas. Aguarde e tente novamente.');
    }
    if (!response.ok) throw new Error(`A Gran respondeu com HTTP ${response.status}.`);
    try {
      return { status: response.status, json: JSON.parse(body) };
    } catch {
      throw new Error('A Gran respondeu com JSON invalido.');
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('A consulta Gran excedeu o tempo limite.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const extractRows = (payload) => {
  const candidates = [
    payload?.data?.rows,
    payload?.data?.items,
    payload?.rows,
    payload?.itens,
    payload?.items,
    payload?.results,
  ];
  return candidates.find(Array.isArray) || [];
};

const unwrapExamCandidate = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return candidate;
  for (const key of ['prova', 'exam', 'question_exam']) {
    if (candidate[key] && typeof candidate[key] === 'object') {
      return candidate[key];
    }
  }
  return candidate;
};

const extractExamIds = (payload) => {
  const ids = new Set();
  const append = (value) => {
    const id = String(value ?? '').trim();
    if (/^\d{1,18}$/.test(id)) ids.add(id);
  };
  for (const row of extractRows(payload)) {
    const proofs = Array.isArray(row?.provas)
      ? row.provas
      : [row?.provas, row?.prova, row?.exam, row?.question_exam].filter(Boolean);
    for (const candidate of proofs) {
      const proof = unwrapExamCandidate(candidate);
      if (proof && typeof proof === 'object') {
        append(
          proof.id
          ?? proof._id
          ?? proof.id_prova
          ?? proof.prova_id
          ?? proof.idProva
          ?? proof.provaId
          ?? proof.exam_id
          ?? proof.examId,
        );
      } else {
        append(proof);
      }
    }
    append(
      row?.id_prova
      ?? row?.prova_id
      ?? row?.idProva
      ?? row?.provaId
      ?? row?.exam_id
      ?? row?.examId,
    );
  }
  return [...ids].slice(0, MAX_EXAM_FILE_REQUESTS);
};

const normalizeFileKind = (value) => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
  if (normalized.includes('gabarito')) return 'gabarito';
  if (normalized.includes('edital')) return 'edital';
  if (
    normalized.includes('folhadeprova')
    || normalized === 'prova'
    || normalized.includes('cadernodeprova')
    || normalized.includes('arquivoprova')
  ) {
    return 'folhaDeProva';
  }
  return '';
};

const readFileUrl = (value) => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  return String(
    value.url
    || value.href
    || value.link
    || value.download
    || value.downloadUrl
    || value.download_url
    || value.arquivo
    || value.file
    || '',
  ).trim();
};

const normalizeExamFileLinks = (payload) => {
  const root = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const data = root?.arquivos && typeof root.arquivos === 'object' ? root.arquivos : root;
  if (!data || typeof data !== 'object') return {};
  const links = {};
  const aliases = {
    edital: ['edital', 'arquivoEdital', 'arquivo_edital'],
    folhaDeProva: [
      'folhaDeProva',
      'folha_de_prova',
      'prova',
      'cadernoDeProva',
      'caderno_de_prova',
      'arquivoProva',
      'arquivo_prova',
    ],
    gabarito: ['gabarito', 'arquivoGabarito', 'arquivo_gabarito'],
  };
  for (const [kind, keys] of Object.entries(aliases)) {
    for (const key of keys) {
      const url = readFileUrl(data[key]);
      if (url) {
        links[kind] = url;
        break;
      }
    }
  }
  const entries = Array.isArray(data)
    ? data
    : [
      ...(Array.isArray(data.items) ? data.items : []),
      ...(Array.isArray(data.files) ? data.files : []),
      ...(Array.isArray(data.documentos) ? data.documentos : []),
    ];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const kind = normalizeFileKind(
      entry.tipo
      || entry.type
      || entry.kind
      || entry.nome
      || entry.name
      || entry.titulo
      || entry.title,
    );
    const url = readFileUrl(entry);
    if (kind && url && !links[kind]) links[kind] = url;
  }
  return links;
};

const fetchExamFiles = async (examId, session) => {
  if (examFilesCache.has(examId)) return examFilesCache.get(examId);
  const requestUrl = `${GRAN_API_ORIGIN}${GRAN_EXAM_FILES_PATH_PREFIX}${encodeURIComponent(examId)}/arquivos`;
  const response = await fetchGranJson(requestUrl, session);
  const links = normalizeExamFileLinks(response.json);
  examFilesCache.set(examId, links);
  return links;
};

const collectExamFiles = async (payload, session) => {
  const examIds = extractExamIds(payload);
  const files = {};
  const warnings = [];
  for (let start = 0; start < examIds.length; start += EXAM_FILE_REQUEST_CONCURRENCY) {
    const batch = examIds.slice(start, start + EXAM_FILE_REQUEST_CONCURRENCY);
    const results = await Promise.all(batch.map(async (examId) => {
      try {
        return { examId, links: await fetchExamFiles(examId, session), error: null };
      } catch (error) {
        return {
          examId,
          links: {},
          error: error instanceof Error ? error.message : 'Falha ao consultar arquivos da prova.',
        };
      }
    }));
    for (const result of results) {
      if (Object.keys(result.links).length) files[result.examId] = result.links;
      if (result.error) warnings.push(`Prova ${result.examId}: ${result.error}`);
    }
  }
  return { files, warnings };
};

const captureSessionFromRequest = async (details) => {
  const observedAt = Date.now();
  if (details.initiator !== GRAN_WEB_ORIGIN || !Array.isArray(details.requestHeaders)) {
    await chrome.storage.session.set({
      [CAPTURE_STATUS_KEY]: {
        state: 'origin_rejected',
        observedAt,
      },
    });
    return;
  }
  const authorization = details.requestHeaders.find(
    (header) => String(header.name || '').toLowerCase() === 'authorization',
  );
  if (!authorization?.value || !/^Bearer\s+/i.test(authorization.value)) {
    await chrome.storage.session.set({
      [CAPTURE_STATUS_KEY]: {
        state: 'authorization_missing',
        observedAt,
      },
    });
    return;
  }
  const session = validateToken(authorization.value);
  const clientHeader = details.requestHeaders.find(
    (header) => String(header.name || '').toLowerCase() === 'x-client-id',
  );
  if (clientHeader?.value && clientHeader.value !== session.clientId) {
    await chrome.storage.session.set({
      [CAPTURE_STATUS_KEY]: {
        state: 'client_mismatch',
        observedAt,
      },
    });
    return;
  }
  await chrome.storage.session.set({
    [SESSION_TOKEN_KEY]: {
      token: session.token,
      expiresAt: session.expiresAt,
    },
    [CAPTURE_STATUS_KEY]: {
      state: 'captured',
      observedAt,
    },
  });
};

const clearSession = async () => {
  await chrome.storage.session.remove([SESSION_TOKEN_KEY, CAPTURE_STATUS_KEY]);
  return { connected: false, expiresAt: null };
};

const getStatus = async () => {
  const session = await getSession();
  const stored = await chrome.storage.session.get(CAPTURE_STATUS_KEY);
  const captureStatus = stored[CAPTURE_STATUS_KEY] || null;
  return {
    connected: Boolean(session),
    expiresAt: session?.expiresAt || null,
    version: chrome.runtime.getManifest().version,
    captureState: captureStatus?.state || 'waiting',
    lastObservedAt: Number(captureStatus?.observedAt || 0) || null,
  };
};

const collect = async (urlValue) => {
  const session = await getSession();
  if (!session) throw new Error('Abra a extensao e conecte uma sessao Gran valida.');
  const requestUrl = validateGranUrl(urlValue);
  const response = await fetchGranJson(requestUrl, session);
  const examFiles = await collectExamFiles(response.json, session);
  return {
    status: response.status,
    requestUrl,
    json: response.json,
    examFiles: examFiles.files,
    warnings: examFiles.warnings,
  };
};

const normalizeTaxonomyRootIds = (kind, rawRootIds, maxRoots = MAX_TAXONOMY_ROOTS_PER_REQUEST) => {
  if (kind !== 'assunto_tree') return [];
  if (!Array.isArray(rawRootIds)) return [];
  const uniqueIds = new Set();
  for (const value of rawRootIds) {
    const id = String(value || '').trim();
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) {
      throw new Error('Identificador de raiz da taxonomia invalido.');
    }
    uniqueIds.add(id);
    if (uniqueIds.size > maxRoots) {
      throw new Error('O lote de raizes da taxonomia excede o limite seguro.');
    }
  }
  return [...uniqueIds];
};

const readPositiveInteger = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

const readTaxonomyPageCount = (payload, perPage) => {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const meta = data?.meta && typeof data.meta === 'object'
    ? data.meta
    : payload?.meta && typeof payload.meta === 'object'
      ? payload.meta
      : {};
  const explicitPages = readPositiveInteger(
    data.pages,
    data.totalPages,
    data.total_pages,
    meta.pages,
    meta.totalPages,
    meta.total_pages,
    payload?.pages,
    payload?.totalPages,
    payload?.total_pages,
  );
  if (explicitPages > 0) return explicitPages;
  const total = readPositiveInteger(
    data.total,
    data.totalItems,
    data.total_items,
    meta.total,
    meta.totalItems,
    meta.total_items,
    payload?.total,
    payload?.totalItems,
    payload?.total_items,
  );
  return total > 0 ? Math.ceil(total / Math.max(1, perPage)) : 1;
};

const collectTaxonomyPage = async (kindValue, pageValue, rawRootIds) => {
  const kind = String(kindValue || '').trim().toLowerCase();
  const definition = TAXONOMY_ENDPOINTS[kind];
  if (!definition) throw new Error('Tipo de taxonomia Gran invalido.');
  const page = Number(pageValue || 1);
  if (!Number.isInteger(page) || page < 1 || page > 10_000) {
    throw new Error('Pagina de taxonomia invalida.');
  }
  const session = await getSession();
  if (!session) throw new Error('Abra a extensao e conecte uma sessao Gran valida.');

  const params = new URLSearchParams(definition.params);
  params.set('perPage', String(definition.perPage));
  params.set('page', String(page));
  for (const rootExternalId of normalizeTaxonomyRootIds(kind, rawRootIds)) {
    params.append('raiz[]', rootExternalId);
  }
  const requestUrl = `${GRAN_API_ORIGIN}${definition.path}?${params.toString()}`;
  const response = await fetchGranJson(requestUrl, session);
  return {
    kind,
    page,
    status: response.status,
    requestUrl,
    json: response.json,
  };
};

const collectTaxonomyBatch = async (kindValue, rawRootIds) => {
  const kind = String(kindValue || '').trim().toLowerCase();
  const definition = TAXONOMY_ENDPOINTS[kind];
  if (!definition) throw new Error('Tipo de taxonomia Gran invalido.');

  const roots = normalizeTaxonomyRootIds(kind, rawRootIds, MAX_TAXONOMY_ROOTS_PER_BATCH);
  const rootBatches = roots.length > 0
    ? Array.from(
      { length: Math.ceil(roots.length / MAX_TAXONOMY_ROOTS_PER_REQUEST) },
      (_, index) => roots.slice(
        index * MAX_TAXONOMY_ROOTS_PER_REQUEST,
        (index + 1) * MAX_TAXONOMY_ROOTS_PER_REQUEST,
      ),
    )
    : [[]];
  const responses = [];

  for (const rootBatch of rootBatches) {
    const firstPage = await collectTaxonomyPage(kind, 1, rootBatch);
    responses.push(firstPage);
    const totalPages = Math.min(
      MAX_TAXONOMY_PAGES_PER_BATCH,
      readTaxonomyPageCount(firstPage.json, definition.perPage),
    );
    for (let page = 2; page <= totalPages; page += 1) {
      responses.push(await collectTaxonomyPage(kind, page, rootBatch));
    }
    if (responses.length > MAX_TAXONOMY_PAGES_PER_BATCH) {
      throw new Error('A taxonomia excedeu o limite seguro de paginas por lote.');
    }
  }

  return {
    kind,
    responses,
    requestCount: responses.length,
    rootCount: roots.length,
  };
};

const taxonomyManifestTotal = (payload) => {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const meta = data?.meta && typeof data.meta === 'object'
    ? data.meta
    : payload?.meta && typeof payload.meta === 'object' ? payload.meta : {};
  return readPositiveInteger(
    data.total, data.totalItems, data.total_items,
    meta.total, meta.totalItems, meta.total_items,
    payload?.total, payload?.totalItems, payload?.total_items,
  );
};

const firstTaxonomyRecord = (payload) => {
  const rows = extractRows(payload);
  if (rows.length > 0 && rows[0] && typeof rows[0] === 'object') return rows[0];
  const data = payload?.data;
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') return data[0];
  return {};
};

const sha256 = async (value) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const checkTaxonomyUpdates = async () => {
  const session = await getSession();
  if (!session) throw new Error('Abra a extensao e conecte uma sessao Gran valida.');
  const manifests = [];
  for (const [kind, definition] of Object.entries(TAXONOMY_ENDPOINTS)) {
    const params = new URLSearchParams(definition.params);
    params.set('perPage', '1');
    params.set('page', '1');
    const requestUrl = `${GRAN_API_ORIGIN}${definition.path}?${params.toString()}`;
    const response = await fetchGranJson(requestUrl, session);
    const record = firstTaxonomyRecord(response.json);
    const total = taxonomyManifestTotal(response.json);
    const indexSignature = String(record.index ?? response.json?.index ?? '').trim() || null;
    const updatedAt = String(record.timestamp ?? record.updated_at ?? response.json?.timestamp ?? '').trim() || null;
    manifests.push({
      taxonomyKind: kind,
      total,
      indexSignature,
      updatedAt,
      fingerprint: await sha256(JSON.stringify([kind, total, indexSignature, updatedAt])),
      checkedAt: new Date().toISOString(),
    });
  }
  return { manifests, requestCount: manifests.length };
};

const ensureCollectorBridgeInOpenTabs = async () => {
  const tabs = await chrome.tabs.query({ url: CRAWLER_TAB_PATTERNS });
  await Promise.all(tabs.map(async (tab) => {
    if (!tab.id) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js'],
      });
    } catch {
      // A aba pode ter sido fechada ou estar navegando durante a atualizacao.
    }
  }));
};

chrome.runtime.onInstalled.addListener(() => {
  void Promise.all([installHeaderRule(), ensureCollectorBridgeInOpenTabs()]);
});
chrome.runtime.onStartup.addListener(() => {
  void Promise.all([installHeaderRule(), ensureCollectorBridgeInOpenTabs()]);
});
void installHeaderRule();
void ensureCollectorBridgeInOpenTabs();

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    void captureSessionFromRequest(details).catch(async () => {
      await chrome.storage.session.set({
        [CAPTURE_STATUS_KEY]: {
          state: 'invalid_credential',
          observedAt: Date.now(),
        },
      });
    });
  },
  {
    // A sessao pode aparecer primeiro em rotas de perfil, filtros ou prova.
    // A coleta continua limitada por validateGranUrl() a /v1/elastic/questao.
    urls: [`${GRAN_API_ORIGIN}/*`],
    types: ['xmlhttprequest'],
  },
  ['requestHeaders', 'extraHeaders'],
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = String(message?.action || '');
  const popupAction = ['CLEAR_SESSION', 'GET_STATUS'].includes(action)
    && sender?.id === chrome.runtime.id
    && !sender?.tab;
  const pageAction = [
    'PING', 'COLLECT', 'COLLECT_TAXONOMY_PAGE', 'COLLECT_TAXONOMY_BATCH', 'CHECK_TAXONOMY_UPDATES',
  ].includes(action)
    && isAllowedSender(sender);
  if (!popupAction && !pageAction) {
    sendResponse({ success: false, message: 'Origem da solicitacao nao autorizada.' });
    return false;
  }
  const operation = action === 'CLEAR_SESSION'
      ? clearSession()
      : action === 'COLLECT'
        ? collect(message.url)
        : action === 'COLLECT_TAXONOMY_PAGE'
          ? collectTaxonomyPage(message.kind, message.page, message.rootExternalIds)
          : action === 'COLLECT_TAXONOMY_BATCH'
            ? collectTaxonomyBatch(message.kind, message.rootExternalIds)
            : action === 'CHECK_TAXONOMY_UPDATES'
              ? checkTaxonomyUpdates()
        : getStatus();
  operation
    .then((data) => sendResponse({ success: true, data }))
    .catch((error) => sendResponse({
      success: false,
      message: error instanceof Error ? error.message : 'Falha no coletor Gran.',
    }));
  return true;
});
