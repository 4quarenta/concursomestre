import Link from 'next/link';
import type { PublicInformationSection } from '../publicInformationContent';

type PublicInformationLink = {
  href: string;
  label: string;
};

type PublicInformationSeoSnapshotProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: PublicInformationSection[];
  links?: PublicInformationLink[];
  structuredData?: Record<string, unknown>;
};

const serializeStructuredData = (value: Record<string, unknown>): string => (
  JSON.stringify(value).replace(/</g, '\\u003c')
);

export default function PublicInformationSeoSnapshot({
  eyebrow,
  title,
  description,
  sections,
  links = [],
  structuredData,
}: PublicInformationSeoSnapshotProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }}
        />
      ) : null}
      <article className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">{eyebrow}</p>
          <h1 className="text-4xl font-bold">{title}</h1>
          <p className="max-w-3xl text-lg leading-8 text-slate-600">{description}</p>
        </header>

        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-3 text-base leading-7 text-slate-700">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              {section.items?.length ? (
                <ul className="mt-4 list-disc space-y-2 pl-6 text-slate-700">
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {links.length ? (
          <nav aria-label="Links relacionados" className="flex flex-wrap gap-3">
            {links.map((link) => (
              <Link key={link.href} href={link.href} prefetch={false} className="font-semibold text-indigo-700 underline">
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </article>
    </main>
  );
}
