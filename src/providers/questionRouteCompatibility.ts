/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*/

import { isQuestionsIndexPath } from '@services/routes/publicRoutes';
import type { PlanBenefitKey } from '@types';

export type QuestionCollectionRouteCompatibility = {
  requiresGlobalLoginWhenEnabled: true;
  allowsPublicServerRender: true;
  featureKey: 'practiceEnabled';
  featureLabel: 'Questoes';
  planBenefitKeys: ['module.practice'];
  planCopyKey: 'module.practice';
  planLabel: 'Prática de questões';
  studyMode: 'practice';
  heavyNotificationBootstrap: true;
};

const QUESTION_COLLECTION_COMPATIBILITY: QuestionCollectionRouteCompatibility = {
  requiresGlobalLoginWhenEnabled: true,
  allowsPublicServerRender: true,
  featureKey: 'practiceEnabled',
  featureLabel: 'Questoes',
  planBenefitKeys: ['module.practice'],
  planCopyKey: 'module.practice',
  planLabel: 'Prática de questões',
  studyMode: 'practice',
  heavyNotificationBootstrap: true,
};

export const resolveQuestionCollectionRouteCompatibility = (
  pathname: string,
): QuestionCollectionRouteCompatibility | null => (
  isQuestionsIndexPath(pathname) ? QUESTION_COLLECTION_COMPATIBILITY : null
);

export const questionCollectionPlanBenefitKeys = (
  pathname: string,
): PlanBenefitKey[] | null => {
  const compatibility = resolveQuestionCollectionRouteCompatibility(pathname);
  return compatibility ? [...compatibility.planBenefitKeys] : null;
};
