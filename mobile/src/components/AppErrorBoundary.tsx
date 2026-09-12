import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

type BoundaryState = {
  hasError: boolean;
};

class ErrorBoundaryCore extends React.Component<React.PropsWithChildren<{ onReset: () => void }>, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ConcursoMestre] uncaught render error', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ hasError: false });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return <CrashFallback onRetry={this.reset} />;
    }

    return this.props.children;
  }
}

const CrashFallback: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => StyleSheet.create({
    screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background, padding: spacing[6] },
    card: { width: '100%', maxWidth: 520, gap: spacing[3], backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing[5] },
    title: { color: theme.text, fontSize: typography.size.xl, fontWeight: typography.weight.extrabold },
    text: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 20 },
    button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: theme.primary, paddingHorizontal: spacing[4] },
    buttonText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  }), [theme]);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>O app encontrou um problema</Text>
        <Text style={styles.text}>Seus dados de sessao permanecem protegidos. Tente recarregar esta tela.</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </Pressable>
      </View>
    </View>
  );
};

export const AppErrorBoundary: React.FC<React.PropsWithChildren<{ onReset?: () => void }>> = ({ children, onReset }) => (
  <ErrorBoundaryCore onReset={onReset || (() => undefined)}>{children}</ErrorBoundaryCore>
);
