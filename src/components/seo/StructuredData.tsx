import { serializeStructuredData } from '@services/seo/structuredData';

export default function StructuredData({ value }: { value: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeStructuredData(value) }}
    />
  );
}
