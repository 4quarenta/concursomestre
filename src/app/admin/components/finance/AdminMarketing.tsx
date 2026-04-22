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
import { AlertCircle, CheckCircle2, Clock, Loader2, Megaphone, Palette, Percent, Trash2, Zap } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import type { AppPromotionTheme, DiscountCode, Plan, SystemSettings } from '@types';
import { themeConfig } from '@constants/themes';
import { planService } from '@services/plans';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';

interface AdminMarketingProps {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => void;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
}

type CouponTargetType = 'all' | 'plan' | 'item';
const DEFAULT_LIMITED_OFFER_EXTENSION_MS = 7 * 24 * 60 * 60 * 1000;

interface CouponDraft extends DiscountCode {
  code: string;
  discountPercentage: number;
  maxUses: number;
  uses: number;
  autoApply: boolean;
  targetType: CouponTargetType;
  targetId: string | null;
}

const createDefaultCouponDraft = (): CouponDraft => ({
  code: '',
  discountPercentage: 10,
  maxUses: 100,
  uses: 0,
  autoApply: false,
  expiresAt: undefined,
  targetType: 'all',
  targetId: null,
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
    discountAmount: coupon?.discountAmount !== undefined ? Number(coupon.discountAmount) : undefined,
    maxUses: Math.max(0, Number(coupon?.maxUses || 0)),
    uses: Math.max(0, Number(coupon?.uses || 0)),
    expiresAt: coupon?.expiresAt || undefined,
    autoApply: Boolean(coupon?.autoApply),
    targetType,
    targetId,
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
  updateSystemSettings,
  saveSystemSettingsNow,
}: AdminMarketingProps) => {
  const { addToast } = useToast();
  const [activeSection, setActiveSection] = useState<'coupons' | 'promo' | 'themes'>('coupons');
  const [draftPromotion, setDraftPromotion] = useState(systemSettings.activePromotion);
  const [draftTheme, setDraftTheme] = useState<AppPromotionTheme>(systemSettings.activeTheme || 'default');
  const [draftCoupons, setDraftCoupons] = useState<CouponDraft[]>((systemSettings.coupons || []).map((coupon) => normalizeCouponDraft(coupon)));
  const [newCoupon, setNewCoupon] = useState<CouponDraft>(createDefaultCouponDraft());
  const [limitedOfferCountdown, setLimitedOfferCountdown] = useState(systemSettings.limitedOfferCountdown);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [pendingDeleteCoupon, setPendingDeleteCoupon] = useState<CouponDraft | null>(null);

  useEffect(() => {
    setDraftPromotion(systemSettings.activePromotion);
    setDraftTheme(systemSettings.activeTheme || 'default');
    setDraftCoupons((systemSettings.coupons || []).map((coupon) => normalizeCouponDraft(coupon)));
    setLimitedOfferCountdown(systemSettings.limitedOfferCountdown);
  }, [systemSettings.activePromotion, systemSettings.activeTheme, systemSettings.coupons, systemSettings.limitedOfferCountdown]);

  useEffect(() => {
    let active = true;

    const loadPlans = async () => {
      try {
        const plans = await planService.getPlans();
        if (active) {
          setAvailablePlans(plans);
        }
      } catch (error) {
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

  const persistMarketingSettings = async (nextSettings: SystemSettings, successMessage: string, actionKey: string) => {
    if (savingKey) {
      return false;
    }

    setSavingKey(actionKey);

    try {
      const persistedSettings = await saveSystemSettingsNow(nextSettings);
      updateSystemSettings(persistedSettings);
      addToast(successMessage, 'success');
      return true;
    } catch (error) {
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

    if (!nextCode) {
      addToast('Informe um código para o cupom.', 'warning');
      return;
    }

    if (draftCoupons.some((coupon) => coupon.code.toUpperCase() === nextCode)) {
      addToast('Esse cupom já existe.', 'warning');
      return;
    }

    if (newCoupon.discountPercentage <= 0) {
      addToast('O desconto precisa ser maior que zero.', 'warning');
      return;
    }

    if (newCoupon.maxUses <= 0) {
      addToast('O limite de usos precisa ser maior que zero.', 'warning');
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
        discountPercentage: Number(newCoupon.discountPercentage),
        maxUses: Number(newCoupon.maxUses),
        uses: 0,
        autoApply: Boolean(newCoupon.autoApply),
        expiresAt: newCoupon.expiresAt || undefined,
        targetType: newCoupon.targetType,
        targetId: normalizedTargetId,
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
    const nextSettings = { ...systemSettings, activePromotion: draftPromotion };
    await persistMarketingSettings(nextSettings, 'Campanha salva com sucesso.', 'save-promotion');
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

      <div className="flex gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-sm transition-all no-scrollbar dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => setActiveSection('coupons')}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
            activeSection === 'coupons' ? 'bg-slate-900 text-white shadow-md dark:bg-indigo-600' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <Percent size={14} /> Cupons de Desconto
        </button>
        <button
          onClick={() => setActiveSection('promo')}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
            activeSection === 'promo' ? 'bg-slate-900 text-white shadow-md dark:bg-indigo-600' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <Megaphone size={14} /> Campanhas
        </button>
        <button
          onClick={() => setActiveSection('themes')}
          className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
            activeSection === 'themes' ? 'bg-slate-900 text-white shadow-md dark:bg-indigo-600' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <Palette size={14} /> Temas Visuais
        </button>
      </div>

      {activeSection === 'coupons' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Código</label>
                <input
                  type="text"
                  value={newCoupon.code}
                  onChange={(event) => setNewCoupon((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-black uppercase text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="EX: APROVADO20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Desconto (%)</label>
                <input
                  type="number"
                  value={newCoupon.discountPercentage}
                  onChange={(event) => setNewCoupon((current) => ({ ...current, discountPercentage: Number(event.target.value) }))}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Max usos</label>
                <input
                  type="number"
                  value={newCoupon.maxUses}
                  onChange={(event) => setNewCoupon((current) => ({ ...current, maxUses: Number(event.target.value) }))}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Aplicacao</label>
                <button
                  type="button"
                  onClick={() => setNewCoupon((current) => ({ ...current, autoApply: !current.autoApply }))}
                  className={`h-10 w-full rounded-lg border px-3 text-left text-xs font-black uppercase tracking-widest transition-colors ${
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
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition-colors focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
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
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => void handleCreateCoupon()}
                disabled={savingKey === 'create-coupon'}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 text-xs font-bold uppercase text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                {savingKey === 'create-coupon' ? <Loader2 size={14} className="animate-spin" /> : <Percent size={14} />}
                Criar cupom
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Cupons podem ser manuais ou auto aplicados. Voce pode limitar por usos, por data final, ou usar os dois ao mesmo tempo. Quando houver alvo definido, o backend restringe o uso ao tipo e ao ID configurados.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6 shadow-sm transition-colors dark:border-amber-900/30 dark:bg-amber-900/10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-lg font-black text-amber-700 dark:text-amber-300"><Clock size={20} /> Oferta por tempo limitado</h3>
                <p className="max-w-2xl text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  Countdown exibido na home e no checkout quando houver desconto aplicado.
                </p>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 dark:border-amber-900/30 dark:bg-slate-900">
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
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Status</p>
                  <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">
                    {limitedOfferCountdown?.enabled ? 'Ativo' : 'Desativado'}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    O contador so aparece com desconto ativo e data final futura.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
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
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
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
                    {coupon.discountPercentage}% OFF · {coupon.uses || 0}/{coupon.maxUses} usos
                    {coupon.expiresAt ? ` · expira ${new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}` : ''}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {describeCouponTarget(coupon)}
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
          <div className="space-y-8 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-slate-100">
                  <Megaphone size={20} className="text-indigo-600 dark:text-indigo-400" /> Campanha ativa
                </h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Configure a campanha promocional global da plataforma.</p>
              </div>
              <button
                onClick={() => setDraftPromotion((current) => ({ ...current, isActive: !current.isActive }))}
                className={`rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                  draftPromotion.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-800'
                }`}
              >
                {draftPromotion.isActive ? 'Ativada' : 'Desativada'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Nome da campanha</label>
                <input
                  type="text"
                  value={draftPromotion.name}
                  onChange={(event) => setDraftPromotion((current) => ({ ...current, name: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Texto do banner</label>
                <input
                  type="text"
                  value={draftPromotion.bannerText}
                  onChange={(event) => setDraftPromotion((current) => ({ ...current, bannerText: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-indigo-100 bg-indigo-50 p-6 dark:border-indigo-900/30 dark:bg-indigo-900/10">
              <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
                <Zap size={14} /> Preview da notificação
              </h4>
              <div className="rounded-2xl border border-indigo-100 bg-white p-4 dark:border-indigo-900/40 dark:bg-slate-900">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{draftPromotion.name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{draftPromotion.bannerText}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => void handleSavePromotion()}
                disabled={savingKey === 'save-promotion'}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingKey === 'save-promotion' ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
                Salvar campanha
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'themes' && (
        <div className="space-y-6 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-slate-100">
                <Palette size={20} className="text-indigo-600 dark:text-indigo-400" /> Temas promocionais
              </h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Personalize a identidade visual da plataforma para eventos especiais.</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800">
              Rascunho: {draftTheme}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(themeConfig).map(([id, theme]) => (
              <button
                key={id}
                onClick={() => setDraftTheme(id as AppPromotionTheme)}
                className={`group relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl border p-6 transition-all ${
                  draftTheme === id
                    ? 'border-indigo-500 bg-white ring-2 ring-indigo-500/20 dark:bg-slate-800'
                    : 'border-slate-100 bg-slate-50/50 hover:scale-[1.02] hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/30 dark:hover:border-slate-700'
                }`}
              >
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${
                  id === 'default' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                    : id === 'black-friday' ? 'bg-black text-white dark:bg-zinc-950'
                    : id === 'black-november' ? 'bg-zinc-900 text-amber-500'
                    : id === 'estudante' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30'
                    : id === 'sao-joao' ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/30'
                    : id === 'carnaval' ? 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-900/30'
                    : id === 'ano-novo' ? 'bg-indigo-950 text-amber-500'
                    : id === 'pascoa' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30'
                    : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30'
                }`}>
                  <theme.icon size={32} />
                </div>
                <div className="text-center">
                  <h4 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{themes.find((entry) => entry.value === id)?.label || id}</h4>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{id}</p>
                </div>
                {draftTheme === id && (
                  <div className="absolute right-4 top-4 text-indigo-600">
                    <CheckCircle2 size={16} />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-start gap-4 rounded-3xl border border-amber-100 bg-amber-50 p-6 dark:border-amber-900/30 dark:bg-amber-900/10">
            <div className="rounded-xl bg-white p-2 text-amber-600 dark:bg-amber-900/50">
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
              onClick={() => void handleSaveTheme()}
              disabled={savingKey === 'save-theme'}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
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
