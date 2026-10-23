import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, TextInput, View } from "react-native";

import { ServerAddress } from "@/components/ServerAddress";
import { Button, Card, Field, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { column, colors, font } from "@/lib/theme";

export default function Profile() {
  const { user, refresh, signOut } = useAuth();
  const [name, setName] = useState(user?.full_name ?? "");
  const [msg, setMsg] = useState(null);
  const [pw, setPw] = useState("");

  async function run(fn, ok) {
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setMsg(e.message);
    }
  }

  if (!user) return null;
  return (
    <ScrollView contentContainerStyle={{ ...column, padding: 16, gap: 16, paddingBottom: 40 }}>
      <Card>
        <T variant="head" accessibilityRole="header">
          Your details
        </T>
        <T variant="small">
          {user.email}
          {user.region ? ` · ${user.region} Region` : ""}
        </T>
        <Field label="Name" value={name} onChangeText={setName} maxLength={120} />
        <Button
          small
          kind="quiet"
          title="Save name"
          onPress={() =>
            run(async () => {
              await api("/auth/me", { method: "PATCH", body: JSON.stringify({ full_name: name.trim() || null }) });
              await refresh();
            }, "Saved.")
          }
        />
      </Card>

      <Card>
        <T variant="head" accessibilityRole="header">
          Learn
        </T>
        <Button small kind="quiet" title="Crop guide" onPress={() => router.push("/crops")} />
        <Button small kind="quiet" title="Limits, accuracy and privacy" onPress={() => router.push("/about")} />
      </Card>

      <Card>
        <T variant="head" accessibilityRole="header">
          Your data
        </T>
        <T variant="muted" style={{ fontSize: 15 }}>
          Deleting is permanent and removes photos from the server.
        </T>
        <Button
          small
          kind="quiet"
          title="Delete my history"
          onPress={() =>
            Alert.alert("Delete all photos and results?", "This cannot be undone.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => run(() => api("/predictions", { method: "DELETE" }), "Your history has been deleted."),
              },
            ])
          }
        />
        <T variant="label">Delete account (enter password)</T>
        <TextInput
          value={pw}
          onChangeText={setPw}
          secureTextEntry
          accessibilityLabel="Password to delete account"
          style={{
            minHeight: 50,
            borderRadius: 6,
            backgroundColor: colors.raised,
            color: colors.ink,
            paddingHorizontal: 14,
            fontFamily: font.regular,
            fontSize: 16,
          }}
        />
        <Button
          small
          kind="danger"
          title="Delete account"
          disabled={!pw}
          onPress={() =>
            Alert.alert("Delete your account?", "Your account, photos and results will be permanently deleted.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () =>
                  run(async () => {
                    await api("/auth/me", { method: "DELETE", body: JSON.stringify({ password: pw }) });
                    await signOut();
                    router.replace("/(auth)/login");
                  }, "Account deleted."),
              },
            ])
          }
        />
      </Card>

      {msg && (
        <T variant="small" accessibilityLiveRegion="polite">
          {msg}
        </T>
      )}

      <View style={{ gap: 10 }}>
        <ServerAddress />
        <Button
          kind="quiet"
          title="Sign out"
          onPress={async () => {
            await signOut();
            router.replace("/(auth)/login");
          }}
        />
      </View>
    </ScrollView>
  );
}
