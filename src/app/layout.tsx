import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { websiteManifest } from '@/config/platform';
import { getConfiguredSiteUrl } from '@/config/siteUrl';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import NextAppProviders from '@/providers/NextAppProviders';
import 'katex/dist/katex.min.css';
import './globals.css';

const siteUrl = getConfiguredSiteUrl();
const googleAdsenseAccount = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ACCOUNT?.trim() || '';
const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim() || '';
const PUBLIC_SETTINGS_FETCH_TIMEOUT_MS = 1800;
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

const readEnvelopeData = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
    const data = (payload as { data?: unknown }).data;
    return data && typeof data === 'object' ? data as Record<string, unknown> : {};
  }

  return payload as Record<string, unknown>;
};

const normalizeAdsenseAccountId = (value?: string | null): string => {
  const normalized = String(value || '').trim();
  return /^ca-pub-\d{8,32}$/i.test(normalized) ? normalized : '';
};

const normalizeGoogleAnalyticsId = (value?: string | null): string => {
  const normalized = String(value || '').trim();
  return /^(G|GT|AW|DC)-[A-Z0-9-]{4,}$/i.test(normalized) ? normalized : '';
};

const fetchPublicMarketingSettings = async (): Promise<{ adsenseAccount: string; analyticsId: string }> => {
  if (typeof fetch !== 'function') {
    return { adsenseAccount: '', analyticsId: '' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_SETTINGS_FETCH_TIMEOUT_MS);

  try {
    const apiBaseUrl = resolveAbsoluteApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined);
    const response = await fetch(new URL('settings.php', apiBaseUrl).toString(), {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { adsenseAccount: '', analyticsId: '' };
    }

    const settings = readEnvelopeData(await response.json());
    return {
      adsenseAccount: normalizeAdsenseAccountId(settings.adsenseClientId as string | undefined),
      analyticsId: normalizeGoogleAnalyticsId(settings.googleAnalyticsId as string | undefined),
    };
  } catch {
    return { adsenseAccount: '', analyticsId: '' };
  } finally {
    clearTimeout(timeout);
  }
};

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publicMarketingSettings = await fetchPublicMarketingSettings();
  const resolvedGoogleAnalyticsId = normalizeGoogleAnalyticsId(googleAnalyticsId)
    || publicMarketingSettings.analyticsId;

  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body
        className={`${inter.variable} min-h-full flex flex-col font-sans no-scrollbar bg-slate-50 text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100`}
        suppressHydrationWarning
      >
        {resolvedGoogleAnalyticsId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(resolvedGoogleAnalyticsId)}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${resolvedGoogleAnalyticsId}');
              `}
            </Script>
          </>
        ) : null}
        <NextAppProviders>{children}</NextAppProviders>
      </body>
    </html>
  );
}
