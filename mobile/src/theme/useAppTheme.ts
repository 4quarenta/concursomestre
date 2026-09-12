import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme } from '@/theme/tokens';

/**
 * Tema semantico do ConcursoMestre seguindo a preferencia do sistema.
 * Novos componentes devem preferir este hook em vez do adaptador `colors` legado.
 */
export const useAppTheme = () => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkTheme : lightTheme;
};

export type ResolvedAppTheme = ReturnType<typeof useAppTheme>;
