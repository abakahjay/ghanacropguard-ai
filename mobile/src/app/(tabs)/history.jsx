import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";

import { Banner, Button, OfflineBanner, T, cap } from "@/components/ui";
import { absoluteUrl, api } from "@/lib/api";
import { colors, font } from "@/lib/theme";
import { CROPS } from "@/lib/types";

const PAGE = 20;

export default function History() {
  const [q, setQ] = useState("");
  const [crop, setCrop] = useState("");
  const [saved, setSaved] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const reqId = useRef(0);

  const load = useCallback(
    async (p) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      const sp = new URLSearchParams({ page: String(p), page_size: String(PAGE) });
      if (q.trim()) sp.set("q", q.trim());
      if (crop) sp.set("crop", crop);
      if (saved) sp.set("saved", "true");
      try {
        const r = await api(`/predictions/history?${sp}`);
        if (id !== reqId.current) return;
        setItems((prev) => (p === 1 ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
        setPage(p);
      } catch (e) {
        if (id === reqId.current) setError(e.message);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [q, crop, saved],
  );

  useEffect(() => {
    const t = setTimeout(() => load(1), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);
  useFocusEffect(
    useCallback(() => {
      load(1);
    }, [load]),
  );

  const filtered = Boolean(q || crop || saved);
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <View style={st.filters}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search a condition, crop or note"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Search history"
          style={st.search}
          returnKeyType="search"
        />
        <View style={st.chips}>
          {[{ key: "", name: "All" }, ...CROPS].map((c) => (
            <Pressable
              key={c.key || "all"}
              accessibilityRole="button"
              accessibilityState={{ selected: crop === c.key }}
              onPress={() => setCrop(c.key)}
              style={[st.chip, crop === c.key && st.chipOn]}
            >
              <T style={[st.chipText, crop === c.key && { color: colors.bg }]}>{c.name}</T>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: saved }}
            onPress={() => setSaved((x) => !x)}
            style={[st.chip, saved && st.chipOn]}
          >
            <T style={[st.chipText, saved && { color: colors.bg }]}>Saved</T>
          </Pressable>
        </View>
        {total !== null && (
          <T variant="small">
            {total} {total === 1 ? "result" : "results"}
          </T>
        )}
      </View>
      {error && (
        <View style={{ paddingHorizontal: 16 }}>
          <Banner text={error} />
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 4 }}
        refreshControl={
          <RefreshControl refreshing={loading && page === 1} onRefresh={() => load(1)} tintColor={colors.ink} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && total !== null && items.length < total) load(page + 1);
        }}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={{ gap: 12, paddingTop: 24 }}>
              <T variant="muted">
                {filtered ? "No checks match these filters." : "You have not checked any leaves yet."}
              </T>
              {!filtered && <Button title="Check a leaf" onPress={() => router.navigate("/(tabs)")} />}
            </View>
          ) : undefined
        }
        renderItem={({ item: p }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/result/${p.id}`)}
            accessibilityLabel={`${p.predicted?.display_name} on ${p.crop}, ${Math.round((p.predicted?.confidence ?? 0) * 100)} percent`}
            style={({ pressed }) => [st.row, pressed && { backgroundColor: colors.raised }]}
          >
            {p.image_url ? (
              <Image source={{ uri: absoluteUrl(p.image_url) }} style={st.thumb} contentFit="cover" />
            ) : (
              <View style={[st.thumb, { backgroundColor: colors.raised }]} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <T numberOfLines={1} style={{ fontSize: 16 }}>
                {p.predicted?.display_name}
                <T style={{ color: colors.muted, fontSize: 16 }}> · {cap(p.crop ?? "")}</T>
              </T>
              <T variant="small" numberOfLines={1}>
                {new Date(p.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                {p.saved ? " · Saved" : ""}
                {p.note ? ` · ${p.note}` : ""}
              </T>
            </View>
            <T style={{ fontVariant: ["tabular-nums"], color: colors.ink2, fontSize: 15 }}>
              {Math.round((p.predicted?.confidence ?? 0) * 100)}%
            </T>
          </Pressable>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  filters: { padding: 16, gap: 10 },
  search: {
    minHeight: 46,
    borderRadius: 6,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: 14,
    fontFamily: font.regular,
    fontSize: 16,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontSize: 15, color: colors.ink2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  thumb: { width: 52, height: 52, borderRadius: 8 },
});
