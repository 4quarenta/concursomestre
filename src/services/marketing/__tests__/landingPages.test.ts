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

import { describe, expect, it } from 'vitest';
import {
  buildMarketingLandingPath,
  mergeMarketingLandingPages,
} from '../landingPages';

describe('marketing landing pages', () => {
  it('creates the default published public landings when no payload exists', () => {
    const pages = mergeMarketingLandingPages(undefined, 'ConcursoMestre');

    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.slug)).toEqual(['planos', 'elite']);
    expect(pages.every((page) => page.status === 'published')).toBe(true);
    expect(pages[1].planCards.map((card) => card.planName)).toEqual(['Gratuito', 'Elite']);
  });

  it('builds dedicated public paths for the default campaigns', () => {
    expect(buildMarketingLandingPath('planos')).toBe('/planos');
    expect(buildMarketingLandingPath('elite')).toBe('/elite');
    expect(buildMarketingLandingPath('campanha-especial')).toBe('/l/campanha-especial');
  });
});
