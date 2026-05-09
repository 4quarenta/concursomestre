'use client';

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

import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardList,
  Filter,
  Search,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import {
  PLATFORM_MAIN_CONTENT_WIDTH_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';

type ConcursoCard = {
  id: string;
  title: string;
  banca: string;
  orgao: string;
  cargo: string;
  ano: string;
};

const buildFallbackCards = (
  agencies: string[],
  roles: string[],
  years: string[],
): ConcursoCard[] => {
  const safeAgencies = agencies.slice(0, 8);
  const safeRoles = roles.slice(0, 8);
  const safeYears = years.slice(0, 6);

  const cards: ConcursoCard[] = [];

  safeAgencies.forEach((agency, agencyIndex) => {
    const role = safeRoles[agencyIndex % Math.max(1, safeRoles.length)] || 'Cargo geral';
    const year = safeYears[agencyIndex % Math.max(1, safeYears.length)] || '2026';
    cards.push({
      id: `${agency}-${role}-${year}`.toLowerCase().replace(/\s+/g, '-'),
      title: `${role} · ${agency}`,
      banca: agency,
      orgao: agency,
      cargo: role,
      ano: year,
    });
  });

  return cards;
};

/**
 * Landing operacional da area de concursos.
 * Usa taxonomias ja existentes para montar um catalogo inicial navegavel
 * sem introduzir contrato fake ou logica critica fora da arquitetura.
 *
 * @since 1.0.0
 */
const ConcursosPage: React.FC = () => {
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('Todos');

  const agencies = useMemo(
    () => (systemSettings?.taxonomies?.agencies || []).map((item) => item.name).filter(Boolean),
    [systemSettings],
  );

  const roles = useMemo(
    () => (systemSettings?.taxonomies?.roles || []).map((item) => item.name).filter(Boolean),
    [systemSettings],
  );

  const years = useMemo(
    () => (systemSettings?.taxonomies?.years || []).map(String).filter(Boolean).sort().reverse(),
    [systemSettings],
  );

  const concursos = useMemo(
    () => buildFallbackCards(agencies, roles, years),
    [agencies, roles, years],
  );

  const filteredConcursos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return concursos.filter((concurso) => {
      const matchesYear = selectedYear === 'Todos' || concurso.ano === selectedYear;
      const matchesSearch = !normalizedSearch || [
        concurso.title,
        concurso.banca,
        concurso.orgao,
        concurso.cargo,
      ].some((value) => value.toLowerCase().includes(normalizedSearch));

      return matchesYear && matchesSearch;
    });
  }, [concursos, searchTerm, selectedYear]);

  return (
    <div className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} space-y-6 animate-fade-in`}>
      <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-6 py-8 text-white md:px-8">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-200">
              Catalogo de oportunidades
            </p>
            <div className="mt-4 flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-indigo-100">
                <Briefcase size={24} />
              </div>
              <div>
                <h1 className={`${PLATFORM_PAGE_TITLE_CLASS} text-white`}>Concursos</h1>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300">
                  Uma area dedicada para organizar editais, bancas, cargos e historicos de prova em um catalogo unico.
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Bancas</p>
                <p className="mt-2 text-2xl font-black text-white">{agencies.length}</p>
              </div>
              <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-100">Cargos</p>
                <p className="mt-2 text-2xl font-black text-white">{roles.length}</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">Anos</p>
                <p className="mt-2 text-2xl font-black text-white">{years.length}</p>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">Catalogados</p>
                <p className="mt-2 text-2xl font-black text-white">{concursos.length}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between bg-slate-50 px-6 py-8 dark:bg-slate-950/80 md:px-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                O que entra aqui
              </p>
              <div className="mt-4 space-y-4">
                {[
                  'Catalogo de concursos por banca, cargo e periodo.',
                  'Historico de provas e materiais vinculados.',
                  'Base pronta para filtros, acompanhamento e SEO por edital.',
                ].map((step, index) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white dark:bg-indigo-500">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-6 md:p-8`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Explorar
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">Catalogo inicial de concursos</h2>
            <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
              Esta primeira versao usa as taxonomias ja existentes da plataforma para estruturar a navegacao por concursos.
            </p>
          </div>
          <div className="inline-flex rounded-2xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {filteredConcursos.length} resultado(s)
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por banca, orgao ou cargo..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
            />
          </div>
          <div className="relative">
            <Calendar size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-10 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
            >
              <option value="Todos">Todos os anos</option>
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredConcursos.length === 0 ? (
          <div className="mt-6 rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-950">
            <p className="text-base font-black text-slate-900 dark:text-slate-100">Nenhum concurso encontrado.</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
              Ajuste os filtros para explorar outras bancas, cargos ou periodos.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {filteredConcursos.map((concurso) => (
              <article
                key={concurso.id}
                className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                        <ClipboardList size={18} />
                      </span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Concurso</p>
                        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">{concurso.title}</h3>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                        <Building2 size={14} className="text-slate-400" />
                        {concurso.orgao}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                        <ShieldCheck size={14} className="text-slate-400" />
                        {concurso.banca}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                        <Target size={14} className="text-slate-400" />
                        {concurso.cargo}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                        <Calendar size={14} className="text-slate-400" />
                        {concurso.ano}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 rounded-full bg-slate-100 p-2 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-[1.8rem] border border-indigo-100 bg-indigo-50/70 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/10">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
              <Filter size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">Base pronta para evoluir</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                A proxima etapa natural e vincular editais, materiais, rankings e paginas publicas por concurso, mantendo SEO e navegacao canônica.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ConcursosPage;
