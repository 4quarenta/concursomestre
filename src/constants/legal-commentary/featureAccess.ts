import type {
  LegalCommentaryFeatureConfig,
  LegalCommentaryFeatureConfigurableKey,
  LegalCommentaryFeatureFallbackMode,
  LegalCommentaryFeatureKey,
  PlanUsageLimitKey,
} from '@types';

export type LegalCommentaryFeatureDefinition = {
  key: LegalCommentaryFeatureKey;
  label: string;
  description: string;
  defaultFallbackMode?: LegalCommentaryFeatureFallbackMode;
  limitKey?: PlanUsageLimitKey;
};

export const LEGAL_COMMENTARY_FEATURE_DEFINITIONS: LegalCommentaryFeatureDefinition[] = [
  {
    key: 'lei.texto',
    label: 'Texto da lei',
    description: 'Leitura integral do artigo. Sempre liberado para todos os planos.',
  },
  {
    key: 'lei.comentario_basico',
    label: 'Comentário do professor',
    description: 'Comentário editorial do professor dentro do artigo.',
    defaultFallbackMode: 'preview',
  },
  {
    key: 'lei.doutrina',
    label: 'Doutrina',
    description: 'Entendimentos doutrinários vinculados ao item da lei.',
    defaultFallbackMode: 'preview',
  },
  {
    key: 'lei.macete',
    label: 'Macete',
    description: 'Atalho de memorização e associação rápida para prova.',
    defaultFallbackMode: 'preview',
  },
  {
    key: 'lei.como_cai',
    label: 'Como cai em prova',
    description: 'Padrão de cobrança, pegadinhas e foco de banca.',
    defaultFallbackMode: 'preview',
  },
  {
    key: 'lei.jurisprudencia',
    label: 'Jurisprudência',
    description: 'Recorte curto com a leitura jurisprudencial mais relevante para prova.',
    defaultFallbackMode: 'preview',
  },
  {
    key: 'lei.sumulas',
    label: 'Súmulas',
    description: 'Súmulas e enunciados relacionados ao artigo.',
    defaultFallbackMode: 'preview',
  },
  {
    key: 'lei.questoes',
    label: 'Questões relacionadas',
    description: 'Acesso ao bloco de prática com questões conectadas ao artigo.',
    defaultFallbackMode: 'preview',
    limitKey: 'lei_related_questions_limit',
  },
  {
    key: 'lei.raiox',
    label: 'Raio-X do artigo',
    description: 'Importância, eixo temático e conexões estratégicas do artigo.',
    defaultFallbackMode: 'locked',
  },
  {
    key: 'lei.anotacoes',
    label: 'Anotações',
    description: 'Card lateral para registrar observações pessoais no estudo do artigo.',
    defaultFallbackMode: 'locked',
    limitKey: 'lei_annotations_limit',
  },
  {
    key: 'lei.modo_foco',
    label: 'Modo foco',
    description: 'Leitura com menos distrações dentro da Lei Comentada.',
    defaultFallbackMode: 'locked',
  },
  {
    key: 'lei.favoritos',
    label: 'Favoritos',
    description: 'Permite salvar leis, seções e artigos da Lei Comentada.',
    defaultFallbackMode: 'locked',
    limitKey: 'lei_favorites_limit',
  },
  {
    key: 'lei.solicitar_comentario',
    label: 'Solicitar comentário',
    description: 'Permite pedir comentário do professor para um item específico da lei.',
    defaultFallbackMode: 'locked',
  },
];

export const LEGAL_COMMENTARY_FEATURE_MODE_OPTIONS: Array<{
  value: LegalCommentaryFeatureFallbackMode;
  label: string;
  description: string;
}> = [
  {
    value: 'preview',
    label: 'Preview',
    description: 'Mostra teaser parcial com CTA de desbloqueio.',
  },
  {
    value: 'locked',
    label: 'Bloqueado',
    description: 'Mostra somente o card bloqueado, sem trecho do conteúdo.',
  },
  {
    value: 'hidden',
    label: 'Oculto',
    description: 'Não renderiza o bloco quando o usuário não tem acesso.',
  },
];

export const LEGAL_COMMENTARY_CONFIGURABLE_FEATURE_KEYS =
  LEGAL_COMMENTARY_FEATURE_DEFINITIONS
    .filter((feature): feature is LegalCommentaryFeatureDefinition & { key: LegalCommentaryFeatureConfigurableKey } => feature.key !== 'lei.texto')
    .map((feature) => feature.key);

export const DEFAULT_LEGAL_COMMENTARY_FEATURE_CONFIG: LegalCommentaryFeatureConfig =
  LEGAL_COMMENTARY_CONFIGURABLE_FEATURE_KEYS.reduce((acc, key) => {
    const definition = LEGAL_COMMENTARY_FEATURE_DEFINITIONS.find((feature) => feature.key === key);
    acc[key] = {
      fallbackMode: definition?.defaultFallbackMode || 'locked',
    };
    return acc;
  }, {} as LegalCommentaryFeatureConfig);

export const normalizeLegalCommentaryFeatureConfig = (
  rawConfig?: Partial<LegalCommentaryFeatureConfig> | null,
): LegalCommentaryFeatureConfig => {
  const normalized = { ...DEFAULT_LEGAL_COMMENTARY_FEATURE_CONFIG } as LegalCommentaryFeatureConfig;

  LEGAL_COMMENTARY_CONFIGURABLE_FEATURE_KEYS.forEach((featureKey) => {
    const incoming = rawConfig?.[featureKey];
    const fallbackMode = incoming?.fallbackMode;

    if (fallbackMode === 'preview' || fallbackMode === 'locked' || fallbackMode === 'hidden') {
      normalized[featureKey] = { fallbackMode };
    }
  });

  return normalized;
};

export const getLegalCommentaryFeatureDefinition = (featureKey: LegalCommentaryFeatureKey) => (
  LEGAL_COMMENTARY_FEATURE_DEFINITIONS.find((feature) => feature.key === featureKey)
);
