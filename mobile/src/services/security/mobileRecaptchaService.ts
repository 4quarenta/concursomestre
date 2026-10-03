import { Platform } from 'react-native';

export type MobileRecaptchaAction =
  | 'login'
  | 'register'
  | 'forgot_password'
  | 'reset_password'
  | 'profile_cancel_subscription';

type RecaptchaSdk = {
  Recaptcha: {
    fetchClient: (siteKey: string) => Promise<{ execute: (action: unknown) => Promise<string> }>;
  };
  RecaptchaAction: {
    LOGIN: () => unknown;
    custom: (name: string) => unknown;
  };
};

declare const require: (moduleName: string) => unknown;

let cachedSiteKey: string | null = null;
let cachedClient: Promise<{ execute: (action: unknown) => Promise<string> }> | null = null;

const getSdk = (): RecaptchaSdk =>
  require('@google-cloud/recaptcha-enterprise-react-native') as RecaptchaSdk;

const getClient = (siteKey: string) => {
  if (cachedSiteKey !== siteKey || !cachedClient) {
    cachedSiteKey = siteKey;
    cachedClient = getSdk().Recaptcha.fetchClient(siteKey).catch((error) => {
      cachedSiteKey = null;
      cachedClient = null;
      throw error;
    });
  }
  return cachedClient;
};

const normalizeSiteKey = (siteKey?: string | null): string => String(siteKey || '').trim();

export const mobileRecaptchaService = {
  /** Warm up the native SDK during public settings bootstrap without blocking startup. */
  prepare(siteKey?: string | null): void {
    const normalizedSiteKey = normalizeSiteKey(siteKey);
    if (Platform.OS !== 'android' || !normalizedSiteKey) return;
    void getClient(normalizedSiteKey).catch(() => undefined);
  },

  async execute(siteKey: string | undefined, action: MobileRecaptchaAction): Promise<string> {
    if (Platform.OS !== 'android') {
      throw new Error('A verificação segura do login ainda não está disponível para este sistema.');
    }

    const normalizedSiteKey = normalizeSiteKey(siteKey);
    if (!normalizedSiteKey) {
      throw new Error('A proteção de login mobile ainda não foi configurada. Tente novamente mais tarde.');
    }

    try {
      const sdk = getSdk();
      const client = await getClient(normalizedSiteKey);
      const sdkAction = action === 'login'
        ? sdk.RecaptchaAction.LOGIN()
        : sdk.RecaptchaAction.custom(action);
      const token = await client.execute(sdkAction);
      if (!token || typeof token !== 'string') {
        throw new Error('empty reCAPTCHA token');
      }
      return token;
    } catch {
      throw new Error('Não foi possível concluir a verificação de segurança. Confira sua conexão e tente novamente.');
    }
  },
};
