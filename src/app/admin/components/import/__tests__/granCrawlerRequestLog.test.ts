import { describe, expect, it } from 'vitest';
import {
  formatSafeGranResponse,
  readGranResponseLogSummary,
  safeGranLogError,
  safeGranRequestUrl,
} from '../granCrawlerRequestLog';

describe('Gran crawler request log', () => {
  it('redacts credential-like query parameters without losing filter parameters', () => {
    const result = safeGranRequestUrl(
      'https://rota-api.grancursosonline.com.br/v1/elastic/questao?page=2&perPage=100&token=secret&anos%5B%5D=2000',
    );

    expect(result).toContain('page=2');
    expect(result).toContain('perPage=100');
    expect(result).toContain('anos%5B%5D=2000');
    expect(result).not.toContain('token=secret');
  });

  it('summarizes provider pagination and a short question sample', () => {
    const summary = readGranResponseLogSummary({
      data: {
        page: 1,
        perPage: 100,
        total: 1803,
        pages: 19,
        rows: [{ id: 42, ano: 2000, enunciado: '<p>Enunciado demonstrativo</p>', alternativas: [] }],
      },
    });

    expect(summary).toMatchObject({ returnedPage: 1, returnedPerPage: 100, total: 1803, pages: 19, rowsCount: 1 });
    expect(summary.rowKeys).toContain('alternativas');
    expect(summary.sampleQuestions[0]).toContain('id=42');
    expect(summary.sampleQuestions[0]).toContain('ano=2000');
    expect(summary.sampleQuestions[0]).toContain('Enunciado demonstrativo');
  });

  it('keeps the complete provider response while redacting credential fields', () => {
    const response = { data: { rows: [{ id: 42, content: 'full text' }] }, access_token: 'secret' };
    const formatted = formatSafeGranResponse(response);

    expect(formatted).toContain('full text');
    expect(formatted).toContain('"access_token": "[redacted]"');
    expect(formatted).not.toContain('secret');
  });

  it('redacts bearer and query credentials from logged errors', () => {
    const result = safeGranLogError('Request failed Bearer abc.def token=secret');

    expect(result).toContain('Bearer [redacted]');
    expect(result).toContain('token=[redacted]');
    expect(result).not.toContain('abc.def');
    expect(result).not.toContain('token=secret');
  });
});
