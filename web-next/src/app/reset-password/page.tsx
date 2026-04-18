import ResetPasswordClient from '@/components/auth/ResetPasswordClient';
import { readFirstSearchParam, type RouteSearchParams } from '@/lib/searchParams';

type ResetPasswordPageProps = {
  searchParams: Promise<RouteSearchParams>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <ResetPasswordClient
      emailFromUrl={readFirstSearchParam(resolvedSearchParams.email)}
      token={readFirstSearchParam(resolvedSearchParams.token)}
    />
  );
}
