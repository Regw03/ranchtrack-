import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Alert, KeyboardAvoidingView } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";

const LIST_COLORS = ["#C4622D", "#1F3D2B", "#3D8B5E", "#D4943A", "#7B5EA7", "#C44D3D", "#2D7A9C", "#8B6E4E", "#5C7A3D", "#D47B8B"];
const LIST_ICONS = ["📋", "🏷️", "🐄", "🐴", "🐑", "🐐", "🐷", "💉", "⚖️", "🤰", "💰", "🏥", "🌾", "🔔", "⭐", "🎯", "📊", "🗂️", "🏠", "🚜"];

export default function EditListScreen() {
  const Colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getListById, updateList } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const list = useMemo(() => getListById(id ?? ""), [getListById, id]);
  const [name, setName] = useState(list?.name ?? "");
  const [selectedColor, setSelectedColor] = useState(list?.color ?? LIST_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(list?.icon ?? LIST_ICONS[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!list) return;
    if (!name.trim()) { Alert.alert("Name Required", "Please enter a name for your list."); return; }
    if (saving) return;
    setSaving(true);
    try {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updateList({ ...list, name: name.trim(), color: selectedColor, icon: selectedIcon });
      router.back();
    } catch (e) { console.log("Error updating list:", e); Alert.alert("Error", "Failed to update list. Please try again."); } finally { setSaving(false); }
  }, [list, name, selectedColor, selectedIcon, saving, updateList, router]);

  if (!list) return (<View style={styles.notFound}><Text style={styles.notFoundText}>List not found</Text></View>);

  return (
    <>
      <Stack.Screen options={{ title: "Edit List" }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.previewCard}><View style={[styles.previewIconBadge, { backgroundColor: selectedColor + "20" }]}><Text style={styles.previewIconText}>{selectedIcon}</Text></View><Text style={styles.previewName}>{name || "List Name"}</Text><View style={[styles.previewAccent, { backgroundColor: selectedColor }]} /></View>
          <View style={styles.section}><Text style={styles.sectionLabel}>List Name</Text><TextInput style={styles.nameInput} value={name} onChangeText={setName} placeholder="e.g., Spring Calving, For Sale, Yearling Heifers" placeholderTextColor={Colors.textTertiary} maxLength={50} testID="edit-list-name-input" /></View>
          <View style={styles.section}><Text style={styles.sectionLabel}>Icon</Text><View style={styles.iconGrid}>{LIST_ICONS.map((icon) => (<TouchableOpacity key={icon} style={[styles.iconOption, selectedIcon === icon && styles.iconOptionActive]} onPress={() => { setSelectedIcon(icon); if (Platform.OS !== "web") void Haptics.selectionAsync(); }}><Text style={styles.iconOptionText}>{icon}</Text></TouchableOpacity>))}</View></View>
          <View style={styles.section}><Text style={styles.sectionLabel}>Color</Text><View style={styles.colorGrid}>{LIST_COLORS.map((color) => (<TouchableOpacity key={color} style={[styles.colorOption, { backgroundColor: color }, selectedColor === color && styles.colorOptionActive]} onPress={() => { setSelectedColor(color); if (Platform.OS !== "web") void Haptics.selectionAsync(); }}>{selectedColor === color && <View style={styles.colorCheck} />}</TouchableOpacity>))}</View></View>
        </ScrollView>
        <View style={styles.footer}><TouchableOpacity style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]} onPress={handleSave} activeOpacity={0.8} disabled={!name.trim() || saving}><Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text></TouchableOpacity></View>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  notFoundText: { fontSize: 16, color: Colors.textSecondary },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  previewCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, alignItems: "center", marginBottom: 28, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3, overflow: "hidden" },
  previewIconBadge: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  previewIconText: { fontSize: 32 },
  previewName: { fontSize: 20, fontWeight: "700" as const, color: Colors.text },
  previewAccent: { position: "absolute", bottom: 0, left: 0, right: 0, height: 4 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: "700" as const, color: Colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10 },
  nameInput: { backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  iconOption: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  iconOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + "15" },
  iconOptionText: { fontSize: 22 },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  colorOption: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "transparent" },
  colorOptionActive: { borderColor: Colors.text },
  colorCheck: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.textInverse },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: Colors.background },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: "700" as const, color: Colors.textInverse },
});
