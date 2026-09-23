'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpenCheck, Flame, PartyPopper, ShoppingBag, Sparkles, Timer, Zap } from 'lucide-react';
import type { AppPromotionTheme, Promotion } from '@types';
import {
  getPromotionThemeCssVars,
  getPromotionThemePresentation,
  type PromotionThemeMotif,
} from '@services/marketing/promotionTheme';

const MOTIF_ICONS: Record<Exclude<PromotionThemeMotif, 'default'>, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  'black-friday': Zap,
  'sao-joao': Flame,
  carnaval: PartyPopper,
  academic: BookOpenCheck,
  celebration: Sparkles,
  shopping: ShoppingBag,
};

const Motif = ({ motif }: { motif: PromotionThemeMotif }) => {
  if (motif === 'default') return null;
  const Icon = MOTIF_ICONS[motif];

  if (motif === 'sao-joao') {
    return (
      <div className="cm-promotion-motif cm-promotion-motif--sao-joao" aria-hidden="true">
        <div className="cm-promotion-motif__string" />
        {['#fb923c', '#facc15', '#ef4444', '#22c55e', '#38bdf8', '#fb923c', '#facc15'].map((color, index) => (
          <span key={`${color}-${index}`} style={{ backgroundColor: color }} />
        ))}
      </div>
    );
  }

  return (
    <div className={`cm-promotion-motif cm-promotion-motif--${motif}`} aria-hidden="true">
      <Icon size={78} strokeWidth={1.1} />
      <Icon size={36} strokeWidth={1.5} />
      <Icon size={52} strokeWidth={1.1} />
    </div>
  );
};

export const PromotionThemeMasthead = ({
  themeId,
  promotion,
}: {
  themeId: AppPromotionTheme;
  promotion?: Promotion | null;
}) => {
  const presentation = getPromotionThemePresentation(themeId);
  if (themeId === 'default') return null;

  return (
    <aside className="cm-promotion-masthead" aria-label={`Campanha ${presentation.label}`}>
      <Motif motif={presentation.motif} />
      <div className="cm-promotion-masthead__content">
        <span className="cm-promotion-masthead__label">
          <Timer size={15} aria-hidden="true" />
          {presentation.label}
        </span>
        <strong>{String(promotion?.bannerText || presentation.heroMessage)}</strong>
        <span className="hidden text-xs font-medium opacity-85 sm:inline">{presentation.mastheadMessage}</span>
        <Link href="/planos" prefetch={false} className="cm-promotion-masthead__cta">
          Ver oferta
        </Link>
      </div>
    </aside>
  );
};

export const PromotionThemeHeroMotif = ({ motif }: { motif: PromotionThemeMotif }) => (
  <Motif motif={motif} />
);

export const promotionThemeSurfaceClass = 'cm-promotion-theme-surface';

export const promotionThemeRootStyle = (themeId: AppPromotionTheme) => getPromotionThemeCssVars(themeId);
