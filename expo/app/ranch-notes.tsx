import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Plus, Trash2, Edit3, Check, X, FileText } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { RanchNote } from "@/types";

// ─── Single note card ─────────────────────────────────────────────────────────

function NoteCard({
  note,
  onDelete,
  onEdit,
}: {
  note: RanchNote;
  onDelete: () => void;
  onEdit: (text: string) => void;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);

  const handleSave = useCallback(() => {
    if (draft.trim().length === 0) return;
    onEdit(draft.trim());
    setEditing(false);
    if (Platform.OS !== "web")
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [draft, onEdit]);

  const handleCancel = useCallback(() => {
    setDraft(note.text);
    setEditing(false);
  }, [note.text]);

  const timeAgo = useMemo(() => {
    const now = new Date();
    const created = new Date(note.updatedAt || note.createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return created.toLocaleDateString([], { month: "short", day: "numeric" });
  }, [note.updatedAt, note.createdAt]);

  if (editing) {
    return (
      <View style={styles.cardEditing}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          style={styles.editInput}
          multiline
          autoFocus
          placeholder="Write a note..."
          placeholderTextColor={Colors.textTertiary}
          maxLength={500}
        />
        <View style={styles.editActions}>
          <TouchableOpacity
            style={styles.editSaveBtn}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Check size={16} color="#fff" />
            <Text style={styles.editSaveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editCancelBtn}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <X size={16} color={Colors.textSecondary} />
            <Text style={styles.editCancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardText}>{note.text}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>{timeAgo}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => { setDraft(note.text); setEditing(true); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Edit3 size={15} color={Colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={15} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RanchNotesScreen() {
  const Colors = useColors();
  const { ranchNotes, addRanchNote, updateRanchNote, deleteRanchNote } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [newText, setNewText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const trimmed = newText.trim();
  const canAdd = trimmed.length > 0;

  const handleAdd = useCallback(async () => {
    if (!canAdd) return;
    if (Platform.OS !== "web")
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await addRanchNote(trimmed);
      setNewText("");
      setIsAdding(false);
    } catch (e) {
      Alert.alert("Error", "Could not save note. Please try again.");
    }
  }, [canAdd, trimmed, addRanchNote]);

  const handleDelete = useCallback((note: RanchNote) => {
    Alert.alert(
      "Delete Note",
      "Delete this note? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web")
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteRanchNote(note.id);
          },
        },
      ],
    );
  }, [deleteRanchNote]);

  const handleEdit = useCallback(async (id: string, text: string) => {
    await updateRanchNote({ id, text });
  }, [updateRanchNote]);

  const handleStartAdding = useCallback(() => {
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: "Ranch Notes" }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <FlatList
              data={ranchNotes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <NoteCard
                  note={item}
                  onDelete={() => handleDelete(item)}
                  onEdit={(text) => handleEdit(item.id, text)}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                isAdding ? (
                  <View style={styles.addCard}>
                    <TextInput
                      ref={inputRef}
                      value={newText}
                      onChangeText={setNewText}
                      placeholder="Write a note for the team..."
                      placeholderTextColor={Colors.textTertiary}
                      style={styles.addInput}
                      multiline
                      maxLength={500}
                    />
                    <View style={styles.addActions}>
                      <TouchableOpacity
                        style={[
                          styles.addSaveBtn,
                          { backgroundColor: canAdd ? Colors.primary : Colors.border },
                        ]}
                        onPress={handleAdd}
                        disabled={!canAdd}
                        activeOpacity={0.85}
                      >
                        <Check size={16} color="#fff" />
                        <Text style={styles.addSaveBtnText}>Post Note</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.addCancelBtn}
                        onPress={() => { setIsAdding(false); setNewText(""); }}
                        activeOpacity={0.8}
                      >
                        <X size={16} color={Colors.textSecondary} />
                        <Text style={styles.addCancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                !isAdding ? (
                  <View style={styles.emptyState}>
                    <View style={[styles.emptyIcon, { backgroundColor: Colors.primary + "18" }]}>
                      <FileText size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>No Notes Yet</Text>
                    <Text style={styles.emptySubtitle}>
                      Use ranch notes to share quick updates with your team — pasture conditions, vet appointments, anything worth remembering.
                    </Text>
                    <TouchableOpacity
                      style={[styles.emptyBtn, { backgroundColor: Colors.primary }]}
                      onPress={handleStartAdding}
                      activeOpacity={0.85}
                    >
                      <Plus size={18} color="#fff" />
                      <Text style={styles.emptyBtnText}>Add First Note</Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              }
              ListFooterComponent={<View style={{ height: 100 }} />}
            />

            {/* FAB */}
            {!isAdding && ranchNotes.length > 0 && (
              <TouchableOpacity
                style={[styles.fab, { backgroundColor: Colors.primary }]}
                onPress={handleStartAdding}
                activeOpacity={0.85}
              >
                <Plus size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </KeyboardAvoidingView>
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
    flex: { flex: 1 },
    listContent: { padding: 16 },

    // Add note
    addCard: {
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    addInput: {
      fontSize: 16,
      color: Colors.text,
      minHeight: 80,
      textAlignVertical: "top" as const,
      marginBottom: 12,
      lineHeight: 22,
    },
    addActions: { flexDirection: "row" as const, gap: 10 },
    addSaveBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    addSaveBtnText: { fontSize: 14, fontWeight: "700" as const, color: "#fff" },
    addCancelBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: Colors.backgroundDark,
    },
    addCancelBtnText: { fontSize: 14, fontWeight: "600" as const, color: Colors.textSecondary },

    // Note card
    card: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    cardText: { fontSize: 15, color: Colors.text, lineHeight: 22, marginBottom: 10 },
    cardFooter: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    },
    cardMeta: { fontSize: 12, color: Colors.textTertiary, fontWeight: "500" as const },
    cardActions: { flexDirection: "row" as const, gap: 14 },

    // Editing
    cardEditing: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    editInput: {
      fontSize: 15,
      color: Colors.text,
      minHeight: 80,
      textAlignVertical: "top" as const,
      marginBottom: 12,
      lineHeight: 22,
    },
    editActions: { flexDirection: "row" as const, gap: 10 },
    editSaveBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: Colors.primary,
    },
    editSaveBtnText: { fontSize: 14, fontWeight: "700" as const, color: "#fff" },
    editCancelBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: Colors.backgroundDark,
    },
    editCancelBtnText: { fontSize: 14, fontWeight: "600" as const, color: Colors.textSecondary },

    // Empty
    emptyState: {
      alignItems: "center" as const,
      paddingTop: 60,
      paddingHorizontal: 32,
      gap: 12,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 24,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "800" as const,
      color: Colors.text,
      textAlign: "center" as const,
    },
    emptySubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center" as const,
      lineHeight: 22,
    },
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
