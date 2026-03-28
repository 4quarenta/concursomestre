
import React, { createContext, useContext, useReducer, ReactNode, useEffect, useRef } from 'react';
import {
  Question, UserAnswer, UserNote, ErrorReport, Comment,
  Difficulty, UserProfile, SystemSettings, DiscountCode, Notification, Ranking, RankingEntry
} from '../types';
// import { MOCK_QUESTIONS } from '../data/questions'; // Mock Removed
import { PRICING, PLAN_DETAILS } from '../constants';
import { notificationService } from '../services/notificationService';
import { reputationService } from '../services/reputationService';
import { commentService } from '../services/commentService';
import { questionService } from '../services/questionService';

import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { api } from '../data/api';

// --- INITIAL STATE ---

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  activeTheme: 'default',
  pricing: {
    Gratuito: { ...PRICING.Gratuito, quarterlyDiscountPercent: 0, annualDiscountPercent: 0 },
    Essencial: { ...PRICING.Essencial, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
    Pro: { ...PRICING.Pro, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
    Elite: { ...PRICING.Elite, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
  },
  planDetails: PLAN_DETAILS,
  activePromotion: {
    isActive: false,
    name: 'Black Friday',
    slug: 'black-friday',
    discountPercentage: 30,
    bannerText: '🔥 30% OFF em todos os planos anuais!',
    themeColor: '#000000',
    landingPageTitle: 'Aprovação Garantida',
    landingPageHeadline: 'Promoção Exclusiva',
    landingPageSubheadline: 'Descontos imperdíveis nos planos Pro e Elite.',
    featuresHighlight: ['IA Ilimitada', 'Raio-X da Banca', 'Simulados']
  },
  coupons: [
    { code: 'BEMVINDO10', discountPercentage: 10, uses: 15, maxUses: 100 },
  ],
  features: {
    practiceEnabled: true,
    marketplaceEnabled: true,
    rankingsEnabled: true,
    communityEnabled: true,
    aiCommentsEnabled: true,
    bulkImportEnabled: true,
    reportsEnabled: true,
    notificationsEnabled: true,
    maintenanceMode: false,
    registrationEnabled: true,
    landingPagePromoEnabled: true,
    xRayEnabled: true,
    loginRequired: true
  },
  geminiApiKey: ''
};

interface DataState {
  questions: Question[];
  users: UserProfile[];
  userAnswers: UserAnswer[];
  userNotes: UserNote[];
  reports: ErrorReport[];
  systemSettings: SystemSettings;
  notifications: Notification[];
  rankings: Ranking[];
}

// 30 Days in ms
const REPORT_RETENTION_PERIOD = 30 * 24 * 60 * 60 * 1000;

const initialState: DataState = {
  questions: [], // MOCK_QUESTIONS replaced by empty array
  users: [],
  userAnswers: [],
  userNotes: [],
  reports: [],
  systemSettings: DEFAULT_SYSTEM_SETTINGS,
  notifications: [],
  rankings: []
};



// --- ACTIONS ---

type DataAction =
  | { type: 'SUBMIT_ANSWER'; payload: UserAnswer }
  | { type: 'ADD_QUESTION'; payload: Question }
  | { type: 'ADD_QUESTIONS'; payload: Question[] }
  | { type: 'UPDATE_QUESTION'; payload: Question }
  | { type: 'DELETE_QUESTION'; payload: number }
  | { type: 'SAVE_NOTE'; payload: { questionId: number; text: string } }
  | { type: 'REPORT_ERROR'; payload: ErrorReport }
  | { type: 'RESOLVE_REPORT'; payload: { id: string; action: 'resolved' | 'ignored' } }
  | { type: 'ADD_COMMENT'; payload: { questionId: number; comment: Comment; parentId?: string } }
  | { type: 'SAVE_QUESTION'; payload: number }
  | { type: 'LIKE_COMMENT'; payload: { questionId: number; commentId: string } }
  | { type: 'RESET_USER_DATA' }
  | { type: 'UPDATE_SYSTEM_SETTINGS'; payload: SystemSettings }
  | { type: 'ADD_COUPON'; payload: DiscountCode }
  | { type: 'DELETE_COUPON'; payload: string }
  | { type: 'UPDATE_USER_STATUS'; payload: { userId: string; updates: Partial<UserProfile> } }
  | { type: 'SET_USER_ANSWERS'; payload: UserAnswer[] }
  | { type: 'RESET_PROGRESS' }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'SET_USERS'; payload: UserProfile[] }
  | { type: 'SET_REPORTS'; payload: ErrorReport[] }
  | { type: 'SET_RANKINGS'; payload: Ranking[] }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'DELETE_NOTIFICATION'; payload: string }
  | { type: 'RESTORE_NOTIFICATION'; payload: string }
  | { type: 'PERMANENT_DELETE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'CLEANUP_OLD_REPORTS' }
  | { type: 'ADD_RANKING'; payload: Ranking }
  | { type: 'UPDATE_RANKING'; payload: Ranking }
  | { type: 'DELETE_RANKING'; payload: string }
  | { type: 'SET_COMMENTS'; payload: { questionId: number; comments: Comment[] } }
  | { type: 'SUBMIT_RANKING_ENTRY'; payload: { rankingId: string; entry: RankingEntry } };

// --- REDUCER ---

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'SUBMIT_ANSWER': {
      const { questionId, isCorrect } = action.payload;

      const newQuestions = state.questions.map(q => {
        if (Number(q.id) === Number(questionId)) {
          const total = q.stats.totalAttempts + 1;
          const correct = q.stats.correctCount + (isCorrect ? 1 : 0);
          const wrong = q.stats.wrongCount + (isCorrect ? 0 : 1);
          const accuracy = correct / total;

          let dificuldade = q.dificuldade;
          if (accuracy > 0.75) dificuldade = 1; // Easy
          else if (accuracy < 0.35) dificuldade = 3; // Hard

          return { ...q, dificuldade, stats: { totalAttempts: total, correctCount: correct, wrongCount: wrong } };
        }
        return q;
      });

      return {
        ...state,
        questions: newQuestions,
        userAnswers: [...state.userAnswers.filter(a => Number(a.questionId) !== Number(questionId)), action.payload]
      };
    }

    case 'ADD_QUESTION':
      return { ...state, questions: [action.payload, ...state.questions] };

    case 'ADD_QUESTIONS': {
      const existingIds = new Set(state.questions.map(q => q.id));
      const uniqueNewQuestions = action.payload.filter(q => !existingIds.has(q.id));
      return { ...state, questions: [...state.questions, ...uniqueNewQuestions] };
    }

    case 'UPDATE_QUESTION':
      return { ...state, questions: state.questions.map(q => q.id === action.payload.id ? action.payload : q) };

    case 'DELETE_QUESTION':
      return {
        ...state,
        questions: state.questions.filter(q => Number(q.id) !== Number(action.payload)),
        userAnswers: state.userAnswers.filter(a => Number(a.questionId) !== Number(action.payload)),
        userNotes: state.userNotes.filter(n => Number(n.questionId) !== Number(action.payload)),
        reports: state.reports.filter(r => Number(r.questionId) !== Number(action.payload))
      };

    case 'SAVE_NOTE': {
      const { questionId, text } = action.payload;
      const filtered = state.userNotes.filter(n => Number(n.questionId) !== Number(questionId));
      if (text.trim() === '') return { ...state, userNotes: filtered };

      const newNote: UserNote = {
        id: `note-${Date.now()}`,
        questionId: Number(questionId),
        text,
        timestamp: Date.now()
      };
      return { ...state, userNotes: [...filtered, newNote] };
    }

    case 'REPORT_ERROR':
      return { ...state, reports: [action.payload, ...state.reports] };

    case 'RESOLVE_REPORT': {
      const now = Date.now();
      return {
        ...state,
        reports: state.reports.map(r => r.id === action.payload.id ? { ...r, status: action.payload.action, resolvedAt: now } : r)
      };
    }

    case 'ADD_COMMENT': {
      const { questionId, comment, parentId } = action.payload;
      return {
        ...state,
        questions: state.questions.map(q => {
          if (Number(q.id) === Number(questionId)) {
            if (parentId) {
              return { ...q, comments: commentService.addReplyToComments(q.comments, parentId, comment) };
            } else {
              return { ...q, comments: [comment, ...q.comments] };
            }
          }
          return q;
        })
      };
    }

    case 'SET_COMMENTS': {
      const { questionId, comments } = action.payload;
      return {
        ...state,
        questions: state.questions.map(q =>
          Number(q.id) === Number(questionId)
            ? { ...q, comments, commentsCount: comments.filter(c => !c.parentId).length }
            : q
        )
      };
    }

    case 'SAVE_QUESTION':
      return {
        ...state,
        questions: state.questions.map(q => {
          if (Number(q.id) === Number(action.payload)) {
            const newIsSaved = !q.isSaved;
            return { ...q, isSaved: newIsSaved, savedCount: (q.savedCount || 0) + (newIsSaved ? 1 : -1) };
          }
          return q;
        })
      };

    case 'LIKE_COMMENT':
      return {
        ...state,
        questions: state.questions.map(q =>
          Number(q.id) === Number(action.payload.questionId)
            ? { ...q, comments: commentService.likeCommentInTree(q.comments, action.payload.commentId) }
            : q
        )
      };

    case 'RESET_USER_DATA':
      return {
        ...state,
        questions: [],
        userAnswers: [],
        userNotes: [],
        reports: [],
        rankings: [],
        notifications: []
      };

    case 'UPDATE_SYSTEM_SETTINGS':
      return { ...state, systemSettings: action.payload };

    case 'ADD_COUPON':
      return {
        ...state,
        systemSettings: { ...state.systemSettings, coupons: [...state.systemSettings.coupons, action.payload] }
      };

    case 'DELETE_COUPON':
      return {
        ...state,
        systemSettings: { ...state.systemSettings, coupons: state.systemSettings.coupons.filter(c => c.code !== action.payload) }
      };

    case 'UPDATE_USER_STATUS':
      return {
        ...state,
        users: state.users.map(u => u.id === action.payload.userId ? { ...u, ...action.payload.updates } : u)
      };

    case 'SET_USER_ANSWERS':
      return { ...state, userAnswers: action.payload };

    case 'RESET_PROGRESS':
      return { ...state, userAnswers: [], userNotes: [] };

    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => n.id === action.payload ? { ...n, isRead: true } : n)
      };

    case 'MARK_ALL_NOTIFICATIONS_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, isRead: true }))
      };

    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications] };

    case 'DELETE_NOTIFICATION':
      return { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, deletedAt: Date.now() } : n) };

    case 'RESTORE_NOTIFICATION':
      return { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, deletedAt: undefined } : n) };

    case 'PERMANENT_DELETE_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.payload) };

    case 'CLEAR_NOTIFICATIONS':
      // Move all visible (non-deleted) to trash
      return { ...state, notifications: state.notifications.map(n => !n.deletedAt ? { ...n, deletedAt: Date.now() } : n) };

    case 'ADD_RANKING':
      return { ...state, rankings: [action.payload, ...state.rankings] };

    case 'UPDATE_RANKING':
      return { ...state, rankings: state.rankings.map(r => r.id === action.payload.id ? action.payload : r) };

    case 'DELETE_RANKING':
      return { ...state, rankings: state.rankings.filter(r => r.id !== action.payload) };

    case 'SUBMIT_RANKING_ENTRY':
      return {
        ...state,
        rankings: state.rankings.map(r =>
          r.id === action.payload.rankingId
            ? { ...r, entries: [...r.entries, action.payload.entry] }
            : r
        )
      };

    // Limpeza automática de relatórios antigos
    case 'CLEANUP_OLD_REPORTS': {
      const now = Date.now();
      return {
        ...state,
        reports: state.reports.filter(r => {
          if (r.status === 'pending') return true;
          if (r.resolvedAt && (now - r.resolvedAt > REPORT_RETENTION_PERIOD)) return false;
          if (!r.resolvedAt && (now - r.timestamp > REPORT_RETENTION_PERIOD)) return false;
          return true;
        }),
        notifications: state.notifications.filter(n => {
          if (!n.deletedAt) return true;
          if (now - n.deletedAt > REPORT_RETENTION_PERIOD) return false;
          return true;
        })
      };
    }

    case 'SET_USERS': return { ...state, users: action.payload };
    case 'SET_REPORTS': return { ...state, reports: action.payload };
    case 'SET_RANKINGS': return { ...state, rankings: action.payload };

    default:
      return state;
  }
}

// --- CONTEXT ---

interface DataContextType extends DataState {
  dispatch: React.Dispatch<DataAction>;
  submitAnswer: (payload: UserAnswer) => void;
  addQuestion: (payload: Question) => Promise<any>;
  addQuestions: (qs: Question[]) => Promise<any>;
  updateQuestion: (q: Question) => Promise<any>;
  deleteQuestion: (id: number) => void;
  toggleSaveQuestion: (id: number) => void;
  saveNote: (qId: number, text: string) => void;
  resetAnswers: () => Promise<void>;
  reportError: (report: Omit<ErrorReport, 'id' | 'status' | 'timestamp'>) => void;
  resolveReport: (id: string, action: 'resolved' | 'ignored', adminReason: string, evidenceUrl?: string) => void;
  addComment: (qId: number, comment: Comment, parentId?: string) => void;
  likeComment: (qId: number, cId: string) => void;
  updateUserStatus: (userId: string, updates: Partial<UserProfile>) => void;
  updateSystemSettings: (settings: SystemSettings) => void;
  addCoupon: (coupon: DiscountCode) => void;
  deleteCoupon: (code: string) => void;
  resetProgress: () => void;

  // Notification Facade
  fetchNotifications: (userId: string) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: (userId: string) => Promise<void>;
  reportComment: (comment_id: string, reason: string, details: string) => Promise<boolean>;
  deleteNotification: (id: string) => Promise<void>;
  restoreNotification: (id: string) => Promise<void>;
  permanentDeleteNotification: (id: string) => Promise<void>;
  clearNotifications: (userId: string) => Promise<void>;
  sendNotification: (userId: string, title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error', category?: 'system' | 'social' | 'marketplace' | 'report', link?: string, evidenceUrl?: string) => Promise<void>;

  // Rankings
  addRanking: (r: Ranking) => void;
  updateRanking: (r: Ranking) => void;
  deleteRanking: (id: string) => void;
  submitRankingEntry: (rId: string, entry: RankingEntry) => void;
  fetchComments: (questionId: number) => Promise<void>;
}

export const DataContext = createContext<DataContextType>({} as DataContextType);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const lastCommentTime = useRef<number>(0);
  const [state, dispatch] = useReducer(dataReducer, initialState);

  // 1. Fetch Questions & User Data
  useEffect(() => {
    const userId = currentUser?.id;
    const params = userId ? { user_id: userId } : {};

    api.get<any>('api/questions/list.php', params)
      .then(response => {
        // Handle pagination structure { data: { rows: [] } }
        const questionsList = response.data?.rows || (Array.isArray(response) ? response : []);

        if (Array.isArray(questionsList)) {
          // Garante que comments seja um array para evitar erros na UI
          const sanitized = questionsList.map((q: any) => ({ ...q, comments: q.comments || [] }));

          dispatch({ type: 'ADD_QUESTIONS', payload: sanitized });

          // Extract User Answers
          if (userId) {
            const loadedAnswers: UserAnswer[] = questionsList
              .filter((q: any) => q.userAnswer)
              .map((q: any) => ({
                questionId: Number(q.id),
                isCorrect: q.userAnswer.isCorrect,
                selectedOptionIndex: q.userAnswer.selectedOptionIndex,
                timestamp: Date.now()
              }));

            if (loadedAnswers.length > 0) {
              dispatch({ type: 'SET_USER_ANSWERS', payload: loadedAnswers });
            }
          }
        }
      })
      .catch(err => {
        console.error("Failed to load questions:", err);
        addToast("Erro ao carregar questões.", "error");
      });
  }, [currentUser?.id]); // Re-fetch ONLY when user ID changes (avoids object ref issues)

  // Clear stale data on user change
  useEffect(() => {
    dispatch({ type: 'RESET_USER_DATA' });
  }, [currentUser?.id]);

  // 2. Global Data Fetch (Settings, Reports, etc.)
  const globalInitRef = useRef(false);
  useEffect(() => {
    if (globalInitRef.current) return;
    globalInitRef.current = true; // Prevent double execution in Strict Mode

    // A. Fetch Settings
    const loadSettings = async () => {
      try {
        const response = await api.get<SystemSettings>('settings.php');

        let settings: SystemSettings | null = null;
        if (response.success && response.data) settings = response.data;
        else if ((response as any).activeTheme) settings = response as any;

        if (settings) {
          // Merge logic to preserve constants
          const mergedSettings: SystemSettings = {
            ...DEFAULT_SYSTEM_SETTINGS,
            ...settings,
            features: {
              ...DEFAULT_SYSTEM_SETTINGS.features,
              ...(settings?.features || {})
            },
            planDetails: DEFAULT_SYSTEM_SETTINGS.planDetails,
            pricing: Object.keys(DEFAULT_SYSTEM_SETTINGS.pricing).reduce((acc, key) => {
              const planKey = key as keyof typeof DEFAULT_SYSTEM_SETTINGS.pricing;
              acc[planKey] = {
                ...DEFAULT_SYSTEM_SETTINGS.pricing[planKey],
                ...(settings?.pricing?.[planKey] || {})
              };
              return acc;
            }, {} as any)
          };

          // B. Fetch Dynamic Filters
          try {
            const filtersRes = await api.get<any>('api/filters/list.php');
            if (filtersRes.success && filtersRes.data) {
              mergedSettings.taxonomies = filtersRes.data;
            }
          } catch (te) {
            console.error("Failed to load dynamic filters:", te);
          }

          dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', payload: mergedSettings });
        }
      } catch (e) { console.error("Failed to load settings from API", e); }
    };

    loadSettings();

    // C. Other Fetches (Reports, Rankings, Users)
    api.get('api/users/list.php')
      .then(data => { if (Array.isArray(data)) dispatch({ type: 'SET_USERS', payload: data }); })
      .catch(err => console.error("Failed to load users:", err));

    api.get('api/reports/list.php')
      .then(data => { if (Array.isArray(data)) dispatch({ type: 'SET_REPORTS', payload: data }); })
      .catch(err => console.error("Failed to load reports:", err));

    api.get('api/rankings/list.php')
      .then(data => { if (Array.isArray(data)) dispatch({ type: 'SET_RANKINGS', payload: data }); })
      .catch(err => console.error("Failed to load rankings:", err));
  }, []);

  // 3. Fetch Notifications with Adaptive Polling
  useEffect(() => {
    if (!currentUser?.id) return;

    // Initial fetch
    fetchNotifications(currentUser.id);

    // Adaptive polling: faster when active, slower when idle
    let pollInterval = 60000; // Start at 60 seconds
    let isUserActive = true;
    let activityTimeout: NodeJS.Timeout;

    const resetActivity = () => {
      isUserActive = true;
      pollInterval = 30000; // 30 seconds when active
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        isUserActive = false;
        pollInterval = 120000; // 2 minutes when idle
      }, 300000); // 5 minutes of inactivity
    };

    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetActivity, { passive: true });
    });

    // Page visibility optimization
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pollInterval = 300000; // 5 minutes when tab is hidden
      } else {
        pollInterval = 30000; // 30 seconds when tab is visible
        fetchNotifications(currentUser.id); // Immediate fetch when returning
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Use recursive setTimeout with proper cleanup to support dynamic intervals
    let pollTimeoutId: NodeJS.Timeout;
    const poll = () => {
      if (!document.hidden || isUserActive) {
        fetchNotifications(currentUser.id);
      }
      // Schedule next poll with current interval value
      pollTimeoutId = setTimeout(poll, pollInterval);
    };

    // Start polling after initial interval
    pollTimeoutId = setTimeout(poll, pollInterval);

    return () => {
      clearTimeout(pollTimeoutId);
      clearTimeout(activityTimeout);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.id]);

  // 3. Cleanup on mount
  useEffect(() => {
    dispatch({ type: 'CLEANUP_OLD_REPORTS' });
  }, []);

  // Facade de dispatch para conveniência
  const submitAnswer = (payload: UserAnswer) => {
    dispatch({ type: 'SUBMIT_ANSWER', payload });

    // Persist to API
    if (currentUser) {
      api.post('api/questions/answer.php', {
        user_id: currentUser.id,
        question_id: payload.questionId,
        selected_option: payload.selectedOptionIndex, // Index of the option
        is_correct: payload.isCorrect,
        time_taken: payload.timeTaken || 0,
        simulation_id: payload.simulationId || null
      }).catch(err => {
        console.error("Failed to save answer", err);
        addToast("Erro ao salvar resposta.", "error");
      });
    }
  };

  const addQuestion = async (payload: Question): Promise<any> => {
    try {
      const res = await questionService.createQuestions([payload]);
      dispatch({ type: 'ADD_QUESTION', payload });
      addToast('Questão adicionada!', 'success');
      return res;
    } catch (error) {
      console.error("Failed to save question:", error);
      addToast('Erro ao salvar questão no servidor.', 'error');
      throw error;
    }
  };

  const addQuestions = async (payload: Question[]): Promise<any> => {
    try {
      const res = await questionService.createQuestions(payload);
      dispatch({ type: 'ADD_QUESTIONS', payload });
      addToast(`${payload.length} questões importadas!`, 'success');
      return res;
    } catch (error) {
      console.error("Failed to save questions:", error);
      addToast('Erro ao importar questões.', 'error');
      throw error;
    }
  };

  const updateQuestion = async (payload: Question): Promise<any> => {
    try {
      const res = await questionService.createQuestions([payload]);
      dispatch({ type: 'UPDATE_QUESTION', payload });
      addToast('Questão atualizada!', 'success');
      return res;
    } catch (error) {
      console.error("Failed to update question:", error);
      addToast('Erro ao atualizar questão.', 'error');
      throw error;
    }
  };
  const deleteQuestion = (payload: number) => {
    dispatch({ type: 'DELETE_QUESTION', payload });
    addToast('Questão removida.', 'info');
  };



  const toggleSaveQuestion = (questionId: number) => {
    // Check if saving or unsaving? Reducer toggles. Context calls API.
    // We can't know easily without state lookup, but UI usually updates immediately.
    dispatch({ type: 'SAVE_QUESTION', payload: questionId });

    if (currentUser) {
      api.post('api/questions/toggle_save.php', {
        user_id: currentUser.id,
        question_id: questionId
      }).catch(err => {
        console.error("Failed to toggle save", err);
        addToast('Erro ao salvar/remover questão.', 'error');
      });
    } else {
      addToast('Faça login para salvar questões.', 'warning');
    }
  };

  const saveNote = (questionId: number, text: string) => {
    dispatch({ type: 'SAVE_NOTE', payload: { questionId, text } });
    addToast('Nota salva!', 'success');
  };

  const reportError = (report: Omit<ErrorReport, 'id' | 'status' | 'timestamp'>) => {
    const duplicate = state.reports.find(r =>
      r.userName === report.userName &&
      r.status === 'pending' &&
      ((r.targetType === 'question' && r.questionId === report.questionId) ||
        (r.targetType === 'material' && r.materialId === report.materialId))
    );

    if (duplicate) {
      addToast('Já existe uma denúncia pendente para este item.', 'warning');
      return;
    }
    const reportId = `rep-${Date.now()}`;
    const reportWithUser: ErrorReport = { ...report, userId: report.userId || currentUser?.id, id: reportId, status: 'pending', timestamp: Date.now() };
    dispatch({ type: 'REPORT_ERROR', payload: reportWithUser });

    // Notificar Admin
    sendNotification('admin', 'Nova Denúncia', `O usuário ${report.userName} reportou um problema na questão/material.`, 'warning', 'report', `/admin?section=database&tab=reports#${reportId}`);

    addToast('Denúncia enviada com sucesso!', 'success');
  };

  const resolveReport = (id: string, action: 'resolved' | 'ignored', adminReason: string, evidenceUrl?: string) => {
    // 1. Identificar o report original
    const report = state.reports.find(r => r.id === id);
    if (!report) return;

    if (!adminReason || adminReason.trim() === '') {
      addToast('A justificativa da decisão é obrigatória.', 'warning');
      return;
    }

    // 2. Atualizar estado local
    dispatch({ type: 'RESOLVE_REPORT', payload: { id, action } }); // Optimistic

    // 3. Notificar o usuário que fez a denúncia
    const title = action === 'resolved' ? 'Denúncia Aceita' : 'Denúncia Recusada';
    const type = action === 'resolved' ? 'success' : 'info'; // 'error' might be too harsh for ignored
    const message = action === 'resolved'
      ? `Sua denúncia sobre a questão #${report.questionId || report.materialId} foi aceita e corrigida! +50 Pontos.`
      : `Sua denúncia sobre a questão #${report.questionId || report.materialId} foi analisada, mas não procedeu. Motivo: ${adminReason}`;

    sendNotification(report.userName, title, message, type, 'report', undefined, evidenceUrl); // Send based on Name if ID missing? Prefer ID.
    // Ensure report has userId or we fall back to finding user by name (risky) or just name (notification system might need ID)
    // Assuming sendNotification handles logic or report has userId.
    if (report.userId) sendNotification(report.userId, title, message, type, 'report', undefined, evidenceUrl);

    // 4. Se resolvida, conceder recompensa (XP/Reputation)
    if (action === 'resolved' && report.userId) {
      // ... (Reputation logic existing)
    }

    addToast(`Denúncia ${action === 'resolved' ? 'resolvida' : 'ignorada'}.`, 'success');
  };

  const resetAnswers = async () => {
    if (!currentUser) return;
    try {
      await api.post('api/questions/reset_answers.php', { user_id: currentUser.id });
      dispatch({ type: 'RESET_PROGRESS' });
      addToast("Suas respostas foram limpas!", 'success');
    } catch (e) {
      console.error("Failed to reset answers", e);
      addToast('Erro ao limpar respostas.', 'error');
    }
  };

  const addComment = (questionId: number, comment: Comment, parentId?: string) => {
    // Anti-Spam Check
    const now = Date.now();
    if (now - lastCommentTime.current < 5000) { // 5 seconds cooldown
      addToast('Aguarde alguns segundos antes de comentar novamente.', 'warning');
      return;
    }
    lastCommentTime.current = now;

    dispatch({ type: 'ADD_COMMENT', payload: { questionId, comment, parentId } });

    // Persist to Backend
    api.post('api/comments/handle.php', {
      action: 'add',
      questionId,
      comment: { ...comment, date: new Date().toISOString() },
      parentId
    }).then(response => {
      if (!response.success) {
        addToast(response.message || 'Erro ao salvar comentário.', 'error');
      }
    }).catch(err => {
      console.error("Failed to save comment", err);
      addToast('Erro de conexão ao salvar comentário.', 'error');
    });
  };

  const likeComment = (questionId: number, commentId: string) => {
    dispatch({ type: 'LIKE_COMMENT', payload: { questionId, commentId } });

    // Persist to Backend
    if (currentUser) {
      api.post('api/comments/handle.php', {
        action: 'like',
        questionId,
        commentId,
        userId: currentUser.id
      }).then(response => {
        if (!response.success) {
          addToast(response.message || 'Erro ao curtir comentário.', 'error');
        }
      }).catch(err => {
        console.error("Failed to save like", err);
        addToast('Erro de conexão ao curtir comentário.', 'error');
      });
    } else {
      addToast('Faça login para curtir.', 'warning');
    }
  };




  const updateUserStatus = (userId: string, updates: Partial<UserProfile>) => dispatch({ type: 'UPDATE_USER_STATUS', payload: { userId, updates } });


  const updateSystemSettings = (payload: SystemSettings) => {
    dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', payload });
    // Save to Backend
    api.post('settings.php', payload).catch(err => console.error("Failed to save settings", err));
  };

  const addCoupon = (payload: DiscountCode) => dispatch({ type: 'ADD_COUPON', payload });
  const deleteCoupon = (payload: string) => dispatch({ type: 'DELETE_COUPON', payload });
  const resetProgress = () => dispatch({ type: 'RESET_PROGRESS' });

  // Notification Facades
  let isFetchingNotifications = false;

  const fetchNotifications = async (userId: string) => {
    // Prevent concurrent requests
    if (isFetchingNotifications) {
      console.log('[DataContext] Skipping fetchNotifications - already in progress');
      return;
    }

    try {
      isFetchingNotifications = true;
      console.log('[DataContext] Fetching notifications for:', userId);
      const notifs = await notificationService.getUserNotifications(userId);
      dispatch({ type: 'SET_NOTIFICATIONS', payload: notifs });
      console.log('[DataContext] Notifications fetched:', notifs.length);
    } catch (error) {
      console.error('[DataContext] Error fetching notifications:', error);
    } finally {
      isFetchingNotifications = false;
    }
  };

  const markNotificationAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
  };

  const markAllNotificationsAsRead = async (userId: string) => {
    await notificationService.markAllAsRead(userId);
    dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' });
  };

  const deleteNotification = async (id: string) => {
    // Soft Delete
    dispatch({ type: 'DELETE_NOTIFICATION', payload: id });
  };

  const restoreNotification = async (id: string) => {
    dispatch({ type: 'RESTORE_NOTIFICATION', payload: id });
  };

  const permanentDeleteNotification = async (id: string) => {
    dispatch({ type: 'PERMANENT_DELETE_NOTIFICATION', payload: id });
  };

  const clearNotifications = async (userId: string) => {
    await notificationService.clearAll(userId);
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
  };

  const sendNotification = async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', category: 'system' | 'social' | 'marketplace' | 'report' = 'system', link?: string, evidenceUrl?: string) => {
    const notif = await notificationService.sendNotification(userId, title, message, type, category, link, evidenceUrl);
    // Adiciona ao estado apenas se for para o usuário atual ou 'admin' (se current for admin)
    if (currentUser && (userId === currentUser.id || userId === 'all' || (currentUser.isAdmin && userId === 'admin'))) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: notif });
    }
  };

  const addRanking = (payload: Ranking) => {
    // 1. Optimistic Update
    dispatch({ type: 'ADD_RANKING', payload });

    // 2. Persist
    api.post('api/rankings/create.php', payload)
      .then(res => {
        if (!res.success) throw new Error(res.message);
        addToast("Ranking criado com sucesso!", "success");
      })
      .catch(err => {
        console.error("Failed to create ranking:", err);
        addToast("Erro ao criar ranking no servidor.", "error");
        // Rollback? ideally yes, but for now we keep it simple or implement DELETE
        dispatch({ type: 'DELETE_RANKING', payload: payload.id });
      });
  };

  const updateRanking = (payload: Ranking) => dispatch({ type: 'UPDATE_RANKING', payload }); // TODO: backend update
  const deleteRanking = (payload: string) => dispatch({ type: 'DELETE_RANKING', payload }); // TODO: backend delete

  const submitRankingEntry = (rankingId: string, entry: RankingEntry) => {
    dispatch({ type: 'SUBMIT_RANKING_ENTRY', payload: { rankingId, entry } });

    if (currentUser) {
      api.post('api/rankings/join.php', {
        rankingId,
        userId: currentUser.id,
        entry
      }).then(res => {
        if (res.success) addToast("Gabarito enviado!", "success");
        else addToast("Erro ao enviar: " + res.message, "error");
      }).catch(err => {
        console.error(err);
        addToast("Falha de conexão ao enviar gabarito.", "error");
      });
    }
  };

  const reportComment = async (commentId: string, reason: string, details: string) => {
    if (!currentUser) {
      addToast("Você precisa estar logado para reportar.", "warning");
      return false;
    }

    try {
      const response = await api.post(`api/reports/handle.php`, {
        reporter_id: currentUser.id,
        target_type: 'comment',
        target_id: commentId,
        reason,
        details
      });

      if (response.success) {
        addToast("Denúncia enviada com sucesso. Obrigado por ajudar a manter a comunidade limpa!", "success");
        return true;
      } else {
        addToast(response.error || "Erro ao enviar denúncia.", "error");
        return false;
      }
    } catch (e) {
      console.error("Failed to report comment", e);
      addToast("Erro de conexão.", "error");
      return false;
    }
  };

  const fetchComments = async (questionId: number) => {
    try {
      const response = await api.get<Comment[]>(`api/comments/list.php`, {
        target_id: String(questionId),
        user_id: currentUser?.id || ''
      });
      if (response.success && response.data) {
        dispatch({ type: 'SET_COMMENTS', payload: { questionId, comments: response.data } });
      }
    } catch (e) {
      console.error("Failed to fetch comments", e);
      addToast("Erro ao carregar comentários.", "error");
    }
  };

  return (
    <DataContext.Provider value={{
      ...state, dispatch, submitAnswer, addQuestion, addQuestions, updateQuestion, deleteQuestion, toggleSaveQuestion,
      saveNote, reportError, resolveReport, addComment, likeComment, resetAnswers,
      updateUserStatus, updateSystemSettings, addCoupon, deleteCoupon, resetProgress,
      fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead,
      deleteNotification, restoreNotification, permanentDeleteNotification,
      clearNotifications, sendNotification,
      addRanking, updateRanking, deleteRanking, submitRankingEntry, fetchComments, reportComment
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
