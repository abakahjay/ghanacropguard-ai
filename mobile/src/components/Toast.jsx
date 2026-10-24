import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, font, radius } from "@/lib/theme";

const ToastContext = createContext(() => {});

/** One short message at a time, above the tab bar. Same look on Android and iOS (iOS has no native toast). */
export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setToast(null));
  }, [anim]);

  const show = useCallback(
    (message, { ms = 5000 } = {}) => {
      clearTimeout(timer.current);
      setToast({ message, id: Date.now() });
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      AccessibilityInfo.announceForAccessibility(message);
      timer.current = setTimeout(hide, ms);
    },
    [anim, hide],
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            st.wrap,
            {
              bottom: insets.bottom + 76,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            },
          ]}
        >
          <Pressable onPress={hide} accessibilityRole="alert" accessibilityHint="Tap to dismiss" style={st.toast}>
            <Text style={st.text}>{toast.message}</Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const st = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    maxWidth: 520,
    backgroundColor: colors.warningBg,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: { color: colors.warningInk, fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
});
