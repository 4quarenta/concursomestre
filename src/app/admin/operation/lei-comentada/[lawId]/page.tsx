import { redirect } from 'next/navigation';

type LegacyLawEntryPageProps = {
  params: {
    lawId: string;
  };
};

const normalizeLawId = (lawId: string) => String(lawId || '').trim();

const LegacyLawEntryPage = ({ params }: LegacyLawEntryPageProps) => {
  const rawLawId = normalizeLawId(params?.lawId || '');
  const normalizedLawId = rawLawId.toLowerCase();

  if (!rawLawId || ['new', 'novo', 'add'].includes(normalizedLawId)) {
    redirect('/admin/operation/lei-comentada/new/edit');
  }

  redirect(`/admin/operation/lei-comentada/${encodeURIComponent(rawLawId)}/edit`);
};

export default LegacyLawEntryPage;
