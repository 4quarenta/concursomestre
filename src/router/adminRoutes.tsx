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
import { RequireAdmin } from './guards';

const AdminPage = React.lazy(() => import('../app/admin/page'));

interface AdminRoutesProps {
  currentUser: UserProfile | null;
}

/**
 * Agrupa as rotas estritamente administrativas.
 */
export const AdminRoutes: React.FC<AdminRoutesProps> = ({ currentUser }) => {
  const adminElement = (
    <RequireAdmin currentUser={currentUser}>
      <AdminPage />
    </RequireAdmin>
  );

  return (
    <>
      <Route path="/admin" element={adminElement} />
      <Route path="/admin/:tab" element={adminElement} />
      <Route path="/admin/:tab/:section" element={adminElement} />
    </>
  );
};

export default AdminRoutes;
