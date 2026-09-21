'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { profileService } from '@services/profile';

export default function MarketingEmailPreferenceControl({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['profile', 'communication-preference', 'marketing-email', userId] as const;
  const preference = useQuery({
    queryKey,
    queryFn: profileService.getMarketingEmailPreference,
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
  const mutation = useMutation({
    mutationFn: profileService.updateMarketingEmailPreference,
    onSuccess: (enabled) => queryClient.setQueryData(queryKey, enabled),
  });
  const enabled = preference.data ?? true;

  return (
    <div className="flex items-center justify-between gap-4 py-5">
      <div className="flex items-start gap-4">
        <div className="mt-1 text-slate-400"><Bell size={20} /></div>
        <div>
          <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">E-mails de marketing e novidades</span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Receba campanhas e novidades. E-mails obrigatórios de cobrança, segurança e suporte continuam separados.</span>
          {preference.isError || mutation.isError ? <span role="alert" className="mt-1 block text-xs text-rose-600">Não foi possível salvar esta preferência.</span> : null}
          <span role="status" aria-live="polite" className="mt-1 block text-xs text-slate-500">
            {preference.isPending ? 'Carregando preferência...' : mutation.isPending ? 'Salvando...' : mutation.isSuccess ? 'Preferência salva.' : ''}
          </span>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-label="E-mails de marketing e novidades"
        aria-checked={enabled}
        disabled={!userId || preference.isPending || preference.isError || mutation.isPending}
        onClick={() => mutation.mutate(!enabled)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 ${enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${enabled ? 'right-1' : 'left-1'}`} />
      </button>
    </div>
  );
}
