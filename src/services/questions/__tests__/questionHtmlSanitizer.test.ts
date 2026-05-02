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
import { normalizeQuestionRichHtml } from '../questionHtmlSanitizer';

describe('question html sanitizer', () => {
  it('removes scripts, event handlers and unsafe urls from rich html', () => {
    const html = normalizeQuestionRichHtml(`
      <p onclick="alert(1)">Texto seguro</p>
      <img src="javascript:alert(1)" onerror="alert(2)" />
      <a href="javascript:alert(3)">clique</a>
      <script>alert(4)</script>
    `);

    expect(html).toContain('Texto seguro');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });

  it('preserves safe formatting and radical normalization', () => {
    const html = normalizeQuestionRichHtml('<p><strong>Gabarito</strong>: $\\sqrt{9}$</p>');

    expect(html).toContain('<strong>');
    expect(html).toContain('$\\sqrt{9}$');
  });
});
