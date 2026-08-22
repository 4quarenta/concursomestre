import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serializeStructuredData } from '@services/seo/structuredData';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('blog editorial experience', () => {
  it('uses the same commercial footer as the homepage throughout the blog', () => {
    const blogLayout = readSource('src/app/blog/layout.tsx');
    const landing = readSource('src/app/landing/components/LandingCommercialPage.tsx');
    const footer = readSource('src/app/landing/components/LandingCommercialFooter.tsx');

    expect(blogLayout).toContain('LandingCommercialFooter');
    expect(landing).toContain('export const Footer = LandingCommercialFooter');
    expect(footer).toContain("{ label: 'Disciplinas', href: '/disciplinas' }");
    expect(footer).toContain("{ label: 'Bancas', href: '/bancas' }");
    expect(footer).toContain("{ label: 'Blog', href: '/blog' }");
  });

  it('uses contextual conversion CTAs for anonymous, free and subscribed readers', () => {
    const source = readSource('src/app/blog/BlogConversionCta.tsx');
    expect(source).toContain('hasActivePlanAccess');
    expect(source).toContain("'/auth?mode=signup'");
    expect(source).toContain("'/plans'");
    expect(source).toContain('publicRoutes.questions.index()');
  });

  it('exposes navigable tags and regional discovery on public pages', () => {
    const home = readSource('src/app/blog/page.tsx');
    const detail = readSource('src/app/blog/[slug]/page.tsx');
    const tagPage = readSource('src/app/blog/tag/[slug]/page.tsx');
    expect(home).toContain('Notícias por região');
    expect(home).toContain('/blog/tag/');
    expect(detail).toContain('href={publicRoutes.blog.tag(tag.slug)}');
    expect(tagPage).toContain("fetchBlogTaxonomyArchiveForServer('tag', slug");
  });

  it('uses the shared taxonomy selector for categories and tags in the editor', () => {
    const editor = readSource('src/app/admin/operation/blog/[articleId]/edit/page.tsx');
    expect(editor).toContain('label="Categoria"');
    expect(editor).toContain('label="Tags editoriais"');
    expect(editor).toContain('BLOG_TAG_KINDS');
    expect(editor).not.toContain('tagInput');
  });

  it('serializes hostile taxonomy and article text without an executable script boundary', () => {
    const serialized = serializeStructuredData({
      name: '</script><script>globalThis.__BLOG_XSS__=true</script>',
      description: '<img src=x onerror=globalThis.__BLOG_XSS__>',
      author: '" onmouseover="globalThis.__BLOG_XSS__=true',
    });
    expect(serialized).not.toContain('</script>');
    expect(serialized).not.toContain('<script>');
    expect(serialized).toContain('\\u003c/script\\u003e');
  });
});
