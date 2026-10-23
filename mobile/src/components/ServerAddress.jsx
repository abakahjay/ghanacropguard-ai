import { useState } from "react";
import { View } from "react-native";

import { api, getBaseUrl, setBaseUrl } from "@/lib/api";

import { Button, Field, T } from "./ui";

/**
 * Lets a tester point the app at the backend: e.g. the laptop's Wi-Fi address
 * (http://192.168.x.x:7004) when running FullBackendd locally, or the deployed HTTPS URL.
 */
export function ServerAddress() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(getBaseUrl());
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <Button
        kind="quiet"
        small
        title={`Server: ${getBaseUrl().replace(/^https?:\/\//, "")}`}
        onPress={() => setOpen(true)}
      />
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <Field
        label="Server address"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        hint="Ask whoever runs the service. For a laptop on your Wi-Fi: http://<laptop IP>:7004"
      />
      <Button
        small
        title="Save and test"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          setMsg(null);
          try {
            await setBaseUrl(url);
            const h = await api("/health", {}, 8000);
            setMsg({ ok: true, text: `Connected. Model: ${h.model_version ?? "not loaded"}` });
          } catch (e) {
            setMsg({ ok: false, text: e.message });
          } finally {
            setBusy(false);
          }
        }}
      />
      {msg && (
        <T variant="small" style={{ color: msg.ok ? "#8cc77f" : "#f08a74" }}>
          {msg.text}
        </T>
      )}
    </View>
  );
}
