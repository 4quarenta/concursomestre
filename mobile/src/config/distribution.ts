export type DistributionChannel = 'development' | 'direct' | 'store';

const rawChannel = String(process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL || '').trim().toLowerCase();

const normalizeDistributionChannel = (value: string): DistributionChannel => {
  if (value === 'store') return 'store';
  if (value === 'direct') return 'direct';
  return __DEV__ ? 'development' : 'direct';
};

export const distributionConfig = {
  channel: normalizeDistributionChannel(rawChannel),
  isStoreBuild: normalizeDistributionChannel(rawChannel) === 'store',
  allowsExternalBillingUi: normalizeDistributionChannel(rawChannel) !== 'store',
} as const;
