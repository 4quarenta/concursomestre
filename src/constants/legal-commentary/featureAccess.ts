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
    label: 'Comentario do professor',
    description: 'Comentario editorial do professor dentro do artigo.',
    defaultFallbackMode: 'preview',
  },
  {
    key: 'lei.doutrina',
    label: 'Doutrina',
    description: 'Entendimentos doutrinarios vinculados ao item da lei.',
    defaultFallbackMode: 'preview',
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
    key: 'lei.sumulas',
    label: 'Sumulas',
    description: 'Sumulas e enunciados relacionados ao artigo.',
    defaultFallbackMode: 'preview',
  },
  {
    key: 'lei.questoes',
    label: 'Questoes relacionadas',
    description: 'Acesso ao bloco de pratica com questoes conectadas ao artigo.',
    defaultFallbackMode: 'preview',
    limitKey: 'lei_related_questions_limit',
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
    key: 'lei.modo_foco',
    label: 'Modo foco',
    description: 'Leitura com menos distracoes dentro da Lei Comentada.',
    defaultFallbackMode: 'locked',
  },
  {
    key: 'lei.favoritos',
    label: 'Favoritos',
    description: 'Permite salvar leis, secoes e artigos da Lei Comentada.',
    defaultFallbackMode: 'locked',
    limitKey: 'lei_favorites_limit',
  },
  {
    key: 'lei.solicitar_comentario',
    label: 'Solicitar comentario',
    description: 'Permite pedir comentario do professor para um item especifico da lei.',
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
