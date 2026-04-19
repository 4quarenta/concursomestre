import type { Material, Question, Ranking, SystemSettings, UserProfile } from '@types';
import type { AdminSeverityTokenKey } from '../../design-system';

type QuestionLike = Partial<Question>;
type UserLike = Partial<UserProfile>;
type MaterialLike = Partial<Material>;
type RankingLike = Partial<Ranking>;
type SettingsLike = Partial<SystemSettings>;

export interface AdminOperationModelInput {
  questions?: QuestionLike[];
  totalQuestions?: number;
  users?: UserLike[];
  materials?: MaterialLike[];
  rankings?: RankingLike[];
  systemSettings?: SettingsLike;
}

export interface AdminOperationMetric {
  key: string;
  label: string;
  value: string;
  description: string;
  trend: string;
  severity: AdminSeverityTokenKey;
}

export interface AdminOperationQueueItem {
  key: string;
  title: string;
  description: string;
  severity: AdminSeverityTokenKey;
  meta: string;
  targetSection: 'questions' | 'exams' | 'import' | 'taxonomies' | 'users' | 'materials' | 'rankings';
}

export interface AdminOperationModel {
  metrics: AdminOperationMetric[];
  queue: AdminOperationQueueItem[];
  quality: {
    questionCoveragePercent: number | null;
    taxonomyBuckets: Array<{ key: string; label: string; total: number }>;
    missingTaxonomyQuestions: number;
    canceledOrOutdatedQuestions: number;
  };
  totals: {
    loadedQuestions: number;
    expectedQuestions: number;
    users: number;
    exams: number;
    materials: number;
    rankings: number;
  };
}

const readStatus = (value: unknown) => String(value ?? '').trim().toLowerCase();
const readField = (record: object, key: string) => (record as Record<string, unknown>)[key];
const readArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const readId = (value: unknown) => String(value ?? '').trim();

const isPendingMaterial = (material: MaterialLike) => readStatus(material.status) === 'pending';
const isRejectedMaterial = (material: MaterialLike) => readStatus(material.status) === 'rejected';
const isPendingRanking = (ranking: RankingLike) => readStatus(ranking.status) === 'pending';
const isRejectedRanking = (ranking: RankingLike) => readStatus(ranking.status) === 'rejected';
const isPendingUser = (user: UserLike) => readStatus(user.status) === 'pending';
const isSuspendedOrBannedUser = (user: UserLike) => ['suspended', 'banned'].includes(readStatus(user.status));

const questionHasTaxonomy = (question: QuestionLike) => {
  const taxonomies = [
    question.bancas,
    question.orgaos,
    question.cargos,
    question.assuntos,
    question.anos,
    question.provas,
  ];

  return taxonomies.some((taxonomy) => readArray(taxonomy).length > 0);
};

const isCanceledOrOutdatedQuestion = (question: QuestionLike) =>
  Boolean(question.isCanceled || question.isOutdated || question.anulada || question.desatualizada);

const buildTaxonomyBuckets = (settings: SettingsLike) => {
  const taxonomies = settings.taxonomies;

  return [
    { key: 'agencies', label: 'Bancas', total: readArray(taxonomies?.agencies).length },
    { key: 'organizations', label: 'Orgaos', total: readArray(taxonomies?.organizations).length },
    { key: 'subjects', label: 'Materias', total: readArray(taxonomies?.subjects).length },
    { key: 'topics', label: 'Assuntos', total: readArray(taxonomies?.topics).length },
    { key: 'roles', label: 'Cargos', total: readArray(taxonomies?.roles).length },
    { key: 'careers', label: 'Carreiras', total: readArray(taxonomies?.careers).length },
    { key: 'years', label: 'Anos', total: readArray(taxonomies?.years).length },
  ];
};

export const buildAdminOperationModel = ({
  questions = [],
  totalQuestions,
  users = [],
  materials = [],
  rankings = [],
  systemSettings = {},
}: AdminOperationModelInput): AdminOperationModel => {
  const loadedQuestions = questions.length;
  const expectedQuestions = Math.max(Number(totalQuestions || 0), loadedQuestions);
  const pendingMaterials = materials.filter(isPendingMaterial);
  const rejectedMaterials = materials.filter(isRejectedMaterial);
  const pendingRankings = rankings.filter(isPendingRanking);
  const rejectedRankings = rankings.filter(isRejectedRanking);
  const pendingUsers = users.filter(isPendingUser);
  const suspendedUsers = users.filter(isSuspendedOrBannedUser);
  const missingTaxonomyQuestions = questions.filter((question) => !questionHasTaxonomy(question)).length;
  const canceledOrOutdatedQuestions = questions.filter(isCanceledOrOutdatedQuestion).length;
  const examBank = readArray(readField(systemSettings, 'examBank'));
  const taxonomyBuckets = buildTaxonomyBuckets(systemSettings);
  const taxonomyTotal = taxonomyBuckets.reduce((total, bucket) => total + bucket.total, 0);
  const questionCoveragePercent = expectedQuestions > 0
    ? Math.round((loadedQuestions / expectedQuestions) * 100)
    : null;

  const queue: AdminOperationQueueItem[] = [
    pendingMaterials.length > 0 ? {
      key: 'pending-materials',
      title: 'Materiais aguardando moderacao',
      description: 'Itens do marketplace precisam de aprovacao ou rejeicao antes de publicar.',
      severity: 'medium',
      meta: `${pendingMaterials.length} pendente(s)`,
      targetSection: 'materials',
    } : null,
    rejectedMaterials.length > 0 ? {
      key: 'rejected-materials',
      title: 'Materiais rejeitados',
      description: 'Rejeicoes devem manter motivo, evidencia e proxima acao clara para o seller.',
      severity: 'low',
      meta: `${rejectedMaterials.length} rejeitado(s)`,
      targetSection: 'materials',
    } : null,
    pendingRankings.length > 0 ? {
      key: 'pending-rankings',
      title: 'Rankings aguardando aprovacao',
      description: 'Rankings pendentes precisam de revisao operacional antes de ficarem publicos.',
      severity: 'medium',
      meta: `${pendingRankings.length} pendente(s)`,
      targetSection: 'rankings',
    } : null,
    missingTaxonomyQuestions > 0 ? {
      key: 'question-taxonomy',
      title: 'Questoes sem taxonomia visivel',
      description: 'Questoes sem banca, orgao, cargo, assunto, ano ou prova prejudicam busca, filtros e SEO.',
      severity: 'high',
      meta: `${missingTaxonomyQuestions} questao(oes)`,
      targetSection: 'questions',
    } : null,
    canceledOrOutdatedQuestions > 0 ? {
      key: 'question-quality',
      title: 'Questoes anuladas ou desatualizadas',
      description: 'Itens marcados como anulados/desatualizados precisam de tratamento claro na operacao.',
      severity: 'medium',
      meta: `${canceledOrOutdatedQuestions} questao(oes)`,
      targetSection: 'questions',
    } : null,
    pendingUsers.length > 0 ? {
      key: 'pending-users',
      title: 'Usuarios pendentes',
      description: 'Contas pendentes podem exigir verificacao ou acao administrativa.',
      severity: 'low',
      meta: `${pendingUsers.length} usuario(s)`,
      targetSection: 'users',
    } : null,
    suspendedUsers.length > 0 ? {
      key: 'suspended-users',
      title: 'Usuarios suspensos ou banidos',
      description: 'Contas restritas precisam de trilha de auditoria e motivo acessivel.',
      severity: 'low',
      meta: `${suspendedUsers.length} usuario(s)`,
      targetSection: 'users',
    } : null,
    taxonomyTotal === 0 ? {
      key: 'taxonomy-empty',
      title: 'Taxonomias nao carregadas',
      description: 'Bancas, orgaos, cargos e assuntos precisam estar disponiveis para importacao e filtros.',
      severity: 'high',
      meta: '0 taxonomias',
      targetSection: 'taxonomies',
    } : null,
    examBank.length === 0 ? {
      key: 'exam-bank-empty',
      title: 'Banco de provas sem registros carregados',
      description: 'A area de provas precisa de inventario para vinculos e importacoes de questoes.',
      severity: 'low',
      meta: '0 provas',
      targetSection: 'exams',
    } : null,
  ].filter(Boolean) as AdminOperationQueueItem[];

  return {
    metrics: [
      {
        key: 'questions',
        label: 'Questoes',
        value: String(expectedQuestions || loadedQuestions),
        description: `${loadedQuestions} carregada(s) nesta sessao.`,
        trend: questionCoveragePercent === null ? 'Sem base' : `${questionCoveragePercent}% local`,
        severity: missingTaxonomyQuestions > 0 ? 'medium' : 'healthy',
      },
      {
        key: 'users',
        label: 'Usuarios',
        value: String(users.length),
        description: `${pendingUsers.length} pendente(s), ${suspendedUsers.length} restrito(s).`,
        trend: users.length > 0 ? 'Ativo' : 'Sem carga',
        severity: pendingUsers.length > 0 ? 'medium' : 'healthy',
      },
      {
        key: 'materials',
        label: 'Materiais',
        value: String(materials.length),
        description: `${pendingMaterials.length} aguardando moderacao.`,
        trend: pendingMaterials.length > 0 ? 'Moderar' : 'Saudavel',
        severity: pendingMaterials.length > 0 ? 'medium' : 'healthy',
      },
      {
        key: 'rankings',
        label: 'Rankings',
        value: String(rankings.length),
        description: `${pendingRankings.length} pendente(s), ${rejectedRankings.length} rejeitado(s).`,
        trend: pendingRankings.length > 0 ? 'Revisar' : 'Saudavel',
        severity: pendingRankings.length > 0 ? 'medium' : 'healthy',
      },
    ],
    queue,
    quality: {
      questionCoveragePercent,
      taxonomyBuckets,
      missingTaxonomyQuestions,
      canceledOrOutdatedQuestions,
    },
    totals: {
      loadedQuestions,
      expectedQuestions,
      users: users.length,
      exams: examBank.length,
      materials: materials.length,
      rankings: rankings.length,
    },
  };
};
