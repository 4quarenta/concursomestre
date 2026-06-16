'use client';

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

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
   User, Star, Book, Shield,
   CreditCard, StickyNote, Zap, TrendingUp,
   ChevronRight, X, BarChart3, Target,
   ShieldCheck, Bell, Info, Users, LogOut, Crown,
   Package, ExternalLink, BookOpen, Download, Trash2,
   AlertTriangle, XCircle, ArrowRight, CheckCircle2, Gift,
   Share2, Copy, Camera, AlertCircle, RotateCcw, Send,
   Loader2, ShieldAlert, MousePointer2, Wallet, MessageSquare,
   BookmarkCheck,
   type LucideIcon,
} from 'lucide-react';
import {
   AreaChart, Area, XAxis, YAxis,
} from 'recharts';
import StableResponsiveContainer from '@/components/shared/charts/StableResponsiveContainer';
import { useAuth } from '@providers/AuthProvider';
import { useTheme } from '@providers/ThemeProvider';
import { useToast } from '@providers/ToastProvider';
import { useConfirm } from '@providers/ModalProvider';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { buildNotificationsQueryKey, fetchNotificationsList } from '@/state/notifications/notificationsQuery';
import { useNotificationsStore } from '@/state/notifications/notificationsStore';
import { useQuestionBankActions } from '@/state/question-bank/useQuestionBankActions';
import { useUserProgressActions } from '@/state/user-progress/useUserProgressActions';
import { useTaxonomyActions } from '@/state/app-config/useTaxonomyActions';
import { type LawSummary, type Material, type Question, type Transaction, type UserProfile } from '../../types';
import AuthModal from '../../components/shared/overlays/AuthModal';
import {
    readApiErrorMessage,
    buildMaterialDownloadEndpoint,
    downloadAuthenticatedFile,
    getAssetUrl,
    getVersionedAssetUrl,
} from '@services/api';
import {
    listLegalCommentaryNotesForUser,
    removeLegalCommentaryArticleNote,
    type LegalCommentaryStoredNote,
} from '@services/legal-commentary/legalCommentaryNotes';
import { readerService } from '@services/materials';
import { cardsService, formatMaskedCardLabelAscii, type SavedCard } from '@services/billing';
import { marketplaceService } from '@services/marketplace';
import { profileService, type ReferralStats } from '@services/profile';
import { supportService, type SupportReply, type SupportThread } from '@services/support';
import { questionService } from '@services/questions';
import { transactionsService } from '@services/transactions';
import { planService } from '@services/plans';
import { subscriptionsService } from '@services/subscriptions';
import { clientLog } from '@services/monitoring/clientLog';
import { buildQuestionPath } from '@services/seo';
import { legalCommentaryApiService } from '@services/legal-commentary';
import { normalizeCareerSelectorLabel } from '@services/filters';
import { useRecaptchaV3 } from '@services/system/useRecaptchaV3';
import {
    PLATFORM_PAGE_DESCRIPTION_CLASS,
    PLATFORM_PAGE_TITLE_CLASS,
    PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import {
    formatDateInSaoPaulo,
    formatDateTimeInSaoPaulo,
    parseSubscriptionDate,
    resolveProfileSubscriptionTimeline,
} from './components/subscriptionDateUtils';
import { getEffectivePlanDisplayName, hasActivePlanAccess, isPlanAtLeast } from '@services/plans/planAccess';
import { buildProfilePath, resolveProfileTab, type ProfileTab } from './profileNavigation';

const StripeSetupCardForm = dynamic(() => import('./components/StripeSetupCardForm'), {
    ssr: false,
    loading: () => (
        <div className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-300">
            <Loader2 size={14} className="animate-spin" />
            Carregando Stripe...
        </div>
    ),
});

const parseFeatureFlag = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
    }
    return false;
};

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const truncateText = (value: string, maxLength: number) => (
    value.length > maxLength ? `${value.slice(0, maxLength).trimEnd()}...` : value
);

const PROFILE_PHOTO_CROP_SIZE = 512;

type ProfilePhotoCropDraft = {
    file: File;
    previewUrl: string;
    zoom: number;
    offsetX: number;
    offsetY: number;
};

const loadImageForCrop = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Nao foi possivel carregar a imagem selecionada.'));
    image.src = src;
});

const buildCircularProfilePhotoFile = async (draft: ProfilePhotoCropDraft): Promise<File> => {
    const image = await loadImageForCrop(draft.previewUrl);
    const canvas = document.createElement('canvas');
    canvas.width = PROFILE_PHOTO_CROP_SIZE;
    canvas.height = PROFILE_PHOTO_CROP_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Nao foi possivel preparar o recorte da foto.');
    }

    const center = PROFILE_PHOTO_CROP_SIZE / 2;
    const baseScale = Math.max(
        PROFILE_PHOTO_CROP_SIZE / image.naturalWidth,
        PROFILE_PHOTO_CROP_SIZE / image.naturalHeight,
    );
    const scale = baseScale * Math.max(1, draft.zoom);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const maxOffsetX = Math.max(0, (drawWidth - PROFILE_PHOTO_CROP_SIZE) / 2);
    const maxOffsetY = Math.max(0, (drawHeight - PROFILE_PHOTO_CROP_SIZE) / 2);
    const drawX = (PROFILE_PHOTO_CROP_SIZE - drawWidth) / 2 + ((draft.offsetX / 100) * maxOffsetX);
    const drawY = (PROFILE_PHOTO_CROP_SIZE - drawHeight) / 2 + ((draft.offsetY / 100) * maxOffsetY);

    ctx.clearRect(0, 0, PROFILE_PHOTO_CROP_SIZE, PROFILE_PHOTO_CROP_SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
            if (nextBlob) {
                resolve(nextBlob);
                return;
            }

            reject(new Error('Nao foi possivel gerar a foto recortada.'));
        }, 'image/png', 0.94);
    });

    return new File([blob], 'profile-photo.png', { type: 'image/png' });
};

const resolveProfileMaterialPurchasedAt = (material: ProfileMaterial): string => (
    material.purchasedAt
    || material.purchased_at
    || material.updatedAt
    || material.updated_at
    || ''
);

const getQuestionTitle = (question: Question | null, fallbackId: string) => (
    question
        ? truncateText(stripHtml(question.enunciado_clean || question.enunciado || `Questão #${fallbackId}`), 160)
        : `Questão #${fallbackId}`
);

const getQuestionSubjectLabel = (question: Question | null) => {
    const assuntos = Array.isArray(question?.assuntos)
        ? question.assuntos.map((assunto) => assunto.nome || assunto.name).filter(Boolean)
        : [];

    return assuntos.length > 0 ? assuntos.slice(0, 2).join(' • ') : 'Assunto não informado';
};

const getQuestionBankLabel = (question: Question | null) => {
    const bancas = Array.isArray(question?.bancas)
        ? question.bancas.map((banca) => banca.sigla || banca.nome || banca.name).filter(Boolean)
        : [];

    return bancas.length > 0 ? bancas.slice(0, 2).join(' / ') : 'Banca não informada';
};

const getQuestionYearLabel = (question: Question | null) => {
    const years = Array.isArray(question?.anos) ? question.anos.filter(Boolean) : [];
    return years.length > 0 ? years.join(', ') : 'Ano não informado';
};

const getQuestionDifficultyLabel = (question: Question | null) => {
    if (!question) return 'Dificuldade não informada';
    return question.difficulty || ['', 'Muito Fácil', 'Fácil', 'Médio', 'Difícil', 'Muito Difícil'][Number(question.dificuldade)] || `Dificuldade ${question.dificuldade || '-'}`;
};

const buildDefaultTestimonialName = (name?: string, email?: string) => {
    const source = String(name || email || '').trim();
    if (!source) return '';

    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return parts[0] || '';

    return `${parts[0]} ${parts[1]?.charAt(0) || ''}.`.trim();
};

type NotebookEntry = {
    id: string;
    source: 'question' | 'law' | 'material';
    title: string;
    subtitle: string;
    text: string;
    timestamp: number;
    href?: string;
    questionId?: number;
    articleId?: string;
    lawSlug?: string;
    materialId?: string;
};

type MaterialNotebookNote = {
    materialId: string;
    title: string;
    subtitle: string;
    text: string;
    timestamp: number;
};

type ProfileReferralStats = ReferralStats & {
    clicks?: number;
    conversions?: number;
    balance?: number;
};

type ProfileMaterial = Material & {
    purchasedAt?: string;
    purchased_at?: string;
    updatedAt?: string;
    updated_at?: string;
    author_name?: string;
};

type ProfileTransaction = Omit<Transaction, 'status' | 'amount'> & {
    status?: string;
    amount?: string | number;
    created_at?: string | null;
    createdAt?: string | null;
    dueDate?: string | null;
    dateFormatted?: string;
    dateTimeFormatted?: string;
    cycleLabel?: string;
    planCycleLabel?: string;
    billingCycleLabel?: string;
    billingCycle?: string;
    intervalLabel?: string;
    intervalUnit?: string;
    interval_unit?: string;
    intervalCount?: number | string;
    interval_count?: number | string;
    planName?: string;
    transactionName?: string;
    description?: string;
    referenceId?: string | number;
    providerTransactionId?: string | number;
    providerTransactionLabel?: string;
    invoicePdfUrl?: string | null;
    hostedInvoiceUrl?: string | null;
    installmentCount?: number | string;
    installmentNumber?: number | string;
    scheduleLabel?: string;
    providerRefundId?: string | null;
    payment_provider?: string;
    provider?: string;
    gateway?: string;
    paymentMethodLabel?: string;
    paymentMethod?: string;
    payment_method?: string;
    paymentMethodType?: string;
    method?: string;
};

type ProfileServiceActionResponse<TData extends Record<string, unknown> = Record<string, unknown>> = {
    success?: boolean;
    message?: string;
    data?: TData;
    url?: string | null;
};

type ProfileSidebarItem = {
    id: ProfileTab;
    label: string;
    icon: LucideIcon;
    onSelect?: () => void;
};

const isPlatformRatingThread = (thread: SupportThread) => (
    String(thread.reason || '').toLowerCase().includes('avaliar plataforma')
    || Number(thread.public_rating || 0) > 0
    || ['platform-rating', 'platform_rating', 'testimonial', 'rating'].includes(String(thread.type || ''))
);

const PROFILE_SUPPORT_STATUS_META: Record<SupportThread['status'], { label: string; className: string }> = {
    new: {
        label: 'Aberto',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    },
    read: {
        label: 'Em análise',
        className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    },
    resolved: {
        label: 'Resolvido',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    },
};

const PROFILE_SUPPORT_TYPE_LABELS: Record<string, string> = {
    bug: 'Problema',
    support: 'Ajuda',
    suggestion: 'Sugestão',
    feedback: 'Feedback',
};

const PROFILE_FALLBACK_FOCUS_AREAS = [
    'Policial',
    'Fiscal',
    'Tribunais',
    'Jurídico',
    'Educação',
    'Militar',
    'Saúde',
    'TI',
    'Diplomata',
];

const PROFILE_EXAM_AREAS = [
    'Residência em Saúde',
    'CFC - Exame de Suficiência',
    'OAB - Exame de Ordem',
];

const Profile: React.FC = () => {
    const { currentUser, logout, refreshUser, updateUser, toggleSavedQuestion } = useAuth();
    const { setTheme } = useTheme();
    const systemSettings = useAppConfigStore((store) => store.systemSettings);
    const { questions, ensureQuestionsLoaded } = useQuestionBankActions();
    const { userNotes, userAnswers, saveNote, ensureUserProgressLoaded } = useUserProgressActions();
    const { ensureTaxonomiesLoaded } = useTaxonomyActions();
   const { addToast } = useToast();
   const confirm = useConfirm();
    const pathname = usePathname() || '/profile';
    const searchParams = useSearchParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const replaceNotifications = useNotificationsStore((state) => state.replaceNotifications);
    const location = React.useMemo(() => {
        const search = searchParams?.toString();
        return {
            pathname,
            search: search ? `?${search}` : '',
        };
    }, [pathname, searchParams]);
    const params = useParams<{ tab?: string }>();
    const activeBillingProvider = (currentUser?.subscription?.payment_provider || systemSettings?.paymentProvider || 'stripe') as 'stripe' | 'manual_admin';
    const isStripeBilling = activeBillingProvider === 'stripe';
    const billingProviderLabel = activeBillingProvider === 'manual_admin' ? 'Concessao manual' : 'Stripe';
    const usesInternalStripeVault = isStripeBilling;
    const stripePublishableKey = systemSettings?.stripePublishableKey || systemSettings?.stripeKey || '';
    const hasActiveSubscription = hasActivePlanAccess(currentUser);
    const effectivePlanDisplayName = getEffectivePlanDisplayName(currentUser);
    const isElitePlan = isPlanAtLeast(currentUser, 'Elite');
    const referralEnabled = parseFeatureFlag(systemSettings?.features?.referralEnabled);
    const canAccessReferralTab = referralEnabled;
    const marketplaceEnabled = systemSettings?.features?.marketplaceEnabled === undefined
        ? true
        : parseFeatureFlag(systemSettings.features.marketplaceEnabled);

    const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
    const [evolutionRange, setEvolutionRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Novos Estados para Funcionalidades Modernas
    const [userMaterials, setUserMaterials] = useState<ProfileMaterial[]>([]);
    const [userCards, setUserCards] = useState<SavedCard[]>([]);
    const [isLoadingCards, setIsLoadingCards] = useState(false);
    const [cardsLoadError, setCardsLoadError] = useState<string | null>(null);
    const [userTransactions, setUserTransactions] = useState<ProfileTransaction[]>([]);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [referralStats, setReferralStats] = useState<ProfileReferralStats | null>(null);
    const [isCopying, setIsCopying] = useState(false);
    const [isAddingCard, setIsAddingCard] = useState(false);
    const [isSavingCard, setIsSavingCard] = useState(false);
    const [isRemovingProfilePhoto, setIsRemovingProfilePhoto] = useState(false);
    const [isSavingProfilePhoto, setIsSavingProfilePhoto] = useState(false);
    const [profilePhotoCropDraft, setProfilePhotoCropDraft] = useState<ProfilePhotoCropDraft | null>(null);
    const [testimonialRating, setTestimonialRating] = useState(5);
    const [testimonialText, setTestimonialText] = useState('');
    const [testimonialDisplayName, setTestimonialDisplayName] = useState('');
    const [testimonialHeadline, setTestimonialHeadline] = useState('');
    const [isSubmittingTestimonial, setIsSubmittingTestimonial] = useState(false);
    const [showTestimonialModal, setShowTestimonialModal] = useState(false);
    const [userPlatformRatings, setUserPlatformRatings] = useState<SupportThread[]>([]);
    const [isLoadingPlatformRatings, setIsLoadingPlatformRatings] = useState(false);
    const [supportHistoryThreads, setSupportHistoryThreads] = useState<SupportThread[]>([]);
    const [isLoadingSupportHistory, setIsLoadingSupportHistory] = useState(false);
    const [expandedSupportThreadId, setExpandedSupportThreadId] = useState<number | null>(null);
    const [supportReplies, setSupportReplies] = useState<Record<number, SupportReply[]>>({});
    const [loadingSupportReplies, setLoadingSupportReplies] = useState<number | null>(null);
    const [supportReplyDrafts, setSupportReplyDrafts] = useState<Record<number, string>>({});
    const [sendingSupportReplyId, setSendingSupportReplyId] = useState<number | null>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelDetails, setCancelDetails] = useState('');
    const [accountDeletionReason, setAccountDeletionReason] = useState('');
    const [isRequestingAccountDeletion, setIsRequestingAccountDeletion] = useState(false);
    const [privacyPreferencesDraft, setPrivacyPreferencesDraft] = useState({
        isPublic: true,
        notifications: true,
        shareData: true,
        showProfilePhoto: true,
        defaultTheme: 'system' as 'system' | 'light' | 'dark',
        defaultPracticeView: 'card' as 'card' | 'list',
        defaultSimulationView: 'list' as 'focus' | 'list',
    });
    const [isSavingPrivacyPreferences, setIsSavingPrivacyPreferences] = useState(false);
    const [confirmOutstandingDebtCharge, setConfirmOutstandingDebtCharge] = useState(false);
    const [isCancelingSubscription, setIsCancelingSubscription] = useState(false);
    const [isUpdatingRenewal, setIsUpdatingRenewal] = useState(false);
    const [optimisticAutoRenew, setOptimisticAutoRenew] = useState<boolean | null>(null);
    const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
    const [stripeSetupClientSecret, setStripeSetupClientSecret] = useState<string | null>(null);
    const recaptchaEnabled = !!systemSettings?.recaptchaEnabled && !!systemSettings?.recaptchaSiteKey;
    const shouldPrepareProfileRecaptcha = recaptchaEnabled && (showCancelModal || activeTab === 'security');
    const {
        executeRecaptcha: executeProfileRecaptcha,
        isReady: isProfileRecaptchaReady,
        loadError: profileRecaptchaLoadError,
    } = useRecaptchaV3({
        enabled: shouldPrepareProfileRecaptcha,
        siteKey: systemSettings?.recaptchaSiteKey,
    });
    const isProfileSecurityCheckLoading = shouldPrepareProfileRecaptcha && !isProfileRecaptchaReady && !profileRecaptchaLoadError;
    const cancelRequestInFlightRef = React.useRef(false);
    const renewalRequestInFlightRef = React.useRef(false);
    const billingSyncRequestInFlightRef = React.useRef(false);
    const lastBillingSyncAtRef = React.useRef(0);
    const personalDetailsSectionRef = React.useRef<HTMLDivElement>(null);
    const pendingPersonalDetailsScrollRef = React.useRef(false);
    const [hasSyncedBillingSnapshot, setHasSyncedBillingSnapshot] = useState(false);
    const [isSyncingBillingSnapshot, setIsSyncingBillingSnapshot] = useState(false);
    const [lawNotes, setLawNotes] = useState<LegalCommentaryStoredNote[]>([]);
    const [materialNotes, setMaterialNotes] = useState<MaterialNotebookNote[]>([]);
    const [favoriteLaws, setFavoriteLaws] = useState<LawSummary[]>([]);
    const [isLoadingFavoriteLaws, setIsLoadingFavoriteLaws] = useState(false);
    const [savedQuestionDetails, setSavedQuestionDetails] = useState<Question[]>([]);
    const [isLoadingSavedQuestions, setIsLoadingSavedQuestions] = useState(false);
    const [profileNowMs, setProfileNowMs] = useState(() => Date.now());
    const shouldLoadQuestionBankForProfile = activeTab === 'notebook' || activeTab === 'saved-questions';

    const currentUserKey = React.useMemo(() => {
        const legacyUserId = (currentUser as (UserProfile & { userId?: string }) | null)?.userId;
        return String(currentUser?.id || legacyUserId || currentUser?.email || '');
    }, [currentUser]);

    React.useEffect(() => {
        const updateNow = () => setProfileNowMs(Date.now());
        const frameId = window.requestAnimationFrame(updateNow);
        const intervalId = window.setInterval(updateNow, 60_000);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearInterval(intervalId);
        };
    }, []);

    React.useEffect(() => {
        const previewUrl = profilePhotoCropDraft?.previewUrl;
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [profilePhotoCropDraft?.previewUrl]);

    React.useEffect(() => {
        const preferences = (currentUser?.preferences || {}) as Partial<UserProfile['preferences']>;
        const frameId = window.requestAnimationFrame(() => {
            setPrivacyPreferencesDraft({
                isPublic: preferences.isPublic !== false,
                notifications: preferences.notifications !== false,
                shareData: preferences.shareData !== false,
                showProfilePhoto: preferences.showProfilePhoto !== false,
                defaultTheme: preferences.defaultTheme === 'light' || preferences.defaultTheme === 'dark'
                    ? preferences.defaultTheme
                    : 'system',
                defaultPracticeView: preferences.defaultPracticeView === 'list' ? 'list' : 'card',
                defaultSimulationView: preferences.defaultSimulationView === 'focus' ? 'focus' : 'list',
            });
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [currentUser?.preferences]);

    React.useEffect(() => {
        lastBillingSyncAtRef.current = 0;
        billingSyncRequestInFlightRef.current = false;

        const frameId = window.requestAnimationFrame(() => {
            setHasSyncedBillingSnapshot(false);
            setIsSyncingBillingSnapshot(false);
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [currentUserKey]);

    React.useEffect(() => {
        void ensureTaxonomiesLoaded();
    }, [ensureTaxonomiesLoaded]);

    const primarySavedCard = useMemo(() => {
        return userCards.find((card) => Number(card.is_default) === 1) || userCards[0] || null;
    }, [userCards]);

    const profilePhotoUrl = useMemo(
        () => getVersionedAssetUrl(currentUser?.photoUrl || '', currentUser?.photoUrl || currentUser?.id || ''),
        [currentUser?.id, currentUser?.photoUrl]
    );

    const defaultTestimonialDisplayName = React.useMemo(
        () => buildDefaultTestimonialName(currentUser?.name, currentUser?.email),
        [currentUser?.name, currentUser?.email]
    );

    const defaultTestimonialHeadline = React.useMemo(() => {
        const planName = String(effectivePlanDisplayName || '').trim();
        return planName ? `Aluno ${planName}` : 'Estudante da plataforma';
    }, [effectivePlanDisplayName]);

    const savedQuestionIds = React.useMemo(() => (
        Array.from(new Set((currentUser?.savedQuestionIds || [])
            .map((questionId) => String(questionId).trim())
            .filter(Boolean)))
    ), [currentUser?.savedQuestionIds]);

    const savedQuestionsById = React.useMemo(() => {
        const questionMap = new Map<string, Question>();

        [...questions, ...savedQuestionDetails].forEach((question) => {
            if (question?.id !== undefined && question?.id !== null) {
                questionMap.set(String(question.id), question);
            }
        });

        return questionMap;
    }, [questions, savedQuestionDetails]);

    const savedQuestionRows = React.useMemo(() => (
        savedQuestionIds.map((questionId) => ({
            id: questionId,
            question: savedQuestionsById.get(questionId) || null,
        }))
    ), [savedQuestionIds, savedQuestionsById]);

    const missingSavedQuestionIds = React.useMemo(() => (
        savedQuestionIds.filter((questionId) => !savedQuestionsById.has(questionId))
    ), [savedQuestionIds, savedQuestionsById]);

    const savedAnsweredCount = React.useMemo(() => {
        const answeredQuestionIds = new Set(userAnswers.map((answer) => String(answer.questionId)));
        return savedQuestionIds.filter((questionId) => answeredQuestionIds.has(questionId)).length;
    }, [savedQuestionIds, userAnswers]);

    React.useEffect(() => {
        if (!currentUser?.id) return;
        void ensureUserProgressLoaded();
    }, [currentUser?.id, ensureUserProgressLoaded]);

    React.useEffect(() => {
        if (!shouldLoadQuestionBankForProfile) {
            return;
        }

        void ensureQuestionsLoaded();
    }, [ensureQuestionsLoaded, shouldLoadQuestionBankForProfile]);

    React.useEffect(() => {
        if (activeTab !== 'saved-questions' || missingSavedQuestionIds.length === 0) {
            return;
        }

        let isMounted = true;
        let hasFinished = false;
        const loadingFrameId = window.requestAnimationFrame(() => {
            if (isMounted && !hasFinished) {
                setIsLoadingSavedQuestions(true);
            }
        });

        Promise.all(
            missingSavedQuestionIds.map(async (questionId) => {
                try {
                    return await questionService.getQuestionById(questionId);
                } catch (error) {
                    clientLog.warn(`Failed to load saved question ${questionId}`, error);
                    return null;
                }
            }),
        ).then((loadedQuestions) => {
            if (!isMounted) return;

            const validQuestions = loadedQuestions.filter(Boolean) as Question[];
            if (validQuestions.length === 0) {
                return;
            }

            setSavedQuestionDetails((currentQuestions) => {
                const nextQuestions = new Map<string, Question>();
                currentQuestions.forEach((question) => {
                    if (question?.id !== undefined && question?.id !== null) {
                        nextQuestions.set(String(question.id), question);
                    }
                });
                validQuestions.forEach((question) => {
                    if (question?.id !== undefined && question?.id !== null) {
                        nextQuestions.set(String(question.id), question);
                    }
                });

                return Array.from(nextQuestions.values());
            });
        }).finally(() => {
            hasFinished = true;
            window.cancelAnimationFrame(loadingFrameId);
            if (isMounted) {
                setIsLoadingSavedQuestions(false);
            }
        });

        return () => {
            isMounted = false;
            window.cancelAnimationFrame(loadingFrameId);
        };
    }, [activeTab, missingSavedQuestionIds]);

    React.useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            setLawNotes(currentUserKey ? listLegalCommentaryNotesForUser(currentUserKey) : []);
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [currentUserKey]);

    const notebookEntries = React.useMemo<NotebookEntry[]>(() => {
        const questionEntries = userNotes.map((note) => {
            const question = questions.find((item) => Number(item.id) === Number(note.questionId));
            const questionLabel = question
                ? truncateText(stripHtml(question.enunciado_clean || question.enunciado || `Questão #${note.questionId}`), 92)
                : `Questão #${note.questionId}`;

            const assuntos = Array.isArray(question?.assuntos)
                ? question.assuntos.map((assunto) => assunto.nome || assunto.name).filter(Boolean)
                : [];

            return {
                id: `question-${note.id}`,
                source: 'question' as const,
                title: questionLabel,
                subtitle: assuntos.length > 0 ? assuntos.slice(0, 2).join(' • ') : 'Anotação em questão',
                text: note.text,
                timestamp: note.timestamp,
                href: buildQuestionPath(question || { id: note.questionId, enunciado_clean: `Questão ${note.questionId}` }),
                questionId: note.questionId,
            };
        });

        const legalEntries = lawNotes.map((note) => ({
            id: `law-${note.id}`,
            source: 'law' as const,
            title: note.articleTitle
                ? `Art. ${note.articleNumber || '?'} • ${note.articleTitle}`
                : `Art. ${note.articleNumber || '?'} • ${note.lawShortTitle || note.lawTitle || 'Lei Comentada'}`,
            subtitle: [note.lawTitle || note.lawShortTitle || 'Lei Comentada', note.areaName].filter(Boolean).join(' • '),
            text: note.note,
            timestamp: note.updatedAt,
            href: note.lawSlug ? `/lei-comentada/${note.lawSlug}${note.articleId ? `#${note.articleId}` : ''}` : undefined,
            articleId: note.articleId,
            lawSlug: note.lawSlug,
        }));

        const materialEntries = materialNotes.map((note) => ({
            id: `material-${note.materialId}`,
            source: 'material' as const,
            title: note.title,
            subtitle: note.subtitle || 'Anotação em material',
            text: note.text,
            timestamp: note.timestamp,
            href: `/read/${note.materialId}`,
            materialId: note.materialId,
        }));

        return [...questionEntries, ...legalEntries, ...materialEntries].sort((left, right) => right.timestamp - left.timestamp);
    }, [lawNotes, materialNotes, questions, userNotes]);

    const handleRemoveLawNote = React.useCallback((articleId: string) => {
        if (!currentUserKey) return;

        removeLegalCommentaryArticleNote(currentUserKey, articleId);
        setLawNotes((currentNotes) => currentNotes.filter((note) => note.articleId !== articleId));
        addToast('Anotação removida.', 'success');
    }, [addToast, currentUserKey]);

    const fetchFavoriteLaws = React.useCallback(async () => {
        if (!currentUserKey) {
            setFavoriteLaws([]);
            return;
        }

        setIsLoadingFavoriteLaws(true);
        try {
            const snapshot = await legalCommentaryApiService.getHomeSnapshot({ force: true });
            const nextFavoriteLawsById = new Map<string, LawSummary>();

            snapshot.favoriteLaws.forEach((law) => {
                nextFavoriteLawsById.set(String(law.id), law);
            });

            snapshot.lawsByArea
                .flatMap((group) => group.laws)
                .filter((law) => law.isFavorite)
                .forEach((law) => {
                    nextFavoriteLawsById.set(String(law.id), law);
                });

            const nextFavoriteLaws = Array.from(nextFavoriteLawsById.values());
            setFavoriteLaws(nextFavoriteLaws);
        } catch {
            addToast('Não foi possível carregar suas leis favoritas.', 'error');
        } finally {
            setIsLoadingFavoriteLaws(false);
        }
    }, [addToast, currentUserKey]);

    const handleRemoveFavoriteLaw = React.useCallback(async (law: LawSummary) => {
        if (!currentUserKey) return;

        try {
            const result = await legalCommentaryApiService.toggleFavorite('law', law.id);
            if (!result.isFavorite) {
                setFavoriteLaws((currentLaws) => currentLaws.filter((item) => item.id !== law.id));
                addToast('Lei removida dos favoritos.', 'success');
                return;
            }

            await fetchFavoriteLaws();
        } catch {
            addToast('Não foi possível atualizar o favorito.', 'error');
        }
    }, [addToast, currentUserKey, fetchFavoriteLaws]);

    const handleRemoveSavedQuestion = React.useCallback((questionId: string) => {
        toggleSavedQuestion(questionId);
        addToast('Questão removida dos salvos.', 'success');
    }, [addToast, toggleSavedQuestion]);

    const formatSavedCardLabel = React.useCallback((card: SavedCard | null | undefined) => {
        if (!card) return '';
        return formatMaskedCardLabelAscii(card);
    }, []);

    const getCardExpiryState = React.useCallback((card: SavedCard | null | undefined) => {
        if (!card?.exp_month || !card?.exp_year) {
            return { isExpired: false, isExpiringSoon: false };
        }

        const now = new Date();
        const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
        const expiryMonthIndex = (Number(card.exp_year) * 12) + (Number(card.exp_month) - 1);
        const remainingMonths = expiryMonthIndex - currentMonthIndex;

        return {
            isExpired: remainingMonths < 0,
            isExpiringSoon: remainingMonths >= 0 && remainingMonths <= 1,
        };
    }, []);

    const normalizeProfileTabForAccess = React.useCallback((tab: Exclude<ProfileTab, 'evolution'>) => {
        if (tab === 'referral' && !canAccessReferralTab) return 'personal';
        if (tab === 'materials' && !marketplaceEnabled) return 'personal';
        return tab;
    }, [canAccessReferralTab, marketplaceEnabled]);

    const changeActiveTab = React.useCallback((nextTab: ProfileTab, options?: { replace?: boolean }) => {
        const resolvedTab = resolveProfileTab(nextTab);
        const normalizedTab = normalizeProfileTabForAccess(resolvedTab);
        const nextPath = buildProfilePath(normalizedTab);

        if (location.pathname !== nextPath || location.search) {
            if (options?.replace ?? false) {
                router.replace(nextPath);
            } else {
                router.push(nextPath);
            }
            return;
        }

        setActiveTab(normalizedTab);
    }, [location.pathname, location.search, normalizeProfileTabForAccess, router]);

    const scrollToPersonalDetailsForm = React.useCallback(() => {
        pendingPersonalDetailsScrollRef.current = true;
        changeActiveTab('personal');

        window.setTimeout(() => {
            if (!pendingPersonalDetailsScrollRef.current || !personalDetailsSectionRef.current) {
                return;
            }

            personalDetailsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            pendingPersonalDetailsScrollRef.current = false;
        }, 160);
    }, [changeActiveTab]);

    // Sincronizar aba com parâmetro da URL (?tab=)
    React.useEffect(() => {
        const legacyTab = new URLSearchParams(location.search).get('tab');
        const resolvedTab = resolveProfileTab(params.tab || legacyTab);
        const normalizedTab = normalizeProfileTabForAccess(resolvedTab);
        const canonicalPath = buildProfilePath(normalizedTab);

        if (location.pathname !== canonicalPath || location.search) {
            router.replace(canonicalPath);
            return;
        }

        const frameId = window.requestAnimationFrame(() => {
            setActiveTab(normalizedTab);
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [location.pathname, location.search, normalizeProfileTabForAccess, router, params.tab]);

    React.useEffect(() => {
        if (activeTab !== 'personal' || !pendingPersonalDetailsScrollRef.current) {
            return;
        }

        const frameId = window.requestAnimationFrame(() => {
            personalDetailsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            pendingPersonalDetailsScrollRef.current = false;
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [activeTab]);

    // Handlers de API para Gerenciamento de Dados
    const primarySavedCardExpiryState = useMemo(() => getCardExpiryState(primarySavedCard), [getCardExpiryState, primarySavedCard]);

    const fetchUserCards = React.useCallback(async () => {
        if (!currentUser?.id) return;
        setIsLoadingCards(true);
        setCardsLoadError(null);
        try {
            const res = await cardsService.listSavedCards();
            if (res.success) setUserCards(res.cards || []);
        } catch (err) {
            clientLog.warn('Failed to fetch cards', err);
            setCardsLoadError('Nao foi possivel sincronizar seus cartoes salvos na Stripe agora.');
        } finally {
            setIsLoadingCards(false);
        }
    }, [currentUser?.id]);

    const handleRemoveCard = async (cardId: string) => {
        const confirmed = await confirm({
            title: 'Remover cartão',
            description: 'Tem certeza que deseja remover este cartão salvo?',
            confirmText: 'Remover',
            cancelText: 'Cancelar',
            type: 'danger',
        });
        if (!confirmed) return;

        try {
            const res = await cardsService.removeSavedCard(cardId);
            addToast(res.message || 'Cartão removido com sucesso!', 'success');
            fetchUserCards();
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro ao remover cartão.'), 'error');
        }
    };

    const handleSetDefaultCard = async (cardId: string) => {
        try {
            const res = await cardsService.setDefaultSavedCard(cardId);
            addToast(res.message || 'Cartão padrão atualizado!', 'success');
            fetchUserCards();
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro ao definir cartão padrão.'), 'error');
        }
    };

    const handleSaveCard = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!currentUser?.id) return;
        if (isStripeBilling) {
            addToast('Use o cofre Stripe interno abaixo para salvar um novo cartão.', 'info');
            return;
        }
        
        setIsSavingCard(true);
        const formData = new FormData(e.currentTarget);
        const data = {
            user_id: currentUser.id,
            card_number: (formData.get('cardNumber') as string).replace(/\s/g, ''),
            card_name: formData.get('cardName'),
            card_expiry: formData.get('expiry'),
            brand: formData.get('brand') || 'outros'
        };

        try {
            const res = await cardsService.saveLegacyCard(data);
            addToast(res.message || 'Cartão salvo com sucesso!', 'success');
            setIsAddingCard(false);
            fetchUserCards();
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro de rede ao salvar cartão.'), 'error');
        } finally {
            setIsSavingCard(false);
        }
    };

    const handlePrepareStripeCard = async () => {
        setIsSavingCard(true);
        try {
            const res = await cardsService.createStripeSetupIntent();
            setStripeSetupClientSecret(res.client_secret);
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro ao preparar o formulário Stripe.'), 'error');
        } finally {
            setIsSavingCard(false);
        }
    };

    const handleStripeCardSaved = async (paymentMethodId: string) => {
        try {
            const res = await cardsService.syncStripeCard(paymentMethodId);
            addToast(res.message || 'Cartão salvo com sucesso na Stripe!', 'success');
            setStripeSetupClientSecret(null);
            setIsAddingCard(false);
            await fetchUserCards();
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro ao salvar o cartão Stripe.'), 'error');
        }
    };

    const openSavedCardsManager = () => {
        changeActiveTab('personal');
        window.setTimeout(() => {
            document.getElementById('saved-cards-personal-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
    };

    const prepareTestimonialModal = React.useCallback(() => {
        setTestimonialDisplayName((current) => current.trim() || defaultTestimonialDisplayName);
        setTestimonialHeadline((current) => current.trim() || defaultTestimonialHeadline);
    }, [defaultTestimonialDisplayName, defaultTestimonialHeadline]);

    const openTestimonialModal = React.useCallback(() => {
        prepareTestimonialModal();
        setShowTestimonialModal(true);
    }, [prepareTestimonialModal]);

    React.useEffect(() => {
        if (!showTestimonialModal || !currentUser?.id) {
            return;
        }

        let isMounted = true;
        const frameId = window.requestAnimationFrame(() => {
            setIsLoadingPlatformRatings(true);
            supportService.listThreads()
                .then((threads) => {
                    if (!isMounted) return;
                    setUserPlatformRatings(threads.filter(isPlatformRatingThread));
                })
                .catch((error) => {
                    clientLog.warn('Failed to load platform ratings', error);
                    if (isMounted) {
                        setUserPlatformRatings([]);
                    }
                })
                .finally(() => {
                    if (isMounted) {
                        setIsLoadingPlatformRatings(false);
                    }
                });
        });

        return () => {
            isMounted = false;
            window.cancelAnimationFrame(frameId);
        };
    }, [currentUser?.id, showTestimonialModal]);

    const fetchSupportHistory = React.useCallback(async (notifyOnError = false) => {
        if (!currentUser?.id) {
            setSupportHistoryThreads([]);
            return;
        }

        setIsLoadingSupportHistory(true);

        try {
            const threads = await supportService.listThreads();
            setSupportHistoryThreads(threads.filter((thread) => !isPlatformRatingThread(thread)));
        } catch (error) {
            clientLog.warn('Failed to load support history', error);
            if (notifyOnError) {
                addToast(readApiErrorMessage(error, 'Não foi possível carregar seu histórico de suporte.'), 'error');
            }
        } finally {
            setIsLoadingSupportHistory(false);
        }
    }, [addToast, currentUser?.id]);

    const toggleSupportHistoryThread = React.useCallback(async (threadId: number) => {
        if (expandedSupportThreadId === threadId) {
            setExpandedSupportThreadId(null);
            return;
        }

        setExpandedSupportThreadId(threadId);

        if (supportReplies[threadId]) {
            return;
        }

        setLoadingSupportReplies(threadId);

        try {
            const threadReplies = await supportService.listReplies(threadId);
            setSupportReplies((currentReplies) => ({ ...currentReplies, [threadId]: threadReplies }));
        } catch (error) {
            clientLog.warn('Failed to load support replies in profile', error);
            addToast(readApiErrorMessage(error, 'Não foi possível carregar a conversa completa.'), 'error');
        } finally {
            setLoadingSupportReplies(null);
        }
    }, [addToast, expandedSupportThreadId, supportReplies]);

    const handleSupportHistoryReplySubmit = React.useCallback(async (thread: SupportThread) => {
        const draft = (supportReplyDrafts[thread.id] || '').trim();

        if (!draft) {
            addToast('Escreva uma resposta antes de enviar.', 'warning');
            return;
        }

        setSendingSupportReplyId(thread.id);

        try {
            await supportService.replyToThread(thread.id, thread.type, draft);
            const threadReplies = await supportService.listReplies(thread.id);
            setSupportReplies((currentReplies) => ({ ...currentReplies, [thread.id]: threadReplies }));
            setSupportReplyDrafts((currentDrafts) => ({ ...currentDrafts, [thread.id]: '' }));
            await fetchSupportHistory(false);
            addToast('Resposta enviada com sucesso.', 'success');
        } catch (error) {
            clientLog.warn('Failed to reply support thread in profile', error);
            addToast(readApiErrorMessage(error, 'Não foi possível enviar sua resposta.'), 'error');
        } finally {
            setSendingSupportReplyId(null);
        }
    }, [addToast, fetchSupportHistory, supportReplyDrafts]);

    const closeProfilePhotoCrop = React.useCallback(() => {
        setProfilePhotoCropDraft(null);
    }, []);

    const openProfilePhotoPicker = React.useCallback(() => {
        if (isSavingProfilePhoto) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;

            const file = target.files?.[0];
            if (!file) return;

            setProfilePhotoCropDraft({
                file,
                previewUrl: URL.createObjectURL(file),
                zoom: 1.12,
                offsetX: 0,
                offsetY: 0,
            });
        };
        input.click();
    }, [isSavingProfilePhoto]);

    const updateProfilePhotoCrop = React.useCallback((patch: Partial<Pick<ProfilePhotoCropDraft, 'zoom' | 'offsetX' | 'offsetY'>>) => {
        setProfilePhotoCropDraft((currentDraft) => (
            currentDraft ? { ...currentDraft, ...patch } : currentDraft
        ));
    }, []);

    const handleSaveProfilePhotoCrop = React.useCallback(async () => {
        if (!profilePhotoCropDraft || isSavingProfilePhoto) return;

        setIsSavingProfilePhoto(true);
        try {
            const croppedFile = await buildCircularProfilePhotoFile(profilePhotoCropDraft);
            const res = await profileService.uploadProfilePhoto(croppedFile);
            const uploadedPhotoUrl = res.photoUrl || '';

            if (!uploadedPhotoUrl) {
                throw new Error('A foto foi enviada, mas o servidor nao retornou a URL da imagem.');
            }

            await updateUser({ photoUrl: uploadedPhotoUrl });
            await refreshUser();
            await updateUser({
                photoUrl: uploadedPhotoUrl,
                ...(res.newXp !== undefined ? { xp: res.newXp } : {}),
                ...(res.newLevel !== undefined ? { level: res.newLevel } : {}),
            });

            setProfilePhotoCropDraft(null);
            addToast(
                res.xpGain ? `${res.message || 'Foto de perfil atualizada!'} +${res.xpGain} XP.` : res.message || 'Foto de perfil atualizada!',
                'success',
            );
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro ao enviar foto.'), 'error');
        } finally {
            setIsSavingProfilePhoto(false);
        }
    }, [addToast, isSavingProfilePhoto, profilePhotoCropDraft, refreshUser, updateUser]);

    const handleRemoveProfilePhoto = async () => {
        if (isRemovingProfilePhoto) return;
        const confirmed = await confirm({
            title: 'Remover foto',
            description: 'Tem certeza que deseja remover sua foto de perfil?',
            confirmText: 'Remover foto',
            cancelText: 'Cancelar',
            type: 'danger',
        });
        if (!confirmed) return;

        setIsRemovingProfilePhoto(true);
        try {
            const res = await profileService.removeProfilePhoto();
            addToast(res.message || 'Foto de perfil removida!', 'success');
            await refreshUser();
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro ao remover foto.'), 'error');
        } finally {
            setIsRemovingProfilePhoto(false);
        }
    };

    const handleSubmitTestimonial = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentUser?.id || isSubmittingTestimonial) return;

        const testimonial = testimonialText.trim();
        const publicDisplayName = testimonialDisplayName.trim();
        const publicHeadline = testimonialHeadline.trim();

        if (testimonial.length < 20) {
            addToast('Escreva um depoimento com pelo menos 20 caracteres.', 'error');
            return;
        }
        if (publicDisplayName.length < 2) {
            addToast('Informe o nome que pode aparecer publicamente.', 'error');
            return;
        }
        if (publicHeadline.length < 3) {
            addToast('Informe o contexto do depoimento, como seu concurso, prova ou objetivo.', 'error');
            return;
        }

        setIsSubmittingTestimonial(true);
        try {
            const result = await profileService.submitTestimonial({
                rating: testimonialRating,
                testimonial,
                publicDisplayName,
                publicHeadline,
                photoUrl: currentUser.photoUrl,
                userName: currentUser.name,
                userEmail: currentUser.email,
                planName: effectivePlanDisplayName,
            });

            if (result.newXp !== undefined || result.newLevel !== undefined) {
                await updateUser({
                    ...(result.newXp !== undefined ? { xp: result.newXp } : {}),
                    ...(result.newLevel !== undefined ? { level: result.newLevel } : {}),
                });
            }

            addToast(result.xpGain ? `${result.message} +${result.xpGain} XP.` : result.message, 'success');
            setUserPlatformRatings((currentRatings) => [
                {
                    id: result.id || Date.now(),
                    type: 'platform-rating',
                    reason: 'Avaliar plataforma',
                    details: testimonial,
                    status: 'new',
                    created_at: new Date().toISOString(),
                    public_rating: testimonialRating,
                    public_display_name: publicDisplayName,
                    public_headline: publicHeadline,
                },
                ...currentRatings,
            ]);
            setTestimonialRating(5);
            setTestimonialText('');
            setTestimonialDisplayName(defaultTestimonialDisplayName);
            setTestimonialHeadline(defaultTestimonialHeadline);
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Não foi possível enviar seu depoimento agora.'), 'error');
        } finally {
            setIsSubmittingTestimonial(false);
        }
    };

    const handleOpenStripePortal = async () => {
        if (!currentUser?.id) return;

        setIsOpeningBillingPortal(true);
        try {
            const res: ProfileServiceActionResponse = await planService.createStripePortalSession();
            const redirectUrl = typeof res.url === 'string' ? res.url : null;

            if (!redirectUrl) {
                throw new Error(res.message || 'Não foi possível abrir o portal da Stripe.');
            }

            window.location.href = redirectUrl;
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro ao abrir o portal da Stripe.'), 'error');
        } finally {
            setIsOpeningBillingPortal(false);
        }
    };

    const requestProfileRecaptchaToken = React.useCallback(async (action: string) => {
        if (!recaptchaEnabled) {
            return null;
        }

        if (!isProfileRecaptchaReady) {
            throw new Error(profileRecaptchaLoadError || 'A verificação de segurança ainda está carregando.');
        }

        return executeProfileRecaptcha(action);
    }, [executeProfileRecaptcha, isProfileRecaptchaReady, profileRecaptchaLoadError, recaptchaEnabled]);

    const handleCancelSubscription = async () => {
        if (!currentUser?.id || !currentUser.subscription || cancelRequestInFlightRef.current) return;

        if (isProfileSecurityCheckLoading) {
            addToast('A verificação de segurança ainda está carregando. Aguarde alguns segundos.', 'warning');
            return;
        }

        if (requiresOutstandingDebtConfirmation && !confirmOutstandingDebtCharge) {
            addToast('Confirme a quitação das parcelas pre-aprovadas antes de cancelar.', 'warning');
            return;
        }

        cancelRequestInFlightRef.current = true;
        setIsCancelingSubscription(true);
        
        const isRefundable = isWithinRefundWindow;
        const shouldSettleDebt = requiresOutstandingDebtConfirmation && confirmOutstandingDebtCharge;

        try {
            const captchaToken = await requestProfileRecaptchaToken('profile_cancel_subscription');
            const res = await planService.cancelSubscription(
                currentUser.id, 
                cancelReason || (isRefundable ? 'arrependimento' : 'user_request'),
                cancelDetails || undefined,
                captchaToken,
                shouldSettleDebt
            );
            if (res.success) {
                addToast(
                    res.message || (res.debt_settled
                        ? 'Saldo contratado quitado. A renovação foi desligada e seu acesso segue até o fim do termo.'
                        : (isRefundable
                            ? 'Solicitacao de cancelamento com reembolso registrada.'
                            : 'Renovacao automatica atualizada.')),
                    'success'
                );
                setShowCancelModal(false);
                setCancelReason('');
                setCancelDetails('');
                setConfirmOutstandingDebtCharge(false);
                await refreshUser();
                setOptimisticAutoRenew(null);
            } else {
                addToast(res.message || 'Erro ao cancelar assinatura.', 'error');
            }
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro ao processar cancelamento.'), 'error');
        } finally {
            cancelRequestInFlightRef.current = false;
            setIsCancelingSubscription(false);
        }
    };

    const closeCancelModal = () => {
        if (isCancelingSubscription) return;
        setShowCancelModal(false);
        setConfirmOutstandingDebtCharge(false);
    };

    const handleSavePrivacyPreferences = async () => {
        if (!currentUser?.id || isSavingPrivacyPreferences) return;

        setIsSavingPrivacyPreferences(true);
        try {
            const nextPreferences = {
                ...currentUser.preferences,
                ...privacyPreferencesDraft,
            };

            if (privacyPreferencesDraft.defaultTheme === 'light' || privacyPreferencesDraft.defaultTheme === 'dark') {
                setTheme(privacyPreferencesDraft.defaultTheme);
            } else if (typeof window !== 'undefined') {
                const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                setTheme(preferredTheme);
            }

            await updateUser({ preferences: nextPreferences });
        } catch (error: unknown) {
            addToast(readApiErrorMessage(error, 'Nao foi possivel salvar suas preferencias.'), 'error');
        } finally {
            setIsSavingPrivacyPreferences(false);
        }
    };

    const handleRequestAccountDeletion = async () => {
        if (!currentUser?.id || isRequestingAccountDeletion) return;

        const reason = accountDeletionReason.trim();
        if (reason.length < 10) {
            addToast('Informe um motivo com pelo menos 10 caracteres para confirmar a exclusao.', 'warning');
            return;
        }

        if (isProfileSecurityCheckLoading) {
            addToast('A verificação de segurança ainda está carregando. Aguarde alguns segundos.', 'warning');
            return;
        }

        const confirmed = await confirm({
            title: 'Excluir conta',
            description: 'Sua conta sera marcada para exclusao e voce sera desconectado. Esta acao exige tratamento interno e nao deve ser usada para pausar assinatura.',
            confirmText: 'Solicitar exclusao',
            cancelText: 'Cancelar',
            type: 'danger',
        });

        if (!confirmed) return;

        setIsRequestingAccountDeletion(true);
        try {
            const captchaToken = await requestProfileRecaptchaToken('profile_delete_account');
            const result = await profileService.requestAccountDeletion(reason, captchaToken);
            addToast(result.message || 'Solicitacao de exclusao registrada.', 'success');
            await logout();
        } catch (error: unknown) {
            addToast(readApiErrorMessage(error, 'Nao foi possivel solicitar a exclusao da conta.'), 'error');
        } finally {
            setIsRequestingAccountDeletion(false);
        }
    };

    const handleRenewalToggle = async () => {
        if (!currentUser?.id || !activeSubscription || isUpdatingRenewal || renewalRequestInFlightRef.current) return;

        const nextValue = !resolvedAutoRenew;
        const totalInstallments = Math.max(1, Number(activeSubscription.total_installments || 1));
        const paidInstallmentsCount = Math.max(0, Number(activeSubscription.paid_installments || 0));
        const hasRemainingCommitment = totalInstallments > 1 && paidInstallmentsCount < totalInstallments;

        if (nextValue && userCards.length === 0) {
            addToast('Você precisa de um cartão salvo para ativar a renovação automática.', 'warning');
            setIsAddingCard(true);
            openSavedCardsManager();
            return;
        }

        renewalRequestInFlightRef.current = true;
        setOptimisticAutoRenew(nextValue);
        setIsUpdatingRenewal(true);

        try {
            const res: ProfileServiceActionResponse<{ auto_renew?: boolean }> = await planService.updateRenewal(nextValue);
            if (res.success) {
                const confirmedAutoRenew = typeof res.data?.auto_renew === 'boolean'
                    ? res.data.auto_renew
                    : nextValue;

                setOptimisticAutoRenew(confirmedAutoRenew);
                addToast(
                    confirmedAutoRenew
                        ? 'Renovação automática ativada.'
                        : (hasRemainingCommitment
                            ? 'Renovação automática desativada. A assinatura sera encerrada ao fim do termo contratado.'
                            : 'Renovação automática desativada. A assinatura sera encerrada ao fim do período atual.'),
                    'success'
                );
                await refreshUser();
            } else {
                addToast(res.message || 'Erro ao atualizar renovação.', 'error');
                setOptimisticAutoRenew(null);
            }
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro ao processar solicitacao.'), 'error');
            setOptimisticAutoRenew(null);
        } finally {
            renewalRequestInFlightRef.current = false;
            setIsUpdatingRenewal(false);
        }
    };

    const fetchUserTransactions = React.useCallback(async () => {
        if (!currentUser?.id) return;
        setIsLoadingTransactions(true);
        try {
            const transactions = await transactionsService.list({
                userId: currentUser.id,
                limit: 50,
            });
            setUserTransactions(transactions);
        } catch (err) {
            clientLog.warn('Failed to fetch transactions', err);
            addToast('Erro ao carregar histórico de pagamentos.', 'error');
        } finally {
            setIsLoadingTransactions(false);
        }
    }, [addToast, currentUser]);

    const refreshNotificationsAfterBillingSync = React.useCallback(async () => {
        const userId = currentUser?.id;
        if (!userId) return;

        try {
            const notifications = await queryClient.fetchQuery({
                queryKey: buildNotificationsQueryKey(userId),
                queryFn: () => fetchNotificationsList(userId),
                staleTime: 0,
            });
            replaceNotifications(userId, notifications);
        } catch (error) {
            clientLog.warn('Failed to refresh billing notifications', error);
        }
    }, [currentUser?.id, queryClient, replaceNotifications]);

    const syncStripeSubscriptionState = React.useCallback(async (options?: { force?: boolean; showLoader?: boolean }) => {
        if (!currentUser?.id || !isStripeBilling || !hasActiveSubscription) {
            setHasSyncedBillingSnapshot(true);
            return;
        }

        const now = Date.now();
        if (!options?.force && now - lastBillingSyncAtRef.current < 90_000) {
            setHasSyncedBillingSnapshot(true);
            return;
        }

        if (billingSyncRequestInFlightRef.current) {
            return;
        }

        billingSyncRequestInFlightRef.current = true;
        lastBillingSyncAtRef.current = now;
        if (options?.showLoader) {
            setIsSyncingBillingSnapshot(true);
        }

        try {
            const response = await subscriptionsService.syncCurrentStripeState();
            if (response?.materialized_invoice) {
                addToast('Renovação sincronizada com sucesso.', 'success');
                void fetchUserTransactions();
                void refreshNotificationsAfterBillingSync();
            }
            await refreshUser();
        } catch (syncError) {
            clientLog.warn('Failed to sync Stripe subscription state', syncError);
        } finally {
            billingSyncRequestInFlightRef.current = false;
            setHasSyncedBillingSnapshot(true);
            setIsSyncingBillingSnapshot(false);
        }
    }, [addToast, currentUser?.id, fetchUserTransactions, hasActiveSubscription, isStripeBilling, refreshNotificationsAfterBillingSync, refreshUser]);

    const formatTransactionAmount = (amount: number | string) => {
        const numericAmount = typeof amount === 'number' ? amount : Number(amount || 0);
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(numericAmount || 0);
    };

    const getTransactionStatusMeta = (status?: string) => {
        const normalized = String(status || '').toLowerCase();

        if (normalized === 'approved' || normalized === 'completed') {
            return {
                label: 'Aprovado',
                className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
            };
        }

        if (normalized === 'refund_requested') {
            return {
                label: 'Reembolso em análise',
                className: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
            };
        }

        if (normalized === 'refunded') {
            return {
                label: 'Reembolsado',
                className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
            };
        }

        if (normalized === 'pending' || normalized === 'pre-approved') {
            return {
                label: normalized === 'pre-approved' ? 'Pre-aprovada' : 'Pendente',
                className: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
            };
        }

        if (normalized === 'rejected') {
            return {
                label: 'Recusado',
                className: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
            };
        }

        return {
            label: 'Cancelado',
            className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        };
    };

    const formatDateBR = (value?: string | number | Date | null) => formatDateInSaoPaulo(value);

    const formatDateTimeBR = (value?: string | number | Date | null) => formatDateTimeInSaoPaulo(value);

    const resolveTransactionCycleLabel = (tx: ProfileTransaction) => {
        const explicitCycle = String(
            tx.cycleLabel
            || tx.planCycleLabel
            || tx.billingCycleLabel
            || tx.billingCycle
            || tx.intervalLabel
            || '',
        ).trim();
        const normalizedExplicitCycle = explicitCycle.toLowerCase();
        if (
            explicitCycle
            && normalizedExplicitCycle !== 'não informado'
            && normalizedExplicitCycle !== 'nao informado'
            && normalizedExplicitCycle !== '-'
        ) {
            return explicitCycle;
        }

        const intervalUnit = String(tx.intervalUnit || tx.interval_unit || '').toLowerCase();
        const intervalCount = Number(tx.intervalCount || tx.interval_count || 1);
        const planLikeLabel = String(
            tx.planName
            || tx.transactionName
            || tx.description
            || '',
        ).toLowerCase();

        if (intervalUnit === 'year') return 'Anual';
        if (intervalUnit === 'month' && intervalCount === 3) return 'Trimestral';
        if (intervalUnit === 'month') return 'Mensal';
        if (intervalUnit === 'week') return 'Semanal';
        if (intervalUnit === 'day') return intervalCount > 1 ? `A cada ${intervalCount} dias` : 'Diário';
        if (planLikeLabel.includes('anual')) return 'Anual';
        if (planLikeLabel.includes('trimestral')) return 'Trimestral';
        if (planLikeLabel.includes('mensal')) return 'Mensal';

        return 'Não informado';
    };

    const resolveTransactionGatewayLabel = (tx: ProfileTransaction) => {
        const provider = String(
            tx.paymentProvider
            || tx.payment_provider
            || tx.provider
            || tx.gateway
            || '',
        ).trim();

        if (!provider) return 'Não informado';
        if (provider.toLowerCase() === 'stripe') return 'Stripe';
        return provider;
    };

    const resolveTransactionMethodLabel = (tx: ProfileTransaction) => {
        const explicitMethod = String(tx.paymentMethodLabel || tx.paymentMethod || tx.payment_method || '').trim();
        if (explicitMethod) return explicitMethod;

        const fallbackMethod = String(tx.paymentMethodType || tx.method || '').toLowerCase();
        if (fallbackMethod === 'card') return 'Cartão';
        if (fallbackMethod === 'pix') return 'Pix';
        if (fallbackMethod === 'boleto') return 'Boleto';

        return 'Não informado';
    };

    const stripPlanCycleSuffix = (value?: string | null) =>
        String(value || '')
            .replace(/\s*-\s*Mensal$/i, '')
            .replace(/\s*-\s*Trimestral$/i, '')
            .replace(/\s*-\s*Anual$/i, '')
            .trim();

    const activeSubscription = currentUser?.subscription || null;
    const serverAutoRenewState = activeSubscription
        ? (typeof activeSubscription.auto_renew === 'boolean'
            ? activeSubscription.auto_renew
            : !Boolean(activeSubscription.cancel_at_period_end))
        : false;
    const resolvedAutoRenew = optimisticAutoRenew ?? serverAutoRenewState;
    const subscriptionPlanName = stripPlanCycleSuffix(currentUser?.planDisplayName || activeSubscription?.plan?.name || effectivePlanDisplayName) || 'Plano Gratuito';
    const subscriptionTimeline = resolveProfileSubscriptionTimeline({
        billing: currentUser?.billing || null,
        subscription: activeSubscription || null,
    });
    const subscriptionCycleLabel = (() => {
        const intervalUnit = String(activeSubscription?.plan?.interval_unit || '').toLowerCase();
        const intervalCount = Math.max(1, Number(activeSubscription?.plan?.interval_count || 1));

        if (intervalUnit === 'year') {
            return intervalCount > 1 ? `A cada ${intervalCount} anos` : 'Anual';
        }

        if (intervalUnit === 'month') {
            if (intervalCount >= 12) return 'Anual';
            if (intervalCount === 3) return 'Trimestral';
            return intervalCount > 1 ? `A cada ${intervalCount} meses` : 'Mensal';
        }

        if (intervalUnit === 'week') {
            return intervalCount > 1 ? `A cada ${intervalCount} semanas` : 'Semanal';
        }

        if (intervalUnit === 'day') {
            return intervalCount > 1 ? `${intervalCount} dias` : 'Diário';
        }

        const billingCycle = String(currentUser?.billing?.billingCycle || '').toLowerCase();
        if (billingCycle === 'annual') return 'Anual';
        if (billingCycle === 'quarterly') return 'Trimestral';
        return 'Mensal';
    })();
    const showFreeInactiveSubscriptionState = !hasActiveSubscription && subscriptionPlanName.toLowerCase().includes('gratuito');
    const {
        termStartAt: subscriptionStartDate,
        termEndAt: subscriptionEndDate,
        totalDays: subscriptionTotalCycleDays,
        remainingDays: subscriptionRemainingDays,
        usedDays: subscriptionUsedDays,
        progressPercent: subscriptionCycleProgress,
        nextChargeAt: subscriptionNextChargeAt,
    } = subscriptionTimeline;
    const hasPendingRefundRequest = userTransactions.some((transaction) => String(transaction.status || '').toLowerCase() === 'refund_requested');
    const installmentCount = Math.max(1, Number(activeSubscription?.total_installments || 1));
    const paidInstallments = Math.max(0, Number(activeSubscription?.paid_installments || 0));
    const firstPaidPlanTransactionAt = userTransactions
        .filter((transaction) => {
            const status = String(transaction.status || '').toLowerCase();
            const type = String(transaction.type || '').toLowerCase();
            return type === 'plan'
                && Number(transaction.amount || 0) > 0
                && ['approved', 'completed', 'refund_requested', 'refunded'].includes(status);
        })
        .map((transaction) => parseSubscriptionDate(transaction.createdAt || transaction.created_at || transaction.dueDate || null))
        .filter((date): date is Date => Boolean(date))
        .sort((left, right) => left.getTime() - right.getTime())[0] || null;
    const firstPaidChargeDaysSinceStart = firstPaidPlanTransactionAt && profileNowMs > 0
        ? Math.max(0, Math.floor((profileNowMs - firstPaidPlanTransactionAt.getTime()) / (24 * 60 * 60 * 1000)))
        : null;
    const isFirstSubscriptionCharge = paidInstallments <= 1;
    const isWithinRefundWindow = isFirstSubscriptionCharge && firstPaidChargeDaysSinceStart !== null
        ? firstPaidChargeDaysSinceStart < 7
        : false;
    const currentInstallment = installmentCount > 1
        ? Math.min(Math.max(paidInstallments, 1), installmentCount)
        : 1;
    const termCommitmentRemaining = installmentCount > 1 && paidInstallments < installmentCount;
    const recurringAmount = Number(activeSubscription?.recurring_amount || 0);
    const subscriptionChargeAmount = recurringAmount > 0 ? recurringAmount : Number(activeSubscription?.plan?.price || 0);
    const pendingInstallmentsCount = Math.max(0, installmentCount - paidInstallments);
    const outstandingTermDebtAmount = termCommitmentRemaining && subscriptionChargeAmount > 0
        ? Number((pendingInstallmentsCount * subscriptionChargeAmount).toFixed(2))
        : 0;
    const requiresOutstandingDebtConfirmation = hasActiveSubscription
        && !isWithinRefundWindow
        && outstandingTermDebtAmount > 0;
    const outstandingTermDebtLabel = formatTransactionAmount(outstandingTermDebtAmount);
    const nextChargeReferenceDate = subscriptionNextChargeAt || subscriptionEndDate;
    const nextRenewalAmount = termCommitmentRemaining && recurringAmount > 0
        ? recurringAmount
        : Number(activeSubscription?.next_renewal_amount || subscriptionChargeAmount || 0);
    const nextRenewalDate = activeSubscription?.next_renewal_date || nextChargeReferenceDate;
    const nextRenewalCycleLabel = String(activeSubscription?.next_renewal_cycle_label || subscriptionCycleLabel || 'Mensal');
    const nextRenewalDateObject = parseSubscriptionDate(nextRenewalDate);
    const profileNowReferenceMs = profileNowMs;
    const isNextRenewalOverdue = Boolean(
        hasActiveSubscription
        && resolvedAutoRenew
        && nextRenewalDateObject
        && nextRenewalDateObject.getTime() < profileNowReferenceMs
    );
    const nextRenewalPriceSourceLabel = termCommitmentRemaining
        ? 'valor contratado nas parcelas pre-aprovadas'
        : activeSubscription?.next_renewal_price_source === 'auto_coupon'
        ? 'cupom autoaplicado vigente'
        : 'preço atual do plano';
    const subscriptionValueDescription = showFreeInactiveSubscriptionState
        ? 'Plano gratuito ativo.'
        : installmentCount > 1
            ? `Parcela ${currentInstallment} de ${installmentCount} do termo contratado.`
            : `Cobrança ${subscriptionCycleLabel.toLowerCase()}.`;
    const subscriptionHeadline = hasActiveSubscription
        ? (resolvedAutoRenew
            ? (isNextRenewalOverdue
                ? `A cobrança prevista para ${formatDateTimeBR(nextRenewalDate)} está em atraso e precisa de averiguação financeira. Valor esperado: ${formatTransactionAmount(nextRenewalAmount)} no plano ${nextRenewalCycleLabel.toLowerCase()}.`
                : `A próxima renovação está prevista para ${formatDateTimeBR(nextRenewalDate)} por ${formatTransactionAmount(nextRenewalAmount)} no plano ${nextRenewalCycleLabel.toLowerCase()}.`)
            : (termCommitmentRemaining
                ? 'A renovação automática está desligada. O termo atual seguirá até a última parcela contratada e depois será encerrado.'
                : `A renovação automática está desligada. Seu acesso fica ativo até ${formatDateTimeBR(subscriptionEndDate)}.`))
        : 'Sua assinatura não está ativa no momento.';
    const renewalCardDescription = hasActiveSubscription
        ? (resolvedAutoRenew
            ? (isNextRenewalOverdue
                ? 'Esta cobrança já passou da data prevista. Confira o financeiro, o cartão padrão e a sincronização da assinatura antes de considerar o ciclo regular.'
                : `Ao manter a renovação ativa, a próxima cobrança seguirá o ${nextRenewalPriceSourceLabel}.`)
            : (termCommitmentRemaining
                ? 'A renovação esta desligada. As cobrancas atuais seguem ate o fim do termo contratado e depois param automaticamente.'
                : 'A renovação esta desligada e o acesso termina no fim deste ciclo.'))
        : 'Ative um plano pago para controlar a renovação automática por aqui.';
    const normalizedSubscriptionStatus = String(activeSubscription?.status || '').toLowerCase();
    const hasBlockingPaymentIssue = Boolean(
        currentUser?.paymentIssue?.interactionLock
        || activeSubscription?.payment_blocking
        || normalizedSubscriptionStatus === 'past_due'
    );
    const hasSubscriptionRecord = Boolean(activeSubscription?.id);
    const hasScheduledCancellation = Boolean(activeSubscription?.cancel_at_period_end);
    const isCanceledStatus = normalizedSubscriptionStatus === 'canceled' || normalizedSubscriptionStatus === 'cancelled';
    const hasScheduledEnding = hasActiveSubscription && !resolvedAutoRenew && hasScheduledCancellation;
    const isCanceledButStillActive = hasActiveSubscription && (hasScheduledEnding || isCanceledStatus);
    const renewalStateLabel = !hasSubscriptionRecord || !hasActiveSubscription
        ? 'Inexistente'
        : resolvedAutoRenew
            ? 'Ativada'
            : 'Desativada';
    const renewalStateClassName = renewalStateLabel === 'Ativada'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
        : renewalStateLabel === 'Desativada'
            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
    const cancellationImpactMessage = hasScheduledEnding
        ? (termCommitmentRemaining
            ? 'A renovação foi desligada. O termo atual segue até a última parcela já contratada.'
            : `A renovação foi desligada. O acesso permanece normal até ${formatDateTimeBR(subscriptionEndDate)}.`)
        : hasActiveSubscription
            ? (termCommitmentRemaining
                ? 'Se você cancelar agora, o acesso continua até o fim do termo contratado.'
                : `Se você cancelar agora, o acesso continua até ${formatDateTimeBR(subscriptionEndDate)}.`)
            : (isCanceledStatus
                ? 'Assinatura encerrada. Para voltar, ative um novo plano.'
                : 'Sem assinatura ativa para cancelamento.');
    const billingStatusLabel = currentUser?.paymentIssue
        ? 'Atencao no pagamento'
        : isNextRenewalOverdue
            ? 'Pagamento em atraso'
        : hasActiveSubscription
            ? 'Cobranca em dia'
            : 'Sem cobranca ativa';
    const shouldShowBillingSyncGate = activeTab === 'billing'
        && isStripeBilling
        && hasActiveSubscription
        && !hasSyncedBillingSnapshot;

    React.useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            setOptimisticAutoRenew(null);
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [activeSubscription?.id, activeSubscription?.auto_renew, activeSubscription?.cancel_at_period_end]);

    const fetchUserMaterials = React.useCallback(async () => {
        if (!marketplaceEnabled || !currentUser?.id) {
            setUserMaterials([]);
            setMaterialNotes([]);
            return;
        }

        try {
            const materials = await marketplaceService.listUserMaterials(currentUser.id);
            setUserMaterials(materials);
        } catch (err) {
            clientLog.warn('Error fetching materials:', err);
        }
    }, [currentUser, marketplaceEnabled]);

    const fetchMaterialNotesForMaterials = React.useCallback(async (materials: ProfileMaterial[]) => {
        if (!marketplaceEnabled || !currentUser?.id || materials.length === 0) {
            setMaterialNotes([]);
            return;
        }

        const settledNotes = await Promise.allSettled(
            materials.map(async (material) => {
                const materialId = String(material?.id || '').trim();
                if (!materialId) return null;

                const note = await readerService.getNote(materialId, currentUser.id);
                const noteText = String(note?.note_text || '').trim();
                if (!noteText) return null;

                const rawTimestamp = note?.updated_at
                    || material.updatedAt
                    || material.updated_at
                    || material.purchasedAt
                    || material.purchased_at
                    || new Date().toISOString();
                const parsedTimestamp = new Date(rawTimestamp).getTime();
                const materialType = String(material.type || '').trim();
                const materialKind = materialType.toLowerCase() === 'pdf'
                    ? 'PDF Interativo'
                    : (materialType || 'Material de estudo');

                return {
                    materialId,
                    title: material.title || `Material #${materialId}`,
                    subtitle: [materialKind, material.authorName || material.author_name].filter(Boolean).join(' • '),
                    text: noteText,
                    timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now(),
                };
            }),
        );

        const nextMaterialNotes = settledNotes
            .map((result) => result.status === 'fulfilled' ? result.value : null)
            .filter(Boolean) as MaterialNotebookNote[];

        setMaterialNotes(nextMaterialNotes);
    }, [currentUser, marketplaceEnabled]);

    const handleRemoveMaterialNote = React.useCallback(async (materialId: string) => {
        if (!currentUser?.id) return;

        try {
            await readerService.saveNote(materialId, '', currentUser.id);
            setMaterialNotes((currentNotes) => currentNotes.filter((note) => note.materialId !== materialId));
            addToast('Anotação removida.', 'success');
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro ao remover anotação do material.'), 'error');
        }
    }, [addToast, currentUser]);

    const fetchReferralStats = React.useCallback(async () => {
        try {
            const stats = await profileService.getReferralStats();
            setReferralStats(stats);
        } catch (err) {
            clientLog.warn('Failed to fetch referral stats', err);
        }
    }, []);

    const handleCancelRefundRequest = async () => {
        if (!currentUser?.id) return;
        const confirmed = await confirm({
            title: 'Cancelar reembolso',
            description: 'Deseja realmente cancelar sua solicitação de reembolso?',
            confirmText: 'Cancelar solicitação',
            cancelText: 'Voltar',
            type: 'warning',
        });
        if (!confirmed) return;

        try {
            const res: ProfileServiceActionResponse = await planService.cancelRefundRequest();
            addToast(res.message || 'Solicitacao cancelada com sucesso.', 'success');
            await refreshUser();
            await fetchUserTransactions();
        } catch (err: unknown) {
            addToast(readApiErrorMessage(err, 'Erro ao cancelar solicitacao.'), 'error');
        }
    };

    const renderBillingTab = () => {
        if (shouldShowBillingSyncGate) {
            return (
                <div className="space-y-5">
                    <section className={`${PLATFORM_SURFACE_CARD_CLASS} px-5 py-8 md:px-6`}>
                        <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                                <Loader2 size={22} className="animate-spin" />
                            </span>
                            <div className="max-w-md space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                    Assinatura
                                </p>
                                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                                    Sincronizando cobrança
                                </h2>
                                <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                    {isSyncingBillingSnapshot
                                        ? 'Estamos consultando a Stripe antes de exibir seu ciclo atual para evitar mostrar dados vencidos.'
                                        : 'Preparando a sincronização do seu ciclo atual.'}
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            );
        }

        return (
        <div className="space-y-5">
            {currentUser?.paymentIssue && (
                <div className={`rounded-[1.5rem] border px-4 py-4 ${currentUser.paymentIssue.type === 'expiring_card' ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10' : 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 rounded-2xl p-2.5 text-white shadow-lg ${currentUser.paymentIssue.type === 'expiring_card' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-rose-500 shadow-rose-500/20'}`}>
                                <ShieldAlert size={16} />
                            </div>
                            <div className="space-y-1">
                                <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${currentUser.paymentIssue.type === 'expiring_card' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}`}>Atencao no pagamento</p>
                                <p className="text-xs font-semibold leading-5 text-slate-700 dark:text-slate-200">
                                    {currentUser.paymentIssue.message || 'Atualize sua forma de pagamento para evitar interrupcoes no acesso.'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={openSavedCardsManager}
                            className="h-10 rounded-xl bg-slate-900 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800 dark:bg-rose-500 dark:text-slate-950"
                        >
                            Resolver
                        </button>
                    </div>
                </div>
            )}

            <section className={`overflow-hidden ${PLATFORM_SURFACE_CARD_CLASS}`}>
                <div className="border-b border-slate-100 px-5 py-6 dark:border-slate-800 md:px-6 md:py-6">
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Assinatura</p>
                            <h2 className={PLATFORM_PAGE_TITLE_CLASS}>
                                {showFreeInactiveSubscriptionState ? 'Plano Gratuito' : subscriptionPlanName}
                            </h2>
                            <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
                                {subscriptionHeadline}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2 md:max-w-[340px] md:justify-end">
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                                <span className={`h-2 w-2 rounded-full ${isNextRenewalOverdue ? 'bg-amber-500' : hasActiveSubscription ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                {isNextRenewalOverdue ? 'Cobrança em atraso' : hasActiveSubscription ? 'Assinatura ativa' : 'Assinatura'}
                            </span>
                            <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] ${
                                isNextRenewalOverdue
                                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                                    : hasActiveSubscription
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                                        : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                                {isNextRenewalOverdue ? 'Averiguar' : hasActiveSubscription ? 'Ativa' : 'Inativa'}
                            </span>
                            {hasActiveSubscription && (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {subscriptionCycleLabel}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => router.push('/plans')}
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-indigo-600 px-3 text-[9px] font-black uppercase tracking-[0.14em] text-white transition-all hover:bg-indigo-700"
                            >
                                {isElitePlan ? 'Gerenciar plano' : 'Upgrade'}
                                <ChevronRight size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 px-5 py-5 md:px-6 md:py-6">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Status</p>
                            <p className="mt-2 text-lg font-black leading-tight text-slate-900 dark:text-slate-100">
                                {hasPendingRefundRequest ? 'Reembolso em análise' : hasBlockingPaymentIssue ? 'Acesso bloqueado' : isNextRenewalOverdue ? 'Pagamento em atraso' : hasActiveSubscription ? 'Acesso liberado' : 'Assinatura inativa'}
                            </p>
                            <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                {hasPendingRefundRequest
                                    ? 'Sua solicitacao esta em andamento e atualizaremos o histórico assim que houver retorno do gateway.'
                                    : hasBlockingPaymentIssue
                                        ? 'Regularize a forma de pagamento para desbloquear novamente os recursos premium.'
                                        : isNextRenewalOverdue
                                            ? 'Há uma cobrança prevista vencida. Verifique o financeiro e a sincronização do gateway.'
                                        : hasActiveSubscription
                                        ? 'Seu acesso premium esta liberado e o ciclo atual segue normalmente.'
                                        : 'Sua assinatura não esta ativa no momento.'}
                            </p>
                        </div>

                        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Ciclo / vigencia</p>
                            <p className="mt-2 text-lg font-black leading-tight text-slate-900 dark:text-slate-100">
                                {hasActiveSubscription ? formatDateTimeBR(subscriptionEndDate) : 'Indeterminado'}
                            </p>
                            <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                {hasActiveSubscription ? `${subscriptionRemainingDays} dias restantes no ciclo atual.` : 'Sem ciclo de cobranca em andamento.'}
                            </p>
                        </div>

                        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Valor</p>
                            <p className="mt-2 text-lg font-black leading-tight text-slate-900 dark:text-slate-100">
                                {showFreeInactiveSubscriptionState ? '0,00' : formatTransactionAmount(subscriptionChargeAmount)}
                            </p>
                            <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                {subscriptionValueDescription}
                            </p>
                        </div>
                    </div>

                    {!showFreeInactiveSubscriptionState && activeSubscription && (
                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40 md:px-5 md:py-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Progresso do ciclo</p>
                                    <p className="text-lg font-black leading-tight text-slate-900 dark:text-slate-100">
                                        {subscriptionUsedDays} de {subscriptionTotalCycleDays || 30} dias utilizados
                                    </p>
                                    <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                        Um resumo rapido do ciclo atual.
                                    </p>
                                </div>

                                <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                                    {subscriptionRemainingDays} dias restantes
                                </span>
                            </div>

                            <div className="mt-6 space-y-3">
                                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                    <span>{subscriptionUsedDays} dias usados</span>
                                    <span>{subscriptionRemainingDays} dias restantes</span>
                                </div>
                                <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-800">
                                    <div
                                        className="h-3 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                                        style={{ width: `${subscriptionCycleProgress}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                                    <span>Início: {formatDateTimeBR(subscriptionStartDate)}</span>
                                    <span>Fim: {formatDateTimeBR(subscriptionEndDate)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
                <div className="space-y-4 xl:col-span-4">
                        <div className={`${PLATFORM_SURFACE_CARD_CLASS} px-4 py-4 md:px-5 md:py-4`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2.5">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Renovacao</p>
                                    <h3 className="text-base font-black leading-tight text-slate-900 dark:text-slate-100">Renovacao automatica</h3>
                                    <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                        {renewalCardDescription}
                                    </p>
                                    {resolvedAutoRenew && hasActiveSubscription && (
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                                Próxima renovação: {formatDateTimeBR(nextRenewalDate)} por {formatTransactionAmount(nextRenewalAmount)} no plano {nextRenewalCycleLabel.toLowerCase()}.
                                            </p>
                                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                Origem do valor: {nextRenewalPriceSourceLabel}.
                                            </p>
                                        </div>
                                    )}
                                    {hasActiveSubscription && !resolvedAutoRenew && (
                                        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                            Acesso até: {formatDateTimeBR(subscriptionEndDate)}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${renewalStateClassName}`}>
                                        {renewalStateLabel}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleRenewalToggle}
                                        disabled={!hasActiveSubscription || isUpdatingRenewal}
                                        role="switch"
                                        aria-checked={resolvedAutoRenew}
                                        aria-label={resolvedAutoRenew ? 'Desativar renovacao automatica' : 'Ativar renovacao automatica'}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-all ${resolvedAutoRenew ? 'border-emerald-500 bg-emerald-500/90' : 'border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-800'} ${(!hasActiveSubscription || isUpdatingRenewal) ? 'cursor-not-allowed opacity-60' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                                    >
                                        <span className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition-transform ${resolvedAutoRenew ? 'translate-x-6' : 'translate-x-1'}`}>
                                            {isUpdatingRenewal ? <Loader2 size={11} className="animate-spin text-slate-400" /> : null}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={`${PLATFORM_SURFACE_CARD_CLASS} px-4 py-4 md:px-5 md:py-4`}>
                            <div className="space-y-3">
                                <div className="space-y-2.5">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Cancelamento</p>
                                    <h3 className="text-base font-black leading-tight text-slate-900 dark:text-slate-100">
                                        {hasScheduledEnding
                                            ? 'Encerramento programado'
                                            : isWithinRefundWindow
                                                ? 'Janela de reembolso aberta'
                                                : hasActiveSubscription
                                                    ? 'Gerenciar cancelamento'
                                                    : isCanceledStatus
                                                        ? 'Assinatura cancelada'
                                                        : 'Sem assinatura ativa'}
                                    </h3>
                                    <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                        {isWithinRefundWindow
                                            ? 'Voce ainda esta dentro dos 7 dias da primeira assinatura para cancelar com reembolso.'
                                            : cancellationImpactMessage}
                                    </p>
                                </div>

                                {hasPendingRefundRequest ? (
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                                            Reembolso em analise
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleCancelRefundRequest}
                                            className="h-10 rounded-xl border border-slate-200 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            Cancelar solicitacao
                                        </button>
                                    </div>
                                ) : isCanceledButStillActive ? (
                                    <button
                                        type="button"
                                        onClick={handleRenewalToggle}
                                        disabled={isUpdatingRenewal}
                                        className="h-10 rounded-xl bg-emerald-600 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-white transition-all hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                        {isUpdatingRenewal ? 'Processando...' : 'Religar renovação'}
                                    </button>
                                ) : hasActiveSubscription ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowCancelModal(true)}
                                        className="h-10 rounded-xl bg-rose-600 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-white transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Cancelar assinatura
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => router.push('/plans')}
                                        className="h-10 rounded-xl border border-slate-200 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        Reativar assinatura
                                    </button>
                                )}
                            </div>
                        </div>
                </div>

                <div className={`${PLATFORM_SURFACE_CARD_CLASS} px-4 py-4 md:px-5 md:py-4 xl:col-span-8`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2.5">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Pagamento</p>
                            <h3 className="text-base font-black leading-tight text-slate-900 dark:text-slate-100">Cartoes e cobranca</h3>
                            <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                Os cartoes salvos ficam em Dados pessoais para compras futuras e renovacoes.
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                Provedor atual: {billingProviderLabel}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                Status de cobranca: {billingStatusLabel}
                            </p>
                        </div>

                        <div className="rounded-[1.1rem] bg-slate-50 px-4 py-2.5 text-right dark:bg-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Cartoes</p>
                            <p className="mt-1.5 text-xl font-black leading-none text-slate-900 dark:text-slate-100">{cardsLoadError ? '--' : userCards.length}</p>
                        </div>
                    </div>

                    {cardsLoadError ? (
                        <div className="mt-4 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Sincronizacao Stripe</p>
                            <p className="mt-1 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                                {cardsLoadError}
                            </p>
                        </div>
                    ) : primarySavedCard ? (
                        <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Cartao principal na Stripe</p>
                                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{formatSavedCardLabel(primarySavedCard)}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                        Expira em {String(primarySavedCard.exp_month || '').padStart(2, '0')}/{primarySavedCard.exp_year}
                                    </span>
                                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                                        Stripe
                                    </span>
                                    {primarySavedCardExpiryState.isExpired && (
                                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                                            Expirado
                                        </span>
                                    )}
                                    {!primarySavedCardExpiryState.isExpired && primarySavedCardExpiryState.isExpiringSoon && (
                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                                            Vence em breve
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={openSavedCardsManager}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-white transition-all hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                        >
                            <CreditCard size={14} />
                            Gerenciar pagamento
                        </button>
                    </div>
                </div>

                {!isElitePlan && (
                    <>
                        <div className={`${PLATFORM_SURFACE_CARD_CLASS} px-4 py-4 md:px-5 md:py-4 xl:col-span-6`}>
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Beneficios</p>
                                    <h3 className="text-base font-black leading-tight text-slate-900 dark:text-slate-100">Plano atual x Plano premium</h3>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Plano atual</p>
                                        <ul className="mt-3 space-y-2">
                                            {[
                                                { label: 'Acesso premium ativo', enabled: hasActiveSubscription },
                                                { label: 'Renovacao configuravel', enabled: hasActiveSubscription },
                                                { label: 'Cartao salvo no cofre Stripe', enabled: userCards.length > 0 },
                                                { label: 'Pacote completo Elite', enabled: isElitePlan },
                                            ].map((item) => (
                                                <li key={`current-${item.label}`} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                    {item.enabled
                                                        ? <CheckCircle2 size={14} className="text-emerald-500" />
                                                        : <XCircle size={14} className="text-slate-300 dark:text-slate-600" />}
                                                    <span>{item.label}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="rounded-[1.2rem] border border-indigo-200 bg-indigo-50 px-3 py-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">Plano premium</p>
                                        <ul className="mt-3 space-y-2">
                                            {[
                                                'Acesso premium ativo',
                                                'Renovacao configuravel',
                                                'Cartao salvo no cofre Stripe',
                                                'Pacote completo Elite',
                                            ].map((label) => (
                                                <li key={`premium-${label}`} className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-200">
                                                    <CheckCircle2 size={14} className="text-indigo-500" />
                                                    <span>{label}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[1.7rem] border border-indigo-200 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 px-4 py-4 text-white shadow-xl shadow-indigo-200 dark:border-indigo-500/20 dark:shadow-none md:px-5 md:py-5 xl:col-span-6">
                            <div className="space-y-3.5">
                                <div className="space-y-2.5">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-100">Upgrade</p>
                                    <h3 className="text-lg font-black leading-tight">Suba para o Plano Elite</h3>
                                    <p className="text-xs font-medium leading-5 text-indigo-100/90">
                                        Destrave o pacote premium completo para estudar com mais consistencia e direcao.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => router.push('/plans')}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-600 transition-all hover:bg-slate-100"
                                >
                                    Quero upgrade
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
        );
    };

    const renderSupportHistoryTab = () => {
        const supportStats = {
            total: supportHistoryThreads.length,
            open: supportHistoryThreads.filter((thread) => thread.status === 'new').length,
            inProgress: supportHistoryThreads.filter((thread) => thread.status === 'read').length,
            resolved: supportHistoryThreads.filter((thread) => thread.status === 'resolved').length,
        };

        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Suporte</p>
                        <h2 className="text-2xl font-black leading-none text-slate-900 dark:text-slate-100">Histórico de conversas</h2>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Acompanhe chamados, sugestões, respostas do suporte e continue conversas abertas.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                            type="button"
                            onClick={() => void fetchSupportHistory(true)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <RotateCcw size={14} />
                            Atualizar
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/support?category=info')}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-indigo-700"
                        >
                            <MessageSquare size={14} />
                            Novo chamado
                        </button>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    {[
                        { label: 'Abertos', value: supportStats.open, className: 'text-amber-600 dark:text-amber-300' },
                        { label: 'Em análise', value: supportStats.inProgress, className: 'text-sky-600 dark:text-sky-300' },
                        { label: 'Resolvidos', value: supportStats.resolved, className: 'text-emerald-600 dark:text-emerald-300' },
                    ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{item.label}</p>
                            <p className={`mt-2 text-2xl font-black ${item.className}`}>{item.value}</p>
                        </div>
                    ))}
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Conversas recentes</p>
                            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{supportStats.total} item(ns)</h3>
                        </div>
                    </div>

                    {isLoadingSupportHistory ? (
                        <div className="flex items-center justify-center px-6 py-20">
                            <Loader2 size={28} className="animate-spin text-indigo-500" />
                        </div>
                    ) : supportHistoryThreads.length === 0 ? (
                        <div className="px-6 py-14 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                <MessageSquare size={24} />
                            </div>
                            <p className="mt-4 text-base font-black text-slate-900 dark:text-slate-100">Nenhuma conversa aberta ainda.</p>
                            <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                                Quando você enviar um chamado ou sugestão, o acompanhamento aparecerá aqui.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {supportHistoryThreads.map((thread) => {
                                const statusMeta = PROFILE_SUPPORT_STATUS_META[thread.status] || PROFILE_SUPPORT_STATUS_META.new;
                                const isExpanded = expandedSupportThreadId === thread.id;
                                const threadReplies = supportReplies[thread.id] || [];
                                const typeLabel = PROFILE_SUPPORT_TYPE_LABELS[String(thread.type || '').toLowerCase()] || 'Suporte';
                                const createdAt = thread.created_at ? new Date(thread.created_at).toLocaleString() : 'Sem data';

                                return (
                                    <article key={thread.id} className="bg-white dark:bg-slate-900">
                                        <button
                                            type="button"
                                            onClick={() => void toggleSupportHistoryThread(thread.id)}
                                            className="w-full px-5 py-5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70"
                                        >
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusMeta.className}`}>
                                                            {statusMeta.label}
                                                        </span>
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                            {typeLabel}
                                                        </span>
                                                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{createdAt}</span>
                                                    </div>
                                                    <p className="mt-3 text-base font-black text-slate-900 dark:text-slate-100">{thread.reason || 'Sem resumo'}</p>
                                                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{thread.details}</p>
                                                </div>
                                                <div className="shrink-0 text-left lg:text-right">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Respostas</p>
                                                    <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{thread.reply_count || 0}</p>
                                                    <p className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-300">{isExpanded ? 'Ocultar conversa' : 'Abrir conversa'}</p>
                                                </div>
                                            </div>
                                        </button>

                                        {isExpanded ? (
                                            <div className="border-t border-slate-100 bg-slate-50 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/70">
                                                <div className="space-y-3">
                                                    {loadingSupportReplies === thread.id ? (
                                                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                                                            Carregando respostas...
                                                        </div>
                                                    ) : threadReplies.length > 0 ? threadReplies.map((reply) => {
                                                        const isUserReply = String(reply.user_id) === String(currentUser?.id);

                                                        return (
                                                            <div
                                                                key={reply.id}
                                                                className={`rounded-2xl border px-4 py-4 ${isUserReply ? 'ml-6 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900' : 'mr-6 border-indigo-200 bg-indigo-50/80 dark:border-indigo-500/20 dark:bg-indigo-500/10'}`}
                                                            >
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{isUserReply ? 'Você' : 'Suporte'}</p>
                                                                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{new Date(reply.created_at).toLocaleString()}</p>
                                                                </div>
                                                                <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{reply.details}</p>
                                                            </div>
                                                        );
                                                    }) : (
                                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                                            Nenhuma resposta ainda.
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-4 rounded-[1.6rem] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Responder conversa</p>
                                                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                                                        <input
                                                            type="text"
                                                            value={supportReplyDrafts[thread.id] || ''}
                                                            onChange={(event) => setSupportReplyDrafts((currentDrafts) => ({ ...currentDrafts, [thread.id]: event.target.value }))}
                                                            placeholder="Escreva sua resposta..."
                                                            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleSupportHistoryReplySubmit(thread)}
                                                            disabled={sendingSupportReplyId === thread.id || !(supportReplyDrafts[thread.id] || '').trim()}
                                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                                                        >
                                                            <Send size={15} />
                                                            {sendingSupportReplyId === thread.id ? 'Enviando...' : 'Responder'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        );
    };

    const renderBillingHistoryTab = () => (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Histórico</p>
                    <h2 className="text-2xl font-black leading-none text-slate-900 dark:text-slate-100">Transações</h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Acompanhe cobrancas aprovadas, parcelas futuras pre-aprovadas e faturas emitidas pelo gateway.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={fetchUserTransactions}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    <RotateCcw size={14} />
                    Atualizar
                </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {isLoadingTransactions ? (
                    <div className="flex items-center justify-center px-6 py-20">
                        <Loader2 size={28} className="animate-spin text-indigo-500" />
                    </div>
                ) : userTransactions.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">ID do gateway</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Plano</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Ciclo</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Gateway</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Método</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Data / hora</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Status</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 text-right">Valor</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 text-center">Fatura</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {userTransactions.map((tx) => {
                                    const statusMeta = getTransactionStatusMeta(tx.status);
                                    const referenceId = tx.providerTransactionId || tx.referenceId || tx.id;
                                    const referenceLabel = tx.providerTransactionLabel || 'ID Stripe';
                                    const invoiceUrl = tx.invoicePdfUrl || tx.hostedInvoiceUrl || null;
                                    const installmentCount = Number(tx.installmentCount || 0);
                                    const installmentLabel = installmentCount > 1 ? `Parcela ${tx.installmentNumber || 1}/${tx.installmentCount}` : null;
                                    const cycleLabel = resolveTransactionCycleLabel(tx);
                                    const gatewayLabel = resolveTransactionGatewayLabel(tx);
                                    const methodLabel = resolveTransactionMethodLabel(tx);
                                    const resolvedPlanName = stripPlanCycleSuffix(
                                        tx.planName || tx.transactionName || tx.description || 'Assinatura',
                                    ) || 'Assinatura';

                                    return (
                                        <tr key={tx.id} className="align-top transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="px-5 py-4">
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{referenceLabel}</p>
                                                    <div className="flex items-center gap-2">
                                                        <code className="max-w-[180px] truncate text-xs font-black text-slate-900 dark:text-slate-100">{referenceId || '-'}</code>
                                                        {referenceId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(String(referenceId));
                                                                    addToast('ID copiado.', 'success');
                                                                }}
                                                                className="rounded-lg border border-slate-200 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                                            >
                                                                Copiar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-black leading-[1.2] text-slate-900 dark:text-slate-100">
                                                    {resolvedPlanName}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{cycleLabel}</p>
                                                    {installmentLabel && (
                                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{installmentLabel}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{gatewayLabel}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{methodLabel}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                        {tx.dateTimeFormatted || formatDateTimeBR(tx.createdAt || tx.dueDate || tx.timestamp)}
                                                    </p>
                                                    {tx.scheduleLabel && (
                                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                            {tx.scheduleLabel}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="space-y-2">
                                                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusMeta.className}`}>
                                                        {statusMeta.label}
                                                    </span>
                                                    {tx.providerRefundId && (
                                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                            Refund: {tx.providerRefundId}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                                    {formatTransactionAmount(tx.amount)}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {invoiceUrl ? (
                                                    <a
                                                        href={invoiceUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                                    >
                                                        <Download size={14} />
                                                        PDF
                                                    </a>
                                                ) : (
                                                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="px-6 py-20 text-center">
                        <BarChart3 size={32} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhuma transação registrada ainda.</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderProfilePhotoCropModal = () => {
        if (!profilePhotoCropDraft) return null;

        return createPortal(
            <AnimatePresence>
                <div className="fixed inset-0 z-[999] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                            if (!isSavingProfilePhoto) closeProfilePhotoCrop();
                        }}
                        className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
                    >
                        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5">
                            <div>
                                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                                    <Camera size={12} />
                                    Foto de perfil
                                </span>
                                <h3 className="mt-2 text-base font-black text-slate-900 dark:text-slate-100 sm:text-lg">Ajustar recorte circular</h3>
                                <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                    Posicione o rosto dentro do círculo antes de salvar.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeProfilePhotoCrop}
                                disabled={isSavingProfilePhoto}
                                className="rounded-2xl border border-slate-200 bg-white/90 p-2 text-slate-400 transition-all hover:border-slate-300 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:text-slate-200"
                                aria-label="Fechar recorte da foto"
                            >
                                <X size={18} />
                            </button>
                        </header>

                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
                            <div className="mx-auto flex h-56 w-56 max-w-full items-center justify-center rounded-2xl bg-slate-100 p-4 dark:bg-slate-950 sm:h-64 sm:w-64">
                                <div className="relative h-44 w-44 overflow-hidden rounded-full border-4 border-white bg-slate-200 shadow-2xl ring-2 ring-indigo-500/40 dark:border-slate-900 dark:bg-slate-800 sm:h-52 sm:w-52">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={profilePhotoCropDraft.previewUrl}
                                        alt="Prévia do recorte circular"
                                        className="absolute inset-0 h-full w-full object-cover"
                                        style={{
                                            transform: `translate(${profilePhotoCropDraft.offsetX / 3}%, ${profilePhotoCropDraft.offsetY / 3}%) scale(${profilePhotoCropDraft.zoom})`,
                                            transformOrigin: 'center',
                                        }}
                                    />
                                    <div className="pointer-events-none absolute inset-0 rounded-full ring-4 ring-white/70 dark:ring-slate-950/70" />
                                </div>
                            </div>

                            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <label className="block space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Zoom</span>
                                    <input
                                        type="range"
                                        min="1"
                                        max="2.4"
                                        step="0.01"
                                        value={profilePhotoCropDraft.zoom}
                                        onChange={(event) => updateProfilePhotoCrop({ zoom: Number(event.target.value) })}
                                        className="w-full accent-indigo-600"
                                    />
                                </label>
                                <label className="block space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Horizontal</span>
                                    <input
                                        type="range"
                                        min="-100"
                                        max="100"
                                        step="1"
                                        value={profilePhotoCropDraft.offsetX}
                                        onChange={(event) => updateProfilePhotoCrop({ offsetX: Number(event.target.value) })}
                                        className="w-full accent-indigo-600"
                                    />
                                </label>
                                <label className="block space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vertical</span>
                                    <input
                                        type="range"
                                        min="-100"
                                        max="100"
                                        step="1"
                                        value={profilePhotoCropDraft.offsetY}
                                        onChange={(event) => updateProfilePhotoCrop({ offsetY: Number(event.target.value) })}
                                        className="w-full accent-indigo-600"
                                    />
                                </label>
                            </div>

                        </div>

                        <footer className="grid shrink-0 grid-cols-1 gap-3 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={closeProfilePhotoCrop}
                                disabled={isSavingProfilePhoto}
                                className="h-11 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveProfilePhotoCrop}
                                disabled={isSavingProfilePhoto}
                                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSavingProfilePhoto ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                                Salvar foto
                            </button>
                        </footer>
                    </motion.div>
                </div>
            </AnimatePresence>,
            document.body
        );
    };

    const renderCancelSubscriptionModal = () => {
        if (!showCancelModal || !activeSubscription) return null;

        return createPortal(
            <AnimatePresence>
                <div className="fixed inset-0 z-[999] flex items-start justify-center overflow-y-auto p-3 sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeCancelModal}
                        className="fixed inset-0 bg-slate-900/90 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative z-10 my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-rose-100 bg-white shadow-2xl dark:border-rose-900/20 dark:bg-slate-900 sm:max-h-[calc(100dvh-2rem)]"
                    >
                        <button
                            type="button"
                            onClick={closeCancelModal}
                            disabled={isCancelingSubscription}
                            className="absolute right-5 top-5 rounded-2xl border border-slate-200 bg-white/90 p-2 text-slate-400 transition-all hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:text-slate-200"
                        >
                            <X size={18} />
                        </button>

                        <div className="p-8 text-center">
                            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-rose-100 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10">
                                <ShieldAlert size={38} className="text-rose-600 dark:text-rose-500" />
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-2xl font-black italic text-slate-900 dark:text-slate-100">
                                    Já vai nos deixar, {currentUser?.name?.split(' ')[0] || 'aluno'}?
                                </h3>
                                <p className="mx-auto max-w-md text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                                    {isWithinRefundWindow
                                        ? 'Você ainda esta no período de garantia. Se cancelar agora, o reembolso pode ser solicitado e seu acesso sera encerrado com segurança.'
                                        : (requiresOutstandingDebtConfirmation
                                            ? 'Este plano possui parcelas pre-aprovadas do termo contratado. Para cancelar agora, o saldo pendente precisa ser quitado e seu acesso seguirá até o fim do contrato.'
                                            : 'Sua aprovação esta cada dia mais proxima. Cancelando agora, a renovação automática sera desligada e o acesso seguira somente ate o fim do ciclo vigente.')}
                                </p>
                            </div>

                            {isWithinRefundWindow && (
                                <div className="mt-6 flex items-start gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-left dark:border-indigo-500/10 dark:bg-indigo-500/5">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
                                        <ShieldCheck size={18} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Garantia legal de 7 dias</h4>
                                        <p className="text-[11px] font-medium leading-tight text-indigo-900/70 dark:text-indigo-300/70">
                                            Sua satisfacao e prioridade. Cancelando dentro desse prazo, o sistema trata a solicitacao de reembolso com os dados da Stripe.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {requiresOutstandingDebtConfirmation && (
                                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-500/20 dark:bg-amber-500/10">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                                            <CreditCard size={17} />
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                                                Saldo do termo contratado
                                            </h4>
                                            <p className="text-xs font-semibold leading-relaxed text-amber-900/80 dark:text-amber-100/80">
                                                Existem {pendingInstallmentsCount} parcela(s) pre-aprovada(s) pendente(s), totalizando {outstandingTermDebtLabel}. Ao confirmar, esse saldo será debitado agora, a cobrança recorrente será encerrada e o acesso continuará até {formatDateTimeBR(subscriptionEndDate)}.
                                            </p>
                                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white/70 p-3 text-[11px] font-bold leading-relaxed text-amber-900 transition hover:border-amber-300 dark:border-amber-500/20 dark:bg-slate-900/40 dark:text-amber-100">
                                                <input
                                                    type="checkbox"
                                                    checked={confirmOutstandingDebtCharge}
                                                    onChange={(event) => setConfirmOutstandingDebtCharge(event.target.checked)}
                                                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                                />
                                                <span>
                                                    Confirmo a quitação do saldo pendente de {outstandingTermDebtLabel} e o desligamento da renovação automática.
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-6 text-left dark:border-slate-800 dark:bg-slate-800/50">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        Motivo principal (opcional)
                                    </label>
                                    <select
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:ring-2 focus:ring-rose-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    >
                                        <option value="">Selecione uma opcao...</option>
                                        <option value="price">Valor da assinatura</option>
                                        <option value="usage">Não estou usando o suficiente</option>
                                        <option value="technical">Problemas técnicos</option>
                                        <option value="content">Falta de conteúdos especificos</option>
                                        <option value="other">Outros motivos</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        Detalhes adicionais (opcional)
                                    </label>
                                    <textarea
                                        value={cancelDetails}
                                        onChange={(event) => setCancelDetails(event.target.value)}
                                        rows={4}
                                        placeholder="Se quiser, conte rapidamente o que motivou o cancelamento."
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    />
                                </div>

                                {recaptchaEnabled ? (
                                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                            Confirmacao de segurança
                                        </p>
                                        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-950/60">
                                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                                profileRecaptchaLoadError
                                                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
                                                    : isProfileSecurityCheckLoading
                                                        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300'
                                                        : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                                            }`}>
                                                {profileRecaptchaLoadError ? <AlertTriangle size={17} /> : isProfileSecurityCheckLoading ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
                                            </span>
                                            <p className="text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-300">
                                                {profileRecaptchaLoadError
                                                    ? profileRecaptchaLoadError
                                                    : isProfileSecurityCheckLoading
                                                        ? 'Estamos preparando a verificação invisível. O botão será liberado em instantes.'
                                                        : 'Verificação invisível pronta. Ao confirmar, validaremos a segurança automaticamente.'}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                                        A confirmacao por reCAPTCHA esta desativada nas configurações da plataforma.
                                    </p>
                                )}
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={closeCancelModal}
                                    disabled={isCancelingSubscription}
                                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Zap size={18} className="fill-current" />
                                    Manter acesso VIP
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelSubscription}
                                    disabled={isCancelingSubscription || isProfileSecurityCheckLoading || (requiresOutstandingDebtConfirmation && !confirmOutstandingDebtCharge)}
                                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:border-rose-500/30 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800"
                                >
                                    {isCancelingSubscription || isProfileSecurityCheckLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                                    {isProfileSecurityCheckLoading ? 'Carregando segurança...' : isCancelingSubscription ? 'Processando...' : 'Confirmar cancelamento'}
                                </button>
                            </div>

                            <p className="mt-4 text-[9px] font-black uppercase tracking-tight text-slate-400">
                                Você manterá seu acesso até {formatDateTimeBR(subscriptionEndDate)}
                            </p>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>,
            document.body
        );
    };

    const renderTestimonialModal = () => {
        if (!showTestimonialModal) return null;

        return createPortal(
            <AnimatePresence>
                <div className="fixed inset-0 z-[999] overflow-hidden p-2 sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                            if (!isSubmittingTestimonial) setShowTestimonialModal(false);
                        }}
                        className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"
                    />

                    <div className="relative z-10 flex h-full min-h-0 items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 16 }}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="platform-rating-modal-title"
                            className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
                        >
                        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-6">
                            <div className="space-y-1">
                                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                                    <MessageSquare size={12} />
                                    Avaliar plataforma
                                </span>
                                <h3 id="platform-rating-modal-title" className="text-lg font-black text-slate-900 dark:text-slate-100">
                                    Avaliar plataforma
                                </h3>
                                <p className="max-w-xl text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                    Conte como tem sido sua experiência. Seu envio passa por avaliação antes de aparecer publicamente.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowTestimonialModal(false)}
                                disabled={isSubmittingTestimonial}
                                className="rounded-2xl border border-slate-200 bg-white/90 p-2 text-slate-400 transition-all hover:border-slate-300 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:text-slate-200"
                                aria-label="Fechar avaliação"
                            >
                                <X size={18} />
                            </button>
                        </header>

                        <form onSubmit={handleSubmitTestimonial} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-500 transition-colors dark:text-slate-400">
                                    Avaliação
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                    {[1, 2, 3, 4, 5].map((rating) => {
                                        const isActive = rating <= testimonialRating;

                                        return (
                                            <button
                                                key={rating}
                                                type="button"
                                                onClick={() => setTestimonialRating(rating)}
                                                disabled={isSubmittingTestimonial}
                                                aria-label={`Avaliar com ${rating} estrela${rating > 1 ? 's' : ''}`}
                                                className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                                                    isActive
                                                        ? 'border-amber-200 bg-amber-50 text-amber-500 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                                                        : 'border-slate-200 bg-slate-50 text-slate-300 hover:border-amber-200 hover:text-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600 dark:hover:border-amber-500/30 dark:hover:text-amber-300'
                                                }`}
                                            >
                                                <Star size={18} className={isActive ? 'fill-current' : ''} />
                                            </button>
                                        );
                                    })}
                                    <span className="ml-1 text-xs font-black text-slate-500 dark:text-slate-400">
                                        {testimonialRating}/5
                                    </span>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 transition-colors dark:text-slate-400">
                                        Nome público
                                    </label>
                                    <input
                                        type="text"
                                        value={testimonialDisplayName}
                                        onChange={(event) => setTestimonialDisplayName(event.target.value)}
                                        disabled={isSubmittingTestimonial}
                                        maxLength={120}
                                        placeholder="Ex: Ana S."
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 transition-colors dark:text-slate-400">
                                        Contexto
                                    </label>
                                    <input
                                        type="text"
                                        value={testimonialHeadline}
                                        onChange={(event) => setTestimonialHeadline(event.target.value)}
                                        disabled={isSubmittingTestimonial}
                                        maxLength={180}
                                        placeholder="Ex: Aprovada Polícia Federal"
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <p className="-mt-2 text-[11px] font-medium leading-5 text-slate-500 dark:text-slate-400">
                                Esses dados aparecem na home somente se o depoimento for aprovado pela equipe.
                            </p>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-500 transition-colors dark:text-slate-400">
                                    Comentário
                                </label>
                                <textarea
                                    value={testimonialText}
                                    onChange={(event) => setTestimonialText(event.target.value)}
                                    disabled={isSubmittingTestimonial}
                                    rows={6}
                                    maxLength={700}
                                    placeholder="Ex: A plataforma me ajudou a manter constância nos estudos..."
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500"
                                />
                                <div className="flex items-center justify-between gap-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                    <span>{testimonialText.trim().length < 20 ? 'Mínimo de 20 caracteres.' : 'Pronto para enviar.'}</span>
                                    <span>{testimonialText.length}/700</span>
                                </div>
                            </div>

                            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="flex items-center justify-between gap-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        Suas avaliações
                                    </h4>
                                    {isLoadingPlatformRatings ? (
                                        <Loader2 size={14} className="animate-spin text-slate-400" />
                                    ) : (
                                        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                            {userPlatformRatings.length}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1 sm:max-h-52">
                                    {userPlatformRatings.length > 0 ? userPlatformRatings.map((rating) => (
                                        <article key={rating.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-1 text-amber-500 dark:text-amber-300">
                                                    {Array.from({ length: 5 }).map((_, index) => (
                                                        <Star
                                                            key={`${rating.id}-star-${index}`}
                                                            size={13}
                                                            className={index < Number(rating.public_rating || 0) ? 'fill-current' : 'text-slate-300 dark:text-slate-700'}
                                                        />
                                                    ))}
                                                </div>
                                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                    {rating.status === 'resolved' ? 'Aprovada/respondida' : rating.status === 'read' ? 'Em análise' : 'Recebida'}
                                                </span>
                                            </div>
                                            <p className="mt-2 line-clamp-3 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                                                {rating.details}
                                            </p>
                                            {rating.created_at ? (
                                                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                                                    {new Date(rating.created_at).toLocaleString('pt-BR')}
                                                </p>
                                            ) : null}
                                        </article>
                                    )) : (
                                        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-xs font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                                            Nenhuma avaliação enviada por você ainda.
                                        </p>
                                    )}
                                </div>
                            </section>

                            <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowTestimonialModal(false)}
                                    disabled={isSubmittingTestimonial}
                                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingTestimonial || testimonialText.trim().length < 20 || testimonialDisplayName.trim().length < 2 || testimonialHeadline.trim().length < 3}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-indigo-500/10 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                                >
                                    {isSubmittingTestimonial ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    {isSubmittingTestimonial ? 'Enviando...' : 'Enviar avaliação'}
                                </button>
                            </footer>
                        </form>
                        </motion.div>
                    </div>
                </div>
            </AnimatePresence>,
            document.body
        );
    };

    // Atualizar dados quando a aba mudar
    React.useEffect(() => {
        if (!currentUser?.id) {
            const frameId = window.requestAnimationFrame(() => {
                setUserCards([]);
                setUserTransactions([]);
                setUserMaterials([]);
                setMaterialNotes([]);
                setFavoriteLaws([]);
                setSupportHistoryThreads([]);
                setSupportReplies({});
                setExpandedSupportThreadId(null);
            });

            return () => window.cancelAnimationFrame(frameId);
        }

        const frameId = window.requestAnimationFrame(() => {
            if (activeTab === 'billing' || activeTab === 'personal') {
                void fetchUserCards();
            }
            if (activeTab === 'billing' || activeTab === 'billing-history') {
                void syncStripeSubscriptionState({
                    force: activeTab === 'billing' && !hasSyncedBillingSnapshot,
                    showLoader: activeTab === 'billing',
                });
                void fetchUserTransactions();
            }
            if (activeTab === 'materials' && marketplaceEnabled) {
                void fetchUserMaterials();
            }
            if (activeTab === 'notebook' && marketplaceEnabled) {
                void fetchUserMaterials();
            }
            if (activeTab === 'favorite-laws') {
                void fetchFavoriteLaws();
            }
            if (activeTab === 'referral' && canAccessReferralTab) {
                void fetchReferralStats();
            }
            if (activeTab === 'support-history') {
                void fetchSupportHistory(false);
            }
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [
        activeTab,
        canAccessReferralTab,
        currentUser?.id,
        fetchReferralStats,
        fetchFavoriteLaws,
        fetchSupportHistory,
        fetchUserCards,
        fetchUserMaterials,
        fetchUserTransactions,
        hasSyncedBillingSnapshot,
        syncStripeSubscriptionState,
        isStripeBilling,
        marketplaceEnabled,
    ]);

    React.useEffect(() => {
        if (activeTab !== 'testimonial') {
            return;
        }

        const frameId = window.requestAnimationFrame(() => {
            prepareTestimonialModal();
            setShowTestimonialModal(true);
            changeActiveTab('personal', { replace: true });
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [activeTab, changeActiveTab, prepareTestimonialModal]);

    React.useEffect(() => {
        if (activeTab !== 'notebook') return;

        if (!marketplaceEnabled || !currentUser?.id || userMaterials.length === 0) {
            const frameId = window.requestAnimationFrame(() => {
                setMaterialNotes([]);
            });

            return () => window.cancelAnimationFrame(frameId);
        }

        const frameId = window.requestAnimationFrame(() => {
            void fetchMaterialNotesForMaterials(userMaterials);
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [
        activeTab,
        currentUser?.id,
        fetchMaterialNotesForMaterials,
        marketplaceEnabled,
        userMaterials,
    ]);

   const EXAM_AREAS = useMemo(() => {
      const taxonomyCareers = Array.isArray(systemSettings?.taxonomies?.careers)
         ? systemSettings.taxonomies.careers
         : [];

      const normalizedCareers = Array.from(new Set(
         taxonomyCareers
            .map((item) => normalizeCareerSelectorLabel(item?.name || ''))
            .filter(Boolean),
      ));

      const careerAreas = normalizedCareers.length > 0
         ? normalizedCareers
         : PROFILE_FALLBACK_FOCUS_AREAS;

      return [
         { group: 'Carreiras', areas: careerAreas },
         { group: 'Exames', areas: PROFILE_EXAM_AREAS },
      ];
   }, [systemSettings]);

   const timelineData = useMemo(() => {
      const data: Record<string, { date: string, taxa: number, total: number }> = {};
      const now = new Date();
      let steps = 30;
      let format: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };

      if (evolutionRange === 'today') {
         steps = now.getHours() + 1;
         format = { hour: '2-digit', minute: '2-digit' };
      } else if (evolutionRange === 'year') {
         steps = 12;
         format = { month: 'short' };
      } else if (evolutionRange === 'week') {
         steps = 7;
      }

      for (let i = steps - 1; i >= 0; i--) {
         const d = new Date(now);
         if (evolutionRange === 'today') d.setHours(d.getHours() - i, 0, 0, 0);
         else if (evolutionRange === 'year') { d.setMonth(d.getMonth() - i, 1); d.setHours(0, 0, 0, 0); }
         else { d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0); }

         const label = evolutionRange === 'today'
            ? `${d.getHours().toString().padStart(2, '0')}:00`
            : d.toLocaleDateString('pt-BR', format);

         data[label] = { date: label, taxa: 0, total: 0 };
      }

      userAnswers.forEach(ans => {
         const d = new Date(ans.timestamp);
         const label = evolutionRange === 'today' ? `${d.getHours().toString().padStart(2, '0')}:00` : d.toLocaleDateString('pt-BR', format);
         if (data[label]) {
            const periodEntries = userAnswers.filter(a => {
               const ad = new Date(a.timestamp);
               const al = evolutionRange === 'today' ? `${ad.getHours().toString().padStart(2, '0')}:00` : ad.toLocaleDateString('pt-BR', format);
               return al === label;
            });
            const correct = periodEntries.filter(a => a.isCorrect).length;
            data[label].taxa = Math.round((correct / periodEntries.length) * 100);
            data[label].total = periodEntries.length;
         }
      });
      return Object.values(data);
   }, [userAnswers, evolutionRange]);


   const generalStats = useMemo(() => {
      const total = userAnswers.length;
      const correct = userAnswers.filter(a => a.isCorrect).length;
      const wrong = total - correct;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

      const diffStats = {
         'Fácil': { total: 0, correct: 0 },
         'Médio': { total: 0, correct: 0 },
         'Difícil': { total: 0, correct: 0 }
      };

      userAnswers.forEach(ans => {
         const q = questions.find(item => item.id === ans.questionId);
         if (q) {
            const label = q.difficulty === 'Fácil' ? 'Fácil' : q.difficulty === 'Médio' ? 'Médio' : 'Difícil';
            if (diffStats[label as keyof typeof diffStats]) {
               diffStats[label as keyof typeof diffStats].total++;
               if (ans.isCorrect) diffStats[label as keyof typeof diffStats].correct++;
            }
         }
      });

      // Topics progress
      const uniqueTopics = new Set(userAnswers.map(ans => questions.find(q => q.id === ans.questionId)?.topic).filter(Boolean));
      const allPossibleTopics = new Set(questions.map(q => q.topic).filter(Boolean));
      const topicsProgress = allPossibleTopics.size > 0 ? Math.round((uniqueTopics.size / allPossibleTopics.size) * 100) : 0;

      return { total, correct, wrong, accuracy, xp: total * 10, diffStats, topicsProgress };
   }, [userAnswers, questions]);

   if (!currentUser) {
      return (
         <div className="max-w-xl mx-auto pt-20 pb-20 px-6 text-center animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 shadow-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
               <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
               <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 dark:text-slate-600">
                  <User size={40} />
               </div>
               <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-3">Identifique-se</h2>
               <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                  Faça login para acompanhar seu desempenho, gerenciar sua assinatura e salvar seu progresso.
               </p>
               <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
               >
                  Entrar ou Criar Conta
               </button>
            </div>
            <AuthModal
               isOpen={showAuthModal}
               onClose={() => setShowAuthModal(false)}
               title="Acesse seu Perfil"
               description="Gerencie seus dados e acompanhe sua evolução detalhada."
            />
         </div>
      );
   }

    const renderSidebarItem = ({ id, label, icon: Icon, onSelect }: ProfileSidebarItem) => (
        <button
            onClick={() => {
                if (onSelect) {
                    onSelect();
                    return;
                }
                changeActiveTab(id, { replace: true });
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'}`}
        >
            <div className="flex items-center gap-3"><Icon size={16} /> {label}</div>
            {activeTab === id && <ChevronRight size={14} className="text-indigo-400 dark:text-indigo-500" />}
        </button>
    );

    return (
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-6 pb-20 space-y-5 md:space-y-6">
            <header>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
                    <User className="text-indigo-600 dark:text-indigo-400" /> Meu Perfil
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1 transition-colors">Gerencie seus dados, assinatura e acompanhe sua evolução.</p>
            </header>

            {/* Banner: Conteúdo Incompleto */}
            {currentUser && (!currentUser.cpf || !currentUser.address?.zipCode) && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 sm:px-6 py-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg border border-indigo-400/30">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <User size={24} className="text-white" />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">Complete seu cadastro para facilitar suas compras</h4>
                            <p className="text-xs text-indigo-100 mt-0.5">Adicione seu CPF e endereço para agilizar o checkout de materiais e planos.</p>
                        </div>
                    </div>
                    <button onClick={scrollToPersonalDetailsForm} className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2 shrink-0 active:scale-95">
                        Completar Agora <ArrowRight size={14} />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
                {/* SIDEBAR DE NAVEGAÇÃO */}
                <aside className="lg:col-span-3 space-y-4 lg:space-y-6">
                    {/* Cartão do Usuário */}
                    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center space-y-3 transition-colors">
                        <div 
                            className="relative group cursor-pointer"
                            onClick={openProfilePhotoPicker}
                        >
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 transition-colors overflow-hidden relative">
                                {profilePhotoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={profilePhotoUrl}
                                        alt={currentUser.name || 'Foto de perfil'}
                                        className="absolute inset-0 h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="text-2xl font-black">{currentUser.name?.charAt(0) || 'U'}</span>
                                )}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isSavingProfilePhoto ? <Loader2 size={20} className="animate-spin text-white" /> : <Camera size={20} className="text-white" />}
                                </div>
                            </div>
                            {profilePhotoUrl ? (
                                <button
                                    type="button"
                                    onClick={async (event) => {
                                        event.stopPropagation();
                                        await handleRemoveProfilePhoto();
                                    }}
                                    disabled={isRemovingProfilePhoto}
                                    className="absolute -top-1 -left-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-900/20"
                                    title="Remover foto"
                                    aria-label="Remover foto de perfil"
                                >
                                    {isRemovingProfilePhoto ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </button>
                            ) : null}
                            <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm">
                                LVL {currentUser.level}
                            </div>
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm transition-colors">{currentUser.name}</h2>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate max-w-[180px] transition-colors">{currentUser.email}</p>
                        </div>
                        <div className="w-full pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-center transition-colors">
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border transition-colors ${isElitePlan ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/30' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700'}`}>
                                Plano {effectivePlanDisplayName}
                            </span>
                        </div>
                    </div>

                    {/* Menu */}
                    <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1 transition-colors">
                        <div className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Menu</div>
                        {renderSidebarItem({ id: 'notebook', label: 'Minhas Anotações', icon: StickyNote })}
                        {renderSidebarItem({ id: 'saved-questions', label: 'Questões salvas', icon: BookmarkCheck })}
                        {renderSidebarItem({ id: 'favorite-laws', label: 'Leis Favoritas', icon: BookOpen })}
                        {marketplaceEnabled && renderSidebarItem({ id: 'materials', label: 'Meus Materiais', icon: Package })}
                        
                        <div className="h-px bg-slate-50 dark:bg-slate-800 my-2 transition-colors" />
                        
                        <div className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Conta</div>
                        {renderSidebarItem({ id: 'personal', label: 'Dados Pessoais', icon: User })}
                        {renderSidebarItem({ id: 'testimonial', label: 'Avaliar plataforma', icon: Star, onSelect: openTestimonialModal })}
                        {renderSidebarItem({ id: 'support-history', label: 'Histórico de suporte', icon: MessageSquare })}
                        {renderSidebarItem({ id: 'billing', label: 'Assinatura', icon: CreditCard })}
                        {renderSidebarItem({ id: 'billing-history', label: 'Transações', icon: BarChart3 })}
                        {canAccessReferralTab && renderSidebarItem({ id: 'referral', label: 'Indique e Ganhe', icon: Gift })}
                        {renderSidebarItem({ id: 'security', label: 'Privacidade', icon: ShieldCheck })}
                    </div>

                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 font-bold text-xs rounded-xl transition-all border border-red-100 dark:border-red-900/30">
                        <LogOut size={14} /> Sair da Conta
                    </button>
                </aside>

            {/* ÁREA DE CONTEÚDO */}
            <main className="lg:col-span-9 space-y-6">

               {activeTab === 'evolution' && (
                  <div className="space-y-6">
                     {/* NOVO CABEÇALHO DE ESTUDOS */}
                     <div className="bg-white dark:bg-slate-900 px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
                        <div className="flex-1 space-y-3">
                           <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Estudando questões para</span>
                           </div>
                           <div className="flex flex-col md:flex-row md:items-center gap-4">
                              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 leading-tight transition-colors">
                                 {currentUser.targetExam || 'Não selecionado'}
                              </h2>
                              <div className="flex items-center gap-2">
                                 <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg transition-colors">Pré edital</span>
                                 <button
                                    onClick={() => setShowGoalModal(true)}
                                    className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                 >
                                    <TrendingUp size={12} /> Trocar guia
                                 </button>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-4 pl-6 border-l border-slate-100 dark:border-slate-800 transition-colors">
                           <div className="relative w-14 h-14">
                              <svg className="w-full h-full -rotate-90">
                                 <circle cx="28" cy="28" r="24" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-slate-800" />
                                 <circle cx="28" cy="28" r="24" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - generalStats.topicsProgress / 100)} className="text-orange-500" strokeLinecap="round" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-slate-900 dark:text-slate-100">{generalStats.topicsProgress}%</div>
                           </div>
                           <div className="text-right">
                              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1 justify-end">Assuntos Concluídos <Info size={10} /></p>
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-colors">Todos os assuntos</p>
                           </div>
                        </div>
                     </div>

                     {/* Stats Grid */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                           <div className="flex justify-between items-start mb-2">
                              <span className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg"><Target size={18} /></span>
                              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Geral</span>
                           </div>
                           <p className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{generalStats.accuracy}%</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Taxa de Acertos</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                           <div className="flex justify-between items-start mb-2">
                              <span className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg"><Book size={18} /></span>
                              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Total</span>
                           </div>
                           <p className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{generalStats.total}</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Questões Respondidas</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                           <div className="flex justify-between items-start mb-2">
                              <span className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg"><Zap size={18} /></span>
                              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Rank</span>
                           </div>
                           <p className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{generalStats.xp}</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Pontos de Experiência</p>
                        </div>
                     </div>

                     {/* RESUMO DO DESEMPENHO */}
                     <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
                        <div className="flex justify-between items-center">
                           <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-3 uppercase tracking-wide">
                              <span className="w-2 h-5 bg-orange-500 rounded-sm" /> Resumo do meu desempenho
                           </h3>
                           <div className="flex items-center gap-3">
                              <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-lg">
                                 {(['today', 'week', 'month', 'year'] as const).map(range => (
                                    <button
                                       key={range}
                                       onClick={() => setEvolutionRange(range)}
                                       className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all ${evolutionRange === range ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                                    >
                                       {range === 'today' ? 'Hoje' : range === 'week' ? 'Semana' : range === 'month' ? 'Mês' : 'Ano'}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                           {/* GERAL GAUGE */}
                           <div className="md:col-span-4 bg-orange-50/30 dark:bg-orange-900/5 p-6 rounded-2xl flex flex-col items-center justify-center space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">Geral <Info size={10} /></h4>
                              <div className="relative w-48 h-24 overflow-hidden">
                                 <svg className="w-full h-full">
                                    <path d="M 10 90 A 80 80 0 0 1 182 90" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" className="dark:stroke-slate-800" />
                                    <path d="M 10 90 A 80 80 0 0 1 182 90" fill="none" stroke="url(#gradient)" strokeWidth="20" strokeLinecap="round" strokeDasharray="301" strokeDashoffset={301 * (1 - generalStats.accuracy / 100)} />
                                    <defs>
                                       <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                          <stop offset="0%" stopColor="#ef4444" />
                                          <stop offset="50%" stopColor="#f59e0b" />
                                          <stop offset="100%" stopColor="#10b981" />
                                       </linearGradient>
                                    </defs>
                                 </svg>
                                 <div className="absolute bottom-0 inset-x-0 flex flex-col items-center pb-1">
                                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{generalStats.accuracy}%</span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${generalStats.accuracy >= 75 ? 'bg-emerald-100 text-emerald-700' : generalStats.accuracy >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                       {generalStats.accuracy >= 75 ? 'ALTO' : generalStats.accuracy >= 50 ? 'MÉDIO' : 'BAIXO'}
                                    </span>
                                 </div>
                              </div>
                              <p className="text-[10px] text-center font-bold text-slate-500 dark:text-slate-400 max-w-[200px]">
                                 Sua probabilidade de aprovação para este cargo é {' '}
                                 <span className="text-emerald-500 font-black">{generalStats.accuracy >= 70 ? 'Superior' : 'Crescente'}</span> em relação à concorrência.
                              </p>
                           </div>

                           {/* NÍVEL DE DIFICULDADE */}
                           <div className="md:col-span-4 space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">Nível de dificuldade <Info size={10} /></h4>
                              <div className="space-y-4 pt-2">
                                 {Object.entries(generalStats.diffStats).map(([label, stats]) => {
                                    const acc = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                                    return (
                                       <div key={label} className="grid grid-cols-12 items-center gap-3">
                                          <span className="col-span-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</span>
                                          <div className="col-span-7 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                             <div className="h-full bg-teal-600 transition-all duration-500" style={{ width: `${acc}%` }} />
                                          </div>
                                          <span className="col-span-2 text-[10px] font-black text-slate-800 dark:text-slate-200 text-right">{acc}%</span>
                                       </div>
                                    )
                                 })}
                              </div>
                           </div>

                           {/* RESOLUÇÕES */}
                           <div className="md:col-span-4 space-y-3">
                              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">Resoluções <Info size={10} /></h4>
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl flex justify-between items-center transition-colors">
                                 <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 text-center"><span className="text-base font-black text-indigo-600 block">{generalStats.total}</span> Resoluções</span>
                                 <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                                 <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 text-center"><span className="text-base font-black text-emerald-600 block">{generalStats.correct}</span> Acertos</span>
                                 <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                                 <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 text-center"><span className="text-base font-black text-red-600 block">{generalStats.wrong}</span> Erros</span>
                              </div>
                              <div className="pt-4 space-y-2">
                                 <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-relaxed uppercase tracking-widest">Desempenho por Período</p>
                                 <div className="h-24 w-full min-w-0">
                                    <StableResponsiveContainer height={96}>
                                       <AreaChart data={timelineData}>
                                          <defs>
                                             <linearGradient id="colorTotalProfile" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                             </linearGradient>
                                          </defs>
                                          <XAxis dataKey="date" hide />
                                          <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={20} />
                                          <Area type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} fill="url(#colorTotalProfile)" name="Quantidade" fillOpacity={1} />
                                          <Area type="monotone" dataKey="taxa" stroke="#6366f1" strokeWidth={1} fillOpacity={0} name="Precisão (%)" />
                                       </AreaChart>
                                    </StableResponsiveContainer>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'notebook' && (
                  <div className="space-y-6">
                     <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Minhas Anotações</h2>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full transition-colors">{notebookEntries.length} notas</span>
                     </div>
                     {notebookEntries.length > 0 ? (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
                           <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
                              <span>Anotação</span>
                              <span>Ação</span>
                           </div>

                           <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {notebookEntries.map((entry) => {
                                 const isLaw = entry.source === 'law';
                                 const isMaterial = entry.source === 'material';
                                 const sourceLabel = isLaw ? 'Lei' : isMaterial ? 'Material' : 'Questão';
                                 const SourceIcon = isLaw ? BookOpen : isMaterial ? Package : StickyNote;
                                 const badgeClassName = isLaw
                                    ? 'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800/60'
                                    : isMaterial
                                       ? 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-300 dark:ring-emerald-800/50'
                                       : 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-900/25 dark:text-amber-300 dark:ring-amber-800/50';

                                 return (
                                    <article key={entry.id} className="grid grid-cols-1 gap-4 px-4 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                       <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                             <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ring-1 ${badgeClassName}`}>
                                                <SourceIcon size={12} />
                                                {sourceLabel}
                                             </span>
                                             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                {formatDateTimeInSaoPaulo(entry.timestamp)}
                                             </span>
                                          </div>

                                          <button
                                             type="button"
                                             onClick={() => entry.href && router.push(entry.href)}
                                             disabled={!entry.href}
                                             className="mt-2 block max-w-full text-left text-sm font-black text-slate-900 transition-colors hover:text-indigo-600 disabled:cursor-default disabled:hover:text-slate-900 dark:text-slate-100 dark:hover:text-indigo-300 dark:disabled:hover:text-slate-100"
                                          >
                                             {entry.title}
                                          </button>

                                          <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                             {entry.subtitle}
                                          </p>

                                          <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                                             {entry.text}
                                          </p>
                                       </div>

                                       <div className="flex items-center justify-end gap-2">
                                          <button
                                             type="button"
                                             onClick={() => entry.href && router.push(entry.href)}
                                             disabled={!entry.href}
                                             className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
                                          >
                                             <ExternalLink size={13} />
                                             Abrir
                                          </button>

                                          <button
                                             type="button"
                                             onClick={() => {
                                                if (entry.source === 'law' && entry.articleId) {
                                                   handleRemoveLawNote(entry.articleId);
                                                   return;
                                                }

                                                if (entry.source === 'material' && entry.materialId) {
                                                   void handleRemoveMaterialNote(entry.materialId);
                                                   return;
                                                }

                                                saveNote(entry.questionId || 0, '');
                                             }}
                                             className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-900/30"
                                             title="Remover anotação"
                                             aria-label="Remover anotação"
                                          >
                                             <Trash2 size={14} />
                                          </button>
                                       </div>
                                    </article>
                                 );
                              })}
                           </div>
                        </div>
                     ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                           <StickyNote size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                           <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">Nenhuma anotação encontrada.</p>
                           <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 transition-colors">Adicione notas em questões e artigos da Lei Comentada durante seus estudos.</p>
                        </div>
                     )}
                  </div>
               )}

               {activeTab === 'saved-questions' && (
                  <div className="space-y-6">
                     <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                           <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Questões salvas</h2>
                           <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                              Seu banco pessoal para voltar, revisar e resolver depois.
                           </p>
                        </div>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full transition-colors">
                           {savedQuestionIds.length} salvas
                        </span>
                     </div>

                     <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
                           <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Total salvo</p>
                           <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{savedQuestionIds.length}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
                           <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Carregadas</p>
                           <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                              {savedQuestionRows.filter((row) => row.question).length}
                           </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
                           <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Respondidas</p>
                           <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{savedAnsweredCount}</p>
                        </div>
                     </div>

                     {savedQuestionIds.length > 0 ? (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
                           <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
                              <span>Questão</span>
                              <span>Ação</span>
                           </div>

                           <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {savedQuestionRows.map(({ id, question }) => {
                                 const title = getQuestionTitle(question, id);
                                 const publicHref = question ? buildQuestionPath(question) : `/practice?questionId=${id}`;
                                 const practiceHref = `/practice?questionId=${id}`;
                                 const answer = userAnswers.find((item) => String(item.questionId) === id);

                                 return (
                                    <article key={id} className="grid grid-cols-1 gap-4 px-4 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                       <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                             <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800/60">
                                                <BookmarkCheck size={12} />
                                                Salva
                                             </span>
                                             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                Q{id}
                                             </span>
                                             {answer && (
                                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${answer.isCorrect ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-300 dark:ring-emerald-800/50' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-900/25 dark:text-rose-300 dark:ring-rose-800/50'}`}>
                                                   {answer.isCorrect ? 'Certa' : 'Errada'}
                                                </span>
                                             )}
                                             {!question && isLoadingSavedQuestions && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                   <Loader2 size={11} className="animate-spin" />
                                                   Carregando
                                                </span>
                                             )}
                                          </div>

                                          <button
                                             type="button"
                                             onClick={() => router.push(publicHref)}
                                             className="mt-2 block max-w-full text-left text-sm font-black text-slate-900 transition-colors hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-300"
                                          >
                                             {title}
                                          </button>

                                          <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                             {question ? getQuestionSubjectLabel(question) : 'Detalhes da questão ainda não carregados.'}
                                          </p>

                                          <div className="mt-3 flex flex-wrap gap-2">
                                             <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                {getQuestionBankLabel(question)}
                                             </span>
                                             <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                {getQuestionYearLabel(question)}
                                             </span>
                                             <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                {getQuestionDifficultyLabel(question)}
                                             </span>
                                          </div>
                                       </div>

                                       <div className="flex items-center justify-end gap-2">
                                          <button
                                             type="button"
                                             onClick={() => router.push(practiceHref)}
                                             className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-indigo-700"
                                          >
                                             <Target size={13} />
                                             Resolver
                                          </button>
                                          <button
                                             type="button"
                                             onClick={() => router.push(publicHref)}
                                             className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
                                          >
                                             <ExternalLink size={13} />
                                             Abrir
                                          </button>
                                          <button
                                             type="button"
                                             onClick={() => handleRemoveSavedQuestion(id)}
                                             className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-900/30"
                                             title="Remover dos salvos"
                                             aria-label="Remover dos salvos"
                                          >
                                             <Trash2 size={14} />
                                          </button>
                                       </div>
                                    </article>
                                 );
                              })}
                           </div>
                        </div>
                     ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                           <BookmarkCheck size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                           <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">Nenhuma questão salva ainda.</p>
                           <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 transition-colors">Use o botão de salvar nas questões para montar sua lista de revisão.</p>
                        </div>
                     )}
                  </div>
               )}

               {activeTab === 'favorite-laws' && (
                  <div className="space-y-6">
                     <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Leis Favoritas</h2>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full transition-colors">{favoriteLaws.length} leis</span>
                     </div>

                     {isLoadingFavoriteLaws ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                           <Loader2 size={36} className="mx-auto mb-3 animate-spin text-slate-300 dark:text-slate-700" />
                           <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">Carregando leis favoritas...</p>
                        </div>
                     ) : favoriteLaws.length > 0 ? (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
                           <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
                              <span>Lei</span>
                              <span>Ação</span>
                           </div>

                           <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {favoriteLaws.map((law) => (
                                 <article key={law.id} className="grid grid-cols-1 gap-4 px-4 py-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                    <div className="min-w-0">
                                       <div className="flex flex-wrap items-center gap-2">
                                          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800/60">
                                             <BookOpen size={12} />
                                             Lei comentada
                                          </span>
                                          {(law.acronym || law.year) && (
                                             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                {[law.acronym, law.year].filter(Boolean).join(' • ')}
                                             </span>
                                          )}
                                       </div>

                                       <button
                                          type="button"
                                          onClick={() => router.push(`/lei-comentada/${law.slug}`)}
                                          className="mt-2 block max-w-full text-left text-sm font-black text-slate-900 transition-colors hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-300"
                                       >
                                          {law.shortTitle || law.title}
                                       </button>

                                       <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                                          {law.description || law.summary || law.ementa || 'Lei salva para consulta rápida.'}
                                       </p>

                                       <div className="mt-3 flex flex-wrap gap-2">
                                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                             {law.articleCount} artigos
                                          </span>
                                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                             {law.progressPercent || 0}% lido
                                          </span>
                                       </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                       <button
                                          type="button"
                                          onClick={() => router.push(`/lei-comentada/${law.slug}`)}
                                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
                                       >
                                          <ExternalLink size={13} />
                                          Abrir
                                       </button>

                                       <button
                                          type="button"
                                          onClick={() => handleRemoveFavoriteLaw(law)}
                                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-900/30"
                                          title="Remover dos favoritos"
                                          aria-label="Remover dos favoritos"
                                       >
                                          <Trash2 size={14} />
                                       </button>
                                    </div>
                                 </article>
                              ))}
                           </div>
                        </div>
                     ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                           <BookOpen size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                           <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">Nenhuma lei favorita ainda.</p>
                           <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 transition-colors">Use o botão de favorito na Lei Comentada para montar sua lista.</p>
                        </div>
                     )}
                  </div>
               )}

               {marketplaceEnabled && activeTab === 'materials' && (
                   <div className="space-y-6">
                       <div className="flex justify-between items-center">
                           <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Meus Materiais</h2>
                           <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full transition-colors">{userMaterials.length} itens</span>
                       </div>
                       
                       {userMaterials.length > 0 ? (
                           <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                               <table className="w-full text-left border-collapse">
                                   <thead>
                                       <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Material</th>
                                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hidden md:table-cell">Aquirido em</th>
                                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">Ação</th>
                                       </tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                       {userMaterials.map((material) => {
                                           const purchasedAtValue = resolveProfileMaterialPurchasedAt(material);
                                           const purchasedAtTimestamp = new Date(purchasedAtValue).getTime();
                                           const daysSince = profileNowMs > 0 && Number.isFinite(purchasedAtTimestamp)
                                               ? (profileNowMs - purchasedAtTimestamp) / (1000 * 60 * 60 * 24)
                                               : 0;
                                           const canDownload = daysSince >= 7;
                                           
                                           return (
                                               <tr key={material.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                   <td className="p-4">
                                                       <div className="flex items-center gap-4">
                                                           <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 overflow-hidden shrink-0">
                                                               {material.coverUrl ? (
                                                                   <Image
                                                                       src={getAssetUrl(material.coverUrl)}
                                                                       alt={`Capa de ${material.title}`}
                                                                       width={48}
                                                                       height={48}
                                                                       unoptimized
                                                                       className="h-full w-full object-cover"
                                                                   />
                                                               ) : <Package size={20} />}
                                                           </div>
                                                           <div>
                                                               <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{material.title}</h3>
                                                               <p className="text-[10px] font-black uppercase text-indigo-500 mt-0.5 tracking-tight">{String(material.type || '').toLowerCase() === 'pdf' ? 'PDF Interativo' : 'Curso Completo'}</p>
                                                           </div>
                                                       </div>
                                                   </td>
                                                   <td className="p-4 hidden md:table-cell">
                                                       <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{purchasedAtValue ? new Date(purchasedAtValue).toLocaleDateString() : '-'}</span>
                                                   </td>
                                                   <td className="p-4 text-right">
                                                       <div className="flex items-center justify-end gap-2">
                                                            <button 
                                                               onClick={() => router.push(`/read/${material.id}`)}
                                                               className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 dark:shadow-none"
                                                            >
                                                                <BookOpen size={14} /> Ler
                                                            </button>
                                                            
                                                            {canDownload ? (
                                                                <button 
                                                                    onClick={() => {
                                                                        void downloadAuthenticatedFile(buildMaterialDownloadEndpoint(material.id)).catch((error: unknown) => {
                                                                            addToast(readApiErrorMessage(error, 'Não foi possível baixar o material agora.'), 'error');
                                                                        });
                                                                    }}
                                                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200 dark:shadow-none"
                                                                >
                                                                    <Download size={14} /> Baixar
                                                                </button>
                                                            ) : (
                                                                <div className="group/tooltip relative">
                                                                    <button disabled className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest cursor-not-allowed opacity-60">
                                                                        <Download size={14} /> Baixar
                                                                    </button>
                                                                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 normal-case font-medium">
                                                                        Download disponível em {Math.ceil(7 - daysSince)} dias (Política de Garantia).
                                                                    </div>
                                                                </div>
                                                            )}
                                                       </div>
                                                   </td>
                                               </tr>
                                           );
                                       })}
                                   </tbody>
                               </table>
                           </div>
                       ) : (
                           <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                               <Package size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                               <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">Nenhum material adquirido.</p>
                               <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 transition-colors">Visite o Marketplace para encontrar materiais de estudo.</p>
                           </div>
                       )}
                   </div>
               )}

               {activeTab === 'personal' && (
                  <div ref={personalDetailsSectionRef} className="scroll-mt-24 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 transition-colors">Dados Pessoais</h2>
                      <form
                        onSubmit={async (e) => {
                           e.preventDefault();
                           if (isUpdatingProfile) return;
                           
                           setIsUpdatingProfile(true);
                           const formData = new FormData(e.currentTarget);
                           
                           const getValue = (name: string) => (formData.get(name) as string) || '';
                           
                           const updates = {
                               name: getValue('name'),
                               cpf: getValue('cpf').replace(/\D/g, ''),
                               phone: getValue('phone').replace(/\D/g, ''),
                               targetExam: getValue('targetExam'),
                               address: {
                                  zipCode: getValue('zipCode').replace(/\D/g, ''),
                                  street: getValue('street'),
                                  number: getValue('number'),
                                  complement: getValue('complement'),
                                  neighborhood: getValue('neighborhood'),
                                  city: getValue('city'),
                                  state: getValue('state')
                               }
                           };

                           const isValidCpf = (value: string) => {
                               if (value.length !== 11) return false;
                               if (/^(\d)\1{10}$/.test(value)) return false;

                               const calcDigit = (base: string, factor: number) => {
                                   const total = base.split('').reduce((sum, digit) => sum + (Number(digit) * factor--), 0);
                                   const result = 11 - (total % 11);
                                   return result > 9 ? 0 : result;
                               };

                               const d1 = calcDigit(value.slice(0, 9), 10);
                               const d2 = calcDigit(value.slice(0, 10), 11);
                               return d1 === Number(value[9]) && d2 === Number(value[10]);
                           };

                           // Manual Validation for better feedback
                           if (!updates.name) { addToast('Nome é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.cpf) { addToast('CPF é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!isValidCpf(updates.cpf)) { addToast('CPF inválido. Verifique e tente novamente.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.phone) { addToast('Telefone é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (![10, 11].includes(updates.phone.length)) { addToast('Telefone inválido. Informe DDD + número com 10 ou 11 dígitos.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.zipCode) { addToast('CEP é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (updates.address.zipCode.length !== 8) { addToast('CEP inválido. Informe um CEP com 8 dígitos.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.street) { addToast('Rua é obrigatória.', 'error'); setIsUpdatingProfile(false); return; }
                           if (updates.address.street.trim().length < 3) { addToast('Logradouro inválido. Informe um endereço válido.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.number) { addToast('Número é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!/[0-9a-zA-Z]/.test(updates.address.number)) { addToast('Número inválido. Informe um número de endereço válido.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.neighborhood) { addToast('Bairro é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (updates.address.neighborhood.trim().length < 2) { addToast('Bairro inválido. Informe um bairro válido.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.city) { addToast('Cidade é obrigatória.', 'error'); setIsUpdatingProfile(false); return; }
                           if (updates.address.city.trim().length < 2) { addToast('Cidade inválida. Informe uma cidade válida.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.state) { addToast('Estado (UF) é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!/^[A-Za-z]{2}$/.test(updates.address.state)) { addToast('UF inválida. Use a sigla com 2 letras (ex.: SP).', 'error'); setIsUpdatingProfile(false); return; }

                           try {
                               await updateUser(updates);
                               // Notification is handled by AuthContext
                           } catch (err: unknown) {
                               clientLog.warn('Profile update error:', err);
                               const msg = readApiErrorMessage(err, 'Erro ao sincronizar. Verifique sua conexão.');
                               addToast(msg, 'error');
                           } finally {
                               setIsUpdatingProfile(false);
                           }
                        }}
                        noValidate
                        className="space-y-6 max-w-2xl"
                     >
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Nome Completo <span className="text-rose-500">*</span></label>
                            <input name="name" type="text" defaultValue={currentUser.name} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">E-mail de Acesso</label>
                                {currentUser.emailVerified ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                                        <CheckCircle2 size={12} /> Confirmado
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                                        <AlertTriangle size={12} /> Pendente
                                    </span>
                                )}
                            </div>
                            <input name="email" type="email" defaultValue={currentUser.email} readOnly className="w-full h-11 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed transition-all font-sans" title="Não é possível alterar o email" />
                            <p className={`text-xs font-semibold leading-relaxed ${currentUser.emailVerified ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                {currentUser.emailVerified
                                    ? 'Seu e-mail foi confirmado e está apto para recuperar senha, receber avisos e liberar recursos da conta.'
                                    : 'Seu e-mail ainda não foi confirmado. Confirme para liberar todos os recursos e receber notificações importantes.'}
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                           <div className="space-y-1.5">
                               <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">CPF <span className="text-rose-500">*</span></label>
                               <input name="cpf" type="text" defaultValue={currentUser.cpf || ''} placeholder="000.000.000-00" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-colors font-sans" />
                           </div>
                           <div className="space-y-1.5">
                               <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Telefone / WhatsApp <span className="text-rose-500">*</span></label>
                               <input
                                   name="phone"
                                   type="tel"
                                   inputMode="tel"
                                   autoComplete="tel"
                                   defaultValue={currentUser.phone || ''}
                                   placeholder="(11) 99999-9999"
                                   className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-colors font-sans"
                               />
                           </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Foco de Estudo</label>
                            <div className="relative group/exam">
                                 <input name="targetExam" type="text" readOnly onClick={() => setShowGoalModal(true)} value={currentUser.targetExam || ''} placeholder="Selecione seu foco" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-900 transition-colors font-sans" />
                                 <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover/exam:text-indigo-500 transition-colors">
                                     <ChevronRight size={16} />
                                 </div>
                            </div>
                        </div>

                         <div className="space-y-4 pt-2">
                            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800 pb-2">Dados de Cobrança / Endereço</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                               <div className="col-span-1 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">CEP <span className="text-rose-500">*</span></label>
                                   <input name="zipCode" type="text" defaultValue={currentUser.address?.zipCode || ''} placeholder="00000-000" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                               <div className="col-span-2 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Logradouro / Rua <span className="text-rose-500">*</span></label>
                                   <input name="street" type="text" defaultValue={currentUser.address?.street || ''} placeholder="Ex: Av. Paulista" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                               <div className="col-span-1 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Número <span className="text-rose-500">*</span></label>
                                   <input name="number" type="text" defaultValue={currentUser.address?.number || ''} placeholder="123" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="space-y-1.5">
                                     <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Complemento (Opcional)</label>
                                     <input name="complement" type="text" defaultValue={currentUser.address?.complement || ''} placeholder="Ex: Apto 101, Bloco A" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                 </div>
                                 <div className="space-y-1.5">
                                     <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Bairro <span className="text-rose-500">*</span></label>
                                     <input name="neighborhood" type="text" defaultValue={currentUser.address?.neighborhood || ''} placeholder="Ex: Centro" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                 </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                               <div className="space-y-1.5 sm:col-span-2">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Cidade <span className="text-rose-500">*</span></label>
                                   <input name="city" type="text" defaultValue={currentUser.address?.city || ''} placeholder="Ex: São Paulo" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                               <div className="space-y-1.5 sm:col-span-1">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Estado (UF) <span className="text-rose-500">*</span></label>
                                   <input name="state" type="text" defaultValue={currentUser.address?.state || ''} placeholder="SP" maxLength={2} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans uppercase" />
                               </div>
                            </div>
                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                <span className="text-rose-500">*</span> Campos obrigatórios.
                            </p>
                         </div>

                         <div className="pt-4 flex flex-wrap items-center gap-3 sm:gap-4">
                            <button 
                                type="submit" 
                                disabled={isUpdatingProfile}
                                className={`px-10 py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all flex items-center gap-2 ${isUpdatingProfile ? 'opacity-70 cursor-wait' : 'hover:-translate-y-1 active:scale-95'}`}
                            >
                               {isUpdatingProfile ? (
                                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                               ) : (
                                   <ShieldCheck size={16} />
                               )}
                                {isUpdatingProfile ? 'Sincronizando...' : 'Sincronizar Perfil'}
                            </button>
                         </div>
                     </form>

                     <div id="saved-cards-personal-section" className="mt-12 border-t border-slate-100 pt-8 dark:border-slate-800">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Cartões Salvos</h3>
                                <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    Seus cartões ficam disponíveis aqui para compras futuras e para renovação automática.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddingCard(!isAddingCard);
                                    if (!isAddingCard) {
                                        setStripeSetupClientSecret(null);
                                    }
                                }}
                                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                                    isAddingCard
                                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {isAddingCard ? <X size={14} /> : <CreditCard size={14} />}
                                {isAddingCard ? 'Cancelar' : 'Adicionar cartão'}
                            </button>
                        </div>

                        <div className="mt-6 space-y-4">
                            {cardsLoadError && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Falha ao sincronizar com a Stripe</p>
                                    <p className="mt-1 text-[11px] font-medium leading-5 text-slate-600 dark:text-slate-300">
                                        {cardsLoadError}
                                    </p>
                                </div>
                            )}

                            {isStripeBilling ? (
                                <>
                                    {isAddingCard && (
                                        <div className="rounded-2xl border border-indigo-100 bg-slate-50 p-5 dark:border-indigo-900/40 dark:bg-slate-800/30">
                                            {!stripeSetupClientSecret ? (
                                                <button
                                                    type="button"
                                                    onClick={handlePrepareStripeCard}
                                                    disabled={isSavingCard}
                                                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-700 disabled:opacity-60"
                                                >
                                                    {isSavingCard ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                                                    {isSavingCard ? 'Preparando formulário...' : 'Novo cartão Stripe'}
                                                </button>
                                            ) : (
                                                <StripeSetupCardForm
                                                    publishableKey={stripePublishableKey}
                                                    clientSecret={stripeSetupClientSecret}
                                                    billingName={currentUser?.name}
                                                    billingEmail={currentUser?.email}
                                                    onSaved={handleStripeCardSaved}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {isLoadingCards ? (
                                        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-800/20">
                                            <Loader2 className="animate-spin text-indigo-500" />
                                        </div>
                                    ) : userCards.length > 0 ? (
                                        <div className="space-y-3">
                                            {userCards.map((card) => (
                                                <div key={card.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all dark:border-slate-800 dark:bg-slate-800/20 md:flex-row md:items-center md:justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${Number(card.is_default) === 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                            <CreditCard size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">
                                                                    {formatMaskedCardLabelAscii(card)}
                                                                </p>
                                                                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">Stripe</span>
                                                                {getCardExpiryState(card).isExpired && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">Expirado</span>}
                                                                {!getCardExpiryState(card).isExpired && getCardExpiryState(card).isExpiringSoon && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Vence em breve</span>}
                                                                {Number(card.is_default) === 1 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">Padrão</span>}
                                                                {Number(card.locked_by_recurring) === 1 && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">Assinatura ativa</span>}
                                                            </div>
                                                            <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                                                Expira em {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
                                                            </p>
                                                            {Number(card.locked_by_recurring) === 1 && (
                                                                <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                                                    Este cartao esta vinculado a renovacao atual. Defina outro como padrao para liberar a remocao.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {Number(card.is_default) !== 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetDefaultCard(String(card.id))}
                                                                className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                            >
                                                                Definir padrão
                                                            </button>
                                                        )}
                                                        {Number(card.locked_by_recurring) !== 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveCard(String(card.id))}
                                                                className="rounded-xl bg-rose-50 p-2 text-rose-500 transition-all hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                                            <CreditCard size={28} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhum cartão salvo ainda.</p>
                                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Adicione um cartão para acelerar compras futuras e renovações.</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {isAddingCard && (
                                        <form onSubmit={handleSaveCard} className="rounded-2xl border border-indigo-100 bg-slate-50 p-5 dark:border-indigo-900/40 dark:bg-slate-800/30">
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Número do Cartão</label>
                                                    <input name="cardNumber" type="text" placeholder="0000 0000 0000 0000" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-900" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Nome no Cartão</label>
                                                    <input name="cardName" type="text" placeholder="COMO ESTÁ IMPRESSO" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-900" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Validade</label>
                                                    <input name="expiry" type="text" placeholder="12/30" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-900" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Bandeira</label>
                                                    <select name="brand" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-900">
                                                        <option value="visa">Visa</option>
                                                        <option value="mastercard">Mastercard</option>
                                                        <option value="elo">Elo</option>
                                                        <option value="amex">Amex</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <button disabled={isSavingCard} type="submit" className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-700 disabled:opacity-60">
                                                {isSavingCard ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                                {isSavingCard ? 'Salvando...' : 'Salvar cartão com segurança'}
                                            </button>
                                        </form>
                                    )}

                                    {isLoadingCards ? (
                                        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-800/20">
                                            <Loader2 className="animate-spin text-indigo-500" />
                                        </div>
                                    ) : userCards.length > 0 ? (
                                        <div className="space-y-3">
                                            {userCards.map((card) => (
                                                <div key={card.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all dark:border-slate-800 dark:bg-slate-800/20 md:flex-row md:items-center md:justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                                            <CreditCard size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">{formatMaskedCardLabelAscii(card, { includeBrand: false })}</p>
                                                                {Number(card.is_default) === 1 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">Padrão</span>}
                                                            </div>
                                                            <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                                                Vence em {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {Number(card.is_default) !== 1 && (
                                                            <button type="button" onClick={() => handleSetDefaultCard(String(card.id))} className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                                                                Definir padrão
                                                            </button>
                                                        )}
                                                        {Number(card.locked_by_recurring) !== 1 && (
                                                            <button type="button" onClick={() => handleRemoveCard(String(card.id))} className="rounded-xl bg-rose-50 p-2 text-rose-500 transition-all hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                                            <CreditCard size={28} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhum cartão salvo ainda.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'support-history' && renderSupportHistoryTab()}

               {activeTab === 'billing' && renderBillingTab()}

               {false && activeTab === 'billing' && (
                  <div className="space-y-6">
                     {/* Alerta de Problema de Pagamento */}
                     {currentUser.paymentIssue && (
                        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-5 rounded-2xl flex items-center gap-5 transition-all">
                           <div className="w-12 h-12 bg-rose-600 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
                              <ShieldAlert size={24} className="text-white" />
                           </div>
                           <div className="flex-1 space-y-0.5">
                              <h3 className="text-sm font-black text-rose-600 dark:text-rose-500 uppercase tracking-tight">Pagamento Pendente</h3>
                              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                                 {currentUser.paymentIssue.message || 'Atualize seus dados para evitar o bloqueio total da sua conta.'}
                              </p>
                           </div>
                            <button 
                               onClick={() => {
                                  openSavedCardsManager();
                               }}
                               className="px-4 py-2 bg-slate-900 dark:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg transition-all"
                            >
                               Resolver
                            </button>
                        </div>
                     )}

                     {/* Resumo da Assinatura */}
                     <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <CreditCard size={120} className="text-indigo-600" />
                        </div>
                        
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Assinatura Ativa</h4>
                                    {hasActiveSubscription && <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                        {billingProviderLabel}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                                    Plano {effectivePlanDisplayName}
                                    {isElitePlan && <Crown className="text-amber-500" size={20} />}
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                                    {currentUser.subscription?.current_period_end 
                                        ? `Sua assinatura renova automaticamente em ${new Date(currentUser.subscription.current_period_end).toLocaleDateString()}.`
                                        : 'Acesse recursos essenciais para sua aprovação.'}
                                </p>
                            </div>

                            {currentUser.subscription?.current_period_end && (
                                <div className="flex flex-col items-end gap-1 text-right animate-in fade-in duration-500">
                                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">Dias Restantes</div>
                                    <div className="text-3xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                                        {(() => {
                                            const diff = new Date(currentUser.subscription.current_period_end).getTime() - new Date().getTime();
                                            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                            return days > 0 ? days : 0;
                                        })()}
                                    </div>
                                    
                                    {hasActiveSubscription && (
                                        <div className="flex flex-col items-end gap-2 mt-2">
                                            {hasPendingRefundRequest ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded border border-amber-200/50">Reembolso em Análise</span>
                                                    <button 
                                                        onClick={handleCancelRefundRequest}
                                                        className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest underline underline-offset-2 transition-colors"
                                                    >
                                                        Cancelar Solicitação
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-end gap-1">
                                                    {isWithinRefundWindow ? (
                                                        <button
                                                            onClick={() => setShowCancelModal(true)}
                                                            className="text-[10px] font-black text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 uppercase tracking-widest transition-colors"
                                                        >
                                                            Cancelar e Solicitar Reembolso
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 opacity-60">
                                                            <ShieldCheck size={12} className="text-emerald-500" />
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Compromisso Ativo</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                             )}
                        </div>

                        {/* Toggle de Renovação Automática */}
                        {currentUser.subscription && hasActiveSubscription && (
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${currentUser.subscription?.auto_renew ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                                        <RotateCcw size={18} className={currentUser.subscription?.auto_renew ? 'animate-spin-slow' : ''} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Renovação Automática</h4>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                            {currentUser.subscription?.auto_renew 
                                                ? 'Seu plano será renovado automaticamente ao fim do ciclo.' 
                                                : 'Sua assinatura será encerrada ao final do período atual.'}
                                        </p>
                                    </div>
                                </div>
                                <div 
                                    onClick={handleRenewalToggle}
                                    className={`w-11 h-6 rounded-full relative cursor-pointer transition-all duration-300 shadow-inner ${currentUser.subscription?.auto_renew ? 'bg-emerald-500 shadow-emerald-600/20' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-lg ${currentUser.subscription?.auto_renew ? 'right-0.5' : 'left-0.5'}`} />
                                </div>
                            </div>
                        )}
                     </div>

                     {/* CTA Ver Planos (Atrativo) */}
                     {(!hasActiveSubscription || !isElitePlan) && (
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl shadow-indigo-200 dark:shadow-none animate-in fade-in zoom-in duration-700 transition-all hover:scale-[1.01]">
                             <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                                 <Zap size={140} className="fill-current" />
                             </div>
                             <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                                 <div className="space-y-1">
                                     <div className="flex items-center justify-center md:justify-start gap-2">
                                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-sm">Upgrade Disponível</span>
                                        <Crown size={14} className="text-amber-300" />
                                     </div>
                                     <h3 className="text-xl font-black tracking-tight leading-tight italic">Torne-se Elite e acelere sua aprovação!</h3>
                                     <p className="text-[11px] font-medium text-indigo-100 max-w-sm opacity-80">Acesse simulados exclusivos, mentoria com IA e banco de questões ilimitado.</p>
                                 </div>
                                 <button 
                                    onClick={() => router.push('/plans')}
                                    className="px-8 py-3 bg-white text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-lg shadow-black/10 flex items-center gap-2 shrink-0 group"
                                 >
                                    Ver Planos Premium <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                 </button>
                             </div>
                        </div>
                     )}

                     {/* Métodos de Pagamento */}
                     <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors overflow-hidden">
                        {isStripeBilling && !usesInternalStripeVault ? (
                            <>
                                <header className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
                                    <div>
                                        <h3 id="save-card-section" className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Billing Portal</h3>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Cartões, cobranças futuras e faturas ficam centralizados na Stripe.</p>
                                    </div>
                                    <button
                                        onClick={handleOpenStripePortal}
                                        disabled={isOpeningBillingPortal}
                                        className="px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
                                    >
                                        {isOpeningBillingPortal ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                                        {isOpeningBillingPortal ? 'Abrindo...' : 'Abrir Portal'}
                                    </button>
                                </header>

                                <div className="p-6 space-y-4">
                                    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-950/20 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Provider ativo</p>
                                            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">{billingProviderLabel}</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                                Use o portal para trocar o cartão, acompanhar faturas, corrigir falhas de pagamento e manter a assinatura pronta para as renovacoes automaticas.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleOpenStripePortal}
                                            disabled={isOpeningBillingPortal}
                                            className="px-5 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                        >
                                            {isOpeningBillingPortal ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                                            {isOpeningBillingPortal ? 'Abrindo Portal...' : 'Gerenciar na Stripe'}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Metodos de pagamento</p>
                                            <p className="mt-2 text-[12px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                                O cartão padrao fica salvo no cliente Stripe e pode ser atualizado a qualquer momento sem passar por armazenamento local na plataforma.
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Falhas e cobrancas</p>
                                            <p className="mt-2 text-[12px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                                Quando uma renovação falhar, o aluno atualiza o metodo no portal e o backend sincroniza o estado da assinatura via webhook.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <footer className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800 flex items-center gap-3">
                                    <Info size={14} className="text-slate-400 shrink-0" />
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
                                        SEUS DADOS DE COBRANÇA SAO PROCESSADOS COM SEGURANÇA PELA STRIPE. CARTOES, FATURAS E TENTATIVAS DE PAGAMENTO SAO GERENCIADOS NO BILLING PORTAL.
                                    </p>
                                </footer>
                            </>
                        ) : isStripeBilling && usesInternalStripeVault ? (
                            <>
                                <header className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
                                    <div>
                                        <h3 id="save-card-section" className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Cofre Stripe</h3>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Cartões, padrão de renovação e cofre externo da Stripe geridos dentro da sua plataforma.</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsAddingCard(!isAddingCard);
                                            if (!isAddingCard) {
                                                setStripeSetupClientSecret(null);
                                            }
                                        }}
                                        className={`px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isAddingCard ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    >
                                        {isAddingCard ? <X size={14} /> : <CreditCard size={14} />} {isAddingCard ? 'Cancelar' : 'Novo Cartão'}
                                    </button>
                                </header>

                                <div className="p-6 space-y-4">
                                    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-950/20 p-5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Provider ativo</p>
                                        <h4 className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{billingProviderLabel}</h4>
                                        <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                            O cartão continua tokenizado e guardado na Stripe, mas a gestão de cartão padrão, adição e remoção acontece nesta tela.
                                        </p>
                                    </div>

                                    {isAddingCard && (
                                        <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 animate-in slide-in-from-top-4 duration-300 space-y-4">
                                            {!stripeSetupClientSecret ? (
                                                <button
                                                    onClick={handlePrepareStripeCard}
                                                    disabled={isSavingCard}
                                                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                                >
                                                    {isSavingCard ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                                                    {isSavingCard ? 'Preparando formulário...' : 'Adicionar cartão Stripe'}
                                                </button>
                                            ) : (
                                                <StripeSetupCardForm
                                                    publishableKey={stripePublishableKey}
                                                    clientSecret={stripeSetupClientSecret}
                                                    billingName={currentUser?.name}
                                                    billingEmail={currentUser?.email}
                                                    onSaved={handleStripeCardSaved}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {isLoadingCards ? (
                                        <div className="text-sm text-slate-500">Carregando cartões...</div>
                                    ) : userCards.length > 0 ? (
                                        <div className="space-y-3">
                                            {userCards.map((card) => (
                                                <div key={card.id} className="group flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 transition-all bg-slate-50 dark:bg-slate-800/20">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.is_default == 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                                            <CreditCard size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest text-xs">{formatMaskedCardLabelAscii(card)}</p>
                                                                {card.is_default == 1 && <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest">Padrão</span>}
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">Expira em {String(card.exp_month).padStart(2, '0')}/{card.exp_year}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-4 md:mt-0">
                                                        {card.is_default != 1 && (
                                                            <button onClick={() => handleSetDefaultCard(String(card.id))} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                                                                Definir padrão
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleRemoveCard(String(card.id))} className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 text-slate-400">
                                            <CreditCard size={32} className="mx-auto mb-3 opacity-50" />
                                            <p className="text-sm font-medium">Nenhum cartão Stripe salvo ainda.</p>
                                        </div>
                                    )}
                                </div>

                                <footer className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800 flex items-center gap-3">
                                    <Info size={14} className="text-slate-400 shrink-0" />
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
                                        O DADO SENSÍVEL CONTINUA NO COFRE DA STRIPE. A PLATAFORMA EXIBE E GERENCIA APENAS O ESPELHO OPERACIONAL PARA O ALUNO.
                                    </p>
                                </footer>
                            </>
                        ) : (
                            <>
                        <header className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 id="save-card-section" className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Formas de Pagamento</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Gerencie seus cartões salvos para renovações automáticas.</p>
                            </div>
                            <button 
                                onClick={() => setIsAddingCard(!isAddingCard)}
                                className={`px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isAddingCard ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                                {isAddingCard ? <X size={14} /> : <CreditCard size={14} />} {isAddingCard ? 'Cancelar' : 'Novo Cartão'}
                            </button>
                        </header>
                        
                        <div className="p-6 space-y-4">
                            {isAddingCard && (
                                <form onSubmit={handleSaveCard} className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 animate-in slide-in-from-top-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Número do Cartão</label>
                                            <input name="cardNumber" type="text" placeholder="0000 0000 0000 0000" required className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none font-mono" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Nome no Cartão</label>
                                            <input name="cardName" type="text" placeholder="JOÃO SILVA" required className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Validade (MM/AA)</label>
                                                <input name="expiry" type="text" placeholder="12/30" required className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Bandeira</label>
                                                <select name="brand" className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none">
                                                    <option value="visa">Visa</option>
                                                    <option value="mastercard">Mastercard</option>
                                                    <option value="elo">Elo</option>
                                                    <option value="amex">Amex</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <button disabled={isSavingCard} type="submit" className="w-full h-10 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center justify-center gap-2">
                                        {isSavingCard ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} 
                                        {isSavingCard ? 'Salvando...' : 'Salvar Cartão com Segurança'}
                                    </button>
                                </form>
                            )}

                            {isLoadingCards ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500" /></div>
                            ) : userCards.length > 0 ? (
                                userCards.map((card) => (
                                    <div key={card.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-8 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 flex items-center justify-center p-1 shadow-sm">
                                                    <span className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                                        {String(card.brand || 'card').replace(/[_-]+/g, ' ').trim() || 'Card'}
                                                    </span>
                                                </div>
                                                <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                                                        {formatMaskedCardLabelAscii(card, { includeBrand: false })}
                                                    </span>
                                                    {card.is_default === 1 && <span className="text-[8px] font-black uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200/50">Padrão</span>}
                                                    {card.locked_by_recurring === 1 && (
                                                        <div className="group/lock relative">
                                                            <span className="text-[8px] font-black uppercase bg-indigo-600 text-white px-2 py-0.5 rounded flex items-center gap-1 cursor-help shadow-sm">
                                                                <ShieldAlert size={8} /> Assinatura Ativa
                                                            </span>
                                                            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover/lock:opacity-100 pointer-events-none transition-opacity z-50 font-medium normal-case">
                                                                Este cartão é o método de pagamento da sua assinatura principal.
                                                            </div>
                                                        </div>
                                                    )}
                                                    {(() => {
                                                        const now = new Date();
                                                        const cardExpiryYear = Number(card.exp_year || 0);
                                                        const cardExpiryMonth = Number(card.exp_month || 0);
                                                        const isExpired = cardExpiryYear < now.getFullYear() || (cardExpiryYear === now.getFullYear() && cardExpiryMonth < (now.getMonth() + 1));
                                                        if (isExpired) {
                                                            return (
                                                                <span className="text-[8px] font-black uppercase bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded border border-rose-200/50 flex items-center gap-1 animate-pulse">
                                                                    <AlertTriangle size={8} /> Expirado
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">Vence em {card.exp_month.toString().padStart(2, '0')}/{card.exp_year}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {card.is_default !== 1 && (
                                                <button onClick={() => handleSetDefaultCard(String(card.id))} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                    Definir Padrão
                                                </button>
                                            )}
                                            {card.locked_by_recurring !== 1 && (
                                                <button onClick={() => handleRemoveCard(String(card.id))} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6">
                                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <AlertCircle size={24} className="text-slate-300" />
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nenhuma forma de pagamento cadastrada.</p>
                                </div>
                            )}
                        </div>
                        
                        <footer className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800 flex items-center gap-3">
                            <Info size={14} className="text-slate-400 shrink-0" />
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
                                SEUS DADOS DE PAGAMENTO SAO PROCESSADOS COM SEGURANCA PELA STRIPE E NAO FICAM ARMAZENADOS INTEGRALMENTE EM NOSSOS SERVIDORES.
                            </p>
                        </footer>
                            </>
                        )}
                     </div>
                  </div>
               )}

               {activeTab === 'billing-history' && renderBillingHistoryTab()}

               {false && activeTab === 'billing-history' && (
                  <div className="space-y-6">
                      <div className="flex justify-between items-center">
                          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Histórico de Transações</h2>
                          <button onClick={fetchUserTransactions} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><RotateCcw size={18} /></button>
                      </div>

                      {isLoadingTransactions ? (
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-20 flex justify-center"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
                      ) : userTransactions.length > 0 ? (
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                              <table className="w-full text-left">
                                  <thead>
                                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Data</th>
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descrição</th>
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">Status</th>
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">Valor</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {userTransactions.map((tx) => {
                                          const transactionStatus = String(tx.status || '').toLowerCase();
                                          return (
                                          <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                              <td className="p-4"><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{tx.dateFormatted || formatDateBR(tx.createdAt || tx.created_at || tx.dueDate || tx.timestamp)}</span></td>
                                              <td className="p-4">
                                                  <div className="flex items-center gap-3">
                                                      <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Package size={14} /></div>
                                                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{tx.description || 'Assinatura'}</span>
                                                  </div>
                                              </td>
                                              <td className="p-4 text-center">
                                                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                                                      (transactionStatus === 'approved' || transactionStatus === 'completed') ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' :
                                                      (transactionStatus === 'pending' || transactionStatus === 'pre-approved') ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' :
                                                      transactionStatus === 'refunded' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' :
                                                      'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                                                  }`}>
                                                      {(transactionStatus === 'approved' || transactionStatus === 'completed') ? 'Aprovado' : (transactionStatus === 'pending' || transactionStatus === 'pre-approved') ? 'Pendente' : transactionStatus === 'refunded' ? 'Estornado' : 'Cancelado'}
                                                  </span>
                                              </td>
                                              <td className="p-4 text-right"><span className="text-xs font-black text-slate-900 dark:text-slate-100">R$ {Number(tx.amount || 0).toFixed(2)}</span></td>
                                          </tr>
                                      );
                                      })}
                                  </tbody>
                              </table>
                          </div>
                      ) : (
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                              <BarChart3 size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Nenhuma transação registrada.</p>
                          </div>
                      )}
                  </div>
               )}

               {activeTab === 'referral' && canAccessReferralTab && (
                   <div className="space-y-6">
                       {/* Banner do Programa */}
                       <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-2xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-200 dark:shadow-none">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                <Gift size={160} />
                            </div>
                            <div className="max-w-md relative z-10 space-y-4">
                                <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">Programa de Parceria</span>
                                <h2 className="text-3xl font-black tracking-tight leading-tight">Indique amigos e ganhe 20% de comissão!</h2>
                                <p className="text-sm font-medium text-indigo-100 leading-relaxed">Compartilhe seu link exclusivo. Cada nova assinatura em planos Elite através do seu link gera créditos automáticos para você.</p>
                                
                                <div className="pt-4 flex items-center gap-3">
                                    <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center justify-between gap-4">
                                        <code className="text-xs font-black tracking-widest text-indigo-100 truncate">
                                            https://concursomestre.com/r/{currentUser.id}
                                        </code>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(`https://concursomestre.com/r/${currentUser.id}`);
                                                setIsCopying(true);
                                                addToast('Link copiado para a área de transferência!', 'success');
                                                setTimeout(() => setIsCopying(false), 2000);
                                            }}
                                            className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2 shrink-0"
                                        >
                                            {isCopying ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                            {isCopying ? 'Copiado' : 'Copiar'}
                                        </button>
                                    </div>
                                    <button className="p-4 bg-indigo-500/30 hover:bg-indigo-500/40 rounded-2xl border border-white/20 transition-all">
                                        <Share2 size={20} />
                                    </button>
                                </div>
                            </div>
                       </div>

                       {/* Stats das Indicações */}
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           {[
                               { label: 'Total de Cliques', value: referralStats?.clicks || 0, icon: MousePointer2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                               { label: 'Indicações Ativas', value: referralStats?.conversions || 0, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                               { label: 'Saldo a Receber', value: `R$ ${(referralStats?.balance || 0).toFixed(2)}`, icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50' }
                           ].map((stat, i) => (
                               <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                                   <div className="flex items-center gap-4">
                                       <div className={`w-12 h-12 rounded-xl ${stat.bg} dark:bg-slate-800 flex items-center justify-center ${stat.color} transition-colors`}>
                                           <stat.icon size={24} />
                                       </div>
                                       <div>
                                           <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">{stat.label}</p>
                                           <h4 className="text-xl font-black text-slate-900 dark:text-slate-100 transition-colors">{stat.value}</h4>
                                       </div>
                                   </div>
                               </div>
                           ))}
                       </div>

                       {/* Como funciona */}
                       <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
                            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Como funciona o programa?</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {[
                                    { step: '01', title: 'Compartilhe o Link', desc: 'Envie para amigos ou em grupos de estudo.' },
                                    { step: '02', title: 'Amigo Assina', desc: 'Sua indicação ganha acesso ao melhor conteúdo.' },
                                    { step: '03', title: 'Você Ganha 20%', desc: 'Receba sua comissão sobre o valor da assinatura.' }
                                ].map((step, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="text-2xl font-black text-indigo-600/20 dark:text-indigo-500/10 italic leading-none">{step.step}</div>
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 transition-colors">{step.title}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">{step.desc}</p>
                                    </div>
                                ))}
                            </div>
                       </div>
                   </div>
               )}

               {activeTab === 'security' && (
                  <div className="space-y-6">
                      {/* Alteração de Senha */}
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                          <div className="flex items-center gap-3 mb-6">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Shield size={20} /></div>
                              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">Segurança da Conta</h2>
                          </div>
                          
                          <form 
                              onSubmit={async (e) => {
                                  e.preventDefault();
                                  const formData = new FormData(e.currentTarget);
                                  const current = formData.get('currentPassword') as string;
                                  const newPass = formData.get('newPassword') as string;
                                  const confirm = formData.get('confirmPassword') as string;
                                  
                                  if (newPass !== confirm) return addToast('As senhas não coincidem.', 'error');
                                  
                                  try {
                                      const res = await profileService.changePassword(current, newPass);
                                      addToast(res.message || 'Senha alterada com sucesso!', 'success');
                                      (e.target as HTMLFormElement).reset();
                                  } catch (err: unknown) {
                                      addToast(readApiErrorMessage(err, 'Falha na comunicação com o servidor.'), 'error');
                                  }
                              }}
                              className="space-y-4 max-w-md"
                          >
                              <div className="space-y-1.5 font-sans">
                                  <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Senha Atual</label>
                                  <input name="currentPassword" type="password" required className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5 font-sans">
                                      <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nova Senha</label>
                                      <input name="newPassword" type="password" required className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                  </div>
                                  <div className="space-y-1.5 font-sans">
                                      <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Confirmar Nova Senha</label>
                                      <input name="confirmPassword" type="password" required className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                  </div>
                              </div>
                              <button type="submit" className="px-6 py-3 bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-md">
                                  Atualizar Senha
                              </button>
                          </form>
                      </div>

                      {/* Preferências de Privacidade */}
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                         <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                             <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Privacidade e Preferências</h2>
                             <button
                                onClick={handleSavePrivacyPreferences}
                                disabled={isSavingPrivacyPreferences}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                             >
                                {isSavingPrivacyPreferences ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                Salvar Tudo
                             </button>
                         </div>
                         <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {[
                               { id: 'isPublic', label: 'Perfil publico no ranking de XP', desc: 'Permite que seu nome apareca no ranking de nivel, sem afetar rankings pos-prova.', checked: privacyPreferencesDraft.isPublic, icon: Users },
                               { id: 'showProfilePhoto', label: 'Mostrar foto no ranking de XP', desc: 'Quando desligado, o ranking usa apenas a inicial do seu nome.', checked: privacyPreferencesDraft.showProfilePhoto, icon: Camera },
                               { id: 'notifications', label: 'Notificacoes por email', desc: 'Receba alertas sobre novidades, cobrancas e atividades importantes.', checked: privacyPreferencesDraft.notifications, icon: Bell },
                               { id: 'shareData', label: 'Compartilhar dados de estudo', desc: 'Usa sua atividade para melhorar recomendacoes e estatisticas internas.', checked: privacyPreferencesDraft.shareData, icon: Zap }
                            ].map((item, i) => (
                               <div key={i} className="flex items-center justify-between py-5 group">
                                  <div className="flex items-start gap-4">
                                     <div className="mt-1 text-slate-400 group-hover:text-indigo-500 transition-colors"><item.icon size={20} /></div>
                                     <div>
                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block transition-colors">{item.label}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5 transition-colors">{item.desc}</span>
                                     </div>
                                  </div>
                                  <div 
                                    onClick={() => setPrivacyPreferencesDraft((current) => ({ ...current, [item.id]: !item.checked }))}
                                    className={`w-11 h-6 rounded-full relative cursor-pointer transition-all duration-300 ${item.checked ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}
                                  >
                                     <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${item.checked ? 'right-1' : 'left-1'} shadow-sm`} />
                                  </div>
                               </div>
                            ))}
                         </div>

                         <div className="mt-6 grid gap-4 md:grid-cols-3">
                            <label className="space-y-2">
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Tema padrao</span>
                               <select
                                  value={privacyPreferencesDraft.defaultTheme}
                                  onChange={(event) => setPrivacyPreferencesDraft((current) => ({ ...current, defaultTheme: event.target.value as 'system' | 'light' | 'dark' }))}
                                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-indigo-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                               >
                                  <option value="system">Sistema</option>
                                  <option value="light">Claro</option>
                                  <option value="dark">Escuro</option>
                               </select>
                            </label>
                            <label className="space-y-2">
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Questões por padrao</span>
                               <select
                                  value={privacyPreferencesDraft.defaultPracticeView}
                                  onChange={(event) => setPrivacyPreferencesDraft((current) => ({ ...current, defaultPracticeView: event.target.value as 'card' | 'list' }))}
                                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-indigo-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                               >
                                  <option value="card">Cartao</option>
                                  <option value="list">Lista</option>
                               </select>
                            </label>
                            <label className="space-y-2">
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Simulado por padrao</span>
                               <select
                                  value={privacyPreferencesDraft.defaultSimulationView}
                                  onChange={(event) => setPrivacyPreferencesDraft((current) => ({ ...current, defaultSimulationView: event.target.value as 'focus' | 'list' }))}
                                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-indigo-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                               >
                                  <option value="list">Lista</option>
                                  <option value="focus">Foco</option>
                               </select>
                            </label>
                         </div>
                      </div>

                      {/* Zona de Perigo */}
                      <div className="bg-rose-50/50 dark:bg-rose-950/10 p-8 rounded-2xl border border-rose-100 dark:border-rose-900/30 transition-colors">
                          <h3 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2">Excluir Conta</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">Esta acao registra uma solicitacao real de exclusao, marca sua conta para tratamento interno e desconecta a sessao.</p>
                          <div className="space-y-4">
                            <textarea
                              value={accountDeletionReason}
                              onChange={(event) => setAccountDeletionReason(event.target.value)}
                              rows={3}
                              placeholder="Explique rapidamente por que deseja excluir sua conta."
                              className="w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 dark:border-rose-900/40 dark:bg-slate-900 dark:text-slate-100"
                            />
                            {recaptchaEnabled ? (
                              <div className="rounded-2xl border border-rose-100 bg-white px-4 py-4 dark:border-rose-900/40 dark:bg-slate-900">
                                <div className="flex items-center gap-3 rounded-xl bg-rose-50/60 px-3 py-3 dark:bg-rose-950/20">
                                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                    profileRecaptchaLoadError
                                      ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
                                      : isProfileSecurityCheckLoading
                                        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300'
                                        : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  }`}>
                                    {profileRecaptchaLoadError ? <AlertTriangle size={17} /> : isProfileSecurityCheckLoading ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
                                  </span>
                                  <p className="text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-300">
                                    {profileRecaptchaLoadError
                                      ? profileRecaptchaLoadError
                                      : isProfileSecurityCheckLoading
                                        ? 'Preparando a verificação invisível para liberar a solicitação.'
                                        : 'Verificação invisível pronta. A segurança será validada automaticamente no envio.'}
                                  </p>
                                </div>
                              </div>
                            ) : null}
                          </div>
                          <button
                            onClick={handleRequestAccountDeletion}
                            disabled={isRequestingAccountDeletion || isProfileSecurityCheckLoading}
                            className="mt-4 text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-2 hover:bg-rose-600 hover:text-white px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                          >
                              {isRequestingAccountDeletion || isProfileSecurityCheckLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                              {isProfileSecurityCheckLoading ? 'Carregando segurança...' : 'Solicitar Exclusão'}
                          </button>
                      </div>
                  </div>
               )}

            </main>
         </div>

         {/* Modal de Seleção de Meta */}
         {showGoalModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in transition-all">
               <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in slide-in-from-bottom-4 duration-300">
                  <header className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                     <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Escolha seu foco</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Selecione a área para a qual você está estudando.</p>
                     </div>
                     <button onClick={() => setShowGoalModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400"><X size={20} /></button>
                  </header>

                  <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar space-y-8">
                     {EXAM_AREAS.map(group => (
                        <div key={group.group} className="space-y-3">
                           <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{group.group}</h4>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
{group.areas.map(area => (
                                 <button
                                    key={area}
                                    onClick={() => {
                                       updateUser({ targetExam: area });
                                       setShowGoalModal(false);
                                    }}
                                     className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all group ${currentUser.targetExam === area ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-600' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                                 >
                                    <span className={`text-sm font-bold ${currentUser.targetExam === area ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>{area}</span>
                                       {currentUser.targetExam === area ? (
                                       <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center"><ChevronRight size={12} className="text-white" /></div>
                                    ) : (
                                       <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ChevronRight size={12} className="text-slate-400" /></div>
                                    )}
                                 </button>
                              ))}
                           </div>
                        </div>
                     ))}
                  </div>

                  <footer className="p-6 bg-slate-50 dark:bg-slate-800/30 text-center">
                     <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">ISSO AJUDARÁ A PERSONALIZAR SUAS RECOMENDAÇÕES E RANKINGS.</p>
                  </footer>
               </div>
            </div>
         )}

         {renderProfilePhotoCropModal()}
         {renderCancelSubscriptionModal()}
         {renderTestimonialModal()}
      </div>
   );
};

export default Profile;

