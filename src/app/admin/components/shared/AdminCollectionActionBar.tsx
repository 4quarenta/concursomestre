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
import { AdminBulkActions } from './AdminDesignSystem';

interface AdminCollectionActionBarProps {
  children: React.ReactNode;
  summary: React.ReactNode;
}

const AdminCollectionActionBar = ({ children, summary }: AdminCollectionActionBarProps) => (
  <AdminBulkActions summary={summary}>{children}</AdminBulkActions>
);

export default AdminCollectionActionBar;
