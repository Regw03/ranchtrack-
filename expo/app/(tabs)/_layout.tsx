import { Tabs } from "expo-router";
import { LayoutDashboard, Fence, Hammer } from "lucide-react-native";
import React, { useMemo } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/providers/ThemeProvider";

export default function TabLayout() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();

  const screenOptions = useMemo(() => {
    const bottomInset = Platform.OS === "web" ? 0 : insets.bottom;
    return {
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: Colors.textTertiary,
      headerShown: false,
      tabBarShowLabel: true,
      tabBarLabelPosition: "below-icon" as const,
      tabBarStyle: {
        backgroundColor: Colors.surface,
        borderTopColor: Colors.borderLight,
        borderTopWidth: 1,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: bottomInset + 8,
        height: 64 + bottomInset,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: "600" as const,
        marginTop: 2,
        marginBottom: 0,
        includeFontPadding: false,
      },
      tabBarIconStyle: {
        marginBottom: 0,
      },
    };
  }, [Colors, insets.bottom]);

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="(herd)"
        options={{
          title: "Animals",
          tabBarIcon: ({ color, size }) => <Fence color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: "Work",
          tabBarIcon: ({ color, size }) => <Hammer color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
