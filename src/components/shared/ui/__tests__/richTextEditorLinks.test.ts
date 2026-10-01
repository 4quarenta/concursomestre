// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyRichTextLink, normalizeRichTextLinkUrl } from '../richTextEditorLinks';

describe('rich text editor links', () => {
  it('wraps selected text while preserving inline formatting', () => {
    const editor = document.createElement('div');
    editor.innerHTML = '<p>Estude com <strong>foco total</strong>.</p>';
    const paragraph = editor.querySelector('p')!;
    const plainText = paragraph.firstChild!;
    const boldText = paragraph.querySelector('strong')!.firstChild!;
    const range = document.createRange();
    range.setStart(plainText, 0);
    range.setEnd(boldText, boldText.textContent!.length);

    expect(applyRichTextLink(editor, range, 'https://exemplo.com/planos')).toBe(true);
    expect(editor.querySelectorAll('a')).toHaveLength(2);
    expect(editor.textContent).toBe('Estude com foco total.');
    expect(editor.querySelector('strong a')?.textContent).toBe('foco total');
    expect(editor.querySelector('a')?.getAttribute('target')).toBe('_blank');
    expect(editor.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('updates a selected existing link instead of nesting anchors', () => {
    const editor = document.createElement('div');
    editor.innerHTML = '<p><a href="/old">texto vinculado</a></p>';
    const text = editor.querySelector('a')!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(text);

    expect(applyRichTextLink(editor, range, '/new')).toBe(true);
    expect(editor.querySelectorAll('a')).toHaveLength(1);
    expect(editor.querySelector('a')?.getAttribute('href')).toBe('/new');
    expect(editor.querySelector('a')?.hasAttribute('target')).toBe(false);
  });

  it('rejects collapsed, detached, and unsafe selections or destinations', () => {
    const editor = document.createElement('div');
    editor.innerHTML = '<p>texto selecionado</p>';
    const text = editor.querySelector('p')!.firstChild!;
    const outside = document.createElement('div');
    const outsideText = document.createTextNode('fora do editor');
    outside.append(outsideText);
    const detachedRange = document.createRange();
    detachedRange.selectNodeContents(outsideText);
    const collapsedRange = document.createRange();
    collapsedRange.setStart(text, 0);

    expect(applyRichTextLink(editor, collapsedRange, '/ok')).toBe(false);
    expect(applyRichTextLink(editor, detachedRange, '/ok')).toBe(false);
    expect(normalizeRichTextLinkUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeRichTextLinkUrl('//example.com')).toBeNull();
    expect(normalizeRichTextLinkUrl('https://example.com')).toBe('https://example.com/');
  });
});
