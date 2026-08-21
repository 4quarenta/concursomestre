import type { Metadata } from 'next';
import { buildNoIndexMetadata, buildPublicPageMetadata } from '../seoMetadata';
import type { PublicMaterialDetail } from './materialServerData';

type SearchValue = string | string[] | undefined;
const tracking = (key: string) => key === 'gclid' || key === 'fbclid' || key.startsWith('utm_');
export const materialDescription = (item: PublicMaterialDetail) => item.description || `Consulte as informações públicas do material ${item.title} e sua disponibilidade no ConcursoMestre.`;
export const buildMaterialMetadata = (item: PublicMaterialDetail | null): Metadata => {
  if (!item) return buildNoIndexMetadata({ title: 'Material não encontrado' });
  const metadata = buildPublicPageMetadata({ title: item.title, description: materialDescription(item), path: item.canonicalPath });
  return item.readiness.status === 'READY' ? metadata : { ...metadata, robots: { index: false, follow: true, googleBot: { index: false, follow: true } } };
};
export const buildMaterialsDirectoryMetadata = (searchParams: Record<string, SearchValue>): Metadata => {
  const path = '/materiais'; const functional = Object.keys(searchParams).some((key) => !tracking(key));
  const metadata = buildPublicPageMetadata({ title: 'Materiais para concursos', description: 'Consulte materiais editoriais públicos para apoiar sua preparação para concursos.', path });
  return functional ? { ...metadata, alternates: { canonical: path }, openGraph: { ...metadata.openGraph, url: path }, robots: { index: false, follow: true, googleBot: { index: false, follow: true } } } : metadata;
};
