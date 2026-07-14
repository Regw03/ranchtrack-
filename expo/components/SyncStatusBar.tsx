import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from "lucide-react-native";
import { useColors } from "@/providers/ThemeProvider";

export type SyncState =
  | "synced"      // All data safely in cloud
  | "syncing"     // Currently syncing
  | "offline"     // No network connection
  | "pending"     // Has local changes not yet synced
  | "error";      // Last sync failed

interface SyncStatusBarProps {
  isSyncing: boolean;
  lastSyncTime: string | null;
  hasPendingChanges?: boolean;
  onSyncPress?: () => void;
  error?: string | null;
}

export function SyncStatusBar({
  isSyncing,
  lastSyncTime,
  hasPendingChanges = false,
  onSyncPress,
  error,
}: SyncStatusBarProps) {
  const Colors = useColors();
  const [isOnline, setIsOnline] = useState(true);
  const spinValue = new Animated.Value(0);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  // Determine sync state
  const syncState: SyncState = (() => {
    if (!isOnline) return "offline";
    if (isSyncing) return "syncing";
    if (error) return "error";
    if (hasPendingChanges) return "pending";
    return "synced";
  })();

  // Spin animation for syncing
  useEffect(() => {
    if (syncState === "syncing") {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [syncState]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const formatLastSync = useCallback(() => {
    if (!lastSyncTime) return "Never synced";
    const date = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }, [lastSyncTime]);

  const config = {
    synced: {
      bg: "#3D8B5E15",
      border: "#3D8B5E30",
      text: Colors.textTertiary,
      label: `Synced ${formatLastSync()}`,
      icon: <CheckCircle2 size={13} color="#3D8B5E" />,
    },
    syncing: {
      bg: "#2D7A9C15",
      border: "#2D7A9C30",
      text: "#2D7A9C",
      label: "Syncing...",
      icon: (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <RefreshCw size={13} color="#2D7A9C" />
        </Animated.View>
      ),
    },
    offline: {
      bg: "#6B6B6B15",
      border: "#6B6B6B30",
      text: Colors.textSecondary,
      label: "Offline — changes saved locally",
      icon: <CloudOff size={13} color={Colors.textSecondary} />,
    },
    pending: {
      bg: "#D4943A15",
      border: "#D4943A30",
      text: "#D4943A",
      label: "Pending sync — tap to sync now",
      icon: <Cloud size={13} color="#D4943A" />,
    },
    error: {
      bg: "#C44D3D15",
      border: "#C44D3D30",
      text: "#C44D3D",
      label: "Sync failed — tap to retry",
      icon: <CloudOff size={13} color="#C44D3D" />,
    },
  }[syncState];

  const isInteractive = syncState === "pending" || syncState === "error";

  return (
    <TouchableOpacity
      style={[
        styles.bar,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
      ]}
      onPress={isInteractive ? onSyncPress : undefined}
      activeOpacity={isInteractive ? 0.7 : 1}
      disabled={!isInteractive}
    >
      {config.icon}
      <Text style={[styles.label, { color: config.text }]}>
        {config.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
});