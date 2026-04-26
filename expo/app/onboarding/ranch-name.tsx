import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowRight } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { useOnboarding } from "@/providers/OnboardingProvider";

export default function RanchSetupScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { setupRanch, isSettingUpRanch } = useRanch();
  const { completeOnboarding } = useOnboarding();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [userName, setUserName] = useState<string>("");
  const [ranchName, setRanchName] = useState<string>("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const trimmedUser = userName.trim();
  const trimmedRanch = ranchName.trim();
  const canContinue =
    trimmedUser.length > 0 && trimmedRanch.length > 0 && !isSettingUpRanch;

  const handleContinue = useCallback(async () => {
    if (!canContinue) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await setupRanch({ userName: trimmedUser, ranchName: trimmedRanch });
      completeOnboarding();
      console.log("Setup complete:", trimmedUser, "@", trimmedRanch);
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      console.log("Failed to set up ranch", e);
      Alert.alert("Couldn't save", "Please try again.");
    }
  }, [canContinue, setupRanch, completeOnboarding, trimmedUser, trimmedRanch, router]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.content,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <Text style={styles.brandEmoji}>🏜️</Text>
              <Text style={styles.title}>Let&apos;s set up your ranch</Text>
              <Text style={styles.subtitle}>
                A couple quick details and you&apos;re ready to start tracking.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Your Name</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={userName}
                    onChangeText={setUserName}
                    placeholder="e.g. Jake Morrison"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="next"
                    maxLength={40}
                    testID="user-name-input"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Ranch Name</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={ranchName}
                    onChangeText={setRanchName}
                    placeholder="e.g. Morrison Cattle Co."
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={handleContinue}
                    maxLength={60}
                    testID="ranch-name-input"
                  />
                </View>
              </View>

              <Text style={styles.hint}>
                You can change these later in your Ranch Profile.
              </Text>
            </Animated.View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.nextBtn,
                { backgroundColor: canContinue ? Colors.primary : Colors.border },
              ]}
              onPress={handleContinue}
              disabled={!canContinue}
              activeOpacity={0.85}
              testID="setup-continue"
            >
              {isSettingUpRanch ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>Get Started</Text>
                  <ArrowRight size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    safeArea: { flex: 1 },
    flex: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 48 },
    brandEmoji: { fontSize: 56, marginBottom: 24 },
    title: {
      fontSize: 32,
      fontWeight: "800" as const,
      color: Colors.text,
      marginBottom: 12,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 16,
      color: Colors.textSecondary,
      lineHeight: 23,
      marginBottom: 40,
    },
    fieldGroup: { marginBottom: 22 },
    label: {
      fontSize: 13,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 1.1,
      marginBottom: 10,
      marginLeft: 4,
    },
    inputWrapper: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: Colors.border,
      paddingHorizontal: 18,
    },
    input: {
      fontSize: 19,
      fontWeight: "600" as const,
      color: Colors.text,
      paddingVertical: 18,
    },
    hint: {
      marginTop: 8,
      fontSize: 13,
      color: Colors.textTertiary,
      textAlign: "center" as const,
    },
    bottomBar: {
      paddingHorizontal: 24,
      paddingBottom: 16,
      paddingTop: 8,
    },
    nextBtn: {
      borderRadius: 16,
      paddingVertical: 18,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 10,
    },
    nextBtnText: {
      fontSize: 18,
      fontWeight: "800" as const,
      color: "#fff",
      letterSpacing: 0.2,
    },
  });
}
