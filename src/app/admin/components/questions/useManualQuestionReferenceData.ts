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
import type { Question, SystemSettings } from '@types';
import { mergeExamBankSources } from '../exams/examBankUtils';

export const useManualQuestionReferenceData = (systemSettings: SystemSettings, questions: Question[] = []) => {
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

  const existingSubjectTopics = useMemo(() => {
    const source = systemSettings.taxonomies?.subjectTopics?.length
      ? systemSettings.taxonomies.subjectTopics
      : (systemSettings.taxonomies?.topics || []).filter((taxonomy: any) => taxonomy.taxonomyLevel === 'topico');
    return source.map((taxonomy: any) => taxonomy.name);
  }, [systemSettings.taxonomies?.subjectTopics, systemSettings.taxonomies?.topics]);

  const existingSpecificSubjects = useMemo(() => {
    const source = systemSettings.taxonomies?.specificSubjects?.length
      ? systemSettings.taxonomies.specificSubjects
      : (systemSettings.taxonomies?.topics || []).filter((taxonomy: any) => taxonomy.taxonomyLevel === 'assunto');
    return source.map((taxonomy: any) => taxonomy.name);
  }, [systemSettings.taxonomies?.specificSubjects, systemSettings.taxonomies?.topics]);

  const existingYears = useMemo(() => {
    return systemSettings.taxonomies?.years || [];
  }, [systemSettings.taxonomies?.years]);

  const existingRoles = useMemo(() => {
    return (systemSettings.taxonomies?.roles || []).map((taxonomy: any) => taxonomy.name);
  }, [systemSettings.taxonomies?.roles]);

  const existingProvas = useMemo(() => {
    return mergeExamBankSources(systemSettings, questions);
  }, [questions, systemSettings]);

  return {
    existingAgencies,
    existingOrgaos,
    existingSubjects,
    existingTopics,
    existingSubjectTopics,
    existingSpecificSubjects,
    existingYears,
    existingRoles,
    existingProvas,
  };
};
