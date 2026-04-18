import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import React, { useMemo, useCallback } from "react";
import { TouchableOpacity, Platform, View } from "react-native";
import { Settings } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/providers/ThemeProvider";

export default function DashboardLayout() {
  const Colors = useColors();
  const router = useRouter();

  const screenOptions = useMemo(() => ({
    headerStyle: { backgroundColor: Colors.background },
    headerTintColor: Colors.primary,
    headerTitleStyle: { color: Colors.text, fontWeight: "600" as const },
    contentStyle: { backgroundColor: Colors.background },
  }), [Colors]);

  const handleSettingsPress = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/settings");
  }, [router]);

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSettingsPress}
              activeOpacity={0.5}
              testID="settings-button"
              style={{
                marginRight: 8,
                padding: 6,
                backgroundColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0,
                overflow: 'visible',
              }}
            >
              <Settings size={20} color={Colors.textSecondary} strokeWidth={1.8} />
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  );
}
