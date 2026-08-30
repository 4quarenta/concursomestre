import React from 'react';
import { authFlowService } from '@/services/auth/authFlowService';
import { accountService } from '@/services/auth/accountService';
import { sessionStore } from '@/services/auth/sessionStore';
import { readApiErrorMessage } from '@/services/api/response';
import { questionService } from '@/services/questions/questionService';
import type { UserProfile } from '@/types/auth';
import { systemSettingsService } from '@/services/system/systemSettingsService';
import type { MobileFeatureKey, MobileSystemSettings } from '@/types/system';

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  password: string;
};

type UpdateUserInput = Partial<UserProfile>;

type AuthContextValue = {
  user: UserProfile | null;
  systemSettings: MobileSystemSettings;
  isLoading: boolean;
  isBootstrapped: boolean;
  login: (input: LoginInput) => Promise<{ requiresTwoFactor: boolean; email?: string }>;
  verifyTwoFactor: (email: string, code: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (input: UpdateUserInput) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSystemSettings: () => Promise<void>;
  isFeatureEnabled: (feature: MobileFeatureKey) => boolean;
  toggleSavedQuestion: (questionId: string | number) => Promise<boolean>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

const normalizeUserProfile = (user: UserProfile | null | undefined): UserProfile | null => {
  if (!user) return null;

  return {
    ...user,
    savedQuestionIds: Array.isArray(user.savedQuestionIds)
      ? user.savedQuestionIds.map((item) => String(item))
      : [],
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [systemSettings, setSystemSettings] = React.useState<MobileSystemSettings>(
    () => systemSettingsService.createDefaultSystemSettings(),
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [isBootstrapped, setIsBootstrapped] = React.useState(false);

  const applySessionFromResponse = React.useCallback(async (response: any) => {
    const payload = response?.data || response;
    const token = payload?.token || response?.token || null;
    const refreshToken = payload?.refreshToken || response?.refreshToken || null;
    const csrfToken = payload?.csrfToken || response?.csrfToken || null;
    const sessionUser = payload?.user || response?.user || null;

    if (!token || !refreshToken || !csrfToken || !sessionUser) {
      throw new Error('Sessao invalida retornada pelo backend.');
    }

    const normalizedUser = normalizeUserProfile(sessionUser as UserProfile);

    setUser(normalizedUser);
    await sessionStore.setSession(token, normalizedUser, { refreshToken, csrfToken });
  }, []);

  const refreshSystemSettings = React.useCallback(async () => {
    try {
      const settings = await systemSettingsService.getSystemSettings();
      setSystemSettings(settings);
    } catch {
      // Nao bloqueia auth se settings estiver indisponivel.
    }
  }, []);

  const refreshProfile = React.useCallback(async () => {
    if (!sessionStore.getAccessToken()) return;

    const profile = await authFlowService.me();
    const normalizedProfile = normalizeUserProfile(profile);

    setUser(normalizedProfile);
    await sessionStore.setSession(sessionStore.getAccessToken(), normalizedProfile);
    await refreshSystemSettings();
  }, [refreshSystemSettings]);

  const login = React.useCallback(async (input: LoginInput) => {
    setIsLoading(true);
    try {
      const response = await authFlowService.login(input);
      const payload = response?.data || response;
      if (payload?.require2FA || response?.require2FA) {
        return {
          requiresTwoFactor: true,
          email: payload?.email || response?.email || input.email,
        };
      }
      await applySessionFromResponse(response);
      await refreshSystemSettings();
      return { requiresTwoFactor: false };
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel realizar o login.'));
    } finally {
      setIsLoading(false);
    }
  }, [applySessionFromResponse, refreshSystemSettings]);

  const verifyTwoFactor = React.useCallback(async (email: string, code: string) => {
    setIsLoading(true);
    try {
      const response = await authFlowService.verifyTwoFactor(email, code);
      await applySessionFromResponse(response);
      await refreshSystemSettings();
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel validar o codigo de seguranca.'));
    } finally {
      setIsLoading(false);
    }
  }, [applySessionFromResponse, refreshSystemSettings]);

  const register = React.useCallback(async (input: RegisterInput) => {
    setIsLoading(true);
    try {
      const response = await authFlowService.register(input);
      await applySessionFromResponse(response);
      await refreshSystemSettings();
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel criar a conta.'));
    } finally {
      setIsLoading(false);
    }
  }, [applySessionFromResponse, refreshSystemSettings]);

  const logout = React.useCallback(async () => {
    setIsLoading(true);
    try {
      await authFlowService.logout();
    } catch {
      // Nao bloqueia logout local.
    } finally {
      setUser(null);
      setSystemSettings(systemSettingsService.createDefaultSystemSettings());
      await sessionStore.clearSession();
      setIsLoading(false);
    }
  }, []);

  const updateUser = React.useCallback(async (input: UpdateUserInput) => {
    if (!user) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    const sanitizedInput = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as UpdateUserInput;

    if (Object.keys(sanitizedInput).length === 0) {
      return;
    }

    const previousUser = normalizeUserProfile(user) as UserProfile;
    const optimisticUser = normalizeUserProfile({
      ...previousUser,
      ...sanitizedInput,
    }) as UserProfile;

    setUser(optimisticUser);
    await sessionStore.setSession(sessionStore.getAccessToken(), optimisticUser);

    try {
      await accountService.updateUserProfile(sanitizedInput);
      await refreshProfile();
    } catch (error) {
      setUser(previousUser);
      await sessionStore.setSession(sessionStore.getAccessToken(), previousUser);
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel atualizar o perfil.'));
    }
  }, [refreshProfile, user]);

  const toggleSavedQuestion = React.useCallback(async (questionId: string | number) => {
    if (!user?.id) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }

    const questionKey = String(questionId);
    const previousUser = normalizeUserProfile(user) as UserProfile;
    const previousSaved = previousUser.savedQuestionIds || [];
    const isCurrentlySaved = previousSaved.includes(questionKey);
    const nextUser = normalizeUserProfile({
      ...previousUser,
      savedQuestionIds: isCurrentlySaved
        ? previousSaved.filter((item) => item !== questionKey)
        : [...previousSaved, questionKey],
    }) as UserProfile;

    setUser(nextUser);
    await sessionStore.setSession(sessionStore.getAccessToken(), nextUser);

    const saveResult = await questionService.toggleSavedQuestion(user.id, questionKey);
    if (!saveResult.success) {
      setUser(previousUser);
      await sessionStore.setSession(sessionStore.getAccessToken(), previousUser);
      throw new Error(saveResult.message || 'Nao foi possivel atualizar as questoes salvas.');
    }

    return !isCurrentlySaved;
  }, [user]);

  React.useEffect(() => {
    const bootstrap = async () => {
      try {
        const snapshot = await sessionStore.hydrate();
        if (snapshot.user) {
          setUser(normalizeUserProfile(snapshot.user));
        }

        if (snapshot.accessToken && snapshot.refreshToken && snapshot.csrfToken) {
          try {
            const profile = await authFlowService.me();
            const normalizedProfile = normalizeUserProfile(profile);

            setUser(normalizedProfile);
            await sessionStore.setSession(snapshot.accessToken, normalizedProfile);
            await refreshSystemSettings();
          } catch {
            await sessionStore.clearSession();
            setUser(null);
            setSystemSettings(systemSettingsService.createDefaultSystemSettings());
          }
        } else {
          if (snapshot.accessToken || snapshot.refreshToken || snapshot.csrfToken) {
            await sessionStore.clearSession();
            setUser(null);
          }
          setSystemSettings(systemSettingsService.createDefaultSystemSettings());
        }
      } finally {
        setIsBootstrapped(true);
      }
    };

    void bootstrap();
  }, [refreshSystemSettings]);

  const isFeatureEnabled = React.useCallback((feature: MobileFeatureKey): boolean => {
    if (user?.isAdmin || user?.role === 'admin') {
      return true;
    }

    return Boolean(systemSettings.features[feature]);
  }, [systemSettings.features, user?.isAdmin, user?.role]);

  const value = React.useMemo<AuthContextValue>(() => ({
    user,
    systemSettings,
    isLoading,
    isBootstrapped,
    login,
    verifyTwoFactor,
    register,
    logout,
    updateUser,
    refreshProfile,
    refreshSystemSettings,
    isFeatureEnabled,
    toggleSavedQuestion,
  }), [
    isBootstrapped,
    isFeatureEnabled,
    isLoading,
    login,
    verifyTwoFactor,
    logout,
    updateUser,
    refreshProfile,
    refreshSystemSettings,
    register,
    systemSettings,
    toggleSavedQuestion,
    user,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro do AuthProvider.');
  }

  return context;
};
