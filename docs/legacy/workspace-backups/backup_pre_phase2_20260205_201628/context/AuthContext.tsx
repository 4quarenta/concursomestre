import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { UserProfile, SimulationSession, Address } from '../types';
import { api } from '../data/api';

// --- CONSTANTS ---
const XP_PER_LEVEL = 1000;

interface AuthState {
  currentUser: UserProfile | null;
}

const initialState: AuthState = {
  currentUser: null
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
  | { type: 'BECOME_PARTNER' };

// --- REDUCER ---

function authReducer(state: AuthState, action: AuthAction): AuthState {
  if (!state.currentUser && action.type !== 'LOGIN') return state;

  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        currentUser: {
          ...action.payload,
          savedQuestionIds: action.payload.savedQuestionIds || [],
          simulations: action.payload.simulations || [],
          purchasedMaterialIds: action.payload.purchasedMaterialIds || []
        }
      };

    case 'LOGOUT':
      return { ...state, currentUser: null };

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
        currentUser: { ...state.currentUser!, isPartner: true }
      };

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
  becomePartner: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const login = (payload: UserProfile) => dispatch({ type: 'LOGIN', payload });
  const logout = () => dispatch({ type: 'LOGOUT' });
  const updateUser = (payload: Partial<UserProfile>) => dispatch({ type: 'UPDATE_USER', payload });
  const addXp = (payload: number) => dispatch({ type: 'ADD_XP', payload });
  const toggleSavedQuestion = (payload: string) => {
    dispatch({ type: 'TOGGLE_SAVED', payload });
    // Persist to API
    if (state.currentUser) {
      api.post('api/questions/toggle_save.php', {
        user_id: state.currentUser.id,
        question_id: payload
      }).catch(err => {
        console.error("Failed to toggle save", err);
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
    api.post('api/simulations/create.php', apiPayload)
      .catch(e => console.error("Failed to save sim", e));
  };
  const purchaseMaterial = (payload: string) => dispatch({ type: 'PURCHASE_MATERIAL', payload });
  const removeMaterialAccess = (payload: string) => dispatch({ type: 'REMOVE_MATERIAL', payload });
  const becomePartner = () => dispatch({ type: 'BECOME_PARTNER' });

  return (
    <AuthContext.Provider value={{
      ...state, login, logout, updateUser, addXp, toggleSavedQuestion, addSimulation, purchaseMaterial, removeMaterialAccess, becomePartner
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