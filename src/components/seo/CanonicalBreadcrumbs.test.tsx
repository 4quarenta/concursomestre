import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CanonicalBreadcrumbs from './CanonicalBreadcrumbs';

describe('CanonicalBreadcrumbs', () => {
  it('renderiza links canonicos e item atual sem link', () => {
    const html = renderToStaticMarkup(<CanonicalBreadcrumbs items={[
      { label: 'Início', path: '/' },
      { label: 'Disciplinas', path: '/disciplinas' },
      { label: 'Direito', path: '/disciplinas/direito' },
    ]} />);
    expect(html).toContain('data-breadcrumbs="true"');
    expect(html).toContain('data-canonical-current="/disciplinas/direito"');
    expect(html).toContain('href="/disciplinas"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('href="/disciplinas/direito"');
  });

  it('escapa labels hostis pelo renderer', () => {
    const html = renderToStaticMarkup(<CanonicalBreadcrumbs items={[
      { label: 'Início', path: '/' },
      { label: '<script>globalThis.__BREADCRUMB_XSS__=true</script>', path: '/seguro' },
    ]} />);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('recusa href externo, com query ou fragmento', () => {
    expect(() => renderToStaticMarkup(<CanonicalBreadcrumbs items={[
      { label: 'Início', path: '/' },
      { label: 'Externo', path: 'https://evil.example/path' },
    ]} />)).toThrow(/Caminho canonico invalido/);
    expect(() => renderToStaticMarkup(<CanonicalBreadcrumbs items={[
      { label: 'Início', path: '/' },
      { label: 'Faceta', path: '/questoes?banca=x' },
    ]} />)).toThrow(/Caminho canonico invalido/);
  });

  it('recusa hierarquia visual com path duplicado', () => {
    expect(() => renderToStaticMarkup(<CanonicalBreadcrumbs items={[
      { label: 'Início', path: '/' },
      { label: 'Outro início', path: '/' },
    ]} />)).toThrow(/path duplicado/);
  });
});
