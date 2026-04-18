import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Check, ArrowRight, Baby, Syringe, Stethoscope } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useOnboarding, RanchConfig } from "@/providers/OnboardingProvider";

interface SetupQuestion {
  id: keyof RanchConfig;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export default function GuidedSetupScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { saveConfig, completeOnboarding } = useOnboarding();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [config, setConfig] = useState<RanchConfig>({
    trackCalvingGroups: true,
    trackProcessing: true,
    trackDoctoring: true,
  });
  const [currentIndex, setCurrentIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const questions: SetupQuestion[] = useMemo(
    () => [
      {
        id: "trackCalvingGroups",
        title: "Do you track calving groups?",
        description:
          "Organize cows into calving groups to track pregnancies, due dates, and new calves by season.",
        icon: <Baby size={32} color={Colors.primary} />,
      },
      {
        id: "trackProcessing",
        title: "Do you run seasonal processing?",
        description:
          "Schedule and track vaccinations, blood tests, and other herd health events for groups of animals.",
        icon: <Syringe size={32} color={Colors.accent} />,
      },
      {
        id: "trackDoctoring",
        title: "Do you track doctoring events?",
        description:
          "Log individual treatments, injuries, and follow-up care for animals that need attention.",
        icon: <Stethoscope size={32} color={Colors.success} />,
      },
    ],
    [Colors],
  );

  const current = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progress = (currentIndex + 1) / questions.length;

  const animateTransition = (direction: "forward") => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: direction === "forward" ? -30 : 30, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setCurrentIndex((prev) => prev + 1);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleToggle = (value: boolean) => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfig((prev) => ({ ...prev, [current.id]: value }));
  };

  const handleNext = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isLast) {
      saveConfig(config);
      completeOnboarding();
      router.dismissAll();
      router.replace("/");
    } else {
      animateTransition("forward");
    }
  };

  const handleSkip = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveConfig(config);
    completeOnboarding();
    router.dismissAll();
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: Colors.primary }]} />
          </View>
          <Text style={styles.progressLabel}>
            {currentIndex + 1} of {questions.length}
          </Text>
        </View>

        <View style={styles.content}>
          <Animated.View
            style={[
              styles.questionContainer,
              { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
            ]}
          >
            <View style={[styles.iconBg, { backgroundColor: Colors.surface }]}>
              {current.icon}
            </View>
            <Text style={styles.questionTitle}>{current.title}</Text>
            <Text style={styles.questionDescription}>{current.description}</Text>

            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  config[current.id] === true && styles.toggleOptionActive,
                  config[current.id] === true && { borderColor: Colors.primary },
                ]}
                onPress={() => handleToggle(true)}
                activeOpacity={0.7}
                testID="toggle-yes"
              >
                {config[current.id] === true && (
                  <View style={[styles.toggleCheck, { backgroundColor: Colors.primary }]}>
                    <Check size={14} color="#fff" />
                  </View>
                )}
                <Text
                  style={[
                    styles.toggleText,
                    config[current.id] === true && { color: Colors.primary, fontWeight: "700" as const },
                  ]}
                >
                  Yes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  config[current.id] === false && styles.toggleOptionActive,
                  config[current.id] === false && { borderColor: Colors.textSecondary },
                ]}
                onPress={() => handleToggle(false)}
                activeOpacity={0.7}
                testID="toggle-no"
              >
                {config[current.id] === false && (
                  <View style={[styles.toggleCheck, { backgroundColor: Colors.textSecondary }]}>
                    <Check size={14} color="#fff" />
                  </View>
                )}
                <Text
                  style={[
                    styles.toggleText,
                    config[current.id] === false && { color: Colors.textSecondary, fontWeight: "700" as const },
                  ]}
                >
                  Not right now
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleNext}
            activeOpacity={0.8}
            testID="next-btn"
          >
            <Text style={styles.nextBtnText}>{isLast ? "Get Started" : "Next"}</Text>
            <ArrowRight size={18} color="#fff" />
          </TouchableOpacity>
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
    },
    topBar: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    skipBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    skipText: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textTertiary,
    },
    progressContainer: {
      paddingHorizontal: 24,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    progressTrack: {
      flex: 1,
      height: 4,
      backgroundColor: Colors.border,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 2,
    },
    progressLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.textTertiary,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    questionContainer: {
      alignItems: "center",
    },
    iconBg: {
      width: 80,
      height: 80,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 28,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    questionTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: Colors.text,
      textAlign: "center",
      marginBottom: 12,
    },
    questionDescription: {
      fontSize: 15,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 36,
      paddingHorizontal: 8,
    },
    toggleRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
    },
    toggleOption: {
      flex: 1,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      paddingVertical: 18,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: Colors.border,
      flexDirection: "row",
      gap: 8,
    },
    toggleOptionActive: {
      backgroundColor: Colors.surface,
    },
    toggleCheck: {
      width: 22,
      height: 22,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    toggleText: {
      fontSize: 16,
      fontWeight: "500",
      color: Colors.textSecondary,
    },
    bottomBar: {
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    nextBtn: {
      backgroundColor: Colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    nextBtnText: {
      fontSize: 17,
      fontWeight: "700",
      color: "#fff",
    },
  });
}
