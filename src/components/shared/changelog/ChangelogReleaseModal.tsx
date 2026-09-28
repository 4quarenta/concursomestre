'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, X } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { changelogService, type ChangelogEntry } from '@services/changelog';

const formatReleaseDate = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

export default function ChangelogReleaseModal() {
  const { currentUser, isLoading } = useAuth();
  const userId = currentUser?.id ? String(currentUser.id) : '';
  return <ChangelogReleaseModalForUser key={userId || 'anonymous'} userId={userId} isLoading={isLoading} />;
}

function ChangelogReleaseModalForUser({ userId, isLoading }: { userId: string; isLoading: boolean }) {
  const router = useRouter();
  const [entry, setEntry] = React.useState<ChangelogEntry | null>(null);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const dismissedEntryRef = React.useRef<number | null>(null);

  const loadUnread = React.useCallback(async () => {
    if (!userId) return;
    try {
      const unread = await changelogService.latestUnread();
      if (!unread || dismissedEntryRef.current === unread.id) return;
      setEntry(unread);
      setOpen(true);
      setError('');
    } catch {
      // Novidades nao devem interromper o uso do produto quando a API estiver indisponivel.
    }
  }, [userId]);

  React.useEffect(() => {
    if (isLoading || !userId) return;
    const initialFetch = window.setTimeout(() => void loadUnread(), 0);
    const interval = window.setInterval(() => void loadUnread(), 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadUnread();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isLoading, loadUnread, userId]);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const dismissForSession = () => {
    if (entry) dismissedEntryRef.current = entry.id;
    setOpen(false);
  };

  const acknowledge = async (): Promise<boolean> => {
    if (!entry || saving) return false;
    setSaving(true);
    setError('');
    try {
      await changelogService.markViewed(entry.id);
      setOpen(false);
      setEntry(null);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nao foi possivel confirmar a leitura. Tente novamente.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openAllNews = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (await acknowledge()) router.push('/novidades');
  };

  if (!entry) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="changelog-release-title"
      aria-describedby="changelog-release-description"
      onCancel={(event) => { event.preventDefault(); dismissForSession(); }}
      onClick={(event) => { if (event.target === dialogRef.current) dismissForSession(); }}
      className="m-auto max-h-[min(88dvh,760px)] w-[min(700px,calc(100%-24px))] max-w-none overflow-hidden rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex max-h-[min(88dvh,760px)] flex-col">
        <header className="relative shrink-0 px-6 pb-5 pt-9 text-center sm:px-9">
          <button
            type="button"
            onClick={dismissForSession}
            aria-label="Fechar novidades por enquanto"
            className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <X size={20} />
          </button>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-800 dark:text-indigo-300">Notas de atualização</p>
          <h2 id="changelog-release-title" className="mx-auto mt-2 max-w-xl text-2xl font-black leading-tight sm:text-3xl">{entry.title}</h2>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <CalendarDays size={15} /> {formatReleaseDate(entry.releaseDate)}
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto border-y border-slate-200 px-6 py-5 dark:border-slate-700 sm:px-9">
          <p id="changelog-release-description" className="border-l-[3px] border-indigo-700 pl-4 text-base italic leading-7 text-slate-600 dark:text-slate-300">
            {entry.description}
          </p>
          <div className="mt-6 space-y-6">
            {entry.content.map((section, index) => (
              <section key={`${entry.id}-${index}`}>
                <h3 className="border-b border-slate-200 pb-2 text-xs font-black uppercase tracking-[0.12em] dark:border-slate-700">{section.title}</h3>
                <ul className="mt-3 space-y-3">
                  {section.items.map((item, itemIndex) => (
                    <li key={`${entry.id}-${index}-${itemIndex}`} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                      <Check size={17} className="mt-1 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {error ? <p role="alert" className="mt-5 text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p> : null}
        </div>

        <footer className="flex shrink-0 flex-col-reverse items-center justify-between gap-3 px-6 py-4 sm:flex-row sm:px-9">
          <Link href="/novidades" onClick={(event) => void openAllNews(event)} className="text-sm font-bold text-indigo-800 underline-offset-4 hover:underline dark:text-indigo-300">
            Ver todas as novidades
          </Link>
          <button
            type="button"
            onClick={() => void acknowledge()}
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-indigo-900 px-5 text-sm font-bold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-wait disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            {saving ? 'Salvando...' : 'Entendi'}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
