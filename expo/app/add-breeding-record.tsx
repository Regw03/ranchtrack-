import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { BreedingRecord } from "@/types";

const STATUS_OPTIONS: { label: string; value: BreedingRecord["status"] }[] = [
  { label: "Bred", value: "bred" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Delivered", value: "delivered" },
  { label: "Open", value: "open" },
];

export default function AddBreedingRecordScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const { addBreedingRecord } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [lastBredDate, setLastBredDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDueDate, setExpectedDueDate] = useState("");
  const [status, setStatus] = useState<BreedingRecord["status"]>("bred");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!expectedDueDate.trim()) { Alert.alert("Missing Info", "Please enter the expected due date."); return; }
    setIsSaving(true);
    try {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addBreedingRecord({ animalId: animalId ?? "", lastBredDate, expectedDueDate: expectedDueDate.trim(), status, notes: notes.trim() });
      router.back();
    } catch { Alert.alert("Error", "Failed to save breeding record."); } finally { setIsSaving(false); }
  }, [expectedDueDate, animalId, lastBredDate, status, notes, addBreedingRecord, router]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Status</Text>
        <View style={styles.chipRow}>
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity key={opt.value} style={[styles.chip, status === opt.value && styles.chipActive]} onPress={() => setStatus(opt.value)}>
              <Text style={[styles.chipText, status === opt.value && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.formGroup}><Text style={styles.label}>Last Bred Date</Text><TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} value={lastBredDate} onChangeText={setLastBredDate} /></View>
      <View style={styles.formGroup}><Text style={styles.label}>Expected Due Date *</Text><TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} value={expectedDueDate} onChangeText={setExpectedDueDate} /></View>
      <View style={styles.formGroup}><Text style={styles.label}>Notes</Text><TextInput style={[styles.input, styles.textArea]} placeholder="e.g. Natural service, AI service..." placeholderTextColor={Colors.textTertiary} value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" /></View>
      <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving} activeOpacity={0.85}>
        <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Add Breeding Record"}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "700" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  textArea: { minHeight: 80, paddingTop: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 14, fontWeight: "600" as const, color: Colors.textSecondary },
  chipTextActive: { color: Colors.textInverse },
  saveButton: { backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 17, fontWeight: "700" as const, color: Colors.textInverse },
});
