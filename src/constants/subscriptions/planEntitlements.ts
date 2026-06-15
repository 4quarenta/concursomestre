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
    label: 'Questoes por dia',
    description: 'Controla quantas questoes podem ser respondidas por dia dentro do plano.',
    inputLabel: 'questoes/dia',
  },
  {
    key: 'comments_per_day',
    label: 'Comentarios por dia',
    description: 'Define quantos comentarios o usuario pode publicar por dia.',
    inputLabel: 'comentarios/dia',
  },
  {
    key: 'simulations_per_week',
    label: 'Simulados por semana',
    description: 'Limite operacional semanal para criacao ou execucao de simulados.',
    inputLabel: 'simulados/semana',
  },
  {
    key: 'simulations_per_month',
    label: 'Simulados por mes',
    description: 'Limite mensal complementar para controlar recorrencia de simulados.',
    inputLabel: 'simulados/mes',
  },
  {
    key: 'saved_questions_limit',
    label: 'Questoes salvas',
    description: 'Define a capacidade maxima de questoes favoritas ou salvas no perfil.',
    inputLabel: 'itens',
  },
  {
    key: 'lei_related_questions_limit',
    label: 'Questoes da lei',
    description: 'Controla quantas questoes relacionadas podem ser abertas a partir da Lei Comentada.',
    inputLabel: 'questoes',
  },
  {
    key: 'lei_annotations_limit',
    label: 'Anotacoes na lei',
    description: 'Limita a quantidade de anotacoes salvas dentro da leitura da Lei Comentada.',
    inputLabel: 'anotacoes',
  },
  {
    key: 'lei_favorites_limit',
    label: 'Favoritos na lei',
    description: 'Limita quantas leis, secoes ou artigos podem ficar favoritados na Lei Comentada.',
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
    label: 'Modulo: dashboard premium',
    description: 'Controla acesso completo ao painel premium de desempenho e insights.',
  },
  {
    key: 'module.practice',
    label: 'Modulo: pratica',
    description: 'Controla acesso ao modulo principal de resolucao de questoes.',
  },
  {
    key: 'module.lei_comentada',
    label: 'Modulo: lei comentada',
    description: 'Controla acesso ao acervo de leis comentadas.',
  },
  {
    key: 'module.flashcards',
    label: 'Modulo: flashcards',
    description: 'Controla acesso ao modulo de flashcards.',
  },
  {
    key: 'module.simulations',
    label: 'Modulo: simulados',
    description: 'Controla acesso ao modulo de simulados, respeitando os limites configurados.',
  },
  {
    key: 'module.xray',
    label: 'Modulo: raio-X',
    description: 'Controla acesso completo ao raio-X de banca.',
  },
  {
    key: 'module.schedule',
    label: 'Modulo: cronograma',
    description: 'Controla acesso ao cronograma e trilhas de estudo.',
  },
  {
    key: 'module.marketplace',
    label: 'Modulo: marketplace',
    description: 'Controla acesso ao marketplace de materiais.',
  },
  {
    key: 'practice.filter_keyword',
    label: 'Filtro: palavra-chave',
    description: 'Libera busca textual no modulo de questoes.',
  },
  {
    key: 'practice.filter_subject',
    label: 'Filtro: materia',
    description: 'Libera filtro por materia/disciplina.',
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
    label: 'Filtro: orgao',
    description: 'Libera filtro por orgao/instituicao.',
  },
  {
    key: 'practice.filter_year',
    label: 'Filtro: ano',
    description: 'Libera filtro por ano da questao/prova.',
  },
  {
    key: 'practice.filter_level',
    label: 'Filtro: nivel',
    description: 'Libera filtro por nivel de escolaridade.',
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
    description: 'Libera filtro por topico/assunto.',
  },
  {
    key: 'practice.filter_saved',
    label: 'Filtro: questoes salvas',
    description: 'Libera recorte de questoes salvas pelo aluno.',
  },
  {
    key: 'practice.filter_teacher_comment',
    label: 'Filtro: comentario do professor',
    description: 'Libera filtro apenas com comentario do professor.',
  },
  {
    key: 'practice.filter_detailed_analysis',
    label: 'Filtro: analise detalhada',
    description: 'Libera filtro apenas com analise detalhada.',
  },
  {
    key: 'practice.filter_answered_correct',
    label: 'Filtro: acertei',
    description: 'Libera filtro de questoes que o aluno acertou.',
  },
  {
    key: 'practice.filter_answered_wrong',
    label: 'Filtro: errei',
    description: 'Libera filtro de questoes que o aluno errou.',
  },
  {
    key: 'question.resolve',
    label: 'Card: resolver questao',
    description: 'Permite responder questoes no card.',
  },
  {
    key: 'question.answer_key',
    label: 'Card: ver gabarito',
    description: 'Permite visualizar gabarito e resultado.',
  },
  {
    key: 'question.basic_explanation',
    label: 'Card: comentario do professor',
    description: 'Permite visualizar o comentario do professor quando disponivel.',
  },
  {
    key: 'question.detailed_analysis',
    label: 'Card: analise detalhada',
    description: 'Permite abrir a analise detalhada dentro do card da questao.',
  },
  {
    key: 'question.save',
    label: 'Card: salvar questao',
    description: 'Permite salvar/favoritar questoes.',
    limitKey: 'saved_questions_limit',
  },
  {
    key: 'question.notes',
    label: 'Card: anotacoes',
    description: 'Permite criar anotacoes pessoais na questao.',
  },
  {
    key: 'question.share',
    label: 'Card: compartilhar',
    description: 'Permite compartilhar questoes.',
  },
  {
    key: 'question.full_statistics',
    label: 'Card: estatisticas completas',
    description: 'Libera estatisticas completas da questao.',
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
    label: 'Ads: entre questoes',
    description: 'Permite inserir anuncios entre cards de questoes.',
  },
  {
    key: 'ads.in_comments',
    label: 'Ads: em comentarios',
    description: 'Permite inserir publicidade na area de comentarios.',
  },
  {
    key: 'ads.web_interstitial',
    label: 'Ads: interstitial web',
    description: 'Permite exibir anuncio interstitial GPT apos acoes do usuario, como responder questoes.',
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
    description: 'Aplica uma experiencia com menos anuncios, sem interrupcoes laterais/entre questoes.',
  },
  {
    key: 'unlimited_questions',
    label: 'Questoes liberadas',
    description: 'Libera o modulo de questoes e usa o limite diario configurado abaixo para controlar o volume.',
    limitKey: 'questions_per_day',
  },
  {
    key: 'basic_statistics',
    label: 'Estatisticas basicas',
    description: 'Permite ver desempenho e historico essencial de resolucao.',
  },
  {
    key: 'community_comments',
    label: 'Comentarios da comunidade',
    description: 'Libera leitura e participacao nos comentarios dos alunos.',
    limitKey: 'comments_per_day',
  },
  {
    key: 'no_ads',
    label: 'Sem anuncios',
    description: 'Oculta banners e blocos de publicidade durante o estudo.',
  },
  {
    key: 'teacher_comments',
    label: 'Comentario do professor',
    description: 'Libera o gabarito comentado assinado por professor.',
  },
  {
    key: 'detailed_analysis',
    label: 'Analise detalhada',
    description: 'Libera analises premium mais profundas por questao.',
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
    description: 'Libera a inteligencia de banca com analises e recomendacoes.',
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
    label: 'Lei comentada: comentario do professor',
    description: 'Libera o comentario editorial do professor dentro do artigo.',
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
    label: 'Lei comentada: anotacoes',
    description: 'Libera o card de anotacoes pessoais dentro do artigo.',
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
    description: 'Permite favoritar leis, secoes e artigos da Lei Comentada.',
    limitKey: 'lei_favorites_limit',
  },
  {
    key: 'lei.solicitar_comentario',
    label: 'Lei comentada: solicitar comentario',
    description: 'Permite solicitar comentario do professor para artigo, inciso, paragrafo ou alinea.',
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
    'question.basic_explanation',
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
    'question.basic_explanation',
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
    'question.basic_explanation',
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
  'question.basic_explanation',
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
  'module.practice': 'Pratica de questoes',
  'question.resolve': 'Resolver questoes',
  'question.basic_explanation': 'Comentario do professor',
  'question.detailed_analysis': 'Analise detalhada',
  'question.full_statistics': 'Estatisticas completas',
  'question.save': 'Salvar questoes',
  'module.lei_comentada': 'Lei comentada',
  'lei.comentario_basico': 'Comentarios na lei',
  'lei.doutrina': 'Doutrina na lei comentada',
  'lei.macete': 'Macetes na lei comentada',
  'lei.jurisprudencia': 'Jurisprudencia e sumulas',
  'lei.sumulas': 'Sumulas relacionadas',
  'lei.questoes': 'Questoes da lei comentada',
  'lei.modo_foco': 'Modo foco na lei',
  'lei.favoritos': 'Favoritar leis e secoes',
  'module.simulations': 'Simulados',
  'exclusive_simulations': 'Simulados exclusivos',
  'module.xray': 'Raio-X da banca',
  'module.dashboard': 'Dashboard premium',
  no_ads: 'Sem anuncios',
  mentor_chat: 'Chat mentor',
  priority_support: 'Suporte prioritario',
  early_access: 'Acesso antecipado',
};

export const getPublicPlanFeaturesForPlan = (
  planName: PlanName,
  entitlements?: Partial<PlanEntitlements> | null,
  maxItems = 10,
): PlanFeature[] => {
  const resolved = normalizePlanEntitlements(entitlements);
  const planBenefits = resolved[planName];
  const enabledFeatures = PUBLIC_PLAN_FEATURE_BENEFIT_KEYS
    .filter((key) => planBenefits[key]?.enabled)
    .map((key) => ({
      text: PUBLIC_PLAN_FEATURE_LABELS[key] || getBenefitDefinition(key).label,
      included: true,
    }));
  const disabledFeatures = PUBLIC_PLAN_FEATURE_BENEFIT_KEYS
    .filter((key) => !planBenefits[key]?.enabled)
    .map((key) => ({
      text: PUBLIC_PLAN_FEATURE_LABELS[key] || getBenefitDefinition(key).label,
      included: false,
    }));

  return [...enabledFeatures, ...disabledFeatures].slice(0, maxItems);
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
