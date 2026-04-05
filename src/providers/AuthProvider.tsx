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

interface AuthState {
  currentUser: UserProfile | null;
  isLoading: boolean;
}

const initialState: AuthState = {
  currentUser: null,
  isLoading: true
};

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
 * Reducer central da sessao autenticada.
 * Ele consolida mutacoes de usuario que abastecem todo o site, incluindo perfil, XP, simulados e materiais comprados.
 * @since v1.0.0
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
  logout: () => void;
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
 * Provider oficial de autenticacao da plataforma.
 * Ele monta a sessao consumida por rotas, layout, checkout, rankings, simulados e painel administrativo.
 * @since v1.0.0
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { addToast } = useToast();
  
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

  const login = React.useCallback(async (payload: UserProfile | null, token?: string | null) => {
    await establishAuthenticatedSession(token, payload ?? undefined);
  }, []);

  const logout = React.useCallback(() => {
    void logoutAuthSession();
  }, []);

  const updateUser = React.useCallback((payload: Partial<UserProfile>): Promise<void> => {
    return new Promise((resolve, reject) => {
      dispatch({ type: 'UPDATE_USER', payload });

      if (!state.currentUser) {
        resolve();
        return;
      }

      const nextUser = { ...state.currentUser, ...payload };
      updateCurrentUserSnapshot(nextUser);

      accountService.updateUserProfile(payload)
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

  const LEVEL_MILESTONES: Record<number, string> = {
    5: 'Impressionante! Voce atingiu o Nivel 5.',
    10: 'Nivel 10 alcancado! Voce esta entre os mais dedicados da plataforma.',
    25: 'Nivel 25! Uma conquista rara.',
    50: 'Nivel 50! Voce virou lenda no ConcursoMestre.',
  };

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
        `Voce ganhou ${payload} pontos de experiencia. Continue assim!`,
        'info',
        'system',
      ).catch(err => console.warn('Falha ao criar notificacao de XP:', err));
    }

    if (newLevel > previousLevel) {
      const milestoneMsg = LEVEL_MILESTONES[newLevel];
      const title = `Subiu para o Nivel ${newLevel}!`;
      const message = milestoneMsg || `Parabens! Voce alcancou o Nivel ${newLevel}.`;

      notificationService.sendNotification(
        user.id,
        title,
        message,
        'success',
        'system',
        '/profile?tab=evolution',
      ).catch(err => console.warn('Falha ao criar notificacao de level up:', err));
    }
  }, [state.currentUser]);

  const toggleSavedQuestion = React.useCallback((payload: string) => {
    dispatch({ type: 'TOGGLE_SAVED', payload });

    if (state.currentUser) {
      questionService.toggleSavedQuestion(state.currentUser.id, payload).catch(err => {
        console.error('Failed to toggle save', err);
      });
    }
  }, [state.currentUser]);

  const addSimulation = React.useCallback((payload: SimulationSession) => {
    dispatch({ type: 'ADD_SIMULATION', payload });

    if (!state.currentUser?.id) {
      return;
    }

    simulationsService.saveSimulation(payload)
        .catch(e => console.error('Failed to save sim', e));
  }, [state.currentUser?.id]);

  const purchaseMaterial = React.useCallback((payload: string) => {
    dispatch({ type: 'PURCHASE_MATERIAL', payload });
  }, []);

  const removeMaterialAccess = React.useCallback((payload: string) => {
    dispatch({ type: 'REMOVE_MATERIAL', payload });
  }, []);

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
 * Hook publico para ler a sessao autenticada em qualquer ponto do frontend.
 * Ele e consumido por rotas protegidas, components compartilhados e features de dominio.
 * @since v1.0.0
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
