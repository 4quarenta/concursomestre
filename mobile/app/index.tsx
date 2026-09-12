import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';

export default function IndexRoute() {
  const { user } = useAuth();

  return <Redirect href={user ? '/questoes' : '/login'} />;
}
