import { describe, expect, it } from 'vitest';
import { validateGranQuestionYearFilter } from '../granCrawlerResponseValidation';

describe('Gran response year validation', () => {
  it('accepts questions with the requested year among multiple exam years', () => {
    expect(validateGranQuestionYearFilter({
      data: { rows: [{ id: 1, anos: [2017, 1998] }] },
    }, '1998')).toEqual({
      valid: true,
      rowCount: 1,
      rowsWithYear: 1,
      mismatchedRows: 0,
    });
  });

  it('rejects a page returned with years outside the selected filter', () => {
    expect(validateGranQuestionYearFilter({
      data: { rows: [{ id: 1, ano: 2012 }, { id: 2, provas: [{ prova: { ano: 2008 } }] }] },
    }, '1998')).toEqual({
      valid: false,
      rowCount: 2,
      rowsWithYear: 2,
      mismatchedRows: 2,
    });
  });

  it('accepts an empty page and unfiltered responses', () => {
    expect(validateGranQuestionYearFilter({ data: { rows: [] } }, '1998').valid).toBe(true);
    expect(validateGranQuestionYearFilter({ data: { rows: [{ id: 1 }] } }, '').valid).toBe(true);
  });
});

