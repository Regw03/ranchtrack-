import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { HealthRecordType } from "@/types";

const HEALTH_TYPES: { label: string; value: HealthRecordType }[] = [
  { label: "Vaccination", value: "vaccination" },
  { label: "Treatment", value: "treatment" },
  { label: "Checkup", value: "checkup" },
  { label: "Injury", value: "injury" },
  { label: "Other", value: "other" },
];

export default function AddHealthRecordScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const { addHealthRecord, currentUserName } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [type, setType] = useState<HealthRecordType>("checkup");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!description.trim()) { Alert.alert("Missing Info", "Please enter a description."); return; }
    setIsSaving(true);
    try {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addHealthRecord({ animalId: animalId ?? "", type, date, description: description.trim(), notes: notes.trim(), administeredBy: currentUserName });
      router.back();
    } catch { Alert.alert("Error", "Failed to save health record."); } finally { setIsSaving(false); }
  }, [description, animalId, type, date, notes, currentUserName, addHealthRecord, router]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.chipRow}>
          {HEALTH_TYPES.map((t) => (
            <TouchableOpacity key={t.value} style={[styles.chip, type === t.value && styles.chipActive]} onPress={() => setType(t.value)}>
              <Text style={[styles.chipText, type === t.value && styles.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.formGroup}><Text style={styles.label}>Date</Text><TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} value={date} onChangeText={setDate} /></View>
      <View style={styles.formGroup}><Text style={styles.label}>Description *</Text><TextInput style={styles.input} placeholder="e.g. Annual Blackleg vaccine" placeholderTextColor={Colors.textTertiary} value={description} onChangeText={setDescription} /></View>
      <View style={styles.formGroup}><Text style={styles.label}>Notes</Text><TextInput style={[styles.input, styles.textArea]} placeholder="Additional notes..." placeholderTextColor={Colors.textTertiary} value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" /></View>
      <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving} activeOpacity={0.85}>
        <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Add Health Record"}</Text>
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
