import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AnalyticsParam = string | number | boolean;

type FirebaseAnalyticsInstance = {
  logEvent: (name: string, params?: Record<string, AnalyticsParam>) => Promise<void>;
  logScreenView: (params: { screen_name: string; screen_class?: string }) => Promise<void>;
  setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
  setUserId: (userId: string | null) => Promise<void>;
  setUserProperty: (name: string, value: string | null) => Promise<void>;
};

let analyticsInstance: FirebaseAnalyticsInstance | null | undefined;
let collectionEnabled = false;
let initializationPromise: Promise<boolean> | null = null;
let consentOverride: boolean | null = null;

const PRIVACY_STORAGE_KEY = 'concursomestre.privacy';

const readUsageDataConsent = async (): Promise<boolean> => {
  try {
    const rawValue = await AsyncStorage.getItem(PRIVACY_STORAGE_KEY);
    if (!rawValue) return false;

    const parsed = JSON.parse(rawValue) as { usageData?: unknown };
    return parsed.usageData === true;
  } catch {
    return false;
  }
};

const writeUsageDataConsent = async (enabled: boolean): Promise<void> => {
  try {
    const rawValue = await AsyncStorage.getItem(PRIVACY_STORAGE_KEY);
    let preferences: Record<string, unknown> = {};

    if (rawValue) {
      try {
        const parsed = JSON.parse(rawValue);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          preferences = parsed as Record<string, unknown>;
        }
      } catch {
        // Recria somente o objeto de preferências quando o valor local estiver
        // corrompido; as demais preferências não podem bloquear o consentimento.
      }
    }

    await AsyncStorage.setItem(
      PRIVACY_STORAGE_KEY,
      JSON.stringify({ ...preferences, usageData: enabled }),
    );
  } catch {
    // A coleta continua fail-closed se a preferência não puder ser persistida.
  }
};

const getAnalytics = (): FirebaseAnalyticsInstance | null => {
  if (analyticsInstance !== undefined) return analyticsInstance;

  // O Expo Go nao registra os modulos nativos do React Native Firebase.
  // Evite importar o pacote nesse runtime: apenas capturar a excecao depois
  // do require nao impede o erro do TurboModule de ser reportado pelo host.
  if (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo'
  ) {
    analyticsInstance = null;
    return analyticsInstance;
  }

  try {
    const firebaseModule = require('@react-native-firebase/analytics') as {
      default?: () => FirebaseAnalyticsInstance;
    };
    const factory = firebaseModule.default;
    analyticsInstance = typeof factory === 'function' ? factory() : null;
  } catch {
    analyticsInstance = null;
  }

  return analyticsInstance;
};

const sanitizeScreenName = (pathname: string): string => {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || '/';
  return withoutQuery
    .replace(/\/+/g, '/')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
    .slice(0, 100) || '/';
};

const hashIdentifier = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `cm_${(hash >>> 0).toString(16)}`;
};

export const analyticsService = {
  async initialize(): Promise<boolean> {
    if (!initializationPromise) {
      initializationPromise = (async () => {
        const analytics = getAnalytics();
        if (!analytics) return false;

        const consent = consentOverride ?? await readUsageDataConsent();
        try {
          await analytics.setAnalyticsCollectionEnabled(consent);
          collectionEnabled = consent;
          return consent;
        } catch {
          collectionEnabled = false;
          return false;
        }
      })();
    }

    return initializationPromise;
  },

  async setUsageDataConsent(enabled: boolean): Promise<boolean> {
    consentOverride = enabled;
    await writeUsageDataConsent(enabled);

    const analytics = getAnalytics();
    collectionEnabled = false;
    if (!analytics) return false;

    try {
      await analytics.setAnalyticsCollectionEnabled(enabled);
      return enabled;
    } catch {
      collectionEnabled = false;
      return false;
    }
  },

  async logScreenView(pathname: string): Promise<void> {
    await this.initialize();
    const analytics = getAnalytics();
    if (!analytics || !collectionEnabled) return;

    try {
      await analytics.logScreenView({
        screen_name: sanitizeScreenName(pathname),
        screen_class: 'ExpoRouterScreen',
      });
    } catch {
      // Analytics nunca deve interromper a navegacao do app.
    }
  },

  async logEvent(name: string, params?: Record<string, AnalyticsParam>): Promise<void> {
    await this.initialize();
    const analytics = getAnalytics();
    if (!analytics || !collectionEnabled) return;

    try {
      await analytics.logEvent(name.slice(0, 40), params);
    } catch {
      // Analytics nunca deve interromper a funcionalidade principal.
    }
  },

  async setUserId(userId?: string | null): Promise<void> {
    await this.initialize();
    const analytics = getAnalytics();
    if (!analytics || !collectionEnabled) return;

    try {
      await analytics.setUserId(userId ? hashIdentifier(String(userId)) : null);
    } catch {
      // O identificador e apenas uma dimensao analitica opcional.
    }
  },

  async setUserProperty(name: string, value?: string | null): Promise<void> {
    await this.initialize();
    const analytics = getAnalytics();
    if (!analytics || !collectionEnabled) return;

    try {
      await analytics.setUserProperty(name.slice(0, 24), value ?? null);
    } catch {
      // Propriedades de analytics nao podem afetar o fluxo do usuario.
    }
  },
};

export default analyticsService;
