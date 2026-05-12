import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  Camera,
  Check,
  X,
  Trash2,
  ChevronRight,
  ImageIcon,
  Edit3,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { CalvingRecord } from "@/types";

type CalfType = "heifer" | "steer" | "bull";

const CALF_TYPE_CONFIG: Record<CalfType, { label: string; emoji: string; color: string; bg: string }> = {
  heifer: { label: "Heifer", emoji: "🐄", color: "#2D7A9C", bg: "#2D7A9C18" },
  steer: { label: "Steer", emoji: "🐂", color: "#7B5EA7", bg: "#7B5EA718" },
  bull: { label: "Bull", emoji: "🐃", color: "#C4622D", bg: "#C4622D18" },
};

// ─── Inline editable field ────────────────────────────────────────────────────

function InlineField({
  label,
  value,
  placeholder,
  onSave,
  multiline,
  keyboardType,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  onSave: (val: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "numbers-and-punctuation";
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>(value ?? "");

  const startEdit = useCallback(() => {
    setDraft(value ?? "");
    setEditing(true);
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [value]);

  const confirm = useCallback(() => {
    onSave(draft.trim());
    setEditing(false);
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [draft, onSave]);

  const cancel = useCallback(() => {
    setDraft(value ?? "");
    setEditing(false);
  }, [value]);

  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor={Colors.textTertiary}
            style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
            autoFocus
            multiline={multiline}
            keyboardType={keyboardType ?? "default"}
            autoCapitalize={keyboardType ? "none" : "sentences"}
          />
          <TouchableOpacity onPress={confirm} style={[styles.iconBtn, styles.iconBtnConfirm]}>
            <Check size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={cancel} style={[styles.iconBtn, styles.iconBtnCancel]}>
            <X size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={startEdit} activeOpacity={0.7} style={styles.fieldValueRow}>
          <Text
            style={[styles.fieldValue, !value && styles.fieldPlaceholder]}
            numberOfLines={multiline ? 0 : 1}
          >
            {value && value.length > 0 ? value : placeholder ?? "Tap to add"}
          </Text>
          <Edit3 size={14} color={Colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CalvingRecordScreen() {
  const Colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    getCalvingRecordById,
    getCalvingListById,
    getAnimalById,
    updateCalvingRecord,
    deleteCalvingRecord,
    calvingRecords,
  } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const record = useMemo(
    () => getCalvingRecordById(id ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, calvingRecords.length, getCalvingRecordById],
  );

  const list = useMemo(
    () => (record ? getCalvingListById(record.calvingListId) : undefined),
    [record, getCalvingListById],
  );

  const linkedCalf = useMemo(
    () => (record?.calfId ? getAnimalById(record.calfId) : undefined),
    [record?.calfId, getAnimalById],
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);

  const patchRecord = useCallback(
    async (patch: Partial<CalvingRecord>) => {
      if (!record) return;
      setIsSaving(true);
      try {
        await updateCalvingRecord({ ...record, ...patch });
      } catch (e) {
        Alert.alert("Error", "Could not save change. Please try again.");
      } finally {
        setIsSaving(false);
      }
    },
    [record, updateCalvingRecord],
  );

  const handleDelete = useCallback(() => {
    if (!record) return;
    Alert.alert(
      "Delete Record",
      `Delete calving record for cow ${record.cowTag} → calf ${record.calfTag}?`,
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

  const handlePickPhoto = useCallback(async () => {
    if (!record) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Add Photo", "Choose a photo source", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Take Photo",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission needed", "Camera access is required.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
          });
          if (!result.canceled && result.assets[0]?.uri) {
            void patchRecord({ photoUrl: result.assets[0].uri });
          }
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission needed", "Photo library access is required.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
          });
          if (!result.canceled && result.assets[0]?.uri) {
            void patchRecord({ photoUrl: result.assets[0].uri });
          }
        },
      },
    ]);
  }, [record, patchRecord]);

  const handleRemovePhoto = useCallback(() => {
    Alert.alert("Remove Photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void patchRecord({ photoUrl: undefined }),
      },
    ]);
  }, [patchRecord]);

  const handleSelectType = useCallback(
    (type: CalfType) => {
      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void patchRecord({ calfType: type });
    },
    [patchRecord],
  );

  if (!record) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Record not found</Text>
      </View>
    );
  }

  const cfg = CALF_TYPE_CONFIG[record.calfType] ?? CALF_TYPE_CONFIG.bull;
  const formattedDate = (() => {
    try {
      return new Date(record.date + "T12:00:00").toLocaleDateString([], {
        weekday: "short",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return record.date;
    }
  })();

  return (
    <>
      <Stack.Screen
        options={{
          title: "Calving Record",
          headerRight: () => (
            <View style={styles.headerActions}>
              {isSaving ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
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

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Photo ── */}
          <TouchableOpacity
            style={styles.photoWrap}
            onPress={handlePickPhoto}
            activeOpacity={0.85}
          >
            {record.photoUrl ? (
              <Image source={{ uri: record.photoUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <ImageIcon size={36} color={Colors.textTertiary} />
                <Text style={styles.photoPlaceholderText}>Tap to add photo</Text>
              </View>
            )}
            <View style={styles.cameraBtn}>
              <Camera size={18} color="#fff" />
            </View>
            {record.photoUrl ? (
              <TouchableOpacity style={styles.removePhotoBtn} onPress={handleRemovePhoto}>
                <X size={16} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.dateText}>{formattedDate}</Text>
            <View style={styles.headerBadges}>
              <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
                <Text style={styles.typeEmoji}>{cfg.emoji}</Text>
                <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
              {list ? (
                <View style={styles.listBadge}>
                  <View style={[styles.listBadgeDot, { backgroundColor: list.color }]} />
                  <Text style={styles.listBadgeText} numberOfLines={1}>
                    {list.name}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── Calf type switcher ── */}
          <Text style={styles.sectionTitle}>Calf Type</Text>
          <View style={styles.typeRow}>
            {(["heifer", "steer", "bull"] as CalfType[]).map((type) => {
              const tcfg = CALF_TYPE_CONFIG[type];
              const selected = record.calfType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeBtn,
                    selected && { backgroundColor: tcfg.color, borderColor: tcfg.color },
                  ]}
                  onPress={() => handleSelectType(type)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.typeBtnEmoji}>{tcfg.emoji}</Text>
                  <Text style={[styles.typeBtnText, selected && { color: "#fff" }]}>
                    {tcfg.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Core info ── */}
          <Text style={styles.sectionTitle}>Core Information</Text>
          <View style={styles.fieldGroup}>
            <InlineField
              label="Date"
              value={record.date}
              placeholder="YYYY-MM-DD"
              onSave={(v) => patchRecord({ date: v })}
              keyboardType="numbers-and-punctuation"
            />
            <InlineField
              label="Cow Tag"
              value={record.cowTag}
              placeholder="e.g. 214"
              onSave={(v) => patchRecord({ cowTag: v })}
            />
            <InlineField
              label="Calf Tag"
              value={record.calfTag}
              placeholder="e.g. 2026-01"
              onSave={(v) => patchRecord({ calfTag: v })}
            />
            <InlineField
              label="Calf Breed"
              value={record.calfBreed}
              placeholder="e.g. Angus"
              onSave={(v) => patchRecord({ calfBreed: v || undefined })}
            />
          </View>

          {/* ── Birth details ── */}
          <Text style={styles.sectionTitle}>Birth Details</Text>
          <View style={styles.fieldGroup}>
            <InlineField
              label="Birth Weight"
              value={record.birthWeight != null ? String(record.birthWeight) : ""}
              placeholder="e.g. 75"
              onSave={(v) => {
                const num = parseFloat(v);
                patchRecord({ birthWeight: isNaN(num) ? undefined : num });
              }}
              keyboardType="numeric"
            />

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Unit</Text>
              <View style={styles.unitToggleWrap}>
                {(["lbs", "kg"] as const).map((u) => {
                  const selected = (record.birthWeightUnit ?? "lbs") === u;
                  return (
                    <TouchableOpacity
                      key={u}
                      onPress={() => patchRecord({ birthWeightUnit: u })}
                      style={[
                        styles.unitBtn,
                        selected && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.unitBtnText, selected && { color: "#fff" }]}>{u}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Assisted Birth</Text>
              <Switch
                value={record.assisted ?? false}
                onValueChange={(val) => patchRecord({ assisted: val })}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.textInverse}
              />
            </View>
          </View>

          {/* ── Notes ── */}
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.fieldGroup}>
            <InlineField
              label="Cow Notes"
              value={record.cowNotes}
              placeholder="Any notes about the cow..."
              onSave={(v) => patchRecord({ cowNotes: v || undefined })}
              multiline
            />
            <InlineField
              label="Calf Notes"
              value={record.calfNotes}
              placeholder="Any notes about the calf..."
              onSave={(v) => patchRecord({ calfNotes: v || undefined })}
              multiline
            />
          </View>

          {/* ── Linked calf profile ── */}
          {linkedCalf ? (
            <>
              <Text style={styles.sectionTitle}>Linked Calf Profile</Text>
              <TouchableOpacity
                style={styles.linkedCard}
                onPress={() => {
                  if (Platform.OS !== "web")
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/animal/${linkedCalf.id}`);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.linkedIcon}>
                  <Text style={styles.linkedEmoji}>🐮</Text>
                </View>
                <View style={styles.linkedInfo}>
                  <Text style={styles.linkedTag}>{linkedCalf.tagId}</Text>
                  <Text style={styles.linkedMeta} numberOfLines={1}>
                    {linkedCalf.breed || "—"} · {linkedCalf.sex}
                  </Text>
                </View>
                <ChevronRight size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { paddingBottom: 20 },
    notFound: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: Colors.background,
    },
    notFoundText: { fontSize: 16, color: Colors.textSecondary },
    headerActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: 16 },

    // Photo
    photoWrap: {
      width: "100%",
      aspectRatio: 16 / 10,
      backgroundColor: Colors.backgroundDark,
      position: "relative" as const,
    },
    photo: { width: "100%", height: "100%" },
    photoPlaceholder: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
    },
    photoPlaceholderText: {
      fontSize: 13,
      color: Colors.textTertiary,
      fontWeight: "600" as const,
    },
    cameraBtn: {
      position: "absolute" as const,
      bottom: 14,
      right: 14,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    removePhotoBtn: {
      position: "absolute" as const,
      top: 14,
      right: 14,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },

    // Header
    header: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 8,
      alignItems: "flex-start" as const,
    },
    dateText: {
      fontSize: 14,
      color: Colors.textSecondary,
      fontWeight: "600" as const,
      marginBottom: 10,
    },
    headerBadges: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 8,
    },
    typeBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
    },
    typeEmoji: { fontSize: 16 },
    typeBadgeText: {
      fontSize: 13,
      fontWeight: "800" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    listBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      maxWidth: 220,
    },
    listBadgeDot: { width: 10, height: 10, borderRadius: 5 },
    listBadgeText: { fontSize: 13, fontWeight: "700" as const, color: Colors.text },

    // Sections
    sectionTitle: {
      fontSize: 13,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 1.1,
      marginTop: 24,
      marginBottom: 10,
      marginHorizontal: 20,
    },

    // Calf type
    typeRow: {
      flexDirection: "row" as const,
      gap: 10,
      paddingHorizontal: 20,
    },
    typeBtn: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: 16,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      gap: 4,
    },
    typeBtnEmoji: { fontSize: 24 },
    typeBtnText: {
      fontSize: 14,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
    },

    // Field group
    fieldGroup: {
      marginHorizontal: 20,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      overflow: "hidden" as const,
    },
    fieldRow: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "700" as const,
      color: Colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    fieldValueRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      gap: 12,
    },
    fieldValue: {
      flex: 1,
      fontSize: 16,
      color: Colors.text,
      fontWeight: "600" as const,
    },
    fieldPlaceholder: {
      color: Colors.textTertiary,
      fontWeight: "500" as const,
      fontStyle: "italic" as const,
    },
    editRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
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
    },
    fieldInputMultiline: {
      minHeight: 70,
      textAlignVertical: "top" as const,
      paddingTop: 10,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    iconBtnConfirm: { backgroundColor: Colors.primary },
    iconBtnCancel: { backgroundColor: Colors.backgroundDark },

    // Unit toggle
    unitToggleWrap: {
      flexDirection: "row" as const,
      gap: 8,
    },
    unitBtn: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    unitBtnText: {
      fontSize: 14,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
    },

    // Linked card
    linkedCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      marginHorizontal: 20,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    linkedIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: Colors.backgroundDark,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    linkedEmoji: { fontSize: 24 },
    linkedInfo: { flex: 1 },
    linkedTag: {
      fontSize: 17,
      fontWeight: "800" as const,
      color: Colors.text,
    },
    linkedMeta: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 2,
      fontWeight: "500" as const,
    },
  });
}
