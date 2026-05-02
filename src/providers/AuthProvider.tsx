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

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { UserProfile, SimulationSession } from '@types';
import { accountService } from '@services/auth';
import { notificationService } from '@services/notifications';
import { questionService } from '@services/questions';
import { simulationsService } from '@services/simulations';
import { useToast } from '@providers/ToastProvider';
import {
  bootstrapAuthSession,
  establishAuthenticatedSession,
  fetchAuthenticatedUser,
  getAccessToken,
  logoutAuthSession,
  subscribeToAuthSession,
  updateCurrentUserSnapshot,
} from '@services/auth/session';

const XP_PER_LEVEL = 1000;
const LEVEL_MILESTONES: Record<number, string> = {
  5: 'Impressionante! Você atingiu o Nivel 5.',
  10: 'Nivel 10 alcancado! Você esta entre os mais dedicados da plataforma.',
  25: 'Nivel 25! Uma conquista rara.',
  50: 'Nivel 50! Você virou lenda no ConcursoMestre.',
};

interface AuthState {
  currentUser: UserProfile | null;
  isLoading: boolean;
}

const initialState: AuthState = {
  currentUser: null,
  isLoading: true
};

/**
 * Campos permitidos no endpoint de atualizacao de perfil.
 * Campos de progresso (xp/level) devem ser apenas locais nesse fluxo.
 * @since v1.0.0
 */
const EDITABLE_PROFILE_FIELDS: Array<keyof UserProfile> = [
  'name',
  'email',
  'cpf',
  'address',
  'bankAccount',
  'targetExam',
  'preferences',
  'photoUrl',
  'role',
];

type AuthAction =
  | { type: 'LOGIN'; payload: UserProfile }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<UserProfile> }
  | { type: 'ADD_XP'; payload: number }
  | { type: 'TOGGLE_SAVED'; payload: string }
  | { type: 'ADD_SIMULATION'; payload: SimulationSession }
  | { type: 'PURCHASE_MATERIAL'; payload: string }
  | { type: 'REMOVE_MATERIAL'; payload: string }
  | { type: 'BECOME_PARTNER' }
  | { type: 'FINISH_LOADING' };

/**
 * Reducer central da sessão autenticada.
 * Ele consolida mutações de usuário que abastecem todo o site, incluindo perfil, XP, simulados e materiais comprados.
 * @since 1.0.0
 */
function authReducer(state: AuthState, action: AuthAction): AuthState {
  if (!state.currentUser && action.type !== 'LOGIN' && action.type !== 'FINISH_LOADING' && action.type !== 'LOGOUT') {
    return state;
  }

  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        isLoading: false,
        currentUser: {
          ...action.payload,
          savedQuestionIds: action.payload.savedQuestionIds || [],
          simulations: action.payload.simulations || [],
          purchasedMaterialIds: action.payload.purchasedMaterialIds || []
        }
      };

    case 'LOGOUT':
      return { ...state, currentUser: null, isLoading: false };

    case 'UPDATE_USER':
      return {
        ...state,
        currentUser: { ...state.currentUser!, ...action.payload }
      };

    case 'ADD_XP': {
      const user = state.currentUser!;
      const totalXp = user.xp + action.payload;
      const newLevel = Math.floor(totalXp / XP_PER_LEVEL) + 1;
      return {
        ...state,
        currentUser: { ...user, xp: totalXp, level: newLevel }
      };
    }

    case 'TOGGLE_SAVED': {
      const user = state.currentUser!;
      const isSaved = user.savedQuestionIds.includes(action.payload);
      return {
        ...state,
        currentUser: {
          ...user,
          savedQuestionIds: isSaved
            ? user.savedQuestionIds.filter(id => id !== action.payload)
            : [...user.savedQuestionIds, action.payload]
        }
      };
    }

    case 'ADD_SIMULATION':
      return {
        ...state,
        currentUser: {
          ...state.currentUser!,
          simulations: [action.payload, ...state.currentUser!.simulations]
        }
      };

    case 'PURCHASE_MATERIAL':
      return {
        ...state,
        currentUser: {
          ...state.currentUser!,
          purchasedMaterialIds: [...state.currentUser!.purchasedMaterialIds, action.payload]
        }
      };

    case 'REMOVE_MATERIAL':
      return {
        ...state,
        currentUser: {
          ...state.currentUser!,
          purchasedMaterialIds: state.currentUser!.purchasedMaterialIds.filter(id => id !== action.payload)
        }
      };

    case 'BECOME_PARTNER':
      return {
        ...state,
        currentUser: { ...state.currentUser!, isPartner: true, role: 'partner' }
      };

    case 'FINISH_LOADING':
      return { ...state, isLoading: false };

    default:
      return state;
  }
}

interface AuthContextType extends AuthState {
  login: (user: UserProfile | null, token?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  addXp: (amount: number) => void;
  toggleSavedQuestion: (id: string) => void;
  addSimulation: (sim: SimulationSession) => void;
  purchaseMaterial: (id: string) => void;
  removeMaterialAccess: (id: string) => void;
  becomePartner: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider oficial de autenticação da plataforma.
 * Ele monta a sessão consumida por rotas, layout, checkout, rankings, simulados e painel administrativo.
 * @since 1.0.0
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { addToast } = useToast();
  
  /**
   * Escuta o estado global da sessão e executa o bootstrap inicial ao subir o app.
   * Essa ponte liga o provider visual ao mecanismo central de sessão em `services/auth/session`.
   * @since 1.0.0
   */
  React.useEffect(() => {
    const unsubscribe = subscribeToAuthSession((snapshot) => {
      if (!snapshot.isBootstrapped) {
        return;
      }

      if (snapshot.currentUser) {
        dispatch({ type: 'LOGIN', payload: snapshot.currentUser });
      } else {
        dispatch({ type: 'LOGOUT' });
      }
    });

    void bootstrapAuthSession().catch((error) => {
      console.error('Failed to bootstrap auth session:', error);
      dispatch({ type: 'LOGOUT' });
    });

    return unsubscribe;
  }, []);

  /**
   * Conclui o login no provider a partir do token e do usuário recebidos pelo fluxo de auth.
   * @since 1.0.0
   */
  const login = React.useCallback(async (payload: UserProfile | null, token?: string | null) => {
    await establishAuthenticatedSession(token, payload ?? undefined);
  }, []);

  /**
   * Inicia o logout remoto e local do usuário atual.
   * @since 1.0.0
   */
  const logout = React.useCallback(async () => {
    await logoutAuthSession();
  }, []);

  /**
   * Atualiza o perfil em modo otimista e persiste a mudanca no backend.
   * Esse fluxo abastece pagina de perfil, onboarding e ajustes de conta.
   * @since 1.0.0
   */
  const updateUser = React.useCallback((payload: Partial<UserProfile>): Promise<void> => {
    return new Promise((resolve, reject) => {
      const sanitizedPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined),
      ) as Partial<UserProfile>;

      dispatch({ type: 'UPDATE_USER', payload: sanitizedPayload });

      if (!state.currentUser) {
        resolve();
        return;
      }

      const nextUser = { ...state.currentUser, ...sanitizedPayload };
      updateCurrentUserSnapshot(nextUser);

      const editablePayload = Object.fromEntries(
        Object.entries(sanitizedPayload).filter(([key]) =>
          EDITABLE_PROFILE_FIELDS.includes(key as keyof UserProfile),
        ),
      ) as Partial<UserProfile>;

      if (Object.keys(editablePayload).length === 0) {
        resolve();
        return;
      }

      accountService.updateUserProfile(editablePayload)
        .then((result) => {
          addToast(result.message || 'Perfil atualizado com sucesso!', 'success');
          resolve();
        })
        .catch(err => {
          console.error('Failed to update user profile', err);
          const errorMessage = err.response?.data?.message || err.message || 'Erro ao atualizar perfil. Tente novamente.';
          addToast(errorMessage, 'error');
          reject(err);
        });
    });
  }, [addToast, state.currentUser]);

  /**
   * Soma XP localmente e dispara notificações de recompensa e level up.
   * Essa funcao conecta pratica, simulados e evolução do usuário no site.
   * @since 1.0.0
   */
  const addXp = React.useCallback((payload: number) => {
    const user = state.currentUser;
    if (!user) return;

    const previousLevel = user.level || 1;
    const newTotalXp = (user.xp || 0) + payload;
    const newLevel = Math.floor(newTotalXp / XP_PER_LEVEL) + 1;

    dispatch({ type: 'ADD_XP', payload });
    updateCurrentUserSnapshot({ ...user, xp: newTotalXp, level: newLevel });

    if (payload > 0) {
      notificationService.sendNotification(
        user.id,
        `+${payload} XP Recebido!`,
        `Você ganhou ${payload} pontos de experiencia. Continue assim!`,
        'info',
        'system',
      ).catch(err => console.warn('Falha ao criar notificação de XP:', err));
    }

    if (newLevel > previousLevel) {
      const milestoneMsg = LEVEL_MILESTONES[newLevel];
      const title = `Subiu para o Nivel ${newLevel}!`;
      const message = milestoneMsg || `Parabens! Você alcancou o Nivel ${newLevel}.`;

      notificationService.sendNotification(
        user.id,
        title,
        message,
        'success',
        'system',
        '/profile/personal',
      ).catch(err => console.warn('Falha ao criar notificação de level up:', err));
    }
  }, [state.currentUser]);

  /**
   * Alterna o estado de salvar questão para a sessão atual.
   * Mantem o app responsivo enquanto sincroniza o favorito no backend.
   * @since 1.0.0
   */
  const toggleSavedQuestion = React.useCallback((payload: string) => {
    dispatch({ type: 'TOGGLE_SAVED', payload });

    if (state.currentUser) {
      questionService.toggleSavedQuestion(state.currentUser.id, payload).catch(err => {
        console.error('Failed to toggle save', err);
      });
    }
  }, [state.currentUser]);

  /**
   * Registra um simulado no estado local e o envia para persistencia oficial.
   * @since 1.0.0
   */
  const addSimulation = React.useCallback((payload: SimulationSession) => {
    dispatch({ type: 'ADD_SIMULATION', payload });

    if (!state.currentUser?.id) {
      return;
    }

    simulationsService.saveSimulation(payload)
        .catch(e => console.error('Failed to save sim', e));
  }, [state.currentUser?.id]);

  /**
   * Libera localmente o acesso a um material comprado.
   * Essa mutação e consumida logo apos transações bem-sucedidas do marketplace.
   * @since 1.0.0
   */
  const purchaseMaterial = React.useCallback((payload: string) => {
    dispatch({ type: 'PURCHASE_MATERIAL', payload });
  }, []);

  /**
   * Revoga localmente o acesso a um material quando um estorno e aprovado.
   * @since 1.0.0
   */
  const removeMaterialAccess = React.useCallback((payload: string) => {
    dispatch({ type: 'REMOVE_MATERIAL', payload });
  }, []);

  /**
   * Promove o usuário atual para parceiro usando o fluxo oficial de conta.
   * @since 1.0.0
   */
  const becomePartner = React.useCallback(() => {
    return new Promise<boolean>((resolve) => {
      if (!state.currentUser) {
        resolve(false);
        return;
      }

      accountService.becomePartner()
        .then(() => {
          dispatch({ type: 'BECOME_PARTNER' });
          updateCurrentUserSnapshot({ ...state.currentUser, isPartner: true, role: 'partner' });
          resolve(true);
        })
        .catch(err => {
          console.error('Failed to update user to partner role', err);
          resolve(false);
        });
    });
  }, [state.currentUser]);

  /**
   * Recarrega o usuário autenticado a partir do token atual em memoria.
   * Usado quando alguma tela precisa refletir dados novos sem reiniciar a sessão.
   * @since 1.0.0
   */
  const refreshUser = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const user = await fetchAuthenticatedUser();
      dispatch({ type: 'LOGIN', payload: user });
    } catch (err) {
      console.error('Failed to refresh user data:', err);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      updateUser,
      addXp,
      toggleSavedQuestion,
      addSimulation,
      purchaseMaterial,
      removeMaterialAccess,
      becomePartner,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook público para ler a sessão autenticada em qualquer ponto do frontend.
 * Ele e consumido por rotas protegidas, components compartilhados e features de dominio.
 * @since 1.0.0
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
