import React, { useCallback, useMemo, useState } from "react";
import {
 View,
 Text,
 StyleSheet,
 FlatList,
 TouchableOpacity,
 Alert,
 Platform,
 TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Plus, Edit3, Trash2, Search, Baby } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { CalvingRecord } from "@/types";

const MONTHS = [
 "Jan", "Feb", "Mar", "Apr", "May", "Jun",
 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ─── Single record card ───────────────────────────────────────────────────────

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

 const dateStr = `${MONTHS[(record.birthMonth ?? 1) - 1]} ${String(record.birthDay ?? 1).padStart(2, "0")}`;

 return (
 <TouchableOpacity
 style={styles.card}
 onPress={onPress}
 onLongPress={onDelete}
 activeOpacity={0.75}
 delayLongPress={500}
 >
 {/* Date */}
 <View style={styles.cardDateBlock}>
 <Text style={styles.cardDateMonth}>
 {MONTHS[(record.birthMonth ?? 1) - 1]}
 </Text>
 <Text style={styles.cardDateDay}>
 {String(record.birthDay ?? 1).padStart(2, "0")}
 </Text>
 </View>

 {/* Divider */}
 <View style={styles.cardDivider} />

 {/* Tags */}
 <View style={styles.cardTags}>
 <View style={styles.cardTagRow}>
 <Text style={styles.cardTagLabel}>COW</Text>
 <Text style={styles.cardTagValue} numberOfLines={1}>{record.cowTag}</Text>
 </View>
 <View style={styles.cardTagRow}>
 <Text style={styles.cardTagLabel}>CALF</Text>
 <Text style={styles.cardTagValue} numberOfLines={1}>{record.calfTag}</Text>
 </View>
 </View>

 {/* Extras */}
 <View style={styles.cardRight}>
 {record.assisted && (
 <View style={styles.assistedPill}>
 <Text style={styles.assistedPillText}>Assisted</Text>
 </View>
 )}
 {record.photoUrl && (
 <Text style={styles.photoIndicator}>📷</Text>
 )}
 <Text style={styles.cardChevron}>›</Text>
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
 calvingRecords,
 deleteCalvingList,
 deleteCalvingRecord,
 updateCalvingList,
 } = useRanch();
 const styles = useMemo(() => createStyles(Colors), [Colors]);

 const [searchQuery, setSearchQuery] = useState("");

 const list = useMemo(
 () => getCalvingListById(id ?? ""),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [id, getCalvingListById, calvingRecords.length],
 );

 // All records for this list sorted newest first
 const allRecords = useMemo(
 () =>
 calvingRecords
 .filter((r) => r.calvingListId === id)
 .sort((a, b) => {
 // Sort by month then day, newest first within year
 if (b.birthMonth !== a.birthMonth) return (b.birthMonth ?? 0) - (a.birthMonth ?? 0);
 return (b.birthDay ?? 0) - (a.birthDay ?? 0);
 }),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [id, calvingRecords.length, calvingRecords],
 );

 // Search filters by cow tag or calf tag
 const filteredRecords = useMemo(() => {
 const q = searchQuery.trim().toLowerCase();
 if (!q) return allRecords;
 return allRecords.filter(
 (r) =>
 r.cowTag.toLowerCase().includes(q) ||
 r.calfTag.toLowerCase().includes(q),
 );
 }, [allRecords, searchQuery]);

 const handleDeleteRecord = useCallback(
 (record: CalvingRecord) => {
 Alert.alert(
 "Delete Record",
 `Delete the record for Cow ${record.cowTag} → Calf ${record.calfTag}?`,
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
 params: { id: record.id },
 });
 },
 [router],
 );

 const handleLogCalving = useCallback(() => {
 if (Platform.OS !== "web")
 void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
 router.push({
 pathname: "/log-calving" as never,
 params: { calvingListId: id },
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
 <View style={styles.headerBtns}>
 <TouchableOpacity
 onPress={() =>
 router.push({
 pathname: "/edit-calving-list" as never,
 params: { id: list.id },
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
 keyboardShouldPersistTaps="handled"
 ListHeaderComponent={
 <View>
 {/* Color bar + stats */}
 <View style={styles.header}>
 <View style={[styles.colorBar, { backgroundColor: list.color }]} />
 <Text style={styles.listTitle}>{list.name}</Text>
 <Text style={styles.recordCount}>
 {allRecords.length} record{allRecords.length !== 1 ? "s" : ""}
 </Text>
 </View>

 {/* Log calving button */}
 <TouchableOpacity
 style={[styles.logBtn, { backgroundColor: list.color }]}
 onPress={handleLogCalving}
 activeOpacity={0.85}
 >
 <Baby size={20} color="#fff" />
 <Text style={styles.logBtnText}>Log Calving</Text>
 </TouchableOpacity>

 {/* Search bar */}
 <View style={styles.searchBar}>
 <Search size={16} color={Colors.textTertiary} />
 <TextInput
 value={searchQuery}
 onChangeText={setSearchQuery}
 placeholder="Search by cow or calf tag..."
 placeholderTextColor={Colors.textTertiary}
 style={styles.searchInput}
 autoCapitalize="none"
 autoCorrect={false}
 clearButtonMode="while-editing"
 returnKeyType="search"
 />
 </View>

 {allRecords.length > 0 && (
 <Text style={styles.sectionTitle}>
 {filteredRecords.length === allRecords.length
 ? `${allRecords.length} Record${allRecords.length !== 1 ? "s" : ""}`
 : `${filteredRecords.length} of ${allRecords.length} Records`}
 </Text>
 )}
 </View>
 }
 ListEmptyComponent={
 <View style={styles.emptyState}>
 {searchQuery.trim().length > 0 ? (
 <>
 <Text style={styles.emptyEmoji}>🔍</Text>
 <Text style={styles.emptyTitle}>No Results</Text>
 <Text style={styles.emptySubtitle}>
 No records found for "{searchQuery}"
 </Text>
 </>
 ) : (
 <>
 <Text style={styles.emptyEmoji}>🐮</Text>
 <Text style={styles.emptyTitle}>No Records Yet</Text>
 <Text style={styles.emptySubtitle}>
 Tap "Log Calving" to record your first calving event.
 </Text>
 </>
 )}
 </View>
 }
 ListFooterComponent={<View style={{ height: 100 }} />}
 />

 {/* FAB */}
 <TouchableOpacity
 style={[styles.fab, { backgroundColor: list.color }]}
 onPress={handleLogCalving}
 activeOpacity={0.85}
 >
 <Plus size={24} color="#fff" />
 </TouchableOpacity>
 </View>
 </>
 );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(Colors: ThemeColors) {
 return StyleSheet.create({
 container: { flex: 1, backgroundColor: Colors.background },
 notFound: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const },
 notFoundText: { fontSize: 16, color: Colors.textSecondary },
 headerBtns: { flexDirection: "row" as const, gap: 16 },
 listContent: { paddingHorizontal: 16, paddingBottom: 40 },

 // Header
 header: { alignItems: "center" as const, paddingVertical: 20 },
 colorBar: { width: 48, height: 5, borderRadius: 3, marginBottom: 12 },
 listTitle: {
 fontSize: 24,
 fontWeight: "800" as const,
 color: Colors.text,
 letterSpacing: -0.3,
 marginBottom: 4,
 },
 recordCount: {
 fontSize: 14,
 color: Colors.textSecondary,
 fontWeight: "600" as const,
 },

 // Log button
 logBtn: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 gap: 10,
 borderRadius: 16,
 paddingVertical: 16,
 marginBottom: 12,
 },
 logBtnText: { fontSize: 17, fontWeight: "800" as const, color: "#fff" },

 // Search
 searchBar: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 backgroundColor: Colors.surface,
 borderRadius: 12,
 borderWidth: 1,
 borderColor: Colors.border,
 paddingHorizontal: 14,
 paddingVertical: 11,
 gap: 10,
 marginBottom: 4,
 },
 searchInput: {
 flex: 1,
 fontSize: 15,
 color: Colors.text,
 fontWeight: "500" as const,
 },

 sectionTitle: {
 fontSize: 13,
 fontWeight: "800" as const,
 color: Colors.textSecondary,
 textTransform: "uppercase" as const,
 letterSpacing: 1.1,
 marginTop: 16,
 marginBottom: 10,
 marginLeft: 2,
 },

 // Card
 card: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 backgroundColor: Colors.surface,
 borderRadius: 14,
 marginBottom: 10,
 borderWidth: 1,
 borderColor: Colors.borderLight,
 shadowColor: "#000",
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.05,
 shadowRadius: 4,
 elevation: 2,
 overflow: "hidden" as const,
 },

 // Date block on the left
 cardDateBlock: {
 width: 56,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 paddingVertical: 16,
 backgroundColor: Colors.backgroundDark,
 },
 cardDateMonth: {
 fontSize: 12,
 fontWeight: "700" as const,
 color: Colors.textSecondary,
 textTransform: "uppercase" as const,
 letterSpacing: 0.5,
 },
 cardDateDay: {
 fontSize: 22,
 fontWeight: "800" as const,
 color: Colors.text,
 lineHeight: 26,
 },

 cardDivider: {
 width: 1,
 alignSelf: "stretch" as const,
 backgroundColor: Colors.border,
 },

 // Tags
 cardTags: {
 flex: 1,
 paddingHorizontal: 14,
 paddingVertical: 12,
 gap: 6,
 },
 cardTagRow: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 gap: 8,
 },
 cardTagLabel: {
 fontSize: 10,
 fontWeight: "800" as const,
 color: Colors.textTertiary,
 letterSpacing: 0.8,
 width: 32,
 },
 cardTagValue: {
 fontSize: 17,
 fontWeight: "700" as const,
 color: Colors.text,
 flex: 1,
 },

 // Right side
 cardRight: {
 paddingRight: 12,
 paddingLeft: 4,
 alignItems: "center" as const,
 gap: 6,
 },
 assistedPill: {
 backgroundColor: "#C44D3D18",
 borderRadius: 6,
 paddingHorizontal: 7,
 paddingVertical: 3,
 },
 assistedPillText: {
 fontSize: 10,
 fontWeight: "700" as const,
 color: "#C44D3D",
 },
 photoIndicator: { fontSize: 14 },
 cardChevron: {
 fontSize: 22,
 color: Colors.textTertiary,
 fontWeight: "300" as const,
 },

 // Empty
 emptyState: {
 alignItems: "center" as const,
 paddingTop: 60,
 paddingHorizontal: 32,
 },
 emptyEmoji: { fontSize: 52, marginBottom: 14 },
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

 // FAB
 fab: {
 position: "absolute" as const,
 bottom: 24,
 right: 20,
 width: 58,
 height: 58,
 borderRadius: 29,
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
