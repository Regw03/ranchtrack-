import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Alert, KeyboardAvoidingView } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { ChevronRight, ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Species, ListType } from "@/types";
import { SPECIES_OPTIONS, SPECIES_ICONS, getBirthingTitle, LIST_TYPE_CONFIG } from "@/mocks/animals";

type Step = "species" | "type" | "name";
const LIST_COLORS = ["#C4622D", "#1F3D2B", "#3D8B5E", "#D4943A", "#7B5EA7", "#C44D3D", "#2D7A9C", "#8B6E4E", "#5C7A3D", "#D47B8B"];

export default function CreateListScreen() {
  const Colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ parentId?: string; parentType?: string; parentSpecies?: string }>();
  const { createList, customLists } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const isSubList = !!params.parentId;
  const [step, setStep] = useState<Step>(isSubList ? "name" : "species");
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>((params.parentSpecies as Species) ?? null);
  const [selectedType, setSelectedType] = useState<ListType | null>((params.parentType as ListType) ?? null);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(LIST_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const parentList = useMemo(() => { if (!params.parentId) return null; return customLists.find((l) => l.id === params.parentId) ?? null; }, [params.parentId, customLists]);

  const listTypeOptions = useMemo(() => {
    if (!selectedSpecies) return [];
    const birthingTitle = getBirthingTitle(selectedSpecies);
    return [
      { type: "vaccinations" as ListType, label: "Vaccinations", icon: "💉", color: "#2D7A9C", description: "Track vaccination schedules & records" },
      { type: "breeding" as ListType, label: "Breeding", icon: "🤰", color: "#7B5EA7", description: "Manage breeding pairs & cycles" },
      { type: "to_be_sold" as ListType, label: "To Be Sold", icon: "💰", color: "#C4622D", description: "Animals marked for sale" },
      { type: "birthing" as ListType, label: birthingTitle, icon: "🐣", color: "#3D8B5E", description: `Track ${birthingTitle.toLowerCase()} season & due dates` },
    ];
  }, [selectedSpecies]);

  const defaultIconForType = useCallback((type: ListType): string => LIST_TYPE_CONFIG[type]?.icon ?? "📋", []);
  const defaultColorForType = useCallback((type: ListType): string => LIST_TYPE_CONFIG[type]?.color ?? LIST_COLORS[0], []);

  const headerTitle = useMemo(() => {
    if (isSubList && parentList) return `New Sub-List in ${parentList.name}`;
    switch (step) { case "species": return "Select Animal Type"; case "type": return "Select List Type"; case "name": return "Name Your List"; }
  }, [step, isSubList, parentList]);

  const handleSelectSpecies = useCallback((species: Species) => { if (Platform.OS !== "web") void Haptics.selectionAsync(); setSelectedSpecies(species); setStep("type"); }, []);
  const handleSelectType = useCallback((type: ListType) => { if (Platform.OS !== "web") void Haptics.selectionAsync(); setSelectedType(type); setSelectedColor(defaultColorForType(type)); setStep("name"); }, [defaultColorForType]);
  const handleBack = useCallback(() => { if (step === "type") { setStep("species"); setSelectedType(null); } else if (step === "name" && !isSubList) { setStep("type"); setName(""); } }, [step, isSubList]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) { Alert.alert("Name Required", "Please enter a name for your list."); return; }
    if (!selectedSpecies || !selectedType) { Alert.alert("Error", "Please select an animal type and list type."); return; }
    if (saving) return;
    setSaving(true);
    try {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await createList({ name: name.trim(), color: selectedColor, icon: defaultIconForType(selectedType), listType: selectedType, species: selectedSpecies, parentId: params.parentId, animalIds: [] });
      router.back();
    } catch (e) { console.log("Error creating list:", e); Alert.alert("Error", "Failed to create list. Please try again."); } finally { setSaving(false); }
  }, [name, selectedSpecies, selectedType, selectedColor, saving, createList, router, params.parentId, defaultIconForType]);

  const speciesFiltered = SPECIES_OPTIONS.filter((s) => s.value !== "other");

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {step !== "species" && !isSubList && (<TouchableOpacity style={styles.backRow} onPress={handleBack} activeOpacity={0.7}><ChevronLeft size={18} color={Colors.primary} /><Text style={styles.backText}>Back</Text></TouchableOpacity>)}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === "species" && (<View><Text style={styles.stepTitle}>What type of animal is this list for?</Text><View style={styles.speciesGrid}>{speciesFiltered.map((species) => (
            <TouchableOpacity key={species.value} style={styles.speciesCard} onPress={() => handleSelectSpecies(species.value as Species)} activeOpacity={0.7} testID={`species-${species.value}`}>
              <Text style={styles.speciesEmoji}>{SPECIES_ICONS[species.value] ?? "🐾"}</Text><Text style={styles.speciesLabel}>{species.label}</Text><ChevronRight size={16} color={Colors.textTertiary} />
            </TouchableOpacity>))}</View></View>)}

          {step === "type" && selectedSpecies && (<View>
            <View style={styles.speciesBadge}><Text style={styles.speciesBadgeEmoji}>{SPECIES_ICONS[selectedSpecies] ?? "🐾"}</Text><Text style={styles.speciesBadgeText}>{SPECIES_OPTIONS.find((s) => s.value === selectedSpecies)?.label}</Text></View>
            <Text style={styles.stepTitle}>Choose a list category</Text>
            <View style={styles.typeGrid}>{listTypeOptions.map((option) => (
              <TouchableOpacity key={option.type} style={[styles.typeCard, { borderLeftColor: option.color }]} onPress={() => handleSelectType(option.type)} activeOpacity={0.7} testID={`type-${option.type}`}>
                <View style={[styles.typeIconBadge, { backgroundColor: option.color + "18" }]}><Text style={styles.typeIconText}>{option.icon}</Text></View>
                <View style={styles.typeCardContent}><Text style={styles.typeCardLabel}>{option.label}</Text><Text style={styles.typeCardDescription}>{option.description}</Text></View>
                <ChevronRight size={16} color={Colors.textTertiary} />
              </TouchableOpacity>))}</View></View>)}

          {step === "name" && (<View>
            {!isSubList && selectedSpecies && selectedType && (<View style={styles.selectionSummary}>
              <View style={styles.summaryChip}><Text style={styles.summaryChipEmoji}>{SPECIES_ICONS[selectedSpecies] ?? "🐾"}</Text><Text style={styles.summaryChipText}>{SPECIES_OPTIONS.find((s) => s.value === selectedSpecies)?.label}</Text></View>
              <View style={[styles.summaryChip, { backgroundColor: defaultColorForType(selectedType) + "15" }]}><Text style={styles.summaryChipEmoji}>{defaultIconForType(selectedType)}</Text><Text style={styles.summaryChipText}>{listTypeOptions.find((o) => o.type === selectedType)?.label ?? selectedType}</Text></View>
            </View>)}
            {isSubList && parentList && (<View style={styles.parentInfo}><Text style={styles.parentInfoLabel}>Creating sub-list in</Text><View style={styles.parentInfoRow}><Text style={styles.parentInfoIcon}>{parentList.icon}</Text><Text style={styles.parentInfoName}>{parentList.name}</Text></View></View>)}
            <View style={styles.previewCard}><View style={[styles.previewIconBadge, { backgroundColor: selectedColor + "20" }]}><Text style={styles.previewIconText}>{selectedType ? defaultIconForType(selectedType) : "📋"}</Text></View><Text style={styles.previewName}>{name || "Sub-List Name"}</Text><View style={[styles.previewAccent, { backgroundColor: selectedColor }]} /></View>
            <View style={styles.section}><Text style={styles.sectionLabel}>{isSubList ? "Sub-List Name" : "List Name"}</Text><TextInput style={styles.nameInput} value={name} onChangeText={setName} placeholder={getPlaceholder(selectedType, selectedSpecies)} placeholderTextColor={Colors.textTertiary} maxLength={50} autoFocus testID="list-name-input" /></View>
            <View style={styles.section}><Text style={styles.sectionLabel}>Color</Text><View style={styles.colorGrid}>{LIST_COLORS.map((color) => (
              <TouchableOpacity key={color} style={[styles.colorOption, { backgroundColor: color }, selectedColor === color && styles.colorOptionActive]} onPress={() => { setSelectedColor(color); if (Platform.OS !== "web") void Haptics.selectionAsync(); }}>
                {selectedColor === color && <View style={styles.colorCheck} />}
              </TouchableOpacity>))}</View></View>
          </View>)}
        </ScrollView>
        {step === "name" && (<View style={styles.footer}><TouchableOpacity style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]} onPress={handleSave} activeOpacity={0.8} disabled={!name.trim() || saving}><Text style={styles.saveBtnText}>{saving ? "Creating..." : isSubList ? "Create Sub-List" : "Create List"}</Text></TouchableOpacity></View>)}
      </KeyboardAvoidingView>
    </>
  );
}

function getPlaceholder(listType: ListType | null, species: Species | null): string {
  if (!listType || !species) return "e.g., Group A, Spring 2025";
  switch (listType) {
    case "vaccinations": return "e.g., Blackleg Group, Spring Boosters, Annual Round";
    case "breeding": return "e.g., Spring Pairs, AI Group, Yearling Heifers";
    case "to_be_sold": return "e.g., Fall Sale, Auction Lot, Culls";
    case "birthing": return species === "cattle" ? "e.g., Spring Calving, First Calf Heifers" : species === "horse" ? "e.g., Spring Foaling, Maiden Mares" : "e.g., Spring Birthing Group";
    default: return "e.g., Group A, Spring 2025";
  }
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  backRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2, gap: 4 },
  backText: { fontSize: 15, fontWeight: "600" as const, color: Colors.primary },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  stepTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text, marginBottom: 18 },
  speciesGrid: { gap: 10 },
  speciesCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 16, padding: 18, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  speciesEmoji: { fontSize: 28, marginRight: 14 },
  speciesLabel: { flex: 1, fontSize: 17, fontWeight: "600" as const, color: Colors.text },
  speciesBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: Colors.primaryLight + "15", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 16, gap: 8 },
  speciesBadgeEmoji: { fontSize: 18 },
  speciesBadgeText: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
  typeGrid: { gap: 12 },
  typeCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderLeftWidth: 4, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  typeIconBadge: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 14 },
  typeIconText: { fontSize: 24 },
  typeCardContent: { flex: 1 },
  typeCardLabel: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
  typeCardDescription: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  selectionSummary: { flexDirection: "row", gap: 10, marginBottom: 18 },
  summaryChip: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.backgroundDark, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, gap: 6 },
  summaryChipEmoji: { fontSize: 16 },
  summaryChipText: { fontSize: 13, fontWeight: "600" as const, color: Colors.text },
  parentInfo: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: Colors.border },
  parentInfoLabel: { fontSize: 11, fontWeight: "700" as const, color: Colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 8 },
  parentInfoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  parentInfoIcon: { fontSize: 20 },
  parentInfoName: { fontSize: 16, fontWeight: "600" as const, color: Colors.text },
  previewCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, alignItems: "center", marginBottom: 28, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3, overflow: "hidden" },
  previewIconBadge: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  previewIconText: { fontSize: 32 },
  previewName: { fontSize: 20, fontWeight: "700" as const, color: Colors.text },
  previewAccent: { position: "absolute", bottom: 0, left: 0, right: 0, height: 4 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: "700" as const, color: Colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10 },
  nameInput: { backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  colorOption: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "transparent" },
  colorOptionActive: { borderColor: Colors.text },
  colorCheck: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.textInverse },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: Colors.background },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: "700" as const, color: Colors.textInverse },
});
