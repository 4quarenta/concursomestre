import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import SimulationDetail from '../SimulationDetail';
import { buildSimulationMetadata } from '../simulationMetadata';
import { fetchPublicSimulationDetail, type PublicSimulationDetail } from '../simulationServerData';
import { publicRoutes } from '@services/routes/publicRoutes';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };
const load = async (slug: string): Promise<PublicSimulationDetail | null> => {
  const result = await fetchPublicSimulationDetail(slug);
  if (result && 'redirectSlug' in result) permanentRedirect(publicRoutes.simulations.detail(result.redirectSlug));
  return result && !('redirectSlug' in result) ? result : null;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { slug } = await params; return buildSimulationMetadata(await load(slug)); }
export default async function PublicSimulationPage({ params }: Props) { const { slug } = await params; const item = await load(slug); if (!item) notFound(); return <SimulationDetail item={item}/>; }
