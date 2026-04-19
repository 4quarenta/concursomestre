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

export interface QuestionItem {
  id: number;
  ordem: number;
  rotulo: string;
  corpo: string;
  corpo_clean?: string;
}

export interface QuestaoComentario {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userPlan?: 'Gratuito' | 'Essencial' | 'Pro' | 'Elite';
  text: string;
  date: string;
  likes: number;
  isLiked?: boolean;
  parentId?: string;
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
  targetType: 'question' | 'material' | 'comment';
  questionId?: number;
  materialId?: string;
  commentId?: string;
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
  resolution?: string;
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
  banca: Banca;
  orgao: Orgao;
  cargo: Cargo;
}

export interface GrupoQuestao {
  id: number;
  enunciado: string;
  enunciado_clean: string;
  rotulo: string | null;
  texto: string | null;
  descrição: string;
  ordem: number;
  image_url?: string;
}

export interface Question {
  id?: number;
  hashId?: string;
  hash?: string;
  enunciado: string;
  enunciado_clean?: string;
  introText?: string;
  imageUrl?: string;
  hasImage?: boolean;
  hasImageItens?: boolean;

  // Taxonomias
  bancas: Banca[];
  orgaos: Orgao[];
  cargos: Cargo[];
  assuntos: Assunto[];
  anos: number[];
  carreiras?: any[];
  areas?: any[];
  tiposProva?: number[];
  ultimoAno?: {
    rank: number;
    stamp: string;
  };
  nivel?: string | any;
  level?: string | any; // Can be string "Superior" or many object from backend
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
  grupoQuestao?: GrupoQuestao;

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
  timestamp: number;
  simulationId?: string;
  timeTaken?: number;
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
  answers: Record<string, number>;
  startTime: number;
  endTime?: number;
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
  address?: Address;
  bankAccount?: BankAccount;
  targetExam: string;
  level: number;
  xp: number;
  reputation: number; // 0 to 100
  commentsCount: number;
  role: 'admin' | 'user' | 'partner' | 'staff';
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
  };
  photoUrl?: string;
  referralCode?: string;
  googleId?: string;
  facebookId?: string;
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
  | 'unlimited_questions'
  | 'basic_statistics'
  | 'community_comments'
  | 'no_ads'
  | 'teacher_comments'
  | 'detailed_analysis'
  | 'ai_explanations'
  | 'error_notebook'
  | 'exclusive_simulations'
  | 'xray_banca'
  | 'mentor_chat'
  | 'priority_support'
  | 'early_access';

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
  | 'ai_explanations_per_day'
  | 'saved_questions_limit';

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
  type?: 'agency' | 'subject' | 'topic' | 'role' | 'year' | 'modality' | 'career' | string;
  description?: string;
  website?: string;
}

export interface GlobalTaxonomies {
  areas?: TaxonomyItem[];
  agencies: TaxonomyItem[];
  organizations: TaxonomyItem[];
  subjects: TaxonomyItem[];
  topics: TaxonomyItem[];
  roles: TaxonomyItem[];
  careers: TaxonomyItem[];
  years: string[];
  modalities: string[];
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
    maintenanceMode: boolean;
    registrationEnabled: boolean;
    landingPagePromoEnabled: boolean;
    xRayEnabled: boolean;
    loginRequired: boolean;
    partnerRegistrationEnabled: boolean;
    recurringEnabled: boolean;
    sameTierCycleChangeEnabled: boolean;
  };
  adsEnabled?: boolean;
  adsenseClientId?: string;
  facebookAdsId?: string;
  adBannerTop?: string;
  adBannerSidebar?: string;
  adBannerBottom?: string;
  geminiApiKey?: string;
  recaptchaEnabled?: boolean;
  recaptchaSiteKey?: string;
  recaptchaSecretKey?: string;

  googleAnalyticsId?: string;
  metaPixelId?: string;
  supportPhone?: string;
  pixKey?: string;
  siteName?: string;
  dailyMotivationMarkdown?: string;
  platformFeePercent?: number;
  appMode?: 'development' | 'production';
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: 'tls' | 'ssl';
  smtpUser?: string;
  smtpPass?: string;
  mailFromAddress?: string;
  mailFromName?: string;
  stripeKey?: string;
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  hasStripeSecretConfigured?: boolean;
  hasStripeWebhookConfigured?: boolean;
  firebaseConfig?: any;
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
  fileUrl?: string;
  pdfPassword?: string;
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
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';
  auto_renew?: boolean;
  payment_provider?: 'stripe';
  payment_checkout_mode?: 'internal' | 'redirect';
  card_vault_provider?: 'local' | 'stripe';
  provider_subscription_id?: string | null;
  provider_customer_id?: string | null;
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
}
