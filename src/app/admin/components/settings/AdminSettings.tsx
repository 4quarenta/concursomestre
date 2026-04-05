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
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  Flag,
  LayoutDashboard,
  Loader2,
  Lock,
  Mail,
  Megaphone,
  MessageSquare,
  QrCode,
  RefreshCcw,
  Repeat,
  Save,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Terminal,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import type { SystemSettings } from '@types';
import { adminService } from '@services/admin/adminService';
import { LogViewer } from './LogViewer';

type AdminToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

interface AdminSettingsProps {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => void;
  addToast: AdminToastFn;
}

/**
 * Centraliza a configuraÃ§Ã£o administrativa da plataforma.
 * A extraÃ§Ã£o deste bloco reduz o tamanho do painel principal sem alterar
 * o fluxo de persistÃªncia jÃ¡ homologado pelo admin.
 */
const AdminSettings = ({ systemSettings, updateSystemSettings, addToast }: AdminSettingsProps) => {
  const { currentUser, refreshUser } = useAuth();
  const [settingActiveTab, setSettingActiveTab] = useState<'general' | 'modules' | 'security' | 'integrations' | 'email' | 'ads' | 'performance'>('general');

  // API Keys
  const [localApiKey, setLocalApiKey] = useState(systemSettings.geminiApiKey || '');
  const [localPaymentProvider, setLocalPaymentProvider] = useState<'mercado_pago' | 'stripe'>(systemSettings.paymentProvider || 'mercado_pago');
  const [localPaymentCheckoutMode, setLocalPaymentCheckoutMode] = useState<'internal' | 'redirect'>(systemSettings.paymentCheckoutMode || 'internal');
  const [localCardVaultProvider, setLocalCardVaultProvider] = useState<'local' | 'mercado_pago' | 'stripe'>(systemSettings.cardVaultProvider || 'local');
  const [localStripePublishableKey, setLocalStripePublishableKey] = useState(systemSettings.stripePublishableKey || systemSettings.stripeKey || '');
  const [localStripeSecretKey, setLocalStripeSecretKey] = useState('');
  const [localStripeWebhookSecret, setLocalStripeWebhookSecret] = useState('');
  const [localMercadoPagoPublicKey, setLocalMercadoPagoPublicKey] = useState(systemSettings.mercadoPagoKey || '');
  const [localMercadoPagoAccessToken, setLocalMercadoPagoAccessToken] = useState('');
  const [localMercadoPagoWebhookSecret, setLocalMercadoPagoWebhookSecret] = useState('');
  const [localRecaptchaEnabled, setLocalRecaptchaEnabled] = useState(!!systemSettings.recaptchaEnabled);
  const [localRecaptchaSiteKey, setLocalRecaptchaSiteKey] = useState(systemSettings.recaptchaSiteKey || '');
  const [localRecaptchaSecretKey, setLocalRecaptchaSecretKey] = useState(systemSettings.recaptchaSecretKey || '');
  const [localFirebaseKey, setLocalFirebaseKey] = useState(systemSettings.firebaseConfig?.apiKey || '');
  const [localGaId, setLocalGaId] = useState(systemSettings.googleAnalyticsId || '');
  const [localPixelId, setLocalPixelId] = useState(systemSettings.metaPixelId || '');
  const [localPhone, setLocalPhone] = useState(systemSettings.supportPhone || '');
  const [localPixKey, setLocalPixKey] = useState(systemSettings.pixKey || '');
  const [localSiteName, setLocalSiteName] = useState(systemSettings.siteName || 'ConcursoMestre');
  const [localPlatformFee, setLocalPlatformFee] = useState(String(systemSettings.platformFeePercent ?? 20));
  // SMTP e modo de app
  const [localAppMode, setLocalAppMode] = useState<'development' | 'production'>(systemSettings.appMode || 'development');
  const [localSmtpHost, setLocalSmtpHost] = useState(systemSettings.smtpHost || '');
  const [localSmtpPort, setLocalSmtpPort] = useState(String(systemSettings.smtpPort || 587));
  const [localSmtpSecure, setLocalSmtpSecure] = useState<'tls' | 'ssl'>(systemSettings.smtpSecure || 'tls');
  const [localSmtpUser, setLocalSmtpUser] = useState(systemSettings.smtpUser || '');
  const [localSmtpPass, setLocalSmtpPass] = useState(systemSettings.smtpPass || '');
  const [localMailFrom, setLocalMailFrom] = useState(systemSettings.mailFromAddress || '');
  const [localMailFromName, setLocalMailFromName] = useState(systemSettings.mailFromName || 'ConcursoMestre');

  // Funcionalidades (MÃ³dulos e Recursos) - Gerenciado localmente antes de salvar
  const [localFeatures, setLocalFeatures] = useState<Record<string, boolean>>(systemSettings.features || {});

  // Ad-related states
  const [localAdsEnabled, setLocalAdsEnabled] = useState(!!systemSettings.adsEnabled);
  const [localAdsenseId, setLocalAdsenseId] = useState(systemSettings.adsenseClientId || '');
  const [localFacebookAdsId, setLocalFacebookAdsId] = useState(systemSettings.facebookAdsId || '');
  const [localAdTop, setLocalAdTop] = useState(systemSettings.adBannerTop || '');
  const [localAdSidebar, setLocalAdSidebar] = useState(systemSettings.adBannerSidebar || '');
  const [localAdBottom, setLocalAdBottom] = useState(systemSettings.adBannerBottom || '');

  const handleToggleFeature = (feature: string, value: boolean) => {
    setLocalFeatures(prev => ({ ...prev, [feature]: value }));
  };

  // 2FA States
  const [twoFactorStep, setTwoFactorStep] = useState<'status' | 'setup' | 'verify'>('status');
  const [twoFactorData, setTwoFactorData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [reset2FACode, setReset2FACode] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [dbTables, setDbTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [isFetchingTables, setIsFetchingTables] = useState(false);

  useEffect(() => {
    if (isResetModalOpen) {
      setIsFetchingTables(true);
      adminService.listResettableTables()
        .then((tables) => {
          setDbTables(tables);
          setSelectedTables(new Set(tables));
        })
        .finally(() => setIsFetchingTables(false));
    }
  }, [isResetModalOpen]);

  const initiate2FASetup = async () => {
    try {
      const setupData = await adminService.setupTwoFactor();
      setTwoFactorData(setupData);
      setTwoFactorStep('setup');
    } catch (err) {
      addToast('Erro ao iniciar setup de 2FA', 'error');
    }
  };

  const verifyAndEnable2FA = async () => {
    try {
      const message = await adminService.enableTwoFactor(twoFactorData?.secret || '', twoFactorCode);
      addToast(message, 'success');
      setTwoFactorStep('status');
      if (refreshUser) refreshUser();
    } catch (err) {
      addToast('Erro ao validar 2FA', 'error');
    }
  };

  const handleSystemReset = async () => {
    if (resetConfirmText !== 'RESETAR') {
      setResetError('Digite RESETAR para confirmar');
      return;
    }
    setIsResetting(true);
    setResetError(null);
    try {
      await adminService.resetDatabase({
        password: resetPassword,
        twoFactorCode: reset2FACode,
        tables: Array.from(selectedTables),
      });
      addToast('Sistema resetado com sucesso! Redirecionando...', 'success');
      setTimeout(() => window.location.href = '/auth', 2000);
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.message || 'Erro crítico no reset. Verifique as credenciais.';
      setResetError(msg);
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    setLocalApiKey(systemSettings.geminiApiKey || '');
    setLocalPaymentProvider(systemSettings.paymentProvider || 'mercado_pago');
    setLocalPaymentCheckoutMode(systemSettings.paymentCheckoutMode || 'internal');
    setLocalCardVaultProvider(systemSettings.cardVaultProvider || 'local');
    setLocalStripePublishableKey(systemSettings.stripePublishableKey || systemSettings.stripeKey || '');
    setLocalStripeSecretKey('');
    setLocalStripeWebhookSecret('');
    setLocalMercadoPagoPublicKey(systemSettings.mercadoPagoKey || '');
    setLocalMercadoPagoAccessToken('');
    setLocalMercadoPagoWebhookSecret('');
    setLocalRecaptchaEnabled(!!systemSettings.recaptchaEnabled);
    setLocalRecaptchaSiteKey(systemSettings.recaptchaSiteKey || '');
    setLocalRecaptchaSecretKey(systemSettings.recaptchaSecretKey || '');
    setLocalFirebaseKey(systemSettings.firebaseConfig?.apiKey || '');
    setLocalGaId(systemSettings.googleAnalyticsId || '');
    setLocalPixelId(systemSettings.metaPixelId || '');
    setLocalPhone(systemSettings.supportPhone || '');
    setLocalPixKey(systemSettings.pixKey || '');
    setLocalSiteName(systemSettings.siteName || 'ConcursoMestre');
    setLocalPlatformFee(String(systemSettings.platformFeePercent ?? 20));
    setLocalAppMode(systemSettings.appMode || 'development');
    setLocalSmtpHost(systemSettings.smtpHost || '');
    setLocalSmtpPort(String(systemSettings.smtpPort || 587));
    setLocalSmtpSecure(systemSettings.smtpSecure || 'tls');
    setLocalSmtpUser(systemSettings.smtpUser || '');
    setLocalSmtpPass(systemSettings.smtpPass || '');
    setLocalMailFrom(systemSettings.mailFromAddress || '');
    setLocalMailFromName(systemSettings.mailFromName || 'ConcursoMestre');
    setLocalFeatures(systemSettings.features || {});
    setLocalAdsEnabled(!!systemSettings.adsEnabled);
    setLocalAdsenseId(systemSettings.adsenseClientId || '');
    setLocalFacebookAdsId(systemSettings.facebookAdsId || '');
    setLocalAdTop(systemSettings.adBannerTop || '');
    setLocalAdSidebar(systemSettings.adBannerSidebar || '');
    setLocalAdBottom(systemSettings.adBannerBottom || '');
  }, [systemSettings]);

  const handleSaveSettings = () => {
    updateSystemSettings({
      ...systemSettings,
      paymentProvider: localPaymentProvider,
      paymentCheckoutMode: localPaymentCheckoutMode,
      cardVaultProvider: localCardVaultProvider,
      siteName: localSiteName,
      supportPhone: localPhone,
      platformFeePercent: Number(localPlatformFee),
      pixKey: localPixKey,
      appMode: localAppMode,
      geminiApiKey: localApiKey,
      recaptchaEnabled: localRecaptchaEnabled,
      recaptchaSiteKey: localRecaptchaSiteKey,
      recaptchaSecretKey: localRecaptchaSecretKey,
      stripeKey: localStripePublishableKey,
      stripePublishableKey: localStripePublishableKey,
      stripeSecretKey: localStripeSecretKey,
      stripeWebhookSecret: localStripeWebhookSecret,
      mercadoPagoKey: localMercadoPagoPublicKey,
      mercadoPagoAccessToken: localMercadoPagoAccessToken,
      mercadoPagoWebhookSecret: localMercadoPagoWebhookSecret,
      firebaseConfig: { ...systemSettings.firebaseConfig, apiKey: localFirebaseKey },
      googleAnalyticsId: localGaId,
      metaPixelId: localPixelId,
      smtpHost: localSmtpHost,
      smtpPort: Number(localSmtpPort),
      smtpUser: localSmtpUser,
      smtpPass: localSmtpPass,
      smtpSecure: localSmtpSecure,
      mailFromAddress: localMailFrom,
      mailFromName: localMailFromName,

      adBannerTop: localAdTop,
      adBannerSidebar: localAdSidebar,
      adBannerBottom: localAdBottom,
      adsEnabled: localAdsEnabled,
      adsenseClientId: localAdsenseId,
      facebookAdsId: localFacebookAdsId,
      features: localFeatures
    });
    addToast('ConfiguraÃ§Ãµes salvas com sucesso!', 'success');
  };

  const apiBaseUrl = String((api as any).defaults.baseURL || '').replace(/\/+$/, '');
  const stripeWebhookUrl = `${apiBaseUrl}/subscriptions/stripe_webhook.php`;
  const mercadoPagoWebhookUrl = `${apiBaseUrl}/subscriptions/webhook_mp.php`;

  const settingTabs = [
    { id: 'general', label: 'Geral', icon: Settings },
    { id: 'modules', label: 'MÃ³dulos', icon: LayoutDashboard },
    { id: 'security', label: 'SeguranÃ§a', icon: ShieldAlert },
    { id: 'integrations', label: 'IntegraÃ§Ãµes', icon: Cpu },
    { id: 'email', label: 'E-mail', icon: Mail },
    { id: 'ads', label: 'AnÃºncios', icon: Megaphone },
    { id: 'performance', label: 'Performance', icon: Database },
  ];

  const pageToggles = [
    // MÃ³dulos Originais
    { id: 'practiceEnabled', label: 'PÃ¡gina de PrÃ¡tica', description: 'Ativa o sistema de resoluÃ§Ã£o de questÃµes', icon: BookOpen },
    { id: 'simulationsEnabled', label: 'PÃ¡gina de Simulados', description: 'MÃ³dulo de provas cronometradas e simulados', icon: Clock },
    { id: 'marketplaceEnabled', label: 'Marketplace', description: 'Plataforma de compra e venda de materiais', icon: ShoppingCart },
    { id: 'rankingsEnabled', label: 'Rankings', description: 'Exibe classificaÃ§Ãµes e desempenho de inscritos', icon: Trophy },
    { id: 'xRayEnabled', label: 'Raio-X da Banca', description: 'AnÃ¡lise estatÃ­stica e perfil de bancas examinadoras', icon: Zap },
    { id: 'landingPagePromoEnabled', label: 'PromoÃ§Ã£o na Home', description: 'Exibe banner de campanha na landing page principal', icon: Megaphone },
    // Recursos
    { id: 'communityEnabled', label: 'ComentÃ¡rios da Comunidade', description: 'InteraÃ§Ã£o e fÃ³rum de debate em questÃµes', icon: MessageSquare },
    { id: 'aiCommentsEnabled', label: 'ComentÃ¡rios com IA', description: 'GeraÃ§Ã£o de anÃ¡lises via Gemini Pro 1.5/2.0', icon: Sparkles },
    { id: 'bulkImportEnabled', label: 'Importador em Massa', description: 'Ferramenta de processamento de PDFs/Imagens', icon: Upload },
    { id: 'reportsEnabled', label: 'Sistema de DenÃºncias', description: 'Ouvidoria e moderaÃ§Ã£o de conteÃºdo', icon: Flag },
    { id: 'notificationsEnabled', label: 'NotificaÃ§Ãµes Push', description: 'Alertas globais e interaÃ§Ãµes sociais', icon: Bell },
    // ConfiguraÃ§Ãµes e Bloqueios CrÃ­ticos
    { id: 'maintenanceMode', label: 'Aviso de ManutenÃ§Ã£o', description: 'Bloqueia o acesso ao site para manutenÃ§Ã£o tÃ©cnica', icon: ShieldAlert },
    { id: 'registrationEnabled', label: 'Novos Cadastros', description: 'Controla a entrada de novos usuÃ¡rios na plataforma', icon: Users },
    { id: 'loginRequired', label: 'Login ObrigatÃ³rio', description: 'Exige login para acessar qualquer conteÃºdo interno', icon: Lock },
    { id: 'partnerRegistrationEnabled', label: 'Cadastro de Vendedor', description: 'Permite que usuÃ¡rios se tornem colaboradores e vendam materiais', icon: ShoppingBag },
    { id: 'recurringEnabled', label: 'CobranÃ§as Recorrentes (Beta)', description: 'Ativa a opÃ§Ã£o de assinatura recorrente mensal via plataforma para planos anuais/trimestrais sem comprometer o limite do cartÃ£o', icon: Repeat },
    { id: 'autoRefundEnabled', label: 'AprovaÃ§Ã£o AutomÃ¡tica de Reembolso', description: 'Ativa o processamento instantÃ¢neo de reembolsos solicitados por usuÃ¡rios dentro do prazo legal', icon: RefreshCcw },
  ];

  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  const SettingRow = ({ keyName, label, description, icon: Icon }: any) => (
    <div
      key={keyName}
      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all group"
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="p-2.5 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 group-hover:border-indigo-300 dark:group-hover:border-indigo-700 transition-colors">
          <Icon size={18} className="text-slate-600 dark:text-slate-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-0.5">{label}</h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{description}</p>
        </div>
      </div>
      <button
        onClick={() => handleToggleFeature(keyName, !localFeatures[keyName])}
        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${localFeatures[keyName]
          ? keyName === 'maintenanceMode' ? 'bg-red-600' : 'bg-indigo-600 dark:bg-indigo-500'
          : 'bg-slate-300 dark:bg-slate-700'
          }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${localFeatures[keyName] ? 'right-1' : 'left-1'
            }`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-slide-up">
      <LogViewer isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div className="flex flex-wrap gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
          {settingTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSettingActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settingActiveTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleSaveSettings}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-indigo-200 dark:shadow-indigo-900/20 active:scale-95"
        >
          <Save size={18} /> Salvar AlteraÃ§Ãµes
        </button>
      </div>

      <div className="min-h-[400px]">
        {settingActiveTab === 'general' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Terminal size={20} className="text-indigo-600 dark:text-indigo-400" />
                    Ambiente da Plataforma
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Modo de operaÃ§Ã£o, logs e acessos de desenvolvimento</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsLogViewerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
                  >
                    <FileText size={14} /> Visualizar Logs
                  </button>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${localAppMode === 'development' ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {localAppMode === 'development' ? 'DEV' : 'PRODUÃ‡ÃƒO'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLocalAppMode(localAppMode === 'development' ? 'production' : 'development')}
                      className={`relative w-12 h-6 rounded-full transition-colors ${localAppMode === 'production' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${localAppMode === 'production' ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-4">Identidade</h4>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome do Site</label>
                      <input type="text" value={localSiteName} onChange={e => setLocalSiteName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-4">Suporte e Taxas</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">WhatsApp</label>
                        <input type="text" value={localPhone} onChange={e => setLocalPhone(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Taxa (%)</label>
                        <input type="number" value={localPlatformFee} onChange={e => setLocalPlatformFee(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-[2.5rem] border border-emerald-100/50 dark:border-emerald-900/30">
              <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-2 mb-4">
                <QrCode size={20} /> Financeiro
              </h3>
              <div className="max-w-md space-y-1.5">
                <label className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest ml-1">Chave PIX Global</label>
                <input type="text" value={localPixKey} onChange={e => setLocalPixKey(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/50 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
              </div>
            </div>
          </div>
        )}

        {settingActiveTab === 'modules' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
              <LayoutDashboard size={20} className="text-indigo-600 dark:text-indigo-400" />
              PÃ¡ginas e MÃ³dulos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pageToggles.map(f => <SettingRow key={f.id} keyName={f.id} {...f} />)}
            </div>
          </div>
        )}

        {settingActiveTab === 'security' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 flex items-center gap-2 mb-6">
              <ShieldAlert size={20} />
              SeguranÃ§a e Acesso
            </h3>
            <div className="space-y-6">
              
              {/* 2FA Management */}
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-4">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                       <ShieldCheck size={18} className="text-indigo-500" /> AutenticaÃ§Ã£o de Dois Fatores (2FA)
                    </h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Reforce a seguranÃ§a da sua conta de administrador exigindo um cÃ³digo gerado pelo Google Authenticator ou similar a cada login e aÃ§Ãµes sensÃ­veis.
                    </p>
                    
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${currentUser?.twoFactorEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                        Status: {currentUser?.twoFactorEnabled ? 'Ativo' : 'Inativo'}
                      </div>
                      
                      {twoFactorStep === 'status' && !currentUser?.twoFactorEnabled && (
                        <button 
                          onClick={initiate2FASetup}
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                          Configurar 2FA agora
                        </button>
                      )}
                    </div>
                  </div>

                  {twoFactorStep === 'setup' && twoFactorData && (
                    <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 shadow-xl animate-scale-in">
                       <div className="flex flex-col items-center gap-4 text-center">
                          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Passo 1: Escaneie o QR Code</p>
                          <div className="p-4 bg-white rounded-2xl border-4 border-slate-100">
                             <img src={twoFactorData.qrCodeUrl} alt="2FA QR Code" className="w-40 h-40" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] font-bold text-slate-400">Ou use a chave manual:</p>
                             <code className="text-sm font-black text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">{twoFactorData.secret}</code>
                          </div>
                          <button 
                             onClick={() => setTwoFactorStep('verify')}
                             className="w-full py-3 bg-slate-900 dark:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
                          >
                             JÃ¡ escaneei, prÃ³ximo passo
                          </button>
                       </div>
                    </div>
                  )}

                  {twoFactorStep === 'verify' && (
                     <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/40 shadow-xl animate-scale-in">
                        <div className="flex flex-col gap-4">
                           <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Passo 2: Verifique o cÃ³digo</p>
                           <input 
                             type="text" 
                             maxLength={6}
                             placeholder="000 000"
                             value={twoFactorCode}
                             onChange={e => setTwoFactorCode(e.target.value)}
                             className="w-full text-center text-3xl font-black tracking-widest bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 outline-none focus:ring-2 focus:ring-emerald-500/20"
                           />
                           <div className="flex gap-2">
                              <button onClick={() => setTwoFactorStep('setup')} className="flex-1 py-3 text-slate-400 font-black text-[10px] uppercase">Voltar</button>
                              <button onClick={verifyAndEnable2FA} className="flex-[2] py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Ativar 2FA</button>
                           </div>
                        </div>
                     </div>
                  )}
                </div>
              </div>

              {/* System Reset Section */}
              <div className="p-8 bg-rose-50/50 dark:bg-rose-900/10 rounded-[2rem] border border-rose-100 dark:border-rose-900/30">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="space-y-2">
                       <h4 className="text-sm font-black text-rose-800 dark:text-rose-400 flex items-center gap-2">
                          <Trash2 size={18} /> Reset Geral de Sistema
                       </h4>
                       <p className="text-[10px] text-rose-700/60 dark:text-rose-500/60 font-medium max-w-md">
                          Esta aÃ§Ã£o apagarÃ¡ permanentemente TODAS as questÃµes, usuÃ¡rios, simulados e transaÃ§Ãµes. Seu usuÃ¡rio administrador serÃ¡ preservado. Esta aÃ§Ã£o Ã© irreversÃ­vel.
                       </p>
                    </div>
                    <button 
                       onClick={() => setIsResetModalOpen(true)}
                       className="px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-rose-200 dark:shadow-none"
                    >
                       Resetar Todo ConteÃºdo
                    </button>
                 </div>
              </div>

              {/* Reset Confirmation Modal */}
              {isResetModalOpen && createPortal(
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
                     <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-scale-in border border-rose-100 dark:border-rose-900/30">
                        <div className="text-center space-y-4 mb-8">
                           <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto text-rose-600">
                              <ShieldAlert size={32} />
                           </div>
                           <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">ConfirmaÃ§Ã£o de Reset</h3>
                           <p className="text-xs text-slate-500 font-medium">Para prosseguir, vocÃª deve autenticar esta aÃ§Ã£o destrutiva.</p>
                        </div>

                        {resetError && (
                          <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-start gap-3 animate-head-shake">
                            <XCircle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-rose-800 dark:text-rose-400">{resetError}</p>
                          </div>
                        )}

                        <div className="space-y-4">
                           {/* Tables Selection */}
                           {isFetchingTables ? (
                              <div className="flex items-center justify-center p-4">
                                <Loader2 className="animate-spin text-slate-400" />
                              </div>
                           ) : (
                              <div className="mb-4 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                                  <span>Tabelas para Limpar</span>
                                  <button onClick={() => setSelectedTables(selectedTables.size === dbTables.length ? new Set() : new Set(dbTables))} className="text-indigo-500 hover:text-indigo-600">
                                    {selectedTables.size === dbTables.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                                  </button>
                                </label>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 custom-scrollbar">
                                  {dbTables.map(table => (
                                    <label key={table} className="flex items-center gap-2 cursor-pointer group">
                                      <div className={`w-3 h-3 rounded-md border flex items-center justify-center transition-colors ${selectedTables.has(table) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-600'}`}>
                                        {selectedTables.has(table) && <span className="text-[8px] font-black">âœ“</span>}
                                      </div>
                                      <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold font-mono group-hover:text-slate-900 truncate">{table}</span>
                                      <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={selectedTables.has(table)}
                                        onChange={() => {
                                          setSelectedTables(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(table)) newSet.delete(table);
                                            else newSet.add(table);
                                            return newSet;
                                          });
                                        }}
                                      />
                                    </label>
                                  ))}
                                </div>
                              </div>
                           )}

                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha do Administrador</label>
                              <input 
                                 type="password" 
                                 value={resetPassword}
                                 onChange={e => setResetPassword(e.target.value)}
                                 className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500/10" 
                              />
                           </div>
                           {localAppMode !== 'development' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
                             <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CÃ³digo 2FA</label>
                                <input 
                                   type="text" 
                                   value={reset2FACode}
                                   onChange={e => setReset2FACode(e.target.value)}
                                   placeholder="000000"
                                   className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500/10" 
                                />
                             </div>
                           )}
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Digite RESETAR para confirmar</label>
                              <input 
                                 type="text" 
                                 value={resetConfirmText}
                                 onChange={e => setResetConfirmText(e.target.value)}
                                 placeholder="RESETAR"
                                 className="w-full bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-100 dark:border-rose-900/20 rounded-xl py-3 px-4 text-sm font-black text-rose-600 placeholder:text-rose-200 outline-none" 
                              />
                           </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                           <button 
                             onClick={() => { setIsResetModalOpen(false); setResetError(null); }} 
                             disabled={isResetting}
                             className="flex-1 py-4 text-slate-400 font-extrabold text-[10px] uppercase disabled:opacity-50"
                           >
                             Cancelar
                           </button>
                           <button 
                              onClick={handleSystemReset}
                              disabled={resetConfirmText !== 'RESETAR' || isResetting}
                              className={`flex-[2] py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${resetConfirmText === 'RESETAR' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200 dark:shadow-none' : 'bg-slate-100 text-slate-300'}`}
                           >
                              {isResetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              {isResetting ? 'Resetando...' : 'Executar Reset'}
                           </button>
                        </div>
                     </div>
                  </div>,
                  document.body
               )}

              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <Lock size={16} className="text-rose-500" /> RestriÃ§Ãµes de IP e SessÃ£o
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-500 font-medium">
                  <p>ConfiguraÃ§Ãµes avanÃ§adas de Firewall e SSL sÃ£o gerenciadas via Servidor (Apache/Nginx).</p>
                  <p>Log de auditoria interna disponÃ­vel na aba Geral &gt; Visualizar Logs.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {settingActiveTab === 'integrations' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
              <Cpu size={20} className="text-indigo-600 dark:text-indigo-400" />
              IntegraÃ§Ãµes e Chaves de API
            </h3>
            <div className="space-y-8">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Gateway principal de pagamento</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">O checkout e a ÃƒÂ¡rea de assinatura passam a seguir o provedor escolhido aqui.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${systemSettings.hasStripeSecretConfigured ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                      Stripe Secret {systemSettings.hasStripeSecretConfigured ? 'configurado' : 'pendente'}
                    </span>
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${systemSettings.hasStripeWebhookConfigured ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                      Stripe Webhook {systemSettings.hasStripeWebhookConfigured ? 'configurado' : 'pendente'}
                    </span>
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${systemSettings.hasMercadoPagoAccessTokenConfigured ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                      MP Access Token {systemSettings.hasMercadoPagoAccessTokenConfigured ? 'configurado' : 'pendente'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setLocalPaymentProvider('mercado_pago')}
                    className={`p-5 rounded-3xl border text-left transition-all ${localPaymentProvider === 'mercado_pago' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:border-blue-300'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Mercado Pago</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2">Checkout customizado com Pix, boleto, cartÃƒÂµes salvos e fluxo existente.</p>
                      </div>
                      {localPaymentProvider === 'mercado_pago' && <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                    </div>
                  </button>
                  <button
                    onClick={() => setLocalPaymentProvider('stripe')}
                    className={`p-5 rounded-3xl border text-left transition-all ${localPaymentProvider === 'stripe' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg shadow-indigo-500/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:border-indigo-300'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Stripe</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2">Checkout hospedado, Billing Portal, recorrÃƒÂªncia nativa e reembolsos por webhook.</p>
                      </div>
                      {localPaymentProvider === 'stripe' && <CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                    </div>
                  </button>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 space-y-4">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">ExperiÃªncia de Checkout</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">Define se o aluno conclui a compra dentro da plataforma ou por redirecionamento externo.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <button
                        onClick={() => setLocalPaymentCheckoutMode('internal')}
                        className={`p-4 rounded-2xl border text-left transition-all ${localPaymentCheckoutMode === 'internal' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/20'}`}
                      >
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Interno</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2">MantÃ©m o aluno no checkout da plataforma. Stripe usa formulÃ¡rio interno; Mercado Pago segue transparente.</p>
                      </button>
                      <button
                        onClick={() => setLocalPaymentCheckoutMode('redirect')}
                        className={`p-4 rounded-2xl border text-left transition-all ${localPaymentCheckoutMode === 'redirect' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/20'}`}
                      >
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Redirecionamento</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2">Usa a tela externa do provedor quando disponÃ­vel. Ãštil para operaÃ§Ã£o rÃ¡pida e troubleshooting.</p>
                      </button>
                    </div>
                  </div>
                  <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 space-y-4">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Cofre de CartÃ£o</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">Controla onde a plataforma trata os cartÃµes salvos e qual integraÃ§Ã£o abastece a Ã¡rea de cobranÃ§a.</p>
                    </div>
                    <select
                      value={localCardVaultProvider}
                      onChange={e => setLocalCardVaultProvider(e.target.value as 'local' | 'mercado_pago' | 'stripe')}
                      className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="local">Local</option>
                      <option value="mercado_pago">Mercado Pago</option>
                      <option value="stripe">Stripe</option>
                    </select>
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Leitura prÃ¡tica</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium mt-2 leading-relaxed">
                        Local mantÃ©m o espelho de cartÃµes e a gestÃ£o dentro da plataforma. Stripe e Mercado Pago usam o cofre do provedor, mas continuam aparecendo e sendo gerenciados na interface interna quando o fluxo suportar isso.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* IA e Dados */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Gemini AI Key</label>
                  <input type="password" value={localApiKey} onChange={e => setLocalApiKey(e.target.value)} placeholder="AIzaSy..."
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Firebase API Key</label>
                  <input type="password" value={localFirebaseKey} onChange={e => setLocalFirebaseKey(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-amber-500/20" />
                </div>
              </div>

              {/* reCAPTCHA */}
              <div className="space-y-4">
                <div className="p-5 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Exigir reCAPTCHA em areas sensiveis</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">Quando ativado, o desafio aparece em login, cadastro, recuperacao de senha, checkout, cancelamento de assinatura e outras acoes protegidas.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocalRecaptchaEnabled(prev => !prev)}
                    className={`relative inline-flex h-9 w-16 items-center rounded-full border transition-all ${localRecaptchaEnabled ? 'border-emerald-500 bg-emerald-500/90' : 'border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-800'}`}
                  >
                    <span
                      className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform ${localRecaptchaEnabled ? 'translate-x-8' : 'translate-x-1'}`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Google reCAPTCHA Site Key (Frontend)</label>
                  <input type="text" value={localRecaptchaSiteKey} onChange={e => setLocalRecaptchaSiteKey(e.target.value)} placeholder="6LeI..."
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Google reCAPTCHA Secret Key (Backend)</label>
                  <input type="password" value={localRecaptchaSecretKey} onChange={e => setLocalRecaptchaSecretKey(e.target.value)} placeholder="6LeI..."
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
              </div>
              </div>

              {/* Pagamentos */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 space-y-4">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Stripe</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">Indicado para assinatura recorrente com Checkout Session e Billing Portal.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Publishable Key (frontend)</label>
                    <input type="text" value={localStripePublishableKey} onChange={e => setLocalStripePublishableKey(e.target.value)} placeholder="pk_live_..."
                      className="w-full bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Secret Key (backend)</label>
                    <input type="password" value={localStripeSecretKey} onChange={e => setLocalStripeSecretKey(e.target.value)} placeholder="sk_live_..."
                      className="w-full bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Webhook Secret (backend)</label>
                    <input type="password" value={localStripeWebhookSecret} onChange={e => setLocalStripeWebhookSecret(e.target.value)} placeholder="whsec_..."
                      className="w-full bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                  <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 px-4 py-3">
                    <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">Webhook Stripe</p>
                    <p className="text-[10px] font-mono text-indigo-700/80 dark:text-indigo-300/80 mt-1 break-all">{stripeWebhookUrl}</p>
                  </div>
                </div>
                <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 space-y-4">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Mercado Pago</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">MantÃƒÂ©m o checkout transparente com Pix, boleto e cartÃƒÂµes salvos locais.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Public Key (frontend)</label>
                    <input type="text" value={localMercadoPagoPublicKey} onChange={e => setLocalMercadoPagoPublicKey(e.target.value)} placeholder="APP_USR-..."
                      className="w-full bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Access Token (backend)</label>
                    <input type="password" value={localMercadoPagoAccessToken} onChange={e => setLocalMercadoPagoAccessToken(e.target.value)} placeholder="APP_USR-..."
                      className="w-full bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Webhook Secret (backend)</label>
                    <input type="password" value={localMercadoPagoWebhookSecret} onChange={e => setLocalMercadoPagoWebhookSecret(e.target.value)} placeholder="Webhook secret"
                      className="w-full bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 px-4 py-3">
                    <p className="text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">Webhook Mercado Pago</p>
                    <p className="text-[10px] font-mono text-blue-700/80 dark:text-blue-300/80 mt-1 break-all">{mercadoPagoWebhookUrl}</p>
                  </div>
                </div>
              </div>

              {/* Analytics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Google Analytics ID</label>
                  <input type="text" value={localGaId} onChange={e => setLocalGaId(e.target.value)} placeholder="G-XXXXXXXXXX"
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Meta Pixel ID</label>
                  <input type="text" value={localPixelId} onChange={e => setLocalPixelId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
              </div>
            </div>
          </div>
        )}

        {settingActiveTab === 'email' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
              <Mail size={20} className="text-indigo-600 dark:text-indigo-400" />
              Servidor de E-mail (SMTP)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Host SMTP</label>
                  <input type="text" value={localSmtpHost} onChange={e => setLocalSmtpHost(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Porta</label>
                    <input type="number" value={localSmtpPort} onChange={e => setLocalSmtpPort(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">SeguranÃ§a</label>
                    <select value={localSmtpSecure} onChange={e => setLocalSmtpSecure(e.target.value as 'tls' | 'ssl')}
                      className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4">
                      <option value="tls">TLS</option>
                      <option value="ssl">SSL</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">UsuÃ¡rio / E-mail</label>
                  <input type="text" value={localSmtpUser} onChange={e => setLocalSmtpUser(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                  <input type="password" value={localSmtpPass} onChange={e => setLocalSmtpPass(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4" />
                </div>
              </div>
            </div>
          </div>
        )}

        {settingActiveTab === 'ads' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <Megaphone size={20} />
                  GestÃ£o de AnÃºncios
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Configure AdSense, Facebook Ads e banners</p>
              </div>
              <button
                onClick={() => setLocalAdsEnabled(!localAdsEnabled)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${localAdsEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${localAdsEnabled ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">AdSense Client ID</label>
                  <input type="text" value={localAdsenseId} onChange={e => setLocalAdsenseId(e.target.value)} placeholder="ca-pub-..."
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Facebook Ads ID</label>
                  <input type="text" value={localFacebookAdsId} onChange={e => setLocalFacebookAdsId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Banner Topo (HTML)</label>
                  <textarea value={localAdTop} onChange={e => setLocalAdTop(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[10px] font-mono rounded-xl py-3 px-4 h-20 resize-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Banner Lateral (Sidebar)</label>
                  <textarea value={localAdSidebar} onChange={e => setLocalAdSidebar(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[10px] font-mono rounded-xl py-3 px-4 h-20 resize-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Banner RodapÃ© (Bottom)</label>
                  <textarea value={localAdBottom} onChange={e => setLocalAdBottom(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[10px] font-mono rounded-xl py-3 px-4 h-20 resize-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {settingActiveTab === 'performance' && (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
              <Database size={20} className="text-indigo-600 dark:text-indigo-400" />
              OtimizaÃ§Ã£o e Cache
            </h3>
            <CacheManagement />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Controle operacional do cache da API.
 * Fica colocalizado com as configuraÃ§Ãµes porque sÃ³ Ã© acessado pela
 * aba de performance e compartilha o mesmo contexto administrativo.
 */
const CacheManagement = () => {
  const { addToast } = useToast();
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchCacheStats = async () => {
    try {
      const data = await adminService.getCacheStats();
      setCacheStats(data);
    } catch (error) {
      console.error('Erro ao buscar estatÃ­sticas de cache:', error);
      setCacheStats({ total_files: 0, valid_entries: 0, expired_entries: 0, total_size_mb: 0, enabled: true });
      addToast('Nao foi possivel carregar as estatisticas de cache.', 'error');
    }
  };

  useEffect(() => {
    fetchCacheStats();
  }, []);

  const handleToggleCache = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const nextMessage = await adminService.toggleCache(!cacheStats?.enabled);
      setMessage(nextMessage);
      await fetchCacheStats();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Erro ao atualizar configuraÃ§Ãµes');
    }
    setLoading(false);
  };

  const handleClearCache = async () => {
    if (!window.confirm('Tem certeza que deseja limpar todo o cache?')) return;
    if (loading) return;
    setLoading(true);
    try {
      const nextMessage = await adminService.clearCache();
      setMessage(nextMessage);
      await fetchCacheStats();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      setMessage('Erro ao limpar cache');
      addToast('Nao foi possivel limpar o cache.', 'error');
    }
    setLoading(false);
  };

  const handleCleanExpired = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const nextMessage = await adminService.cleanExpiredCache();
      setMessage(nextMessage);
      await fetchCacheStats();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Erro ao limpar cache expirado:', error);
      setMessage('Erro ao limpar cache expirado');
      addToast('Nao foi possivel limpar entradas expiradas do cache.', 'error');
    }
    setLoading(false);
  };

  if (!cacheStats) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {message && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-medium animate-slide-up">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total de Arquivos</p>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{cacheStats.total_files || 0}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Entradas VÃ¡lidas</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{cacheStats.valid_entries || 0}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
          <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Entradas Expiradas</p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{cacheStats.expired_entries || 0}</p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
          <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Tamanho Total</p>
          <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{cacheStats.total_size_mb || 0} MB</p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Enable/Disable */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-1">Status do Cache</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {cacheStats.enabled ? 'Cache ativo - Respostas em cache' : 'Cache desativado - Sem otimizaÃ§Ã£o'}
            </p>
          </div>
          <button
            onClick={handleToggleCache}
            disabled={loading}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${cacheStats.enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${cacheStats.enabled ? 'right-1' : 'left-1'
                }`}
            />
          </button>
        </div>

        {/* TTL Setting */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
          <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-1">Tempo de Vida (TTL)</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">DuraÃ§Ã£o padrÃ£o do cache</p>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-indigo-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{cacheStats.default_ttl || 300} segundos</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleCleanExpired}
          disabled={loading}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-200 dark:shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={16} />
          Limpar Expirados
        </button>
        <button
          onClick={handleClearCache}
          disabled={loading}
          className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200 dark:shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X size={16} />
          Limpar Todo Cache
        </button>
        <button
          onClick={fetchCacheStats}
          disabled={loading}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
          Atualizar
        </button>
      </div>
    </div>
  );
};

export default AdminSettings;


