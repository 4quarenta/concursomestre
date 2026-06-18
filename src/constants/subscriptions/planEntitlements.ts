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

import {
  PlanBenefitAccess,
  PlanBenefitDefinition,
  PlanBenefitKey,
  PlanBenefitMatrix,
  PlanEntitlements,
  PlanFeature,
  PlanName,
  PlanUsageLimitDefinition,
  PlanUsageLimitKey,
  PlanUsageLimitMatrix,
  PlanUsageLimits,
} from '@types';

export const PLAN_ORDER: PlanName[] = ['Gratuito', 'Essencial', 'Pro', 'Elite'];

export const PLAN_USAGE_LIMIT_DEFINITIONS: PlanUsageLimitDefinition[] = [
  {
    key: 'questions_per_day',
    label: 'Questões por dia',
    description: 'Controla quantas questões podem ser respondidas por dia dentro do plano.',
    inputLabel: 'questões/dia',
  },
  {
    key: 'comments_per_day',
    label: 'Comentários por dia',
    description: 'Define quantos comentários o usuário pode publicar por dia.',
    inputLabel: 'comentários/dia',
  },
  {
    key: 'simulations_per_week',
    label: 'Simulados por semana',
    description: 'Limite operacional semanal para criação ou execução de simulados.',
    inputLabel: 'simulados/semana',
  },
  {
    key: 'simulations_per_month',
    label: 'Simulados por mês',
    description: 'Limite mensal complementar para controlar recorrência de simulados.',
    inputLabel: 'simulados/mês',
  },
  {
    key: 'saved_questions_limit',
    label: 'Questões salvas',
    description: 'Define a capacidade máxima de questões favoritas ou salvas no perfil.',
    inputLabel: 'itens',
  },
  {
    key: 'lei_related_questions_limit',
    label: 'Questões da lei',
    description: 'Controla quantas questões relacionadas podem ser abertas a partir da Lei Comentada.',
    inputLabel: 'questões',
  },
  {
    key: 'lei_annotations_limit',
    label: 'Anotações na lei',
    description: 'Limita a quantidade de anotações salvas dentro da leitura da Lei Comentada.',
    inputLabel: 'anotações',
  },
  {
    key: 'lei_favorites_limit',
    label: 'Favoritos na lei',
    description: 'Limita quantas leis, seções ou artigos podem ficar favoritados na Lei Comentada.',
    inputLabel: 'favoritos',
  },
  {
    key: 'ad_interstitial_answer_interval',
    label: 'Intervalo do interstitial',
    description: 'Exibe um interstitial apos X questoes respondidas. Use 1 para tentar exibir a cada resposta.',
    inputLabel: 'respostas',
  },
];

export const PLAN_BENEFIT_DEFINITIONS: PlanBenefitDefinition[] = [
  {
    key: 'module.dashboard',
    label: 'Módulo: dashboard premium',
    description: 'Controla acesso completo ao painel premium de desempenho e insights.',
  },
  {
    key: 'module.practice',
    label: 'Módulo: prática',
    description: 'Controla acesso ao módulo principal de resolução de questões.',
  },
  {
    key: 'module.lei_comentada',
    label: 'Módulo: lei comentada',
    description: 'Controla acesso ao acervo de leis comentadas.',
  },
  {
    key: 'module.flashcards',
    label: 'Módulo: flashcards',
    description: 'Controla acesso ao módulo de flashcards.',
  },
  {
    key: 'module.simulations',
    label: 'Módulo: simulados',
    description: 'Controla acesso ao módulo de simulados, respeitando os limites configurados.',
  },
  {
    key: 'module.xray',
    label: 'Módulo: raio-X',
    description: 'Controla acesso completo ao raio-X de banca.',
  },
  {
    key: 'module.schedule',
    label: 'Módulo: cronograma',
    description: 'Controla acesso ao cronograma e trilhas de estudo.',
  },
  {
    key: 'module.marketplace',
    label: 'Módulo: marketplace',
    description: 'Controla acesso ao marketplace de materiais.',
  },
  {
    key: 'practice.filter_keyword',
    label: 'Filtro: palavra-chave',
    description: 'Libera busca textual no módulo de questões.',
  },
  {
    key: 'practice.filter_subject',
    label: 'Filtro: matéria',
    description: 'Libera filtro por matéria/disciplina.',
  },
  {
    key: 'practice.filter_difficulty',
    label: 'Filtro: dificuldade',
    description: 'Libera filtro por dificuldade.',
  },
  {
    key: 'practice.filter_bank',
    label: 'Filtro: banca',
    description: 'Libera filtro por banca organizadora.',
  },
  {
    key: 'practice.filter_organization',
    label: 'Filtro: órgão',
    description: 'Libera filtro por órgão/instituição.',
  },
  {
    key: 'practice.filter_year',
    label: 'Filtro: ano',
    description: 'Libera filtro por ano da questão/prova.',
  },
  {
    key: 'practice.filter_level',
    label: 'Filtro: nível',
    description: 'Libera filtro por nível de escolaridade.',
  },
  {
    key: 'practice.filter_role',
    label: 'Filtro: cargo',
    description: 'Libera filtro por cargo.',
  },
  {
    key: 'practice.filter_modality',
    label: 'Filtro: modalidade',
    description: 'Libera filtro por modalidade.',
  },
  {
    key: 'practice.filter_topic',
    label: 'Filtro: assunto',
    description: 'Libera filtro por tópico/assunto.',
  },
  {
    key: 'practice.filter_saved',
    label: 'Filtro: questões salvas',
    description: 'Libera recorte de questões salvas pelo aluno.',
  },
  {
    key: 'practice.filter_teacher_comment',
    label: 'Filtro: comentário do professor',
    description: 'Libera filtro apenas com comentário do professor.',
  },
  {
    key: 'practice.filter_detailed_analysis',
    label: 'Filtro: análise detalhada',
    description: 'Libera filtro apenas com análise detalhada.',
  },
  {
    key: 'practice.filter_answered_correct',
    label: 'Filtro: acertei',
    description: 'Libera filtro de questões que o aluno acertou.',
  },
  {
    key: 'practice.filter_answered_wrong',
    label: 'Filtro: errei',
    description: 'Libera filtro de questões que o aluno errou.',
  },
  {
    key: 'question.resolve',
    label: 'Card: resolver questão',
    description: 'Permite responder questões no card.',
  },
  {
    key: 'question.answer_key',
    label: 'Card: ver gabarito',
    description: 'Permite visualizar gabarito e resultado.',
  },
  {
    key: 'teacher_comments',
    label: 'Card: comentário do professor',
    description: 'Permite visualizar o comentário do professor quando disponível.',
  },
  {
    key: 'question.detailed_analysis',
    label: 'Card: análise detalhada',
    description: 'Permite abrir a análise detalhada dentro do card da questão.',
  },
  {
    key: 'question.save',
    label: 'Card: salvar questão',
    description: 'Permite salvar/favoritar questões.',
    limitKey: 'saved_questions_limit',
  },
  {
    key: 'question.notes',
    label: 'Card: anotações',
    description: 'Permite criar anotações pessoais na questão.',
  },
  {
    key: 'question.share',
    label: 'Card: compartilhar',
    description: 'Permite compartilhar questoes.',
  },
  {
    key: 'question.full_statistics',
    label: 'Card: estatísticas completas',
    description: 'Libera estatísticas completas da questão.',
  },
  {
    key: 'ads.adsense_banner',
    label: 'Ads: banner AdSense',
    description: 'Permite exibir banners AdSense para o plano.',
  },
  {
    key: 'ads.facebook_banner',
    label: 'Ads: banner Facebook/Meta',
    description: 'Permite exibir banners da Meta ou criativos equivalentes.',
  },
  {
    key: 'ads.between_questions',
    label: 'Ads: entre questões',
    description: 'Permite inserir anúncios entre cards de questões.',
  },
  {
    key: 'ads.in_comments',
    label: 'Ads: em comentários',
    description: 'Permite inserir publicidade na área de comentários.',
  },
  {
    key: 'ads.web_interstitial',
    label: 'Ads: interstitial web',
    description: 'Permite exibir anúncio interstitial GPT após ações do usuário, como responder questões.',
    limitKey: 'ad_interstitial_answer_interval',
  },
  {
    key: 'ads.navigation_pop',
    label: 'Ads: pop de navegacao',
    description: 'Permite abrir uma chamada publicitaria controlada durante navegacao entre paginas.',
  },
  {
    key: 'ads.internal_sponsorships',
    label: 'Ads: patrocinio interno',
    description: 'Permite chamadas comerciais internas da plataforma.',
  },
  {
    key: 'ads.reduced',
    label: 'Ads: exibicao reduzida',
    description: 'Aplica uma experiência com menos anúncios, sem interrupções laterais/entre questões.',
  },
  {
    key: 'unlimited_questions',
    label: 'Questões liberadas',
    description: 'Libera o módulo de questões e usa o limite diário configurado abaixo para controlar o volume.',
    limitKey: 'questions_per_day',
  },
  {
    key: 'basic_statistics',
    label: 'Estatisticas basicas',
    description: 'Permite ver desempenho e historico essencial de resolucao.',
  },
  {
    key: 'community_comments',
    label: 'Comentários da comunidade',
    description: 'Libera leitura e participação nos comentários dos alunos.',
    limitKey: 'comments_per_day',
  },
  {
    key: 'no_ads',
    label: 'Sem anúncios',
    description: 'Oculta banners e blocos de publicidade durante o estudo.',
  },
  {
    key: 'detailed_analysis',
    label: 'Analise detalhada',
    description: 'Libera análises premium mais profundas por questão.',
  },
  {
    key: 'error_notebook',
    label: 'Caderno de erros',
    description: 'Libera recursos avancados para revisar erros e recorrencias.',
  },
  {
    key: 'exclusive_simulations',
    label: 'Simulados exclusivos',
    description: 'Libera simulados premium e usa os limites semanal/mensal configurados abaixo.',
    limitKey: 'simulations_per_month',
  },
  {
    key: 'xray_banca',
    label: 'Raio-X da banca',
    description: 'Libera a inteligência de banca com análises e recomendações.',
  },
  {
    key: 'mentor_chat',
    label: 'Chat mentor',
    description: 'Libera atendimento e acompanhamento premium de mentor.',
  },
  {
    key: 'priority_support',
    label: 'Suporte prioritario',
    description: 'Prioriza o atendimento do assinante em filas e suporte.',
  },
  {
    key: 'early_access',
    label: 'Acesso antecipado',
    description: 'Libera novidades antes do restante da base.',
  },
  {
    key: 'lei.comentario_basico',
    label: 'Lei comentada: comentário do professor',
    description: 'Libera o comentário editorial do professor dentro do artigo.',
  },
  {
    key: 'lei.doutrina',
    label: 'Lei comentada: doutrina',
    description: 'Libera os cards de doutrina e entendimento doutrinario no artigo.',
  },
  {
    key: 'lei.macete',
    label: 'Lei comentada: macete',
    description: 'Libera o card premium de memorizacao e macete rapido.',
  },
  {
    key: 'lei.como_cai',
    label: 'Lei comentada: como cai em prova',
    description: 'Libera o bloco com estrategia e padrao de cobranca.',
  },
  {
    key: 'lei.jurisprudencia',
    label: 'Lei comentada: jurisprudencia',
    description: 'Libera o resumo jurisprudencial relevante do artigo.',
  },
  {
    key: 'lei.sumulas',
    label: 'Lei comentada: sumulas',
    description: 'Libera sumulas e enunciados relacionados ao artigo.',
  },
  {
    key: 'lei.questoes',
    label: 'Lei comentada: questoes relacionadas',
    description: 'Libera o bloco de pratica conectado ao artigo.',
    limitKey: 'lei_related_questions_limit',
  },
  {
    key: 'lei.raiox',
    label: 'Lei comentada: raio-X do artigo',
    description: 'Libera o mapa estrategico de importancia, tema e conexoes do artigo.',
  },
  {
    key: 'lei.anotacoes',
    label: 'Lei comentada: anotações',
    description: 'Libera o card de anotações pessoais dentro do artigo.',
    limitKey: 'lei_annotations_limit',
  },
  {
    key: 'lei.modo_foco',
    label: 'Lei comentada: modo foco',
    description: 'Libera a leitura em modo foco dentro da Lei Comentada.',
  },
  {
    key: 'lei.favoritos',
    label: 'Lei comentada: favoritar lei/secao',
    description: 'Permite favoritar leis, seções e artigos da Lei Comentada.',
    limitKey: 'lei_favorites_limit',
  },
  {
    key: 'lei.solicitar_comentario',
    label: 'Lei comentada: solicitar comentário',
    description: 'Permite solicitar comentário do professor para artigo, inciso, parágrafo ou alínea.',
  },
];

const createBenefitMatrix = (enabledKeys: PlanBenefitKey[]): PlanBenefitMatrix => {
  const enabledSet = new Set(enabledKeys);

  return PLAN_BENEFIT_DEFINITIONS.reduce((acc, benefit) => {
    acc[benefit.key] = {
      enabled: enabledSet.has(benefit.key),
    };
    return acc;
  }, {} as PlanBenefitMatrix);
};

const limited = (value: number): { mode: 'limited'; value: number } => ({
  mode: 'limited',
  value,
});

const unlimited = (): { mode: 'unlimited'; value: null } => ({
  mode: 'unlimited',
  value: null,
});

const createUsageLimitMatrix = (
  partial: Partial<Record<PlanUsageLimitKey, { mode: 'limited' | 'unlimited'; value: number | null }>>
): PlanUsageLimitMatrix => {
  return PLAN_USAGE_LIMIT_DEFINITIONS.reduce((acc, definition) => {
    const current = partial[definition.key];
    acc[definition.key] = current
      ? {
          mode: current.mode === 'limited' ? 'limited' : 'unlimited',
          value: current.mode === 'limited' ? Math.max(0, Number(current.value || 0)) : null,
        }
      : limited(0);
    return acc;
  }, {} as PlanUsageLimitMatrix);
};

export const DEFAULT_PLAN_ENTITLEMENTS: PlanEntitlements = {
  Gratuito: createBenefitMatrix([
    'module.practice',
    'module.lei_comentada',
    'module.simulations',
    'module.marketplace',
    'practice.filter_keyword',
    'practice.filter_subject',
    'practice.filter_difficulty',
    'practice.filter_bank',
    'question.resolve',
    'question.answer_key',
    'ads.adsense_banner',
    'ads.facebook_banner',
    'ads.between_questions',
    'ads.in_comments',
    'ads.web_interstitial',
    'ads.navigation_pop',
    'ads.internal_sponsorships',
    'unlimited_questions',
    'basic_statistics',
    'community_comments',
    'lei.comentario_basico',
    'lei.modo_foco',
  ]),
  Essencial: createBenefitMatrix([
    'module.practice',
    'module.lei_comentada',
    'module.simulations',
    'module.marketplace',
    'practice.filter_keyword',
    'practice.filter_subject',
    'practice.filter_difficulty',
    'practice.filter_bank',
    'practice.filter_organization',
    'practice.filter_year',
    'practice.filter_level',
    'practice.filter_role',
    'practice.filter_modality',
    'practice.filter_topic',
    'practice.filter_saved',
    'practice.filter_teacher_comment',
    'practice.filter_answered_correct',
    'practice.filter_answered_wrong',
    'question.resolve',
    'question.answer_key',
    'question.save',
    'question.notes',
    'question.share',
    'question.full_statistics',
    'ads.adsense_banner',
    'ads.facebook_banner',
    'ads.internal_sponsorships',
    'ads.reduced',
    'unlimited_questions',
    'basic_statistics',
    'community_comments',
    'teacher_comments',
    'error_notebook',
    'lei.comentario_basico',
    'lei.modo_foco',
    'lei.favoritos',
    'lei.solicitar_comentario',
  ]),
  Pro: createBenefitMatrix([
    'module.practice',
    'module.lei_comentada',
    'module.flashcards',
    'module.simulations',
    'module.marketplace',
    'practice.filter_keyword',
    'practice.filter_subject',
    'practice.filter_difficulty',
    'practice.filter_bank',
    'practice.filter_organization',
    'practice.filter_year',
    'practice.filter_level',
    'practice.filter_role',
    'practice.filter_modality',
    'practice.filter_topic',
    'practice.filter_saved',
    'practice.filter_teacher_comment',
    'practice.filter_detailed_analysis',
    'practice.filter_answered_correct',
    'practice.filter_answered_wrong',
    'question.resolve',
    'question.answer_key',
    'question.detailed_analysis',
    'question.save',
    'question.notes',
    'question.share',
    'question.full_statistics',
    'unlimited_questions',
    'basic_statistics',
    'community_comments',
    'no_ads',
    'teacher_comments',
    'detailed_analysis',
    'error_notebook',
    'exclusive_simulations',
    'lei.comentario_basico',
    'lei.doutrina',
    'lei.macete',
    'lei.como_cai',
    'lei.questoes',
    'lei.anotacoes',
    'lei.modo_foco',
    'lei.favoritos',
    'lei.solicitar_comentario',
  ]),
  Elite: createBenefitMatrix([
    'module.dashboard',
    'module.practice',
    'module.lei_comentada',
    'module.flashcards',
    'module.simulations',
    'module.xray',
    'module.schedule',
    'module.marketplace',
    'practice.filter_keyword',
    'practice.filter_subject',
    'practice.filter_difficulty',
    'practice.filter_bank',
    'practice.filter_organization',
    'practice.filter_year',
    'practice.filter_level',
    'practice.filter_role',
    'practice.filter_modality',
    'practice.filter_topic',
    'practice.filter_saved',
    'practice.filter_teacher_comment',
    'practice.filter_detailed_analysis',
    'practice.filter_answered_correct',
    'practice.filter_answered_wrong',
    'question.resolve',
    'question.answer_key',
    'question.detailed_analysis',
    'question.save',
    'question.notes',
    'question.share',
    'question.full_statistics',
    'unlimited_questions',
    'basic_statistics',
    'community_comments',
    'no_ads',
    'teacher_comments',
    'detailed_analysis',
    'error_notebook',
    'exclusive_simulations',
    'xray_banca',
    'mentor_chat',
    'priority_support',
    'early_access',
    'lei.comentario_basico',
    'lei.doutrina',
    'lei.macete',
    'lei.como_cai',
    'lei.jurisprudencia',
    'lei.sumulas',
    'lei.questoes',
    'lei.raiox',
    'lei.anotacoes',
    'lei.modo_foco',
    'lei.favoritos',
    'lei.solicitar_comentario',
  ]),
};

export const DEFAULT_PLAN_USAGE_LIMITS: PlanUsageLimits = {
  Gratuito: createUsageLimitMatrix({
    questions_per_day: limited(20),
    comments_per_day: limited(3),
    simulations_per_week: limited(1),
    simulations_per_month: limited(1),
    saved_questions_limit: limited(50),
    lei_related_questions_limit: limited(0),
    lei_annotations_limit: limited(0),
    lei_favorites_limit: limited(0),
    ad_interstitial_answer_interval: limited(1),
  }),
  Essencial: createUsageLimitMatrix({
    questions_per_day: unlimited(),
    comments_per_day: limited(10),
    simulations_per_week: limited(5),
    simulations_per_month: limited(5),
    saved_questions_limit: limited(200),
    lei_related_questions_limit: limited(0),
    lei_annotations_limit: limited(0),
    lei_favorites_limit: limited(25),
    ad_interstitial_answer_interval: limited(0),
  }),
  Pro: createUsageLimitMatrix({
    questions_per_day: unlimited(),
    comments_per_day: unlimited(),
    simulations_per_week: unlimited(),
    simulations_per_month: unlimited(),
    saved_questions_limit: limited(1000),
    lei_related_questions_limit: unlimited(),
    lei_annotations_limit: limited(100),
    lei_favorites_limit: limited(100),
    ad_interstitial_answer_interval: limited(0),
  }),
  Elite: createUsageLimitMatrix({
    questions_per_day: unlimited(),
    comments_per_day: unlimited(),
    simulations_per_week: unlimited(),
    simulations_per_month: unlimited(),
    saved_questions_limit: unlimited(),
    lei_related_questions_limit: unlimited(),
    lei_annotations_limit: unlimited(),
    lei_favorites_limit: unlimited(),
    ad_interstitial_answer_interval: limited(0),
  }),
};

export const PUBLIC_PLAN_FEATURE_BENEFIT_KEYS: PlanBenefitKey[] = [
  'module.practice',
  'question.resolve',
  'teacher_comments',
  'question.detailed_analysis',
  'question.full_statistics',
  'question.save',
  'module.lei_comentada',
  'lei.comentario_basico',
  'lei.doutrina',
  'lei.macete',
  'lei.jurisprudencia',
  'lei.sumulas',
  'lei.questoes',
  'lei.modo_foco',
  'lei.favoritos',
  'module.simulations',
  'exclusive_simulations',
  'module.xray',
  'module.dashboard',
  'no_ads',
  'mentor_chat',
  'priority_support',
  'early_access',
];

const PUBLIC_PLAN_FEATURE_LABELS: Partial<Record<PlanBenefitKey, string>> = {
  'module.practice': 'Prática de questões',
  'question.resolve': 'Resolver questões',
  teacher_comments: 'Comentário do professor',
  'question.detailed_analysis': 'Análise detalhada',
  'question.full_statistics': 'Estatísticas completas',
  'question.save': 'Salvar questões',
  'module.lei_comentada': 'Lei comentada',
  'lei.comentario_basico': 'Comentários na lei',
  'lei.doutrina': 'Doutrina na lei comentada',
  'lei.macete': 'Macetes na lei comentada',
  'lei.jurisprudencia': 'Jurisprudência e súmulas',
  'lei.sumulas': 'Súmulas relacionadas',
  'lei.questoes': 'Questões da lei comentada',
  'lei.modo_foco': 'Modo foco na lei',
  'lei.favoritos': 'Favoritar leis e seções',
  'module.simulations': 'Simulados',
  'exclusive_simulations': 'Simulados exclusivos',
  'module.xray': 'Raio-X da banca',
  'module.dashboard': 'Dashboard premium',
  no_ads: 'Sem anúncios',
  mentor_chat: 'Chat mentor',
  priority_support: 'Suporte prioritário',
  early_access: 'Acesso antecipado',
};

type PublicPlanFeatureOptions = {
  maxItems?: number;
  includeDisabled?: boolean;
  usageLimits?: Partial<PlanUsageLimits> | null;
};

const buildUsageLimitFeature = (
  usageLimits: PlanUsageLimits,
  planName: PlanName,
  key: PlanUsageLimitKey,
  unlimitedText: string,
  limitedText: (value: number) => string,
): PlanFeature | null => {
  const limit = usageLimits[planName]?.[key];
  if (!limit) {
    return null;
  }

  if (limit.mode === 'unlimited') {
    return { text: unlimitedText, included: true };
  }

  const value = Number(limit.value || 0);
  return value > 0 ? { text: limitedText(value), included: true } : null;
};

const buildCommercialPlanFeatures = (
  planName: PlanName,
  planBenefits: PlanBenefitMatrix,
  usageLimits: PlanUsageLimits,
): PlanFeature[] => {
  const features: PlanFeature[] = [];
  const addFeature = (feature: PlanFeature | null | false) => {
    if (!feature) return;
    if (features.some((item) => item.text === feature.text)) return;
    features.push(feature);
  };

  addFeature(buildUsageLimitFeature(
    usageLimits,
    planName,
    'questions_per_day',
    'Questões ilimitadas',
    (value) => `${value} questões por dia`,
  ));

  addFeature(buildUsageLimitFeature(
    usageLimits,
    planName,
    'simulations_per_month',
    'Simulados ilimitados',
    (value) => `${value} simulado${value === 1 ? '' : 's'} por mês`,
  ));

  addFeature(planBenefits.teacher_comments?.enabled && { text: 'Comentário do professor', included: true });
  addFeature(planBenefits['question.detailed_analysis']?.enabled && { text: 'Análise detalhada IA', included: true });
  addFeature(planBenefits['question.full_statistics']?.enabled && { text: 'Estatísticas completas', included: true });
  addFeature(planBenefits['module.lei_comentada']?.enabled && { text: 'Lei comentada', included: true });
  addFeature(planBenefits['lei.doutrina']?.enabled && { text: 'Doutrina, súmulas e jurisprudência', included: true });
  addFeature(buildUsageLimitFeature(
    usageLimits,
    planName,
    'saved_questions_limit',
    'Questões salvas ilimitadas',
    (value) => `${value} questões salvas`,
  ));
  addFeature(planBenefits.no_ads?.enabled && { text: 'Sem anúncios', included: true });
  addFeature(planBenefits['module.xray']?.enabled && { text: 'Raio-X da banca', included: true });
  addFeature(planBenefits['module.dashboard']?.enabled && { text: 'Dashboard premium', included: true });
  addFeature(planBenefits.priority_support?.enabled && { text: 'Suporte prioritário', included: true });
  addFeature(planBenefits.early_access?.enabled && { text: 'Novas funcionalidades primeiro', included: true });

  return features;
};

export const getPublicPlanFeaturesForPlan = (
  planName: PlanName,
  entitlements?: Partial<PlanEntitlements> | null,
  optionsOrMaxItems: number | PublicPlanFeatureOptions = 10,
): PlanFeature[] => {
  const options = typeof optionsOrMaxItems === 'number'
    ? { maxItems: optionsOrMaxItems, includeDisabled: true }
    : {
        maxItems: optionsOrMaxItems.maxItems ?? 10,
        includeDisabled: optionsOrMaxItems.includeDisabled ?? true,
        usageLimits: optionsOrMaxItems.usageLimits ?? null,
      };
  const resolved = normalizePlanEntitlements(entitlements);
  const resolvedUsageLimits = normalizePlanUsageLimits(options.usageLimits || DEFAULT_PLAN_USAGE_LIMITS);
  const planBenefits = resolved[planName];
  const commercialFeatures = buildCommercialPlanFeatures(planName, planBenefits, resolvedUsageLimits);
  const commercialFeatureTexts = new Set(commercialFeatures.map((feature) => feature.text));
  const enabledFeatures = PUBLIC_PLAN_FEATURE_BENEFIT_KEYS
    .filter((key) => planBenefits[key]?.enabled)
    .map((key) => ({
      text: PUBLIC_PLAN_FEATURE_LABELS[key] || getBenefitDefinition(key).label,
      included: true,
    }))
    .filter((feature) => !commercialFeatureTexts.has(feature.text));
  const disabledFeatures = PUBLIC_PLAN_FEATURE_BENEFIT_KEYS
    .filter((key) => !planBenefits[key]?.enabled)
    .map((key) => ({
      text: PUBLIC_PLAN_FEATURE_LABELS[key] || getBenefitDefinition(key).label,
      included: false,
    }));

  const features = options.includeDisabled
    ? [...commercialFeatures, ...enabledFeatures, ...disabledFeatures]
    : [...commercialFeatures, ...enabledFeatures];

  if (features.length === 0) {
    return [{ text: 'Recursos essenciais do plano', included: true }];
  }

  return features.slice(0, options.maxItems);
};

const normalizePlanBenefitAccess = (
  rawValue: unknown,
  fallback: PlanBenefitAccess
): PlanBenefitAccess => {
  if (typeof rawValue === 'boolean') {
    return { enabled: rawValue };
  }

  if (rawValue && typeof rawValue === 'object') {
    return {
      enabled: Boolean((rawValue as Partial<PlanBenefitAccess>).enabled),
    };
  }

  return { ...fallback };
};

export const normalizePlanEntitlements = (
  rawEntitlements?: Partial<PlanEntitlements> | null
): PlanEntitlements => {
  const merged = { ...DEFAULT_PLAN_ENTITLEMENTS } as PlanEntitlements;

  PLAN_ORDER.forEach((planName) => {
    const rawPlan = rawEntitlements?.[planName];
    const mergedPlan = { ...DEFAULT_PLAN_ENTITLEMENTS[planName] } as PlanBenefitMatrix;

    if (rawPlan && typeof rawPlan === 'object') {
      PLAN_BENEFIT_DEFINITIONS.forEach((benefit) => {
        const rawValue = (rawPlan as Partial<Record<PlanBenefitKey, unknown>>)[benefit.key];
        mergedPlan[benefit.key] = normalizePlanBenefitAccess(rawValue, mergedPlan[benefit.key]);
      });
    }

    merged[planName] = mergedPlan;
  });

  return merged;
};

const normalizePlanUsageLimitValue = (
  rawValue: unknown,
  fallback: { mode: 'limited' | 'unlimited'; value: number | null }
) => {
  if (!rawValue || typeof rawValue !== 'object') {
    return { ...fallback };
  }

  const mode = (rawValue as { mode?: string }).mode === 'limited' ? 'limited' : 'unlimited';
  const value = mode === 'limited'
    ? Math.max(0, Number((rawValue as { value?: number | null }).value || 0))
    : null;

  return { mode, value } as { mode: 'limited' | 'unlimited'; value: number | null };
};

export const normalizePlanUsageLimits = (
  rawLimits?: Partial<PlanUsageLimits> | null
): PlanUsageLimits => {
  const merged = { ...DEFAULT_PLAN_USAGE_LIMITS } as PlanUsageLimits;

  PLAN_ORDER.forEach((planName) => {
    const rawPlan = rawLimits?.[planName];
    const mergedPlan = { ...DEFAULT_PLAN_USAGE_LIMITS[planName] } as PlanUsageLimitMatrix;

    if (rawPlan && typeof rawPlan === 'object') {
      PLAN_USAGE_LIMIT_DEFINITIONS.forEach((limitDefinition) => {
        const rawValue = (rawPlan as Partial<Record<PlanUsageLimitKey, unknown>>)[limitDefinition.key];
        mergedPlan[limitDefinition.key] = normalizePlanUsageLimitValue(rawValue, mergedPlan[limitDefinition.key]);
      });
    }

    merged[planName] = mergedPlan;
  });

  return merged;
};

export const getBenefitDefinition = (benefitKey: PlanBenefitKey): PlanBenefitDefinition =>
  PLAN_BENEFIT_DEFINITIONS.find((benefit) => benefit.key === benefitKey) || {
    key: benefitKey,
    label: benefitKey,
    description: '',
  };

export const getUsageLimitDefinition = (limitKey: PlanUsageLimitKey): PlanUsageLimitDefinition =>
  PLAN_USAGE_LIMIT_DEFINITIONS.find((definition) => definition.key === limitKey) || {
    key: limitKey,
    label: limitKey,
    description: '',
    inputLabel: limitKey,
  };

export const getEnabledBenefitKeysForPlan = (
  planName: keyof PlanEntitlements,
  entitlements?: Partial<PlanEntitlements> | null
): PlanBenefitKey[] => {
  const resolved = normalizePlanEntitlements(entitlements);

  return PLAN_BENEFIT_DEFINITIONS
    .filter((benefit) => resolved[planName][benefit.key].enabled)
    .map((benefit) => benefit.key);
};

export const getIncrementalBenefitKeysForPlan = (
  planName: keyof PlanEntitlements,
  entitlements?: Partial<PlanEntitlements> | null
): PlanBenefitKey[] => {
  const resolved = normalizePlanEntitlements(entitlements);
  const currentIndex = PLAN_ORDER.indexOf(planName);
  const previousPlan = currentIndex > 0 ? PLAN_ORDER[currentIndex - 1] : null;

  return PLAN_BENEFIT_DEFINITIONS
    .filter((benefit) => {
      const enabledInCurrent = resolved[planName][benefit.key].enabled;
      const enabledInPrevious = previousPlan ? resolved[previousPlan][benefit.key].enabled : false;
      return enabledInCurrent && !enabledInPrevious;
    })
    .map((benefit) => benefit.key);
};
