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
import { Route } from 'react-router-dom';
import type { UserProfile } from '@types';
import PageTransition from '../components/PageTransition';
import { RequireAdmin } from './guards';

const AdminPage = React.lazy(() => import('../app/admin/page'));

interface AdminRoutesProps {
  currentUser: UserProfile | null;
}

/**
 * Agrupa as rotas estritamente administrativas.
 */
export const AdminRoutes: React.FC<AdminRoutesProps> = ({ currentUser }) => {
  return (
    <Route
      path="/admin"
      element={
        <RequireAdmin currentUser={currentUser}>
          <PageTransition><AdminPage /></PageTransition>
        </RequireAdmin>
      }
    />
  );
};

export default AdminRoutes;
