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
  BookOpen,
  BrainCircuit,
  Filter,
  Instagram,
  Linkedin,
  MessageCircle,
  MessageSquare,
  Building2,
  Landmark as LandmarkIcon,
  Scale,
  Shield,
  Send,
  ShoppingBag,
  Trophy,
  Youtube,
  Zap,
} from 'lucide-react';
import type {
  LandingFeatureCard,
  LandingFeatureIconKey,
  LandingFeaturedOrganizationIconKey,
  LandingFeaturedOrganizationStatus,
  LandingFeaturedOrganization,
  LandingPageContent,
  LandingSocialIconKey,
  LandingSocialLink,
} from '@types';

type LucideIconComponent = typeof Trophy;

interface IconOption<TKey extends string> {
  key: TKey;
  label: string;
  icon: LucideIconComponent;
}

const normalizeLegacyLabel = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

let draftIdSequence = 0;

const buildId = (prefix: string) => {
  draftIdSequence += 1;
  return `${prefix}-draft-${draftIdSequence}`;
};

export const LANDING_FEATURE_ICON_OPTIONS: Array<IconOption<LandingFeatureIconKey>> = [
  { key: 'ranking', label: 'Ranking', icon: Trophy },
  { key: 'materials', label: 'Materiais', icon: ShoppingBag },
  { key: 'teacher-comments', label: 'Comentarios', icon: MessageSquare },
  { key: 'filters', label: 'Filtros', icon: Filter },
  { key: 'xray', label: 'Raio-X', icon: Zap },
  { key: 'community', label: 'Comunidade', icon: MessageCircle },
  { key: 'simulations', label: 'Simulados', icon: BrainCircuit },
  { key: 'performance', label: 'Desempenho', icon: BookOpen },
];

export const LANDING_SOCIAL_ICON_OPTIONS: Array<IconOption<LandingSocialIconKey>> = [
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'youtube', label: 'YouTube', icon: Youtube },
  { key: 'telegram', label: 'Telegram', icon: Send },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
];

export const landingFeatureIconMap = LANDING_FEATURE_ICON_OPTIONS.reduce<Record<LandingFeatureIconKey, LucideIconComponent>>(
  (accumulator, option) => {
    accumulator[option.key] = option.icon;
    return accumulator;
  },
  {} as Record<LandingFeatureIconKey, LucideIconComponent>,
);

export const landingSocialIconMap = LANDING_SOCIAL_ICON_OPTIONS.reduce<Record<LandingSocialIconKey, LucideIconComponent>>(
  (accumulator, option) => {
    accumulator[option.key] = option.icon;
    return accumulator;
  },
  {} as Record<LandingSocialIconKey, LucideIconComponent>,
);

export const LANDING_FEATURED_ORGANIZATION_STATUS_OPTIONS: Array<{ key: LandingFeaturedOrganizationStatus; label: string }> = [
  { key: 'FEATURED', label: 'Em destaque' },
  { key: 'OPEN_NOTICE', label: 'Edital publicado' },
  { key: 'COMING_SOON', label: 'Em breve' },
  { key: 'LONG_TERM', label: 'Planejamento' },
];

export const LANDING_FEATURED_ORGANIZATION_ICON_OPTIONS: Array<{ key: LandingFeaturedOrganizationIconKey; label: string; icon: LucideIconComponent }> = [
  { key: 'building', label: 'Instituição', icon: Building2 },
  { key: 'landmark', label: 'Órgão público', icon: LandmarkIcon },
  { key: 'shield', label: 'Segurança', icon: Shield },
  { key: 'scale', label: 'Justiça', icon: Scale },
];

export const landingFeaturedOrganizationIconMap = LANDING_FEATURED_ORGANIZATION_ICON_OPTIONS.reduce<Record<LandingFeaturedOrganizationIconKey, LucideIconComponent>>(
  (accumulator, option) => {
    accumulator[option.key] = option.icon;
    return accumulator;
  },
  {} as Record<LandingFeaturedOrganizationIconKey, LucideIconComponent>,
);

export const createLandingFeatureCard = (): LandingFeatureCard => ({
  id: buildId('feature'),
  title: 'Novo diferencial',
  description: 'Explique em uma frase curta por que esse recurso ajuda o aluno a estudar com mais clareza e chegar mais preparado na prova.',
  iconKey: 'performance',
  enabled: true,
  order: 999,
});

export const createLandingSocialLink = (): LandingSocialLink => ({
  id: buildId('social'),
  label: 'Instagram',
  handle: '@concursomestre',
  url: '',
  iconKey: 'instagram',
  enabled: false,
});

export const createDefaultLandingPageContent = (): LandingPageContent => ({
  featureCards: [
    {
      id: 'banco-de-questoes',
      title: 'Encontre exatamente o que vale a pena estudar',
      description: 'Pratique por banca, assunto, ano e objetivo para atacar o que mais impacta seu resultado.',
      iconKey: 'filters',
      enabled: true,
      order: 10,
    },
    {
      id: 'simulados-com-metrica',
      title: 'Saiba como voce chega para a prova',
      description: 'Use simulados para medir nivel, ritmo e consistencia antes do dia decisivo.',
      iconKey: 'simulations',
      enabled: true,
      order: 20,
    },
    {
      id: 'revisao-com-contexto',
      title: 'Milhares de questoes de concurso',
      description: 'Tenha volume real para treinar todos os dias com questoes organizadas por banca, assunto, ano e objetivo.',
      iconKey: 'teacher-comments',
      enabled: true,
      order: 30,
    },
    {
      id: 'desempenho-com-direcao',
      title: 'Veja onde voce esta perdendo ponto',
      description: 'Entenda sua evolucao por materia e identifique rapido o que precisa de reforco antes da prova.',
      iconKey: 'performance',
      enabled: true,
      order: 40,
    },
    {
      id: 'ranking-comparativo',
      title: 'Compare seu nivel com mais clareza',
      description: 'Veja como seu desempenho se compara ao de outros candidatos e entenda melhor seu momento.',
      iconKey: 'ranking',
      enabled: true,
      order: 50,
    },
    {
      id: 'rotina-integrada',
      title: 'Tudo no mesmo fluxo de estudo',
      description: 'Ganhe tempo com uma rotina integrada, sem depender de varias ferramentas separadas para estudar.',
      iconKey: 'materials',
      enabled: true,
      order: 60,
    },
  ],
  socialLinks: [
    {
      id: 'instagram',
      label: 'Instagram',
      handle: '@concursomestre',
      url: '',
      iconKey: 'instagram',
      enabled: false,
    },
    {
      id: 'youtube',
      label: 'YouTube',
      handle: 'Canal oficial',
      url: '',
      iconKey: 'youtube',
      enabled: false,
    },
    {
      id: 'telegram',
      label: 'Telegram',
      handle: 'Comunidade oficial',
      url: '',
      iconKey: 'telegram',
      enabled: false,
    },
  ],
  featuredOrganizations: [],
});

const normalizeFeatureCard = (feature: Partial<LandingFeatureCard>, index: number): LandingFeatureCard => {
  const fallback = createDefaultLandingPageContent().featureCards[index] || createLandingFeatureCard();
  const incomingTitle = typeof feature.title === 'string' && feature.title.trim() ? feature.title.trim() : fallback.title;
  const isLegacyDetailedComments = normalizeLegacyLabel(incomingTitle) === 'comentarios detalhados';
  const iconKey = LANDING_FEATURE_ICON_OPTIONS.some((option) => option.key === feature.iconKey)
    ? (feature.iconKey as LandingFeatureIconKey)
    : fallback.iconKey;
  const order = typeof feature.order === 'number' && Number.isFinite(feature.order)
    ? feature.order
    : (fallback.order ?? ((index + 1) * 10));

  return {
    id: typeof feature.id === 'string' && feature.id.trim() ? feature.id.trim() : fallback.id,
    title: isLegacyDetailedComments ? 'Milhares de questoes de concurso' : incomingTitle,
    description: isLegacyDetailedComments
      ? 'Tenha volume real para treinar todos os dias com questoes organizadas por banca, assunto, ano e objetivo.'
      : (typeof feature.description === 'string' && feature.description.trim() ? feature.description.trim() : fallback.description),
    iconKey,
    enabled: typeof feature.enabled === 'boolean' ? feature.enabled : (fallback.enabled ?? true),
    order,
  };
};

const normalizeSocialLink = (link: Partial<LandingSocialLink>, index: number): LandingSocialLink => {
  const fallback = createDefaultLandingPageContent().socialLinks[index] || createLandingSocialLink();
  const iconKey = LANDING_SOCIAL_ICON_OPTIONS.some((option) => option.key === link.iconKey)
    ? (link.iconKey as LandingSocialIconKey)
    : fallback.iconKey;

  return {
    id: typeof link.id === 'string' && link.id.trim() ? link.id.trim() : fallback.id,
    label: typeof link.label === 'string' && link.label.trim() ? link.label.trim() : fallback.label,
    handle: typeof link.handle === 'string' ? link.handle.trim() : fallback.handle,
    url: typeof link.url === 'string' ? link.url.trim() : fallback.url,
    iconKey,
    enabled: typeof link.enabled === 'boolean' ? link.enabled : fallback.enabled,
  };
};

const normalizeFeaturedOrganization = (
  item: Partial<LandingFeaturedOrganization>,
  index: number,
): LandingFeaturedOrganization | null => {
  const filterId = Number(item.filterId);
  if (!Number.isInteger(filterId) || filterId <= 0) return null;
  const status = LANDING_FEATURED_ORGANIZATION_STATUS_OPTIONS.some((option) => option.key === item.status)
    ? item.status as LandingFeaturedOrganizationStatus
    : 'FEATURED';
  const iconKey = LANDING_FEATURED_ORGANIZATION_ICON_OPTIONS.some((option) => option.key === item.iconKey)
    ? item.iconKey as LandingFeaturedOrganizationIconKey
    : 'building';
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `orgao-${filterId}-${index}`,
    filterId,
    status,
    iconKey,
    enabled: item.enabled !== false,
    order: typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : (index + 1) * 10,
  };
};

export const mergeLandingPageContent = (
  incoming?: Partial<LandingPageContent> | null,
): LandingPageContent => {
  const defaults = createDefaultLandingPageContent();
  const featureSource = Array.isArray(incoming?.featureCards) && incoming.featureCards.length > 0
    ? incoming.featureCards
    : defaults.featureCards;
  const socialSource = Array.isArray(incoming?.socialLinks) && incoming.socialLinks.length > 0
    ? incoming.socialLinks
    : defaults.socialLinks;
  const organizationSource = Array.isArray(incoming?.featuredOrganizations)
    ? incoming.featuredOrganizations
    : defaults.featuredOrganizations;

  return {
    featureCards: featureSource
      .map((feature, index) => normalizeFeatureCard(feature, index))
      .sort((left, right) => {
        const leftOrder = left.order ?? 0;
        const rightOrder = right.order ?? 0;
        if (leftOrder === rightOrder) {
          return left.title.localeCompare(right.title, 'pt-BR');
        }
        return leftOrder - rightOrder;
      }),
    socialLinks: socialSource.map((social, index) => normalizeSocialLink(social, index)),
    featuredOrganizations: Array.from(new Map(organizationSource
      .map((item, index) => normalizeFeaturedOrganization(item, index))
      .filter((item): item is LandingFeaturedOrganization => item !== null)
      .map((item) => [item.filterId, item] as const)).values())
      .sort((left, right) => left.order - right.order || left.filterId - right.filterId)
      .slice(0, 6),
  };
};
