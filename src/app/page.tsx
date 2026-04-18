import React from 'react';
import type { Metadata } from 'next';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import LandingCommercialClient from '@/components/landing/LandingCommercialClient';
import type { Plan, SystemSettings } from '@/types';

export async function generateMetadata(): Promise<Metadata> {
  const settings = mergePublicSystemSettings(
    await safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
  );
  const siteName = settings?.siteName || 'ConcursoMestre';
  const globalSeo = settings?.seo?.global;
  const landingSeo = settings?.seo?.pages?.landing;

  const title = landingSeo?.title || `${siteName} | Estude com estratégia e evolua com mais direção`;
  const description = landingSeo?.meta_description || globalSeo?.meta_description || 'Banco de questões, simulados e análise de desempenho para concursos, OAB e ENEM.';

  return {
    title,
    description,
    openGraph: {
      title: landingSeo?.og_title || globalSeo?.default_og_title || title,
      description: landingSeo?.og_description || globalSeo?.default_og_description || description,
      siteName,
      type: 'website',
      images: landingSeo?.og_image ? [{ url: landingSeo.og_image }] : [],
    },
    alternates: {
      canonical: landingSeo?.canonical_url || globalSeo?.canonical_base_url || `/`
    }
  };
}

export default async function HomePage() {
  const [rawSettings, rawPlans] = await Promise.all([
    safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
    safeServerFetch<Plan[]>('plans/list.php', [])
  ]);
  const settings = mergePublicSystemSettings(rawSettings);
  const plans = Array.isArray(rawPlans) ? rawPlans : [];

  return (
    <LandingCommercialClient
      systemSettings={settings}
      plans={plans}
    />
  );
}
