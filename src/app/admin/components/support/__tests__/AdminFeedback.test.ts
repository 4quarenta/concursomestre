import { describe, expect, it } from 'vitest';
import type { AdminFeedbackThread } from '@services/admin/adminService';
import {
  getEditorialAdminAction,
  getEffectiveFeedbackType,
  parseEditorialRequestContext,
} from '../AdminFeedback';

const makeFeedback = (overrides: Partial<AdminFeedbackThread> = {}): AdminFeedbackThread => ({
  id: 42,
  user_id: 'user-1',
  user_name: 'Aluno',
  user_email: 'aluno@example.com',
  type: 'support',
  reason: 'Solicitar comentário do professor',
  details: 'Codigo do pedido: teacher_request:11:7:block-2\nLei: Lei de exemplo',
  created_at: '2026-06-19T12:00:00Z',
  status: 'new',
  ...overrides,
});

describe('AdminFeedback editorial request classification', () => {
  it('classifies a teacher comment request and builds its admin CTA', () => {
    const feedback = makeFeedback();

    expect(getEffectiveFeedbackType(feedback)).toBe('teacher-request');
    expect(parseEditorialRequestContext(feedback)).toEqual({
      kind: 'teacher-request',
      lawId: '11',
      sectionId: '7',
      targetId: 'block-2',
    });
    expect(getEditorialAdminAction(feedback)).toEqual({
      href: '/admin/operation/lei-comentada/11/edit?supportRequest=42&sectionId=7&targetId=block-2',
      label: 'Abrir lei e comentar',
    });
  });

  it('classifies detailed analysis requests separately', () => {
    const feedback = makeFeedback({
      reason: 'Solicitar análise detalhada',
      details: 'Código do pedido: analysis_request:5:3:section',
    });

    expect(getEffectiveFeedbackType(feedback)).toBe('analysis-request');
    expect(getEditorialAdminAction(feedback)?.label).toBe('Abrir lei e analisar');
  });

  it('keeps regular support messages in the support category', () => {
    const feedback = makeFeedback({ reason: 'Ajuda com a conta', details: 'Não consigo alterar meu cadastro.' });

    expect(getEffectiveFeedbackType(feedback)).toBe('support');
    expect(getEditorialAdminAction(feedback)).toBeNull();
  });
});
