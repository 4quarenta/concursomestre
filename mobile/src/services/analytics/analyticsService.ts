import Constants, { ExecutionEnvironment } from 'expo-constants';

type AnalyticsParam = string | number | boolean;

type FirebaseAnalyticsInstance = {
  logEvent: (name: string, params?: Record<string, AnalyticsParam>) => Promise<void>;
  logScreenView: (params: { screen_name: string; screen_class?: string }) => Promise<void>;
  setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
  setUserId: (userId: string | null) => Promise<void>;
  setUserProperty: (name: string, value: string | null) => Promise<void>;
};

let analyticsInstance: FirebaseAnalyticsInstance | null | undefined;

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
    const analytics = getAnalytics();
    if (!analytics) return false;

    try {
      await analytics.setAnalyticsCollectionEnabled(true);
      return true;
    } catch {
      return false;
    }
  },

  async logScreenView(pathname: string): Promise<void> {
    const analytics = getAnalytics();
    if (!analytics) return;

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
    const analytics = getAnalytics();
    if (!analytics) return;

    try {
      await analytics.logEvent(name.slice(0, 40), params);
    } catch {
      // Analytics nunca deve interromper a funcionalidade principal.
    }
  },

  async setUserId(userId?: string | null): Promise<void> {
    const analytics = getAnalytics();
    if (!analytics) return;

    try {
      await analytics.setUserId(userId ? hashIdentifier(String(userId)) : null);
    } catch {
      // O identificador e apenas uma dimensao analitica opcional.
    }
  },

  async setUserProperty(name: string, value?: string | null): Promise<void> {
    const analytics = getAnalytics();
    if (!analytics) return;

    try {
      await analytics.setUserProperty(name.slice(0, 24), value ?? null);
    } catch {
      // Propriedades de analytics nao podem afetar o fluxo do usuario.
    }
  },
};

export default analyticsService;
