import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

export default function AuthLayout() {
  const { user } = useAuth();
  if (user) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
