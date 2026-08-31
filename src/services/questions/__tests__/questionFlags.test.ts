import { describe, expect, it } from 'vitest';
import type { Question } from 'types';
import { isPlatformOriginalQuestion, isQuestionCanceled, readQuestionBooleanFlag } from '../questionFlags';

const makeQuestion = (patch: Record<string, unknown> = {}) => ({
  enunciado: 'Enunciado',
  bancas: [],
  orgaos: [],
  cargos: [],
  assuntos: [],
  anos: [],
  tipo: 'multipla escolha',
  dificuldade: 1,
  itens: [],
  resposta: 1,
  ...patch,
} as unknown as Question);

describe('question flags', () => {
  it('does not treat backend string false values as canceled questions', () => {
    expect(isQuestionCanceled(makeQuestion({ anulada: '0' }))).toBe(false);
    expect(isQuestionCanceled(makeQuestion({ isCanceled: 'false' }))).toBe(false);
  });

  it('recognizes common true values for canceled questions', () => {
    expect(isQuestionCanceled(makeQuestion({ anulada: 1 }))).toBe(true);
    expect(isQuestionCanceled(makeQuestion({ isCanceled: 'true' }))).toBe(true);
  });

  it('recognizes platform original questions without false positives from string zero', () => {
    expect(isPlatformOriginalQuestion(makeQuestion({ questionOrigin: 'platform' }))).toBe(true);
    expect(isPlatformOriginalQuestion(makeQuestion({ inedita: '1' }))).toBe(true);
    expect(isPlatformOriginalQuestion(makeQuestion({ questionOrigin: 'exam', inedita: '0' }))).toBe(false);
  });

  it('normalizes boolean-like values from APIs and forms', () => {
    expect(readQuestionBooleanFlag('sim')).toBe(true);
    expect(readQuestionBooleanFlag('nao')).toBe(false);
    expect(readQuestionBooleanFlag(0)).toBe(false);
    expect(readQuestionBooleanFlag(1)).toBe(true);
  });
});
