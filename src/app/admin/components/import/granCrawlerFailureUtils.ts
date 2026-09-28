export type GranTaxonomySyncKey = 'assunto' | 'banca' | 'orgao' | 'cargo' | 'carreira' | 'area';

const TAXONOMY_FAILURE_CODE_PREFIX = 'gran_taxonomy_not_synced_';
const TAXONOMY_KEYS = new Set<GranTaxonomySyncKey>([
  'assunto', 'banca', 'orgao', 'cargo', 'carreira', 'area',
]);

export function getTaxonomyKeyFromFailureCode(code: string): GranTaxonomySyncKey | null {
  const key = code.startsWith(TAXONOMY_FAILURE_CODE_PREFIX)
    ? code.slice(TAXONOMY_FAILURE_CODE_PREFIX.length)
    : '';
  return TAXONOMY_KEYS.has(key as GranTaxonomySyncKey) ? key as GranTaxonomySyncKey : null;
}

export function getLegacyTaxonomyName(message: string): string | null {
  const match = message.match(/^A taxonomia Gran "([^"]+)" ainda n(?:a|ã)o foi sincronizada\./i);
  return match?.[1]?.trim() || null;
}

export function getLegacyTaxonomyKey(payload: unknown, taxonomyName: string): GranTaxonomySyncKey | null {
  return getLegacyTaxonomyTarget(payload, taxonomyName)?.key ?? null;
}

export type GranLegacyTaxonomyTarget = {
  key: GranTaxonomySyncKey;
  externalId: string;
};

export function getLegacyTaxonomyTarget(payload: unknown, taxonomyName: string): GranLegacyTaxonomyTarget | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const candidates: Record<string, unknown>[] = [record];
  if (Array.isArray(record.questions)) {
    candidates.push(...record.questions.filter((item): item is Record<string, unknown> => (
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    )));
  }
  if (Array.isArray(record.batches)) {
    for (const batch of record.batches) {
      if (!batch || typeof batch !== 'object' || Array.isArray(batch)) continue;
      const batchRecord = batch as Record<string, unknown>;
      const nestedPayload = batchRecord.payload && typeof batchRecord.payload === 'object'
        && !Array.isArray(batchRecord.payload)
        ? batchRecord.payload as Record<string, unknown>
        : batchRecord;
      candidates.push(nestedPayload);
      if (Array.isArray(nestedPayload.questions)) {
        candidates.push(...nestedPayload.questions.filter((item): item is Record<string, unknown> => (
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
        )));
      }
    }
  }
  const filterGroups: Array<[GranTaxonomySyncKey, string[]]> = [
    ['assunto', ['subjects', 'topics', 'subtopics', 'assuntos', 'materias', 'topicos']],
    ['banca', ['examBoards', 'exam_boards', 'bancas']],
    ['orgao', ['organizations', 'orgaos']],
    ['cargo', ['roles', 'cargos']],
    ['carreira', ['careerPaths', 'career_paths']],
    ['area', ['areas', 'levels', 'niveis', 'focos', 'careers', 'carreiras']],
  ];
  const normalizedName = taxonomyName.trim().toLocaleLowerCase('pt-BR');
  const matches = new Map<string, GranLegacyTaxonomyTarget>();
  for (const candidate of candidates) {
    const canonical = candidate._canonical_contract && typeof candidate._canonical_contract === 'object'
      ? candidate._canonical_contract as Record<string, unknown>
      : {};
    const filters = candidate.filters && typeof candidate.filters === 'object'
      ? candidate.filters as Record<string, unknown>
      : canonical.filters && typeof canonical.filters === 'object'
        ? canonical.filters as Record<string, unknown>
        : candidate;
    for (const [key, fields] of filterGroups) {
      for (const field of fields) {
        const value = filters[field];
        const items = Array.isArray(value) ? value : value ? [value] : [];
        for (const item of items) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
          const taxonomy = item as Record<string, unknown>;
          const externalId = String(taxonomy.externalId ?? taxonomy.sourceExternalId ?? taxonomy.source_external_id ?? '').trim();
          if (externalId === '') continue;
          const entityType = String(
            taxonomy.sourceEntityType ?? taxonomy.source_entity_type ?? taxonomy.entityType ?? taxonomy.entity_type ?? '',
          ).toLowerCase();
          const name = String(taxonomy.label ?? taxonomy.name ?? taxonomy.nome ?? '').trim().toLocaleLowerCase('pt-BR');
          if (name !== normalizedName) continue;

          if (field === 'careers' || field === 'carreiras') {
            // The canonical `careers` bucket defaults to Gran focus/area, while
            // legacy `carreiras` values represent the Gran career taxonomy.
            const careerKey = entityType === 'area'
              ? 'area'
              : entityType === 'carreira'
                ? 'carreira'
                : field === 'carreiras' ? 'carreira' : 'area';
            matches.set(`${careerKey}:${externalId}`, { key: careerKey, externalId });
            continue;
          }
          if (entityType === 'area') {
            matches.set(`area:${externalId}`, { key: 'area', externalId });
            continue;
          }
          if (entityType === 'carreira') {
            matches.set(`carreira:${externalId}`, { key: 'carreira', externalId });
            continue;
          }
          matches.set(`${key}:${externalId}`, { key, externalId });
        }
      }
    }
  }
  return matches.size === 1 ? Array.from(matches.values())[0] : null;
}
