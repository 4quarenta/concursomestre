import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import ProfessionalDetail from '../../profissoes/ProfessionalDetail';
import { buildProfessionalMetadata } from '../../profissoes/professionalMetadata';
import { fetchProfessionalDetail, type ProfessionalDetail as Detail } from '../../profissoes/professionalServerData';

export const revalidate = 300;
type Props={params:Promise<{slug:string}>};
const load=async(slug:string):Promise<Detail|null>=>{const result=await fetchProfessionalDetail('career',slug);if(result&&'redirectSlug'in result)permanentRedirect(`/carreiras/${encodeURIComponent(result.redirectSlug)}`);return result&&!('redirectSlug'in result)?result:null;};
export async function generateMetadata({params}:Props):Promise<Metadata>{const{slug}=await params;return buildProfessionalMetadata('career',await load(slug));}
export default async function CareerPage({params}:Props){const{slug}=await params;const item=await load(slug);if(!item)notFound();return <ProfessionalDetail item={item}/>;}
