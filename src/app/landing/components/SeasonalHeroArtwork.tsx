import Image from 'next/image';
import type { AppPromotionTheme } from '@types';

type SeasonalTheme = Exclude<AppPromotionTheme, 'default'>;

export const SEASONAL_HERO_ARTWORK: Record<SeasonalTheme, { src: string; alt: string }> = {
  'black-friday': {
    src: '/images/marketing/black-friday-hero.webp',
    alt: 'Black Friday: convite preto e dourado com livros e fitas.',
  },
  'black-november': {
    src: '/images/marketing/black-november-hero.webp',
    alt: 'Black November: calend\u00e1rio e livros com marcadores dourados.',
  },
  estudante: {
    src: '/images/marketing/estudante-hero.webp',
    alt: 'Volta \u00e0s aulas: mochila azul, cadernos e materiais de estudo.',
  },
  'sao-joao': {
    src: '/images/marketing/sao-joao-hero.webp',
    alt: 'S\u00e3o Jo\u00e3o: fogueira, bandeirinhas, chap\u00e9u de palha e sanfona.',
  },
  carnaval: {
    src: '/images/marketing/carnaval-hero.webp',
    alt: 'Carnaval: m\u00e1scara colorida, serpentinas e pandeiro junto aos livros.',
  },
  'ano-novo': {
    src: '/images/marketing/ano-novo-hero.webp',
    alt: 'Ano Novo: estrela dourada e agenda aberta para novos planos.',
  },
  pascoa: {
    src: '/images/marketing/pascoa-hero.webp',
    alt: 'P\u00e1scoa: ovos decorados, flores e um livro aberto.',
  },
  consumidor: {
    src: '/images/marketing/consumidor-hero.webp',
    alt: 'Dia do Consumidor: sacola, presente e livro com marcador dourado.',
  },
};

export function SeasonalHeroArtwork({ themeId }: { themeId: SeasonalTheme }) {
  const artwork = SEASONAL_HERO_ARTWORK[themeId];

  return (
    <div data-seasonal-artwork={themeId} className="relative mx-auto aspect-[4/3] w-full max-w-3xl">
      <Image
        key={artwork.src}
        src={artwork.src}
        alt={artwork.alt}
        fill
        priority
        sizes="(min-width: 1280px) 720px, (min-width: 1024px) 58vw, (min-width: 768px) 704px, 100vw"
        className="object-contain"
      />
    </div>
  );
}
