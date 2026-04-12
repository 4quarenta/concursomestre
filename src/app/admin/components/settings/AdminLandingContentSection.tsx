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

import React from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Megaphone, Plus, Share2, Trash2 } from 'lucide-react';
import type { LandingFeatureCard, LandingPageContent, LandingSocialLink } from '@types';
import {
  createLandingFeatureCard,
  createLandingSocialLink,
  LANDING_FEATURE_ICON_OPTIONS,
  LANDING_SOCIAL_ICON_OPTIONS,
  landingFeatureIconMap,
  landingSocialIconMap,
  mergeLandingPageContent,
} from '../../../landing/landingContent';

interface AdminLandingContentSectionProps {
  siteName: string;
  content?: LandingPageContent;
  onChange: (content: LandingPageContent) => void;
}

const inputClassName = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const labelClassName = 'ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500';

const updateFeatureCard = (
  cards: LandingFeatureCard[],
  id: string,
  updater: (card: LandingFeatureCard) => LandingFeatureCard,
) => cards.map((card) => (card.id === id ? updater(card) : card));

const reorderFeatureCards = (cards: LandingFeatureCard[]): LandingFeatureCard[] => (
  cards
    .map((card, index) => ({
      ...card,
      order: typeof card.order === 'number' ? card.order : ((index + 1) * 10),
    }))
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
);

const moveFeatureCard = (
  cards: LandingFeatureCard[],
  id: string,
  direction: 'up' | 'down',
): LandingFeatureCard[] => {
  const orderedCards = reorderFeatureCards(cards);
  const currentIndex = orderedCards.findIndex((card) => card.id === id);

  if (currentIndex < 0) return orderedCards;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= orderedCards.length) {
    return orderedCards;
  }

  const nextCards = [...orderedCards];
  const [currentCard] = nextCards.splice(currentIndex, 1);
  nextCards.splice(targetIndex, 0, currentCard);

  return nextCards.map((card, index) => ({
    ...card,
    order: (index + 1) * 10,
  }));
};

const updateSocialLink = (
  links: LandingSocialLink[],
  id: string,
  updater: (link: LandingSocialLink) => LandingSocialLink,
) => links.map((link) => (link.id === id ? updater(link) : link));

const AdminLandingContentSection: React.FC<AdminLandingContentSectionProps> = ({
  siteName,
  content,
  onChange,
}) => {
  const resolvedContent = mergeLandingPageContent(content);
  const featureCards = reorderFeatureCards(resolvedContent.featureCards);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100">
              <Megaphone size={20} className="text-indigo-600 dark:text-indigo-400" />
              Homepage
            </h3>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Gerencie os cards da secao "O que voce encontra na plataforma" exibidos na homepage do {siteName || 'ConcursoMestre'}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange({
              ...resolvedContent,
              featureCards: reorderFeatureCards([
                ...featureCards,
                { ...createLandingFeatureCard(), order: (featureCards.length + 1) * 10 },
              ]),
            })}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white"
          >
            <Plus size={14} />
            Adicionar card
          </button>
        </div>

        <div className="grid gap-4">
          {featureCards.map((card, index) => {
            const Icon = landingFeatureIconMap[card.iconKey];

            return (
              <div
                key={card.id}
                className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50 lg:grid-cols-[minmax(0,1fr)_240px]"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className={labelClassName}>Titulo do card {index + 1}</label>
                    <input
                      value={card.title}
                      onChange={(event) => onChange({
                        ...resolvedContent,
                        featureCards: updateFeatureCard(
                          resolvedContent.featureCards,
                          card.id,
                          (currentCard) => ({ ...currentCard, title: event.target.value }),
                        ),
                      })}
                      className={inputClassName}
                      placeholder="Ex.: Banco de questoes com foco real"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className={labelClassName}>Descricao</label>
                    <textarea
                      value={card.description}
                      onChange={(event) => onChange({
                        ...resolvedContent,
                        featureCards: updateFeatureCard(
                          resolvedContent.featureCards,
                          card.id,
                          (currentCard) => ({ ...currentCard, description: event.target.value }),
                        ),
                      })}
                      className={`${inputClassName} min-h-[110px] resize-none`}
                      placeholder="Explique em uma frase curta por que esse recurso melhora o estudo e aproxima o aluno do resultado."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClassName}>Ordem</label>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={String(card.order ?? ((index + 1) * 10))}
                      onChange={(event) => onChange({
                        ...resolvedContent,
                        featureCards: reorderFeatureCards(updateFeatureCard(
                          featureCards,
                          card.id,
                          (currentCard) => ({ ...currentCard, order: Number(event.target.value || 0) }),
                        )),
                      })}
                      className={inputClassName}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClassName}>Status</label>
                    <button
                      type="button"
                      onClick={() => onChange({
                        ...resolvedContent,
                        featureCards: updateFeatureCard(
                          featureCards,
                          card.id,
                          (currentCard) => ({ ...currentCard, enabled: !(currentCard.enabled ?? true) }),
                        ),
                      })}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-black transition-all ${
                        card.enabled !== false
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300'
                          : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                      }`}
                    >
                      <span>{card.enabled !== false ? 'Ativo' : 'Inativo'}</span>
                      {card.enabled !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex h-full flex-col justify-between gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className={labelClassName}>Icone</label>
                      <select
                        value={card.iconKey}
                        onChange={(event) => onChange({
                          ...resolvedContent,
                          featureCards: updateFeatureCard(
                            resolvedContent.featureCards,
                            card.id,
                            (currentCard) => ({ ...currentCard, iconKey: event.target.value as LandingFeatureCard['iconKey'] }),
                          ),
                        })}
                        className={inputClassName}
                      >
                        {LANDING_FEATURE_ICON_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-[1.5rem] border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900/30 dark:bg-indigo-900/10">
                      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
                        <Icon size={20} />
                      </div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{card.title || 'Novo diferencial'}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                          card.enabled !== false
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {card.enabled !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                        {card.description || 'Descreva o beneficio principal exibido na homepage.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => onChange({
                        ...resolvedContent,
                        featureCards: moveFeatureCard(featureCards, card.id, 'up'),
                      })}
                      disabled={index === 0}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      <ArrowUp size={14} />
                      Subir
                    </button>

                    <button
                      type="button"
                      onClick={() => onChange({
                        ...resolvedContent,
                        featureCards: moveFeatureCard(featureCards, card.id, 'down'),
                      })}
                      disabled={index === featureCards.length - 1}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      <ArrowDown size={14} />
                      Descer
                    </button>

                    <button
                      type="button"
                      onClick={() => onChange({
                        ...resolvedContent,
                        featureCards: featureCards.filter((featureCard) => featureCard.id !== card.id),
                      })}
                      disabled={featureCards.length <= 1}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/30 dark:text-rose-300"
                    >
                      <Trash2 size={14} />
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100">
              <Share2 size={20} className="text-indigo-600 dark:text-indigo-400" />
              Redes sociais da homepage
            </h3>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Configure os canais que aparecem na secao de comunidade da homepage. Somente links ativos e validos sao exibidos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange({
              ...resolvedContent,
              socialLinks: [...resolvedContent.socialLinks, createLandingSocialLink()],
            })}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:border-slate-700 dark:text-slate-100"
          >
            <Plus size={14} />
            Adicionar canal
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {resolvedContent.socialLinks.map((link) => {
            const Icon = landingSocialIconMap[link.iconKey];

            return (
              <div key={link.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{link.label || 'Canal oficial'}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{link.handle || 'Handle opcional'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange({
                      ...resolvedContent,
                      socialLinks: resolvedContent.socialLinks.filter((socialLink) => socialLink.id !== link.id),
                    })}
                    disabled={resolvedContent.socialLinks.length <= 1}
                    className="rounded-2xl border border-rose-200 p-3 text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/30 dark:text-rose-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClassName}>Titulo</label>
                    <input
                      value={link.label}
                      onChange={(event) => onChange({
                        ...resolvedContent,
                        socialLinks: updateSocialLink(
                          resolvedContent.socialLinks,
                          link.id,
                          (currentLink) => ({ ...currentLink, label: event.target.value }),
                        ),
                      })}
                      className={inputClassName}
                      placeholder="Ex.: Instagram"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClassName}>Handle</label>
                    <input
                      value={link.handle}
                      onChange={(event) => onChange({
                        ...resolvedContent,
                        socialLinks: updateSocialLink(
                          resolvedContent.socialLinks,
                          link.id,
                          (currentLink) => ({ ...currentLink, handle: event.target.value }),
                        ),
                      })}
                      className={inputClassName}
                      placeholder="@concursomestre"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClassName}>URL</label>
                    <input
                      value={link.url}
                      onChange={(event) => onChange({
                        ...resolvedContent,
                        socialLinks: updateSocialLink(
                          resolvedContent.socialLinks,
                          link.id,
                          (currentLink) => ({ ...currentLink, url: event.target.value }),
                        ),
                      })}
                      className={inputClassName}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={labelClassName}>Icone</label>
                      <select
                        value={link.iconKey}
                        onChange={(event) => onChange({
                          ...resolvedContent,
                          socialLinks: updateSocialLink(
                            resolvedContent.socialLinks,
                            link.id,
                            (currentLink) => ({ ...currentLink, iconKey: event.target.value as LandingSocialLink['iconKey'] }),
                          ),
                        })}
                        className={inputClassName}
                      >
                        {LANDING_SOCIAL_ICON_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className={labelClassName}>Status</label>
                      <button
                        type="button"
                        onClick={() => onChange({
                          ...resolvedContent,
                          socialLinks: updateSocialLink(
                            resolvedContent.socialLinks,
                            link.id,
                            (currentLink) => ({ ...currentLink, enabled: !currentLink.enabled }),
                          ),
                        })}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-black transition-all ${
                          link.enabled
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300'
                            : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                        }`}
                      >
                        <span>{link.enabled ? 'Ativo' : 'Inativo'}</span>
                        {link.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AdminLandingContentSection;
