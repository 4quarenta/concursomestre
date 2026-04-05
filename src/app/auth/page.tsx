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
import type { UserProfile } from '@types';
import Auth from './components/Auth';

interface AuthPageProps {
  onLogin: (user: UserProfile | null, token?: string | null) => Promise<void>;
}

/**
 * Entry point oficial da autenticacao.
 */
const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  return <Auth onLogin={onLogin} />;
};

export default AuthPage;
