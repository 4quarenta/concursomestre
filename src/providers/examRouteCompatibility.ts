/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*/

import { isExamPublicPath } from '@services/routes/publicRoutes';

export type ExamPublicRouteCompatibility = {
  withoutPlatformShell: true;
  skipNotificationBootstrap: true;
};

const EXAM_PUBLIC_ROUTE_COMPATIBILITY: ExamPublicRouteCompatibility = {
  withoutPlatformShell: true,
  skipNotificationBootstrap: true,
};

export const resolveExamPublicRouteCompatibility = (
  pathname: string,
): ExamPublicRouteCompatibility | null => (
  isExamPublicPath(pathname) ? EXAM_PUBLIC_ROUTE_COMPATIBILITY : null
);
