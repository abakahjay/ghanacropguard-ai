import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, TextInput, View } from "react-native";

import { Banner, Button, Card, ConfidenceBars, T, cap } from "@/components/ui";
import { absoluteUrl, api } from "@/lib/api";
import { colors, font, radius } from "@/lib/theme";

const KIND = { disease: "Disease", pest: "Pest damage", healthy: "No problem detected" };

export default function ResultScreen() {
  const { id } = useLocalSearchParams();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(null);

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    api(`/predictions/${encodeURIComponent(id)}`)
      .then((r) => {
        if (alive) {
          setP(r);
          setNote(r.note ?? "");
          setError(null);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [id, attempt]);
  const load = useCallback(() => {
    setError(null);
    setAttempt((a) => a + 1);
  }, []);

  async function patch(body, ok) {
    try {
      setP(await api(`/predictions/${id}`, { method: "PATCH", body: JSON.stringify(body) }));
      setMsg(ok);
    } catch (e) {
      setMsg(e.message);
    }
  }

  if (error) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Banner text={error} />
        <Button title="Try again" onPress={load} />
      </View>
    );
  }
  if (!p) return <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} accessibilityLabel="Loading result" />;

  const top = p.predicted;
  const low = p.warnings.some((w) => w.code === "low_confidence");
  const shown = p.warnings.filter((w) => w.code !== "scope");
  const img = absoluteUrl(p.image_url);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: `${top.display_name} · ${cap(top.crop)}` }} />
      {img ? (
        <Image
          source={{ uri: img }}
          style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surface }}
          contentFit="cover"
          accessibilityLabel={`Your photo, assessed as ${top.display_name}`}
        />
      ) : null}
      <Card>
        <T variant="small">
          {KIND[top.kind] ?? top.kind} · model {p.model_version}
        </T>
        <T variant="title" accessibilityRole="header">
          {low ? "Possibly " : "Most likely "}
          {top.display_name.toLowerCase()}
        </T>
        <ConfidenceBars items={p.top_predictions} />
        <T variant="small">
          Analysed in {p.processing_ms?.toFixed(0)} ms · {new Date(p.created_at).toLocaleString("en-GB")}
        </T>
      </Card>
      {shown.length > 0 && (
        <Card tone="warning">
          {shown.map((w) => (
            <T key={w.code} style={{ color: colors.warningInk, fontSize: 15 }}>
              {w.message}
            </T>
          ))}
        </Card>
      )}
      <View style={{ gap: 8 }}>
        <T variant="head" accessibilityRole="header">
          About this condition
        </T>
        <T variant="muted">{p.explanation}</T>
        {p.signs.length > 0 && (
          <T variant="muted" style={{ fontSize: 15 }}>
            {p.signs.map((s) => `• ${s}`).join("\n")}
          </T>
        )}
      </View>
      <Card>
        <T variant="head" accessibilityRole="header">
          What you can do next
        </T>
        <T variant="muted" style={{ fontSize: 16 }}>
          {p.next_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
        </T>
        <T style={{ fontSize: 15 }}>{p.escalate}</T>
      </Card>
      <Card>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            small
            kind="quiet"
            style={{ flex: 1 }}
            title={p.saved ? "Saved ✓" : "Save result"}
            onPress={() => patch({ saved: !p.saved }, p.saved ? "Removed from saved." : "Saved.")}
          />
          <Button
            small
            kind="danger"
            style={{ flex: 1 }}
            title="Delete"
            onPress={() =>
              Alert.alert("Delete this result?", "The photo and result will be permanently deleted.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await api(`/predictions/${id}`, { method: "DELETE" });
                      router.back();
                    } catch (e) {
                      setMsg(e.message);
                    }
                  },
                },
              ])
            }
          />
        </View>
        <T variant="label">Your note</T>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={1000}
          multiline
          placeholder="e.g. Plot by the river"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Your note"
          style={{
            minHeight: 64,
            borderRadius: 6,
            backgroundColor: colors.raised,
            color: colors.ink,
            padding: 12,
            fontFamily: font.regular,
            fontSize: 16,
            textAlignVertical: "top",
          }}
        />
        <Button
          small
          kind="quiet"
          title="Save note"
          onPress={() => patch({ note: note.trim() || null }, "Note saved.")}
        />
        {msg && (
          <T variant="small" accessibilityLiveRegion="polite">
            {msg}
          </T>
        )}
      </Card>
      <View style={{ gap: 6 }}>
        <T variant="label">Sources</T>
        {p.sources.map((s) => (
          <T
            key={s.url}
            style={{ color: colors.ink2, fontSize: 15, textDecorationLine: "underline" }}
            accessibilityRole="link"
            onPress={() => Linking.openURL(s.url)}
          >
            {s.title}
          </T>
        ))}
        <T variant="small" style={{ marginTop: 8 }}>
          {p.disclaimer} {p.warnings.find((w) => w.code === "scope")?.message}
        </T>
      </View>
    </ScrollView>
  );
}
