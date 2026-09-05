export type MarketingCampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended' | 'archived';

export type MarketingCampaignObjective =
  | 'CRIAR_CONTA'
  | 'INICIAR_TESTE'
  | 'ESCOLHER_PLANO'
  | 'ASSINAR_PRO'
  | 'ASSINAR_ELITE'
  | 'FAZER_SIMULADO'
  | 'RESPONDER_QUESTOES'
  | 'REATIVAR_USUARIO'
  | 'UPGRADE_PLANO';

export type MarketingConversionEvent =
  | 'signup_completed'
  | 'plan_selected'
  | 'subscription_activated'
  | 'checkout_started';

export type MarketingGovernancePolicy = {
  frequencyCap?: { count: number; window: 'session' | 'day' | 'week' | 'ever' };
  cooldownHours?: number;
  maxImpressions?: number;
  mutualExclusionGroup?: string;
  suppressAfterConversion?: boolean;
};

export type MarketingEligibilityContext = {
  now?: Date;
  impressions?: number;
  lastInteractionAt?: Date | null;
  converted?: boolean;
  competingCampaignActive?: boolean;
  audienceEligible?: boolean;
};

export type MarketingCampaignWindow = {
  status: MarketingCampaignStatus;
  startsAt?: string | null;
  endsAt?: string | null;
};

const objectiveEvents: Record<MarketingCampaignObjective, MarketingConversionEvent> = {
  CRIAR_CONTA: 'signup_completed',
  INICIAR_TESTE: 'signup_completed',
  ESCOLHER_PLANO: 'plan_selected',
  ASSINAR_PRO: 'subscription_activated',
  ASSINAR_ELITE: 'subscription_activated',
  FAZER_SIMULADO: 'checkout_started',
  RESPONDER_QUESTOES: 'checkout_started',
  REATIVAR_USUARIO: 'subscription_activated',
  UPGRADE_PLANO: 'subscription_activated',
};

const toTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const resolveCampaignConversionEvent = (objective: MarketingCampaignObjective): MarketingConversionEvent => (
  objectiveEvents[objective]
);

export const isCampaignWithinWindow = (
  campaign: MarketingCampaignWindow,
  now = new Date(),
): boolean => {
  if (!['scheduled', 'active'].includes(campaign.status)) return false;

  const timestamp = now.getTime();
  const startsAt = toTimestamp(campaign.startsAt);
  const endsAt = toTimestamp(campaign.endsAt);

  return (startsAt === null || timestamp >= startsAt) && (endsAt === null || timestamp < endsAt);
};

export const isCampaignEligible = (
  campaign: MarketingCampaignWindow,
  governance: MarketingGovernancePolicy = {},
  context: MarketingEligibilityContext = {},
): boolean => {
  if (!isCampaignWithinWindow(campaign, context.now)) return false;
  if (context.audienceEligible === false) return false;
  if (governance.suppressAfterConversion !== false && context.converted === true) return false;
  if (governance.frequencyCap && (context.impressions || 0) >= Math.max(0, governance.frequencyCap.count)) return false;
  if (governance.maxImpressions !== undefined && (context.impressions || 0) >= Math.max(0, governance.maxImpressions)) return false;
  if (context.competingCampaignActive === true && governance.mutualExclusionGroup) return false;

  const cooldownHours = Math.max(0, governance.cooldownHours || 0);
  if (cooldownHours > 0 && context.lastInteractionAt) {
    const nowTimestamp = (context.now || new Date()).getTime();
    const elapsedHours = (nowTimestamp - context.lastInteractionAt.getTime()) / (1000 * 60 * 60);
    if (elapsedHours < cooldownHours) return false;
  }

  return true;
};

export const getCountdownRemainingMs = (endsAt: string | null | undefined, now = new Date()): number => {
  const deadline = toTimestamp(endsAt);
  if (deadline === null) return 0;
  return Math.max(0, deadline - now.getTime());
};
