import type { Metadata } from 'next';
import { buildPublicPageMetadata } from '../seoMetadata';

type SearchValue = string | string[] | undefined;

export type DirectoryMetadataSearchParams = Record<string, SearchValue>;

const trackingParameter = (key: string) => key === 'gclid' || key === 'fbclid' || key.startsWith('utm_');

const first = (value: SearchValue): string => Array.isArray(value) ? String(value[0] || '') : String(value || '');

export const buildTaxonomyDirectoryMetadata = ({
  title,
  description,
  path,
  searchParams,
}: {
  title: string;
  description: string;
  path: '/disciplinas' | '/bancas' | '/orgaos' | '/carreiras' | '/cargos';
  searchParams: DirectoryMetadataSearchParams;
}): Metadata => {
  const functionalKeys = Object.keys(searchParams).filter((key) => (
    !trackingParameter(key) && key !== 'pagina' && first(searchParams[key]).trim() !== ''
  ));
  const page = Math.max(1, Number.parseInt(first(searchParams.pagina), 10) || 1);
  const filtered = functionalKeys.length > 0;
  const canonical = !filtered && page > 1 ? `${path}?pagina=${page}` : path;
  const metadata = buildPublicPageMetadata({ title, description, path: canonical });

  if (!filtered) return metadata;
  return {
    ...metadata,
    alternates: { canonical: path },
    openGraph: { ...metadata.openGraph, url: path },
    robots: {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    },
  };
};
