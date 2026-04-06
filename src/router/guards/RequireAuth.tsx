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

interface RequireAuthProps {
  currentUser: UserProfile | null;
  loginRequired?: boolean;
  children: React.ReactElement;
}

/**
 * Guard oficial das rotas autenticadas.
 * Permite reaproveitar a mesma regra sem espalhar ternarios pelo router.
 */
export const RequireAuth: React.FC<RequireAuthProps> = ({
  currentUser,
  loginRequired = true,
  children,
}) => {
  const location = useLocation();

  if (!currentUser && loginRequired) {
    const requestedRoute = `${location.pathname}${location.search}${location.hash}`;
    sessionStorage.setItem('redirectAfterLogin', requestedRoute);
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default RequireAuth;
