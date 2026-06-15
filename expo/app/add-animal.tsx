import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Species } from "@/types";
import { SPECIES_OPTIONS, getGenderOptions } from "@/mocks/animals";
import { AlertCircle } from "lucide-react-native";

export default function AddAnimalScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { addAnimal, isAddingAnimal, isDuplicateTagInSameYear, activeBusinessYearId, activeBusinessYear } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [name, setName] = useState("");
  const [tagId, setTagId] = useState("");
  const [species, setSpecies] = useState<Species>("cattle");
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<string>("female");
  const [notes, setNotes] = useState("");
  const [duplicateWarningDismissed, setDuplicateWarningDismissed] = useState(false);

  const genderOptions = getGenderOptions(species);
  const isTagRequired = species !== "horse";
  const hasSameYearDuplicate = tagId.trim() ? isDuplicateTagInSameYear(tagId.trim(), activeBusinessYearId) : false;

  const doSave = useCallback(async () => {
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addAnimal({
      tagId: tagId.trim(),
      name: name.trim() || undefined,
      species,
      breed: breed.trim() || "Unknown",
      birthDate: birthDate.trim() || new Date().getFullYear().toString(),
      sex: sex as "male" | "female" | "steer" | "heifer",
      notes: notes.trim(),
      status: "active",
      markedForSale: false,
      businessYearId: activeBusinessYearId,
    });
    router.back();
  }, [name, tagId, species, breed, birthDate, sex, notes, addAnimal, router, activeBusinessYearId]);

  const handleSave = useCallback(async () => {
    if (isTagRequired && !tagId.trim()) { Alert.alert("Missing Info", "Please enter a tag ID."); return; }
    if (tagId.trim() && hasSameYearDuplicate && !duplicateWarningDismissed) {
      Alert.alert("Duplicate Tag ID", `Tag "${tagId.trim()}" already exists in ${activeBusinessYear.name}. Do you want to add it anyway?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Add Anyway", onPress: () => { setDuplicateWarningDismissed(true); void doSave(); } },
      ]);
      return;
    }
    await doSave();
  }, [tagId, isTagRequired, hasSameYearDuplicate, duplicateWarningDismissed, activeBusinessYear.name, doSave]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Tag ID {isTagRequired ? "*" : "(optional)"}</Text>
        <TextInput style={styles.input} placeholder={isTagRequired ? "e.g. TAG-007" : "Optional for horses"} placeholderTextColor={Colors.textTertiary} value={tagId} onChangeText={(t) => { setTagId(t); setDuplicateWarningDismissed(false); }} autoCapitalize="characters" testID="animal-tag-input" />
        {hasSameYearDuplicate && !duplicateWarningDismissed && (
          <View style={styles.duplicateWarning}><AlertCircle size={14} color={Colors.warning} /><Text style={styles.duplicateWarningText}>This tag ID already exists in {activeBusinessYear.name}</Text></View>
        )}
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Name (optional)</Text>
        <TextInput style={styles.input} placeholder="e.g. Dusty" placeholderTextColor={Colors.textTertiary} value={name} onChangeText={setName} testID="animal-name-input" />
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Species</Text>
        <View style={styles.chipRow}>
          {SPECIES_OPTIONS.map((opt) => (
            <TouchableOpacity key={opt.value} style={[styles.chip, species === opt.value && styles.chipActive]} onPress={() => setSpecies(opt.value as Species)}>
              <Text style={[styles.chipText, species === opt.value && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Breed</Text>
        <TextInput style={styles.input} placeholder="e.g. Angus" placeholderTextColor={Colors.textTertiary} value={breed} onChangeText={setBreed} />
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Birth Year</Text>
        <TextInput style={styles.input} placeholder="YYYY" placeholderTextColor={Colors.textTertiary} value={birthDate} onChangeText={setBirthDate} keyboardType="numeric" maxLength={4} />
        <Text style={styles.birthHint}>Year only is fine for older animals</Text>
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Sex</Text>
        <View style={styles.chipRow}>
          {genderOptions.map((opt) => (
            <TouchableOpacity key={opt.value} style={[styles.chip, sex === opt.value && styles.chipActive]} onPress={() => setSex(opt.value)}>
              <Text style={[styles.chipText, sex === opt.value && styles.chipTextActive]}>{opt.icon} {opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="Any notes about this animal..." placeholderTextColor={Colors.textTertiary} value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" />
      </View>
      <TouchableOpacity style={[styles.saveButton, isAddingAnimal && styles.saveButtonDisabled]} onPress={handleSave} disabled={isAddingAnimal} activeOpacity={0.85} testID="save-animal-btn">
        <Text style={styles.saveButtonText}>{isAddingAnimal ? "Saving..." : "Add Animal"}</Text>
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
  generationRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  generationInput: { flex: 1 },
  estToggle: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  estToggleActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  estToggleText: { fontSize: 13, fontWeight: "600" as const, color: Colors.textTertiary },
  estToggleTextActive: { color: Colors.textInverse },
  estHint: { fontSize: 12, color: Colors.warning, marginTop: 6, fontStyle: "italic" as const },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 14, fontWeight: "600" as const, color: Colors.textSecondary },
  chipTextActive: { color: Colors.textInverse },
  saveButton: { backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 17, fontWeight: "700" as const, color: Colors.textInverse },
  birthHint: { fontSize: 12, color: Colors.textTertiary, marginTop: 6, fontStyle: "italic" as const },
  duplicateWarning: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 4 },
  duplicateWarningText: { fontSize: 12, fontWeight: "500" as const, color: Colors.warning },
});
