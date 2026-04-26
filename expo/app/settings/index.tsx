import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
} from "react-native";
import {
  ChevronRight,
  Bell,
  Database,
  HelpCircle,
  Smartphone,
  Moon,
  Sun,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";

export default function SettingsScreen() {
  const Colors = useColors();
  const { isDark, toggleTheme } = useTheme();
  const { ranch } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const handleToggleDarkMode = useCallback(() => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    toggleTheme();
  }, [toggleTheme]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.ranchHeader}>
        <View style={styles.ranchIcon}>
          <Text style={styles.ranchIconText}>🏜️</Text>
        </View>
        <Text style={styles.ranchName}>{ranch.name || "Your Ranch"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.themeCard}>
          <View style={styles.themeIconContainer}>
            {isDark ? (
              <Moon size={20} color={Colors.primary} />
            ) : (
              <Sun size={20} color={Colors.primary} />
            )}
          </View>
          <View style={styles.themeContent}>
            <Text style={styles.themeLabel}>Dark Mode</Text>
            <Text style={styles.themeSubtitle}>{isDark ? "On" : "Off"}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={handleToggleDarkMode}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.textInverse}
            testID="dark-mode-toggle"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        {[
          { icon: Bell, label: "Notifications", subtitle: "Breeding & health alerts" },
          { icon: Database, label: "Data & Storage", subtitle: "Manage offline data" },
          { icon: Smartphone, label: "Sync Settings", subtitle: "Multi-device sync" },
          { icon: HelpCircle, label: "Help & Support", subtitle: "FAQs and contact" },
        ].map((item, idx) => (
          <TouchableOpacity key={idx} style={styles.settingsRow} activeOpacity={0.7}>
            <View style={styles.settingsIconContainer}>
              <item.icon size={20} color={Colors.primary} />
            </View>
            <View style={styles.settingsRowContent}>
              <Text style={styles.settingsRowLabel}>{item.label}</Text>
              <Text style={styles.settingsRowSubtitle}>{item.subtitle}</Text>
            </View>
            <ChevronRight size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.versionText}>RanchTrack v1.0.0</Text>
    </ScrollView>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  ranchHeader: { alignItems: "center", paddingTop: 28, paddingBottom: 32 },
  ranchIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: Colors.secondaryLight, alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 2, borderColor: Colors.border },
  ranchIconText: { fontSize: 34 },
  ranchName: { fontSize: 26, fontWeight: "800" as const, color: Colors.text, letterSpacing: -0.3 },
  section: { paddingHorizontal: 16, marginBottom: 28 },
  sectionTitle: { fontSize: 13, fontWeight: "800" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 12, marginLeft: 2 },
  themeCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  themeIconContainer: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.backgroundDark, alignItems: "center", justifyContent: "center" },
  themeContent: { flex: 1, marginLeft: 14 },
  themeLabel: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
  themeSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: "500" as const },
  settingsRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  settingsIconContainer: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.backgroundDark, alignItems: "center", justifyContent: "center" },
  settingsRowContent: { flex: 1, marginLeft: 14 },
  settingsRowLabel: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
  settingsRowSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: "500" as const },
  versionText: { textAlign: "center" as const, fontSize: 13, color: Colors.textTertiary, marginTop: 20, marginBottom: 20, fontWeight: "500" as const },
});
