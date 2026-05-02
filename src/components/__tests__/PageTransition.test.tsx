import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PageTransition from '../PageTransition';

describe('PageTransition', () => {
  it('renders a stable non-animated shell on the server', () => {
    const markup = renderToString(
      <PageTransition>
        <main data-testid="page-content">Conteúdo</main>
      </PageTransition>,
    );

    expect(markup).toContain('data-testid="page-content"');
    expect(markup).toContain('class="w-full h-full"');
    expect(markup).not.toContain('opacity:0');
    expect(markup).not.toContain('scale(0.98)');
  });
});
