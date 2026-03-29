import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import axios from 'axios';
import { UserProfile, SimulationSession } from '../types';
import { apiClient, ENDPOINTS } from '@core/api';
import {
  clearStoredSession,
  clearStoredUser,
  getRawStoredToken,
  getStoredToken,
  setStoredToken,
  setStoredUser,
} from '@core/auth/session';
import { useToast } from './ToastContext';

const XP_PER_LEVEL = 1000;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost/questao-pro-backend/api/';

interface AuthState {
  currentUser: UserProfile | null;
  isLoading: boolean;
}

const initialState: AuthState = {
  currentUser: null,
  isLoading: true,
};

const createInitialState = (_state: AuthState = initialState): AuthState => {
  const token = getStoredToken();

  return {
    currentUser: null,
    isLoading: !!token,
  };
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
          purchasedMaterialIds: action.payload.purchasedMaterialIds || [],
        },
      };

    case 'LOGOUT':
      return { ...state, currentUser: null, isLoading: false };

    case 'UPDATE_USER':
      return {
        ...state,
        currentUser: { ...state.currentUser!, ...action.payload },
      };

    case 'ADD_XP': {
      const user = state.currentUser!;
      const totalXp = user.xp + action.payload;
      const newLevel = Math.floor(totalXp / XP_PER_LEVEL) + 1;

      return {
        ...state,
        currentUser: { ...user, xp: totalXp, level: newLevel },
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
            ? user.savedQuestionIds.filter((id) => id !== action.payload)
            : [...user.savedQuestionIds, action.payload],
        },
      };
    }

    case 'ADD_SIMULATION':
      return {
        ...state,
        currentUser: { ...state.currentUser!, simulations: [action.payload, ...state.currentUser!.simulations] },
      };

    case 'PURCHASE_MATERIAL':
      return {
        ...state,
        currentUser: {
          ...state.currentUser!,
          purchasedMaterialIds: [...state.currentUser!.purchasedMaterialIds, action.payload],
        },
      };

    case 'REMOVE_MATERIAL':
      return {
        ...state,
        currentUser: {
          ...state.currentUser!,
          purchasedMaterialIds: state.currentUser!.purchasedMaterialIds.filter((id) => id !== action.payload),
        },
      };

    case 'BECOME_PARTNER':
      return {
        ...state,
        currentUser: { ...state.currentUser!, isPartner: true, role: 'partner' },
      };

    case 'FINISH_LOADING':
      return { ...state, isLoading: false };

    default:
      return state;
  }
}

interface AuthContextType extends AuthState {
  login: (user: UserProfile) => void;
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

const buildAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'X-Auth-Token': token,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState, createInitialState);
  const { addToast } = useToast();

  React.useEffect(() => {
    if (state.currentUser) {
      setStoredUser(state.currentUser);
      return;
    }

    clearStoredUser();
  }, [state.currentUser]);

  const renewToken = React.useCallback(async (): Promise<string | null> => {
    try {
      const token = getRawStoredToken();
      if (!token) return null;

      const response = await axios.get(`${API_BASE_URL}${ENDPOINTS.auth.refresh}`, {
        headers: buildAuthHeaders(token),
        timeout: 15000,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 401,
      });

      if (response.status !== 200) {
        return null;
      }

      const refreshedToken = response.data?.data?.token || response.data?.token || null;
      if (refreshedToken) {
        setStoredToken(refreshedToken);
        return refreshedToken;
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  const bootstrapSession = React.useCallback(async (bootstrapToken: string) => {
    const response = await axios.get(`${API_BASE_URL}${ENDPOINTS.auth.user}`, {
      headers: buildAuthHeaders(bootstrapToken),
      timeout: 15000,
      validateStatus: (status) => (status >= 200 && status < 300) || status === 401,
    });

    if (response.status !== 200) {
      return null;
    }

    return response.data?.success && response.data?.data?.user
      ? (response.data.data.user as UserProfile)
      : null;
  }, []);

  React.useEffect(() => {
    const token = getStoredToken();

    if (!token) {
      dispatch({ type: 'FINISH_LOADING' });
      return;
    }

    let cancelled = false;
    const restoredToken = token;

    bootstrapSession(restoredToken)
      .then(async (user) => {
        if (cancelled) return;

        const latestToken = getRawStoredToken();
        if (latestToken && latestToken !== restoredToken) {
          return;
        }

        if (user) {
          dispatch({ type: 'LOGIN', payload: user });
          await renewToken();
          return;
        }

        clearStoredSession();
        dispatch({ type: 'FINISH_LOADING' });
      })
      .catch(() => {
        if (cancelled) return;

        const latestToken = getRawStoredToken();
        if (latestToken && latestToken !== restoredToken) {
          return;
        }

        clearStoredSession();
        dispatch({ type: 'FINISH_LOADING' });
      });

    return () => {
      cancelled = true;
    };
  }, [bootstrapSession, renewToken]);

  React.useEffect(() => {
    if (!state.currentUser) return;

    const intervalId = setInterval(() => {
      renewToken().catch(() => undefined);
    }, 20 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [state.currentUser, renewToken]);

  const login = (payload: UserProfile) => {
    dispatch({ type: 'LOGIN', payload });
  };

  const logout = () => {
    clearStoredSession();
    dispatch({ type: 'LOGOUT' });
  };

  const updateUser = (payload: Partial<UserProfile>): Promise<void> => {
    return new Promise((resolve, reject) => {
      dispatch({ type: 'UPDATE_USER', payload });

      if (!state.currentUser) {
        resolve();
        return;
      }

      apiClient
        .post(ENDPOINTS.users.update, {
          id: state.currentUser.id,
          ...payload,
        })
        .then((res: any) => {
          addToast(res.message || 'Perfil atualizado com sucesso!', 'success');
          resolve();
        })
        .catch((err) => {
          console.error('Failed to update user profile', err);
          const errorMessage = err.response?.data?.message || err.message || 'Erro ao atualizar perfil. Tente novamente.';
          addToast(errorMessage, 'error');
          reject(err);
        });
    });
  };

  const LEVEL_MILESTONES: Record<number, string> = {
    5: 'Impressionante! Voce atingiu o Nivel 5, continue se dedicando.',
    10: 'Nivel 10 alcancado! Voce esta entre os mais dedicados da plataforma.',
    25: 'Nivel 25! Uma conquista rara, parabens.',
    50: 'Nivel 50! Voce e uma lenda no ConcursoMestre.',
  };

  const addXp = (payload: number) => {
    const user = state.currentUser;
    if (!user) return;

    const previousLevel = user.level || 1;
    const newTotalXp = (user.xp || 0) + payload;
    const newLevel = Math.floor(newTotalXp / XP_PER_LEVEL) + 1;

    dispatch({ type: 'ADD_XP', payload });

    if (payload > 0) {
      apiClient
        .post('notifications/send.php', {
          user_id: user.id,
          title: `+${payload} XP Recebido!`,
          message: `Voce ganhou ${payload} pontos de experiencia. Continue assim!`,
          type: 'info',
          category: 'system',
        })
        .catch((err) => console.warn('Falha ao criar notificacao de XP:', err));
    }

    if (newLevel > previousLevel) {
      const milestoneMsg = LEVEL_MILESTONES[newLevel];
      const title = `Subiu para o Nivel ${newLevel}!`;
      const message =
        milestoneMsg ||
        `Parabens! Voce alcancou o Nivel ${newLevel}. Continue respondendo questoes para avancar ainda mais!`;

      apiClient
        .post('notifications/send.php', {
          user_id: user.id,
          title,
          message,
          type: 'success',
          category: 'system',
          link: '/profile?tab=evolution',
        })
        .catch((err) => console.warn('Falha ao criar notificacao de level up:', err));
    }
  };

  const toggleSavedQuestion = (payload: string) => {
    dispatch({ type: 'TOGGLE_SAVED', payload });

    if (state.currentUser) {
      apiClient
        .post(ENDPOINTS.questions.toggleSave, {
          user_id: state.currentUser.id,
          question_id: payload,
        })
        .catch((err) => {
          console.error('Failed to toggle save', err);
        });
    }
  };

  const addSimulation = (payload: SimulationSession) => {
    dispatch({ type: 'ADD_SIMULATION', payload });

    apiClient
      .post(ENDPOINTS.simulations.create, {
        ...payload,
        user_id: state.currentUser?.id,
      })
      .catch((err) => console.error('Failed to save sim', err));
  };

  const purchaseMaterial = (payload: string) => dispatch({ type: 'PURCHASE_MATERIAL', payload });
  const removeMaterialAccess = (payload: string) => dispatch({ type: 'REMOVE_MATERIAL', payload });

  const becomePartner = () => {
    return new Promise<boolean>((resolve) => {
      if (!state.currentUser) {
        resolve(false);
        return;
      }

      apiClient
        .post(ENDPOINTS.users.update, {
          id: state.currentUser.id,
          role: 'partner',
        })
        .then(() => {
          dispatch({ type: 'BECOME_PARTNER' });
          resolve(true);
        })
        .catch((err) => {
          console.error('Failed to update user to partner role', err);
          resolve(false);
        });
    });
  };

  const refreshUser = async () => {
    const token = getStoredToken();
    if (!token) return;

    try {
      const user = await bootstrapSession(token);
      if (user) {
        dispatch({ type: 'LOGIN', payload: user });
        return;
      }

      clearStoredSession();
      dispatch({ type: 'LOGOUT' });
    } catch (err) {
      console.error('Failed to refresh user data:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
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
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
