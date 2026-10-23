import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";

import { ONBOARDED_KEY } from "@/lib/keys";

export default function Index() {
  const { user } = useAuth();
  const [onboarded, setOnboarded] = useState(null);
  useEffect(() => {
    SecureStore.getItemAsync(ONBOARDED_KEY)
      .then((v) => setOnboarded(v === "1"))
      .catch(() => setOnboarded(true));
  }, []);
  if (onboarded === null) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href={user ? "/(tabs)" : "/(auth)/login"} />;
}
