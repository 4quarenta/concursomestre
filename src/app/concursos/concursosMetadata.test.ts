import { describe, expect, it } from 'vitest';
import { generateMetadata } from './page';
import { generateMetadata as generateOpenMetadata } from '../concursos-abertos/page';
import { buildContestMetadata, contestDescription, contestMetadataTitle } from './contestMetadata';
import type { PublicContest } from './contestServerData';

const contest = {
  id: 1, slug: 'concurso-canonico', title: 'Concurso Canônico', description: null, isOpen: false,
  status: 'completed', year: 2025, officialUrl: null, dates: {}, organizations: [], board: null,
  positions: [], documents: [], exams: [], questions: [], questionCount: 0,
  canonicalPath: '/concursos/concurso-canonico', breadcrumbs: [], updatedAt: null,
} satisfies PublicContest;

describe('/concursos metadata', () => {
  it('keeps the canonical contest hub NOINDEX in PRELAUNCH', async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(metadata.alternates?.canonical).toBe('/concursos');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it('keeps hub filters on the clean canonical and NOINDEX', async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ busca: 'federal', foo: 'bar' } as never) });
    expect(metadata.alternates?.canonical).toBe('/concursos');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });

    const emptyUnknown = await generateMetadata({ searchParams: Promise.resolve({ foo: '' } as never) });
    expect(emptyUnknown.alternates?.canonical).toBe('/concursos');
    expect(emptyUnknown.robots).toMatchObject({ index: false, follow: true });
  });

  it('gives open contests its own canonical identity', async () => {
    const metadata = await generateOpenMetadata({ searchParams: Promise.resolve({}) });
    expect(metadata.alternates?.canonical).toBe('/concursos-abertos');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });

    const emptySearch = await generateOpenMetadata({ searchParams: Promise.resolve({ busca: '' }) });
    expect(emptySearch.alternates?.canonical).toBe('/concursos-abertos');
    expect(emptySearch.robots).toMatchObject({ index: false, follow: true });
  });

  it('uses the persisted detail canonical and omits canonical for missing entities', () => {
    const valid = buildContestMetadata(contest);
    expect(valid.alternates?.canonical).toBe('/concursos/concurso-canonico');
    expect(valid.robots).toMatchObject({ index: false, follow: true });
    expect(buildContestMetadata(null).alternates?.canonical).toBeNull();
  });

  it('does not claim open registrations when the factual date rule failed', () => {
    const description = contestDescription({ ...contest, status: 'registration_open', isOpen: false });
    expect(description).not.toContain('inscrições abertas');
    expect(description).toContain('fora da janela de inscrições');
  });

  it('distinguishes common same-name contests with factual context', () => {
    const organization = [{ id: 2, slug: 'policia-federal', name: 'Polícia Federal', acronym: 'PF', path: '/orgaos/policia-federal' }];
    expect(contestMetadataTitle({ ...contest, title: 'Concurso Polícia Federal', year: 2025, organizations: organization })).toBe('Concurso Polícia Federal - 2025, PF');
    expect(contestMetadataTitle({ ...contest, title: 'Concurso Polícia Federal', year: 2026, organizations: organization })).toBe('Concurso Polícia Federal - 2026, PF');
    expect(contestMetadataTitle({ ...contest, title: 'Concurso PF 2026', year: 2026, organizations: organization })).toBe('Concurso PF 2026');
  });
});
