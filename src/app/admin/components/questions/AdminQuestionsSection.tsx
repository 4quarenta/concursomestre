/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from 'react';
import Link from 'next/link';
import { FileText, MessageSquare, Sparkles } from 'lucide-react';
import type { Question, SystemSettings } from '@types';
import { aiService, questionService, type GeneratedOriginalQuestion, type OriginalQuestionModality } from '@services/questions';
import { readApiErrorMessage } from '@services/api';
import { buildQuestionPath } from '@services/seo';
import { withQuestionPublicationAliases } from '@services/questions/questionPublication';
import {
  ADMIN_COLLECTION_TABLE_CLASS,
  ADMIN_COLLECTION_TABLE_HEAD_CLASS,
  ADMIN_COLLECTION_TABLE_ROW_CLASS,
} from '../shared/adminPanelStyles';
import AdminCollectionActionBar from '../shared/AdminCollectionActionBar';
import AdminCollectionPagination from '../shared/AdminCollectionPagination';
import AdminCollectionTablePanel from '../shared/AdminCollectionTablePanel';
import { AdminRowActions } from '../shared/AdminDesignSystem';
import AdminCollectionToolbar from '../shared/AdminCollectionToolbar';
import AdminPublishStateBadge, { resolveAdminPublishState } from '../shared/AdminPublishStateBadge';
import AdminConfirmDialog from '../ui/AdminConfirmDialog';
import AdminQuestionAiGenerationModal, {
  type AdminQuestionAiGenerationKind,
  type AdminQuestionAiGenerationResult,
} from './AdminQuestionAiGenerationModal';
import AdminOriginalQuestionGenerationModal, {
  type AdminOriginalQuestionGenerationResult,
} from './AdminOriginalQuestionGenerationModal';
import { slugify } from '../database/slugify';
import {
  getQuestionOptionLabel,
  isQuestionTaxonomyRecord,
  type QuestionTaxonomyOption,
} from './questionEditorShared';

interface QuestionsPagination {
  total: number;
  perPage: number;
  pages: number;
  page: number;
}

type AdminQuestionRecord = Question & Record<string, unknown> & {
  id?: number | string;
  text?: string;
  published_at?: string;
  teacher_comment?: string;
  detailed_comment?: string;
  has_teacher_comment?: boolean | number;
  has_detailed_comment?: boolean | number;
  prova_id?: number | string | null;
  adminPublicationDate?: string;
  adminPublicationTimestamp?: number;
  publicationStatus?: string;
  editorialStatus?: string;
  reviewStatus?: string;
  comentarios?: Record<string, unknown>;
  ['comentários']?: Record<string, unknown>;
};

interface ActionResult {
  success?: boolean;
  message?: string;
}

const isActionFailure = (value: unknown): value is ActionResult =>
  Boolean(value) && typeof value === 'object' && 'success' in (value as Record<string, unknown>) && (value as ActionResult).success === false;

const toQuestionRecord = (question: Question | null | undefined): AdminQuestionRecord =>
  ((question && typeof question === 'object' ? question : {}) as AdminQuestionRecord);

const getEntityLabel = (value: QuestionTaxonomyOption) => getQuestionOptionLabel(value);
const getTaxonomyRecord = (value: QuestionTaxonomyOption) => (isQuestionTaxonomyRecord(value) ? value : null);

const normalizeTextToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const stripHtml = (value: unknown) => String(value || '').replace(/<[^>]*>?/gm, '').trim();

const normalizeEditorialText = (value: unknown) => String(value || '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim();

const findTaxonomyByLabel = (items: QuestionTaxonomyOption[] = [], label: string) => {
  const normalizedLabel = normalizeTextToken(label);
  return items.find((item) => {
    const record = getTaxonomyRecord(item);
    const candidates = [
      getEntityLabel(item),
      record?.sigla,
      record?.name,
      record?.nome,
      record?.descricao,
      record?.['descri\u00e7\u00e3o'],
    ];
    return candidates.some((candidate) => normalizeTextToken(candidate) === normalizedLabel);
  }) || null;
};

const findTaxonomyById = (items: QuestionTaxonomyOption[] = [], id: unknown) => {
  const normalizedId = String(id ?? '').trim();
  if (!normalizedId) {
    return null;
  }

  return items.find((item) => {
    const record = getTaxonomyRecord(item);
    if (record) {
      return String(record.id ?? '').trim() === normalizedId;
    }

    return typeof item === 'string' || typeof item === 'number'
      ? String(item).trim() === normalizedId
      : false;
  }) || null;
};

const isGenericFocusLabel = (value: unknown) => {
  const normalized = normalizeTextToken(value);
  return ['outra', 'outras', 'outro', 'outros', 'geral', 'diversos', 'diversas'].includes(normalized);
};

const inferCareerFromRoleLabel = (roleLabel: string, careers: QuestionTaxonomyOption[] = []) => {
  const normalizedRole = normalizeTextToken(roleLabel);
  const rules = [
    {
      roleTokens: ['soldado', 'policial', 'policia', 'pm', 'delegado', 'agente', 'escrivao', 'investigador', 'guarda', 'penal'],
      careerTokens: ['policial', 'seguranca publica', 'seguranca'],
    },
    {
      roleTokens: ['analista judiciario', 'tecnico judiciario', 'oficial de justica', 'tribunal', 'juiz'],
      careerTokens: ['tribunal', 'tribunais', 'juridica', 'juridico', 'judiciaria', 'judiciario'],
    },
    {
      roleTokens: ['auditor', 'fiscal', 'tributario', 'tributaria', 'receita'],
      careerTokens: ['fiscal', 'controle', 'gestao'],
    },
    {
      roleTokens: ['professor', 'pedagogo', 'educador'],
      careerTokens: ['educacao', 'educacional', 'docencia'],
    },
    {
      roleTokens: ['enfermeiro', 'medico', 'tecnico em enfermagem', 'farmaceutico'],
      careerTokens: ['saude'],
    },
    {
      roleTokens: ['bancario', 'escriturario', 'caixa'],
      careerTokens: ['bancaria', 'bancario', 'bancos'],
    },
  ];

  const matchedRule = rules.find((rule) => rule.roleTokens.some((token) => normalizedRole.includes(token)));
  if (!matchedRule) {
    return null;
  }

  return careers.find((career) => {
    const label = normalizeTextToken(getEntityLabel(career));
    return matchedRule.careerTokens.some((token) => label.includes(token));
  }) || null;
};

const normalizeDifficulty = (value: unknown) => {
  const normalized = normalizeTextToken(value);
  if (normalized === 'facil' || normalized === '1') return 1;
  if (normalized === 'dificil' || normalized === '3') return 3;
  return 2;
};

const normalizeDifficultyLabel = (value: unknown) => {
  const difficulty = normalizeDifficulty(value);
  if (difficulty === 1) return 'F\u00e1cil';
  if (difficulty === 3) return 'Dif\u00edcil';
  return 'M\u00e9dio';
};

const createTaxonomyItem = ({
  label,
  found,
  materia,
  fallbackLevel,
  parent,
  rootSubject,
}: {
  label: string;
  found?: QuestionTaxonomyOption | null;
  materia: boolean;
  fallbackLevel?: string;
  parent?: QuestionTaxonomyOption | null;
  rootSubject?: QuestionTaxonomyOption | null;
}) => {
  const foundRecord = isQuestionTaxonomyRecord(found) ? found : null;
  const parentRecord = isQuestionTaxonomyRecord(parent) ? parent : null;
  const rootSubjectRecord = isQuestionTaxonomyRecord(rootSubject) ? rootSubject : null;
  const name = getEntityLabel(found) || label;
  const parentId = foundRecord?.parent_id ?? foundRecord?.parentId ?? parentRecord?.id ?? null;
  const parentName = foundRecord?.parent_name ?? foundRecord?.parentName ?? getEntityLabel(parent);
  const taxonomyLevel = fallbackLevel ?? foundRecord?.taxonomy_level ?? foundRecord?.taxonomyLevel;
  const rootSubjectId = foundRecord?.root_subject_id ?? foundRecord?.rootSubjectId ?? rootSubjectRecord?.id ?? null;
  const rootSubjectName = foundRecord?.root_subject_name ?? foundRecord?.rootSubjectName ?? getEntityLabel(rootSubject);

  return {
    ...(foundRecord || {}),
    id: foundRecord?.id ?? null,
    name,
    nome: foundRecord?.nome || foundRecord?.name || name,
    slug: foundRecord?.slug || slugify(name),
    materia,
    ...(parentId ? { parentId, parent_id: parentId } : {}),
    ...(parentName ? { parentName, parent_name: parentName } : {}),
    ...(taxonomyLevel ? { taxonomyLevel, taxonomy_level: taxonomyLevel } : {}),
    ...(rootSubjectId ? { rootSubjectId, root_subject_id: rootSubjectId } : {}),
    ...(rootSubjectName ? { rootSubjectName, root_subject_name: rootSubjectName } : {}),
  };
};

const createSimpleTaxonomyItem = (
  label: string,
  found?: QuestionTaxonomyOption | null,
  extra: Record<string, unknown> = {},
) => {
  const foundRecord = isQuestionTaxonomyRecord(found) ? found : null;
  const name = getEntityLabel(found) || label;
  if (!name) {
    return null;
  }

  const parentId = foundRecord?.parent_id ?? foundRecord?.parentId ?? null;
  const parentName = foundRecord?.parent_name ?? foundRecord?.parentName ?? '';

  return {
    ...(foundRecord || {}),
    id: foundRecord?.id ?? null,
    name,
    nome: foundRecord?.nome || foundRecord?.name || name,
    sigla: foundRecord?.sigla || name,
    descricao: foundRecord?.descricao || foundRecord?.['descri\u00e7\u00e3o'] || name,
    ['descri\u00e7\u00e3o']: foundRecord?.['descri\u00e7\u00e3o'] || foundRecord?.descricao || name,
    slug: foundRecord?.slug || slugify(name),
    ...(parentId ? { parentId, parent_id: parentId } : {}),
    ...(parentName ? { parentName, parent_name: parentName } : {}),
    ...extra,
  };
};

const resolveGeneratedYear = (value: unknown) => {
  const numericYear = Number(String(value || '').match(/\d{4}/)?.[0] || '');
  const currentYear = new Date().getFullYear();
  return Number.isFinite(numericYear) && numericYear >= 2000 && numericYear <= currentYear + 1
    ? numericYear
    : currentYear;
};

const pickFirstTaxonomyLabel = (
  items: QuestionTaxonomyOption[] = [],
  options: { avoidGeneric?: boolean } = {},
) => (
  items
    .map(getEntityLabel)
    .find((label) => label && (!options.avoidGeneric || !isGenericFocusLabel(label)))
  || ''
);

const findRoleForCareer = (roles: QuestionTaxonomyOption[] = [], career?: QuestionTaxonomyOption, careerLabel = '') => {
  const careerRecord = isQuestionTaxonomyRecord(career) ? career : null;
  const careerId = String(careerRecord?.id ?? '').trim();
  const normalizedCareerLabel = normalizeTextToken(getEntityLabel(career) || careerLabel);

  return roles.find((role) => {
    const roleRecord = isQuestionTaxonomyRecord(role) ? role : null;
    const parentId = String(roleRecord?.parentId ?? roleRecord?.parent_id ?? '').trim();
    const parentName = normalizeTextToken(roleRecord?.parentName ?? roleRecord?.parent_name ?? '');

    return (careerId && parentId === careerId)
      || (normalizedCareerLabel && parentName === normalizedCareerLabel);
  }) || null;
};

const hasEntityValue = (values: unknown) => {
  if (Array.isArray(values)) {
    return values.some((value) => Boolean(getEntityLabel(value)));
  }

  return Boolean(getEntityLabel(values as QuestionTaxonomyOption));
};

const getGeneratedTaxonomyLevel = (item: QuestionTaxonomyOption) => String(
  isQuestionTaxonomyRecord(item) ? item.taxonomyLevel || item.taxonomy_level || '' : '',
)
  .trim()
  .toLowerCase();

const getGeneratedQuestionMissingFilters = (question: Question) => {
  const subjectItems = (question.assuntos || []).filter((taxonomy) => Boolean((taxonomy as { materia?: unknown })?.materia));
  const assuntoItems = (question.assuntos || []).filter((taxonomy) => (
    !Boolean((taxonomy as { materia?: unknown })?.materia)
    && getGeneratedTaxonomyLevel(taxonomy) === 'assunto'
  ));
  const missing: string[] = [];

  if (!hasEntityValue(question.carreiras)) missing.push('Foco');
  if (!hasEntityValue(subjectItems)) missing.push('Materia');
  if (!getEntityLabel(question.difficulty || question.dificuldade)) missing.push('Dificuldade');
  if (!hasEntityValue(question.bancas)) missing.push('Banca');
  if (!hasEntityValue(question.orgaos)) missing.push('Órgão');
  if (!Array.isArray(question.anos) || question.anos.length === 0) missing.push('Ano');
  if (!getEntityLabel(question.level || question.nivel)) missing.push('Nivel');
  if (!hasEntityValue(assuntoItems)) missing.push('Assunto');
  if (!hasEntityValue(question.cargos)) missing.push('Cargo');
  if (!getEntityLabel(question.tipo)) missing.push('Modalidade');

  return missing;
};

const applyOriginalQuestionPublicationDecision = (
  question: Question,
  decision: 'draft' | 'published',
): Question => {
  const questionRecord = toQuestionRecord(question);
  const publishedAt = decision === 'published'
    ? (questionRecord.publishedAt || questionRecord.published_at || new Date().toISOString())
    : '';

  return withQuestionPublicationAliases({
    ...question,
    publishStatus: decision,
    publicationStatus: decision,
    editorialStatus: decision,
    status: decision,
    reviewStatus: decision === 'published' ? 'approved' : 'pending',
    publishedAt,
    published_at: publishedAt,
  });
};

const deriveGeneratedSpecificSubjectLabel = (
  generatedQuestion: GeneratedOriginalQuestion,
  topicLabel: string,
  subjectLabel: string,
) => {
  const rawSpecificSubjectLabel = String(generatedQuestion.specificSubject || '').trim();
  if (
    rawSpecificSubjectLabel
    && normalizeTextToken(rawSpecificSubjectLabel) !== normalizeTextToken(topicLabel)
    && normalizeTextToken(rawSpecificSubjectLabel) !== normalizeTextToken(subjectLabel)
  ) {
    return rawSpecificSubjectLabel;
  }

  const sourceText = normalizeTextToken([
    generatedQuestion.enunciado,
    generatedQuestion.introText,
    generatedQuestion.teacherComment,
    generatedQuestion.detailedComment,
  ].filter(Boolean).join(' '));
  const rules = [
    { tokens: ['progressao aritmetica', ' soma dos termos da pa', ' pa '], label: 'Progressão Aritmética' },
    { tokens: ['progressao geometrica', ' pg '], label: 'Progressão Geométrica' },
    { tokens: ['dialogo competitivo'], label: 'Diálogo Competitivo' },
    { tokens: ['lei 14 133', 'licitacao', 'contratacao publica'], label: 'Nova Lei de Licitações' },
    { tokens: ['exercicio profissional', 'profissao', 'profissional'], label: 'Liberdade Profissional' },
    { tokens: ['direitos fundamentais'], label: 'Direitos Fundamentais' },
    { tokens: ['controle de constitucionalidade'], label: 'Controle de Constitucionalidade' },
    { tokens: ['ato administrativo'], label: 'Atos Administrativos' },
    { tokens: ['administracao publica', 'principios administrativos'], label: 'Princípios da Administração Pública' },
    { tokens: ['concordancia verbal'], label: 'Concordância Verbal' },
    { tokens: ['regencia verbal'], label: 'Regência Verbal' },
  ];
  const matchedRule = rules.find((rule) => rule.tokens.some((token) => sourceText.includes(token.trim())));

  if (matchedRule) {
    return matchedRule.label;
  }

  return `Aspectos específicos de ${topicLabel || subjectLabel}`;
};

const buildGeneratedQuestionPayload = ({
  generatedQuestion,
  agencyLabel,
  forcedSubjectLabel,
  forcedModality,
  systemSettings,
}: {
  generatedQuestion: GeneratedOriginalQuestion;
  agencyLabel: string;
  forcedSubjectLabel?: string;
  forcedModality?: OriginalQuestionModality;
  systemSettings?: SystemSettings;
}): Question => {
  const now = new Date().toISOString();
  const agency = findTaxonomyByLabel(systemSettings?.taxonomies?.agencies || [], agencyLabel);
  const agencyRecord = getTaxonomyRecord(agency);
  const agencyName = getEntityLabel(agency) || agencyLabel;
  const rawOptions = (generatedQuestion.options || [])
    .map((option) => String(option || '').trim())
    .filter(Boolean);
  const isTrueFalse = forcedModality
    ? forcedModality === 'certo ou errado'
    : normalizeTextToken(generatedQuestion.modality).includes('certo')
      || (rawOptions.length === 2 && rawOptions.every((option) => ['certo', 'errado'].includes(normalizeTextToken(option))));
  const options = isTrueFalse ? ['Certo', 'Errado'] : rawOptions;
  const correctOptionIndex = Math.max(
    0,
    Math.min(options.length - 1, Number(generatedQuestion.correctOptionIndex) || 0),
  );
  const subjects = systemSettings?.taxonomies?.subjects || [];
  const topics = systemSettings?.taxonomies?.topics || [];
  const organizations = systemSettings?.taxonomies?.organizations || [];
  const roles = systemSettings?.taxonomies?.roles || [];
  const careers = systemSettings?.taxonomies?.careers || [];
  const areas = systemSettings?.taxonomies?.areas || [];
  const subjectLabel = String(
    forcedSubjectLabel
    || generatedQuestion.subject
    || pickFirstTaxonomyLabel(subjects)
    || 'Conhecimentos Gerais',
  ).trim();
  const rawTopicLabel = String(generatedQuestion.topic || '').trim();
  const rawSpecificSubjectLabel = String(generatedQuestion.specificSubject || '').trim();
  const candidateTopicLabel = rawTopicLabel || rawSpecificSubjectLabel || `Nocoes de ${subjectLabel}`;
  const topicLabel = normalizeTextToken(candidateTopicLabel) === normalizeTextToken(subjectLabel)
    ? `Nocoes de ${subjectLabel}`
    : candidateTopicLabel;
  const specificSubjectLabel = deriveGeneratedSpecificSubjectLabel(generatedQuestion, topicLabel, subjectLabel);
  const organizationLabel = String(
    generatedQuestion.organization
    || pickFirstTaxonomyLabel(organizations)
    || agencyName
    || 'Plataforma',
  ).trim();
  let roleLabel = String(generatedQuestion.role || '').trim();
  const careerLabel = String(generatedQuestion.career || '').trim();
  const areaLabel = String(generatedQuestion.area || pickFirstTaxonomyLabel(areas) || 'Geral').trim();
  const foundOrganization = organizationLabel ? findTaxonomyByLabel(organizations, organizationLabel) : null;
  let foundRole = roleLabel ? findTaxonomyByLabel(roles, roleLabel) : null;
  let foundRoleRecord = getTaxonomyRecord(foundRole);
  const foundCareer = careerLabel && !isGenericFocusLabel(careerLabel) ? findTaxonomyByLabel(careers, careerLabel) : null;
  const foundArea = areaLabel ? findTaxonomyByLabel(areas, areaLabel) : null;
  let roleRawParentId = foundRoleRecord?.parentId ?? foundRoleRecord?.parent_id ?? null;
  let roleRawParentName = String(foundRoleRecord?.parentName ?? foundRoleRecord?.parent_name ?? '').trim();
  let parentCareerById = findTaxonomyById(careers, roleRawParentId);
  let parentCareerByName = roleRawParentName ? findTaxonomyByLabel(careers, roleRawParentName) : null;
  const inferredCareer = roleLabel ? inferCareerFromRoleLabel(roleLabel, careers) : null;
  let resolvedCareer = parentCareerById
    || parentCareerByName
    || foundCareer
    || inferredCareer
    || careers.find((career) => !isGenericFocusLabel(getEntityLabel(career)))
    || null;

  if (!roleLabel) {
    const fallbackRole = findRoleForCareer(roles, resolvedCareer, getEntityLabel(resolvedCareer) || careerLabel)
      || roles.find((role) => Boolean(getEntityLabel(role)))
      || null;
    roleLabel = getEntityLabel(fallbackRole) || 'Cargo Geral';
    foundRole = fallbackRole || findTaxonomyByLabel(roles, roleLabel);
    foundRoleRecord = getTaxonomyRecord(foundRole);
    roleRawParentId = foundRoleRecord?.parentId ?? foundRoleRecord?.parent_id ?? null;
    roleRawParentName = String(foundRoleRecord?.parentName ?? foundRoleRecord?.parent_name ?? '').trim();
    parentCareerById = findTaxonomyById(careers, roleRawParentId);
    parentCareerByName = roleRawParentName ? findTaxonomyByLabel(careers, roleRawParentName) : null;
    resolvedCareer = parentCareerById || parentCareerByName || resolvedCareer;
  }

  const resolvedCareerRecord = getTaxonomyRecord(resolvedCareer);
  const resolvedCareerLabel = getEntityLabel(resolvedCareer)
    || (!isGenericFocusLabel(careerLabel) ? careerLabel : '')
    || roleRawParentName
    || 'Administrativa';
  const roleParentId = roleRawParentId ?? resolvedCareerRecord?.id ?? null;
  const roleParentName = roleRawParentName
    || getEntityLabel(resolvedCareer)
    || resolvedCareerLabel
    || '';
  const generatedYear = resolveGeneratedYear(generatedQuestion.year);
  const subjectTaxonomy = createTaxonomyItem({
    label: subjectLabel,
    found: findTaxonomyByLabel(subjects, subjectLabel),
    materia: true,
    fallbackLevel: 'materia',
  });
  const taxonomyItems = [subjectTaxonomy];

  if (topicLabel && normalizeTextToken(topicLabel) !== normalizeTextToken(subjectLabel)) {
    const topicTaxonomy = createTaxonomyItem({
      label: topicLabel,
      found: findTaxonomyByLabel(topics, topicLabel),
      materia: false,
      fallbackLevel: 'topico',
      parent: subjectTaxonomy,
      rootSubject: subjectTaxonomy,
    });
    taxonomyItems.push(topicTaxonomy);

    if (
      specificSubjectLabel
      && normalizeTextToken(specificSubjectLabel) !== normalizeTextToken(subjectLabel)
      && normalizeTextToken(specificSubjectLabel) !== normalizeTextToken(topicLabel)
    ) {
      taxonomyItems.push(createTaxonomyItem({
        label: specificSubjectLabel,
        found: findTaxonomyByLabel(topics, specificSubjectLabel),
        materia: false,
        fallbackLevel: 'assunto',
        parent: topicTaxonomy,
        rootSubject: subjectTaxonomy,
      }));
    }
  }

  const question = {
    enunciado: generatedQuestion.enunciado,
    enunciado_clean: stripHtml(generatedQuestion.enunciado),
    introText: generatedQuestion.introText || '',
    imageUrl: '',
    bancas: [{
      ...(agencyRecord ?? {}),
      id: agencyRecord?.id ?? null,
      sigla: agencyRecord?.sigla || agencyName,
      name: agencyRecord?.name || agencyRecord?.nome || agencyName,
      nome: agencyRecord?.nome || agencyRecord?.name || agencyName,
      slug: agencyRecord?.slug || slugify(agencyName),
    }],
    orgaos: organizationLabel
      ? [createSimpleTaxonomyItem(organizationLabel, foundOrganization)].filter(Boolean)
      : [],
    cargos: roleLabel
      ? [createSimpleTaxonomyItem(roleLabel, foundRole, {
        parentId: roleParentId,
        parent_id: roleParentId,
        parentName: roleParentName || undefined,
        parent_name: roleParentName || undefined,
      })].filter(Boolean)
      : [],
    assuntos: taxonomyItems,
    anos: [generatedYear],
    carreiras: resolvedCareerLabel
      ? [createSimpleTaxonomyItem(resolvedCareerLabel, resolvedCareer)].filter(Boolean)
      : [],
    areas: areaLabel
      ? [createSimpleTaxonomyItem(areaLabel, foundArea)].filter(Boolean)
      : [],
    nivel: generatedQuestion.level || 'Superior',
    level: generatedQuestion.level || 'Superior',
    tipo: isTrueFalse ? 'certo ou errado' : 'multipla escolha',
    dificuldade: normalizeDifficulty(generatedQuestion.difficulty),
    difficulty: normalizeDifficultyLabel(generatedQuestion.difficulty),
    itens: options.map((option, index) => ({
      id: index + 1,
      ordem: index + 1,
      rotulo: isTrueFalse ? (index === 0 ? 'C' : 'E') : String.fromCharCode(65 + index),
      corpo: option,
      corpo_clean: stripHtml(option),
    })),
    resposta: correctOptionIndex + 1,
    questionOrigin: 'platform',
    question_origin: 'platform',
    grupoQuestao: null,
    grupoQuestaoId: null,
    grupo_questao_id: null,
    provaId: null,
    provas: [],
    teacherComment: normalizeEditorialText(generatedQuestion.teacherComment),
    detailedComment: normalizeEditorialText(generatedQuestion.detailedComment),
    hasTeacherComment: true,
    hasDetailedComment: true,
    anulada: false,
    desatualizada: false,
    publishStatus: 'draft',
    visibilityStatus: 'public',
    scheduledAt: '',
    publishedAt: '',
    reviewStatus: 'pending',
    editorialStatus: 'draft',
    publicationStatus: 'draft',
    stats: { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
    comments: [],
    timestamp: now,
  } as unknown as Question;

  return withQuestionPublicationAliases(question);
};

interface AdminQuestionsSectionProps {
  questions: Question[];
  pagination: QuestionsPagination;
  isLoading?: boolean;
  errorMessage?: string;
  filter: string;
  onFilterChange: (value: string) => void;
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  onCreate: () => void;
  onEdit: (question: Question) => void;
  onAddQuestions: (questions: Question[]) => Promise<ActionResult | void | null | undefined> | ActionResult | void | null | undefined;
  onUpdate: (question: Question) => Promise<ActionResult | void | null | undefined> | ActionResult | void | null | undefined;
  onDelete: (questionId: string | number) => Promise<ActionResult | void | null | undefined> | ActionResult | void | null | undefined;
  onPageChange: (page: number) => void;
  onRefresh?: () => Promise<void> | void;
  systemSettings?: SystemSettings;
}

/**
 * Lista operacional das questoes no admin seguindo o padrao de tabela WordPress.
 * A seção centraliza busca, paginação, ações de linha e geração editorial por IA.
 *
 * @since 1.0.0
 */
const AdminQuestionsSection = ({
  questions,
  pagination,
  isLoading = false,
  errorMessage = '',
  filter,
  onFilterChange,
  renderSortableHeader,
  onCreate,
  onEdit,
  onAddQuestions,
  onUpdate,
  onDelete,
  onPageChange,
  onRefresh,
  systemSettings,
}: AdminQuestionsSectionProps) => {
  const [pendingDeleteQuestion, setPendingDeleteQuestion] = React.useState<Question | null>(null);
  const [isDeletingQuestion, setIsDeletingQuestion] = React.useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = React.useState<Set<string>>(new Set());
  const [generatedContentById, setGeneratedContentById] = React.useState<Record<string, Partial<Question>>>({});
  const [generationKind, setGenerationKind] = React.useState<AdminQuestionAiGenerationKind>('teacher');
  const [isGenerationModalOpen, setIsGenerationModalOpen] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);
  const [generationCurrentLabel, setGenerationCurrentLabel] = React.useState('');
  const [generationResults, setGenerationResults] = React.useState<AdminQuestionAiGenerationResult[]>([]);
  const [isSavingGeneratedResults, setIsSavingGeneratedResults] = React.useState(false);
  const [savedGenerationById, setSavedGenerationById] = React.useState<Record<string, { teacher?: boolean; detailed?: boolean }>>({});
  const [isOriginalGenerationModalOpen, setIsOriginalGenerationModalOpen] = React.useState(false);
  const [originalGenerationAgency, setOriginalGenerationAgency] = React.useState('');
  const [originalGenerationSubject, setOriginalGenerationSubject] = React.useState('');
  const [originalGenerationModality, setOriginalGenerationModality] = React.useState<OriginalQuestionModality>('multipla escolha');
  const [originalGenerationQuantity, setOriginalGenerationQuantity] = React.useState(3);
  const [isGeneratingOriginalQuestions, setIsGeneratingOriginalQuestions] = React.useState(false);
  const [originalGenerationProgress, setOriginalGenerationProgress] = React.useState(0);
  const [originalGenerationCurrentLabel, setOriginalGenerationCurrentLabel] = React.useState('');
  const [originalGenerationResults, setOriginalGenerationResults] = React.useState<AdminOriginalQuestionGenerationResult[]>([]);
  const [originalGenerationError, setOriginalGenerationError] = React.useState('');
  const [originalGenerationPayloads, setOriginalGenerationPayloads] = React.useState<Question[]>([]);
  const [isSavingOriginalQuestionDrafts, setIsSavingOriginalQuestionDrafts] = React.useState(false);
  const generationRunningRef = React.useRef(false);
  const generationSavePayloadsRef = React.useRef<Record<string, Question>>({});

  const generationIsRunning = generationResults.some((item) => item.status === 'pending' || item.status === 'running');
  const generationHasUnsavedResults = generationResults.some((item) => (
    item.status === 'success' && Boolean(item.result) && !item.isSaved
  ));
  const generationIsBusy = generationIsRunning || isSavingGeneratedResults;
  const agencyOptions = React.useMemo(() => (
    Array.from(new Set((systemSettings?.taxonomies?.agencies || []).map(getEntityLabel).filter(Boolean)))
  ), [systemSettings?.taxonomies?.agencies]);
  const subjectHints = React.useMemo(() => (
    Array.from(new Set((systemSettings?.taxonomies?.subjects || []).map(getEntityLabel).filter(Boolean)))
  ), [systemSettings?.taxonomies?.subjects]);
  const topicHints = React.useMemo(() => (
    Array.from(new Set((systemSettings?.taxonomies?.topics || []).map(getEntityLabel).filter(Boolean)))
  ), [systemSettings?.taxonomies?.topics]);
  const organizationHints = React.useMemo(() => (
    Array.from(new Set((systemSettings?.taxonomies?.organizations || []).map(getEntityLabel).filter(Boolean)))
  ), [systemSettings?.taxonomies?.organizations]);
  const roleHints = React.useMemo(() => (
    Array.from(new Set((systemSettings?.taxonomies?.roles || []).map(getEntityLabel).filter(Boolean)))
  ), [systemSettings?.taxonomies?.roles]);
  const careerHints = React.useMemo(() => (
    Array.from(new Set((systemSettings?.taxonomies?.careers || []).map(getEntityLabel).filter(Boolean)))
  ), [systemSettings?.taxonomies?.careers]);
  const roleFocusHints = React.useMemo(() => {
    const careers = systemSettings?.taxonomies?.careers || [];
    return Array.from(new Set((systemSettings?.taxonomies?.roles || [])
      .map((role) => {
        const roleRecord = role as {
          parentId?: string | number | null;
          parent_id?: string | number | null;
          parentName?: string;
          parent_name?: string;
        };
        const roleLabel = getEntityLabel(role);
        const parentId = roleRecord?.parentId ?? roleRecord?.parent_id ?? null;
        const parentName = String(roleRecord?.parentName ?? roleRecord?.parent_name ?? '').trim();
        const parentCareer = findTaxonomyById(careers, parentId)
          || (parentName ? findTaxonomyByLabel(careers, parentName) : null);
        const focusLabel = getEntityLabel(parentCareer) || parentName;

        return roleLabel && focusLabel ? `${focusLabel} -> ${roleLabel}` : '';
      })
      .filter(Boolean)));
  }, [systemSettings?.taxonomies?.careers, systemSettings?.taxonomies?.roles]);
  const areaHints = React.useMemo(() => (
    Array.from(new Set((systemSettings?.taxonomies?.areas || []).map(getEntityLabel).filter(Boolean)))
  ), [systemSettings?.taxonomies?.areas]);

  const getQuestionId = (question: Question) => String(toQuestionRecord(question).id ?? '');

  const getQuestionLabel = (question: Question) => {
    const questionRecord = toQuestionRecord(question);
    const rawTitle = String(questionRecord.enunciado_clean || questionRecord.text || questionRecord.enunciado || '').trim();
    const title = rawTitle ? rawTitle.replace(/\s+/g, ' ').slice(0, 90) : 'Quest\u00e3o sem enunciado';
    return `#${questionRecord.id ?? '-'} - ${title}${rawTitle.length > 90 ? '...' : ''}`;
  };

  const hasGeneratedContent = (value: unknown) => {
    if (typeof value === 'string') return value.trim().length > 0;
    return Boolean(value);
  };

  const resolveQuestionAiState = (question: Question, generatedContent: Partial<Question>, questionId: string) => {
    const questionRecord = toQuestionRecord(question);
    const commentsMeta = questionRecord.comentarios || questionRecord['comentários'] || {};
    const teacherComment = String(
      generatedContent.teacherComment
        || questionRecord.teacherComment
        || questionRecord.teacher_comment
        || '',
    ).trim();
    const detailedComment = String(
      generatedContent.detailedComment
        || questionRecord.detailedComment
        || questionRecord.detailed_comment
        || '',
    ).trim();
    const savedFlags = savedGenerationById[questionId] || {};

    return {
      teacherComment,
      detailedComment,
      hasComment: Boolean(
        savedFlags.teacher
          || questionRecord.hasTeacherComment
          || questionRecord.has_teacher_comment
          || commentsMeta.professor
          || hasGeneratedContent(teacherComment),
      ),
      hasDetailedAnalysis: Boolean(
        savedFlags.detailed
          || questionRecord.hasDetailedComment
          || questionRecord.has_detailed_comment
          || commentsMeta.ia
          || hasGeneratedContent(detailedComment),
      ),
    };
  };

  const selectedQuestions = React.useMemo(
    () => questions.filter((question) => selectedQuestionIds.has(getQuestionId(question))),
    [questions, selectedQuestionIds],
  );

  const allVisibleSelected = questions.length > 0 && selectedQuestions.length === questions.length;

  const toggleSelectAllVisible = () => {
    setSelectedQuestionIds((current) => {
      if (allVisibleSelected) {
        return new Set();
      }

      const next = new Set(current);
      questions.forEach((question) => {
        const id = getQuestionId(question);
        if (id) next.add(id);
      });
      return next;
    });
  };

  const toggleQuestionSelection = (question: Question) => {
    const id = getQuestionId(question);
    if (!id) return;

    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const updateGenerationItem = (id: string, patch: Partial<AdminQuestionAiGenerationResult>) => {
    setGenerationResults((current) => current.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    )));
  };

  const openOriginalGenerationModal = () => {
    setOriginalGenerationError('');
    setOriginalGenerationProgress(0);
    setOriginalGenerationCurrentLabel('Selecione uma banca para gerar questões inéditas.');
    setOriginalGenerationResults([]);
    setOriginalGenerationPayloads([]);
    setIsSavingOriginalQuestionDrafts(false);
    if (!originalGenerationAgency && agencyOptions.length === 1) {
      setOriginalGenerationAgency(agencyOptions[0]);
    }
    setIsOriginalGenerationModalOpen(true);
  };

  const runOriginalQuestionGeneration = async () => {
    const agency = originalGenerationAgency.trim();
    const selectedSubject = originalGenerationSubject.trim();
    const quantity = Math.max(1, Math.min(20, Math.round(Number(originalGenerationQuantity) || 1)));

    if (!agency || isGeneratingOriginalQuestions) {
      setOriginalGenerationError('Selecione uma banca antes de gerar as questões.');
      return;
    }

    setIsGeneratingOriginalQuestions(true);
    setOriginalGenerationError('');
    setOriginalGenerationPayloads([]);
    setIsSavingOriginalQuestionDrafts(false);
    setOriginalGenerationProgress(5);
    setOriginalGenerationCurrentLabel(`Preparando ${quantity} questão(ões) no estilo ${agency}.`);
    setOriginalGenerationResults(Array.from({ length: quantity }, (_, index) => ({
      id: `pending-${index}`,
      label: `Questão ${index + 1}`,
      status: index === 0 ? 'running' : 'pending',
      preview: 'Aguardando retorno da IA.',
    })));

    try {
      const generatedQuestions = await aiService.generateOriginalQuestions({
        agency,
        quantity,
        targetSubject: selectedSubject || undefined,
        targetModality: originalGenerationModality,
        subjects: subjectHints,
        topics: topicHints,
        organizations: organizationHints,
        roles: roleHints,
        careers: careerHints,
        roleFocusPairs: roleFocusHints,
        areas: areaHints,
      });

      if (generatedQuestions.length === 0) {
        throw new Error('A IA não retornou questões válidas para salvar.');
      }

      setOriginalGenerationProgress(100);
      setOriginalGenerationCurrentLabel('Geração concluída. Revise o conteúdo e escolha o que publicar.');

      const payloads = generatedQuestions.map((generatedQuestion) => (
        applyOriginalQuestionPublicationDecision(
          buildGeneratedQuestionPayload({
            generatedQuestion,
            agencyLabel: agency,
            forcedSubjectLabel: selectedSubject || undefined,
            forcedModality: originalGenerationModality,
            systemSettings,
          }),
          'draft',
        )
      ));

      setOriginalGenerationPayloads(payloads);
      setOriginalGenerationResults(payloads.map((question, index) => ({
        id: `review-${index}`,
        label: `Questão ${index + 1}`,
        status: 'review',
        publicationDecision: 'draft',
        filterIssues: getGeneratedQuestionMissingFilters(question),
        subject: (question.assuntos || []).find((item) => Boolean((item as { materia?: unknown })?.materia))?.name || '',
        preview: question.enunciado_clean || question.enunciado || '',
        question,
      })));
    } catch (error) {
      const message = readApiErrorMessage(error, 'Não foi possível gerar as questões inéditas.');
      setOriginalGenerationError(message);
      setOriginalGenerationProgress(100);
      setOriginalGenerationCurrentLabel('Falha na geração de questões inéditas.');
      setOriginalGenerationResults((current) => current.map((item) => (
        item.status === 'success' ? item : { ...item, status: 'error', error: message }
      )));
    } finally {
      setIsGeneratingOriginalQuestions(false);
    }
  };

  const updateOriginalQuestionPublicationDecision = (
    id: string,
    decision: 'draft' | 'published',
  ) => {
    const itemIndex = originalGenerationResults.findIndex((item) => item.id === id);
    if (itemIndex < 0) return;

    setOriginalGenerationPayloads((current) => current.map((question, index) => (
      index === itemIndex ? applyOriginalQuestionPublicationDecision(question, decision) : question
    )));
    setOriginalGenerationResults((current) => current.map((item, index) => {
      if (index !== itemIndex || !item.question) {
        return item;
      }

      const question = applyOriginalQuestionPublicationDecision(item.question, decision);
      return {
        ...item,
        publicationDecision: decision,
        filterIssues: getGeneratedQuestionMissingFilters(question),
        question,
      };
    }));
  };

  const saveOriginalQuestionDrafts = async () => {
    if (isGeneratingOriginalQuestions || isSavingOriginalQuestionDrafts || originalGenerationPayloads.length === 0) {
      return;
    }

    const invalidQuestions = originalGenerationPayloads
      .map((question, index) => ({
        index,
        missing: getGeneratedQuestionMissingFilters(question),
      }))
      .filter((item) => item.missing.length > 0);

    if (invalidQuestions.length > 0) {
      const firstInvalid = invalidQuestions[0];
      setOriginalGenerationError(
        `A questão ${firstInvalid.index + 1} ainda está sem: ${firstInvalid.missing.join(', ')}.`,
      );
      return;
    }

    setIsSavingOriginalQuestionDrafts(true);
    setOriginalGenerationError('');
    setOriginalGenerationCurrentLabel('Salvando questão(ões) revisada(s)...');
    setOriginalGenerationResults((current) => current.map((item) => (
      item.status === 'review' ? { ...item, status: 'saving' } : item
    )));

    try {
      const response = await onAddQuestions(originalGenerationPayloads);

      if (isActionFailure(response)) {
        throw new Error(response.message || 'Não foi possível criar as questões geradas.');
      }

      setOriginalGenerationResults((current) => current.map((item) => (
        item.status === 'saving' || item.status === 'review'
          ? { ...item, status: 'success' }
          : item
      )));
      setOriginalGenerationCurrentLabel(`${originalGenerationPayloads.length} questão(ões) criada(s) pela revisão.`);
      setOriginalGenerationPayloads([]);
      await onRefresh?.();
    } catch (error) {
      const message = readApiErrorMessage(error, 'Não foi possível salvar as questões geradas.');
      setOriginalGenerationError(message);
      setOriginalGenerationCurrentLabel('Falha ao salvar as questões.');
      setOriginalGenerationResults((current) => current.map((item) => (
        item.status === 'saving' ? { ...item, status: 'review', error: message } : item
      )));
    } finally {
      setIsSavingOriginalQuestionDrafts(false);
    }
  };

  const openResultModal = async (question: Question, kind: AdminQuestionAiGenerationKind) => {
    const id = getQuestionId(question);
    const label = getQuestionLabel(question);
    const cached = generatedContentById[id] || {};
    const cachedRecord = cached as Partial<AdminQuestionRecord>;
    const questionRecord = toQuestionRecord(question);
    const field = kind === 'teacher' ? 'teacherComment' : 'detailedComment';
    const directResult = String(cachedRecord[field] || questionRecord[field] || '').trim();

    generationSavePayloadsRef.current = {};
    setGenerationKind(kind);
    setGenerationProgress(directResult ? 100 : 15);
    setGenerationCurrentLabel(directResult ? 'Resultado salvo.' : `Carregando ${label}`);
    setGenerationResults([{
      id,
      label,
      status: directResult ? 'success' : 'running',
      result: directResult || undefined,
      isSaved: Boolean(directResult),
    }]);
    setIsGenerationModalOpen(true);

    if (directResult) {
      return;
    }

    try {
      const fullQuestion = await questionService.getQuestionForAdminEdit(id);
      const result = String(toQuestionRecord(fullQuestion)[field] || '').trim();
      updateGenerationItem(id, result
        ? { status: 'success', result, isSaved: true }
        : { status: 'error', error: 'Nenhum conte\u00fado salvo foi encontrado para esta quest\u00e3o.' });
      setGenerationProgress(100);
      setGenerationCurrentLabel(result ? 'Resultado carregado.' : 'Conteúdo não encontrado.');
      if (result) {
        setGeneratedContentById((current) => ({
          ...current,
          [id]: { ...(current[id] || {}), [field]: result },
        }));
      }
    } catch (error) {
      updateGenerationItem(id, { status: 'error', error: readApiErrorMessage(error, 'Não foi possível carregar o resultado.') });
      setGenerationProgress(100);
      setGenerationCurrentLabel('Falha ao carregar resultado.');
    }
  };

  const runAiGeneration = async (targets: Question[], kind: AdminQuestionAiGenerationKind) => {
    const normalizedTargets = targets.filter((question) => getQuestionId(question));
    if (normalizedTargets.length === 0 || generationIsBusy || generationRunningRef.current) {
      return;
    }

    generationRunningRef.current = true;
    generationSavePayloadsRef.current = {};
    setIsSavingGeneratedResults(false);
    setGenerationKind(kind);
    setGenerationProgress(0);
    setGenerationCurrentLabel('Preparando questoes selecionadas...');
    setGenerationResults(normalizedTargets.map((question) => ({
      id: getQuestionId(question),
      label: getQuestionLabel(question),
      status: 'pending',
    })));
    setIsGenerationModalOpen(true);

    try {
      for (let index = 0; index < normalizedTargets.length; index += 1) {
        const question = normalizedTargets[index];
        const id = getQuestionId(question);
        const label = getQuestionLabel(question);
        setGenerationCurrentLabel(`Gerando ${label}`);
        updateGenerationItem(id, { status: 'running' });

        try {
          const fullQuestion = await questionService
            .getQuestionForAdminEdit(id)
            .catch(() => question);
          const cachedGeneration = generatedContentById[id] || {};
          const generationBase = { ...question, ...fullQuestion, ...cachedGeneration } as Question;
          const result = kind === 'teacher'
            ? await aiService.generateTeacherComment(generationBase)
            : await aiService.generateDetailedAnalysis(generationBase);

          const fieldPatch = kind === 'teacher'
            ? { teacherComment: result, hasTeacherComment: true }
            : { detailedComment: result, hasDetailedComment: true };

          generationSavePayloadsRef.current[id] = { ...generationBase, ...fieldPatch } as Question;
          updateGenerationItem(id, { status: 'success', result, isSaved: false, error: undefined });
        } catch (error) {
          updateGenerationItem(id, {
            status: 'error',
            error: readApiErrorMessage(error, 'Não foi possível gerar este conteúdo.'),
          });
        } finally {
          setGenerationProgress(Math.round(((index + 1) / normalizedTargets.length) * 100));
        }
      }

      setGenerationCurrentLabel('Processamento concluido. Revise e salve os resultados gerados.');
    } finally {
      generationRunningRef.current = false;
    }
  };

  const saveGeneratedResults = async () => {
    if (generationIsRunning || isSavingGeneratedResults) {
      return;
    }

    const pendingResults = generationResults.filter((item) => (
      item.status === 'success' && Boolean(item.result) && !item.isSaved
    ));

    if (pendingResults.length === 0) {
      return;
    }

    setIsSavingGeneratedResults(true);
    setGenerationCurrentLabel('Salvando resultado(s) gerado(s)...');

    let savedCount = 0;

    try {
      for (const item of pendingResults) {
        const payload = generationSavePayloadsRef.current[item.id];
        updateGenerationItem(item.id, { isSaving: true, error: undefined });

        try {
          if (!payload) {
            throw new Error('N\u00e3o foi poss\u00edvel localizar os dados desta quest\u00e3o para salvar.');
          }

          const updateResult = await onUpdate(payload);

          if (isActionFailure(updateResult)) {
            throw new Error(updateResult.message || 'Não foi possível salvar o conteúdo gerado.');
          }

          const fieldPatch = generationKind === 'teacher'
            ? { teacherComment: item.result, hasTeacherComment: true }
            : { detailedComment: item.result, hasDetailedComment: true };

          setGeneratedContentById((current) => ({
            ...current,
            [item.id]: { ...(current[item.id] || {}), ...fieldPatch },
          }));
          setSavedGenerationById((current) => ({
            ...current,
            [item.id]: {
              ...(current[item.id] || {}),
              ...(generationKind === 'teacher' ? { teacher: true } : { detailed: true }),
            },
          }));
          updateGenerationItem(item.id, { isSaved: true, isSaving: false, error: undefined });
          delete generationSavePayloadsRef.current[item.id];
          savedCount += 1;
        } catch (error) {
          updateGenerationItem(item.id, {
            isSaved: false,
            isSaving: false,
            error: readApiErrorMessage(error, 'Não foi possível salvar este resultado.'),
          });
        }
      }

      setGenerationCurrentLabel(savedCount === pendingResults.length
        ? 'Resultado(s) salvo(s) com sucesso.'
        : 'Alguns resultado(s) não foram salvos. Confira os avisos abaixo.');
      if (savedCount > 0) {
        await onRefresh?.();
      }
    } finally {
      setIsSavingGeneratedResults(false);
    }
  };

  const formatPublicationDate = (value: unknown) => {
    if (!value) return '-';

    const rawValue = String(value).trim();
    if (!rawValue) return '-';

    const numericValue = Number(rawValue);
    const parsedDate = Number.isFinite(numericValue) && rawValue.length >= 10
      ? new Date(numericValue < 100000000000 ? numericValue * 1000 : numericValue)
      : new Date(rawValue.includes('T') ? rawValue : rawValue.replace(' ', 'T'));
    if (Number.isNaN(parsedDate.getTime())) {
      return rawValue;
    }

    return parsedDate.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(',', '');
  };

  const requestDeleteQuestion = (question: Question) => {
    setPendingDeleteQuestion(question);
  };

  const cancelDeleteQuestion = () => {
    if (!isDeletingQuestion) {
      setPendingDeleteQuestion(null);
    }
  };

  const confirmDeleteQuestion = async () => {
    if (!pendingDeleteQuestion || isDeletingQuestion) {
      return;
    }

    setIsDeletingQuestion(true);
    try {
      await onDelete(getQuestionId(pendingDeleteQuestion));
      setPendingDeleteQuestion(null);
    } catch {
      // O fluxo superior ja exibe o erro; manter o modal aberto permite tentar novamente.
    } finally {
      setIsDeletingQuestion(false);
    }
  };

  const pendingQuestionRecord = toQuestionRecord(pendingDeleteQuestion);
  const pendingQuestionTitle = String(
    pendingQuestionRecord.enunciado_clean
      || pendingQuestionRecord.text
      || `#${pendingQuestionRecord.id || ''}`,
  ).trim();

  return (
    <div className="space-y-4">
      <AdminCollectionToolbar
        title="Questões"
        description="Cadastro, revisão editorial e manutenção do banco principal."
        itemCount={pagination.total}
        itemCountLabel="questões"
        searchValue={filter}
        onSearchChange={onFilterChange}
        searchPlaceholder="Buscar questões..."
        primaryActionLabel="Adicionar nova"
        onPrimaryAction={onCreate}
        actions={(
          <button
            type="button"
            onClick={openOriginalGenerationModal}
            disabled={isGeneratingOriginalQuestions}
            className="inline-flex items-center gap-2 rounded-sm border border-sky-700 bg-sky-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-sky-800 hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles size={14} />
            Gerar inéditas
          </button>
        )}
      />

      <AdminCollectionActionBar
        summary={selectedQuestions.length > 0 ? `${selectedQuestions.length} questão(ões) selecionada(s)` : 'Selecione uma ou mais questões para aplicar a ação.'}
      >
          <button
            type="button"
            disabled={selectedQuestions.length === 0 || generationIsBusy}
            onClick={() => void runAiGeneration(selectedQuestions, 'teacher')}
            className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
          >
            <MessageSquare size={14} />
            Gerar comentário
          </button>
          <button
            type="button"
            disabled={selectedQuestions.length === 0 || generationIsBusy}
            onClick={() => void runAiGeneration(selectedQuestions, 'detailed')}
            className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
          >
            <FileText size={14} />
            Gerar análise
          </button>
      </AdminCollectionActionBar>

      <AdminCollectionTablePanel title="Banco principal de questões" className="transition-colors duration-300">
        <table className={ADMIN_COLLECTION_TABLE_CLASS}>
          <thead className={ADMIN_COLLECTION_TABLE_HEAD_CLASS}>
            <tr>
              <th className="w-12 p-4">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  aria-label="Selecionar questões visíveis"
                  className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </th>
              {renderSortableHeader('Questão', 'enunciado_clean')}
              <th className="p-4">ID</th>
              <th className="p-4">Comentário</th>
              <th className="p-4">Análise detalhada</th>
              <th className="p-4">Prova vinculada</th>
              <th className="p-4">Ano</th>
              <th className="p-4">Status</th>
              {renderSortableHeader('Publicação', 'adminPublicationTimestamp')}
              {renderSortableHeader('Banca/Materia', 'banca')}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {isLoading && questions.length === 0 && (
              <tr>
                <td colSpan={10} className="p-10 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                  Carregando questões...
                </td>
              </tr>
            )}
            {!isLoading && errorMessage !== '' && (
              <tr>
                <td colSpan={10} className="p-10 text-center text-sm font-medium text-red-600 dark:text-red-400">
                  {errorMessage}
                </td>
              </tr>
            )}
            {!isLoading && errorMessage === '' && questions.length === 0 && (
              <tr>
                <td colSpan={10} className="p-10 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                  Nenhuma questão encontrada.
                </td>
              </tr>
            )}
            {questions.map((question) => {
              const questionRecord = toQuestionRecord(question);
              const questionId = getQuestionId(question);
              const generatedContent = generatedContentById[questionId] || {};
              const numericQuestionId = Number(questionRecord.id ?? NaN);
              const {
                hasComment,
                hasDetailedAnalysis,
              } = resolveQuestionAiState(question, generatedContent, questionId);
              const questionViewPath = Number.isFinite(numericQuestionId)
                ? buildQuestionPath({
                  ...question,
                  id: numericQuestionId,
                  enunciado: question.enunciado ?? questionRecord.text,
                  enunciado_clean: question.enunciado_clean ?? questionRecord.text,
                })
                : null;

              const linkedExam = Array.isArray(questionRecord.provas) && questionRecord.provas.length > 0
                ? question.provas?.[0]
                : null;

              const linkedExamName = linkedExam?.nome || '-';
              const linkedYear = linkedExam?.ano
                ?? (Array.isArray(questionRecord.anos) && questionRecord.anos.length > 0
                  ? Math.max(...questionRecord.anos.map((year) => Number(year) || 0))
                  : null);

              return (
                <tr key={questionId || `question-${questionRecord.id ?? 'sem-id'}`} className={ADMIN_COLLECTION_TABLE_ROW_CLASS}>
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedQuestionIds.has(questionId)}
                      onChange={() => toggleQuestionSelection(question)}
                      aria-label={`Selecionar questão ${question.id ?? ''}`}
                      className="h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </td>
                  <td className="max-w-[260px] p-4 sm:max-w-md">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {question.enunciado_clean || questionRecord.text}
                    </p>
                    <div className="mt-2">
                      <AdminRowActions>
                      {questionViewPath && (
                        <>
                          <Link
                            href={questionViewPath}
                            prefetch={false}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                          >
                            Ver
                          </Link>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(question)}
                        className="font-medium text-sky-700 hover:text-sky-900 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                      >
                        Editar
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <button
                        type="button"
                        onClick={() => requestDeleteQuestion(question)}
                        className="font-medium text-red-600 hover:text-red-800 hover:underline dark:text-red-400 dark:hover:text-red-300"
                      >
                        Lixeira
                      </button>
                      </AdminRowActions>
                    </div>
                  </td>

                  <td className="p-4 text-slate-700 dark:text-slate-300 font-semibold">
                    #{questionRecord.id ?? '-'}
                  </td>

                  <td className="p-4">
                    <button
                      type="button"
                      disabled={generationIsBusy}
                      onClick={() => hasComment
                        ? void openResultModal(question, 'teacher')
                        : void runAiGeneration([question], 'teacher')}
                      className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-45 ${
                        hasComment
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
                      }`}
                      title={hasComment ? 'Ver comentário' : 'Gerar comentário'}
                    >
                      {hasComment ? <MessageSquare size={12} /> : <Sparkles size={12} />}
                      {hasComment ? 'Ver' : 'Gerar'}
                    </button>
                  </td>

                  <td className="p-4">
                    <button
                      type="button"
                      disabled={generationIsBusy}
                      onClick={() => hasDetailedAnalysis
                        ? void openResultModal(question, 'detailed')
                        : void runAiGeneration([question], 'detailed')}
                      className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-45 ${
                        hasDetailedAnalysis
                          ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
                      }`}
                      title={hasDetailedAnalysis ? 'Ver análise detalhada' : 'Gerar análise detalhada'}
                    >
                      {hasDetailedAnalysis ? <FileText size={12} /> : <Sparkles size={12} />}
                      {hasDetailedAnalysis ? 'Ver' : 'Gerar'}
                    </button>
                  </td>

                  <td className="p-4 text-slate-700 dark:text-slate-300 max-w-[220px] truncate" title={linkedExamName}>
                    {linkedExamName}
                  </td>

                  <td className="p-4 text-slate-700 dark:text-slate-300">
                    {linkedYear || '-'}
                  </td>

                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      <AdminPublishStateBadge state={resolveAdminPublishState(questionRecord)} />
                      {Number(question.anulada) === 1 && (
                        <span className="rounded-sm border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                          Anulada
                        </span>
                      )}
                      {Number(question.desatualizada) === 1 && (
                        <span className="rounded-sm border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                          Desatualizada
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="whitespace-nowrap p-4 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">{formatPublicationDate(questionRecord.adminPublicationDate)}</span>
                  </td>

                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {question.bancas?.map((banca) => getEntityLabel(banca)).filter(Boolean).join(' / ') || 'Banca'}
                      </span>
                      <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {question.assuntos
                          ?.map((subject) => ((subject as { materia?: unknown; nome?: string; name?: string })?.materia ? getEntityLabel(subject) : ''))
                          .filter(Boolean)
                          .join(', ') || 'Matéria'}
                      </span>
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminCollectionTablePanel>

      <AdminCollectionPagination
        visibleCount={questions.length}
        totalCount={pagination.total}
        itemLabel="questões"
        page={pagination.page}
        totalPages={pagination.pages}
        onPageChange={onPageChange}
      />

      <AdminConfirmDialog
        isOpen={Boolean(pendingDeleteQuestion)}
        title="Excluir questão"
        description={`A questão ${pendingDeleteQuestion ? `#${pendingQuestionRecord.id ?? ''}` : ''} será removida permanentemente. ${pendingQuestionTitle ? `Trecho: "${pendingQuestionTitle.slice(0, 140)}${pendingQuestionTitle.length > 140 ? '...' : ''}"` : ''}`}
        confirmLabel="Excluir permanentemente"
        cancelLabel="Cancelar"
        tone="danger"
        loading={isDeletingQuestion}
        onCancel={cancelDeleteQuestion}
        onConfirm={() => void confirmDeleteQuestion()}
      />

      <AdminQuestionAiGenerationModal
        isOpen={isGenerationModalOpen}
        kind={generationKind}
        progress={generationProgress}
        currentLabel={generationCurrentLabel}
        results={generationResults}
        hasUnsavedResults={generationHasUnsavedResults}
        isSaving={isSavingGeneratedResults}
        onSave={() => void saveGeneratedResults()}
        onClose={() => setIsGenerationModalOpen(false)}
      />

      <AdminOriginalQuestionGenerationModal
        isOpen={isOriginalGenerationModalOpen}
        agencyOptions={agencyOptions}
        subjectOptions={subjectHints}
        selectedAgency={originalGenerationAgency}
        selectedSubject={originalGenerationSubject}
        selectedModality={originalGenerationModality}
        quantity={originalGenerationQuantity}
        isProcessing={isGeneratingOriginalQuestions || isSavingOriginalQuestionDrafts}
        isSavingDrafts={isSavingOriginalQuestionDrafts}
        progress={originalGenerationProgress}
        currentLabel={originalGenerationCurrentLabel}
        results={originalGenerationResults}
        error={originalGenerationError}
        onAgencyChange={setOriginalGenerationAgency}
        onSubjectChange={setOriginalGenerationSubject}
        onModalityChange={setOriginalGenerationModality}
        onQuantityChange={(value) => setOriginalGenerationQuantity(Math.max(1, Math.min(20, Math.round(Number(value) || 1))))}
        onGenerate={() => void runOriginalQuestionGeneration()}
        onPublicationDecisionChange={updateOriginalQuestionPublicationDecision}
        onSaveDrafts={() => void saveOriginalQuestionDrafts()}
        onClose={() => setIsOriginalGenerationModalOpen(false)}
      />
    </div>
  );
};

export default AdminQuestionsSection;
