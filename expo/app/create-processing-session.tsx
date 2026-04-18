import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import {
  Plus,
  X,
  Check,
  Users,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useProcessingSessions } from "@/providers/ProcessingSessionProvider";
import { useRanch } from "@/providers/RanchProvider";
import { SessionGroup } from "@/types";

type GroupDraft = Omit<SessionGroup, "id">;

export default function CreateProcessingSessionScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { createSession, isCreating } = useProcessingSessions();
  const { activeBusinessYear, calvingGroups, breedingGroups } = useRanch();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [customGroupName, setCustomGroupName] = useState("");

  const availableCalvingGroups = useMemo(
    () =>
      calvingGroups.filter(
        (cg) => !groups.some((g) => g.type === "calving_group" && g.groupId === cg.id),
      ),
    [calvingGroups, groups],
  );

  const availableBreedingGroups = useMemo(
    () =>
      breedingGroups.filter(
        (bg) => !groups.some((g) => g.type === "breeding_group" && g.groupId === bg.id),
      ),
    [breedingGroups, groups],
  );

  const addCalvingGroup = useCallback((id: string, groupName: string) => {
    setGroups((prev) => [
      ...prev,
      { type: "calving_group", groupId: id, name: groupName, status: "not_started" },
    ]);
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const addBreedingGroup = useCallback((id: string, groupName: string) => {
    setGroups((prev) => [
      ...prev,
      { type: "breeding_group", groupId: id, name: groupName, status: "not_started" },
    ]);
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const addCustomGroup = useCallback(() => {
    if (!customGroupName.trim()) return;
    setGroups((prev) => [
      ...prev,
      { type: "custom", name: customGroupName.trim(), status: "not_started" },
    ]);
    setCustomGroupName("");
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [customGroupName]);

  const removeGroup = useCallback((index: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter a session name.");
      return;
    }
    try {
      await createSession({
        name: name.trim(),
        businessYearId: activeBusinessYear.id,
        groups,
        notes: notes.trim(),
      });
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.log("Error creating session:", e);
      Alert.alert("Error", "Failed to create session. Try again.");
    }
  }, [name, notes, groups, activeBusinessYear.id, createSession, router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "New Processing Session" }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.label}>Session Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Spring Processing 2026"
            placeholderTextColor={Colors.textTertiary}
            value={name}
            onChangeText={setName}
            testID="session-name-input"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Business Year</Text>
          <View style={styles.yearBadge}>
            <Text style={styles.yearBadgeText}>{activeBusinessYear.name}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Groups</Text>
            <Text style={styles.groupCount}>{groups.length} added</Text>
          </View>

          {groups.map((group, index) => (
            <View key={`${group.type}-${group.name}-${index}`} style={styles.groupChip}>
              <Users size={14} color={Colors.primary} />
              <Text style={styles.groupChipText}>{group.name}</Text>
              <Text style={styles.groupTypeLabel}>
                {group.type === "calving_group" ? "Calving" : group.type === "breeding_group" ? "Breeding" : "Custom"}
              </Text>
              <TouchableOpacity
                onPress={() => removeGroup(index)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {!showGroupPicker ? (
            <TouchableOpacity
              style={styles.addGroupBtn}
              onPress={() => setShowGroupPicker(true)}
              testID="add-group-btn"
            >
              <Plus size={16} color={Colors.primary} />
              <Text style={styles.addGroupBtnText}>Add Group</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.groupPickerContainer}>
              {availableCalvingGroups.length > 0 && (
                <View style={styles.groupPickerSection}>
                  <Text style={styles.groupPickerTitle}>Calving Groups</Text>
                  {availableCalvingGroups.map((cg) => (
                    <TouchableOpacity
                      key={cg.id}
                      style={styles.groupPickerItem}
                      onPress={() => addCalvingGroup(cg.id, cg.name)}
                    >
                      <Text style={styles.groupPickerItemText}>{cg.name}</Text>
                      <Plus size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {availableBreedingGroups.length > 0 && (
                <View style={styles.groupPickerSection}>
                  <Text style={styles.groupPickerTitle}>Breeding Groups</Text>
                  {availableBreedingGroups.map((bg) => (
                    <TouchableOpacity
                      key={bg.id}
                      style={styles.groupPickerItem}
                      onPress={() => addBreedingGroup(bg.id, bg.name)}
                    >
                      <Text style={styles.groupPickerItemText}>{bg.name}</Text>
                      <Plus size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.groupPickerSection}>
                <Text style={styles.groupPickerTitle}>Custom Group</Text>
                <View style={styles.customGroupRow}>
                  <TextInput
                    style={styles.customGroupInput}
                    placeholder="Group name"
                    placeholderTextColor={Colors.textTertiary}
                    value={customGroupName}
                    onChangeText={setCustomGroupName}
                  />
                  <TouchableOpacity
                    style={[styles.customGroupAddBtn, !customGroupName.trim() && styles.disabledBtn]}
                    onPress={addCustomGroup}
                    disabled={!customGroupName.trim()}
                  >
                    <Plus size={16} color={Colors.textInverse} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.donePickerBtn}
                onPress={() => setShowGroupPicker(false)}
              >
                <Text style={styles.donePickerBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Any notes about this session..."
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <TouchableOpacity
          style={[styles.createBtn, (!name.trim() || isCreating) && styles.disabledBtn]}
          onPress={handleCreate}
          disabled={!name.trim() || isCreating}
          testID="create-session-btn"
        >
          <Check size={20} color={Colors.textInverse} />
          <Text style={styles.createBtnText}>
            {isCreating ? "Creating..." : "Create Session"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 120 },
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    label: { fontSize: 14, fontWeight: "700" as const, color: Colors.text, marginBottom: 8, letterSpacing: -0.1 },
    groupCount: { fontSize: 12, color: Colors.textTertiary, fontWeight: "600" as const },
    input: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 16,
      fontSize: 15,
      color: Colors.text,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    notesInput: { minHeight: 80 },
    yearBadge: {
      alignSelf: "flex-start",
      backgroundColor: Colors.primary + "12",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    yearBadgeText: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
    groupChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 8,
      gap: 8,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    groupChipText: { flex: 1, fontSize: 14, fontWeight: "600" as const, color: Colors.text },
    groupTypeLabel: { fontSize: 11, fontWeight: "600" as const, color: Colors.textTertiary, backgroundColor: Colors.background, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    addGroupBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: Colors.primary + "0A",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.primary + "20",
      borderStyle: "dashed",
    },
    addGroupBtnText: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
    groupPickerContainer: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    groupPickerSection: { marginBottom: 14 },
    groupPickerTitle: { fontSize: 12, fontWeight: "700" as const, color: Colors.textSecondary, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 0.5 },
    groupPickerItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: Colors.background,
      marginBottom: 4,
    },
    groupPickerItemText: { fontSize: 14, fontWeight: "600" as const, color: Colors.text },
    customGroupRow: { flexDirection: "row", gap: 8 },
    customGroupInput: {
      flex: 1,
      backgroundColor: Colors.background,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: Colors.text,
    },
    customGroupAddBtn: {
      backgroundColor: Colors.primary,
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    donePickerBtn: {
      alignItems: "center",
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
    },
    donePickerBtnText: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: Colors.background },
    createBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.primary,
      paddingVertical: 16,
      borderRadius: 14,
      gap: 8,
    },
    createBtnText: { fontSize: 16, fontWeight: "700" as const, color: Colors.textInverse },
    disabledBtn: { opacity: 0.4 },
  });
