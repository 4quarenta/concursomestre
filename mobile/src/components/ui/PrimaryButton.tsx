import React from 'react';
import { AppButton } from '@/components/ui/Primitives';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Adaptador visual legado. Sera substituido por controle de plataforma na fase Expo UI.
 */
export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  loading = false,
  disabled = false,
}) => {
  return <AppButton label={label} onPress={onPress} loading={loading} disabled={disabled} />;
};
