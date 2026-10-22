import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const practice = readFileSync(resolve(process.cwd(), 'src/app/practice/PracticeClient.tsx'), 'utf8');
const questionCard = readFileSync(resolve(process.cwd(), 'src/app/questions/components/QuestionCard.tsx'), 'utf8');
const studyWidget = readFileSync(resolve(process.cwd(), 'src/components/shared/feedback/StudySessionWidget.tsx'), 'utf8');

describe('question practice presentation controls', () => {
  it('provides the result toolbar and full-width mobile question surface', () => {
    expect(practice).toContain('questões encontradas');
    expect(practice).toContain('Imprimir questões');
    expect(practice).toContain('10 por página');
    expect(practice).toContain('-mx-3 w-[calc(100%+1.5rem)]');
  });

  it('uses compact options and numbered pagination without previous/next labels', () => {
    expect(questionCard).toContain('p-2.5 sm:p-3');
    const start = practice.indexOf('<nav aria-label="Paginação das questões"');
    const end = practice.indexOf('</nav>', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(practice.slice(start, end)).not.toContain('Anterior');
    expect(practice.slice(start, end)).not.toContain('Próxima</');
    expect(practice.slice(start, end)).toContain('pageHref(page, cursor, previous)');
  });

  it('keeps the collapsed study timer subdued until interaction', () => {
    expect(studyWidget).toContain('opacity-35');
    expect(studyWidget).toContain('hover:opacity-100 focus-visible:opacity-100');
  });
});
