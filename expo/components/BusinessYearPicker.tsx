import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Animated,
  Platform,
} from "react-native";
import { ChevronDown, Plus, Check, Calendar } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { BusinessYear } from "@/types";

export default function BusinessYearPicker() {
  const Colors = useColors();
  const { businessYears, activeBusinessYear, setActiveBusinessYear, createBusinessYear } = useRanch();
  const [showPicker, setShowPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handleSelect = useCallback(async (year: BusinessYear) => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setActiveBusinessYear(year.id);
    setShowPicker(false);
  }, [setActiveBusinessYear]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await createBusinessYear({
      name: newName.trim(),
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
      isActive: true,
    });
    setNewName("");
    setShowCreate(false);
    setShowPicker(false);
  }, [newName, createBusinessYear]);

  return (
    <>
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowPicker(true)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          testID="business-year-picker"
        >
          <Calendar size={14} color={Colors.primary} />
          <Text style={styles.yearText} numberOfLines={1}>{activeBusinessYear.name}</Text>
          <ChevronDown size={14} color={Colors.textTertiary} />
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { setShowPicker(false); setShowCreate(false); }}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>Business Year</Text>
            <FlatList
              data={businessYears}
              keyExtractor={(item) => item.id}
              style={styles.yearList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.yearOption, item.id === activeBusinessYear.id && styles.yearOptionActive]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.yearOptionText, item.id === activeBusinessYear.id && styles.yearOptionTextActive]}>{item.name}</Text>
                  {item.id === activeBusinessYear.id && <Check size={16} color={Colors.primary} />}
                </TouchableOpacity>
              )}
            />
            {showCreate ? (
              <View style={styles.createForm}>
                <TextInput
                  style={styles.createInput}
                  placeholder="e.g. Fall Calving 2026"
                  placeholderTextColor={Colors.textTertiary}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
                <TouchableOpacity style={[styles.createBtn, !newName.trim() && styles.createBtnDisabled]} onPress={handleCreate} disabled={!newName.trim()}>
                  <Text style={styles.createBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addYearBtn} onPress={() => setShowCreate(true)} activeOpacity={0.7}>
                <Plus size={16} color={Colors.primary} />
                <Text style={styles.addYearText}>New Business Year</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { alignSelf: "flex-start", flexShrink: 1, maxWidth: "100%" as unknown as number },
  picker: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.primary + "0D", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, gap: 6, flexShrink: 1 },
  yearText: { fontSize: 13, fontWeight: "700" as const, color: Colors.primary, flexShrink: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-start", paddingTop: 120, paddingHorizontal: 24 },
  dropdown: { backgroundColor: Colors.surface, borderRadius: 18, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10, maxHeight: 400 },
  dropdownTitle: { fontSize: 15, fontWeight: "800" as const, color: Colors.text, marginBottom: 12, letterSpacing: -0.2 },
  yearList: { maxHeight: 240 },
  yearOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 4 },
  yearOptionActive: { backgroundColor: Colors.primary + "0D" },
  yearOptionText: { fontSize: 15, fontWeight: "600" as const, color: Colors.text },
  yearOptionTextActive: { color: Colors.primary, fontWeight: "700" as const },
  addYearBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: 4 },
  addYearText: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
  createForm: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: 4 },
  createInput: { flex: 1, backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.text },
  createBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { fontSize: 14, fontWeight: "700" as const, color: Colors.textInverse },
});
