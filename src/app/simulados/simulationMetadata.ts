import type { Metadata } from 'next';
import { buildNoIndexMetadata, buildPublicPageMetadata } from '../seoMetadata';
import type { PublicSimulationDetail } from './simulationServerData';

type SearchValue = string | string[] | undefined;
const tracking = (key: string) => key === 'gclid' || key === 'fbclid' || key.startsWith('utm_');

export const simulationDescription = (item: PublicSimulationDetail): string => item.description
  || `Consulte a proposta, a duração e a composição pública do simulado ${item.title}.`;

export const buildSimulationMetadata = (item: PublicSimulationDetail | null): Metadata => {
  if (!item) return buildNoIndexMetadata({ title: 'Simulado não encontrado' });
  const metadata = buildPublicPageMetadata({ title: item.title, description: simulationDescription(item), path: item.canonicalPath });
  if (item.readiness.status === 'READY') return metadata;
  return { ...metadata, robots: { index: false, follow: true, googleBot: { index: false, follow: true } } };
};

export const buildSimulationsDirectoryMetadata = (searchParams: Record<string, SearchValue>): Metadata => {
  const path = '/simulados';
  const functionalVariant = Object.keys(searchParams).some((key) => !tracking(key));
  const metadata = buildPublicPageMetadata({ title: 'Simulados', description: 'Explore simulados editoriais públicos e escolha uma experiência de prática com composição estável.', path });
  if (!functionalVariant) return metadata;
  return { ...metadata, alternates: { canonical: path }, openGraph: { ...metadata.openGraph, url: path }, robots: { index: false, follow: true, googleBot: { index: false, follow: true } } };
};
