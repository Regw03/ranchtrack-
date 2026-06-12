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
import { ArrowRight, Mail, Lock, Home } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { signInWithEmail, resendConfirmationEmail } from "@/lib/supabase";
import { useRanch } from "@/providers/RanchProvider";
import { useOnboarding } from "@/providers/OnboardingProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_STORAGE_KEY = "ranchtrack_auth_user_id";

export default function SignInScreen() {
  const Colors = useColors();
  const router = useRouter();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const { ranch, refreshRanch } = useRanch();
  const { completeOnboarding, isOnboardingComplete } = useOnboarding();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (isOnboardingComplete && !!ranch?.id && !!ranch?.name) {
      router.replace("/(tabs)/dashboard");
    }
  }, [isOnboardingComplete, ranch?.id, ranch?.name, router]);

  const trimmedEmail = email.trim().toLowerCase();
  const canContinue =
    trimmedEmail.includes("@") &&
    password.length >= 6 &&
    !isLoading;

  const handleResendConfirmation = useCallback(async () => {
    if (!trimmedEmail.includes("@")) {
      Alert.alert("Email Required", "Please enter your email address above first.");
      return;
    }
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsResending(true);
    try {
      await resendConfirmationEmail(trimmedEmail);
      Alert.alert(
        "Confirmation Email Sent",
        `We've sent a new confirmation link to ${trimmedEmail}. Please check your inbox (and spam folder).`,
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not resend confirmation email.";
      const lower = message.toLowerCase();
      const friendly = lower.includes("rate")
        ? "Too many requests. Please wait a minute and try again."
        : message;
      Alert.alert("Resend Failed", friendly);
    } finally {
      setIsResending(false);
    }
  }, [trimmedEmail]);

  const handleSignIn = useCallback(async () => {
    if (!canContinue) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setIsLoading(true);
    try {
      const userId = await signInWithEmail(trimmedEmail, password);

      await AsyncStorage.setItem(AUTH_STORAGE_KEY, userId);
      await AsyncStorage.setItem("ranchtrack_current_user_id", userId);

      try {
        await refreshRanch();
      } catch (e) {
        console.log("[sign-in] refreshRanch failed, may need to join a ranch", e);
      }

      await completeOnboarding();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Something went wrong. Please try again.";
      const lower = message.toLowerCase();
      if (lower.includes("confirm") || lower.includes("not confirmed")) {
        Alert.alert(
          "Email Not Confirmed",
          "Please confirm your email before signing in. Would you like us to resend the confirmation email?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Resend",
              onPress: () => {
                void handleResendConfirmation();
              },
            },
          ],
        );
      } else {
        Alert.alert("Sign In Failed", message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [canContinue, trimmedEmail, password, refreshRanch, completeOnboarding, handleResendConfirmation]);

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
                <Home size={36} color={Colors.primary} />
              </View>

              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                Sign in to access your ranch from this device.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <Mail size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                    maxLength={80}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Lock size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Your password"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={handleSignIn}
                    maxLength={60}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => router.push("/onboarding/forgot-password")}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotLinkText}>
                  Forgot your password?{" "}
                  <Text style={{ color: Colors.primary, fontWeight: "700" }}>Reset it</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.signUpLink}
                onPress={() => router.push("/onboarding/sign-up")}
                activeOpacity={0.7}
              >
                <Text style={styles.signUpLinkText}>
                  Don&apos;t have an account?{" "}
                  <Text style={{ color: Colors.primary, fontWeight: "700" }}>
                    Create one
                  </Text>
                </Text>
              </TouchableOpacity>

              <Text style={styles.hint}>
                Use the same email and password you signed up with on your other device.
              </Text>

              <TouchableOpacity
                style={styles.resendLink}
                onPress={handleResendConfirmation}
                activeOpacity={0.7}
                disabled={isResending}
                testID="resend-confirmation"
              >
                {isResending ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <Text style={styles.resendLinkText}>
                    Didn&apos;t get the confirmation email?{" "}
                    <Text style={{ color: Colors.primary, fontWeight: "700" }}>
                      Resend it
                    </Text>
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.nextBtn,
                { backgroundColor: canContinue ? Colors.primary : Colors.border },
              ]}
              onPress={handleSignIn}
              disabled={!canContinue}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>Sign In</Text>
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
    fieldGroup: { marginBottom: 20 },
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
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: Colors.border,
      paddingHorizontal: 16,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontSize: 17,
      fontWeight: "500" as const,
      color: Colors.text,
      paddingVertical: 16,
    },
    forgotLink: {
      alignItems: "center" as const,
      paddingVertical: 8,
      marginTop: 8,
    },
    forgotLinkText: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    signUpLink: {
      marginTop: 4,
      marginBottom: 16,
      alignItems: "center" as const,
      paddingVertical: 8,
    },
    signUpLinkText: {
      fontSize: 15,
      color: Colors.textSecondary,
    },
    resendLink: {
      marginTop: 18,
      alignItems: "center" as const,
      paddingVertical: 10,
    },
    resendLinkText: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center" as const,
    },
    hint: {
      fontSize: 13,
      color: Colors.textTertiary,
      textAlign: "center" as const,
      lineHeight: 20,
      paddingHorizontal: 8,
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
