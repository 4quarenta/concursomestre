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

export function extractSemanticSnapshot(documentOrOptions, maybeOptions = {}) {
  const hasDocumentApi = documentOrOptions
    && typeof documentOrOptions.querySelectorAll === 'function';
  const document = hasDocumentApi ? documentOrOptions : globalThis.document;
  const options = hasDocumentApi ? maybeOptions : (documentOrOptions || {});
  const mode = options.mode === 'hydrated' ? 'hydrated' : 'raw';
  const normalize = (value) => String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, '<time>')
    .trim();
  const isExcluded = (element) => {
    if (!element || typeof element.closest !== 'function') return false;
    if (element.closest('[data-hydration-interaction]')) return true;
    return Array.isArray(options.ignoreSelectors)
      && options.ignoreSelectors.some((selector) => {
        try {
          return Boolean(element.closest(selector));
        } catch {
          return false;
        }
      });
  };
  const elements = (selector) => Array.from(document.querySelectorAll(selector)).filter((element) => !isExcluded(element));
  const texts = (selector) => elements(selector).map((element) => normalize(element.textContent)).filter(Boolean);
  const attributeValues = (selector, attribute) => elements(selector)
    .map((element) => normalize(element.getAttribute(attribute)))
    .filter(Boolean);
  const digest = (value) => {
    const input = normalize(value);
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${input.length}:${(hash >>> 0).toString(16)}`;
  };
  const internalLinks = elements('main a[href], nav[aria-label] a[href], [data-breadcrumbs] a[href]')
    .map((element) => ({
      href: normalize(element.getAttribute('href')),
      text: normalize(element.textContent),
    }))
    .filter((entry) => entry.href.startsWith('/') || entry.href.startsWith(options.origin || ''))
    .map((entry) => `${entry.text}|${entry.href}`)
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .sort();
  const breadcrumbSelector = [
    'main nav[aria-label*="breadcrumb" i]',
    'main nav[aria-label*="migalha" i]',
    'main [data-breadcrumbs]',
    '[data-semantic-content] nav[aria-label*="breadcrumb" i]',
    '[data-semantic-content] nav[aria-label*="migalha" i]',
    '[data-semantic-content] [data-breadcrumbs]',
  ].join(', ');
  const breadcrumbs = elements(breadcrumbSelector)
    .map((element) => normalize(element.textContent))
    .filter(Boolean);
  const schemaTypes = [];
  const schemaIdentifiers = [];
  const jsonLd = [];
  const collectSchemaFacts = (value) => {
    if (Array.isArray(value)) {
      value.forEach(collectSchemaFacts);
      return;
    }
    if (!value || typeof value !== 'object') return;
    Object.entries(value).forEach(([key, nested]) => {
      if (key === '@type') {
        (Array.isArray(nested) ? nested : [nested]).forEach((item) => {
          const type = normalize(item);
          if (type) schemaTypes.push(type);
        });
      }
      if (key === '@id' || key === 'url' || key === 'item' || key === 'mainEntityOfPage') {
        const identifier = normalize(nested);
        if (identifier) schemaIdentifiers.push(identifier);
      }
      collectSchemaFacts(nested);
    });
  };
  elements('script[type="application/ld+json"]').forEach((element) => {
    try {
      const parsed = JSON.parse(element.textContent || 'null');
      jsonLd.push(parsed);
      collectSchemaFacts(parsed);
    } catch {
      jsonLd.push({ invalid: true });
    }
  });
  const mainElements = elements('main');
  const semanticRegions = elements('main article, [data-semantic-content]');
  const regionSource = semanticRegions.length > 0 ? semanticRegions : mainElements;
  const semanticText = regionSource.map((element) => {
    const clone = element.cloneNode(true);
    const excludedSelectors = [
      '[data-hydration-interaction]',
      ...(Array.isArray(options.ignoreSelectors) ? options.ignoreSelectors : []),
    ];
    excludedSelectors.forEach((selector) => {
      try {
        clone.querySelectorAll(selector).forEach((nested) => nested.remove());
      } catch {
        // Invalid optional selectors are ignored consistently with isExcluded.
      }
    });
    return normalize(clone.textContent);
  }).join('\n');

  return {
    mode,
    title: normalize(document.title),
    canonical: attributeValues('link[rel="canonical"]', 'href'),
    robots: attributeValues('meta[name="robots"]', 'content'),
    description: attributeValues('meta[name="description"]', 'content'),
    openGraph: {
      title: attributeValues('meta[property="og:title"]', 'content'),
      description: attributeValues('meta[property="og:description"]', 'content'),
      url: attributeValues('meta[property="og:url"]', 'content'),
      type: attributeValues('meta[property="og:type"]', 'content'),
    },
    domNodeCount: document.querySelectorAll('*').length,
    mainCount: mainElements.length,
    h1: texts('main h1, [data-semantic-content] h1'),
    h2: texts('main h2, [data-semantic-content] h2'),
    h3: texts('main h3, [data-semantic-content] h3'),
    breadcrumbs,
    internalLinks,
    jsonLdCount: jsonLd.length,
    jsonLdInvalidCount: jsonLd.filter((entry) => entry && entry.invalid === true).length,
    schemaTypes: [...new Set(schemaTypes)].sort(),
    schemaIdentifiers: [...new Set(schemaIdentifiers)].sort(),
    semanticTextDigest: digest(semanticText),
    semanticTextSample: semanticText.slice(0, 600),
  };
}

export const compareSemanticSnapshots = ({ raw, hydrated, sentinels = [], surfaces = {} }) => {
  const differences = [];
  const compare = (field, severity = 'semantic') => {
    if (JSON.stringify(raw[field]) !== JSON.stringify(hydrated[field])) {
      differences.push({ field, severity, raw: raw[field], hydrated: hydrated[field] });
    }
  };
  [
    'title', 'canonical', 'robots', 'description', 'openGraph', 'mainCount',
    'h1', 'h2', 'h3', 'breadcrumbs', 'jsonLdCount', 'jsonLdInvalidCount',
    'schemaTypes', 'schemaIdentifiers', 'semanticTextDigest',
  ].forEach((field) => compare(field));
  compare('internalLinks', 'interaction');

  const sentinelHits = [];
  Object.entries(surfaces).forEach(([surface, value]) => {
    sentinels.forEach((sentinel) => {
      if (sentinel && String(value || '').includes(sentinel)) {
        sentinelHits.push({ surface, sentinel });
      }
    });
  });

  const classification = sentinelHits.length > 0
    ? 'SECURITY_DIVERGENCE'
    : differences.some((entry) => entry.severity === 'semantic')
      ? 'SEMANTIC_DIVERGENCE'
      : differences.length > 0
        ? 'INTERACTION_ONLY'
        : 'EQUIVALENT';

  return { classification, differences, sentinelHits };
};
