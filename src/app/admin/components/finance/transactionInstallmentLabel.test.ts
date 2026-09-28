import { describe, expect, it } from 'vitest';
import { getTransactionInstallmentLabel } from './transactionInstallmentLabel';

describe('getTransactionInstallmentLabel', () => {
  it('labels an approved real invoice as paid, not future', () => {
    expect(getTransactionInstallmentLabel({
      installmentNumber: 1,
      installmentCount: 2,
      transactionStatus: 'approved',
    })).toBe('Parcela paga 1 de 2');
  });

  it('keeps future wording only for projected installments', () => {
    expect(getTransactionInstallmentLabel({
      installmentNumber: 2,
      installmentCount: 2,
      isRevenueProjection: true,
      transactionStatus: 'pre-approved',
    })).toBe('Parcela futura 2 de 2');
  });

  it('does not describe a real pending invoice as future or paid', () => {
    expect(getTransactionInstallmentLabel({
      installmentNumber: 1,
      installmentCount: 2,
      transactionStatus: 'pending',
    })).toBe('Parcela 1 de 2');
  });

  it('omits incomplete or inconsistent installment metadata', () => {
    expect(getTransactionInstallmentLabel({ installmentNumber: 1 })).toBeNull();
    expect(getTransactionInstallmentLabel({ installmentNumber: 3, installmentCount: 2 })).toBeNull();
  });
});
