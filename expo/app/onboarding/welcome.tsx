import React, { useMemo, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowRight } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";

export default function WelcomeScreen() {
  const Colors = useColors();
  const router = useRouter();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const emojiScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(emojiScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeAnim, slideAnim, emojiScale]);

  const handleGetStarted = useCallback(() => {
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/onboarding/ranch-name");
  }, [router]);

  const handleJoinRanch = useCallback(() => {
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/onboarding/join-ranch");
  }, [router]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.heroBlock,
              { transform: [{ scale: emojiScale }] },
            ]}
          >
            <View style={styles.emojiCircle}>
              <Text style={styles.brandEmoji}>🐂</Text>
            </View>
          </Animated.View>

          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <Text style={styles.title}>Ranch Tracker</Text>
            <Text style={styles.subtitle}>
              Track your herd, calving, and work—fast and simple.
            </Text>
          </Animated.View>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.cta}
            onPress={handleGetStarted}
            activeOpacity={0.85}
            testID="welcome-get-started"
          >
            <Text style={styles.ctaText}>Create a New Ranch</Text>
            <ArrowRight size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryCta}
            onPress={handleJoinRanch}
            activeOpacity={0.7}
            testID="welcome-join-ranch"
          >
            <Text style={styles.secondaryCtaText}>Join an existing ranch</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    safeArea: { flex: 1 },
    content: {
      flex: 1,
      paddingHorizontal: 28,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    heroBlock: {
      marginBottom: 36,
    },
    emojiCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: Colors.primary + "14",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    brandEmoji: {
      fontSize: 64,
    },
    title: {
      fontSize: 38,
      fontWeight: "800" as const,
      color: Colors.text,
      letterSpacing: -0.8,
      textAlign: "center" as const,
      marginBottom: 14,
    },
    subtitle: {
      fontSize: 17,
      color: Colors.textSecondary,
      textAlign: "center" as const,
      lineHeight: 25,
      paddingHorizontal: 8,
    },
    bottomBar: {
      paddingHorizontal: 24,
      paddingBottom: 20,
      paddingTop: 8,
    },
    cta: {
      backgroundColor: Colors.primary,
      borderRadius: 18,
      paddingVertical: 20,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 12,
    },
    ctaText: {
      fontSize: 19,
      fontWeight: "800" as const,
      color: "#fff",
      letterSpacing: 0.2,
    },
    secondaryCta: {
      marginTop: 14,
      paddingVertical: 14,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    secondaryCtaText: {
      fontSize: 15,
      fontWeight: "700" as const,
      color: Colors.primary,
      letterSpacing: 0.2,
    },
  });
}
