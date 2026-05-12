import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Plus, Edit3, Trash2, Baby, ChevronRight, Search } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { CalvingRecord } from "@/types";

// ─── Calf type config ─────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  heifer: { label: "Heifer", color: "#2D7A9C", bg: "#2D7A9C18" },
  steer: { label: "Steer", color: "#7B5EA7", bg: "#7B5EA718" },
  bull: { label: "Bull", color: "#C4622D", bg: "#C4622D18" },
};

// ─── Single calving record card ───────────────────────────────────────────────

function CalvingCard({
  record,
  onPress,
  onDelete,
}: {
  record: CalvingRecord;
  onPress: () => void;
  onDelete: () => void;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const cfg = TYPE_CONFIG[record.calfType] ?? TYPE_CONFIG.bull;

  const formattedDate = useMemo(() => {
    try {
      return new Date(record.date + "T12:00:00").toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return record.date;
    }
  }, [record.date]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onDelete}
      activeOpacity={0.75}
      delayLongPress={600}
    >
      <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardDate}>{formattedDate}</Text>
          <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.cardMainRow}>
          <View style={styles.tagBlock}>
            <Text style={styles.tagBlockLabel}>Cow</Text>
            <Text style={styles.tagBlockValue} numberOfLines={1}>
              {record.cowTag}
            </Text>
          </View>

          <Text style={styles.arrow}>→</Text>

          <View style={styles.tagBlock}>
            <Text style={styles.tagBlockLabel}>Calf</Text>
            <Text style={styles.tagBlockValue} numberOfLines={1}>
              {record.calfTag}
            </Text>
          </View>

          <ChevronRight size={18} color={Colors.textTertiary} style={styles.chevron} />
        </View>

        {(record.assisted || record.birthWeight || record.cowNotes || record.calfNotes) ? (
          <View style={styles.extrasRow}>
            {record.assisted && (
              <View style={styles.extraChip}>
                <Text style={styles.extraChipText}>Assisted</Text>
              </View>
            )}
            {record.birthWeight ? (
              <View style={styles.extraChip}>
                <Text style={styles.extraChipText}>
                  {record.birthWeight} {record.birthWeightUnit ?? "lbs"}
                </Text>
              </View>
            ) : null}
            {record.cowNotes ? (
              <View style={styles.extraChip}>
                <Text style={styles.extraChipText} numberOfLines={1}>
                  Cow: {record.cowNotes}
                </Text>
              </View>
            ) : null}
            {record.calfNotes ? (
              <View style={styles.extraChip}>
                <Text style={styles.extraChipText} numberOfLines={1}>
                  Calf: {record.calfNotes}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CalvingListDetailScreen() {
  const Colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    getCalvingListById,
    getCalvingRecordsForList,
    calvingRecords,
    deleteCalvingList,
    deleteCalvingRecord,
  } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [searchQuery] = useState<string>("");

  const list = useMemo(
    () => getCalvingListById(id ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, getCalvingListById, calvingRecords.length],
  );

  const allRecords = useMemo(
    () => getCalvingRecordsForList(id ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, getCalvingRecordsForList, calvingRecords.length],
  );

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return allRecords;
    const q = searchQuery.toLowerCase();
    return allRecords.filter(
      (r) =>
        r.cowTag.toLowerCase().includes(q) ||
        r.calfTag.toLowerCase().includes(q) ||
        r.calfType.toLowerCase().includes(q),
    );
  }, [allRecords, searchQuery]);

  const heiferCount = allRecords.filter((r) => r.calfType === "heifer").length;
  const steerCount = allRecords.filter((r) => r.calfType === "steer").length;
  const bullCount = allRecords.filter((r) => r.calfType === "bull").length;

  const handleDeleteRecord = useCallback(
    (record: CalvingRecord) => {
      Alert.alert(
        "Delete Record",
        `Delete calving record for cow ${record.cowTag} → calf ${record.calfTag}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              if (Platform.OS !== "web")
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await deleteCalvingRecord(record.id);
            },
          },
        ],
      );
    },
    [deleteCalvingRecord],
  );

  const handleDeleteList = useCallback(() => {
    if (!list) return;
    Alert.alert(
      "Delete List",
      `Delete "${list.name}" and all ${allRecords.length} record${allRecords.length !== 1 ? "s" : ""} in it? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web")
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteCalvingList(list.id);
            router.back();
          },
        },
      ],
    );
  }, [list, allRecords.length, deleteCalvingList, router]);

  const handleOpenRecord = useCallback(
    (record: CalvingRecord) => {
      if (Platform.OS !== "web")
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/calving-record/[id]" as never,
        params: { id: record.id } as never,
      });
    },
    [router],
  );

  const handleLogCalving = useCallback(() => {
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: "/log-calving" as never,
      params: { calvingListId: id } as never,
    });
  }, [router, id]);

  if (!list) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>List not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: list.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/edit-calving-list" as never,
                    params: { id: list.id } as never,
                  })
                }
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Edit3 size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteList}
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
          data={filteredRecords}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CalvingCard
              record={item}
              onPress={() => handleOpenRecord(item)}
              onDelete={() => handleDeleteRecord(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={styles.header}>
                <View style={[styles.colorBar, { backgroundColor: list.color }]} />
                <Text style={styles.listTitle}>{list.name}</Text>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>{allRecords.length}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: "#2D7A9C" }]}>{heiferCount}</Text>
                    <Text style={styles.statLabel}>Heifers</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: "#7B5EA7" }]}>{steerCount}</Text>
                    <Text style={styles.statLabel}>Steers</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={[styles.statNum, { color: "#C4622D" }]}>{bullCount}</Text>
                    <Text style={styles.statLabel}>Bulls</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.logBtn, { backgroundColor: list.color }]}
                onPress={handleLogCalving}
                activeOpacity={0.85}
              >
                <Baby size={20} color="#fff" />
                <Text style={styles.logBtnText}>Log Calving</Text>
              </TouchableOpacity>

              {allRecords.length > 3 && (
                <SafeAreaView edges={[]}>
                  <View style={styles.searchInner}>
                    <Search size={16} color={Colors.textTertiary} />
                    <Text style={styles.searchPlaceholder}>
                      Search by cow or calf tag...
                    </Text>
                  </View>
                </SafeAreaView>
              )}

              {allRecords.length > 0 && (
                <Text style={styles.sectionTitle}>
                  Records ({filteredRecords.length}
                  {filteredRecords.length !== allRecords.length ? ` of ${allRecords.length}` : ""})
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🐮</Text>
              <Text style={styles.emptyTitle}>No Records Yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap &quot;Log Calving&quot; to record your first calving event in this list.
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: list.color }]}
          onPress={handleLogCalving}
          activeOpacity={0.85}
        >
          <Plus size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    notFound: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const },
    notFoundText: { fontSize: 16, color: Colors.textSecondary },
    headerActions: { flexDirection: "row" as const, gap: 16 },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },

    header: { alignItems: "center" as const, paddingVertical: 24 },
    colorBar: { width: 48, height: 5, borderRadius: 3, marginBottom: 14 },
    listTitle: {
      fontSize: 24,
      fontWeight: "800" as const,
      color: Colors.text,
      letterSpacing: -0.3,
      marginBottom: 18,
    },
    statsRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
      gap: 16,
    },
    statBox: { alignItems: "center" as const, minWidth: 44 },
    statNum: { fontSize: 24, fontWeight: "800" as const, color: Colors.text },
    statLabel: {
      fontSize: 11,
      color: Colors.textSecondary,
      fontWeight: "600" as const,
      marginTop: 2,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    statDivider: { width: 1, height: 32, backgroundColor: Colors.border },

    logBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 10,
      borderRadius: 16,
      paddingVertical: 16,
      marginTop: 8,
      marginBottom: 4,
    },
    logBtnText: { fontSize: 16, fontWeight: "800" as const, color: "#fff" },

    searchInner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
      marginTop: 14,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    searchPlaceholder: {
      flex: 1,
      fontSize: 15,
      color: Colors.textTertiary,
    },

    sectionTitle: {
      fontSize: 13,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 1.1,
      marginTop: 20,
      marginBottom: 10,
      marginLeft: 2,
    },

    card: {
      flexDirection: "row" as const,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
      overflow: "hidden" as const,
    },
    cardAccent: { width: 4 },
    cardBody: { flex: 1, padding: 14 },
    cardTopRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: 10,
    },
    cardDate: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontWeight: "600" as const,
    },
    typeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    typeBadgeText: {
      fontSize: 12,
      fontWeight: "800" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    cardMainRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
    },
    tagBlock: { flex: 1 },
    tagBlockLabel: {
      fontSize: 11,
      color: Colors.textTertiary,
      fontWeight: "700" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    tagBlockValue: {
      fontSize: 20,
      fontWeight: "800" as const,
      color: Colors.text,
      letterSpacing: -0.3,
    },
    arrow: {
      fontSize: 18,
      color: Colors.textTertiary,
      fontWeight: "300" as const,
    },
    chevron: { marginLeft: 4 },

    extrasRow: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 6,
      marginTop: 10,
    },
    extraChip: {
      backgroundColor: Colors.backgroundDark,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      maxWidth: 180,
    },
    extraChipText: {
      fontSize: 11,
      color: Colors.textSecondary,
      fontWeight: "600" as const,
    },

    emptyState: {
      alignItems: "center" as const,
      paddingTop: 60,
      paddingHorizontal: 32,
    },
    emptyEmoji: { fontSize: 52, marginBottom: 16 },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: Colors.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center" as const,
      lineHeight: 22,
    },

    fab: {
      position: "absolute" as const,
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 6,
    },
  });
}
