import RouteContentSkeleton from './RouteContentSkeleton';
import type { NavigationSkeletonVariant } from './navigationSkeletonRoute';

const pulse = 'animate-pulse motion-reduce:animate-none bg-slate-200/80 dark:bg-slate-800/80';
const surface = 'rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';

const Block = ({ className = '' }: { className?: string }) => (
  <div className={`${pulse} rounded ${className}`} />
);

const Heading = () => (
  <div className="mb-5 space-y-3">
    <div className="flex items-center gap-2"><Block className="h-3 w-12" /><Block className="h-3 w-20" /></div>
    <Block className="h-8 w-64 max-w-full" />
    <Block className="h-4 w-2/3 max-w-full" />
  </div>
);

const SearchFilters = () => (
  <div className={`${surface} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4`}>
    <Block className="h-11 lg:col-span-1" />
    <Block className="h-11" />
    <Block className="h-11" />
    <Block className="h-11" />
  </div>
);

const DashboardSkeleton = () => (
  <>
    <Heading />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className={`${surface} p-4`}><Block className="h-3 w-24" /><Block className="mt-4 h-8 w-20" /><Block className="mt-3 h-3 w-32" /></div>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
      <section className={`${surface} p-5`}><Block className="h-5 w-40" /><Block className="mt-5 h-56 w-full" /><div className="mt-4 grid gap-3 sm:grid-cols-2">{[0, 1].map((item) => <Block key={item} className="h-16" />)}</div></section>
      <section className={`${surface} p-5`}><Block className="h-5 w-36" /><div className="mt-5 space-y-3">{[0, 1, 2, 3].map((item) => <Block key={item} className="h-14" />)}</div></section>
    </div>
  </>
);

const QuestionsSkeleton = () => (
  <>
    <Heading />
    <SearchFilters />
    <div className={`${surface} my-4 flex flex-wrap items-center justify-between gap-3 p-3`}><Block className="h-4 w-40" /><div className="flex gap-2"><Block className="h-10 w-28" /><Block className="h-10 w-32" /></div></div>
    {[0, 1].map((item) => <section key={item} className={`${surface} mb-4 overflow-hidden`}><div className="flex items-center gap-2 border-b border-slate-200 p-4 dark:border-slate-800"><Block className="h-4 w-12" /><Block className="h-7 w-28" /><Block className="h-7 w-20" /></div><div className="space-y-4 p-5"><Block className="h-5 w-4/5" />{[0, 1, 2].map((option) => <Block key={option} className="h-12 w-full" />)}</div></section>)}
  </>
);

const ExamsSkeleton = () => (
  <>
    <Heading /><div className={`${surface} mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]`}>{[0, 1, 2, 3, 4].map((item) => <Block key={item} className="h-11" />)}</div>
    <Block className="mb-3 h-5 w-20" />
    <div className="grid gap-3 lg:grid-cols-2">{[0, 1, 2, 3].map((item) => <article key={item} className={`${surface} p-4`}><div className="flex justify-between gap-3"><Block className="h-5 w-3/4" /><Block className="h-7 w-14" /></div><Block className="mt-4 h-3 w-2/3" /><Block className="mt-3 h-3 w-1/2" /></article>)}</div>
  </>
);

const SimulationsSkeleton = () => (
  <>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><Heading /></div><Block className="mb-5 h-11 w-40" /></div>
    <div className="mb-6 grid gap-3 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="flex items-center justify-between border-r border-slate-200 py-3 pr-4 dark:border-slate-800"><div><Block className="h-3 w-28" /><Block className="mt-3 h-7 w-20" /></div><Block className="h-10 w-10" /></div>)}</div>
    <div className="mb-4 flex gap-5 border-b border-slate-200 pb-3 dark:border-slate-800">{[0, 1, 2].map((item) => <Block key={item} className="h-5 w-28" />)}</div>
    <SearchFilters /><div className="mt-4 grid gap-3 lg:grid-cols-2">{[0, 1, 2, 3].map((item) => <article key={item} className={`${surface} p-5`}><Block className="h-5 w-2/3" /><Block className="mt-3 h-4 w-1/2" /><div className="mt-5 flex gap-5"><Block className="h-4 w-24" /><Block className="h-4 w-20" /></div><Block className="mt-5 h-10 w-36" /></article>)}</div>
  </>
);

const XraySkeleton = () => (
  <>
    <Heading /><div className={`${surface} mb-5 grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]`}><Block className="h-11" /><Block className="h-11" /><Block className="h-11 w-32" /></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className={`${surface} p-4`}><Block className="h-3 w-28" /><Block className="mt-4 h-8 w-20" /></div>)}</div>
    <div className="grid gap-4 xl:grid-cols-2"><section className={`${surface} p-5`}><Block className="h-5 w-44" /><Block className="mt-5 h-56 w-full" /></section><section className={`${surface} p-5`}><Block className="h-5 w-40" /><div className="mt-5 space-y-3">{[0, 1, 2, 3].map((item) => <Block key={item} className="h-12" />)}</div></section></div>
  </>
);

const ScheduleSkeleton = () => (
  <>
    <Heading /><div className="mb-5 grid gap-3 border-y border-slate-200 py-4 sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-800">{[0, 1, 2, 3].map((item) => <div key={item} className="border-r border-slate-200 pr-3 dark:border-slate-800"><Block className="h-3 w-28" /><Block className="mt-3 h-6 w-32" /><Block className="mt-2 h-3 w-24" /></div>)}</div>
    <div className="mb-3 flex gap-5 border-b border-slate-200 pb-3 dark:border-slate-800">{[0, 1, 2].map((item) => <Block key={item} className="h-5 w-16" />)}</div>
    <section className={`${surface} overflow-hidden`}><div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800"><Block className="h-9 w-64" /><Block className="h-9 w-36" /></div>{[0, 1, 2, 3, 4].map((item) => <div key={item} className="grid grid-cols-[80px_minmax(0,1fr)_100px_100px] gap-4 border-b border-slate-200 p-4 dark:border-slate-800"><Block className="h-5" /><Block className="h-5" /><Block className="h-5" /><Block className="h-8" /></div>)}</section>
  </>
);

const ListSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <><Heading /><SearchFilters /><div className="mt-4 space-y-3">{Array.from({ length: rows }, (_, item) => <div key={item} className={`${surface} flex items-center gap-4 p-4`}><Block className="h-10 w-10 shrink-0" /><div className="flex-1"><Block className="h-4 w-2/3" /><Block className="mt-3 h-3 w-1/3" /></div><Block className="h-9 w-24" /></div>)}</div></>
);

const NotificationSkeleton = () => (
  <><Heading /><div className="flex gap-4 border-b border-slate-200 pb-3 dark:border-slate-800">{[0, 1, 2].map((item) => <Block key={item} className="h-5 w-24" />)}</div><div className="mt-4 space-y-3">{[0, 1, 2, 3, 4].map((item) => <div key={item} className={`${surface} flex gap-3 p-4`}><Block className="h-10 w-10 shrink-0 rounded-full" /><div className="flex-1"><Block className="h-4 w-1/2" /><Block className="mt-3 h-3 w-4/5" /></div><Block className="h-3 w-16" /></div>)}</div></>
);

const SupportSkeleton = () => (
  <><Heading /><div className="mb-5 flex gap-4 border-b border-slate-200 pb-3 dark:border-slate-800">{[0, 1, 2].map((item) => <Block key={item} className="h-5 w-32" />)}</div><section className={`${surface} max-w-3xl p-5`}><Block className="h-5 w-48" /><Block className="mt-5 h-11 w-full" /><Block className="mt-3 h-11 w-full" /><Block className="mt-3 h-36 w-full" /><Block className="mt-4 h-10 w-36" /></section></>
);

export default function NavigationRouteSkeleton({ variant }: { variant: NavigationSkeletonVariant }) {
  let content: React.ReactNode;
  switch (variant) {
    case 'dashboard': content = <DashboardSkeleton />; break;
    case 'questions': content = <QuestionsSkeleton />; break;
    case 'exams': content = <ExamsSkeleton />; break;
    case 'simulations': content = <SimulationsSkeleton />; break;
    case 'xray': content = <XraySkeleton />; break;
    case 'schedule': content = <ScheduleSkeleton />; break;
    case 'profile': return <RouteContentSkeleton variant="profile" />;
    case 'notifications': content = <NotificationSkeleton />; break;
    case 'support': content = <SupportSkeleton />; break;
    case 'ranking': content = <ListSkeleton rows={6} />; break;
    case 'marketplace': content = <ListSkeleton />; break;
    case 'flashcards': content = <ListSkeleton />; break;
    case 'editorial': content = <ListSkeleton rows={3} />; break;
    case 'directory': content = <ListSkeleton rows={6} />; break;
  }

  return (
    <div role="status" aria-live="polite" className="pointer-events-none select-none">
      <span className="sr-only">Carregando conteúdo da página</span>
      <div aria-hidden="true">{content}</div>
    </div>
  );
}
