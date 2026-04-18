import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Switch,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { X, Check, Stethoscope } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { getAnimalDisplayName } from "@/mocks/animals";
import { DoctoringEventType } from "@/types";

const EVENT_TYPES: { value: DoctoringEventType; label: string; emoji: string }[] = [
  { value: "injury", label: "Injury", emoji: "🩹" },
  { value: "illness", label: "Illness", emoji: "🤒" },
  { value: "lameness", label: "Lameness", emoji: "🦿" },
  { value: "infection", label: "Infection", emoji: "🦠" },
  { value: "custom", label: "Other", emoji: "📋" },
];

export default function LogDoctoringEventScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const { getAnimalById, addDoctoringEvent, isAddingDoctoringEvent } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const animal = useMemo(() => getAnimalById(animalId ?? ""), [getAnimalById, animalId]);

  const [type, setType] = useState<DoctoringEventType>("illness");
  const [customTypeName, setCustomTypeName] = useState("");
  const [notes, setNotes] = useState("");
  const [treatment, setTreatment] = useState("");
  const [followUpNeeded, setFollowUpNeeded] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const handleSave = useCallback(async () => {
    if (!animalId) return;
    if (type === "custom" && !customTypeName.trim()) {
      Alert.alert("Missing Info", "Please enter a name for the custom event type.");
      return;
    }

    try {
      await addDoctoringEvent({
        animalId,
        date: today,
        type,
        customTypeName: type === "custom" ? customTypeName.trim() : undefined,
        notes: notes.trim(),
        treatment: treatment.trim() || undefined,
        followUpNeeded,
        resolved: false,
      });
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.log("Error logging doctoring event:", e);
      Alert.alert("Error", "Failed to log doctoring event. Please try again.");
    }
  }, [animalId, type, customTypeName, notes, treatment, followUpNeeded, today, addDoctoringEvent, router]);

  if (!animal) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Doctor Animal" }} />
        <Text style={styles.errorText}>Animal not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: `Doctor ${getAnimalDisplayName(animal)}` }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.animalHeader}>
          <Stethoscope size={20} color={Colors.accent} />
          <Text style={styles.animalHeaderText}>{getAnimalDisplayName(animal)}</Text>
          <Text style={styles.dateText}>{today}</Text>
        </View>

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeGrid}>
          {EVENT_TYPES.map((et) => (
            <TouchableOpacity
              key={et.value}
              style={[styles.typeChip, type === et.value && styles.typeChipActive]}
              onPress={() => {
                setType(et.value);
                if (Platform.OS !== "web") void Haptics.selectionAsync();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.typeEmoji}>{et.emoji}</Text>
              <Text style={[styles.typeChipText, type === et.value && styles.typeChipTextActive]}>{et.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {type === "custom" && (
          <TextInput
            style={styles.input}
            placeholder="Event type name..."
            placeholderTextColor={Colors.textTertiary}
            value={customTypeName}
            onChangeText={setCustomTypeName}
          />
        )}

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the issue..."
          placeholderTextColor={Colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Treatment</Text>
        <TextInput
          style={styles.input}
          placeholder="Treatment given (optional)..."
          placeholderTextColor={Colors.textTertiary}
          value={treatment}
          onChangeText={setTreatment}
        />

        <View style={styles.switchRow}>
          <View style={styles.switchLabelWrap}>
            <Text style={styles.switchLabel}>Follow-up Needed</Text>
            <Text style={styles.switchHint}>Adds to "Needs Attention" list</Text>
          </View>
          <Switch
            value={followUpNeeded}
            onValueChange={setFollowUpNeeded}
            trackColor={{ false: Colors.border, true: Colors.warning + "60" }}
            thumbColor={followUpNeeded ? Colors.warning : Colors.textTertiary}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isAddingDoctoringEvent && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isAddingDoctoringEvent}
          activeOpacity={0.8}
        >
          <Check size={20} color={Colors.textInverse} />
          <Text style={styles.saveButtonText}>{isAddingDoctoringEvent ? "Saving..." : "Log Event"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  errorText: { fontSize: 16, color: Colors.textSecondary, textAlign: "center", marginTop: 40 },
  animalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  animalHeaderText: { fontSize: 17, fontWeight: "700" as const, color: Colors.text, flex: 1 },
  dateText: { fontSize: 13, color: Colors.textTertiary, fontWeight: "500" as const },
  label: { fontSize: 14, fontWeight: "700" as const, color: Colors.textSecondary, marginBottom: 8, marginTop: 4 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  typeEmoji: { fontSize: 16 },
  typeChipText: { fontSize: 14, fontWeight: "600" as const, color: Colors.text },
  typeChipTextActive: { color: Colors.textInverse },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  textArea: { minHeight: 80, paddingTop: 12 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchLabelWrap: { flex: 1 },
  switchLabel: { fontSize: 15, fontWeight: "600" as const, color: Colors.text },
  switchHint: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 16, fontWeight: "700" as const, color: Colors.textInverse },
});
