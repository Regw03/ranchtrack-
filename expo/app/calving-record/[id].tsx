import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
 View,
 Text,
 StyleSheet,
 ScrollView,
 TouchableOpacity,
 TextInput,
 Alert,
 Platform,
 Switch,
 ActivityIndicator,
 Image,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
 Camera,
 Check,
 X,
 Trash2,
 ChevronRight,
 ImageIcon,
 Edit3,
} from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { CalvingRecord } from "@/types";

const MONTHS = [
 "January", "February", "March", "April", "May", "June",
 "July", "August", "September", "October", "November", "December",
];

const MONTHS_SHORT = [
 "Jan", "Feb", "Mar", "Apr", "May", "Jun",
 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ─── Inline editable field ────────────────────────────────────────────────────

function EditableField({
 label,
 value,
 onSave,
 placeholder,
 keyboardType = "default",
 multiline = false,
 capitalize = "sentences",
}: {
 label: string;
 value: string;
 onSave: (val: string) => void;
 placeholder?: string;
 keyboardType?: "default" | "numeric" | "numbers-and-punctuation";
 multiline?: boolean;
 capitalize?: "none" | "sentences" | "words" | "characters";
}) {
 const Colors = useColors();
 const styles = useMemo(() => createStyles(Colors), [Colors]);
 const [editing, setEditing] = useState(false);
 const [draft, setDraft] = useState(value);

 useEffect(() => { setDraft(value); }, [value]);

 const handleSave = useCallback(() => {
 onSave(draft.trim());
 setEditing(false);
 if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 }, [draft, onSave]);

 const handleCancel = useCallback(() => {
 setDraft(value);
 setEditing(false);
 }, [value]);

 if (editing) {
 return (
 <View style={styles.fieldEditing}>
 <Text style={styles.fieldLabel}>{label}</Text>
 <View style={styles.fieldEditRow}>
 <TextInput
 value={draft}
 onChangeText={setDraft}
 style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
 autoFocus
 multiline={multiline}
 keyboardType={keyboardType}
 autoCapitalize={capitalize}
 returnKeyType={multiline ? "default" : "done"}
 onSubmitEditing={multiline ? undefined : handleSave}
 placeholder={placeholder}
 placeholderTextColor={Colors.textTertiary}
 />
 <View style={styles.fieldEditBtns}>
 <TouchableOpacity style={styles.fieldSaveBtn} onPress={handleSave}>
 <Check size={16} color="#fff" />
 </TouchableOpacity>
 <TouchableOpacity style={styles.fieldCancelBtn} onPress={handleCancel}>
 <X size={16} color={Colors.textSecondary} />
 </TouchableOpacity>
 </View>
 </View>
 </View>
 );
 }

 return (
 <TouchableOpacity style={styles.fieldRow} onPress={() => setEditing(true)} activeOpacity={0.7}>
 <View style={styles.fieldInfo}>
 <Text style={styles.fieldLabel}>{label}</Text>
 <Text style={[styles.fieldValue, !value && styles.fieldEmpty]}>
 {value || (placeholder ?? "Tap to add")}
 </Text>
 </View>
 <Edit3 size={15} color={Colors.textTertiary} />
 </TouchableOpacity>
 );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CalvingRecordScreen() {
 const Colors = useColors();
 const { id } = useLocalSearchParams<{ id: string }>();
 const router = useRouter();
 const {
 calvingRecords,
 updateCalvingRecord,
 deleteCalvingRecord,
 getCalvingListById,
 getAnimalById,
 businessYears,
 } = useRanch();
 const styles = useMemo(() => createStyles(Colors), [Colors]);

 const record = useMemo(
 () => calvingRecords.find((r) => r.id === id),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [id, calvingRecords],
 );

 const list = useMemo(
 () => (record?.calvingListId ? getCalvingListById(record.calvingListId) : undefined),
 [record?.calvingListId, getCalvingListById],
 );

 const calfAnimal = useMemo(
 () => (record?.calfId ? getAnimalById(record.calfId) : undefined),
 [record?.calfId, getAnimalById],
 );

 const [isSaving, setIsSaving] = useState(false);

 const handleUpdate = useCallback(
 async (patch: Partial<CalvingRecord>) => {
 if (!record) return;
 setIsSaving(true);
 try {
 const updated = { ...record, ...patch, updatedAt: new Date().toISOString() };

 // Recompute full ISO date when month or day changes
 if (patch.birthMonth !== undefined || patch.birthDay !== undefined) {
 const by = businessYears.find((y) => y.id === record.businessYearId);
 const yearNum = by
 ? new Date(by.startDate).getFullYear()
 : new Date().getFullYear();
 const mm = String(updated.birthMonth).padStart(2, "0");
 const dd = String(updated.birthDay).padStart(2, "0");
 updated.date = `${yearNum}-${mm}-${dd}`;
 }

 await updateCalvingRecord(updated);
 } catch (e) {
 Alert.alert("Error", "Could not save. Please try again.");
 } finally {
 setIsSaving(false);
 }
 },
 [record, updateCalvingRecord, businessYears],
  );

 const handleDelete = useCallback(() => {
 if (!record) return;
 Alert.alert(
 "Delete Record",
 `Delete the record for Cow ${record.cowTag} → Calf ${record.calfTag}? This cannot be undone.`,
 [
 { text: "Cancel", style: "cancel" },
 {
 text: "Delete",
 style: "destructive",
 onPress: async () => {
 if (Platform.OS !== "web")
 void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
 await deleteCalvingRecord(record.id);
 router.back();
 },
 },
 ],
 );
 }, [record, deleteCalvingRecord, router]);

 const handlePhotoPress = useCallback(async () => {
 if (!record) return;
 const options: string[] = ["Take Photo", "Choose from Library"];
 if (record.photoUrl) options.push("Remove Photo");

 Alert.alert("Photo", "Add a photo of the cow and calf pair", [
 {
 text: "Take Photo",
 onPress: async () => {
 const { status } = await ImagePicker.requestCameraPermissionsAsync();
 if (status !== "granted") {
 Alert.alert("Permission needed", "Camera permission is required.");
 return;
 }
 const result = await ImagePicker.launchCameraAsync({
 mediaTypes: ImagePicker.MediaTypeOptions.Images,
 allowsEditing: true,
 aspect: [4, 3],
 quality: 0.85,
 });
 if (!result.canceled && result.assets[0]) {
 await handleUpdate({ photoUrl: result.assets[0].uri });
 }
 },
 },
 {
 text: "Choose from Library",
 onPress: async () => {
 const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
 if (status !== "granted") {
 Alert.alert("Permission needed", "Photo library permission is required.");
 return;
 }
 const result = await ImagePicker.launchImageLibraryAsync({
 mediaTypes: ImagePicker.MediaTypeOptions.Images,
 allowsEditing: true,
 aspect: [4, 3],
 quality: 0.85,
 });
 if (!result.canceled && result.assets[0]) {
 await handleUpdate({ photoUrl: result.assets[0].uri });
 }
 },
 },
 ...(record.photoUrl
 ? [{
 text: "Remove Photo",
 style: "destructive" as const,
 onPress: async () => handleUpdate({ photoUrl: undefined }),
 }]
 : []),
 { text: "Cancel", style: "cancel" as const },
 ]);
 }, [record, handleUpdate]);

 const handleCalfTypeChange = useCallback(
 (type: "heifer" | "steer" | "bull") => {
 if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 void handleUpdate({ calfType: type });
 },
 [handleUpdate],
 );

 if (!record) {
 return (
 <View style={styles.notFound}>
 <Text style={styles.notFoundText}>Record not found</Text>
 </View>
 );
 }

 // Build display date
 const monthName = MONTHS[(record.birthMonth ?? 1) - 1] ?? "";
 const dayStr = String(record.birthDay ?? 1).padStart(2, "0");
 const yearNum = record.date
 ? new Date(record.date).getFullYear()
 : new Date().getFullYear();
 const displayDate = `${monthName} ${dayStr}, ${yearNum}`;

 return (
 <>
 <Stack.Screen
 options={{
 title: `Cow ${record.cowTag} — Calf ${record.calfTag}`,
 headerRight: () => (
 <View style={styles.headerRight}>
 {isSaving && <ActivityIndicator size="small" color={Colors.primary} />}
 <TouchableOpacity
 onPress={handleDelete}
 hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
 >
 <Trash2 size={20} color={Colors.error} />
 </TouchableOpacity>
 </View>
 ),
 }}
 />

 <ScrollView
 style={styles.container}
 contentContainerStyle={styles.content}
 showsVerticalScrollIndicator={false}
 >
 {/* ── Hero photo ── */}
 <TouchableOpacity
 style={styles.heroPhoto}
 onPress={handlePhotoPress}
 activeOpacity={0.9}
 >
 {record.photoUrl ? (
 <Image
 source={{ uri: record.photoUrl }}
 style={styles.heroImage}
 resizeMode="cover"
 />
 ) : (
 <View style={styles.heroPlaceholder}>
 <ImageIcon size={36} color={Colors.textTertiary} />
 <Text style={styles.heroPlaceholderText}>Tap to add photo</Text>
 <Text style={styles.heroPlaceholderSub}>
 Photo of the cow and calf pair
 </Text>
 </View>
 )}
 {/* Camera badge */}
 <View style={[styles.cameraBadge, { backgroundColor: list?.color ?? Colors.primary }]}>
 <Camera size={16} color="#fff" />
 </View>
 </TouchableOpacity>

 {/* ── Identity header ── */}
 <View style={styles.identityBlock}>
 <View style={styles.identityRow}>
 <View style={styles.identityTag}>
 <Text style={styles.identityTagLabel}>COW</Text>
 <Text style={styles.identityTagValue}>{record.cowTag}</Text>
 </View>
 <Text style={styles.identityArrow}>→</Text>
 <View style={styles.identityTag}>
 <Text style={styles.identityTagLabel}>CALF</Text>
 <Text style={styles.identityTagValue}>{record.calfTag}</Text>
 </View>
 </View>
 <Text style={styles.identityDate}>{displayDate}</Text>
 {list && (
 <View style={styles.listBadge}>
 <View style={[styles.listBadgeDot, { backgroundColor: list.color }]} />
 <Text style={styles.listBadgeName}>{list.name}</Text>
 </View>
 )}
 </View>

 {/* ── Required fields ── */}
 <View style={styles.section}>
 <Text style={styles.sectionTitle}>Record Details</Text>
 <View style={styles.card}>

 {/* Editable cow tag */}
 <EditableField
 label="Cow Tag #"
 value={record.cowTag}
 onSave={(v) => handleUpdate({ cowTag: v })}
 placeholder="Enter cow tag"
 capitalize="characters"
 />
 <View style={styles.divider} />

 {/* Editable calf tag */}
 <EditableField
 label="Calf Tag #"
 value={record.calfTag}
 onSave={(v) => handleUpdate({ calfTag: v })}
 placeholder="Enter calf tag"
 capitalize="characters"
 />
 <View style={styles.divider} />

 {/* Date — month and day spinners */}
 <View style={styles.fieldRow}>
 <View style={styles.fieldInfo}>
 <Text style={styles.fieldLabel}>Date of Birth</Text>
 <Text style={styles.fieldValue}>{displayDate}</Text>
 </View>
 <View style={styles.dateSpinners}>
 {/* Month */}
 <View style={styles.spinner}>
 <TouchableOpacity
 onPress={() =>
 handleUpdate({
 birthMonth: record.birthMonth === 12 ? 1 : (record.birthMonth ?? 1) + 1,
 })
 }
 style={styles.spinnerBtn}
 >
 <Text style={styles.spinnerArrow}>▲</Text>
 </TouchableOpacity>
 <Text style={styles.spinnerValue}>
 {MONTHS_SHORT[(record.birthMonth ?? 1) - 1]}
 </Text>
 <TouchableOpacity
 onPress={() =>
 handleUpdate({
 birthMonth: record.birthMonth === 1 ? 12 : (record.birthMonth ?? 1) - 1,
 })
 }
 style={styles.spinnerBtn}
 >
 <Text style={styles.spinnerArrow}>▼</Text>
 </TouchableOpacity>
 </View>
 <Text style={styles.spinnerSep}>/</Text>
 {/* Day */}
 <View style={styles.spinner}>
 <TouchableOpacity
 onPress={() =>
 handleUpdate({
 birthDay: record.birthDay === 31 ? 1 : (record.birthDay ?? 1) + 1,
 })
 }
 style={styles.spinnerBtn}
 >
 <Text style={styles.spinnerArrow}>▲</Text>
 </TouchableOpacity>
 <Text style={styles.spinnerValue}>
 {String(record.birthDay ?? 1).padStart(2, "0")}
 </Text>
 <TouchableOpacity
 onPress={() =>
 handleUpdate({
 birthDay: record.birthDay === 1 ? 31 : (record.birthDay ?? 1) - 1,
 })
 }
 style={styles.spinnerBtn}
 >
 <Text style={styles.spinnerArrow}>▼</Text>
 </TouchableOpacity>
 </View>
 </View>
 </View>
 <View style={styles.divider} />

 {/* Assisted toggle */}
 <View style={styles.fieldRow}>
 <View style={styles.fieldInfo}>
 <Text style={styles.fieldLabel}>Assisted Birth</Text>
 <Text style={styles.fieldValue}>
 {record.assisted ? "Yes — assistance was needed" : "No — unassisted"}
 </Text>
 </View>
 <Switch
 value={record.assisted}
 onValueChange={(v) => handleUpdate({ assisted: v })}
 trackColor={{ false: Colors.border, true: "#C44D3D" }}
 thumbColor={Colors.textInverse}
 />
 </View>
 </View>
 </View>

 {/* ── Optional fields ── */}
 <View style={styles.section}>
 <Text style={styles.sectionTitle}>Optional Details</Text>
 <View style={styles.card}>

 {/* Calf type */}
 <View style={styles.fieldRow}>
 <View style={styles.fieldInfo}>
 <Text style={styles.fieldLabel}>Calf Type</Text>
 <Text style={[styles.fieldValue, !record.calfType && styles.fieldEmpty]}>
 {record.calfType
 ? record.calfType.charAt(0).toUpperCase() + record.calfType.slice(1)
 : "Not set"}
 </Text>
 </View>
 </View>
 <View style={styles.calfTypeRow}>
 {(["heifer", "steer", "bull"] as const).map((type) => {
 const selected = record.calfType === type;
 const colors = {
 heifer: "#2D7A9C",
 steer: "#7B5EA7",
 bull: "#C4622D",
 };
 return (
 <TouchableOpacity
 key={type}
 style={[
 styles.calfTypeBtn,
 selected && { backgroundColor: colors[type], borderColor: colors[type] },
 ]}
 onPress={() => handleCalfTypeChange(type)}
 activeOpacity={0.8}
 >
 <Text style={[styles.calfTypeBtnText, selected && { color: "#fff" }]}>
 {type.charAt(0).toUpperCase() + type.slice(1)}
 </Text>
 </TouchableOpacity>
 );
 })}
 </View>
 <View style={styles.divider} />

 {/* Sire tag */}
 <EditableField
 label="Sire Tag #"
 value={record.sireTag ?? ""}
 onSave={(v) => handleUpdate({ sireTag: v || undefined })}
 placeholder="Enter sire tag"
 capitalize="characters"
 />
 <View style={styles.divider} />

 {/* Birth weight */}
 <View style={styles.fieldRow}>
 <View style={{ flex: 1 }}>
 <EditableField
 label="Birth Weight"
 value={record.birthWeight ? String(record.birthWeight) : ""}
 onSave={(v) => handleUpdate({ birthWeight: v ? Number(v) : undefined })}
 placeholder="e.g. 82"
 keyboardType="numeric"
 />
 </View>
 </View>
 {/* Weight unit toggle */}
 {!!record.birthWeight && (
 <>
 <View style={styles.divider} />
 <View style={styles.fieldRow}>
 <View style={styles.fieldInfo}>
 <Text style={styles.fieldLabel}>Weight Unit</Text>
 <Text style={styles.fieldValue}>{record.birthWeightUnit ?? "lbs"}</Text>
 </View>
 <View style={styles.unitToggle}>
 <TouchableOpacity
 style={[
 styles.unitBtn,
 (record.birthWeightUnit ?? "lbs") === "lbs" && styles.unitBtnActive,
 ]}
 onPress={() => handleUpdate({ birthWeightUnit: "lbs" })}
 >
 <Text style={[
 styles.unitBtnText,
 (record.birthWeightUnit ?? "lbs") === "lbs" && styles.unitBtnTextActive,
 ]}>lbs</Text>
 </TouchableOpacity>
 <TouchableOpacity
 style={[
 styles.unitBtn,
 record.birthWeightUnit === "kg" && styles.unitBtnActive,
 ]}
 onPress={() => handleUpdate({ birthWeightUnit: "kg" })}
 >
 <Text style={[
 styles.unitBtnText,
 record.birthWeightUnit === "kg" && styles.unitBtnTextActive,
 ]}>kg</Text>
 </TouchableOpacity>
 </View>
 </View>
 </>
 )}
 <View style={styles.divider} />

 {/* Notes */}
 <EditableField
 label="Notes"
 value={record.notes ?? ""}
 onSave={(v) => handleUpdate({ notes: v || undefined })}
 placeholder="Anything unusual about the birth or animals"
 multiline
 />
 </View>
 </View>

 {/* ── Linked calf animal profile ── */}
 {calfAnimal && (
 <View style={styles.section}>
 <Text style={styles.sectionTitle}>Linked Calf Profile</Text>
 <TouchableOpacity
 style={styles.linkedCard}
 onPress={() => router.push(`/animal/${calfAnimal.id}`)}
 activeOpacity={0.75}
 >
 <View style={styles.linkedIcon}>
 <Text style={{ fontSize: 24 }}>🐮</Text>
 </View>
 <View style={styles.linkedInfo}>
 <Text style={styles.linkedTag}>{calfAnimal.tagId}</Text>
 <Text style={styles.linkedSub}>
 {calfAnimal.breed || "Cattle"} · Tap to open animal profile
 </Text>
 </View>
 <ChevronRight size={18} color={Colors.textTertiary} />
 </TouchableOpacity>
 </View>
 )}

 {/* ── Meta ── */}
 <View style={styles.meta}>
 {record.createdByName && (
 <Text style={styles.metaText}>Logged by {record.createdByName}</Text>
 )}
 <Text style={styles.metaText}>
 Created {new Date(record.createdAt).toLocaleDateString()}
 </Text>
 {record.updatedAt !== record.createdAt && (
 <Text style={styles.metaText}>
 Last edited {new Date(record.updatedAt).toLocaleDateString()}
 </Text>
 )}
 </View>

 <View style={{ height: 48 }} />
 </ScrollView>
 </>
 );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(Colors: ThemeColors) {
 return StyleSheet.create({
 container: { flex: 1, backgroundColor: Colors.background },
 content: { paddingBottom: 40 },
 notFound: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const },
 notFoundText: { fontSize: 16, color: Colors.textSecondary },
 headerRight: { flexDirection: "row" as const, alignItems: "center" as const, gap: 14 },

 // Hero photo
 heroPhoto: {
 height: 240,
 backgroundColor: Colors.surface,
 borderBottomWidth: 1,
 borderBottomColor: Colors.border,
 position: "relative" as const,
 },
 heroImage: { width: "100%", height: "100%" },
 heroPlaceholder: {
 flex: 1,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 gap: 8,
 },
 heroPlaceholderText: {
 fontSize: 16,
 fontWeight: "600" as const,
 color: Colors.textSecondary,
 },
 heroPlaceholderSub: {
 fontSize: 13,
 color: Colors.textTertiary,
 },
 cameraBadge: {
 position: "absolute" as const,
 bottom: 14,
 right: 14,
 width: 38,
 height: 38,
 borderRadius: 19,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 shadowColor: "#000",
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.2,
 shadowRadius: 4,
 elevation: 3,
 },

 // Identity block
 identityBlock: {
 alignItems: "center" as const,
 paddingVertical: 20,
 paddingHorizontal: 20,
 gap: 10,
 },
 identityRow: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 gap: 16,
 },
 identityTag: { alignItems: "center" as const },
 identityTagLabel: {
 fontSize: 11,
 fontWeight: "800" as const,
 color: Colors.textTertiary,
 letterSpacing: 1,
 marginBottom: 2,
 },
 identityTagValue: {
 fontSize: 26,
 fontWeight: "800" as const,
 color: Colors.text,
 letterSpacing: -0.5,
 },
 identityArrow: {
 fontSize: 22,
 color: Colors.textTertiary,
 fontWeight: "300" as const,
 marginTop: 12,
 },
 identityDate: {
 fontSize: 15,
 color: Colors.textSecondary,
 fontWeight: "600" as const,
 },
 listBadge: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 gap: 6,
 backgroundColor: Colors.surface,
 paddingHorizontal: 12,
 paddingVertical: 6,
 borderRadius: 12,
 borderWidth: 1,
 borderColor: Colors.borderLight,
 },
 listBadgeDot: { width: 8, height: 8, borderRadius: 4 },
 listBadgeName: { fontSize: 13, fontWeight: "600" as const, color: Colors.textSecondary },

 // Sections
 section: { paddingHorizontal: 16, marginBottom: 20 },
 sectionTitle: {
 fontSize: 13,
 fontWeight: "800" as const,
 color: Colors.textSecondary,
 textTransform: "uppercase" as const,
 letterSpacing: 1.1,
 marginBottom: 10,
 marginLeft: 2,
 },
 card: {
 backgroundColor: Colors.surface,
 borderRadius: 16,
 borderWidth: 1,
 borderColor: Colors.borderLight,
 overflow: "hidden" as const,
 },
 divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

 // Field rows
 fieldRow: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 justifyContent: "space-between" as const,
 paddingHorizontal: 16,
 paddingVertical: 14,
 gap: 12,
 },
 fieldInfo: { flex: 1 },
 fieldLabel: {
 fontSize: 11,
 fontWeight: "700" as const,
 color: Colors.textTertiary,
 textTransform: "uppercase" as const,
 letterSpacing: 0.8,
 marginBottom: 3,
 },
 fieldValue: { fontSize: 16, fontWeight: "600" as const, color: Colors.text },
 fieldEmpty: { color: Colors.textTertiary, fontStyle: "italic" as const, fontWeight: "400" as const },

 // Editing
 fieldEditing: { paddingHorizontal: 16, paddingVertical: 12 },
 fieldEditRow: {
 flexDirection: "row" as const,
 alignItems: "flex-start" as const,
 gap: 10,
 marginTop: 6,
 },
 fieldInput: {
 flex: 1,
 fontSize: 16,
 fontWeight: "600" as const,
 color: Colors.text,
 backgroundColor: Colors.backgroundDark,
 borderRadius: 10,
 paddingHorizontal: 12,
 paddingVertical: 10,
 borderWidth: 1.5,
 borderColor: Colors.primary,
 },
 fieldInputMulti: { minHeight: 90, textAlignVertical: "top" as const },
 fieldEditBtns: { flexDirection: "column" as const, gap: 6 },
 fieldSaveBtn: {
 width: 36,
 height: 36,
 borderRadius: 10,
 backgroundColor: Colors.primary,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 },
 fieldCancelBtn: {
 width: 36,
 height: 36,
 borderRadius: 10,
 backgroundColor: Colors.surface,
 borderWidth: 1,
 borderColor: Colors.border,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 },

 // Date spinners
 dateSpinners: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 gap: 4,
 },
 spinner: { alignItems: "center" as const },
 spinnerBtn: { paddingHorizontal: 10, paddingVertical: 4 },
 spinnerArrow: {
 fontSize: 12,
 color: Colors.primary,
 fontWeight: "700" as const,
 },
 spinnerValue: {
 fontSize: 15,
 fontWeight: "800" as const,
 color: Colors.text,
 minWidth: 36,
 textAlign: "center" as const,
 },
 spinnerSep: {
 fontSize: 16,
 color: Colors.textTertiary,
 marginHorizontal: 2,
 },

 // Calf type
 calfTypeRow: {
 flexDirection: "row" as const,
 gap: 8,
 paddingHorizontal: 16,
 paddingBottom: 14,
 },
 calfTypeBtn: {
 flex: 1,
 paddingVertical: 10,
 borderRadius: 10,
 borderWidth: 1.5,
 borderColor: Colors.border,
 backgroundColor: Colors.backgroundDark,
 alignItems: "center" as const,
 },
 calfTypeBtnText: {
 fontSize: 14,
 fontWeight: "700" as const,
 color: Colors.textSecondary,
 },

 // Weight unit toggle
 unitToggle: {
 flexDirection: "row" as const,
 borderRadius: 8,
 overflow: "hidden" as const,
 borderWidth: 1,
 borderColor: Colors.border,
 },
 unitBtn: { paddingHorizontal: 14, paddingVertical: 8 },
 unitBtnActive: { backgroundColor: Colors.primary },
 unitBtnText: { fontSize: 13, fontWeight: "700" as const, color: Colors.textSecondary },
 unitBtnTextActive: { color: "#fff" },

 // Linked animal
 linkedCard: {
 flexDirection: "row" as const,
 alignItems: "center" as const,
 backgroundColor: Colors.surface,
 borderRadius: 14,
 padding: 14,
 gap: 12,
 borderWidth: 1,
 borderColor: Colors.borderLight,
 },
 linkedIcon: {
 width: 46,
 height: 46,
 borderRadius: 12,
 backgroundColor: Colors.backgroundDark,
 alignItems: "center" as const,
 justifyContent: "center" as const,
 },
 linkedInfo: { flex: 1 },
 linkedTag: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
 linkedSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

 // Meta
 meta: {
 paddingHorizontal: 16,
 paddingTop: 8,
 alignItems: "center" as const,
 gap: 3,
 },
 metaText: { fontSize: 12, color: Colors.textTertiary, fontWeight: "500" as const },
 });
}
