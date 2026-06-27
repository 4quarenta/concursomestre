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
import AdminDatabaseNavigation from './AdminDatabaseNavigation';
import AdminDatabaseModals from './AdminDatabaseModals';
import AdminDatabaseSections from './AdminDatabaseSections';
import {
  useAdminDatabaseManagerController,
  type AdminDatabaseManagerControllerProps,
} from './useAdminDatabaseManagerController';

/**
 * Shell da aba "Base de Dados" do admin.
 * Ele existe para manter a composição enxuta: navegação, seções e modais são plugados a partir do controller oficial da feature.
 */
const AdminDatabaseManager = (props: AdminDatabaseManagerControllerProps) => {
  const { navigationProps, sectionsProps, modalsProps } = useAdminDatabaseManagerController(props);
  return (
    <div className="relative space-y-6">
      {navigationProps.standaloneSection ? null : <AdminDatabaseNavigation {...navigationProps} />}
      <AdminDatabaseSections {...sectionsProps} />
      <AdminDatabaseModals {...modalsProps} />
    </div>
  );
};

export default AdminDatabaseManager;
