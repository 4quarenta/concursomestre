type GranRecord = Record<string, unknown>;

const asRecord = (value: unknown): GranRecord | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as GranRecord
    : null
);

const readRows = (response: unknown): GranRecord[] => {
  const root = asRecord(response);
  if (!root) return [];
  const data = asRecord(root.data);
  const candidates: unknown[] = [
    data?.rows,
    data?.items,
    data?.results,
    asRecord(data?.hits)?.hits,
    root.rows,
    root.items,
    root.results,
    asRecord(root.hits)?.hits,
    Array.isArray(root.data) ? root.data : null,
  ];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate.map((entry) => {
      const record = asRecord(entry);
      const source = asRecord(record?._source);
      if (source) return source;
      return record;
    }).filter((entry): entry is GranRecord => entry !== null);
  }
  return [];
};

const collectYearValues = (value: unknown, target: Set<string>, depth = 0): void => {
  if (depth > 5 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectYearValues(entry, target, depth + 1));
    return;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const text = String(value).trim();
    if (/^\d{4}$/.test(text) && Number(text) >= 1900 && Number(text) <= 2200) target.add(text);
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  Object.entries(record).forEach(([key, entry]) => {
    if (/^(?:ano|anos|year|years|ultimoAno|lastYear)$/i.test(key)
      || /^(?:prova|provas)$/i.test(key)) {
      collectYearValues(entry, target, depth + 1);
    }
  });
};

export type GranYearFilterValidation = {
  valid: boolean;
  rowCount: number;
  rowsWithYear: number;
  mismatchedRows: number;
};

export const validateGranQuestionYearFilter = (
  response: unknown,
  requestedYear: string,
): GranYearFilterValidation => {
  const year = requestedYear.trim();
  const rows = readRows(response);
  if (year === '' || rows.length === 0) {
    return { valid: true, rowCount: rows.length, rowsWithYear: 0, mismatchedRows: 0 };
  }

  let rowsWithYear = 0;
  let mismatchedRows = 0;
  rows.forEach((row) => {
    const rowYears = new Set<string>();
    collectYearValues(row, rowYears);
    if (rowYears.size === 0) return;
    rowsWithYear += 1;
    if (!rowYears.has(year)) mismatchedRows += 1;
  });

  return {
    valid: mismatchedRows === 0 && rowsWithYear === rows.length,
    rowCount: rows.length,
    rowsWithYear,
    mismatchedRows,
  };
};

