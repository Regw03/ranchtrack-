import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Alert, KeyboardAvoidingView } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";

const GROUP_COLORS = ["#3D8B5E", "#1F3D2B", "#C4622D", "#D4943A", "#7B5EA7", "#2D7A9C", "#C44D3D", "#8B6E4E", "#5C7A3D", "#D47B8B"];

export default function EditCalvingGroupScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCalvingGroupById, updateCalvingGroup } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const group = useMemo(() => getCalvingGroupById(id ?? ""), [getCalvingGroupById, id]);
  const [name, setName] = useState(group?.name ?? "");
  const [selectedColor, setSelectedColor] = useState(group?.color ?? GROUP_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!group) return;
    if (!name.trim()) { Alert.alert("Name Required", "Please enter a name."); return; }
    if (saving) return;
    setSaving(true);
    try {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updateCalvingGroup({ ...group, name: name.trim(), color: selectedColor });
      router.back();
    } catch (e) { console.log("Error updating calving group:", e); Alert.alert("Error", "Failed to update calving group."); } finally { setSaving(false); }
  }, [group, name, selectedColor, saving, updateCalvingGroup, router]);

  if (!group) return (<View style={styles.notFound}><Text style={styles.notFoundText}>Group not found</Text></View>);

  return (
    <>
      <Stack.Screen options={{ title: "Edit Group" }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.previewCard}><View style={[styles.previewAccent, { backgroundColor: selectedColor }]} /><Text style={styles.previewName}>{name || "Group Name"}</Text></View>
          <View style={styles.section}><Text style={styles.sectionLabel}>Group Name</Text><TextInput style={styles.nameInput} value={name} onChangeText={setName} placeholder="Group name" placeholderTextColor={Colors.textTertiary} maxLength={60} autoFocus /></View>
          <View style={styles.section}><Text style={styles.sectionLabel}>Color</Text><View style={styles.colorGrid}>{GROUP_COLORS.map((color) => (<TouchableOpacity key={color} style={[styles.colorOption, { backgroundColor: color }, selectedColor === color && styles.colorOptionActive]} onPress={() => { setSelectedColor(color); if (Platform.OS !== "web") void Haptics.selectionAsync(); }}>{selectedColor === color && <View style={styles.colorCheck} />}</TouchableOpacity>))}</View></View>
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
  previewAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  previewName: { fontSize: 20, fontWeight: "700" as const, color: Colors.text, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: "700" as const, color: Colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10 },
  nameInput: { backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  colorOption: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "transparent" },
  colorOptionActive: { borderColor: Colors.text },
  colorCheck: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.textInverse },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: Colors.background },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: "700" as const, color: Colors.textInverse },
});
