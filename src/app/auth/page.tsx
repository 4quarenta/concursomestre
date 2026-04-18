import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import AuthPageClient from '@/components/auth/AuthPageClient';
import type { SystemSettings } from '@/types';
import { readFirstSearchParam, type RouteSearchParams } from '@/lib/searchParams';

type AuthPageProps = {
  searchParams: Promise<RouteSearchParams>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const resolvedSearchParams = await searchParams;
  const settings = mergePublicSystemSettings(
    await safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
  );
  const requestedMode = readFirstSearchParam(resolvedSearchParams.mode);
  const redirectTo = readFirstSearchParam(resolvedSearchParams.redirect);
  const referralCode = readFirstSearchParam(resolvedSearchParams.ref)
    ?? readFirstSearchParam(resolvedSearchParams.referral);

  return (
    <AuthPageClient
      initialMode={requestedMode === 'signup' ? 'signup' : 'login'}
      redirectTo={redirectTo}
      referralCode={referralCode}
      systemSettings={settings}
    />
  );
}
