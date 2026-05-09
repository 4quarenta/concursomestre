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
    label: 'Comentario basico',
    description: 'Leitura guiada curta, mantendo valor real para quem ainda estuda no gratuito.',
    defaultFallbackMode: 'hidden',
  },
  {
    key: 'lei.macete',
    label: 'Macete',
    description: 'Atalho de memorizacao e associacao rapida para prova.',
    defaultFallbackMode: 'preview',
  },
  {
    key: 'lei.como_cai',
    label: 'Como cai em prova',
    description: 'Padrao de cobranca, pegadinhas e foco de banca.',
    defaultFallbackMode: 'preview',
  },
  {
    key: 'lei.jurisprudencia',
    label: 'Jurisprudencia',
    description: 'Recorte curto com a leitura jurisprudencial mais relevante para prova.',
    defaultFallbackMode: 'preview',
  },
  {
    key: 'lei.frequencia',
    label: 'Frequencia de cobranca',
    description: 'Intensidade de cobranca do artigo em prova, com barra e classificacao.',
    defaultFallbackMode: 'locked',
  },
  {
    key: 'lei.questoes',
    label: 'Questoes relacionadas',
    description: 'Acesso ao bloco de pratica com questoes conectadas ao artigo.',
    defaultFallbackMode: 'preview',
    limitKey: 'lei_related_questions_limit',
  },
  {
    key: 'lei.flashcards',
    label: 'Flashcards',
    description: 'Cartoes automaticos para memorizar o artigo com revisao rapida.',
    defaultFallbackMode: 'preview',
    limitKey: 'lei_flashcards_limit',
  },
  {
    key: 'lei.raiox',
    label: 'Raio-X do artigo',
    description: 'Importancia, eixo tematico e conexoes estrategicas do artigo.',
    defaultFallbackMode: 'locked',
  },
  {
    key: 'lei.anotacoes',
    label: 'Anotacoes',
    description: 'Card lateral para registrar observacoes pessoais no estudo do artigo.',
    defaultFallbackMode: 'locked',
    limitKey: 'lei_annotations_limit',
  },
  {
    key: 'lei.conexoes',
    label: 'Conexoes',
    description: 'Liga o artigo a temas, leis e caminhos de revisao relacionados.',
    defaultFallbackMode: 'preview',
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
    description: 'Mostra somente o card bloqueado, sem trecho do conteudo.',
  },
  {
    value: 'hidden',
    label: 'Oculto',
    description: 'Nao renderiza o bloco quando o usuario nao tem acesso.',
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
