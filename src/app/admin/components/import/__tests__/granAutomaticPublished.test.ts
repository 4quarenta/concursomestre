import { describe, expect, it } from 'vitest';
import { countGranPublishedYear, recordGranPublishedBatch } from '../granAutomaticPublished';

describe('Gran confirmed cycle publications', () => {
  it('counts confirmed creations once per batch, including repeated polling and resume', () => {
    let ledger = { runKey: 'run', batches: {} };
    ledger = recordGranPublishedBatch(ledger, 'run', 'one', 2004, 12);
    ledger = recordGranPublishedBatch(ledger, 'run', 'one', 2004, 12);
    ledger = recordGranPublishedBatch(JSON.parse(JSON.stringify(ledger)), 'run', 'one', 2004, 10);
    ledger = recordGranPublishedBatch(ledger, 'run', 'two', 2004, 3);
    ledger = recordGranPublishedBatch(ledger, 'run', 'three', 2005, 4);
    expect(countGranPublishedYear(ledger, 2004)).toBe(15);
    expect(countGranPublishedYear(ledger, 2005)).toBe(4);
  });
  it('does not carry another cycle or count an all-duplicate batch', () => {
    let ledger = recordGranPublishedBatch({ runKey: '', batches: {} }, 'old', 'one', 2004, 100);
    ledger = recordGranPublishedBatch(ledger, 'new', 'two', 2004, 0);
    expect(countGranPublishedYear(ledger, 2004)).toBe(0);
  });
});
