import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ServerAddress } from "@/components/ServerAddress";
import { Banner, Button, Field, OfflineBanner, T } from "@/components/ui";

import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", padding: 16, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <T variant="title" accessibilityRole="header">
            Sign in
          </T>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={submit}
          />
          <Link href="/(auth)/forgot-password">
            <T variant="muted" style={{ textDecorationLine: "underline" }}>
              Forgot password?
            </T>
          </Link>
          {error && <Banner text={error} />}
          <Button kind="accent" title="Sign in" busy={busy} onPress={submit} />
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <T variant="muted">New here?</T>
            <Link href="/(auth)/register" replace>
              <T style={{ color: colors.accent }}>Create an account</T>
            </Link>
          </View>
          <ServerAddress />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
