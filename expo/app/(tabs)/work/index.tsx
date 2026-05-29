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
  Heart,
  ClipboardList,
  Stethoscope,
  DollarSign,
  ChevronRight,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  FolderOpen,
  Baby,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { useProcessingSessions } from "@/providers/ProcessingSessionProvider";
import BusinessYearPicker from "@/components/BusinessYearPicker";

interface WorkSectionProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  onPress?: () => void;
  children?: React.ReactNode;
}

function WorkSection({ title, subtitle, icon, iconBg, onPress, children }: WorkSectionProps) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: iconBg + "18" }]}>
            {icon}
          </View>
          <View style={styles.sectionTitleBlock}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {onPress ? <ChevronRight size={18} color={Colors.textTertiary} /> : null}
      </TouchableOpacity>
      {children ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function ActionChip({
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
    Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={[styles.chipWrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[styles.chip, { borderColor: color + "30" }]}
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[styles.chipIcon, { backgroundColor: color + "15" }]}>{icon}</View>
        <Text style={styles.chipLabel}>{label}</Text>
        <ChevronRight size={14} color={Colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function WorkScreen() {
  const Colors = useColors();
  const router = useRouter();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const {
    calvingLists,
    calvingRecords,
    breedingGroups,
    bredAnimals,
    openAnimals,
    forSaleAnimals,
    soldAnimals,
    needsAttentionAnimals,
    activeBusinessYear,
  } = useRanch();

  const { sessions, getSessionProgress } = useProcessingSessions();

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

  const calvingStats = useMemo(() => {
    const yearRecords = calvingRecords.filter(
      (r) => r.businessYearId === activeBusinessYear?.id,
    );
    return {
      lists: calvingLists.length,
      total: yearRecords.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calvingLists.length, calvingRecords.length, activeBusinessYear?.id]);

  const nav = useCallback((route: string) => {
    router.push(route as never);
  }, [router]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.screenTitle}>Work</Text>
        </View>
        <BusinessYearPicker />
      </View>

      {needsAttentionAnimals.length > 0 && (
        <TouchableOpacity
          style={styles.attentionBanner}
          onPress={() => {
            if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            nav("/needs-attention");
          }}
          activeOpacity={0.8}
        >
          <View style={styles.attentionIconWrap}>
            <AlertTriangle size={18} color="#C44D3D" />
          </View>
          <View style={styles.attentionTextWrap}>
            <Text style={styles.attentionTitle}>
              {needsAttentionAnimals.length} Need{needsAttentionAnimals.length === 1 ? "s" : ""} Attention
            </Text>
            <Text style={styles.attentionSubtitle}>Animals requiring follow-up care</Text>
          </View>
          <ChevronRight size={18} color="#C44D3D" />
        </TouchableOpacity>
      )}

      <WorkSection
        title="Calving"
        subtitle={
          calvingStats.lists > 0
            ? `${calvingStats.lists} list${calvingStats.lists !== 1 ? "s" : ""} · ${calvingStats.total} record${calvingStats.total !== 1 ? "s" : ""}`
            : "No lists yet — create one to start"
        }
        icon={<Baby size={18} color="#2D7A9C" />}
        iconBg="#2D7A9C"
      >
        <View style={styles.chipGrid}>
          <ActionChip
            label="Log Calving"
            icon={<Plus size={16} color="#2D7A9C" />}
            color="#2D7A9C"
            onPress={() => nav("/log-calving")}
          />
          <ActionChip
            label="New List"
            icon={<FolderOpen size={16} color="#2D7A9C" />}
            color="#2D7A9C"
            onPress={() => nav("/create-calving-list")}
          />
        </View>
        {calvingLists.map((list) => {
          const listRecords = calvingRecords.filter(
            (r) => r.calvingListId === list.id,
          );
          return (
            <TouchableOpacity
              key={list.id}
              style={[styles.miniCard, { borderLeftWidth: 3, borderLeftColor: list.color }]}
              onPress={() => nav(`/calving-list/${list.id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.miniName} numberOfLines={1}>{list.name}</Text>
              <Text style={styles.miniStat}>{listRecords.length} records</Text>
              <ChevronRight size={14} color={Colors.textTertiary} />
            </TouchableOpacity>
          );
        })}
      </WorkSection>

      <WorkSection
        title="Breeding"
        subtitle={`${bredAnimals.length} bred · ${openAnimals.length} open`}
        icon={<Heart size={18} color={Colors.accent} />}
        iconBg={Colors.accent}
      >
        <View style={styles.chipGrid}>
          <ActionChip
            label="Add Record"
            icon={<Plus size={16} color={Colors.accent} />}
            color={Colors.accent}
            onPress={() => nav("/add-breeding-record")}
          />
          <ActionChip
            label="New Group"
            icon={<FolderOpen size={16} color={Colors.accent} />}
            color={Colors.accent}
            onPress={() => nav("/create-breeding-group")}
          />
        </View>
        {breedingGroups.length > 0 && breedingGroups.slice(0, 3).map((group) => (
          <TouchableOpacity
            key={group.id}
            style={[styles.miniCard, { borderLeftWidth: 3, borderLeftColor: group.color }]}
            onPress={() => nav(`/breeding-group/${group.id}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.miniName} numberOfLines={1}>{group.name}</Text>
            <Text style={styles.miniStat}>{group.animalIds.length} head</Text>
            <ChevronRight size={14} color={Colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </WorkSection>

      <WorkSection
        title="Processing Sessions"
        subtitle={`${activeSessions.length} active session${activeSessions.length !== 1 ? "s" : ""}`}
        icon={<ClipboardList size={18} color="#D4943A" />}
        iconBg="#D4943A"
        onPress={() => nav("/processing-sessions")}
      >
        {activeSessions.length > 0 ? (
          activeSessions.slice(0, 3).map((s) => {
            const StatusIcon = s.label === "Completed" ? CheckCircle2 : s.label === "In Progress" ? Activity : Clock;
            return (
              <TouchableOpacity
                key={s.session.id}
                style={styles.sessionRow}
                onPress={() => nav(`/processing-session/${s.session.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.sessionDot, { backgroundColor: s.statusColor + "18" }]}>
                  <StatusIcon size={14} color={s.statusColor} />
                </View>
                <Text style={styles.sessionName} numberOfLines={1}>{s.session.name}</Text>
                <Text style={[styles.sessionStatus, { color: s.statusColor }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => nav("/create-processing-session")}
            activeOpacity={0.85}
          >
            <Plus size={16} color={Colors.textInverse} />
            <Text style={styles.createBtnText}>New Session</Text>
          </TouchableOpacity>
        )}
      </WorkSection>

      <WorkSection
        title="Doctoring"
        subtitle={needsAttentionAnimals.length > 0
          ? `${needsAttentionAnimals.length} need follow-up`
          : "No pending follow-ups"}
        icon={<Stethoscope size={18} color="#C44D3D" />}
        iconBg="#C44D3D"
      >
        <View style={styles.chipGrid}>
          <ActionChip
            label="Doctor Animal"
            icon={<Stethoscope size={16} color="#C44D3D" />}
            color="#C44D3D"
            onPress={() => nav("/log-doctoring-event")}
          />
          {needsAttentionAnimals.length > 0 && (
            <ActionChip
              label="Needs Attention"
              icon={<AlertTriangle size={16} color="#C44D3D" />}
              color="#C44D3D"
              onPress={() => nav("/needs-attention")}
            />
          )}
        </View>
      </WorkSection>

      {(forSaleAnimals.length > 0 || soldAnimals.length > 0) && (
        <WorkSection
          title="For Sale"
          subtitle={`${forSaleAnimals.length} for sale · ${soldAnimals.length} sold`}
          icon={<DollarSign size={18} color={Colors.accent} />}
          iconBg={Colors.accent}
          onPress={() => nav("/for-sale")}
        />
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
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 10,
    },
    topBarLeft: {
      flex: 1,
      minWidth: 0,
    },
    screenTitle: {
      fontSize: 28,
      fontWeight: "800" as const,
      color: Colors.text,
      letterSpacing: -0.5,
    },

    attentionBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#C44D3D" + "12",
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: "#C44D3D" + "28",
    },
    attentionIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#C44D3D" + "20",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    attentionTextWrap: {
      flex: 1,
    },
    attentionTitle: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: "#C44D3D",
    },
    attentionSubtitle: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    section: {
      marginTop: 16,
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
      flex: 1,
      gap: 12,
    },
    sectionIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTitleBlock: {
      flex: 1,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "800" as const,
      color: Colors.text,
      letterSpacing: -0.2,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    sectionBody: {
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10,
    },
    chipWrap: {
      minWidth: 120,
      flexGrow: 1,
      flexShrink: 0,
      flexBasis: "30%" as unknown as number,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.background,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderWidth: 1,
      gap: 6,
    },
    chipIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    chipLabel: {
      fontSize: 12,
      fontWeight: "700" as const,
      color: Colors.text,
      flex: 1,
    },
    miniCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.background,
      borderRadius: 12,
      padding: 12,
      marginBottom: 6,
      gap: 10,
    },
    miniDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    miniName: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: Colors.text,
      flex: 1,
    },
    miniStat: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: Colors.textSecondary,
    },
    miniProgress: {
      width: 48,
      height: 5,
      borderRadius: 3,
      backgroundColor: Colors.borderLight,
      overflow: "hidden",
    },
    miniProgressFill: {
      height: 5,
      borderRadius: 3,
    },
    sessionRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.background,
      borderRadius: 12,
      padding: 12,
      marginBottom: 6,
      gap: 10,
    },
    sessionDot: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    sessionName: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: Colors.text,
      flex: 1,
    },
    sessionStatus: {
      fontSize: 12,
      fontWeight: "600" as const,
    },
    createBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: Colors.primary,
    },
    createBtnText: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: Colors.textInverse,
    },
  });
