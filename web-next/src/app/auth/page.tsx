import { redirect } from 'next/navigation';
import { buildLegacyUrl, type LegacySearchParams } from '@/lib/legacyRedirect';

const buildLegacyAuthUrl = (searchParams: LegacySearchParams) => {
  const targetUrl = new URL(buildLegacyUrl('/auth', searchParams));

  const requestedMode = targetUrl.searchParams.get('mode');
  const requestedRegister = targetUrl.searchParams.get('register');

  if (!requestedMode && (requestedRegister === 'true' || requestedRegister === '1')) {
    targetUrl.searchParams.set('mode', 'signup');
  }

  targetUrl.searchParams.delete('register');

  return targetUrl.toString();
};

export default async function AuthBridgePage({
  searchParams,
}: {
  searchParams: Promise<LegacySearchParams>;
}) {
  redirect(buildLegacyAuthUrl(await searchParams));
}
