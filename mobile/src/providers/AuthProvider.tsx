/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from 'react';
import { authFlowService } from '@/services/auth/authFlowService';
import { accountService } from '@/services/auth/accountService';
import { sessionStorage } from '@/storage/sessionStorage';
import { readApiErrorMessage } from '@/services/api/response';
import { questionService } from '@/services/questions/questionService';
import type { UserProfile } from '@/types/auth';
import { systemSettingsService } from '@/services/system/systemSettingsService';
import type { MobileFeatureKey, MobileSystemSettings } from '@/types/system';
import { normalizeApiFailure } from '@/api/errors';

type LoginInput = { email: string; password: string };
type RegisterInput = { name: string; email: string; password: string };
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
const SCREENSHOT_MODE = process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1';

const SCREENSHOT_USER: UserProfile = {
  id: 'visual-preview-user',
  name: 'Aluno ConcursoMestre',
  email: 'preview@concursomestre.com',
  role: 'user',
  emailVerified: true,
  level: 12,
  xp: 3480,
  plan: 'Pro',
  savedQuestionIds: [],
  subscription: {
    status: 'active',
    auto_renew: true,
    plan: { name: 'Pro' },
  },
};

const isScreenshotPublicRoute = () => {
  if (!SCREENSHOT_MODE || typeof window === 'undefined') return false;
  const pathname = String(window.location?.pathname || '').toLowerCase();
  return pathname.includes('/login') || pathname.includes('/cadastro');
};

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
  }
  return '';
};

const normalizeUserProfile = (user: UserProfile | null | undefined): UserProfile | null => {
  if (!user) return null;
  const rawUser = user as UserProfile & Record<string, unknown>;
  const nestedUser = rawUser.user && typeof rawUser.user === 'object'
    ? rawUser.user as Record<string, unknown>
    : undefined;
  const personal = rawUser.personal && typeof rawUser.personal === 'object'
    ? rawUser.personal as Record<string, unknown>
    : undefined;
  const gamification = rawUser.gamification && typeof rawUser.gamification === 'object'
    ? rawUser.gamification as Record<string, unknown>
    : undefined;
  const subscription = rawUser.subscription && typeof rawUser.subscription === 'object'
    ? rawUser.subscription as Record<string, unknown>
    : undefined;
  const subscriptionPlan = subscription?.plan && typeof subscription.plan === 'object'
    ? subscription.plan as Record<string, unknown>
    : undefined;

  const resolvedId = firstNonEmptyString(
    rawUser.id,
    rawUser.userId,
    rawUser.user_id,
    rawUser.uid,
    nestedUser?.id,
    nestedUser?.userId,
    nestedUser?.user_id,
  );
  const resolvedName = firstNonEmptyString(
    rawUser.name,
    rawUser.displayName,
    rawUser.display_name,
    nestedUser?.name,
    nestedUser?.displayName,
    nestedUser?.display_name,
  );
  const resolvedEmail = firstNonEmptyString(
    rawUser.email,
    nestedUser?.email,
  );
  const targetExam = firstNonEmptyString(
    rawUser.targetExam,
    rawUser.target_exam,
    personal?.targetExam,
    personal?.target_exam,
    nestedUser?.targetExam,
    nestedUser?.target_exam,
  );
  const photoUrl = firstNonEmptyString(
    rawUser.photoUrl,
    rawUser.photo_url,
    rawUser.profilePhotoUrl,
    rawUser.profile_photo_url,
    rawUser.userPhotoUrl,
    rawUser.user_photo_url,
    rawUser.avatarUrl,
    rawUser.avatar_url,
    nestedUser?.photoUrl,
    nestedUser?.photo_url,
    nestedUser?.avatarUrl,
    nestedUser?.avatar_url,
  );
  const resolvedPlan = firstNonEmptyString(
    typeof rawUser.plan === 'string' || typeof rawUser.plan === 'number' ? rawUser.plan : undefined,
    rawUser.planName,
    rawUser.plan_name,
    subscriptionPlan?.displayName,
    subscriptionPlan?.name,
    nestedUser?.plan,
    nestedUser?.planName,
  );
  const savedQuestionIds = rawUser.savedQuestionIds ?? rawUser.saved_question_ids;

  return {
    ...user,
    id: resolvedId || user.id || '',
    name: resolvedName || user.name || '',
    email: resolvedEmail || user.email || '',
    targetExam: targetExam || undefined,
    photoUrl: photoUrl || undefined,
    plan: resolvedPlan || user.plan,
    role: (rawUser.role ?? nestedUser?.role ?? user.role) as UserProfile['role'],
    emailVerified: Boolean(rawUser.emailVerified ?? rawUser.email_verified ?? nestedUser?.emailVerified ?? user.emailVerified),
    level: Number(rawUser.level ?? gamification?.level ?? user.level ?? 0) || undefined,
    xp: Number(rawUser.xp ?? gamification?.xp ?? user.xp ?? 0) || undefined,
    savedQuestionIds: Array.isArray(savedQuestionIds)
      ? savedQuestionIds.map((item) => String(item))
      : [],
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const screenshotUser = SCREENSHOT_MODE && !isScreenshotPublicRoute() ? SCREENSHOT_USER : null;
  const [user, setUser] = React.useState<UserProfile | null>(() => screenshotUser);
  const [systemSettings, setSystemSettings] = React.useState<MobileSystemSettings>(
    () => systemSettingsService.createDefaultSystemSettings(),
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [isBootstrapped, setIsBootstrapped] = React.useState(SCREENSHOT_MODE);

  const applySessionFromResponse = React.useCallback(async (response: any) => {
    // A API de producao ja teve duas formas validas de transportar a sessao:
    // diretamente no payload e dentro de `data`. O cliente nativo tambem pode
    // receber o usuario apenas no /auth/me quando o login e servido por uma
    // instancia antiga do backend. Nao descarte um token utilizavel por causa
    // dessa diferenca de envelope.
    const responseObject = response && typeof response === 'object' ? response : {};
    const dataObject = responseObject.data && typeof responseObject.data === 'object'
      ? responseObject.data
      : {};
    const payload = { ...responseObject, ...dataObject };
    const token = firstNonEmptyString(
      payload.token,
      payload.accessToken,
      payload.access_token,
      payload.authSession?.token,
      payload.session?.token,
    ) || null;
    const refreshToken = firstNonEmptyString(
      payload.refreshToken,
      payload.refresh_token,
      payload.authSession?.refreshToken,
      payload.authSession?.refresh_token,
      payload.session?.refreshToken,
      payload.session?.refresh_token,
    ) || null;
    const csrfToken = firstNonEmptyString(
      payload.csrfToken,
      payload.csrf_token,
      payload.authSession?.csrfToken,
      payload.authSession?.csrf_token,
      payload.session?.csrfToken,
      payload.session?.csrf_token,
    ) || null;
    let sessionUser = payload.user || payload.profile || payload.account || payload.session?.user || null;

    if (!token) throw new Error('Sessao invalida retornada pelo backend.');

    if (!sessionUser) {
      // Permite concluir o login quando o endpoint devolve o token antes do
      // DTO do usuario. O /auth/me usa o token recem-recebido e e o contrato
      // oficial para recuperar a identidade autenticada.
      await sessionStorage.setSession(token, null, refreshToken, csrfToken);
      try {
        sessionUser = await authFlowService.me();
      } catch (error) {
        await sessionStorage.clearSession();
        throw error;
      }
    }

    const normalizedUser = normalizeUserProfile({
      ...(sessionUser as UserProfile),
      subscription: payload?.subscription || response?.subscription || (sessionUser as UserProfile).subscription,
      level: payload?.gamification?.level ?? (sessionUser as UserProfile).level,
      xp: payload?.gamification?.xp ?? (sessionUser as UserProfile).xp,
    });
    if (!normalizedUser?.id) {
      await sessionStorage.clearSession();
      throw new Error('Sessao invalida retornada pelo backend.');
    }
    setUser(normalizedUser);
    await sessionStorage.setSession(
      token,
      normalizedUser,
      refreshToken || null,
      csrfToken || null,
    );
  }, []);

  const refreshSystemSettings = React.useCallback(async () => {
    if (SCREENSHOT_MODE) return;
    try {
      const settings = await systemSettingsService.getSystemSettings();
      setSystemSettings(settings);
    } catch {
      // Nao bloqueia auth se settings estiver indisponivel.
    }
  }, []);

  const refreshProfile = React.useCallback(async () => {
    if (SCREENSHOT_MODE) return;
    if (!sessionStorage.getAccessToken()) return;
    const currentUser = normalizeUserProfile(sessionStorage.getCurrentUser());
    const [profile, session] = await Promise.all([
      accountService.getUserProfile(),
      authFlowService.me(),
    ]);
    const normalizedProfile = normalizeUserProfile({
      ...(currentUser || {}),
      ...session,
      ...profile,
    } as UserProfile);
    setUser(normalizedProfile);
    await sessionStorage.setSession(sessionStorage.getAccessToken(), normalizedProfile);
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
      try { await refreshProfile(); } catch { /* login ja foi concluido */ }
      await refreshSystemSettings();
      return { requiresTwoFactor: false };
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel realizar o login.'));
    } finally { setIsLoading(false); }
  }, [applySessionFromResponse, refreshProfile, refreshSystemSettings]);

  const verifyTwoFactor = React.useCallback(async (email: string, code: string) => {
    setIsLoading(true);
    try {
      const response = await authFlowService.verifyTwoFactor(email, code);
      await applySessionFromResponse(response);
      try { await refreshProfile(); } catch { /* 2FA ja concluiu a sessao */ }
      await refreshSystemSettings();
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel validar o codigo de seguranca.'));
    } finally { setIsLoading(false); }
  }, [applySessionFromResponse, refreshProfile, refreshSystemSettings]);

  const register = React.useCallback(async (input: RegisterInput) => {
    setIsLoading(true);
    try {
      const response = await authFlowService.register(input);
      await applySessionFromResponse(response);
      try { await refreshProfile(); } catch { /* cadastro ja foi concluido */ }
      await refreshSystemSettings();
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel criar a conta.'));
    } finally { setIsLoading(false); }
  }, [applySessionFromResponse, refreshProfile, refreshSystemSettings]);

  const logout = React.useCallback(async () => {
    if (SCREENSHOT_MODE) return;
    setIsLoading(true);
    try { await authFlowService.logout(); } catch { /* logout local continua */ }
    finally {
      setUser(null);
      // As configuracoes do sistema sao globais da plataforma, nao pertencem
      // a conta que acabou de sair. O listener da sessao recarrega a projecao
      // publica sem autenticar, preservando o estado oficial do servidor.
      await sessionStorage.clearSession();
      setIsLoading(false);
    }
  }, []);

  const updateUser = React.useCallback(async (input: UpdateUserInput) => {
    if (!user || !sessionStorage.getAccessToken()) {
      throw new Error('Sessao expirada. Faca login novamente.');
    }
    if (SCREENSHOT_MODE) {
      setUser(normalizeUserProfile({ ...user, ...input }));
      return;
    }
    const sanitizedInput = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as UpdateUserInput;
    if (Object.keys(sanitizedInput).length === 0) return;
    const previousUser = normalizeUserProfile(user) as UserProfile;
    const optimisticUser = normalizeUserProfile({ ...previousUser, ...sanitizedInput }) as UserProfile;
    setUser(optimisticUser);
    await sessionStorage.setSession(sessionStorage.getAccessToken(), optimisticUser);
    try {
      await accountService.updateUserProfile(sanitizedInput);
      await refreshProfile();
    } catch (error) {
      const currentToken = sessionStorage.getAccessToken();
      if (currentToken) {
        setUser(previousUser);
        await sessionStorage.setSession(currentToken, previousUser);
      } else {
        // O interceptor ja limpou a sessao apos um 401. Nao restaure o perfil
        // local sem token, pois isso deixa a UI aparentemente autenticada e
        // faz o proximo salvamento falhar novamente.
        setUser(null);
      }
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel atualizar o perfil.'));
    }
  }, [refreshProfile, user]);

  const toggleSavedQuestion = React.useCallback(async (questionId: string | number) => {
    if (!user?.id) throw new Error('Sessao expirada. Faca login novamente.');
    const questionKey = String(questionId);
    const previousUser = normalizeUserProfile(user) as UserProfile;
    const previousSaved = previousUser.savedQuestionIds || [];
    const isCurrentlySaved = previousSaved.includes(questionKey);
    const nextUser = normalizeUserProfile({
      ...previousUser,
      savedQuestionIds: isCurrentlySaved ? previousSaved.filter((item) => item !== questionKey) : [...previousSaved, questionKey],
    }) as UserProfile;
    setUser(nextUser);
    if (SCREENSHOT_MODE) return !isCurrentlySaved;
    await sessionStorage.setSession(sessionStorage.getAccessToken(), nextUser);
    const saveResult = await questionService.toggleSavedQuestion(user.id, questionKey);
    if (!saveResult.success) {
      setUser(previousUser);
      await sessionStorage.setSession(sessionStorage.getAccessToken(), previousUser);
      throw new Error(saveResult.message || 'Nao foi possivel atualizar as questoes salvas.');
    }
    return !isCurrentlySaved;
  }, [user]);

  React.useEffect(() => {
    if (SCREENSHOT_MODE) return undefined;
    const unsubscribe = sessionStorage.subscribe((snapshot) => {
      if (!snapshot.accessToken) {
        setUser(null);
        void refreshSystemSettings();
      }
    });
    return unsubscribe;
  }, [refreshSystemSettings]);

  React.useEffect(() => {
    if (SCREENSHOT_MODE) {
      setUser(isScreenshotPublicRoute() ? null : SCREENSHOT_USER);
      setIsBootstrapped(true);
      return;
    }
    const bootstrap = async () => {
      try {
        const snapshot = await sessionStorage.hydrate();
        if (snapshot.user) setUser(normalizeUserProfile(snapshot.user));

        // settings.php e uma projecao publica das configuracoes globais da
        // plataforma. Ela precisa ser sincronizada mesmo sem uma conta local.
        // Comecamos a requisicao antes do /me para nao atrelar a configuracao
        // global ao sucesso da autenticacao.
        const publicSettingsPromise = refreshSystemSettings();

        if (snapshot.accessToken) {
          try {
            const [profile, session] = await Promise.all([
              accountService.getUserProfile(),
              authFlowService.me(),
            ]);
            const normalizedProfile = normalizeUserProfile({
              ...(normalizeUserProfile(snapshot.user) || {}),
              ...session,
              ...profile,
            } as UserProfile);
            setUser(normalizedProfile);
            await sessionStorage.setSession(snapshot.accessToken, normalizedProfile);
            await publicSettingsPromise;
          } catch (error) {
            const failure = normalizeApiFailure(error);
            // Somente uma credencial invalida remove a sessao local. Um 403
            // preserva a identidade e representa falta de permissao no recurso.
            if (failure.status === 401) {
              await sessionStorage.clearSession();
              setUser(null);
              await publicSettingsPromise;
            } else {
              // Falhas de rede/servidor durante reload ou update nao invalidam
              // a sessao persistida. O perfil sera sincronizado no proximo retry.
              await publicSettingsPromise;
            }
          }
        } else {
          // Um perfil persistido sem token nao representa uma sessao valida.
          // Evita abrir a Home com um usuario de preview/estado antigo e falhar
          // depois nas chamadas que exigem user_id.
          setUser(null);
          // A configuracao global e atualizada em background. Uma indisponibilidade
          // temporaria do servidor nao pode transformar a abertura anonima do app
          // em uma espera de ate o timeout HTTP.
          void publicSettingsPromise;
        }
      } finally { setIsBootstrapped(true); }
    };
    void bootstrap();
  }, [refreshSystemSettings]);

  const isFeatureEnabled = React.useCallback((feature: MobileFeatureKey): boolean => {
    if (user?.isAdmin || user?.role === 'admin') return true;
    return Boolean(systemSettings.features[feature]);
  }, [systemSettings.features, user?.isAdmin, user?.role]);

  const value = React.useMemo<AuthContextValue>(() => ({
    user, systemSettings, isLoading, isBootstrapped, login, verifyTwoFactor, register, logout, updateUser,
    refreshProfile, refreshSystemSettings, isFeatureEnabled, toggleSavedQuestion,
  }), [user, systemSettings, isLoading, isBootstrapped, login, verifyTwoFactor, register, logout, updateUser,
    refreshProfile, refreshSystemSettings, isFeatureEnabled, toggleSavedQuestion]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro do AuthProvider.');
  return context;
};
