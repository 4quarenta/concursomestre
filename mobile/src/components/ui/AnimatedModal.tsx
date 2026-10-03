import React from "react";
import {
  Animated,
  Easing,
  Modal as NativeModal,
  type ModalProps,
  useWindowDimensions,
} from "react-native";

type AnimatedModalProps = Pick<ModalProps, "onRequestClose" | "presentationStyle" | "statusBarTranslucent" | "transparent"> & {
  visible: boolean;
  mode?: "sheet" | "fade";
  children: React.ReactNode;
};

/**
 * Gives Android modals a deterministic entrance/exit duration rather than the
 * very short platform-window transition. The content is mounted first, then
 * animated on the next frame to avoid revealing it in its final position.
 */
export function AnimatedModal({
  visible,
  mode = "sheet",
  children,
  ...modalProps
}: AnimatedModalProps) {
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = React.useState(visible);
  const progress = React.useRef(new Animated.Value(0)).current;
  const animation = React.useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    let frame: number | null = null;
    animation.current?.stop();

    if (visible && !mounted) {
      progress.setValue(0);
      setMounted(true);
      return undefined;
    }

    if (visible && mounted) {
      frame = requestAnimationFrame(() => {
        animation.current = Animated.timing(progress, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
        animation.current.start();
      });
    } else if (!visible && mounted) {
      animation.current = Animated.timing(progress, {
        toValue: 0,
        duration: 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      });
      animation.current.start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      animation.current?.stop();
    };
  }, [height, mounted, mode, progress, visible]);

  const opacity = progress;
  const transform = mode === "sheet"
    ? [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [Math.min(height * 0.08, 96), 0] }) }]
    : [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }];

  return (
    <NativeModal
      {...modalProps}
      animationType="none"
      onRequestClose={modalProps.onRequestClose}
      transparent
      visible={mounted}
    >
      <Animated.View style={{ flex: 1, opacity, transform }}>
        {children}
      </Animated.View>
    </NativeModal>
  );
}
