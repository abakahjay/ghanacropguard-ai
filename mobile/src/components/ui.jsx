import NetInfo from "@react-native-community/netinfo";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, font, radius } from "@/lib/theme";

export function T({ style, variant = "body", ...p }) {
  return <Text {...p} style={[s.body, variant !== "body" && s[variant], style]} />;
}

export function Button({ title, kind = "primary", busy = false, small = false, style, disabled, onPress, ...p }) {
  const bg = { accent: colors.accent, primary: colors.ink, quiet: colors.raised, danger: colors.dangerBg }[kind];
  const fg = { accent: colors.accentInk, primary: colors.bg, quiet: colors.ink, danger: colors.dangerInk }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy), busy }}
      disabled={disabled || busy}
      onPress={(e) => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSm,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}
      {...p}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[s.btnText, small && { fontSize: 15 }, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, hint, style, ...p }) {
  return (
    <View style={{ gap: 6 }}>
      <T variant="label" nativeID={`${label}-label`}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[s.input, error ? { borderColor: colors.negative } : null, style]}
        {...p}
      />
      {error ? (
        <T variant="small" style={{ color: colors.negative }}>
          {error}
        </T>
      ) : hint ? (
        <T variant="small">{hint}</T>
      ) : null}
    </View>
  );
}

export function Card({ children, style, tone = "surface" }) {
  const bg = { surface: colors.surface, warning: colors.warningBg, danger: colors.dangerBg }[tone];
  return <View style={[s.card, { backgroundColor: bg }, style]}>{children}</View>;
}

export function Banner({ text, tone = "danger" }) {
  return (
    <Card tone={tone} style={{ paddingVertical: 12 }}>
      <T
        style={{ color: tone === "danger" ? colors.dangerInk : colors.warningInk, fontSize: 15 }}
        accessibilityRole="alert"
      >
        {text}
      </T>
    </Card>
  );
}

/** Shows a thin bar when the device has no internet connection. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(
    () => NetInfo.addEventListener((st) => setOffline(st.isConnected === false || st.isInternetReachable === false)),
    [],
  );
  if (!offline) return null;
  return (
    <View style={s.offline} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={s.offlineText}>You are offline. Photos can only be checked with a connection.</Text>
    </View>
  );
}

export function ConfidenceBars({ items, compact = false }) {
  return (
    <View style={{ gap: compact ? 10 : 14 }} accessibilityLabel="Model confidence by condition">
      {items.map((it, i) => {
        const pct = Math.round(it.confidence * 1000) / 10;
        return (
          <View
            key={it.class_key}
            style={{ gap: 6 }}
            accessible
            accessibilityLabel={`${it.display_name}, ${it.crop}, ${pct.toFixed(1)} percent`}
          >
            <View style={s.barRow}>
              <Text style={[s.barLabel, i === 0 && { color: colors.ink, fontFamily: font.medium }]} numberOfLines={1}>
                {it.display_name}
                <Text style={{ color: colors.muted }}> · {cap(it.crop)}</Text>
              </Text>
              <Text style={[s.barValue, i === 0 && { color: colors.ink }]}>{pct.toFixed(1)}%</Text>
            </View>
            <View style={s.track}>
              <View
                style={[
                  s.fill,
                  { width: `${Math.max(pct, 0.5)}%`, backgroundColor: i === 0 ? colors.accent : colors.barMuted },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function cap(x) {
  return x ? x[0].toUpperCase() + x.slice(1) : x;
}

const s = StyleSheet.create({
  body: { color: colors.ink, fontFamily: font.regular, fontSize: 17, lineHeight: 25 },
  small: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.ink2 },
  label: { fontFamily: font.medium, fontSize: 15 },
  title: { fontFamily: font.light, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  head: { fontFamily: font.medium, fontSize: 18, lineHeight: 24 },
  btn: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSm: { minHeight: 40, paddingHorizontal: 14 },
  btnText: { fontFamily: font.medium, fontSize: 16 },
  input: {
    minHeight: 50,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
    color: colors.ink,
    paddingHorizontal: 14,
    fontFamily: font.regular,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  card: { borderRadius: radius.lg, padding: 16, gap: 12 },
  offline: { backgroundColor: colors.warningBg, paddingVertical: 8, paddingHorizontal: 16 },
  offlineText: { color: colors.warningInk, fontFamily: font.regular, fontSize: 14 },
  barRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  barLabel: { color: colors.ink2, fontFamily: font.regular, fontSize: 15, flexShrink: 1 },
  barValue: { color: colors.muted, fontFamily: font.regular, fontSize: 15, fontVariant: ["tabular-nums"] },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.raised },
  fill: { height: 8, borderRadius: 4 },
});
