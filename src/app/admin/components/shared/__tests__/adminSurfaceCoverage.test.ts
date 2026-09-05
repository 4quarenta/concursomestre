/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved.
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { describe, expect, it } from 'vitest';
import { ADMIN_SURFACE_COVERAGE, getAdminSurfaceCoverageSummary } from '../adminSurfaceCoverage';

describe('admin surface coverage', () => {
  it('keeps every comparable list and editor on a canonical interaction contract', () => {
    const summary = getAdminSurfaceCoverageSummary();

    expect(summary.comparableLists).toBe(26);
    expect(summary.standardizedLists).toBe(summary.comparableLists);
    expect(summary.editableSurfaces).toBe(7);
    expect(summary.standardizedEditors).toBe(summary.editableSurfaces);
    expect(summary.unjustifiedExceptions).toBe(0);
  });

  it('does not duplicate route identities in the coverage ledger', () => {
    const ids = ADMIN_SURFACE_COVERAGE.map((surface) => surface.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
