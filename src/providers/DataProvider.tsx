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


import React, { createContext, useContext, useReducer, ReactNode, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Question, UserAnswer, UserNote, ErrorReport, QuestaoComentario,
  Difficulty, UserProfile, SystemSettings, DiscountCode, Notification, Ranking, RankingEntry,
  GlobalTaxonomies
} from '@types';
// import { MOCK_QUESTIONS } from '../data/questions'; // Mock Removed
import { PRICING, PLAN_DETAILS } from '@constants/index';
import { notificationService } from '@services/notifications';
import { reputationService } from '@services/auth';
import { commentService } from '@services/comments';
import { questionService } from '@services/questions';
import { userProgressService } from '@services/progress';
import { adminService } from '@services/admin/adminService';
import { filtersService } from '@services/filters';
import { rankingsService } from '@services/rankings';
import { reportsService } from '@services/reports';
import { DEFAULT_PLAN_ENTITLEMENTS } from '@constants/subscriptions/planEntitlements';

import { useAuth } from './AuthProvider';
import { useToast } from '@providers/ToastProvider';

// --- INITIAL STATE ---

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  activeTheme: 'default',
  paymentProvider: 'mercado_pago',
  paymentCheckoutMode: 'internal',
  cardVaultProvider: 'local',
  pricing: {
    Gratuito: { ...PRICING.Gratuito, quarterlyDiscountPercent: 0, annualDiscountPercent: 0 },
    Essencial: { ...PRICING.Essencial, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
    Pro: { ...PRICING.Pro, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
    Elite: { ...PRICING.Elite, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
  },
  planDetails: PLAN_DETAILS,
  planEntitlements: DEFAULT_PLAN_ENTITLEMENTS,
  activePromotion: {
    isActive: false,
    name: 'Black Friday',
    slug: 'black-friday',
    discountPercentage: 30,
    bannerText: 'ðŸ”¥ 30% OFF em todos os planos anuais!',
    themeColor: '#000000',
    landingPageTitle: 'AprovaÃ§Ã£o Garantida',
    landingPageHeadline: 'PromoÃ§Ã£o Exclusiva',
    landingPageSubheadline: 'Descontos imperdÃ­veis nos planos Pro e Elite.',
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
    simulationsEnabled: true,
    maintenanceMode: false,
    registrationEnabled: true,
    landingPagePromoEnabled: true,
    xRayEnabled: true,
    loginRequired: true,
    partnerRegistrationEnabled: true
  },
  geminiApiKey: '',
  recaptchaEnabled: false,
  recaptchaSiteKey: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', // Chave de teste pÃºblica do Google
  recaptchaSecretKey: ''
};

interface DataState {
  questions: Question[];
  users: UserProfile[];
  userAnswers: UserAnswer[];
  userComments: QuestaoComentario[];
  userNotes: UserNote[];
  reports: ErrorReport[];
  systemSettings: SystemSettings;
  notifications: Notification[];
  rankings: Ranking[];
  totalQuestions: number;
  // Loaded Status Flags
  isUsersLoaded: boolean;
  isReportsLoaded: boolean;
  isRankingsLoaded: boolean;
  isTaxonomiesLoaded: boolean;
  isUserProgressLoaded: boolean;
}



// 30 Days in ms
const REPORT_RETENTION_PERIOD = 30 * 24 * 60 * 60 * 1000;

const initialState: DataState = {
  questions: [], // MOCK_QUESTIONS replaced by empty array
  users: [],
  userAnswers: [],
  userComments: [],
  userNotes: [],
  reports: [],
  systemSettings: DEFAULT_SYSTEM_SETTINGS,
  notifications: [],
  rankings: [],
  totalQuestions: 0,
  isUsersLoaded: false,
  isReportsLoaded: false,
  isRankingsLoaded: false,
  isTaxonomiesLoaded: false,
  isUserProgressLoaded: false
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
  | { type: 'ADD_COMMENT'; payload: { questionId: number; comment: QuestaoComentario; parentId?: string } }
  | { type: 'SET_COMMENTS'; payload: { questionId: number; comments: QuestaoComentario[] } }
  | { type: 'SAVE_QUESTION'; payload: number }
  | { type: 'LIKE_COMMENT'; payload: { questionId: number; commentId: string } }
  | { type: 'RESET_USER_DATA' }
  | { type: 'UPDATE_SYSTEM_SETTINGS'; payload: SystemSettings }
  | { type: 'ADD_COUPON'; payload: DiscountCode }
  | { type: 'DELETE_COUPON'; payload: string }
  | { type: 'UPDATE_USER_STATUS'; payload: { userId: string; updates: Partial<UserProfile> } }
  | { type: 'SET_USER_ANSWERS'; payload: UserAnswer[] }
  | { type: 'SET_USER_COMMENTS'; payload: QuestaoComentario[] }
  | { type: 'SET_USER_NOTES'; payload: UserNote[] }
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
  | { type: 'DELETE_COMMENT'; payload: { questionId: number; commentId: string } }
  | { type: 'SUBMIT_RANKING_ENTRY'; payload: { rankingId: string; entry: RankingEntry } }
  | { type: 'MODERATE_RANKING'; payload: { id: string; status: 'approved' | 'rejected' } }
  | { type: 'SET_TAXONOMIES'; payload: GlobalTaxonomies }
  | { type: 'SET_TOTAL_QUESTIONS'; payload: number }
  | { type: 'MARK_LOADED'; payload: keyof Pick<DataState, 'isUsersLoaded' | 'isReportsLoaded' | 'isRankingsLoaded' | 'isTaxonomiesLoaded' | 'isUserProgressLoaded'> };

// --- REDUCER ---

/**
 * Reducer central dos dados de dominio carregados no frontend.
 * Ele sincroniza questoes, comentarios, rankings, reports, usuarios e configuracoes que abastecem o site.
 * @since v1.0.0
 */
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
          if (accuracy > 0.85) dificuldade = 1; // Muito FÃ¡cil
          else if (accuracy > 0.65) dificuldade = 2; // FÃ¡cil
          else if (accuracy > 0.45) dificuldade = 3; // MÃ©dia
          else if (accuracy > 0.25) dificuldade = 4; // DifÃ­cil
          else dificuldade = 5; // Muito DifÃ­cil

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
            const currentComments = q.comments || [];
            let newComments;
            if (parentId) {
              newComments = commentService.addReplyToComments(currentComments, parentId, comment);
            } else {
              newComments = [comment, ...currentComments];
            }
            return {
              ...q,
              comments: newComments,
              commentsCount: (newComments || []).filter(c => !c.parentId).length
            };
          }
          return q;
        })
      };
    }

    case 'DELETE_COMMENT': {
      const { questionId, commentId } = action.payload;
      return {
        ...state,
        questions: state.questions.map(q => {
          if (Number(q.id) === Number(questionId)) {
            const filterOut = (comments: QuestaoComentario[]): QuestaoComentario[] => {
              return comments
                .filter(c => c.id !== commentId)
                .map(c => ({ ...c, replies: filterOut(c.replies || []) }));
            };
            const newComments = filterOut(q.comments || []);
            return {
              ...q,
              comments: newComments,
              commentsCount: newComments.filter(c => !c.parentId).length
            };
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
            ? { ...q, comments, commentsCount: (comments || []).filter((c: QuestaoComentario) => !c.parentId).length }
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
      return { ...state, systemSettings: { ...state.systemSettings, ...action.payload } };

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

    case 'SET_USER_COMMENTS':
      return { ...state, userComments: action.payload };

    case 'SET_USER_NOTES':
      return { ...state, userNotes: action.payload };

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
      return {
        ...state,
        rankings: state.rankings.map(r => r.id === action.payload.id ? action.payload : r)
      };

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

    // Limpeza automÃ¡tica de relatÃ³rios antigos
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

    case 'SET_TAXONOMIES':
      return {
        ...state,
        systemSettings: {
          ...state.systemSettings,
          taxonomies: action.payload
        }
      };

    case 'SET_TOTAL_QUESTIONS':
      return { ...state, totalQuestions: action.payload };

    case 'MARK_LOADED':
      return { ...state, [action.payload]: true };

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
  addComment: (qId: number, comment: QuestaoComentario, parentId?: string) => void;
  likeComment: (qId: number, cId: string) => void;
  updateUserStatus: (userId: string, updates: Partial<UserProfile>) => void;
  updateSystemSettings: (settings: SystemSettings) => void;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<void>;
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
  moderateRanking: (rankingId: string, status: 'approved' | 'rejected') => Promise<void>;
  fetchComments: (questionId: number) => Promise<void>;
  fetchUserComments: (userId: string) => Promise<void>;
  fetchMoreQuestions: (page: number) => Promise<void>;
  deleteComment: (questionId: number) => void;

  // Lazy Load Fetchers
  ensureUsersLoaded: (force?: boolean) => Promise<void>;
  ensureReportsLoaded: (force?: boolean) => Promise<void>;
  ensureRankingsLoaded: (force?: boolean) => Promise<void>;
  ensureTaxonomiesLoaded: (force?: boolean) => Promise<void>;
  ensureUserProgressLoaded: (force?: boolean) => Promise<void>;
}

export const DataContext = createContext<DataContextType>({} as DataContextType);

/**
 * Provider oficial de dados compartilhados da plataforma.
 * Ele faz o bootstrap dos dominios globais que alimentam home, pratica, rankings, admin e fluxos de suporte.
 * @since v1.0.0
 */
export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, updateUser, isLoading: authIsLoading } = useAuth();
  const { addToast } = useToast();
  const lastCommentTime = useRef<number>(0);
  const dataInitRef = useRef<string | null>(null);
  const isFetchingNotificationsRef = useRef(false);
  const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSystemSettingsRef = useRef<SystemSettings | null>(null);
  const lastSavedSystemSettingsRef = useRef<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const isSavingSystemSettingsRef = useRef(false);
  const [state, dispatch] = useReducer(dataReducer, initialState);

  const flushSystemSettingsSave = useCallback(async () => {
    if (isSavingSystemSettingsRef.current) return;

    const nextSettings = pendingSystemSettingsRef.current;
    if (!nextSettings) return;

    pendingSystemSettingsRef.current = null;
    isSavingSystemSettingsRef.current = true;

    try {
      await adminService.saveSystemSettings(nextSettings);
      lastSavedSystemSettingsRef.current = nextSettings;
    } catch (error) {
      console.error('Failed to persist system settings:', error);

      if (!pendingSystemSettingsRef.current) {
        dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', payload: lastSavedSystemSettingsRef.current });
      }

      addToast('Erro ao salvar configuracoes. As alteracoes nao foram persistidas.', 'error');
    } finally {
      isSavingSystemSettingsRef.current = false;

      if (pendingSystemSettingsRef.current) {
        void flushSystemSettingsSave();
      }
    }
  }, [addToast]);

  useEffect(() => {
    return () => {
      if (settingsSaveTimerRef.current) {
        clearTimeout(settingsSaveTimerRef.current);
      }
    };
  }, []);

  // --- LAZY LOADING FUNCTIONS ---

  const ensureUsersLoaded = useCallback(async (force = false) => {
    if (state.isUsersLoaded && !force) return;
    try {
      const data = await adminService.getUsers();
      dispatch({ type: 'SET_USERS', payload: data });
      dispatch({ type: 'MARK_LOADED', payload: 'isUsersLoaded' });
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  }, [state.isUsersLoaded]);

  const ensureReportsLoaded = useCallback(async (force = false) => {
    if (state.isReportsLoaded && !force) return;
    try {
      const data = await adminService.getReports();
      dispatch({ type: 'SET_REPORTS', payload: data });
      dispatch({ type: 'MARK_LOADED', payload: 'isReportsLoaded' });
    } catch (err) {
      console.error("Failed to load reports:", err);
    }
  }, [state.isReportsLoaded]);

  const ensureRankingsLoaded = useCallback(async (force = false) => {
    if (state.isRankingsLoaded && !force) return;
    try {
      const rankings = await rankingsService.list();
      dispatch({ type: 'SET_RANKINGS', payload: rankings });
      dispatch({ type: 'MARK_LOADED', payload: 'isRankingsLoaded' });
    } catch (err) {
      console.error("Failed to load rankings:", err);
    }
  }, [state.isRankingsLoaded]);

  const ensureTaxonomiesLoaded = useCallback(async (force = false) => {
    if (state.isTaxonomiesLoaded && !force) return;
    try {
      const taxonomies = await filtersService.listTaxonomies();
      if (taxonomies) {
        dispatch({ type: 'SET_TAXONOMIES', payload: taxonomies });
        dispatch({ type: 'MARK_LOADED', payload: 'isTaxonomiesLoaded' });
      }
    } catch (err) {
      console.error("Failed to load filters:", err);
    }
  }, [state.isTaxonomiesLoaded]);

  const ensureUserProgressLoaded = useCallback(async (force = false) => {
    if (!currentUser?.id || (state.isUserProgressLoaded && !force)) return;
    try {
      // Parallel fetch for progress data
      const [answers, userComments, userNotes] = await Promise.all([
        userProgressService.getUserAnswers(currentUser.id),
        commentService.getUserComments(currentUser.id),
        userProgressService.getUserQuestionNotes(currentUser.id)
      ]);

      if (Array.isArray(answers)) dispatch({ type: 'SET_USER_ANSWERS', payload: answers });

      if (Array.isArray(userComments)) dispatch({ type: 'SET_USER_COMMENTS', payload: userComments });

      if (Array.isArray(userNotes)) {
        dispatch({ type: 'SET_USER_NOTES', payload: userNotes });
      }

      dispatch({ type: 'MARK_LOADED', payload: 'isUserProgressLoaded' });
    } catch (err) {
      console.error("Failed to load user progress:", err);
    }
  }, [currentUser?.id, state.isUserProgressLoaded]);

  const fetchInitialData = useCallback(async () => {
    const userId = currentUser?.id || 'guest';
    if (dataInitRef.current === userId) return;
    dataInitRef.current = userId;

    dispatch({ type: 'RESET_USER_DATA' });

    // 1. Fetch System Settings (Essential)
    adminService.getSystemSettings()
      .then((settingsPayload) => {
        if (settingsPayload && Object.keys(settingsPayload).length > 0) {
          lastSavedSystemSettingsRef.current = { ...DEFAULT_SYSTEM_SETTINGS, ...settingsPayload };
          dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', payload: settingsPayload as SystemSettings });
        }
      })
      .catch(err => console.error("Failed to load system settings:", err));

    // 2. Fetch Initial Questions (Home/Marketplace)
    const params = currentUser?.id ? { user_id: currentUser.id } : {};
    questionService.getQuestionPage(params)
      .then(({ rows, total }) => {
        if (Array.isArray(rows)) {
          const sanitized = rows.map((q: any) => ({ ...q, comments: null }));
          dispatch({ type: 'ADD_QUESTIONS', payload: sanitized });
          dispatch({ type: 'SET_TOTAL_QUESTIONS', payload: total || sanitized.length });
        }
      })
      .catch(err => console.error("Failed to load initial questions:", err));
  }, [currentUser?.id]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const fetchNotifications = useCallback(async (userId: string) => {
    if (!currentUser?.id) {
      return;
    }

    if (isFetchingNotificationsRef.current) {
      console.log('[DataContext] Skipping fetchNotifications - already in progress');
      return;
    }

    try {
      isFetchingNotificationsRef.current = true;
      console.log('[DataContext] Fetching notifications for:', userId);
      const notifs = await notificationService.getUserNotifications(userId);
      dispatch({ type: 'SET_NOTIFICATIONS', payload: notifs });
      console.log('[DataContext] Notifications fetched:', notifs.length);
    } catch (error) {
      console.error('[DataContext] Error fetching notifications:', error);
    } finally {
      isFetchingNotificationsRef.current = false;
    }
  }, [currentUser?.id]);

  // 3. Fetch Notifications with Adaptive Polling
  useEffect(() => {
    if (authIsLoading || !currentUser?.id) return;

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
  }, [authIsLoading, currentUser?.id, fetchNotifications]);

  // 3. Cleanup on mount
  useEffect(() => {
    dispatch({ type: 'CLEANUP_OLD_REPORTS' });
  }, []);

  // Facade de dispatch para conveniÃªncia
  const submitAnswer = useCallback((payload: UserAnswer) => {
    dispatch({ type: 'SUBMIT_ANSWER', payload });

    // Persist to API
    if (currentUser) {
      questionService.submitUserAnswer(currentUser.id, payload).then((result) => {
        if (result.success && result.newXp !== undefined) {
          void updateUser({ xp: result.newXp, level: result.newLevel });
        }
      }).catch(err => {
        console.error("Failed to save answer", err);
        // Error on answer is important enough to show toast
        addToast("Erro ao salvar resposta.", "error");
      });
    }
  }, [currentUser?.id, addToast]);

  const addQuestion = useCallback(async (payload: Question): Promise<any> => {
    try {
      const res = await questionService.createQuestions([payload]);
      const createdQ = res.created && res.created.length > 0 ? res.created[0] : payload;
      dispatch({ type: 'ADD_QUESTION', payload: createdQ });
      addToast('QuestÃ£o adicionada!', 'success');
      return res;
    } catch (error) {
      console.error("Failed to save question:", error);
      addToast('Erro ao salvar questÃ£o no servidor.', 'error');
      throw error;
    }
  }, [addToast]);

  const addQuestions = useCallback(async (payload: Question[]): Promise<any> => {
    try {
      const res = await questionService.createQuestions(payload);
      dispatch({ type: 'ADD_QUESTIONS', payload });
      addToast(`${payload.length} questÃµes importadas!`, 'success');
      return res;
    } catch (error) {
      console.error("Failed to save questions:", error);
      addToast('Erro ao importar questÃµes.', 'error');
      throw error;
    }
  }, [addToast]);

  const updateQuestion = useCallback(async (payload: Question): Promise<any> => {
    try {
      const res = await questionService.updateQuestion(String(payload.id), payload);
      if (!res.success) {
        throw new Error('Falha ao atualizar a questao.');
      }
      dispatch({ type: 'UPDATE_QUESTION', payload });
      addToast('QuestÃ£o atualizada!', 'success');
      return res;
    } catch (error) {
      console.error("Failed to update question:", error);
      addToast('Erro ao atualizar questÃ£o.', 'error');
      throw error;
    }
  }, [addToast]);

  const deleteQuestion = useCallback(async (payload: number) => {
    try {
      const result = await questionService.deleteQuestion(payload);
      if (!result.success) {
        throw new Error(result.message || 'Falha ao remover a questao.');
      }
      dispatch({ type: 'DELETE_QUESTION', payload });
      addToast('QuestÃ£o removida.', 'info');
    } catch (error) {
      console.error("Failed to delete question:", error);
      addToast('Erro ao remover questÃ£o do servidor.', 'error');
    }
  }, [addToast]);



  const toggleSaveQuestion = useCallback((questionId: number) => {
    dispatch({ type: 'SAVE_QUESTION', payload: questionId });

    if (currentUser) {
      questionService.toggleSavedQuestion(currentUser.id, questionId).catch(err => {
        console.error("Failed to toggle save", err);
        addToast('Erro ao salvar/remover questÃ£o.', 'error');
      });
    } else {
      addToast('FaÃ§a login para salvar questÃµes.', 'warning');
    }
  }, [currentUser?.id, addToast]);

  const saveNote = useCallback((questionId: number, text: string) => {
    dispatch({ type: 'SAVE_NOTE', payload: { questionId, text } });
    addToast('Nota salva!', 'success');
  }, [addToast]);

  const markNotificationAsRead = useCallback(async (id: string) => {
    await notificationService.markAsRead(id);
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
  }, []);

  const markAllNotificationsAsRead = useCallback(async (_userId: string) => {
    await notificationService.markAllAsRead();
    dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' });
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    // Soft Delete
    dispatch({ type: 'DELETE_NOTIFICATION', payload: id });
  }, []);

  const restoreNotification = useCallback(async (id: string) => {
    dispatch({ type: 'RESTORE_NOTIFICATION', payload: id });
  }, []);

  const permanentDeleteNotification = useCallback(async (id: string) => {
    dispatch({ type: 'PERMANENT_DELETE_NOTIFICATION', payload: id });
  }, []);

  const clearNotifications = useCallback(async (_userId: string) => {
    await notificationService.clearAll();
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
  }, []);

  const sendNotification = useCallback(async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', category: 'system' | 'social' | 'marketplace' | 'report' = 'system', link?: string, evidenceUrl?: string) => {
    // Map 'report' category to 'moderation' as expected by the service
    const serviceCategory = category === 'report' ? 'moderation' : category;
    await notificationService.sendNotification(userId, title, message, type, serviceCategory, link, evidenceUrl);

    // Adiciona ao estado apenas se for para o usuÃ¡rio atual ou 'admin' (se current for admin)
    if (currentUser && (userId === currentUser.id || userId === 'all' || (currentUser.isAdmin && userId === 'admin'))) {
      const notif: Notification = {
        id: `notif-${Date.now()}`,
        userId,
        title,
        message,
        type,
        category,
        isRead: false,
        timestamp: Date.now(),
        link,
        evidenceUrl
      };
      dispatch({ type: 'ADD_NOTIFICATION', payload: notif });
    }
  }, [currentUser]);

  const reportError = useCallback((report: Omit<ErrorReport, 'id' | 'status' | 'timestamp'>) => {
    const duplicate = state.reports.find(r =>
      r.userName === report.userName &&
      r.status === 'pending' &&
      (
        (r.targetType === 'question' && report.targetType === 'question' && r.questionId === report.questionId) ||
        (r.targetType === 'material' && report.targetType === 'material' && r.materialId === report.materialId) ||
        (r.targetType === 'comment' && report.targetType === 'comment' && r.commentId === report.commentId)
      )
    );

    if (duplicate) {
      addToast('JÃ¡ existe uma denÃºncia pendente para este item.', 'warning');
      return;
    }

    if (!currentUser?.id) {
      addToast('FaÃ§a login para enviar uma denÃºncia.', 'warning');
      return;
    }

    void (async () => {
      try {
        const targetId = report.targetType === 'question'
          ? report.questionId
          : report.targetType === 'material'
            ? report.materialId
            : report.commentId;

        if (!targetId) {
          throw new Error('Alvo da denÃºncia invÃ¡lido.');
        }

        const result = await reportsService.createReport({
          reporterId: currentUser.id,
          targetType: report.targetType,
          targetId,
          reason: report.reason,
          details: report.details,
          evidenceUrl: report.evidenceUrl,
        });

        if (result.duplicate) {
          void ensureReportsLoaded(true);
          addToast(result.message || 'JÃ¡ existe uma denÃºncia pendente para este item.', 'warning');
          return;
        }

        const reportId = result.id || `rep-${Date.now()}`;
        const reportWithUser: ErrorReport = {
          ...report,
          userId: currentUser.id,
          id: reportId,
          status: 'pending',
          timestamp: Date.now(),
        };

        dispatch({ type: 'REPORT_ERROR', payload: reportWithUser });

        const targetLabel = report.targetType === 'question'
          ? 'questao'
          : report.targetType === 'material'
            ? 'material'
            : 'comentario';

        sendNotification(
          'admin',
          'Nova DenÃºncia',
          `O usuÃ¡rio ${report.userName} reportou um problema em ${targetLabel}.`,
          'warning',
          'report',
          `/admin?section=database&tab=reports#${reportId}`
        );

        addToast(result.message || 'DenÃºncia enviada com sucesso!', 'success');
      } catch (error) {
        console.error('Failed to create report:', error);
        addToast((error as Error).message || 'Erro ao enviar denÃºncia.', 'error');
      }
    })();
  }, [state.reports, currentUser?.id, addToast, sendNotification, ensureReportsLoaded]);

  const resolveReport = useCallback(async (id: string, action: 'resolved' | 'ignored', adminReason: string, evidenceUrl?: string) => {
    const report = state.reports.find(r => r.id === id);
    if (!report) return;

    if (!adminReason || adminReason.trim() === '') {
      addToast('A justificativa da decisÃ£o Ã© obrigatÃ³ria.', 'warning');
      return;
    }

    try {
      await adminService.moderateReport(id, action, adminReason, evidenceUrl);
      dispatch({ type: 'RESOLVE_REPORT', payload: { id, action } });
      addToast(`DenÃºncia ${action === 'resolved' ? 'resolvida' : 'ignorada'}.`, 'success');
    } catch (error) {
      console.error('Failed to resolve report:', error);
      addToast('Erro ao atualizar a denÃºncia.', 'error');
    }
  }, [state.reports, addToast]);

  const resetAnswers = useCallback(async () => {
    if (!currentUser) return;
    try {
      const result = await questionService.resetAnswers(currentUser.id);
      if (!result.success) {
        throw new Error(result.message || 'Falha ao limpar as respostas.');
      }
      dispatch({ type: 'RESET_PROGRESS' });
      addToast("Suas respostas foram limpas!", 'success');
    } catch (e) {
      console.error("Failed to reset answers", e);
      addToast('Erro ao limpar respostas.', 'error');
    }
  }, [currentUser?.id, addToast]);

  const fetchUserComments = useCallback(async (userId: string) => {
    try {
      const comments = await commentService.getUserComments(userId);
      if (Array.isArray(comments)) {
        dispatch({ type: 'SET_USER_COMMENTS', payload: comments });
      }
    } catch (err) {
      console.error("Failed to fetch user comments:", err);
    }
  }, []);

  const addComment = useCallback((questionId: number, comment: QuestaoComentario, parentId?: string) => {
    // Anti-Spam Check
    const now = Date.now();
    if (now - lastCommentTime.current < 5000) { // 5 seconds cooldown
      addToast('Aguarde alguns segundos antes de comentar novamente.', 'warning');
      return;
    }
    lastCommentTime.current = now;

    dispatch({ type: 'ADD_COMMENT', payload: { questionId, comment, parentId } });

    // Persist to Backend
    commentService.addComment({
      questionId: String(questionId),
      content: comment.text,
      userId: currentUser?.id || comment.userId,
      userName: currentUser?.name || comment.userName,
      parentId,
      targetType: 'question',
    }).then(() => {
        // Refresh global user activity for dashboard
        if (currentUser?.id) {
          fetchUserComments(currentUser.id);
        }
    }).catch(err => {
      console.error("Failed to save comment", err);
      addToast(err.message || 'Erro de conexÃ£o ao salvar comentÃ¡rio.', 'error');
    });
  }, [addToast, currentUser?.id, currentUser?.name, fetchUserComments]);

  const likeComment = useCallback((questionId: number, commentId: string) => {
    dispatch({ type: 'LIKE_COMMENT', payload: { questionId, commentId } });

    // Persist to Backend
    if (currentUser) {
      commentService.likeComment(commentId, currentUser.id).catch(err => {
        console.error("Failed to save like", err);
        addToast(err.message || 'Erro de conexÃ£o ao curtir comentÃ¡rio.', 'error');
      });
    } else {
      addToast('FaÃ§a login para curtir.', 'warning');
    }
  }, [currentUser?.id, addToast]);





  const updateUserStatus = useCallback(async (userId: string, updates: Partial<UserProfile>) => {
    try {
      await adminService.performUserAction({
        user_id: userId,
        action: 'update_user_status',
        status: updates.status,
        reputation: typeof updates.reputation === 'number' ? updates.reputation : undefined,
      });
      dispatch({ type: 'UPDATE_USER_STATUS', payload: { userId, updates } });
      addToast('Dados do usuário atualizados.', 'success');
    } catch (error) {
      console.error("Failed to update user:", error);
      addToast('Erro ao atualizar usuário no servidor.', 'error');
    }
  }, [addToast]);


  const updateSystemSettings = useCallback((payload: SystemSettings) => {
    dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', payload });
    pendingSystemSettingsRef.current = payload;

    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
    }

    settingsSaveTimerRef.current = setTimeout(() => {
      void flushSystemSettingsSave();
    }, 450);
  }, [flushSystemSettingsSave]);

  const saveSystemSettingsNow = useCallback(async (payload?: SystemSettings) => {
    const nextSettings = payload ?? pendingSystemSettingsRef.current ?? state.systemSettings;
    if (!nextSettings) return;

    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
      settingsSaveTimerRef.current = null;
    }

    // Forca a persistencia imediata quando a tela precisa de um save explicito.
    pendingSystemSettingsRef.current = null;

    if (isSavingSystemSettingsRef.current) {
      pendingSystemSettingsRef.current = nextSettings;
      return;
    }

    isSavingSystemSettingsRef.current = true;

    try {
      await adminService.saveSystemSettings(nextSettings);
      lastSavedSystemSettingsRef.current = nextSettings;
    } catch (error) {
      console.error('Failed to persist system settings immediately:', error);
      dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', payload: lastSavedSystemSettingsRef.current });
      addToast('Erro ao salvar configuracoes. As alteracoes nao foram persistidas.', 'error');
      throw error;
    } finally {
      isSavingSystemSettingsRef.current = false;

      if (pendingSystemSettingsRef.current) {
        void flushSystemSettingsSave();
      }
    }
  }, [addToast, flushSystemSettingsSave, state.systemSettings]);




  const addCoupon = useCallback((payload: DiscountCode) => {
    const nextCoupons = [...state.systemSettings.coupons, payload];
    updateSystemSettings({ ...state.systemSettings, coupons: nextCoupons });
  }, [state.systemSettings, updateSystemSettings]);
  const deleteCoupon = useCallback((payload: string) => {
    const nextCoupons = state.systemSettings.coupons.filter(coupon => coupon.code !== payload);
    updateSystemSettings({ ...state.systemSettings, coupons: nextCoupons });
  }, [state.systemSettings, updateSystemSettings]);
  const resetProgress = useCallback(() => dispatch({ type: 'RESET_PROGRESS' }), []);


  const addRanking = useCallback((payload: Ranking) => {
    // 1. Optimistic Update
    dispatch({ type: 'ADD_RANKING', payload });

    // 2. Persist
    rankingsService.create(payload)
      .then(() => {
        addToast("Ranking criado com sucesso!", "success");
      })
      .catch(err => {
        console.error("Failed to create ranking:", err);
        addToast("Erro ao criar ranking no servidor.", "error");
        // Rollback? ideally yes, but for now we keep it simple or implement DELETE
        dispatch({ type: 'DELETE_RANKING', payload: payload.id });
      });
  }, [addToast]);

  const updateRanking = useCallback(async (payload: Ranking) => {
    try {
      await adminService.updateRanking(payload);
      dispatch({ type: 'UPDATE_RANKING', payload });
      addToast('Ranking atualizado com sucesso!', 'success');
    } catch (error) {
      console.error('Failed to update ranking:', error);
      addToast('Erro ao atualizar ranking.', 'error');
      throw error;
    }
  }, [addToast]);
  const deleteRanking = useCallback(async (payload: string) => {
    try {
      await adminService.deleteRanking(payload);
      dispatch({ type: 'DELETE_RANKING', payload });
      addToast('Ranking excluÃ­do com sucesso!', 'success');
    } catch (error) {
      console.error('Failed to delete ranking:', error);
      addToast('Erro ao excluir ranking.', 'error');
      throw error;
    }
  }, [addToast]);

  const submitRankingEntry = useCallback((rankingId: string, entry: RankingEntry) => {
    dispatch({ type: 'SUBMIT_RANKING_ENTRY', payload: { rankingId, entry } });

    if (currentUser) {
      rankingsService.join(rankingId, currentUser.id, entry).then(() => {
        addToast("Gabarito enviado!", "success");
      }).catch(err => {
        console.error(err);
        addToast("Falha de conexÃ£o ao enviar gabarito.", "error");
      });
    }
  }, [currentUser?.id, addToast]);

  const moderateRanking = useCallback(async (rankingId: string, status: 'approved' | 'rejected') => {
    try {
      await rankingsService.moderate(rankingId, status);
      dispatch({ type: 'MODERATE_RANKING', payload: { id: rankingId, status } });
      addToast(`Ranking ${status === 'approved' ? 'aprovado' : 'rejeitado'}!`, 'success');
    } catch (error) {
      console.error("Failed to moderate ranking:", error);
      addToast('Erro ao moderar ranking', 'error');
      throw error;
    }
  }, [addToast]);


  const reportComment = useCallback(async (commentId: string, reason: string, details: string) => {
    if (!currentUser) {
      addToast("VocÃª precisa estar logado para reportar.", "warning");
      return false;
    }

    try {
      await commentService.reportComment(commentId, reason, details, currentUser.id);
      addToast("DenÃºncia enviada com sucesso. Obrigado por ajudar a manter a comunidade limpa!", "success");
      return true;
    } catch (e) {
      console.error("Failed to report comment", e);
      addToast((e as Error).message || "Erro de conexÃ£o.", "error");
      return false;
    }
  }, [currentUser?.id, addToast]);

  const fetchComments = useCallback(async (questionId: number) => {
    try {
      const comments = await commentService.getComments(String(questionId), currentUser?.id);
      dispatch({ type: 'SET_COMMENTS', payload: { questionId, comments } });
    } catch (e) {
      console.error(`[DataContext] Failed to fetch comments for ${questionId}`, e);
      addToast("Erro ao carregar comentÃ¡rios.", "error");
    }
  }, [currentUser?.id, addToast]);

  const fetchMoreQuestions = useCallback(async (page: number) => {
    const params = {
        user_id: currentUser?.id,
        page,
        limit: 100
    };

    try {
        const { rows } = await questionService.getQuestionPage(params);
        const questionsList = rows;

        if (Array.isArray(questionsList)) {
            const sanitized = questionsList.map((q: any) => ({ ...q, comments: null }));
            dispatch({ type: 'ADD_QUESTIONS', payload: sanitized });
        }
    } catch (err) {
        console.error("Failed to fetch more questions:", err);
    }
  }, [currentUser?.id]);

  const deleteComment = useCallback((questionId: number, commentId: string) => {
    if (!currentUser) return;

    dispatch({ type: 'DELETE_COMMENT', payload: { questionId, commentId } });

    commentService.deleteComment(commentId, currentUser.id).then(() => {
        addToast("ComentÃ¡rio excluÃ­do com sucesso.", "success");
    }).catch(err => {
      console.error("Failed to delete comment", err);
      addToast(err.message || "Erro de conexÃ£o ao excluir comentÃ¡rio.", "error");
      fetchComments(questionId);
    });
  }, [currentUser?.id, addToast, fetchComments]);

  return (
    <DataContext.Provider value={
      {
        ...state,
        dispatch,
        submitAnswer,
        addQuestion,
        addQuestions,
        updateQuestion,
        deleteQuestion,
        toggleSaveQuestion,
        saveNote,
        resetAnswers,
        reportError,
        resolveReport,
        addComment,
        likeComment,
        updateUserStatus,
        updateSystemSettings,
        saveSystemSettingsNow,
        addCoupon,
        deleteCoupon,
        resetProgress,
        fetchNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        reportComment,
        deleteNotification,
        restoreNotification,
        permanentDeleteNotification,
        clearNotifications,
        sendNotification,
        addRanking,
        updateRanking,
        deleteRanking,
        submitRankingEntry,
        moderateRanking,
        fetchComments,
        fetchUserComments,
        fetchMoreQuestions,
        deleteComment,
        // Lazy Loader Export
        ensureUsersLoaded,
        ensureReportsLoaded,
        ensureRankingsLoaded,
        ensureTaxonomiesLoaded,
        ensureUserProgressLoaded
      }
    }>
      {children}
    </DataContext.Provider>
  );
};

/**
 * Hook publico para consumir o contexto global de dados do frontend.
 * Ele conecta features como questoes, rankings, admin, notificacoes e configuracoes ao mesmo estado oficial.
 * @since v1.0.0
 */
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};

