'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import { buildProfilePath } from '../../profile/profileNavigation';

export default function SubscriptionStatusPage() {
  const router = useRouter();
  const params = useParams<{ status?: string }>();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      router.replace('/auth');
      return;
    }

    router.replace(params.status === 'failure' ? '/plans' : buildProfilePath('billing'));
  }, [currentUser, params.status, router]);

  return null;
}
