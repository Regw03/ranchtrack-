import React, { useMemo, useCallback, useRef, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, Platform, Animated } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { ChevronRight, Edit3, Trash2, Plus, UserMinus, UserPlus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Animal, CustomList } from "@/types";
import { SPECIES_ICONS, getAnimalDisplayName, getGenderTitle } from "@/mocks/animals";
import { getAnimalAge } from "@/utils/helpers";

function ListAnimalCard({ animal, index, onRemove }: { animal: Animal; index: number; onRemove: () => void }) {
  const Colors = useColors();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 50, useNativeDriver: true }).start(); }, [fadeAnim, index]);

  return (
    <Animated.View style={[styles.cardWrapper, { opacity: fadeAnim, transform: [{ scale: scaleAnim }, { translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      <TouchableOpacity style={styles.card} onPress={() => { if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/animal/${animal.id}`); }}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start()} activeOpacity={1}>
        <View style={styles.cardImageContainer}>
          {animal.photoUrl ? <Image source={{ uri: animal.photoUrl }} style={styles.cardImage} /> : <View style={styles.cardImagePlaceholder}><Text style={styles.speciesEmoji}>{SPECIES_ICONS[animal.species] || "🐾"}</Text></View>}
          <View style={styles.tagBadge}><Text style={styles.tagBadgeText}>{animal.tagId}</Text></View>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}><Text style={styles.animalName} numberOfLines={1}>{getAnimalDisplayName(animal)}</Text><ChevronRight size={18} color={Colors.textTertiary} /></View>
          <Text style={styles.animalBreed} numberOfLines={1}>{animal.breed}</Text>
          <View style={styles.cardMeta}>
            <View style={styles.metaChip}><Text style={styles.metaChipText}>{SPECIES_ICONS[animal.species]} {animal.species}</Text></View>
            <View style={styles.metaChip}><Text style={styles.metaChipText}>{getAnimalAge(animal.birthDate)}</Text></View>
            <View style={styles.metaChip}><Text style={styles.metaChipText}>{["male", "steer", "gelding", "colt"].includes(animal.sex) ? "♂" : "♀"} {getGenderTitle(animal.species, animal.sex)}</Text></View>
          </View>
        </View>
        <TouchableOpacity style={styles.removeBtn} onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert("Remove from List", `Remove ${getAnimalDisplayName(animal)} from this list?`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: onRemove }]);
        }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><UserMinus size={16} color={Colors.error} /></TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SubListCard({ list, animalCount }: { list: CustomList; animalCount: number }) {
  const Colors = useColors();
  const router = useRouter();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  return (
    <TouchableOpacity style={[styles.subListRow, { borderLeftColor: list.color }]} onPress={() => { if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: "/list/[id]", params: { id: list.id } }); }} activeOpacity={0.7}>
      <Text style={styles.subListIcon}>{list.icon}</Text>
      <View style={styles.subListInfo}><Text style={styles.subListName} numberOfLines={1}>{list.name}</Text><Text style={styles.subListCount}>{animalCount} head</Text></View>
      <ChevronRight size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

export default function ListDetailScreen() {
  const Colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getListById, animals, removeAnimalFromList, deleteList, getSubLists } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const list = useMemo(() => getListById(id ?? ""), [getListById, id]);
  const subLists = useMemo(() => { if (!list) return []; return getSubLists(list.id); }, [list, getSubLists]);
  const listAnimals = useMemo(() => { if (!list) return []; return list.animalIds.map((aid) => animals.find((a) => a.id === aid)).filter((a): a is Animal => a !== undefined); }, [list, animals]);

  const handleRemoveAnimal = useCallback((animalId: string) => { if (!list) return; void removeAnimalFromList({ listId: list.id, animalId }); }, [list, removeAnimalFromList]);
  const handleDeleteList = useCallback(() => {
    if (!list) return;
    Alert.alert("Delete List", `Are you sure you want to delete "${list.name}"? This won't delete any animals.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); await deleteList(list.id); router.back(); } }]);
  }, [list, deleteList, router]);

  if (!list) return (<View style={styles.notFound}><Text style={styles.notFoundText}>List not found</Text></View>);

  return (
    <>
      <Stack.Screen options={{ title: list.name, headerRight: () => (<View style={styles.headerActions}><TouchableOpacity onPress={() => router.push({ pathname: "/edit-list", params: { id: list.id } })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Edit3 size={20} color={Colors.primary} /></TouchableOpacity><TouchableOpacity onPress={handleDeleteList} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Trash2 size={20} color={Colors.error} /></TouchableOpacity></View>) }} />
      <View style={styles.container}>
        <FlatList data={listAnimals} keyExtractor={(item) => item.id} renderItem={({ item, index }) => (<ListAnimalCard animal={item} index={index} onRemove={() => handleRemoveAnimal(item.id)} />)} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
          ListHeaderComponent={<View>
            <View style={styles.listHeader}><View style={[styles.listIconBadge, { backgroundColor: list.color + "20" }]}><Text style={styles.listIconText}>{list.icon}</Text></View><Text style={styles.listTitle}>{list.name}</Text><Text style={styles.listCount}>{listAnimals.length} animals</Text></View>
            {subLists.length > 0 && (<View style={styles.subListsSection}><Text style={styles.subListsSectionTitle}>Sub-Lists</Text>{subLists.map((sl) => { const count = sl.animalIds.filter((aid) => animals.some((a) => a.id === aid)).length; return <SubListCard key={sl.id} list={sl} animalCount={count} />; })}
              <TouchableOpacity style={styles.addSubListBtn} onPress={() => router.push({ pathname: "/create-list", params: { parentId: list.id, parentType: list.listType, parentSpecies: list.species ?? "" } })} activeOpacity={0.7}><Plus size={14} color={Colors.primary} /><Text style={styles.addSubListText}>Add Sub-List</Text></TouchableOpacity></View>)}
            {subLists.length === 0 && !list.parentId && (<TouchableOpacity style={styles.createSubListHint} onPress={() => router.push({ pathname: "/create-list", params: { parentId: list.id, parentType: list.listType, parentSpecies: list.species ?? "" } })} activeOpacity={0.7}><Plus size={14} color={Colors.primary} /><Text style={styles.createSubListHintText}>Create a Sub-List</Text></TouchableOpacity>)}
          </View>}
          ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyEmoji}>📋</Text><Text style={styles.emptyTitle}>No Animals in This List</Text><Text style={styles.emptySubtitle}>Tap the button below to add animals</Text></View>}
        />
        <View style={styles.fabGroup}>
          <TouchableOpacity style={styles.fabSecondary} onPress={() => router.push({ pathname: "/add-to-list", params: { listId: list.id } })} activeOpacity={0.85}><Plus size={20} color={Colors.primary} /><Text style={styles.fabSecondaryText}>Existing</Text></TouchableOpacity>
          <TouchableOpacity style={styles.fab} onPress={() => { if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push({ pathname: "/add-animal-to-list", params: { listId: list.id, listType: list.listType, listSpecies: list.species ?? "" } }); }} activeOpacity={0.85}><UserPlus size={22} color={Colors.textInverse} /><Text style={styles.fabText}>New</Text></TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  notFoundText: { fontSize: 16, color: Colors.textSecondary },
  headerActions: { flexDirection: "row", gap: 16 },
  listContent: { paddingBottom: 100 },
  listHeader: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 20 },
  listIconBadge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  listIconText: { fontSize: 28 },
  listTitle: { fontSize: 22, fontWeight: "800" as const, color: Colors.text },
  listCount: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  cardWrapper: { paddingHorizontal: 16, paddingTop: 10 },
  card: { backgroundColor: Colors.surface, borderRadius: 18, flexDirection: "row", overflow: "hidden", shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3, alignItems: "center" },
  cardImageContainer: { width: 90, height: 100, position: "relative" },
  cardImage: { width: 90, height: 100, resizeMode: "cover" },
  cardImagePlaceholder: { width: 90, height: 100, backgroundColor: Colors.secondaryLight, alignItems: "center", justifyContent: "center" },
  speciesEmoji: { fontSize: 32 },
  tagBadge: { position: "absolute", top: 6, left: 6, backgroundColor: "rgba(31, 61, 43, 0.85)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagBadgeText: { fontSize: 10, fontWeight: "700" as const, color: "#FFFFFF" },
  cardContent: { flex: 1, padding: 12, justifyContent: "center" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  animalName: { fontSize: 16, fontWeight: "700" as const, color: Colors.text, flex: 1 },
  animalBreed: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardMeta: { flexDirection: "row", marginTop: 8, gap: 5 },
  metaChip: { backgroundColor: Colors.backgroundDark, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  metaChipText: { fontSize: 10, color: Colors.textSecondary, fontWeight: "500" as const, textTransform: "capitalize" as const },
  removeBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  fabGroup: { position: "absolute", bottom: 20, right: 16, flexDirection: "row", gap: 10 },
  fabSecondary: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4, borderWidth: 1, borderColor: Colors.border },
  fabSecondaryText: { fontSize: 14, fontWeight: "700" as const, color: Colors.primary },
  fab: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.accent, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 20, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  fabText: { fontSize: 14, fontWeight: "700" as const, color: Colors.textInverse },
  emptyState: { alignItems: "center", paddingTop: 40, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" as const, marginTop: 6 },
  subListsSection: { paddingHorizontal: 16, paddingBottom: 12 },
  subListsSectionTitle: { fontSize: 12, fontWeight: "700" as const, color: Colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 8 },
  subListRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, borderLeftWidth: 3, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  subListIcon: { fontSize: 16, marginRight: 8 },
  subListInfo: { flex: 1, marginRight: 6 },
  subListName: { fontSize: 14, fontWeight: "600" as const, color: Colors.text },
  subListCount: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  addSubListBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  addSubListText: { fontSize: 13, fontWeight: "600" as const, color: Colors.primary },
  createSubListHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginHorizontal: 16, marginBottom: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, borderStyle: "dashed" },
  createSubListHintText: { fontSize: 13, fontWeight: "600" as const, color: Colors.primary },
});
