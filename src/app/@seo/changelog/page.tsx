import { fetchChangelogForServer } from '../../changelog/changelogServerData';
import { serializeStructuredData } from '@services/seo/structuredData';

export const revalidate = 300;

export default async function ChangelogSeoSnapshot() {
  const versions = await fetchChangelogForServer();

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Changelog do ConcursoMestre',
            url: 'https://concursomestre.com/changelog',
            hasPart: versions.map((version) => ({
              '@type': 'Article',
              headline: version.title,
              datePublished: version.release_date,
              description: version.description,
            })),
          }),
        }}
      />
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Evolução da plataforma</p>
          <h1 className="text-4xl font-bold">Changelog e atualizações</h1>
          <p className="max-w-3xl text-lg text-slate-600">
            Acompanhe as novidades, melhorias e correções publicadas no ConcursoMestre.
          </p>
        </header>

        {versions.map((version) => (
          <article key={version.id} className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              v{version.version} · {version.release_date}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{version.title}</h2>
            <p className="mt-3 leading-7 text-slate-700">{version.description}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {version.content_json.map((category) => (
                <section key={`${version.id}-${category.title}`}>
                  <h3 className="font-semibold">{category.title}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                    {category.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
