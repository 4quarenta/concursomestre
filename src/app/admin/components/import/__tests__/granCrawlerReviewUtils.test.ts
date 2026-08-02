import { describe, expect, it } from 'vitest';
import { mergeGranReviewPayloads, partitionGranReviewPayloads } from '../granCrawlerReviewUtils';

describe('partitionGranReviewPayloads', () => {
  it('keeps unpublished questions visible and hides published questions in a separate queue', () => {
    const payload = {
      schemaVersion: 'question-import.v2',
      exam: {
        title: 'Prova Gran',
        questionRange: { start: 1, end: 80, total: 80 },
      },
      contexts: [{ tempId: 'ctx_1', questionNumbers: [1, 2] }],
      questions: [{
        tempId: 'q_1',
        source: { questionNumber: 1, contextTempId: 'ctx_1', alreadyPublished: false },
        publication: { status: 'draft' },
      }, {
        tempId: 'q_2',
        source: {
          questionNumber: 2,
          contextTempId: 'ctx_1',
          localQuestionId: 91,
          alreadyPublished: true,
          publicationStatus: 'published',
        },
        publication: { status: 'published' },
      }],
    };

    const result = partitionGranReviewPayloads([payload]);

    expect(result.pendingQuestionCount).toBe(1);
    expect(result.publishedQuestionCount).toBe(1);
    expect(result.pendingPayloads[0]?.questions.map((question) => question.tempId)).toEqual(['q_1']);
    expect(result.publishedPayloads[0]?.questions.map((question) => question.tempId)).toEqual(['q_2']);
    expect(result.pendingPayloads[0]?.contexts[0]?.questionNumbers).toEqual([1]);
    expect(result.publishedPayloads[0]?.contexts[0]?.questionNumbers).toEqual([2]);
    expect(result.pendingPayloads[0]?.exam?.questionRange).toBeUndefined();
    expect(result.publishedPayloads[0]?.exam?.questionRange).toBeUndefined();
  });

  it('does not classify an unsaved draft as already published', () => {
    const result = partitionGranReviewPayloads([{
      questions: [{
        source: { questionNumber: 8, alreadyPublished: false, publicationStatus: 'draft' },
        publication: { status: 'draft' },
      }],
      contexts: [],
    }]);

    expect(result.pendingQuestionCount).toBe(1);
    expect(result.publishedQuestionCount).toBe(0);
  });

  it('accumulates pages, removes duplicate Gran ids and stops at 5.000 cards', () => {
    const question = (id: number) => ({
      tempId: `q_${id}`,
      source: { provider: 'gran', externalId: id, questionNumber: id },
    });
    const current = [{ exam: { title: 'Prova A' }, contexts: [], questions: [question(1), question(2)] }];
    const incoming = [{ exam: { title: 'Prova B' }, contexts: [], questions: [question(2), question(3)] }];

    const merged = mergeGranReviewPayloads(current, incoming, 5000);

    expect(merged.total).toBe(3);
    expect(merged.added).toBe(1);
    expect(merged.payloads.flatMap((payload) => payload.questions).map((item) => item.tempId)).toEqual(['q_1', 'q_2', 'q_3']);

    const full = mergeGranReviewPayloads(
      [{ exam: {}, contexts: [], questions: Array.from({ length: 4999 }, (_, index) => question(index + 1)) }],
      [{ exam: {}, contexts: [], questions: [question(5000), question(5001)] }],
      5000,
    );
    expect(full.total).toBe(5000);
    expect(full.added).toBe(1);
    expect(full.limitReached).toBe(true);
  });
});
