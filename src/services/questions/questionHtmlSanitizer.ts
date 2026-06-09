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
const UNSAFE_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form', 'input', 'button', 'textarea', 'select', 'option', 'video', 'audio', 'canvas']);
const SAFE_TAGS = new Set([
  'a', 'abbr', 'article', 'aside', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup',
  'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'mark', 'math', 'menclose', 'mi', 'mn', 'mo',
  'mroot', 'mrow', 'msqrt', 'mtext', 'ol', 'p', 'pre', 's', 'section', 'small', 'span', 'strong',
  'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
]);
const URI_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'srcset']);
const SAFE_ATTRIBUTE_PREFIXES = ['aria-', 'data-'];
const SAFE_ATTRIBUTES = new Set([
  'alt', 'class', 'colspan', 'height', 'id', 'loading', 'rel', 'role', 'rowspan', 'scope',
  'style', 'target', 'title', 'width',
]);
const UNSAFE_STYLE_PATTERN = /(expression\s*\(|url\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|-moz-binding\s*:)/i;
const SAFE_DATA_IMAGE_URI_PATTERN = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;
const SAFE_URI_PATTERN = /^(https?:|mailto:|tel:|\/|#|uploads\/|assets\/|images\/|_next\/)/i;

const isSafeUriValue = (attributeName: string, value: string) => (
  SAFE_URI_PATTERN.test(value)
  || (attributeName === 'src' && SAFE_DATA_IMAGE_URI_PATTERN.test(value))
);

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
    .filter((declaration) => !UNSAFE_STYLE_PATTERN.test(declaration))
    .join('; ')
);

const stripUnsafeHtmlByRegex = (inputHtml: string): string => (
  inputHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|link|meta|form|input|button|textarea|select|option|video|audio|canvas)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src|xlink:href)\s*=\s*(["'])([^"']*)\2/gi, (match, attributeName, quote, rawValue) => {
      const normalizedAttribute = String(attributeName || '').toLowerCase();
      const uri = String(rawValue || '').trim();
      if (/^(?:javascript|vbscript):/i.test(uri)) {
        return ` ${attributeName}="#"`;
      }
      if (/^data:/i.test(uri) && !isSafeUriValue(normalizedAttribute, uri)) {
        return ` ${attributeName}="#"`;
      }
      return match;
    })
    .replace(/\s+srcset\s*=\s*(["'])[^"']*(?:javascript|vbscript|data):[^"']*\1/gi, '')
    .replace(/\s+style\s*=\s*(["'])[^"']*(?:expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|-moz-binding\s*:)[^"']*\1/gi, '')
);

const isSafeAttribute = (name: string) => (
  SAFE_ATTRIBUTES.has(name)
  || SAFE_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix))
);

const sanitizeUriAttribute = (element: HTMLElement, attributeName: string): void => {
  const value = (element.getAttribute(attributeName) || '').trim();
  if (value === '') {
    element.removeAttribute(attributeName);
    return;
  }

  if (attributeName === 'srcset') {
    const hasUnsafeSource = value
      .split(',')
      .map((source) => source.trim().split(/\s+/)[0] || '')
      .some((source) => source !== '' && !SAFE_URI_PATTERN.test(source));

    if (hasUnsafeSource) {
      element.removeAttribute(attributeName);
    }

    return;
  }

  if (!isSafeUriValue(attributeName.toLowerCase(), value)) {
    element.removeAttribute(attributeName);
  }
};

const sanitizeElementAttributes = (element: HTMLElement): void => {
  Array.from(element.attributes).forEach((attribute) => {
    const attributeName = attribute.name.toLowerCase();

    if (attributeName.startsWith('on')) {
      element.removeAttribute(attribute.name);
      return;
    }

    if (!isSafeAttribute(attributeName) && !URI_ATTRIBUTES.has(attributeName)) {
      element.removeAttribute(attribute.name);
      return;
    }

    if (URI_ATTRIBUTES.has(attributeName)) {
      sanitizeUriAttribute(element, attribute.name);
      return;
    }

    if (attributeName === 'style' && UNSAFE_STYLE_PATTERN.test(attribute.value)) {
      element.removeAttribute(attribute.name);
    }
  });

  if (element.tagName.toLowerCase() === 'a') {
    element.setAttribute('rel', 'nofollow noopener noreferrer');
    if (element.getAttribute('target') === '_blank') {
      element.setAttribute('rel', 'nofollow noopener noreferrer');
    }
  }
};

const sanitizeElementTree = (root: HTMLElement): void => {
  Array.from(root.querySelectorAll<HTMLElement>('*')).forEach((element) => {
    const tagName = element.tagName.toLowerCase();

    if (UNSAFE_TAGS.has(tagName)) {
      element.remove();
      return;
    }

    if (!SAFE_TAGS.has(tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    sanitizeElementAttributes(element);
  });
};

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

  const normalizedByRegex = stripUnsafeHtmlByRegex(regexNormalizeRadicalArtifacts(String(rawHtml)));

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

    sanitizeElementTree(root);

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
