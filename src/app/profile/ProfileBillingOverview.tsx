'use client';

import type { ReactNode } from 'react';
import { BadgeCheck, Check, CreditCard, FileText, RefreshCw } from 'lucide-react';
import { PLATFORM_SURFACE_CARD_CLASS } from '@constants/layout';

type LatestPayment = { amount: string; date: string; status: string; statusClass: string };

type Props = {
    active: boolean;
    manualGrant: boolean;
    freePlan: boolean;
    planName: string;
    planCycle: string;
    planPrice: string;
    nextChargeDate?: string;
    nextChargeAmount?: string;
    accessUntil?: string;
    renewalEnabled: boolean;
    renewalUpdating: boolean;
    subscriptionStatus: string;
    cardLabel?: string;
    cardExpiry?: string;
    cardWarning?: string;
    cardLoadError?: string | null;
    latestPayment?: LatestPayment;
    refundPending: boolean;
    canceledButActive: boolean;
    withinRefundWindow: boolean;
    banners?: ReactNode;
    paymentMethodsContent?: ReactNode;
    paymentMethodsExpanded?: boolean;
    onChoosePlan: () => void;
    onToggleRenewal: () => void;
    onCancelSubscription: () => void;
    onCancelRefund: () => void;
    onManageCards: () => void;
    onHistory: () => void;
};

const benefits = [
    'Acesso a questões e provas',
    'Simulados para treinar',
    'Lei comentada e mapas mentais',
    'Cronograma e Raio-X da banca',
    'E muito mais',
];

export default function ProfileBillingOverview(props: Props) {
    const {
        active, manualGrant, freePlan, planName, planCycle, planPrice, nextChargeDate, nextChargeAmount,
        accessUntil, renewalEnabled, renewalUpdating, subscriptionStatus, cardLabel, cardExpiry,
        cardWarning, cardLoadError, latestPayment, refundPending, canceledButActive,
        withinRefundWindow, banners, paymentMethodsContent, paymentMethodsExpanded, onChoosePlan, onToggleRenewal, onCancelSubscription, onCancelRefund,
        onManageCards, onHistory,
    } = props;
    const hasSubscription = active || manualGrant;

    return (
        <div className="space-y-4">
            {banners}
            {freePlan && !hasSubscription ? (
                <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">SEM ASSINATURA ATIVA</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Plano gratuito</span>
                    </div>
                    <div className="grid gap-5 p-5 md:grid-cols-[1.2fr_0.8fr] md:p-6">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Plano atual</p>
                            <h2 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">Plano Gratuito</h2>
                            <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">SEM ASSINATURA</span>
                            <p className="mt-3 font-semibold text-slate-800 dark:text-slate-200">Você ainda não possui um plano pago.</p>
                            <p className="mt-1 max-w-xl text-sm leading-5 text-slate-600 dark:text-slate-300">Assine um plano para ter acesso completo às funcionalidades do ConcursoMestre e potencializar sua preparação.</p>
                            <button type="button" onClick={onChoosePlan} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Conhecer planos <span aria-hidden="true">›</span></button>
                            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"><BadgeCheck size={16} /> Acesso gratuito ativo</p>
                            <p className="ml-6 text-xs text-slate-500 dark:text-slate-400">Você pode continuar utilizando as funcionalidades do plano gratuito.</p>
                        </div>
                        <div className="border-t border-slate-200 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0 dark:border-slate-800">
                            <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Com um plano, você também terá:</p>
                            <ul className="space-y-3">{benefits.map((benefit) => <li key={benefit} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><Check size={15} className="shrink-0 text-blue-600" />{benefit}</li>)}</ul>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                        <div className="flex items-start gap-3"><CreditCard size={20} className="mt-0.5 shrink-0 text-slate-600 dark:text-slate-300" /><div><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Formas de pagamento</p>{cardLoadError ? <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{cardLoadError}</p> : cardLabel ? <><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{cardLabel}</p><p className="text-xs text-slate-500 dark:text-slate-400">Expira em {cardExpiry}{cardWarning ? ` · ${cardWarning}` : ''}</p></> : <><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Nenhum cartão salvo</p><p className="text-xs text-slate-500 dark:text-slate-400">Adicione um cartão para facilitar sua futura assinatura.</p></>}</div></div>
                        <button type="button" aria-expanded={Boolean(paymentMethodsExpanded)} onClick={onManageCards} className="min-h-10 rounded-md border border-blue-500 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10">{paymentMethodsExpanded ? 'Fechar cartões' : cardLabel ? 'Gerenciar cartões' : 'Adicionar cartão'}</button>
                    </div>
                    {paymentMethodsExpanded && paymentMethodsContent}
                </section>
            ) : (
                <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
                    <div className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">ASSINATURA ATIVA</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{manualGrant ? 'Acesso vitalício' : subscriptionStatus}</span>
                    </div>
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div><p className="text-sm text-slate-500 dark:text-slate-400">Plano atual</p><h2 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{planName}</h2><p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{manualGrant ? 'Acesso Elite concedido pela administração, sem cobrança ou renovação.' : <>Plano {planCycle.toLowerCase()} <span className="mx-1">·</span> <strong>{planPrice}</strong>{nextChargeDate && <> <br />Próxima renovação: {nextChargeDate}</>}</>}</p></div>
                    </div>
                    {!manualGrant && <>
                        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center dark:border-slate-800">
                            <RefreshCw size={20} className="shrink-0 text-slate-700 dark:text-slate-300" />
                            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Renovação automática</p><p className="text-sm text-slate-600 dark:text-slate-300">{canceledButActive ? `Encerramento programado para ${accessUntil || 'o fim do período atual'}.` : renewalEnabled ? `Sua assinatura será renovada em ${nextChargeDate || 'data a confirmar'}${nextChargeAmount ? ` por ${nextChargeAmount}` : ''}.` : `Renovação desativada. Seu acesso segue até ${accessUntil || 'o fim do período atual'}.`}</p></div>
                            <button type="button" role="switch" aria-checked={renewalEnabled} aria-label={renewalEnabled ? 'Desativar renovação automática' : 'Ativar renovação automática'} disabled={renewalUpdating} onClick={onToggleRenewal} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${renewalEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}><span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${renewalEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                            <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={onToggleRenewal} disabled={renewalUpdating || !renewalEnabled} className="text-sm font-medium text-blue-700 underline disabled:cursor-default disabled:no-underline disabled:text-slate-400 dark:text-blue-300">{renewalEnabled ? 'Cancelar renovação' : canceledButActive ? 'Religar renovação' : 'Renovação desativada'}</button><button type="button" onClick={refundPending ? onCancelRefund : onCancelSubscription} className="text-sm font-medium text-blue-700 underline dark:text-blue-300">{refundPending ? 'Cancelar pedido' : 'Cancelar assinatura'}</button></div>
                        </div>
                        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center dark:border-slate-800">
                            <CreditCard size={20} className="shrink-0 text-slate-700 dark:text-slate-300" />
                            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Forma de pagamento</p>{cardLoadError ? <p className="text-sm text-amber-700 dark:text-amber-300">{cardLoadError}</p> : cardLabel ? <><p className="text-sm text-slate-700 dark:text-slate-300">{cardLabel}</p><p className="text-xs text-slate-500 dark:text-slate-400">Expira em {cardExpiry}{cardWarning ? ` · ${cardWarning}` : ''}</p></> : <p className="text-sm text-slate-600 dark:text-slate-300">Nenhum cartão salvo</p>}</div>
                            <button type="button" aria-expanded={Boolean(paymentMethodsExpanded)} onClick={onManageCards} className="min-h-10 shrink-0 rounded-md border border-blue-500 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10">{paymentMethodsExpanded ? 'Fechar cartões' : 'Gerenciar pagamento'}</button>
                        </div>
                        {paymentMethodsExpanded && paymentMethodsContent}
                        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center dark:border-slate-800">
                            <FileText size={20} className="shrink-0 text-slate-700 dark:text-slate-300" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Último pagamento</p>{latestPayment ? <p className="text-sm text-slate-700 dark:text-slate-300"><strong>{latestPayment.amount}</strong> <span className={`mx-2 rounded-full px-2 py-1 text-xs font-semibold ${latestPayment.statusClass}`}>{latestPayment.status}</span>{latestPayment.date}</p> : <p className="text-sm text-slate-600 dark:text-slate-300">Nenhum pagamento registrado.</p>}</div><button type="button" onClick={onHistory} className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">Ver histórico ›</button>
                        </div>
                        {withinRefundWindow && <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">Você está dentro do prazo de reembolso de 7 dias.</p>}
                    </>
                    }
                    {manualGrant && <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">Acesso vitalício gratuito. Não há cobrança recorrente.</div>}
                </section>
            )}
        </div>
    );
}
