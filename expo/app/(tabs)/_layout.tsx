import { Tabs } from "expo-router";
import { LayoutDashboard, Fence, Hammer } from "lucide-react-native";
import React, { useMemo } from "react";
import { Platform } from "react-native";
import { useColors } from "@/providers/ThemeProvider";

export default function TabLayout() {
  const Colors = useColors();

  const screenOptions = useMemo(() => ({
    tabBarActiveTintColor: Colors.primary,
    tabBarInactiveTintColor: Colors.textTertiary,
    headerShown: false,
    tabBarStyle: {
      backgroundColor: Colors.surface,
      borderTopColor: Colors.borderLight,
      borderTopWidth: 1,
      paddingHorizontal: 12,
      ...(Platform.OS === "web" ? { height: 60, paddingBottom: 8 } : {}),
    },
    tabBarLabelStyle: {
      fontSize: 12,
      fontWeight: "600" as const,
      paddingBottom: Platform.OS === "web" ? 4 : 0,
    },
    tabBarItemStyle: {
      paddingVertical: 4,
    },
  }), [Colors]);

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
