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

import { describe, expect, it } from 'vitest';
import { buildLawJsonLd, descriptionForLaw } from '@/app/lei-comentada/[slug]/page';
import { parsePublicLawDetail } from '../publicLegalCommentaryProjection';
import {
  createProtectedLawPayload,
  PROTECTED_LAW_SENTINELS,
  unlockProtectedLawPayload,
} from './protectedLawFixture';

const FORBIDDEN_KEYS = new Set([
  'syncLogs',
  'isAdmin',
  'reportedCount',
  'previousText',
  'avoidRepetitionNote',
  'teacherComments',
  'examTips',
]);

const findForbiddenKeys = (value: unknown, path = '$'): string[] => {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenKeys(item, `${path}[${index}]`));
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [
    ...(FORBIDDEN_KEYS.has(key) ? [`${path}.${key}`] : []),
    ...findForbiddenKeys(item, `${path}.${key}`),
  ]);
};

describe('PublicLegalCommentaryProjection', () => {
  it('keeps public legal text and removes protected editorial recursively for anonymous readers', () => {
    const projected = parsePublicLawDetail(createProtectedLawPayload(), { authenticated: false });
    expect(projected).not.toBeNull();

    const serialized = JSON.stringify(projected);
    PROTECTED_LAW_SENTINELS.forEach((sentinel) => expect(serialized).not.toContain(sentinel));
    expect(findForbiddenKeys(projected)).toEqual([]);
    expect(projected?.articles[0].text).toBe('Texto legal publico.');
    expect(projected?.sectionEditorials[0]).toMatchObject({ hasContent: true, access: 'locked' });
    expect(projected?.editorialAvailability.commentary).toEqual({ available: true, access: 'locked' });
  });

  it('retains authorized editorial while keeping administrative diagnostics private', () => {
    const projected = parsePublicLawDetail(unlockProtectedLawPayload(), { authenticated: true });
    const serialized = JSON.stringify(projected);

    expect(serialized).toContain('SECRET_EDITORIAL_SENTINEL_123');
    expect(serialized).toContain('SECRET_DOCTRINE_SENTINEL_321');
    expect(serialized).not.toContain('SECRET_ADMIN_SENTINEL_963');
    expect(serialized).not.toContain('SECRET_PREVIOUS_TEXT_SENTINEL_987');
    expect(findForbiddenKeys(projected)).toEqual([]);
  });

  it('does not grant editorial content merely because a reader is authenticated', () => {
    const projected = parsePublicLawDetail(createProtectedLawPayload(), { authenticated: true });
    const serialized = JSON.stringify(projected);

    expect(serialized).not.toContain('SECRET_EDITORIAL_SENTINEL_123');
    expect(serialized).not.toContain('SECRET_SUMMARY_SENTINEL_456');
    expect(projected?.sectionEditorials[0]).toMatchObject({ hasContent: true, access: 'locked' });
  });

  it('derives metadata and JSON-LD only from sanitized public fields', () => {
    const projected = parsePublicLawDetail(createProtectedLawPayload(), { authenticated: false });
    expect(projected).not.toBeNull();

    const presentation = JSON.stringify({
      description: descriptionForLaw(projected),
      jsonLd: buildLawJsonLd(projected!),
    });
    PROTECTED_LAW_SENTINELS.forEach((sentinel) => expect(presentation).not.toContain(sentinel));
    expect(presentation).toContain('Resumo publico da norma.');
    expect(presentation).not.toContain('articleBody');
  });
});
