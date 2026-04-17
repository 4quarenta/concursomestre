import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, ShieldCheck, Star, Zap } from 'lucide-react';
import { buildPromotionMetadata, loadPublicPromotionPageData } from '@/lib/publicPromotion';

interface PromoPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 900;

export async function generateMetadata(): Promise<Metadata> {
  return buildPromotionMetadata(await loadPublicPromotionPageData());
}

export default async function PromoPage({ params }: PromoPageProps) {
  const { slug } = await params;
  const pageData = await loadPublicPromotionPageData();
  const promo = pageData.promotion;

  if (!pageData.isEnabled || slug !== promo.slug) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 transition-colors dark:bg-slate-950">
      <div className="relative w-full overflow-hidden px-6 py-24 text-center text-white" style={{ backgroundColor: promo.themeColor }}>
        <div className="relative z-10 mx-auto max-w-4xl space-y-8">
          <span className="inline-block rounded-full border border-white/10 bg-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.2em]">
            Oferta por tempo limitado
          </span>
          <h1 className="text-5xl font-black leading-none tracking-tight md:text-7xl">{promo.landingPageHeadline}</h1>
          <p className="mx-auto max-w-2xl text-xl font-medium leading-relaxed opacity-90 md:text-2xl">{promo.landingPageSubheadline}</p>
          <div className="pt-4">
            <Link
              href="/planos"
              className="inline-flex rounded-full bg-white px-12 py-5 text-sm font-black uppercase tracking-widest text-slate-900 shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              Quero aproveitar {promo.discountPercentage}% OFF
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-16 text-center text-4xl font-black text-slate-900 transition-colors dark:text-slate-100">Por que assinar agora?</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {promo.featuresHighlight.map((feat, idx) => (
            <div key={feat} className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 shadow-sm transition-all dark:bg-slate-800 dark:text-indigo-400">
                {idx === 0 ? <Zap size={32} /> : idx === 1 ? <ShieldCheck size={32} /> : <Star size={32} />}
              </div>
              <h3 className="mb-3 text-2xl font-black text-slate-900 transition-colors dark:text-slate-100">{feat}</h3>
              <p className="leading-relaxed text-slate-500 transition-colors dark:text-slate-400">
                Aproveite recursos premium para acelerar sua preparacao com mais clareza, profundidade e consistencia.
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 px-6 py-24 transition-colors dark:bg-slate-950">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-fuchsia-700 p-12 text-center text-white shadow-2xl md:p-20">
          <div className="relative z-10 flex flex-col items-center">
            <h2 className="mb-8 text-4xl font-black md:text-5xl">Plano Elite Anual</h2>
            <div className="mb-10 flex flex-col items-center justify-center gap-4 md:flex-row">
              <span className="text-2xl font-bold opacity-50 line-through">R$ {pageData.settings.pricing.Elite.annual.toFixed(2).replace('.', ',')}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-black uppercase tracking-widest opacity-80">Apenas</span>
                <span className="text-6xl font-black md:text-8xl">
                  R$ {(pageData.settings.pricing.Elite.annual * (1 - promo.discountPercentage / 100)).toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
            <p className="mb-12 max-w-xl text-lg font-medium text-indigo-100 opacity-90">
              Sua jornada rumo a estabilidade comeca com uma decisao mais estrategica.
            </p>
            <Link
              href="/planos"
              className="w-full rounded-2xl bg-white px-16 py-6 text-sm font-black uppercase tracking-widest text-indigo-700 shadow-xl transition-all hover:bg-slate-50 hover:scale-105 active:scale-95 md:w-auto"
            >
              Assinar com desconto
            </Link>
            <div className="mt-8 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest opacity-70">
              <Check size={14} /> Garantia de 7 dias
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
