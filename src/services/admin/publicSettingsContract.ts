import type { SystemSettings } from '@types';

type PublicSettingsSection = Record<string, unknown>;

export interface PublicSystemSettingsContract {
  contractVersion: 'public-settings.v1';
  branding?: PublicSettingsSection;
  features?: Partial<SystemSettings['features']>;
  plans?: PublicSettingsSection;
  commerce?: PublicSettingsSection;
  marketing?: PublicSettingsSection;
  advertising?: PublicSettingsSection;
  authentication?: {
    recaptcha?: PublicSettingsSection;
    google?: PublicSettingsSection;
    facebook?: PublicSettingsSection;
    apple?: PublicSettingsSection;
  };
  analytics?: PublicSettingsSection;
  content?: PublicSettingsSection;
  engagement?: PublicSettingsSection;
}

const section = (value: unknown): PublicSettingsSection => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as PublicSettingsSection
    : {}
);

/**
 * Traduz o DTO publico por dominio para o modelo interno ja consumido pela UI.
 * O adapter existe somente nesta fronteira; a API nao volta a publicar aliases.
 */
export const adaptPublicSystemSettings = (
  payload: PublicSystemSettingsContract | Partial<SystemSettings> | null | undefined,
): Partial<SystemSettings> => {
  if (!payload || typeof payload !== 'object') return {};
  if (!('contractVersion' in payload)) return payload as Partial<SystemSettings>;

  const contract = payload as PublicSystemSettingsContract;
  const branding = section(contract.branding);
  const plans = section(contract.plans);
  const commerce = section(contract.commerce);
  const marketing = section(contract.marketing);
  const advertising = section(contract.advertising);
  const analytics = section(contract.analytics);
  const content = section(contract.content);
  const engagement = section(contract.engagement);
  const recaptcha = section(contract.authentication?.recaptcha);
  const google = section(contract.authentication?.google);
  const facebook = section(contract.authentication?.facebook);
  const apple = section(contract.authentication?.apple);

  const googleClientId = String(google.clientId || '').trim();
  const facebookAppId = String(facebook.appId || '').trim();
  const appleClientId = String(apple.clientId || '').trim();

  return {
    ...branding,
    ...plans,
    ...commerce,
    ...marketing,
    ...advertising,
    ...analytics,
    ...content,
    ...engagement,
    features: contract.features as SystemSettings['features'] | undefined,
    recaptchaEnabled: Boolean(recaptcha.enabled),
    recaptchaSiteKey: String(recaptcha.siteKey || ''),
    googleAuthClientId: googleClientId,
    hasGoogleAuthClientConfigured: Boolean(googleClientId),
    facebookAuthAppId: facebookAppId,
    hasFacebookAuthConfigured: Boolean(facebookAppId),
    appleAuthClientId: appleClientId,
    appleAuthRedirectUri: String(apple.redirectUri || ''),
    hasAppleAuthConfigured: Boolean(appleClientId),
  } as Partial<SystemSettings>;
};
