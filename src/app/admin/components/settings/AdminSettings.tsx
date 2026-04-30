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

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell, BookOpen, CalendarDays, Clock, Cpu, Database, FileText, Flag, Globe, LayoutDashboard, Loader2,
  Layers, Lock, Mail, Megaphone, MessageSquare, RefreshCcw, Repeat, Save, Settings, ShieldAlert, ShieldCheck,
  ShoppingBag, ShoppingCart, Sparkles, Terminal, Trash2, Trophy, Upload, Users, XCircle, Zap,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import type { SeoSettings, SystemSettings } from '@types';
import apiClient from '@services/api/client';
import { adminService } from '@services/admin/adminService';
import { parseDailyMotivationMarkdown } from '@services/dashboard/dashboardInsightsService';
import AdminSettingsTabsBar from './AdminSettingsTabsBar';
import { LogViewer } from './LogViewer';
import AdminCacheManagement from './AdminCacheManagement';
import AdminSeoSettingsSection from './AdminSeoSettingsSection';
import AdminLandingContentSection from './AdminLandingContentSection';
import StripePaymentMethodsSettings from './StripePaymentMethodsSettings';
import { mergeSeoSettings } from './seoSettings';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';

type AdminToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
type AdminSettingsTab = 'general' | 'modules' | 'security' | 'integrations' | 'email' | 'ads' | 'seo' | 'performance' | 'logs';

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

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const toIsoDateTimeValue = (value: string) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const resolveFutureLimitedOfferEndsAt = (value?: string | null) => {
  const timestamp = new Date(value || '').getTime();
  if (!value || Number.isNaN(timestamp) || timestamp <= Date.now()) {
    return new Date(Date.now() + DEFAULT_LIMITED_OFFER_EXTENSION_MS).toISOString();
  }

  return value;
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
  { id: 'reportsEnabled', label: 'Denuncias', icon: Flag },
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
  const [integrationsTestResult, setIntegrationsTestResult] = useState<any | null>(null);

  useEffect(() => {
    setLocalSettings(systemSettings);
    setLocalSeoSettings(mergeSeoSettings(systemSettings.seo));
  }, [systemSettings]);

  useEffect(() => {
    setActiveTab(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!isResetModalOpen) return;
    adminService.listResettableTables().then((tables) => {
      const resettableTables = tables
        .filter((table) => !RESET_TABLE_EXCLUSIONS.has(String(table).trim().toLowerCase()))
        .sort((left, right) => left.localeCompare(right, 'pt-BR'));

      setDbTables(resettableTables);
      setSelectedTables(new Set(resettableTables));
    }).catch(() => addToast('Nao foi possivel carregar as tabelas do reset.', 'error'));
  }, [isResetModalOpen, addToast]);

  const changeSection = (section: AdminSettingsTab) => {
    setActiveTab(section);
    onSectionChange?.(section);
  };

  const setField = <K extends keyof SystemSettings>(field: K, value: SystemSettings[K]) => {
    setLocalSettings((current) => ({ ...current, [field]: value }));
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
    const payload = {
      ...stripFeatureFlagAliases(localSettings),
      paymentProvider: 'stripe',
      cardVaultProvider: 'stripe',
      paymentCheckoutMode: localSettings.paymentCheckoutMode || 'internal',
      stripePaymentMethods: localSettings.stripePaymentMethods,
      siteName: localSettings.siteName || 'ConcursoMestre',
      platformFeePercent: Number(localSettings.platformFeePercent ?? 20),
      smtpPort: Number(localSettings.smtpPort || 587),
      features: {
        ...(localSettings.features || {}),
      } as SystemSettings['features'],
      seo: localSeoSettings,
    } as SystemSettings & Record<string, unknown>;

    if (!localSettings.smtpPass) {
      delete payload.smtpPass;
    }

    delete payload.hasSmtpPasswordConfigured;
    delete payload.hasGeminiApiKeyConfigured;
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
      addToast('Configuracoes salvas com sucesso.', 'success');
    } catch {
      addToast('Nao foi possivel salvar as configuracoes.', 'error');
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
    } catch (error: any) {
      setResetError(error?.message || 'Falha ao resetar o sistema.');
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
    } catch (error: any) {
      const message = error?.message || 'Nao foi possivel testar o SMTP.';
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
      setIntegrationsTestResult(result);
      addToast(result.message, 'success');
    } catch (error: any) {
      const message = error?.message || 'Nao foi possivel validar as integracoes.';
      setIntegrationsTestResult({ message, data: null });
      addToast(message, 'error');
    } finally {
      setIsTestingIntegrations(false);
    }
  };

  const stripeWebhookUrl = `${String(apiClient.defaults.baseURL || '').replace(/\/+$/, '')}/subscriptions/stripe_webhook.php`;
  const isStripeSecretConfigured = !!(localSettings.hasStripeSecretConfigured || localSettings.stripeSecretKey);
  const isStripeWebhookConfigured = !!(localSettings.hasStripeWebhookConfigured || localSettings.stripeWebhookSecret);
  const isGeminiConfigured = !!(localSettings.hasGeminiApiKeyConfigured || localSettings.geminiApiKey);
  const isRecaptchaSecretConfigured = !!(localSettings.hasRecaptchaSecretConfigured || localSettings.recaptchaSecretKey);
  const isSmtpPasswordConfigured = !!(localSettings.hasSmtpPasswordConfigured || localSettings.smtpPass);
  const settingsTabs = [
    { id: 'general', label: 'Geral', icon: Settings },
    { id: 'modules', label: 'Modulos', icon: LayoutDashboard },
    { id: 'security', label: 'Seguranca', icon: ShieldAlert },
    { id: 'integrations', label: 'Integracoes', icon: Cpu },
    { id: 'email', label: 'E-mail', icon: Mail },
    { id: 'ads', label: 'Anuncios', icon: Megaphone },
    { id: 'seo', label: 'SEO', icon: Globe },
    { id: 'performance', label: 'Performance', icon: Database },
    { id: 'logs', label: 'Logs', icon: FileText },
  ] as const;
  const activeTabMeta = settingsTabs.find((tab) => tab.id === activeTab);
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
          tabs={settingsTabs as any}
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
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Configuracoes principais da plataforma.</p>
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
                  Motivacao diaria
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
                <label className={labelClassName}>Conteudo</label>
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

          <AdminLandingContentSection
            siteName={localSettings.siteName || 'ConcursoMestre'}
            content={localSettings.landingPageContent}
            onChange={(content) => setField('landingPageContent', content)}
          />
        </div>
      )}

      {activeTab === 'modules' && <div className="grid gap-4 md:grid-cols-2">{featureItems.map((feature) => <button key={feature.id} type="button" onClick={() => setFeature(feature.id, !localSettings.features?.[feature.id])} className={`${ADMIN_PAGE_PANEL_CLASS} flex items-center justify-between p-5 text-left`}><div className="flex items-center gap-3"><feature.icon size={18} className="text-sky-700 dark:text-sky-300" /><div><p className="text-sm font-black text-slate-900 dark:text-slate-100">{feature.label}</p><p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{feature.id}</p></div></div><div className={`rounded-sm px-3 py-1 text-[10px] font-black uppercase ${localSettings.features?.[feature.id] ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{localSettings.features?.[feature.id] ? 'Ativo' : 'Inativo'}</div></button>)}</div>}

      {activeTab === 'security' && (
        <div className="grid gap-5 md:gap-6 lg:grid-cols-2">
          <div className={ADMIN_PAGE_PANEL_CLASS}>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><ShieldCheck size={20} className="text-sky-700 dark:text-sky-300" /> 2FA</h3>
            <p className="mb-4 text-xs font-medium text-slate-500 dark:text-slate-400">Status atual: {currentUser?.twoFactorEnabled ? 'ativo' : 'inativo'}.</p>
            {twoFactorStep === 'status' && !currentUser?.twoFactorEnabled && <button type="button" onClick={initiate2FASetup} className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-6 py-2 text-[10px] uppercase tracking-[0.18em]`}>Configurar 2FA</button>}
            {twoFactorStep === 'setup' && twoFactorData && <div className="space-y-4"><img src={twoFactorData.qrCodeUrl} alt="QR 2FA" className="h-40 w-40 rounded-sm border border-slate-300 bg-white p-3" /><code className="block rounded-sm bg-slate-100 px-4 py-3 text-sm font-black dark:bg-slate-950 dark:text-slate-100">{twoFactorData.secret}</code><button type="button" onClick={() => setTwoFactorStep('verify')} className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-6 py-2 text-[10px] uppercase tracking-[0.18em] dark:bg-sky-700 dark:text-white dark:hover:bg-sky-800`}>Ja escaneei</button></div>}
            {twoFactorStep === 'verify' && <div className="space-y-4"><input type="text" maxLength={6} value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="000000" className={`${inputClassName} text-center text-2xl font-black tracking-widest`} /><button type="button" onClick={verifyAndEnable2FA} className="rounded-sm border border-emerald-700 bg-emerald-700 px-6 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white">Ativar 2FA</button></div>}
          </div>
          <div className="rounded-sm border border-rose-200 bg-rose-50 p-4 sm:p-5 md:p-6 dark:border-rose-900/30 dark:bg-rose-900/10">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-rose-700 dark:text-rose-300"><Trash2 size={20} /> Reset geral</h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Apaga conteudo operacional com autenticacao forte.</p>
            <button type="button" onClick={() => setIsResetModalOpen(true)} className="mt-5 rounded-sm border border-rose-700 bg-rose-700 px-6 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white">Resetar conteudo</button>
          </div>
          {isResetModalOpen && createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md"><div className="w-full max-w-2xl rounded-[2.5rem] border border-rose-100 bg-white p-8 shadow-2xl dark:border-rose-900/30 dark:bg-slate-900"><h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Confirmacao de reset</h3>{resetError && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-900/30 dark:bg-rose-900/20"><XCircle size={18} className="mt-0.5 text-rose-600" /><p className="text-xs font-bold text-rose-800 dark:text-rose-300">{resetError}</p></div>}<div className="mt-6 space-y-4"><div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">{dbTables.map((table) => <label key={table} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300"><input type="checkbox" checked={selectedTables.has(table)} onChange={() => setSelectedTables((current) => { const next = new Set(current); next.has(table) ? next.delete(table) : next.add(table); return next; })} /><span className="font-mono">{table}</span></label>)}</div><div className="grid gap-4 md:grid-cols-2"><input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Senha do admin" className={inputClassName} /><input type="text" value={reset2FACode} onChange={(e) => setReset2FACode(e.target.value)} placeholder="Codigo 2FA" className={inputClassName} /></div><input type="text" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} placeholder="Digite RESETAR" className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 outline-none dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300" /></div><div className="mt-8 flex gap-3"><button type="button" onClick={() => { setIsResetModalOpen(false); setResetError(null); }} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400">Cancelar</button><button type="button" onClick={handleSystemReset} disabled={isResetting || resetConfirmText !== 'RESETAR'} className={`flex-[2] rounded-2xl py-4 text-[10px] font-black uppercase tracking-[0.18em] text-white ${resetConfirmText === 'RESETAR' ? 'bg-rose-600' : 'bg-slate-300'}`}>{isResetting ? <Loader2 size={14} className="mx-auto animate-spin" /> : 'Executar reset'}</button></div></div></div>, document.body)}
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className={`space-y-6 ${ADMIN_PAGE_PANEL_CLASS}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><Cpu size={20} className="text-sky-700 dark:text-sky-300" /> Integracoes</h3>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Diagnostico oficial do backend.</p>
            </div>
            <button type="button" onClick={() => void handleTestIntegrations()} disabled={isTestingIntegrations} className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}>{isTestingIntegrations ? 'Testando...' : 'Testar integracoes'}</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <select value={localSettings.paymentCheckoutMode || 'internal'} onChange={(e) => setField('paymentCheckoutMode', e.target.value as 'internal' | 'redirect')} className={inputClassName}><option value="internal">Checkout interno</option><option value="redirect">Checkout externo</option></select>
            <label className={`flex items-center justify-between px-4 py-3 ${ADMIN_MUTED_SURFACE_CLASS}`}><span className="text-sm font-semibold text-slate-900 dark:text-slate-100">reCAPTCHA ativo</span><input type="checkbox" checked={!!localSettings.recaptchaEnabled} onChange={(e) => setField('recaptchaEnabled', e.target.checked)} className="h-4 w-4 rounded-sm border-slate-300 text-sky-700" /></label>
            <input value={localSettings.stripePublishableKey || localSettings.stripeKey || ''} onChange={(e) => setField('stripePublishableKey', e.target.value)} className={inputClassName} placeholder="Stripe publishable key" />
            <div className="space-y-2"><div className="flex items-center justify-between"><span className={labelClassName}>Stripe secret key</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isStripeSecretConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isStripeSecretConfigured ? 'Configurada' : 'Ausente'}</span></div><input type="password" value={localSettings.stripeSecretKey || ''} onChange={(e) => setField('stripeSecretKey', e.target.value)} className={inputClassName} placeholder={isStripeSecretConfigured ? 'Digite uma nova chave para substituir a atual' : 'Stripe secret key'} /></div>
            <div className="space-y-2"><div className="flex items-center justify-between"><span className={labelClassName}>Stripe webhook secret</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isStripeWebhookConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isStripeWebhookConfigured ? 'Configurado' : 'Ausente'}</span></div><input type="password" value={localSettings.stripeWebhookSecret || ''} onChange={(e) => setField('stripeWebhookSecret', e.target.value)} className={inputClassName} placeholder={isStripeWebhookConfigured ? 'Digite um novo segredo para substituir o atual' : 'Stripe webhook secret'} /></div>
            <div className="space-y-2 md:col-span-2"><div className="flex items-center justify-between"><span className={labelClassName}>Google OAuth Client ID</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${localSettings.hasGoogleAuthClientConfigured || localSettings.googleAuthClientId ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{localSettings.hasGoogleAuthClientConfigured || localSettings.googleAuthClientId ? 'Configurado' : 'Ausente'}</span></div><input value={localSettings.googleAuthClientId || ''} onChange={(e) => setField('googleAuthClientId', e.target.value)} className={inputClassName} placeholder="000000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com" /><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Use o Client ID do aplicativo Web do Google Cloud. Origens autorizadas: http://localhost:3000 e o domínio de produção.</p></div>
            <input value={localSettings.googleAnalyticsId || ''} onChange={(e) => setField('googleAnalyticsId', e.target.value)} className={inputClassName} placeholder="Google Analytics ID" />
            <input value={localSettings.metaPixelId || ''} onChange={(e) => setField('metaPixelId', e.target.value)} className={inputClassName} placeholder="Meta Pixel ID" />
            <div className="space-y-2"><div className="flex items-center justify-between"><span className={labelClassName}>Gemini API key</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isGeminiConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isGeminiConfigured ? 'Configurada' : 'Ausente'}</span></div><input type="password" value={localSettings.geminiApiKey || ''} onChange={(e) => setField('geminiApiKey', e.target.value)} className={inputClassName} placeholder={isGeminiConfigured ? 'Digite uma nova chave para substituir a atual' : 'Gemini API key'} />{localSettings.hasGeminiApiKeyConfigured && !localSettings.geminiApiKey && <p className="text-xs font-medium text-slate-500 dark:text-slate-400">A chave atual fica oculta no frontend e as chamadas de IA agora passam pelo backend.</p>}</div>
            <input value={localSettings.recaptchaSiteKey || ''} onChange={(e) => setField('recaptchaSiteKey', e.target.value)} className={inputClassName} placeholder="reCAPTCHA site key" />
            <div className="space-y-2 md:col-span-2"><div className="flex items-center justify-between"><span className={labelClassName}>reCAPTCHA secret key</span><span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isRecaptchaSecretConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{isRecaptchaSecretConfigured ? 'Configurada' : 'Ausente'}</span></div><input type="password" value={localSettings.recaptchaSecretKey || ''} onChange={(e) => setField('recaptchaSecretKey', e.target.value)} className={inputClassName} placeholder={isRecaptchaSecretConfigured ? 'Digite um novo segredo para substituir o atual' : 'reCAPTCHA secret key'} /></div>
          </div>
          <div className="rounded-sm border border-sky-300 bg-sky-50 p-4 dark:border-sky-900/30 dark:bg-sky-900/10"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Webhook oficial</p><p className="mt-2 break-all text-xs font-mono text-sky-700 dark:text-sky-300">{stripeWebhookUrl}</p></div>
          {integrationsTestResult && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{Object.entries(integrationsTestResult.data?.checks || {}).map(([key, check]: any) => <div key={key} className={`rounded-sm border p-4 ${check.status === 'ok' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10' : check.status === 'critical' ? 'border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10' : 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10'}`}><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{check.label}</p><p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{check.status}</p><p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{check.detail}</p></div>)}</div>}
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
          </div>
          {smtpTestResult && <div className={`rounded-sm border p-4 ${smtpTestResult.ok ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10' : 'border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10'}`}><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Resultado do teste</p><p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{smtpTestResult.ok ? 'OK' : 'Falhou'}</p><p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{smtpTestResult.message}</p></div>}
        </div>
      )}

      {activeTab === 'ads' && <div className={`grid gap-4 ${ADMIN_PAGE_PANEL_CLASS} md:grid-cols-2`}><input value={localSettings.adsenseClientId || ''} onChange={(e) => setField('adsenseClientId', e.target.value)} className={inputClassName} placeholder="AdSense Client ID" /><input value={localSettings.facebookAdsId || ''} onChange={(e) => setField('facebookAdsId', e.target.value)} className={inputClassName} placeholder="Facebook Ads ID" /><textarea value={localSettings.adBannerTop || ''} onChange={(e) => setField('adBannerTop', e.target.value)} className={`${ADMIN_TEXTAREA_CLASS} min-h-[120px] resize-none font-mono text-xs md:col-span-2`} placeholder="Banner topo (HTML)" /><textarea value={localSettings.adBannerSidebar || ''} onChange={(e) => setField('adBannerSidebar', e.target.value)} className={`${ADMIN_TEXTAREA_CLASS} min-h-[120px] resize-none font-mono text-xs`} placeholder="Banner lateral" /><textarea value={localSettings.adBannerBottom || ''} onChange={(e) => setField('adBannerBottom', e.target.value)} className={`${ADMIN_TEXTAREA_CLASS} min-h-[120px] resize-none font-mono text-xs`} placeholder="Banner rodape" /></div>}

      {activeTab === 'integrations' && <StripePaymentMethodsSettings value={localSettings.stripePaymentMethods} onChange={(stripePaymentMethods) => setField('stripePaymentMethods', stripePaymentMethods)} />}
      {activeTab === 'seo' && <AdminSeoSettingsSection seoSettings={localSeoSettings} onChange={setLocalSeoSettings} />}
      {activeTab === 'performance' && <div className={ADMIN_PAGE_PANEL_CLASS}><AdminCacheManagement /></div>}
      {activeTab === 'logs' && <LogViewer isOpen embedded />}
    </div>
  );
};

export default AdminSettings;

