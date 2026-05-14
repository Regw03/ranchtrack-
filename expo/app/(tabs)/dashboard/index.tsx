import React, { useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  Stethoscope,
  ClipboardList,
  Plus,
  ChevronRight,
  Activity,
  CircleDot,
  CheckCircle2,
  Clock,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { useProcessingSessions } from "@/providers/ProcessingSessionProvider";
import { Animal, DoctoringEvent, ProcessingSession } from "@/types";

function QuickActionButton({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}) {
  const Colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={[styles.quickActionWrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.quickAction}
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: color + "18" }]}>
          {icon}
        </View>
        <Text style={styles.quickActionLabel} numberOfLines={1}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function AttentionItem({
  animal,
  event,
  onPress,
}: {
  animal: Animal;
  event: DoctoringEvent;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const typeLabel = event.type === "custom" ? (event.customTypeName || "Custom") : event.type;

  return (
    <TouchableOpacity
      style={styles.attentionItem}
      onPress={() => {
        if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
      testID={`attention-${animal.id}`}
    >
      <View style={styles.attentionDot} />
      <View style={styles.attentionContent}>
        <Text style={styles.attentionTag}>{animal.tagId}</Text>
        <Text style={styles.attentionNote} numberOfLines={1}>
          {typeLabel}{event.notes ? ` — ${event.notes}` : ""}
        </Text>
      </View>
      <ChevronRight size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

function SessionCard({
  session,
  statusLabel,
  statusColor,
  onPress,
}: {
  session: ProcessingSession;
  statusLabel: string;
  statusColor: string;
  onPress: () => void;
}) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const StatusIcon = statusLabel === "Completed"
    ? CheckCircle2
    : statusLabel === "In Progress"
      ? Activity
      : Clock;

  return (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={() => {
        if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={styles.sessionCardTop}>
        <View style={[styles.sessionStatusIcon, { backgroundColor: statusColor + "18" }]}>
          <StatusIcon size={16} color={statusColor} />
        </View>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionName} numberOfLines={2}>{session.name}</Text>
          <Text style={styles.sessionMeta}>
            {session.groups.length} group{session.groups.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <ChevronRight size={16} color={Colors.textTertiary} />
      </View>
      <View style={styles.sessionBadge}>
        <View style={[styles.sessionBadgeDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.sessionBadgeText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const Colors = useColors();
  const router = useRouter();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const {
    needsAttentionAnimals,
    doctoringEvents,
    activeBusinessYear,
  } = useRanch();

  const { sessions, getSessionProgress } = useProcessingSessions();

  const attentionItems = useMemo(() => {
    const items: { animal: Animal; event: DoctoringEvent }[] = [];
    const seen = new Set<string>();
    for (const animal of needsAttentionAnimals) {
      if (seen.has(animal.id)) continue;
      seen.add(animal.id);
      const latestEvent = doctoringEvents
        .filter((e) => e.animalId === animal.id && e.followUpNeeded && !e.resolved)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (latestEvent) {
        items.push({ animal, event: latestEvent });
      }
    }
    return items;
  }, [needsAttentionAnimals, doctoringEvents]);

  const activeSessions = useMemo(() => {
    return sessions
      .filter((s) => s.businessYearId === activeBusinessYear.id)
      .map((s) => {
        const progress = getSessionProgress(s);
        let statusColor = Colors.textTertiary;
        if (progress.label === "Completed") statusColor = Colors.success;
        else if (progress.label === "In Progress") statusColor = Colors.warning;
        return { session: s, ...progress, statusColor };
      });
  }, [sessions, activeBusinessYear.id, getSessionProgress, Colors]);

  const hasAttention = attentionItems.length > 0;
  const hasProcessing = activeSessions.length > 0;

  const handleQuickAction = useCallback((route: string) => {
    router.push(route as never);
  }, [router]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Today's Ranch</Text>
        <Text style={styles.yearBadge}>{activeBusinessYear.name}</Text>
      </View>

      <View style={styles.quickActionsGrid}>
        <QuickActionButton
          label="Add Cow"
          icon={<Plus size={22} color="#3D8B5E" />}
          color="#3D8B5E"
          onPress={() => handleQuickAction("/add-animal")}
        />
        <QuickActionButton
          label="Process"
          icon={<ClipboardList size={22} color="#D4943A" />}
          color="#D4943A"
          onPress={() => handleQuickAction("/processing-sessions")}
        />
        <QuickActionButton
          label="Doctor"
          icon={<Stethoscope size={22} color="#C44D3D" />}
          color="#C44D3D"
          onPress={() => handleQuickAction("/log-doctoring-event")}
        />
      </View>

      {hasAttention && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/needs-attention");
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <AlertTriangle size={16} color="#C44D3D" />
              </View>
              <Text style={styles.sectionTitle}>Needs Attention</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{attentionItems.length}</Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
          <View style={styles.sectionBody}>
            {attentionItems.slice(0, 5).map((item) => (
              <AttentionItem
                key={item.animal.id}
                animal={item.animal}
                event={item.event}
                onPress={() => router.push(`/animal/${item.animal.id}`)}
              />
            ))}
            {attentionItems.length > 5 && (
              <TouchableOpacity
                style={styles.seeAllBtn}
                onPress={() => router.push("/needs-attention")}
              >
                <Text style={styles.seeAllText}>
                  See all {attentionItems.length} animals
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {hasProcessing && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/processing-sessions");
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: "#D4943A" + "18" }]}>
                <ClipboardList size={16} color="#D4943A" />
              </View>
              <Text style={styles.sectionTitle}>Processing Sessions</Text>
            </View>
            <ChevronRight size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
          <View style={styles.sectionBody}>
            {activeSessions.map((s) => (
              <SessionCard
                key={s.session.id}
                session={s.session}
                statusLabel={s.label}
                statusColor={s.statusColor}
                onPress={() => router.push(`/processing-session/${s.session.id}`)}
              />
            ))}
          </View>
        </View>
      )}

      {!hasAttention && !hasProcessing && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <CircleDot size={36} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>All Clear</Text>
          <Text style={styles.emptySubtitle}>
            Nothing needs your attention right now. Use the quick actions above to get started.
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const createStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      paddingBottom: 20,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 6,
    },
    greeting: {
      fontSize: 26,
      fontWeight: "800" as const,
      color: Colors.text,
      letterSpacing: -0.5,
    },
    yearBadge: {
      fontSize: 12,
      fontWeight: "700" as const,
      color: Colors.primary,
      backgroundColor: Colors.primary + "12",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    quickActionsGrid: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 8,
      gap: 10,
    },
    quickActionWrap: {
      flex: 1,
    },
    quickAction: {
      backgroundColor: Colors.surface,
      borderRadius: 16,
      paddingVertical: 18,
      paddingHorizontal: 8,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    quickActionIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    quickActionLabel: {
      fontSize: 11,
      fontWeight: "700" as const,
      color: Colors.text,
      textAlign: "center",
    },
    section: {
      marginTop: 20,
      marginHorizontal: 16,
      backgroundColor: Colors.surface,
      borderRadius: 18,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
    },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    sectionIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: "#C44D3D" + "18",
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "800" as const,
      color: Colors.text,
      letterSpacing: -0.2,
    },
    countBadge: {
      backgroundColor: "#C44D3D",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      minWidth: 24,
      alignItems: "center",
    },
    countBadgeText: {
      fontSize: 12,
      fontWeight: "700" as const,
      color: "#FFFFFF",
    },
    sectionBody: {
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    attentionItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    attentionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#C44D3D",
      marginRight: 12,
    },
    attentionContent: {
      flex: 1,
    },
    attentionTag: {
      fontSize: 15,
      fontWeight: "700" as const,
      color: Colors.text,
    },
    attentionNote: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    seeAllBtn: {
      paddingVertical: 12,
      alignItems: "center",
    },
    seeAllText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: Colors.primary,
    },
    calvingCard: {
      backgroundColor: Colors.background,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
    },
    calvingCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    calvingColorDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 10,
    },
    calvingName: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700" as const,
      color: Colors.text,
    },
    calvingStats: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    calvingStat: {
      flex: 1,
      alignItems: "center",
    },
    calvingStatNum: {
      fontSize: 20,
      fontWeight: "800" as const,
      color: Colors.text,
    },
    calvingStatLabel: {
      fontSize: 11,
      fontWeight: "600" as const,
      color: Colors.textTertiary,
      marginTop: 1,
    },
    calvingStatDivider: {
      width: 1,
      height: 28,
      backgroundColor: Colors.borderLight,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.borderLight,
      overflow: "hidden",
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.success,
    },
    sessionCard: {
      backgroundColor: Colors.background,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
    },
    sessionCardTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    sessionStatusIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    sessionInfo: {
      flex: 1,
      marginRight: 4,
    },
    sessionName: {
      fontSize: 15,
      fontWeight: "700" as const,
      color: Colors.text,
    },
    sessionMeta: {
      fontSize: 12,
      color: Colors.textTertiary,
      marginTop: 2,
    },
    sessionBadge: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      marginLeft: 48,
      gap: 6,
    },
    sessionBadgeDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    sessionBadgeText: {
      fontSize: 13,
      fontWeight: "600" as const,
    },
    emptyState: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 40,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: Colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "800" as const,
      color: Colors.text,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
  });
