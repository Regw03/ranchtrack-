import React, { useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { AlertCircle, ChevronRight, Stethoscope, Clock } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Animal, DoctoringEvent } from "@/types";
import { SPECIES_ICONS, getAnimalDisplayName } from "@/mocks/animals";
import { formatDate } from "@/utils/helpers";

function AttentionRow({ animal, latestEvent }: { animal: Animal; latestEvent: DoctoringEvent | undefined }) {
  const Colors = useColors();
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/animal/${animal.id}`);
  }, [animal.id, router]);

  const typeLabel = latestEvent
    ? latestEvent.type === "custom"
      ? latestEvent.customTypeName ?? "Other"
      : latestEvent.type.charAt(0).toUpperCase() + latestEvent.type.slice(1)
    : "";

  return (
    <Animated.View style={[styles.row, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.rowInner}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={styles.avatar}>
          {animal.photoUrl ? (
            <Image source={{ uri: animal.photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarEmoji}>{SPECIES_ICONS[animal.species] || "🐾"}</Text>
          )}
          <View style={styles.alertBadge}>
            <AlertCircle size={10} color="#fff" />
          </View>
        </View>
        <View style={styles.info}>
          <Text style={styles.tag}>{getAnimalDisplayName(animal)}</Text>
          {latestEvent && (
            <>
              <View style={styles.eventRow}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{typeLabel}</Text>
                </View>
                <View style={styles.dateRow}>
                  <Clock size={11} color={Colors.textTertiary} />
                  <Text style={styles.dateText}>{formatDate(latestEvent.date)}</Text>
                </View>
              </View>
              {latestEvent.notes ? (
                <Text style={styles.notes} numberOfLines={1}>{latestEvent.notes}</Text>
              ) : null}
            </>
          )}
        </View>
        <ChevronRight size={18} color={Colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function NeedsAttentionScreen() {
  const Colors = useColors();
  const { needsAttentionAnimals, getDoctoringEventsForAnimal } = useRanch();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const renderItem = useCallback(
    ({ item }: { item: Animal }) => {
      const events = getDoctoringEventsForAnimal(item.id);
      const latestUnresolved = events.find((e) => e.followUpNeeded && !e.resolved);
      return <AttentionRow animal={item} latestEvent={latestUnresolved} />;
    },
    [getDoctoringEventsForAnimal],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Needs Attention" }} />
      <FlatList
        data={needsAttentionAnimals}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Stethoscope size={22} color={Colors.warning} />
            </View>
            <Text style={styles.headerTitle}>{needsAttentionAnimals.length} animal{needsAttentionAnimals.length !== 1 ? "s" : ""} need follow-up</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>All Clear</Text>
            <Text style={styles.emptySubtitle}>No animals currently need follow-up care</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.warning + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700" as const, color: Colors.text },
  row: { paddingHorizontal: 16, paddingTop: 6 },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: "visible",
    backgroundColor: Colors.secondaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarImage: { width: 48, height: 48, borderRadius: 14 },
  avatarEmoji: { fontSize: 24 },
  alertBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.warning,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  info: { flex: 1 },
  tag: { fontSize: 16, fontWeight: "800" as const, color: Colors.text, letterSpacing: -0.2 },
  eventRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.warning + "18",
  },
  typeBadgeText: { fontSize: 11, fontWeight: "700" as const, color: Colors.warning, textTransform: "capitalize" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  dateText: { fontSize: 11, color: Colors.textTertiary },
  notes: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", marginTop: 6 },
});
