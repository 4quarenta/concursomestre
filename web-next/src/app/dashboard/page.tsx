import { redirect } from 'next/navigation';
import { appendSearchParamsToPath, type RouteSearchParams } from '@/lib/searchParams';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  redirect(appendSearchParamsToPath('/', await searchParams));
}
