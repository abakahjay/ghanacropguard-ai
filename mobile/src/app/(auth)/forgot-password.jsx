import Constants from "expo-constants";
import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Banner, Button, Card, Field, OfflineBanner, T } from "@/components/ui";

import { api } from "@/lib/api";
import { column, colors } from "@/lib/theme";

// The emailed link opens the website's reset page, which works on any device.
const WEB_URL = String(Constants.expoConfig?.extra?.webUrl ?? "").replace(/\/$/, "");

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  async function submit() {
    if (!email.trim()) {
      setError("Enter the email you signed up with.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), redirect_uri: `${WEB_URL}/reset-password` }),
      });
      setSent(r.message);
    } catch (e) {
      setError(e.fields?.[0]?.message || e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ ...column, flexGrow: 1, justifyContent: "flex-end", padding: 16, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <T variant="title" accessibilityRole="header">
            Forgot password
          </T>
          {sent ? (
            <Card>
              <T>{sent}</T>
              <T variant="muted">
                Open the link in the email within 30 minutes to choose a new password, then sign in here with it.
              </T>
            </Card>
          ) : (
            <>
              <T variant="muted">
                We&apos;ll email you a link to choose a new password. Accounts made with Google can use this to add one.
              </T>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                onSubmitEditing={submit}
              />
              {error && <Banner text={error} />}
              <Button kind="accent" title="Send reset link" busy={busy} onPress={submit} />
            </>
          )}
          <View style={{ flexDirection: "row" }}>
            <Link href="/(auth)/login" replace>
              <T style={{ color: colors.accent }}>Back to sign in</T>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
