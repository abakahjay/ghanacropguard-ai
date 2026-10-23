import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { Banner, Card, T } from "@/components/ui";
import { api } from "@/lib/api";
import { column, colors } from "@/lib/theme";
import { CROPS } from "@/lib/types";

export default function Crops() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [crop, setCrop] = useState("cassava");
  const [open, setOpen] = useState(null);
  useEffect(() => {
    api("/crops")
      .then((r) => setData(r.crops))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <ScrollView contentContainerStyle={{ ...column, padding: 16, gap: 12, paddingBottom: 40 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {CROPS.map((c) => (
          <Pressable
            key={c.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: crop === c.key }}
            onPress={() => setCrop(c.key)}
            style={{
              minHeight: 40,
              paddingHorizontal: 14,
              justifyContent: "center",
              borderRadius: 6,
              backgroundColor: crop === c.key ? colors.ink : colors.surface,
            }}
          >
            <T style={{ fontSize: 15, color: crop === c.key ? colors.bg : colors.ink2 }}>{c.name}</T>
          </Pressable>
        ))}
      </View>
      {error && <Banner text={error} />}
      {!data && !error && <ActivityIndicator color={colors.ink} />}
      {data?.[crop]?.map((c) => (
        <Pressable
          key={c.class_key}
          accessibilityRole="button"
          accessibilityState={{ expanded: open === c.class_key }}
          onPress={() => setOpen(open === c.class_key ? null : c.class_key)}
        >
          <Card>
            <T variant="small">{c.kind === "pest" ? "Pest" : c.kind === "healthy" ? "Healthy" : "Disease"}</T>
            <T variant="head">{c.display_name}</T>
            <T variant="muted" style={{ fontSize: 15 }} numberOfLines={open === c.class_key ? undefined : 2}>
              {c.summary}
            </T>
            {open === c.class_key && (
              <>
                {c.signs.length > 0 && (
                  <T variant="muted" style={{ fontSize: 15 }}>
                    {c.signs.map((s) => `• ${s}`).join("\n")}
                  </T>
                )}
                <T variant="label">First steps</T>
                <T variant="muted" style={{ fontSize: 15 }}>
                  {c.steps.map((s) => `• ${s}`).join("\n")}
                </T>
              </>
            )}
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
