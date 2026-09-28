import { describe, expect, it } from 'vitest';
import { toQuestionFilterValue } from '../adminImportWorkflowPublicationCore';

describe('Gran taxonomy identity through the review editor', () => {
  it.each(['area', 'carreira'])('preserves the %s namespace instead of reducing identity to an external ID', (sourceEntityType) => {
    expect(toQuestionFilterValue({
      name: 'Educacao', provider: 'gran', externalId: 7, sourceEntityType,
    })).toMatchObject({ label: 'Educacao', provider: 'gran', externalId: 7, sourceEntityType });
  });
});
