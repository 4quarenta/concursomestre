type SearchParams = Record<string, string | string[] | undefined>;

type QuestionsAliasPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const buildPracticePath = (params: SearchParams = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
      return;
    }

    if (typeof value === 'string') {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `/practice?${queryString}` : '/practice';
};

export default async function QuestionsAliasPage({ searchParams }: QuestionsAliasPageProps) {
  const targetPath = buildPracticePath(await searchParams);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <meta httpEquiv="refresh" content={`0;url=${targetPath}`} />
      <a
        href={targetPath}
        className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold shadow-sm"
      >
        Abrir pagina de questoes
      </a>
    </main>
  );
}
