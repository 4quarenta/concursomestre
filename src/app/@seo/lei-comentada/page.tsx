import Link from 'next/link';
import { fetchLegalHomeSnapshot } from '../../lei-comentada/legalCommentaryServerData';

export const revalidate = 300;

export default async function LegalCommentarySeoSnapshot() {
  const snapshot = await fetchLegalHomeSnapshot();

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Biblioteca legislativa</p>
          <h1 className="text-4xl font-bold">Lei comentada</h1>
          <p className="max-w-3xl text-lg text-slate-600">
            Estude legislação para concursos com texto oficial, organização por matéria e acesso direto aos artigos.
          </p>
        </header>

        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-sm text-slate-500">Leis</dt>
            <dd className="mt-1 text-2xl font-bold">{snapshot.totals.laws}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-sm text-slate-500">Artigos</dt>
            <dd className="mt-1 text-2xl font-bold">{snapshot.totals.articles}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-sm text-slate-500">Atualizações recentes</dt>
            <dd className="mt-1 text-2xl font-bold">{snapshot.totals.updatedRecently}</dd>
          </div>
        </dl>

        <div className="space-y-8">
          {snapshot.lawsByArea.map(({ area, laws }) => (
            <section key={String(area.id)} aria-labelledby={`legal-area-${area.id}`}>
              <h2 id={`legal-area-${area.id}`} className="mb-3 text-2xl font-semibold">{area.name}</h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {laws.map((law) => (
                  <li key={String(law.id)} className="rounded-lg border border-slate-200 bg-white p-4">
                    <Link href={`/lei-comentada/${law.slug}`} className="text-lg font-semibold text-indigo-700">
                      {law.title}
                    </Link>
                    {law.summary ? <p className="mt-2 line-clamp-3 text-sm text-slate-600">{law.summary}</p> : null}
                    <p className="mt-3 text-xs text-slate-500">{law.articleCount} artigos</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
