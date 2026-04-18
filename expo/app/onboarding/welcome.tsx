import React, { useMemo, useRef, useEffect } from "react";
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
import { Sparkles, FileUp, ArrowRight } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useOnboarding } from "@/providers/OnboardingProvider";

export default function WelcomeScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.stagger(150, [
        Animated.spring(card1Anim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.spring(card2Anim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();
  }, [fadeAnim, slideAnim, card1Anim, card2Anim]);

  const handleStartFresh = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/onboarding/guided-setup?mode=fresh");
  };

  const handleBringData = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/onboarding/import-data");
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.brandEmoji}>🐄</Text>
          <Text style={styles.title}>Welcome to RanchTrack</Text>
          <Text style={styles.subtitle}>
            Your herd management made simple.{"\n"}Let's get you set up.
          </Text>
        </Animated.View>

        <View style={styles.cardsContainer}>
          <Animated.View
            style={[
              styles.cardWrapper,
              {
                opacity: card1Anim,
                transform: [{ scale: card1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.card}
              onPress={handleStartFresh}
              activeOpacity={0.8}
              testID="start-fresh-btn"
            >
              <View style={styles.cardIconContainer}>
                <View style={[styles.cardIconBg, { backgroundColor: Colors.primary + "18" }]}>
                  <Sparkles size={28} color={Colors.primary} />
                </View>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Start Fresh</Text>
                <Text style={styles.cardDescription}>
                  No existing data? No problem. Start building your herd from scratch.
                </Text>
              </View>
              <View style={[styles.cardArrow, { backgroundColor: Colors.primary + "12" }]}>
                <ArrowRight size={18} color={Colors.primary} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={[
              styles.cardWrapper,
              {
                opacity: card2Anim,
                transform: [{ scale: card2Anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.card}
              onPress={handleBringData}
              activeOpacity={0.8}
              testID="bring-data-btn"
            >
              <View style={styles.cardIconContainer}>
                <View style={[styles.cardIconBg, { backgroundColor: Colors.accent + "18" }]}>
                  <FileUp size={28} color={Colors.accent} />
                </View>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Bring Existing Data</Text>
                <Text style={styles.cardDescription}>
                  Import from CSV, spreadsheet, or enter animals manually.
                </Text>
              </View>
              <View style={[styles.cardArrow, { backgroundColor: Colors.accent + "12" }]}>
                <ArrowRight size={18} color={Colors.accent} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            You can always add more animals and data later
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    safeArea: {
      flex: 1,
      paddingHorizontal: 24,
    },
    header: {
      alignItems: "center" as const,
      paddingTop: 48,
      paddingBottom: 40,
    },
    brandEmoji: {
      fontSize: 56,
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: "800" as const,
      color: Colors.text,
      marginBottom: 12,
      textAlign: "center" as const,
    },
    subtitle: {
      fontSize: 16,
      color: Colors.textSecondary,
      textAlign: "center" as const,
      lineHeight: 24,
    },
    cardsContainer: {
      flex: 1,
      justifyContent: "center" as const,
      gap: 16,
      paddingBottom: 40,
    },
    cardWrapper: {},
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 20,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    cardIconContainer: {
      marginRight: 16,
    },
    cardIconBg: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    cardContent: {
      flex: 1,
      marginRight: 12,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: "700" as const,
      color: Colors.text,
      marginBottom: 4,
    },
    cardDescription: {
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 19,
    },
    cardArrow: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    footer: {
      paddingBottom: 20,
      alignItems: "center" as const,
    },
    footerText: {
      fontSize: 13,
      color: Colors.textTertiary,
      textAlign: "center" as const,
    },
  });
}
