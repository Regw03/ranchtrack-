import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Platform, Alert, KeyboardAvoidingView, ActionSheetIOS } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Camera, ImagePlus, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Species, ListType } from "@/types";
import { SPECIES_OPTIONS, SPECIES_ICONS, getGenderOptions, getBirthingTitle } from "@/mocks/animals";

interface VaccinationFields { vaccineName: string; vaccineDate: string; administeredBy: string; vaccineNotes: string; }
interface BreedingFields { sireTagId: string; lastBredDate: string; expectedDueDate: string; breedingStatus: "bred" | "confirmed" | "open"; breedingNotes: string; }
interface ToBeSoldFields { reasonForSale: string; askingPrice: string; }
interface BirthingFields { damTagId: string; expectedDueDate: string; birthingNotes: string; }

export default function AddAnimalToListScreen() {
  const Colors = useColors();
  const { listId, listType, listSpecies } = useLocalSearchParams<{ listId: string; listType: string; listSpecies: string }>();
  const router = useRouter();
  const { addAnimal, addAnimalToList, addHealthRecord, addBreedingRecord, animals, isAddingAnimal } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const species = (listSpecies as Species) || "cattle";
  const type = (listType as ListType) || "custom";
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [tagId, setTagId] = useState("");
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("female");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [vaccFields, setVaccFields] = useState<VaccinationFields>({ vaccineName: "", vaccineDate: new Date().toISOString().split("T")[0], administeredBy: "", vaccineNotes: "" });
  const [breedFields, setBreedFields] = useState<BreedingFields>({ sireTagId: "", lastBredDate: "", expectedDueDate: "", breedingStatus: "bred", breedingNotes: "" });
  const [saleFields, setSaleFields] = useState<ToBeSoldFields>({ reasonForSale: "", askingPrice: "" });
  const [birthFields, setBirthFields] = useState<BirthingFields>({ damTagId: "", expectedDueDate: "", birthingNotes: "" });

  const genderOptions = useMemo(() => getGenderOptions(species), [species]);
  const speciesLabel = useMemo(() => SPECIES_OPTIONS.find((s) => s.value === species)?.label ?? species, [species]);
  const listTypeLabel = useMemo(() => { switch (type) { case "vaccinations": return "Vaccinations"; case "breeding": return "Breeding"; case "to_be_sold": return "To Be Sold"; case "birthing": return getBirthingTitle(species); default: return ""; } }, [type, species]);
  const headerTitle = useMemo(() => `New ${speciesLabel} Profile`, [speciesLabel]);

  const handlePickPhoto = useCallback(() => {
    const showOptions = (options: string[], actions: (() => void)[]) => {
      if (Platform.OS === "ios") { ActionSheetIOS.showActionSheetWithOptions({ options: [...options, "Cancel"], cancelButtonIndex: options.length }, (index) => { if (index < options.length) actions[index](); }); }
      else { Alert.alert("Profile Photo", "Choose a source", [...options.map((label, i) => ({ text: label, onPress: actions[i] })), { text: "Cancel", style: "cancel" as const }]); }
    };
    const pickFromLibrary = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 }); if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri); };
    const takePhoto = async () => { const { status } = await ImagePicker.requestCameraPermissionsAsync(); if (status !== "granted") { Alert.alert("Permission Required", "Camera access is needed."); return; } const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 }); if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri); };
    if (photoUri) showOptions(["Take Photo", "Choose from Library", "Remove Photo"], [takePhoto, pickFromLibrary, () => setPhotoUri(null)]);
    else showOptions(["Take Photo", "Choose from Library"], [takePhoto, pickFromLibrary]);
  }, [photoUri]);

  const handleSave = useCallback(async () => {
    if (!tagId.trim()) { Alert.alert("Missing Info", "Please enter a tag number."); return; }
    if (saving) return;
    setSaving(true);
    try {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const result = await addAnimal({ tagId: tagId.trim(), name: name.trim() || undefined, species, breed: breed.trim() || "Unknown", birthDate: birthDate.trim() || new Date().getFullYear().toString(), sex: sex as "male" | "female" | "steer" | "heifer", notes: notes.trim(), photoUrl: photoUri ?? undefined, status: "active", markedForSale: type === "to_be_sold" });
      const newAnimalId = result.newAnimal.id;
      if (listId) { await addAnimalToList({ listId, animalId: newAnimalId }); }
      if (type === "vaccinations" && vaccFields.vaccineName.trim()) { await addHealthRecord({ animalId: newAnimalId, type: "vaccination", date: vaccFields.vaccineDate || new Date().toISOString().split("T")[0], description: vaccFields.vaccineName.trim(), notes: vaccFields.vaccineNotes.trim(), administeredBy: vaccFields.administeredBy.trim() || undefined }); }
      if (type === "breeding" && breedFields.lastBredDate.trim()) { const sire = breedFields.sireTagId.trim() ? animals.find((a) => a.tagId === breedFields.sireTagId.trim()) : undefined; await addBreedingRecord({ animalId: newAnimalId, sireId: sire?.id, lastBredDate: breedFields.lastBredDate.trim(), expectedDueDate: breedFields.expectedDueDate.trim() || "", status: breedFields.breedingStatus, notes: breedFields.breedingNotes.trim() }); }
      if (type === "birthing" && birthFields.expectedDueDate.trim()) { const dam = birthFields.damTagId.trim() ? animals.find((a) => a.tagId === birthFields.damTagId.trim()) : undefined; await addBreedingRecord({ animalId: newAnimalId, sireId: dam?.id, lastBredDate: new Date().toISOString().split("T")[0], expectedDueDate: birthFields.expectedDueDate.trim(), status: "confirmed", notes: birthFields.birthingNotes.trim() }); }
      router.back();
    } catch (e) { console.log("Error creating animal profile:", e); Alert.alert("Error", "Failed to create animal profile."); } finally { setSaving(false); }
  }, [tagId, name, species, breed, birthDate, sex, notes, photoUri, type, saving, addAnimal, addAnimalToList, listId, vaccFields, breedFields, birthFields, addHealthRecord, addBreedingRecord, animals, router]);

  const breedingStatusOptions = [{ value: "bred", label: "Bred" }, { value: "confirmed", label: "Confirmed" }, { value: "open", label: "Open" }];

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.listContext}><View style={[styles.listContextDot, { backgroundColor: Colors.accent }]} /><Text style={styles.listContextText}>Adding to {listTypeLabel} list</Text></View>
          <TouchableOpacity style={styles.photoSection} onPress={handlePickPhoto} activeOpacity={0.8} testID="photo-picker-btn">
            {photoUri ? (
              <View style={styles.photoPreviewContainer}><Image source={{ uri: photoUri }} style={styles.photoPreview} /><View style={styles.photoEditBadge}><Camera size={14} color={Colors.textInverse} /></View><TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setPhotoUri(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><X size={14} color={Colors.textInverse} /></TouchableOpacity></View>
            ) : (
              <View style={styles.photoPlaceholder}><Text style={styles.photoPlaceholderEmoji}>{SPECIES_ICONS[species] ?? "🐾"}</Text><View style={styles.photoAddBadge}><ImagePlus size={16} color={Colors.textInverse} /></View><Text style={styles.photoHint}>Add Photo</Text></View>
            )}
          </TouchableOpacity>
          <View style={styles.formCard}>
            <Text style={styles.formCardTitle}>Basic Info</Text>
            <View style={styles.formGroup}><Text style={styles.label}>Tag Number *</Text><TextInput style={styles.input} placeholder="e.g. TAG-007" placeholderTextColor={Colors.textTertiary} value={tagId} onChangeText={setTagId} autoCapitalize="characters" testID="animal-tag-input" /></View>
            <View style={styles.formGroup}><Text style={styles.label}>Name (optional)</Text><TextInput style={styles.input} placeholder="e.g. Dusty" placeholderTextColor={Colors.textTertiary} value={name} onChangeText={setName} testID="animal-name-input" /></View>
            <View style={styles.formGroup}><Text style={styles.label}>Breed</Text><TextInput style={styles.input} placeholder="e.g. Angus" placeholderTextColor={Colors.textTertiary} value={breed} onChangeText={setBreed} /></View>
            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}><Text style={styles.label}>Birth Year</Text><TextInput style={styles.input} placeholder="YYYY" placeholderTextColor={Colors.textTertiary} value={birthDate} onChangeText={setBirthDate} keyboardType="numeric" maxLength={4} /></View>
              <View style={[styles.formGroup, styles.formGroupHalf]}><Text style={styles.label}>Species</Text><View style={styles.speciesDisplay}><Text style={styles.speciesDisplayEmoji}>{SPECIES_ICONS[species] ?? "🐾"}</Text><Text style={styles.speciesDisplayText}>{speciesLabel}</Text></View></View>
            </View>
            <View style={styles.formGroup}><Text style={styles.label}>{species === "cattle" || species === "horse" ? "Gender / Class" : "Sex"}</Text><View style={styles.chipRow}>{genderOptions.map((opt) => (<TouchableOpacity key={opt.value} style={[styles.chip, sex === opt.value && styles.chipActive]} onPress={() => { setSex(opt.value); if (Platform.OS !== "web") void Haptics.selectionAsync(); }}><Text style={[styles.chipText, sex === opt.value && styles.chipTextActive]}>{opt.icon} {opt.label}</Text></TouchableOpacity>))}</View></View>
            <View style={styles.formGroup}><Text style={styles.label}>Notes</Text><TextInput style={[styles.input, styles.textArea]} placeholder="Any notes..." placeholderTextColor={Colors.textTertiary} value={notes} onChangeText={setNotes} multiline numberOfLines={3} textAlignVertical="top" /></View>
          </View>
          {type === "vaccinations" && (<View style={styles.formCard}><View style={styles.formCardTitleRow}><Text style={styles.formCardTitleIcon}>💉</Text><Text style={styles.formCardTitle}>Vaccination Details</Text></View><View style={styles.formGroup}><Text style={styles.label}>Vaccine Name</Text><TextInput style={styles.input} placeholder="e.g. Blackleg, BVD" placeholderTextColor={Colors.textTertiary} value={vaccFields.vaccineName} onChangeText={(v) => setVaccFields((p) => ({ ...p, vaccineName: v }))} /></View><View style={styles.formRow}><View style={[styles.formGroup, styles.formGroupHalf]}><Text style={styles.label}>Date Given</Text><TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} value={vaccFields.vaccineDate} onChangeText={(v) => setVaccFields((p) => ({ ...p, vaccineDate: v }))} /></View><View style={[styles.formGroup, styles.formGroupHalf]}><Text style={styles.label}>Administered By</Text><TextInput style={styles.input} placeholder="e.g. Dr. Smith" placeholderTextColor={Colors.textTertiary} value={vaccFields.administeredBy} onChangeText={(v) => setVaccFields((p) => ({ ...p, administeredBy: v }))} /></View></View><View style={styles.formGroup}><Text style={styles.label}>Notes</Text><TextInput style={[styles.input, styles.textArea]} placeholder="Reactions, dosage..." placeholderTextColor={Colors.textTertiary} value={vaccFields.vaccineNotes} onChangeText={(v) => setVaccFields((p) => ({ ...p, vaccineNotes: v }))} multiline numberOfLines={2} textAlignVertical="top" /></View></View>)}
          {type === "breeding" && (<View style={styles.formCard}><View style={styles.formCardTitleRow}><Text style={styles.formCardTitleIcon}>🤰</Text><Text style={styles.formCardTitle}>Breeding Details</Text></View><View style={styles.formGroup}><Text style={styles.label}>Sire Tag #</Text><TextInput style={styles.input} placeholder="e.g. TAG-001" placeholderTextColor={Colors.textTertiary} value={breedFields.sireTagId} onChangeText={(v) => setBreedFields((p) => ({ ...p, sireTagId: v }))} autoCapitalize="characters" /></View><View style={styles.formRow}><View style={[styles.formGroup, styles.formGroupHalf]}><Text style={styles.label}>Last Bred Date</Text><TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} value={breedFields.lastBredDate} onChangeText={(v) => setBreedFields((p) => ({ ...p, lastBredDate: v }))} /></View><View style={[styles.formGroup, styles.formGroupHalf]}><Text style={styles.label}>Expected Due</Text><TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} value={breedFields.expectedDueDate} onChangeText={(v) => setBreedFields((p) => ({ ...p, expectedDueDate: v }))} /></View></View><View style={styles.formGroup}><Text style={styles.label}>Breeding Status</Text><View style={styles.chipRow}>{breedingStatusOptions.map((opt) => (<TouchableOpacity key={opt.value} style={[styles.chip, breedFields.breedingStatus === opt.value && styles.chipActive]} onPress={() => { setBreedFields((p) => ({ ...p, breedingStatus: opt.value as BreedingFields["breedingStatus"] })); if (Platform.OS !== "web") void Haptics.selectionAsync(); }}><Text style={[styles.chipText, breedFields.breedingStatus === opt.value && styles.chipTextActive]}>{opt.label}</Text></TouchableOpacity>))}</View></View><View style={styles.formGroup}><Text style={styles.label}>Notes</Text><TextInput style={[styles.input, styles.textArea]} placeholder="Breeding method..." placeholderTextColor={Colors.textTertiary} value={breedFields.breedingNotes} onChangeText={(v) => setBreedFields((p) => ({ ...p, breedingNotes: v }))} multiline numberOfLines={2} textAlignVertical="top" /></View></View>)}
          {type === "to_be_sold" && (<View style={styles.formCard}><View style={styles.formCardTitleRow}><Text style={styles.formCardTitleIcon}>💰</Text><Text style={styles.formCardTitle}>Sale Details</Text></View><View style={styles.formGroup}><Text style={styles.label}>Asking Price</Text><TextInput style={styles.input} placeholder="e.g. $2,500" placeholderTextColor={Colors.textTertiary} value={saleFields.askingPrice} onChangeText={(v) => setSaleFields((p) => ({ ...p, askingPrice: v }))} keyboardType="numeric" /></View><View style={styles.formGroup}><Text style={styles.label}>Reason for Sale</Text><TextInput style={[styles.input, styles.textArea]} placeholder="e.g. Culling, downsizing..." placeholderTextColor={Colors.textTertiary} value={saleFields.reasonForSale} onChangeText={(v) => setSaleFields((p) => ({ ...p, reasonForSale: v }))} multiline numberOfLines={2} textAlignVertical="top" /></View></View>)}
          {type === "birthing" && (<View style={styles.formCard}><View style={styles.formCardTitleRow}><Text style={styles.formCardTitleIcon}>🐣</Text><Text style={styles.formCardTitle}>{getBirthingTitle(species)} Details</Text></View><View style={styles.formGroup}><Text style={styles.label}>Dam Tag #</Text><TextInput style={styles.input} placeholder="e.g. TAG-002" placeholderTextColor={Colors.textTertiary} value={birthFields.damTagId} onChangeText={(v) => setBirthFields((p) => ({ ...p, damTagId: v }))} autoCapitalize="characters" /></View><View style={styles.formGroup}><Text style={styles.label}>Expected Due Date</Text><TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} value={birthFields.expectedDueDate} onChangeText={(v) => setBirthFields((p) => ({ ...p, expectedDueDate: v }))} /></View><View style={styles.formGroup}><Text style={styles.label}>Notes</Text><TextInput style={[styles.input, styles.textArea]} placeholder="First time, complications..." placeholderTextColor={Colors.textTertiary} value={birthFields.birthingNotes} onChangeText={(v) => setBirthFields((p) => ({ ...p, birthingNotes: v }))} multiline numberOfLines={2} textAlignVertical="top" /></View></View>)}
        </ScrollView>
        <View style={styles.footer}><TouchableOpacity style={[styles.saveBtn, (!tagId.trim() || saving) && styles.saveBtnDisabled]} onPress={handleSave} disabled={!tagId.trim() || saving || isAddingAnimal} activeOpacity={0.85} testID="save-animal-btn"><Text style={styles.saveBtnText}>{saving ? "Creating..." : "Create & Add to List"}</Text></TouchableOpacity></View>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  listContext: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, paddingHorizontal: 4 },
  listContextDot: { width: 8, height: 8, borderRadius: 4 },
  listContextText: { fontSize: 13, fontWeight: "600" as const, color: Colors.textSecondary },
  photoSection: { alignItems: "center", marginBottom: 20 },
  photoPreviewContainer: { position: "relative", width: 110, height: 110 },
  photoPreview: { width: 110, height: 110, borderRadius: 24, borderWidth: 3, borderColor: Colors.primary + "30" },
  photoEditBadge: { position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.background },
  photoRemoveBtn: { position: "absolute", top: -4, right: -4, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.error, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.background },
  photoPlaceholder: { width: 110, height: 110, borderRadius: 24, backgroundColor: Colors.secondaryLight, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed" },
  photoPlaceholderEmoji: { fontSize: 36, marginBottom: 2 },
  photoAddBadge: { position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.background },
  photoHint: { position: "absolute", bottom: -20, fontSize: 11, fontWeight: "600" as const, color: Colors.textTertiary },
  formCard: { backgroundColor: Colors.surface, borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  formCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  formCardTitleIcon: { fontSize: 20 },
  formCardTitle: { fontSize: 16, fontWeight: "700" as const, color: Colors.text, marginBottom: 16 },
  formGroup: { marginBottom: 16 },
  formRow: { flexDirection: "row", gap: 12 },
  formGroupHalf: { flex: 1 },
  label: { fontSize: 12, fontWeight: "700" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.4, marginBottom: 6 },
  input: { backgroundColor: Colors.backgroundDark, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  textArea: { minHeight: 70, paddingTop: 12 },
  speciesDisplay: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.primary + "10", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 8, borderWidth: 1, borderColor: Colors.primary + "20" },
  speciesDisplayEmoji: { fontSize: 18 },
  speciesDisplayText: { fontSize: 15, fontWeight: "600" as const, color: Colors.primary },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.backgroundDark, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: "600" as const, color: Colors.textSecondary },
  chipTextActive: { color: Colors.textInverse },
  footer: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: Colors.background },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center", shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: "700" as const, color: Colors.textInverse },
});
