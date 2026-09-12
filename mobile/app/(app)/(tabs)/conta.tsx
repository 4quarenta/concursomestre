import { AccountScreen } from '@/features/account/screens/AccountScreen';
import { StoreAccountScreen } from '@/features/account/screens/StoreAccountScreen';

const AccountTab = process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL === 'store'
  ? StoreAccountScreen
  : AccountScreen;

export default AccountTab;
