import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";

export default function AddWeightRecordScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const { addWeightRecord } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const parsedWeight = parseFloat(weight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) { Alert.alert("Invalid Weight", "Please enter a valid weight."); return; }
    setIsSaving(true);
    try {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addWeightRecord({ animalId: animalId ?? "", date, weight: parsedWeight, unit });
      router.back();
    } catch { Alert.alert("Error", "Failed to save weight record."); } finally { setIsSaving(false); }
  }, [weight, animalId, date, unit, addWeightRecord, router]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.weightInputSection}>
        <TextInput style={styles.weightInput} placeholder="0" placeholderTextColor={Colors.textTertiary} value={weight} onChangeText={setWeight} keyboardType="numeric" testID="weight-input" />
        <View style={styles.unitToggle}>
          <TouchableOpacity style={[styles.unitBtn, unit === "lbs" && styles.unitBtnActive]} onPress={() => setUnit("lbs")}>
            <Text style={[styles.unitBtnText, unit === "lbs" && styles.unitBtnTextActive]}>lbs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.unitBtn, unit === "kg" && styles.unitBtnActive]} onPress={() => setUnit("kg")}>
            <Text style={[styles.unitBtnText, unit === "kg" && styles.unitBtnTextActive]}>kg</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.formGroup}><Text style={styles.label}>Date</Text><TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} value={date} onChangeText={setDate} /></View>
      <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving} activeOpacity={0.85}>
        <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Add Weight Record"}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  weightInputSection: { alignItems: "center", paddingVertical: 32 },
  weightInput: { fontSize: 56, fontWeight: "800" as const, color: Colors.text, textAlign: "center" as const, minWidth: 120 },
  unitToggle: { flexDirection: "row", marginTop: 16, backgroundColor: Colors.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: Colors.border },
  unitBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  unitBtnActive: { backgroundColor: Colors.primary },
  unitBtnText: { fontSize: 15, fontWeight: "600" as const, color: Colors.textSecondary },
  unitBtnTextActive: { color: Colors.textInverse },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "700" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  saveButton: { backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 17, fontWeight: "700" as const, color: Colors.textInverse },
});
