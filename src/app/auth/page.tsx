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
  const { currentUser, login } = useAuth();

  React.useEffect(() => {
    if (!currentUser) {
      return;
    }

    const redirect = window.sessionStorage.getItem('redirectAfterLogin') || '/';
    window.sessionStorage.removeItem('redirectAfterLogin');
    router.replace(redirect);
  }, [currentUser, router]);

  if (currentUser) {
    return null;
  }

  return <Auth onLogin={login} />;
};

export default AuthPage;
