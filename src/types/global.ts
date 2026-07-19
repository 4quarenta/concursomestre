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


export enum Difficulty {
  VERY_EASY = 'Muito Fácil',
  EASY = 'Fácil',
  MEDIUM = 'Médio',
  HARD = 'Difícil',
  VERY_HARD = 'Muito Difícil'
}

// Keep old Subject only if needed for simulation config, otherwise refactor everything later
export enum Subject {
  PORTUGUESE = 'Português',
  MATH = 'Matemática',
  LAW = 'Direito',
  HISTORY = 'História',
  INFORMATICS = 'Informática',
  ENEM_GENERAL = 'ENEM Gerais',
  GEOGRAPHY = 'Geografia',
  BIOLOGY = 'Biologia',
  PHYSICS = 'Física',
  CHEMISTRY = 'Química'
}

export interface Banca {
  id: number;
  sigla: string;
  nome: string;
  name?: string;
  slug: string;
  descrição?: string;
  descricao?: string;
  oab?: boolean;
}

export interface Orgao {
  id: number;
  nome: string;
  name?: string;
  sigla?: string;
  slug: string;
  uf?: string;
  esfera?: string;
}

export interface Cargo {
  id: number;
  slug: string;
  descrição: string;
  descricao?: string;
  name?: string;
  parentId?: number | string;
  parent_id?: number | string;
}

export interface Assunto {
  id: number;
  nome: string;
  name?: string;
  nome_clean?: string;
  slug: string;
  materia: boolean;
  assunto_raiz?: number | null;
  pai?: number | null;
  palavrasChave?: string[];
}

export interface QuestionTaxonomyLabel {
  id?: number | string;
  nome?: string;
  name?: string;
  descricao?: string;
  sigla?: string;
  slug?: string;
  [key: string]: unknown;
}

export type QuestionLevelValue = string | number | QuestionTaxonomyLabel | null;

export interface QuestionItem {
  id: number;
  ordem: number;
  rotulo: string;
  corpo: string;
  corpo_clean?: string;
}

export type QuestionAssetUsage = 'statement' | 'support' | 'alternative' | 'context' | 'reference';

export interface QuestionAsset {
  tempId?: string;
  id?: string;
  type: 'image';
  usage: QuestionAssetUsage;
  url?: string;
  base64?: string;
  alt?: string;
  caption?: string;
  sourcePage?: number | string | null;
  order?: number;
}

export interface QuestionContextPayload {
  id?: number | string | null;
  tempId?: string;
  type?: 'shared' | 'individual' | string;
  body?: string;
  bodyClean?: string;
  reference?: string;
  sourcePage?: number | string | null;
  assets: QuestionAsset[];
  questionNumbers?: Array<number | string>;
  texto?: string;
  questionIds?: Array<number | string>;
}

export interface QuestionSourcePayload {
  origin: 'platform' | 'exam' | 'manual' | 'ai' | string;
  examId?: number | string | null;
  questionNumber?: number | string | null;
  contextTempId?: number | string | null;
  questionGroupId?: number | string | null;
  sourcePage?: number | string | null;
}

export interface QuestionContentPayload {
  statement: string;
  statementClean?: string;
  supportText?: string;
  reference?: string;
}

export interface QuestionFilterValuePayload {
  id?: number | string | null;
  label: string;
  slug?: string;
}

export interface QuestionFiltersPayload {
  subjects?: QuestionFilterValuePayload[];
  topics?: QuestionFilterValuePayload[];
  subtopics?: QuestionFilterValuePayload[];
  examBoards?: QuestionFilterValuePayload[];
  organizations?: QuestionFilterValuePayload[];
  roles?: QuestionFilterValuePayload[];
  careers?: QuestionFilterValuePayload[];
  years?: QuestionFilterValuePayload[];
  levels?: QuestionFilterValuePayload[];
  examTypes?: QuestionFilterValuePayload[];
  materias?: QuestionFilterValuePayload[];
  topicos?: QuestionFilterValuePayload[];
  assuntos?: QuestionFilterValuePayload[];
  bancas?: QuestionFilterValuePayload[];
  orgaos?: QuestionFilterValuePayload[];
  cargos?: QuestionFilterValuePayload[];
  carreiras?: QuestionFilterValuePayload[];
  anos?: QuestionFilterValuePayload[];
  niveis?: QuestionFilterValuePayload[];
  tiposProva?: QuestionFilterValuePayload[];
  provas?: QuestionFilterValuePayload[];
}

export interface QuestionAlternativePayload {
  tempId?: string;
  id?: string;
  order: number;
  label: string;
  text: string;
  textClean?: string;
  assets?: QuestionAsset[];
}

export interface QuestionAnswerPayload {
  mode?: 'single' | 'multiple' | 'boolean' | 'text' | string;
  raw?: string | number | Array<string | number> | null | unknown;
  correctAlternativeTempIds?: string[];
  type?: 'single' | 'multiple' | 'boolean' | 'text' | string;
  value?: string | number | Array<string | number> | null;
  alternativeId?: string | null;
}

export interface QuestionEditorialCommentsPayload {
  teacherComment?: string;
  detailedComment?: string;
}

export interface QuestionEditorialPayload {
  type: 'teacher_comment' | 'detailed_analysis' | string;
  title?: string;
  body: string;
  status: 'draft' | 'published' | string;
}

export interface QuestionPublicationPayload {
  status: 'draft' | 'published' | 'scheduled' | string;
  visibility: 'public' | 'elite' | 'internal' | string;
  scheduledAt?: string | null;
}

export interface QuestionReviewPayload {
  required?: boolean;
  status?: 'pending' | 'reviewed' | 'approved' | string;
  reasons?: string[];
  needsReview?: boolean;
  statusReasons?: string[];
}

export interface QuestionPayload {
  tempId?: string;
  id?: number | string | null;
  source: QuestionSourcePayload;
  content: QuestionContentPayload;
  assets: QuestionAsset[];
  filters: QuestionFiltersPayload;
  type?: string;
  questionType?: string;
  difficulty: string;
  alternatives: QuestionAlternativePayload[];
  answer: QuestionAnswerPayload;
  editorial?: QuestionEditorialPayload[];
  editorialComments?: QuestionEditorialCommentsPayload;
  publication: QuestionPublicationPayload;
  review: QuestionReviewPayload;
}

export interface QuestaoComentario {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userPlan?: 'Gratuito' | 'Essencial' | 'Pro' | 'Elite';
  userRole?: 'admin' | 'user' | 'partner' | 'staff' | string;
  text: string;
  date: string;
  likes: number;
  isLiked?: boolean;
  userHasPendingReport?: boolean;
  parentId?: string;
  moderationStatus?: 'pending' | 'approved' | 'spam';
  replies: QuestaoComentario[];
}

export interface QuestionStats {
  totalAttempts: number;
  correctCount: number;
  wrongCount: number;
  optionDistribution?: Record<string, number>; // maps optionId -> count
}

export interface ErrorReport {
  id: string;
  targetType: 'question' | 'material' | 'comment' | 'law_section';
  questionId?: number;
  materialId?: string;
  commentId?: string;
  lawSectionId?: string;
  userName: string;
  userId?: string;
  reason: string;
  email?: string;
  role?: 'student' | 'admin' | 'partner' | 'staff' | 'user';
  plan?: string;
  level?: number;
  details: string;
  status: 'pending' | 'resolved' | 'ignored';
  timestamp: number;
  evidenceUrl?: string; // Evidência enviada pelo usuário na denúncia
  targetContent?: string;
  targetLabel?: string;
  targetContext?: string;
  targetUrl?: string;
  resolution?: string;
  userResponse?: string;
  internalNote?: string;
  moderationActionApplied?: string;
  resolvedAt?: number;
}

export interface Prova {
  id: number;
  nome: string;
  slug: string;
  ano: number;
  tipo: number;
  index: string;
  nivel: string;
  caderno?: string;
  tipoCaderno?: string;
  corCaderno?: string;
  bookletType?: string;
  bookletColor?: string;
  examType?: string;
  publishStatus?: 'published' | 'draft' | 'scheduled';
  visibilityStatus?: 'public' | 'elite' | 'internal';
  scheduledAt?: string;
  pdfUrl?: string;
  proofUrl?: string;
  editalUrl?: string;
  gabaritoUrl?: string;
  answerKeyUrl?: string;
  files?: ExamFileAttachment[];
  examFiles?: ExamFileAttachment[];
  banca: Banca;
  orgao: Orgao;
  orgaos?: Orgao[];
  cargo: Cargo;
  cargos?: Cargo[];
  foco?: QuestionTaxonomyLabel;
  focos?: QuestionTaxonomyLabel[];
  carreira?: QuestionTaxonomyLabel;
  carreiras?: QuestionTaxonomyLabel[];
  roles?: string[];
  dataInscricaoInicio?: string;
  dataInscricaoFim?: string;
  dataProva?: string;
  valorInscricao?: string | number;
  totalQuestoes?: string | number;
  etapas?: ExamStage[];
  requisitosDetalhados?: ExamScopedTextItem[];
  requirementsDetailed?: ExamScopedTextItem[];
  remuneracoesDetalhadas?: ExamScopedTextItem[];
  remunerationsDetailed?: ExamScopedTextItem[];
  vagasDetalhadas?: ExamScopedTextItem[];
  vacanciesDetailed?: ExamScopedTextItem[];
  conteudoProgramaticoDetalhado?: ExamProgrammaticContentItem[];
  programmaticContentDetailed?: ExamProgrammaticContentItem[];
  questoesVinculadas?: Array<string | number>;
  platformQuestionIds?: Array<string | number>;
  vagas?: Array<string | {
    descricao?: string;
    description?: string;
    ampla?: number;
    pcd?: number;
    cotas?: number;
    cadastroReserva?: number;
    cadastro_reserva?: number;
  }>;
  vacancies?: Array<string | {
    descricao?: string;
    description?: string;
    ampla?: number;
    pcd?: number;
    cotas?: number;
    cadastroReserva?: number;
    cadastro_reserva?: number;
  }>;
  requisitos?: string[];
  requirements?: string[];
  remuneracoes?: string[];
  remunerations?: string[];
  conteudoProgramatico?: string[];
  programmaticContent?: string[];
  cadernos?: ExamBooklet[];
}

export interface ExamScopedTextItem {
  id?: string | number;
  scopeType?: 'geral' | 'orgao' | 'cargo' | 'foco';
  scope?: string;
  orgao?: string;
  cargo?: string;
  foco?: string;
  chave?: string;
  key?: string;
  texto?: string;
  text?: string;
  value?: string;
  description?: string;
}

export interface ExamProgrammaticContentItem {
  id?: string | number;
  materia?: string;
  subject?: string;
  topico?: string;
  topic?: string;
  assunto?: string;
  specificSubject?: string;
  questoes?: string | number;
  questions?: string | number;
  orgao?: string;
  cargo?: string;
  foco?: string;
}

export interface ExamStage {
  id?: string | number;
  nome?: string;
  name?: string;
  criterio?: 'eliminatorio' | 'classificatorio' | 'eliminatorio_classificatorio' | string;
  criterion?: string;
  data?: string;
  date?: string;
  descricao?: string;
  description?: string;
}

export type ExamFileKind = 'prova' | 'gabarito' | 'edital' | 'outro';

export interface ExamBookletContent {
  id?: number;
  nome?: string;
  name?: string;
  slug?: string;
  type?: string;
  role?: string;
  ordem?: number;
  parentId?: number | null;
  taxonomyLevel?: string | null;
}

export interface ExamBooklet {
  id?: number;
  nome?: string;
  name?: string;
  tipo?: string | null;
  type?: string | null;
  cor?: string | null;
  color?: string | null;
  ordem?: number;
  conteudoProgramatico?: ExamBookletContent[];
  programmaticContent?: ExamBookletContent[];
}

export interface ExamFileAttachment {
  id?: string | number;
  kind: ExamFileKind;
  type?: ExamFileKind;
  label?: string;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  version?: number;
  versao?: number;
  visibilityStatus?: string;
  uploadedByUserId?: string | null;
  uploadedAt?: string;
  archivedAt?: string | null;
}

export interface GrupoQuestao {
  id: number;
  texto: string;
  assets?: QuestionAsset[];
  questionIds?: Array<number | string> | string;
  enunciado?: string;
  enunciado_clean?: string;
  enunciadoClean?: string;
  rotulo?: string | null;
  descrição: string;
  ordem?: number;
  image_url?: string;
  imageUrl?: string;
  question_count?: number;
  questionCount?: number;
  question_ids?: Array<number | string> | string;
}

export interface Question {
  id?: number;
  hashId?: string;
  hash?: string;
  source?: QuestionSourcePayload;
  content?: QuestionContentPayload;
  assets?: QuestionAsset[];
  filters?: QuestionFiltersPayload;
  questionType?: string;
  alternatives?: QuestionAlternativePayload[];
  answer?: QuestionAnswerPayload;
  publication?: QuestionPublicationPayload;
  review?: QuestionReviewPayload;
  editorial?: QuestionEditorialPayload[];
  editorialComments?: QuestionEditorialCommentsPayload;
  enunciado: string;
  enunciado_clean?: string;
  introText?: string;
  intro_text?: string;
  referenceText?: string;
  reference_text?: string;
  imageUrl?: string;
  hasImage?: boolean;
  hasImageItens?: boolean;

  // Taxonomias
  bancas: Banca[];
  orgaos: Orgao[];
  cargos: Cargo[];
  assuntos: Assunto[];
  anos: number[];
  carreiras?: QuestionTaxonomyLabel[];
  areas?: QuestionTaxonomyLabel[];
  tiposProva?: number[];
  ultimoAno?: {
    rank: number;
    stamp: string;
  };
  nivel?: QuestionLevelValue;
  level?: QuestionLevelValue; // Can be string "Superior" or object from backend
  isCanceled?: boolean;
  isOutdated?: boolean;

  tipo: string; // Ex: "multipla escolha", "certo ou errado"
  dificuldade: number; // 1, 2, 3
  difficulty?: string; // For frontend compatibility (Fácil, Médio, Difícil)
  topic?: string; // For frontend compatibility
  rotulo?: number;

  itens: QuestionItem[];
  resposta: number; // ID do item correto

    provas?: Prova[];
    provaId?: string | number;
    questionOrigin?: 'platform' | 'exam' | string;
    question_origin?: 'platform' | 'exam' | string;
    grupoQuestao?: GrupoQuestao;
    grupoQuestaoId?: number | string | null;
    grupo_questao_id?: number | string | null;

  teacherComment?: string;
  detailedComment?: string;
  hasTeacherComment?: boolean;
  hasDetailedComment?: boolean;
  comentários?: {
    ia: boolean;
    professor: boolean;
    professorVideo: boolean;
    aluno: boolean;
    totalAlunos: number;
    totalProfessores: number;
  };

  anulada?: boolean;
  desatualizada?: boolean;
  resolvida?: boolean;

  stats?: QuestionStats;
  comments?: QuestaoComentario[];
  timestamp?: string;
  slug?: string;
  index?: string;
  isSaved?: boolean;
  savedCount?: number;
  commentsCount?: number;
  publishStatus?: 'published' | 'draft' | 'scheduled';
  visibilityStatus?: 'public' | 'elite' | 'internal';
  scheduledAt?: string;
  createdAt?: string;
  created_at?: string;
  publishedAt?: string;
  published_at?: string;
}

export interface FilterResponse {
  data: {
    total: number;
    perPage: number;
    pages: number;
    page: number;
    rows: Question[];
  }
}

export interface UserAnswer {
  questionId: number;
  selectedOptionIndex: number;
  isCorrect: boolean;
  /** Gabarito devolvido somente apos a correcao canonica no servidor. */
  correctOptionIndex?: number;
  timestamp: number;
  simulationId?: string;
  timeTaken?: number;
  subjectName?: string;
  subject?: string;
  materia?: string;
  assuntos?: Array<{
    id?: number | string;
    nome?: string;
    name?: string;
    slug?: string;
    parentId?: number | string | null;
    materia?: boolean;
    meta_materia?: boolean;
  }>;
}

export interface UserNote {
  id: string;
  questionId: number;
  text: string;
  timestamp: number;
}

export interface Address {
  zipCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface BankAccount {
  bankCode: string;
  bankName: string;
  agency: string;
  account: string;
  accountDigit: string;
  holderName: string;
  holderDocument: string;
  type: 'checking' | 'savings';
}

export interface SimulationConfig {
  id: string;
  name: string;
  questionCount: number;
  subjects: Subject[];
  difficulty: Difficulty | 'All';
  timerEnabled: boolean;
  timerMinutes: number;
  feedbackMode: 'after_all' | 'instant';
  filters: {
    careers: string[];
    agencies: string[];
    years: string[];
    organizations: string[];
    roles: string[];
    levels: string[];
    topics: string[];
  };
}

export interface SimulationSession {
  id: string;
  config: SimulationConfig;
  questions: Question[];
  answers: Record<string, number | { index?: number; correct_option_index?: number; is_correct?: boolean | number; time_taken?: number }>;
  startTime: number;
  endTime?: number;
  durationSeconds?: number;
  status: 'in_progress' | 'completed';
  score?: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'system' | 'social' | 'marketplace' | 'report';
  isRead: boolean;
  timestamp: number;
  link?: string;
  evidenceUrl?: string; // Novo: URL de imagem/prova da decisão
  eventKey?: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  channel?: 'in_app' | 'email' | 'push';
  entityType?: string;
  entityId?: string;
  actionKey?: string;
  deletedAt?: number;
}

export type SeoRobotsPolicy = 'index,follow' | 'noindex,follow' | 'noindex,nofollow' | 'index,nofollow';

export interface SeoPageSettings {
  title?: string;
  meta_description?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  robots_override?: SeoRobotsPolicy | '';
}

export interface SeoGlobalSettings {
  site_title: string;
  meta_description: string;
  canonical_base_url: string;
  robots_default: SeoRobotsPolicy;
  default_og_title: string;
  default_og_description: string;
  default_og_image: string;
  default_twitter_title: string;
  default_twitter_description: string;
  default_twitter_image: string;
  google_site_verification?: string;
  bing_site_verification?: string;
  noindex_non_production: boolean;
  enable_sitemap: boolean;
  enable_robots_txt_control: boolean;
}

export interface SeoSettings {
  global: SeoGlobalSettings;
  pages: {
    landing: SeoPageSettings;
    plans: SeoPageSettings;
    faq: SeoPageSettings;
    changelog: SeoPageSettings;
    privacy: SeoPageSettings;
    terms: SeoPageSettings;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  cpf?: string;
  phone?: string;
  address?: Address;
  bankAccount?: BankAccount;
  targetExam: string;
  level: number;
  xp: number;
  reputation: number; // 0 to 100
  commentsCount: number;
  role: 'admin' | 'user' | 'partner' | 'staff';
  /** Campos derivados exclusivamente pelo adapter local da sessão canônica. */
  permissions?: string[];
  linkedProviders?: string[];
  partnershipStatus?: string;
  twoFactorEnabled?: boolean;
  plan?: string;
  status: 'active' | 'suspended' | 'banned' | 'pending';
  isAdmin?: boolean;
  isStaff?: boolean;
  isPartner?: boolean;
  canAccessAdmin?: boolean;
  hasSavedCard?: boolean;
  savedQuestionIds: string[];
  simulations: SimulationSession[];
  purchasedMaterialIds: string[];
  preferences: {
    shareData: boolean;
    notifications: boolean;
    isPublic?: boolean;
    showProfilePhoto?: boolean;
    defaultTheme?: 'system' | 'light' | 'dark';
    defaultPracticeView?: 'card' | 'list';
    defaultSimulationView?: 'focus' | 'list';
  };
  photoUrl?: string;
  referralCode?: string;
  googleId?: string;
  facebookId?: string;
  hasGoogleLinked?: boolean;
  hasFacebookLinked?: boolean;
  appleId?: string;
  studyStreak?: {
    current: number;
    best: number;
    lastVisitDate: string;
  };
  isDeletionPending?: boolean;
  deletionRequestedAt?: string;
  paymentIssue?: {
    message?: string;
    code?: string;
    type?: string;
    severity?: 'warning' | 'blocking' | string;
    interactionLock?: boolean;
    actionLabel?: string;
    actionTarget?: string;
    blockingReason?: string;
  };
  planDisplayName?: string;
  billing: {
    plan: 'Gratuito' | 'Essencial' | 'Pro' | 'Elite';
    billingCycle: 'monthly' | 'quarterly' | 'annual';
    nextBilling?: string;
    cardLast4?: string;
    paymentDay?: number; // Dia preferencial para recebimento de repasses (1-31)
  };
  subscription?: UserSubscription;
}

export interface RankingEntry {
  id: string;
  userId?: string;
  userName: string;
  registrationNumber: string;
  examType: string;
  category: 'AC' | 'Afro' | 'PCD';
  userAnswers: string;
  score: number;
  discursiveScore?: number;
  timestamp: number;
  status: 'active' | 'eliminated' | 'approved';
}

export interface Ranking {
  id: string;
  name: string;
  institution: string;
  imageUrl?: string;
  totalQuestions: number;
  vacanciesAc: number;
  vacanciesAfro: number;
  vacanciesPcd: number;
  reserveLimit: number;
  correctKey: string;
  keyStatus: 'official' | 'pending';
  status?: 'pending' | 'approved' | 'rejected';
  officialKeyReleaseDate?: string;
  examTypes: string[];
  hasDiscursive: boolean;
  entries: RankingEntry[];
  createdAt: number;
  officialKeyPdfUrl?: string;
  preliminaryKeyPdfUrl?: string;
}

export interface DiscountCode {
  code: string;
  discountPercentage: number;
  discountAmount?: number;
  uses: number;
  maxUses?: number;
  expiresAt?: string;
  autoApply?: boolean;
  targetType?: 'all' | 'plan' | 'item';
  targetId?: string | null;
  newUsersOnly?: boolean;
  firstPurchaseOnly?: boolean;
  allowedUserIds?: string[];
  allowedUserEmails?: string[];
}

export interface PlanPricing {
  monthly: number;
  quarterly: number;
  annual: number;
  quarterlyDiscountPercent: number;
  annualDiscountPercent: number;
}

export type PlanName = 'Gratuito' | 'Essencial' | 'Pro' | 'Elite';

export interface Promotion {
  isActive: boolean;
  name: string;
  slug: string;
  discountPercentage: number;
  bannerText: string;
  themeColor: string;
  landingPageTitle: string;
  landingPageHeadline: string;
  landingPageSubheadline: string;
  featuresHighlight: string[];
  notificationTitle?: string;
  notificationMessage?: string;
  notificationActionUrl?: string;
  emailEnabled?: boolean;
  emailSubject?: string;
  emailPreview?: string;
  emailBody?: string;
  siteBanners?: MarketingCampaignBanner[];
  automationRules?: MarketingCampaignAutomationRule[];
}

export interface MarketingCampaignBanner {
  id: string;
  enabled: boolean;
  placement: 'topbar' | 'home-hero' | 'question-sidebar' | 'practice-sidebar' | 'checkout' | 'marketplace';
  headline: string;
  description?: string;
  ctaLabel?: string;
  actionUrl?: string;
  backgroundColor?: string;
}

export interface MarketingCampaignAutomationRule {
  id: string;
  enabled: boolean;
  condition: 'recent_signup' | 'near_subscription' | 'inactive_7_days' | 'trial_ending' | 'saved_questions' | 'elite_upgrade';
  channel: 'email' | 'notification' | 'both';
  delayHours: number;
  subject: string;
  message: string;
}

export interface LimitedOfferCountdownSettings {
  enabled: boolean;
  endsAt: string;
}

export type LandingFeatureIconKey =
  | 'ranking'
  | 'materials'
  | 'teacher-comments'
  | 'filters'
  | 'xray'
  | 'community'
  | 'simulations'
  | 'performance';

export interface LandingFeatureCard {
  id: string;
  title: string;
  description: string;
  iconKey: LandingFeatureIconKey;
  enabled?: boolean;
  order?: number;
}

export type LandingSocialIconKey =
  | 'instagram'
  | 'youtube'
  | 'telegram'
  | 'whatsapp'
  | 'linkedin';

export interface LandingSocialLink {
  id: string;
  label: string;
  handle: string;
  url: string;
  iconKey: LandingSocialIconKey;
  enabled: boolean;
}

export interface LandingPageContent {
  featureCards: LandingFeatureCard[];
  socialLinks: LandingSocialLink[];
}

export type MarketingLandingPageStatus = 'draft' | 'published';
export type MarketingLandingPageType = 'plans';

export interface MarketingLandingHero {
  eyebrow: string;
  title: string;
  description: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  proof: string;
}

export interface MarketingLandingPlanCard {
  id: string;
  title: string;
  planName: PlanName;
  badge?: string;
  description: string;
  ctaLabel: string;
  featured?: boolean;
  summaryBenefits: string[];
}

export interface MarketingLandingContentBlockItem {
  title: string;
  description: string;
}

export interface MarketingLandingAuthoritySection {
  eyebrow: string;
  title: string;
  description: string;
  items: MarketingLandingContentBlockItem[];
}

export interface MarketingLandingValueMatrix {
  eyebrow: string;
  title: string;
  whatYouDo: string[];
  whatYouReceive: string[];
  whatYouConquer: string[];
}

export interface MarketingLandingEliteSection {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  ctaLabel: string;
}

export interface MarketingLandingComparisonRow {
  id: string;
  label: string;
  values: Partial<Record<PlanName, string>>;
}

export interface MarketingLandingObjectionItem {
  title: string;
  description: string;
}

export interface MarketingLandingGuaranteeSection {
  title: string;
  description: string;
}

export interface MarketingLandingFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface MarketingLandingFinalCta {
  title: string;
  description: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
}

export interface MarketingLandingSeo {
  title: string;
  metaDescription: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
}

export interface MarketingLandingPage {
  id: string;
  title: string;
  slug: string;
  status: MarketingLandingPageStatus;
  pageType: MarketingLandingPageType;
  linkedPlanId?: number | null;
  hero: MarketingLandingHero;
  planCards: MarketingLandingPlanCard[];
  authoritySection: MarketingLandingAuthoritySection;
  valueMatrix: MarketingLandingValueMatrix;
  eliteSection: MarketingLandingEliteSection;
  comparisonRows: MarketingLandingComparisonRow[];
  objections: MarketingLandingObjectionItem[];
  guarantee: MarketingLandingGuaranteeSection;
  faq: MarketingLandingFaqItem[];
  finalCta: MarketingLandingFinalCta;
  seo: MarketingLandingSeo;
  createdAt: string;
  updatedAt: string;
}

export interface PlanFeature {
  text: string;
  included: boolean;
}

export type PlanBenefitKey =
    | 'module.dashboard'
    | 'module.practice'
    | 'module.lei_comentada'
    | 'module.flashcards'
    | 'module.simulations'
    | 'module.xray'
    | 'module.schedule'
    | 'module.marketplace'
    | 'practice.filter_keyword'
    | 'practice.filter_subject'
    | 'practice.filter_difficulty'
    | 'practice.filter_bank'
    | 'practice.filter_organization'
    | 'practice.filter_year'
    | 'practice.filter_level'
    | 'practice.filter_role'
    | 'practice.filter_modality'
    | 'practice.filter_topic'
    | 'practice.filter_saved'
    | 'practice.filter_teacher_comment'
    | 'practice.filter_detailed_analysis'
    | 'practice.filter_answered_correct'
    | 'practice.filter_answered_wrong'
    | 'question.resolve'
    | 'question.answer_key'
    | 'question.detailed_analysis'
    | 'question.save'
    | 'question.notes'
    | 'question.share'
    | 'question.full_statistics'
    | 'ads.adsense_banner'
    | 'ads.facebook_banner'
    | 'ads.between_questions'
    | 'ads.in_comments'
    | 'ads.web_interstitial'
    | 'ads.navigation_pop'
    | 'ads.internal_sponsorships'
    | 'ads.reduced'
    | 'unlimited_questions'
    | 'basic_statistics'
    | 'community_comments'
  | 'no_ads'
  | 'teacher_comments'
  | 'detailed_analysis'
  | 'error_notebook'
  | 'exclusive_simulations'
  | 'xray_banca'
  | 'mentor_chat'
  | 'priority_support'
  | 'early_access'
  | 'lei.comentario_basico'
  | 'lei.doutrina'
  | 'lei.macete'
  | 'lei.como_cai'
  | 'lei.jurisprudencia'
  | 'lei.sumulas'
  | 'lei.questoes'
  | 'lei.raiox'
  | 'lei.anotacoes'
  | 'lei.modo_foco'
  | 'lei.favoritos'
  | 'lei.solicitar_comentario';

export interface PlanBenefitDefinition {
  key: PlanBenefitKey;
  label: string;
  description: string;
  limitKey?: PlanUsageLimitKey;
}

export interface PlanBenefitAccess {
  enabled: boolean;
}

export type PlanBenefitMatrix = Record<PlanBenefitKey, PlanBenefitAccess>;

export interface PlanEntitlements {
  Gratuito: PlanBenefitMatrix;
  Essencial: PlanBenefitMatrix;
  Pro: PlanBenefitMatrix;
  Elite: PlanBenefitMatrix;
}

export type PlanUsageLimitKey =
  | 'questions_per_day'
  | 'comments_per_day'
  | 'simulations_per_week'
  | 'simulations_per_month'
  | 'saved_questions_limit'
  | 'lei_related_questions_limit'
  | 'lei_annotations_limit'
  | 'lei_favorites_limit'
  | 'ad_interstitial_answer_interval';

export type LegalCommentaryFeatureKey =
  | 'lei.texto'
  | 'lei.comentario_basico'
  | 'lei.doutrina'
  | 'lei.macete'
  | 'lei.como_cai'
  | 'lei.jurisprudencia'
  | 'lei.sumulas'
  | 'lei.questoes'
  | 'lei.raiox'
  | 'lei.anotacoes'
  | 'lei.modo_foco'
  | 'lei.favoritos'
  | 'lei.solicitar_comentario';

export type LegalCommentaryFeatureConfigurableKey = Exclude<LegalCommentaryFeatureKey, 'lei.texto'>;

export type LegalCommentaryFeatureFallbackMode = 'preview' | 'locked' | 'hidden';

export interface LegalCommentaryFeatureConfigEntry {
  fallbackMode: LegalCommentaryFeatureFallbackMode;
}

export type LegalCommentaryFeatureConfig = Record<
  LegalCommentaryFeatureConfigurableKey,
  LegalCommentaryFeatureConfigEntry
>;

export interface LegalCommentaryFeatureAccessState {
  feature_key: LegalCommentaryFeatureKey;
  requires_plan: PlanName;
  enabled: boolean;
  mode: 'full' | LegalCommentaryFeatureFallbackMode;
  fallback_mode: 'full' | LegalCommentaryFeatureFallbackMode;
  limit_key?: PlanUsageLimitKey | null;
  limit_value?: number | null;
}

export interface PlanUsageLimitDefinition {
  key: PlanUsageLimitKey;
  label: string;
  description: string;
  inputLabel: string;
}

export interface PlanUsageLimitValue {
  mode: 'unlimited' | 'limited';
  value: number | null;
}

export type PlanUsageLimitMatrix = Record<PlanUsageLimitKey, PlanUsageLimitValue>;

export interface PlanUsageLimits {
  Gratuito: PlanUsageLimitMatrix;
  Essencial: PlanUsageLimitMatrix;
  Pro: PlanUsageLimitMatrix;
  Elite: PlanUsageLimitMatrix;
}

export interface PlanConfig {
  displayName?: string;
  color: string;
  popular?: boolean;
  enabled?: boolean;
  features: PlanFeature[];
}

export type AppPromotionTheme = 'default' | 'black-friday' | 'black-november' | 'estudante' | 'sao-joao' | 'carnaval' | 'ano-novo' | 'pascoa' | 'consumidor';

export interface TaxonomyItem {
  id: string;
  name: string;
  slug?: string;
  parentId?: string;
  rootSubjectId?: string;
  taxonomyLevel?: 'materia' | 'topico' | 'assunto' | string;
  type?: 'agency' | 'subject' | 'topic' | 'role' | 'year' | 'modality' | 'career' | string;
  description?: string;
  website?: string;
  assetUrl?: string;
  iconKey?: string;
  aliases?: string[];
  keywords?: string[];
}

export interface GlobalTaxonomies {
  areas?: TaxonomyItem[];
  agencies: TaxonomyItem[];
  organizations: TaxonomyItem[];
  subjects: TaxonomyItem[];
  topics: TaxonomyItem[];
  subjectTopics?: TaxonomyItem[];
  specificSubjects?: TaxonomyItem[];
  roles: TaxonomyItem[];
  careers: TaxonomyItem[];
  years: string[];
  modalities: string[];
}

export interface FirebaseClientConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export type StripePaymentMethodId = 'card' | 'pix' | 'boleto' | 'apple_pay' | 'google_pay' | string;

export interface StripePaymentMethodSetting {
  id: StripePaymentMethodId;
  label: string;
  stripeType: string;
  enabled: boolean;
  checkoutSupported: boolean;
  recurringSupported: boolean;
  removable?: boolean;
  description?: string;
}

export interface StripePaymentMethodsSettings {
  methods: StripePaymentMethodSetting[];
}

export interface EmailTemplateModel {
  key: string;
  name: string;
  description: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  enabled: boolean;
  updatedAt?: string;
}

export interface GamificationRuleSettings {
  key: string;
  eventName: string;
  category: string;
  label: string;
  description: string;
  xp: number;
  maxXp?: number;
  reputation?: number;
  repeatability?: string;
  enabled: boolean;
}

export interface GamificationSettings {
  enabled: boolean;
  rules: GamificationRuleSettings[];
  updatedAt?: string;
}

export interface NotificationRuleSettings {
  key: string;
  category: string;
  label: string;
  trigger: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | string;
  link?: string | null;
  audience?: string;
  enabled: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  rules: NotificationRuleSettings[];
  updatedAt?: string;
}

export interface SystemSettings {
  appName?: string;
  activeTheme: AppPromotionTheme;
  paymentProvider?: 'stripe';
  paymentCheckoutMode?: 'internal' | 'redirect';
  cardVaultProvider?: 'stripe';
  stripePaymentMethods?: StripePaymentMethodsSettings;
  pricing: {
    Gratuito: PlanPricing;
    Essencial: PlanPricing;
    Pro: PlanPricing;
    Elite: PlanPricing;
  };
  planDetails: {
    Gratuito: PlanConfig;
    Essencial: PlanConfig;
    Pro: PlanConfig;
    Elite: PlanConfig;
  };
  planEntitlements?: PlanEntitlements;
  planUsageLimits?: PlanUsageLimits;
  legalCommentaryFeatureConfig?: LegalCommentaryFeatureConfig;
  activePromotion: Promotion;
  limitedOfferCountdown: LimitedOfferCountdownSettings;
  landingPageContent?: LandingPageContent;
  landingPages?: MarketingLandingPage[];
  coupons: DiscountCode[];
  features: {
    practiceEnabled: boolean;
    marketplaceEnabled: boolean;
    rankingsEnabled: boolean;
    referralEnabled: boolean;
    annotatedLawsEnabled: boolean;
    flashcardsEnabled: boolean;
    communityEnabled: boolean;
    aiCommentsEnabled: boolean;
    bulkImportEnabled: boolean;
    reportsEnabled: boolean;
    notificationsEnabled: boolean;
    simulationsEnabled: boolean;
    studyScheduleEnabled: boolean;
    maintenanceMode: boolean;
    registrationEnabled: boolean;
    landingPagePromoEnabled: boolean;
    xRayEnabled: boolean;
    loginRequired: boolean;
    partnerRegistrationEnabled: boolean;
    recurringEnabled: boolean;
    sameTierCycleChangeEnabled: boolean;
    autoRefundEnabled: boolean;
  };
  adsEnabled?: boolean;
  adsenseTestMode?: boolean;
  adsenseClientId?: string;
  adsTxtContent?: string;
  adsenseTopSlotId?: string;
  adsenseSidebarSlotId?: string;
  adsenseBottomSlotId?: string;
  adPlacementTopEnabled?: boolean;
  adPlacementSidebarEnabled?: boolean;
  adPlacementBottomEnabled?: boolean;
  adPlacementInterstitialEnabled?: boolean;
  adPlacementNavigationPopEnabled?: boolean;
  facebookAdsId?: string;
  adBannerTop?: string;
  adBannerSidebar?: string;
  adBannerBottom?: string;
  adInterstitialSlotId?: string;
  adNavigationPopUrl?: string;
  aiProvider?: 'gemini' | 'openai' | 'auto' | string;
  geminiApiKey?: string;
  geminiModel?: string;
  hasGeminiApiKeyConfigured?: boolean;
  openaiApiKey?: string;
  openAiModel?: string;
  hasOpenAiApiKeyConfigured?: boolean;
  recaptchaEnabled?: boolean;
  recaptchaSiteKey?: string;
  recaptchaSecretKey?: string;
  hasRecaptchaSecretConfigured?: boolean;

  googleAnalyticsId?: string;
  googleAuthClientId?: string;
  hasGoogleAuthClientConfigured?: boolean;
  facebookAuthAppId?: string;
  facebookAuthAppSecret?: string;
  hasFacebookAuthConfigured?: boolean;
  appleAuthClientId?: string;
  appleAuthRedirectUri?: string;
  hasAppleAuthConfigured?: boolean;
  metaPixelId?: string;
  supportPhone?: string;
  legalContactEmail?: string;
  privacyContactEmail?: string;
  pixKey?: string;
  siteName?: string;
  dailyMotivationMarkdown?: string;
  platformFeePercent?: number;
  referralCommissionPercent?: number;
  referralRefundGraceDays?: number;
  referralPayoutCycleDays?: number;
  referralPayoutDay?: number;
  appMode?: 'development' | 'production';
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: 'tls' | 'ssl';
  smtpUser?: string;
  smtpPass?: string;
  hasSmtpPasswordConfigured?: boolean;
  mailFromAddress?: string;
  mailFromName?: string;
  emailLogoUrl?: string;
  emailTemplates?: EmailTemplateModel[];
  gamification?: GamificationSettings;
  notificationSettings?: NotificationSettings;
  stripeKey?: string;
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  hasStripeSecretConfigured?: boolean;
  hasStripeWebhookConfigured?: boolean;
  firebaseConfig?: FirebaseClientConfig;
  taxonomies?: GlobalTaxonomies;
  examBank?: Prova[];
  seo?: SeoSettings;
}

export interface Material {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  price: number;
  type: 'PDF' | 'Simulado' | 'Resumo';
  subject: Subject | string;
  subjectId?: number;
  subjectText?: string;
  topicId?: number;
  topic?: string;
  pageCount?: number;
  year?: number;
  examTarget?: string;
  coverUrl?: string;
  previewUrl?: string;
  /** Referencia opaca retornada apenas apos um upload privado. */
  fileRef?: string;
  /** Indica que existe PDF protegido sem revelar caminho de armazenamento. */
  hasFile?: boolean;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  salesCount: number;
  rating: number;
  createdAt: number;
  comments: QuestaoComentario[];
  details?: string;
}

export interface Transaction {
  id: string;
  buyerId: string;
  buyerName: string;
  materialId: string;
  materialTitle: string;
  sellerId: string;
  amount: number;
  platformFee: number;
  status: 'completed' | 'approved' | 'refund_requested' | 'refunded' | 'cancelled';
  refundReason?: string;
  type?: 'material' | 'plan';
  paymentProvider?: 'stripe';
  timestamp: number;
}

export interface Plan {
  id: number;
  name: string;
  description: string;
  price: number;
  interval_count: number;
  interval_unit: 'day' | 'week' | 'month' | 'year';
  tier?: number; // 1=Gratuito, 2=Essencial, 3=Pro, 4=Elite
  features: PlanFeature[];
  external_plan_id?: string;
  is_active?: boolean;
  canonical_name?: PlanName;
}

export interface UserSubscription {
  id: number;
  user_id: string;
  plan_id: number;
  created_at?: string | number | null;
  createdAt?: string | number | null;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';
  auto_renew?: boolean;
  payment_provider?: 'stripe' | 'manual_admin';
  payment_checkout_mode?: 'internal' | 'redirect';
  card_vault_provider?: 'local' | 'stripe';
  provider_subscription_id?: string | null;
  provider_customer_id?: string | null;
  provider_schedule_id?: string | null;
  provider_current_period_start?: string | number | null;
  provider_current_period_end?: string | number | null;
  next_billing_at?: string | number | null;
  cancel_at_period_end?: boolean;
  current_period_start: string;
  current_period_end: string;
  plan?: Plan;
  refund_requested?: boolean;
  is_recurring?: boolean;
  total_installments?: number;
  paid_installments?: number;
  recurring_amount?: number;
  renewal_iteration?: number;
  next_renewal_amount?: number;
  next_renewal_date?: string | number | null;
  next_renewal_price_source?: string | null;
  next_renewal_cycle_label?: string | null;
  payment_block_reason?: string | null;
  payment_blocking?: boolean;
}
