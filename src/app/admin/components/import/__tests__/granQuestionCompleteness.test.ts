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

  it('does not show blockers when the canonical validator considers the question ready', () => {
    expect(describeQuestionPublicationBlockers(question())).toEqual([]);
  });
});
