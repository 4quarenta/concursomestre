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

import React, { useState } from 'react';
import { CreditCard, FileText, Plus, QrCode, Smartphone, Trash2, Wallet } from 'lucide-react';
import type { StripePaymentMethodSetting, StripePaymentMethodsSettings } from '@types';
import { normalizeStripePaymentMethodsSettings } from '@services/payments/stripePaymentMethodsConfig';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';

interface StripePaymentMethodsSettingsProps {
  value?: StripePaymentMethodsSettings;
  onChange: (value: StripePaymentMethodsSettings) => void;
}

const methodIconMap: Record<string, React.ElementType> = {
  card: CreditCard,
  pix: QrCode,
  boleto: FileText,
  apple_pay: Smartphone,
  google_pay: Wallet,
};

const inputClassName = `w-full ${ADMIN_FIELD_CLASS}`;

/**
 * Configuração administrativa dos métodos Stripe aceitos pelo checkout.
 * Métodos sem suporte no checkout atual são persistidos, mas não viram atalho financeiro.
 * @since v1.0.0
 */
const StripePaymentMethodsSettings = ({ value, onChange }: StripePaymentMethodsSettingsProps) => {
  const normalized = normalizeStripePaymentMethodsSettings(value);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftStripeType, setDraftStripeType] = useState('');

  const updateMethod = (methodId: string, patch: Partial<StripePaymentMethodSetting>) => {
    onChange({
      methods: normalized.methods.map((method) => (
        method.id === methodId ? { ...method, ...patch } : method
      )),
    });
  };

  const removeMethod = (methodId: string) => {
    onChange({
      methods: normalized.methods.filter((method) => method.id !== methodId || !method.removable),
    });
  };

  const addMethod = () => {
    const label = draftLabel.trim();
    const stripeType = draftStripeType.trim().toLowerCase();
    if (!label || !stripeType) {
      return;
    }

    const baseId = `custom_${stripeType.replace(/[^a-z0-9_:-]/g, '_')}`;
    let suffix = normalized.methods.length + 1;
    let id = `${baseId}_${suffix}`;
    while (normalized.methods.some((method) => method.id === id)) {
      suffix += 1;
      id = `${baseId}_${suffix}`;
    }

    onChange({
      methods: [
        ...normalized.methods,
        {
          id,
          label,
          stripeType,
          enabled: false,
          checkoutSupported: false,
          recurringSupported: false,
          removable: true,
          description: 'Método customizado. Ative apenas após existir implementação e configuração equivalente na Stripe.',
        },
      ],
    });
    setDraftLabel('');
    setDraftStripeType('');
  };

  return (
    <section className={ADMIN_PAGE_PANEL_CLASS}>
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Stripe</p>
          <h4 className="mt-1 text-lg font-black text-slate-950 dark:text-white">Formas de pagamento</h4>
          <p className="mt-2 max-w-3xl text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
            Ative somente métodos habilitados também na Stripe. O checkout interno exibe apenas métodos com suporte operacional implementado.
          </p>
        </div>
        <div className="rounded-sm border border-slate-300 bg-slate-100 px-4 py-3 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
          {normalized.methods.filter((method) => method.enabled).length} ativos
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {normalized.methods.map((method) => {
          const Icon = methodIconMap[method.id] || Wallet;
          const canShowInCheckout = method.enabled && method.checkoutSupported;

          return (
            <article key={method.id} className={ADMIN_PAGE_PANEL_CLASS}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-slate-100 text-sky-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-sky-300">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-950 dark:text-white">{method.label}</p>
                      <span className="rounded-sm bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">{method.stripeType}</span>
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{method.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={method.enabled}
                  onClick={() => updateMethod(method.id, { enabled: !method.enabled })}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all ${
                    method.enabled ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${method.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${canShowInCheckout ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                  {canShowInCheckout ? 'Checkout visível' : 'Não exibido no checkout'}
                </span>
                <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${method.recurringSupported ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {method.recurringSupported ? 'Recorrência' : 'Sem recorrência'}
                </span>
                <button
                  type="button"
                  onClick={() => updateMethod(method.id, { checkoutSupported: !method.checkoutSupported })}
                  className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-colors ${
                    method.checkoutSupported
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {method.checkoutSupported ? 'Ocultar checkout' : 'Exibir checkout'}
                </button>
                <button
                  type="button"
                  onClick={() => updateMethod(method.id, { recurringSupported: !method.recurringSupported })}
                  className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-colors ${
                    method.recurringSupported
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {method.recurringSupported ? 'Sem recorrência' : 'Com recorrência'}
                </button>
                {method.removable ? (
                  <button type="button" onClick={() => removeMethod(method.id)} className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
                    <Trash2 size={12} /> Remover
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 rounded-sm border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Adicionar método Stripe</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} className={inputClassName} placeholder="Nome exibido, ex: Link" />
          <input value={draftStripeType} onChange={(event) => setDraftStripeType(event.target.value)} className={inputClassName} placeholder="Stripe type, ex: link" />
          <button type="button" onClick={addMethod} disabled={!draftLabel.trim() || !draftStripeType.trim()} className={`${ADMIN_PRIMARY_BUTTON_CLASS} justify-center px-5 py-2 text-[10px] uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:bg-slate-300`}>
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>
    </section>
  );
};

export default StripePaymentMethodsSettings;
