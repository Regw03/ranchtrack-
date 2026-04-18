import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Plus, Trash2, Check } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";

type AnimalType = "cow" | "calf" | "bull" | "unknown";

interface ManualAnimalEntry {
  id: string;
  tagNumber: string;
  animalType: AnimalType;
}

const ANIMAL_TYPES: { value: AnimalType; label: string; emoji: string }[] = [
  { value: "cow", label: "Cow", emoji: "🐄" },
  { value: "calf", label: "Calf", emoji: "🐮" },
  { value: "bull", label: "Bull", emoji: "🐃" },
  { value: "unknown", label: "Unknown", emoji: "❓" },
];

let entryCounter = 0;
function makeEntryId() {
  entryCounter++;
  return `entry-${Date.now()}-${entryCounter}`;
}

export default function ManualEntryScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { addAnimal, activeBusinessYearId } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [entries, setEntries] = useState<ManualAnimalEntry[]>([
    { id: makeEntryId(), tagNumber: "", animalType: "cow" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const addEntry = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEntries((prev) => [...prev, { id: makeEntryId(), tagNumber: "", animalType: "cow" }]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const updateTag = useCallback((id: string, tag: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, tagNumber: tag } : e)));
  }, []);

  const updateType = useCallback((id: string, type: AnimalType) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, animalType: type } : e)));
  }, []);

  const validEntries = useMemo(
    () => entries.filter((e) => e.tagNumber.trim().length > 0),
    [entries],
  );

  const handleSave = useCallback(async () => {
    if (validEntries.length === 0) {
      Alert.alert("No Animals", "Please enter at least one tag number.");
      return;
    }
    setIsSaving(true);
    try {
      for (const entry of validEntries) {
        const sex = (() => {
          switch (entry.animalType) {
            case "cow": return "female" as const;
            case "bull": return "male" as const;
            case "calf": return "female" as const;
            default: return "female" as const;
          }
        })();

        await addAnimal({
          tagId: entry.tagNumber.trim(),
          species: "cattle",
          breed: "Unknown",
          birthDate: new Date().toISOString().split("T")[0],
          sex,
          notes: "",
          status: "active",
          markedForSale: false,
          businessYearId: activeBusinessYearId,
          identityStatus: "unknown",
        });
      }

      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log(`Manually added ${validEntries.length} animals`);
      router.push("/onboarding/guided-setup?mode=manual");
    } catch (err) {
      console.log("Manual entry error:", err);
      Alert.alert("Error", "Something went wrong while adding animals.");
    } finally {
      setIsSaving(false);
    }
  }, [validEntries, addAnimal, activeBusinessYearId, router]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Quick Add Animals</Text>
          <View style={styles.backBtn} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.hint}>
              Add your animals quickly — just tag number and type. You can fill in details later.
            </Text>

            {entries.map((entry, index) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryNumber}>#{index + 1}</Text>
                  {entries.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeEntry(entry.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={18} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.fieldLabel}>Tag Number *</Text>
                <TextInput
                  style={styles.input}
                  value={entry.tagNumber}
                  onChangeText={(text) => updateTag(entry.id, text)}
                  placeholder="e.g. 42, A-103, Red Dot"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="characters"
                  testID={`tag-input-${index}`}
                />

                <Text style={styles.fieldLabel}>Animal Type</Text>
                <View style={styles.typeRow}>
                  {ANIMAL_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeChip,
                        entry.animalType === type.value && styles.typeChipActive,
                        entry.animalType === type.value && { borderColor: Colors.primary },
                      ]}
                      onPress={() => updateType(entry.id, type.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.typeEmoji}>{type.emoji}</Text>
                      <Text
                        style={[
                          styles.typeLabel,
                          entry.animalType === type.value && { color: Colors.primary, fontWeight: "700" as const },
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addMoreBtn}
              onPress={addEntry}
              activeOpacity={0.7}
              testID="add-more-btn"
            >
              <Plus size={18} color={Colors.primary} />
              <Text style={styles.addMoreText}>Add Another Animal</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.saveBtn, (validEntries.length === 0 || isSaving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={validEntries.length === 0 || isSaving}
              activeOpacity={0.8}
              testID="save-animals-btn"
            >
              <Check size={20} color="#fff" />
              <Text style={styles.saveBtnText}>
                {isSaving
                  ? "Saving..."
                  : `Save ${validEntries.length} Animal${validEntries.length !== 1 ? "s" : ""}`}
              </Text>
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
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: Colors.text,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    hint: {
      fontSize: 14,
      color: Colors.textTertiary,
      lineHeight: 20,
      marginBottom: 20,
      marginTop: 4,
    },
    entryCard: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    entryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    entryNumber: {
      fontSize: 13,
      fontWeight: "700",
      color: Colors.textTertiary,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.textSecondary,
      marginBottom: 6,
    },
    input: {
      backgroundColor: Colors.backgroundDark,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: Colors.text,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    typeRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    typeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: Colors.backgroundDark,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    typeChipActive: {
      backgroundColor: Colors.primary + "10",
    },
    typeEmoji: {
      fontSize: 16,
    },
    typeLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontWeight: "500" as const,
    },
    addMoreBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Colors.primary + "30",
      borderStyle: "dashed",
      marginTop: 4,
    },
    addMoreText: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.primary,
    },
    bottomBar: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      backgroundColor: Colors.background,
    },
    saveBtn: {
      backgroundColor: Colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
    },
  });
}
