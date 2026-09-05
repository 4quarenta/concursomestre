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
import { AdminPagination } from './AdminDesignSystem';

interface AdminCollectionPaginationProps {
  visibleCount: number;
  totalCount: number;
  itemLabel: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const AdminCollectionPagination = ({
  visibleCount,
  totalCount,
  itemLabel,
  page,
  totalPages,
  onPageChange,
}: AdminCollectionPaginationProps) => (
  <AdminPagination visibleCount={visibleCount} totalCount={totalCount} itemLabel={itemLabel} page={page} totalPages={totalPages} onPageChange={onPageChange} />
);

export default AdminCollectionPagination;
