import React, { useMemo, useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ClipboardList,
  Stethoscope,
  DollarSign,
  ChevronRight,
  Plus,
  AlertTriangle,
  FolderOpen,
  Baby,
  Search,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { useSubscription } from "@/providers/SubscriptionProvider";
import { useProcessing } from "@/providers/ProcessingProvider";
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
  const { isPro, isFree } = useSubscription();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const {
    calvingLists,
    calvingRecords,
    forSaleAnimals,
    soldAnimals,
    needsAttentionAnimals,
    activeBusinessYear,
  } = useRanch();

  const {
    processingGroups,
    processingEvents,
    getEventProgress,
  } = useProcessing();

  const activeGroups = useMemo(() => {
    return processingGroups.filter((g) => g.businessYearId === activeBusinessYear?.id);
  }, [processingGroups, activeBusinessYear?.id]);

  const recentEvents = useMemo(() => {
    return processingEvents
      .filter((e) => e.businessYearId === activeBusinessYear?.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  }, [processingEvents, activeBusinessYear?.id]);

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

  const [calvingSearch, setCalvingSearch] = useState("");

  // Cross-list calving search results
  const calvingSearchResults = useMemo(() => {
    const q = calvingSearch.trim().toLowerCase();
    if (!q) return [];
    return calvingRecords.filter(
      (r) =>
        r.businessYearId === activeBusinessYear?.id &&
        (r.cowTag.toLowerCase().includes(q) || r.calfTag.toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calvingSearch, calvingRecords.length, calvingRecords, activeBusinessYear?.id]);

  const PAID_ROUTES = ["/log-calving", "/create-calving-list", "/calving-list/", "/calving-record/", "/processing-groups", "/processing-group/", "/for-sale", "/ranch-notes"];

  const nav = useCallback((route: string) => {
    const requiresPro = PAID_ROUTES.some((r) => route.startsWith(r));
    if (requiresPro && isFree) {
      router.push("/paywall" as never);
      return;
    }
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as never);
  }, [router, isFree]);

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

        {/* Cross-list search */}
        {calvingStats.total > 0 && (
          <View style={styles.calvingSearchBar}>
            <Search size={15} color={Colors.textTertiary} />
            <TextInput
              value={calvingSearch}
              onChangeText={setCalvingSearch}
              placeholder="Search all lists by cow or calf tag..."
              placeholderTextColor={Colors.textTertiary}
              style={styles.calvingSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {calvingSearch.length > 0 && (
              <TouchableOpacity onPress={() => setCalvingSearch("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={15} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Search results */}
        {calvingSearch.trim().length > 0 ? (
          calvingSearchResults.length === 0 ? (
            <Text style={styles.calvingSearchEmpty}>
              No records found for "{calvingSearch}"
            </Text>
          ) : (
            calvingSearchResults.map((record) => {
              const list = calvingLists.find((l) => l.id === record.calvingListId);
              return (
                <TouchableOpacity
                  key={record.id}
                  style={styles.searchResultCard}
                  onPress={() => {
                    setCalvingSearch("");
                    router.push({ pathname: "/calving-record/[id]" as never, params: { id: record.id } });
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.searchResultTags}>
                    <Text style={styles.searchResultLabel}>COW</Text>
                    <Text style={styles.searchResultTag}>{record.cowTag}</Text>
                    <Text style={styles.searchResultArrow}>→</Text>
                    <Text style={styles.searchResultLabel}>CALF</Text>
                    <Text style={styles.searchResultTag}>{record.calfTag}</Text>
                  </View>
                  <View style={styles.searchResultMeta}>
                    {list && (
                      <View style={styles.searchResultListBadge}>
                        <View style={[styles.searchResultDot, { backgroundColor: list.color }]} />
                        <Text style={styles.searchResultListName} numberOfLines={1}>{list.name}</Text>
                      </View>
                    )}
                    <Text style={styles.searchResultDate}>
                      {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][(record.birthMonth ?? 1) - 1]} {String(record.birthDay ?? 1).padStart(2, "0")}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        ) : (
          calvingLists.map((list) => {
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
          })
        )}
      </WorkSection>

      <WorkSection
        title="Processing"
        subtitle={
          activeGroups.length > 0
            ? `${activeGroups.length} group${activeGroups.length !== 1 ? "s" : ""} · ${recentEvents.length > 0 ? `${recentEvents.length} recent event${recentEvents.length !== 1 ? "s" : ""}` : "no events yet"}`
            : "No groups yet — create one to start"
        }
        icon={<ClipboardList size={18} color="#D4943A" />}
        iconBg="#D4943A"
        onPress={() => nav("/processing-groups")}
      >
        <View style={styles.chipGrid}>
          <ActionChip
            label="Groups"
            icon={<FolderOpen size={16} color="#D4943A" />}
            color="#D4943A"
            onPress={() => nav("/processing-groups")}
          />
        </View>
        {activeGroups.slice(0, 3).map((group) => {
          const groupEvents = processingEvents.filter((e) => e.groupId === group.id);
          const latestEvent = groupEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          const progress = latestEvent ? getEventProgress(latestEvent.id, group.id) : null;
          return (
            <TouchableOpacity
              key={group.id}
              style={[styles.miniCard, { borderLeftWidth: 3, borderLeftColor: group.color }]}
              onPress={() => nav(`/processing-group/${group.id}`)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.miniName} numberOfLines={1}>{group.name}</Text>
                <Text style={styles.miniStat}>{group.animalIds.length} head</Text>
              </View>
              {latestEvent && progress && (
                <Text style={styles.miniStat}>
                  {latestEvent.status === "completed" ? "✓ Done" : `${progress.done}/${progress.total}`}
                </Text>
              )}
              <ChevronRight size={14} color={Colors.textTertiary} />
            </TouchableOpacity>
          );
        })}
        {activeGroups.length === 0 && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => nav("/processing-groups")}
            activeOpacity={0.85}
          >
            <Plus size={16} color={Colors.textInverse} />
            <Text style={styles.createBtnText}>Create First Group</Text>
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
    calvingSearchBar: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 8 },
    calvingSearchInput: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: "500" as const },
    calvingSearchEmpty: { fontSize: 13, color: Colors.textTertiary, textAlign: "center" as const, paddingVertical: 12, fontStyle: "italic" as const },
    searchResultCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight },
    searchResultTags: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, marginBottom: 6 },
    searchResultLabel: { fontSize: 10, fontWeight: "800" as const, color: Colors.textTertiary, letterSpacing: 0.8 },
    searchResultTag: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
    searchResultArrow: { fontSize: 14, color: Colors.textTertiary, marginHorizontal: 2 },
    searchResultMeta: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
    searchResultListBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5 },
    searchResultDot: { width: 8, height: 8, borderRadius: 4 },
    searchResultListName: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" as const, maxWidth: 160 },
    searchResultDate: { fontSize: 12, color: Colors.textTertiary, fontWeight: "500" as const },
  });
