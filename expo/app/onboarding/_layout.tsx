import { Stack } from "expo-router";
import React, { useMemo } from "react";
import { useColors } from "@/providers/ThemeProvider";

export default function OnboardingLayout() {
  const Colors = useColors();

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: Colors.background },
      animation: "slide_from_right" as const,
    }),
    [Colors],
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="ranch-name" />
      <Stack.Screen name="join-ranch" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="import-data" />
      <Stack.Screen name="manual-entry" />
      <Stack.Screen name="guided-setup" />
      <Stack.Screen name="import-review" />
    </Stack>
  );
}
