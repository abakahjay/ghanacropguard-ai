import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ServerAddress } from "@/components/ServerAddress";
import { Banner, Button, Field, OfflineBanner, T } from "@/components/ui";

import { useAuth } from "@/lib/auth";
import { colors, font } from "@/lib/theme";
import { GHANA_REGIONS } from "@/lib/types";

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "", region: "" });
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [showRegions, setShowRegions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    const fe = {};
    if (!form.email.includes("@")) fe.email = "Enter a valid email address.";
    if (form.password.length < 8) fe.password = "At least 8 characters.";
    else if (!/[a-z]/i.test(form.password) || !/\d/.test(form.password)) fe.password = "Use letters and numbers.";
    if (form.password !== form.confirm) fe.confirm = "Passwords do not match.";
    if (!age) fe.age_confirmed = "You must be 16 or older to create an account.";
    if (!terms) fe.accept_terms = "Please accept the Terms of Use and privacy notice.";
    setFields(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    setError(null);
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim() || null,
        region: form.region || null,
        age_confirmed: age,
        accept_terms: terms,
      });
    } catch (e) {
      const err = e;
      const f2 = {};
      for (const f of err.fields ?? []) f2[f.field] = f.message.replace(/^Value error, /, "");
      setFields(f2);
      if (!Object.keys(f2).length) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingTop: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <T variant="title" accessibilityRole="header">
            Create an account
          </T>
          <T variant="muted">Your checks stay private to your account. We never ask for your exact location.</T>
          <Field
            label="Your name (optional)"
            value={form.full_name}
            onChangeText={set("full_name")}
            autoComplete="name"
          />
          <Field
            label="Email"
            value={form.email}
            onChangeText={set("email")}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={fields.email}
          />
          <Field
            label="Password"
            value={form.password}
            onChangeText={set("password")}
            secureTextEntry
            autoComplete="new-password"
            error={fields.password}
            hint="At least 8 characters, with letters and numbers"
          />
          <Field
            label="Confirm password"
            value={form.confirm}
            onChangeText={set("confirm")}
            secureTextEntry
            error={fields.confirm}
          />
          <View style={{ gap: 6 }}>
            <T variant="label">Region (optional)</T>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowRegions((x) => !x)}
              style={{
                minHeight: 50,
                borderRadius: 6,
                backgroundColor: colors.raised,
                justifyContent: "center",
                paddingHorizontal: 14,
              }}
            >
              <T style={{ color: form.region ? colors.ink : colors.muted }}>{form.region || "Prefer not to say"}</T>
            </Pressable>
            {showRegions && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {["", ...GHANA_REGIONS].map((r) => (
                  <Pressable
                    key={r || "none"}
                    accessibilityRole="button"
                    accessibilityState={{ selected: form.region === r }}
                    onPress={() => {
                      set("region")(r);
                      setShowRegions(false);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 6,
                      backgroundColor: form.region === r ? colors.ink : colors.surface,
                    }}
                  >
                    <T
                      style={{
                        fontSize: 15,
                        fontFamily: font.regular,
                        color: form.region === r ? colors.bg : colors.ink2,
                      }}
                    >
                      {r || "Prefer not to say"}
                    </T>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <CheckRow checked={age} onChange={setAge} label="I am 16 years old or older." error={fields.age_confirmed} />
          <CheckRow
            checked={terms}
            onChange={setTerms}
            error={fields.accept_terms}
            label="I accept the Terms of Use and have read the privacy notice."
            onMore={() => router.push("/about")}
          />
          {error && <Banner text={error} />}
          <Button kind="accent" title="Create account" busy={busy} onPress={submit} />
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <T variant="muted">Already registered?</T>
            <Link href="/(auth)/login" replace>
              <T style={{ color: colors.accent }}>Sign in</T>
            </Link>
          </View>
          <ServerAddress />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CheckRow({ checked, onChange, label, error, onMore }) {
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => onChange(!checked)}
        style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", minHeight: 44 }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            marginTop: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: checked ? colors.accent : colors.raised,
          }}
        >
          {checked ? <T style={{ color: colors.accentInk, fontSize: 16, lineHeight: 20 }}>✓</T> : null}
        </View>
        <T variant="muted" style={{ flex: 1, fontSize: 15 }}>
          {label}
        </T>
      </Pressable>
      {onMore && (
        <T style={{ color: colors.accent, fontSize: 15, marginLeft: 36 }} accessibilityRole="link" onPress={onMore}>
          Read the terms and privacy notice
        </T>
      )}
      {error && (
        <T variant="small" style={{ color: colors.negative, marginLeft: 36 }}>
          {error}
        </T>
      )}
    </View>
  );
}
