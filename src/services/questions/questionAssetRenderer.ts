import type { QuestionAsset } from '@types';
import { getAssetUrl } from '@services/api';
import { normalizeQuestionRichHtml } from './questionHtmlSanitizer';

const escapeHtmlAttribute = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const isTransientBlobUrl = (value: string): boolean => /^blob:/i.test(value.trim());

const absolutizeEmbeddedImages = (html: string): string => html.replace(
  /<img[^>]+src=(['"])([^'"]+)\1[^>]*>/gi,
  (match, _quote, source) => {
    const src = String(source || '').trim();
    if (isTransientBlobUrl(src)) return '';
    if (/^(?:https?:|data:image\/)/i.test(src)) return match;
    return match.replace(src, getAssetUrl(src));
  },
);

const getAssetId = (asset: QuestionAsset): string => String(asset.tempId || asset.id || '').trim();

const getAssetSource = (asset: QuestionAsset): string => {
  const source = String(asset.url || asset.base64 || '').trim();
  if (!source || /^(?:javascript|vbscript):/i.test(source) || isTransientBlobUrl(source)) return '';
  if (/^(?:https?:|data:image\/)/i.test(source)) return source;
  if (asset.base64 && source === asset.base64) {
    return `data:image/png;base64,${source.replace(/\s+/g, '')}`;
  }
  return getAssetUrl(source);
};

const renderAsset = (asset: QuestionAsset, source: string): string => [
  '<figure class="question-support-figure my-3">',
  `<img src="${escapeHtmlAttribute(source)}" alt="${escapeHtmlAttribute(asset.alt || 'Imagem da questao')}" loading="lazy" />`,
  asset.caption ? `<figcaption>${escapeHtmlAttribute(asset.caption)}</figcaption>` : '',
  '</figure>',
].join('');

/**
 * Resolves canonical [image:asset_id] markers and keeps markerless assets
 * visible in the field to which the backend assigned them.
 */
export const renderQuestionContentWithAssets = (
  html: string | null | undefined,
  assets: QuestionAsset[] | null | undefined,
): string => {
  const safeHtml = absolutizeEmbeddedImages(normalizeQuestionRichHtml(String(html || '')));
  const availableAssets = (Array.isArray(assets) ? assets : [])
    .map((asset) => ({ asset, id: getAssetId(asset), src: getAssetSource(asset) }))
    .filter((entry) => entry.id && entry.src);
  const renderedAssetIds = new Set<string>();

  const withMarkers = safeHtml.replace(/\[image:([^\]\s]+)\]/gi, (marker, rawAssetId) => {
    const assetId = String(rawAssetId || '').trim();
    const match = availableAssets.find((entry) => entry.id === assetId);
    if (!match) return marker;
    renderedAssetIds.add(match.id);
    return renderAsset(match.asset, match.src);
  });

  const unreferencedAssets = availableAssets
    .filter((entry) => !renderedAssetIds.has(entry.id))
    .sort((left, right) => Number(left.asset.order || 0) - Number(right.asset.order || 0))
    .map((entry) => renderAsset(entry.asset, entry.src))
    .join('');

  return `${withMarkers}${unreferencedAssets}`;
};
