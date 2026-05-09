import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
  RefreshControl,
} from "react-native";
import {
  Copy,
  ChevronRight,
  Shield,
  Bell,
  Database,
  HelpCircle,
  LogOut,
  Smartphone,
  Moon,
  Sun,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { useOnboarding } from "@/providers/OnboardingProvider";
import { getInitials } from "@/utils/helpers";
import { signOut } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const AUTH_STORAGE_KEY = "ranchtrack_auth_user_id";

export default function SettingsScreen() {
  const Colors = useColors();
  const { isDark, toggleTheme } = useTheme();
  const { ranch, currentUserId, resetApp, refreshRanch, isRefreshingRanch } = useRanch();
  const { resetOnboarding } = useOnboarding();
  const router = useRouter();
  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);

  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await refreshRanch();
    } catch (e) {
      console.log("[settings] refresh failed", e);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refreshRanch]);
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const ROLE_LABELS: Record<string, string> = {
    owner: "Owner",
    manager: "Manager",
    worker: "Worker",
  };

  const ROLE_COLORS: Record<string, string> = {
    owner: Colors.accent,
    manager: Colors.primary,
    worker: Colors.textSecondary,
  };

  const handleCopyInvite = useCallback(() => {
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert("Invite Code Copied", `Code: ${ranch.inviteCode}`);
  }, [ranch.inviteCode]);

  const handleToggleDarkMode = useCallback(() => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    toggleTheme();
  }, [toggleTheme]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? You can sign back in anytime with your email and password.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              if (Platform.OS !== "web") {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }

              await signOut();

              await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
              await AsyncStorage.removeItem("ranchtrack_current_user_id");
              await AsyncStorage.removeItem("ranchtrack_pending_user_name");
              await AsyncStorage.removeItem("ranchtrack_auth_intent");

              await resetApp();
              await resetOnboarding();

              router.replace("/onboarding/welcome");
            } catch (e) {
              const message =
                e instanceof Error ? e.message : "Something went wrong signing out.";
              Alert.alert("Sign Out Failed", message);
            }
          },
        },
      ],
    );
  }, [resetApp, resetOnboarding, router]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isManualRefreshing || isRefreshingRanch}
          onRefresh={handleRefresh}
          tintColor={Colors.primary}
          title="Checking for new members..."
          titleColor={Colors.textSecondary}
        />
      }
    >
      <View style={styles.ranchHeader}>
        <View style={styles.ranchIcon}>
          <Text style={styles.ranchIconText}>🏜️</Text>
        </View>
        <Text style={styles.ranchName}>{ranch.name}</Text>
        <Text style={styles.ranchMembers}>
          {ranch.members.length} team members
        </Text>
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
            <Text style={styles.themeSubtitle}>
              {isDark ? "On" : "Off"}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={handleToggleDarkMode}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={isDark ? Colors.textInverse : Colors.textInverse}
            testID="dark-mode-toggle"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invite Code</Text>
        <TouchableOpacity
          style={styles.inviteCard}
          onPress={handleCopyInvite}
          activeOpacity={0.7}
        >
          <View style={styles.inviteCodeContainer}>
            <Text style={styles.inviteCode}>{ranch.inviteCode}</Text>
          </View>
          <View style={styles.inviteCopyBtn}>
            <Copy size={18} color={Colors.primary} />
            <Text style={styles.inviteCopyText}>Copy</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Team Members</Text>
        {ranch.members.map((member) => {
          const isCurrentUser = member.userId === currentUserId;
          return (
            <View key={member.userId} style={styles.memberCard}>
              <View
                style={[
                  styles.memberAvatar,
                  {
                    backgroundColor:
                      ROLE_COLORS[member.role] || Colors.textSecondary,
                  },
                ]}
              >
                <Text style={styles.memberAvatarText}>
                  {getInitials(member.name)}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {isCurrentUser && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>You</Text>
                    </View>
                  )}
                </View>
                <View style={styles.roleBadge}>
                  <Shield
                    size={12}
                    color={ROLE_COLORS[member.role] || Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      {
                        color:
                          ROLE_COLORS[member.role] || Colors.textSecondary,
                      },
                    ]}
                  >
                    {ROLE_LABELS[member.role] || member.role}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
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

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.7}
      >
        <LogOut size={18} color={Colors.error} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

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
  ranchMembers: { fontSize: 15, color: Colors.textSecondary, marginTop: 5, fontWeight: "500" as const },
  section: { paddingHorizontal: 16, marginBottom: 28 },
  sectionTitle: { fontSize: 13, fontWeight: "800" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 12, marginLeft: 2 },
  themeCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  themeIconContainer: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.backgroundDark, alignItems: "center", justifyContent: "center" },
  themeContent: { flex: 1, marginLeft: 14 },
  themeLabel: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
  themeSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: "500" as const },
  inviteCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  inviteCodeContainer: { backgroundColor: Colors.backgroundDark, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  inviteCode: { fontSize: 19, fontWeight: "800" as const, color: Colors.primary, letterSpacing: 2.5 },
  inviteCopyBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  inviteCopyText: { fontSize: 15, fontWeight: "700" as const, color: Colors.primary },
  memberCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  memberAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  memberAvatarText: { fontSize: 16, fontWeight: "700" as const, color: Colors.textInverse },
  memberInfo: { flex: 1, marginLeft: 14 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberName: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
  youBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  youBadgeText: { fontSize: 11, fontWeight: "800" as const, color: Colors.textInverse },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  roleText: { fontSize: 13, fontWeight: "700" as const },
  settingsRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  settingsIconContainer: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.backgroundDark, alignItems: "center", justifyContent: "center" },
  settingsRowContent: { flex: 1, marginLeft: 14 },
  settingsRowLabel: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
  settingsRowSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: "500" as const },
  signOutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginHorizontal: 16, marginTop: 8, paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.surface, gap: 8, borderWidth: 1.5, borderColor: Colors.error },
  signOutText: { fontSize: 16, fontWeight: "700" as const, color: Colors.error },
  versionText: { textAlign: "center" as const, fontSize: 13, color: Colors.textTertiary, marginTop: 20, marginBottom: 20, fontWeight: "500" as const },
});
