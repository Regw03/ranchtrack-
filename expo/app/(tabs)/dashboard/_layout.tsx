import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import React, { useMemo, useCallback } from "react";
import { TouchableOpacity, Platform, View } from "react-native";
import { Settings, Users } from "lucide-react-native";
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

  const handleRanchProfilePress = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/ranch-profile");
  }, [router]);

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4 }}>
              <TouchableOpacity
                onPress={handleRanchProfilePress}
                activeOpacity={0.5}
                testID="ranch-profile-button"
                style={{ padding: 8 }}
              >
                <Users size={20} color={Colors.textSecondary} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSettingsPress}
                activeOpacity={0.5}
                testID="settings-button"
                style={{ padding: 8 }}
              >
                <Settings size={20} color={Colors.textSecondary} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
    </Stack>
  );
}
