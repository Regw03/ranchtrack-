import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import {
  Pencil,
  Check,
  Shield,
  UserPlus,
  UserCog,
  X,
  Plus,
  Crown,
  Mail,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { getInitials } from "@/utils/helpers";

export default function RanchProfileScreen() {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const {
    ranch,
    users,
    currentUser,
    currentUserId,
    setRanchName,
    isSettingRanchName,
    updateUserName,
    isUpdatingUserName,
    setActiveUser,
    addUserAndSwitch,
    isAddingUser,
  } = useRanch();

  const [editingRanchName, setEditingRanchName] = useState<boolean>(false);
  const [ranchDraft, setRanchDraft] = useState<string>(ranch.name);

  const [editingUserName, setEditingUserName] = useState<boolean>(false);
  const [userDraft, setUserDraft] = useState<string>(currentUser?.name ?? "");

  const [switchOpen, setSwitchOpen] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>("");

  const owner = useMemo(
    () => ranch.members.find((m) => m.userId === ranch.ownerId),
    [ranch.members, ranch.ownerId],
  );

  const handleStartEditRanch = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRanchDraft(ranch.name);
    setEditingRanchName(true);
  }, [ranch.name]);

  const handleSaveRanchName = useCallback(async () => {
    const trimmed = ranchDraft.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Ranch name can't be empty.");
      return;
    }
    if (trimmed === ranch.name) {
      setEditingRanchName(false);
      return;
    }
    try {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await setRanchName(trimmed);
      setEditingRanchName(false);
    } catch (e) {
      console.log("Failed to save ranch name", e);
      Alert.alert("Couldn't save", "Please try again.");
    }
  }, [ranchDraft, ranch.name, setRanchName]);

  const handleStartEditUser = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUserDraft(currentUser?.name ?? "");
    setEditingUserName(true);
  }, [currentUser?.name]);

  const handleSaveUserName = useCallback(async () => {
    const trimmed = userDraft.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Your name can't be empty.");
      return;
    }
    if (!currentUserId) return;
    if (trimmed === currentUser?.name) {
      setEditingUserName(false);
      return;
    }
    try {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updateUserName({ userId: currentUserId, name: trimmed });
      setEditingUserName(false);
    } catch (e) {
      console.log("Failed to save user name", e);
      Alert.alert("Couldn't save", "Please try again.");
    }
  }, [userDraft, currentUserId, currentUser?.name, updateUserName]);

  const handleSwitchUser = useCallback(
    async (userId: string) => {
      if (userId === currentUserId) {
        setSwitchOpen(false);
        return;
      }
      try {
        if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await setActiveUser(userId);
        setSwitchOpen(false);
      } catch (e) {
        console.log("Failed to switch user", e);
      }
    },
    [currentUserId, setActiveUser],
  );

  const handleCreateAndSwitch = useCallback(async () => {
    const trimmed = newUserName.trim();
    if (!trimmed) return;
    try {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await addUserAndSwitch(trimmed);
      setNewUserName("");
      setSwitchOpen(false);
    } catch (e) {
      console.log("Failed to create user", e);
      Alert.alert("Couldn't create user", "Please try again.");
    }
  }, [newUserName, addUserAndSwitch]);

  return (
    <>
      <Stack.Screen options={{ title: "Ranch Profile" }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>🏜️</Text>
          </View>
          {editingRanchName ? (
            <View style={styles.heroEditRow}>
              <TextInput
                value={ranchDraft}
                onChangeText={setRanchDraft}
                style={styles.heroInput}
                autoFocus
                autoCapitalize="words"
                maxLength={60}
                onSubmitEditing={handleSaveRanchName}
                returnKeyType="done"
                testID="ranch-name-edit"
              />
              <TouchableOpacity
                style={styles.heroSaveBtn}
                onPress={handleSaveRanchName}
                disabled={isSettingRanchName}
                activeOpacity={0.8}
              >
                {isSettingRanchName ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Check size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.heroNameRow}
              activeOpacity={0.7}
              onPress={handleStartEditRanch}
              testID="edit-ranch-name"
            >
              <Text style={styles.heroName} numberOfLines={2}>
                {ranch.name || "Your Ranch"}
              </Text>
              <View style={styles.editChip}>
                <Pencil size={14} color={Colors.primary} />
              </View>
            </TouchableOpacity>
          )}
          <Text style={styles.heroSubtitle}>
            Owned by {owner?.name ?? currentUser?.name ?? "—"}
          </Text>
        </View>

        <Section title="Team Members" Colors={Colors}>
          {ranch.members.map((m) => {
            const isOwner = m.userId === ranch.ownerId;
            const isYou = m.userId === currentUserId;
            return (
              <View
                key={m.userId}
                style={styles.memberRow}
                testID={`member-${m.userId}`}
              >
                <View
                  style={[
                    styles.memberAvatar,
                    {
                      backgroundColor: isOwner ? Colors.accent : Colors.primary,
                    },
                  ]}
                >
                  <Text style={styles.memberAvatarText}>{getInitials(m.name)}</Text>
                </View>
                <View style={styles.memberBody}>
                  <View style={styles.memberHeading}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.name}
                    </Text>
                    {isYou && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>You</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.memberRoleRow}>
                    {isOwner ? (
                      <Crown size={13} color={Colors.accent} />
                    ) : (
                      <Shield size={13} color={Colors.textSecondary} />
                    )}
                    <Text
                      style={[
                        styles.memberRole,
                        { color: isOwner ? Colors.accent : Colors.textSecondary },
                      ]}
                    >
                      {isOwner ? "Owner" : "Member"}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.invitePlaceholder}
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert(
                "Coming soon",
                "Invite teammates by email or code in a future update.",
              )
            }
            testID="invite-member-placeholder"
          >
            <View style={styles.inviteIcon}>
              <Mail size={18} color={Colors.textTertiary} />
            </View>
            <View style={styles.inviteBody}>
              <Text style={styles.inviteTitle}>Invite a teammate</Text>
              <Text style={styles.inviteSubtitle}>Coming soon</Text>
            </View>
            <UserPlus size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </Section>

        <Section title="You" Colors={Colors}>
          {editingUserName ? (
            <View style={styles.youEditCard}>
              <TextInput
                value={userDraft}
                onChangeText={setUserDraft}
                style={styles.youInput}
                autoFocus
                autoCapitalize="words"
                maxLength={40}
                onSubmitEditing={handleSaveUserName}
                returnKeyType="done"
                placeholder="Your name"
                placeholderTextColor={Colors.textTertiary}
                testID="user-name-edit"
              />
              <View style={styles.youEditActions}>
                <TouchableOpacity
                  style={styles.youCancelBtn}
                  onPress={() => setEditingUserName(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.youCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.youSaveBtn}
                  onPress={handleSaveUserName}
                  disabled={isUpdatingUserName}
                  activeOpacity={0.85}
                >
                  {isUpdatingUserName ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.youSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.youCard}
              onPress={handleStartEditUser}
              activeOpacity={0.7}
              testID="edit-your-name"
            >
              <View style={styles.youAvatar}>
                <Text style={styles.youAvatarText}>
                  {getInitials(currentUser?.name ?? "?")}
                </Text>
              </View>
              <View style={styles.youBody}>
                <Text style={styles.youLabel}>Your name</Text>
                <Text style={styles.youName} numberOfLines={1}>
                  {currentUser?.name ?? "Set your name"}
                </Text>
              </View>
              <View style={styles.editChip}>
                <Pencil size={14} color={Colors.primary} />
              </View>
            </TouchableOpacity>
          )}
        </Section>

        <Section title="Actions" Colors={Colors}>
          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSwitchOpen(true);
            }}
            testID="switch-user-btn"
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.primary + "18" }]}>
              <UserCog size={20} color={Colors.primary} />
            </View>
            <View style={styles.actionBody}>
              <Text style={styles.actionTitle}>Switch User</Text>
              <Text style={styles.actionSubtitle}>For testing — change active profile</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.actionRow, styles.actionRowDisabled]}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.border }]}>
              <UserPlus size={20} color={Colors.textTertiary} />
            </View>
            <View style={styles.actionBody}>
              <Text style={[styles.actionTitle, { color: Colors.textTertiary }]}>
                Invite Member
              </Text>
              <Text style={styles.actionSubtitle}>Coming soon</Text>
            </View>
          </View>
        </Section>

        <View style={{ height: 32 }} />
      </ScrollView>

      <SwitchUserModal
        visible={switchOpen}
        onClose={() => setSwitchOpen(false)}
        users={users}
        currentUserId={currentUserId}
        onSelect={handleSwitchUser}
        newUserName={newUserName}
        setNewUserName={setNewUserName}
        onCreate={handleCreateAndSwitch}
        isAddingUser={isAddingUser}
        Colors={Colors}
      />
    </>
  );
}

function Section({
  title,
  children,
  Colors,
}: {
  title: string;
  children: React.ReactNode;
  Colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SwitchUserModal({
  visible,
  onClose,
  users,
  currentUserId,
  onSelect,
  newUserName,
  setNewUserName,
  onCreate,
  isAddingUser,
  Colors,
}: {
  visible: boolean;
  onClose: () => void;
  users: { id: string; name: string }[];
  currentUserId: string;
  onSelect: (id: string) => void;
  newUserName: string;
  setNewUserName: (s: string) => void;
  onCreate: () => void;
  isAddingUser: boolean;
  Colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Switch User</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose} activeOpacity={0.7}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>
            Pick an existing user or add a new one (testing).
          </Text>

          <ScrollView
            style={styles.modalList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {users.map((u) => {
              const isActive = u.id === currentUserId;
              return (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.modalRow, isActive && styles.modalRowActive]}
                  onPress={() => onSelect(u.id)}
                  activeOpacity={0.7}
                  testID={`switch-to-${u.id}`}
                >
                  <View
                    style={[
                      styles.modalAvatar,
                      { backgroundColor: isActive ? Colors.primary : Colors.backgroundDark },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalAvatarText,
                        { color: isActive ? "#fff" : Colors.textSecondary },
                      ]}
                    >
                      {getInitials(u.name)}
                    </Text>
                  </View>
                  <Text style={styles.modalName} numberOfLines={1}>
                    {u.name}
                  </Text>
                  {isActive && <Check size={18} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}

            <View style={styles.modalAddBlock}>
              <Text style={styles.modalAddLabel}>Add new user</Text>
              <View style={styles.modalAddRow}>
                <TextInput
                  value={newUserName}
                  onChangeText={setNewUserName}
                  placeholder="Name"
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.modalAddInput}
                  autoCapitalize="words"
                  maxLength={40}
                  onSubmitEditing={onCreate}
                  returnKeyType="done"
                  testID="new-user-input"
                />
                <TouchableOpacity
                  style={[
                    styles.modalAddBtn,
                    {
                      backgroundColor:
                        newUserName.trim().length > 0 ? Colors.primary : Colors.border,
                    },
                  ]}
                  onPress={onCreate}
                  disabled={isAddingUser || newUserName.trim().length === 0}
                  activeOpacity={0.85}
                  testID="create-user-btn"
                >
                  {isAddingUser ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Plus size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(Colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { paddingBottom: 40 },

    heroCard: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: Colors.surface,
      borderRadius: 20,
      paddingVertical: 26,
      paddingHorizontal: 20,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    heroIcon: {
      width: 78,
      height: 78,
      borderRadius: 24,
      backgroundColor: Colors.secondaryLight,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 14,
      borderWidth: 2,
      borderColor: Colors.border,
    },
    heroIconText: { fontSize: 36 },
    heroNameRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
    },
    heroName: {
      fontSize: 26,
      fontWeight: "800" as const,
      color: Colors.text,
      letterSpacing: -0.4,
      textAlign: "center" as const,
    },
    heroEditRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      width: "100%" as const,
      gap: 10,
    },
    heroInput: {
      flex: 1,
      fontSize: 22,
      fontWeight: "800" as const,
      color: Colors.text,
      backgroundColor: Colors.background,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    heroSaveBtn: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: Colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    editChip: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: Colors.primary + "18",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    heroSubtitle: {
      marginTop: 8,
      fontSize: 14,
      color: Colors.textSecondary,
      fontWeight: "600" as const,
    },

    section: { marginTop: 26, paddingHorizontal: 16 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 1.2,
      marginBottom: 10,
      marginLeft: 4,
    },
    sectionBody: { gap: 8 },

    memberRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    memberAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    memberAvatarText: {
      fontSize: 16,
      fontWeight: "800" as const,
      color: "#fff",
    },
    memberBody: { flex: 1, marginLeft: 14 },
    memberHeading: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
    },
    memberName: { fontSize: 17, fontWeight: "700" as const, color: Colors.text, flexShrink: 1 },
    memberRoleRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 5,
      marginTop: 4,
    },
    memberRole: { fontSize: 13, fontWeight: "700" as const },
    youBadge: {
      backgroundColor: Colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    youBadgeText: { fontSize: 11, fontWeight: "800" as const, color: "#fff" },

    invitePlaceholder: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      borderStyle: "dashed" as const,
    },
    inviteIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: Colors.backgroundDark,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    inviteBody: { flex: 1, marginLeft: 12 },
    inviteTitle: { fontSize: 15, fontWeight: "700" as const, color: Colors.textSecondary },
    inviteSubtitle: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },

    youCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    youAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: Colors.primary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    youAvatarText: { fontSize: 16, fontWeight: "800" as const, color: "#fff" },
    youBody: { flex: 1, marginLeft: 14 },
    youLabel: {
      fontSize: 12,
      fontWeight: "700" as const,
      color: Colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
    },
    youName: { fontSize: 17, fontWeight: "700" as const, color: Colors.text, marginTop: 2 },

    youEditCard: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    youInput: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: Colors.text,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: Colors.background,
      borderRadius: 10,
    },
    youEditActions: {
      flexDirection: "row" as const,
      gap: 10,
      marginTop: 12,
    },
    youCancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: Colors.backgroundDark,
      alignItems: "center" as const,
    },
    youCancelText: { fontSize: 15, fontWeight: "700" as const, color: Colors.textSecondary },
    youSaveBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: Colors.primary,
      alignItems: "center" as const,
    },
    youSaveText: { fontSize: 15, fontWeight: "800" as const, color: "#fff" },

    actionRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    actionRowDisabled: { opacity: 0.6 },
    actionIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    actionBody: { flex: 1, marginLeft: 14 },
    actionTitle: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
    actionSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: "500" as const },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end" as const,
    },
    modalCard: {
      backgroundColor: Colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 28,
      maxHeight: "80%" as const,
    },
    modalHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    },
    modalTitle: { fontSize: 20, fontWeight: "800" as const, color: Colors.text },
    modalClose: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: Colors.backgroundDark,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    modalSubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginTop: 6,
      marginBottom: 12,
    },
    modalList: { maxHeight: 480 },
    modalRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      marginBottom: 8,
      gap: 12,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    modalRowActive: { borderColor: Colors.primary, borderWidth: 1.5 },
    modalAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    modalAvatarText: { fontSize: 14, fontWeight: "800" as const },
    modalName: { flex: 1, fontSize: 16, fontWeight: "700" as const, color: Colors.text },

    modalAddBlock: {
      marginTop: 8,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
    },
    modalAddLabel: {
      fontSize: 12,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 1.1,
      marginBottom: 10,
      marginLeft: 4,
    },
    modalAddRow: {
      flexDirection: "row" as const,
      gap: 10,
    },
    modalAddInput: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600" as const,
      color: Colors.text,
      backgroundColor: Colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    modalAddBtn: {
      width: 52,
      height: 52,
      borderRadius: 12,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
  });
}
