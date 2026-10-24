import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getOfficialExamProgram, OfficialExamProgramSection } from '../provas/officialExamProgram';

const biologyExamSlug = 'fundatec-ifc-professor-do-ensino-basico-tecnico-e-tecnologico-area-biologia-2023';

describe('official exam program', () => {
  it('keeps the IFC Biology program tied to the official edital and its exam structure', () => {
    const program = getOfficialExamProgram(biologyExamSlug);

    expect(program?.subjects.map(({ name, questionCount, weight }) => [name, questionCount, weight])).toEqual([
      ['Língua Portuguesa', 10, '1,60 ponto por questão'],
      ['Legislação', 10, '1,60 ponto por questão'],
      ['Conhecimentos Específicos · Biologia', 40, '1,70 ponto por questão'],
    ]);
    expect(program?.sourceUrl).toContain('edital-d9c5a901b3a1be9b20e6.pdf#page=47');
    expect(program?.subjects.every(({ topics }) => topics.length > 0)).toBe(true);
  });

  it('renders a searchable-by-browser, expandable program only for the curated exam', () => {
    const html = renderToStaticMarkup(<OfficialExamProgramSection slug={biologyExamSlug} />);

    expect(html).toContain('Conteúdo programático');
    expect(html).toContain('Bioquímica: compostos inorgânicos e orgânicos.');
    expect(html).toContain('>40</strong> questões');
    expect(html).toContain('Anexos VI e VII');
    expect(renderToStaticMarkup(<OfficialExamProgramSection slug="another-exam" />)).toBe('');
  });
});
