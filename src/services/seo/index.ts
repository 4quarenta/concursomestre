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

export { applyDocumentSeo, useDocumentSeo } from './documentSeo';
export {
  buildAbsoluteUrl,
  buildMaterialPath,
  buildMaterialSlug,
  buildQuestionPath,
  buildQuestionSlug,
  buildRankingPath,
  buildRankingSlug,
  getQuestionSeoLabel,
  slugifyContent,
  summarizeSeoText,
} from './slug';
export { seoService } from './seoService';
export { buildBoardPath } from './taxonomyPaths';
export type { DocumentSeoPayload } from './documentSeo';
export type { SitemapStatusPayload } from './seoService';
