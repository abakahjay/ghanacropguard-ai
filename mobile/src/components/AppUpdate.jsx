import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";

import { Button, T } from "@/components/ui";
import { checkForUpdate, downloadAndInstall, installedVersionCode } from "@/lib/appUpdate";
import { colors, radius } from "@/lib/theme";

const UpdateContext = createContext({ supported: false, checkNow: async () => null });

/**
 * Checks the website's app-version.json once per launch (Android APK only) and offers the
 * newer version. "Later" hides it until the next launch; Profile can check again on demand.
 */
export function AppUpdateProvider({ children }) {
  const [release, setRelease] = useState(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(null); // null = idle, 0..1 = downloading
  const [handedOff, setHandedOff] = useState(false);
  const supported = installedVersionCode() != null;

  const show = useCallback((r) => {
    if (!r) return;
    setRelease(r);
    setHandedOff(false);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (supported) checkForUpdate().then(show);
  }, [supported, show]);

  const checkNow = useCallback(async () => {
    const r = await checkForUpdate();
    show(r);
    return r;
  }, [show]);

  async function update() {
    setProgress(0);
    const how = await downloadAndInstall(release, setProgress);
    setProgress(null);
    setHandedOff(how === "installer" || how === "browser");
  }

  const downloading = progress != null;
  return (
    <UpdateContext.Provider value={{ supported, checkNow }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !downloading && setVisible(false)}>
        <View style={st.backdrop}>
          <View style={st.card} accessibilityViewIsModal>
            <T variant="head" accessibilityRole="header">Update available</T>
            {release && (
              <T variant="muted" style={{ fontSize: 15 }}>
                GhanaCropGuard {release.versionName}
                {release.size ? ` · ${release.size}` : ""}
              </T>
            )}
            {release?.notes?.length > 0 && (
              <View style={{ gap: 4 }}>
                {release.notes.map((n) => (
                  <T key={n} style={{ fontSize: 15, lineHeight: 22 }}>• {n}</T>
                ))}
              </View>
            )}
            {downloading && (
              <View style={{ gap: 6 }} accessibilityLiveRegion="polite">
                <T variant="small">Downloading… {Math.round(progress * 100)}%</T>
                <View style={st.track}>
                  <View style={[st.fill, { width: `${Math.max(progress * 100, 2)}%` }]} />
                </View>
              </View>
            )}
            {handedOff && (
              <T variant="small" style={{ color: colors.ink2 }}>
                Follow Android&apos;s prompt to install. If it asks, allow GhanaCropGuard to install apps, then tap Update.
              </T>
            )}
            <View style={{ gap: 10, marginTop: 4 }}>
              <Button kind="accent" title={handedOff ? "Try again" : "Update now"} busy={downloading} onPress={update} />
              <Button kind="quiet" title="Later" disabled={downloading} onPress={() => setVisible(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </UpdateContext.Provider>
  );
}

export const useAppUpdate = () => useContext(UpdateContext);

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  card: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    gap: 12,
  },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.raised },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
