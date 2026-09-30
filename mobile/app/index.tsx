import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';

export default function IndexRoute() {
  const { user, isGuest, isBootstrapped } = useAuth();

  if (!isBootstrapped) return null;
  return <Redirect href={user || isGuest ? '/inicio' : '/bem-vindo'} />;
}
