import { describe, expect, it } from 'vitest';
import {
  getLegacyTaxonomyKey,
  getLegacyTaxonomyName,
  getTaxonomyKeyFromFailureCode,
} from './granCrawlerFailureUtils';

describe('Gran publication taxonomy failure helpers', () => {
  it('recognizes only supported taxonomy categories in canonical failure codes', () => {
    expect(getTaxonomyKeyFromFailureCode('gran_taxonomy_not_synced_orgao')).toBe('orgao');
    expect(getTaxonomyKeyFromFailureCode('gran_taxonomy_not_synced_unknown')).toBeNull();
    expect(getTaxonomyKeyFromFailureCode('import_contract_invalid')).toBeNull();
  });

  it('extracts only the known legacy unsynchronized-taxonomy message', () => {
    expect(getLegacyTaxonomyName('A taxonomia Gran "Educação" ainda nao foi sincronizada. Sincronize antes.'))
      .toBe('Educação');
    expect(getLegacyTaxonomyName('A taxonomia Gran "Educação" ainda não foi sincronizada. Sincronize antes.'))
      .toBe('Educação');
    expect(getLegacyTaxonomyName('Nao foi possivel persistir este item.')).toBeNull();
  });

  it('maps legacy failure names to their canonical Gran category', () => {
    const payload = {
      filters: {
        organizations: [{ label: 'Educação', provider: 'gran', externalId: '506' }],
      },
    };
    expect(getLegacyTaxonomyKey(payload, 'Educação')).toBe('orgao');
    expect(getLegacyTaxonomyKey(payload, 'Saúde')).toBeNull();
    expect(getLegacyTaxonomyKey({ filters: { organizations: [{ label: 'Educação' }] } }, 'Educação'))
      .toBeNull();
    expect(getLegacyTaxonomyKey({ filters: { organizations: ['Educação'], careers: ['Educação'] } }, 'Educação'))
      .toBeNull();
  });

  it('finds taxonomy inside the persisted single-question failure payload', () => {
    const payload = {
      schemaVersion: 'question-import.v2',
      questions: [{
        filters: {
          organizations: [{ label: 'Educação (Professores, Especialistas e outros)', provider: 'gran', externalId: '506' }],
        },
      }],
    };
    expect(getLegacyTaxonomyKey(payload, 'Educação (Professores, Especialistas e outros)')).toBe('orgao');
  });
});
