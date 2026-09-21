import Constants from 'expo-constants';

const LOCAL_HOST_PATTERN = /(^|\/)\/?(localhost|127\.0\.0\.1|10\.0\.2\.2)(:|\/|$)/i;

const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
};

const readConfiguredApiBaseUrl = (): string => {
  const fromEnvironment = process.env.EXPO_PUBLIC_API_BASE_URL;
  const fromExpoConfig = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  const configured = fromEnvironment || fromExpoConfig || '';

  if (!configured.trim()) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL nao configurada. Builds de staging/producao exigem uma URL publica da API.',
    );
  }

  const normalized = normalizeBaseUrl(configured);
  const isLocal = LOCAL_HOST_PATTERN.test(normalized.replace(/^https?:\/\//i, ''));

  if (isLocal) {
    throw new Error(
      'A aplicacao nao aceita uma API local. Configure EXPO_PUBLIC_API_BASE_URL com o backend publico.',
    );
  }

  if (!normalized.toLowerCase().startsWith('https://')) {
    throw new Error(
      'A API configurada deve estar publicada em HTTPS.',
    );
  }

  return normalized;
};

export const runtimeConfig = {
  apiBaseUrl: readConfiguredApiBaseUrl(),
} as const;
