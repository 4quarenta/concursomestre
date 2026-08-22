import graphJson from '../../../config/seo/internal-link-graph.v1.json';
import pageMapJson from '../../../config/seo/seo-production-page-map.v1.json';

export type InternalLinkGraphV1 = {
  version: 'internal-link-graph.v1';
  datasetMode: 'TEMPORARY_TEST_DATASET';
  orphanDefinition: string;
  limits: Record<string, number>;
  futureGates: string[];
  families: Array<{
    familyId: string;
    canonicalRoute: string;
    identityAuthority: string;
    breadcrumb: string[];
    primarySchema: string | null;
    functional: boolean;
  }>;
  approvedRelations: Array<{
    sourceFamily: string;
    relation: string;
    targetFamily: string;
    direction: string;
    authority: string;
    ssr: boolean;
    maxLinks: number;
  }>;
  rejectedInferences: string[];
};

export type InternalLinkGraphValidation = {
  valid: boolean;
  errors: string[];
  value?: InternalLinkGraphV1;
};

export const validateInternalLinkGraph = (input: unknown): InternalLinkGraphValidation => {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return { valid: false, errors: ['Contrato ausente.'] };
  const graph = input as InternalLinkGraphV1;
  if (graph.version !== 'internal-link-graph.v1') errors.push('Versao invalida.');

  const pageFamilies = new Map((pageMapJson.families || []).map((family) => [family.familyId, family]));
  const ids = new Set<string>();
  for (const family of graph.families || []) {
    if (!family.familyId || ids.has(family.familyId)) errors.push(`Familia duplicada: ${family.familyId}`);
    ids.add(family.familyId);
    const pageFamily = pageFamilies.get(family.familyId);
    if (!pageFamily) errors.push(`Familia fora do Production Page Map: ${family.familyId}`);
    if (pageFamily && !pageFamily.routePatterns.includes(family.canonicalRoute)) {
      errors.push(`Rota divergente do Production Page Map: ${family.familyId}`);
    }
    if (!family.canonicalRoute.startsWith('/') || family.canonicalRoute.includes('?')) {
      errors.push(`Rota canonica invalida: ${family.familyId}`);
    }
    for (const parent of family.breadcrumb || []) {
      if (!pageFamilies.has(parent)) errors.push(`Breadcrumb desconhecido: ${family.familyId} -> ${parent}`);
    }
  }
  for (const relation of graph.approvedRelations || []) {
    if (!ids.has(relation.sourceFamily) || !ids.has(relation.targetFamily)) {
      errors.push(`Relacao com familia ausente: ${relation.sourceFamily} -> ${relation.targetFamily}`);
    }
    if (!relation.authority.trim()) errors.push(`Relacao sem autoridade: ${relation.relation}`);
    if (!Number.isInteger(relation.maxLinks) || relation.maxLinks < 1 || relation.maxLinks > 100) {
      errors.push(`Limite invalido: ${relation.relation}`);
    }
  }
  const requiredGates = [
    'INTERNAL_LINK_GRAPH_REAL_DATA_VALIDATION_REQUIRED',
    'SEO_ORPHAN_REAL_DATA_VALIDATION_REQUIRED',
    'BREADCRUMB_REAL_DATA_VALIDATION_REQUIRED',
    'STRUCTURED_DATA_REAL_DATA_VALIDATION_REQUIRED',
  ];
  for (const gate of requiredGates) {
    if (!graph.futureGates?.includes(gate)) errors.push(`Gate ausente: ${gate}`);
  }
  if (graph.families?.length !== 44) errors.push(`Inventario deve conter 44 familias: ${graph.families?.length ?? 0}`);
  if (graph.approvedRelations?.length !== 67) errors.push(`Grafo deve conter 67 relacoes: ${graph.approvedRelations?.length ?? 0}`);
  if (graph.rejectedInferences?.length !== 9) errors.push(`Contrato deve conter 9 inferencias rejeitadas: ${graph.rejectedInferences?.length ?? 0}`);
  return errors.length ? { valid: false, errors } : { valid: true, errors, value: graph };
};

const validation = validateInternalLinkGraph(graphJson);
if (!validation.valid || !validation.value) {
  throw new Error(`Internal Link Graph invalido: ${validation.errors.join(' | ')}`);
}

export const internalLinkGraph = validation.value;
