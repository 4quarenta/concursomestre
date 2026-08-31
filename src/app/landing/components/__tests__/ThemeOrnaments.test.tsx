import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ThemeOrnaments } from '../ThemeOrnaments';

describe('ThemeOrnaments', () => {
  it('renders deterministic carnival ornaments across server renders', () => {
    const firstMarkup = renderToString(<ThemeOrnaments themeId="carnaval" />);
    const secondMarkup = renderToString(<ThemeOrnaments themeId="carnaval" />);

    expect(firstMarkup).toBe(secondMarkup);
    expect(firstMarkup).toContain('animate-spin-slow');
  });

  it('renders deterministic consumer ornaments across server renders', () => {
    const firstMarkup = renderToString(<ThemeOrnaments themeId="consumidor" />);
    const secondMarkup = renderToString(<ThemeOrnaments themeId="consumidor" />);

    expect(firstMarkup).toBe(secondMarkup);
    expect(firstMarkup).toContain('rotate(');
  });
});
