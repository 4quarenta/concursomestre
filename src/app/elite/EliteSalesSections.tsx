import Link from 'next/link';
import { ArrowRight, Check, Instagram, Linkedin, MessageCircle, Send, ShieldCheck, Youtube } from 'lucide-react';
import type { LandingSocialIconKey } from '@types';

export interface ElitePlanOfferCard {
  planId: number;
  planName: string;
  cycleName: string;
  monthlyAmount: number;
  cycleAmount: number;
  cycleLabel: string;
  isFree: boolean;
  isRecommended: boolean;
  discountPercent: number;
  savingsAmount: number;
  checkoutHref: string;
}

interface EliteSalesSectionsProps {
  offers: ElitePlanOfferCard[];
  socialLinks: Array<{ id: string; label: string; handle: string; url: string; iconKey: LandingSocialIconKey }>;
}

const socialIcons = {
  instagram: Instagram,
  youtube: Youtube,
  telegram: Send,
  whatsapp: MessageCircle,
  linkedin: Linkedin,
} satisfies Record<LandingSocialIconKey, typeof Instagram>;

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value);

const FAQ_ITEMS = [
  {
    question: 'O que muda entre o Gratuito e o Elite?',
    answer: 'O plano Gratuito permite começar a estudar na plataforma. O Elite oferece acesso aos recursos avançados apresentados nesta página.',
  },
  {
    question: 'Como funciona a cobrança do plano anual?',
    answer: 'O valor mensal exibido é a parcela do ciclo anual. No cartão, a cobrança é feita mês a mês, conforme as condições apresentadas na finalização da compra.',
  },
  {
    question: 'Como funciona a garantia de 7 dias?',
    answer: 'A assinatura Elite conta com garantia de 7 dias. Consulte os termos da oferta no momento da contratação.',
  },
  {
    question: 'Posso começar pelo plano Gratuito?',
    answer: 'Sim. Você pode começar pelo Gratuito e escolher um dos ciclos Elite quando quiser acessar os recursos do plano.',
  },
];

export default function EliteSalesSections({ offers, socialLinks }: EliteSalesSectionsProps) {
  const freeOffer = offers.find((offer) => offer.isFree);
  const featuredOffer = offers.find((offer) => offer.isRecommended) || offers.find((offer) => !offer.isFree);
  const actionOffer = freeOffer || featuredOffer;

  return (
    <>
      <section id="elite-planos" aria-labelledby="elite-plans-title" className="px-5 pb-4 pt-14 sm:px-7 sm:pt-16 lg:px-9">
        <div className="mx-auto max-w-[1180px]">
          <header className="mb-7 text-center sm:mb-8">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-300">Planos Concurso Mestre</p>
            <h2 id="elite-plans-title" className="mt-2 text-[clamp(1.8rem,3.4vw,2.25rem)] font-black leading-tight tracking-[-.04em]">Escolha seu plano</h2>
            <p className="mt-2 text-sm text-slate-300">Comece grátis ou escolha o ciclo Elite que combina com sua preparação.</p>
          </header>

          {offers.length > 0 ? (
            <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {offers.map((offer) => (
                <article
                  key={offer.planId}
                  className={`relative flex min-w-0 flex-col rounded-2xl border p-5 transition ${offer.isRecommended
                    ? 'z-[1] border-emerald-300/60 bg-gradient-to-br from-[#172940] to-[#101a2a] shadow-[0_0_0_1px_rgba(110,220,160,.12),0_18px_48px_rgba(0,0,0,.28)] xl:-translate-y-1.5'
                    : 'border-white/[.12] bg-gradient-to-br from-[#111d30] to-[#0d1727]'
                    }`}
                >
                  <div className="flex min-h-[48px] items-start justify-between gap-2">
                    <div>
                      <p className={`text-[9px] font-extrabold uppercase tracking-[.13em] ${offer.isFree ? 'text-slate-400' : 'text-blue-300'}`}>
                        {offer.isFree ? 'Para começar' : offer.planName}
                      </p>
                      <h3 className="mt-1 text-[17px] font-extrabold text-slate-50">{offer.cycleName}</h3>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {offer.isRecommended ? <span className="rounded-full border border-blue-200/25 bg-blue-300/10 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[.05em] text-blue-100">Recomendado</span> : null}
                      {offer.discountPercent > 0 ? <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[.05em] text-emerald-200">{offer.discountPercent}% OFF</span> : null}
                    </div>
                  </div>

                  <div className="mt-3 border-t border-white/[.11] pt-4">
                    <p className="flex min-h-[43px] items-baseline gap-1 whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-100">R$</span>
                      <span className="text-[clamp(1.8rem,2.5vw,2.15rem)] font-black leading-none tracking-[-.065em] text-white">{offer.monthlyAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-[11px] text-slate-300">{offer.isFree ? '/sempre' : '/mês'}</span>
                    </p>
                    <p className="mt-1 min-h-[17px] text-[10px] text-slate-400">
                      {offer.isFree ? 'Sem cobrança' : `${formatCurrency(offer.cycleAmount)} ${offer.cycleLabel}`}
                    </p>
                    {offer.discountPercent > 0 && offer.savingsAmount > 0 ? (
                      <p className="mt-2 inline-flex rounded-md border border-emerald-300/15 bg-emerald-300/[.07] px-2 py-1 text-[9px] text-emerald-100/80">
                        Você economiza <strong className="ml-1 font-extrabold text-emerald-200">{formatCurrency(offer.savingsAmount)}</strong>
                      </p>
                    ) : null}
                  </div>

                  <p className="mt-3 min-h-[35px] text-[10px] leading-[17px] text-slate-300">
                    {offer.isFree ? 'Conheça a plataforma e comece a estudar no seu ritmo.' : `Acesso aos recursos do plano ${offer.planName}.`}
                  </p>

                  {!offer.isFree && offer.isRecommended ? (
                    <p className="mt-1 flex items-start gap-1.5 text-[9px] leading-[14px] text-slate-400">
                      <span aria-hidden="true" className="mt-0.5 text-blue-300">ⓘ</span>
                      No cartão, uma parcela é cobrada por mês.
                    </p>
                  ) : null}

                  <Link
                    href={offer.checkoutHref}
                    prefetch={false}
                    className={`mt-auto inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[10px] px-3 py-2.5 text-center text-[10px] font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-blue-300 ${offer.isRecommended
                      ? 'bg-slate-100 text-slate-950 hover:bg-white'
                      : offer.isFree
                        ? 'border border-white/[.16] bg-white/[.04] text-slate-100 hover:bg-white/[.09]'
                        : 'bg-slate-100 text-slate-950 hover:bg-white'
                      }`}
                  >
                    {offer.isFree ? 'Começar grátis' : `Assinar ${offer.cycleName.toLowerCase()}`}
                    <ArrowRight aria-hidden="true" size={14} />
                  </Link>

                  <div className="mt-3 flex min-h-[24px] flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[.10] pt-2.5 text-[8px] font-semibold text-slate-400">
                    {offer.isFree ? (
                      <span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" size={12} className="text-emerald-300" />Acesso gratuito</span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" size={12} className="text-emerald-300" />Compra segura</span>
                        <span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" size={12} className="text-emerald-300" />7 dias de garantia</span>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-white/[.12] bg-white/[.03] p-6 text-center text-sm text-slate-300">Consulte os planos disponíveis no momento.</p>
          )}

          <p className="mt-4 text-center text-[9px] text-slate-500">Os valores e condições vigentes são apresentados antes da confirmação da assinatura.</p>

        </div>
      </section>

      <section aria-labelledby="elite-faq-title" className="px-5 py-14 sm:px-7 sm:py-16 lg:px-9">
        <div className="mx-auto max-w-[850px]">
          <header className="mb-6 text-center">
            <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-blue-300">Dúvidas frequentes</p>
            <h2 id="elite-faq-title" className="mt-2 text-[clamp(1.55rem,3vw,1.9rem)] font-black tracking-[-.04em]">Perguntas frequentes</h2>
            <p className="mt-2 text-[11px] text-slate-400">Informações para escolher seu plano com tranquilidade.</p>
          </header>
          <div className="overflow-hidden rounded-xl border border-white/[.12] bg-[#0e1828]/80">
            {FAQ_ITEMS.filter((item) => freeOffer || !item.question.includes('Gratuito')).map((item, index) => (
              <details key={item.question} open={index === 0} className="group border-b border-white/[.09] px-4 last:border-b-0 sm:px-5">
                <summary className="flex min-h-[50px] cursor-pointer list-none items-center justify-between gap-4 text-[11px] font-bold text-slate-100 [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/[.12] text-sm font-normal text-blue-200 group-open:hidden">+</span>
                  <span aria-hidden="true" className="hidden h-6 w-6 shrink-0 place-items-center rounded-full border border-white/[.12] text-sm font-normal text-blue-200 group-open:grid">−</span>
                </summary>
                <p className="max-w-[740px] pb-4 pr-8 text-[10px] leading-[17px] text-slate-300">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {actionOffer ? (
        <section aria-label="Comece pelo plano Gratuito" className="px-5 pb-12 sm:px-7 lg:px-9">
          <div className="mx-auto max-w-[1180px]">
            <aside aria-labelledby="elite-free-cta-title" className="relative grid gap-3 overflow-hidden rounded-2xl border border-emerald-300/30 bg-[linear-gradient(110deg,rgba(20,53,48,.55),rgba(16,30,43,.97)_50%,#101b2c)] p-4 sm:grid-cols-[42px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5 sm:py-4">
              <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full border border-emerald-300/25 bg-emerald-300/10 text-emerald-300"><ShieldCheck size={20} /></span>
              <div>
                <p className="text-[8px] font-extrabold uppercase tracking-[.13em] text-emerald-200">Ainda está em dúvida?</p>
                <h3 id="elite-free-cta-title" className="mt-1 text-[14px] font-extrabold leading-5 text-slate-50">{freeOffer ? 'Comece pelo Gratuito e conheça a plataforma.' : 'Conheça as ferramentas do Elite para sua preparação.'}</h3>
                <p className="mt-1 text-[10px] leading-4 text-slate-300">{freeOffer ? 'Explore os recursos disponíveis e escolha o Elite quando quiser avançar.' : 'Confira os recursos disponíveis e as condições atuais antes de assinar.'}</p>
              </div>
              <Link href={actionOffer.checkoutHref} prefetch={false} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] bg-emerald-600 px-4 py-2.5 text-[10px] font-extrabold text-white transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-emerald-200 sm:col-start-3 sm:row-span-1">
                {freeOffer ? 'Começar grátis' : 'Ver plano recomendado'} <ArrowRight aria-hidden="true" size={14} />
              </Link>
              {freeOffer ? <span className="text-[8px] text-emerald-100/65 sm:absolute sm:bottom-1 sm:right-5">Plano Gratuito · Sem cobrança</span> : null}
            </aside>
          </div>
        </section>
      ) : null}

      {socialLinks.length > 0 ? (
        <section aria-labelledby="elite-social-title" className="px-5 pb-12 sm:px-7 lg:px-9">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5 rounded-2xl border border-transparent bg-[linear-gradient(#101a2b,#101a2b)_padding-box,linear-gradient(110deg,#d92979,#7556d9)_border-box] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
            <div>
              <p className="text-[8px] font-extrabold uppercase tracking-[.14em] text-violet-200">Concurso Mestre</p>
              <h2 id="elite-social-title" className="mt-1 text-[17px] font-extrabold tracking-[-.025em]">Acompanhe a plataforma de perto</h2>
              <p className="mt-1 text-[10px] text-slate-300">Novidades e bastidores nos canais oficiais.</p>
            </div>
            <nav aria-label="Redes sociais" className="flex flex-wrap gap-2">
              {socialLinks.map((social) => {
                const Icon = socialIcons[social.iconKey];
                return (
                  <a key={social.id} href={social.url} target="_blank" rel="noopener noreferrer" aria-label={`${social.label}${social.handle ? ` ${social.handle}` : ''}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/[.14] px-3 text-[9px] font-bold text-slate-100 transition hover:border-violet-200/50 hover:bg-violet-200/[.06]">
                    <Icon aria-hidden="true" size={15} className="text-violet-200" />
                    {social.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </section>
      ) : null}
    </>
  );
}
