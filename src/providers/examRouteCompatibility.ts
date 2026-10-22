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
  withoutPlatformShell: boolean;
  skipNotificationBootstrap: true;
};

export const resolveExamPublicRouteCompatibility = (
  pathname: string,
): ExamPublicRouteCompatibility | null => (
  isExamPublicPath(pathname)
    ? { withoutPlatformShell: pathname === '/blog/provas' || pathname.startsWith('/blog/provas/'), skipNotificationBootstrap: true }
    : null
);
