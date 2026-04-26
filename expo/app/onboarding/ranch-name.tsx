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
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowRight } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";

export default function RanchNameScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { setRanchName, isSettingRanchName } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [name, setName] = useState<string>("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const trimmed = name.trim();
  const canContinue = trimmed.length > 0 && !isSettingRanchName;

  const handleContinue = useCallback(async () => {
    if (!canContinue) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await setRanchName(trimmed);
      console.log("Ranch created:", trimmed);
      router.replace("/onboarding/welcome");
    } catch (e) {
      console.log("Failed to set ranch name", e);
      Alert.alert("Couldn't save", "Please try a different name.");
    }
  }, [canContinue, setRanchName, trimmed, router]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View
            style={[
              styles.content,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={styles.brandEmoji}>🏜️</Text>
            <Text style={styles.title}>Name your ranch</Text>
            <Text style={styles.subtitle}>
              This is your home base. Every animal, calving record, and note will live here.
            </Text>

            <View style={styles.inputWrapper}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Morrison Cattle Co."
                placeholderTextColor={Colors.textTertiary}
                style={styles.input}
                autoFocus
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                maxLength={60}
                testID="ranch-name-input"
              />
            </View>

            <Text style={styles.hint}>You can change this later in Settings.</Text>
          </Animated.View>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.nextBtn,
                { backgroundColor: canContinue ? Colors.primary : Colors.border },
              ]}
              onPress={handleContinue}
              disabled={!canContinue}
              activeOpacity={0.85}
              testID="ranch-name-continue"
            >
              {isSettingRanchName ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>Continue</Text>
                  <ArrowRight size={18} color="#fff" />
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
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    safeArea: {
      flex: 1,
    },
    flex: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 56,
    },
    brandEmoji: {
      fontSize: 52,
      marginBottom: 20,
    },
    title: {
      fontSize: 30,
      fontWeight: "800" as const,
      color: Colors.text,
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 16,
      color: Colors.textSecondary,
      lineHeight: 23,
      marginBottom: 36,
    },
    inputWrapper: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    input: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: Colors.text,
      paddingVertical: 16,
    },
    hint: {
      marginTop: 14,
      fontSize: 13,
      color: Colors.textTertiary,
    },
    bottomBar: {
      paddingHorizontal: 24,
      paddingBottom: 16,
      paddingTop: 8,
    },
    nextBtn: {
      borderRadius: 14,
      paddingVertical: 16,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
    },
    nextBtnText: {
      fontSize: 17,
      fontWeight: "700" as const,
      color: "#fff",
    },
  });
}
