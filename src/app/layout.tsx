import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { websiteManifest } from '@/config/platform';
import { getConfiguredSiteUrl } from '@/config/siteUrl';
import NextAppProviders from '@/providers/NextAppProviders';
import DeferredGoogleAnalytics from '@/components/shared/analytics/DeferredGoogleAnalytics';
import {
  fetchPublicMarketingSettings,
  normalizeAdsenseAccountId,
  normalizeGoogleAnalyticsId,
} from './publicMarketingSettings';
import './globals.css';

const siteUrl = getConfiguredSiteUrl();
const googleAdsenseAccount = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ACCOUNT?.trim() || '';
const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim() || '';
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

const buildBaseMetadata = (adsenseAccount: string): Metadata => ({
  title: {
    template: '%s | ConcursoMestre',
    default: websiteManifest.website.title,
  },
  metadataBase: siteUrl,
  description: websiteManifest.website.description,
  applicationName: websiteManifest.website.applicationName,
  authors: [{ name: '4quarenta' }],
  generator: 'Next.js',
  keywords: ['concursos', 'questoes', 'simulados', 'ranking', 'marketplace'],
  referrer: 'origin',
  creator: '4quarenta',
  publisher: 'ConcursoMestre',
  manifest: websiteManifest.website.manifestPath,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: websiteManifest.website.title,
    description: websiteManifest.website.description,
    url: '/',
    siteName: websiteManifest.product.name,
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: websiteManifest.website.title,
    description: websiteManifest.website.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: websiteManifest.branding.icon.publicPath,
  },
  ...(adsenseAccount
    ? {
      other: {
        'google-adsense-account': adsenseAccount,
      },
    }
    : {}),
});

export const generateMetadata = async (): Promise<Metadata> => {
  const adsenseAccount = normalizeAdsenseAccountId(googleAdsenseAccount)
    || (await fetchPublicMarketingSettings()).adsenseAccount;

  return buildBaseMetadata(adsenseAccount);
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function RootLayout(props: RootLayoutProps) {
  const { children } = props;
  const publicMarketingSettings = await fetchPublicMarketingSettings();
  const resolvedGoogleAnalyticsId = normalizeGoogleAnalyticsId(googleAnalyticsId)
    || publicMarketingSettings.analyticsId;

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body
        className={`${inter.variable} min-h-full flex flex-col font-sans no-scrollbar bg-slate-50 text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100`}
      >
        {resolvedGoogleAnalyticsId ? <DeferredGoogleAnalytics measurementId={resolvedGoogleAnalyticsId} /> : null}
        <NextAppProviders initialPublicSettings={publicMarketingSettings.settings as unknown as Record<string, unknown> | null}>{children}</NextAppProviders>
      </body>
    </html>
  );
}
