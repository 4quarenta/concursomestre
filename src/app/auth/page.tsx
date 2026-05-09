'use client';

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import Auth from './components/Auth';

/**
 * Entry point oficial da autenticação.
 */
const AuthPage: React.FC = () => {
  const router = useRouter();
  const { currentUser, login, isLoading } = useAuth();

  React.useEffect(() => {
    if (isLoading || !currentUser) {
      return;
    }

    const redirect = window.sessionStorage.getItem('redirectAfterLogin') || '/dashboard';
    window.sessionStorage.removeItem('redirectAfterLogin');
    router.replace(redirect);
  }, [currentUser, isLoading, router]);

  return <Auth onLogin={login} />;
};

export default AuthPage;
