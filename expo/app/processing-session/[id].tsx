import React, { useCallback, useRef, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import {
  Plus,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader,
  Trash2,
  Syringe,
  Droplet,
  Pill,
  ClipboardCheck,
  Tag,
  Users,
  ClipboardList,
  MoreVertical,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useProcessingSessions } from "@/providers/ProcessingSessionProvider";
import { useRanch } from "@/providers/RanchProvider";
import { SessionGroup, SessionEvent, SessionGroupStatus, HealthEventType } from "@/types";
import { HEALTH_EVENT_TYPE_CONFIG } from "@/constants/health";
import { formatDate } from "@/utils/helpers";

const GROUP_STATUS_CONFIG: Record<SessionGroupStatus, { label: string; color: string; icon: React.ComponentType<{ size: number; color: string }> }> = {
  not_started: { label: "Not Started", color: "#9B9B9B", icon: Circle },
  in_progress: { label: "In Progress", color: "#D4943A", icon: Loader },
  completed: { label: "Completed", color: "#3D8B5E", icon: CheckCircle2 },
};

const STATUS_CYCLE: SessionGroupStatus[] = ["not_started", "in_progress", "completed"];

const EVENT_TYPE_ICONS: Record<HealthEventType, React.ComponentType<{ size: number; color: string }>> = {
  vaccination: Syringe,
  blood_test: Droplet,
  treatment: Pill,
  inspection: ClipboardCheck,
  custom: Tag,
};

function GroupCard({
  group,
  events,
  onStatusChange,
  onRemove,
}: {
  group: SessionGroup;
  events: SessionEvent[];
  onStatusChange: () => void;
  onRemove: () => void;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const statusConfig = GROUP_STATUS_CONFIG[group.status];
  const StatusIcon = statusConfig.icon;

  const handleLongPress = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(group.name, "What would you like to do?", [
      { text: "Remove from Session", onPress: onRemove, style: "destructive" },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [group.name, onRemove]);

  return (
    <Animated.View style={[styles.groupCard, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.groupCardInner}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        onLongPress={handleLongPress}
        activeOpacity={1}
      >
        <View style={styles.groupHeader}>
          <View style={[styles.groupIcon, { backgroundColor: statusConfig.color + "18" }]}>
            <Users size={16} color={statusConfig.color} />
          </View>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
            {events.length > 0 && (
              <Text style={styles.groupEventCount}>
                {events.length} event{events.length > 1 ? "s" : ""}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.statusBtn, { backgroundColor: statusConfig.color + "14", borderColor: statusConfig.color + "30" }]}
            onPress={onStatusChange}
            activeOpacity={0.7}
          >
            <StatusIcon size={14} color={statusConfig.color} />
            <Text style={[styles.statusBtnText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function EventRow({ event, onDelete }: { event: SessionEvent; onDelete: () => void }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const config = HEALTH_EVENT_TYPE_CONFIG[event.type];
  const Icon = EVENT_TYPE_ICONS[event.type];

  return (
    <View style={styles.eventRow}>
      <View style={[styles.eventIcon, { backgroundColor: config.color + "14" }]}>
        <Icon size={14} color={config.color} />
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
        <Text style={styles.eventMeta}>{formatDate(event.completedDate)}</Text>
      </View>
      <TouchableOpacity
        onPress={onDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Trash2 size={14} color={Colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

export default function ProcessingSessionDetailScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getSessionById, updateGroupStatus, removeGroupFromSession, deleteSessionEvent, getSessionProgress } = useProcessingSessions();
  const { getBusinessYearName } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const session = getSessionById(id ?? "");

  const progress = useMemo(
    () => (session ? getSessionProgress(session) : { completed: 0, total: 0, label: "Unknown" }),
    [session, getSessionProgress],
  );

  const handleCycleStatus = useCallback(
    async (groupId: string, currentStatus: SessionGroupStatus) => {
      if (!session) return;
      const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
      const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        await updateGroupStatus({ sessionId: session.id, groupId, status: nextStatus });
      } catch (e) {
        console.log("Error updating group status:", e);
      }
    },
    [session, updateGroupStatus],
  );

  const handleRemoveGroup = useCallback(
    (group: SessionGroup) => {
      if (!session) return;
      Alert.alert("Remove Group", `Remove "${group.name}" from this session?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeGroupFromSession({ sessionId: session.id, groupId: group.id });
            } catch (e) {
              console.log("Error removing group:", e);
            }
          },
        },
      ]);
    },
    [session, removeGroupFromSession],
  );

  const handleDeleteEvent = useCallback(
    (event: SessionEvent) => {
      if (!session) return;
      Alert.alert("Delete Event", `Delete "${event.name}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSessionEvent({ sessionId: session.id, eventId: event.id });
            } catch (e) {
              console.log("Error deleting event:", e);
            }
          },
        },
      ]);
    },
    [session, deleteSessionEvent],
  );

  if (!session) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Session" }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Session not found</Text>
        </View>
      </View>
    );
  }

  const yearName = getBusinessYearName(session.businessYearId) || "Unknown Year";
  const progressPercent = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
  const statusColor = progress.label === "Completed" ? Colors.success : progress.label === "In Progress" ? Colors.warning : Colors.textTertiary;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: session.name }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>{session.name}</Text>
          <View style={styles.heroMeta}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{yearName}</Text>
            </View>
            <Text style={styles.heroDate}>Created {formatDate(session.createdAt)}</Text>
          </View>
          <View style={styles.heroProgress}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: statusColor }]} />
            </View>
            <View style={styles.progressMeta}>
              <Text style={[styles.progressLabel, { color: statusColor }]}>{progress.label}</Text>
              <Text style={styles.progressCount}>{progress.completed}/{progress.total} groups</Text>
            </View>
          </View>
          {session.notes ? (
            <Text style={styles.heroNotes}>{session.notes}</Text>
          ) : null}
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Groups</Text>
            <TouchableOpacity
              style={styles.addInlineBtn}
              onPress={() => router.push(`/add-group-to-session?sessionId=${session.id}`)}
            >
              <Plus size={14} color={Colors.primary} />
              <Text style={styles.addInlineBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {session.groups.length === 0 ? (
            <View style={styles.emptySectionBlock}>
              <Text style={styles.emptySectionText}>No groups assigned yet</Text>
            </View>
          ) : (
            session.groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                events={session.events.filter((e) => e.groupId === group.id)}
                onStatusChange={() => handleCycleStatus(group.id, group.status)}
                onRemove={() => handleRemoveGroup(group)}
              />
            ))
          )}
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Events Logged</Text>
            <Text style={styles.sectionCount}>{session.events.length}</Text>
          </View>

          {session.events.length === 0 ? (
            <View style={styles.emptySectionBlock}>
              <Text style={styles.emptySectionText}>No events logged yet</Text>
            </View>
          ) : (
            <View style={styles.eventsContainer}>
              {session.events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onDelete={() => handleDeleteEvent(event)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {session.groups.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push(`/log-session-event?sessionId=${session.id}`);
          }}
          activeOpacity={0.85}
          testID="log-session-event-fab"
        >
          <Syringe size={20} color={Colors.textInverse} />
          <Text style={styles.fabLabel}>Log Event</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { paddingBottom: 100 },
    notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
    notFoundText: { fontSize: 16, color: Colors.textSecondary },
    heroSection: {
      backgroundColor: Colors.surface,
      margin: 16,
      borderRadius: 18,
      padding: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    heroTitle: { fontSize: 24, fontWeight: "800" as const, color: Colors.text, letterSpacing: -0.5 },
    heroMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
    heroBadge: { backgroundColor: Colors.primary + "12", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    heroBadgeText: { fontSize: 12, fontWeight: "700" as const, color: Colors.primary },
    heroDate: { fontSize: 12, color: Colors.textTertiary },
    heroProgress: { marginTop: 16 },
    progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: "hidden" as const },
    progressFill: { height: "100%", borderRadius: 4 },
    progressMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    progressLabel: { fontSize: 13, fontWeight: "700" as const },
    progressCount: { fontSize: 12, color: Colors.textTertiary, fontWeight: "500" as const },
    heroNotes: { fontSize: 13, color: Colors.textSecondary, marginTop: 12, lineHeight: 19 },
    sectionBlock: { paddingHorizontal: 16, marginTop: 8, marginBottom: 12 },
    sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionTitle: { fontSize: 17, fontWeight: "800" as const, color: Colors.text, letterSpacing: -0.2 },
    sectionCount: { fontSize: 13, fontWeight: "600" as const, color: Colors.textTertiary },
    addInlineBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primary + "0D" },
    addInlineBtnText: { fontSize: 13, fontWeight: "600" as const, color: Colors.primary },
    groupCard: { marginBottom: 8 },
    groupCardInner: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      padding: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
    groupHeader: { flexDirection: "row", alignItems: "center" },
    groupIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 12 },
    groupInfo: { flex: 1 },
    groupName: { fontSize: 15, fontWeight: "700" as const, color: Colors.text },
    groupEventCount: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
    statusBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
    },
    statusBtnText: { fontSize: 11, fontWeight: "700" as const },
    emptySectionBlock: { backgroundColor: Colors.surface, borderRadius: 14, padding: 24, alignItems: "center" },
    emptySectionText: { fontSize: 14, color: Colors.textTertiary },
    eventsContainer: {
      backgroundColor: Colors.surface,
      borderRadius: 14,
      overflow: "hidden" as const,
    },
    eventRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    eventIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", marginRight: 10 },
    eventInfo: { flex: 1 },
    eventName: { fontSize: 14, fontWeight: "600" as const, color: Colors.text },
    eventMeta: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
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
    fabLabel: { fontSize: 15, fontWeight: "700" as const, color: Colors.textInverse },
  });
