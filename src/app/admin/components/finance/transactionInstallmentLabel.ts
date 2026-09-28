export type InstallmentLabelInput = {
  installmentNumber?: number;
  installmentCount?: number;
  isRevenueProjection?: boolean;
  transactionStatus?: string;
};

export const getTransactionInstallmentLabel = ({
  installmentNumber,
  installmentCount,
  isRevenueProjection = false,
  transactionStatus = '',
}: InstallmentLabelInput): string | null => {
  const number = Number(installmentNumber || 0);
  const count = Number(installmentCount || 0);

  if (!Number.isInteger(number) || !Number.isInteger(count) || number < 1 || count < number) {
    return null;
  }

  const prefix = isRevenueProjection
    ? 'Parcela futura'
    : ['approved', 'completed'].includes(transactionStatus.trim().toLowerCase())
      ? 'Parcela paga'
      : 'Parcela';

  return `${prefix} ${number} de ${count}`;
};
