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
import { Plus, Users } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useProcessingSessions } from "@/providers/ProcessingSessionProvider";
import { useRanch } from "@/providers/RanchProvider";

export default function AddGroupToSessionScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { getSessionById, addGroupToSession } = useProcessingSessions();
  const { calvingGroups, breedingGroups } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const session = getSessionById(sessionId ?? "");
  const [customGroupName, setCustomGroupName] = useState("");

  const existingGroupIds = useMemo(
    () => new Set(session?.groups.map((g) => g.groupId).filter(Boolean) ?? []),
    [session],
  );

  const availableCalvingGroups = useMemo(
    () => calvingGroups.filter((cg) => !existingGroupIds.has(cg.id)),
    [calvingGroups, existingGroupIds],
  );

  const availableBreedingGroups = useMemo(
    () => breedingGroups.filter((bg) => !existingGroupIds.has(bg.id)),
    [breedingGroups, existingGroupIds],
  );

  const handleAddGroup = useCallback(
    async (type: "calving_group" | "breeding_group" | "custom", groupId: string | undefined, name: string) => {
      if (!session) return;
      try {
        await addGroupToSession({
          sessionId: session.id,
          group: { type, groupId, name, status: "not_started" },
        });
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } catch (e) {
        console.log("Error adding group:", e);
      }
    },
    [session, addGroupToSession, router],
  );

  const handleAddCustom = useCallback(() => {
    if (!customGroupName.trim()) return;
    handleAddGroup("custom", undefined, customGroupName.trim());
  }, [customGroupName, handleAddGroup]);

  if (!session) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Add Group" }} />
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
      <Stack.Screen options={{ title: "Add Group" }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {availableCalvingGroups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calving Groups</Text>
            {availableCalvingGroups.map((cg) => (
              <TouchableOpacity
                key={cg.id}
                style={styles.groupItem}
                onPress={() => handleAddGroup("calving_group", cg.id, cg.name)}
                activeOpacity={0.7}
              >
                <Users size={16} color={Colors.primary} />
                <Text style={styles.groupItemText}>{cg.name}</Text>
                <Plus size={16} color={Colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {availableBreedingGroups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Breeding Groups</Text>
            {availableBreedingGroups.map((bg) => (
              <TouchableOpacity
                key={bg.id}
                style={styles.groupItem}
                onPress={() => handleAddGroup("breeding_group", bg.id, bg.name)}
                activeOpacity={0.7}
              >
                <Users size={16} color={Colors.primary} />
                <Text style={styles.groupItemText}>{bg.name}</Text>
                <Plus size={16} color={Colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Group</Text>
          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              placeholder="Enter group name"
              placeholderTextColor={Colors.textTertiary}
              value={customGroupName}
              onChangeText={setCustomGroupName}
            />
            <TouchableOpacity
              style={[styles.customAddBtn, !customGroupName.trim() && styles.disabledBtn]}
              onPress={handleAddCustom}
              disabled={!customGroupName.trim()}
            >
              <Plus size={18} color={Colors.textInverse} />
            </TouchableOpacity>
          </View>
        </View>

        {availableCalvingGroups.length === 0 && availableBreedingGroups.length === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>
              All existing groups are already added. You can create a custom group above.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { padding: 20, paddingBottom: 40 },
    notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
    notFoundText: { fontSize: 16, color: Colors.textSecondary },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 12, fontWeight: "700" as const, color: Colors.textSecondary, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 0.5 },
    groupItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    groupItemText: { flex: 1, fontSize: 15, fontWeight: "600" as const, color: Colors.text },
    customRow: { flexDirection: "row", gap: 8 },
    customInput: {
      flex: 1,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: Colors.text,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    customAddBtn: {
      backgroundColor: Colors.primary,
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    disabledBtn: { opacity: 0.4 },
    emptyHint: { paddingTop: 12, paddingHorizontal: 8 },
    emptyHintText: { fontSize: 13, color: Colors.textTertiary, lineHeight: 19, textAlign: "center" as const },
  });
