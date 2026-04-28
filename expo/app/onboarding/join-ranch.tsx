import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowRight, Users } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { useOnboarding } from "@/providers/OnboardingProvider";

export default function JoinRanchScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { joinRanch, isJoiningRanch, ranch } = useRanch();
  const { completeOnboarding, isOnboardingComplete } = useOnboarding();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [userName, setUserName] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const trimmedUser = userName.trim();
  const trimmedCode = code.trim().toUpperCase();
  const canContinue =
    trimmedUser.length > 0 && trimmedCode.length >= 4 && !isJoiningRanch;

  const handleJoin = useCallback(async () => {
    if (!canContinue) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await joinRanch({ userName: trimmedUser, code: trimmedCode });
      await completeOnboarding();
      console.log("[join-ranch] joined", trimmedCode);
    } catch (e) {
      console.log("[join-ranch] failed to join", e);
      Alert.alert(
        "Couldn't join",
        e instanceof Error ? e.message : "Please check the code and try again.",
      );
    }
  }, [canContinue, joinRanch, completeOnboarding, trimmedUser, trimmedCode]);

  useEffect(() => {
    if (isOnboardingComplete && !!ranch?.id && !!ranch?.name) {
      console.log("[join-ranch] state ready, navigating to dashboard");
      router.replace("/(tabs)/dashboard");
    }
  }, [isOnboardingComplete, ranch?.id, ranch?.name, router]);

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
              <View style={styles.iconCircle}>
                <Users size={36} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Join an existing ranch</Text>
              <Text style={styles.subtitle}>
                Enter the invite code from your ranch owner or manager.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Your Name</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={userName}
                    onChangeText={setUserName}
                    placeholder="e.g. Casey Brooks"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="next"
                    maxLength={40}
                    testID="join-user-name-input"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Invite Code</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={code}
                    onChangeText={(t) => setCode(t.toUpperCase())}
                    placeholder="e.g. AB23XK"
                    placeholderTextColor={Colors.textTertiary}
                    style={[styles.input, styles.codeInput]}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleJoin}
                    maxLength={12}
                    testID="join-code-input"
                  />
                </View>
              </View>

              <Text style={styles.hint}>
                Don&apos;t have a code? Ask your ranch owner to share it from
                their Settings.
              </Text>
            </Animated.View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.nextBtn,
                { backgroundColor: canContinue ? Colors.primary : Colors.border },
              ]}
              onPress={handleJoin}
              disabled={!canContinue}
              activeOpacity={0.85}
              testID="join-continue"
            >
              {isJoiningRanch ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>Join Ranch</Text>
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
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
    iconCircle: {
      width: 76,
      height: 76,
      borderRadius: 22,
      backgroundColor: Colors.primary + "18",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 22,
    },
    title: {
      fontSize: 30,
      fontWeight: "800" as const,
      color: Colors.text,
      marginBottom: 12,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 16,
      color: Colors.textSecondary,
      lineHeight: 23,
      marginBottom: 32,
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
    codeInput: {
      letterSpacing: 4,
      fontSize: 22,
      fontWeight: "800" as const,
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
