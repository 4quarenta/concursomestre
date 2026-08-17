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

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import {
  compareSemanticSnapshots,
  extractSemanticSnapshot,
} from '../lib/semantic-page-snapshot.mjs';

const snapshot = (html, mode = 'raw') => {
  const dom = new JSDOM(html, { url: 'https://concursomestre.com/exemplo' });
  return extractSemanticSnapshot(dom.window.document, {
    mode,
    origin: 'https://concursomestre.com',
  });
};

const page = ({ extra = '', h1 = 'Conteudo principal' } = {}) => `
  <!doctype html>
  <html>
    <head>
      <title>Pagina de teste</title>
      <meta name="description" content="Descricao publica">
      <meta name="robots" content="index,follow">
      <link rel="canonical" href="https://concursomestre.com/exemplo">
      <script type="application/ld+json">{"@type":"Article","@id":"https://concursomestre.com/exemplo"}</script>
    </head>
    <body>
      <main><h1>${h1}</h1><p data-semantic-content>Texto publico estavel.</p>${extra}</main>
    </body>
  </html>`;

describe('semantic SSR/hydration snapshots', () => {
  it('classifies equivalent semantic surfaces', () => {
    const raw = snapshot(page(), 'raw');
    const hydrated = snapshot(page(), 'hydrated');

    expect(compareSemanticSnapshots({ raw, hydrated })).toMatchObject({
      classification: 'EQUIVALENT',
      differences: [],
    });
  });

  it('classifies added interactive links without changing semantic content', () => {
    const raw = snapshot(page(), 'raw');
    const hydrated = snapshot(page({ extra: '<a href="/login">Entrar</a>' }), 'hydrated');

    expect(compareSemanticSnapshots({ raw, hydrated }).classification).toBe('INTERACTION_ONLY');
  });

  it('ignores explicitly marked hydration-only interaction islands', () => {
    const raw = snapshot(page(), 'raw');
    const hydrated = snapshot(page({
      extra: '<section data-hydration-interaction><h2>CTA personalizado</h2><p>Estado da sessao.</p></section>',
    }), 'hydrated');

    expect(compareSemanticSnapshots({ raw, hydrated }).classification).toBe('EQUIVALENT');
  });

  it('removes interaction islands nested inside a semantic article', () => {
    const raw = snapshot(page({ extra: '<article><p>Corpo publico.</p></article>' }), 'raw');
    const hydrated = snapshot(page({
      extra: '<article><p>Corpo publico.</p><section data-hydration-interaction><p>Entrar para continuar.</p></section></article>',
    }), 'hydrated');

    expect(compareSemanticSnapshots({ raw, hydrated }).classification).toBe('EQUIVALENT');
  });

  it('detects semantic content removed during hydration', () => {
    const raw = snapshot(page({ extra: '<section><h2>Titulo removido</h2><p>Conteudo divergente.</p></section>' }), 'raw');
    const hydrated = snapshot(page(), 'hydrated');

    expect(compareSemanticSnapshots({ raw, hydrated }).classification).toBe('SEMANTIC_DIVERGENCE');
  });

  it('promotes protected sentinel exposure to a security divergence', () => {
    const html = page();
    const raw = snapshot(html, 'raw');
    const hydrated = snapshot(html, 'hydrated');
    const comparison = compareSemanticSnapshots({
      raw,
      hydrated,
      sentinels: ['SECRET_EDITORIAL_SENTINEL_123'],
      surfaces: { rsc: 'SECRET_EDITORIAL_SENTINEL_123' },
    });

    expect(comparison.classification).toBe('SECURITY_DIVERGENCE');
    expect(comparison.sentinelHits).toEqual([
      { surface: 'rsc', sentinel: 'SECRET_EDITORIAL_SENTINEL_123' },
    ]);
  });
});
