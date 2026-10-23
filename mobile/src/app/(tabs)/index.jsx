import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";

import { Banner, Button, Card, OfflineBanner, T } from "@/components/ui";
import { uploadPrediction } from "@/lib/api";
import { compressForUpload, formatBytes } from "@/lib/image";
import { colors, radius } from "@/lib/theme";

export default function CheckScreen() {
  const [stage, setStage] = useState({ kind: "empty" });

  async function pick(source) {
    try {
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setStage({
            kind: "error",
            settings: !perm.canAskAgain,
            message: "Camera permission is needed to take a photo. You can also choose a photo from your gallery.",
          });
          return;
        }
      }
      const opts = { mediaTypes: ["images"], quality: 1, exif: false };
      const res =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      if (a.mimeType && !a.mimeType.startsWith("image/")) {
        setStage({ kind: "error", message: "That file is not a photo." });
        return;
      }
      setStage({ kind: "preparing" });
      const c = await compressForUpload(a.uri, a.width || 4000, a.height || 3000);
      // Blob.size of a file:// response is unreliable on Android; count the bytes instead.
      const sent = await fetch(c.uri)
        .then((r) => r.arrayBuffer())
        .then((b) => b.byteLength)
        .catch(() => undefined);
      setStage({ kind: "ready", uri: c.uri, width: c.width, height: c.height, original: a.fileSize, sent });
    } catch {
      setStage({ kind: "error", message: "We could not open that photo. Try another one, or take a new photo." });
    }
  }

  function upload(s) {
    setStage({ kind: "uploading", uri: s.uri, progress: 0, original: s.original, sent: s.sent });
    uploadPrediction(
      s.uri,
      (p) => setStage((cur) => (cur.kind === "uploading" ? { ...cur, progress: p } : cur)),
      () => setStage({ kind: "analysing", uri: s.uri }),
    )
      .then((p) => {
        setStage({ kind: "empty" });
        router.push(`/result/${p.id}`);
      })
      .catch((e) => setStage({ kind: "error", uri: s.uri, message: e.message, retry: () => upload(s) }));
  }

  const preview = "uri" in stage ? stage.uri : undefined;
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={st.wrap}>
        <View style={st.photo}>
          {preview ? (
            <Image
              source={{ uri: preview }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              accessibilityLabel="Your photo, ready to check"
            />
          ) : (
            <View style={st.empty}>
              <T variant="title" style={{ fontSize: 26, lineHeight: 30 }}>
                {stage.kind === "preparing" ? "Preparing your photo…" : "Photograph one leaf, close up, in daylight."}
              </T>
            </View>
          )}
        </View>

        {(stage.kind === "empty" || stage.kind === "preparing" || (stage.kind === "error" && !stage.uri)) && (
          <View style={{ gap: 10 }}>
            <Button
              kind="primary"
              title="Take photo"
              onPress={() => pick("camera")}
              disabled={stage.kind === "preparing"}
            />
            <Button
              kind="quiet"
              title="Choose from gallery"
              onPress={() => pick("gallery")}
              disabled={stage.kind === "preparing"}
            />
          </View>
        )}

        {stage.kind === "ready" && (
          <Card>
            <View style={st.row}>
              <View>
                <T variant="small">Original</T>
                <T style={st.num}>{formatBytes(stage.original)}</T>
              </View>
              <View>
                <T variant="small">Sending</T>
                <T style={st.num}>
                  {formatBytes(stage.sent)} · {stage.width}×{stage.height}
                </T>
              </View>
            </View>
            <Button kind="accent" title="Check this leaf" onPress={() => upload(stage)} />
            <Button kind="quiet" title="Retake" onPress={() => setStage({ kind: "empty" })} />
          </Card>
        )}

        {stage.kind === "uploading" && (
          <Card>
            <View style={st.row}>
              <T>Uploading</T>
              <T style={st.num}>{Math.round(stage.progress * 100)}%</T>
            </View>
            <View
              style={st.track}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(stage.progress * 100) }}
            >
              <View style={[st.fill, { width: `${stage.progress * 100}%` }]} />
            </View>
          </Card>
        )}

        {stage.kind === "analysing" && (
          <Card>
            <T accessibilityLiveRegion="polite">Analysing the photo…</T>
            <T variant="small">This usually takes under a second.</T>
          </Card>
        )}

        {stage.kind === "error" && (
          <View style={{ gap: 10 }}>
            <Banner text={stage.message} />
            {stage.retry && <Button title="Try again" onPress={stage.retry} />}
            {stage.settings && <Button kind="quiet" title="Open settings" onPress={() => Linking.openSettings()} />}
            {stage.uri && (
              <Button kind="quiet" title="Choose another photo" onPress={() => setStage({ kind: "empty" })} />
            )}
          </View>
        )}

        {stage.kind === "empty" && (
          <Card>
            <T variant="head">For a useful result</T>
            <T variant="muted" style={{ fontSize: 15 }}>
              • Fill the frame with the affected leaf, stem or pod.{"\n"}• Use daylight; avoid strong shadow.{"\n"}•
              Hold steady so spots or insects are sharp.{"\n"}• Cashew, cassava, maize and tomato only.
            </T>
            <Button kind="quiet" small title="Crop guide" onPress={() => router.push("/crops")} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 16, gap: 16, paddingBottom: 32 },
  photo: { aspectRatio: 4 / 3, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface },
  empty: { flex: 1, justifyContent: "flex-end", padding: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  num: { fontVariant: ["tabular-nums"], fontSize: 16 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.raised },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.ink },
});
