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
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import {
  Check,
  Syringe,
  Droplet,
  Pill,
  ClipboardCheck,
  Tag,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useProcessingSessions } from "@/providers/ProcessingSessionProvider";
import { HEALTH_EVENT_TYPE_CONFIG } from "@/constants/health";
import { HealthEventType } from "@/types";

const EVENT_TYPES: { key: HealthEventType; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { key: "vaccination", icon: Syringe },
  { key: "blood_test", icon: Droplet },
  { key: "treatment", icon: Pill },
  { key: "inspection", icon: ClipboardCheck },
  { key: "custom", icon: Tag },
];

export default function LogSessionEventScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { getSessionById, logSessionEvent } = useProcessingSessions();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const session = getSessionById(sessionId ?? "");

  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState<HealthEventType>("vaccination");
  const [customTypeName, setCustomTypeName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>(session?.groups[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !selectedGroupId || !session) {
      Alert.alert("Required", "Please enter an event name and select a group.");
      return;
    }
    setIsSaving(true);
    try {
      await logSessionEvent({
        sessionId: session.id,
        type: selectedType,
        customTypeName: selectedType === "custom" ? customTypeName.trim() : undefined,
        name: name.trim(),
        groupId: selectedGroupId,
        notes: notes.trim(),
      });
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.log("Error logging session event:", e);
      Alert.alert("Error", "Failed to log event.");
    } finally {
      setIsSaving(false);
    }
  }, [name, selectedType, customTypeName, selectedGroupId, notes, session, logSessionEvent, router]);

  if (!session) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Log Event" }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Session not found</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Log Event" }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.label}>Event Type</Text>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map(({ key, icon: Icon }) => {
              const config = HEALTH_EVENT_TYPE_CONFIG[key];
              const isSelected = selectedType === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.typeChip,
                    isSelected && { backgroundColor: config.color + "18", borderColor: config.color },
                  ]}
                  onPress={() => {
                    setSelectedType(key);
                    if (Platform.OS !== "web") void Haptics.selectionAsync();
                  }}
                >
                  <Icon size={16} color={isSelected ? config.color : Colors.textTertiary} />
                  <Text style={[styles.typeChipText, isSelected && { color: config.color }]}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedType === "custom" && (
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Custom type name"
              placeholderTextColor={Colors.textTertiary}
              value={customTypeName}
              onChangeText={setCustomTypeName}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Event Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Blackleg Vaccine, Pour-on"
            placeholderTextColor={Colors.textTertiary}
            value={name}
            onChangeText={setName}
            testID="event-name-input"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Group</Text>
          <View style={styles.groupList}>
            {session.groups.map((group) => {
              const isSelected = selectedGroupId === group.id;
              return (
                <TouchableOpacity
                  key={group.id}
                  style={[styles.groupOption, isSelected && styles.groupOptionActive]}
                  onPress={() => {
                    setSelectedGroupId(group.id);
                    if (Platform.OS !== "web") void Haptics.selectionAsync();
                  }}
                >
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.groupOptionText, isSelected && styles.groupOptionTextActive]}>
                    {group.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Any additional notes..."
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, (!name.trim() || !selectedGroupId || isSaving) && styles.disabledBtn]}
          onPress={handleSave}
          disabled={!name.trim() || !selectedGroupId || isSaving}
          testID="save-event-btn"
        >
          <Check size={20} color={Colors.textInverse} />
          <Text style={styles.saveBtnText}>{isSaving ? "Saving..." : "Log Event"}</Text>
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
    notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
    notFoundText: { fontSize: 16, color: Colors.textSecondary },
    section: { marginBottom: 24 },
    label: { fontSize: 14, fontWeight: "700" as const, color: Colors.text, marginBottom: 8, letterSpacing: -0.1 },
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
    typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    typeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: Colors.surface,
      borderWidth: 1.5,
      borderColor: Colors.border,
    },
    typeChipText: { fontSize: 13, fontWeight: "600" as const, color: Colors.textSecondary },
    groupList: { gap: 6 },
    groupOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Colors.border,
    },
    groupOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOuterActive: { borderColor: Colors.primary },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
    groupOptionText: { fontSize: 15, fontWeight: "600" as const, color: Colors.text },
    groupOptionTextActive: { color: Colors.primary },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: Colors.background },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.primary,
      paddingVertical: 16,
      borderRadius: 14,
      gap: 8,
    },
    saveBtnText: { fontSize: 16, fontWeight: "700" as const, color: Colors.textInverse },
    disabledBtn: { opacity: 0.4 },
  });
