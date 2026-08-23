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
import { readFileSync } from 'node:fs';

describe('Phase 7 public image dimensions', () => {
  it('reserves space and prioritizes only the featured blog cover', () => {
    const source = readFileSync('src/app/blog/BlogArticleCard.tsx', 'utf8');
    expect(source).toContain("width={featured ? 1280 : 960}");
    expect(source).toContain("height={featured ? 800 : 540}");
    expect(source).toContain("fetchPriority={featured ? 'high' : 'auto'}");
  });

  it('reserves intrinsic space for article covers', () => {
    const source = readFileSync('src/app/blog/[slug]/page.tsx', 'utf8');
    expect(source).toMatch(/width=\{1280\}[\s\S]*height=\{720\}/);
  });
});
