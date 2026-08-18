import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateMetadata as generateExamMetadata } from '../provas/page';
import { generateMetadata as generateQuestionMetadata } from '../questoes/page';

const robotsIndex = (robots: Awaited<ReturnType<typeof generateQuestionMetadata>>['robots']) => (
  typeof robots === 'object' && robots !== null ? robots.index : undefined
);

describe('Phase 2 public collection metadata', () => {
  beforeEach(() => vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION'));
  afterEach(() => vi.unstubAllEnvs());

  it('keeps the clean questions hub indexable and strips tracking from canonical', async () => {
    const metadata = await generateQuestionMetadata({
      searchParams: Promise.resolve({ utm_source: 'newsletter' }),
    });

    expect(metadata.alternates?.canonical).toBe('/questoes');
    expect(robotsIndex(metadata.robots)).not.toBe(false);
  });

  it('marks question facets and UI state noindex with a clean hub canonical', async () => {
    const metadata = await generateQuestionMetadata({
      searchParams: Promise.resolve({ materia: 'direito', view: 'lista' }),
    });

    expect(metadata.alternates?.canonical).toBe('/questoes');
    expect(robotsIndex(metadata.robots)).toBe(false);
  });

  it('uses a self canonical for unfiltered exam pagination', async () => {
    const metadata = await generateExamMetadata({
      searchParams: Promise.resolve({ pagina: '2' }),
    });

    expect(metadata.alternates?.canonical).toBe('/provas?pagina=2');
    expect(robotsIndex(metadata.robots)).toBe(true);
  });

  it('marks exam facets noindex and points them to the clean hub', async () => {
    const metadata = await generateExamMetadata({
      searchParams: Promise.resolve({ ano: '2026', pagina: '2' }),
    });

    expect(metadata.alternates?.canonical).toBe('/provas');
    expect(robotsIndex(metadata.robots)).toBe(false);
  });
});
