import type { Metadata } from 'next';
import { websiteManifest } from '@/config/platform';
import { applySeoLaunchModeToMetadata } from '@services/seo/launchControl';

interface PublicPageMetadataInput {
  title: string;
  description: string;
  path: string;
}

interface NoIndexMetadataInput {
  title: string;
  description?: string;
}

export const buildPublicPageMetadata = ({
  title,
  description,
  path,
}: PublicPageMetadataInput): Metadata => applySeoLaunchModeToMetadata({
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: websiteManifest.product.name,
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }, undefined, path);

export const buildNoIndexMetadata = ({
  title,
  description = websiteManifest.website.description,
}: NoIndexMetadataInput): Metadata => ({
  title,
  description,
  alternates: {
    canonical: null,
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
});
