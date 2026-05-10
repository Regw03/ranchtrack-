import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Modal,
  ActivityIndicator,
} from "react-native";
import {
  Copy,
  Shield,
  Bell,
  Database,
  HelpCircle,
  LogOut,
  Smartphone,
  Moon,
  Sun,
  X,
  RefreshCw,
  Trash2,
  CheckCircle,
  BellOff,
  Mail,
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
const NOTIF_BREEDING_KEY = "ranchtrack_notif_breeding";
const NOTIF_HEALTH_KEY = "ranchtrack_notif_health";

export default function SettingsScreen() {
  const Colors = useColors();
  const { isDark, toggleTheme } = useTheme();
  const { ranch, currentUserId, resetApp, refreshRanch, isRefreshingRanch, animals, doctoringEvents } = useRanch();
  const { resetOnboarding } = useOnboarding();
  const router = useRouter();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);
  const [notifBreeding, setNotifBreeding] = useState<boolean>(true);
  const [notifHealth, setNotifHealth] = useState<boolean>(true);
  const [notifLoaded, setNotifLoaded] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<"notifications" | "data" | "sync" | "help" | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const ROLE_LABELS: Record<string, string> = { owner: "Owner", manager: "Manager", worker: "Worker" };
  const ROLE_COLORS: Record<string, string> = { owner: Colors.accent, manager: Colors.primary, worker: Colors.textSecondary };

  useEffect(() => {
    (async () => {
      try {
        const [b, h] = await Promise.all([
          AsyncStorage.getItem(NOTIF_BREEDING_KEY),
          AsyncStorage.getItem(NOTIF_HEALTH_KEY),
        ]);
        if (b !== null) setNotifBreeding(b === "true");
        if (h !== null) setNotifHealth(h === "true");
      } catch (e) {
        console.log("[settings] failed to load notif prefs", e);
      } finally {
        setNotifLoaded(true);
      }
    })();
    AsyncStorage.getItem("ranchtrack_last_sync").then((val) => { if (val) setLastSyncTime(val); });
  }, []);

  const saveNotifPref = useCallback(async (key: string, value: boolean) => {
    try { await AsyncStorage.setItem(key, value ? "true" : "false"); } catch (e) { console.log(e); }
  }, []);

  const handleToggleBreeding = useCallback((val: boolean) => {
    setNotifBreeding(val);
    void saveNotifPref(NOTIF_BREEDING_KEY, val);
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [saveNotifPref]);

  const handleToggleHealth = useCallback((val: boolean) => {
    setNotifHealth(val);
    void saveNotifPref(NOTIF_HEALTH_KEY, val);
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [saveNotifPref]);

  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try { await refreshRanch(); } catch (e) { console.log("[settings] refresh failed", e); } finally { setIsManualRefreshing(false); }
  }, [refreshRanch]);

  const handleSyncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      await refreshRanch();
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSyncTime(now);
      await AsyncStorage.setItem("ranchtrack_last_sync", now);
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sync Complete", "Your ranch data is up to date.");
    } catch (e) {
      console.log("[settings] sync failed", e);
      Alert.alert("Sync Failed", "Could not reach the server. Your data is saved locally.");
    } finally {
      setIsSyncing(false);
    }
  }, [refreshRanch]);

  const handleClearData = useCallback(() => {
    Alert.alert(
      "Clear All Local Data",
      "This removes all data from this device only. Your server data is not affected. You will be signed out.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Data", style: "destructive",
          onPress: async () => {
            try {
              await resetApp();
              await resetOnboarding();
              await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
              await AsyncStorage.removeItem("ranchtrack_current_user_id");
              router.replace("/onboarding/welcome");
            } catch (e) {
              console.log("[settings] clear data failed", e);
              Alert.alert("Error", "Could not clear data. Please try again.");
            }
          },
        },
      ],
    );
  }, [resetApp, resetOnboarding, router]);

  const handleCopyInvite = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Invite Code", `Share this code with your team:\n\n${ranch.inviteCode}`);
  }, [ranch.inviteCode]);

  const handleToggleDarkMode = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleTheme();
  }, [toggleTheme]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out? You can sign back in anytime with your email and password.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out", style: "destructive",
          onPress: async () => {
            try {
              if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await signOut();
              await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
              await AsyncStorage.removeItem("ranchtrack_current_user_id");
              await AsyncStorage.removeItem("ranchtrack_pending_user_name");
              await AsyncStorage.removeItem("ranchtrack_auth_intent");
              await resetApp();
              await resetOnboarding();
              router.replace("/onboarding/welcome");
            } catch (e) {
              Alert.alert("Sign Out Failed", e instanceof Error ? e.message : "Something went wrong.");
            }
          },
        },
      ],
    );
  }, [resetApp, resetOnboarding, router]);

  const animalCount = (animals ?? []).filter((a) => a.status === "active").length;
  const doctoringCount = (doctoringEvents ?? []).length;

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
      <Modal visible={activeModal === "notifications"} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalClose}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalNote}>Control which events trigger reminders. These preferences are saved on this device.</Text>
            {notifLoaded && (
              <>
                <View style={styles.notifRow}>
                  <View style={styles.notifIconWrap}><Bell size={20} color={Colors.primary} /></View>
                  <View style={styles.notifInfo}>
                    <Text style={styles.notifLabel}>Breeding Reminders</Text>
                    <Text style={styles.notifSubtitle}>Due dates and breeding follow-ups</Text>
                  </View>
                  <Switch value={notifBreeding} onValueChange={handleToggleBreeding} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.textInverse} />
                </View>
                <View style={styles.notifRow}>
                  <View style={styles.notifIconWrap}>
                    {notifHealth ? <Bell size={20} color={Colors.primary} /> : <BellOff size={20} color={Colors.textTertiary} />}
                  </View>
                  <View style={styles.notifInfo}>
                    <Text style={styles.notifLabel}>Health Follow-Ups</Text>
                    <Text style={styles.notifSubtitle}>Doctoring events that need attention</Text>
                  </View>
                  <Switch value={notifHealth} onValueChange={handleToggleHealth} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.textInverse} />
                </View>
              </>
            )}
            <Text style={styles.modalFootnote}>Full push notification support is coming in a future update. Your preferences are saved now.</Text>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={activeModal === "data"} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Data & Storage</Text>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalClose}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalNote}>All data is stored locally on this device and synced to the cloud when online.</Text>
            {[
              { label: "Active Animals", value: animalCount },
              { label: "Team Members", value: ranch.members.length },
              { label: "Doctoring Events", value: doctoringCount },
            ].map((item) => (
              <View key={item.label} style={styles.dataRow}>
                <Text style={styles.dataLabel}>{item.label}</Text>
                <Text style={styles.dataValue}>{item.value}</Text>
              </View>
            ))}
            <View style={styles.modalDivider} />
            <TouchableOpacity style={styles.dangerButton} onPress={() => { setActiveModal(null); setTimeout(handleClearData, 300); }} activeOpacity={0.8}>
              <Trash2 size={18} color="#fff" />
              <Text style={styles.dangerButtonText}>Clear Local Data</Text>
            </TouchableOpacity>
            <Text style={styles.modalFootnote}>Clearing local data removes everything from this device only. Your server data is not affected.</Text>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={activeModal === "sync"} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sync Settings</Text>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalClose}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalNote}>RanchTrack syncs automatically when you open the app. You can also sync manually below.</Text>
            <View style={styles.syncStatusCard}>
              <CheckCircle size={20} color={Colors.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.syncStatusLabel}>Sync Status</Text>
                <Text style={styles.syncStatusValue}>{lastSyncTime ? `Last synced at ${lastSyncTime}` : "Not yet synced this session"}</Text>
              </View>
            </View>
            {[
              { label: "Animals", value: "Synced to cloud ✓" },
              { label: "Ranch & Members", value: "Synced to cloud ✓" },
              { label: "Calving & Health Records", value: "Local only (coming soon)" },
            ].map((item) => (
              <View key={item.label} style={styles.syncInfoRow}>
                <Text style={styles.syncInfoLabel}>{item.label}</Text>
                <Text style={styles.syncInfoValue}>{item.value}</Text>
              </View>
            ))}
            <View style={styles.modalDivider} />
            <TouchableOpacity style={[styles.syncButton, isSyncing && { opacity: 0.7 }]} onPress={handleSyncNow} disabled={isSyncing} activeOpacity={0.85}>
              {isSyncing ? <ActivityIndicator color="#fff" /> : <><RefreshCw size={18} color="#fff" /><Text style={styles.syncButtonText}>Sync Now</Text></>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={activeModal === "help"} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Help & Support</Text>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalClose}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.helpCard}>
              <Text style={styles.helpCardTitle}>RanchTrack</Text>
              <Text style={styles.helpCardVersion}>Version 1.0.0</Text>
            </View>
            {[
              { q: "How do I invite a team member?", a: "Go to Settings → copy your Invite Code → share it with your teammate. They enter it on the Join Ranch screen." },
              { q: "Why isn't my data showing on another device?", a: "Pull down on Settings to force a sync. Animals and ranch data sync automatically when the app opens." },
              { q: "What data is synced to the cloud?", a: "Animals and ranch/member info sync to Supabase. Calving, health, and breeding records are stored locally — full sync is coming soon." },
              { q: "How do I start a new business year?", a: "Go to the Work tab, tap the business year selector at the top, and choose Create New Year." },
              { q: "Can I undo marking an animal as sold?", a: "Yes — go to the For Sale screen, tap the Sold tab, find the animal, and tap Undo Sold." },
            ].map((item, i) => (
              <View key={i} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.contactButton} onPress={() => Alert.alert("Contact Support", "For help, email: support@ranchtrack.app")} activeOpacity={0.8}>
              <Mail size={18} color={Colors.primary} />
              <Text style={styles.contactButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <View style={styles.ranchHeader}>
        <View style={styles.ranchIcon}><Text style={styles.ranchIconText}>🏜️</Text></View>
        <Text style={styles.ranchName}>{ranch.name}</Text>
        <Text style={styles.ranchMembers}>{ranch.members.length} team members</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.themeCard}>
          <View style={styles.themeIconContainer}>
            {isDark ? <Moon size={20} color={Colors.primary} /> : <Sun size={20} color={Colors.primary} />}
          </View>
          <View style={styles.themeContent}>
            <Text style={styles.themeLabel}>Dark Mode</Text>
            <Text style={styles.themeSubtitle}>{isDark ? "On" : "Off"}</Text>
          </View>
          <Switch value={isDark} onValueChange={handleToggleDarkMode} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.textInverse} testID="dark-mode-toggle" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invite Code</Text>
        <TouchableOpacity style={styles.inviteCard} onPress={handleCopyInvite} activeOpacity={0.7}>
          <View style={styles.inviteCodeContainer}><Text style={styles.inviteCode}>{ranch.inviteCode}</Text></View>
          <View style={styles.inviteCopyBtn}><Copy size={18} color={Colors.primary} /><Text style={styles.inviteCopyText}>Copy</Text></View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Team Members</Text>
        {ranch.members.map((member) => {
          const isCurrentUser = member.userId === currentUserId;
          return (
            <View key={member.userId} style={styles.memberCard}>
              <View style={[styles.memberAvatar, { backgroundColor: ROLE_COLORS[member.role] || Colors.textSecondary }]}>
                <Text style={styles.memberAvatarText}>{getInitials(member.name)}</Text>
              </View>
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {isCurrentUser && <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>}
                </View>
                <View style={styles.roleBadge}>
                  <Shield size={12} color={ROLE_COLORS[member.role] || Colors.textSecondary} />
                  <Text style={[styles.roleText, { color: ROLE_COLORS[member.role] || Colors.textSecondary }]}>{ROLE_LABELS[member.role] || member.role}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        {[
          { icon: Bell, label: "Notifications", subtitle: notifBreeding && notifHealth ? "All alerts on" : "Some alerts off", modal: "notifications" as const },
          { icon: Database, label: "Data & Storage", subtitle: `${animalCount} animals on this device`, modal: "data" as const },
          { icon: Smartphone, label: "Sync Settings", subtitle: lastSyncTime ? `Last synced ${lastSyncTime}` : "Tap to sync now", modal: "sync" as const },
          { icon: HelpCircle, label: "Help & Support", subtitle: "FAQs and contact", modal: "help" as const },
        ].map((item) => (
          <TouchableOpacity
            key={item.modal}
            style={styles.settingsRow}
            activeOpacity={0.7}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveModal(item.modal);
            }}
          >
            <View style={styles.settingsIconContainer}><item.icon size={20} color={Colors.primary} /></View>
            <View style={styles.settingsRowContent}>
              <Text style={styles.settingsRowLabel}>{item.label}</Text>
              <Text style={styles.settingsRowSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.settingsChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
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
  ranchHeader: { alignItems: "center" as const, paddingTop: 28, paddingBottom: 32 },
  ranchIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: Colors.secondaryLight, alignItems: "center" as const, justifyContent: "center" as const, marginBottom: 14, borderWidth: 2, borderColor: Colors.border },
  ranchIconText: { fontSize: 34 },
  ranchName: { fontSize: 26, fontWeight: "800" as const, color: Colors.text, letterSpacing: -0.3 },
  ranchMembers: { fontSize: 15, color: Colors.textSecondary, marginTop: 5, fontWeight: "500" as const },
  section: { paddingHorizontal: 16, marginBottom: 28 },
  sectionTitle: { fontSize: 13, fontWeight: "800" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 1.2, marginBottom: 12, marginLeft: 2 },
  themeCard: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: Colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  themeIconContainer: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.backgroundDark, alignItems: "center" as const, justifyContent: "center" as const },
  themeContent: { flex: 1, marginLeft: 14 },
  themeLabel: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
  themeSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: "500" as const },
  inviteCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 18, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  inviteCodeContainer: { backgroundColor: Colors.backgroundDark, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  inviteCode: { fontSize: 19, fontWeight: "800" as const, color: Colors.primary, letterSpacing: 2.5 },
  inviteCopyBtn: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  inviteCopyText: { fontSize: 15, fontWeight: "700" as const, color: Colors.primary },
  memberCard: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  memberAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center" as const, justifyContent: "center" as const },
  memberAvatarText: { fontSize: 16, fontWeight: "700" as const, color: Colors.textInverse },
  memberInfo: { flex: 1, marginLeft: 14 },
  memberNameRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  memberName: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
  youBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  youBadgeText: { fontSize: 11, fontWeight: "800" as const, color: Colors.textInverse },
  roleBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, marginTop: 4 },
  roleText: { fontSize: 13, fontWeight: "700" as const },
  settingsRow: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  settingsIconContainer: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.backgroundDark, alignItems: "center" as const, justifyContent: "center" as const },
  settingsRowContent: { flex: 1, marginLeft: 14 },
  settingsRowLabel: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
  settingsRowSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: "500" as const },
  settingsChevron: { fontSize: 22, color: Colors.textTertiary, fontWeight: "300" as const, paddingLeft: 4 },
  signOutButton: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, marginHorizontal: 16, marginTop: 8, paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.surface, gap: 8, borderWidth: 1.5, borderColor: Colors.error },
  signOutText: { fontSize: 16, fontWeight: "700" as const, color: Colors.error },
  versionText: { textAlign: "center" as const, fontSize: 13, color: Colors.textTertiary, marginTop: 20, marginBottom: 20, fontWeight: "500" as const },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontWeight: "800" as const, color: Colors.text },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: "center" as const, justifyContent: "center" as const },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalNote: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: 24, backgroundColor: Colors.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  modalDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 20 },
  modalFootnote: { fontSize: 12, color: Colors.textTertiary, textAlign: "center" as const, marginTop: 16, lineHeight: 18 },
  notifRow: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight },
  notifIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.backgroundDark, alignItems: "center" as const, justifyContent: "center" as const },
  notifInfo: { flex: 1, marginLeft: 12 },
  notifLabel: { fontSize: 15, fontWeight: "700" as const, color: Colors.text },
  notifSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  dataRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight },
  dataLabel: { fontSize: 15, fontWeight: "600" as const, color: Colors.text },
  dataValue: { fontSize: 18, fontWeight: "800" as const, color: Colors.primary },
  dangerButton: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: Colors.error, borderRadius: 14, paddingVertical: 16, gap: 8 },
  dangerButtonText: { fontSize: 16, fontWeight: "700" as const, color: "#fff" },
  syncStatusCard: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.borderLight },
  syncStatusLabel: { fontSize: 13, fontWeight: "700" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.8 },
  syncStatusValue: { fontSize: 14, color: Colors.text, marginTop: 2, fontWeight: "500" as const },
  syncInfoRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  syncInfoLabel: { fontSize: 14, color: Colors.text, fontWeight: "600" as const },
  syncInfoValue: { fontSize: 13, color: Colors.textSecondary },
  syncButton: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, gap: 8 },
  syncButtonText: { fontSize: 16, fontWeight: "700" as const, color: "#fff" },
  helpCard: { alignItems: "center" as const, paddingVertical: 24, marginBottom: 16 },
  helpCardTitle: { fontSize: 22, fontWeight: "800" as const, color: Colors.text },
  helpCardVersion: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  faqItem: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight },
  faqQ: { fontSize: 14, fontWeight: "700" as const, color: Colors.text, marginBottom: 6 },
  faqA: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  contactButton: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: 14, paddingVertical: 16, gap: 8, marginTop: 8, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.surface },
  contactButtonText: { fontSize: 16, fontWeight: "700" as const, color: Colors.primary },
});
