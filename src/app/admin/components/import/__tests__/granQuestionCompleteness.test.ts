import { describe, expect, it } from 'vitest';
import type { Question } from '@types';
import { describeQuestionPublicationBlockers } from '../granQuestionCompleteness';

const question = (overrides: Record<string, unknown> = {}) => ({
  tipo: 'multipla escolha',
  enunciado: 'Enunciado da questão com conteúdo suficiente.',
  expectedOptionsCount: 5,
  itens: [
    { corpo: 'Alternativa A' },
    { corpo: 'Alternativa B' },
    { corpo: 'Alternativa C' },
    { corpo: 'Alternativa D' },
    { corpo: 'Alternativa E' },
  ],
  resposta: 2,
  ...overrides,
} as unknown as Question);

describe('Gran question publication blocker descriptions', () => {
  it('shows each concrete missing requirement from the canonical publication validator', () => {
    expect(describeQuestionPublicationBlockers(question({
      enunciado: '',
      tipo: 'desconhecido',
      itens: [],
      resposta: 0,
    }))).toEqual([
      'Enunciado ausente ou curto demais (são necessários pelo menos 12 caracteres).',
      'Modalidade da questão não definida; selecione o tipo da questão.',
      'Nenhuma alternativa válida foi extraída; adicione pelo menos 5.',
      'Gabarito ausente; marque a alternativa correta, ou indique se a questão foi anulada/atribuída a todos.',
    ]);
  });

  it('reports the actual and expected alternative counts', () => {
    expect(describeQuestionPublicationBlockers(question({ itens: [
      { corpo: 'Alternativa A' },
      { corpo: 'Alternativa B' },
      { corpo: 'Alternativa C' },
    ] }))).toContain('Alternativas incompletas: 3 de 5 preenchidas.');
  });

  it('does not call an existing answer key missing when its alternative was not extracted', () => {
    const blockers = describeQuestionPublicationBlockers(question({
      itens: [
        { corpo: 'Alternativa A' },
        { corpo: 'Alternativa B' },
      ],
      resposta: 0,
      correctOptionIndex: 2,
    }));

    expect(blockers).toContain('Alternativas incompletas: 2 de 5 preenchidas.');
    expect(blockers).toContain('Gabarito C informado, mas a alternativa correspondente não foi extraída ou está vazia.');
    expect(blockers).not.toContain('Gabarito ausente; marque a alternativa correta, ou indique se a questão foi anulada/atribuída a todos.');
  });

  it('accepts a valid answer index even when the legacy response field is empty', () => {
    expect(describeQuestionPublicationBlockers(question({ resposta: 0, correctOptionIndex: 2 }))).toEqual([]);
  });

  it('does not show blockers when the canonical validator considers the question ready', () => {
    expect(describeQuestionPublicationBlockers(question())).toEqual([]);
  });
});
