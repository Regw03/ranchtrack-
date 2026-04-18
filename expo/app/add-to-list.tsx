import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Image, Platform, KeyboardAvoidingView } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Search, Check, PlusCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Animal } from "@/types";
import { SPECIES_ICONS, getAnimalDisplayName, getGenderTitle } from "@/mocks/animals";

export default function AddToListScreen() {
  const Colors = useColors();
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const router = useRouter();
  const { animals, getListById, addAnimalToList, removeAnimalFromList } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const list = useMemo(() => getListById(listId ?? ""), [getListById, listId]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAnimals = useMemo(() => { if (!searchQuery) return animals; const q = searchQuery.toLowerCase(); return animals.filter((a) => (a.name ?? "").toLowerCase().includes(q) || a.tagId.toLowerCase().includes(q) || a.breed.toLowerCase().includes(q)); }, [animals, searchQuery]);

  const handleToggle = useCallback((animalId: string) => {
    if (!list) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (list.animalIds.includes(animalId)) { void removeAnimalFromList({ listId: list.id, animalId }); } else { void addAnimalToList({ listId: list.id, animalId }); }
  }, [list, addAnimalToList, removeAnimalFromList]);

  const renderAnimalRow = useCallback(({ item }: { item: Animal }) => {
    const isInList = list?.animalIds.includes(item.id) ?? false;
    return (
      <TouchableOpacity style={[styles.animalRow, isInList && styles.animalRowSelected]} onPress={() => handleToggle(item.id)} activeOpacity={0.7}>
        <View style={styles.animalRowLeft}>
          {item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.animalThumb} /> : <View style={styles.animalThumbPlaceholder}><Text style={styles.animalThumbEmoji}>{SPECIES_ICONS[item.species] || "🐾"}</Text></View>}
          <View style={styles.animalRowInfo}><Text style={styles.animalRowName}>{getAnimalDisplayName(item)}</Text><Text style={styles.animalRowMeta}>{item.tagId} · {item.breed} · {getGenderTitle(item.species, item.sex)}</Text></View>
        </View>
        <View style={[styles.checkCircle, isInList && styles.checkCircleActive]}>{isInList && <Check size={14} color={Colors.textInverse} />}</View>
      </TouchableOpacity>
    );
  }, [list, handleToggle, Colors, styles]);

  if (!list) return (<View style={styles.notFound}><Text style={styles.notFoundText}>List not found</Text></View>);

  return (
    <>
      <Stack.Screen options={{ title: `Add to ${list.name}` }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.searchContainer}><Search size={18} color={Colors.textTertiary} /><TextInput style={styles.searchInput} placeholder="Search animals..." placeholderTextColor={Colors.textTertiary} value={searchQuery} onChangeText={setSearchQuery} /></View>
        <TouchableOpacity style={styles.createNewBtn} onPress={() => { if (!list) return; if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push({ pathname: "/add-animal-to-list", params: { listId: list.id, listType: list.listType, listSpecies: list.species ?? "" } }); }} activeOpacity={0.8} testID="create-new-animal-btn">
          <PlusCircle size={20} color={Colors.textInverse} /><Text style={styles.createNewBtnText}>Create New Animal Profile</Text>
        </TouchableOpacity>
        <View style={styles.countBar}><Text style={styles.countText}>{list.animalIds.length} animal{list.animalIds.length !== 1 ? "s" : ""} in this list</Text><Text style={styles.countHint}>or select existing below</Text></View>
        <FlatList data={filteredAnimals} keyExtractor={(item) => item.id} renderItem={renderAnimalRow} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>No animals found</Text></View>} />
        <View style={styles.footer}><TouchableOpacity style={styles.doneBtn} onPress={() => router.back()} activeOpacity={0.8}><Text style={styles.doneBtnText}>Done</Text></TouchableOpacity></View>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  notFoundText: { fontSize: 16, color: Colors.textSecondary },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, marginHorizontal: 16, marginTop: 16, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: Colors.text },
  countBar: { paddingHorizontal: 20, paddingVertical: 10 },
  countText: { fontSize: 13, fontWeight: "600" as const, color: Colors.textSecondary },
  countHint: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  createNewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.accent, marginHorizontal: 16, marginTop: 14, borderRadius: 14, paddingVertical: 14, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  createNewBtnText: { fontSize: 15, fontWeight: "700" as const, color: Colors.textInverse },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  animalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.surface, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 2, borderColor: "transparent" },
  animalRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  animalRowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  animalThumb: { width: 44, height: 44, borderRadius: 12 },
  animalThumbPlaceholder: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.secondaryLight, alignItems: "center", justifyContent: "center" },
  animalThumbEmoji: { fontSize: 20 },
  animalRowInfo: { flex: 1, marginLeft: 12 },
  animalRowName: { fontSize: 15, fontWeight: "600" as const, color: Colors.text },
  animalRowMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  checkCircleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  emptyState: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: Colors.background },
  doneBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  doneBtnText: { fontSize: 16, fontWeight: "700" as const, color: Colors.textInverse },
});
