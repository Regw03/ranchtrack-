import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
 View,
 Text,
 StyleSheet,
 TextInput,
 TouchableOpacity,
 ScrollView,
 KeyboardAvoidingView,
 Platform,
 Alert,
 ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Species } from "@/types";
import { SPECIES_OPTIONS, getGenderOptions } from "@/mocks/animals";

export default function EditAnimalScreen() {
 const Colors = useColors();
 const router = useRouter();
 const { id } = useLocalSearchParams<{ id: string }>();
 const { getAnimalById, updateAnimal } = useRanch();
 const styles = useMemo(() => createStyles(Colors), [Colors]);

 const animal = useMemo(() => getAnimalById(id ?? ""), [id, getAnimalById]);

 // Pre-fill all fields from current animal data
 const [tagId, setTagId] = useState(animal?.tagId ?? "");
 const [name, setName] = useState(animal?.name ?? "");
 const [species, setSpecies] = useState<Species>(animal?.species ?? "cattle");
 const [breed, setBreed] = useState(animal?.breed ?? "");
 const [birthDate, setBirthDate] = useState(animal?.birthDate ?? "");
 const [sex, setSex] = useState<Animal["sex"]>(animal?.sex ?? "female");
 const [notes, setNotes] = useState(animal?.notes ?? "");
 const [isSaving, setIsSaving] = useState(false);

 // Re-sync if animal loads after mount
 useEffect(() => {
 if (animal) {
 setTagId(animal.tagId);
 setName(animal.name ?? "");
 setSpecies(animal.species);
 setBreed(animal.breed);
 setBirthDate(animal.birthDate);
 setSex(animal.sex);
 setNotes(animal.notes);
 }
 }, [animal?.id]);

 const genderOptions = useMemo(() => getGenderOptions(species), [species]);
 const canSave = tagId.trim().length > 0 && !isSaving;

 const handleSave = useCallback(async () => {
 if (!canSave || !animal) return;
 if (Platform.OS !== "web")
 void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

 setIsSaving(true);
 try {
 await updateAnimal({
 ...animal,
 tagId: tagId.trim(),
 name: name.trim() || undefined,
 species,
 breed: breed.trim(),
 birthDate: birthDate.trim(),
 sex: sex as Animal["sex"],
 notes: notes.trim(),
 updatedAt: new Date().toISOString(),
 });
 router.back();
 } catch (e) {
 Alert.alert("Error", "Could not save changes. Please try again.");
 } finally {
 setIsSaving(false);
 }
 }, [canSave, animal, tagId, name, species, breed, birthDate, sex, notes, updateAnimal, router]);

 if (!animal) {
 return (
 <View style={styles.notFound}>
 <Text style={styles.notFoundText}>Animal not found</Text>
 </View>
 );
 }

 return (
 <>
 <Stack.Screen options={{ title: `Edit ${animal.tagId}` }} />
 <View style={styles.container}>
 <KeyboardAvoidingView
 style={styles.flex}
 behavior={Platform.OS === "ios" ? "padding" : undefined}
 >
 <ScrollView
 contentContainerStyle={styles.scrollContent}
 keyboardShouldPersistTaps="handled"
 showsVerticalScrollIndicator={false}
 >
 {/* Tag ID */}
 <View style={styles.formGroup}>
 <Text style={styles.label}>Tag ID *</Text>
 <TextInput
 value={tagId}
 onChangeText={setTagId}
 style={styles.input}
 placeholder="e.g. 214"
 placeholderTextColor={Colors.textTertiary}
 autoCapitalize="characters"
 returnKeyType="next"
 maxLength={20}
 />
 </View>

 {/* Name */}
 <View style={styles.formGroup}>
 <Text style={styles.label}>Name (optional)</Text>
 <TextInput
 value={name}
 onChangeText={setName}
 style={styles.input}
 placeholder="e.g. Bessie"
 placeholderTextColor={Colors.textTertiary}
 autoCapitalize="words"
 returnKeyType="next"
 maxLength={50}
 />
 </View>

 {/* Species */}
 <View style={styles.formGroup}>
 <Text style={styles.label}>Species</Text>
 <View style={styles.chipRow}>
 {SPECIES_OPTIONS.map((opt) => (
 <TouchableOpacity
 key={opt.value}
 style={[styles.chip, species === opt.value && styles.chipActive]}
 onPress={() => {
 setSpecies(opt.value as Species);
 setSex("female");
 }}
 activeOpacity={0.7}
 >
 <Text style={[styles.chipText, species === opt.value && styles.chipTextActive]}>
 {opt.label}
 </Text>
 </TouchableOpacity>
 ))}
 </View>
 </View>

 {/* Breed */}
 <View style={styles.formGroup}>
 <Text style={styles.label}>Breed</Text>
 <TextInput
 value={breed}
 onChangeText={setBreed}
 style={styles.input}
 placeholder="e.g. Angus, Hereford"
 placeholderTextColor={Colors.textTertiary}
 autoCapitalize="words"
 returnKeyType="next"
 maxLength={50}
 />
 </View>

 {/* Birth Date */}
 <View style={styles.formGroup}>
 <Text style={styles.label}>Birth Year</Text>
 <TextInput
 value={birthDate}
 onChangeText={setBirthDate}
 style={styles.input}
 placeholder="e.g. 2021 or 2021-05-03"
 placeholderTextColor={Colors.textTertiary}
 keyboardType="numbers-and-punctuation"
 returnKeyType="next"
 maxLength={10}
 />
 </View>

 {/* Sex */}
 <View style={styles.formGroup}>
 <Text style={styles.label}>Sex</Text>
 <View style={styles.chipRow}>
 {genderOptions.map((opt) => (
 <TouchableOpacity
 key={opt.value}
 style={[styles.chip, sex === opt.value && styles.chipActive]}
 onPress={() => setSex(opt.value as Animal["sex"])}
 activeOpacity={0.7}
 >
 <Text style={[styles.chipText, sex === opt.value && styles.chipTextActive]}>
 {opt.label}
 </Text>
 </TouchableOpacity>
 ))}
 </View>
 </View>

 {/* Notes */}
 <View style={styles.formGroup}>
 <Text style={styles.label}>Notes</Text>
 <TextInput
 value={notes}
 onChangeText={setNotes}
 style={[styles.input, styles.textArea]}
 placeholder="Any notes about this animal..."
 placeholderTextColor={Colors.textTertiary}
 multiline
 numberOfLines={4}
 textAlignVertical="top"
 maxLength={500}
 />
 </View>

 <View style={{ height: 32 }} />
 </ScrollView>

 {/* Save button */}
 <View style={styles.bottomBar}>
 <TouchableOpacity
 style={[
 styles.saveBtn,
 { backgroundColor: canSave ? Colors.primary : Colors.border },
 ]}
 onPress={handleSave}
 disabled={!canSave}
 activeOpacity={0.85}
 >
 {isSaving ? (
 <ActivityIndicator color="#fff" />
 ) : (
 <>
 <Check size={20} color="#fff" />
 <Text style={styles.saveBtnText}>Save Changes</Text>
 </>
 )}
 </TouchableOpacity>
 </View>
 </KeyboardAvoidingView>
 </View>
 </>
 );
}

// Needed for the sex cast
type Animal = import("@/types").Animal;

function createStyles(Colors: ThemeColors) {
 return StyleSheet.create({
 container: { flex: 1, backgroundColor: Colors.background },
 flex: { flex: 1 },
 notFound: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const },
 notFoundText: { fontSize: 16, color: Colors.textSecondary },
 scrollContent: { padding: 20, paddingBottom: 8 },

 formGroup: { marginBottom: 20 },
 label: {
 fontSize: 13,
 fontWeight: "700" as const,
 color: Colors.textSecondary,
 textTransform: "uppercase" as const,
 letterSpacing: 0.8,
 marginBottom: 8,
 },
 input: {
 backgroundColor: Colors.surface,
 borderRadius: 12,
 borderWidth: 1.5,
 borderColor: Colors.border,
 paddingHorizontal: 16,
 paddingVertical: 14,
 fontSize: 16,
 fontWeight: "500" as const,
 color: Colors.text,
 },
 textArea: {
 minHeight: 100,
 paddingTop: 14,
 },
 chipRow: {
 flexDirection: "row" as const,
 flexWrap: "wrap" as const,
 gap: 8,
 },
 chip: {
 paddingHorizontal: 16,
 paddingVertical: 10,
 borderRadius: 10,
 backgroundColor: Colors.surface,
 borderWidth: 1.5,
 borderColor: Colors.border,
 },
 chipActive: {
 backgroundColor: Colors.primary,
 borderColor: Colors.primary,
 },
 chipText: {
 fontSize: 14,
 fontWeight: "600" as const,
 color: Colors.textSecondary,
 },
 chipTextActive: {
 color: "#fff",
 },

 bottomBar: {
 padding: 20,
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
 },
 });
}
