import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { websiteManifest } from '@/config/platform';
import { getConfiguredSiteUrl } from '@/config/siteUrl';
import NextAppProviders from '@/providers/NextAppProviders';
import 'katex/dist/katex.min.css';
import './globals.css';

const siteUrl = getConfiguredSiteUrl();
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

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
      <body
        className={`${inter.variable} min-h-full flex flex-col font-sans no-scrollbar bg-slate-50 text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100`}
        suppressHydrationWarning
      >
        <NextAppProviders>{children}</NextAppProviders>
      </body>
    </html>
  );
}
