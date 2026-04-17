import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { websiteManifest } from '@/config/platform';
import './globals.css';

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: '%s | ConcursoMestre',
    default: 'ConcursoMestre | Questoes, simulados, ranking e materiais para concursos',
  },
  metadataBase: new URL(websiteManifest.website.canonicalUrl),
  description: 'Plataforma de questoes para concursos com simulados, ranking, assinatura, desempenho e marketplace de materiais.',
  applicationName: 'ConcursoMestre',
  authors: [{ name: "4quarenta" }],
  generator: 'Next.js',
  keywords: ['concursos', 'questoes', 'simulados', 'ranking', 'marketplace'],
  referrer: 'origin',
  creator: '4quarenta',
  publisher: 'ConcursoMestre',
  manifest: websiteManifest.website.manifestPath,
  alternates: {
    canonical: '/',
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
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col no-scrollbar bg-slate-50 text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100">{children}</body>
    </html>
  );
}
