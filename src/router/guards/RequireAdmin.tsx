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
import { Navigate, useLocation } from 'react-router-dom';
import type { UserProfile } from '@types';

interface RequireAdminProps {
  currentUser: UserProfile | null;
  children: React.ReactElement;
}

/**
 * Guard oficial das rotas administrativas.
 * Ele preserva a rota pretendida quando o usuario ainda precisa autenticar.
 */
export const RequireAdmin: React.FC<RequireAdminProps> = ({ currentUser, children }) => {
  const location = useLocation();

  if (!currentUser) {
    const requestedRoute = `${location.pathname}${location.search}${location.hash}`;
    sessionStorage.setItem('redirectAfterLogin', requestedRoute);
    return <Navigate to="/auth" replace />;
  }

  if (!currentUser?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireAdmin;
