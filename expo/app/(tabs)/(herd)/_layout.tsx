import { Stack } from "expo-router";
import React, { useMemo } from "react";
import { useColors } from "@/providers/ThemeProvider";

export default function HerdLayout() {
  const Colors = useColors();
  const screenOptions = useMemo(() => ({
    headerStyle: { backgroundColor: Colors.background },
    headerTintColor: Colors.primary,
    headerTitleStyle: { color: Colors.text, fontWeight: "600" as const },
    contentStyle: { backgroundColor: Colors.background },
  }), [Colors]);

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="index"
        options={{ title: "Animals" }}
      />
    </Stack>
  );
}
