import Link from 'next/link';
import { serializeStructuredData } from '@services/seo/structuredData';
import { FAQ_DATA } from '../../faq/faqContent';

const faqEntries = FAQ_DATA.flatMap((category) => category.questions);

const faqStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqEntries.map((entry) => ({
    '@type': 'Question',
    name: entry.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: entry.a,
    },
  })),
};

export default function FaqSeoSnapshot() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(faqStructuredData) }}
      />
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Dúvidas frequentes</p>
          <h1 className="text-4xl font-bold">Tudo o que você precisa saber</h1>
          <p className="max-w-3xl text-lg text-slate-600">
            Consulte respostas sobre questões, Lei Comentada, simulados, assinaturas, conta, privacidade e suporte.
          </p>
        </header>

        {FAQ_DATA.map((category) => (
          <section key={category.category} aria-labelledby={`faq-${category.icon}`}>
            <h2 id={`faq-${category.icon}`} className="mb-4 text-2xl font-semibold">{category.category}</h2>
            <div className="space-y-3">
              {category.questions.map((entry) => (
                <details key={entry.q} open className="rounded-lg border border-slate-200 bg-white p-5">
                  <summary className="font-semibold">{entry.q}</summary>
                  <p className="mt-3 leading-7 text-slate-700">{entry.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <Link href="/support?category=info" className="font-semibold text-indigo-700 underline">
          Abrir a central de suporte
        </Link>
      </div>
    </main>
  );
}
