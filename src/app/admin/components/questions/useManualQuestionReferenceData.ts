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
import type { SystemSettings } from '@types';

export const useManualQuestionReferenceData = (systemSettings: SystemSettings) => {
  const existingAgencies = useMemo(() => {
    return (systemSettings.taxonomies?.agencies || []).map((taxonomy: any) => taxonomy.sigla || taxonomy.name);
  }, [systemSettings.taxonomies?.agencies]);

  const existingOrgaos = useMemo(() => {
    return (systemSettings.taxonomies?.organizations || []).map((taxonomy: any) => taxonomy.sigla || taxonomy.name);
  }, [systemSettings.taxonomies?.organizations]);

  const existingSubjects = useMemo(() => {
    return (systemSettings.taxonomies?.subjects || []).map((taxonomy: any) => taxonomy.name);
  }, [systemSettings.taxonomies?.subjects]);

  const existingTopics = useMemo(() => {
    return (systemSettings.taxonomies?.topics || []).map((taxonomy: any) => taxonomy.name);
  }, [systemSettings.taxonomies?.topics]);

  const existingYears = useMemo(() => {
    return systemSettings.taxonomies?.years || [];
  }, [systemSettings.taxonomies?.years]);

  const existingRoles = useMemo(() => {
    return (systemSettings.taxonomies?.roles || []).map((taxonomy: any) => taxonomy.name);
  }, [systemSettings.taxonomies?.roles]);

  return {
    existingAgencies,
    existingOrgaos,
    existingSubjects,
    existingTopics,
    existingYears,
    existingRoles,
  };
};
