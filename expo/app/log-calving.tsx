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
import { Check, Plus } from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";

const MONTHS = [
 "Jan", "Feb", "Mar", "Apr", "May", "Jun",
 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function LogCalvingScreen() {
 const Colors = useColors();
 const router = useRouter();
 const params = useLocalSearchParams<{ calvingListId?: string }>();
 const {
 logCalvingEvent,
 isLoggingCalvingEvent,
 calvingLists,
 getCalvingListById,
 activeBusinessYear,
 } = useRanch();
 const styles = useMemo(() => createStyles(Colors), [Colors]);

 // ─── Form state ───────────────────────────────────────────────────────────

 const today = new Date();
 const [birthMonth, setBirthMonth] = useState(today.getMonth() + 1);
 const [birthDay, setBirthDay] = useState(today.getDate());
 const [cowTag, setCowTag] = useState("");
 const [calfTag, setCalfTag] = useState("");
 const [assisted, setAssisted] = useState<boolean | null>(null);
 const [selectedListId, setSelectedListId] = useState<string | undefined>(
 params.calvingListId ?? (calvingLists.length === 1 ? calvingLists[0].id : undefined),
 );
 const [saveCount, setSaveCount] = useState(0);
 const [lastAssisted, setLastAssisted] = useState<boolean | null>(null);

 // Success flash
 const successAnim = useRef(new Animated.Value(0)).current;

 useEffect(() => {
 if (params.calvingListId) {
 setSelectedListId(params.calvingListId);
 } else if (calvingLists.length === 1) {
 setSelectedListId(calvingLists[0].id);
 }
 }, [params.calvingListId, calvingLists.length]);

 const selectedList = useMemo(
 () => (selectedListId ? getCalvingListById(selectedListId) : undefined),
 [selectedListId, getCalvingListById],
 );

 const canSave =
 cowTag.trim().length > 0 &&
 calfTag.trim().length > 0 &&
 assisted !== null &&
 birthDay >= 1 && birthDay <= 31 &&
 birthMonth >= 1 && birthMonth <= 12 &&
 !!selectedListId &&
 !isLoggingCalvingEvent;

 // ─── Handlers ─────────────────────────────────────────────────────────────

 const flashSuccess = useCallback(() => {
 Animated.sequence([
 Animated.timing(successAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
 Animated.timing(successAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
 ]).start();
 }, [successAnim]);

 const handleSave = useCallback(async () => {
 if (!canSave || !selectedListId || assisted === null) return;
 if (Platform.OS !== "web")
 void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

 try {
 await logCalvingEvent({
 calvingListId: selectedListId,
 birthMonth,
 birthDay,
 cowTag: cowTag.trim(),
 calfTag: calfTag.trim(),
 assisted,
 });

 setLastAssisted(assisted);
 setSaveCount((c) => c + 1);
 flashSuccess();

 // Reset only cow and calf tags — keep list, date, and assisted
 setCowTag("");
 setCalfTag("");
 } catch (e) {
 Alert.alert("Error", "Could not save. Please try again.");
 }
 }, [
 canSave, selectedListId, assisted, birthMonth, birthDay,
 cowTag, calfTag, logCalvingEvent, flashSuccess,
 ]);

 const handleAssisted = useCallback((val: boolean) => {
 if (Platform.OS !== "web")
 void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
 setAssisted(val);
 }, []);

 const handleMonthChange = useCallback((direction: "up" | "down") => {
 if (Platform.OS !== "web")
 void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 setBirthMonth((m) => {
 if (direction === "up") return m === 12 ? 1 : m + 1;
 return m === 1 ? 12 : m - 1;
 });
 }, []);

 const handleDayChange = useCallback((direction: "up" | "down") => {
 if (Platform.OS !== "web")
 void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 setBirthDay((d) => {
 if (direction === "up") return d === 31 ? 1 : d + 1;
 return d === 1 ? 31 : d - 1;
 });
 }, []);

 // ─── Render ───────────────────────────────────────────────────────────────

 const successOpacity = successAnim;

 // No lists exist — prompt to create one
 if (calvingLists.length === 0) {
 return (
 <View style={styles.container}>
 <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
 <View style={styles.noListState}>
 <Text style={styles.noListEmoji}>🐄</Text>
 <Text style={styles.noListTitle}>No Calving Lists Yet</Text>
 <Text style={styles.noListSubtitle}>
 Create at least one calving list before logging a calving event.
 </Text>
 <TouchableOpacity
 style={[styles.createListBtn, { backgroundColor: Colors.primary }]}
 onPress={() => router.replace("/create-calving-list")}
 activeOpacity={0.85}
 >
 <Plus size={18} color="#fff" />
 <Text style={styles.createListBtnText}>Create a List</Text>
 </TouchableOpacity>
 </View>
 </SafeAreaView>
 </View>
 );
 }

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
 {/* ── Save counter ── */}
 {saveCount > 0 && (
 <View style={styles.topBar}>
 <Animated.View style={[styles.savedBadge, { opacity: successOpacity }]}>
 <Check size={13} color={Colors.success} />
 <Text style={styles.savedText}>Saved!</Text>
 </Animated.View>
 <Text style={styles.saveCounter}>
 {saveCount} record{saveCount !== 1 ? "s" : ""} logged
 </Text>
 </View>
 )}

 <View style={styles.form}>

 {/* ── List selector ── */}
 {calvingLists.length > 1 && (
 <>
 <Text style={styles.sectionLabel}>Calving List</Text>
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
 if (Platform.OS !== "web")
 void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 setSelectedListId(list.id);
 }}
 activeOpacity={0.8}
 >
 <View
 style={[
 styles.listChipDot,
 {
 backgroundColor:
 selectedListId === list.id ? "#fff" : list.color,
 },
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
 </>
 )}

 {/* Show selected list name when only one exists */}
 {calvingLists.length === 1 && selectedList && (
 <View style={styles.singleListBadge}>
 <View style={[styles.singleListDot, { backgroundColor: selectedList.color }]} />
 <Text style={styles.singleListName}>{selectedList.name}</Text>
 </View>
 )}

 {/* ── Date — month and day only ── */}
 <Text style={styles.sectionLabel}>
 Date of Birth
 <Text style={styles.sectionLabelMeta}>
 {" "}· year from {activeBusinessYear?.name ?? "business year"}
 </Text>
 </Text>
 <View style={styles.dateRow}>
 {/* Month */}
 <View style={styles.dateBlock}>
 <TouchableOpacity
 style={styles.dateArrow}
 onPress={() => handleMonthChange("up")}
 activeOpacity={0.7}
 >
 <Text style={styles.dateArrowText}>▲</Text>
 </TouchableOpacity>
 <View style={styles.dateDisplay}>
 <Text style={styles.dateValue}>{MONTHS[birthMonth - 1]}</Text>
 <Text style={styles.dateHint}>Month</Text>
 </View>
 <TouchableOpacity
 style={styles.dateArrow}
 onPress={() => handleMonthChange("down")}
 activeOpacity={0.7}
 >
 <Text style={styles.dateArrowText}>▼</Text>
 </TouchableOpacity>
 </View>

 <Text style={styles.dateSep}>/</Text>

 {/* Day */}
 <View style={styles.dateBlock}>
 <TouchableOpacity
 style={styles.dateArrow}
 onPress={() => handleDayChange("up")}
 activeOpacity={0.7}
 >
 <Text style={styles.dateArrowText}>▲</Text>
 </TouchableOpacity>
 <View style={styles.dateDisplay}>
 <Text style={styles.dateValue}>{String(birthDay).padStart(2, "0")}</Text>
 <Text style={styles.dateHint}>Day</Text>
 </View>
 <TouchableOpacity
 style={styles.dateArrow}
 onPress={() => handleDayChange("down")}
 activeOpacity={0.7}
 >
 <Text style={styles.dateArrowText}>▼</Text>
 </TouchableOpacity>
 </View>
 </View>

 {/* ── Cow tag ── */}
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

 {/* ── Calf tag ── */}
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
 />
 </View>

 {/* ── Assisted — two big YES / NO buttons ── */}
 <Text style={styles.sectionLabel}>Assisted Birth?</Text>
 <View style={styles.assistedRow}>
 <TouchableOpacity
 style={[
 styles.assistedBtn,
 assisted === true && styles.assistedBtnYes,
 ]}
 onPress={() => handleAssisted(true)}
 activeOpacity={0.8}
 >
 <Text
 style={[
 styles.assistedBtnText,
 assisted === true && styles.assistedBtnTextActive,
 ]}
 >
 YES
 </Text>
 </TouchableOpacity>
 <TouchableOpacity
 style={[
 styles.assistedBtn,
 assisted === false && styles.assistedBtnNo,
 ]}
 onPress={() => handleAssisted(false)}
 activeOpacity={0.8}
 >
 <Text
 style={[
 styles.assistedBtnText,
 assisted === false && styles.assistedBtnTextActive,
 ]}
 >
 NO
 </Text>
 </TouchableOpacity>
 </View>

 {assisted === null && (
 <Text style={styles.assistedHint}>Select YES or NO to continue</Text>
 )}
 </View>
 </ScrollView>

 {/* ── Save button ── */}
 <View style={styles.bottomBar}>
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
 >
 {isLoggingCalvingEvent ? (
 <ActivityIndicator color="#fff" />
 ) : (
 <>
 <Check size={22} color="#fff" />
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

 // No list state
 noListState: {
 flex: 1,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 paddingHorizontal: 32,
 gap: 12,
 },
 noListEmoji: { fontSize: 52, marginBottom: 4 },
 noListTitle: { fontSize: 20, fontWeight: "800" as const, color: Colors.text, textAlign: "center" as const },
 noListSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: "center" as const, lineHeight: 22 },
 createListBtn: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 gap: 8,
 marginTop: 8,
 paddingHorizontal: 24,
 paddingVertical: 14,
 borderRadius: 14,
 },
 createListBtnText: { fontSize: 16, fontWeight: "700" as const, color: "#fff" },

 // Save counter
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
 gap: 5,
 backgroundColor: Colors.success + "20",
 paddingHorizontal: 10,
 paddingVertical: 5,
 borderRadius: 20,
 },
 savedText: { fontSize: 13, fontWeight: "700" as const, color: Colors.success },
 saveCounter: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" as const },

 form: { paddingHorizontal: 20, paddingTop: 16 },

 sectionLabel: {
 fontSize: 13,
 fontWeight: "800" as const,
 color: Colors.textSecondary,
 textTransform: "uppercase" as const,
 letterSpacing: 1.1,
 marginBottom: 10,
 marginTop: 22,
 marginLeft: 2,
 },
 sectionLabelMeta: {
 fontSize: 11,
 fontWeight: "500" as const,
 color: Colors.textTertiary,
 textTransform: "none" as const,
 letterSpacing: 0,
 },

 // List chips
 listChips: { gap: 10, paddingBottom: 4 },
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
 listChipDot: { width: 10, height: 10, borderRadius: 5 },
 listChipText: {
 fontSize: 15,
 fontWeight: "700" as const,
 color: Colors.text,
 maxWidth: 160,
 },
 singleListBadge: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 gap: 8,
 marginTop: 10,
 marginBottom: 4,
 },
 singleListDot: { width: 10, height: 10, borderRadius: 5 },
 singleListName: { fontSize: 15, fontWeight: "700" as const, color: Colors.textSecondary },

 // Date picker
 dateRow: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 gap: 16,
 },
 dateBlock: {
 flex: 1,
 alignItems: "center" as const,
 backgroundColor: Colors.surface,
 borderRadius: 14,
 borderWidth: 1.5,
 borderColor: Colors.border,
 paddingVertical: 8,
 },
 dateArrow: {
 paddingVertical: 8,
 paddingHorizontal: 24,
 },
 dateArrowText: {
 fontSize: 14,
 color: Colors.primary,
 fontWeight: "700" as const,
 },
 dateDisplay: { alignItems: "center" as const, paddingVertical: 4 },
 dateValue: {
 fontSize: 26,
 fontWeight: "800" as const,
 color: Colors.text,
 letterSpacing: -0.5,
 },
 dateHint: {
 fontSize: 11,
 color: Colors.textTertiary,
 fontWeight: "600" as const,
 textTransform: "uppercase" as const,
 letterSpacing: 0.8,
 marginTop: 2,
 },
 dateSep: {
 fontSize: 28,
 color: Colors.textTertiary,
 fontWeight: "300" as const,
 marginTop: -8,
 },

 // Tag inputs
 inputWrapper: {
 backgroundColor: Colors.surface,
 borderRadius: 14,
 borderWidth: 1.5,
 borderColor: Colors.border,
 paddingHorizontal: 16,
 },
 input: {
 fontSize: 20,
 fontWeight: "700" as const,
 color: Colors.text,
 paddingVertical: 16,
 },

 // Assisted buttons
 assistedRow: {
 flexDirection: "row" as const,
 gap: 12,
 },
 assistedBtn: {
 flex: 1,
 paddingVertical: 22,
 borderRadius: 16,
 borderWidth: 2,
 borderColor: Colors.border,
 backgroundColor: Colors.surface,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 },
 assistedBtnYes: {
 backgroundColor: "#C44D3D",
 borderColor: "#C44D3D",
 },
 assistedBtnNo: {
 backgroundColor: Colors.primary,
 borderColor: Colors.primary,
 },
 assistedBtnText: {
 fontSize: 22,
 fontWeight: "900" as const,
 color: Colors.textSecondary,
 letterSpacing: 2,
 },
 assistedBtnTextActive: {
 color: "#fff",
 },
 assistedHint: {
 fontSize: 13,
 color: Colors.textTertiary,
 textAlign: "center" as const,
 marginTop: 8,
 fontStyle: "italic" as const,
 },

 // Save button
 bottomBar: {
 paddingHorizontal: 20,
 paddingBottom: 16,
 paddingTop: 8,
 },
 saveBtn: {
 borderRadius: 16,
 paddingVertical: 20,
 flexDirection: "row" as const,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 gap: 10,
 },
 saveBtnText: {
 fontSize: 19,
 fontWeight: "800" as const,
 color: "#fff",
 letterSpacing: 0.2,
 },
 });
}
