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

import React from 'react';
import { CheckCircle2, Clock3, CreditCard, Lock, Plus, ShieldCheck, WalletCards } from 'lucide-react';
import { formatMaskedCardLabelAscii } from '@services/billing';

interface CheckoutStripePaymentMethodPanelProps {
  stripeCards: any[];
  isLoadingStripeCards: boolean;
  selectedStripeCardId: string | null;
  onSelectSavedCard: (cardId: string) => void;
  onSelectNewCard: () => void;
  selectedInstallmentCount: number;
  onInstallmentChange: (value: string) => void;
  supportsStripeBillingChoices: boolean;
  maxInstallments: number;
  checkoutFinalCycleAmount: number;
  isStripeInternalCheckout: boolean;
}

/**
 * Organiza a escolha entre cartao salvo e novo cartao no checkout Stripe.
 * O componente apenas melhora a leitura da UI e usa callbacks prontos da pagina.
 * @since v1.0.0
 */
const CheckoutStripePaymentMethodPanel: React.FC<CheckoutStripePaymentMethodPanelProps> = ({
  stripeCards,
  isLoadingStripeCards,
  selectedStripeCardId,
  onSelectSavedCard,
  onSelectNewCard,
  selectedInstallmentCount,
  onInstallmentChange,
  supportsStripeBillingChoices,
  maxInstallments,
  checkoutFinalCycleAmount,
  isStripeInternalCheckout,
}) => {
  const hasSavedCards = stripeCards.length > 0;
  const isUsingSavedCard = Boolean(selectedStripeCardId);

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-[#0f1020] md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <CreditCard size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Pagamento</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                Escolha como deseja concluir a compra. O checkout continua dentro da aplicação e usa o fluxo oficial da Stripe.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <ShieldCheck size={12} />
            {isStripeInternalCheckout ? 'Checkout interno' : 'Checkout seguro'}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            if (hasSavedCards) {
              onSelectSavedCard(selectedStripeCardId || stripeCards[0].id);
            }
          }}
          disabled={!hasSavedCards || isLoadingStripeCards}
          className={`rounded-[1.75rem] border p-5 text-left transition-all ${
            hasSavedCards
              ? isUsingSavedCard
                ? 'border-indigo-500 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-500/10'
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#121528]'
              : 'cursor-not-allowed border-slate-200 bg-slate-50/70 opacity-70 dark:border-slate-800 dark:bg-[#121528]'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-[#0f1020] dark:text-slate-200">
                <WalletCards size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Cartao salvo</p>
                <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">Usar um cartao ja cadastrado</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                  Informe apenas o CVV novamente para validar que voce esta com o cartao em maos.
                </p>
              </div>
            </div>
            {hasSavedCards ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                {stripeCards.length} disponivel(is)
              </span>
            ) : null}
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectNewCard}
          className={`rounded-[1.75rem] border p-5 text-left transition-all ${
            !isUsingSavedCard
              ? 'border-indigo-500 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-500/10'
              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#121528]'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-[#0f1020] dark:text-slate-200">
                <Plus size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Novo cartao</p>
                <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">Adicionar dados de outro cartao</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                  Preencha os dados no formulario seguro da Stripe e escolha se quer salvar esse cartao no perfil.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-[#0f1020] dark:text-slate-300">
              Formulario seguro
            </span>
          </div>
        </button>
      </div>

      {hasSavedCards ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#121528]">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Cartoes disponiveis</p>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                A selecao abaixo altera apenas a UI. A cobranca continua sendo criada pelas fachadas oficiais do checkout.
              </p>
            </div>
            {isLoadingStripeCards ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-[#0f1020] dark:text-slate-300">
                Carregando...
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {stripeCards.map((card: any) => {
              const isSelected = selectedStripeCardId === card.id;

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelectSavedCard(card.id)}
                  className={`rounded-[1.5rem] border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-500/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#0f1020]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        {String(card.brand || 'card').toUpperCase()}
                      </p>
                      <p className="text-base font-black text-slate-900 dark:text-white">
                        {formatMaskedCardLabelAscii(card, { includeBrand: false })}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Expira em {String(card.exp_month).padStart(2, '0')}/{String(card.exp_year).slice(-2)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {Number(card.is_default) === 1 ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                          Padrao
                        </span>
                      ) : null}
                      {isSelected ? <CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-400" /> : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#121528]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-[#0f1020] dark:text-slate-200">
              <Clock3 size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">Nenhum cartao salvo encontrado</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                Voce ainda pode pagar normalmente com um novo cartao. Se preferir, salve esse cartao no final para acelerar as proximas compras.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#121528]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Parcelamento</p>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              As opcoes abaixo usam o valor comercial exibido no checkout, sem redefinir o estado financeiro final no frontend.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-[#0f1020] dark:text-slate-300">
            <Lock size={12} />
            Processo protegido
          </div>
        </div>

        <div className="mt-4">
          <select
            value={String(selectedInstallmentCount)}
            onChange={(event) => onInstallmentChange(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
          >
            <option value="1">
              1x de R$ {checkoutFinalCycleAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </option>
            {supportsStripeBillingChoices && Array.from({ length: maxInstallments - 1 }, (_, index) => {
              const installments = index + 2;
              const installmentAmount = Number((checkoutFinalCycleAmount / installments).toFixed(2));
              return (
                <option key={installments} value={String(installments)}>
                  {installments}x de R$ {installmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </option>
              );
            })}
          </select>
        </div>
      </div>
    </div>
  );
};

export default CheckoutStripePaymentMethodPanel;

