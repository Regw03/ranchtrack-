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
  KeyboardAvoidingView,
} from "react-native";
import {
  Pencil,
  Shield,
  UserPlus,
  UserCog,
  X,
  Plus,
  Crown,
  Star,
  Settings as SettingsIcon,
  ChevronRight,
  Check,
  RotateCcw,
  Lock,
} from "lucide-react-native";
import type { UserRole, RanchMember } from "@/types";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { getInitials } from "@/utils/helpers";

export default function RanchProfileScreen() {
  const Colors = useColors();
  const router = useRouter();
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
    resetApp,
    isResettingApp,
    canInviteTeammates,
    inviteTeammate,
    isInvitingTeammate,
    currentUserRole,
  } = useRanch();

  const [editingRanchName, setEditingRanchName] = useState<boolean>(false);
  const [ranchDraft, setRanchDraft] = useState<string>(ranch.name);

  const [editingUserName, setEditingUserName] = useState<boolean>(false);
  const [userDraft, setUserDraft] = useState<string>(currentUser?.name ?? "");

  const [switchOpen, setSwitchOpen] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>("");

  const [inviteOpen, setInviteOpen] = useState<boolean>(false);
  const [inviteName, setInviteName] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<"manager" | "member">("member");

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
      setEditingRanchName(false);
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
      setEditingRanchName(false);
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
      setEditingUserName(false);
      return;
    }
    if (!currentUserId) {
      setEditingUserName(false);
      return;
    }
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
      setEditingUserName(false);
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

  const handleOpenInvite = useCallback(() => {
    if (!canInviteTeammates) {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInviteName("");
    setInviteRole("member");
    setInviteOpen(true);
  }, [canInviteTeammates]);

  const handleConfirmInvite = useCallback(async () => {
    // The invite code flow is the correct way to add team members
    // Close the modal and show instructions
    setInviteOpen(false);
    const inviteCode = ranch.inviteCode;
    if (inviteCode) {
      Alert.alert(
        "Share Invite Code",
        `Share this code with your team member:\n\n${inviteCode}\n\nThey will use it when signing up for RanchTrack to join your ranch.`,
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "No Invite Code",
        "Go to Settings to generate an invite code first.",
        [{ text: "OK" }]
      );
    }
  }, [ranch.inviteCode, setInviteOpen]);

  const handleResetApp = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const doReset = async () => {
      try {
        await resetApp();
        if (Platform.OS !== "web")
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/onboarding/welcome");
      } catch (e) {
        console.log("Failed to reset app", e);
        Alert.alert("Couldn't reset", "Please try again.");
      }
    };
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" && window.confirm(
        "Reset app? This will delete all ranch data and return to the welcome screen.",
      );
      if (ok) void doReset();
      return;
    }
    Alert.alert(
      "Reset App?",
      "This will delete all ranch data on this device and return to the welcome screen. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void doReset();
          },
        },
      ],
    );
  }, [resetApp, router]);

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
          <TouchableOpacity
            style={styles.heroNameRow}
            activeOpacity={0.7}
            onPress={handleStartEditRanch}
            testID="edit-ranch-name"
            disabled={editingRanchName}
          >
            <Text style={styles.heroName} numberOfLines={2}>
              {ranch.name || "Your Ranch"}
            </Text>
            {!editingRanchName && (
              <View style={styles.editChip}>
                <Pencil size={14} color={Colors.primary} />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.heroSubtitle}>
            Owned by {owner?.name ?? currentUser?.name ?? "\u2014"}
          </Text>

          {editingRanchName && (
            <View style={styles.inlineEditCard}>
              <Text style={styles.inlineEditLabel}>Ranch name</Text>
              <TextInput
                value={ranchDraft}
                onChangeText={setRanchDraft}
                style={styles.inlineEditInput}
                autoFocus
                autoCapitalize="words"
                maxLength={60}
                onSubmitEditing={handleSaveRanchName}
                returnKeyType="done"
                placeholder="e.g. Bar M Ranch"
                placeholderTextColor={Colors.textTertiary}
                testID="ranch-name-edit"
              />
              <View style={styles.inlineEditActions}>
                <TouchableOpacity
                  style={styles.inlineCancelBtn}
                  onPress={() => setEditingRanchName(false)}
                  activeOpacity={0.8}
                  disabled={isSettingRanchName}
                  testID="cancel-ranch-name"
                >
                  <Text style={styles.inlineCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.inlineSaveBtn,
                    (isSettingRanchName ||
                      ranchDraft.trim().length === 0 ||
                      ranchDraft.trim() === ranch.name) &&
                      styles.inlineSaveBtnDisabled,
                  ]}
                  onPress={handleSaveRanchName}
                  disabled={
                    isSettingRanchName ||
                    ranchDraft.trim().length === 0 ||
                    ranchDraft.trim() === ranch.name
                  }
                  activeOpacity={0.85}
                  testID="save-ranch-name"
                >
                  {isSettingRanchName ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.inlineSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <Section title="Team Members" Colors={Colors}>
          {ranch.members.map((m) => {
            const isYou = m.userId === currentUserId;
            const meta = getRoleMeta(m.role, Colors);
            return (
              <TouchableOpacity
                key={m.userId}
                style={styles.memberRow}
                testID={`member-${m.userId}`}
                activeOpacity={0.7}
                onPress={() => {
                  if (Platform.OS !== "web") void Haptics.selectionAsync();
                  Alert.alert(
                    m.name,
                    `${meta.label}${isYou ? " \u2014 that's you" : ""}\n\n${meta.description}`,
                  );
                }}
              >
                <View
                  style={[
                    styles.memberAvatar,
                    { backgroundColor: meta.avatarColor },
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
                    <View style={[styles.roleBadge, { backgroundColor: meta.color + "1F" }]}>
                      {meta.icon === "crown" && <Crown size={12} color={meta.color} />}
                      {meta.icon === "star" && <Star size={12} color={meta.color} />}
                      {meta.icon === "shield" && <Shield size={12} color={meta.color} />}
                      <Text style={[styles.roleBadgeText, { color: meta.color }]}>
                        {meta.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.inviteCta, !canInviteTeammates && styles.inviteCtaDisabled]}
            activeOpacity={canInviteTeammates ? 0.7 : 1}
            onPress={handleOpenInvite}
            disabled={!canInviteTeammates}
            testID="invite-teammate-btn"
          >
            <View
              style={[
                styles.inviteIcon,
                {
                  backgroundColor: canInviteTeammates
                    ? Colors.primary + "1F"
                    : Colors.backgroundDark,
                },
              ]}
            >
              {canInviteTeammates ? (
                <UserPlus size={18} color={Colors.primary} />
              ) : (
                <Lock size={16} color={Colors.textTertiary} />
              )}
            </View>
            <View style={styles.inviteBody}>
              <Text
                style={[
                  styles.inviteTitle,
                  { color: canInviteTeammates ? Colors.text : Colors.textTertiary },
                ]}
              >
                Invite a teammate
              </Text>
              <Text style={styles.inviteSubtitle}>
                {canInviteTeammates
                  ? "Add a new member to your ranch"
                  : "Only owners or managers can invite teammates"}
              </Text>
            </View>
            {canInviteTeammates && <ChevronRight size={18} color={Colors.textTertiary} />}
          </TouchableOpacity>
        </Section>

        <Section title="You" Colors={Colors}>
          {editingUserName ? (
            <View style={styles.inlineEditCard}>
              <Text style={styles.inlineEditLabel}>Your name</Text>
              <TextInput
                value={userDraft}
                onChangeText={setUserDraft}
                style={styles.inlineEditInput}
                autoFocus
                autoCapitalize="words"
                maxLength={40}
                onSubmitEditing={handleSaveUserName}
                returnKeyType="done"
                placeholder="Your name"
                placeholderTextColor={Colors.textTertiary}
                testID="user-name-edit"
              />
              <View style={styles.inlineEditActions}>
                <TouchableOpacity
                  style={styles.inlineCancelBtn}
                  onPress={() => setEditingUserName(false)}
                  activeOpacity={0.8}
                  disabled={isUpdatingUserName}
                  testID="cancel-user-name"
                >
                  <Text style={styles.inlineCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.inlineSaveBtn,
                    (isUpdatingUserName ||
                      userDraft.trim().length === 0 ||
                      userDraft.trim() === (currentUser?.name ?? "")) &&
                      styles.inlineSaveBtnDisabled,
                  ]}
                  onPress={handleSaveUserName}
                  disabled={
                    isUpdatingUserName ||
                    userDraft.trim().length === 0 ||
                    userDraft.trim() === (currentUser?.name ?? "")
                  }
                  activeOpacity={0.85}
                  testID="save-user-name"
                >
                  {isUpdatingUserName ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.inlineSaveText}>Save</Text>
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

          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/settings");
            }}
            testID="open-settings"
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.textSecondary + "18" }]}>
              <SettingsIcon size={20} color={Colors.textSecondary} />
            </View>
            <View style={styles.actionBody}>
              <Text style={styles.actionTitle}>App Settings</Text>
              <Text style={styles.actionSubtitle}>Theme, business year, data</Text>
            </View>
            <ChevronRight size={18} color={Colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, isResettingApp && styles.actionRowDisabled]}
            activeOpacity={0.7}
            onPress={handleResetApp}
            disabled={isResettingApp}
            testID="reset-app-btn"
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.error + "18" }]}>
              {isResettingApp ? (
                <ActivityIndicator color={Colors.error} />
              ) : (
                <RotateCcw size={20} color={Colors.error} />
              )}
            </View>
            <View style={styles.actionBody}>
              <Text style={[styles.actionTitle, { color: Colors.error }]}>Reset App</Text>
              <Text style={styles.actionSubtitle}>
                Clear all data and return to welcome screen
              </Text>
            </View>
          </TouchableOpacity>
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

      <InviteTeammateModal
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        name={inviteName}
        setName={setInviteName}
        role={inviteRole}
        setRole={setInviteRole}
        onConfirm={handleConfirmInvite}
        isInviting={isInvitingTeammate}
        canInvite={canInviteTeammates}
        inviterRole={currentUserRole}
        Colors={Colors}
      />
    </>
  );
}

function getRoleMeta(
  role: UserRole,
  Colors: ThemeColors,
): {
  label: string;
  icon: "crown" | "star" | "shield";
  color: string;
  avatarColor: string;
  description: string;
} {
  switch (role) {
    case "owner":
      return {
        label: "Owner",
        icon: "crown",
        color: Colors.accent,
        avatarColor: Colors.accent,
        description: "Full control \u2014 can invite anyone and manage the ranch.",
      };
    case "manager":
      return {
        label: "Manager",
        icon: "star",
        color: Colors.primary,
        avatarColor: Colors.primary,
        description: "Can invite teammates and manage day-to-day work.",
      };
    case "worker":
    case "member":
    default:
      return {
        label: "Member",
        icon: "shield",
        color: Colors.textSecondary,
        avatarColor: Colors.textSecondary,
        description: "Can view and log work. Cannot invite teammates.",
      };
  }
}

function InviteTeammateModal({
  visible,
  onClose,
  name,
  setName,
  role,
  setRole,
  onConfirm,
  isInviting,
  canInvite,
  inviterRole,
  Colors,
}: {
  visible: boolean;
  onClose: () => void;
  name: string;
  setName: (s: string) => void;
  role: "manager" | "member";
  setRole: (r: "manager" | "member") => void;
  onConfirm: () => void;
  isInviting: boolean;
  canInvite: boolean;
  inviterRole: RanchMember["role"] | null;
  Colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const trimmed = name.trim();
  const disabled = isInviting || trimmed.length === 0 || !canInvite;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalBackdrop}
      >
        <ScrollView
          contentContainerStyle={styles.modalScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite Teammate</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose} activeOpacity={0.7}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>
            {canInvite
              ? `Inviting as ${inviterRole === "owner" ? "Owner" : "Manager"}. New teammates can be added as Manager or Member.`
              : "Only owners or managers can invite teammates."}
          </Text>

          <View style={styles.inviteFieldBlock}>
            <Text style={styles.inviteFieldLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sam"
              placeholderTextColor={Colors.textTertiary}
              style={styles.modalAddInput}
              autoCapitalize="words"
              maxLength={40}
              autoFocus={canInvite}
              editable={canInvite}
              onSubmitEditing={onConfirm}
              returnKeyType="done"
              testID="invite-name-input"
            />
          </View>

          <View style={styles.inviteFieldBlock}>
            <Text style={styles.inviteFieldLabel}>Role</Text>
            <View style={styles.roleOptions}>
              {(
                [
                  { value: "member" as const, label: "Member", desc: "View and log work", icon: "shield" as const },
                  { value: "manager" as const, label: "Manager", desc: "Can invite teammates", icon: "star" as const },
                ]
              ).map((opt) => {
                const selected = role === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.roleOption,
                      selected && {
                        borderColor: Colors.primary,
                        backgroundColor: Colors.primary + "12",
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (Platform.OS !== "web") void Haptics.selectionAsync();
                      setRole(opt.value);
                    }}
                    disabled={!canInvite}
                    testID={`invite-role-${opt.value}`}
                  >
                    <View
                      style={[
                        styles.roleOptionIcon,
                        {
                          backgroundColor: selected ? Colors.primary : Colors.backgroundDark,
                        },
                      ]}
                    >
                      {opt.icon === "star" ? (
                        <Star size={16} color={selected ? "#fff" : Colors.textSecondary} />
                      ) : (
                        <Shield size={16} color={selected ? "#fff" : Colors.textSecondary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleOptionLabel}>{opt.label}</Text>
                      <Text style={styles.roleOptionDesc}>{opt.desc}</Text>
                    </View>
                    {selected && <Check size={18} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.inviteConfirmBtn,
              { backgroundColor: disabled ? Colors.border : Colors.primary },
            ]}
            onPress={onConfirm}
            disabled={disabled}
            activeOpacity={0.85}
            testID="confirm-invite-btn"
          >
            {isInviting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <UserPlus size={18} color="#fff" />
                <Text style={styles.inviteConfirmText}>Send Invite</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
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
    inlineEditCard: {
      width: "100%" as const,
      marginTop: 16,
      backgroundColor: Colors.background,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1.5,
      borderColor: Colors.primary,
    },
    inlineEditLabel: {
      fontSize: 12,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
      marginBottom: 8,
    },
    inlineEditInput: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: Colors.text,
      backgroundColor: Colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    inlineEditActions: {
      flexDirection: "row" as const,
      gap: 10,
      marginTop: 12,
    },
    inlineCancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: Colors.backgroundDark,
      alignItems: "center" as const,
    },
    inlineCancelText: { fontSize: 15, fontWeight: "700" as const, color: Colors.textSecondary },
    inlineSaveBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: Colors.primary,
      alignItems: "center" as const,
    },
    inlineSaveBtnDisabled: { opacity: 0.5 },
    inlineSaveText: { fontSize: 15, fontWeight: "800" as const, color: "#fff" },
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

    inviteCta: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: Colors.borderLight,
      borderStyle: "dashed" as const,
      gap: 4,
    },
    inviteCtaDisabled: { opacity: 0.85 },
    roleBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: "800" as const,
      letterSpacing: 0.3,
    },
    inviteFieldBlock: {
      marginTop: 14,
    },
    inviteFieldLabel: {
      fontSize: 12,
      fontWeight: "800" as const,
      color: Colors.textSecondary,
      textTransform: "uppercase" as const,
      letterSpacing: 1.1,
      marginBottom: 8,
      marginLeft: 4,
    },
    roleOptions: { gap: 10 },
    roleOption: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Colors.borderLight,
      backgroundColor: Colors.surface,
    },
    roleOptionIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    roleOptionLabel: {
      fontSize: 15,
      fontWeight: "800" as const,
      color: Colors.text,
    },
    roleOptionDesc: {
      fontSize: 12,
      fontWeight: "500" as const,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    inviteConfirmBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
      paddingVertical: 16,
      borderRadius: 14,
      marginTop: 18,
    },
    inviteConfirmText: {
      fontSize: 16,
      fontWeight: "800" as const,
      color: "#fff",
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
    modalScrollContent: {
      flexGrow: 1,
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