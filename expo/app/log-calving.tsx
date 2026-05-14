import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Check, RefreshCw, Plus } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";

type CalfType = "heifer" | "steer" | "bull";

interface LastEntry {
  calfType: CalfType;
  calfBreed: string;
}

const CALF_TYPE_CONFIG: Record<CalfType, { label: string; emoji: string; color: string }> = {
  heifer: { label: "Heifer", emoji: "🐄", color: "#2D7A9C" },
  steer: { label: "Steer", emoji: "🐂", color: "#7B5EA7" },
  bull: { label: "Bull", emoji: "🐃", color: "#C4622D" },
};

export default function LogCalvingScreen() {
  const Colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ calvingListId?: string }>();
  const { logCalvingEvent, isLoggingCalvingEvent, calvingLists, getCalvingListById, createCalvingList } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const todayIso = new Date().toISOString().substring(0, 10);
  const isoToDisplay = useCallback((iso: string): string => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return `${m[2]}-${m[3]}-${m[1]}`;
  }, []);
  const displayToIso = useCallback((display: string): string | null => {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(display.trim());
    if (!m) return null;
    const mm = parseInt(m[1], 10);
    const dd = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900) return null;
    return `${m[3]}-${m[1]}-${m[2]}`;
  }, []);
  const formatDateInput = useCallback((raw: string, prev: string): string => {
    const isDeleting = raw.length < prev.length;
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    if (isDeleting && /-$/.test(raw)) return raw;
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return out;
  }, []);
  const [date, setDate] = useState<string>(isoToDisplay(todayIso));
  const [cowTag, setCowTag] = useState("");
  const [calfTag, setCalfTag] = useState("");
  const [calfType, setCalfType] = useState<CalfType>("heifer");
  const [selectedListId, setSelectedListId] = useState<string | undefined>(
    params.calvingListId,
  );
  const [saveCount, setSaveCount] = useState<number>(0);
  const [lastEntry, setLastEntry] = useState<LastEntry | null>(null);
  const [isCreatingList, setIsCreatingList] = useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>("");
  const [isSavingList, setIsSavingList] = useState<boolean>(false);

  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (params.calvingListId) setSelectedListId(params.calvingListId);
  }, [params.calvingListId]);

  useEffect(() => {
    if (!selectedListId && calvingLists.length > 0) {
      setSelectedListId(calvingLists[0].id);
    }
  }, [calvingLists, selectedListId]);

  const selectedList = useMemo(
    () => (selectedListId ? getCalvingListById(selectedListId) : undefined),
    [selectedListId, getCalvingListById],
  );

  const canSave =
    cowTag.trim().length > 0 &&
    calfTag.trim().length > 0 &&
    !!selectedListId &&
    !!displayToIso(date) &&
    !isLoggingCalvingEvent;

  const flashSuccess = useCallback(() => {
    Animated.sequence([
      Animated.timing(successAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(successAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [successAnim]);

  const handleSave = useCallback(async () => {
    if (!canSave || !selectedListId) return;
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const isoDate = displayToIso(date) ?? todayIso;
      await logCalvingEvent({
        calvingListId: selectedListId,
        date: isoDate,
        cowTag: cowTag.trim(),
        calfTag: calfTag.trim(),
        calfType,
      });

      setLastEntry({ calfType, calfBreed: "" });
      setSaveCount((c) => c + 1);
      flashSuccess();

      setCowTag("");
      setCalfTag("");
    } catch (e) {
      console.log("[log-calving] save error", e);
      Alert.alert("Error", "Could not save the calving record. Please try again.");
    }
  }, [canSave, selectedListId, date, cowTag, calfTag, calfType, logCalvingEvent, flashSuccess, displayToIso, todayIso]);

  const handleRepeatLast = useCallback(() => {
    if (!lastEntry) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCalfType(lastEntry.calfType);
  }, [lastEntry]);

  const handleQuickCreateList = useCallback(async () => {
    const name = newListName.trim();
    if (!name || isSavingList) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSavingList(true);
    try {
      const result = await createCalvingList({ name, color: "#3D8B5E" });
      const created = (result as unknown as { newList?: { id: string } } | undefined)?.newList;
      if (created?.id) setSelectedListId(created.id);
      setNewListName("");
      setIsCreatingList(false);
    } catch (e) {
      console.log("[log-calving] create list error", e);
      Alert.alert("Error", "Could not create the list. Please try again.");
    } finally {
      setIsSavingList(false);
    }
  }, [newListName, isSavingList, createCalvingList]);

  const handleSelectType = useCallback((type: CalfType) => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCalfType(type);
  }, []);

  const successOpacity = successAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {saveCount > 0 && (
              <View style={styles.topBar}>
                <Animated.View style={[styles.savedBadge, { opacity: successOpacity }]}>
                  <Check size={14} color={Colors.success} />
                  <Text style={styles.savedBadgeText}>Saved!</Text>
                </Animated.View>
                <Text style={styles.saveCounter}>
                  {saveCount} record{saveCount !== 1 ? "s" : ""} logged
                </Text>
                {lastEntry && (
                  <TouchableOpacity
                    style={styles.repeatBtn}
                    onPress={handleRepeatLast}
                    activeOpacity={0.7}
                    testID="repeat-last-btn"
                  >
                    <RefreshCw size={14} color={Colors.primary} />
                    <Text style={styles.repeatBtnText}>Repeat last</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.form}>
              <Text style={styles.sectionLabel}>Calving List</Text>
              {calvingLists.length === 0 ? (
                isCreatingList ? (
                  <View style={styles.inlineCreateWrap}>
                    <TextInput
                      value={newListName}
                      onChangeText={setNewListName}
                      placeholder="e.g. Spring Heifers"
                      placeholderTextColor={Colors.textTertiary}
                      style={styles.inlineCreateInput}
                      autoFocus
                      autoCapitalize="words"
                      returnKeyType="done"
                      onSubmitEditing={handleQuickCreateList}
                      maxLength={50}
                      testID="inline-list-name"
                    />
                    <TouchableOpacity
                      style={[styles.inlineCreateBtn, (!newListName.trim() || isSavingList) && styles.inlineCreateBtnDisabled]}
                      onPress={handleQuickCreateList}
                      disabled={!newListName.trim() || isSavingList}
                      activeOpacity={0.85}
                      testID="inline-list-save"
                    >
                      {isSavingList ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Check size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.createListBtn}
                    onPress={() => {
                      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsCreatingList(true);
                    }}
                    activeOpacity={0.85}
                    testID="create-list-inline"
                  >
                    <Plus size={18} color="#fff" />
                    <Text style={styles.createListBtnText}>Create your first list</Text>
                  </TouchableOpacity>
                )
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.listChips}
                >
                  {calvingLists.map((list) => (
                    <TouchableOpacity
                      key={list.id}
                      style={[
                        styles.listChip,
                        selectedListId === list.id && {
                          backgroundColor: list.color,
                          borderColor: list.color,
                        },
                      ]}
                      onPress={() => {
                        if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedListId(list.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.listChipDot,
                          { backgroundColor: selectedListId === list.id ? "#fff" : list.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.listChipText,
                          selectedListId === list.id && { color: "#fff" },
                        ]}
                        numberOfLines={1}
                      >
                        {list.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={styles.sectionLabel}>Date</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  value={date}
                  onChangeText={(t) => setDate((prev) => formatDateInput(t, prev))}
                  placeholder="MM-DD-YYYY"
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.input}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  maxLength={10}
                />
              </View>

              <Text style={styles.sectionLabel}>Cow Tag #</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  value={cowTag}
                  onChangeText={setCowTag}
                  placeholder="e.g. 214"
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.input}
                  autoCapitalize="characters"
                  returnKeyType="next"
                  maxLength={20}
                />
              </View>

              <Text style={styles.sectionLabel}>Calf Tag #</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  value={calfTag}
                  onChangeText={setCalfTag}
                  placeholder="e.g. 2026-01"
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.input}
                  autoCapitalize="characters"
                  returnKeyType="done"
                  maxLength={20}
                  onSubmitEditing={handleSave}
                />
              </View>

              <Text style={styles.sectionLabel}>Calf Type</Text>
              <View style={styles.typeRow}>
                {(["heifer", "steer", "bull"] as CalfType[]).map((type) => {
                  const cfg = CALF_TYPE_CONFIG[type];
                  const selected = calfType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeBtn,
                        selected && { backgroundColor: cfg.color, borderColor: cfg.color },
                      ]}
                      onPress={() => handleSelectType(type)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.typeEmoji}>{cfg.emoji}</Text>
                      <Text
                        style={[
                          styles.typeBtnText,
                          selected && { color: "#fff" },
                        ]}
                      >
                        {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.bottomBar}>
            {!selectedListId && calvingLists.length > 0 && (
              <Text style={styles.selectListHint}>Select a calving list above to continue</Text>
            )}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                {
                  backgroundColor: canSave
                    ? (selectedList?.color ?? Colors.primary)
                    : Colors.border,
                },
              ]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.85}
              testID="save-calving-btn"
            >
              {isLoggingCalvingEvent ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Check size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Record</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    safeArea: { flex: 1 },
    flex: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingBottom: 20 },

    topBar: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 4,
      gap: 10,
    },
    savedBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      backgroundColor: Colors.success + "18",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    savedBadgeText: {
      fontSize: 13,
      fontWeight: "700" as const,
      color: Colors.success,
    },
    saveCounter: {
      flex: 1,
      fontSize: 13,
      color: Colors.textSecondary,
      fontWeight: "600" as const,
    },
    repeatBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: Colors.primary,
    },
    repeatBtnText: {
      fontSize: 13,
      fontWeight: "700" as const,
      color: Colors.primary,
    },

    form: { paddingHorizontal: 20, paddingTop: 16 },

    sectionLabel: {
      fontSize: 13,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 1.1,
      marginBottom: 10,
      marginTop: 20,
      marginLeft: 2,
    },

    noListBanner: {
      backgroundColor: Colors.warning + "18",
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: Colors.warning + "40",
    },
    noListText: {
      fontSize: 14,
      color: Colors.warning,
      fontWeight: "600" as const,
      lineHeight: 20,
    },
    createListBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
      backgroundColor: Colors.primary,
      paddingVertical: 14,
      borderRadius: 14,
    },
    createListBtnText: {
      fontSize: 15,
      fontWeight: "800" as const,
      color: "#fff",
      letterSpacing: 0.2,
    },
    inlineCreateWrap: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
    },
    inlineCreateInput: {
      flex: 1,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: Colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      fontWeight: "600" as const,
      color: Colors.text,
    },
    inlineCreateBtn: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: Colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    inlineCreateBtnDisabled: {
      opacity: 0.4,
    },

    listChips: {
      gap: 10,
      paddingBottom: 4,
    },
    listChip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    listChipDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    listChipText: {
      fontSize: 15,
      fontWeight: "700" as const,
      color: Colors.text,
      maxWidth: 160,
    },

    inputWrapper: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: Colors.border,
      paddingHorizontal: 16,
    },
    input: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: Colors.text,
      paddingVertical: 16,
    },

    typeRow: {
      flexDirection: "row" as const,
      gap: 10,
    },
    typeBtn: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: 18,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      gap: 6,
    },
    typeEmoji: {
      fontSize: 28,
    },
    typeBtnText: {
      fontSize: 15,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
    },

    bottomBar: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      paddingTop: 8,
      gap: 8,
    },
    selectListHint: {
      fontSize: 13,
      color: Colors.textTertiary,
      textAlign: "center" as const,
      fontWeight: "500" as const,
    },
    saveBtn: {
      borderRadius: 16,
      paddingVertical: 18,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 10,
    },
    saveBtnText: {
      fontSize: 18,
      fontWeight: "800" as const,
      color: "#fff",
      letterSpacing: 0.2,
    },
  });
}
