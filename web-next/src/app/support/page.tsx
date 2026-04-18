import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import SupportPageClient from '@/components/support/SupportPageClient';
import type { SystemSettings } from '@/types';

export default async function SupportPage() {
  const settings = mergePublicSystemSettings(
    await safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
  );

  return <SupportPageClient systemSettings={settings} />;
}
