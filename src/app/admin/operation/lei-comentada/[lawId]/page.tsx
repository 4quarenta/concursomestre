import { redirect } from 'next/navigation';

type LegacyLawEntryPageProps = {
  params: Promise<{
    lawId: string;
  }>;
};

const normalizeLawId = (lawId: string) => String(lawId || '').trim();

const LegacyLawEntryPage = async ({ params }: LegacyLawEntryPageProps) => {
  const resolvedParams = await params;
  const rawLawId = normalizeLawId(resolvedParams?.lawId || '');
  const normalizedLawId = rawLawId.toLowerCase();

  if (!rawLawId || ['new', 'novo', 'add'].includes(normalizedLawId)) {
    redirect('/admin/operation/lei-comentada/new/edit');
  }

  redirect(`/admin/operation/lei-comentada/${encodeURIComponent(rawLawId)}/edit`);
};

export default LegacyLawEntryPage;
