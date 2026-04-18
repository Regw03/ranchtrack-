import React, { useCallback, useRef, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import {
  Plus,
  ChevronRight,
  Trash2,
  ClipboardList,
  Calendar,
  CheckCircle2,
  Circle,
  Loader,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useProcessingSessions } from "@/providers/ProcessingSessionProvider";
import { useRanch } from "@/providers/RanchProvider";
import { ProcessingSession } from "@/types";
import { formatDate } from "@/utils/helpers";

const STATUS_COLORS = {
  "Not Started": "#9B9B9B",
  "In Progress": "#D4943A",
  "Completed": "#3D8B5E",
};

function SessionCard({
  session,
  yearName,
  onPress,
  onDelete,
}: {
  session: ProcessingSession;
  yearName: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  const Colors = useColors();
  const { getSessionProgress } = useProcessingSessions();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const progress = getSessionProgress(session);
  const statusColor = STATUS_COLORS[progress.label as keyof typeof STATUS_COLORS] ?? Colors.textTertiary;

  const progressPercent = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  const handleLongPress = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(session.name, "What would you like to do?", [
      { text: "Delete", onPress: onDelete, style: "destructive" },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [session.name, onDelete]);

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.cardInner}
        onPress={onPress}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        onLongPress={handleLongPress}
        activeOpacity={1}
        testID={`session-card-${session.id}`}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle} numberOfLines={1}>{session.name}</Text>
            <View style={styles.cardMeta}>
              <Calendar size={11} color={Colors.textTertiary} />
              <Text style={styles.cardYear}>{yearName}</Text>
              <View style={styles.metaDot} />
              <Text style={styles.cardDate}>{formatDate(session.createdAt)}</Text>
            </View>
          </View>
          <ChevronRight size={18} color={Colors.textTertiary} />
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: statusColor }]} />
          </View>
          <View style={styles.progressInfo}>
            <Text style={[styles.progressLabel, { color: statusColor }]}>{progress.label}</Text>
            <Text style={styles.progressCount}>
              {progress.completed}/{progress.total} groups
            </Text>
          </View>
        </View>

        {session.events.length > 0 && (
          <View style={styles.eventsBadge}>
            <ClipboardList size={12} color={Colors.textSecondary} />
            <Text style={styles.eventsBadgeText}>
              {session.events.length} event{session.events.length > 1 ? "s" : ""} logged
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ProcessingSessionsScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { sessions, deleteSession } = useProcessingSessions();
  const { activeBusinessYear, businessYears, getBusinessYearName } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const filteredSessions = useMemo(
    () => sessions.filter((s) => s.businessYearId === activeBusinessYear.id),
    [sessions, activeBusinessYear.id],
  );

  const allTimeSessions = useMemo(
    () => sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [sessions],
  );

  const handleDelete = useCallback(
    (session: ProcessingSession) => {
      Alert.alert("Delete Session", `Delete "${session.name}"? This cannot be undone.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSession(session.id);
              if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              console.log("Error deleting session:", e);
            }
          },
        },
      ]);
    },
    [deleteSession],
  );

  const renderItem = useCallback(
    ({ item }: { item: ProcessingSession }) => (
      <SessionCard
        session={item}
        yearName={getBusinessYearName(item.businessYearId) || "Unknown Year"}
        onPress={() => router.push(`/processing-session/${item.id}`)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [router, getBusinessYearName, handleDelete],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Processing Sessions" }} />

      <FlatList
        data={allTimeSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Processing Sessions</Text>
            <Text style={styles.subtitle}>
              {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""} this year
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No processing sessions yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a session to track seasonal processing like spring turnout or fall processing
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/create-processing-session");
        }}
        activeOpacity={0.85}
        testID="create-session-fab"
      >
        <Plus size={22} color={Colors.textInverse} />
        <Text style={styles.fabLabel}>New Session</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    listContent: { paddingBottom: 100 },
    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    screenTitle: { fontSize: 28, fontWeight: "800" as const, color: Colors.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
    card: { paddingHorizontal: 16, paddingTop: 8 },
    cardInner: {
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    cardHeader: { flexDirection: "row", alignItems: "center" },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
    cardTitleWrap: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: "700" as const, color: Colors.text, letterSpacing: -0.2 },
    cardMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
    cardYear: { fontSize: 12, color: Colors.textTertiary, fontWeight: "500" as const },
    metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textTertiary },
    cardDate: { fontSize: 12, color: Colors.textTertiary },
    progressSection: { marginTop: 14 },
    progressBar: {
      height: 6,
      backgroundColor: Colors.border,
      borderRadius: 3,
      overflow: "hidden" as const,
    },
    progressFill: { height: "100%", borderRadius: 3 },
    progressInfo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
    progressLabel: { fontSize: 12, fontWeight: "700" as const },
    progressCount: { fontSize: 12, color: Colors.textTertiary, fontWeight: "500" as const },
    eventsBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
    },
    eventsBadgeText: { fontSize: 12, color: Colors.textSecondary, fontWeight: "500" as const },
    empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text },
    emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" as const, marginTop: 6, lineHeight: 20 },
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
