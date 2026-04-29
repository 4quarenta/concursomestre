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

import React from 'react';
import katex from 'katex';
import { normalizeQuestionRichHtml } from '@services/questions/questionHtmlSanitizer';

interface MathRichTextProps {
  content?: string | null;
  className?: string;
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const stripControlChars = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

const renderLatex = (source: string, displayMode: boolean) => {
  const expression = source.trim();
  if (!expression) {
    return '';
  }

  try {
    return katex.renderToString(expression, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
    });
  } catch {
    return escapeHtml(expression);
  }
};

const protectMath = (value: string) => {
  const tokens: string[] = [];
  const html: string[] = [];
  const addToken = (source: string, displayMode: boolean) => {
    const token = `%%CM_MATH_${tokens.length}%%`;
    tokens.push(token);
    html.push(renderLatex(source, displayMode));
    return token;
  };

  let output = value
    .replace(/\$\$([\s\S]+?)\$\$/g, (_match, source) => addToken(source, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_match, source) => addToken(source, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_match, source) => addToken(source, false));

  output = output.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_match, prefix, source) => `${prefix}${addToken(source, false)}`);

  return { output, tokens, html };
};

const renderInlineMarkdown = (value: string) => value
  .replace(/`([^`]+?)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+?)\*/g, '<em>$1</em>');

const normalizeSafeInlineTag = (tag: string) => {
  const normalized = tag.toLowerCase().replace(/\s+/g, '');
  if (/^<br\/?>$/.test(normalized)) return '<br />';
  if (/^<\/?b>$/.test(normalized)) return normalized.startsWith('</') ? '</strong>' : '<strong>';
  if (/^<\/?i>$/.test(normalized)) return normalized.startsWith('</') ? '</em>' : '<em>';
  if (/^<\/?(strong|em|mark)>$/.test(normalized)) return normalized;
  return '';
};

const protectSafeInlineHtml = (value: string) => {
  const tokens: string[] = [];
  const html: string[] = [];
  const output = value.replace(/<\/?(?:strong|em|mark|b|i)\s*>|<br\s*\/?>/gi, (tag) => {
    const safeTag = normalizeSafeInlineTag(tag);
    if (!safeTag) {
      return tag;
    }

    const token = `%%CM_HTML_${tokens.length}%%`;
    tokens.push(token);
    html.push(safeTag);
    return token;
  });

  return { output, tokens, html };
};

const restoreMath = (value: string, tokens: string[], html: string[]) => tokens.reduce(
  (current, token, index) => current.replaceAll(token, html[index] || ''),
  value,
);

export const renderMathMarkdownToHtml = (content: string | null | undefined): string => {
  const raw = stripControlChars(String(content || '').trim());
  if (!raw) {
    return '';
  }

  const withoutFence = raw
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const { output, tokens, html } = protectMath(withoutFence);
  const safeHtml = protectSafeInlineHtml(output);
  const escaped = escapeHtml(safeHtml.output);
  const blocks = escaped.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  const renderedBlocks = blocks.map((block) => {
    const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      return '';
    }

    const heading = lines[0].match(/^(#{1,4})\s+(.+)$/);
    if (heading && lines.length === 1) {
      return `<h4>${renderInlineMarkdown(heading[2])}</h4>`;
    }

    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    }

    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      return `<ol>${lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`;
    }

    return `<p>${renderInlineMarkdown(lines.join('<br />'))}</p>`;
  }).join('');

  return normalizeQuestionRichHtml(restoreMath(
    restoreMath(renderedBlocks, safeHtml.tokens, safeHtml.html),
    tokens,
    html,
  ));
};

export const MathRichText = ({ content, className = '' }: MathRichTextProps) => {
  const html = React.useMemo(() => renderMathMarkdownToHtml(content), [content]);

  if (!html) {
    return null;
  }

  return (
    <div
      className={`question-rich-html question-comment-math ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MathRichText;
