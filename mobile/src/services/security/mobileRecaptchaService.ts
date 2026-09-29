import { Platform } from 'react-native';

type RecaptchaAction = { action: string };
type RecaptchaClient = { execute(action: RecaptchaAction, timeout?: number): Promise<string> };
type RecaptchaSdk = {
  Recaptcha: { fetchClient(siteKey: string): Promise<RecaptchaClient> };
  RecaptchaAction: { custom(action: string): RecaptchaAction };
};

export type MobileRecaptchaAction = 'login' | 'register';

let cachedSiteKey: string | null = null;
let cachedClient: RecaptchaClient | null = null;
let clientPromise: Promise<RecaptchaClient> | null = null;

const loadSdk = (): RecaptchaSdk => require('@google-cloud/recaptcha-enterprise-react-native') as RecaptchaSdk;

const getClient = async (siteKey: string): Promise<RecaptchaClient> => {
  if (cachedClient && cachedSiteKey === siteKey) return cachedClient;
  if (clientPromise && cachedSiteKey === siteKey) return clientPromise;

  cachedSiteKey = siteKey;
  clientPromise = loadSdk().Recaptcha.fetchClient(siteKey)
    .then((client) => {
      cachedClient = client;
      return client;
    })
    .finally(() => {
      clientPromise = null;
    });
  return clientPromise;
};

export const mobileRecaptchaService = {
  async prepare(siteKey?: string): Promise<void> {
    if (Platform.OS !== 'android' || !siteKey?.trim()) return;
    try {
      await getClient(siteKey.trim());
    } catch {
      // A inicializacao antecipada melhora a latencia; a acao protegida
      // continua reportando falhas de forma controlada ao usuario.
    }
  },

  async execute(siteKey: string | undefined, action: MobileRecaptchaAction): Promise<string> {
    if (Platform.OS !== 'android') {
      throw new Error('A verificacao segura ainda nao esta configurada para esta plataforma.');
    }
    const normalizedSiteKey = siteKey?.trim();
    if (!normalizedSiteKey) {
      throw new Error('A verificacao segura do app nao esta configurada. Tente novamente mais tarde.');
    }

    try {
      const sdk = loadSdk();
      const client = await getClient(normalizedSiteKey);
      const token = await client.execute(sdk.RecaptchaAction.custom(action), 10000);
      if (!token?.trim()) throw new Error('Token vazio');
      return token;
    } catch {
      throw new Error('Nao foi possivel validar sua solicitacao agora. Verifique sua conexao e tente novamente.');
    }
  },
};
