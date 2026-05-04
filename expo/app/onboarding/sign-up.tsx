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
import { ArrowRight, Mail, Lock, User } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { signUpWithEmail, signInWithEmail } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_STORAGE_KEY = "ranchtrack_auth_user_id";

export default function SignUpScreen() {
  const Colors = useColors();
  const router = useRouter();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const canContinue =
    trimmedName.length > 0 &&
    trimmedEmail.includes("@") &&
    password.length >= 6 &&
    password === confirmPassword &&
    !isLoading;

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  const handleSignUp = useCallback(async () => {
    if (!canContinue) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setIsLoading(true);
    try {
      let userId: string | null = null;
      let signUpError: unknown = null;

      // Try creating the account first
      try {
        userId = await signUpWithEmail(trimmedEmail, password);
      } catch (e) {
        signUpError = e;
      }

      // Always try to sign in afterwards. This handles three cases gracefully:
      //   1. Sign-up succeeded but no session (email confirmation enabled).
      //   2. The email is already registered — user is just signing back in.
      //   3. Sign-up rate-limited but the account may already exist.
      try {
        const signedInId = await signInWithEmail(trimmedEmail, password);
        if (signedInId) userId = signedInId;
      } catch (signInErr) {
        console.log("[sign-up] post-signup signIn failed", signInErr);
      }

      // If we still don't have a user ID, surface the most useful error
      if (!userId) {
        const raw =
          signUpError instanceof Error
            ? signUpError.message
            : "Something went wrong. Please try again.";
        const lower = raw.toLowerCase();

        let friendly = raw;
        if (lower.includes("rate limit") || lower.includes("rate-limit")) {
          friendly =
            "Too many sign-up attempts right now. Please wait an hour and try again, or use a different email address.";
        } else if (lower.includes("already registered") || lower.includes("already exists")) {
          friendly =
            "This email is already registered. Please tap 'Sign in' below to log in instead.";
        } else if (lower.includes("email not confirmed") || lower.includes("confirm")) {
          friendly =
            "Please check your email and confirm your address before signing in.";
        }
        throw new Error(friendly);
      }

      await AsyncStorage.setItem(AUTH_STORAGE_KEY, userId);
      await AsyncStorage.setItem("ranchtrack_current_user_id", userId);
      await AsyncStorage.setItem("ranchtrack_pending_user_name", trimmedName);

      // Route based on the intent stored when the user tapped a button on welcome
      const intent = await AsyncStorage.getItem("ranchtrack_auth_intent");
      await AsyncStorage.removeItem("ranchtrack_auth_intent");

      if (intent === "join") {
        router.replace("/onboarding/join-ranch");
      } else {
        router.replace("/onboarding/ranch-name");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      Alert.alert("Sign Up Failed", message);
    } finally {
      setIsLoading(false);
    }
  }, [canContinue, trimmedEmail, trimmedName, password, router]);

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
                <User size={36} color={Colors.primary} />
              </View>

              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>
                Your account lets you access your ranch from any device.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Your Name</Text>
                <View style={styles.inputWrapper}>
                  <User size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Casey Brooks"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="next"
                    maxLength={40}
                  />
                </View>
              </View>

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
                    placeholder="At least 6 characters"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    secureTextEntry
                    returnKeyType="next"
                    maxLength={60}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={[
                  styles.inputWrapper,
                  !passwordsMatch && { borderColor: "#C44D3D" },
                ]}>
                  <Lock size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter your password"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.input}
                    secureTextEntry
                    returnKeyType="done"
                    onSubmitEditing={handleSignUp}
                    maxLength={60}
                  />
                </View>
                {!passwordsMatch && (
                  <Text style={styles.errorText}>Passwords do not match</Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.signInLink}
                onPress={() => router.push("/onboarding/sign-in")}
                activeOpacity={0.7}
              >
                <Text style={styles.signInLinkText}>
                  Already have an account?{" "}
                  <Text style={{ color: Colors.primary, fontWeight: "700" }}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.nextBtn,
                { backgroundColor: canContinue ? Colors.primary : Colors.border },
              ]}
              onPress={handleSignUp}
              disabled={!canContinue}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>Create Account</Text>
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
    errorText: {
      fontSize: 13,
      color: "#C44D3D",
      marginTop: 6,
      marginLeft: 4,
    },
    signInLink: {
      marginTop: 8,
      alignItems: "center" as const,
      paddingVertical: 8,
    },
    signInLinkText: {
      fontSize: 15,
      color: Colors.textSecondary,
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
