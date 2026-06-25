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
  Baby,
  ChevronRight,
  FileText,
  Activity,
  CircleDot,
  CheckCircle2,
  Clock,
  Calendar,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { useSubscription } from "@/providers/SubscriptionProvider";
import { Animal, DoctoringEvent } from "@/types";

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


export default function DashboardScreen() {
  const Colors = useColors();
  const router = useRouter();
  const { isFree } = useSubscription();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const {
    needsAttentionAnimals,
    doctoringEvents,
    activeBusinessYear,
    ranchNotes,
    animals,
  } = useRanch();


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



  const hasAttention = attentionItems.length > 0;


  const PAID_QUICK_ACTIONS = ["/log-calving", "/processing-groups", "/processing-sessions"];

  const handleQuickAction = useCallback((route: string) => {
    const requiresPro = PAID_QUICK_ACTIONS.some((r) => route.startsWith(r));
    if (requiresPro && isFree) {
      router.push("/paywall" as never);
      return;
    }
    router.push(route as never);
  }, [router, isFree]);

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
          label="Log Calving"
          icon={<Baby size={22} color="#2D7A9C" />}
          color="#2D7A9C"
          onPress={() => handleQuickAction("/log-calving")}
        />
        <QuickActionButton
          label="Processing"
          icon={<ClipboardList size={22} color="#D4943A" />}
          color="#D4943A"
          onPress={() => handleQuickAction("/processing-groups")}
        />
        <QuickActionButton
          label="Add Cow"
          icon={<Plus size={22} color="#3D8B5E" />}
          color="#3D8B5E"
          onPress={() => handleQuickAction("/add-animal")}
        />
        <QuickActionButton
          label="Doctor"
          icon={<Stethoscope size={22} color="#C44D3D" />}
          color="#C44D3D"
          onPress={() => handleQuickAction("/log-doctoring-event")}
        />
      </View>

      {ranchNotes.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => isFree ? router.push("/paywall" as never) : router.push("/ranch-notes" as never)}
            activeOpacity={0.7}
          >
            <View style={[styles.sectionIconWrap, { backgroundColor: "#D4943A18" }]}>
              <FileText size={18} color="#D4943A" />
            </View>
            <Text style={styles.sectionTitle}>Ranch Notes</Text>
            <Text style={styles.sectionCount}>{ranchNotes.length}</Text>
            <ChevronRight size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
          {ranchNotes.slice(0, 2).map((note) => (
            <TouchableOpacity
              key={note.id}
              style={styles.noteCard}
              onPress={() => isFree ? router.push("/paywall" as never) : router.push("/ranch-notes" as never)}
              activeOpacity={0.75}
            >
              <Text style={styles.noteText} numberOfLines={2}>{note.text}</Text>
              <Text style={styles.noteMeta}>
                {new Date(note.updatedAt || note.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!hasAttention && (
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
    noteCard: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: 12,
      marginTop: 6,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    noteText: {
      fontSize: 14,
      color: Colors.text,
      lineHeight: 20,
      marginBottom: 4,
    },
    noteMeta: {
      fontSize: 11,
      color: Colors.textTertiary,
      fontWeight: "500" as const,
    },
    sectionCount: {
      fontSize: 13,
      fontWeight: "700" as const,
      color: Colors.textSecondary,
      marginLeft: "auto" as const,
    },
    breedingStats: {
      flexDirection: "row",
      backgroundColor: Colors.background,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 8,
      marginBottom: 14,
    },
    breedingStat: {
      flex: 1,
      alignItems: "center",
    },
    breedingStatValue: {
      fontSize: 22,
      fontWeight: "800" as const,
      color: Colors.text,
    },
    breedingStatLabel: {
      fontSize: 11,
      fontWeight: "600" as const,
      color: Colors.textTertiary,
      marginTop: 2,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    breedingStatDivider: {
      width: 1,
      backgroundColor: Colors.border,
      marginVertical: 2,
    },
    dueSoonSection: {
      marginTop: 2,
    },
    dueSoonTitle: {
      fontSize: 12,
      fontWeight: "700" as const,
      color: Colors.textTertiary,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    dueSoonItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.background,
      borderRadius: 12,
      padding: 12,
      marginBottom: 6,
    },
    dueSoonDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 10,
    },
    dueSoonContent: {
      flex: 1,
    },
    dueSoonTag: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: Colors.text,
    },
    dueSoonName: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    dueSoonDateCol: {
      alignItems: "flex-end",
      gap: 3,
    },
    dueSoonDateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    dueSoonDate: {
      fontSize: 12,
      color: Colors.textSecondary,
      fontWeight: "500" as const,
    },
    dueSoonDays: {
      fontSize: 12,
      fontWeight: "700" as const,
    },
  });
