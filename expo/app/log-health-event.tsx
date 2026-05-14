import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
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
  Check,
  ChevronDown,
  Fence,
  Heart,
  Users,
  FileText,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useHealth, HEALTH_EVENT_TYPE_CONFIG } from "@/providers/HealthProvider";
import { useRanch } from "@/providers/RanchProvider";
import { HealthEventType, HealthEventTarget, HealthEventTemplate } from "@/types";

const EVENT_TYPE_ICONS: Record<HealthEventType, React.ComponentType<{ size: number; color: string }>> = {
  vaccination: Syringe,
  blood_test: Droplet,
  treatment: Pill,
  inspection: ClipboardCheck,
  custom: Tag,
};

const EVENT_TYPES: HealthEventType[] = ["vaccination", "blood_test", "treatment", "inspection", "custom"];

export default function LogHealthEventScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { templates, createEvent } = useHealth();
  const { activeAnimals, breedingGroups, customLists } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [step, setStep] = useState<"template" | "details">("template");
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState<HealthEventType>("vaccination");
  const [customTypeName, setCustomTypeName] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [target, setTarget] = useState<HealthEventTarget | null>(null);
  const [notes, setNotes] = useState("");
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  const handleSelectTemplate = useCallback((template: HealthEventTemplate) => {
    setName(template.name);
    setSelectedType(template.type);
    setCustomTypeName(template.customTypeName ?? "");
    setNotes(template.notes);
    if (template.suggestedIntervalDays) {
      const d = new Date();
      d.setDate(d.getDate() + template.suggestedIntervalDays);
      setDueDate(d.toISOString().split("T")[0]);
    }
    setStep("details");
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSkipTemplate = useCallback(() => {
    setStep("details");
  }, []);

  const targetOptions = useMemo(() => {
    const options: HealthEventTarget[] = [
      { type: "herd", id: "entire-herd", name: `Entire Herd (${activeAnimals.length} head)` },
    ];
    breedingGroups.forEach((g) => {
      options.push({ type: "breeding_group", id: g.id, name: `Breeding: ${g.name}` });
    });
    customLists.forEach((l) => {
      options.push({ type: "custom_group", id: l.id, name: l.name });
    });
    return options;
  }, [activeAnimals.length, breedingGroups, customLists]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Enter an event name");
      return;
    }
    if (!target) {
      Alert.alert("Required", "Select a target group");
      return;
    }
    if (!dueDate) {
      Alert.alert("Required", "Enter a due date");
      return;
    }
    try {
      await createEvent({
        type: selectedType,
        customTypeName: selectedType === "custom" ? customTypeName.trim() || undefined : undefined,
        name: name.trim(),
        dueDate,
        target,
        exceptionAnimalIds: [],
        notes: notes.trim(),
      });
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.log("Error creating health event:", e);
      Alert.alert("Error", "Could not create health event");
    }
  }, [name, selectedType, customTypeName, dueDate, target, notes, createEvent, router]);

  if (step === "template") {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Log Health Event" }} />
        <ScrollView contentContainerStyle={styles.templateStep} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Start from a template?</Text>
          <Text style={styles.stepDesc}>
            Pick a saved template or start fresh
          </Text>

          {templates.length > 0 && (
            <View style={styles.templateList}>
              {templates.map((t) => {
                const config = HEALTH_EVENT_TYPE_CONFIG[t.type];
                const Icon = EVENT_TYPE_ICONS[t.type];
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.templateOption}
                    onPress={() => handleSelectTemplate(t)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.templateOptionIcon, { backgroundColor: config.color + "18" }]}>
                      <Icon size={16} color={config.color} />
                    </View>
                    <View style={styles.templateOptionInfo}>
                      <Text style={styles.templateOptionName}>{t.name}</Text>
                      <Text style={styles.templateOptionType}>{t.customTypeName || config.label}</Text>
                    </View>
                    <FileText size={14} color={Colors.textTertiary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkipTemplate}
            activeOpacity={0.7}
            testID="skip-template-btn"
          >
            <Text style={styles.skipBtnText}>Start from scratch</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Log Health Event" }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.fieldLabel}>Event Name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Spring Vaccination"
            placeholderTextColor={Colors.textTertiary}
            testID="event-name-input"
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

          <Text style={styles.fieldLabel}>Due Date</Text>
          <TextInput
            style={styles.textInput}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textTertiary}
            testID="event-date-input"
          />

          <Text style={styles.fieldLabel}>Apply To</Text>
          {showTargetPicker ? (
            <View style={styles.targetPicker}>
              {targetOptions.map((opt) => {
                const isSelected = target?.id === opt.id;
                const icon = opt.type === "herd" ? Fence
                  : opt.type === "breeding_group" ? Heart
                  : Users;
                const IconComponent = icon;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.targetOption, isSelected && styles.targetOptionSelected]}
                    onPress={() => {
                      setTarget(opt);
                      setShowTargetPicker(false);
                      if (Platform.OS !== "web") void Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <IconComponent size={16} color={isSelected ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.targetOptionText, isSelected && { color: Colors.primary, fontWeight: "700" as const }]}>
                      {opt.name}
                    </Text>
                    {isSelected && <Check size={16} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.targetSelector}
              onPress={() => setShowTargetPicker(true)}
              activeOpacity={0.7}
              testID="target-selector"
            >
              <Text style={[styles.targetSelectorText, !target && { color: Colors.textTertiary }]}>
                {target ? target.name : "Select group or herd..."}
              </Text>
              <ChevronDown size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}

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

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            activeOpacity={0.85}
            testID="save-event-btn"
          >
            <Check size={18} color={Colors.textInverse} />
            <Text style={styles.saveBtnText}>Schedule Event</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  templateStep: {
    padding: 20,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  stepDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  templateList: {
    gap: 8,
  },
  templateOption: {
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
  templateOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  templateOptionInfo: {
    flex: 1,
  },
  templateOptionName: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  templateOptionType: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  formScroll: {
    padding: 20,
    paddingBottom: 40,
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
  targetSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  targetSelectorText: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  targetPicker: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
  },
  targetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  targetOptionSelected: {
    backgroundColor: Colors.primary + "08",
  },
  targetOptionText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 28,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.textInverse,
  },
});
