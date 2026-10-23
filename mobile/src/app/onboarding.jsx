import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useRef, useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, T } from "@/components/ui";
import { colors, column, font } from "@/lib/theme";

import { ONBOARDED_KEY } from "@/lib/keys";

const PAGES = [
  {
    title: "Photograph the leaf, see what's wrong",
    body: "Take a photo of a cashew, cassava, maize or tomato leaf. The model checks it against 22 diseases, pests and healthy leaves, trained on photos from Ghanaian farms.",
  },
  {
    title: "Close, sharp, in daylight",
    body: "Fill the screen with one affected leaf. Avoid deep shade and blur. Your photo is shrunk to about 200 KB on the phone before sending, to save data.",
  },
  {
    title: "A first opinion, not a diagnosis",
    body: "Results can be wrong, and uncertain ones are flagged. Before you spend money on treatment, confirm with your district agricultural extension officer.",
  },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const list = useRef(null);

  async function finish() {
    await SecureStore.setItemAsync(ONBOARDED_KEY, "1").catch(() => {});
    router.replace("/(auth)/register");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        ref={list}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.title}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => (
          <View style={[st.page, { width, paddingHorizontal: Math.max(24, (width - 640) / 2 + 16) }]}>
            <T style={st.step} accessibilityLabel={`Step ${index + 1} of ${PAGES.length}`}>
              {index + 1} / {PAGES.length}
            </T>
            <T variant="title" accessibilityRole="header" style={{ fontSize: 36, lineHeight: 40 }}>
              {item.title}
            </T>
            <T variant="muted" style={{ marginTop: 16 }}>
              {item.body}
            </T>
          </View>
        )}
      />
      <View style={[column, st.footer]}>
        <View style={st.dots}>
          {PAGES.map((p, k) => (
            <View key={p.title} style={[st.dot, k === i && st.dotOn]} />
          ))}
        </View>
        {i < PAGES.length - 1 ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button kind="quiet" title="Skip" onPress={finish} style={{ flex: 1 }} />
            <Button
              kind="accent"
              title="Next"
              style={{ flex: 2 }}
              onPress={() => {
                list.current?.scrollToIndex({ index: i + 1 });
                setI(i + 1);
              }}
            />
          </View>
        ) : (
          <Button kind="accent" title="Get started" onPress={finish} />
        )}
        <Button
          kind="quiet"
          title="I already have an account"
          onPress={async () => {
            await SecureStore.setItemAsync(ONBOARDED_KEY, "1").catch(() => {});
            router.replace("/(auth)/login");
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 24, paddingBottom: 32 },
  step: { color: colors.muted, fontFamily: font.regular, fontSize: 14, marginBottom: 12 },
  footer: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.raised },
  dotOn: { backgroundColor: colors.accent, width: 20 },
});
