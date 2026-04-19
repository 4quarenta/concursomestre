import type { Metadata } from 'next';
import { websiteManifest } from '@/config/platform';
import { getConfiguredSiteUrl } from '@/config/siteUrl';
import NextAppProviders from '@/providers/NextAppProviders';
import './globals.css';

const siteUrl = getConfiguredSiteUrl();

export const metadata: Metadata = {
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-full flex flex-col font-sans no-scrollbar bg-slate-50 text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100"
        suppressHydrationWarning
      >
        <NextAppProviders>{children}</NextAppProviders>
      </body>
    </html>
  );
}
