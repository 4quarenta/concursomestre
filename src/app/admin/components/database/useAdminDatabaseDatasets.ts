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

import { useMemo } from 'react';
import type { ErrorReport, Material } from '@types';
import { groupPendingReports } from '../reports/reportModeration';

interface UseAdminDatabaseDatasetsOptions {
  allUsers: any[];
  allMaterials: Material[];
  allReports: ErrorReport[];
  filter: string;
}

const normalizeText = (value: unknown) => String(value ?? '').toLowerCase().trim();

export const useAdminDatabaseDatasets = ({
  allUsers,
  allMaterials,
  allReports,
  filter,
}: UseAdminDatabaseDatasetsOptions) => {
  const normalizedFilter = normalizeText(filter);

  const filteredUsers = useMemo(() => {
    if (!normalizedFilter) return allUsers;

    return allUsers.filter((user: any) => {
      const name = normalizeText(user.name);
      const email = normalizeText(user.email);
      return name.includes(normalizedFilter) || email.includes(normalizedFilter);
    });
  }, [allUsers, normalizedFilter]);

  const filteredMaterials = useMemo(() => {
    if (!normalizedFilter) return allMaterials;

    return allMaterials.filter((material: Material) => {
      return normalizeText(material.title).includes(normalizedFilter);
    });
  }, [allMaterials, normalizedFilter]);

  const blockedMaterials = useMemo(() => {
    return allMaterials.filter((material: Material) => material.status === 'rejected');
  }, [allMaterials]);

  const groupedReports = useMemo(() => {
    return groupPendingReports(allReports as ErrorReport[]);
  }, [allReports]);

  return {
    filteredUsers,
    filteredMaterials,
    blockedMaterials,
    groupedReports,
  };
};

