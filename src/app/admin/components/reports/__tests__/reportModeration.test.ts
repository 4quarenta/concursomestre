import { describe, expect, it } from 'vitest';

import { groupPendingReports } from '../reportModeration';
import type { ErrorReport } from '@services/admin/adminService';

const makeReport = (overrides: Partial<ErrorReport>): ErrorReport => ({
  id: 'rep-1',
  targetType: 'question',
  questionId: 10,
  reason: 'Erro de digitação',
  details: 'Texto com erro.',
  status: 'pending',
  timestamp: 1,
  userName: 'Aluno',
  userEmail: 'aluno@example.com',
  ...overrides,
});

describe('groupPendingReports', () => {
  it('groups reports only when target and reason match', () => {
    const groups = groupPendingReports([
      makeReport({ id: 'rep-1', questionId: 10, reason: 'Erro de digitação', timestamp: 1 }),
      makeReport({ id: 'rep-2', questionId: 10, reason: 'Erro de digitacao', timestamp: 2 }),
      makeReport({ id: 'rep-3', questionId: 10, reason: 'Desatualizada / Anulada', timestamp: 3 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.reports).map((reports) => reports.map((report) => report.id))).toEqual([
      ['rep-1', 'rep-2'],
      ['rep-3'],
    ]);
  });

  it('keeps same reason separated by different targets', () => {
    const groups = groupPendingReports([
      makeReport({ id: 'rep-1', questionId: 10, reason: 'Erro' }),
      makeReport({ id: 'rep-2', questionId: 11, reason: 'Erro' }),
    ]);

    expect(groups).toHaveLength(2);
  });
});
