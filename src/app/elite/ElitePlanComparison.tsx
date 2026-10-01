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

import { Check, Minus } from 'lucide-react';
import type { PlanBenefitKey, PlanEntitlements, PlanName, PlanUsageLimitKey, PlanUsageLimits } from '@types';
import { getPlanUsageLimitForPlanName, hasBenefitForPlanName } from '@services/plans/planAccess';

type ComparisonSettings = {
  planEntitlements?: Partial<PlanEntitlements>;
  planUsageLimits?: Partial<PlanUsageLimits>;
};

type CellValue = string | boolean;
type ComparisonRow = { label: string; free: CellValue; elite: CellValue };

/** Formata no comparativo o limite efetivo configurado para cada plano. */
const limitText = (plan: PlanName, key: PlanUsageLimitKey, settings?: ComparisonSettings['planUsageLimits']) => {
  const limit = getPlanUsageLimitForPlanName(plan, key, settings);
  return limit === null ? 'Ilimitadas' : `Até ${limit} por ${key === 'questions_per_day' ? 'dia' : 'mês'}`;
};

/** Confere recursos compostos usando as permissões atuais publicadas para o plano. */
const hasAllBenefits = (plan: PlanName, keys: PlanBenefitKey[], settings?: ComparisonSettings['planEntitlements']) => (
  keys.every((key) => hasBenefitForPlanName(plan, key, settings))
);

/** Apresenta o estado de um recurso de forma consistente nas versões desktop e móvel. */
function FeatureValue({ value, featured = false }: { value: CellValue; featured?: boolean }) {
  if (typeof value === 'boolean') {
    return value
      ? <Check aria-label="Incluído" size={18} strokeWidth={2.6} className="mx-auto text-emerald-400" />
      : <Minus aria-label="Não incluído" size={16} strokeWidth={2.2} className="mx-auto text-slate-500" />;
  }

  return <span className={featured ? 'font-semibold text-blue-100' : 'font-medium text-slate-300'}>{value}</span>;
}

/** Compara Gratuito e Elite na landing server-rendered /elite a partir das configurações públicas do catálogo. */
export default function ElitePlanComparison({ settings }: { settings?: ComparisonSettings }) {
  const entitlements = settings?.planEntitlements;
  const limits = settings?.planUsageLimits;
  const rows: ComparisonRow[] = [
    { label: 'Banco com mais de 3 milhões de questões', free: true, elite: true },
    {
      label: 'Questões para praticar',
      free: limitText('Gratuito', 'questions_per_day', limits),
      elite: limitText('Elite', 'questions_per_day', limits),
    },
    {
      label: 'Filtros por banca, matéria e dificuldade',
      free: hasAllBenefits('Gratuito', ['practice.filter_bank', 'practice.filter_subject', 'practice.filter_difficulty'], entitlements),
      elite: hasAllBenefits('Elite', ['practice.filter_bank', 'practice.filter_subject', 'practice.filter_difficulty'], entitlements),
    },
    {
      label: 'Filtros por órgão, ano e cargo',
      free: hasAllBenefits('Gratuito', ['practice.filter_organization', 'practice.filter_year', 'practice.filter_role'], entitlements),
      elite: hasAllBenefits('Elite', ['practice.filter_organization', 'practice.filter_year', 'practice.filter_role'], entitlements),
    },
    {
      label: 'Gabarito e resposta da questão',
      free: hasAllBenefits('Gratuito', ['question.resolve', 'question.answer_key'], entitlements),
      elite: hasAllBenefits('Elite', ['question.resolve', 'question.answer_key'], entitlements),
    },
    {
      label: 'Análise detalhada, alternativa por alternativa',
      free: hasBenefitForPlanName('Gratuito', 'question.detailed_analysis', entitlements),
      elite: hasBenefitForPlanName('Elite', 'question.detailed_analysis', entitlements),
    },
    {
      label: 'Simulados',
      free: hasBenefitForPlanName('Gratuito', 'module.simulations', entitlements)
        ? limitText('Gratuito', 'simulations_per_month', limits)
        : false,
      elite: hasBenefitForPlanName('Elite', 'module.simulations', entitlements)
        ? limitText('Elite', 'simulations_per_month', limits)
        : false,
    },
    {
      label: 'Raio-X completo da banca',
      free: hasBenefitForPlanName('Gratuito', 'module.xray', entitlements),
      elite: hasBenefitForPlanName('Elite', 'module.xray', entitlements) ? 'Completo' : false,
    },
    {
      label: 'Salvar questões e fazer anotações',
      free: hasAllBenefits('Gratuito', ['question.save', 'question.notes'], entitlements),
      elite: hasAllBenefits('Elite', ['question.save', 'question.notes'], entitlements),
    },
    {
      label: 'Painel de desempenho',
      free: 'Estatísticas básicas',
      elite: hasBenefitForPlanName('Elite', 'question.full_statistics', entitlements) ? 'Análise completa' : 'Estatísticas básicas',
    },
    {
      label: 'Estudo sem anúncios',
      free: hasBenefitForPlanName('Gratuito', 'no_ads', entitlements) ? true : 'Com anúncios',
      elite: hasBenefitForPlanName('Elite', 'no_ads', entitlements),
    },
    {
      label: 'Acesso antecipado a novidades',
      free: hasBenefitForPlanName('Gratuito', 'early_access', entitlements),
      elite: hasBenefitForPlanName('Elite', 'early_access', entitlements),
    },
  ];

  return (
    <section aria-labelledby="elite-plan-comparison-title" className="px-5 py-16 sm:px-7 sm:py-20 lg:px-9">
      <div className="mx-auto max-w-[1050px]">
        <header className="mb-7 text-center sm:mb-8">
          <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-blue-300">Escolha como quer estudar</p>
          <h2 id="elite-plan-comparison-title" className="mt-2 text-[clamp(1.7rem,3.3vw,2.15rem)] font-black leading-tight tracking-[-.04em]">
            Gratuito ou <span className="text-blue-300">Elite?</span>
          </h2>
          <p className="mt-2 text-sm text-slate-400">Compare os recursos e avance no seu ritmo.</p>
        </header>

        <div className="overflow-hidden rounded-[15px] border border-white/[.12] bg-[#0d1625] shadow-[0_18px_48px_rgba(0,0,0,.16)]">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[650px] table-fixed border-collapse text-[13px]">
              <thead className="bg-white/[.025] text-[10px] font-extrabold tracking-[.12em] text-slate-300">
                <tr>
                  <th scope="col" className="w-[58%] px-6 py-4 text-left">RECURSO</th>
                  <th scope="col" className="w-[21%] px-4 py-4 text-center">GRATUITO</th>
                  <th scope="col" className="w-[21%] bg-blue-400/[.075] px-4 py-4 text-center text-blue-200">ELITE</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-white/[.09]">
                    <th scope="row" className="px-6 py-3.5 text-left font-medium leading-5 text-slate-200">{row.label}</th>
                    <td className="px-4 py-3.5 text-center"><FeatureValue value={row.free} /></td>
                    <td className="bg-blue-400/[.035] px-4 py-3.5 text-center"><FeatureValue value={row.elite} featured /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-white/[.09] md:hidden">
            {rows.map((row) => (
              <article key={row.label} className="grid grid-cols-2 px-3.5 py-3">
                <h3 className="col-span-2 pb-2.5 text-xs font-semibold leading-5 text-slate-200">{row.label}</h3>
                <div className="border-t border-white/[.09] px-2 py-2 text-center">
                  <span className="mb-1 block text-[9px] font-extrabold tracking-[.08em] text-slate-400">GRATUITO</span>
                  <FeatureValue value={row.free} />
                </div>
                <div className="border-t border-white/[.09] bg-blue-400/[.035] px-2 py-2 text-center">
                  <span className="mb-1 block text-[9px] font-extrabold tracking-[.08em] text-blue-300">ELITE</span>
                  <FeatureValue value={row.elite} featured />
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 border-t border-white/[.09] px-4 py-3.5 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span>Comece grátis. Mude para o Elite quando quiser mais recursos.</span>
            <span className="inline-flex items-center gap-2 text-slate-300"><i aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Sem compromisso para começar</span>
          </div>
        </div>
      </div>
    </section>
  );
}
