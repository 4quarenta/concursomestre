import Constants from 'expo-constants';

const LOCAL_API_BASE_URL = 'http://localhost/questao-pro-backend/api/';
const LOCAL_HOST_PATTERN = /(^|\/)\/?(localhost|127\.0\.0\.1|10\.0\.2\.2)(:|\/|$)/i;

const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
};

const readConfiguredApiBaseUrl = (): string => {
  const fromEnvironment = process.env.EXPO_PUBLIC_API_BASE_URL;
  const fromExpoConfig = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  const configured = fromEnvironment || fromExpoConfig || (__DEV__ ? LOCAL_API_BASE_URL : '');

  if (!configured.trim()) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL nao configurada. Builds de staging/producao exigem uma URL publica da API.',
    );
  }

  const normalized = normalizeBaseUrl(configured);

  if (!__DEV__ && LOCAL_HOST_PATTERN.test(normalized.replace(/^https?:\/\//i, ''))) {
    throw new Error(
      'Build de producao aponta para uma API local. Configure EXPO_PUBLIC_API_BASE_URL com o backend publico.',
    );
  }

  if (!__DEV__ && !normalized.toLowerCase().startsWith('https://')) {
    throw new Error(
      'Build de staging/producao exige EXPO_PUBLIC_API_BASE_URL em HTTPS.',
    );
  }

  return normalized;
};

export const runtimeConfig = {
  apiBaseUrl: readConfiguredApiBaseUrl(),
} as const;
