import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
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

const LIST_COLORS = [
  "#3D8B5E",
  "#2D7A9C",
  "#C4622D",
  "#7B5EA7",
  "#D4943A",
  "#C44D3D",
  "#4A8B7A",
  "#8B6914",
  "#5A7A3A",
  "#9C4D7A",
];

export default function CreateCalvingListScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { createCalvingList } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [name, setName] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>(LIST_COLORS[0]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !isLoading;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await createCalvingList({ name: trimmedName, color: selectedColor });
      router.back();
    } catch (e) {
      console.log("[create-calving-list] error", e);
      Alert.alert("Error", "Could not create the list. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [canSave, trimmedName, selectedColor, createCalvingList, router]);

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
              <Text style={styles.label}>List Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Spring Heifers, North Pasture..."
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.input}
                  autoCapitalize="words"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  maxLength={50}
                  testID="calving-list-name-input"
                />
              </View>

              <Text style={styles.label}>Color</Text>
              <View style={styles.colorGrid}>
                {LIST_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorSwatchSelected,
                    ]}
                    onPress={() => {
                      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedColor(color);
                    }}
                    activeOpacity={0.8}
                    testID={`color-${color}`}
                  >
                    {selectedColor === color && (
                      <Text style={styles.colorCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Preview</Text>
              <View style={styles.previewCard}>
                <View style={[styles.previewDot, { backgroundColor: selectedColor }]} />
                <Text style={styles.previewName} numberOfLines={1}>
                  {trimmedName || "List Name"}
                </Text>
                <Text style={styles.previewCount}>0 records</Text>
              </View>
            </Animated.View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: canSave ? selectedColor : Colors.border },
              ]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.85}
              testID="create-calving-list-save"
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.saveBtnText}>Create List</Text>
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
    content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
    label: {
      fontSize: 13,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 1.1,
      marginBottom: 10,
      marginLeft: 2,
      marginTop: 20,
    },
    inputWrapper: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: Colors.border,
      paddingHorizontal: 16,
    },
    input: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: Colors.text,
      paddingVertical: 16,
    },
    colorGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 12,
    },
    colorSwatch: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    colorSwatchSelected: {
      borderWidth: 3,
      borderColor: "#fff",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    colorCheck: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "800" as const,
    },
    previewCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    previewDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    previewName: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700" as const,
      color: Colors.text,
    },
    previewCount: {
      fontSize: 13,
      color: Colors.textTertiary,
      fontWeight: "500" as const,
    },
    bottomBar: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      paddingTop: 8,
    },
    saveBtn: {
      borderRadius: 16,
      paddingVertical: 18,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 10,
    },
    saveBtnText: {
      fontSize: 18,
      fontWeight: "800" as const,
      color: "#fff",
      letterSpacing: 0.2,
    },
  });
}
