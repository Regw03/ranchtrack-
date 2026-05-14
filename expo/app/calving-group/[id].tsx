import React, { useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { ChevronRight, Edit3, Trash2, Baby, UserMinus, AlertCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Animal, CalvingRecord } from "@/types";
import { SPECIES_ICONS, getAnimalDisplayName } from "@/mocks/animals";
import { getAnimalAge } from "@/utils/helpers";

interface PairedRecord {
  cow: Animal;
  calf: Animal | null;
  calvingRecord: CalvingRecord | null;
}

function PairedCalvingCard({
  record,
  index,
  onRemoveCow,
  onNavigate,
}: {
  record: PairedRecord;
  index: number;
  onRemoveCow: () => void;
  onNavigate: (animalId: string) => void;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, index]);

  const { cow, calf, calvingRecord } = record;
  const hasCalved = !!calf;
  const calfSex = calvingRecord?.calfSex;
  const isHeifer = calfSex === "female";

  return (
    <Animated.View style={[styles.pairedCard, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={styles.cowRow}
        onPress={() => onNavigate(cow.id)}
        activeOpacity={0.75}
      >
        <View style={styles.animalIcon}>
          <Text style={styles.animalEmoji}>
            {SPECIES_ICONS[cow.species] || "🐄"}
          </Text>
        </View>
        <View style={styles.animalInfo}>
          <View style={styles.animalTopRow}>
            <Text style={styles.animalTag}>{cow.tagId}</Text>
            <View style={styles.damBadge}>
              <Text style={styles.damBadgeText}>Dam</Text>
            </View>
          </View>
          {cow.breed ? (
            <Text style={styles.animalBreed} numberOfLines={1}>{cow.breed}</Text>
          ) : null}
          {cow.birthDate ? (
            <Text style={styles.animalAge}>{getAnimalAge(cow.birthDate)}</Text>
          ) : null}
        </View>
        <View style={styles.rowActions}>
          <ChevronRight size={16} color={Colors.textTertiary} />
          <TouchableOpacity
            onPress={onRemoveCow}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.removeBtn}
          >
            <UserMinus size={15} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <View style={styles.connector}>
        <View style={styles.connectorLine} />
        <View style={[styles.connectorDot, hasCalved && { backgroundColor: Colors.success }]} />
        <View style={styles.connectorLine} />
      </View>

      {hasCalved && calf ? (
        <TouchableOpacity
          style={styles.calfRow}
          onPress={() => onNavigate(calf.id)}
          activeOpacity={0.75}
        >
          <View style={[styles.animalIcon, styles.calfIcon]}>
            <Text style={styles.animalEmoji}>🐮</Text>
          </View>
          <View style={styles.animalInfo}>
            <View style={styles.animalTopRow}>
              <Text style={styles.animalTag}>{calf.tagId}</Text>
              <View style={[
                styles.calfBadge,
                { backgroundColor: isHeifer ? "#2D7A9C18" : Colors.accent + "18" },
              ]}>
                <Text style={[
                  styles.calfBadgeText,
                  { color: isHeifer ? "#2D7A9C" : Colors.accent },
                ]}>
                  {isHeifer ? "Heifer Calf" : "Bull Calf"}
                </Text>
              </View>
            </View>
            {calf.breed ? (
              <Text style={styles.animalBreed} numberOfLines={1}>{calf.breed}</Text>
            ) : null}
            {calvingRecord?.date ? (
              <Text style={styles.animalAge}>
                Born {new Date(calvingRecord.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                {calvingRecord.assisted ? " · Assisted" : ""}
              </Text>
            ) : null}
            {calvingRecord?.notes ? (
              <Text style={styles.calfNotes} numberOfLines={1}>{calvingRecord.notes}</Text>
            ) : null}
          </View>
          <ChevronRight size={16} color={Colors.textTertiary} style={{ marginTop: 2 }} />
        </TouchableOpacity>
      ) : (
        <View style={styles.pendingRow}>
          <AlertCircle size={14} color={Colors.textTertiary} />
          <Text style={styles.pendingText}>Not yet calved</Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function CalvingGroupDetailScreen() {
  const Colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    getCalvingGroupById,
    animals,
    calvingRecordsForYear,
    removeCowFromCalvingGroup,
    deleteCalvingGroup,
    getAnimalById,
  } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const group = useMemo(
    () => getCalvingGroupById(id ?? ""),
    [getCalvingGroupById, id],
  );

  const pairedRecords = useMemo<PairedRecord[]>(() => {
    if (!group) return [];
    return group.cowIds.map((cowId) => {
      const cow = animals.find((a) => a.id === cowId);
      if (!cow) return null;
      const calvingRecord = calvingRecordsForYear.find((r) => r.motherId === cowId) ?? null;
      const calf = calvingRecord?.calfId ? (getAnimalById(calvingRecord.calfId) ?? null) : null;
      return { cow, calf, calvingRecord };
    }).filter((r): r is PairedRecord => r !== null);
  }, [group, animals, calvingRecordsForYear, getAnimalById]);

  const unmatchedCalves = useMemo<Animal[]>(() => {
    if (!group) return [];
    const pairedCalfIds = new Set(
      pairedRecords.map((r) => r.calf?.id).filter(Boolean) as string[],
    );
    return group.calfIds
      .filter((cid) => !pairedCalfIds.has(cid))
      .map((cid) => animals.find((a) => a.id === cid))
      .filter((a): a is Animal => a !== undefined);
  }, [group, pairedRecords, animals]);

  const calvedCount = pairedRecords.filter((r) => !!r.calf).length;
  const totalCows = pairedRecords.length;

  const handleRemoveCow = useCallback(
    (cowId: string) => {
      if (!group) return;
      const animal = animals.find((a) => a.id === cowId);
      const name = animal ? getAnimalDisplayName(animal) : "this animal";
      Alert.alert(
        "Remove from Group",
        `Remove ${name} from this calving group?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              if (Platform.OS !== "web")
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void removeCowFromCalvingGroup({ groupId: group.id, cowId });
            },
          },
        ],
      );
    },
    [group, animals, removeCowFromCalvingGroup],
  );

  const handleDeleteGroup = useCallback(() => {
    if (!group) return;
    Alert.alert(
      "Delete Group",
      `Delete "${group.name}"? This won't delete any animals.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web")
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteCalvingGroup(group.id);
            router.back();
          },
        },
      ],
    );
  }, [group, deleteCalvingGroup, router]);

  const handleNavigateAnimal = useCallback(
    (animalId: string) => {
      if (Platform.OS !== "web")
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/animal/${animalId}`);
    },
    [router],
  );

  if (!group) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Group not found</Text>
      </View>
    );
  }

  const progressPct = totalCows > 0 ? Math.round((calvedCount / totalCows) * 100) : 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: group.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/edit-calving-group" as never,
                    params: { id: group.id },
                  })
                }
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Edit3 size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteGroup}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Trash2 size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <View style={styles.container}>
        <FlatList
          data={pairedRecords}
          keyExtractor={(item) => item.cow.id}
          renderItem={({ item, index }) => (
            <PairedCalvingCard
              record={item}
              index={index}
              onRemoveCow={() => handleRemoveCow(item.cow.id)}
              onNavigate={handleNavigateAnimal}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={styles.groupHeader}>
                <View style={[styles.colorBar, { backgroundColor: group.color }]} />
                <Text style={styles.groupTitle}>{group.name}</Text>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{totalCows}</Text>
                    <Text style={styles.statLabel}>Cows</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: Colors.success }]}>
                      {calvedCount}
                    </Text>
                    <Text style={styles.statLabel}>Calved</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: Colors.warning }]}>
                      {totalCows - calvedCount}
                    </Text>
                    <Text style={styles.statLabel}>Remaining</Text>
                  </View>
                </View>

                {totalCows > 0 && (
                  <View style={styles.progressBarWrap}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: (`${progressPct}%` as unknown) as number,
                            backgroundColor: Colors.success,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressLabel}>{progressPct}% calved</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.calvingBtn}
                onPress={() => {
                  if (Platform.OS !== "web")
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  router.push({
                    pathname: "/log-calving",
                    params: { calvingGroupId: group.id },
                  });
                }}
                activeOpacity={0.85}
              >
                <Baby size={20} color="#fff" />
                <Text style={styles.calvingBtnText}>Log Calving in This Group</Text>
              </TouchableOpacity>

              {pairedRecords.length > 0 && (
                <Text style={styles.listSectionTitle}>
                  Cow — Calf Pairs ({pairedRecords.length})
                </Text>
              )}
            </View>
          }
          ListFooterComponent={
            <>
              {unmatchedCalves.length > 0 && (
                <View style={styles.unmatchedSection}>
                  <Text style={styles.listSectionTitle}>
                    Additional Calves ({unmatchedCalves.length})
                  </Text>
                  {unmatchedCalves.map((calf) => (
                    <TouchableOpacity
                      key={calf.id}
                      style={styles.unmatchedCard}
                      onPress={() => handleNavigateAnimal(calf.id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.animalIcon}>
                        <Text style={styles.animalEmoji}>🐮</Text>
                      </View>
                      <View style={styles.animalInfo}>
                        <Text style={styles.animalTag}>{calf.tagId}</Text>
                        {calf.breed ? (
                          <Text style={styles.animalBreed}>{calf.breed}</Text>
                        ) : null}
                      </View>
                      <ChevronRight size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={{ height: 100 }} />
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🐄</Text>
              <Text style={styles.emptyTitle}>No Cows Yet</Text>
              <Text style={styles.emptySubtitle}>
                Add cows to start tracking this calving group
              </Text>
            </View>
          }
        />

      </View>
    </>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    notFound: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: Colors.background },
    notFoundText: { fontSize: 16, color: Colors.textSecondary },
    headerActions: { flexDirection: "row" as const, gap: 16 },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },

    groupHeader: { alignItems: "center" as const, paddingVertical: 24, paddingHorizontal: 4 },
    colorBar: { width: 48, height: 5, borderRadius: 3, marginBottom: 14 },
    groupTitle: { fontSize: 24, fontWeight: "800" as const, color: Colors.text, letterSpacing: -0.3, marginBottom: 16 },

    statsRow: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: Colors.surface, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, gap: 24, borderWidth: 1, borderColor: Colors.borderLight },
    statBox: { alignItems: "center" as const },
    statValue: { fontSize: 26, fontWeight: "800" as const, color: Colors.text },
    statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" as const, marginTop: 2 },
    statDivider: { width: 1, height: 36, backgroundColor: Colors.border },

    progressBarWrap: { marginTop: 16, width: "100%" as const, alignItems: "center" as const },
    progressBar: { width: "100%" as const, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden" as const },
    progressFill: { height: "100%" as const, borderRadius: 3 },
    progressLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, fontWeight: "600" as const },

    calvingBtn: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 10, backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, marginTop: 16, marginBottom: 4 },
    calvingBtnText: { fontSize: 16, fontWeight: "800" as const, color: "#fff" },

    listSectionTitle: { fontSize: 13, fontWeight: "800" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 1.1, marginTop: 20, marginBottom: 12, marginLeft: 2 },

    pairedCard: {
      backgroundColor: Colors.surface,
      borderRadius: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
      overflow: "hidden" as const,
    },
    cowRow: { flexDirection: "row" as const, alignItems: "center" as const, padding: 14, gap: 12 },
    calfRow: { flexDirection: "row" as const, alignItems: "center" as const, padding: 14, gap: 12, backgroundColor: Colors.backgroundDark },
    pendingRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, padding: 14, paddingTop: 10, paddingBottom: 14 },
    pendingText: { fontSize: 13, color: Colors.textTertiary, fontStyle: "italic" as const },

    connector: { flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 20, gap: 0 },
    connectorLine: { flex: 1, height: 1, backgroundColor: Colors.border },
    connectorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border, marginHorizontal: 6 },

    animalIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.backgroundDark, alignItems: "center" as const, justifyContent: "center" as const },
    calfIcon: { backgroundColor: Colors.border + "40" },
    animalEmoji: { fontSize: 20 },
    animalInfo: { flex: 1 },
    animalTopRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, flexWrap: "wrap" as const },
    animalTag: { fontSize: 16, fontWeight: "800" as const, color: Colors.text },
    animalBreed: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    animalAge: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
    calfNotes: { fontSize: 12, color: Colors.textTertiary, marginTop: 2, fontStyle: "italic" as const },

    damBadge: { backgroundColor: Colors.primary + "18", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    damBadgeText: { fontSize: 11, fontWeight: "700" as const, color: Colors.primary },
    calfBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    calfBadgeText: { fontSize: 11, fontWeight: "700" as const },

    rowActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
    removeBtn: { padding: 4 },

    unmatchedSection: { marginTop: 4 },
    unmatchedCard: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight },

    emptyState: { alignItems: "center" as const, paddingTop: 60, paddingBottom: 40 },
    emptyEmoji: { fontSize: 48, marginBottom: 14 },
    emptyTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text, marginBottom: 6 },
    emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" as const },

    fabGroup: { position: "absolute" as const, bottom: 24, right: 20 },
    fab: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    fabText: { fontSize: 15, fontWeight: "700" as const, color: "#fff" },
  });
