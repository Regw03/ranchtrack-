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
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
 CheckCircle2,
 Circle,
 Loader,
 Trash2,
 ChevronDown,
 ChevronUp,
} from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useProcessing } from "@/providers/ProcessingProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Animal, ProcessingResult } from "@/types";

// ─── Result config ────────────────────────────────────────────────────────────

const RESULT_CONFIG: Record<
 ProcessingResult,
 { label: string; color: string; bg: string }
> = {
 done: { label: "Done", color: "#3D8B5E", bg: "#3D8B5E18" },
 not_done: { label: "Not Done", color: "#C44D3D", bg: "#C44D3D18" },
 bred: { label: "Bred", color: "#3D8B5E", bg: "#3D8B5E18" },
 open: { label: "Open", color: "#C44D3D", bg: "#C44D3D18" },
};

const STATUS_CONFIG = {
 not_started: { label: "Not Started", color: "#9B9B9B", Icon: Circle },
 in_progress: { label: "In Progress", color: "#D4943A", Icon: Loader },
 completed: { label: "Completed", color: "#3D8B5E", Icon: CheckCircle2 },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
 vaccination: "Vaccination",
 preg_check: "Preg Check",
 blood_test: "Blood Test",
 custom: "Custom",
};

// ─── Animal result row ────────────────────────────────────────────────────────

function AnimalResultRow({
 animal,
 eventType,
 currentResult,
 notes,
 onSetResult,
 onPress,
}: {
 animal: Animal;
 eventType: string;
 currentResult: ProcessingResult | undefined;
 notes: string | undefined;
 onSetResult: (result: ProcessingResult, notes?: string) => void;
 onPress: () => void;
}) {
 const Colors = useColors();
 const styles = useMemo(() => createStyles(Colors), [Colors]);
 const [expanded, setExpanded] = useState(false);
 const [noteDraft, setNoteDraft] = useState(notes ?? "");

 const isPregCheck = eventType === "preg_check";
 const positiveResult: ProcessingResult = isPregCheck ? "bred" : "done";
 const negativeResult: ProcessingResult = isPregCheck ? "open" : "not_done";

 const handleToggle = useCallback((result: ProcessingResult) => {
 if (Platform.OS !== "web")
 void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
 onSetResult(result, noteDraft.trim() || undefined);
 }, [onSetResult, noteDraft]);

 const handleNoteSave = useCallback(() => {
 if (currentResult) {
 onSetResult(currentResult, noteDraft.trim() || undefined);
 }
 }, [currentResult, noteDraft, onSetResult]);

 const resultCfg = currentResult ? RESULT_CONFIG[currentResult] : null;

 return (
 <View style={[styles.animalCard, currentResult && { borderLeftWidth: 3, borderLeftColor: resultCfg?.color }]}>
 <View style={styles.animalCardMain}>
 {/* Animal info */}
 <TouchableOpacity style={styles.animalInfo} onPress={onPress} activeOpacity={0.7}>
 <Text style={styles.animalTag}>{animal.tagId}</Text>
 {animal.name ? <Text style={styles.animalName}>{animal.name}</Text> : null}
 {notes ? <Text style={styles.animalNote} numberOfLines={1}>{notes}</Text> : null}
 </TouchableOpacity>

 {/* Result buttons */}
 <View style={styles.resultBtns}>
 <TouchableOpacity
 style={[
 styles.resultBtn,
 { borderColor: RESULT_CONFIG[positiveResult].color },
 currentResult === positiveResult && {
 backgroundColor: RESULT_CONFIG[positiveResult].color,
 },
 ]}
 onPress={() => handleToggle(positiveResult)}
 activeOpacity={0.8}
 >
 <Text
 style={[
 styles.resultBtnText,
 { color: RESULT_CONFIG[positiveResult].color },
 currentResult === positiveResult && { color: "#fff" },
 ]}
 >
 {RESULT_CONFIG[positiveResult].label}
 </Text>
 </TouchableOpacity>

 <TouchableOpacity
 style={[
 styles.resultBtn,
 { borderColor: RESULT_CONFIG[negativeResult].color },
 currentResult === negativeResult && {
 backgroundColor: RESULT_CONFIG[negativeResult].color,
 },
 ]}
 onPress={() => handleToggle(negativeResult)}
 activeOpacity={0.8}
 >
 <Text
 style={[
 styles.resultBtnText,
 { color: RESULT_CONFIG[negativeResult].color },
 currentResult === negativeResult && { color: "#fff" },
 ]}
 >
 {RESULT_CONFIG[negativeResult].label}
 </Text>
 </TouchableOpacity>

 {/* Note toggle */}
 <TouchableOpacity
 style={styles.noteToggle}
 onPress={() => setExpanded((v) => !v)}
 hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
 >
 {expanded
 ? <ChevronUp size={16} color={Colors.textTertiary} />
 : <ChevronDown size={16} color={Colors.textTertiary} />
 }
 </TouchableOpacity>
 </View>
 </View>

 {/* Inline note field */}
 {expanded && (
 <View style={styles.noteField}>
 <TextInput
 value={noteDraft}
 onChangeText={setNoteDraft}
 placeholder="Note for this animal (optional)..."
 placeholderTextColor={Colors.textTertiary}
 style={styles.noteInput}
 multiline
 numberOfLines={2}
 textAlignVertical="top"
 maxLength={200}
 onBlur={handleNoteSave}
 />
 </View>
 )}
 </View>
 );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProcessingEventDetailScreen() {
 const Colors = useColors();
 const { id } = useLocalSearchParams<{ id: string }>();
 const router = useRouter();
 const {
 getProcessingEventById,
 processingEvents,
 getProcessingGroupById,
 processingGroups,
 getRecordsForEvent,
 getRecordForAnimal,
 setProcessingRecord,
 getEventProgress,
 deleteProcessingEvent,
 processingRecords,
 } = useProcessing();
 const { animals } = useRanch();
 const styles = useMemo(() => createStyles(Colors), [Colors]);

 const event = useMemo(
 () => getProcessingEventById(id ?? ""),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [id, processingEvents],
 );

 const group = useMemo(
 () => event ? getProcessingGroupById(event.groupId) : undefined,
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [event, processingGroups],
 );

 const groupAnimals = useMemo(
 () => group ? animals.filter((a) => group.animalIds.includes(a.id)) : [],
 [group, animals],
 );

 const records = useMemo(
 () => getRecordsForEvent(id ?? ""),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [id, processingRecords],
 );

 const progress = useMemo(
 () => event && group ? getEventProgress(event.id, group.id) : { total: 0, done: 0, pct: 0 },
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [event, group, processingRecords],
 );

 const handleSetResult = useCallback(async (
 animalId: string,
 result: ProcessingResult,
 notes?: string,
 ) => {
 if (!event) return;
 await setProcessingRecord({ eventId: event.id, animalId, result, notes });
 }, [event, setProcessingRecord]);

 const handleDelete = useCallback(() => {
 if (!event) return;
 Alert.alert(
 "Delete Event",
 `Delete "${event.name}"? All animal records for this event will also be removed.`,
 [
 { text: "Cancel", style: "cancel" },
 {
 text: "Delete",
 style: "destructive",
 onPress: async () => {
 if (Platform.OS !== "web")
 void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
 await deleteProcessingEvent(event.id);
 router.back();
 },
 },
 ],
 );
 }, [event, deleteProcessingEvent, router]);

 if (!event || !group) {
 return (
 <View style={styles.notFound}>
 <Text style={styles.notFoundText}>Event not found</Text>
 </View>
 );
 }

 const statusCfg = STATUS_CONFIG[event.status];
 const StatusIcon = statusCfg.Icon;

 // Sort: unrecorded animals first, then recorded
 const sortedAnimals = [...groupAnimals].sort((a, b) => {
 const aHasRecord = records.some((r) => r.animalId === a.id);
 const bHasRecord = records.some((r) => r.animalId === b.id);
 if (aHasRecord && !bHasRecord) return 1;
 if (!aHasRecord && bHasRecord) return -1;
 return 0;
 });

 return (
 <>
 <Stack.Screen
 options={{
 title: event.name,
 headerRight: () => (
 <TouchableOpacity
 onPress={handleDelete}
 hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
 >
 <Trash2 size={20} color={Colors.error} />
 </TouchableOpacity>
 ),
 }}
 />
 <View style={styles.container}>
 <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
 <FlatList
 data={sortedAnimals}
 keyExtractor={(a) => a.id}
 contentContainerStyle={styles.listContent}
 showsVerticalScrollIndicator={false}
 keyboardShouldPersistTaps="handled"
 ListHeaderComponent={
 <View style={styles.header}>
 {/* Group badge */}
 <TouchableOpacity
 style={[styles.groupBadge, { backgroundColor: group.color + "18", borderColor: group.color + "40" }]}
 onPress={() => router.push({ pathname: "/processing-group/[id]" as never, params: { id: group.id } })}
 activeOpacity={0.8}
 >
 <View style={[styles.groupDot, { backgroundColor: group.color }]} />
 <Text style={[styles.groupBadgeText, { color: group.color }]}>{group.name}</Text>
 </TouchableOpacity>

 {/* Event details */}
 <View style={styles.eventMeta}>
 <View style={[styles.typeBadge, { backgroundColor: statusCfg.color + "18" }]}>
 <Text style={[styles.typeText, { color: statusCfg.color }]}>
 {EVENT_TYPE_LABELS[event.type] ?? event.customTypeName}
 </Text>
 </View>
 <Text style={styles.eventDate}>
 {new Date(event.date).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
 </Text>
 </View>

 {/* Status + progress */}
 <View style={styles.statusRow}>
 <View style={styles.statusLeft}>
 <StatusIcon size={18} color={statusCfg.color} />
 <Text style={[styles.statusLabel, { color: statusCfg.color }]}>
 {statusCfg.label}
 </Text>
 </View>
 <Text style={styles.progressText}>
 {progress.done} of {progress.total} done
 </Text>
 </View>

 {/* Progress bar */}
 <View style={styles.progressBar}>
 <View
 style={[
 styles.progressFill,
 {
 width: `${progress.pct}%` as any,
 backgroundColor: statusCfg.color,
 },
 ]}
 />
 </View>

 {event.notes ? (
 <Text style={styles.eventNotes}>{event.notes}</Text>
 ) : null}

 <Text style={styles.listHeader}>Animals</Text>
 </View>
 }
 renderItem={({ item }) => {
 const record = getRecordForAnimal(event.id, item.id);
 return (
 <AnimalResultRow
 animal={item}
 eventType={event.type}
 currentResult={record?.result}
 notes={record?.notes}
 onSetResult={(result, notes) => handleSetResult(item.id, result, notes)}
 onPress={() => router.push(`/animal/${item.id}`)}
 />
 );
 }}
 ListEmptyComponent={
 <View style={styles.emptyState}>
 <Text style={styles.emptyText}>
 This group has no animals. Go to the group and add animals first.
 </Text>
 <TouchableOpacity
 style={[styles.emptyBtn, { backgroundColor: group.color }]}
 onPress={() => router.push({ pathname: "/processing-group/[id]" as never, params: { id: group.id } })}
 activeOpacity={0.85}
 >
 <Text style={styles.emptyBtnText}>Go to Group</Text>
 </TouchableOpacity>
 </View>
 }
 ListFooterComponent={<View style={{ height: 40 }} />}
 />
 </SafeAreaView>
 </View>
 </>
 );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(Colors: ThemeColors) {
 return StyleSheet.create({
 container: { flex: 1, backgroundColor: Colors.background },
 safeArea: { flex: 1 },
 notFound: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const },
 notFoundText: { fontSize: 16, color: Colors.textSecondary },
 listContent: { padding: 16 },

 // Header
 header: { marginBottom: 16 },
 groupBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7, alignSelf: "flex-start" as const, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 14 },
 groupDot: { width: 8, height: 8, borderRadius: 4 },
 groupBadgeText: { fontSize: 13, fontWeight: "700" as const },
 eventMeta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 14 },
 typeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
 typeText: { fontSize: 12, fontWeight: "700" as const },
 eventDate: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" as const },
 statusRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginBottom: 8 },
 statusLeft: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
 statusLabel: { fontSize: 14, fontWeight: "700" as const },
 progressText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "600" as const },
 progressBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden" as const, marginBottom: 12 },
 progressFill: { height: "100%", borderRadius: 3 },
 eventNotes: { fontSize: 13, color: Colors.textSecondary, fontStyle: "italic" as const, marginBottom: 12, lineHeight: 18 },
 listHeader: { fontSize: 13, fontWeight: "800" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 1.1, marginTop: 8, marginBottom: 4 },

 // Animal result card
 animalCard: { backgroundColor: Colors.surface, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight, overflow: "hidden" as const },
 animalCardMain: { flexDirection: "row" as const, alignItems: "center" as const, padding: 12, gap: 10 },
 animalInfo: { flex: 1 },
 animalTag: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
 animalName: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
 animalNote: { fontSize: 11, color: Colors.textTertiary, marginTop: 2, fontStyle: "italic" as const },
 resultBtns: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
 resultBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, minWidth: 56, alignItems: "center" as const },
 resultBtnText: { fontSize: 11, fontWeight: "800" as const, letterSpacing: 0.3 },
 noteToggle: { padding: 4 },

 // Note field
 noteField: { paddingHorizontal: 12, paddingBottom: 12 },
 noteInput: { backgroundColor: Colors.backgroundDark, borderRadius: 10, padding: 10, fontSize: 13, color: Colors.text, minHeight: 60, borderWidth: 1, borderColor: Colors.border },

 // Empty
 emptyState: { alignItems: "center" as const, paddingTop: 40, paddingHorizontal: 32, gap: 12 },
 emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" as const, lineHeight: 22 },
 emptyBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
 emptyBtnText: { fontSize: 15, fontWeight: "700" as const, color: "#fff" },
 });
}
