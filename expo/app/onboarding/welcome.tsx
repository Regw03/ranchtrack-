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
import { ArrowRight, LogIn } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCurrentAuthUserId } from "@/lib/supabase";

const AUTH_STORAGE_KEY = "ranchtrack_auth_user_id";

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

    // Check if user is already authenticated — if so skip straight past welcome
    (async () => {
      try {
        const [storedId, authId] = await Promise.all([
          AsyncStorage.getItem(AUTH_STORAGE_KEY),
          getCurrentAuthUserId(),
        ]);
        if (storedId && authId) {
          // Already logged in — the app layout will handle routing to dashboard
          console.log("[welcome] user already authenticated, skipping welcome");
        }
      } catch (e) {
        console.log("[welcome] auth check failed", e);
      }
    })();
  }, [fadeAnim, slideAnim, emojiScale]);

  // --- New ranch: go to sign-up first, then ranch setup ---
  const handleGetStarted = useCallback(async () => {
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // If already authenticated, skip sign-up and go straight to ranch name
      const authId = await getCurrentAuthUserId();
      if (authId) {
        router.push("/onboarding/ranch-name");
      } else {
        router.push("/onboarding/sign-up");
      }
    } catch {
      router.push("/onboarding/sign-up");
    }
  }, [router]);

  // --- Join ranch: go to sign-up first, then join ---
  const handleJoinRanch = useCallback(async () => {
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const authId = await getCurrentAuthUserId();
      if (authId) {
        router.push("/onboarding/join-ranch");
      } else {
        // Store intent so sign-up knows to redirect to join-ranch after
        await AsyncStorage.setItem("ranchtrack_auth_intent", "join");
        router.push("/onboarding/sign-up");
      }
    } catch {
      await AsyncStorage.setItem("ranchtrack_auth_intent", "join");
      router.push("/onboarding/sign-up");
    }
  }, [router]);

  // --- Returning user: go straight to sign-in ---
  const handleSignIn = useCallback(() => {
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/onboarding/sign-in");
  }, [router]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View
            style={[styles.heroBlock, { transform: [{ scale: emojiScale }] }]}
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
              Track your herd, calving, and work — fast and simple.
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.bottomBar,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Primary: Create a new ranch */}
          <TouchableOpacity
            style={styles.cta}
            onPress={handleGetStarted}
            activeOpacity={0.85}
            testID="welcome-get-started"
          >
            <Text style={styles.ctaText}>Create a New Ranch</Text>
            <ArrowRight size={22} color="#fff" />
          </TouchableOpacity>

          {/* Secondary: Join an existing ranch */}
          <TouchableOpacity
            style={styles.secondaryCta}
            onPress={handleJoinRanch}
            activeOpacity={0.7}
            testID="welcome-join-ranch"
          >
            <Text style={styles.secondaryCtaText}>Join an existing ranch</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>already have an account?</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Sign in for returning users */}
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={handleSignIn}
            activeOpacity={0.7}
            testID="welcome-sign-in"
          >
            <LogIn size={18} color={Colors.primary} />
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </Animated.View>
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
      paddingBottom: 24,
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
    dividerRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginTop: 20,
      marginBottom: 16,
      gap: 10,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: Colors.border,
    },
    dividerText: {
      fontSize: 12,
      color: Colors.textTertiary,
      fontWeight: "600" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
    },
    signInBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
      paddingVertical: 16,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    signInBtnText: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: Colors.primary,
    },
  });
}
