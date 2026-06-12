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
import { ArrowRight, Mail, CheckCircle } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { sendPasswordResetEmail } from "@/lib/supabase";

export default function ForgotPasswordScreen() {
 const Colors = useColors();
 const router = useRouter();
 const styles = useMemo(() => createStyles(Colors), [Colors]);

 const [email, setEmail] = useState("");
 const [isLoading, setIsLoading] = useState(false);
 const [sent, setSent] = useState(false);

 const fadeAnim = useRef(new Animated.Value(0)).current;
 const slideAnim = useRef(new Animated.Value(24)).current;

 useEffect(() => {
 Animated.parallel([
 Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
 Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
 ]).start();
 }, [fadeAnim, slideAnim]);

 const trimmedEmail = email.trim().toLowerCase();
 const canSend = trimmedEmail.includes("@") && !isLoading && !sent;

 const handleSend = useCallback(async () => {
 if (!canSend) return;
 if (Platform.OS !== "web")
 void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

 setIsLoading(true);
 try {
 await sendPasswordResetEmail(trimmedEmail);
 setSent(true);
 if (Platform.OS !== "web")
 void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
 } catch (e) {
 // Don't reveal if email exists or not for security
 // Just show success either way
 setSent(true);
 } finally {
 setIsLoading(false);
 }
 }, [canSend, trimmedEmail]);

 // ─── Success state ────────────────────────────────────────────────────────

 if (sent) {
 return (
 <View style={styles.container}>
 <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
 <Animated.View
 style={[
 styles.successContent,
 { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
 ]}
 >
 <View style={[styles.successIcon, { backgroundColor: Colors.primary + "18" }]}>
 <CheckCircle size={48} color={Colors.primary} />
 </View>
 <Text style={styles.successTitle}>Check Your Email</Text>
 <Text style={styles.successBody}>
 If an account exists for{" "}
 <Text style={{ fontWeight: "700", color: Colors.text }}>{trimmedEmail}</Text>
 {", "}a password reset link has been sent.
 </Text>
 <Text style={styles.successNote}>
 The link expires after 24 hours. Check your spam folder if you don't see it.
 </Text>
 </Animated.View>

 <View style={styles.bottomBar}>
 <TouchableOpacity
 style={[styles.btn, { backgroundColor: Colors.primary }]}
 onPress={() => router.replace("/onboarding/sign-in")}
 activeOpacity={0.85}
 >
 <Text style={styles.btnText}>Back to Sign In</Text>
 <ArrowRight size={20} color="#fff" />
 </TouchableOpacity>
 </View>
 </SafeAreaView>
 </View>
 );
 }

 // ─── Form state ───────────────────────────────────────────────────────────

 return (
 <View style={styles.container}>
 <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
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
 <View style={[styles.iconCircle, { backgroundColor: Colors.primary + "18" }]}>
 <Mail size={36} color={Colors.primary} />
 </View>

 <Text style={styles.title}>Forgot Password?</Text>
 <Text style={styles.subtitle}>
 Enter the email address you signed up with and we'll send you a link to reset your password.
 </Text>

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
 returnKeyType="done"
 onSubmitEditing={handleSend}
 autoFocus
 maxLength={80}
 />
 </View>

 <TouchableOpacity
 style={styles.backLink}
 onPress={() => router.back()}
 activeOpacity={0.7}
 >
 <Text style={styles.backLinkText}>
 Remember your password?{" "}
 <Text style={{ color: Colors.primary, fontWeight: "700" }}>Sign in</Text>
 </Text>
 </TouchableOpacity>
 </Animated.View>
 </ScrollView>

 <View style={styles.bottomBar}>
 <TouchableOpacity
 style={[
 styles.btn,
 { backgroundColor: canSend ? Colors.primary : Colors.border },
 ]}
 onPress={handleSend}
 disabled={!canSend}
 activeOpacity={0.85}
 >
 {isLoading ? (
 <ActivityIndicator color="#fff" />
 ) : (
 <>
 <Text style={styles.btnText}>Send Reset Link</Text>
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
 content: { paddingHorizontal: 24, paddingTop: 32 },

 iconCircle: {
 width: 80,
 height: 80,
 borderRadius: 24,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 marginBottom: 24,
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
 lineHeight: 24,
 marginBottom: 32,
 },
 label: {
 fontSize: 13,
 fontWeight: "800" as const,
 color: Colors.textSecondary,
 textTransform: "uppercase" as const,
 letterSpacing: 1.1,
 marginBottom: 10,
 marginLeft: 2,
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
 inputIcon: { marginRight: 10 },
 input: {
 flex: 1,
 fontSize: 17,
 fontWeight: "500" as const,
 color: Colors.text,
 paddingVertical: 16,
 },
 backLink: {
 marginTop: 16,
 alignItems: "center" as const,
 paddingVertical: 8,
 },
 backLinkText: {
 fontSize: 15,
 color: Colors.textSecondary,
 },

 // Success state
 successContent: {
 flex: 1,
 paddingHorizontal: 28,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 },
 successIcon: {
 width: 96,
 height: 96,
 borderRadius: 28,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 marginBottom: 28,
 },
 successTitle: {
 fontSize: 28,
 fontWeight: "800" as const,
 color: Colors.text,
 marginBottom: 14,
 textAlign: "center" as const,
 },
 successBody: {
 fontSize: 16,
 color: Colors.textSecondary,
 textAlign: "center" as const,
 lineHeight: 24,
 marginBottom: 16,
 },
 successNote: {
 fontSize: 13,
 color: Colors.textTertiary,
 textAlign: "center" as const,
 lineHeight: 20,
 },

 bottomBar: {
 paddingHorizontal: 24,
 paddingBottom: 16,
 paddingTop: 8,
 },
 btn: {
 borderRadius: 16,
 paddingVertical: 18,
 flexDirection: "row" as const,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 gap: 10,
 },
 btnText: {
 fontSize: 18,
 fontWeight: "800" as const,
 color: "#fff",
 letterSpacing: 0.2,
 },
 });
}
