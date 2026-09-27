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
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const canonical = record._canonical_contract && typeof record._canonical_contract === 'object'
    ? record._canonical_contract as Record<string, unknown>
    : {};
  const filters = record.filters && typeof record.filters === 'object'
    ? record.filters as Record<string, unknown>
    : canonical.filters && typeof canonical.filters === 'object'
      ? canonical.filters as Record<string, unknown>
      : record;
  const filterGroups: Array<[GranTaxonomySyncKey, string[]]> = [
    ['assunto', ['subjects', 'topics', 'subtopics', 'assuntos', 'materias', 'topicos']],
    ['banca', ['examBoards', 'exam_boards', 'bancas']],
    ['orgao', ['organizations', 'orgaos']],
    ['cargo', ['roles', 'cargos']],
    ['carreira', ['careers', 'carreiras']],
    ['area', ['areas', 'levels', 'niveis', 'focos']],
  ];
  const normalizedName = taxonomyName.trim().toLocaleLowerCase('pt-BR');
  const matches = new Set<GranTaxonomySyncKey>();
  for (const [key, fields] of filterGroups) {
    for (const field of fields) {
      const value = filters[field];
      const items = Array.isArray(value) ? value : value ? [value] : [];
      if (items.some((item) => {
        if (typeof item === 'string') return item.trim().toLocaleLowerCase('pt-BR') === normalizedName;
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
        const taxonomy = item as Record<string, unknown>;
        const provider = String(taxonomy.provider ?? taxonomy.sourceProvider ?? taxonomy.source_provider ?? '').toLowerCase();
        const hasExternalIdentity = Boolean(taxonomy.externalId ?? taxonomy.sourceExternalId ?? taxonomy.source_external_id);
        const name = String(taxonomy.label ?? taxonomy.name ?? taxonomy.nome ?? '').trim().toLocaleLowerCase('pt-BR');
        return name === normalizedName && (provider === 'gran' || hasExternalIdentity);
      })) matches.add(key);
    }
  }
  return matches.size === 1 ? Array.from(matches)[0] : null;
}
