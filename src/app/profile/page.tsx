'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import { buildProfilePath } from './profileNavigation';

export default function ProfileIndexPage() {
  const router = useRouter();
  const { currentUser, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    router.replace(currentUser ? buildProfilePath('personal') : '/auth');
  }, [currentUser, isLoading, router]);

  return null;
}
