'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Loader2, Target } from 'lucide-react';
import BrandLink from '@/components/shared/BrandLink';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import { readApiErrorMessage } from '@/lib/browserApi';
import {
  statisticsService,
  type SubjectStatistics,
  type UserStatistics,
} from '@/services/statistics/statisticsService';

const formatAverageTime = (averageTime: number) => {
  if (!Number.isFinite(averageTime) || averageTime <= 0) {
    return 'Sem leitura';
  }

  if (averageTime < 60) {
    return `${Math.round(averageTime)}s`;
  }

  const minutes = Math.floor(averageTime / 60);
  const seconds = Math.round(averageTime % 60);
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

const buildPerformanceLabel = (subject: SubjectStatistics) => {
  if (subject.accuracyRate >= 75) {
    return 'Muito bem';
  }

  if (subject.accuracyRate >= 50) {
    return 'Atencao';
  }

  return 'Revisar';
};

export default function PerformanceSubjectsPageClient() {
  const { currentUser, isAuthenticated, isLoading: authLoading } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<UserStatistics | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated || !currentUser?.id) {
      setStats(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadStatistics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextStats = await statisticsService.getUserStatistics(currentUser.id);
        if (!isMounted) {
          return;
        }

        setStats(nextStats);
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setError(readApiErrorMessage(requestError, 'Nao foi possivel carregar a performance por materia.'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadStatistics();

    return () => {
      isMounted = false;
    };
  }, [authLoading, currentUser?.id, isAuthenticated]);

  const sortedSubjects = useMemo(
    () => [...(stats?.subjectBreakdown || [])].sort((left, right) => right.totalQuestions - left.totalQuestions),
    [stats?.subjectBreakdown],
  );

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 size={40} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Carregando performance detalhada...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center text-center">
          <BrandLink className="mb-8" />
          <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <BookOpen size={28} />
            </div>
            <h1 className="mt-6 text-2xl font-black text-slate-900 dark:text-slate-100">Entre para ver sua performance</h1>
            <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Seus indicadores por materia ficam aqui, com leitura consolidada de acertos, erros e precisao.
            </p>
            <Link
              href="/auth?mode=login&redirect=/performance/subjects"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-indigo-700"
            >
              Entrar agora
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <BrandLink className="mb-3" />
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={14} />
            Voltar ao dashboard
          </Link>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
            Performance detalhada
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">
            Todos os dados por materia
          </h1>
          <p className="text-sm font-medium leading-7 text-slate-500 dark:text-slate-400 md:text-base">
            Veja onde voce esta forte, onde esta errando mais e quais materias pedem revisao.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.8rem] border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Materias</p>
            <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{sortedSubjects.length}</p>
          </div>
          <div className="rounded-[1.8rem] border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Questoes</p>
            <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{stats?.totalQuestionsAnswered || 0}</p>
          </div>
          <div className="rounded-[1.8rem] border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Precisao geral</p>
            <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{stats?.accuracyRate || 0}%</p>
          </div>
        </div>
      </header>

      <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Tabela completa</h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Resultados consolidados por materia.</p>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {sortedSubjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-2">Materia</th>
                  <th className="px-4 py-2">Questoes</th>
                  <th className="px-4 py-2">Acertos</th>
                  <th className="px-4 py-2">Erros</th>
                  <th className="px-4 py-2">Precisao</th>
                  <th className="px-4 py-2">Leitura</th>
                </tr>
              </thead>
              <tbody>
                {sortedSubjects.map((subject) => (
                  <tr
                    key={subject.subject}
                    className="rounded-[1.6rem] bg-slate-50 text-sm font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    <td className="rounded-l-[1.6rem] px-4 py-4 font-black text-slate-900 dark:text-slate-100">{subject.subject}</td>
                    <td className="px-4 py-4">{subject.totalQuestions}</td>
                    <td className="px-4 py-4 text-teal-600 dark:text-teal-300">{subject.correctAnswers}</td>
                    <td className="px-4 py-4 text-orange-600 dark:text-orange-300">{subject.wrongAnswers}</td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-[170px] items-center gap-3">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-teal-500 via-indigo-500 to-fuchsia-500"
                            style={{ width: `${subject.accuracyRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-black">{subject.accuracyRate}%</span>
                      </div>
                    </td>
                    <td className="rounded-r-[1.6rem] px-4 py-4">
                      <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                        <Target size={12} />
                        {buildPerformanceLabel(subject)} · {formatAverageTime(subject.averageTime)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-950">
            <p className="text-lg font-bold text-slate-700 dark:text-slate-200">Nenhuma materia consolidada ainda.</p>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              Resolva questoes para preencher esta analise detalhada.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
