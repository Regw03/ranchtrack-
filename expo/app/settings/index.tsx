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
  UserMinus,
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
  const { ranch, currentUserId, resetApp, refreshRanch, isRefreshingRanch, animals, doctoringEvents, currentUserRole, canInviteTeammates, removeTeammate } = useRanch();
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

  const handleRemoveMember = useCallback((userId: string, name: string) => {
    Alert.alert(
      "Remove Teammate",
      `Remove ${name} from the ranch? They will lose access immediately.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web")
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await removeTeammate(userId);
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Could not remove member.");
            }
          },
        },
      ],
    );
  }, [removeTeammate]);


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
      {/* Notifications Modal */}
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

      {/* Data & Storage Modal */}
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

      {/* Sync Modal */}
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
              <View style={styles.syncStatusInfo}>
                <Text style={styles.syncStatusLabel}>Sync Status</Text>
                <Text style={styles.syncStatusValue}>{lastSyncTime ? `Last synced at ${lastSyncTime}` : "Not yet synced this session"}</Text>
              </View>
            </View>
            {[
              { label: "Animals", value: "Synced to cloud ✓" },
              { label: "Ranch & Members", value: "Synced to cloud ✓" },
              { label: "Calving Lists & Records", value: "Synced to cloud ✓" },
              { label: "Breeding Records & Groups", value: "Synced to cloud ✓" },
              { label: "Doctoring Events", value: "Synced to cloud ✓" },
              { label: "Weight & Health Records", value: "Synced to cloud ✓" },
              { label: "Processing Sessions", value: "Synced to cloud ✓" },
            ].map((item) => (
              <View key={item.label} style={styles.syncInfoRow}>
                <Text style={styles.syncInfoLabel}>{item.label}</Text>
                <Text style={styles.syncInfoValue}>{item.value}</Text>
              </View>
            ))}
            <View style={styles.modalDivider} />
            <TouchableOpacity style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]} onPress={handleSyncNow} disabled={isSyncing} activeOpacity={0.85}>
              {isSyncing ? <ActivityIndicator color="#fff" /> : <><RefreshCw size={18} color="#fff" /><Text style={styles.syncButtonText}>Sync Now</Text></>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Help Modal */}
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

            <Text style={styles.helpSection}>📊 Dashboard</Text>
            {[
              { q: "What is the Dashboard?", a: "Your daily command center. Shows animals needing attention, active calving groups, processing sessions, and quick action buttons for the most common tasks." },
              { q: "Quick Actions", a: "Add Calf opens the calving log. Add Cow opens the add animal form. Process opens processing sessions. Doctor opens the doctoring form. Each takes 1–2 taps." },
              { q: "Needs Attention", a: "Shows animals with unresolved doctoring follow-ups. Tap any animal to open their profile and resolve the issue. The section is hidden when there are none." },
            ].map((item, i) => (
              <View key={`dash${i}`} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}

            <Text style={styles.helpSection}>🐄 Animals (Herd Tab)</Text>
            {[
              { q: "Viewing your herd", a: "The Animals tab groups your herd by type: Cows, Heifers, Calves, Bulls, Steers, and Deceased. Tap a group card to filter the list to that type only." },
              { q: "Adding an animal", a: "Tap the + button at the bottom right. Tag ID is the only required field. Name, breed, birth year, gender, and species are all optional." },
              { q: "Animal profile", a: "Tap any animal card to open its full profile. From here you can edit details, add a photo, log health records, weight records, breeding records, and doctoring events." },
              { q: "Adding a photo", a: "Open the animal profile and tap the photo area or camera icon. You can take a new photo or choose from your library. The photo shows on the profile only, not on list cards." },
              { q: "Birth year vs full date", a: "For older animals, enter just the birth year (e.g. 2019). Full birthdates are only needed for calves — those are filled in automatically through the calving screen." },
              { q: "Identity status", a: "Mark an animal as Confirmed, Estimated, or Unknown. Estimated animals show a ~ symbol next to their tag. Useful when you are not certain of an animal's details." },
              { q: "Generation tracking", a: "Optionally enter a generation number when adding an animal. Toggle Est. to mark it as estimated. Generations are displayed as #3 (confirmed) or ~3 (estimated) on animal cards." },
              { q: "Searching animals", a: "Use the search bar at the top of the Animals screen. Search by tag number, name, or breed. Tap a group card to filter by type at the same time." },
              { q: "Marking for sale", a: "Open the animal profile and tap Mark for Sale. They appear on the For Sale screen immediately. Tap Mark Sold to move them to the Sold tab." },
              { q: "Marking as deceased", a: "Open the animal profile and tap Deceased. The animal is removed from all lists and shows in the Deceased group card. Tap Undo Deceased to fully restore them." },
              { q: "Merging duplicates", a: "If an animal was entered twice, open one profile and use Merge Duplicate. All records from the duplicate transfer to the kept animal." },
            ].map((item, i) => (
              <View key={`herd${i}`} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}

            <Text style={styles.helpSection}>🐮 Calving</Text>
            {[
              { q: "Logging a calving event", a: "From the Dashboard tap Add Calf, or Work tab → Log Calving. Type the cow's tag, enter the calf's tag, tap Heifer or Bull, then Save. The calf is automatically added to your herd." },
              { q: "Unknown cow", a: "If you do not know the mother's tag, you can leave it blank or type an unrecognized tag. The calving record is still saved with the unmatched tag stored as a note." },
              { q: "Repeat last entry", a: "After saving a calf, tap Repeat Last Entry to pre-fill the calf type, breed, and assisted status from the previous entry. Useful during busy calving periods." },
              { q: "Calving groups", a: "Groups organize cows by pasture or season (e.g. North Pasture, Spring Heifers). Go to Work → Calving → Groups → New Calving Group. Add cows and log calvings directly from within the group." },
              { q: "Logging from a group", a: "Open a calving group and tap Log Calving. The mother selection is limited to cows in that group, and the new calf is automatically added to the group." },
              { q: "Groups reset each year", a: "When you create a new business year, calving groups start fresh. Old groups are preserved if you switch back to view a past year." },
              { q: "Female calves at year end", a: "When you create a new business year, female calves are automatically promoted to replacement heifers. Bull calves do not transfer since they are typically sold." },
            ].map((item, i) => (
              <View key={`calv${i}`} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}

            <Text style={styles.helpSection}>🐂 Breeding</Text>
            {[
              { q: "Adding a breeding record", a: "Open an animal profile and tap Add Breeding Record. Enter the last bred date, expected due date, sire tag (optional), and breeding status." },
              { q: "Breeding status options", a: "Open: not yet bred. Bred: breeding date entered. Confirmed: pregnancy confirmed. Delivered: calf has been born. Tap quick-toggle buttons on the Breeding screen to update in one tap." },
              { q: "Breeding groups", a: "Go to Work → Breeding → Groups → New Breeding Group. Add females and heifers to organize breeding by pasture or sire. Works the same way as calving groups." },
              { q: "Breeding records reset each year", a: "Like calving, breeding records and groups are tied to the active business year. Each new year starts fresh." },
            ].map((item, i) => (
              <View key={`breed${i}`} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}

            <Text style={styles.helpSection}>💉 Health Events</Text>
            {[
              { q: "Logging a group health event", a: "Go to Work → Health Events → Log Event. Choose an event type (Vaccination, Blood Test, Treatment, Inspection, or Custom), assign it to a group, set the date, and save." },
              { q: "Health templates", a: "Templates save common events for quick reuse. Go to Work → Health Events → Templates → New Template. Select a template when logging a new event to pre-fill the fields." },
              { q: "Tracking due and overdue events", a: "The Health Events screen groups events into Upcoming, Overdue, and Completed. Overdue events show in red. Tap the circle on any event to mark it complete." },
              { q: "Doctoring individual animals", a: "For individual issues like injury or illness, use Doctoring instead of Health Events. Open an animal profile and tap Doctor, or use the Doctor quick action on the Dashboard." },
              { q: "Doctoring follow-ups", a: "When logging a doctoring event, toggle Follow-Up Needed. The animal will appear on the Needs Attention list on your Dashboard until the follow-up is resolved." },
              { q: "Resolving a follow-up", a: "Open the animal profile, find the doctoring event in the health timeline, and tap Mark Resolved. The animal is removed from the Needs Attention list." },
            ].map((item, i) => (
              <View key={`health${i}`} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}

            <Text style={styles.helpSection}>📋 Processing Sessions</Text>
            {[
              { q: "What is a processing session?", a: "A processing session tracks a seasonal work event like Spring Processing or Fall Preg Check. It groups health events and tasks together so you can see what is done and what still needs attention." },
              { q: "Creating a session", a: "Go to Work → Processing Sessions → New Session. Give it a name (e.g. Spring Processing 2026), assign groups, add notes, and save. Sessions are tied to your active business year." },
              { q: "Logging events in a session", a: "Open a session and tap Log Event. Choose the event type, name it, select the group it applies to, and save. Events appear in the session timeline." },
              { q: "Tracking group progress", a: "Inside a session, each group shows a status: Not Started, In Progress, or Completed. Tap the status to cycle through the options as work gets done." },
            ].map((item, i) => (
              <View key={`proc${i}`} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}

            <Text style={styles.helpSection}>💰 For Sale</Text>
            {[
              { q: "Marking an animal for sale", a: "Open any animal profile and tap Mark for Sale. The animal appears on the For Sale screen immediately. They remain in your herd until marked as sold." },
              { q: "Marking as sold", a: "On the For Sale screen, tap Mark Sold on any animal. They move to the Sold tab and are removed from all other lists and groups." },
              { q: "Undoing a sale", a: "On the For Sale screen tap the Sold tab, find the animal, and tap Undo Sold. The animal is fully restored including any lists or groups they belonged to before being sold." },
            ].map((item, i) => (
              <View key={`sale${i}`} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}

            <Text style={styles.helpSection}>📝 Custom Lists</Text>
            {[
              { q: "Creating a list", a: "On the Animals screen scroll to the Operations section and tap New List. Choose an animal type (Cattle or Horse), pick a category (Vaccinations, Breeding, To Be Sold, or Calving/Foaling), give it a name and color, and save." },
              { q: "Adding animals to a list", a: "Open a list and tap the + button. Search for existing animals to add, or create a brand new animal profile directly from within the list using the list type as a template." },
              { q: "Sub-lists", a: "Lists support sub-lists for organizing groups within a category. Open a list and tap Add Sub-List (e.g. First Calf Heifers inside a Calving list). Sub-lists collapse under their parent." },
              { q: "Removing animals from a list", a: "Open the list and remove the animal, or open the animal profile and remove the list from the Lists section on their profile." },
            ].map((item, i) => (
              <View key={`list${i}`} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}

            <Text style={styles.helpSection}>📅 Business Years</Text>
            {[
              { q: "What is a business year?", a: "A business year represents one ranch season (e.g. Spring Calving 2026). Calving records, breeding records, and groups are all tied to it so each season stays organized separately." },
              { q: "Creating a new business year", a: "Go to the Work tab, tap the business year selector at the top, and choose Create New Year. Give it a name and it becomes the active year for all new records." },
              { q: "What carries over to a new year?", a: "Active animals (cows, bulls, steers) carry over. Female calves are automatically promoted to replacement heifers. Bull calves do not transfer. Calving and breeding groups start fresh." },
              { q: "Viewing past years", a: "Tap the business year selector at the top of the Work tab and choose any past year. All screens filter to show records from that year." },
            ].map((item, i) => (
              <View key={`year${i}`} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}

            <Text style={styles.helpSection}>👥 Team & Ranch</Text>
            {[
              { q: "Inviting a team member", a: "Go to Settings and copy your Invite Code. Share it with your teammate. They install RanchTrack, tap Join an Existing Ranch on the welcome screen, enter their name and the code, and they are in." },
              { q: "Seeing new members on your device", a: "Pull down on the Settings screen to refresh the member list. The app also automatically checks for new members each time you open it." },
              { q: "Roles", a: "Owners and Managers can invite new teammates. Members can view and add data but cannot invite others. Roles are shown on each member card in Settings." },
              { q: "Ranch Profile", a: "Tap the ranch button in the top right of the Dashboard to open Ranch Profile. Edit your ranch name, your name, manage team members, and switch users on shared devices." },
              { q: "Switching users on a shared device", a: "Open Ranch Profile and tap Switch User. Select an existing user or add a new one. Useful when multiple people share the same device." },
            ].map((item, i) => (
              <View key={`team${i}`} style={styles.faqItem}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}

            <Text style={styles.helpSection}>☁️ Account & Sync</Text>
            {[
              { q: "What syncs to the cloud?", a: "Everything syncs automatically — animals, ranch and member info, business years, calving lists and records, breeding records and groups, doctoring events, weight records, health records, and processing sessions." },
              { q: "Signing in on a new device", a: "Open RanchTrack, tap Sign In on the welcome screen, and enter your email and password. Your ranch and animals are pulled down automatically." },
              { q: "Signing out", a: "Go to Settings and tap Sign Out at the bottom. Your local data is cleared from this device but remains on the server." },
              { q: "Clearing local data", a: "Go to Settings → Data & Storage → Clear Local Data. This removes all data from this device only. Sign back in to restore everything from the server." },
            ].map((item, i) => (
              <View key={`acct${i}`} style={styles.faqItem}>
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

      {/* Main Content */}
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
              {/* Show remove button for owner/manager, but not on self or on owner */}
              {canInviteTeammates && !isCurrentUser && member.role !== "owner" &&
                !(currentUserRole === "manager" && member.role === "manager") && (
                  <TouchableOpacity
                    onPress={() => handleRemoveMember(member.userId, member.name)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.removeMemberBtn}
                  >
                    <UserMinus size={18} color={Colors.error} />
                  </TouchableOpacity>
                )}
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
  removeMemberBtn: { padding: 8 },
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
  syncStatusInfo: { flex: 1, marginLeft: 12 },
  syncStatusLabel: { fontSize: 13, fontWeight: "700" as const, color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.8 },
  syncStatusValue: { fontSize: 14, color: Colors.text, marginTop: 2, fontWeight: "500" as const },
  syncInfoRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  syncInfoLabel: { fontSize: 14, color: Colors.text, fontWeight: "600" as const },
  syncInfoValue: { fontSize: 13, color: Colors.textSecondary },
  syncButton: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, gap: 8 },
  syncButtonDisabled: { opacity: 0.7 },
  syncButtonText: { fontSize: 16, fontWeight: "700" as const, color: "#fff" },
  helpCard: { alignItems: "center" as const, paddingVertical: 24, marginBottom: 16 },
  helpCardTitle: { fontSize: 22, fontWeight: "800" as const, color: Colors.text },
  helpCardVersion: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  faqItem: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight },
  faqQ: { fontSize: 14, fontWeight: "700" as const, color: Colors.text, marginBottom: 6 },
  faqA: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  contactButton: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: 14, paddingVertical: 16, gap: 8, marginTop: 8, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.surface },
  contactButtonText: { fontSize: 16, fontWeight: "700" as const, color: Colors.primary },
  helpSection: { fontSize: 15, fontWeight: "800" as const, color: Colors.text, marginTop: 20, marginBottom: 10, letterSpacing: 0.2 },
});
