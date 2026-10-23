import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView } from "react-native";

import { Card, T } from "@/components/ui";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

const PORTFOLIO_URL = "https://portfolio-8jmo.onrender.com/";

const pct = (v) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "–");

export default function About() {
  const [info, setInfo] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api("/model/info")
      .then(setInfo)
      .catch(() => setFailed(true));
  }, []);
  const t = info?.test_metrics;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <Card>
        <T variant="head" accessibilityRole="header">
          Measured accuracy
        </T>
        {t ? (
          <>
            <T>
              Accuracy {pct(t.accuracy)} · correct in top 3 {pct(t.top3_accuracy)}
            </T>
            <T variant="small">
              Macro F1 {typeof t.f1_macro === "number" ? t.f1_macro.toFixed(3) : "–"} on {t.n_images ?? "–"} held-out
              test photos. Model {info?.name}.
            </T>
            <T variant="small">{info?.note}</T>
          </>
        ) : (
          <T variant="muted">
            {failed ? "The model service could not be reached." : "No recorded test results for this model."}
          </T>
        )}
      </Card>
      <Card>
        <T variant="head" accessibilityRole="header">
          Limits
        </T>
        <T variant="muted" style={{ fontSize: 15 }}>
          {
            "• Not a diagnosis. Confirm with an extension officer.\n• Only 22 conditions of cashew, cassava, maize and tomato. Anything else will still be matched to one of them.\n• Blurred, dark or distant photos give poorer results.\n• Confidence is how similar the photo is to training photos, not a probability that your plant has it.\n• No pesticide names or doses are given.\n• Needs an internet connection to analyse a photo."
          }
        </T>
      </Card>
      <Card>
        <T variant="head" accessibilityRole="header">
          Privacy
        </T>
        <T variant="muted" style={{ fontSize: 15 }}>
          {
            "Your photos are private to your account, stored with location data removed and deleted after the retention period unless you save the result. You can delete any result, your history or your account from Profile. We never ask for your exact location."
          }
        </T>
      </Card>
      <Card>
        <T variant="head" accessibilityRole="header">
          Terms of Use (summary)
        </T>
        <T variant="muted" style={{ fontSize: 15 }}>
          {
            "• You must be 16 or older to create an account.\n• Upload only photos you took or are allowed to share, of crops only; no photos of people.\n• Results are a preliminary aid, provided free and without guarantee. Treatment decisions are yours; confirm with an extension officer.\n• Do not try to access other people's data or overload the service.\n• The full terms are on the GhanaCropGuard website (Terms page)."
          }
        </T>
      </Card>
      <T variant="small">
        Training data: CCMT dataset, Mensah et al. (2023), Data in Brief 49:109306, doi:10.17632/bwh3zbpkpv.1, CC BY
        4.0.
      </T>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(PORTFOLIO_URL)}>
        <T variant="small">
          Built by <T style={{ color: colors.accent, fontSize: 13 }}>Abakah Joshua</T>
        </T>
      </Pressable>
    </ScrollView>
  );
}
