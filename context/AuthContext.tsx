import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { UserProfile, SimulationSession, Address } from '../types';
import { apiClient, ENDPOINTS } from '@core/api';
import { useToast } from './ToastContext';

// --- CONSTANTS ---
const XP_PER_LEVEL = 1000;

interface AuthState {
  currentUser: UserProfile | null;
  isLoading: boolean;
}

const initialState: AuthState = {
  currentUser: null,
  isLoading: true
};

const normalizeStoredToken = (value: string | null | undefined): string | null => {
  if (!value) return null;

  let normalized = value.trim();
  if (!normalized) return null;

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    return null;
  }

  return normalized;
};

const clearStoredSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// --- ACTIONS ---

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

// --- REDUCER ---

function authReducer(state: AuthState, action: AuthAction): AuthState {
  // Guard: ignora ações que dependem de usuário logado, exceto LOGIN, FINISH_LOADING e LOGOUT
  if (!state.currentUser && action.type !== 'LOGIN' && action.type !== 'FINISH_LOADING' && action.type !== 'LOGOUT') return state;

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
        currentUser: { ...state.currentUser!, simulations: [action.payload, ...state.currentUser!.simulations] }
      };

    case 'PURCHASE_MATERIAL':
      return {
        ...state,
        currentUser: { ...state.currentUser!, purchasedMaterialIds: [...state.currentUser!.purchasedMaterialIds, action.payload] }
      };

    case 'REMOVE_MATERIAL':
      return {
        ...state,
        currentUser: { ...state.currentUser!, purchasedMaterialIds: state.currentUser!.purchasedMaterialIds.filter(id => id !== action.payload) }
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

// --- CONTEXT ---

interface AuthContextType extends AuthState {
  login: (user: UserProfile) => void;
  logout: () => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  addXp: (amount: number) => void;
  toggleSavedQuestion: (id: string) => void;
  addSimulation: (sim: SimulationSession) => void;
  purchaseMaterial: (id: string) => void;
  removeMaterialAccess: (id: string) => void;
  becomePartner: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { addToast } = useToast();
  const restoreTokenRef = React.useRef<string | null>(null);

  // Restaura sessão no mount verificando token salvo
  React.useEffect(() => {
    const rawToken = localStorage.getItem('token');
    const token = normalizeStoredToken(rawToken);

    if (rawToken && !token) {
      clearStoredSession();
      dispatch({ type: 'FINISH_LOADING' });
      return;
    }
    if (token) {
      restoreTokenRef.current = token;
      apiClient.get(ENDPOINTS.auth.user)
        .then((res: any) => {
          const latestToken = normalizeStoredToken(localStorage.getItem('token'));
          if (latestToken !== restoreTokenRef.current) {
            dispatch({ type: 'FINISH_LOADING' });
            return;
          }

          if (res.success && res.data && res.data.user) {
            dispatch({ type: 'LOGIN', payload: res.data.user });
            // Renova o token imediatamente ao restaurar sessão
            renovarToken();
          } else {
            clearStoredSession();
            dispatch({ type: 'FINISH_LOADING' });
          }
        })
        .catch(() => {
          const latestToken = normalizeStoredToken(localStorage.getItem('token'));
          if (latestToken === restoreTokenRef.current) {
            clearStoredSession();
          }
          dispatch({ type: 'FINISH_LOADING' });
        });
    } else {
      dispatch({ type: 'FINISH_LOADING' });
    }
  }, []);

  // Função auxiliar para renovar o token silenciosamente
  const renovarToken = async () => {
    try {
      const requestToken = normalizeStoredToken(localStorage.getItem('token'));
      if (!requestToken) return;

      const res: any = await apiClient.get(ENDPOINTS.auth.refresh);
      const renewedToken = normalizeStoredToken(res?.data?.token ?? null);
      const currentToken = normalizeStoredToken(localStorage.getItem('token'));

      if (renewedToken && currentToken === requestToken) {
        localStorage.setItem('token', renewedToken);
      }
    } catch {
      // Falha silenciosa — o token existente ainda pode ser válido
    }
  };

  // Auto-renova o token a cada 20 minutos (token expira em 24h)
  React.useEffect(() => {
    if (!state.currentUser) return;
    const intervalo = setInterval(renovarToken, 20 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, [state.currentUser]);


  const login = (payload: UserProfile) => {
    // Save token if passed in payload? No, login.php returns token separately.
    // But Auth.tsx handles saving token to localStorage?
    // Let's assume Auth.tsx saves token.
    dispatch({ type: 'LOGIN', payload });
  };

  const logout = () => {
    clearStoredSession();
    dispatch({ type: 'LOGOUT' });
  };

  const updateUser = (payload: Partial<UserProfile>): Promise<void> => {
    return new Promise((resolve, reject) => {
      dispatch({ type: 'UPDATE_USER', payload });

      // Persist to API
      if (state.currentUser) {
        apiClient.post(ENDPOINTS.users.update, {
          id: state.currentUser.id,
          ...payload
        })
          .then((res: any) => {
            addToast(res.message || 'Perfil atualizado com sucesso!', 'success');
            resolve();
          })
          .catch(err => {
            console.error('Failed to update user profile', err);
            const errorMessage = err.response?.data?.message || err.message || 'Erro ao atualizar perfil. Tente novamente.';
            addToast(errorMessage, 'error');
            reject(err);
          });
      } else {
        resolve(); // Or reject if user must be present
      }
    });
  };
  // Marcos de nível especiais com mensagem personalizada
  const LEVEL_MILESTONES: Record<number, string> = {
    5: '🌟 Impressionante! Você atingiu o Nível 5 — continue se dedicando!',
    10: '🔥 Nível 10 alcançado! Você está entre os mais dedicados da plataforma.',
    25: '💎 Nível 25! Uma conquista rara — parabéns, você é incrível!',
    50: '🏆 NÍVEL 50! Você é uma lenda no ConcursoMestre!',
  };

  const addXp = (payload: number) => {
    const user = state.currentUser;
    if (!user) return;

    const previousLevel = user.level || 1;
    const newTotalXp = (user.xp || 0) + payload;
    const newLevel = Math.floor(newTotalXp / XP_PER_LEVEL) + 1;

    // Atualiza o state imediatamente
    dispatch({ type: 'ADD_XP', payload });

    // Notificação de XP Ganho
    if (payload > 0) {
      apiClient.post('notifications/send.php', {
        user_id: user.id,
        title: `✨ +${payload} XP Recebido!`,
        message: `Você ganhou ${payload} pontos de experiência. Continue assim!`,
        type: 'info',
        category: 'system'
      }).catch(err => console.warn('Falha ao criar notificação de XP:', err));
    }

    // Detecta subida de nível e envia notificação via backend
    if (newLevel > previousLevel) {
      const milestoneMsg = LEVEL_MILESTONES[newLevel];
      const title = `🎉 Subiu para o Nível ${newLevel}!`;
      const message = milestoneMsg || `Parabéns! Você alcançou o Nível ${newLevel}. Continue respondendo questões para avançar ainda mais!`;

      apiClient.post('notifications/send.php', {
        user_id: user.id,
        title,
        message,
        type: 'success',
        category: 'system',
        link: '/profile?tab=evolution',
      }).catch(err => console.warn('Falha ao criar notificação de level up:', err));
    }
  };
  const toggleSavedQuestion = (payload: string) => {
    dispatch({ type: 'TOGGLE_SAVED', payload });
    // Persist to API
    if (state.currentUser) {
      apiClient.post(ENDPOINTS.questions.toggleSave, {
        user_id: state.currentUser.id,
        question_id: payload
      }).catch(err => {
        console.error('Failed to toggle save', err);
        // Optionally revert state here or show toast
      });
    }
  };
  const addSimulation = (payload: SimulationSession) => {
    dispatch({ type: 'ADD_SIMULATION', payload });
    // Persist to API
    // We assume payload has user_id or we use current state user
    // Ideally we pass the full object.
    const apiPayload = {
      ...payload,
      user_id: state.currentUser?.id
    };
    // Fire and forget (or handle error via toast)
    apiClient.post(ENDPOINTS.simulations.create, apiPayload)
      .catch(e => console.error("Failed to save sim", e));
  };
  const purchaseMaterial = (payload: string) => dispatch({ type: 'PURCHASE_MATERIAL', payload });
  const removeMaterialAccess = (payload: string) => dispatch({ type: 'REMOVE_MATERIAL', payload });
  const becomePartner = () => {
    return new Promise<boolean>((resolve) => {
      if (state.currentUser) {
        apiClient.post(ENDPOINTS.users.update, {
          id: state.currentUser.id,
          role: 'partner'
        })
          .then(() => {
            dispatch({ type: 'BECOME_PARTNER' });
            resolve(true);
          })
          .catch(err => {
            console.error('Failed to update user to partner role', err);
            resolve(false);
          });
      } else {
        resolve(false);
      }
    });
  };

  const refreshUser = async () => {
    const token = normalizeStoredToken(localStorage.getItem('token'));
    if (token) {
      try {
        const res: any = await apiClient.get(ENDPOINTS.auth.user);
        if (res.success && res.data && res.data.user) {
          dispatch({ type: 'LOGIN', payload: res.data.user });
        }
      } catch (err) {
        console.error('Failed to refresh user data:', err);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      ...state, login, logout, updateUser, addXp, toggleSavedQuestion, addSimulation, purchaseMaterial, removeMaterialAccess, becomePartner, refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
