import type { Metadata } from 'next';
import { buildPublicPageMetadata } from '../seoMetadata';

export const buildUnpromotedBlogTaxonomyMetadata = ({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata => ({
  ...buildPublicPageMetadata({ title, description, path }),
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
});
