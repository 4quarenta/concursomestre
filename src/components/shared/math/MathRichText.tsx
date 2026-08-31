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
  disableCallouts?: boolean;
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

const normalizeLegacyHtmlToMarkdown = (value: string) => value
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n\n')
  .replace(/<p[^>]*>/gi, '')
  .replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n')
  .replace(/<li[^>]*>/gi, '- ')
  .replace(/<\/li>/gi, '\n')
  .replace(/<strong[^>]*>|<b[^>]*>/gi, '**')
  .replace(/<\/strong>|<\/b>/gi, '**')
  .replace(/<em[^>]*>|<i[^>]*>/gi, '*')
  .replace(/<\/em>|<\/i>/gi, '*')
  .replace(/<u[^>]*>/gi, '__')
  .replace(/<\/u>/gi, '__')
  .replace(/<mark[^>]*>/gi, '**')
  .replace(/<\/mark>/gi, '**')
  .replace(/<\/?(?:div|section|article|header|footer)[^>]*>/gi, '\n')
  .replace(/&nbsp;/gi, ' ');

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
  .replace(/__([^_]+?)__/g, '<u>$1</u>')
  .replace(/`([^`]+?)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+?)\*/g, '<em>$1</em>');

const splitMarkdownTableRow = (line: string) => line
  .trim()
  .replace(/^\|/, '')
  .replace(/\|$/, '')
  .split('|')
  .map((cell) => cell.trim());

const isMarkdownTableSeparator = (line: string) => {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

const isMarkdownTable = (lines: string[]) => (
  lines.length >= 2
  && lines[0].includes('|')
  && isMarkdownTableSeparator(lines[1])
);

const renderMarkdownTable = (lines: string[]) => {
  const headers = splitMarkdownTableRow(lines[0]);
  const rows = lines.slice(2)
    .filter((line) => line.includes('|'))
    .map(splitMarkdownTableRow)
    .filter((cells) => cells.some(Boolean));

  if (headers.length < 2 || rows.length === 0) {
    return '';
  }

  return [
    '<div class="cm-rich-table-wrap"><table>',
    `<thead><tr>${headers.map((header) => `<th>${renderInlineMarkdown(header)}</th>`).join('')}</tr></thead>`,
    `<tbody>${rows.map((row) => `<tr>${headers.map((_header, index) => `<td>${renderInlineMarkdown(row[index] || '')}</td>`).join('')}</tr>`).join('')}</tbody>`,
    '</table></div>',
  ].join('');
};

const CALLOUT_META: Record<string, { label: string; className: string }> = {
  ATENCAO: { label: 'Atencao de prova', className: 'cm-callout-warning' },
  ATENÇÃO: { label: 'Atencao de prova', className: 'cm-callout-warning' },
  CUIDADO: { label: 'Cuidado', className: 'cm-callout-warning' },
  DICA: { label: 'Dica do professor', className: 'cm-callout-tip' },
  ERRO: { label: 'Erro comum', className: 'cm-callout-danger' },
  GABARITO: { label: 'Gabarito comentado', className: 'cm-callout-success' },
  MACETE: { label: 'Macete', className: 'cm-callout-purple' },
  PROVA: { label: 'Como cai em prova', className: 'cm-callout-info' },
};

const normalizeCalloutKey = (value: string) => value
  .trim()
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const renderCalloutBlock = (lines: string[]) => {
  const firstLine = lines[0] || '';
  const match = firstLine.match(/^&gt;\s*\[!([A-ZÀ-Ú]+)\]\s*(.*)$/i);
  if (!match) {
    return '';
  }

  const meta = CALLOUT_META[normalizeCalloutKey(match[1])] || CALLOUT_META.DICA;
  const bodyLines = [
    match[2],
    ...lines.slice(1).map((line) => line.replace(/^&gt;\s?/, '')),
  ].map((line) => line.trim()).filter(Boolean);

  if (bodyLines.length === 0) {
    return '';
  }

  return [
    `<div class="cm-callout ${meta.className}">`,
    `<div class="cm-callout-title">${meta.label}</div>`,
    `<div class="cm-callout-body">${renderInlineMarkdown(bodyLines.join('<br />'))}</div>`,
    '</div>',
  ].join('');
};

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

const looksLikeHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

const renderSafeHtmlWithMath = (content: string): string => {
  const { output, tokens, html } = protectMath(content);
  return restoreMath(normalizeQuestionRichHtml(output), tokens, html);
};

interface RenderMathMarkdownOptions {
  disableCallouts?: boolean;
}

export const renderMathMarkdownToHtml = (
  content: string | null | undefined,
  options: RenderMathMarkdownOptions = {},
): string => {
  const raw = stripControlChars(String(content || '').trim());
  if (!raw) {
    return '';
  }

  const withoutFence = raw
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  if (looksLikeHtml(withoutFence)) {
    return renderSafeHtmlWithMath(withoutFence);
  }

  const normalizedLegacyHtml = normalizeLegacyHtmlToMarkdown(withoutFence);
  const { output, tokens, html } = protectMath(normalizedLegacyHtml);
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

    if (isMarkdownTable(lines)) {
      return renderMarkdownTable(lines);
    }

    const callout = options.disableCallouts ? '' : renderCalloutBlock(lines);
    if (callout) {
      return callout;
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

export const MathRichText = ({ content, className = '', disableCallouts = false }: MathRichTextProps) => {
  const sanitizedHtml = React.useMemo(
    () => renderMathMarkdownToHtml(content, { disableCallouts }),
    [content, disableCallouts],
  );

  if (!sanitizedHtml) {
    return null;
  }

  return (
    <div
      className={`question-rich-html question-comment-math ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default MathRichText;
