import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View, Platform } from "react-native";
import { UserCheck } from "lucide-react-native";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { ThemeColors } from "@/constants/colors";

export default function UserSwitchToast() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const { userSwitchToast, dismissUserSwitchToast } = useRanch();

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (!userSwitchToast) return;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateY, {
          toValue: -12,
          duration: 220,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start(() => {
        dismissUserSwitchToast();
      });
    }, 2400);

    return () => clearTimeout(t);
  }, [userSwitchToast, opacity, translateY, dismissUserSwitchToast]);

  if (!userSwitchToast) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { opacity, transform: [{ translateY }] }]}
      testID="user-switch-toast"
    >
      <View style={styles.pill}>
        <View style={styles.iconWrap}>
          <UserCheck size={14} color="#fff" />
        </View>
        <Text style={styles.text} numberOfLines={1}>
          Now using <Text style={styles.name}>{userSwitchToast.name}</Text>
        </Text>
      </View>
    </Animated.View>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      position: "absolute" as const,
      top: 8,
      left: 0,
      right: 0,
      alignItems: "center" as const,
      zIndex: 50,
    },
    pill: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: Colors.text,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 8,
    },
    iconWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: Colors.primary,
    },
    text: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: Colors.background,
      letterSpacing: 0.1,
    },
    name: {
      fontWeight: "800" as const,
      color: "#fff",
    },
  });
}
