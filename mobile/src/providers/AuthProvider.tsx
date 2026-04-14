import React from 'react';
import { authFlowService } from '@/services/auth/authFlowService';
import { sessionStore } from '@/services/auth/sessionStore';
import { readApiErrorMessage } from '@/services/api/response';
import { questionService } from '@/services/questions/questionService';
import type { UserProfile } from '@/types/auth';

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  user: UserProfile | null;
  isLoading: boolean;
  isBootstrapped: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
  const [isLoading, setIsLoading] = React.useState(false);
  const [isBootstrapped, setIsBootstrapped] = React.useState(false);

  const applySessionFromResponse = React.useCallback(async (response: any) => {
    const payload = response?.data || response;
    const token = payload?.token || response?.token || null;
    const sessionUser = payload?.user || response?.user || null;

    if (!token || !sessionUser) {
      throw new Error('Sessao invalida retornada pelo backend.');
    }

    if (payload?.require2FA || response?.require2FA) {
      throw new Error('Fluxo 2FA ainda nao mapeado no app mobile. Faça login no web para concluir.');
    }

    const normalizedUser = normalizeUserProfile(sessionUser as UserProfile);

    setUser(normalizedUser);
    await sessionStore.setSession(token, normalizedUser);
  }, []);

  const refreshProfile = React.useCallback(async () => {
    if (!sessionStore.getAccessToken()) return;

    const profile = await authFlowService.me();
    const normalizedProfile = normalizeUserProfile(profile);

    setUser(normalizedProfile);
    await sessionStore.setSession(sessionStore.getAccessToken(), normalizedProfile);
  }, []);

  const login = React.useCallback(async (input: LoginInput) => {
    setIsLoading(true);
    try {
      const response = await authFlowService.login(input);
      await applySessionFromResponse(response);
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel realizar o login.'));
    } finally {
      setIsLoading(false);
    }
  }, [applySessionFromResponse]);

  const register = React.useCallback(async (input: RegisterInput) => {
    setIsLoading(true);
    try {
      const response = await authFlowService.register(input);
      await applySessionFromResponse(response);
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel criar a conta.'));
    } finally {
      setIsLoading(false);
    }
  }, [applySessionFromResponse]);

  const logout = React.useCallback(async () => {
    setIsLoading(true);
    try {
      await authFlowService.logout();
    } catch {
      // Nao bloqueia logout local.
    } finally {
      setUser(null);
      await sessionStore.clearSession();
      setIsLoading(false);
    }
  }, []);

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

        if (snapshot.accessToken) {
          try {
            const profile = await authFlowService.me();
            const normalizedProfile = normalizeUserProfile(profile);

            setUser(normalizedProfile);
            await sessionStore.setSession(snapshot.accessToken, normalizedProfile);
          } catch {
            await sessionStore.clearSession();
            setUser(null);
          }
        }
      } finally {
        setIsBootstrapped(true);
      }
    };

    void bootstrap();
  }, []);

  const value = React.useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isBootstrapped,
    login,
    register,
    logout,
    refreshProfile,
    toggleSavedQuestion,
  }), [isBootstrapped, isLoading, login, logout, refreshProfile, register, toggleSavedQuestion, user]);

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
