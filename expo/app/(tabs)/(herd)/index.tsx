import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Animated,
  Image,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Search, ChevronRight, Plus, Skull, HelpCircle, Stethoscope } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch, HERD_GROUP_CONFIG } from "@/providers/RanchProvider";
import { Animal, HerdGroup } from "@/types";
import { SPECIES_ICONS, getGenderTitle } from "@/mocks/animals";
import { getAnimalAge } from "@/utils/helpers";
import BusinessYearPicker from "@/components/BusinessYearPicker";

function GroupSummaryCard({
  group,
  count,
  isSelected,
  onPress,
}: {
  group: HerdGroup;
  count: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const Colors = useColors();
  const config = HERD_GROUP_CONFIG[group];
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.groupCard,
          isSelected && { borderColor: config.color, borderWidth: 2 },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Text style={styles.groupEmoji}>{config.emoji}</Text>
        <Text style={[styles.groupCount, { color: config.color }]}>{count}</Text>
        <Text style={styles.groupLabel}>{config.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function DeceasedCard({
  count,
  isSelected,
  onPress,
}: {
  count: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.deceasedCard,
          isSelected && { borderColor: "#8B8B8B", borderWidth: 2 },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={styles.deceasedIconWrap}>
          <Skull size={20} color="#8B8B8B" />
        </View>
        <Text style={styles.deceasedCount}>{count}</Text>
        <Text style={styles.deceasedLabel}>Deceased</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function AnimalRow({ animal, yearLabel, showYear }: { animal: Animal; yearLabel: string; showYear: boolean }) {
  const Colors = useColors();
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/animal/${animal.id}`);
  }, [animal.id, router]);

  const genderTitle = getGenderTitle(animal.species, animal.sex);

  return (
    <Animated.View style={[styles.animalRow, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.animalRowInner}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        testID={`herd-animal-${animal.id}`}
      >
        <View style={styles.animalAvatar}>
          {animal.photoUrl ? (
            <Image source={{ uri: animal.photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarEmoji}>{SPECIES_ICONS[animal.species] || "🐾"}</Text>
          )}
        </View>
        <View style={styles.animalInfo}>
          <View style={styles.animalTagRow}>
            <Text style={styles.animalTag}>{animal.tagId}</Text>

          </View>
          {animal.name ? <Text style={styles.animalName} numberOfLines={1}>{animal.name}</Text> : null}
          {showYear && yearLabel ? (
            <Text style={styles.yearContext} numberOfLines={1}>{yearLabel}</Text>
          ) : null}
          <View style={styles.animalMeta}>
            <Text style={styles.metaText}>{animal.breed}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>{genderTitle}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>{getAnimalAge(animal.birthDate)}</Text>
          </View>
        </View>
        <ChevronRight size={18} color={Colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HerdScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { activeAnimals, animalsByHerdGroup, getBusinessYearName, animals, deceasedAnimals, needsAttentionAnimals, animalStats } = useRanch();
  const [selectedGroup, setSelectedGroup] = useState<HerdGroup | "deceased" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const groupOrder: HerdGroup[] = ["cows", "heifers", "calves", "bulls", "steers"];

  const visibleGroups = useMemo(
    () => groupOrder.filter((g) => animalsByHerdGroup[g].length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [animalsByHerdGroup, groupOrder.length],
  );

  const effectiveGroup = selectedGroup === "deceased"
    ? "deceased"
    : selectedGroup && visibleGroups.includes(selectedGroup)
      ? selectedGroup
      : visibleGroups[0] ?? null;

  const filteredAnimals = useMemo(() => {
    let list = effectiveGroup === "deceased"
      ? deceasedAnimals
      : effectiveGroup
        ? animalsByHerdGroup[effectiveGroup] ?? []
        : [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.tagId.toLowerCase().includes(q) ||
          (a.name ?? "").toLowerCase().includes(q) ||
          a.breed.toLowerCase().includes(q),
      );
    }
    return list;
  }, [animalsByHerdGroup, effectiveGroup, searchQuery, deceasedAnimals]);

  const handleGroupPress = useCallback((group: HerdGroup | "deceased") => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    setSelectedGroup(group);
  }, []);

  const duplicateTagIds = useMemo(() => {
    const tagCounts = new Map<string, number>();
    animals.forEach((a) => {
      const key = a.tagId.toLowerCase();
      tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
    });
    const dupes = new Set<string>();
    tagCounts.forEach((count, key) => {
      if (count > 1) dupes.add(key);
    });
    return dupes;
  }, [animals]);

  const renderItem = useCallback(
    ({ item }: { item: Animal }) => {
      const showYear = duplicateTagIds.has(item.tagId.toLowerCase());
      const yearLabel = item.businessYearId ? getBusinessYearName(item.businessYearId) : "";
      return <AnimalRow animal={item} yearLabel={yearLabel} showYear={showYear} />;
    },
    [duplicateTagIds, getBusinessYearName],
  );

  const renderHeader = useCallback(() => (
    <View>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.screenTitle}>Herd</Text>
          <Text style={styles.headcount}>
            {animalStats.total} head breeding{animalStats.calvesCount > 0 ? ` · ${animalStats.calvesCount} calves` : ""}
          </Text>
          {deceasedAnimals.length > 0 && (
            <Text style={styles.headcount}>{deceasedAnimals.length} deceased</Text>
          )}
        </View>
        <BusinessYearPicker />
      </View>

      <View style={styles.groupGrid}>
        {visibleGroups.map((group) => (
          <GroupSummaryCard
            key={group}
            group={group}
            count={animalsByHerdGroup[group].length}
            isSelected={effectiveGroup === group}
            onPress={() => handleGroupPress(group)}
          />
        ))}
        {deceasedAnimals.length > 0 && (
          <DeceasedCard
            count={deceasedAnimals.length}
            isSelected={effectiveGroup === "deceased"}
            onPress={() => handleGroupPress("deceased")}
          />
        )}
      </View>

      {needsAttentionAnimals.length > 0 && (
        <TouchableOpacity
          style={styles.attentionBanner}
          onPress={() => {
            if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/needs-attention");
          }}
          activeOpacity={0.8}
        >
          <View style={styles.attentionIconWrap}>
            <Stethoscope size={18} color="#D4943A" />
          </View>
          <View style={styles.attentionTextWrap}>
            <Text style={styles.attentionTitle}>{needsAttentionAnimals.length} Need{needsAttentionAnimals.length === 1 ? "s" : ""} Attention</Text>
            <Text style={styles.attentionSubtitle}>Animals requiring follow-up care</Text>
          </View>
          <ChevronRight size={18} color="#D4943A" />
        </TouchableOpacity>
      )}

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>
          {effectiveGroup === "deceased" ? "Deceased" : effectiveGroup ? HERD_GROUP_CONFIG[effectiveGroup].label : "No Animals"}
        </Text>
        <Text style={styles.listCount}>{filteredAnimals.length} head</Text>
      </View>
    </View>
  ), [activeAnimals.length, deceasedAnimals.length, visibleGroups, animalsByHerdGroup, effectiveGroup, handleGroupPress, filteredAnimals.length, styles]);

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Search size={16} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tag, name, breed..."
          placeholderTextColor={Colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="herd-search"
        />
      </View>
      <FlatList
        data={filteredAnimals}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🐄</Text>
            <Text style={styles.emptyTitle}>No Animals</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? "Try a different search" : "Add your first animal to get started"}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/add-animal");
        }}
        activeOpacity={0.85}
        testID="add-animal-fab"
      >
        <Plus size={24} color={Colors.textInverse} />
        <Text style={styles.fabLabel}>Add Animal</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 100,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headcount: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  groupGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center",
    minWidth: 80,
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  groupEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  groupCount: {
    fontSize: 24,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: Colors.text,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  listCount: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textTertiary,
  },
  animalRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  animalRowInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  animalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.secondaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    resizeMode: "cover",
  },
  avatarEmoji: {
    fontSize: 24,
  },
  animalInfo: {
    flex: 1,
  },
  animalTagRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  animalTag: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  genBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.primary + "15",
  },
  genBadgeEst: {
    backgroundColor: "#D4943A" + "18",
  },
  genBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  genBadgeTextEst: {
    color: "#D4943A",
  },
  animalName: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  animalMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textTertiary,
  },
  yearContext: {
    fontSize: 11,
    fontWeight: "500" as const,
    color: Colors.primary,
    marginTop: 1,
  },
  empty: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center" as const,
    marginTop: 6,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  fabLabel: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.textInverse,
  },
  deceasedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center" as const,
    minWidth: 80,
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 2,
    borderColor: "transparent" as const,
  },
  deceasedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#8B8B8B" + "18",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 6,
  },
  deceasedCount: {
    fontSize: 24,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
    color: "#8B8B8B",
  },
  deceasedLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  attentionBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#D4943A" + "12",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D4943A" + "28",
  },
  attentionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#D4943A" + "20",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: 12,
  },
  attentionTextWrap: {
    flex: 1,
  },
  attentionTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#D4943A",
  },
  attentionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
