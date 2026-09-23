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

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, CheckCircle2, Clock, Loader2, Mail, Megaphone, MonitorSmartphone, Palette, Percent, Plus, Send, Settings2, Trash2, Zap } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import type { AppPromotionTheme, DiscountCode, MarketingCampaignAutomationRule, MarketingCampaignBanner, Plan, SystemSettings } from '@types';
import { themeConfig } from '@constants/themes';
import { planService } from '@services/plans';
import { notificationService } from '@services/notifications';
import {
  normalizeCampaignBannerActionUrl,
  normalizePromotionNotificationActionUrl,
  PROMOTION_RUNTIME_STATE_LABELS,
  resolvePromotionRuntimeState,
} from '@services/marketing/promotionCampaign';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SEGMENTED_TABS_CLASS,
  ADMIN_TAB_BUTTON_ACTIVE_CLASS,
  ADMIN_TAB_BUTTON_IDLE_CLASS,
} from '../shared/adminPanelStyles';

interface AdminMarketingProps {
  systemSettings: SystemSettings;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
  forcedSection?: 'coupons' | 'promo' | 'themes';
  hideSectionTabs?: boolean;
}

type CouponTargetType = 'all' | 'plan' | 'item';
const DEFAULT_LIMITED_OFFER_EXTENSION_MS = 7 * 24 * 60 * 60 * 1000;

const CAMPAIGN_BANNER_PLACEMENTS: Array<{ value: MarketingCampaignBanner['placement']; label: string }> = [
  { value: 'topbar', label: 'Topo do site' },
  { value: 'home-hero', label: 'Home / hero' },
  { value: 'question-sidebar', label: 'Questao / lateral' },
  { value: 'practice-sidebar', label: 'Pratica / lateral' },
  { value: 'checkout', label: 'Checkout' },
  { value: 'marketplace', label: 'Marketplace' },
];

const CAMPAIGN_AUTOMATION_CONDITIONS: Array<{ value: MarketingCampaignAutomationRule['condition']; label: string }> = [
  { value: 'recent_signup', label: 'Criou conta recentemente' },
  { value: 'near_subscription', label: 'Chegou perto de assinar' },
  { value: 'inactive_7_days', label: 'Inativo ha 7 dias' },
  { value: 'trial_ending', label: 'Teste perto do fim' },
  { value: 'saved_questions', label: 'Salvou questoes' },
  { value: 'elite_upgrade', label: 'Elegivel para Elite' },
];

const CAMPAIGN_CHANNELS: Array<{ value: MarketingCampaignAutomationRule['channel']; label: string }> = [
  { value: 'email', label: 'Email' },
  { value: 'notification', label: 'Notificacao' },
  { value: 'both', label: 'Email + notificacao' },
];

interface CouponDraft extends DiscountCode {
  code: string;
  discountPercentage: number;
  discountAmount?: number;
  maxUses: number;
  uses: number;
  autoApply: boolean;
  targetType: CouponTargetType;
  targetId: string | null;
  newUsersOnly: boolean;
  firstPurchaseOnly: boolean;
  allowedUserIds: string[];
  allowedUserEmails: string[];
}

const createDefaultCouponDraft = (): CouponDraft => ({
  code: '',
  discountPercentage: 10,
  discountAmount: 0,
  maxUses: 100,
  uses: 0,
  autoApply: false,
  expiresAt: undefined,
  targetType: 'all',
  targetId: null,
  newUsersOnly: false,
  firstPurchaseOnly: false,
  allowedUserIds: [],
  allowedUserEmails: [],
});

const createCampaignEntityId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const createDefaultCampaignBanner = (): MarketingCampaignBanner => ({
  id: createCampaignEntityId('campaign-banner'),
  enabled: true,
  placement: 'topbar',
  headline: 'Oferta ativa no ConcursoMestre',
  description: 'Mostre a mensagem principal da campanha nesta area.',
  ctaLabel: 'Ver oferta',
  actionUrl: '/planos',
  backgroundColor: '#0f172a',
});

const createDefaultCampaignAutomation = (): MarketingCampaignAutomationRule => ({
  id: createCampaignEntityId('campaign-automation'),
  enabled: true,
  condition: 'near_subscription',
  channel: 'email',
  delayHours: 2,
  subject: 'Falta pouco para liberar seus recursos',
  message: 'Convide o aluno a concluir a assinatura com uma mensagem curta e objetiva.',
});

const normalizePromotionDraft = (promotion: SystemSettings['activePromotion']): SystemSettings['activePromotion'] => ({
  ...promotion,
  status: promotion.status || (promotion.isActive ? 'active' : 'paused'),
  notificationTitle: promotion.notificationTitle || promotion.name || 'Campanha ConcursoMestre',
  notificationMessage: promotion.notificationMessage || promotion.bannerText || '',
  notificationActionUrl: normalizePromotionNotificationActionUrl(promotion.notificationActionUrl, promotion),
  emailEnabled: Boolean(promotion.emailEnabled),
  emailSubject: promotion.emailSubject || promotion.name || 'Campanha ConcursoMestre',
  emailPreview: promotion.emailPreview || promotion.bannerText || '',
  emailBody: promotion.emailBody || 'Escreva a mensagem principal da campanha de email.',
  siteBanners: (Array.isArray(promotion.siteBanners) ? promotion.siteBanners : [createDefaultCampaignBanner()])
    .map((banner) => ({
      ...banner,
      actionUrl: normalizeCampaignBannerActionUrl(banner.actionUrl, promotion),
    })),
  automationRules: Array.isArray(promotion.automationRules) ? promotion.automationRules : [],
});

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

const getCouponRuntimeStatus = (coupon: CouponDraft) => {
  if (coupon.expiresAt) {
    const expiresAtTimestamp = new Date(coupon.expiresAt).getTime();
    if (!Number.isNaN(expiresAtTimestamp) && expiresAtTimestamp < Date.now()) {
      return {
        label: 'Expirado',
        className: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
      };
    }
  }

  if (coupon.maxUses > 0 && Number(coupon.uses || 0) >= coupon.maxUses) {
    return {
      label: 'Esgotado',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    };
  }

  return {
    label: 'Ativo',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  };
};

const normalizeCouponAudienceList = (value: unknown, lowercase = false) => {
  const source = typeof value === 'string'
    ? value.split(/[\r\n,;]+/)
    : Array.isArray(value)
      ? value
      : [];

  return Array.from(new Set(source
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => (lowercase ? item.toLowerCase() : item))));
};

const formatCouponDiscount = (coupon: CouponDraft) => {
  const fixedAmount = Number(coupon.discountAmount || 0);
  if (fixedAmount > 0) {
    return `R$ ${fixedAmount.toFixed(2).replace('.', ',')} OFF`;
  }

  return `${Number(coupon.discountPercentage || 0)}% OFF`;
};

const normalizeCouponDraft = (coupon?: Partial<DiscountCode> | null): CouponDraft => {
  const targetType = (() => {
    const candidate = String(coupon?.targetType || 'all').trim().toLowerCase();
    return candidate === 'plan' || candidate === 'item' ? candidate : 'all';
  })() as CouponTargetType;
  const targetId = targetType === 'all'
    ? null
    : String(coupon?.targetId || '').trim() || null;

  return {
    code: String(coupon?.code || '').trim().toUpperCase(),
    discountPercentage: Number(coupon?.discountPercentage || 0),
    discountAmount: coupon?.discountAmount !== undefined ? Number(coupon.discountAmount) : 0,
    maxUses: Math.max(0, Number(coupon?.maxUses || 0)),
    uses: Math.max(0, Number(coupon?.uses || 0)),
    expiresAt: coupon?.expiresAt || undefined,
    autoApply: Boolean(coupon?.autoApply),
    targetType,
    targetId,
    newUsersOnly: Boolean(coupon?.newUsersOnly),
    firstPurchaseOnly: Boolean(coupon?.firstPurchaseOnly),
    allowedUserIds: normalizeCouponAudienceList(coupon?.allowedUserIds),
    allowedUserEmails: normalizeCouponAudienceList(coupon?.allowedUserEmails, true),
  };
};

/**
 * Centraliza cupons, campanhas e temas do dominio financeiro.
 * O componente trabalha com rascunhos locais e so confirma sucesso
 * depois que a persistencia administrativa termina no backend.
 *
 * @since 1.0.0
 */
const AdminMarketing = ({
  systemSettings,
  saveSystemSettingsNow,
  forcedSection,
  hideSectionTabs = false,
}: AdminMarketingProps) => {
  const { addToast } = useToast();
  const [activeSection, setActiveSection] = useState<'coupons' | 'promo' | 'themes'>(forcedSection || 'coupons');
  const [draftPromotion, setDraftPromotion] = useState(() => normalizePromotionDraft(systemSettings.activePromotion));
  const [draftTheme, setDraftTheme] = useState<AppPromotionTheme>(systemSettings.activeTheme || 'default');
  const [draftCoupons, setDraftCoupons] = useState<CouponDraft[]>((systemSettings.coupons || []).map((coupon) => normalizeCouponDraft(coupon)));
  const [newCoupon, setNewCoupon] = useState<CouponDraft>(createDefaultCouponDraft());
  const [limitedOfferCountdown, setLimitedOfferCountdown] = useState(systemSettings.limitedOfferCountdown);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [pendingDeleteCoupon, setPendingDeleteCoupon] = useState<CouponDraft | null>(null);
  const promotionRuntimeState = resolvePromotionRuntimeState(draftPromotion);
  const promotionRuntimeStateLabel = PROMOTION_RUNTIME_STATE_LABELS[promotionRuntimeState];
  const hasSavedBanners = (draftPromotion.siteBanners || []).length > 0;

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setDraftPromotion(normalizePromotionDraft(systemSettings.activePromotion));
      setDraftTheme(systemSettings.activeTheme || 'default');
      setDraftCoupons((systemSettings.coupons || []).map((coupon) => normalizeCouponDraft(coupon)));
      setLimitedOfferCountdown(systemSettings.limitedOfferCountdown);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [systemSettings.activePromotion, systemSettings.activeTheme, systemSettings.coupons, systemSettings.limitedOfferCountdown]);

  useEffect(() => {
    if (!forcedSection) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setActiveSection(forcedSection);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [forcedSection]);

  useEffect(() => {
    let active = true;

    const loadPlans = async () => {
      try {
        const plans = await planService.getPlans();
        if (active) {
          setAvailablePlans(plans);
        }
      } catch {
        if (active) {
          setAvailablePlans([]);
        }
      }
    };

    void loadPlans();

    return () => {
      active = false;
    };
  }, []);

  const themes = useMemo((): { value: AppPromotionTheme; label: string }[] => ([
    { value: 'default', label: 'Padrão (Azul/Slate)' },
    { value: 'black-friday', label: 'Black Friday (Preto/Roxo)' },
    { value: 'black-november', label: 'Black November' },
    { value: 'estudante', label: 'Dia do Estudante' },
    { value: 'sao-joao', label: 'São João' },
    { value: 'carnaval', label: 'Carnaval' },
    { value: 'ano-novo', label: 'Ano Novo' },
    { value: 'pascoa', label: 'Páscoa' },
    { value: 'consumidor', label: 'Semana do Consumidor' },
  ]), []);

  const planTargetOptions = useMemo(() => availablePlans.map((plan) => ({
    value: String(plan.id),
    label: `${plan.name} (#${plan.id})`,
  })), [availablePlans]);

  const describeCouponTarget = (coupon: CouponDraft) => {
    if (coupon.targetType === 'plan') {
      const matchingPlan = availablePlans.find((plan) => String(plan.id) === String(coupon.targetId || ''));
      return matchingPlan ? `Plano: ${matchingPlan.name} (#${matchingPlan.id})` : `Plano #${coupon.targetId || 'n/d'}`;
    }

    if (coupon.targetType === 'item') {
      return `Item #${coupon.targetId || 'n/d'}`;
    }

    return 'Todos os alvos';
  };

  const describeCouponAudience = (coupon: CouponDraft) => {
    const parts: string[] = [];
    if (coupon.newUsersOnly) {
      parts.push('somente novos usuarios');
    }
    if (coupon.firstPurchaseOnly) {
      parts.push('sem compra anterior');
    }
    if (coupon.allowedUserIds.length || coupon.allowedUserEmails.length) {
      parts.push(`${coupon.allowedUserIds.length + coupon.allowedUserEmails.length} usuario(s) autorizado(s)`);
    }

    return parts.length ? parts.join(' · ') : 'Sem restricao de usuario';
  };

  const persistMarketingSettings = async (nextSettings: SystemSettings, successMessage: string, actionKey: string) => {
    if (savingKey) {
      return false;
    }

    setSavingKey(actionKey);

    try {
      await saveSystemSettingsNow(nextSettings);
      addToast(successMessage, 'success');
      return true;
    } catch {
      addToast('Não foi possível salvar as alterações de marketing.', 'error');
      return false;
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateCoupon = async () => {
    const nextCode = newCoupon.code.trim().toUpperCase();
    const normalizedTargetId = newCoupon.targetType === 'all'
      ? null
      : String(newCoupon.targetId || '').trim() || null;
    const discountPercentage = Number(newCoupon.discountPercentage || 0);
    const discountAmount = Number(newCoupon.discountAmount || 0);

    if (!nextCode) {
      addToast('Informe um código para o cupom.', 'warning');
      return;
    }

    if (draftCoupons.some((coupon) => coupon.code.toUpperCase() === nextCode)) {
      addToast('Esse cupom já existe.', 'warning');
      return;
    }

    if (discountPercentage <= 0 && discountAmount <= 0) {
      addToast('O desconto precisa ser maior que zero.', 'warning');
      return;
    }

    if (discountPercentage > 0 && discountAmount > 0) {
      addToast('Use desconto percentual ou fixo, nao os dois no mesmo cupom.', 'warning');
      return;
    }

    if (discountPercentage > 100) {
      addToast('O desconto percentual nao pode passar de 100%.', 'warning');
      return;
    }

    if (newCoupon.maxUses < 0) {
      addToast('O limite de usos nao pode ser negativo.', 'warning');
      return;
    }

    if (newCoupon.targetType !== 'all' && !normalizedTargetId) {
      addToast('Defina o tipo e o ID do alvo do cupom.', 'warning');
      return;
    }

    const nextCoupons = [
      ...draftCoupons,
      normalizeCouponDraft({
        code: nextCode,
        discountPercentage,
        discountAmount,
        maxUses: Number(newCoupon.maxUses),
        uses: 0,
        autoApply: Boolean(newCoupon.autoApply),
        expiresAt: newCoupon.expiresAt || undefined,
        targetType: newCoupon.targetType,
        targetId: normalizedTargetId,
        newUsersOnly: Boolean(newCoupon.newUsersOnly),
        firstPurchaseOnly: Boolean(newCoupon.firstPurchaseOnly),
        allowedUserIds: newCoupon.allowedUserIds,
        allowedUserEmails: newCoupon.allowedUserEmails,
      }),
    ];
    const nextSettings = { ...systemSettings, coupons: nextCoupons };

    if (await persistMarketingSettings(nextSettings, 'Cupom criado com sucesso.', 'create-coupon')) {
      setDraftCoupons(nextCoupons);
      setNewCoupon(createDefaultCouponDraft());
    }
  };

  const handleConfirmDeleteCoupon = async () => {
    if (!pendingDeleteCoupon) {
      return;
    }

    const nextCoupons = draftCoupons.filter((coupon) => coupon.code !== pendingDeleteCoupon.code);
    const nextSettings = { ...systemSettings, coupons: nextCoupons };

    if (await persistMarketingSettings(nextSettings, 'Cupom removido com sucesso.', `delete-coupon-${pendingDeleteCoupon.code}`)) {
      setDraftCoupons(nextCoupons);
      setPendingDeleteCoupon(null);
    }
  };

  const handleSavePromotion = async () => {
    const normalizedPromotion = normalizePromotionDraft(draftPromotion);
    if (normalizedPromotion.startsAt && normalizedPromotion.endsAt
      && new Date(normalizedPromotion.startsAt).getTime() >= new Date(normalizedPromotion.endsAt).getTime()) {
      addToast('A data de encerramento precisa ser posterior ao inicio da campanha.', 'warning');
      return;
    }
    const nextSettings = { ...systemSettings, activePromotion: normalizedPromotion };
    const saved = await persistMarketingSettings(nextSettings, 'Campanha salva com sucesso.', 'save-promotion');

    if (saved) {
      setDraftPromotion(normalizedPromotion);
    }
  };

  const handleSendCampaignNotification = async () => {
    if (savingKey) {
      return;
    }

    const title = String(draftPromotion.notificationTitle || draftPromotion.name || '').trim();
    const message = String(draftPromotion.notificationMessage || draftPromotion.bannerText || '').trim();

    if (!title || !message) {
      addToast('Defina titulo e mensagem antes de disparar a notificacao.', 'warning');
      return;
    }

    setSavingKey('send-campaign-notification');

    try {
      const result = await notificationService.sendNotification(
        'all',
        title,
        message,
        'info',
        'system',
        normalizePromotionNotificationActionUrl(draftPromotion.notificationActionUrl, draftPromotion),
      );

      if (result.success) {
        addToast('Notificacao enviada para os usuarios.', 'success');
      } else {
        addToast('Nao foi possivel enviar a notificacao.', 'error');
      }
    } finally {
      setSavingKey(null);
    }
  };

  const patchCampaignBanner = (bannerId: string, updater: (banner: MarketingCampaignBanner) => MarketingCampaignBanner) => {
    setDraftPromotion((current) => ({
      ...current,
      siteBanners: (current.siteBanners || []).map((banner) => (banner.id === bannerId ? updater(banner) : banner)),
    }));
  };

  const patchCampaignAutomation = (automationId: string, updater: (rule: MarketingCampaignAutomationRule) => MarketingCampaignAutomationRule) => {
    setDraftPromotion((current) => ({
      ...current,
      automationRules: (current.automationRules || []).map((rule) => (rule.id === automationId ? updater(rule) : rule)),
    }));
  };

  const handleSaveTheme = async () => {
    const nextSettings = { ...systemSettings, activeTheme: draftTheme };
    await persistMarketingSettings(nextSettings, 'Tema promocional salvo com sucesso.', 'save-theme');
  };

  const handleSaveLimitedOfferCountdown = async () => {
    const normalizedCountdown = limitedOfferCountdown?.enabled
      ? {
        ...(limitedOfferCountdown || { enabled: true, endsAt: '' }),
        endsAt: resolveFutureLimitedOfferEndsAt(limitedOfferCountdown?.endsAt),
      }
      : limitedOfferCountdown;
    const nextSettings = { ...systemSettings, limitedOfferCountdown: normalizedCountdown };
    if (normalizedCountdown?.enabled && normalizedCountdown.endsAt !== limitedOfferCountdown?.endsAt) {
      setLimitedOfferCountdown(normalizedCountdown);
      addToast('Definimos automaticamente uma data final futura de 7 dias para a oferta limitada.', 'info');
    }
    await persistMarketingSettings(nextSettings, 'Oferta limitada atualizada.', 'save-limited-offer');
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <AdminConfirmDialog
        isOpen={!!pendingDeleteCoupon}
        title="Excluir cupom"
        description={`O cupom ${pendingDeleteCoupon?.code || ''} será removido das configurações do sistema. Essa ação só será confirmada depois da persistência real no backend.`}
        confirmLabel="Excluir cupom"
        tone="danger"
        loading={savingKey === `delete-coupon-${pendingDeleteCoupon?.code || ''}`}
        onConfirm={() => void handleConfirmDeleteCoupon()}
        onCancel={() => setPendingDeleteCoupon(null)}
      />

      {!hideSectionTabs ? (
        <div className={`${ADMIN_SEGMENTED_TABS_CLASS} overflow-hidden no-scrollbar`}>
          <button
            onClick={() => setActiveSection('coupons')}
            className={`flex items-center gap-2 rounded-sm border px-5 py-2 text-xs font-black uppercase tracking-widest transition-all ${
              activeSection === 'coupons' ? ADMIN_TAB_BUTTON_ACTIVE_CLASS : ADMIN_TAB_BUTTON_IDLE_CLASS
            }`}
          >
            <Percent size={14} /> Cupons de Desconto
          </button>
          <button
            onClick={() => setActiveSection('promo')}
            className={`flex items-center gap-2 rounded-sm border px-5 py-2 text-xs font-black uppercase tracking-widest transition-all ${
              activeSection === 'promo' ? ADMIN_TAB_BUTTON_ACTIVE_CLASS : ADMIN_TAB_BUTTON_IDLE_CLASS
            }`}
          >
            <Megaphone size={14} /> Campanhas
          </button>
          <button
            onClick={() => setActiveSection('themes')}
            className={`flex items-center gap-2 rounded-sm border px-5 py-2 text-xs font-black uppercase tracking-widest transition-all ${
              activeSection === 'themes' ? ADMIN_TAB_BUTTON_ACTIVE_CLASS : ADMIN_TAB_BUTTON_IDLE_CLASS
            }`}
          >
            <Palette size={14} /> Temas Visuais
          </button>
        </div>
      ) : null}

      {activeSection === 'coupons' && (
        <div className="space-y-4">
          <div className="rounded-sm border border-slate-300 bg-white p-5 shadow-none transition-colors dark:border-slate-700 dark:bg-slate-900">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Código</label>
                <input
                  type="text"
                  value={newCoupon.code}
                  onChange={(event) => setNewCoupon((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  className={`${ADMIN_FIELD_CLASS} w-full font-black uppercase`}
                  placeholder="EX: APROVADO20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Desconto (%)</label>
                <input
                  type="number"
                  value={newCoupon.discountPercentage}
                  onChange={(event) => setNewCoupon((current) => ({ ...current, discountPercentage: Number(event.target.value) }))}
                  className={`${ADMIN_FIELD_CLASS} w-full`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Desconto fixo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newCoupon.discountAmount || 0}
                  onChange={(event) => setNewCoupon((current) => ({ ...current, discountAmount: Number(event.target.value) }))}
                  className={`${ADMIN_FIELD_CLASS} w-full`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Max usos</label>
                <input
                  type="number"
                  min="0"
                  value={newCoupon.maxUses}
                  onChange={(event) => setNewCoupon((current) => ({ ...current, maxUses: Number(event.target.value) }))}
                  className={`${ADMIN_FIELD_CLASS} w-full`}
                />
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">0 = ilimitado</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Aplicacao</label>
                <button
                  type="button"
                  onClick={() => setNewCoupon((current) => ({ ...current, autoApply: !current.autoApply }))}
                  className={`h-9 w-full rounded-sm border px-3 text-left text-xs font-black uppercase tracking-widest transition-colors ${
                    newCoupon.autoApply
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {newCoupon.autoApply ? 'Auto aplicado' : 'Manual'}
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Tipo alvo</label>
                <select
                  value={newCoupon.targetType}
                  onChange={(event) => {
                    const nextTargetType = event.target.value as CouponTargetType;
                    setNewCoupon((current) => ({
                      ...current,
                      targetType: nextTargetType,
                      targetId: nextTargetType === 'all' ? null : current.targetId,
                    }));
                  }}
                  className={`${ADMIN_FIELD_CLASS} w-full`}
                >
                  <option value="all">Todos</option>
                  <option value="plan">Plano</option>
                  <option value="item">Item</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">ID alvo</label>
                {newCoupon.targetType === 'plan' ? (
                  <select
                    value={newCoupon.targetId || ''}
                    onChange={(event) => setNewCoupon((current) => ({ ...current, targetId: event.target.value || null }))}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">Selecione</option>
                    {planTargetOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={newCoupon.targetType === 'all' ? '' : (newCoupon.targetId || '')}
                    disabled={newCoupon.targetType === 'all'}
                    onChange={(event) => setNewCoupon((current) => ({ ...current, targetId: event.target.value.trim() || null }))}
                    className={`${ADMIN_FIELD_CLASS} w-full disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-900 dark:disabled:text-slate-600`}
                    placeholder={newCoupon.targetType === 'item' ? 'Ex: 145' : 'Nao se aplica'}
                  />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Expira em</label>
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(newCoupon.expiresAt)}
                  onChange={(event) => setNewCoupon((current) => ({
                    ...current,
                    expiresAt: toIsoDateTimeValue(event.target.value) || undefined,
                  }))}
                  className={`${ADMIN_FIELD_CLASS} w-full`}
                />
              </div>
              <label className="flex min-h-10 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={newCoupon.newUsersOnly}
                  onChange={(event) => setNewCoupon((current) => ({ ...current, newUsersOnly: event.target.checked }))}
                />
                Somente novos usuarios
              </label>
              <label className="flex min-h-10 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={newCoupon.firstPurchaseOnly}
                  onChange={(event) => setNewCoupon((current) => ({ ...current, firstPurchaseOnly: event.target.checked }))}
                />
                Sem compra anterior
              </label>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Usuarios autorizados</label>
                <textarea
                  value={[...newCoupon.allowedUserEmails, ...newCoupon.allowedUserIds].join('\n')}
                  onChange={(event) => {
                    const values = normalizeCouponAudienceList(event.target.value);
                    setNewCoupon((current) => ({
                      ...current,
                      allowedUserEmails: values.filter((value) => value.includes('@')).map((value) => value.toLowerCase()),
                      allowedUserIds: values.filter((value) => !value.includes('@')),
                    }));
                  }}
                  className={`${ADMIN_FIELD_CLASS} min-h-24 w-full resize-y py-3`}
                  placeholder="E-mails ou IDs, um por linha"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => void handleCreateCoupon()}
                disabled={savingKey === 'create-coupon'}
                className={ADMIN_PRIMARY_BUTTON_CLASS}
              >
                {savingKey === 'create-coupon' ? <Loader2 size={14} className="animate-spin" /> : <Percent size={14} />}
                Criar cupom
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Cupons podem ser manuais ou auto aplicados. Voce pode limitar por usos, por data final, ou usar os dois ao mesmo tempo. Quando houver alvo definido, o backend restringe o uso ao tipo e ao ID configurados.
            </p>
          </div>

          <div className="rounded-sm border border-amber-200 bg-amber-50/40 p-5 shadow-none transition-colors dark:border-amber-900/30 dark:bg-amber-900/10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-lg font-black text-amber-700 dark:text-amber-300"><Clock size={20} /> Oferta por tempo limitado</h3>
                <p className="max-w-2xl text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  Countdown exibido na home, nos planos e no checkout enquanto estiver ativo e com data futura.
                </p>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-sm border border-amber-200 bg-white px-4 py-3 dark:border-amber-900/30 dark:bg-slate-900">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Countdown ativo</span>
                <input
                  type="checkbox"
                  checked={!!limitedOfferCountdown?.enabled}
                  onChange={(event) => setLimitedOfferCountdown((current) => ({
                    ...(current || { endsAt: '' }),
                    enabled: event.target.checked,
                    endsAt: event.target.checked
                      ? resolveFutureLimitedOfferEndsAt(current?.endsAt)
                      : (current?.endsAt || ''),
                  }))}
                  className="h-5 w-5 rounded border-slate-300 text-amber-500"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,280px),1fr]">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Data final da oferta</label>
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(limitedOfferCountdown?.endsAt)}
                  onChange={(event) => setLimitedOfferCountdown((current) => ({
                    ...(current || { enabled: false }),
                    endsAt: toIsoDateTimeValue(event.target.value),
                  }))}
                  className={`${ADMIN_FIELD_CLASS} w-full`}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-sm border border-white/80 bg-white/80 p-4 shadow-none dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Status</p>
                  <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">
                    {limitedOfferCountdown?.enabled ? 'Ativo' : 'Desativado'}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    O contador aparece quando estiver ativo e tiver uma data final futura.
                  </p>
                </div>
                <div className="rounded-sm border border-white/80 bg-white/80 p-4 shadow-none dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Encerramento</p>
                  <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
                    {limitedOfferCountdown?.endsAt
                      ? new Date(limitedOfferCountdown.endsAt).toLocaleString('pt-BR')
                      : 'Nao definido'}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Defina uma data futura para sincronizar home e checkout.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => void handleSaveLimitedOfferCountdown()}
                disabled={savingKey === 'save-limited-offer'}
                className="inline-flex items-center gap-2 rounded-sm border border-amber-600 bg-amber-600 px-5 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingKey === 'save-limited-offer' ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                Salvar oferta limitada
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {draftCoupons.map((coupon) => (
              <div key={coupon.code} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors dark:border-slate-800 dark:bg-slate-900">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-black text-slate-900 dark:text-slate-100">{coupon.code}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] ${getCouponRuntimeStatus(coupon).className}`}>
                      {getCouponRuntimeStatus(coupon).label}
                    </span>
                    {coupon.autoApply && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Auto
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatCouponDiscount(coupon)} · {coupon.uses || 0}/{coupon.maxUses || 'ilimitado'} usos
                    {coupon.expiresAt ? ` · expira ${new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}` : ''}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {describeCouponTarget(coupon)}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {describeCouponAudience(coupon)}
                  </p>
                </div>
                <button
                  onClick={() => setPendingDeleteCoupon(coupon)}
                  className="text-slate-300 transition-colors hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400"
                  aria-label={`Excluir cupom ${coupon.code}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {draftCoupons.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                Nenhum cupom cadastrado.
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'promo' && (
        <div className="space-y-6">
          <div className="space-y-6 rounded-sm border border-slate-300 bg-white p-5 shadow-none transition-colors dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-slate-100">
                  <Megaphone size={20} className="text-sky-700 dark:text-sky-300" /> Oferta global da home
                </h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Esta oferta controla a faixa global e o texto promocional legado. Campanhas operacionais sao gerenciadas no bloco acima.</p>
              </div>
              <button
                onClick={() => setDraftPromotion((current) => {
                  const isActive = !current.isActive;
                  return {
                    ...current,
                    isActive,
                    status: isActive ? (current.status === 'scheduled' ? 'scheduled' : 'active') : 'paused',
                  };
                })}
                className={`rounded-sm border px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                  draftPromotion.isActive ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                {draftPromotion.isActive ? 'Pausar publicacao' : 'Publicar oferta'}
              </button>
            </div>

            <div className={`grid gap-3 rounded-sm border p-4 md:grid-cols-3 ${promotionRuntimeState === 'active' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40'}`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Estado efetivo agora</p>
                <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">{promotionRuntimeStateLabel}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Faixa global</p>
                <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">{promotionRuntimeState === 'active' ? 'Pode aparecer para o publico' : 'Nao aparece para o publico'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Banners salvos</p>
                <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">{hasSavedBanners ? 'Disponiveis para futura publicacao' : 'Nenhum banner cadastrado'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Nome da campanha</label>
                <input
                  type="text"
                  value={draftPromotion.name}
                  onChange={(event) => setDraftPromotion((current) => ({ ...current, name: event.target.value }))}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                  aria-label="Nome da campanha"
                />
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Texto do banner</label>
                <input
                  type="text"
                  value={draftPromotion.bannerText}
                  onChange={(event) => setDraftPromotion((current) => ({ ...current, bannerText: event.target.value }))}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                  aria-label="Texto do banner"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Status de publicacao</label>
                <select
                  value={draftPromotion.status || (draftPromotion.isActive ? 'active' : 'paused')}
                  onChange={(event) => {
                    const status = event.target.value as NonNullable<SystemSettings['activePromotion']['status']>;
                    setDraftPromotion((current) => ({
                      ...current,
                      status,
                      isActive: status === 'active' || status === 'scheduled',
                    }));
                  }}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                  aria-label="Status de publicacao da oferta global"
                >
                  <option value="draft">Rascunho</option>
                  <option value="scheduled">Agendada</option>
                  <option value="active">Ativa</option>
                  <option value="paused">Pausada</option>
                  <option value="ended">Encerrada</option>
                  <option value="archived">Arquivada</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Inicio (opcional)</label>
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(draftPromotion.startsAt)}
                  onChange={(event) => setDraftPromotion((current) => ({
                    ...current,
                    startsAt: event.target.value ? toIsoDateTimeValue(event.target.value) : null,
                  }))}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                  aria-label="Inicio da campanha"
                />
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Encerramento (opcional)</label>
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(draftPromotion.endsAt)}
                  onChange={(event) => setDraftPromotion((current) => ({
                    ...current,
                    endsAt: event.target.value ? toIsoDateTimeValue(event.target.value) : null,
                  }))}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                  aria-label="Encerramento da campanha"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-sm border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/30 dark:bg-sky-900/10">
              <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-sky-700 dark:text-sky-300">
                <Zap size={14} /> Preview operacional
              </h4>
              <div className="rounded-sm border border-sky-200 bg-white p-4 dark:border-sky-900/40 dark:bg-slate-900">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{draftPromotion.notificationTitle || draftPromotion.name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{draftPromotion.notificationMessage || draftPromotion.bannerText}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className={ADMIN_MUTED_SURFACE_CLASS}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Banners ativos</p>
                  <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{(draftPromotion.siteBanners || []).filter((banner) => banner.enabled).length}</p>
                </div>
                <div className={ADMIN_MUTED_SURFACE_CLASS}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Automacoes ativas</p>
                  <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{(draftPromotion.automationRules || []).filter((rule) => rule.enabled).length}</p>
                </div>
                <div className={ADMIN_MUTED_SURFACE_CLASS}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</p>
                  <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{draftPromotion.emailEnabled ? 'Ativo' : 'Pausado'}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="space-y-4 rounded-sm border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/30 dark:bg-sky-900/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-sky-700 dark:text-sky-300">
                      <Bell size={14} /> Notificacao manual
                    </h4>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Dispare uma chamada direta para todos os usuarios quando a campanha estiver pronta.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSendCampaignNotification()}
                    disabled={savingKey === 'send-campaign-notification'}
                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                  >
                    {savingKey === 'send-campaign-notification' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Enviar
                  </button>
                </div>

                <div className="grid gap-4">
                  <input
                    type="text"
                    value={draftPromotion.notificationTitle || ''}
                    onChange={(event) => setDraftPromotion((current) => ({ ...current, notificationTitle: event.target.value }))}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                    placeholder="Titulo da notificacao"
                    aria-label="Titulo da notificacao"
                  />
                  <textarea
                    value={draftPromotion.notificationMessage || ''}
                    onChange={(event) => setDraftPromotion((current) => ({ ...current, notificationMessage: event.target.value }))}
                    className={`${ADMIN_FIELD_CLASS} min-h-[88px] w-full resize-none`}
                    placeholder="Mensagem curta que aparece no sino do usuario"
                    aria-label="Mensagem curta da notificacao"
                  />
                  <input
                    type="text"
                    value={draftPromotion.notificationActionUrl || ''}
                    onChange={(event) => setDraftPromotion((current) => ({ ...current, notificationActionUrl: event.target.value }))}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                    placeholder="/planos"
                    aria-label="Link da notificacao"
                  />
                </div>
              </section>

              <section className="space-y-4 rounded-sm border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                      <Mail size={14} /> Email da campanha
                    </h4>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Modelo base usado pelas automacoes de email desta campanha.</p>
                  </div>
                  <label className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:border-emerald-900/40 dark:bg-slate-900 dark:text-emerald-300">
                    <input
                      type="checkbox"
                      checked={!!draftPromotion.emailEnabled}
                      onChange={(event) => setDraftPromotion((current) => ({ ...current, emailEnabled: event.target.checked }))}
                    />
                    Ativo
                  </label>
                </div>

                <div className="grid gap-4">
                  <input
                    type="text"
                    value={draftPromotion.emailSubject || ''}
                    onChange={(event) => setDraftPromotion((current) => ({ ...current, emailSubject: event.target.value }))}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                    placeholder="Assunto do email"
                    aria-label="Assunto do email"
                  />
                  <input
                    type="text"
                    value={draftPromotion.emailPreview || ''}
                    onChange={(event) => setDraftPromotion((current) => ({ ...current, emailPreview: event.target.value }))}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full font-semibold`}
                    placeholder="Pre-header / chamada curta"
                    aria-label="Pre-header do email"
                  />
                  <textarea
                    value={draftPromotion.emailBody || ''}
                    onChange={(event) => setDraftPromotion((current) => ({ ...current, emailBody: event.target.value }))}
                    className={`${ADMIN_FIELD_CLASS} min-h-[120px] w-full resize-none`}
                    placeholder="Corpo do email"
                    aria-label="Corpo do email"
                  />
                </div>
              </section>
            </div>

            <section className="space-y-4 rounded-sm border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                    <MonitorSmartphone size={14} /> Banners por area
                  </h4>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Edite os textos e areas sem publica-los por acidente. A oferta precisa estar publicada para qualquer faixa aparecer.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraftPromotion((current) => ({ ...current, siteBanners: [...(current.siteBanners || []), createDefaultCampaignBanner()] }))}
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  <Plus size={14} />
                  Banner
                </button>
              </div>

              <div className="space-y-3">
                {(draftPromotion.siteBanners || []).map((banner) => (
                  <div key={banner.id} className="rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={banner.enabled}
                          onChange={(event) => patchCampaignBanner(banner.id, (current) => ({ ...current, enabled: event.target.checked }))}
                        />
                        {banner.enabled ? 'Ativo' : 'Inativo'}
                      </label>
                      <button
                        type="button"
                        onClick={() => setDraftPromotion((current) => ({ ...current, siteBanners: (current.siteBanners || []).filter((item) => item.id !== banner.id) }))}
                        className="inline-flex items-center gap-2 rounded-sm border border-rose-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-600 dark:border-rose-900/40 dark:text-rose-300"
                      >
                        <Trash2 size={12} />
                        Remover
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Area</label>
                        <select
                          value={banner.placement}
                          onChange={(event) => patchCampaignBanner(banner.id, (current) => ({ ...current, placement: event.target.value as MarketingCampaignBanner['placement'] }))}
                          className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                          aria-label={`Area do banner ${banner.id}`}
                        >
                          {CAMPAIGN_BANNER_PLACEMENTS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Cor</label>
                        <input
                          type="text"
                          value={banner.backgroundColor || ''}
                          onChange={(event) => patchCampaignBanner(banner.id, (current) => ({ ...current, backgroundColor: event.target.value }))}
                          className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                          placeholder="#0f172a"
                          aria-label={`Cor do banner ${banner.id}`}
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Titulo</label>
                        <input
                          type="text"
                          value={banner.headline}
                          onChange={(event) => patchCampaignBanner(banner.id, (current) => ({ ...current, headline: event.target.value }))}
                          className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                          aria-label={`Titulo do banner ${banner.id}`}
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Descricao</label>
                        <input
                          type="text"
                          value={banner.description || ''}
                          onChange={(event) => patchCampaignBanner(banner.id, (current) => ({ ...current, description: event.target.value }))}
                          className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                          aria-label={`Descricao do banner ${banner.id}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">CTA</label>
                        <input
                          type="text"
                          value={banner.ctaLabel || ''}
                          onChange={(event) => patchCampaignBanner(banner.id, (current) => ({ ...current, ctaLabel: event.target.value }))}
                          className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                          aria-label={`CTA do banner ${banner.id}`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Link</label>
                        <input
                          type="text"
                          value={banner.actionUrl || ''}
                          onChange={(event) => patchCampaignBanner(banner.id, (current) => ({ ...current, actionUrl: event.target.value }))}
                          className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                          aria-label={`Link do banner ${banner.id}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4 rounded-sm border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                    <Settings2 size={14} /> Automacoes condicionais
                  </h4>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Regras para email/notificacao quando o usuario cria conta, se aproxima de assinar, fica inativo ou demonstra interesse.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraftPromotion((current) => ({ ...current, automationRules: [...(current.automationRules || []), createDefaultCampaignAutomation()] }))}
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  <Plus size={14} />
                  Regra
                </button>
              </div>

              <div className="space-y-3">
                {(draftPromotion.automationRules || []).map((rule) => (
                  <div key={rule.id} className="rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(event) => patchCampaignAutomation(rule.id, (current) => ({ ...current, enabled: event.target.checked }))}
                        />
                        {rule.enabled ? 'Ativa' : 'Inativa'}
                      </label>
                      <button
                        type="button"
                        onClick={() => setDraftPromotion((current) => ({ ...current, automationRules: (current.automationRules || []).filter((item) => item.id !== rule.id) }))}
                        className="inline-flex items-center gap-2 rounded-sm border border-rose-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-600 dark:border-rose-900/40 dark:text-rose-300"
                      >
                        <Trash2 size={12} />
                        Remover
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Condicao</label>
                        <select
                          value={rule.condition}
                          onChange={(event) => patchCampaignAutomation(rule.id, (current) => ({ ...current, condition: event.target.value as MarketingCampaignAutomationRule['condition'] }))}
                          className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                          aria-label={`Condicao da automacao ${rule.id}`}
                        >
                          {CAMPAIGN_AUTOMATION_CONDITIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Canal</label>
                        <select
                          value={rule.channel}
                          onChange={(event) => patchCampaignAutomation(rule.id, (current) => ({ ...current, channel: event.target.value as MarketingCampaignAutomationRule['channel'] }))}
                          className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                          aria-label={`Canal da automacao ${rule.id}`}
                        >
                          {CAMPAIGN_CHANNELS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Atraso (h)</label>
                        <input
                          type="number"
                          value={rule.delayHours}
                          onChange={(event) => patchCampaignAutomation(rule.id, (current) => ({ ...current, delayHours: Number(event.target.value) }))}
                          className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                          aria-label={`Atraso da automacao ${rule.id} em horas`}
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Assunto / titulo</label>
                        <input
                          type="text"
                          value={rule.subject}
                          onChange={(event) => patchCampaignAutomation(rule.id, (current) => ({ ...current, subject: event.target.value }))}
                          className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                          aria-label={`Assunto da automacao ${rule.id}`}
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2 xl:col-span-4">
                        <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Mensagem</label>
                        <textarea
                          value={rule.message}
                          onChange={(event) => patchCampaignAutomation(rule.id, (current) => ({ ...current, message: event.target.value }))}
                          className={`${ADMIN_FIELD_CLASS} min-h-[92px] w-full resize-none`}
                          aria-label={`Mensagem da automacao ${rule.id}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex justify-end">
              <button
                onClick={() => void handleSavePromotion()}
                disabled={savingKey === 'save-promotion'}
                className={ADMIN_PRIMARY_BUTTON_CLASS}
              >
                {savingKey === 'save-promotion' ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
                Salvar campanha
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'themes' && (
        <div className="space-y-6 rounded-sm border border-slate-300 bg-white p-5 shadow-none transition-colors dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-slate-100">
                <Palette size={20} className="text-sky-700 dark:text-sky-300" /> Temas promocionais
              </h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Personalize a identidade visual da plataforma para eventos especiais.</p>
            </div>
            <div className="rounded-sm bg-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800">
              Rascunho: {draftTheme}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(themeConfig).map(([id, theme]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDraftTheme(id as AppPromotionTheme)}
                aria-pressed={draftTheme === id}
                className={`group relative flex flex-col items-center gap-4 overflow-hidden rounded-sm border p-5 transition-all ${
                  draftTheme === id
                    ? 'border-sky-700 bg-white ring-1 ring-sky-700/20 dark:bg-slate-800'
                    : 'border-slate-300 bg-slate-50/50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900/30 dark:hover:border-slate-600'
                }`}
              >
                <div className={`flex h-16 w-16 items-center justify-center rounded-sm transition-transform group-hover:scale-110 ${
                  id === 'default' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                    : id === 'black-friday' ? 'bg-black text-white dark:bg-zinc-950'
                    : id === 'black-november' ? 'bg-zinc-900 text-amber-500'
                    : id === 'estudante' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30'
                    : id === 'sao-joao' ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/30'
                    : id === 'carnaval' ? 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-900/30'
                    : id === 'ano-novo' ? 'bg-slate-950 text-amber-500'
                    : id === 'pascoa' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30'
                    : 'bg-sky-50 text-sky-700 dark:bg-sky-900/30'
                }`}>
                  <theme.icon size={32} />
                </div>
                <div className="text-center">
                  <h4 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{themes.find((entry) => entry.value === id)?.label || id}</h4>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{id}</p>
                </div>
                {draftTheme === id && (
                  <div className="absolute right-4 top-4 text-sky-700 dark:text-sky-300">
                    <CheckCircle2 size={16} />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-start gap-4 rounded-sm border border-amber-100 bg-amber-50 p-5 dark:border-amber-900/30 dark:bg-amber-900/10">
            <div className="rounded-sm bg-white p-2 text-amber-600 dark:bg-amber-900/50">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black uppercase text-amber-800 dark:text-amber-400">Impacto visual global</h4>
              <p className="mt-1 text-xs font-medium leading-relaxed text-amber-700 dark:text-amber-500/80">
                A alteração do tema impacta imediatamente a landing page e elementos decorativos em toda a plataforma. O sistema de cores light/dark continua funcionando de forma complementar ao tema selecionado.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveTheme()}
              disabled={savingKey === 'save-theme'}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              {savingKey === 'save-theme' ? <Loader2 size={14} className="animate-spin" /> : <Palette size={14} />}
              Aplicar tema visual
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMarketing;
