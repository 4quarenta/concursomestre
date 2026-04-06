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
  PlanBenefitDefinition,
  PlanBenefitKey,
  PlanBenefitMatrix,
  PlanEntitlements,
} from '../../../../types';

export const PLAN_ORDER = ['Gratuito', 'Essencial', 'Pro', 'Elite'] as const;

export const PLAN_BENEFIT_DEFINITIONS: PlanBenefitDefinition[] = [
  {
    key: 'unlimited_questions',
    label: 'Questões ilimitadas',
    description: 'Remove o limite diario e libera a resolucao continua de questões.',
  },
  {
    key: 'basic_statistics',
    label: 'Estatisticas basicas',
    description: 'Permite ver desempenho e histórico essencial de resolucao.',
  },
  {
    key: 'community_comments',
    label: 'Comentários da comunidade',
    description: 'Libera leitura e participacao nos comentários dos alunos.',
  },
  {
    key: 'no_ads',
    label: 'Sem anuncios',
    description: 'Oculta banners e blocos de publicidade durante o estudo.',
  },
  {
    key: 'teacher_comments',
    label: 'Comentário do professor',
    description: 'Libera o gabarito comentado assinado por professor.',
  },
  {
    key: 'detailed_analysis',
    label: 'Análise detalhada',
    description: 'Libera analises premium mais profundas por questão.',
  },
  {
    key: 'ai_explanations',
    label: 'Explicacoes por IA',
    description: 'Libera explicacoes e assistencia com IA nas trilhas de estudo.',
  },
  {
    key: 'error_notebook',
    label: 'Caderno de erros',
    description: 'Libera recursos avancados para revisar erros e recorrencias.',
  },
  {
    key: 'exclusive_simulations',
    label: 'Simulados exclusivos',
    description: 'Libera simulados premium e trilhas especiais.',
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
    acc[benefit.key] = enabledSet.has(benefit.key);
    return acc;
  }, {} as PlanBenefitMatrix);
};

export const DEFAULT_PLAN_ENTITLEMENTS: PlanEntitlements = {
  Gratuito: createBenefitMatrix([
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

export const normalizePlanEntitlements = (
  rawEntitlements?: Partial<PlanEntitlements> | null
): PlanEntitlements => {
  const merged = { ...DEFAULT_PLAN_ENTITLEMENTS } as PlanEntitlements;

  PLAN_ORDER.forEach((planName) => {
    const rawPlan = rawEntitlements?.[planName];
    const mergedPlan = { ...DEFAULT_PLAN_ENTITLEMENTS[planName] } as PlanBenefitMatrix;

    if (rawPlan && typeof rawPlan === 'object') {
      PLAN_BENEFIT_DEFINITIONS.forEach((benefit) => {
        const rawValue = (rawPlan as Partial<PlanBenefitMatrix>)[benefit.key];
        if (typeof rawValue === 'boolean') {
          mergedPlan[benefit.key] = rawValue;
        }
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

export const getEnabledBenefitKeysForPlan = (
  planName: keyof PlanEntitlements,
  entitlements?: Partial<PlanEntitlements> | null
): PlanBenefitKey[] => {
  const resolved = normalizePlanEntitlements(entitlements);

  return PLAN_BENEFIT_DEFINITIONS
    .filter((benefit) => resolved[planName][benefit.key])
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
      const enabledInCurrent = resolved[planName][benefit.key];
      const enabledInPrevious = previousPlan ? resolved[previousPlan][benefit.key] : false;
      return enabledInCurrent && !enabledInPrevious;
    })
    .map((benefit) => benefit.key);
};
