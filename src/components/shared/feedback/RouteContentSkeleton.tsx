type RouteContentSkeletonProps = {
  variant?: 'profile' | 'admin' | 'checkout' | 'dashboard' | 'simulation';
  testId?: string;
};

const pulse = 'animate-pulse motion-reduce:animate-none bg-slate-200/80 dark:bg-slate-800/80';

const ProfileSkeleton = () => (
  <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-4 sm:px-4 md:px-6">
    <header className="space-y-3">
      <div className={`h-3 w-32 rounded ${pulse}`} />
      <div className={`h-7 w-40 rounded ${pulse}`} />
      <div className={`h-4 w-72 max-w-full rounded ${pulse}`} />
    </header>
    <nav aria-hidden="true" className="flex gap-2 overflow-hidden border-b border-slate-200 dark:border-slate-800">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className={`h-11 w-28 shrink-0 rounded-t-md ${pulse}`} />
      ))}
    </nav>
    <main className="space-y-5">
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className={`h-16 w-16 shrink-0 rounded-full ${pulse}`} />
        <div className="space-y-2">
          <div className={`h-5 w-36 rounded ${pulse}`} />
          <div className={`h-3 w-48 max-w-full rounded ${pulse}`} />
          <div className={`h-3 w-24 rounded ${pulse}`} />
        </div>
      </section>
      <section className="space-y-4">
        <div className={`h-5 w-36 rounded ${pulse}`} />
        <div className={`h-3 w-64 max-w-full rounded ${pulse}`} />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={`h-14 rounded-md ${pulse}`} />
          ))}
        </div>
        <div className={`h-20 w-full rounded-md ${pulse}`} />
        <div className={`h-10 w-36 rounded-md ${pulse}`} />
      </section>
    </main>
  </div>
);

const AdminSkeleton = () => (
  <div className="w-full space-y-4">
    <section className="rounded-sm border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className={`h-5 w-40 rounded ${pulse}`} />
          <div className={`h-3 w-64 max-w-full rounded ${pulse}`} />
        </div>
        <div className={`h-10 w-32 rounded-sm ${pulse}`} />
      </div>
      <div className={`mt-5 h-11 w-full rounded-sm ${pulse}`} />
    </section>
    <section className="overflow-hidden rounded-sm border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className={`h-12 w-full ${pulse}`} />
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_120px_88px] gap-4 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className={`h-4 rounded ${pulse}`} />
          <div className={`h-4 rounded ${pulse}`} />
          <div className={`h-8 rounded-sm ${pulse}`} />
        </div>
      ))}
    </section>
  </div>
);

const CheckoutSkeleton = () => (
  <div className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-[#0f1020] sm:px-6">
    <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5 rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className={`h-7 w-56 rounded ${pulse}`} />
        <div className={`h-4 w-3/4 rounded ${pulse}`} />
        <div className="grid gap-3 pt-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={`h-14 rounded-md ${pulse}`} />
          ))}
        </div>
        <div className={`h-14 w-full rounded-md ${pulse}`} />
      </section>
      <aside className="h-fit space-y-4 rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className={`h-5 w-36 rounded ${pulse}`} />
        <div className={`h-24 w-full rounded-md ${pulse}`} />
        <div className={`h-12 w-full rounded-md ${pulse}`} />
      </aside>
    </div>
  </div>
);

const StudySkeleton = ({ dashboard = false }: { dashboard?: boolean }) => (
  <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-4 sm:px-4 md:px-6">
    <section className="space-y-3">
      <div className={`h-7 w-52 max-w-full rounded ${pulse}`} />
      <div className={`h-4 w-96 max-w-full rounded ${pulse}`} />
    </section>
    <section className={`grid gap-4 ${dashboard ? 'sm:grid-cols-2 xl:grid-cols-4' : 'lg:grid-cols-[280px_minmax(0,1fr)]'}`}>
      {Array.from({ length: dashboard ? 4 : 2 }, (_, index) => (
        <div
          key={index}
          className={`rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 ${!dashboard && index === 1 ? 'min-h-80' : ''}`}
        >
          <div className={`h-4 w-28 rounded ${pulse}`} />
          <div className={`mt-5 h-10 ${dashboard ? 'w-24' : 'w-full'} rounded ${pulse}`} />
          <div className={`mt-4 h-3 w-3/4 rounded ${pulse}`} />
          {!dashboard ? <div className={`mt-5 h-40 w-full rounded-md ${pulse}`} /> : null}
        </div>
      ))}
    </section>
  </div>
);

export default function RouteContentSkeleton({
  variant = 'admin',
  testId,
}: RouteContentSkeletonProps) {
  return (
    <div
      data-testid={testId}
      aria-hidden="true"
      className="pointer-events-none select-none"
    >
      {variant === 'profile' ? <ProfileSkeleton /> : null}
      {variant === 'admin' ? <AdminSkeleton /> : null}
      {variant === 'checkout' ? <CheckoutSkeleton /> : null}
      {variant === 'dashboard' ? <StudySkeleton dashboard /> : null}
      {variant === 'simulation' ? <StudySkeleton /> : null}
    </div>
  );
}
