import { describe, expect, it } from 'vitest';
import {
  buildBreadcrumbList,
  buildCollectionPage,
  buildItemList,
  buildStructuredDataGraph,
  buildWebPage,
  serializeStructuredData,
} from './structuredData';

describe('structured data canonico', () => {
  it('mantem breadcrumb e ItemList em rotas canonicas absolutas', () => {
    const breadcrumbs = buildBreadcrumbList([
      { label: 'Início', path: '/' },
      { label: 'Órgãos', path: '/orgaos' },
    ]);
    const items = buildItemList([{ name: 'Órgão Público', path: '/orgaos/orgao-publico' }]);
    expect(breadcrumbs.itemListElement[1].item).toMatch(/\/orgaos$/);
    expect(items.itemListElement[0].url).toMatch(/\/orgaos\/orgao-publico$/);
  });

  it('recusa query, hash e URL externa em identidade canonica', () => {
    expect(() => buildWebPage({ path: '/orgaos?busca=x', name: 'x' })).toThrow();
    expect(() => buildCollectionPage({ path: '/blog#topo', name: 'x' })).toThrow();
    expect(() => buildItemList([{ name: 'x', path: 'https://evil.example/x' }])).toThrow();
    expect(() => buildWebPage({ path: '/orgaos/', name: 'x' })).toThrow();
    expect(() => buildWebPage({ path: '/orgaos//x', name: 'x' })).toThrow();
    expect(() => buildWebPage({ path: '/orgaos/../x', name: 'x' })).toThrow();
  });

  it('neutraliza fechamento de script e caracteres HTML', () => {
    const hostile = '</script><img src=x onerror=globalThis.__STRUCTURED_DATA_XSS__>';
    const serialized = serializeStructuredData({
      title: hostile,
      name: hostile,
      description: hostile,
      breadcrumb: { label: hostile },
      author: { name: hostile },
      related: [{ label: hostile }],
    });
    expect(serialized).not.toContain('</script>');
    expect(serialized).not.toContain('<img');
    expect(serialized).toContain('\\u003c');
  });

  it('recusa breadcrumb vazio, incompleto ou com path duplicado', () => {
    expect(() => buildBreadcrumbList([])).toThrow();
    expect(() => buildBreadcrumbList([{ label: 'Início', path: '/' }])).toThrow();
    expect(() => buildBreadcrumbList([
      { label: 'Início', path: '/' },
      { label: 'Início de novo', path: '/' },
    ])).toThrow();
  });

  it('remove nos opcionais vazios do grafo', () => {
    const graph = buildStructuredDataGraph([buildWebPage({ path: '/blog/post', name: 'Post' }), null]);
    expect(graph).not.toHaveProperty('__graph');
    expect(graph['@graph']).toHaveLength(1);
  });
});
