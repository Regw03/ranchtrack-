import React, { useCallback, useMemo, useState, useEffect } from "react";
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
  Edit3,
  Check,
  X,
  Trash2,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react-native";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { CalvingRecord } from "@/types";

const TYPE_CONFIG = {
  heifer: { label: "Heifer", emoji: "🐄", color: "#2D7A9C", bg: "#2D7A9C18" },
  steer: { label: "Steer", emoji: "🐂", color: "#7B5EA7", bg: "#7B5EA718" },
  bull: { label: "Bull", emoji: "🐃", color: "#C4622D", bg: "#C4622D18" },
};

type CalfType = "heifer" | "steer" | "bull";

function EditableField({
  label,
  value,
  onSave,
  placeholder,
  keyboardType = "default",
  multiline = false,
}: {
  label: string;
  value: string;
  onSave: (val: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "numbers-and-punctuation";
  multiline?: boolean;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

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
            returnKeyType={multiline ? "default" : "done"}
            onSubmitEditing={multiline ? undefined : handleSave}
            placeholder={placeholder}
            placeholderTextColor={Colors.textTertiary}
          />
          <View style={styles.fieldEditActions}>
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
        <Text style={[styles.fieldValue, !value && styles.fieldValueEmpty]}>
          {value || placeholder || "Tap to add"}
        </Text>
      </View>
      <Edit3 size={15} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

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

  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleUpdate = useCallback(
    async (patch: Partial<CalvingRecord>) => {
      if (!record) return;
      setIsSaving(true);
      try {
        await updateCalvingRecord({ ...record, ...patch });
      } catch (e) {
        console.log("[calving-record] update failed", e);
        Alert.alert("Error", "Could not save. Please try again.");
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
      `Delete calving record for cow ${record.cowTag} → calf ${record.calfTag}? This cannot be undone.`,
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

    Alert.alert("Photo", "Choose an option", [
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
            quality: 0.8,
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
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            await handleUpdate({ photoUrl: result.assets[0].uri });
          }
        },
      },
      ...(record.photoUrl
        ? [
            {
              text: "Remove Photo",
              style: "destructive" as const,
              onPress: async () => handleUpdate({ photoUrl: undefined }),
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }, [record, handleUpdate]);

  const handleTypeChange = useCallback(
    (type: CalfType) => {
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

  const cfg = TYPE_CONFIG[record.calfType] ?? TYPE_CONFIG.bull;

  const formattedDate = (() => {
    try {
      return new Date(record.date + "T12:00:00").toLocaleDateString([], {
        weekday: "long",
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
          title: `Cow ${record.cowTag} → Calf ${record.calfTag}`,
          headerRight: () => (
            <View style={styles.headerActions}>
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
        <TouchableOpacity
          style={styles.photoArea}
          onPress={handlePhotoPress}
          activeOpacity={0.85}
        >
          {record.photoUrl ? (
            <Image source={{ uri: record.photoUrl }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <ImageIcon size={32} color={Colors.textTertiary} />
              <Text style={styles.photoPlaceholderText}>Tap to add photo</Text>
            </View>
          )}
          <View style={styles.photoCameraBtn}>
            <Camera size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.heroSection}>
          <Text style={styles.heroDate}>{formattedDate}</Text>
          <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
            <Text style={styles.typeEmoji}>{cfg.emoji}</Text>
            <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          {list && (
            <View style={styles.listBadge}>
              <View style={[styles.listBadgeDot, { backgroundColor: list.color }]} />
              <Text style={styles.listBadgeText}>{list.name}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calf Type</Text>
          <View style={styles.typeRow}>
            {(["heifer", "steer", "bull"] as CalfType[]).map((type) => {
              const c = TYPE_CONFIG[type];
              const selected = record.calfType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeBtn,
                    selected && { backgroundColor: c.color, borderColor: c.color },
                  ]}
                  onPress={() => handleTypeChange(type)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.typeBtnEmoji}>{c.emoji}</Text>
                  <Text style={[styles.typeBtnLabel, selected && { color: "#fff" }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Core Information</Text>
          <View style={styles.card}>
            <EditableField
              label="Date"
              value={record.date}
              onSave={(v) => handleUpdate({ date: v })}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.divider} />
            <EditableField
              label="Cow Tag #"
              value={record.cowTag}
              onSave={(v) => handleUpdate({ cowTag: v })}
              placeholder="Enter cow tag"
            />
            <View style={styles.divider} />
            <EditableField
              label="Calf Tag #"
              value={record.calfTag}
              onSave={(v) => handleUpdate({ calfTag: v })}
              placeholder="Enter calf tag"
            />
            <View style={styles.divider} />
            <EditableField
              label="Calf Breed"
              value={record.calfBreed ?? ""}
              onSave={(v) => handleUpdate({ calfBreed: v })}
              placeholder="e.g. Angus, Hereford"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Birth Details</Text>
          <View style={styles.card}>
            <EditableField
              label="Birth Weight"
              value={record.birthWeight ? String(record.birthWeight) : ""}
              onSave={(v) => handleUpdate({ birthWeight: v ? Number(v) : undefined })}
              placeholder="e.g. 82"
              keyboardType="numeric"
            />
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
                  <Text
                    style={[
                      styles.unitBtnText,
                      (record.birthWeightUnit ?? "lbs") === "lbs" && styles.unitBtnTextActive,
                    ]}
                  >
                    lbs
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.unitBtn,
                    record.birthWeightUnit === "kg" && styles.unitBtnActive,
                  ]}
                  onPress={() => handleUpdate({ birthWeightUnit: "kg" })}
                >
                  <Text
                    style={[
                      styles.unitBtnText,
                      record.birthWeightUnit === "kg" && styles.unitBtnTextActive,
                    ]}
                  >
                    kg
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.fieldRow}>
              <View style={styles.fieldInfo}>
                <Text style={styles.fieldLabel}>Assisted Birth</Text>
                <Text style={styles.fieldValue}>
                  {record.assisted ? "Yes — assistance was needed" : "No — unassisted"}
                </Text>
              </View>
              <Switch
                value={record.assisted ?? false}
                onValueChange={(v) => handleUpdate({ assisted: v })}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.textInverse}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.card}>
            <EditableField
              label="Cow Notes"
              value={record.cowNotes ?? ""}
              onSave={(v) => handleUpdate({ cowNotes: v })}
              placeholder="Any notes about the cow during this event"
              multiline
            />
            <View style={styles.divider} />
            <EditableField
              label="Calf Notes"
              value={record.calfNotes ?? ""}
              onSave={(v) => handleUpdate({ calfNotes: v })}
              placeholder="Any notes about the calf"
              multiline
            />
          </View>
        </View>

        {calfAnimal && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Linked Calf Profile</Text>
            <TouchableOpacity
              style={styles.linkedCard}
              onPress={() => router.push(`/animal/${calfAnimal.id}`)}
              activeOpacity={0.75}
            >
              <View style={styles.linkedIcon}>
                <Text style={styles.linkedEmoji}>🐮</Text>
              </View>
              <View style={styles.linkedInfo}>
                <Text style={styles.linkedTag}>{calfAnimal.tagId}</Text>
                <Text style={styles.linkedSubtitle}>
                  {calfAnimal.breed || "Unknown breed"} · Tap to open profile
                </Text>
              </View>
              <ChevronRight size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

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

        <View style={styles.bottomSpace} />
      </ScrollView>
    </>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { paddingBottom: 40 },
    notFound: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const },
    notFoundText: { fontSize: 16, color: Colors.textSecondary },
    headerActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: 14 },

    photoArea: {
      height: 200,
      backgroundColor: Colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      position: "relative" as const,
    },
    photo: { width: "100%" as const, height: "100%" as const },
    photoPlaceholder: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
    },
    photoPlaceholderText: { fontSize: 14, color: Colors.textTertiary, fontWeight: "500" as const },
    photoCameraBtn: {
      position: "absolute" as const,
      bottom: 12,
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },

    heroSection: {
      alignItems: "center" as const,
      paddingTop: 20,
      paddingBottom: 16,
      paddingHorizontal: 20,
      gap: 10,
    },
    heroDate: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: Colors.text,
      textAlign: "center" as const,
    },
    typeBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
    },
    typeEmoji: { fontSize: 18 },
    typeBadgeText: { fontSize: 15, fontWeight: "800" as const },
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
    listBadgeText: { fontSize: 13, fontWeight: "600" as const, color: Colors.textSecondary },

    typeRow: {
      flexDirection: "row" as const,
      gap: 10,
    },
    typeBtn: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
      gap: 4,
    },
    typeBtnEmoji: { fontSize: 22 },
    typeBtnLabel: {
      fontSize: 13,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
    },

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
    fieldValueEmpty: { color: Colors.textTertiary, fontStyle: "italic" as const },

    fieldEditing: { paddingHorizontal: 16, paddingVertical: 12 },
    fieldEditRow: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 10, marginTop: 6 },
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
    fieldInputMulti: { minHeight: 80, textAlignVertical: "top" as const },
    fieldEditActions: { flexDirection: "column" as const, gap: 6 },
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

    unitToggle: { flexDirection: "row" as const, borderRadius: 8, overflow: "hidden" as const, borderWidth: 1, borderColor: Colors.border },
    unitBtn: { paddingHorizontal: 14, paddingVertical: 8 },
    unitBtnActive: { backgroundColor: Colors.primary },
    unitBtnText: { fontSize: 13, fontWeight: "700" as const, color: Colors.textSecondary },
    unitBtnTextActive: { color: "#fff" },

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
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: Colors.backgroundDark,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    linkedEmoji: { fontSize: 22 },
    linkedInfo: { flex: 1 },
    linkedTag: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
    linkedSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

    meta: {
      paddingHorizontal: 16,
      paddingTop: 8,
      gap: 4,
      alignItems: "center" as const,
    },
    metaText: { fontSize: 12, color: Colors.textTertiary, fontWeight: "500" as const },
    bottomSpace: { height: 40 },
  });
}
