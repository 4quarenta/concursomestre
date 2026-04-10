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
    key: 'ai_explanations_per_day',
    label: 'Explicacoes IA por dia',
    description: 'Controla quantas explicacoes por IA podem ser geradas diariamente.',
    inputLabel: 'usos/dia',
  },
  {
    key: 'saved_questions_limit',
    label: 'Questoes salvas',
    description: 'Define a capacidade maxima de questoes favoritas ou salvas no perfil.',
    inputLabel: 'itens',
  },
];

export const PLAN_BENEFIT_DEFINITIONS: PlanBenefitDefinition[] = [
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
    key: 'ai_explanations',
    label: 'Explicacoes por IA',
    description: 'Libera explicacoes e assistencia com IA nas trilhas de estudo.',
    limitKey: 'ai_explanations_per_day',
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
    'unlimited_questions',
    'basic_statistics',
    'community_comments',
  ]),
  Essencial: createBenefitMatrix([
    'unlimited_questions',
    'basic_statistics',
    'community_comments',
    'no_ads',
  ]),
  Pro: createBenefitMatrix([
    'unlimited_questions',
    'basic_statistics',
    'community_comments',
    'no_ads',
    'teacher_comments',
    'ai_explanations',
    'error_notebook',
    'exclusive_simulations',
  ]),
  Elite: createBenefitMatrix([
    'unlimited_questions',
    'basic_statistics',
    'community_comments',
    'no_ads',
    'teacher_comments',
    'detailed_analysis',
    'ai_explanations',
    'error_notebook',
    'exclusive_simulations',
    'xray_banca',
    'mentor_chat',
    'priority_support',
    'early_access',
  ]),
};

export const DEFAULT_PLAN_USAGE_LIMITS: PlanUsageLimits = {
  Gratuito: createUsageLimitMatrix({
    questions_per_day: limited(15),
    comments_per_day: limited(3),
    simulations_per_week: limited(0),
    simulations_per_month: limited(0),
    ai_explanations_per_day: limited(0),
    saved_questions_limit: limited(50),
  }),
  Essencial: createUsageLimitMatrix({
    questions_per_day: unlimited(),
    comments_per_day: limited(10),
    simulations_per_week: limited(0),
    simulations_per_month: limited(0),
    ai_explanations_per_day: limited(0),
    saved_questions_limit: limited(200),
  }),
  Pro: createUsageLimitMatrix({
    questions_per_day: unlimited(),
    comments_per_day: unlimited(),
    simulations_per_week: limited(5),
    simulations_per_month: limited(20),
    ai_explanations_per_day: limited(25),
    saved_questions_limit: limited(1000),
  }),
  Elite: createUsageLimitMatrix({
    questions_per_day: unlimited(),
    comments_per_day: unlimited(),
    simulations_per_week: unlimited(),
    simulations_per_month: unlimited(),
    ai_explanations_per_day: unlimited(),
    saved_questions_limit: unlimited(),
  }),
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
