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
 SectionList,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
 Plus,
 ChevronRight,
 UserMinus,
 Search,
 CheckCircle2,
 Circle,
 Loader,
} from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useProcessing } from "@/providers/ProcessingProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Animal, ProcessingEvent } from "@/types";

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

// ─── Animal row ───────────────────────────────────────────────────────────────

function AnimalRow({
 animal,
 onRemove,
 onPress,
}: {
 animal: Animal;
 onRemove: () => void;
 onPress: () => void;
}) {
 const Colors = useColors();
 const styles = useMemo(() => createStyles(Colors), [Colors]);

 return (
 <TouchableOpacity style={styles.animalRow} onPress={onPress} activeOpacity={0.75}>
 <View style={styles.animalIcon}>
 <Text style={styles.animalEmoji}>{animal.species === "horse" ? "🐎" : "🐄"}</Text>
 </View>
 <View style={styles.animalInfo}>
 <Text style={styles.animalTag}>{animal.tagId}</Text>
 {animal.name ? <Text style={styles.animalName}>{animal.name}</Text> : null}
 {animal.breed ? <Text style={styles.animalBreed}>{animal.breed}</Text> : null}
 </View>
 <TouchableOpacity
 onPress={onRemove}
 hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
 >
 <UserMinus size={17} color={Colors.error} />
 </TouchableOpacity>
 </TouchableOpacity>
 );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({
 event,
 progress,
 onPress,
}: {
 event: ProcessingEvent;
 progress: { total: number; done: number; pct: number };
 onPress: () => void;
}) {
 const Colors = useColors();
 const styles = useMemo(() => createStyles(Colors), [Colors]);
 const cfg = STATUS_CONFIG[event.status];
 const Icon = cfg.Icon;

 return (
 <TouchableOpacity style={styles.eventCard} onPress={onPress} activeOpacity={0.75}>
 <View style={styles.eventHeader}>
 <View style={styles.eventTitleRow}>
 <Icon size={16} color={cfg.color} />
 <Text style={styles.eventName}>{event.name}</Text>
 </View>
 <Text style={styles.eventDate}>
 {new Date(event.date).toLocaleDateString([], { month: "short", day: "numeric" })}
 </Text>
 </View>
 <View style={styles.eventMeta}>
 <View style={[styles.eventTypeBadge, { backgroundColor: cfg.color + "18" }]}>
 <Text style={[styles.eventTypeText, { color: cfg.color }]}>
 {EVENT_TYPE_LABELS[event.type] ?? event.customTypeName ?? "Custom"}
 </Text>
 </View>
 <Text style={styles.eventProgress}>{progress.done}/{progress.total}</Text>
 </View>
 {progress.total > 0 && (
 <View style={styles.progressBar}>
 <View
 style={[
 styles.progressFill,
 {
 width: `${progress.pct}%` as any,
 backgroundColor: cfg.color,
 },
 ]}
 />
 </View>
 )}
 <ChevronRight size={16} color={Colors.textTertiary} style={styles.eventChevron} />
 </TouchableOpacity>
 );
}

// ─── Add animals modal ────────────────────────────────────────────────────────

function AddAnimalsPanel({
 groupAnimalIds,
 onAdd,
 onClose,
}: {
 groupAnimalIds: string[];
 onAdd: (animalId: string) => void;
 onClose: () => void;
}) {
 const Colors = useColors();
 const { animals } = useRanch();
 const styles = useMemo(() => createStyles(Colors), [Colors]);
 const [search, setSearch] = useState("");

 const available = animals.filter(
 (a) =>
 a.status === "active" &&
 !groupAnimalIds.includes(a.id) &&
 (search === "" ||
 a.tagId.toLowerCase().includes(search.toLowerCase()) ||
 (a.name ?? "").toLowerCase().includes(search.toLowerCase())),
 );

 return (
 <View style={styles.addPanel}>
 <View style={styles.addPanelHeader}>
 <Text style={styles.addPanelTitle}>Add Animals</Text>
 <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
 <Text style={styles.addPanelClose}>Done</Text>
 </TouchableOpacity>
 </View>
 <View style={styles.searchBar}>
 <Search size={15} color={Colors.textTertiary} />
 <TextInput
 value={search}
 onChangeText={setSearch}
 placeholder="Search by tag or name..."
 placeholderTextColor={Colors.textTertiary}
 style={styles.searchInput}
 autoCapitalize="none"
 autoCorrect={false}
 />
 </View>
 <FlatList
 data={available}
 keyExtractor={(a) => a.id}
 renderItem={({ item }) => (
 <TouchableOpacity
 style={styles.addAnimalRow}
 onPress={() => {
 if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 onAdd(item.id);
 }}
 activeOpacity={0.75}
 >
 <Text style={styles.addAnimalEmoji}>{item.species === "horse" ? "🐎" : "🐄"}</Text>
 <View style={styles.addAnimalInfo}>
 <Text style={styles.addAnimalTag}>{item.tagId}</Text>
 {item.name ? <Text style={styles.addAnimalName}>{item.name}</Text> : null}
 </View>
 <Plus size={18} color={Colors.primary} />
 </TouchableOpacity>
 )}
 ListEmptyComponent={
 <Text style={styles.addEmpty}>
 {search ? `No animals match "${search}"` : "All active animals are already in this group"}
 </Text>
 }
 showsVerticalScrollIndicator={false}
 style={styles.addList}
 />
 </View>
 );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProcessingGroupDetailScreen() {
 const Colors = useColors();
 const { id } = useLocalSearchParams<{ id: string }>();
 const router = useRouter();
 const {
 getProcessingGroupById,
 processingGroups,
 getEventsForGroup,
 processingEvents,
 removeAnimalFromGroup,
 addAnimalToGroup,
 getEventProgress,
 processingRecords,
 deleteProcessingGroup,
 } = useProcessing();
 const { animals } = useRanch();
 const styles = useMemo(() => createStyles(Colors), [Colors]);

 const [showAddPanel, setShowAddPanel] = useState(false);

 const group = useMemo(
 () => getProcessingGroupById(id ?? ""),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [id, processingGroups],
 );

 const groupAnimals = useMemo(
 () => (group ? animals.filter((a) => group.animalIds.includes(a.id)) : []),
 [group, animals],
 );

 const events = useMemo(
 () => getEventsForGroup(id ?? "").sort(
 (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
 ),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [id, processingEvents, processingRecords],
 );

 const handleRemoveAnimal = useCallback((animal: Animal) => {
 Alert.alert(
 "Remove Animal",
 `Remove ${animal.tagId} from this group?`,
 [
 { text: "Cancel", style: "cancel" },
 {
 text: "Remove",
 style: "destructive",
 onPress: async () => {
 if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
 await removeAnimalFromGroup(id ?? "", animal.id);
 },
 },
 ],
 );
 }, [id, removeAnimalFromGroup]);

 const handleAddAnimal = useCallback(async (animalId: string) => {
 await addAnimalToGroup(id ?? "", animalId);
 }, [id, addAnimalToGroup]);

 const handleDeleteGroup = useCallback(() => {
 if (!group) return;
 Alert.alert(
 "Delete Group",
 `Delete "${group.name}"? All processing events for this group will also be removed.`,
 [
 { text: "Cancel", style: "cancel" },
 {
 text: "Delete",
 style: "destructive",
 onPress: async () => {
 if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
 await deleteProcessingGroup(group.id);
 router.back();
 },
 },
 ],
 );
 }, [group, deleteProcessingGroup, router]);

 if (!group) {
 return (
 <View style={styles.notFound}>
 <Text style={styles.notFoundText}>Group not found</Text>
 </View>
 );
 }

 return (
 <>
 <Stack.Screen
 options={{
 title: group.name,
 headerRight: () => (
 <TouchableOpacity
 onPress={handleDeleteGroup}
 hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
 >
 <Text style={[styles.deleteBtn, { color: Colors.error }]}>Delete</Text>
 </TouchableOpacity>
 ),
 }}
 />
 <View style={styles.container}>
 {showAddPanel ? (
 <AddAnimalsPanel
 groupAnimalIds={group.animalIds}
 onAdd={handleAddAnimal}
 onClose={() => setShowAddPanel(false)}
 />
 ) : (
 <SectionList
 sections={[
 { title: "Events", data: events as unknown[] },
 { title: "Animals", data: groupAnimals as unknown[] },
 ]}
 keyExtractor={(item) => (item as ProcessingEvent | Animal).id}
 contentContainerStyle={styles.listContent}
 showsVerticalScrollIndicator={false}
 stickySectionHeadersEnabled={false}
 ListHeaderComponent={
 <View style={styles.groupHeader}>
 <View style={[styles.colorBar, { backgroundColor: group.color }]} />
 <Text style={styles.groupTitle}>{group.name}</Text>
 <View style={styles.statsRow}>
 <View style={styles.statBox}>
 <Text style={styles.statNum}>{groupAnimals.length}</Text>
 <Text style={styles.statLabel}>Animals</Text>
 </View>
 <View style={styles.statDivider} />
 <View style={styles.statBox}>
 <Text style={styles.statNum}>{events.length}</Text>
 <Text style={styles.statLabel}>Events</Text>
 </View>
 <View style={styles.statDivider} />
 <View style={styles.statBox}>
 <Text style={[styles.statNum, { color: "#3D8B5E" }]}>
 {events.filter((e) => e.status === "completed").length}
 </Text>
 <Text style={styles.statLabel}>Completed</Text>
 </View>
 </View>
 <TouchableOpacity
 style={[styles.newEventBtn, { backgroundColor: group.color }]}
 onPress={() =>
 router.push({
 pathname: "/create-processing-event" as never,
 params: { groupId: group.id },
 })
 }
 activeOpacity={0.85}
 >
 <Plus size={18} color="#fff" />
 <Text style={styles.newEventBtnText}>New Processing Event</Text>
 </TouchableOpacity>
 </View>
 }
 renderSectionHeader={({ section }) => (
 <Text style={styles.sectionTitle}>{section.title}</Text>
 )}
 renderItem={({ item, section }) => {
 if (section.title === "Events") {
 const event = item as unknown as ProcessingEvent;
 return (
 <EventCard
 event={event}
 progress={getEventProgress(event.id, group.id)}
 onPress={() =>
 router.push({
 pathname: "/processing-event/[id]" as never,
 params: { id: event.id },
 })
 }
 />
 );
 }
 const animal = item as unknown as Animal;
 return (
 <AnimalRow
 animal={animal}
 onRemove={() => handleRemoveAnimal(animal)}
 onPress={() => router.push(`/animal/${animal.id}`)}
 />
 );
 }}
 ListEmptyComponent={null}
 renderSectionFooter={({ section }) => {
 if (section.title === "Events" && events.length === 0) {
 return (
 <Text style={styles.emptyText}>
 No events yet — tap "New Processing Event" to get started.
 </Text>
 );
 }
 if (section.title === "Animals" && groupAnimals.length === 0) {
 return (
 <Text style={styles.emptyText}>
 No animals in this group yet. Tap + Add Animals to get started.
 </Text>
 );
 }
 return null;
 }}
 ListFooterComponent={<View style={{ height: 100 }} />}
 />
 )}

 {!showAddPanel && (
 <TouchableOpacity
 style={[styles.fab, { backgroundColor: group.color }]}
 onPress={() => {
 if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
 setShowAddPanel(true);
 }}
 activeOpacity={0.85}
 >
 <Plus size={22} color="#fff" />
 </TouchableOpacity>
 )}
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
 listContent: { padding: 16 },
 deleteBtn: { fontSize: 15, fontWeight: "600" as const },

 // Header
 groupHeader: { alignItems: "center" as const, paddingBottom: 8 },
 colorBar: { width: 48, height: 5, borderRadius: 3, marginBottom: 12 },
 groupTitle: { fontSize: 24, fontWeight: "800" as const, color: Colors.text, letterSpacing: -0.3, marginBottom: 16 },
 statsRow: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: Colors.surface, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14, borderWidth: 1, borderColor: Colors.borderLight, gap: 20, marginBottom: 16 },
 statBox: { alignItems: "center" as const },
 statNum: { fontSize: 24, fontWeight: "800" as const, color: Colors.text },
 statLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: "600" as const, marginTop: 2, textTransform: "uppercase" as const, letterSpacing: 0.5 },
 statDivider: { width: 1, height: 32, backgroundColor: Colors.border },
 newEventBtn: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, borderRadius: 14, paddingVertical: 14, width: "100%", marginBottom: 8 },
 newEventBtnText: { fontSize: 15, fontWeight: "700" as const, color: "#fff" },

 sectionTitle: { fontSize: 13, fontWeight: "800" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 1.1, marginTop: 20, marginBottom: 10, marginLeft: 2 },

 // Event card
 eventCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
 eventHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginBottom: 8 },
 eventTitleRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, flex: 1 },
 eventName: { fontSize: 15, fontWeight: "700" as const, color: Colors.text, flex: 1 },
 eventDate: { fontSize: 12, color: Colors.textTertiary, fontWeight: "500" as const },
 eventMeta: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginBottom: 8 },
 eventTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
 eventTypeText: { fontSize: 11, fontWeight: "700" as const },
 eventProgress: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" as const },
 progressBar: { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: "hidden" as const },
 progressFill: { height: "100%", borderRadius: 2 },
 eventChevron: { position: "absolute" as const, right: 14, top: 14 },

 // Animal row
 animalRow: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight, gap: 12 },
 animalIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.backgroundDark, alignItems: "center" as const, justifyContent: "center" as const },
 animalEmoji: { fontSize: 20 },
 animalInfo: { flex: 1 },
 animalTag: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
 animalName: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
 animalBreed: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },

 // Add animals panel
 addPanel: { flex: 1, backgroundColor: Colors.background },
 addPanelHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
 addPanelTitle: { fontSize: 17, fontWeight: "700" as const, color: Colors.text },
 addPanelClose: { fontSize: 15, fontWeight: "600" as const, color: Colors.primary },
 searchBar: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, gap: 8, margin: 16, marginTop: 12 },
 searchInput: { flex: 1, fontSize: 15, color: Colors.text },
 addList: { flex: 1, paddingHorizontal: 16 },
 addAnimalRow: { flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 12 },
 addAnimalEmoji: { fontSize: 22 },
 addAnimalInfo: { flex: 1 },
 addAnimalTag: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
 addAnimalName: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
 addEmpty: { fontSize: 14, color: Colors.textTertiary, textAlign: "center" as const, paddingTop: 40, fontStyle: "italic" as const },

 emptyText: { fontSize: 14, color: Colors.textTertiary, textAlign: "center" as const, paddingVertical: 16, fontStyle: "italic" as const },

 // FAB
 fab: { position: "absolute" as const, bottom: 24, right: 20, width: 58, height: 58, borderRadius: 29, alignItems: "center" as const, justifyContent: "center" as const, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
 });
}
