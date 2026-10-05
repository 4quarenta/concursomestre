export type GranPageRequestLog = {
  id: string;
  mode: 'manual' | 'automatico';
  page: number;
  year: string;
  requestedPerPage: number;
  requestUrl: string;
  startedAt: string;
  httpStatus?: number;
  returnedPage?: number | null;
  returnedPerPage?: number | null;
  total?: number | null;
  pages?: number | null;
  rowsCount?: number;
  responseKeys?: string[];
  rowKeys?: string[];
  sampleQuestions?: string[];
  responseJson?: string;
  mappedQuestionCount?: number;
  batchId?: string;
  error?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

export const safeGranRequestUrl = (value: string) => {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/token|auth|secret|password|credential|api.?key/i.test(key)) {
        url.searchParams.set(key, '[redacted]');
      }
    }
    return url.toString();
  } catch {
    return '[URL indisponivel]';
  }
};

export const safeGranLogError = (value: string) => value
  .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
  .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[token redacted]')
  .replace(/((?:token|auth|secret|password|credential|api.?key)=)[^&\s]+/gi, '$1[redacted]')
  .slice(0, 500);

const redactSensitiveResponseFields = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactSensitiveResponseFields);
  const record = asRecord(value);
  if (!record) {
    return typeof value === 'string'
      ? value
        .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
        .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[token redacted]')
      : value;
  }
  return Object.fromEntries(Object.entries(record).map(([key, entry]) => [
    key,
    /token|authorization|auth|secret|password|credential|api.?key/i.test(key)
      ? '[redacted]'
      : redactSensitiveResponseFields(entry),
  ]));
};

export const formatSafeGranResponse = (response: Record<string, unknown>) => JSON.stringify(
  redactSensitiveResponseFields(response),
  null,
  2,
);

export const readGranResponseLogSummary = (response: Record<string, unknown>) => {
  const data = asRecord(response.data) || response;
  const rows = Array.isArray(data.rows)
    ? data.rows
    : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.results)
        ? data.results
        : Array.isArray(response.rows)
          ? response.rows
          : [];
  const firstRow = asRecord(rows[0]);
  const samples = rows.slice(0, 3).map((item) => {
    const row = asRecord(item);
    if (!row) return 'registro sem campos estruturados';
    const id = row.id ?? row.questaoId ?? row.questao_id ?? row.codigo ?? row.numero ?? row.idQuestao;
    const year = row.ano ?? row.anos ?? row.year;
    const content = row.enunciado ?? row.texto ?? row.questao ?? row.pergunta ?? row.descricao;
    const contentPreview = typeof content === 'string'
      ? content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
      : '';
    return [id === undefined ? null : `id=${String(id)}`, year === undefined ? null : `ano=${String(year)}`, contentPreview || null]
      .filter(Boolean)
      .join(' · ') || 'ID/ano nao identificados';
  });
  const numeric = (value: unknown) => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : null;
  const aggregationContainers = [data.aggs, data.aggregations, response.aggs, response.aggregations];
  const readUniqueTotal = (value: unknown, depth = 0): number | null => {
    if (depth > 4 || value === null || value === undefined) return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const result = readUniqueTotal(item, depth + 1);
        if (result !== null) return result;
      }
      return null;
    }
    const record = asRecord(value);
    if (!record) return null;
    for (const key of ['total_unique', 'totalUnique', 'unique_total', 'filtered_total']) {
      const result = numeric(record[key]);
      if (result !== null && result >= 0) return result;
    }
    for (const child of Object.values(record)) {
      const result = readUniqueTotal(child, depth + 1);
      if (result !== null) return result;
    }
    return null;
  };
  const filteredTotal = aggregationContainers
    .map((container) => readUniqueTotal(container))
    .find((value): value is number => value !== null) ?? null;
  const returnedPerPage = numeric(data.perPage ?? data.per_page ?? response.perPage ?? response.per_page);
  const reportedPages = numeric(data.pages ?? data.totalPages ?? response.pages ?? response.totalPages);
  const total = filteredTotal ?? numeric(data.total_unique ?? data.totalUnique ?? data.total ?? response.total);

  return {
    returnedPage: numeric(data.page ?? response.page),
    returnedPerPage,
    total,
    pages: filteredTotal !== null && returnedPerPage !== null
      ? (filteredTotal > 0 ? Math.ceil(filteredTotal / returnedPerPage) : 0)
      : reportedPages,
    rowsCount: rows.length,
    responseKeys: Object.keys(data).slice(0, 24),
    rowKeys: firstRow ? Object.keys(firstRow).slice(0, 24) : [],
    sampleQuestions: samples,
  };
};
