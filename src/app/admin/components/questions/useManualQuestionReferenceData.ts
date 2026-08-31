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

import { useEffect, useMemo, useState } from 'react';
import type { Prova, Question, SystemSettings, TaxonomyItem } from '@types';
import { examService } from '@services/exams/examService';
import { mergeExamBankSources } from '../exams/examBankUtils';

type TaxonomyItemWithSigla = TaxonomyItem & {
  sigla?: string;
};

const getTaxonomyShortLabel = (taxonomy: TaxonomyItemWithSigla) => taxonomy.sigla || taxonomy.name;

export const useManualQuestionReferenceData = (
  systemSettings: SystemSettings,
  questions: Question[] = [],
  enabled = true,
) => {
  const taxonomies = systemSettings.taxonomies;
  const [canonicalProvas, setCanonicalProvas] = useState<Prova[]>([]);
  const [hasCanonicalProvasLoaded, setHasCanonicalProvasLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setCanonicalProvas([]);
      setHasCanonicalProvasLoaded(false);
      return;
    }

    let isActive = true;

    setHasCanonicalProvasLoaded(false);
    void examService.list({ limit: 500 }).then((items) => {
      if (!isActive) {
        return;
      }
      setCanonicalProvas(items);
      setHasCanonicalProvasLoaded(true);
    }).catch(() => {
      if (!isActive) {
        return;
      }
      setCanonicalProvas([]);
      setHasCanonicalProvasLoaded(true);
    });

    return () => {
      isActive = false;
    };
  }, [enabled]);

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
    if (hasCanonicalProvasLoaded && canonicalProvas.length > 0) {
      return mergeExamBankSources({ ...systemSettings, examBank: canonicalProvas }, []);
    }

    const hasPersistedExamBank = Array.isArray(systemSettings.examBank) && systemSettings.examBank.length > 0;
    if (hasPersistedExamBank || questions.length === 0) {
      return mergeExamBankSources(systemSettings, []);
    }

    return mergeExamBankSources(systemSettings, questions);
  }, [canonicalProvas, hasCanonicalProvasLoaded, questions, systemSettings]);

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
