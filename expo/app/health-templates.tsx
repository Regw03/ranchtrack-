import React, { useCallback, useRef, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import {
  Syringe,
  Droplet,
  Pill,
  ClipboardCheck,
  Tag,
  Plus,
  Trash2,
  X,
  Check,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useHealth, HEALTH_EVENT_TYPE_CONFIG } from "@/providers/HealthProvider";
import { HealthEventTemplate, HealthEventType } from "@/types";

const EVENT_TYPE_ICONS: Record<HealthEventType, React.ComponentType<{ size: number; color: string }>> = {
  vaccination: Syringe,
  blood_test: Droplet,
  treatment: Pill,
  inspection: ClipboardCheck,
  custom: Tag,
};

const EVENT_TYPES: HealthEventType[] = ["vaccination", "blood_test", "treatment", "inspection", "custom"];

function TemplateCard({ template, onDelete }: { template: HealthEventTemplate; onDelete: (id: string) => void }) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const config = HEALTH_EVENT_TYPE_CONFIG[template.type];
  const Icon = EVENT_TYPE_ICONS[template.type];

  const handleDelete = useCallback(() => {
    Alert.alert("Delete Template", `Remove "${template.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(template.id) },
    ]);
  }, [template, onDelete]);

  return (
    <Animated.View style={[styles.templateCard, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.templateCardInner}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        onLongPress={handleDelete}
        activeOpacity={1}
      >
        <View style={[styles.templateIcon, { backgroundColor: config.color + "18" }]}>
          <Icon size={18} color={config.color} />
        </View>
        <View style={styles.templateInfo}>
          <Text style={styles.templateName}>{template.name}</Text>
          <Text style={styles.templateType}>{template.customTypeName || config.label}</Text>
          {template.suggestedIntervalDays ? (
            <Text style={styles.templateInterval}>Every {template.suggestedIntervalDays} days</Text>
          ) : null}
          {template.notes ? <Text style={styles.templateNotes} numberOfLines={1}>{template.notes}</Text> : null}
        </View>
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Trash2 size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HealthTemplatesScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { templates, createTemplate, deleteTemplate } = useHealth();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState<HealthEventType>("vaccination");
  const [customTypeName, setCustomTypeName] = useState("");
  const [intervalDays, setIntervalDays] = useState("");
  const [notes, setNotes] = useState("");

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Enter a template name");
      return;
    }
    try {
      await createTemplate({
        name: name.trim(),
        type: selectedType,
        customTypeName: selectedType === "custom" ? customTypeName.trim() || undefined : undefined,
        suggestedIntervalDays: intervalDays ? parseInt(intervalDays, 10) : undefined,
        notes: notes.trim(),
      });
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName("");
      setCustomTypeName("");
      setIntervalDays("");
      setNotes("");
      setShowForm(false);
    } catch (e) {
      console.log("Error creating template:", e);
    }
  }, [name, selectedType, customTypeName, intervalDays, notes, createTemplate]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteTemplate(id);
    } catch (e) {
      console.log("Error deleting template:", e);
    }
  }, [deleteTemplate]);

  const renderItem = useCallback(
    ({ item }: { item: HealthEventTemplate }) => (
      <TemplateCard template={item} onDelete={handleDelete} />
    ),
    [handleDelete],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Health Templates" }} />

      {showForm ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.formContainer}
        >
          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>New Template</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <X size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Annual Brucellosis Test"
              placeholderTextColor={Colors.textTertiary}
              testID="template-name-input"
            />

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((type) => {
                const config = HEALTH_EVENT_TYPE_CONFIG[type];
                const Icon = EVENT_TYPE_ICONS[type];
                const isSelected = selectedType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, isSelected && { backgroundColor: config.color + "20", borderColor: config.color }]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Icon size={14} color={isSelected ? config.color : Colors.textTertiary} />
                    <Text style={[styles.typeChipText, isSelected && { color: config.color }]}>
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedType === "custom" && (
              <>
                <Text style={styles.fieldLabel}>Custom Type Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={customTypeName}
                  onChangeText={setCustomTypeName}
                  placeholder="e.g. Deworming"
                  placeholderTextColor={Colors.textTertiary}
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Suggested Interval (days, optional)</Text>
            <TextInput
              style={styles.textInput}
              value={intervalDays}
              onChangeText={setIntervalDays}
              placeholder="e.g. 365"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional details..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} testID="save-template-btn">
              <Check size={18} color={Colors.textInverse} />
              <Text style={styles.saveBtnText}>Save Template</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <>
          <FlatList
            data={templates}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.listHeaderWrap}>
                <Text style={styles.sectionTitle}>Saved Templates</Text>
                <Text style={styles.sectionDesc}>
                  Create reusable templates for common health events. Long-press to delete.
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyTitle}>No templates yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create templates for vaccinations, tests, and other recurring events
                </Text>
              </View>
            }
          />
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowForm(true);
            }}
            activeOpacity={0.85}
            testID="add-template-fab"
          >
            <Plus size={24} color={Colors.textInverse} />
            <Text style={styles.fabLabel}>New Template</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 100,
  },
  listHeaderWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  sectionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  templateCard: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  templateCardInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  templateType: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  templateInterval: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 2,
  },
  templateNotes: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  formContainer: {
    flex: 1,
  },
  formScroll: {
    padding: 20,
    paddingBottom: 40,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    marginTop: 16,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top" as const,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    gap: 5,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
    gap: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.textInverse,
  },
  empty: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center" as const,
    marginTop: 6,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  fabLabel: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.textInverse,
  },
});
