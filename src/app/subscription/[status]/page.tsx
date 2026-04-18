import { notFound } from 'next/navigation';
import SubscriptionStatusClient from '@/components/subscription/SubscriptionStatusClient';

const ALLOWED_STATUSES = new Set(['success', 'failure', 'pending']);

export default async function SubscriptionStatusPage({
  params,
}: {
  params: Promise<{ status: string }>;
}) {
  const { status } = await params;

  if (!ALLOWED_STATUSES.has(status)) {
    notFound();
  }

  return <SubscriptionStatusClient status={status as 'failure' | 'pending' | 'success'} />;
}
