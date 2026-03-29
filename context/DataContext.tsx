
import React, { createContext, useContext, useReducer, ReactNode, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Question, UserAnswer, UserNote, ErrorReport, QuestaoComentario,
  Difficulty, UserProfile, SystemSettings, DiscountCode, Notification, Ranking, RankingEntry,
  GlobalTaxonomies
} from '../types';
// import { MOCK_QUESTIONS } from '../data/questions'; // Mock Removed
import { PRICING, PLAN_DETAILS } from '../constants';
import { notificationService } from '@features/notifications';
import { reputationService } from '@features/auth';
import { commentService } from '@features/comments';
import { questionService } from '@features/questions';
import { DEFAULT_PLAN_ENTITLEMENTS } from '../src/features/subscriptions/config/planEntitlements';

import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { apiClient, ENDPOINTS, ApiResponse } from '@core/api';

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
    simulationsEnabled: true,
    maintenanceMode: false,
    registrationEnabled: true,
    landingPagePromoEnabled: true,
    xRayEnabled: true,
    loginRequired: true,
    partnerRegistrationEnabled: true
  },
  geminiApiKey: '',
  recaptchaSiteKey: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', // Chave de teste pública do Google
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
          if (accuracy > 0.85) dificuldade = 1; // Muito Fácil
          else if (accuracy > 0.65) dificuldade = 2; // Fácil
          else if (accuracy > 0.45) dificuldade = 3; // Média
          else if (accuracy > 0.25) dificuldade = 4; // Difícil
          else dificuldade = 5; // Muito Difícil

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

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, updateUser, isLoading: isAuthLoading } = useAuth();
  const { addToast } = useToast();
  const lastCommentTime = useRef<number>(0);
  const dataInitRef = useRef<string | null>(null);
  const [state, dispatch] = useReducer(dataReducer, initialState);

  // --- LAZY LOADING FUNCTIONS ---

  const ensureUsersLoaded = useCallback(async (force = false) => {
    if (state.isUsersLoaded && !force) return;
    try {
      const response = await apiClient.get(ENDPOINTS.users.list);
      const raw = (response as any).data || response;
      const data = Array.isArray(raw) ? raw : (raw.data && Array.isArray(raw.data) ? raw.data : []);
      dispatch({ type: 'SET_USERS', payload: data });
      dispatch({ type: 'MARK_LOADED', payload: 'isUsersLoaded' });
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  }, [state.isUsersLoaded]);

  const ensureReportsLoaded = useCallback(async (force = false) => {
    if (state.isReportsLoaded && !force) return;
    try {
      const response = await apiClient.get(ENDPOINTS.reports.list);
      const raw = (response as any).data || response;
      const data = Array.isArray(raw) ? raw : (raw.data && Array.isArray(raw.data) ? raw.data : []);
      dispatch({ type: 'SET_REPORTS', payload: data });
      dispatch({ type: 'MARK_LOADED', payload: 'isReportsLoaded' });
    } catch (err) {
      console.error("Failed to load reports:", err);
    }
  }, [state.isReportsLoaded]);

  const ensureRankingsLoaded = useCallback(async (force = false) => {
    if (state.isRankingsLoaded && !force) return;
    try {
      const response = await apiClient.get(ENDPOINTS.rankings.list);
      const raw = (response as any).data || response;
      const data = Array.isArray(raw) ? raw : (raw.data && Array.isArray(raw.data) ? raw.data : []);
      dispatch({ type: 'SET_RANKINGS', payload: data });
      dispatch({ type: 'MARK_LOADED', payload: 'isRankingsLoaded' });
    } catch (err) {
      console.error("Failed to load rankings:", err);
    }
  }, [state.isRankingsLoaded]);

  const ensureTaxonomiesLoaded = useCallback(async (force = false) => {
    if (state.isTaxonomiesLoaded && !force) return;
    try {
      const response = await apiClient.get(ENDPOINTS.filters.list || '/filtersList');
      const raw = (response as any).data || response;
      const data = raw.data || raw;
      if (data) {
        const taxonomies = {
          agencies: data.bancas?.map((b: any) => ({ id: b.id, name: b.nome || b.name, sigla: b.sigla, slug: b.slug, description: b.description, website: b.website, type: 'agency' })) || [],
          organizations: data.orgaos?.map((o: any) => ({ id: o.id, name: o.nome || o.name, sigla: o.sigla, slug: o.slug, description: o.description, website: o.website, type: 'organization' })) || [],
          subjects: data.assuntos?.filter((a: any) => a.materia).map((a: any) => ({ id: a.id, name: a.nome || a.name, slug: a.slug, description: a.description, website: a.website, materia: true, type: 'subject' })) || [],
          topics: data.assuntos?.filter((a: any) => !a.materia).map((a: any) => ({ id: a.id, name: a.nome || a.name, slug: a.slug, description: a.description, website: a.website, parentId: a.pai || a.parent_id, materia: false, type: 'topic' })) || [],
          roles: data.cargos?.map((c: any) => ({ id: c.id, name: c.descricao || c.name || c.name, slug: c.slug, description: c.description, website: c.website, parentId: c.pai || c.parent_id, type: 'role' })) || [],
          careers: data.carreiras?.map((c: any) => ({ id: c.id, name: c.nome || c.name, slug: c.slug, description: c.description, website: c.website, parentId: c.pai || c.parent_id, type: 'career' })) || [],
          years: data.anos?.map(String) || [],
          modalities: ['Múltipla Escolha', 'Certo/Errado']
        };
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
      const [answersRes, commentsRes, notesRes] = await Promise.all([
        apiClient.get(ENDPOINTS.users.answers || '/users/answers.php', { params: { user_id: currentUser.id } }),
        apiClient.get(ENDPOINTS.users.comments, { params: { user_id: currentUser.id } }),
        apiClient.get('/users/notes.php', { params: { userId: currentUser.id } })
      ]);

      const answers = answersRes.data || answersRes;
      if (Array.isArray(answers)) dispatch({ type: 'SET_USER_ANSWERS', payload: answers });

      const userComments = commentsRes.data || commentsRes;
      if (Array.isArray(userComments)) dispatch({ type: 'SET_USER_COMMENTS', payload: userComments });

      const notesData = notesRes.data || notesRes;
      if (notesData && notesData.success && Array.isArray(notesData.notes)) {
        const loadedNotes = notesData.notes
          .filter((n: any) => n.type === 'question')
          .map((n: any) => ({
            id: String(n.id),
            questionId: Number(n.itemId),
            text: n.text,
            timestamp: new Date(n.updatedAt).getTime()
          }));
        dispatch({ type: 'SET_USER_NOTES', payload: loadedNotes });
      }

      dispatch({ type: 'MARK_LOADED', payload: 'isUserProgressLoaded' });
    } catch (err) {
      console.error("Failed to load user progress:", err);
    }
  }, [currentUser?.id, state.isUserProgressLoaded]);

  const fetchInitialData = useCallback(async () => {
    if (isAuthLoading) return;

    const userId = currentUser?.id || 'guest';
    if (dataInitRef.current === userId) return;
    dataInitRef.current = userId;

    dispatch({ type: 'RESET_USER_DATA' });

    // 1. Fetch System Settings (Essential)
    apiClient.get('/settings.php')
      .then((response: any) => {
        if (response.success && response.data) {
          dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', payload: response.data });
        }
      })
      .catch(err => console.error("Failed to load system settings:", err));

    // 2. Fetch Initial Questions (Home/Marketplace)
    const params = currentUser?.id ? { user_id: currentUser.id } : {};
    apiClient.get<any>(ENDPOINTS.questions.list, { params })
      .then(response => {
        const responseData = response.data || response;
        const questionsList = responseData.rows || responseData.data?.rows || (Array.isArray(responseData) ? responseData : []);
        if (Array.isArray(questionsList)) {
          const sanitized = questionsList.map((q: any) => ({ ...q, comments: null }));
          dispatch({ type: 'ADD_QUESTIONS', payload: sanitized });
          const totalCount = responseData.total || responseData.data?.total || sanitized.length;
          dispatch({ type: 'SET_TOTAL_QUESTIONS', payload: totalCount });
        }
      })
      .catch(err => console.error("Failed to load initial questions:", err));
  }, [currentUser?.id, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading) return;
    fetchInitialData();
  }, [fetchInitialData, isAuthLoading]);

  // 3. Fetch Notifications with Adaptive Polling
  useEffect(() => {
    if (isAuthLoading) return;
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
  }, [currentUser?.id, isAuthLoading]);

  // 3. Cleanup on mount
  useEffect(() => {
    dispatch({ type: 'CLEANUP_OLD_REPORTS' });
  }, []);

  // Facade de dispatch para conveniência
  const submitAnswer = useCallback((payload: UserAnswer) => {
    dispatch({ type: 'SUBMIT_ANSWER', payload });

    // Persist to API
    if (currentUser) {
      apiClient.post(ENDPOINTS.questions.submit, {
        user_id: currentUser.id,
        question_id: payload.questionId,
        selected_option: payload.selectedOptionIndex,
        is_correct: payload.isCorrect,
        time_taken: payload.timeTaken || 0,
        simulation_id: payload.simulationId || null
      }).then((res: any) => {
        if (res.success && res.new_xp !== undefined) {
          updateUser({ xp: res.new_xp, level: res.new_level }, true); // Silent update for XP
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
      addToast('Questão adicionada!', 'success');
      return res;
    } catch (error) {
      console.error("Failed to save question:", error);
      addToast('Erro ao salvar questão no servidor.', 'error');
      throw error;
    }
  }, [addToast]);

  const addQuestions = useCallback(async (payload: Question[]): Promise<any> => {
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
  }, [addToast]);

  const updateQuestion = useCallback(async (payload: Question): Promise<any> => {
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
  }, [addToast]);

  const deleteQuestion = useCallback(async (payload: number) => {
    try {
      await apiClient.delete(`${ENDPOINTS.questions.list}/${payload}`);
      dispatch({ type: 'DELETE_QUESTION', payload });
      addToast('Questão removida.', 'info');
    } catch (error) {
      console.error("Failed to delete question:", error);
      addToast('Erro ao remover questão do servidor.', 'error');
    }
  }, [addToast]);



  const toggleSaveQuestion = useCallback((questionId: number) => {
    dispatch({ type: 'SAVE_QUESTION', payload: questionId });

    if (currentUser) {
      apiClient.post(ENDPOINTS.questions.toggleSave, {
        user_id: currentUser.id,
        question_id: questionId
      }).catch(err => {
        console.error("Failed to toggle save", err);
        addToast('Erro ao salvar/remover questão.', 'error');
      });
    } else {
      addToast('Faça login para salvar questões.', 'warning');
    }
  }, [currentUser?.id, addToast]);

  const saveNote = useCallback((questionId: number, text: string) => {
    dispatch({ type: 'SAVE_NOTE', payload: { questionId, text } });
    addToast('Nota salva!', 'success');
  }, [addToast]);

  // Notification Facades
  let isFetchingNotifications = false;

  const fetchNotifications = useCallback(async (userId: string) => {
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
  }, []);

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

    // Adiciona ao estado apenas se for para o usuário atual ou 'admin' (se current for admin)
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
  }, [state.reports, currentUser?.id, addToast, sendNotification]);

  const resolveReport = useCallback((id: string, action: 'resolved' | 'ignored', adminReason: string, evidenceUrl?: string) => {
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

    if (report.userId) sendNotification(report.userId, title, message, type, 'report', undefined, evidenceUrl);

    addToast(`Denúncia ${action === 'resolved' ? 'resolvida' : 'ignorada'}.`, 'success');
  }, [state.reports, addToast, sendNotification]);

  const resetAnswers = useCallback(async () => {
    if (!currentUser) return;
    try {
      await apiClient.post('/questions/reset-answers', { user_id: currentUser.id });
      dispatch({ type: 'RESET_PROGRESS' });
      addToast("Suas respostas foram limpas!", 'success');
    } catch (e) {
      console.error("Failed to reset answers", e);
      addToast('Erro ao limpar respostas.', 'error');
    }
  }, [currentUser?.id, addToast]);

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
    apiClient.post(ENDPOINTS.comments.create, {
      action: 'add',
      questionId,
      comment: { ...comment, date: new Date().toISOString() },
      parentId
    }).then((res: any) => {
      const response = res as ApiResponse;
      if (response.success) {
        // Refresh global user activity for dashboard
        if (currentUser?.id) {
          fetchUserComments(currentUser.id);
        }
      } else {
        addToast(response.message || 'Erro ao salvar comentário.', 'error');
      }
    }).catch(err => {
      console.error("Failed to save comment", err);
      addToast('Erro de conexão ao salvar comentário.', 'error');
    });
  }, [addToast]);

  const likeComment = useCallback((questionId: number, commentId: string) => {
    dispatch({ type: 'LIKE_COMMENT', payload: { questionId, commentId } });

    // Persist to Backend
    if (currentUser) {
      apiClient.post(ENDPOINTS.comments.like, {
        action: 'like',
        questionId,
        commentId,
        userId: currentUser.id
      }).then((res: any) => {
        const response = res as ApiResponse;
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
  }, [currentUser?.id, addToast]);





  const updateUserStatus = useCallback(async (userId: string, updates: Partial<UserProfile>) => {
    try {
      await apiClient.post(`/users/update`, { userId, ...updates });
      dispatch({ type: 'UPDATE_USER_STATUS', payload: { userId, updates } });
      addToast('Dados do usuário atualizados.', 'success');
    } catch (error) {
      console.error("Failed to update user:", error);
      addToast('Erro ao atualizar usuário no servidor.', 'error');
    }
  }, [addToast]);


  const updateSystemSettings = useCallback((payload: SystemSettings) => {
    dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', payload });
    console.log("🚀 SAVING SETTINGS:", payload);
    apiClient.post(ENDPOINTS.settings.update, payload)
      .then(res => console.log("✅ SAVE SUCCESS:", res))
      .catch(err => console.error("❌ SAVE FAILED:", err));
  }, []);




  const addCoupon = useCallback((payload: DiscountCode) => dispatch({ type: 'ADD_COUPON', payload }), []);
  const deleteCoupon = useCallback((payload: string) => dispatch({ type: 'DELETE_COUPON', payload }), []);
  const resetProgress = useCallback(() => dispatch({ type: 'RESET_PROGRESS' }), []);


  const addRanking = useCallback((payload: Ranking) => {
    // 1. Optimistic Update
    dispatch({ type: 'ADD_RANKING', payload });

    // 2. Persist
    apiClient.post(ENDPOINTS.rankings.create, payload)
      .then((res: any) => {
        const response = res as ApiResponse;
        if (!response.success) throw new Error(response.message);
        addToast("Ranking criado com sucesso!", "success");
      })
      .catch(err => {
        console.error("Failed to create ranking:", err);
        addToast("Erro ao criar ranking no servidor.", "error");
        // Rollback? ideally yes, but for now we keep it simple or implement DELETE
        dispatch({ type: 'DELETE_RANKING', payload: payload.id });
      });
  }, [addToast]);

  const updateRanking = useCallback((payload: Ranking) => dispatch({ type: 'UPDATE_RANKING', payload }), []);
  const deleteRanking = useCallback((payload: string) => dispatch({ type: 'DELETE_RANKING', payload }), []);

  const submitRankingEntry = useCallback((rankingId: string, entry: RankingEntry) => {
    dispatch({ type: 'SUBMIT_RANKING_ENTRY', payload: { rankingId, entry } });

    if (currentUser) {
      apiClient.post(ENDPOINTS.rankings.join, {
        rankingId,
        userId: currentUser.id,
        entry
      }).then((res: any) => {
        const response = res as ApiResponse;
        if (response.success) addToast("Gabarito enviado!", "success");
        else addToast("Erro ao enviar: " + response.message, "error");
      }).catch(err => {
        console.error(err);
        addToast("Falha de conexão ao enviar gabarito.", "error");
      });
    }
  }, [currentUser?.id, addToast]);

  const moderateRanking = useCallback(async (rankingId: string, status: 'approved' | 'rejected') => {
    try {
      await apiClient.post(ENDPOINTS.rankings.moderate, { id: rankingId, status });
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
      addToast("Você precisa estar logado para reportar.", "warning");
      return false;
    }

    try {
      const res = await apiClient.post(ENDPOINTS.reports.create, {
        reporter_id: currentUser.id,
        target_type: 'comment',
        target_id: commentId,
        reason,
        details
      });
      const response = res as unknown as ApiResponse;

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
  }, [currentUser?.id, addToast]);

  const fetchComments = useCallback(async (questionId: number) => {
    try {
      const res = await apiClient.get(ENDPOINTS.comments.list, {
        params: {
          target_id: String(questionId),
          user_id: currentUser?.id || ''
        }
      });
      const response = res as unknown as ApiResponse<QuestaoComentario[]>;
      if (response.success && response.data) {
        dispatch({ type: 'SET_COMMENTS', payload: { questionId, comments: response.data } });
      }
    } catch (e) {
      console.error(`[DataContext] Failed to fetch comments for ${questionId}`, e);
      addToast("Erro ao carregar comentários.", "error");
    }
  }, [currentUser?.id, addToast]);

  const fetchUserComments = useCallback(async (userId: string) => {
    try {
      const res: any = await apiClient.get(ENDPOINTS.users.comments, { params: { user_id: userId } });
      const comments = res.data || res;
      if (Array.isArray(comments)) {
        dispatch({ type: 'SET_USER_COMMENTS', payload: comments });
      }
    } catch (err) {
      console.error("Failed to fetch user comments:", err);
    }
  }, []);

  const fetchMoreQuestions = useCallback(async (page: number) => {
    const userId = currentUser?.id || 'guest';
    const params = {
        user_id: currentUser?.id,
        page,
        limit: 100
    };

    try {
        const response: any = await apiClient.get(ENDPOINTS.questions.list, { params });
        const responseData = response.data || response;
        const questionsList = responseData.rows || responseData.data?.rows || (Array.isArray(responseData) ? responseData : []);

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

    apiClient.post(ENDPOINTS.comments.handle, {
      action: 'delete',
      commentId,
      userId: currentUser.id
    }).then((res: any) => {
      const response = res as ApiResponse;
      if (response.success) {
        addToast("Comentário excluído com sucesso.", "success");
      } else {
        addToast(response.message || "Erro ao excluir comentário.", "error");
        fetchComments(questionId);
      }
    }).catch(err => {
      console.error("Failed to delete comment", err);
      addToast("Erro de conexão ao excluir comentário.", "error");
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

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
