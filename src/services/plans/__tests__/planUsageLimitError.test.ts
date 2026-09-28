import { describe, expect, it } from 'vitest';
import { getPlanUsageLimitKeyFromError } from '../planUsageLimitError';

describe('getPlanUsageLimitKeyFromError', () => {
  it('recognizes the canonical server-side daily question limit response', () => {
    expect(getPlanUsageLimitKeyFromError({
      response: {
        data: {
          message: 'Limite de questoes por dia atingido para o seu plano. Disponivel no Plano Elite ou superior.',
        },
      },
    })).toBe('questions_per_day');
  });

  it('recognizes simulation quotas without mistaking unrelated request failures', () => {
    expect(getPlanUsageLimitKeyFromError(new Error('Limite de simulados por mês atingido.'))).toBe('simulations_per_month');
    expect(getPlanUsageLimitKeyFromError(new Error('Falha interna ao salvar resposta.'))).toBeNull();
  });
});
