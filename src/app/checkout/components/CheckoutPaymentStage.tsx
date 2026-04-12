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
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  Handshake,
  Loader2,
  Lock,
  MapPin,
  PencilLine,
  QrCode,
  Tag,
  User,
} from 'lucide-react';
import { formatMaskedCardLabelAscii } from '@services/billing';
import type { Address } from '@types';
import StripeCardElementForm from './StripeCardElementForm';
import StripeSavedCardCvcForm from './StripeSavedCardCvcForm';
import { CHECKOUT_STRIPE_FORM_IDS } from '../constants';

interface InstallmentOption {
  value: string;
  label: string;
}

interface CheckoutPaymentStageProps {
  planName: string;
  billingCycle: string;
  planBenefits: string[];
  subtotalLabel: string;
  discountLabel?: string | null;
  totalLabel: string;
  dueLabel: string;
  couponCode: string;
  applyingCoupon: boolean;
  appliedCouponCode?: string | null;
  appliedCouponSource?: 'auto' | 'manual' | null;
  couponSavingsLabel?: string | null;
  autoRenew: boolean;
  saveCard: boolean;
  stripeRequiresSavedCard: boolean;
  isStripeInternalCheckout: boolean;
  isLoadingStripeCards: boolean;
  stripeCards: any[];
  selectedStripeCardId: string | null;
  selectedStripeCard: any;
  stripePublishableKey: string;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserCpf?: string;
  currentUserAddress?: Address;
  emailVerified?: boolean;
  hasMissingRequirements?: boolean;
  nextRenewalLabel?: string | null;
  paymentBreakdownLabel?: string | null;
  paymentProtectionLabel?: string | null;
  installmentOptions?: InstallmentOption[];
  selectedInstallmentValue?: string;
  processing: boolean;
  legalNotice?: React.ReactNode;
  pixCapabilityStatus?: string;
  pixCapabilityMessage?: string;
  enabledPaymentMethodIds?: string[];
  onCouponCodeChange: (value: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onAutoRenewChange: (value: boolean) => void;
  onSaveCardChange: (value: boolean) => void;
  onSelectSavedCard: (cardId: string) => void;
  onSelectNewCard: () => void;
  onConfirmSavedCard: (args: { stripe: any; cvcElement: any }) => Promise<void>;
  onPaymentMethodCreated: (paymentMethodId: string) => Promise<any>;
  onPaymentFinalized: (step?: any) => Promise<void> | void;
  onConfirmClick: () => void;
  onInstallmentChange: (value: string) => void;
  onEditBillingInfo: () => void;
  confirmLabel: string;
  processingLabel: string;
}

/**
 * Resume campos de cobrança em um formato de leitura, sem criar um formulário paralelo.
 * A edição continua centralizada no fluxo oficial do checkout.
 * @since v1.0.0
 */
const BillingField: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div>
    <label className="mb-2 block text-sm font-medium text-zinc-700">
      {label}
    </label>
    <div className="flex min-h-[50px] items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900">
      {icon ? <span className="shrink-0 text-zinc-400">{icon}</span> : null}
      <span className="line-clamp-2">{value}</span>
    </div>
  </div>
);

/**
 * Seção enxuta com os dados de cobrança usados pelo checkout.
 * @since v1.0.0
 */
const CheckoutBillingInfoCard: React.FC<{
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserCpf?: string;
  currentUserAddress?: Address;
  emailVerified?: boolean;
  hasMissingRequirements?: boolean;
  onEditBillingInfo: () => void;
}> = ({
  currentUserName,
  currentUserEmail,
  currentUserCpf,
  currentUserAddress,
  emailVerified,
  hasMissingRequirements,
  onEditBillingInfo,
}) => {
  const addressLabel = useMemo(() => {
    if (!currentUserAddress) {
      return 'Complete seus dados de endereço no cadastro.';
    }

    const streetLine = [currentUserAddress.street, currentUserAddress.number]
      .filter(Boolean)
      .join(', ');

    return [
      streetLine,
      currentUserAddress.neighborhood,
      [currentUserAddress.city, currentUserAddress.state].filter(Boolean).join(' - '),
      currentUserAddress.zipCode ? `CEP ${currentUserAddress.zipCode}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
  }, [currentUserAddress]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Etapa 1 concluida
          </p>
          <h2 className="mt-1 text-lg font-medium text-zinc-950">Dados confirmados</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Essas informações vieram da etapa de identificação e serão usadas nesta assinatura.
          </p>
        </div>
        <button
          type="button"
          onClick={onEditBillingInfo}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          <PencilLine size={16} />
          Editar
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
            hasMissingRequirements ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {hasMissingRequirements ? 'Revisão pendente' : 'Pronto para seguir'}
          </span>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
            emailVerified ? 'bg-zinc-100 text-zinc-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {emailVerified ? 'E-mail confirmado' : 'Confirmação de e-mail pendente'}
          </span>
        </div>

        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <BillingField
              label="Nome completo"
              value={currentUserName || 'Preencha seu nome completo'}
              icon={<User size={16} />}
            />
            <BillingField
              label="E-mail"
              value={currentUserEmail || 'Preencha seu e-mail'}
              icon={<span className="text-xs font-semibold">@</span>}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <BillingField
              label="CPF"
              value={currentUserCpf || 'Preencha seu CPF'}
              icon={<span className="text-xs font-semibold">ID</span>}
            />
            <BillingField
              label="Endereço"
              value={addressLabel}
              icon={<MapPin size={16} />}
            />
          </div>
        </div>
      </div>

      {hasMissingRequirements ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="space-y-3">
            <p>
              Antes de concluir a compra, complete seus dados de cobrança e confirme o e-mail.
            </p>
            <button
              type="button"
              onClick={onEditBillingInfo}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Completar agora
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

/**
 * Renderiza o bloco de pagamento no formato mais seco do Figma, reaproveitando os formulários Stripe oficiais.
 * @since v1.0.0
 */
const CheckoutPaymentMethodCard: React.FC<{
  stripeCards: any[];
  isLoadingStripeCards: boolean;
  selectedStripeCardId: string | null;
  selectedStripeCard: any;
  isStripeInternalCheckout: boolean;
  stripePublishableKey: string;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserAddress?: Address;
  saveCard: boolean;
  stripeRequiresSavedCard: boolean;
  installmentOptions: InstallmentOption[];
  selectedInstallmentValue: string;
  processing: boolean;
  pixCapabilityStatus?: string;
  pixCapabilityMessage?: string;
  enabledPaymentMethodIds: string[];
  paymentMethod: 'card' | 'pix';
  paymentReady: boolean;
  confirmLabel: string;
  processingLabel: string;
  couponCode: string;
  applyingCoupon: boolean;
  appliedCouponCode?: string | null;
  appliedCouponSource?: 'auto' | 'manual' | null;
  couponSavingsLabel?: string | null;
  autoRenew: boolean;
  onSaveCardChange: (value: boolean) => void;
  onPaymentMethodChange: (value: 'card' | 'pix') => void;
  onCouponCodeChange: (value: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onAutoRenewChange: (value: boolean) => void;
  onSelectSavedCard: (cardId: string) => void;
  onSelectNewCard: () => void;
  onConfirmSavedCard: (args: { stripe: any; cvcElement: any }) => Promise<void>;
  onPaymentMethodCreated: (paymentMethodId: string) => Promise<any>;
  onPaymentFinalized: (step?: any) => Promise<void> | void;
  onStripeReadyChange: (ready: boolean) => void;
  onInstallmentChange: (value: string) => void;
  onConfirmClick: () => void;
}> = ({
  stripeCards,
  isLoadingStripeCards,
  selectedStripeCardId,
  selectedStripeCard,
  isStripeInternalCheckout,
  stripePublishableKey,
  currentUserName,
  currentUserEmail,
  currentUserAddress,
  saveCard,
  stripeRequiresSavedCard,
  installmentOptions,
  selectedInstallmentValue,
  processing,
  pixCapabilityStatus,
  pixCapabilityMessage,
  enabledPaymentMethodIds,
  paymentMethod,
  paymentReady,
  confirmLabel,
  processingLabel,
  couponCode,
  applyingCoupon,
  appliedCouponCode,
  appliedCouponSource,
  couponSavingsLabel,
  autoRenew,
  onSaveCardChange,
  onPaymentMethodChange,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  onAutoRenewChange,
  onSelectSavedCard,
  onSelectNewCard,
  onConfirmSavedCard,
  onPaymentMethodCreated,
  onPaymentFinalized,
  onStripeReadyChange,
  onInstallmentChange,
  onConfirmClick,
}) => {
  const hasSavedCards = stripeCards.length > 0;
  const usingSavedCard = Boolean(selectedStripeCardId && hasSavedCards);
  const pixIsActive = pixCapabilityStatus === 'active';
  const canUseCard = enabledPaymentMethodIds.includes('card');
  const canUsePix = enabledPaymentMethodIds.includes('pix');
  const [showCouponInput, setShowCouponInput] = useState(false);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-[#1a1c2e] dark:shadow-none md:p-8">
      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Etapa 2</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Método de pagamento</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Escolha como deseja concluir a assinatura. O processamento financeiro continua centralizado na Stripe.
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {canUseCard ? (
          <button
            type="button"
            onClick={() => onPaymentMethodChange('card')}
            className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
              paymentMethod === 'card'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-200'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-[#0f1020] dark:text-slate-300'
            }`}
          >
            <CreditCard size={16} />
            <span>Cartão de crédito</span>
          </button>
        ) : null}
        {canUsePix ? (
          <button
            type="button"
            onClick={() => onPaymentMethodChange('pix')}
            className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
              paymentMethod === 'pix'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-200'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-[#0f1020] dark:text-slate-300'
            }`}
          >
            <QrCode size={16} />
            <span>PIX</span>
          </button>
        ) : null}
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#0f1020]">
        <div className="space-y-5">
          {!canUseCard && !canUsePix ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              Nenhuma forma de pagamento compatível está ativa no painel admin.
            </div>
          ) : paymentMethod === 'card' && canUseCard ? (
            <>
              <div className="flex flex-wrap gap-3">
                {hasSavedCards ? (
                  <button
                    type="button"
                    onClick={() => onSelectSavedCard(selectedStripeCardId || stripeCards[0].id)}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all ${
                      usingSavedCard
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-[#111428] dark:text-slate-300'
                    }`}
                  >
                    <CreditCard size={16} />
                    <span>Usar cartão salvo</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={onSelectNewCard}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all ${
                    !usingSavedCard
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-[#111428] dark:text-slate-300'
                  }`}
                >
                  <CreditCard size={16} />
                  <span>Novo cartão</span>
                </button>
              </div>

              {isLoadingStripeCards ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  Carregando cartões salvos...
                </div>
              ) : null}

              {hasSavedCards && usingSavedCard ? (
            <>
              <div className="space-y-3">
                {stripeCards.map((card: any) => {
                  const isSelected = selectedStripeCardId === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onSelectSavedCard(card.id)}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        isSelected
                          ? 'border-zinc-900 bg-zinc-50'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-zinc-950">
                            {formatMaskedCardLabelAscii(card)}
                          </div>
                          <p className="text-sm text-zinc-500">
                            Vence em {String(card.exp_month).padStart(2, '0')}/{String(card.exp_year).slice(-2)}
                          </p>
                        </div>
                        {isSelected ? <CheckCircle2 size={18} className="text-zinc-900" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              {isStripeInternalCheckout ? (
                <div>
                  <StripeSavedCardCvcForm
                    publishableKey={stripePublishableKey}
                    formId={CHECKOUT_STRIPE_FORM_IDS.savedCard}
                    cardBrand={selectedStripeCard?.brand}
                    last4={selectedStripeCard?.last_four_digits}
                    label="CVV (para sua segurança)"
                    hideDescription
                    hideTrustNote
                    hideFieldHint
                    hideSubmitButton
                    onConfirm={onConfirmSavedCard}
                    onReadyChange={onStripeReadyChange}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  A Stripe abrirá a confirmação segura para concluir o pagamento com o cartão salvo.
                </div>
              )}
            </>
          ) : (
            <>
              {isStripeInternalCheckout ? (
                <StripeCardElementForm
                  publishableKey={stripePublishableKey}
                  formId={CHECKOUT_STRIPE_FORM_IDS.newCard}
                  billingName={currentUserName}
                  billingEmail={currentUserEmail}
                  billingAddress={currentUserAddress}
                  hideHeader
                  hideTrustNote
                  hideNameHelper
                  hideSubmitButton
                  onPaymentMethodCreated={onPaymentMethodCreated}
                  onPaymentFinalized={onPaymentFinalized}
                  onReadyChange={onStripeReadyChange}
                />
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  Você será levado para a tela segura da Stripe para informar o cartão e concluir a compra.
                </div>
              )}
            </>
          )}
            </>
          ) : canUsePix ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#111428]">
              <div className="flex flex-col items-center py-6 text-center">
                <div className="mb-5 rounded-xl border border-zinc-200 bg-white p-8">
                  <QrCode className="size-28 text-zinc-900" />
                </div>
                <p className="text-sm font-semibold text-zinc-950">
                  {pixIsActive ? 'PIX ativo na conta Stripe' : 'PIX ainda não está ativo para assinaturas neste checkout'}
                </p>
                <p className="mt-2 max-w-md text-sm text-zinc-500">
                  {pixCapabilityMessage || 'A capability pix_payments pode ser solicitada via API, mas assinatura recorrente segue usando cartão até a Stripe liberar o fluxo operacional compatível.'}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-50 p-4">
                <p className="mb-2 text-xs text-zinc-600">Código PIX</p>
                <div className="flex items-center justify-between gap-3">
                  <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-zinc-500">
                    {pixIsActive ? 'Capability ativa. Aguardando contrato de cobrança PIX recorrente.' : 'Aguardando ativação segura pela Stripe...'}
                  </code>
                  <button
                    type="button"
                    disabled
                    className="inline-flex shrink-0 items-center gap-2 rounded-md bg-zinc-300 px-3 py-1.5 text-xs text-white"
                  >
                    <Copy size={14} />
                    Copiar
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">
                  Use cartão de crédito para concluir agora. PIX depende de capability ativa e fluxo oficial Stripe para não criar cobrança fora do contrato financeiro.
                </p>
              </div>
            </div>
          ) : null}

          {paymentMethod === 'card' && canUseCard && installmentOptions.length > 1 ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Parcelamento
              </label>
              <div className="relative">
                <select
                  value={selectedInstallmentValue}
                  onChange={(event) => onInstallmentChange(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-zinc-200 px-4 py-3 pr-10 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  {installmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-zinc-400" />
              </div>
            </div>
          ) : null}

          {paymentMethod === 'card' && canUseCard && !usingSavedCard ? (
            <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4">
              <input
                type="checkbox"
                checked={saveCard || stripeRequiresSavedCard}
                disabled={stripeRequiresSavedCard}
                onChange={(event) => onSaveCardChange(event.target.checked)}
                className="mt-0.5 size-4 cursor-pointer accent-zinc-900"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-zinc-950">
                  Salvar este cartão para futuras compras
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {stripeRequiresSavedCard
                    ? 'Obrigatório para manter a renovação automática com Stripe.'
                    : 'O cartão fica salvo com segurança no cofre oficial da Stripe para acelerar próximas assinaturas.'}
                </p>
              </div>
            </label>
          ) : null}

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-slate-700 dark:bg-[#111428]">
            <button
              type="button"
              onClick={() => {
                if (appliedCouponCode) {
                  onRemoveCoupon();
                  return;
                }
                setShowCouponInput((current) => !current);
              }}
              className="flex items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900 dark:text-slate-300 dark:hover:text-white"
            >
              <Tag className="size-4" />
              <span>{appliedCouponCode ? 'Remover cupom de desconto' : showCouponInput ? 'Fechar cupom' : 'Adicionar cupom de desconto'}</span>
            </button>

            {showCouponInput && !appliedCouponCode ? (
              <div className="mt-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Código do cupom"
                      value={couponCode}
                      onChange={(event) => onCouponCodeChange(event.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 pl-10 text-sm uppercase text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                    />
                    <Tag className="absolute left-3 top-3 size-4 text-zinc-400" />
                  </div>
                  <button
                    type="button"
                    onClick={onApplyCoupon}
                    disabled={applyingCoupon || !couponCode.trim()}
                    className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-300 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                  >
                    {applyingCoupon ? 'Aplicando...' : 'Aplicar'}
                  </button>
                </div>
              </div>
            ) : null}

            {appliedCouponCode ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <Check className="size-4" />
                  <span>
                    Cupom "{appliedCouponCode}" {appliedCouponSource === 'auto' ? 'aplicado automaticamente' : 'aplicado com sucesso'}
                  </span>
                </div>
                {couponSavingsLabel ? (
                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    Economia aplicada: {couponSavingsLabel}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <AutoRenewToggleCard enabled={autoRenew} onChange={onAutoRenewChange} />

          {paymentMethod === 'card' && canUseCard ? (
            <button
              type="button"
              onClick={onConfirmClick}
              disabled={processing || !paymentReady}
              className={`flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none ${
                processing ? 'animate-pulse' : ''
              }`}
            >
              {processing || !paymentReady ? <Loader2 size={16} className="animate-spin" /> : null}
              {processing ? processingLabel : paymentReady ? confirmLabel : 'Carregando checkout seguro...'}
            </button>
          ) : null}

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Seus dados de pagamento são criptografados e protegidos pela Stripe.
              </p>
            </div>
          </div>

          <CheckoutRefundGuaranteeCard />
        </div>
      </div>
    </section>
  );
};

/**
 * Sidebar sticky com resumo do pedido no formato do Figma.
 * @since v1.0.0
 */
const CheckoutOrderSummarySidebar: React.FC<{
  planName: string;
  billingCycle: string;
  planBenefits: string[];
  couponCode: string;
  applyingCoupon: boolean;
  appliedCouponCode?: string | null;
  appliedCouponSource?: 'auto' | 'manual' | null;
  couponSavingsLabel?: string | null;
  subtotalLabel: string;
  discountLabel?: string | null;
  totalLabel: string;
  dueLabel: string;
  paymentMethodLabel: string;
  installmentSummaryLabel: string;
  nextRenewalLabel?: string | null;
  paymentBreakdownLabel?: string | null;
  paymentProtectionLabel?: string | null;
  legalNotice?: React.ReactNode;
  processing: boolean;
  paymentReady: boolean;
  confirmLabel: string;
  processingLabel: string;
  onCouponCodeChange: (value: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onConfirmClick: () => void;
}> = ({
  planName,
  billingCycle,
  planBenefits,
  couponCode,
  applyingCoupon,
  appliedCouponCode,
  appliedCouponSource,
  couponSavingsLabel,
  subtotalLabel,
  discountLabel,
  totalLabel,
  dueLabel,
  paymentMethodLabel,
  installmentSummaryLabel,
  nextRenewalLabel,
  paymentBreakdownLabel,
  paymentProtectionLabel,
  legalNotice,
  processing,
  paymentReady,
  confirmLabel,
  processingLabel,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  onConfirmClick,
}) => {
  return (
    <div className="sticky top-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-[#1a1c2e] dark:shadow-none">
        <div className="relative overflow-hidden bg-slate-950 p-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.34),transparent_44%)]" />
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-200">Você está assinando</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">{planName}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-300">{billingCycle}</p>
          </div>
        </div>

        <div className="p-6">

          <div className="mb-6 rounded-lg bg-zinc-50 p-4">
            <ul className="space-y-2">
              {planBenefits.slice(0, 3).map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-sm text-zinc-600">
                  <Check className="size-4 shrink-0 text-zinc-900" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 border-t border-zinc-200 pt-4">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-zinc-600">Forma de pagamento</span>
              <span className="font-semibold text-zinc-950">{paymentMethodLabel}</span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-zinc-600">Parcelamento</span>
              <span className="font-semibold text-zinc-950">{installmentSummaryLabel}</span>
            </div>
            {nextRenewalLabel ? (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-zinc-600">Renovação</span>
                <span className="font-semibold text-zinc-950">{nextRenewalLabel}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-zinc-600">Subtotal</span>
              <span className="font-semibold text-zinc-950">{subtotalLabel}</span>
            </div>
            {discountLabel ? (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-emerald-600">Desconto</span>
                <span className="font-semibold text-emerald-600">- {discountLabel}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3 text-sm">
              <span className="font-black text-zinc-700">TOTAL:</span>
              <span className="font-black text-zinc-950">{totalLabel}</span>
            </div>
          </div>

          <div className="mt-4 border-t border-zinc-200 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-zinc-600">Total hoje</span>
              <span className="text-3xl font-black tracking-tight text-indigo-600">{dueLabel}</span>
            </div>
            {paymentProtectionLabel ? (
              <p className="mt-2 text-xs font-semibold leading-relaxed text-zinc-500">
                {paymentProtectionLabel}
              </p>
            ) : null}
          </div>
        <div className="mt-6 border-t border-zinc-200 bg-white pt-6 dark:border-slate-800 dark:bg-[#1a1c2e]">
          <button
            type="button"
            onClick={onConfirmClick}
            disabled={processing || !paymentReady}
            className={`flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none ${
              processing ? 'animate-pulse' : ''
            }`}
          >
            {processing || !paymentReady ? <Loader2 size={16} className="animate-spin" /> : null}
            {processing ? processingLabel : paymentReady ? confirmLabel : 'Carregando checkout seguro...'}
          </button>

          <div className="mt-4">
            {legalNotice}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Toggle visual para a renovação automática, sem alterar a regra de negócio do backend.
 * @since v1.0.0
 */
const AutoRenewToggleCard: React.FC<{
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}> = ({ enabled, onChange }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-[#1a1c2e] dark:shadow-none md:p-5">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-500">Renovação</p>
        <h3 className="mt-1 text-base font-black text-slate-950 dark:text-white">Renovação automática</h3>
        <p className="mt-1 max-w-xl text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
          Mantém sua assinatura ativa no próximo ciclo. Você pode cancelar a renovação quando quiser.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? 'Desativar renovação automática' : 'Ativar renovação automática'}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-[#1a1c2e] ${
          enabled
            ? 'border-indigo-600 bg-indigo-600 shadow-lg shadow-indigo-500/20'
            : 'border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute left-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
            enabled ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  </section>
);

/**
 * Card de garantia exibido antes da decisão de renovação.
 * Mantém a mensagem comercial fora do resumo financeiro para reduzir ruído no CTA.
 * @since v1.0.0
 */
const CheckoutRefundGuaranteeCard: React.FC = () => (
  <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 shadow-lg shadow-sky-100/60 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100 dark:shadow-none md:p-5">
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
        <Handshake size={18} />
      </div>
      <div>
        <p className="font-bold text-sky-950 dark:text-white">Garantia de 7 dias ou seu dinheiro de volta.</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed">Assine com tranquilidade: pagamento protegido e reembolso disponível dentro do prazo de arrependimento.</p>
      </div>
    </div>
  </section>
);

/**
 * Etapa visual do checkout no padrão do Figma enviado pelo usuário.
 * O layout ficou mais seco e organizado, sem criar uma regra de negócio paralela.
 * @since v1.0.0
 */
const CheckoutPaymentStage: React.FC<CheckoutPaymentStageProps> = ({
  planName,
  billingCycle,
  planBenefits,
  subtotalLabel,
  discountLabel,
  totalLabel,
  dueLabel,
  couponCode,
  applyingCoupon,
  appliedCouponCode,
  appliedCouponSource,
  couponSavingsLabel,
  autoRenew,
  saveCard,
  stripeRequiresSavedCard,
  isStripeInternalCheckout,
  isLoadingStripeCards,
  stripeCards,
  selectedStripeCardId,
  selectedStripeCard,
  stripePublishableKey,
  currentUserName,
  currentUserEmail,
  currentUserCpf,
  currentUserAddress,
  emailVerified,
  hasMissingRequirements,
  nextRenewalLabel,
  paymentBreakdownLabel,
  paymentProtectionLabel,
  installmentOptions = [],
  selectedInstallmentValue = '1',
  processing,
  legalNotice,
  pixCapabilityStatus,
  pixCapabilityMessage,
  enabledPaymentMethodIds = ['card'],
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  onAutoRenewChange,
  onSaveCardChange,
  onSelectSavedCard,
  onSelectNewCard,
  onConfirmSavedCard,
  onPaymentMethodCreated,
  onPaymentFinalized,
  onConfirmClick,
  onInstallmentChange,
  onEditBillingInfo,
  confirmLabel,
  processingLabel,
}) => {
  const [stripeReady, setStripeReady] = useState(!isStripeInternalCheckout);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix'>('card');
  const canUseCard = enabledPaymentMethodIds.includes('card');
  const canUsePix = enabledPaymentMethodIds.includes('pix');

  useEffect(() => {
    setStripeReady(!isStripeInternalCheckout);
  }, [isStripeInternalCheckout, selectedStripeCardId]);

  useEffect(() => {
    if (paymentMethod === 'card' && !canUseCard && canUsePix) {
      setPaymentMethod('pix');
    }

    if (paymentMethod === 'pix' && !canUsePix && canUseCard) {
      setPaymentMethod('card');
    }
  }, [canUseCard, canUsePix, paymentMethod]);

  const paymentReady = canUseCard && paymentMethod === 'card' && (!isStripeInternalCheckout || stripeReady);
  const paymentMethodLabel = paymentMethod === 'pix' ? 'PIX' : 'Cartão';
  const installmentSummaryLabel = paymentMethod === 'pix'
    ? 'À vista'
    : `${selectedInstallmentValue || '1'}x de ${dueLabel}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
      <div className="space-y-8">
        {hasMissingRequirements ? (
          <CheckoutBillingInfoCard
            currentUserName={currentUserName}
            currentUserEmail={currentUserEmail}
            currentUserCpf={currentUserCpf}
            currentUserAddress={currentUserAddress}
            emailVerified={emailVerified}
            hasMissingRequirements={hasMissingRequirements}
            onEditBillingInfo={onEditBillingInfo}
          />
        ) : null}

        <CheckoutPaymentMethodCard
          stripeCards={stripeCards}
          isLoadingStripeCards={isLoadingStripeCards}
          selectedStripeCardId={selectedStripeCardId}
          selectedStripeCard={selectedStripeCard}
          isStripeInternalCheckout={isStripeInternalCheckout}
          stripePublishableKey={stripePublishableKey}
          currentUserName={currentUserName}
          currentUserEmail={currentUserEmail}
          currentUserAddress={currentUserAddress}
          saveCard={saveCard}
          stripeRequiresSavedCard={stripeRequiresSavedCard}
          installmentOptions={installmentOptions}
          selectedInstallmentValue={selectedInstallmentValue}
          processing={processing}
          pixCapabilityStatus={pixCapabilityStatus}
          pixCapabilityMessage={pixCapabilityMessage}
          enabledPaymentMethodIds={enabledPaymentMethodIds}
          paymentMethod={paymentMethod}
          paymentReady={paymentReady}
          confirmLabel={confirmLabel}
          processingLabel={processingLabel}
          couponCode={couponCode}
          applyingCoupon={applyingCoupon}
          appliedCouponCode={appliedCouponCode}
          appliedCouponSource={appliedCouponSource}
          couponSavingsLabel={couponSavingsLabel}
          autoRenew={autoRenew}
          onSaveCardChange={onSaveCardChange}
          onPaymentMethodChange={setPaymentMethod}
          onCouponCodeChange={onCouponCodeChange}
          onApplyCoupon={onApplyCoupon}
          onRemoveCoupon={onRemoveCoupon}
          onAutoRenewChange={onAutoRenewChange}
          onSelectSavedCard={onSelectSavedCard}
          onSelectNewCard={onSelectNewCard}
          onConfirmSavedCard={onConfirmSavedCard}
          onPaymentMethodCreated={onPaymentMethodCreated}
          onPaymentFinalized={onPaymentFinalized}
          onStripeReadyChange={setStripeReady}
          onInstallmentChange={onInstallmentChange}
          onConfirmClick={onConfirmClick}
        />

      </div>

      <CheckoutOrderSummarySidebar
        planName={planName}
        billingCycle={billingCycle}
        planBenefits={planBenefits}
        couponCode={couponCode}
        applyingCoupon={applyingCoupon}
        appliedCouponCode={appliedCouponCode}
        appliedCouponSource={appliedCouponSource}
        couponSavingsLabel={couponSavingsLabel}
        subtotalLabel={subtotalLabel}
        discountLabel={discountLabel}
        totalLabel={totalLabel}
        dueLabel={dueLabel}
        paymentMethodLabel={paymentMethodLabel}
        installmentSummaryLabel={installmentSummaryLabel}
        nextRenewalLabel={nextRenewalLabel}
        paymentBreakdownLabel={paymentBreakdownLabel}
        paymentProtectionLabel={paymentProtectionLabel}
        legalNotice={legalNotice}
        processing={processing}
        paymentReady={paymentReady}
        confirmLabel={confirmLabel}
        processingLabel={processingLabel}
        onCouponCodeChange={onCouponCodeChange}
        onApplyCoupon={onApplyCoupon}
        onRemoveCoupon={onRemoveCoupon}
        onConfirmClick={onConfirmClick}
      />
    </div>
  );
};

export default CheckoutPaymentStage;

