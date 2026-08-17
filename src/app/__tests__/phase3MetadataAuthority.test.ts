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

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildNoIndexMetadata } from '../seoMetadata';
import { buildQuestionMetadata } from '../question/questionPageMetadata';

const source = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Phase 3 metadata authority', () => {
  it('emits no canonical and noindex metadata for not-found resources', () => {
    const metadata = buildNoIndexMetadata({ title: 'Nao encontrada' });

    expect(metadata.alternates?.canonical).toBeNull();
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    });
  });

  it('uses the same safe metadata for a missing question', () => {
    const metadata = buildQuestionMetadata(null);

    expect(metadata.alternates?.canonical).toBeNull();
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('keeps the platform provider from mutating server metadata', () => {
    const provider = source('src/providers/PlatformMetadataProvider.tsx');

    expect(provider).not.toContain('applyWebsiteMetadata');
    expect(provider).not.toContain('useEffect');
    expect(provider).not.toContain('document.');
  });

  it('removes client metadata authority from the SSR question route', () => {
    const questionPage = source('src/app/question/QuestionPublicPage.tsx');

    expect(questionPage).not.toContain('useDocumentSeo');
    expect(questionPage).not.toContain('summarizeSeoText');
  });

  it('does not reset canonical metadata to the home page during CSR cleanup', () => {
    const documentSeo = source('src/services/seo/documentSeo.ts');

    expect(documentSeo).toContain('data-document-seo-created');
    expect(documentSeo).not.toContain('window.location.origin');
    expect(documentSeo).not.toContain('applyWebsiteMetadata');
  });

  it('shares the memoized public settings load between root metadata and home SSR', () => {
    const layout = source('src/app/layout.tsx');
    const home = source('src/app/page.tsx');
    const settingsLoader = source('src/app/publicMarketingSettings.ts');

    expect(layout).toContain('fetchPublicMarketingSettings');
    expect(home).toContain('fetchPublicMarketingSettings');
    expect(settingsLoader).toContain("import { cache } from 'react'");
    expect(settingsLoader).toContain('resolvePersistedSystemSettings');
    expect(layout).not.toContain("new URL('settings.php'");
    expect(home).not.toContain("new URL('settings.php'");
  });

  it('keeps migrated route semantics in the real page without a parallel SEO route', () => {
    const practice = source('src/app/practice/PracticePage.tsx');
    const plans = source('src/app/planos/page.tsx');
    const lawHub = source('src/app/lei-comentada/page.tsx');
    const lawDetail = source('src/app/lei-comentada/[slug]/page.tsx');
    const rootLayout = source('src/app/layout.tsx');

    expect(practice).toContain('data-practice-semantic-header');
    expect(practice).toContain("'@type': 'CollectionPage'");
    expect(plans).toContain("'@type': 'WebPage'");
    expect(lawHub).toContain('fetchLegalCommentaryModuleAvailability');
    expect(lawDetail).toContain('fetchLegalCommentaryModuleAvailability');
    expect(() => source('src/app/@seo/default.tsx')).toThrow();
    expect(rootLayout).not.toContain('data-server-seo-shell');
    expect(rootLayout).not.toContain('ClientHydrationMarker');
    expect(rootLayout).not.toContain('suppressHydrationWarning');
  });

  it('does not repeat migrated server headings inside client islands', () => {
    const plansClient = source('src/app/planos/components/MarketingPlansLandingPage.tsx');
    const lawHubClient = source('src/app/lei-comentada/LegalCommentaryClient.tsx');
    const lawDetailClient = source('src/app/lei-comentada/[slug]/LawDetailClient.tsx');

    expect(plansClient).toContain('{!semanticHeadingRendered ? (');
    expect(lawHubClient).toContain('{!semanticHeaderRendered ? <div>');
    expect(lawDetailClient).toContain('{!semanticHeaderRendered ? <div className="flex flex-wrap items-center');
    expect(plansClient).not.toMatch(/semanticHeadingRendered \? \(\s*<h2[^>]*>\s*\{landingPage\.hero\.title\}/);
    expect(lawHubClient).not.toMatch(/semanticHeaderRendered \? \(\s*<h2[^>]*>Lei comentada/);
    expect(lawDetailClient).not.toMatch(/semanticHeaderRendered \? \(\s*<h2/);
  });

  it('keeps footer gates and question structured data stable across hydration', () => {
    const footer = source('src/components/shared/layout/Footer.tsx');
    const questionRoute = source('src/app/questoes/[id]/[[...slug]]/page.tsx');
    const questionClient = source('src/app/question/QuestionPublicPage.tsx');

    expect(footer).toContain('useEffectiveSystemSettings');
    expect(footer).not.toContain('useAppConfigStore');
    expect(questionRoute).toContain('canonicalUrl={buildAbsoluteUrl(resolution.futurePath)}');
    expect(questionClient).toContain('canonicalUrl || buildAbsoluteUrl');
  });
});
