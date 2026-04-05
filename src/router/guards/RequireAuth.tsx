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
import { Navigate } from 'react-router-dom';
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
  if (!currentUser && loginRequired) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default RequireAuth;
