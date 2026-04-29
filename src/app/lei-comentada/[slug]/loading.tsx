export default function LoadingLeiComentadaDetalhe() {
  return (
    <div className="w-full space-y-6 animate-fade-in">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6 px-6 py-7 md:px-8">
            <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-3">
              <div className="h-3 w-28 animate-pulse rounded-full bg-indigo-100 dark:bg-indigo-900/40" />
              <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
              <div className="h-4 w-5/6 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
            </div>
          </div>

          <aside className="border-t border-slate-200 bg-slate-50 px-6 py-7 dark:border-slate-800 dark:bg-slate-950/70 md:px-8 xl:border-l xl:border-t-0">
            <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 h-14 w-full animate-pulse rounded-2xl bg-white dark:bg-slate-900" />
            <div className="mt-5 h-3 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          </aside>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden xl:block xl:self-start">
          <section className="sticky top-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="h-3 w-14 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="mt-5 space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/70" />
              ))}
            </div>
          </section>
        </aside>

        <section className="space-y-5">
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
              <div className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
            </div>
          </section>

          <section className="mx-auto max-w-[1040px] rounded-3xl border border-slate-200 bg-slate-100/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
            <div className="min-h-[calc(100vh-220px)] rounded-sm bg-white px-7 py-9 shadow-[0_18px_50px_rgba(15,23,42,0.14)] dark:bg-slate-900 sm:px-10 md:px-14 md:py-12 lg:px-16">
              <div className="space-y-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-4 border-b border-slate-200 pb-6 last:border-b-0 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="h-6 w-24 animate-pulse rounded-full bg-indigo-100 dark:bg-indigo-900/40" />
                        <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                      </div>
                      <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/70" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
                      <div className="h-4 w-11/12 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
                      <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
