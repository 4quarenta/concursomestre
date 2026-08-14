import { describe, expect, it } from 'vitest';
import type { Question } from '@types';
import { resolvePublicQuestionRouteFromQuestion } from './questionServerResolver';

const asQuestion = (value: Record<string, unknown>) => value as unknown as Question;

describe('questionServerResolver', () => {
  it('uses the normative slug contract for the canonical route', () => {
    const resolution = resolvePublicQuestionRouteFromQuestion(asQuestion({
      id: 123,
      enunciado: '<p>Art. 5º — Ação & Controle</p>',
    }));

    expect(resolution.futureSlug).toBe('art-5o-acao-e-controle');
    expect(resolution.futurePath).toBe('/questoes/123/art-5o-acao-e-controle');
  });

  it('uses a stable fallback when the statement has no usable content', () => {
    const resolution = resolvePublicQuestionRouteFromQuestion(asQuestion({ id: 67813, enunciado: '<img src="/imagem.png">' }));
    expect(resolution.futurePath).toBe('/questoes/67813/questao-67813');
  });

  it('records shadow canonical agreement and divergence without applying it', () => {
    const matching = resolvePublicQuestionRouteFromQuestion(asQuestion({
      id: 8,
      enunciado: 'Direito Administrativo',
      seoDecision: { canonical: { path: '/questoes/8/direito-administrativo' } },
    }));
    const divergent = resolvePublicQuestionRouteFromQuestion(asQuestion({
      id: 8,
      enunciado: 'Direito Administrativo',
      seoDecision: { canonical: { path: '/questoes/8/questao-8' } },
    }));

    expect(matching.shadowCanonicalMatchesFutureRoute).toBe(true);
    expect(divergent.shadowCanonicalMatchesFutureRoute).toBe(false);
    expect(divergent.futurePath).toBe('/questoes/8/direito-administrativo');
  });

  it('truncates long labels at the normative word boundary', () => {
    const resolution = resolvePublicQuestionRouteFromQuestion(asQuestion({
      id: 99,
      enunciado: 'Esta questão possui um enunciado propositalmente muito extenso para validar a divergência real causada pelo corte normativo em limite de palavra',
    }));
    expect(resolution.futureSlug.length).toBeLessThanOrEqual(80);
    expect(resolution.futureSlug.endsWith('-')).toBe(false);
  });

  it('preserves angle-bracket text that is not an HTML tag', () => {
    const resolution = resolvePublicQuestionRouteFromQuestion(asQuestion({
      id: 269,
      enunciado_clean: 'Elementos (< e >) exemplos',
    }));

    expect(resolution.futurePath).toBe('/questoes/269/elementos-e-exemplos');
  });
});
