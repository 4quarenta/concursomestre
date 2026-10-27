import { describe, expect, it } from 'vitest';
import { queueDiagnostic, type CmBatchQueueItem } from './cmBatchDiagnostics';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CmBatchQueueDiagnostics from './CmBatchQueueDiagnostics';

const item: CmBatchQueueItem = { id: 1, entityType: 'question', externalKey: 'exam:q1', action: 'enrich', status: 'blocked', canonicalId: '42', attempts: 1, diagnostics: {} };
describe('CM Batch queue diagnostics', () => {
  it('renders blocked and pending items even when there are no failures', () => {
    const html = renderToStaticMarkup(createElement(CmBatchQueueDiagnostics, {
      items: [{ ...item, diagnostics: { message: 'Filtro canonico ausente ou ambiguo: examBoards / NCE' } }, { ...item, id: 2, status: 'planned', externalKey: 'exam:q2' }],
      exams: [{ externalKey: 'exam', metadata: { examTitle: 'Prova de teste' } }],
      questions: [{ examExternalKey: 'exam', tempId: 'q1', externalQuestionId: '12345', questionNumber: 12 }],
    }));
    expect(html).toContain('NCE');
    expect(html).toContain('Aguardando processamento');
    expect(html).toContain('12345');
    expect(html).toContain('Prova de teste');
    expect(html).toContain('Ver diagnóstico técnico');
  });
  it('shows the recorded block message, not just a generic error code', () => {
    const result = queueDiagnostic({ ...item, diagnostics: { code: 'item_rejected', message: 'Filtro canonico ausente ou ambiguo: examBoards / NCE' } });
    expect(result.message).toContain('NCE');
    expect(result.nextStep).toContain('hierarquia');
  });
  it('reads reasons saved by the dry run and preserves their technical code', () => {
    const result = queueDiagnostic({ ...item, diagnostics: { reason: 'gran_external_id_content_conflict' } });
    expect(result.message).toContain('ID Gran');
    expect(result.technical).toBe('gran_external_id_content_conflict');
  });
  it('does not present an unprocessed item as a failure', () => {
    const result = queueDiagnostic({ ...item, status: 'planned', attempts: 0, diagnostics: { reason: 'create_as_private_draft_review_required' } });
    expect(result.message).toBe('Aguardando processamento na fila.');
  });
  it('explains missing diagnostics and dependency blocks honestly', () => {
    expect(queueDiagnostic(item).message).toContain('não registrou');
    expect(queueDiagnostic({ ...item, diagnostics: { message: 'Prova ainda nao foi materializada; o checkpoint da prova precisa concluir primeiro.' } }).nextStep).toContain('prova de origem');
  });
});
