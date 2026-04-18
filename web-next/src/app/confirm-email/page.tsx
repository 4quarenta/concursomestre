import ConfirmEmailClient from '@/components/auth/ConfirmEmailClient';
import { readFirstSearchParam, type RouteSearchParams } from '@/lib/searchParams';

type ConfirmEmailPageProps = {
  searchParams: Promise<RouteSearchParams>;
};

export default async function ConfirmEmailPage({ searchParams }: ConfirmEmailPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <ConfirmEmailClient
      redirectTo={readFirstSearchParam(resolvedSearchParams.redirect)}
      token={readFirstSearchParam(resolvedSearchParams.token)}
    />
  );
}
