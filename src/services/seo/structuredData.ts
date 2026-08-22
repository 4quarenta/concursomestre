import { buildSiteUrl } from '@/config/siteUrl';

export type CanonicalBreadcrumbItem = {
  label: string;
  path: string;
};

type ItemListEntry = {
  name: string;
  path: string;
};

export const assertCanonicalPath = (path: string): string => {
  const value = String(path || '').trim();
  const segments = value.split('/');
  if (
    !value.startsWith('/')
    || value.startsWith('//')
    || /[?#\\\u0000-\u001f]/.test(value)
    || (value !== '/' && value.endsWith('/'))
    || (value !== '/' && segments.some((segment, index) => index > 0 && (segment === '' || segment === '.' || segment === '..')))
  ) {
    throw new Error(`Caminho canonico invalido para structured data: ${value}`);
  }
  return value;
};

export const assertCanonicalBreadcrumbItems = (
  items: readonly CanonicalBreadcrumbItem[],
): readonly CanonicalBreadcrumbItem[] => {
  if (items.length < 2) throw new Error('Breadcrumb canonico deve conter ao menos dois itens.');
  const paths = new Set<string>();
  for (const item of items) {
    if (!String(item.label || '').trim()) throw new Error('Breadcrumb canonico contem label vazio.');
    const path = assertCanonicalPath(item.path);
    if (paths.has(path)) throw new Error(`Breadcrumb canonico contem path duplicado: ${path}`);
    paths.add(path);
  }
  return items;
};

export const buildBreadcrumbList = (items: readonly CanonicalBreadcrumbItem[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: assertCanonicalBreadcrumbItems(items).map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: String(item.label || '').trim(),
    item: buildSiteUrl(assertCanonicalPath(item.path)),
  })),
});

export const buildItemList = (items: readonly ItemListEntry[], startPosition = 1) => ({
  '@type': 'ItemList',
  numberOfItems: items.length,
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: startPosition + index,
    name: String(item.name || '').trim(),
    url: buildSiteUrl(assertCanonicalPath(item.path)),
  })),
});

export const buildCollectionPage = ({
  path,
  name,
  description,
}: {
  path: string;
  name: string;
  description?: string;
}) => ({
  '@type': 'CollectionPage',
  '@id': `${buildSiteUrl(assertCanonicalPath(path))}#webpage`,
  url: buildSiteUrl(assertCanonicalPath(path)),
  name,
  ...(description ? { description } : {}),
  inLanguage: 'pt-BR',
});

export const buildWebPage = ({
  path,
  name,
  description,
}: {
  path: string;
  name: string;
  description?: string;
}) => ({
  '@type': 'WebPage',
  '@id': `${buildSiteUrl(assertCanonicalPath(path))}#webpage`,
  url: buildSiteUrl(assertCanonicalPath(path)),
  name,
  ...(description ? { description } : {}),
  inLanguage: 'pt-BR',
});

export const buildStructuredDataGraph = (nodes: readonly unknown[]) => ({
  '@context': 'https://schema.org',
  '@graph': nodes.filter(Boolean),
});

/** Serializes JSON-LD without allowing script breakout through entity-controlled text. */
export const serializeStructuredData = (value: unknown): string => (
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
);
