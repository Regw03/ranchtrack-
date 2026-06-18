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
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Plus, ChevronRight, Trash2, Users } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useProcessing } from "@/providers/ProcessingProvider";
import { useRanch } from "@/providers/RanchProvider";
import { ProcessingGroup } from "@/types";

const GROUP_COLORS = [
 "#3D8B5E", "#2D7A9C", "#C4622D", "#7B5EA7",
 "#D4943A", "#C44D3D", "#4A8B7A", "#8B6914",
];

// ─── Create group inline card ──────────────────────────────────────────────────

function CreateGroupCard({
 onSave,
 onCancel,
}: {
 onSave: (name: string, color: string) => void;
 onCancel: () => void;
}) {
 const Colors = useColors();
 const styles = useMemo(() => createStyles(Colors), [Colors]);
 const [name, setName] = useState("");
 const [color, setColor] = useState(GROUP_COLORS[0]);

 const canSave = name.trim().length > 0;

 return (
 <View style={styles.createCard}>
 <TextInput
 value={name}
 onChangeText={setName}
 placeholder="Group name (e.g. Yearling Heifers)"
 placeholderTextColor={Colors.textTertiary}
 style={styles.createInput}
 autoFocus
 autoCapitalize="words"
 maxLength={40}
 returnKeyType="done"
 onSubmitEditing={() => canSave && onSave(name.trim(), color)}
 />
 <View style={styles.colorRow}>
 {GROUP_COLORS.map((c) => (
 <TouchableOpacity
 key={c}
 style={[
 styles.colorDot,
 { backgroundColor: c },
 color === c && styles.colorDotSelected,
 ]}
 onPress={() => setColor(c)}
 activeOpacity={0.8}
 />
 ))}
 </View>
 <View style={styles.createActions}>
 <TouchableOpacity
 style={[styles.createSaveBtn, { backgroundColor: canSave ? color : Colors.border }]}
 onPress={() => canSave && onSave(name.trim(), color)}
 disabled={!canSave}
 activeOpacity={0.85}
 >
 <Text style={styles.createSaveBtnText}>Create Group</Text>
 </TouchableOpacity>
 <TouchableOpacity style={styles.createCancelBtn} onPress={onCancel} activeOpacity={0.7}>
 <Text style={styles.createCancelBtnText}>Cancel</Text>
 </TouchableOpacity>
 </View>
 </View>
 );
}

// ─── Group card ───────────────────────────────────────────────────────────────

function GroupCard({
 group,
 onPress,
 onDelete,
}: {
 group: ProcessingGroup;
 onPress: () => void;
 onDelete: () => void;
}) {
 const Colors = useColors();
 const { animals } = useRanch();
 const styles = useMemo(() => createStyles(Colors), [Colors]);

 const groupAnimals = animals.filter((a) => group.animalIds.includes(a.id));

 return (
 <TouchableOpacity style={styles.groupCard} onPress={onPress} activeOpacity={0.75}>
 <View style={[styles.groupColorBar, { backgroundColor: group.color }]} />
 <View style={styles.groupInfo}>
 <Text style={styles.groupName}>{group.name}</Text>
 <View style={styles.groupMeta}>
 <Users size={13} color={Colors.textTertiary} />
 <Text style={styles.groupCount}>
 {groupAnimals.length} animal{groupAnimals.length !== 1 ? "s" : ""}
 </Text>
 </View>
 </View>
 <View style={styles.groupActions}>
 <TouchableOpacity
 onPress={onDelete}
 hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
 >
 <Trash2 size={17} color={Colors.error} />
 </TouchableOpacity>
 <ChevronRight size={18} color={Colors.textTertiary} />
 </View>
 </TouchableOpacity>
 );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProcessingGroupsScreen() {
 const Colors = useColors();
 const router = useRouter();
 const { processingGroups, createProcessingGroup, deleteProcessingGroup } = useProcessing();
 const styles = useMemo(() => createStyles(Colors), [Colors]);

 const [isCreating, setIsCreating] = useState(false);

 const handleCreate = useCallback(async (name: string, color: string) => {
 if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
 await createProcessingGroup({ name, color });
 setIsCreating(false);
 }, [createProcessingGroup]);

 const handleDelete = useCallback((group: ProcessingGroup) => {
 Alert.alert(
 "Delete Group",
 `Delete "${group.name}"? All events linked to this group will also be removed.`,
 [
 { text: "Cancel", style: "cancel" },
 {
 text: "Delete",
 style: "destructive",
 onPress: async () => {
 if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
 await deleteProcessingGroup(group.id);
 },
 },
 ],
 );
 }, [deleteProcessingGroup]);

 return (
 <>
 <Stack.Screen options={{ title: "Processing Groups" }} />
 <View style={styles.container}>
 <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
 <FlatList
 data={processingGroups}
 keyExtractor={(item) => item.id}
 renderItem={({ item }) => (
 <GroupCard
 group={item}
 onPress={() => router.push({ pathname: "/processing-group/[id]" as never, params: { id: item.id } })}
 onDelete={() => handleDelete(item)}
 />
 )}
 contentContainerStyle={styles.listContent}
 showsVerticalScrollIndicator={false}
 keyboardShouldPersistTaps="handled"
 ListHeaderComponent={
 isCreating ? (
 <CreateGroupCard
 onSave={handleCreate}
 onCancel={() => setIsCreating(false)}
 />
 ) : null
 }
 ListEmptyComponent={
 !isCreating ? (
 <View style={styles.emptyState}>
 <Text style={styles.emptyEmoji}>🐄</Text>
 <Text style={styles.emptyTitle}>No Groups Yet</Text>
 <Text style={styles.emptySubtitle}>
 Create groups to organize your cattle for processing — Yearling Heifers, 1st Calf Cows, Mature Cows, Bulls, etc.
 </Text>
 <TouchableOpacity
 style={[styles.emptyBtn, { backgroundColor: Colors.primary }]}
 onPress={() => setIsCreating(true)}
 activeOpacity={0.85}
 >
 <Plus size={18} color="#fff" />
 <Text style={styles.emptyBtnText}>Create First Group</Text>
 </TouchableOpacity>
 </View>
 ) : null
 }
 ListFooterComponent={<View style={{ height: 100 }} />}
 />

 {!isCreating && processingGroups.length > 0 && (
 <TouchableOpacity
 style={[styles.fab, { backgroundColor: Colors.primary }]}
 onPress={() => {
 if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
 setIsCreating(true);
 }}
 activeOpacity={0.85}
 >
 <Plus size={24} color="#fff" />
 </TouchableOpacity>
 )}
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
 listContent: { padding: 16 },

 // Create card
 createCard: {
 backgroundColor: Colors.surface,
 borderRadius: 16,
 padding: 16,
 marginBottom: 12,
 borderWidth: 1.5,
 borderColor: Colors.primary,
 },
 createInput: {
 fontSize: 16,
 fontWeight: "600" as const,
 color: Colors.text,
 paddingVertical: 8,
 marginBottom: 14,
 borderBottomWidth: 1,
 borderBottomColor: Colors.border,
 },
 colorRow: {
 flexDirection: "row" as const,
 gap: 10,
 marginBottom: 16,
 },
 colorDot: {
 width: 32,
 height: 32,
 borderRadius: 16,
 },
 colorDotSelected: {
 borderWidth: 3,
 borderColor: "#fff",
 shadowColor: "#000",
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.3,
 shadowRadius: 3,
 elevation: 3,
 },
 createActions: {
 flexDirection: "row" as const,
 gap: 10,
 },
 createSaveBtn: {
 flex: 1,
 paddingVertical: 12,
 borderRadius: 12,
 alignItems: "center" as const,
 },
 createSaveBtnText: {
 fontSize: 15,
 fontWeight: "700" as const,
 color: "#fff",
 },
 createCancelBtn: {
 paddingVertical: 12,
 paddingHorizontal: 16,
 borderRadius: 12,
 backgroundColor: Colors.backgroundDark,
 alignItems: "center" as const,
 },
 createCancelBtnText: {
 fontSize: 15,
 fontWeight: "600" as const,
 color: Colors.textSecondary,
 },

 // Group card
 groupCard: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 backgroundColor: Colors.surface,
 borderRadius: 14,
 marginBottom: 10,
 borderWidth: 1,
 borderColor: Colors.borderLight,
 overflow: "hidden" as const,
 shadowColor: "#000",
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.04,
 shadowRadius: 4,
 elevation: 2,
 },
 groupColorBar: {
 width: 5,
 alignSelf: "stretch" as const,
 },
 groupInfo: {
 flex: 1,
 paddingHorizontal: 14,
 paddingVertical: 14,
 },
 groupName: {
 fontSize: 16,
 fontWeight: "700" as const,
 color: Colors.text,
 marginBottom: 4,
 },
 groupMeta: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 gap: 5,
 },
 groupCount: {
 fontSize: 13,
 color: Colors.textTertiary,
 fontWeight: "500" as const,
 },
 groupActions: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 gap: 12,
 paddingRight: 14,
 },

 // Empty
 emptyState: {
 alignItems: "center" as const,
 paddingTop: 60,
 paddingHorizontal: 32,
 gap: 12,
 },
 emptyEmoji: { fontSize: 52, marginBottom: 4 },
 emptyTitle: { fontSize: 20, fontWeight: "800" as const, color: Colors.text, textAlign: "center" as const },
 emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" as const, lineHeight: 22 },
 emptyBtn: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 gap: 8,
 marginTop: 8,
 paddingHorizontal: 24,
 paddingVertical: 14,
 borderRadius: 14,
 },
 emptyBtnText: { fontSize: 16, fontWeight: "700" as const, color: "#fff" },

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
