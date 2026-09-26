import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HeroSection } from '../LandingCommercialPage';
import { SEASONAL_HERO_ARTWORK } from '../SeasonalHeroArtwork';
import type { AppPromotionTheme } from '@types';

describe('homepage seasonal artwork', () => {
  it('keeps the desktop and phone only for the default theme', () => {
    const html = renderToStaticMarkup(<HeroSection themeId="default" />);
    expect(html).toContain('data-platform-mockup');
    expect(html).toContain('Seu desempenho');
    expect(html).not.toContain('data-seasonal-artwork');
  });

  it.each(Object.entries(SEASONAL_HERO_ARTWORK))('replaces the devices entirely for %s', (theme, artwork) => {
    const html = renderToStaticMarkup(<HeroSection themeId={theme as AppPromotionTheme} />);
    expect(html).toContain(`data-seasonal-artwork="${theme}"`);
    expect(html).not.toContain('data-platform-mockup');
    expect(html).not.toContain('Seu desempenho');
    expect(html).toContain(encodeURIComponent(artwork.src));
    expect(html).toContain(artwork.alt);
    expect(html).toContain('href="#planos"');
    const asset = path.join(process.cwd(), 'public', artwork.src);
    expect(existsSync(asset)).toBe(true);
    const buffer = readFileSync(asset);
    expect(buffer.toString('ascii', 8, 12)).toBe('WEBP');
    expect(buffer.length).toBeLessThan(450_000);
  });

  it('provides eight distinct assets instead of palette variants of one mockup', () => {
    expect(new Set(Object.values(SEASONAL_HERO_ARTWORK).map(({ src }) => src)).size).toBe(8);
  });
});
