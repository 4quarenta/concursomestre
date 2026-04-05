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

interface RequireAdminProps {
  currentUser: UserProfile | null;
  children: React.ReactElement;
}

/**
 * Guard oficial das rotas administrativas.
 */
export const RequireAdmin: React.FC<RequireAdminProps> = ({ currentUser, children }) => {
  if (!currentUser?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireAdmin;
