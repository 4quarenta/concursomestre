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

const RADICAL_SYMBOL = '\u221A';
const RADICAL_TOKEN_PATTERN = '(?:\\u221A|&radic;|&#8730;|&#x221a;|\\u00E2\\u02C6\\u0161)';
const DECORATIVE_LINE_CHARS_PATTERN = '[\\s\\u00A0_\\-\\u00AF\\u203E\\u2014\\u2015\\u2500\\u2501\\u0304\\u0305\\u0332]';
const LINE_STYLE_PATTERN = /(text-decoration\s*:\s*overline|border-top\s*:|border-bottom\s*:)/i;
const HEAVY_LAYOUT_PATTERN = /(width\s*:|display\s*:\s*(block|inline-block)|position\s*:\s*(absolute|relative)|left\s*:|right\s*:|top\s*:|bottom\s*:)/i;
const STYLE_DECLARATION_SEPARATOR = ';';
const LINE_DECLARATION_PATTERN = /^(text-decoration|border-top|border-bottom)\s*:/i;
const HEAVY_DECLARATION_PATTERN = /^(width|min-width|max-width|left|right|top|bottom|position)\s*:/i;
const BLOCK_DISPLAY_DECLARATION_PATTERN = /^display\s*:\s*(block|inline-block)$/i;
const MATH_LAYOUT_TAGS = new Set(['math', 'msqrt', 'mroot', 'mrow', 'menclose', 'mi', 'mn', 'mo', 'mtext']);
const MATH_LAYOUT_ATTRIBUTES = ['width', 'minwidth', 'maxwidth', 'min-width', 'max-width'];

const stripDecorativeChars = (value: string): string => (
  value
    .replace(/\u00A0/g, ' ')
    .replace(/[\s_\-\u00AF\u203E\u2014\u2015\u2500\u2501\u0304\u0305\u0332]+/g, '')
);

const stripUnsafeLineAndLayoutStyles = (styleAttr: string, shouldStripLineStyles: boolean): string => (
  styleAttr
    .split(STYLE_DECLARATION_SEPARATOR)
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .filter((declaration) => !shouldStripLineStyles || !LINE_DECLARATION_PATTERN.test(declaration))
    .filter((declaration) => !HEAVY_DECLARATION_PATTERN.test(declaration))
    .filter((declaration) => !BLOCK_DISPLAY_DECLARATION_PATTERN.test(declaration))
    .join('; ')
);

const sanitizeLineStyledElement = (element: HTMLElement): void => {
  const styleAttr = element.getAttribute('style') || '';
  if (!LINE_STYLE_PATTERN.test(styleAttr)) {
    return;
  }

  const hasVisualChildren = Boolean(element.querySelector('img,svg,math,table,video,canvas,iframe,object'));
  const meaningfulText = stripDecorativeChars(element.textContent || '');
  if (!hasVisualChildren && !meaningfulText) {
    element.remove();
    return;
  }

  const hasHeavyLayout = HEAVY_LAYOUT_PATTERN.test(styleAttr);
  if (!hasHeavyLayout && !hasVisualChildren) {
    return;
  }

  const safeStyle = stripUnsafeLineAndLayoutStyles(styleAttr, true);

  if (safeStyle) {
    element.setAttribute('style', safeStyle);
  } else {
    element.removeAttribute('style');
  }
};

const sanitizeMathLayoutElement = (element: HTMLElement): void => {
  const tagName = element.tagName.toLowerCase();
  if (!MATH_LAYOUT_TAGS.has(tagName)) {
    return;
  }

  MATH_LAYOUT_ATTRIBUTES.forEach((attribute) => {
    element.removeAttribute(attribute);
  });

  const styleAttr = element.getAttribute('style') || '';
  if (!styleAttr) {
    return;
  }

  const safeStyle = stripUnsafeLineAndLayoutStyles(styleAttr, LINE_STYLE_PATTERN.test(styleAttr));
  if (safeStyle) {
    element.setAttribute('style', safeStyle);
  } else {
    element.removeAttribute('style');
  }
};

const regexNormalizeRadicalArtifacts = (inputHtml: string): string => {
  let normalized = inputHtml;

  // Ex.: "√¯¯¯¯¯" / "√_____" / mojibake equivalents.
  normalized = normalized.replace(
    new RegExp(`${RADICAL_TOKEN_PATTERN}(?:${DECORATIVE_LINE_CHARS_PATTERN}|&nbsp;|&#160;){3,}`, 'gi'),
    RADICAL_SYMBOL,
  );

  // Ex.: "√<span style='text-decoration: overline'>_____</span>" (and div/p variants).
  normalized = normalized.replace(
    new RegExp(
      `${RADICAL_TOKEN_PATTERN}\\s*<(span|div|p)[^>]*(?:text-decoration\\s*:\\s*overline|border-top|border-bottom)[^>]*>(?:${DECORATIVE_LINE_CHARS_PATTERN}|&nbsp;|&#160;|<br\\s*\\/?>)*<\\/\\1>`,
      'gi',
    ),
    RADICAL_SYMBOL,
  );

  // Ex.: "√<hr ...>" from malformed OCR conversions.
  normalized = normalized.replace(new RegExp(`${RADICAL_TOKEN_PATTERN}\\s*<hr[^>]*>`, 'gi'), RADICAL_SYMBOL);

  return normalized;
};

/**
 * Removes malformed OCR/PDF artifacts that generate "infinite radical lines"
 * while preserving valid question content.
 *
 * @since 1.0.0
 */
export const normalizeQuestionRichHtml = (rawHtml: string | null | undefined): string => {
  if (!rawHtml) {
    return '';
  }

  const normalizedByRegex = regexNormalizeRadicalArtifacts(String(rawHtml));

  if (typeof DOMParser === 'undefined') {
    return normalizedByRegex;
  }

  try {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(`<div id="question-rich-html-root">${normalizedByRegex}</div>`, 'text/html');
    const root = parsedDocument.getElementById('question-rich-html-root');
    if (!root) {
      return normalizedByRegex;
    }

    const elements = Array.from(root.querySelectorAll<HTMLElement>('*'));
    elements.forEach((element) => {
      sanitizeLineStyledElement(element);
      sanitizeMathLayoutElement(element);
    });

    return root.innerHTML;
  } catch {
    return normalizedByRegex;
  }
};
