'use client';

import type { FormEventHandler, ReactNode } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { formatMaskedCardLabelAscii, type SavedCard } from '@services/billing';

type Props = {
    cards: SavedCard[];
    loading: boolean;
    error?: string | null;
    adding: boolean;
    saving: boolean;
    stripeBilling: boolean;
    stripeForm?: ReactNode;
    onToggleAdd: () => void;
    onPrepareStripe: () => void;
    onSaveCard: FormEventHandler<HTMLFormElement>;
    onSetDefault: (id: string) => void;
    onRemove: (id: string) => void;
};

export default function SavedPaymentMethodsManager({
    cards, loading, error, adding, saving, stripeBilling, stripeForm,
    onToggleAdd, onPrepareStripe, onSaveCard, onSetDefault, onRemove,
}: Props) {
    return (
        <div id="billing-payment-methods" className="space-y-4 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            {error && (
                <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    {error}
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cartões salvos</p>
                <button type="button" onClick={onToggleAdd} className="min-h-9 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
                    {adding ? 'Cancelar' : 'Adicionar cartão'}
                </button>
            </div>
            {adding && (stripeBilling ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                    {stripeForm || (
                        <button type="button" onClick={onPrepareStripe} disabled={saving} className="min-h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                            {saving ? 'Preparando formulário...' : 'Continuar para adicionar cartão'}
                        </button>
                    )}
                </div>
            ) : (
                <form onSubmit={onSaveCard} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900/60">
                    <input name="cardNumber" type="text" placeholder="Número do cartão" required className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
                    <input name="cardName" type="text" placeholder="Nome no cartão" required className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
                    <input name="expiry" type="text" placeholder="Validade MM/AA" required className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
                    <select name="brand" className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="elo">Elo</option><option value="amex">Amex</option></select>
                    <button type="submit" disabled={saving} className="min-h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2">{saving ? 'Salvando...' : 'Salvar cartão'}</button>
                </form>
            ))}
            {loading ? (
                <div className="h-16 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
            ) : cards.length ? (
                <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {cards.map((card) => (
                        <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <CreditCard size={18} className="shrink-0 text-slate-500 dark:text-slate-400" />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatMaskedCardLabelAscii(card)}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Expira em {String(card.exp_month || '').padStart(2, '0')}/{card.exp_year}{Number(card.is_default) === 1 ? ' · Padrão' : ''}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {Number(card.is_default) !== 1 && <button type="button" onClick={() => onSetDefault(String(card.id))} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">Definir padrão</button>}
                                {Number(card.locked_by_recurring) !== 1 && <button type="button" onClick={() => onRemove(String(card.id))} aria-label="Remover cartão" className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-300">Remover</button>}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum cartão salvo.</p>
            )}
        </div>
    );
}
