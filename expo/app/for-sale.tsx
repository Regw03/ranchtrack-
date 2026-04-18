import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle, Tag, Undo2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { Animal } from "@/types";
import { SPECIES_ICONS, getAnimalDisplayName } from "@/mocks/animals";
import { getAnimalAge } from "@/utils/helpers";

type SaleFilter = "for_sale" | "sold";

function SaleAnimalCard({ animal, onToggle, onSold, onUndoSold, isSold }: { animal: Animal; onToggle: () => void; onSold?: () => void; onUndoSold?: () => void; isSold: boolean }) {
  const Colors = useColors();
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/animal/${animal.id}`)}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        activeOpacity={1}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardAvatar}>
            {animal.photoUrl ? (
              <Image source={{ uri: animal.photoUrl }} style={styles.cardAvatarImg} />
            ) : (
              <Text style={styles.cardAvatarEmoji}>{SPECIES_ICONS[animal.species] || "🐾"}</Text>
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTag}>{animal.tagId}</Text>
            {animal.name ? <Text style={styles.cardName}>{animal.name}</Text> : null}
            <View style={styles.cardMeta}>
              <Text style={styles.cardMetaText}>{animal.breed}</Text>
              <View style={styles.dot} />
              <Text style={styles.cardMetaText}>{getAnimalAge(animal.birthDate)}</Text>
            </View>
          </View>
          {isSold ? (
            <View style={styles.soldBadge}><CheckCircle size={14} color={Colors.textInverse} /><Text style={styles.soldBadgeText}>Sold</Text></View>
          ) : (
            <View style={styles.forSaleBadge}><Tag size={14} color={Colors.accent} /><Text style={styles.forSaleBadgeText}>For Sale</Text></View>
          )}
        </View>
        {animal.saleNote ? <Text style={styles.saleNote}>{animal.saleNote}</Text> : null}
        {!isSold ? (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.unmarkBtn} onPress={() => onToggle()} activeOpacity={0.7}>
              <Text style={styles.unmarkText}>Remove from Sale</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.soldBtn} onPress={() => { if (onSold) onSold(); }} activeOpacity={0.85}>
              <CheckCircle size={15} color={Colors.textInverse} />
              <Text style={styles.soldBtnText}>Mark Sold</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.undoBtn} onPress={() => { if (onUndoSold) onUndoSold(); }} activeOpacity={0.7}>
              <Undo2 size={15} color={Colors.warning} />
              <Text style={styles.undoBtnText}>Undo Sold</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ForSaleScreen() {
  const Colors = useColors();
  const { forSaleAnimals, soldAnimals, toggleMarkedForSale, markAsSold, undoSold } = useRanch();
  const [filter, setFilter] = useState<SaleFilter>("for_sale");
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const displayAnimals = filter === "for_sale" ? forSaleAnimals : soldAnimals;

  const handleToggle = useCallback(async (animal: Animal) => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleMarkedForSale(animal.id);
  }, [toggleMarkedForSale]);

  const handleMarkSold = useCallback(async (animal: Animal) => {
    Alert.alert("Mark as Sold", `Mark ${getAnimalDisplayName(animal)} as sold? This will remove them from active herd.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Mark Sold", onPress: async () => {
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await markAsSold(animal.id);
      }},
    ]);
  }, [markAsSold]);

  const handleUndoSold = useCallback(async (animal: Animal) => {
    Alert.alert("Undo Sold", `Return ${getAnimalDisplayName(animal)} to the active herd?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", onPress: async () => {
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await undoSold(animal.id);
      }},
    ]);
  }, [undoSold]);

  const renderItem = useCallback(({ item }: { item: Animal }) => (
    <SaleAnimalCard animal={item} isSold={filter === "sold"} onToggle={() => handleToggle(item)} onSold={() => handleMarkSold(item)} onUndoSold={() => handleUndoSold(item)} />
  ), [filter, handleToggle, handleMarkSold, handleUndoSold]);

  return (
    <View style={styles.container}>
      <FlatList
        data={displayAnimals}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.filterRow}>
            <TouchableOpacity style={[styles.filterBtn, filter === "for_sale" && styles.filterBtnActive]} onPress={() => setFilter("for_sale")}>
              <Tag size={16} color={filter === "for_sale" ? Colors.textInverse : Colors.accent} />
              <Text style={[styles.filterText, filter === "for_sale" && styles.filterTextActive]}>For Sale ({forSaleAnimals.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterBtn, filter === "sold" && styles.filterBtnActiveSold]} onPress={() => setFilter("sold")}>
              <CheckCircle size={16} color={filter === "sold" ? Colors.textInverse : Colors.textSecondary} />
              <Text style={[styles.filterText, filter === "sold" && styles.filterTextActive]}>Sold ({soldAnimals.length})</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{filter === "for_sale" ? "💰" : "✅"}</Text>
            <Text style={styles.emptyTitle}>{filter === "for_sale" ? "No Animals For Sale" : "No Sold Animals"}</Text>
            <Text style={styles.emptySubtitle}>{filter === "for_sale" ? "Mark animals for sale from their profile page" : "Animals marked as sold will appear here"}</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingBottom: 40 },
  filterRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 10 },
  filterBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterBtnActiveSold: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 14, fontWeight: "700" as const, color: Colors.text },
  filterTextActive: { color: Colors.textInverse },
  cardWrap: { paddingHorizontal: 16, paddingTop: 8 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  cardTop: { flexDirection: "row", alignItems: "center" },
  cardAvatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.secondaryLight, alignItems: "center", justifyContent: "center", overflow: "hidden", marginRight: 12 },
  cardAvatarImg: { width: 48, height: 48, resizeMode: "cover" },
  cardAvatarEmoji: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTag: { fontSize: 16, fontWeight: "800" as const, color: Colors.text },
  cardName: { fontSize: 13, fontWeight: "600" as const, color: Colors.textSecondary, marginTop: 1 },
  cardMeta: { flexDirection: "row", alignItems: "center", marginTop: 3, gap: 6 },
  cardMetaText: { fontSize: 12, color: Colors.textTertiary },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textTertiary },
  forSaleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.accent + "18", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  forSaleBadgeText: { fontSize: 12, fontWeight: "700" as const, color: Colors.accent },
  soldBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  soldBadgeText: { fontSize: 12, fontWeight: "700" as const, color: Colors.textInverse },
  saleNote: { fontSize: 13, color: Colors.textSecondary, marginTop: 10, paddingLeft: 60, fontStyle: "italic" as const },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  unmarkBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.backgroundDark, alignItems: "center" },
  unmarkText: { fontSize: 13, fontWeight: "600" as const, color: Colors.textSecondary },
  soldBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.primary },
  soldBtnText: { fontSize: 13, fontWeight: "700" as const, color: Colors.textInverse },
  undoBtn: { flex: 1, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.warning + "18", borderWidth: 1.5, borderColor: Colors.warning + "30" },
  undoBtnText: { fontSize: 13, fontWeight: "700" as const, color: Colors.warning },
  empty: { alignItems: "center", paddingTop: 48, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" as const, marginTop: 6 },
});
