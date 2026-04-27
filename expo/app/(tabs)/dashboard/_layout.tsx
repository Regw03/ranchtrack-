import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import React, { useMemo, useCallback } from "react";
import { TouchableOpacity, Platform, View, Text } from "react-native";
import { UserCircle2 } from "lucide-react-native";
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
            <TouchableOpacity
              onPress={handleRanchProfilePress}
              activeOpacity={0.6}
              testID="ranch-profile-button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
                marginRight: 4,
                borderRadius: 999,
                backgroundColor: Colors.primary + '12',
              }}
            >
              <UserCircle2 size={18} color={Colors.primary} strokeWidth={2} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>Ranch</Text>
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  );
}
