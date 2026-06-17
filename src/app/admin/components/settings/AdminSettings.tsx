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

import Image from 'next/image';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell, BookOpen, CalendarDays, Clock, Copy, Cpu, Database, FileText, Flag, Globe, LayoutDashboard, Loader2,
  CheckCircle2, Layers, Lock, Mail, Megaphone, MessageSquare, RefreshCcw, Repeat, Save, Settings, ShieldAlert, ShieldCheck,
  ShoppingBag, ShoppingCart, Sparkles, Terminal, Trash2, Trophy, Upload, Users, XCircle, Zap,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import type { AdminSecurityIpsPayload, AdminSettingsTestResult } from '@services/admin/adminService';
import type { EmailTemplateModel, PlanBenefitKey, PlanUsageLimitKey, SeoSettings, SystemSettings } from '@types';
import apiClient from '@services/api/client';
import { readApiErrorMessage } from '@services/api';
import { adminService } from '@services/admin/adminService';
import { parseDailyMotivationMarkdown } from '@services/dashboard/dashboardInsightsService';
import { normalizeEmailTemplates } from '@constants/email/defaultEmailTemplates';
import { DEFAULT_SYSTEM_SETTINGS } from '@/state/app-config/systemSettings';
import {
  normalizeGamificationSettings,
  normalizeNotificationSettings,
} from '@constants/gamificationNotificationSettings';
import AdminSettingsTabsBar from './AdminSettingsTabsBar';
import { LogViewer } from './LogViewer';
import AdminCacheManagement from './AdminCacheManagement';
import AdminSeoSettingsSection from './AdminSeoSettingsSection';
import AdminEmailTemplatesSection from './AdminEmailTemplatesSection';
import AdminGamificationSettingsSection from './AdminGamificationSettingsSection';
import AdminNotificationSettingsSection from './AdminNotificationSettingsSection';
import StripePaymentMethodsSettings from './StripePaymentMethodsSettings';
import { mergeSeoSettings } from './seoSettings';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_TAB_BUTTON_ACTIVE_CLASS,
  ADMIN_TAB_BUTTON_IDLE_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';
import {
  PLAN_BENEFIT_DEFINITIONS,
  PLAN_USAGE_LIMIT_DEFINITIONS,
  DEFAULT_PLAN_USAGE_LIMITS,
  PLAN_ORDER,
  normalizePlanEntitlements,
  normalizePlanUsageLimits,
} from '@constants/subscriptions/planEntitlements';

type AdminToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
type AdminSettingsTab = 'general' | 'modules' | 'gamification' | 'notifications' | 'security' | 'integrations' | 'email' | 'email-templates' | 'ads' | 'seo' | 'performance' | 'logs';
type AdminSettingsTabs = React.ComponentProps<typeof AdminSettingsTabsBar>['tabs'];

interface AdminIntegrationCheck {
  label: string;
  status: string;
  detail: string;
}

interface AdminIntegrationChecksPayload {
  checks?: Record<string, AdminIntegrationCheck>;
  critical_count?: number | string;
  warning_count?: number | string;
}

type AdminIntegrationsTestResult = Omit<AdminSettingsTestResult, 'data'> & {
  data?: AdminIntegrationChecksPayload;
};

interface AdminSettingsProps {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => void;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
  addToast: AdminToastFn;
  initialSection?: AdminSettingsTab;
  onSectionChange?: (section: AdminSettingsTab) => void;
  standaloneSection?: boolean;
}

const inputClassName = `w-full ${ADMIN_FIELD_CLASS}`;
const labelClassName = 'ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500';
const RESET_TABLE_EXCLUSIONS = new Set(['settings', 'system_settings']);
const DEFAULT_LIMITED_OFFER_EXTENSION_MS = 7 * 24 * 60 * 60 * 1000;
const AD_PLAN_BENEFIT_KEYS: PlanBenefitKey[] = [
  'ads.adsense_banner',
  'ads.facebook_banner',
  'ads.between_questions',
  'ads.in_comments',
  'ads.web_interstitial',
  'ads.navigation_pop',
  'ads.internal_sponsorships',
  'ads.reduced',
  'no_ads',
];
const AD_PLAN_LIMIT_KEYS: PlanUsageLimitKey[] = [
  'ad_interstitial_answer_interval',
];

const resolveFutureLimitedOfferEndsAt = (value?: string | null) => {
  const timestamp = new Date(value || '').getTime();
  if (!value || Number.isNaN(timestamp) || timestamp <= Date.now()) {
    return new Date(Date.now() + DEFAULT_LIMITED_OFFER_EXTENSION_MS).toISOString();
  }

  return value;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const apiMessage = readApiErrorMessage(error, '');
  if (apiMessage.trim()) {
    return apiMessage;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
};

const featureItems = [
  { id: 'practiceEnabled', label: 'Pratica', icon: BookOpen },
  { id: 'simulationsEnabled', label: 'Simulados', icon: Clock },
  { id: 'studyScheduleEnabled', label: 'Cronograma', icon: CalendarDays },
  { id: 'marketplaceEnabled', label: 'Marketplace', icon: ShoppingCart },
  { id: 'rankingsEnabled', label: 'Rankings', icon: Trophy },
  { id: 'referralEnabled', label: 'Indique e ganhe', icon: Users },
  { id: 'xRayEnabled', label: 'Raio-X', icon: Zap },
  { id: 'landingPagePromoEnabled', label: 'Promo na home', icon: Megaphone },
  { id: 'communityEnabled', label: 'Comunidade', icon: MessageSquare },
  { id: 'aiCommentsEnabled', label: 'Comentarios com IA', icon: Sparkles },
  { id: 'bulkImportEnabled', label: 'Importador', icon: Upload },
  { id: 'reportsEnabled', label: 'Denúncias', icon: Flag },
  { id: 'notificationsEnabled', label: 'Notificacoes', icon: Bell },
  { id: 'maintenanceMode', label: 'Manutencao', icon: ShieldAlert },
  { id: 'registrationEnabled', label: 'Novos cadastros', icon: Users },
  { id: 'loginRequired', label: 'Login obrigatorio', icon: Lock },
  { id: 'partnerRegistrationEnabled', label: 'Cadastro parceiro', icon: ShoppingBag },
  { id: 'recurringEnabled', label: 'Recorrencia', icon: Repeat },
  { id: 'sameTierCycleChangeEnabled', label: 'Troca de ciclo no mesmo tier', icon: RefreshCcw },
  { id: 'autoRefundEnabled', label: 'Auto refund', icon: RefreshCcw },
];

featureItems.splice(1, 0,
  { id: 'annotatedLawsEnabled', label: 'Lei comentada', icon: FileText },
  { id: 'flashcardsEnabled', label: 'Flashcards', icon: Layers },
);

const FEATURE_FLAG_KEYS = featureItems.map((feature) => feature.id);

const stripFeatureFlagAliases = (settings: SystemSettings): SystemSettings => {
  const nextSettings = { ...settings } as SystemSettings & Record<string, unknown>;

  FEATURE_FLAG_KEYS.forEach((featureKey) => {
    delete nextSettings[featureKey];
  });

  return nextSettings as SystemSettings;
};

const ADMIN_SECRET_SETTING_KEYS = [
  'smtpPass',
  'geminiApiKey',
  'openaiApiKey',
  'recaptchaSecretKey',
  'facebookAuthAppSecret',
  'stripeSecretKey',
  'stripeWebhookSecret',
] as const;

const isMaskedAdminSecretValue = (value: unknown): boolean => {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return true;
  }

  return /^[*•·xX_-]{6,}$/.test(rawValue)
    || /^_+hidden_+$/i.test(rawValue)
    || /^__masked__/i.test(rawValue)
    || /^digite uma nova/i.test(rawValue);
};

const stripEmptyAdminSecrets = (settings: SystemSettings & Record<string, unknown>) => {
  ADMIN_SECRET_SETTING_KEYS.forEach((key) => {
    if (isMaskedAdminSecretValue(settings[key])) {
      delete settings[key];
    }
  });
};

const AdminSettings = ({
  systemSettings,
  saveSystemSettingsNow,
  addToast,
  initialSection = 'general',
  onSectionChange,
  standaloneSection = false,
}: AdminSettingsProps) => {
  const { currentUser, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminSettingsTab>(initialSection);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<SystemSettings>(systemSettings);
  const [localSeoSettings, setLocalSeoSettings] = useState<SeoSettings>(() => mergeSeoSettings(systemSettings.seo));
  const [twoFactorStep, setTwoFactorStep] = useState<'status' | 'setup' | 'verify'>('status');
  const [twoFactorData, setTwoFactorData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [resetPassword, setResetPassword] = useState('');
  const [reset2FACode, setReset2FACode] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTestingIntegrations, setIsTestingIntegrations] = useState(false);
  const [integrationsTestResult, setIntegrationsTestResult] = useState<AdminIntegrationsTestResult | null>(null);
  const [securityIpsLoading, setSecurityIpsLoading] = useState(false);
  const [securityIpsPayload, setSecurityIpsPayload] = useState<AdminSecurityIpsPayload>({
    suspicious: [],
    banned: [],
    stats: {
      suspiciousCount: 0,
      bannedCount: 0,
    },
  });
  const [securityIpsSearch, setSecurityIpsSearch] = useState('');
  const [securityIpActionLoading, setSecurityIpActionLoading] = useState<string | null>(null);
  const [manualBanIp, setManualBanIp] = useState('');
  const [manualBanReason, setManualBanReason] = useState('');

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setLocalSettings(systemSettings);
      setLocalSeoSettings(mergeSeoSettings(systemSettings.seo));
    });

    return () => cancelAnimationFrame(frame);
  }, [systemSettings]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setActiveTab(initialSection);
    });

    return () => cancelAnimationFrame(frame);
  }, [initialSection]);

  useEffect(() => {
    if (!isResetModalOpen) return;
    adminService.listResettableTables().then((tables) => {
      const resettableTables = tables
        .filter((table) => !RESET_TABLE_EXCLUSIONS.has(String(table).trim().toLowerCase()))
        .sort((left, right) => left.localeCompare(right, 'pt-BR'));

      setDbTables(resettableTables);
      setSelectedTables(new Set(resettableTables));
    }).catch(() => addToast('Não foi possível carregar as tabelas do reset.', 'error'));
  }, [isResetModalOpen, addToast]);

  const changeSection = (section: AdminSettingsTab) => {
    setActiveTab(section);
    onSectionChange?.(section);
  };

  const setField = <K extends keyof SystemSettings>(field: K, value: SystemSettings[K]) => {
    setLocalSettings((current) => ({ ...current, [field]: value }));
  };

  const toggleAdPlanEntitlement = (planName: (typeof PLAN_ORDER)[number], benefitKey: PlanBenefitKey) => {
    setLocalSettings((current) => {
      const resolvedEntitlements = normalizePlanEntitlements(current.planEntitlements || DEFAULT_SYSTEM_SETTINGS.planEntitlements);

      return {
        ...current,
        planEntitlements: {
          ...resolvedEntitlements,
          [planName]: {
            ...resolvedEntitlements[planName],
            [benefitKey]: {
              enabled: !resolvedEntitlements[planName][benefitKey].enabled,
            },
          },
        },
      };
    });
  };

  const setAdPlanUsageLimitMode = (
    planName: (typeof PLAN_ORDER)[number],
    limitKey: PlanUsageLimitKey,
    mode: 'limited' | 'unlimited',
  ) => {
    setLocalSettings((current) => {
      const resolvedLimits = normalizePlanUsageLimits(current.planUsageLimits || DEFAULT_PLAN_USAGE_LIMITS);
      const currentLimit = resolvedLimits[planName][limitKey];

      return {
        ...current,
        planUsageLimits: {
          ...resolvedLimits,
          [planName]: {
            ...resolvedLimits[planName],
            [limitKey]: {
              mode,
              value: mode === 'limited' ? Math.max(0, Number(currentLimit.value || 1)) : null,
            },
          },
        },
      };
    });
  };

  const setAdPlanUsageLimitValue = (
    planName: (typeof PLAN_ORDER)[number],
    limitKey: PlanUsageLimitKey,
    value: number,
  ) => {
    setLocalSettings((current) => {
      const resolvedLimits = normalizePlanUsageLimits(current.planUsageLimits || DEFAULT_PLAN_USAGE_LIMITS);

      return {
        ...current,
        planUsageLimits: {
          ...resolvedLimits,
          [planName]: {
            ...resolvedLimits[planName],
            [limitKey]: {
              mode: 'limited',
              value: Math.max(0, Number.isFinite(value) ? value : 0),
            },
          },
        },
      };
    });
  };

  const handleCopyAdsenseMetaTag = async () => {
    const publisherId = String(localSettings.adsenseClientId || '').trim();
    if (!publisherId) {
      addToast('Informe o ID ca-pub antes de copiar a metatag.', 'warning');
      return;
    }

    const metaTag = `<meta name="google-adsense-account" content="${publisherId}">`;

    try {
      await navigator.clipboard.writeText(metaTag);
      addToast('Metatag do AdSense copiada.', 'success');
    } catch {
      addToast('Não foi possível copiar automaticamente. Selecione e copie a metatag.', 'warning');
    }
  };

  const setFeature = (key: string, value: boolean) => {
    setLocalSettings((current) => ({
      ...(current as SystemSettings & Record<string, unknown>),
      [key]: value,
      features: {
        ...(current.features || {}),
        [key]: value,
      },
    }) as SystemSettings);
  };

  const buildSettingsPayload = (): SystemSettings => {
    const resolvedFeatures = {
      ...DEFAULT_SYSTEM_SETTINGS.features,
      ...(systemSettings.features || {}),
      ...(localSettings.features || {}),
    };
    const payload = {
      ...stripFeatureFlagAliases(localSettings),
      paymentProvider: 'stripe',
      cardVaultProvider: 'stripe',
      paymentCheckoutMode: localSettings.paymentCheckoutMode || 'internal',
      stripePaymentMethods: localSettings.stripePaymentMethods,
      siteName: localSettings.siteName || 'ConcursoMestre',
      platformFeePercent: Number(localSettings.platformFeePercent ?? 20),
      smtpPort: Number(localSettings.smtpPort || 587),
      features: resolvedFeatures,
      seo: localSeoSettings,
    } as SystemSettings & Record<string, unknown>;

    stripEmptyAdminSecrets(payload);

    delete payload.hasSmtpPasswordConfigured;
    delete payload.hasGeminiApiKeyConfigured;
    delete payload.hasOpenAiApiKeyConfigured;
    delete payload.hasRecaptchaSecretConfigured;
    delete payload.hasStripeSecretConfigured;
    delete payload.hasStripeWebhookConfigured;

    return payload as SystemSettings;
  };

  const handlePersistSettings = async () => {
    if (isSavingSettings) return;
    const nextSettings = buildSettingsPayload();
    const limitedOfferCountdown = nextSettings.limitedOfferCountdown;
    if (limitedOfferCountdown?.enabled) {
      const resolvedEndsAt = resolveFutureLimitedOfferEndsAt(limitedOfferCountdown.endsAt);
      if (resolvedEndsAt !== limitedOfferCountdown.endsAt) {
        nextSettings.limitedOfferCountdown = {
          ...limitedOfferCountdown,
          endsAt: resolvedEndsAt,
        };
        setLocalSettings((current) => ({
          ...current,
          limitedOfferCountdown: {
            ...(current.limitedOfferCountdown || { enabled: true, endsAt: resolvedEndsAt }),
            enabled: true,
            endsAt: resolvedEndsAt,
          },
        }));
        addToast('A oferta por tempo limitado estava sem data valida. Definimos automaticamente um encerramento futuro de 7 dias.', 'info');
      }
    }

    setIsSavingSettings(true);
    try {
      const persistedSettings = await saveSystemSettingsNow(nextSettings);
      setLocalSettings(persistedSettings);
      setLocalSeoSettings(mergeSeoSettings(persistedSettings.seo));
      addToast('Configurações salvas com sucesso.', 'success');
    } catch (error: unknown) {
      console.error('Erro ao salvar configurações administrativas:', error);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDailyMotivationFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setField('dailyMotivationMarkdown', await file.text());
    addToast('Arquivo de motivacoes carregado.', 'success');
    event.target.value = '';
  };

  const initiate2FASetup = async () => {
    try {
      const setupData = await adminService.setupTwoFactor();
      setTwoFactorData(setupData);
      setTwoFactorStep('setup');
    } catch {
      addToast('Erro ao iniciar setup de 2FA.', 'error');
    }
  };

  const verifyAndEnable2FA = async () => {
    try {
      const message = await adminService.enableTwoFactor(twoFactorData?.secret || '', twoFactorCode);
      addToast(message, 'success');
      setTwoFactorStep('status');
      refreshUser?.();
    } catch {
      addToast('Erro ao validar 2FA.', 'error');
    }
  };

  const handleSystemReset = async () => {
    if (resetConfirmText !== 'RESETAR') {
      setResetError('Digite RESETAR para confirmar.');
      return;
    }
    setIsResetting(true);
    setResetError(null);
    try {
      await adminService.resetDatabase({ password: resetPassword, twoFactorCode: reset2FACode, tables: Array.from(selectedTables) });
      addToast('Sistema resetado com sucesso. Redirecionando...', 'success');
      setTimeout(() => { window.location.href = '/auth'; }, 1500);
    } catch (error: unknown) {
      setResetError(getErrorMessage(error, 'Falha ao resetar o sistema.'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleTestSmtp = async () => {
    if (isTestingSmtp) return;
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const result = await adminService.testSmtpSettings({ ...buildSettingsPayload(), targetEmail: localSettings.mailFromAddress || localSettings.smtpUser });
      setSmtpTestResult({ ok: true, message: result.message });
      addToast(result.message, 'success');
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Não foi possível testar o SMTP.');
      setSmtpTestResult({ ok: false, message });
      addToast(message, 'error');
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleTestIntegrations = async () => {
    if (isTestingIntegrations) return;
    setIsTestingIntegrations(true);
    setIntegrationsTestResult(null);
    try {
      const result = await adminService.testIntegrations(buildSettingsPayload());
      const integrationResult = result as AdminIntegrationsTestResult;
      const checks = Object.values(integrationResult.data?.checks || {});
      const criticalCount = Math.max(0, Number(integrationResult.data?.critical_count ?? checks.filter((check) => check.status === 'critical').length) || 0);
      const warningCount = Math.max(0, Number(integrationResult.data?.warning_count ?? checks.filter((check) => check.status === 'warning').length) || 0);

      setIntegrationsTestResult(integrationResult);

      if (criticalCount > 0) {
        addToast(integrationResult.message || 'Integrações com falhas criticas.', 'error');
      } else if (warningCount > 0) {
        addToast(integrationResult.message || 'Integrações verificadas com avisos.', 'warning');
      } else {
        addToast(integrationResult.message || 'Integrações verificadas com sucesso.', 'success');
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Não foi possível validar as integrações.');
      setIntegrationsTestResult({ message, data: null });
      addToast(message, 'error');
    } finally {
      setIsTestingIntegrations(false);
    }
  };

  const handleTestEmailTemplate = async (template: EmailTemplateModel, targetEmail: string): Promise<string> => {
    const resolvedTargetEmail = targetEmail.trim() || localSettings.mailFromAddress || localSettings.smtpUser || currentUser?.email || '';
    if (!resolvedTargetEmail) {
      throw new Error('Informe um e-mail de teste.');
    }

    try {
      const result = await adminService.testEmailTemplate({
        ...buildSettingsPayload(),
        templateKey: template.key,
        template,
        targetEmail: resolvedTargetEmail,
      });
      addToast(result.message, 'success');
      return result.message;
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Não foi possível testar o modelo de e-mail.');
      addToast(message, 'error');
      throw new Error(message);
    }
  };

  const fetchSecurityIps = React.useCallback(async (searchValue = securityIpsSearch) => {
    setSecurityIpsLoading(true);
    try {
      const payload = await adminService.getSecurityIps(searchValue, 80);
      setSecurityIpsPayload(payload);
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Não foi possível carregar os IPs suspeitos.'), 'error');
    } finally {
      setSecurityIpsLoading(false);
    }
  }, [addToast, securityIpsSearch]);

  useEffect(() => {
    if (activeTab !== 'security') return;
    const timeout = window.setTimeout(() => {
      void fetchSecurityIps();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [activeTab, fetchSecurityIps]);

  const handleBanIp = async (ipAddress: string, reason: string) => {
    if (securityIpActionLoading) return;
    setSecurityIpActionLoading(`ban:${ipAddress}`);
    try {
      await adminService.banSecurityIp(ipAddress, reason);
      addToast('IP bloqueado com sucesso.', 'success');
      if (manualBanIp === ipAddress) {
        setManualBanIp('');
        setManualBanReason('');
      }
      await fetchSecurityIps();
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Não foi possível bloquear o IP.'), 'error');
    } finally {
      setSecurityIpActionLoading(null);
    }
  };

  const handleUnbanIp = async (ipAddress: string) => {
    if (securityIpActionLoading) return;
    setSecurityIpActionLoading(`unban:${ipAddress}`);
    try {
      await adminService.unbanSecurityIp(ipAddress);
      addToast('IP desbloqueado com sucesso.', 'success');
      await fetchSecurityIps();
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Não foi possível desbloquear o IP.'), 'error');
    } finally {
      setSecurityIpActionLoading(null);
    }
  };

  const stripeWebhookUrl = `${String(apiClient.defaults.baseURL || '').replace(/\/+$/, '')}/subscriptions/stripe_webhook.php`;
  const isStripeSecretConfigured = !!(localSettings.hasStripeSecretConfigured || localSettings.stripeSecretKey);
  const isStripeWebhookConfigured = !!(localSettings.hasStripeWebhookConfigured || localSettings.stripeWebhookSecret);
  const isGeminiConfigured = !!(localSettings.hasGeminiApiKeyConfigured || localSettings.geminiApiKey);
  const isOpenAiConfigured = !!(localSettings.hasOpenAiApiKeyConfigured || localSettings.openaiApiKey);
  const isRecaptchaSecretConfigured = !!(localSettings.hasRecaptchaSecretConfigured || localSettings.recaptchaSecretKey);
  const isFacebookAuthConfigured = !!(localSettings.hasFacebookAuthConfigured || (localSettings.facebookAuthAppId && localSettings.facebookAuthAppSecret));
  const isAppleAuthConfigured = !!(localSettings.hasAppleAuthConfigured || localSettings.appleAuthClientId);
  const isSmtpPasswordConfigured = !!(localSettings.hasSmtpPasswordConfigured || localSettings.smtpPass);
  const gamificationSettings = useMemo(
    () => normalizeGamificationSettings(localSettings.gamification),
    [localSettings.gamification],
  );
  const notificationSettings = useMemo(
    () => normalizeNotificationSettings(localSettings.notificationSettings),
    [localSettings.notificationSettings],
  );
  const settingsTabs: AdminSettingsTabs = [
    { id: 'general', label: 'Geral', icon: Settings },
    { id: 'modules', label: 'Modulos', icon: LayoutDashboard },
    { id: 'gamification', label: 'Gamificação', icon: Trophy },
    { id: 'notifications', label: 'Notificacoes', icon: Bell },
    { id: 'security', label: 'Seguranca', icon: ShieldAlert },
    { id: 'integrations', label: 'Integrações', icon: Cpu },
    { id: 'email', label: 'E-mail', icon: Mail },
    { id: 'email-templates', label: 'Modelos de e-mail', icon: MessageSquare },
    { id: 'ads', label: 'Anuncios', icon: Megaphone },
    { id: 'seo', label: 'SEO', icon: Globe },
    { id: 'performance', label: 'Performance', icon: Database },
    { id: 'logs', label: 'Logs', icon: FileText },
  ];
  const integrationChecks = useMemo<[string, AdminIntegrationCheck][]>(() => {
    const statusOrder: Record<string, number> = {
      critical: 0,
      warning: 1,
      ok: 2,
    };

    return Object.entries(integrationsTestResult?.data?.checks || {})
      .sort(([, left], [, right]) => {
        const leftOrder = statusOrder[left.status] ?? 3;
        const rightOrder = statusOrder[right.status] ?? 3;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.label.localeCompare(right.label, 'pt-BR');
      });
  }, [integrationsTestResult]);
  const integrationCriticalCount = integrationsTestResult
    ? Math.max(0, Number(integrationsTestResult.data?.critical_count ?? integrationChecks.filter(([, check]) => check.status === 'critical').length) || 0)
    : 0;
  const integrationWarningCount = integrationsTestResult
    ? Math.max(0, Number(integrationsTestResult.data?.warning_count ?? integrationChecks.filter(([, check]) => check.status === 'warning').length) || 0)
    : 0;
  const hasIntegrationCriticalIssues = integrationCriticalCount > 0;
  const hasIntegrationWarnings = integrationWarningCount > 0;
  const integrationResultToneClassName = hasIntegrationCriticalIssues
    ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/30 dark:bg-rose-900/10 dark:text-rose-200'
    : hasIntegrationWarnings
      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-200'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-200';
  const IntegrationResultIcon = hasIntegrationCriticalIssues ? XCircle : hasIntegrationWarnings ? ShieldAlert : ShieldCheck;
  const adsensePublisherId = String(localSettings.adsenseClientId || '').trim();
  const adsenseMetaTag = adsensePublisherId
    ? `<meta name="google-adsense-account" content="${adsensePublisherId}">`
    : '<meta name="google-adsense-account" content="ca-pub-0000000000000000">';
  const adPlacementCards = [
    {
      key: 'top',
      label: 'Topo',
      description: 'Exibido acima do conteúdo principal e em paginas como dashboard, pratica e layout geral.',
      enabledField: 'adPlacementTopEnabled',
      slotField: 'adsenseTopSlotId',
      htmlField: 'adBannerTop',
      placeholder: 'Slot do banner horizontal',
    },
    {
      key: 'sidebar',
      label: 'Lateral',
      description: 'Exibido em áreas laterais como marketplace e cards de questões quando houver espaco.',
      enabledField: 'adPlacementSidebarEnabled',
      slotField: 'adsenseSidebarSlotId',
      htmlField: 'adBannerSidebar',
      placeholder: 'Slot do retangulo lateral',
    },
    {
      key: 'bottom',
      label: 'Rodape / inline',
      description: 'Exibido após blocos de conteúdo, principalmente em cards e paginas longas.',
      enabledField: 'adPlacementBottomEnabled',
      slotField: 'adsenseBottomSlotId',
      htmlField: 'adBannerBottom',
      placeholder: 'Slot do banner inferior',
    },
  ] as const;
  const enabledAdPlacements = adPlacementCards.filter((placement) => localSettings[placement.enabledField] !== false).length
    + (localSettings.adPlacementInterstitialEnabled !== false ? 1 : 0)
    + (localSettings.adPlacementNavigationPopEnabled === true ? 1 : 0);
  const hasConfiguredAdSource = Boolean(
    localSettings.adsenseTestMode === true
    || adsensePublisherId
    || localSettings.adBannerTop
    || localSettings.adBannerSidebar
    || localSettings.adBannerBottom
    || localSettings.adInterstitialSlotId
    || localSettings.adNavigationPopUrl
  );
  const resolvedAdPlanEntitlements = normalizePlanEntitlements(localSettings.planEntitlements || DEFAULT_SYSTEM_SETTINGS.planEntitlements);
  const resolvedAdPlanUsageLimits = normalizePlanUsageLimits(localSettings.planUsageLimits || DEFAULT_PLAN_USAGE_LIMITS);
  const adPlanLimitDefinitions = PLAN_USAGE_LIMIT_DEFINITIONS.filter((definition) => AD_PLAN_LIMIT_KEYS.includes(definition.key));

  return (
    <div className="space-y-5 md:space-y-6">
      <LogViewer isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} />
      {standaloneSection ? (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => void handlePersistSettings()}
            disabled={isSavingSettings}
            className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-8 py-3 text-xs font-bold uppercase tracking-widest`}
          >
            <Save size={18} />
            {isSavingSettings ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </div>
      ) : (
        <AdminSettingsTabsBar
          tabs={settingsTabs}
          activeTab={activeTab}
          isSaving={isSavingSettings}
          onChange={(section) => changeSection(section as AdminSettingsTab)}
          onSave={() => void handlePersistSettings()}
        />
      )}

      {activeTab === 'general' && (
        <div className="space-y-5">
          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                  <Terminal size={18} className="text-sky-700 dark:text-sky-300" />
                  Ambiente
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Configurações principais da plataforma.</p>
              </div>
              <button type="button" onClick={() => setIsLogViewerOpen(true)} className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}>
                <Terminal size={14} />
                Visualizar logs
              </button>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                <label className={labelClassName}>Nome do site</label>
                <input value={localSettings.siteName || ''} onChange={(e) => setField('siteName', e.target.value)} className={inputClassName} />
              </div>
              <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                <label className={labelClassName}>WhatsApp</label>
                <input value={localSettings.supportPhone || ''} onChange={(e) => setField('supportPhone', e.target.value)} className={inputClassName} />
              </div>
              <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                <label className={labelClassName}>E-mail juridico</label>
                <input type="email" value={localSettings.legalContactEmail || ''} onChange={(e) => setField('legalContactEmail', e.target.value)} className={inputClassName} placeholder="juridico@seudominio.com" />
              </div>
              <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                <label className={labelClassName}>E-mail privacidade/DPO</label>
                <input type="email" value={localSettings.privacyContactEmail || ''} onChange={(e) => setField('privacyContactEmail', e.target.value)} className={inputClassName} placeholder="dpo@seudominio.com" />
              </div>
              <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                <label className={labelClassName}>Taxa da plataforma (%)</label>
                <input type="number" value={String(localSettings.platformFeePercent ?? 20)} onChange={(e) => setField('platformFeePercent', Number(e.target.value))} className={inputClassName} />
              </div>
              <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                <label className={labelClassName}>PIX global</label>
                <input value={localSettings.pixKey || ''} onChange={(e) => setField('pixKey', e.target.value)} className={inputClassName} />
              </div>
              <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                <label className={labelClassName}>Modo</label>
                <select value={localSettings.appMode || 'development'} onChange={(e) => setField('appMode', e.target.value as 'development' | 'production')} className={inputClassName}>
                  <option value="development">development</option>
                  <option value="production">production</option>
                </select>
              </div>
            </div>
          </div>

          <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                  <Sparkles size={18} className="text-sky-700 dark:text-sky-300" />
                  Motivação diaria
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Arquivo Markdown usado nos cards motivacionais.</p>
              </div>
              <label className={`${ADMIN_SECONDARY_BUTTON_CLASS} inline-flex cursor-pointer px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}>
                <Upload size={14} />
                Carregar .md
                <input type="file" accept=".md,text/markdown,text/plain" className="hidden" onChange={handleDailyMotivationFileUpload} />
              </label>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className={labelClassName}>Conteúdo</label>
                <textarea value={localSettings.dailyMotivationMarkdown || ''} onChange={(e) => setField('dailyMotivationMarkdown', e.target.value)} className={`${ADMIN_TEXTAREA_CLASS} min-h-[220px] resize-y font-mono text-xs`} />
              </div>
              <div className="grid gap-2 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                <span className={labelClassName}>Frases validas</span>
                <div className={`inline-flex w-fit items-center gap-3 px-4 py-3 ${ADMIN_MUTED_SURFACE_CLASS}`}>
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{parseDailyMotivationMarkdown(localSettings.dailyMotivationMarkdown || '').length}</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">itens</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'modules' && <div className="grid gap-4 md:grid-cols-2">{featureItems.map((feature) => <button key={feature.id} type="button" onClick={() => setFeature(feature.id, !localSettings.features?.[feature.id])} className={`${ADMIN_PAGE_PANEL_CLASS} flex items-center justify-between p-5 text-left`}><div className="flex items-center gap-3"><feature.icon size={18} className="text-sky-700 dark:text-sky-300" /><div><p className="text-sm font-black text-slate-900 dark:text-slate-100">{feature.label}</p><p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{feature.id}</p></div></div><div className={`rounded-sm px-3 py-1 text-[10px] font-black uppercase ${localSettings.features?.[feature.id] ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{localSettings.features?.[feature.id] ? 'Ativo' : 'Inativo'}</div></button>)}</div>}

      {activeTab === 'gamification' && (
        <AdminGamificationSettingsSection
          settings={gamificationSettings}
          onChange={(nextSettings) => setField('gamification', nextSettings)}
        />
      )}

      {activeTab === 'notifications' && (
        <AdminNotificationSettingsSection
          settings={notificationSettings}
          onChange={(nextSettings) => {
            setField('notificationSettings', nextSettings);
            setFeature('notificationsEnabled', nextSettings.enabled);
          }}
        />
      )}

      {activeTab === 'security' && (
        <div className="grid gap-5 md:gap-6 lg:grid-cols-2">
          <div className={ADMIN_PAGE_PANEL_CLASS}>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><ShieldCheck size={20} className="text-sky-700 dark:text-sky-300" /> 2FA</h3>
            <p className="mb-4 text-xs font-medium text-slate-500 dark:text-slate-400">Status atual: {currentUser?.twoFactorEnabled ? 'ativo' : 'inativo'}.</p>
            {twoFactorStep === 'status' && !currentUser?.twoFactorEnabled && <button type="button" onClick={initiate2FASetup} className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-6 py-2 text-[10px] uppercase tracking-[0.18em]`}>Configurar 2FA</button>}
            {twoFactorStep === 'setup' && twoFactorData && <div className="space-y-4"><Image src={twoFactorData.qrCodeUrl} alt="QR 2FA" width={160} height={160} unoptimized className="h-40 w-40 rounded-sm border border-slate-300 bg-white p-3" /><code className="block rounded-sm bg-slate-100 px-4 py-3 text-sm font-black dark:bg-slate-950 dark:text-slate-100">{twoFactorData.secret}</code><button type="button" onClick={() => setTwoFactorStep('verify')} className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-6 py-2 text-[10px] uppercase tracking-[0.18em] dark:bg-sky-700 dark:text-white dark:hover:bg-sky-800`}>Ja escaneei</button></div>}
            {twoFactorStep === 'verify' && <div className="space-y-4"><input type="text" maxLength={6} value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="000000" className={`${inputClassName} text-center text-2xl font-black tracking-widest`} /><button type="button" onClick={verifyAndEnable2FA} className="rounded-sm border border-emerald-700 bg-emerald-700 px-6 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white">Ativar 2FA</button></div>}
          </div>
          <div className="rounded-sm border border-rose-200 bg-rose-50 p-4 sm:p-5 md:p-6 dark:border-rose-900/30 dark:bg-rose-900/10">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-rose-700 dark:text-rose-300"><Trash2 size={20} /> Reset geral</h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Apaga conteúdo operacional com autenticação forte.</p>
            <button type="button" onClick={() => setIsResetModalOpen(true)} className="mt-5 rounded-sm border border-rose-700 bg-rose-700 px-6 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white">Resetar conteúdo</button>
          </div>
          <div className={`${ADMIN_PAGE_PANEL_CLASS} lg:col-span-2`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">IPs suspeitos e bloqueados</h3>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Suspeitos: {securityIpsPayload.stats.suspiciousCount} | Bloqueados: {securityIpsPayload.stats.bannedCount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchSecurityIps()}
                disabled={securityIpsLoading}
                className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}
              >
                {securityIpsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                Atualizar
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <label className={labelClassName}>Buscar IP</label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={securityIpsSearch}
                    onChange={(event) => setSecurityIpsSearch(event.target.value)}
                    className={inputClassName}
                    placeholder="Ex: 177.12.0.1"
                  />
                  <button
                    type="button"
                    className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] uppercase tracking-[0.18em]`}
                    onClick={() => void fetchSecurityIps(securityIpsSearch)}
                  >
                    Filtrar
                  </button>
                </div>
              </div>

              <div className="rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <label className={labelClassName}>Bloqueio manual</label>
                <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]">
                  <input
                    value={manualBanIp}
                    onChange={(event) => setManualBanIp(event.target.value)}
                    className={inputClassName}
                    placeholder="IP"
                  />
                  <input
                    value={manualBanReason}
                    onChange={(event) => setManualBanReason(event.target.value)}
                    className={inputClassName}
                    placeholder="Motivo do bloqueio"
                  />
                  <button
                    type="button"
                    disabled={!manualBanIp.trim() || !manualBanReason.trim() || !!securityIpActionLoading}
                    onClick={() => void handleBanIp(manualBanIp.trim(), manualBanReason.trim())}
                    className="rounded-sm border border-rose-600 bg-rose-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Bloquear
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Lista suspeita</p>
                </div>
                <div className="max-h-80 overflow-auto">
                  {securityIpsPayload.suspicious.length === 0 ? (
                    <p className="px-3 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">Nenhum IP suspeito no recorte atual.</p>
                  ) : (
                    <table className="min-w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950">
                        <tr>
                          <th className="px-3 py-2 font-black uppercase tracking-[0.16em] text-slate-500">IP</th>
                          <th className="px-3 py-2 font-black uppercase tracking-[0.16em] text-slate-500">Score</th>
                          <th className="px-3 py-2 font-black uppercase tracking-[0.16em] text-slate-500">Sinais</th>
                          <th className="px-3 py-2 text-right font-black uppercase tracking-[0.16em] text-slate-500">Acao</th>
                        </tr>
                      </thead>
                      <tbody>
                        {securityIpsPayload.suspicious.map((item) => (
                          <tr key={`suspicious-${item.ipAddress}`} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2 align-top">
                              <p className="font-black text-slate-900 dark:text-slate-100">{item.ipAddress}</p>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                Sessões: {item.sessionsCount} | Usuários: {item.usersCount}
                              </p>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <span className={`inline-flex rounded-sm px-2 py-1 text-[10px] font-black ${item.score >= 40 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : item.score >= 20 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'}`}>
                                {item.score}
                              </span>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="flex flex-wrap gap-1">
                                {(item.signals || []).slice(0, 3).map((signal) => (
                                  <span key={`${item.ipAddress}-${signal.key}`} className="rounded-sm border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                    {signal.label} ({signal.count})
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top text-right">
                              {item.isBanned ? (
                                <button
                                  type="button"
                                  onClick={() => void handleUnbanIp(item.ipAddress)}
                                  disabled={securityIpActionLoading === `unban:${item.ipAddress}`}
                                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] uppercase tracking-[0.18em]`}
                                >
                                  {securityIpActionLoading === `unban:${item.ipAddress}` ? <Loader2 size={12} className="animate-spin" /> : null}
                                  Desbloquear
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleBanIp(item.ipAddress, `Bloqueio manual pelo admin após alerta de seguranca (score ${item.score}).`)}
                                  disabled={securityIpActionLoading === `ban:${item.ipAddress}`}
                                  className="rounded-sm border border-rose-600 bg-rose-600 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {securityIpActionLoading === `ban:${item.ipAddress}` ? <Loader2 size={12} className="animate-spin" /> : null}
                                  Bloquear
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">IPs bloqueados</p>
                </div>
                <div className="max-h-80 overflow-auto">
                  {securityIpsPayload.banned.length === 0 ? (
                    <p className="px-3 py-4 text-xs font-medium text-slate-500 dark:text-slate-400">Nenhum IP bloqueado no momento.</p>
                  ) : (
                    <table className="min-w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950">
                        <tr>
                          <th className="px-3 py-2 font-black uppercase tracking-[0.16em] text-slate-500">IP</th>
                          <th className="px-3 py-2 font-black uppercase tracking-[0.16em] text-slate-500">Motivo</th>
                          <th className="px-3 py-2 text-right font-black uppercase tracking-[0.16em] text-slate-500">Acao</th>
                        </tr>
                      </thead>
                      <tbody>
                        {securityIpsPayload.banned.map((item) => (
                          <tr key={`banned-${item.ipAddress}`} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2 align-top">
                              <p className="font-black text-slate-900 dark:text-slate-100">{item.ipAddress}</p>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Bloqueios: {item.blockedHits}</p>
                            </td>
                            <td className="px-3 py-2 align-top text-slate-600 dark:text-slate-300">{item.reason || '-'}</td>
                            <td className="px-3 py-2 align-top text-right">
                              <button
                                type="button"
                                onClick={() => void handleUnbanIp(item.ipAddress)}
                                disabled={securityIpActionLoading === `unban:${item.ipAddress}`}
                                className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-3 py-2 text-[10px] uppercase tracking-[0.18em]`}
                              >
                                {securityIpActionLoading === `unban:${item.ipAddress}` ? <Loader2 size={12} className="animate-spin" /> : null}
                                Desbloquear
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
          {isResetModalOpen && createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md"><div className="w-full max-w-2xl rounded-2xl border border-rose-100 bg-white p-8 shadow-2xl dark:border-rose-900/30 dark:bg-slate-900"><h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Confirmação de reset</h3>{resetError && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-900/30 dark:bg-rose-900/20"><XCircle size={18} className="mt-0.5 text-rose-600" /><p className="text-xs font-bold text-rose-800 dark:text-rose-300">{resetError}</p></div>}<div className="mt-6 space-y-4"><div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">{dbTables.map((table) => <label key={table} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300"><input type="checkbox" checked={selectedTables.has(table)} onChange={() => setSelectedTables((current) => { const next = new Set(current); if (next.has(table)) { next.delete(table); } else { next.add(table); } return next; })} /><span className="font-mono">{table}</span></label>)}</div><div className="grid gap-4 md:grid-cols-2"><input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Senha do admin" className={inputClassName} /><input type="text" value={reset2FACode} onChange={(e) => setReset2FACode(e.target.value)} placeholder="Codigo 2FA" className={inputClassName} /></div><input type="text" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} placeholder="Digite RESETAR" className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 outline-none dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300" /></div><div className="mt-8 flex gap-3"><button type="button" onClick={() => { setIsResetModalOpen(false); setResetError(null); }} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400">Cancelar</button><button type="button" onClick={handleSystemReset} disabled={isResetting || resetConfirmText !== 'RESETAR'} className={`flex-[2] rounded-2xl py-4 text-[10px] font-black uppercase tracking-[0.18em] text-white ${resetConfirmText === 'RESETAR' ? 'bg-rose-600' : 'bg-slate-300'}`}>{isResetting ? <Loader2 size={14} className="mx-auto animate-spin" /> : 'Executar reset'}</button></div></div></div>, document.body)}
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className={`space-y-6 ${ADMIN_PAGE_PANEL_CLASS}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><Cpu size={20} className="text-sky-700 dark:text-sky-300" /> Integrações</h3>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Diagnostico oficial do backend.</p>
            </div>
            <button type="button" onClick={() => void handleTestIntegrations()} disabled={isTestingIntegrations} className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}>{isTestingIntegrations ? 'Testando...' : 'Testar integrações'}</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <select value={localSettings.paymentCheckoutMode || 'internal'} onChange={(e) => setField('paymentCheckoutMode', e.target.value as 'internal' | 'redirect')} className={inputClassName}><option value="internal">Checkout interno</option><option value="redirect">Checkout externo</option></select>
            <label className={`flex items-center justify-between px-4 py-3 ${ADMIN_MUTED_SURFACE_CLASS}`}><span className="text-sm font-semibold text-slate-900 dark:text-slate-100">reCAPTCHA v3 ativo</span><input type="checkbox" checked={!!localSettings.recaptchaEnabled} onChange={(e) => setField('recaptchaEnabled', e.target.checked)} className="h-4 w-4 rounded-sm border-slate-300 text-sky-700" /></label>
            <input value={localSettings.stripePublishableKey || localSettings.stripeKey || ''} onChange={(e) => setField('stripePublishableKey', e.target.value)} className={inputClassName} placeholder="Stripe publishable key" />
            <div className="space-y-2"><div className="flex items-center justify-between"><span className={labelClassName}>Stripe secret key</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isStripeSecretConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isStripeSecretConfigured ? 'Configurada' : 'Ausente'}</span></div><input type="password" value={localSettings.stripeSecretKey || ''} onChange={(e) => setField('stripeSecretKey', e.target.value)} className={inputClassName} placeholder={isStripeSecretConfigured ? 'Digite uma nova chave para substituir a atual' : 'Stripe secret key'} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><span className={labelClassName}>Stripe webhook secret</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isStripeWebhookConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isStripeWebhookConfigured ? 'Configurado' : 'Ausente'}</span></div><input type="password" value={localSettings.stripeWebhookSecret || ''} onChange={(e) => setField('stripeWebhookSecret', e.target.value)} className={inputClassName} placeholder={isStripeWebhookConfigured ? 'Digite um novo segredo para substituir o atual' : 'Stripe webhook secret'} /></div>
            <div className="space-y-2 md:col-span-2"><div className="flex items-center justify-between"><span className={labelClassName}>Google OAuth Client ID</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${localSettings.hasGoogleAuthClientConfigured || localSettings.googleAuthClientId ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{localSettings.hasGoogleAuthClientConfigured || localSettings.googleAuthClientId ? 'Configurado' : 'Ausente'}</span></div><input value={localSettings.googleAuthClientId || ''} onChange={(e) => setField('googleAuthClientId', e.target.value)} className={inputClassName} placeholder="000000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com" /><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Use o Client ID do aplicativo Web do Google Cloud. Origens autorizadas: http://localhost:3000 e o domínio de produção.</p></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><span className={labelClassName}>Facebook App ID</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isFacebookAuthConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isFacebookAuthConfigured ? 'Configurado' : 'Ausente'}</span></div><input value={localSettings.facebookAuthAppId || ''} onChange={(e) => setField('facebookAuthAppId', e.target.value)} className={inputClassName} placeholder="Facebook App ID" /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><span className={labelClassName}>Facebook App Secret</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isFacebookAuthConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isFacebookAuthConfigured ? 'Configurado' : 'Ausente'}</span></div><input type="password" value={localSettings.facebookAuthAppSecret || ''} onChange={(e) => setField('facebookAuthAppSecret', e.target.value)} className={inputClassName} placeholder={isFacebookAuthConfigured ? 'Digite um novo segredo para substituir o atual' : 'Facebook App Secret'} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><span className={labelClassName}>Apple Client ID</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isAppleAuthConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isAppleAuthConfigured ? 'Configurado' : 'Ausente'}</span></div><input value={localSettings.appleAuthClientId || ''} onChange={(e) => setField('appleAuthClientId', e.target.value)} className={inputClassName} placeholder="com.concursomestre.web" /></div>
            <div className="space-y-2"><input value={localSettings.appleAuthRedirectUri || ''} onChange={(e) => setField('appleAuthRedirectUri', e.target.value)} className={inputClassName} placeholder="Apple Redirect URI (opcional)" /><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Se vazio, o login usa automaticamente a origem atual + /auth.</p></div>
            <input value={localSettings.googleAnalyticsId || ''} onChange={(e) => setField('googleAnalyticsId', e.target.value)} className={inputClassName} placeholder="Google Analytics ID" />
            <input value={localSettings.metaPixelId || ''} onChange={(e) => setField('metaPixelId', e.target.value)} className={inputClassName} placeholder="Meta Pixel ID" />
            <div className="space-y-2 md:col-span-2"><span className={labelClassName}>Provedor padrao de IA</span><select value={localSettings.aiProvider || 'gemini'} onChange={(e) => setField('aiProvider', e.target.value)} className={inputClassName}><option value="gemini">Gemini</option><option value="openai">OpenAI / ChatGPT</option><option value="auto">Automatico: OpenAI se configurado, senao Gemini</option></select><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Todas as geracoes passam pelo backend. O frontend nunca recebe a chave do provedor.</p></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><span className={labelClassName}>Gemini API key</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isGeminiConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isGeminiConfigured ? 'Configurada' : 'Ausente'}</span></div><input type="password" value={localSettings.geminiApiKey || ''} onChange={(e) => setField('geminiApiKey', e.target.value)} className={inputClassName} placeholder={isGeminiConfigured ? 'Digite uma nova chave para substituir a atual' : 'Gemini API key'} />{localSettings.hasGeminiApiKeyConfigured && !localSettings.geminiApiKey && <p className="text-xs font-medium text-slate-500 dark:text-slate-400">A chave atual fica oculta no frontend.</p>}</div>
            <div className="space-y-2"><div className="flex items-center justify-between"><span className={labelClassName}>OpenAI API key</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isOpenAiConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isOpenAiConfigured ? 'Configurada' : 'Ausente'}</span></div><input type="password" value={localSettings.openaiApiKey || ''} onChange={(e) => setField('openaiApiKey', e.target.value)} className={inputClassName} placeholder={isOpenAiConfigured ? 'Digite uma nova chave para substituir a atual' : 'OpenAI API key'} />{localSettings.hasOpenAiApiKeyConfigured && !localSettings.openaiApiKey && <p className="text-xs font-medium text-slate-500 dark:text-slate-400">A chave atual fica oculta no frontend.</p>}</div>
            <div className="space-y-2 md:col-span-2"><span className={labelClassName}>Modelo OpenAI</span><input value={localSettings.openAiModel || 'gpt-4o-mini'} onChange={(e) => setField('openAiModel', e.target.value)} className={inputClassName} placeholder="gpt-4o-mini" /><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Usado quando o provedor escolhido for OpenAI/ChatGPT. Chamadas antigas que enviam modelo Gemini usam este valor automaticamente.</p></div>
            <div className="space-y-2"><input value={localSettings.recaptchaSiteKey || ''} onChange={(e) => setField('recaptchaSiteKey', e.target.value)} className={inputClassName} placeholder="reCAPTCHA v3 site key" /><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Use chaves do reCAPTCHA v3. O token agora e gerado automaticamente no envio de login, cadastro e reset.</p></div>
            <div className="space-y-2 md:col-span-2"><div className="flex items-center justify-between"><span className={labelClassName}>reCAPTCHA v3 secret key</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isRecaptchaSecretConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isRecaptchaSecretConfigured ? 'Configurada' : 'Ausente'}</span></div><input type="password" value={localSettings.recaptchaSecretKey || ''} onChange={(e) => setField('recaptchaSecretKey', e.target.value)} className={inputClassName} placeholder={isRecaptchaSecretConfigured ? 'Digite um novo segredo para substituir o atual' : 'reCAPTCHA v3 secret key'} /></div>
          </div>
          <div className="rounded-sm border border-sky-300 bg-sky-50 p-4 dark:border-sky-900/30 dark:bg-sky-900/10"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Webhook oficial</p><p className="mt-2 break-all text-xs font-mono text-sky-700 dark:text-sky-300">{stripeWebhookUrl}</p></div>
          {integrationsTestResult && (
            <div className="space-y-4">
              <div className={`flex flex-col gap-4 rounded-sm border p-4 md:flex-row md:items-center md:justify-between ${integrationResultToneClassName}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-white/70 p-2 text-current shadow-sm dark:bg-slate-950/30">
                    <IntegrationResultIcon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black">{integrationsTestResult.message || 'Integrações verificadas.'}</p>
                    <p className="mt-1 text-xs font-semibold opacity-80">
                      {hasIntegrationCriticalIssues
                        ? 'Corrija os itens criticos antes de considerar as integrações prontas para producao.'
                        : hasIntegrationWarnings
                          ? 'Nao ha falha critica, mas existem avisos que merecem revisão.'
                          : 'Todas as integrações testadas estao saudaveis.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black dark:bg-slate-950/30">
                    {integrationCriticalCount} critica(s)
                  </span>
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black dark:bg-slate-950/30">
                    {integrationWarningCount} aviso(s)
                  </span>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {integrationChecks.map(([key, check]) => (
                  <div
                    key={key}
                    className={`rounded-sm border p-4 ${
                      check.status === 'ok'
                        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10'
                        : check.status === 'critical'
                          ? 'border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10'
                          : 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10'
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{check.label}</p>
                    <p className={`mt-2 text-sm font-black uppercase ${
                      check.status === 'ok'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : check.status === 'critical'
                          ? 'text-rose-700 dark:text-rose-300'
                          : 'text-amber-700 dark:text-amber-300'
                    }`}
                    >
                      {check.status === 'ok' ? 'OK' : check.status === 'critical' ? 'Critico' : 'Aviso'}
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{check.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'email' && (
        <div className={`space-y-6 ${ADMIN_PAGE_PANEL_CLASS}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><Mail size={20} className="text-sky-700 dark:text-sky-300" /> SMTP</h3>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Teste real via backend oficial. A senha salva fica oculta e so e substituida quando uma nova senha e informada.</p>
            </div>
            <button type="button" onClick={() => void handleTestSmtp()} disabled={isTestingSmtp} className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}>{isTestingSmtp ? 'Testando...' : 'Testar SMTP'}</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <input value={localSettings.smtpHost || ''} onChange={(e) => setField('smtpHost', e.target.value)} className={inputClassName} placeholder="Host SMTP" />
            <input type="number" value={String(localSettings.smtpPort || 587)} onChange={(e) => setField('smtpPort', Number(e.target.value))} className={inputClassName} placeholder="Porta" />
            <select value={localSettings.smtpSecure || 'tls'} onChange={(e) => setField('smtpSecure', e.target.value as 'tls' | 'ssl')} className={inputClassName}><option value="tls">TLS</option><option value="ssl">SSL</option></select>
            <input value={localSettings.smtpUser || ''} onChange={(e) => setField('smtpUser', e.target.value)} className={inputClassName} placeholder="Usuario SMTP" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={labelClassName}>Senha SMTP</span>
                <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isSmtpPasswordConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isSmtpPasswordConfigured ? 'Configurada' : 'Ausente'}</span>
              </div>
              <input type="password" value={localSettings.smtpPass || ''} onChange={(e) => setField('smtpPass', e.target.value)} className={inputClassName} placeholder={isSmtpPasswordConfigured ? 'Digite uma nova senha para substituir a atual' : 'Senha SMTP'} />
            </div>
            <input value={localSettings.mailFromAddress || ''} onChange={(e) => setField('mailFromAddress', e.target.value)} className={inputClassName} placeholder="E-mail remetente" />
            <input value={localSettings.mailFromName || ''} onChange={(e) => setField('mailFromName', e.target.value)} className={inputClassName} placeholder="Nome remetente" />
            <div className="grid gap-4 rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:col-span-2 md:grid-cols-[minmax(0,1fr)_180px] md:items-center">
              <div className="space-y-2">
                <label className={labelClassName}>Logo padrao dos e-mails</label>
                <input
                  value={localSettings.emailLogoUrl || ''}
                  onChange={(event) => setField('emailLogoUrl', event.target.value)}
                  className={inputClassName}
                  placeholder="https://concursomestre.com/branding/logo-light.png"
                />
                <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  Use uma URL publica em HTTPS. Essa imagem substitui o bloco <strong>CM</strong> no cabecalho do modelo padrao dos e-mails.
                </p>
              </div>
              <div className="flex h-24 items-center justify-center rounded-sm border border-slate-200 bg-slate-950 p-4 dark:border-slate-700">
                {/^https?:\/\/\S+$/i.test(String(localSettings.emailLogoUrl || '').trim()) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={String(localSettings.emailLogoUrl || '').trim()}
                    alt="Logo dos e-mails"
                    className="max-h-14 max-w-[140px] object-contain"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-sm font-black text-white">
                    CM
                  </div>
                )}
              </div>
            </div>
          </div>
          {smtpTestResult && <div className={`rounded-sm border p-4 ${smtpTestResult.ok ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10' : 'border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10'}`}><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Resultado do teste</p><p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{smtpTestResult.ok ? 'OK' : 'Falhou'}</p><p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{smtpTestResult.message}</p></div>}
        </div>
      )}

      {activeTab === 'email-templates' && (
        <AdminEmailTemplatesSection
          templates={normalizeEmailTemplates(localSettings.emailTemplates)}
          onChange={(emailTemplates) => setField('emailTemplates', emailTemplates)}
          defaultTestEmail={localSettings.mailFromAddress || localSettings.smtpUser || currentUser?.email || ''}
          emailLogoUrl={localSettings.emailLogoUrl || ''}
          onSendTest={handleTestEmailTemplate}
        />
      )}

      {activeTab === 'ads' && (
        <div className={`space-y-5 ${ADMIN_PAGE_PANEL_CLASS}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">Publicidade</p>
              <h3 className="mt-2 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100">
                <Megaphone size={20} />
                Controle de anúncios
              </h3>
              <p className="mt-2 max-w-2xl text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Configure a conta AdSense, valide a propriedade do dominio e escolha exatamente onde os banners seráo exibidos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setField('adsEnabled', !localSettings.adsEnabled)}
              className={`inline-flex items-center justify-center gap-2 rounded-sm border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition-colors ${
                localSettings.adsEnabled
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${localSettings.adsEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {localSettings.adsEnabled ? 'Anuncios ativos' : 'Anuncios pausados'}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className={ADMIN_MUTED_SURFACE_CLASS + ' p-4'}>
              <p className={labelClassName}>Status</p>
              <p className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">{enabledAdPlacements}/5</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">posicoes habilitadas</p>
            </div>
            <div className={ADMIN_MUTED_SURFACE_CLASS + ' p-4'}>
              <p className={labelClassName}>Fonte</p>
              <p className={`mt-3 text-sm font-black ${hasConfiguredAdSource ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {localSettings.adsenseTestMode === true ? 'Teste Google' : hasConfiguredAdSource ? 'Configurada' : 'Pendente'}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">AdSense ou HTML customizado</p>
            </div>
            <div className={ADMIN_MUTED_SURFACE_CLASS + ' p-4'}>
              <p className={labelClassName}>Verificação AdSense</p>
              <p className={`mt-3 text-sm font-black ${adsensePublisherId ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {adsensePublisherId ? 'Metatag pronta' : 'Informe o ca-pub'}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">injetada no head do site</p>
            </div>
          </div>

          <div className="rounded-sm border border-sky-200 bg-sky-50 p-4 text-sm font-semibold leading-relaxed text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100">
            Quando o publisher ou slot nao estiverem preenchidos, o site usa os IDs oficiais de teste do Google para validar renderização sem gerar tráfego real. O interstitial respeita o frequency cap do Google e também o intervalo configurado em Controle de Acesso por Plano.
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              Use o modo teste para validar a implementação. Ele ignora temporariamente os slots reais e HTML customizado, usa os IDs oficiais do Google e adiciona <span className="font-mono">data-adtest=&quot;on&quot;</span>. Desative para veicular os anúncios reais após a verificação/aprovação do AdSense.
            </div>
            <button
              type="button"
              onClick={() => setField('adsenseTestMode', localSettings.adsenseTestMode !== true)}
              className={`flex h-full min-h-[96px] flex-col items-start justify-center rounded-sm border p-4 text-left transition-colors ${
                localSettings.adsenseTestMode === true
                  ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                <Sparkles size={14} />
                Modo teste Google
              </span>
              <span className="mt-3 text-2xl font-black">{localSettings.adsenseTestMode === true ? 'Ativo' : 'Desativado'}</span>
              <span className="mt-1 text-xs font-semibold opacity-80">Forcar criativos oficiais de teste.</span>
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <div className="space-y-4">
              <div>
                <label className={labelClassName}>ID da conta AdSense</label>
                <input
                  value={localSettings.adsenseClientId || ''}
                  onChange={(event) => setField('adsenseClientId', event.target.value)}
                  className={inputClassName}
                  placeholder="ca-pub-7995648525529106"
                />
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Use o mesmo valor da metatag exigida pelo Google AdSense.
                </p>
              </div>
              <div>
                <label className={labelClassName}>Meta/Facebook Ads ID</label>
                <input
                  value={localSettings.facebookAdsId || ''}
                  onChange={(event) => setField('facebookAdsId', event.target.value)}
                  className={inputClassName}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className={ADMIN_MUTED_SURFACE_CLASS + ' p-4'}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={labelClassName}>Metatag de propriedade</p>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    O Google usa essa tag para confirmar que o dominio pertence a sua conta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyAdsenseMetaTag()}
                  className={`${ADMIN_SECONDARY_BUTTON_CLASS} shrink-0`}
                >
                  <Copy size={14} />
                  Copiar
                </button>
              </div>
              <pre className="mt-4 overflow-x-auto rounded-sm border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {adsenseMetaTag}
              </pre>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {adPlacementCards.map((placement) => {
              const enabled = localSettings[placement.enabledField] !== false;
              const slotValue = String(localSettings[placement.slotField] || '');
              const htmlValue = String(localSettings[placement.htmlField] || '');

              return (
                <div key={placement.key} className={`${ADMIN_MUTED_SURFACE_CLASS} flex flex-col gap-4 p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{placement.label}</p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">{placement.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setField(placement.enabledField, !enabled)}
                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                        enabled
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'
                          : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                      }`}
                    >
                      {enabled ? 'Ativo' : 'Off'}
                    </button>
                  </div>

                  <div>
                    <label className={labelClassName}>Slot AdSense</label>
                    <input
                      value={slotValue}
                      onChange={(event) => setField(placement.slotField, event.target.value)}
                      className={inputClassName}
                      placeholder={placement.placeholder}
                    />
                  </div>

                  <div className="flex-1">
                    <label className={labelClassName}>HTML customizado</label>
                    <textarea
                      value={htmlValue}
                      onChange={(event) => setField(placement.htmlField, event.target.value)}
                      className={`${ADMIN_TEXTAREA_CLASS} min-h-[150px] resize-y font-mono text-xs`}
                      placeholder="<ins class='adsbygoogle' ...></ins>"
                    />
                    <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      Se preencher HTML, ele substitui o slot automatico dessa posicao.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">Interstitial GPT</p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    Out-of-page ad gerenciado pelo Google. No plano gratuito, pode ser disparado após respostas conforme o intervalo do plano.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setField('adPlacementInterstitialEnabled', localSettings.adPlacementInterstitialEnabled === false)}
                  className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                    localSettings.adPlacementInterstitialEnabled !== false
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  {localSettings.adPlacementInterstitialEnabled !== false ? 'Ativo' : 'Off'}
                </button>
              </div>
              <div className="mt-4">
                <label className={labelClassName}>Slot interstitial</label>
                <input
                  value={localSettings.adInterstitialSlotId || ''}
                  onChange={(event) => setField('adInterstitialSlotId', event.target.value)}
                  className={inputClassName}
                  placeholder="/6355419/Travel/Europe/France/Paris"
                />
                <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  Se vazio, usa o slot oficial de teste do Google Publisher Tag.
                </p>
              </div>
            </div>

            <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">Pop de navegação</p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    Chamada controlada para campanha interna ou patrocinio. Mantida desligada por padrao para preservar experiencia.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setField('adPlacementNavigationPopEnabled', localSettings.adPlacementNavigationPopEnabled !== true)}
                  className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                    localSettings.adPlacementNavigationPopEnabled === true
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  {localSettings.adPlacementNavigationPopEnabled === true ? 'Ativo' : 'Off'}
                </button>
              </div>
              <div className="mt-4">
                <label className={labelClassName}>URL do pop</label>
                <input
                  value={localSettings.adNavigationPopUrl || ''}
                  onChange={(event) => setField('adNavigationPopUrl', event.target.value)}
                  className={inputClassName}
                  placeholder="/plans"
                />
                <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  Use preferencialmente uma URL interna da plataforma. Navegadores podem bloquear popunder externo.
                </p>
              </div>
            </div>
          </div>

          <div className={`${ADMIN_MUTED_SURFACE_CLASS} overflow-hidden`}>
            <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-2`}>
              <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">Publicidade por plano</h4>
              <p className="max-w-3xl text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Defina quem ve anúncios, quem recebe experiencia reduzida e quais planos ficam completamente sem publicidade.
              </p>
            </div>

            <div className="space-y-3 p-4">
              <div className="hidden grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(92px,1fr))] gap-3 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 xl:grid">
                <span>Regra</span>
                {PLAN_ORDER.map((planName) => (
                  <span key={`ads-plan-header-${planName}`} className="text-center">{planName}</span>
                ))}
              </div>

              {AD_PLAN_BENEFIT_KEYS.map((benefitKey) => {
                const benefit = PLAN_BENEFIT_DEFINITIONS.find((item) => item.key === benefitKey);

                return (
                  <div
                    key={`ads-plan-${benefitKey}`}
                    className="grid gap-3 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/50 xl:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(92px,1fr))] xl:items-center"
                  >
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-slate-100">{benefit?.label || benefitKey}</div>
                      <div className="mt-1 break-all text-[10px] font-mono text-slate-400 dark:text-slate-500">{benefitKey}</div>
                      {benefit?.description ? (
                        <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">{benefit.description}</p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:contents">
                      {PLAN_ORDER.map((planName) => {
                        const enabled = resolvedAdPlanEntitlements[planName][benefitKey].enabled;

                        return (
                          <button
                            key={`ads-plan-${benefitKey}-${planName}`}
                            type="button"
                            onClick={() => toggleAdPlanEntitlement(planName, benefitKey)}
                            className={`flex min-h-[52px] items-center justify-center gap-2 rounded-sm border px-2 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-all ${
                              enabled
                                ? `${ADMIN_TAB_BUTTON_ACTIVE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300`
                                : `${ADMIN_TAB_BUTTON_IDLE_CLASS} text-slate-400 dark:text-slate-500`
                            }`}
                            title={`${enabled ? 'Desativar' : 'Ativar'} ${benefit?.label || benefitKey} para ${planName}`}
                          >
                            {enabled ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                            <span>{planName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {adPlanLimitDefinitions.length > 0 ? (
                <div className="mt-5 overflow-hidden rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="border-b border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <h5 className="text-xs font-black uppercase tracking-[0.14em] text-slate-900 dark:text-slate-100">Limites de anúncios por plano</h5>
                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      Controle a cadência de formatos interruptivos, como interstitial após resposta de questões.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left">
                      <thead className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Limite</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descricao</th>
                          {PLAN_ORDER.map((planName) => (
                            <th key={`ads-limit-${planName}`} className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                              {planName}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {adPlanLimitDefinitions.map((limitDefinition) => (
                          <tr key={`ads-limit-${limitDefinition.key}`} className="bg-white dark:bg-slate-900/40">
                            <td className="p-4 align-top">
                              <div className="text-sm font-black text-slate-900 dark:text-slate-100">{limitDefinition.label}</div>
                              <div className="mt-1 text-[10px] font-mono text-slate-400 dark:text-slate-500">{limitDefinition.key}</div>
                            </td>
                            <td className="p-4 align-top text-xs font-medium text-slate-500 dark:text-slate-400">
                              {limitDefinition.description}
                            </td>
                            {PLAN_ORDER.map((planName) => {
                              const currentLimit = resolvedAdPlanUsageLimits[planName][limitDefinition.key];

                              return (
                                <td key={`ads-limit-${limitDefinition.key}-${planName}`} className="p-4 align-top">
                                  <div className="mx-auto flex max-w-[170px] flex-col gap-2">
                                    <div className="inline-flex rounded-sm border border-slate-300 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                                      <button
                                        type="button"
                                        onClick={() => setAdPlanUsageLimitMode(planName, limitDefinition.key, 'limited')}
                                        className={`flex-1 rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                                          currentLimit.mode === 'limited'
                                            ? 'bg-sky-700 text-white'
                                            : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                      >
                                        Limite
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAdPlanUsageLimitMode(planName, limitDefinition.key, 'unlimited')}
                                        className={`flex-1 rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                                          currentLimit.mode === 'unlimited'
                                            ? 'bg-emerald-600 text-white'
                                            : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                      >
                                        Ilimitado
                                      </button>
                                    </div>

                                    {currentLimit.mode === 'limited' ? (
                                      <div>
                                        <input
                                          type="number"
                                          min={0}
                                          value={currentLimit.value ?? 0}
                                          onChange={(event) => setAdPlanUsageLimitValue(planName, limitDefinition.key, Number(event.target.value))}
                                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                        />
                                        <div className="mt-1 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                                          {limitDefinition.inputLabel}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                                        Sem teto
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'integrations' && <StripePaymentMethodsSettings value={localSettings.stripePaymentMethods} onChange={(stripePaymentMethods) => setField('stripePaymentMethods', stripePaymentMethods)} />}
      {activeTab === 'seo' && <AdminSeoSettingsSection seoSettings={localSeoSettings} onChange={setLocalSeoSettings} />}
      {activeTab === 'performance' && <div className={ADMIN_PAGE_PANEL_CLASS}><AdminCacheManagement /></div>}
      {activeTab === 'logs' && <LogViewer isOpen embedded />}
    </div>
  );
};

export default AdminSettings;
