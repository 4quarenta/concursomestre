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
import type { Question, SystemSettings, TaxonomyItem } from '@types';
import { mergeExamBankSources } from '../exams/examBankUtils';

type TaxonomyItemWithSigla = TaxonomyItem & {
  sigla?: string;
};

const getTaxonomyShortLabel = (taxonomy: TaxonomyItemWithSigla) => taxonomy.sigla || taxonomy.name;

export const useManualQuestionReferenceData = (systemSettings: SystemSettings, questions: Question[] = []) => {
  const taxonomies = systemSettings.taxonomies;

  const existingAgencies = useMemo(() => {
    return (taxonomies?.agencies || []).map(getTaxonomyShortLabel);
  }, [taxonomies]);

  const existingOrgaos = useMemo(() => {
    return (taxonomies?.organizations || []).map(getTaxonomyShortLabel);
  }, [taxonomies]);

  const existingSubjects = useMemo(() => {
    return taxonomies?.subjects || [];
  }, [taxonomies]);

  const existingTopics = useMemo(() => {
    return taxonomies?.topics || [];
  }, [taxonomies]);

  const existingSubjectTopics = useMemo(() => {
    const source = taxonomies?.subjectTopics?.length
      ? taxonomies.subjectTopics
      : (taxonomies?.topics || []).filter((taxonomy) => taxonomy.taxonomyLevel === 'topico');
    return source;
  }, [taxonomies]);

  const existingSpecificSubjects = useMemo(() => {
    const source = taxonomies?.specificSubjects?.length
      ? taxonomies.specificSubjects
      : (taxonomies?.topics || []).filter((taxonomy) => taxonomy.taxonomyLevel === 'assunto');
    return source;
  }, [taxonomies]);

  const existingYears = useMemo(() => {
    return taxonomies?.years || [];
  }, [taxonomies]);

  const existingFocuses = useMemo(() => {
    return taxonomies?.careers || [];
  }, [taxonomies]);

  const existingRoles = useMemo(() => {
    return taxonomies?.roles || [];
  }, [taxonomies]);

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
    existingFocuses,
    existingRoles,
    existingProvas,
  };
};
