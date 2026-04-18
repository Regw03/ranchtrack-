import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Check, AlertCircle, RotateCcw, ChevronDown, ChevronUp, StickyNote, Users } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { GenerationConfidence } from "@/types";

const LAST_CALVING_KEY = "ranchtrack_last_calving_entry";

interface LastEntry {
  calfSex: "male" | "female";
  calfBreed: string;
  assisted: boolean;
}

async function loadLastEntry(): Promise<LastEntry | null> {
  try {
    const stored = await AsyncStorage.getItem(LAST_CALVING_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

async function saveLastEntry(entry: LastEntry): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_CALVING_KEY, JSON.stringify(entry));
  } catch (e) {
    console.log("Error saving last calving entry:", e);
  }
}

export default function LogCalvingScreen() {
  const Colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ calvingGroupId?: string }>();
  const {
    animals,
    logCalving,
    isLoggingCalving,
    activeBusinessYearId,
    activeBusinessYear,
    isDuplicateTagInSameYear,
    getCalvingGroupById,
    addCalfToCalvingGroup,
    calvingGroups,
  } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const paramGroup = useMemo(
    () => (params.calvingGroupId ? getCalvingGroupById(params.calvingGroupId) : undefined),
    [params.calvingGroupId, getCalvingGroupById],
  );

  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(params.calvingGroupId);

  useEffect(() => {
    if (params.calvingGroupId) setSelectedGroupId(params.calvingGroupId);
  }, [params.calvingGroupId]);

  const calvingGroup = useMemo(
    () => (selectedGroupId ? getCalvingGroupById(selectedGroupId) : undefined),
    [selectedGroupId, getCalvingGroupById],
  );

  const availableGroups = useMemo(
    () => calvingGroups.filter((g) => !g.archived),
    [calvingGroups],
  );

  const [cowTag, setCowTag] = useState("");
  const [calfTag, setCalfTag] = useState("");
  const [calfSex, setCalfSex] = useState<"male" | "female">("female");
  const [calfBreed, setCalfBreed] = useState("");
  const [assisted, setAssisted] = useState(false);
  const [notes, setNotes] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [lastEntry, setLastEntry] = useState<LastEntry | null>(null);

  const calfTagRef = useRef<TextInput>(null);
  const successAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadLastEntry().then((entry) => {
      if (entry) {
        setLastEntry(entry);
        console.log("Loaded last calving entry:", entry);
      }
    });
  }, []);

  const matchedMother = useMemo(() => {
    if (!cowTag.trim()) return null;
    const q = cowTag.trim().toLowerCase();
    return animals.find(
      (a) =>
        a.tagId.toLowerCase() === q &&
        (a.sex === "female" || a.sex === "heifer") &&
        a.status === "active",
    );
  }, [animals, cowTag]);

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCalfSex(lastEntry.calfSex);
    setCalfBreed(lastEntry.calfBreed);
    setAssisted(lastEntry.assisted);
    console.log("Applied last entry values:", lastEntry);
  }, [lastEntry]);

  const showSuccess = useCallback(() => {
    successAnim.setValue(1);
    successScale.setValue(0.5);
    Animated.parallel([
      Animated.timing(successScale, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(successAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, [successAnim, successScale]);

  const resetForm = useCallback(() => {
    setCowTag("");
    setCalfTag("");
    setCalfBreed("");
    setAssisted(false);
    setNotes("");
    setShowExtras(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!calfTag.trim()) {
      Alert.alert("Missing Info", "Please enter a calf tag.");
      return;
    }

    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const motherId = matchedMother?.id ?? "";
    const breed = calfBreed.trim() || matchedMother?.breed || "Unknown";

    const entry: LastEntry = { calfSex, calfBreed: breed, assisted };
    await saveLastEntry(entry);
    setLastEntry(entry);

    const result = await logCalving({
      motherId,
      date: new Date().toISOString().split("T")[0],
      calfTagId: calfTag.trim(),
      calfSex,
      calfBreed: breed,
      birthWeight: undefined,
      birthWeightUnit: "lbs",
      assisted,
      notes: notes.trim() || (cowTag.trim() && !matchedMother ? `Cow tag: ${cowTag.trim()} (unmatched)` : ""),
      businessYearId: activeBusinessYearId,
    });

    if (calvingGroup && result.newCalf) {
      try {
        await addCalfToCalvingGroup({ groupId: calvingGroup.id, calfId: result.newCalf.id });
      } catch (e) {
        console.log("Error adding calf to group:", e);
      }
    }

    setSavedCount((c) => c + 1);
    showSuccess();
    resetForm();
  }, [
    calfTag, calfSex, calfBreed, assisted, notes, cowTag, matchedMother,
    logCalving, activeBusinessYearId, calvingGroup, addCalfToCalvingGroup,
    showSuccess, resetForm,
  ]);

  const isDuplicate = calfTag.trim() !== "" && isDuplicateTagInSameYear(calfTag.trim(), activeBusinessYearId);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: savedCount > 0 ? `Log Calving (${savedCount} saved)` : "Log Calving" }} />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.successOverlay,
          { opacity: successAnim, transform: [{ scale: successScale }] },
        ]}
      >
        <View style={styles.successBadge}>
          <Check size={32} color="#fff" />
          <Text style={styles.successText}>Saved!</Text>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {paramGroup && calvingGroup && (
          <View style={styles.groupBanner}>
            <View style={[styles.groupBannerDot, { backgroundColor: calvingGroup.color }]} />
            <Text style={styles.groupBannerText}>{calvingGroup.name}</Text>
          </View>
        )}

        {!paramGroup && availableGroups.length > 0 && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Calving Group (optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groupsRow}
            >
              <TouchableOpacity
                style={[styles.groupChip, !selectedGroupId && styles.groupChipActive]}
                onPress={() => {
                  if (Platform.OS !== "web") void Haptics.selectionAsync();
                  setSelectedGroupId(undefined);
                }}
                activeOpacity={0.8}
                testID="group-chip-none"
              >
                <Users size={14} color={!selectedGroupId ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.groupChipText, !selectedGroupId && styles.groupChipTextActive]}>
                  None
                </Text>
              </TouchableOpacity>
              {availableGroups.map((g) => {
                const active = selectedGroupId === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[
                      styles.groupChip,
                      active && styles.groupChipActive,
                      active && { borderColor: g.color, backgroundColor: g.color + "15" },
                    ]}
                    onPress={() => {
                      if (Platform.OS !== "web") void Haptics.selectionAsync();
                      setSelectedGroupId(g.id);
                    }}
                    activeOpacity={0.8}
                    testID={`group-chip-${g.id}`}
                  >
                    <View style={[styles.groupChipDot, { backgroundColor: g.color }]} />
                    <Text style={[styles.groupChipText, active && styles.groupChipTextActive]}>
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {lastEntry && (
          <TouchableOpacity
            style={styles.repeatBtn}
            onPress={handleRepeatLast}
            activeOpacity={0.7}
            testID="repeat-last-btn"
          >
            <RotateCcw size={16} color={Colors.primary} />
            <Text style={styles.repeatBtnText}>
              Repeat last ({lastEntry.calfSex === "female" ? "Heifer" : "Bull"}{lastEntry.calfBreed ? ` · ${lastEntry.calfBreed}` : ""})
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Cow Tag</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter cow tag (optional)"
            placeholderTextColor={Colors.textTertiary}
            value={cowTag}
            onChangeText={setCowTag}
            autoCapitalize="characters"
            returnKeyType="next"
            onSubmitEditing={() => calfTagRef.current?.focus()}
            testID="cow-tag-input"
          />
          {cowTag.trim() !== "" && (
            <Text style={[styles.matchHint, { color: matchedMother ? Colors.success : Colors.warning }]}>
              {matchedMother ? `Matched: ${matchedMother.tagId}` : "No match — will save as note"}
            </Text>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Calf Tag *</Text>
          <TextInput
            ref={calfTagRef}
            style={styles.input}
            placeholder="e.g. 2026-01"
            placeholderTextColor={Colors.textTertiary}
            value={calfTag}
            onChangeText={setCalfTag}
            autoCapitalize="characters"
            testID="calf-tag-input"
          />
          {isDuplicate && (
            <View style={styles.duplicateWarning}>
              <AlertCircle size={14} color={Colors.warning} />
              <Text style={styles.duplicateWarningText}>
                Tag exists in {activeBusinessYear.name}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Calf Type</Text>
          <View style={styles.sexRow}>
            <TouchableOpacity
              style={[styles.sexBtn, calfSex === "female" && styles.sexBtnActiveHeifer]}
              onPress={() => {
                if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setCalfSex("female");
              }}
              activeOpacity={0.8}
              testID="sex-heifer-btn"
            >
              <Text style={styles.sexEmoji}>♀</Text>
              <Text style={[styles.sexBtnLabel, calfSex === "female" && styles.sexBtnLabelActive]}>
                Heifer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sexBtn, calfSex === "male" && styles.sexBtnActiveBull]}
              onPress={() => {
                if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setCalfSex("male");
              }}
              activeOpacity={0.8}
              testID="sex-bull-btn"
            >
              <Text style={styles.sexEmoji}>♂</Text>
              <Text style={[styles.sexBtnLabel, calfSex === "male" && styles.sexBtnLabelActive]}>
                Bull
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.extrasToggle}
          onPress={() => setShowExtras(!showExtras)}
          activeOpacity={0.7}
        >
          <StickyNote size={16} color={Colors.textTertiary} />
          <Text style={styles.extrasToggleText}>
            {showExtras ? "Hide extras" : "Breed, notes & more"}
          </Text>
          {showExtras ? (
            <ChevronUp size={16} color={Colors.textTertiary} />
          ) : (
            <ChevronDown size={16} color={Colors.textTertiary} />
          )}
        </TouchableOpacity>

        {showExtras && (
          <View style={styles.extrasSection}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Breed</Text>
              <TextInput
                style={styles.input}
                placeholder={matchedMother?.breed || "e.g. Angus"}
                placeholderTextColor={Colors.textTertiary}
                value={calfBreed}
                onChangeText={setCalfBreed}
                testID="breed-input"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Assisted Birth?</Text>
              <View style={styles.assistedRow}>
                <TouchableOpacity
                  style={[styles.assistedBtn, !assisted && styles.assistedBtnActiveNo]}
                  onPress={() => setAssisted(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.assistedBtnText, !assisted && styles.assistedBtnTextActive]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.assistedBtn, assisted && styles.assistedBtnActiveYes]}
                  onPress={() => setAssisted(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.assistedBtnText, assisted && styles.assistedBtnTextActive]}>Yes</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any notes..."
                placeholderTextColor={Colors.textTertiary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                testID="notes-input"
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, isLoggingCalving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoggingCalving}
          activeOpacity={0.85}
          testID="save-calving-btn"
        >
          <Check size={22} color="#fff" />
          <Text style={styles.saveButtonText}>
            {isLoggingCalving ? "Saving..." : "Log Calving"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollView: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    groupBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.primary + "0A",
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: Colors.primary + "20",
    },
    groupBannerDot: { width: 10, height: 10, borderRadius: 5 },
    groupBannerText: { fontSize: 13, fontWeight: "600" as const, color: Colors.primary },
    groupsRow: { flexDirection: "row", gap: 8, paddingVertical: 2, paddingRight: 8 },
    groupChip: {
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
    groupChipActive: {
      borderColor: Colors.primary,
      backgroundColor: Colors.primary + "10",
    },
    groupChipDot: { width: 10, height: 10, borderRadius: 5 },
    groupChipText: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: Colors.textSecondary,
    },
    groupChipTextActive: { color: Colors.text },
    repeatBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: Colors.primary + "0D",
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: Colors.primary + "25",
    },
    repeatBtnText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: Colors.primary,
      flex: 1,
    },
    formGroup: { marginBottom: 18 },
    label: {
      fontSize: 12,
      fontWeight: "700" as const,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    input: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 17,
      color: Colors.text,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    textArea: { minHeight: 80, paddingTop: 14 },
    matchHint: {
      fontSize: 12,
      fontWeight: "500" as const,
      marginTop: 6,
      paddingHorizontal: 4,
    },
    duplicateWarning: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 4,
    },
    duplicateWarningText: { fontSize: 12, fontWeight: "500" as const, color: Colors.warning },
    sexRow: { flexDirection: "row", gap: 12 },
    sexBtn: {
      flex: 1,
      paddingVertical: 20,
      borderRadius: 16,
      backgroundColor: Colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: Colors.border,
      gap: 4,
    },
    sexBtnActiveHeifer: {
      backgroundColor: "#2D7A9C" + "15",
      borderColor: "#2D7A9C",
    },
    sexBtnActiveBull: {
      backgroundColor: Colors.accent + "15",
      borderColor: Colors.accent,
    },
    sexEmoji: {
      fontSize: 28,
      lineHeight: 34,
    },
    sexBtnLabel: {
      fontSize: 16,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
    },
    sexBtnLabelActive: {
      color: Colors.text,
    },
    extrasToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 14,
      marginBottom: 4,
    },
    extrasToggleText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: Colors.textTertiary,
      flex: 1,
    },
    extrasSection: {
      marginBottom: 4,
    },
    assistedRow: { flexDirection: "row", gap: 10 },
    assistedBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: Colors.surface,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: Colors.border,
    },
    assistedBtnActiveNo: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    assistedBtnActiveYes: {
      backgroundColor: Colors.warning,
      borderColor: Colors.warning,
    },
    assistedBtnText: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: Colors.textSecondary,
    },
    assistedBtnTextActive: { color: "#fff" },
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: Colors.success,
      borderRadius: 16,
      paddingVertical: 18,
      marginTop: 12,
      shadowColor: Colors.success,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: { fontSize: 18, fontWeight: "800" as const, color: "#fff" },
    successOverlay: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 100,
      alignItems: "center",
      justifyContent: "center",
    },
    successBadge: {
      backgroundColor: Colors.success,
      borderRadius: 24,
      paddingHorizontal: 32,
      paddingVertical: 20,
      alignItems: "center",
      gap: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    successText: { fontSize: 18, fontWeight: "800" as const, color: "#fff" },
  });
