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

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Target } from 'lucide-react';
import { useData } from '@providers/DataProvider';
import { buildSubjectPerformanceData, calculateAccuracySummary } from '@services/dashboard/dashboardInsightsService';

/**
 * Pagina detalhada de desempenho por materia.
 * Ela expande o card do dashboard para listar todos os indicadores do usuario por materia.
 *
 * @since 1.0.0
 */
const PerformanceSubjectsPage: React.FC = () => {
  const { userAnswers, questions, ensureUserProgressLoaded } = useData();

  /**
   * Garante que o historico do usuario esteja pronto antes da tabela detalhada.
   *
   * @since 1.0.0
   */
  React.useEffect(() => {
    ensureUserProgressLoaded();
  }, [ensureUserProgressLoaded]);

  const subjectMetrics = useMemo(
    () => buildSubjectPerformanceData(userAnswers, questions),
    [questions, userAnswers],
  );

  const summary = useMemo(
    () => calculateAccuracySummary(userAnswers),
    [userAnswers],
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={14} />
            Voltar ao dashboard
          </Link>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
            Performance detalhada
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            Todos os dados por materia
          </h1>
          <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Veja onde voce esta forte, onde esta errando mais e quais materias pedem revisao.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.8rem] border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Materias</p>
            <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{subjectMetrics.length}</p>
          </div>
          <div className="rounded-[1.8rem] border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Questoes</p>
            <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{summary.totalQuestions}</p>
          </div>
          <div className="rounded-[1.8rem] border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Precisao geral</p>
            <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{summary.accuracyRate}%</p>
          </div>
        </div>
      </header>

      <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Tabela completa</h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Resultados consolidados por materia.</p>
          </div>
        </div>

        {subjectMetrics.length > 0 ? (
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
                {subjectMetrics.map((subject) => (
                  <tr
                    key={subject.name}
                    className="rounded-[1.6rem] bg-slate-50 text-sm font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    <td className="rounded-l-[1.6rem] px-4 py-4 font-black text-slate-900 dark:text-slate-100">{subject.name}</td>
                    <td className="px-4 py-4">{subject.total}</td>
                    <td className="px-4 py-4 text-teal-600 dark:text-teal-300">{subject.correct}</td>
                    <td className="px-4 py-4 text-orange-600 dark:text-orange-300">{subject.wrong}</td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-[170px] items-center gap-3">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-teal-500 via-indigo-500 to-fuchsia-500"
                            style={{ width: `${subject.accuracy}%` }}
                          />
                        </div>
                        <span className="text-xs font-black">{subject.accuracy}%</span>
                      </div>
                    </td>
                    <td className="rounded-r-[1.6rem] px-4 py-4">
                      <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                        <Target size={12} />
                        {subject.accuracy >= 75 ? 'Muito bem' : subject.accuracy >= 50 ? 'Atencao' : 'Revisar'}
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
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">Resolva questoes para preencher esta analise detalhada.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default PerformanceSubjectsPage;
