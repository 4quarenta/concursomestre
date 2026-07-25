import type { QuestionTaxonomyLabel } from '@types';
import {
  readLooseField,
  toLooseRecord,
} from './adminImportWorkflowParsingCore';
import {
  createTaxonomyLabel,
  getTaxonomyText,
  readLooseText,
} from './adminImportWorkflowPublicationCore';

const readCanonicalFilterItems = (
  filters: Record<string, unknown>,
  keys: string[],
  extras: Record<string, unknown> = {},
): QuestionTaxonomyLabel[] => {
  const values = readLooseField(filters, keys);
  const items = Array.isArray(values)
    ? values
    : (values === null || values === undefined || values === '' ? [] : [values]);

  return items.map((value) => {
    const valueRecord = toLooseRecord(value);
    const label = valueRecord
      ? readLooseText(valueRecord, ['label', 'name', 'nome', 'title', 'titulo', 'sigla', 'slug'])
      : String(value || '').trim();
    if (!label) return null;
    const base = createTaxonomyLabel(label, extras) as QuestionTaxonomyLabel;
    return {
      ...base,
      ...(valueRecord || {}),
      id: valueRecord?.id ?? base.id,
      name: label,
      nome: label,
      slug: readLooseText(valueRecord, ['slug']) || base.slug,
      ...extras,
    } as QuestionTaxonomyLabel;
  }).filter((value): value is QuestionTaxonomyLabel => Boolean(value));
};

export const readCanonicalQuestionFilters = (filters: Record<string, unknown>) => ({
  subjects: readCanonicalFilterItems(
    filters,
    ['subjects', 'materias'],
    { materia: true, taxonomyLevel: 'materia', taxonomy_level: 'materia' },
  ),
  topics: readCanonicalFilterItems(
    filters,
    ['topics', 'topicos'],
    { materia: false, taxonomyLevel: 'topico', taxonomy_level: 'topico' },
  ),
  subtopics: readCanonicalFilterItems(
    filters,
    ['subtopics', 'assuntos'],
    { materia: false, taxonomyLevel: 'assunto', taxonomy_level: 'assunto' },
  ),
  examBoards: readCanonicalFilterItems(filters, ['examBoards', 'bancas']),
  organizations: readCanonicalFilterItems(filters, ['organizations', 'orgaos']),
  roles: readCanonicalFilterItems(filters, ['roles', 'cargos']),
  careers: readCanonicalFilterItems(
    filters,
    ['careers', 'carreiras', 'focuses', 'focos', 'areas'],
  ),
  levels: readCanonicalFilterItems(filters, ['levels', 'niveis']),
  examTypes: readCanonicalFilterItems(filters, ['examTypes', 'tiposProva', 'tipos_prova']),
  years: readCanonicalFilterItems(filters, ['years', 'anos'])
    .map((item) => Number(getTaxonomyText(item)))
    .filter((year) => Number.isInteger(year) && year >= 1900 && year <= 2200),
});

export const resolveFirstQuestionFocus = (
  questions: Array<Record<string, unknown>>,
): QuestionTaxonomyLabel | null => {
  for (const question of questions) {
    const focusItems = Array.isArray(question.carreiras)
      ? question.carreiras
      : (Array.isArray(question.focos) ? question.focos : []);
    for (const item of focusItems) {
      const itemRecord = toLooseRecord(item);
      const label = itemRecord
        ? readLooseText(itemRecord, ['name', 'nome', 'label', 'title', 'slug'])
        : String(item || '').trim();
      if (label) {
        return {
          ...(itemRecord || {}),
          ...createTaxonomyLabel(label),
          name: label,
          nome: label,
        } as QuestionTaxonomyLabel;
      }
    }
  }
  return null;
};
