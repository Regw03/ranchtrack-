import React, { useMemo, useCallback, useRef, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, Platform, Animated } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { ChevronRight, Edit3, Trash2, Plus, UserMinus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Animal } from "@/types";
import { SPECIES_ICONS, getAnimalDisplayName, getGenderTitle } from "@/mocks/animals";
import { getAnimalAge } from "@/utils/helpers";

function GroupAnimalCard({ animal, index, onRemove }: { animal: Animal; index: number; onRemove: () => void }) {
  const Colors = useColors();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 40, useNativeDriver: true }).start(); }, [fadeAnim, index]);

  return (
    <Animated.View style={[styles.cardWrapper, { opacity: fadeAnim, transform: [{ scale: scaleAnim }, { translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <TouchableOpacity style={styles.card}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        onPress={() => { if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/animal/${animal.id}`); }} activeOpacity={1}>
        <View style={styles.cardImageContainer}>
          {animal.photoUrl ? <Image source={{ uri: animal.photoUrl }} style={styles.cardImage} /> : <View style={styles.cardImagePlaceholder}><Text style={styles.speciesEmoji}>{SPECIES_ICONS[animal.species] || "🐾"}</Text></View>}
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}><Text style={styles.animalName} numberOfLines={1}>{getAnimalDisplayName(animal)}</Text><ChevronRight size={18} color={Colors.textTertiary} /></View>
          <Text style={styles.animalBreed} numberOfLines={1}>{animal.breed}</Text>
          <View style={styles.cardMeta}>
            <View style={styles.metaChip}><Text style={styles.metaChipText}>{animal.tagId}</Text></View>
            <View style={styles.metaChip}><Text style={styles.metaChipText}>{getAnimalAge(animal.birthDate)}</Text></View>
            <View style={styles.metaChip}><Text style={styles.metaChipText}>{["male", "steer", "gelding", "colt"].includes(animal.sex) ? "♂" : "♀"} {getGenderTitle(animal.species, animal.sex)}</Text></View>
          </View>
        </View>
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><UserMinus size={16} color={Colors.error} /></TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function BreedingGroupDetailScreen() {
  const Colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getBreedingGroupById, animals, removeAnimalFromBreedingGroup, deleteBreedingGroup } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const group = useMemo(() => getBreedingGroupById(id ?? ""), [getBreedingGroupById, id]);
  const groupAnimals = useMemo(() => {
    if (!group) return [];
    return group.animalIds.map((aid) => animals.find((a) => a.id === aid)).filter((a): a is Animal => a !== undefined);
  }, [group, animals]);

  const handleRemoveAnimal = useCallback((animalId: string) => {
    if (!group) return;
    const animal = animals.find((a) => a.id === animalId);
    const name = animal ? getAnimalDisplayName(animal) : "this animal";
    Alert.alert("Remove from Group", `Remove ${name} from this breeding group?`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => {
      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      void removeAnimalFromBreedingGroup({ groupId: group.id, animalId });
    }}]);
  }, [group, animals, removeAnimalFromBreedingGroup]);

  const handleDeleteGroup = useCallback(() => {
    if (!group) return;
    Alert.alert("Delete Group", `Are you sure you want to delete "${group.name}"? This won't delete any animals.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); await deleteBreedingGroup(group.id); router.back(); } }]);
  }, [group, deleteBreedingGroup, router]);

  if (!group) return (<View style={styles.notFound}><Text style={styles.notFoundText}>Group not found</Text></View>);

  return (
    <>
      <Stack.Screen options={{ title: group.name, headerRight: () => (<View style={styles.headerActions}>
        <TouchableOpacity onPress={() => router.push({ pathname: "/edit-breeding-group" as any, params: { id: group.id } })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Edit3 size={20} color={Colors.primary} /></TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteGroup} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Trash2 size={20} color={Colors.error} /></TouchableOpacity>
      </View>) }} />
      <View style={styles.container}>
        <FlatList data={groupAnimals} keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (<GroupAnimalCard animal={item} index={index} onRemove={() => handleRemoveAnimal(item.id)} />)}
          contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
          ListHeaderComponent={<View>
            <View style={styles.groupHeader}>
              <View style={[styles.colorBar, { backgroundColor: group.color }]} />
              <Text style={styles.groupTitle}>{group.name}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}><Text style={styles.statValue}>{groupAnimals.length}</Text><Text style={styles.statLabel}>Animal{groupAnimals.length !== 1 ? "s" : ""}</Text></View>
              </View>
            </View>
            {groupAnimals.length > 0 && (<View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Animals ({groupAnimals.length})</Text></View>)}
          </View>}
          ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyEmoji}>🐄</Text><Text style={styles.emptyTitle}>No Animals Yet</Text><Text style={styles.emptySubtitle}>Add animals to start tracking this breeding group</Text></View>}
        />
        <View style={styles.fabGroup}><TouchableOpacity style={styles.fab} onPress={() => router.push({ pathname: "/add-animals-to-breeding-group" as any, params: { groupId: group.id } })} activeOpacity={0.85}><Plus size={22} color={Colors.textInverse} /><Text style={styles.fabText}>Add Animals</Text></TouchableOpacity></View>
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
  groupHeader: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 20 },
  colorBar: { width: 48, height: 5, borderRadius: 3, marginBottom: 14 },
  groupTitle: { fontSize: 24, fontWeight: "800" as const, color: Colors.text, letterSpacing: -0.3 },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 16, backgroundColor: Colors.surface, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, gap: 28 },
  statBox: { alignItems: "center" },
  statValue: { fontSize: 28, fontWeight: "800" as const, color: Colors.text },
  statLabel: { fontSize: 12, fontWeight: "600" as const, color: Colors.textTertiary, marginTop: 2 },
  sectionHeaderRow: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "700" as const, color: Colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: 0.6 },
  cardWrapper: { paddingHorizontal: 16, paddingTop: 8 },
  card: { backgroundColor: Colors.surface, borderRadius: 18, flexDirection: "row", overflow: "hidden", shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3, alignItems: "center" },
  cardImageContainer: { width: 80, height: 90, position: "relative" },
  cardImage: { width: 80, height: 90, resizeMode: "cover" },
  cardImagePlaceholder: { width: 80, height: 90, backgroundColor: Colors.secondaryLight, alignItems: "center", justifyContent: "center" },
  speciesEmoji: { fontSize: 28 },
  cardContent: { flex: 1, padding: 12, justifyContent: "center" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  animalName: { fontSize: 16, fontWeight: "700" as const, color: Colors.text, flex: 1 },
  animalBreed: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardMeta: { flexDirection: "row", marginTop: 8, gap: 5 },
  metaChip: { backgroundColor: Colors.backgroundDark, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  metaChipText: { fontSize: 10, color: Colors.textSecondary, fontWeight: "500" as const },
  removeBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  emptyState: { alignItems: "center", paddingTop: 40, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" as const, marginTop: 6 },
  fabGroup: { position: "absolute", bottom: 20, right: 16 },
  fab: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.accent, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 20, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  fabText: { fontSize: 14, fontWeight: "700" as const, color: Colors.textInverse },
});
