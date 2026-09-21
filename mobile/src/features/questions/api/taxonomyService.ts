import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { readApiData } from '@/services/api/response';
import { questionFixtureTaxonomies, QUESTION_FIXTURE_MODE } from '@/features/questions/data/questionFixtures';

export type QuestionTaxonomyOption = {
  id?: string | number;
  nome: string;
  sigla?: string;
  slug?: string;
  pai?: string | number | null;
  materia?: boolean;
  taxonomyLevel?: 'materia' | 'topico' | 'subtopico' | 'assunto' | string;
};

export type QuestionTaxonomies = {
  bancas: QuestionTaxonomyOption[];
  orgaos: QuestionTaxonomyOption[];
  materias: QuestionTaxonomyOption[];
  assuntos: QuestionTaxonomyOption[];
  cargos: QuestionTaxonomyOption[];
  carreiras: QuestionTaxonomyOption[];
  anos: string[];
};

const normalizeOption = (raw: any): QuestionTaxonomyOption | null => {
  const nome = String(raw?.nome || raw?.name || '').trim();
  if (!nome) return null;

  return {
    id: raw?.id,
    nome,
    sigla: String(raw?.sigla || '').trim() || undefined,
    slug: String(raw?.slug || '').trim() || undefined,
    pai: raw?.pai ?? raw?.parent_id ?? null,
    materia: Boolean(raw?.materia),
    taxonomyLevel: String(raw?.taxonomy_level || raw?.taxonomyLevel || '').trim() || undefined,
  };
};

const normalizeOptions = (rows: unknown): QuestionTaxonomyOption[] => (
  Array.isArray(rows)
    ? rows.map(normalizeOption).filter((item): item is QuestionTaxonomyOption => item !== null)
    : []
);

export const taxonomyService = {
  async list(): Promise<QuestionTaxonomies> {
    if (QUESTION_FIXTURE_MODE) return questionFixtureTaxonomies;
    const response: any = await apiClient.get<any>(ENDPOINTS.filters.list);
    const payload = readApiData<any>(response, {});
    const subjectRows = normalizeOptions(payload?.assuntos);

    const materias = subjectRows.filter((item) => (
      item.materia || item.taxonomyLevel === 'materia' || !item.pai
    ));
    const assuntos = subjectRows.filter((item) => !materias.some((materia) => String(materia.id) === String(item.id)));

    return {
      bancas: normalizeOptions(payload?.bancas),
      orgaos: normalizeOptions(payload?.orgaos),
      materias,
      assuntos,
      cargos: normalizeOptions(payload?.cargos),
      carreiras: normalizeOptions(payload?.carreiras),
      anos: Array.isArray(payload?.anos)
        ? payload.anos.map((value: unknown) => String(value).trim()).filter(Boolean)
        : [],
    };
  },
};

export default taxonomyService;
