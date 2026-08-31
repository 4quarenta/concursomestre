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

const GOOGLE_CLIENT_ID_PATTERN = /^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i;

export const normalizeGoogleClientId = (...candidates: Array<string | undefined | null>) => (
  candidates
    .map((candidate) => String(candidate || '').trim())
    .find((candidate) => GOOGLE_CLIENT_ID_PATTERN.test(candidate)) || ''
);

export const hasInvalidGoogleClientIdCandidate = (...candidates: Array<string | undefined | null>) => (
  candidates.some((candidate) => String(candidate || '').trim().length > 0)
  && !normalizeGoogleClientId(...candidates)
);
