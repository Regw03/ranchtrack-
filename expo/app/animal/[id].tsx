import React, { useMemo, useCallback, useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  Heart,
  Scale,
  Baby,
  Trash2,
  Plus,
  Calendar,
  TrendingUp,
  Tag,
  List,
  X,
  Camera,
  Skull,
  Undo2,
  HelpCircle,
  GitMerge,
  Edit3,
  CheckCircle,
  AlertTriangle,
  Stethoscope,
  CheckCircle2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ThemeColors } from "@/constants/colors";
import { useColors } from "@/providers/ThemeProvider";
import { useRanch } from "@/providers/RanchProvider";
import { SPECIES_ICONS, getAnimalDisplayName, getGenderTitle } from "@/mocks/animals";
import { formatDate, getAnimalAge } from "@/utils/helpers";
import { HealthRecord, WeightRecord, BreedingRecord, CustomList, Animal, DoctoringEvent } from "@/types";

function SectionHeader({ title, icon, onAdd }: { title: string; icon: React.ReactNode; onAdd?: () => void }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>{icon}<Text style={styles.sectionTitle}>{title}</Text></View>
      {onAdd && (<TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.7}><Plus size={16} color={Colors.primary} /><Text style={styles.addBtnText}>Add</Text></TouchableOpacity>)}
    </View>
  );
}

function WeightChart({ records }: { records: WeightRecord[] }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  if (records.length === 0) return null;
  const maxWeight = Math.max(...records.map((r) => r.weight));
  const minWeight = Math.min(...records.map((r) => r.weight));
  const range = maxWeight - minWeight || 1;

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBars}>
        {records.slice(-6).map((record) => {
          const height = ((record.weight - minWeight) / range) * 60 + 20;
          return (
            <View key={record.id} style={styles.chartBarWrapper}>
              <Text style={styles.chartBarValue}>{record.weight}</Text>
              <View style={[styles.chartBar, { height }]} />
              <Text style={styles.chartBarLabel}>{new Date(record.date).toLocaleDateString("en-US", { month: "short" })}</Text>
            </View>
          );
        })}
      </View>
      {records.length >= 2 && (
        <View style={styles.trendRow}>
          <TrendingUp size={14} color={Colors.success} />
          <Text style={styles.trendText}>{records[records.length - 1].weight - records[0].weight > 0 ? "+" : ""}{records[records.length - 1].weight - records[0].weight} {records[0].unit} total change</Text>
        </View>
      )}
    </View>
  );
}

function HealthTimeline({ records }: { records: HealthRecord[] }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const TYPE_COLORS: Record<string, string> = { vaccination: Colors.success, treatment: Colors.accent, checkup: Colors.primary, injury: Colors.error, other: Colors.textSecondary };

  return (
    <View>
      {records.slice(0, 5).map((record, idx) => (
        <View key={record.id} style={styles.timelineItem}>
          <View style={styles.timelineDotColumn}>
            <View style={[styles.healthDot, { backgroundColor: TYPE_COLORS[record.type] || Colors.primary }]} />
            {idx < Math.min(records.length, 5) - 1 && <View style={styles.timelineConnector} />}
          </View>
          <View style={styles.timelineContent}>
            <View style={styles.timelineHeader}>
              <View style={[styles.typeBadge, { backgroundColor: (TYPE_COLORS[record.type] || Colors.primary) + "20" }]}>
                <Text style={[styles.typeBadgeText, { color: TYPE_COLORS[record.type] || Colors.primary }]}>{record.type}</Text>
              </View>
              <Text style={styles.timelineDate}>{formatDate(record.date)}</Text>
            </View>
            <Text style={styles.timelineDescription}>{record.description}</Text>
            {record.notes ? <Text style={styles.timelineNotes}>{record.notes}</Text> : null}
          </View>
        </View>
      ))}
      {records.length === 0 && <Text style={styles.emptyRecordText}>No health records yet</Text>}
    </View>
  );
}

function BreedingSection({ records }: { records: BreedingRecord[] }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const STATUS_COLORS: Record<string, string> = { bred: Colors.accent, confirmed: Colors.success, delivered: Colors.primary, open: Colors.textSecondary };

  return (
    <View>
      {records.map((record) => (
        <View key={record.id} style={styles.breedingCard}>
          <View style={styles.breedingRow}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[record.status] || Colors.primary }]} />
            <Text style={styles.breedingStatus}>{record.status}</Text>
          </View>
          <View style={styles.breedingDates}>
            <View style={styles.breedingDateItem}><Calendar size={14} color={Colors.textTertiary} /><Text style={styles.breedingDateLabel}>Bred: {formatDate(record.lastBredDate)}</Text></View>
            <View style={styles.breedingDateItem}><Calendar size={14} color={Colors.accent} /><Text style={[styles.breedingDateLabel, { color: Colors.accent }]}>Due: {formatDate(record.expectedDueDate)}</Text></View>
          </View>
          {record.notes ? <Text style={styles.breedingNotes}>{record.notes}</Text> : null}
        </View>
      ))}
      {records.length === 0 && <Text style={styles.emptyRecordText}>No breeding records yet</Text>}
    </View>
  );
}

function DoctoringTimeline({ events, onResolve }: { events: DoctoringEvent[]; onResolve: (event: DoctoringEvent) => void }) {
  const Colors = useColors();
  const styles = useMemo(() => createStyles(Colors), [Colors]);
  const TYPE_COLORS: Record<string, string> = { injury: Colors.error, illness: Colors.warning, lameness: "#8B6914", infection: "#C44D8B", custom: Colors.textSecondary };
  const TYPE_EMOJI: Record<string, string> = { injury: "🩹", illness: "🤒", lameness: "🦿", infection: "🦠", custom: "📋" };

  return (
    <View>
      {events.slice(0, 8).map((event, idx) => {
        const color = TYPE_COLORS[event.type] || Colors.textSecondary;
        const label = event.type === "custom" ? (event.customTypeName ?? "Other") : event.type;
        return (
          <View key={event.id} style={styles.timelineItem}>
            <View style={styles.timelineDotColumn}>
              <View style={[styles.healthDot, { backgroundColor: color }]} />
              {idx < Math.min(events.length, 8) - 1 && <View style={styles.timelineConnector} />}
            </View>
            <View style={styles.doctoringCard}>
              <View style={styles.doctoringCardHeader}>
                <View style={styles.doctoringCardHeaderLeft}>
                  <Text style={styles.doctoringEmoji}>{TYPE_EMOJI[event.type] || "📋"}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: color + "20" }]}>
                    <Text style={[styles.typeBadgeText, { color }]}>{label}</Text>
                  </View>
                </View>
                <Text style={styles.timelineDate}>{formatDate(event.date)}</Text>
              </View>
              {event.notes ? <Text style={styles.timelineDescription}>{event.notes}</Text> : null}
              {event.treatment ? (
                <View style={styles.treatmentRow}>
                  <Text style={styles.treatmentLabel}>Tx:</Text>
                  <Text style={styles.treatmentText}>{event.treatment}</Text>
                </View>
              ) : null}
              {event.createdByName ? (
                <Text style={styles.attributionText}>By {event.createdByName}</Text>
              ) : null}
              {event.followUpNeeded && !event.resolved && (
                <TouchableOpacity style={styles.resolveBtn} onPress={() => onResolve(event)} activeOpacity={0.7}>
                  <CheckCircle2 size={14} color={Colors.success} />
                  <Text style={styles.resolveBtnText}>Mark Resolved</Text>
                </TouchableOpacity>
              )}
              {event.followUpNeeded && event.resolved && (
                <View style={styles.resolvedBadge}>
                  <CheckCircle2 size={12} color={Colors.success} />
                  <Text style={styles.resolvedBadgeText}>Resolved</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function AnimalListsSection({ lists, onRemove }: { lists: CustomList[]; onRemove: (listId: string) => void }) {
  const Colors = useColors();
  const router = useRouter();
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  return (
    <View>
      {lists.length > 0 ? (
        <View style={styles.listsContainer}>
          {lists.map((list) => (
            <View key={list.id} style={[styles.listChip, { borderLeftColor: list.color }]}>
              <TouchableOpacity style={styles.listChipContent} onPress={() => router.push({ pathname: "/list/[id]", params: { id: list.id } })} activeOpacity={0.7}>
                <Text style={styles.listChipIcon}>{list.icon}</Text>
                <Text style={styles.listChipName}>{list.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onRemove(list.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.listChipRemove}>
                <X size={12} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyRecordText}>Not in any lists</Text>
      )}
    </View>
  );
}

export default function AnimalDetailScreen() {
  const Colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getAnimalById, getWeightRecordsForAnimal, getHealthRecordsForAnimal, getBreedingRecordsForAnimal, deleteAnimal, toggleMarkedForSale, markAsDeceased, undoDeceased, undoSold, getListsForAnimal, removeAnimalFromList, customLists, updateAnimal, getAnimalDisplayWithYear, getBusinessYearName, animals, mergeAnimals, isMergingAnimals, getDoctoringEventsForAnimal, updateDoctoringEvent } = useRanch();
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const styles = useMemo(() => createStyles(Colors), [Colors]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start(); }, [fadeAnim]);

  const animal = useMemo(() => getAnimalById(id ?? ""), [getAnimalById, id]);
  const weightRecords = useMemo(() => getWeightRecordsForAnimal(id ?? ""), [getWeightRecordsForAnimal, id]);
  const healthRecords = useMemo(() => getHealthRecordsForAnimal(id ?? ""), [getHealthRecordsForAnimal, id]);
  const breedingRecords = useMemo(() => getBreedingRecordsForAnimal(id ?? ""), [getBreedingRecordsForAnimal, id]);
  const animalLists = useMemo(() => getListsForAnimal(id ?? ""), [getListsForAnimal, id]);
  const doctoringEvents = useMemo(() => getDoctoringEventsForAnimal(id ?? ""), [getDoctoringEventsForAnimal, id]);

  const handleRemoveFromList = useCallback((listId: string) => { if (!id) return; void removeAnimalFromList({ listId, animalId: id }); }, [id, removeAnimalFromList]);

  const handlePickPhoto = useCallback(() => {
    if (!animal) return;
    Alert.alert("Update Photo", "Choose a source", [
      { text: "Take Photo", onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") { Alert.alert("Permission needed", "Camera access is required to take photos."); return; }
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
        if (!result.canceled && result.assets[0]) { await updateAnimal({ ...animal, photoUrl: result.assets[0].uri }); if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
      }},
      { text: "Choose from Library", onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") { Alert.alert("Permission needed", "Photo library access is required."); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
        if (!result.canceled && result.assets[0]) { await updateAnimal({ ...animal, photoUrl: result.assets[0].uri }); if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
      }},
      ...(animal.photoUrl ? [{ text: "Remove Photo", style: "destructive" as const, onPress: async () => { await updateAnimal({ ...animal, photoUrl: undefined }); } }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }, [animal, updateAnimal]);

  const handleToggleSale = useCallback(() => { if (!animal) return; if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); void toggleMarkedForSale(animal.id); }, [animal, toggleMarkedForSale]);

  const handleMarkDeceased = useCallback(() => {
    if (!animal) return;
    Alert.alert("Mark as Deceased", `Mark ${getAnimalDisplayName(animal)} as deceased? This will remove them from all active lists.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Mark Deceased", style: "destructive", onPress: async () => {
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await markAsDeceased(animal.id);
      }},
    ]);
  }, [animal, markAsDeceased]);

  const handleUndoDeceased = useCallback(() => {
    if (!animal) return;
    Alert.alert("Undo Deceased", `Return ${getAnimalDisplayName(animal)} to the active herd?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", onPress: async () => {
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await undoDeceased(animal.id);
      }},
    ]);
  }, [animal, undoDeceased]);

  const handleUndoSold = useCallback(() => {
    if (!animal) return;
    Alert.alert("Undo Sold", `Return ${getAnimalDisplayName(animal)} to the active herd?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", onPress: async () => {
        if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await undoSold(animal.id);
      }},
    ]);
  }, [animal, undoSold]);

  const handleDelete = useCallback(() => {
    Alert.alert("Remove Animal", `Are you sure you want to remove ${animal ? getAnimalDisplayName(animal) : ""}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); await deleteAnimal(id ?? ""); router.back(); } },
    ]);
  }, [animal, deleteAnimal, id, router]);

  const handleMerge = useCallback(async (targetAnimal: Animal) => {
    if (!animal) return;
    Alert.alert(
      "Merge Animals",
      `Merge ${getAnimalDisplayName(targetAnimal)} into ${getAnimalDisplayName(animal)}? All records from ${getAnimalDisplayName(targetAnimal)} will be transferred and that entry will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Merge", style: "destructive", onPress: async () => {
          if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await mergeAnimals({ keepId: animal.id, removeId: targetAnimal.id });
          setShowMergeModal(false);
          setMergeSearch("");
        }},
      ],
    );
  }, [animal, mergeAnimals]);

  const mergeableCandidates = useMemo(() => {
    if (!animal) return [];
    const q = mergeSearch.toLowerCase();
    return animals.filter((a) =>
      a.id !== animal.id &&
      a.status !== "deceased" &&
      (q === "" || a.tagId.toLowerCase().includes(q) || (a.name ?? "").toLowerCase().includes(q))
    ).slice(0, 20);
  }, [animals, animal, mergeSearch]);

  if (!animal) {
    return (<View style={styles.notFound}><Text style={styles.notFoundText}>Animal not found</Text></View>);
  }

  const latestWeight = weightRecords.length > 0 ? weightRecords[weightRecords.length - 1] : null;

  return (
    <>
      <Stack.Screen options={{ title: getAnimalDisplayName(animal) }} />
      <Animated.ScrollView style={[styles.container, { opacity: fadeAnim }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <TouchableOpacity activeOpacity={0.8} onPress={handlePickPhoto}>
            {animal.photoUrl ? (<Image source={{ uri: animal.photoUrl }} style={styles.heroImage} />) : (<View style={styles.heroPlaceholder}><Text style={styles.heroEmoji}>{SPECIES_ICONS[animal.species] || "🐾"}</Text></View>)}
          </TouchableOpacity>
          <View style={styles.heroOverlay}>
            <View style={styles.heroTagBadge}><Text style={styles.heroTagText}>{animal.tagId}</Text></View>
            <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto} activeOpacity={0.7}><Camera size={18} color="#fff" /></TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileSection}>
          <Text style={styles.animalName}>{getAnimalDisplayWithYear(animal)}</Text>
          <Text style={styles.animalBreed}>{animal.breed}</Text>
          {animal.businessYearId ? (
            <Text style={styles.businessYearLabel}>
              {getBusinessYearName(animal.businessYearId)}
              {animal.generation != null ? ` · Gen ${animal.generationConfidence === "estimated" ? "~" : "#"}${animal.generation}` : ""}
              {animal.generationConfidence === "estimated" ? " (Est.)" : ""}
            </Text>
          ) : null}
          {(animal.identityStatus && animal.identityStatus !== "confirmed") && (
            <View style={styles.identityBadgeRow}>
              <View style={[styles.identityBadge, animal.identityStatus === "estimated" ? styles.identityBadgeEstimated : styles.identityBadgeUnknown]}>
                <HelpCircle size={12} color={animal.identityStatus === "estimated" ? Colors.warning : Colors.textTertiary} />
                <Text style={[styles.identityBadgeText, animal.identityStatus === "estimated" ? styles.identityBadgeTextEstimated : styles.identityBadgeTextUnknown]}>
                  {animal.identityStatus === "estimated" ? "Estimated ID" : "Unknown ID"}
                </Text>
              </View>
            </View>
          )}
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}><Text style={styles.quickStatValue}>{SPECIES_ICONS[animal.species]} {animal.species}</Text><Text style={styles.quickStatLabel}>Species</Text></View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}><Text style={styles.quickStatValue}>{getAnimalAge(animal.birthDate)}</Text><Text style={styles.quickStatLabel}>Age</Text></View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}><Text style={styles.quickStatValue}>{["male", "steer"].includes(animal.sex) ? "♂" : "♀"} {getGenderTitle(animal.species, animal.sex)}</Text><Text style={styles.quickStatLabel}>Sex</Text></View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}><Text style={styles.quickStatValue}>{latestWeight ? `${latestWeight.weight}` : "—"}</Text><Text style={styles.quickStatLabel}>{latestWeight ? latestWeight.unit : "Weight"}</Text></View>
          </View>
          {animal.notes ? (<View style={styles.notesCard}><Text style={styles.notesText}>{animal.notes}</Text></View>) : null}
        </View>

        <View style={styles.doctorButtonWrap}>
          <TouchableOpacity
            style={styles.doctorButton}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: "/log-doctoring-event", params: { animalId: animal.id } });
            }}
            activeOpacity={0.8}
          >
            <Stethoscope size={20} color={Colors.textInverse} />
            <Text style={styles.doctorButtonText}>Doctor</Text>
          </TouchableOpacity>
        </View>

        {doctoringEvents.length > 0 && (
          <View style={styles.recordsSection}>
            <SectionHeader title="Doctoring History" icon={<Stethoscope size={18} color={Colors.warning} />} onAdd={() => router.push({ pathname: "/log-doctoring-event", params: { animalId: animal.id } })} />
            <DoctoringTimeline events={doctoringEvents} onResolve={async (event) => {
              await updateDoctoringEvent({ ...event, resolved: true });
              if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }} />
          </View>
        )}

        <View style={styles.recordsSection}>
          <SectionHeader title="Weight Tracking" icon={<Scale size={18} color={Colors.accent} />} onAdd={() => router.push({ pathname: "/add-weight-record", params: { animalId: animal.id } })} />
          <WeightChart records={weightRecords} />
        </View>
        <View style={styles.recordsSection}>
          <SectionHeader title="Health Records" icon={<Heart size={18} color={Colors.error} />} onAdd={() => router.push({ pathname: "/add-health-record", params: { animalId: animal.id } })} />
          <HealthTimeline records={healthRecords} />
        </View>
        <View style={styles.recordsSection}>
          <SectionHeader title="Breeding" icon={<Baby size={18} color={Colors.success} />} onAdd={() => router.push({ pathname: "/add-breeding-record", params: { animalId: animal.id } })} />
          <BreedingSection records={breedingRecords} />
        </View>
        {customLists.length > 0 && (
          <View style={styles.recordsSection}>
            <SectionHeader title="Lists" icon={<List size={18} color={Colors.primary} />} onAdd={() => router.push({ pathname: "/add-to-list", params: { listId: "" } })} />
            <AnimalListsSection lists={animalLists} onRemove={handleRemoveFromList} />
          </View>
        )}

        {animal.mergedFromIds && animal.mergedFromIds.length > 0 && (
          <View style={styles.recordsSection}>
            <SectionHeader title="Merged From" icon={<GitMerge size={18} color={Colors.primary} />} />
            <View style={styles.identityCard}>
              <View style={styles.identityRow}>
                <Text style={styles.identityLabel}>Merged From</Text>
                <Text style={styles.mergedCount}>{animal.mergedFromIds.length} animal{animal.mergedFromIds.length > 1 ? "s" : ""}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.mergeButton} onPress={() => setShowMergeModal(true)} activeOpacity={0.7}>
            <GitMerge size={18} color={Colors.primary} />
            <Text style={styles.mergeButtonText}>Merge Duplicate</Text>
          </TouchableOpacity>
          {animal.status === "deceased" ? (
            <TouchableOpacity style={styles.undoDeceasedButton} onPress={handleUndoDeceased} activeOpacity={0.7}>
              <Undo2 size={18} color={Colors.warning} />
              <Text style={styles.undoDeceasedButtonText}>Undo Deceased</Text>
            </TouchableOpacity>
          ) : animal.status === "sold" ? (
            <TouchableOpacity style={styles.undoSoldButton} onPress={handleUndoSold} activeOpacity={0.7}>
              <Undo2 size={18} color={Colors.warning} />
              <Text style={styles.undoSoldButtonText}>Undo Sold</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={[styles.saleButton, animal.markedForSale && styles.saleButtonActive]} onPress={handleToggleSale} activeOpacity={0.7}>
                <Tag size={18} color={animal.markedForSale ? Colors.textInverse : Colors.accent} />
                <Text style={[styles.saleButtonText, animal.markedForSale && styles.saleButtonTextActive]}>{animal.markedForSale ? "Marked for Sale" : "Mark for Sale"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deceasedButton} onPress={handleMarkDeceased} activeOpacity={0.7}>
                <Skull size={18} color={Colors.textSecondary} />
                <Text style={styles.deceasedButtonText}>Mark Deceased</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.7}>
            <Trash2 size={18} color={Colors.error} />
            <Text style={styles.deleteButtonText}>Remove Animal</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>

      <Modal visible={showMergeModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Merge Duplicate</Text>
              <TouchableOpacity onPress={() => { setShowMergeModal(false); setMergeSearch(""); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Select the animal to merge into {animal ? getAnimalDisplayName(animal) : ""}. All their records will be transferred here.</Text>
            <View style={styles.modalSearchWrap}>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search by tag or name..."
                placeholderTextColor={Colors.textTertiary}
                value={mergeSearch}
                onChangeText={setMergeSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={mergeableCandidates}
              keyExtractor={(item) => item.id}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.mergeRow} onPress={() => handleMerge(item)} activeOpacity={0.7} disabled={isMergingAnimals}>
                  <View style={styles.mergeRowInfo}>
                    <Text style={styles.mergeRowTag}>{item.tagId}</Text>
                    {item.name ? <Text style={styles.mergeRowName}>{item.name}</Text> : null}
                    <Text style={styles.mergeRowMeta}>{item.breed} · {item.sex}</Text>
                  </View>
                  <GitMerge size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.mergeEmpty}>No matching animals found</Text>}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const createStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background },
  notFoundText: { fontSize: 16, color: Colors.textSecondary },
  heroSection: { height: 240, position: "relative" },
  heroImage: { width: "100%", height: 240, resizeMode: "cover" },
  heroPlaceholder: { width: "100%", height: 240, backgroundColor: Colors.secondaryLight, alignItems: "center", justifyContent: "center" },
  heroEmoji: { fontSize: 72 },
  heroOverlay: { position: "absolute", bottom: 12, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  photoButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(31, 61, 43, 0.85)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  heroTagBadge: { backgroundColor: "rgba(31, 61, 43, 0.9)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  heroTagText: { fontSize: 14, fontWeight: "700" as const, color: "#FFFFFF", letterSpacing: 1 },
  profileSection: { paddingHorizontal: 20, paddingTop: 20 },
  animalName: { fontSize: 28, fontWeight: "800" as const, color: Colors.text },
  animalBreed: { fontSize: 16, color: Colors.textSecondary, marginTop: 2 },
  businessYearLabel: { fontSize: 13, fontWeight: "500" as const, color: Colors.primary, marginTop: 4 },
  quickStats: { flexDirection: "row", backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginTop: 20, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  quickStatItem: { flex: 1, alignItems: "center" },
  quickStatValue: { fontSize: 14, fontWeight: "700" as const, color: Colors.text, textTransform: "capitalize" as const },
  quickStatLabel: { fontSize: 11, color: Colors.textTertiary, marginTop: 3 },
  quickStatDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  notesCard: { backgroundColor: Colors.surfaceElevated, borderRadius: 12, padding: 14, marginTop: 16, borderLeftWidth: 3, borderLeftColor: Colors.secondary },
  notesText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  recordsSection: { paddingHorizontal: 20, marginTop: 28 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.text },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.backgroundDark, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  addBtnText: { fontSize: 13, fontWeight: "600" as const, color: Colors.primary },
  chartContainer: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  chartBars: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", height: 120 },
  chartBarWrapper: { alignItems: "center", flex: 1 },
  chartBarValue: { fontSize: 10, fontWeight: "600" as const, color: Colors.textSecondary, marginBottom: 4 },
  chartBar: { width: 24, backgroundColor: Colors.accent, borderRadius: 6, opacity: 0.8 },
  chartBarLabel: { fontSize: 10, color: Colors.textTertiary, marginTop: 6 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  trendText: { fontSize: 13, color: Colors.success, fontWeight: "600" as const },
  timelineItem: { flexDirection: "row", marginBottom: 2 },
  timelineDotColumn: { width: 24, alignItems: "center" },
  healthDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  timelineConnector: { width: 2, flex: 1, backgroundColor: Colors.border, minHeight: 12 },
  timelineContent: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginLeft: 8, marginBottom: 8, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  timelineHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: "700" as const, textTransform: "capitalize" as const },
  timelineDate: { fontSize: 12, color: Colors.textTertiary },
  timelineDescription: { fontSize: 14, color: Colors.text, marginTop: 6, fontWeight: "500" as const },
  timelineNotes: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  breedingCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  breedingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  breedingStatus: { fontSize: 14, fontWeight: "700" as const, color: Colors.text, textTransform: "capitalize" as const },
  breedingDates: { marginTop: 10, gap: 6 },
  breedingDateItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  breedingDateLabel: { fontSize: 13, color: Colors.textSecondary },
  breedingNotes: { fontSize: 13, color: Colors.textSecondary, marginTop: 8, fontStyle: "italic" as const },
  emptyRecordText: { fontSize: 14, color: Colors.textTertiary, textAlign: "center" as const, paddingVertical: 20 },
  actionButtons: { paddingHorizontal: 20, marginTop: 36, gap: 10 },
  saleButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.surface, gap: 8, borderWidth: 1, borderColor: Colors.accent + "40" },
  saleButtonActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  saleButtonText: { fontSize: 15, fontWeight: "600" as const, color: Colors.accent },
  saleButtonTextActive: { color: Colors.textInverse },
  deceasedButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.surface, gap: 8, borderWidth: 1, borderColor: Colors.textSecondary + "30" },
  deceasedButtonText: { fontSize: 15, fontWeight: "600" as const, color: Colors.textSecondary },
  undoDeceasedButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.warning + "18", gap: 8, borderWidth: 1.5, borderColor: Colors.warning + "30" },
  undoDeceasedButtonText: { fontSize: 15, fontWeight: "700" as const, color: Colors.warning },
  undoSoldButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.warning + "18", gap: 8, borderWidth: 1.5, borderColor: Colors.warning + "30" },
  undoSoldButtonText: { fontSize: 15, fontWeight: "700" as const, color: Colors.warning },
  deleteButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.surface, gap: 8, borderWidth: 1, borderColor: Colors.error + "30" },
  deleteButtonText: { fontSize: 15, fontWeight: "600" as const, color: Colors.error },
  listsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  listChip: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 12, borderLeftWidth: 3, paddingRight: 8, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  listChipContent: { flexDirection: "row", alignItems: "center", paddingLeft: 10, paddingVertical: 8, gap: 6 },
  listChipIcon: { fontSize: 14 },
  listChipName: { fontSize: 13, fontWeight: "600" as const, color: Colors.text },
  listChipRemove: { padding: 6 },
  identityBadgeRow: { flexDirection: "row" as const, marginTop: 6 },
  identityBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  identityBadgeEstimated: { backgroundColor: Colors.warning + "18" },
  identityBadgeUnknown: { backgroundColor: Colors.textTertiary + "18" },
  identityBadgeText: { fontSize: 11, fontWeight: "600" as const },
  identityBadgeTextEstimated: { color: Colors.warning },
  identityBadgeTextUnknown: { color: Colors.textTertiary },
  identityCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  identityRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  identityLabel: { fontSize: 14, fontWeight: "600" as const, color: Colors.textSecondary },
  identityChips: { flexDirection: "row" as const, gap: 6 },
  identityChip: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.backgroundDark, borderWidth: 1, borderColor: Colors.border },
  identityChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  identityChipText: { fontSize: 11, fontWeight: "600" as const, color: Colors.textSecondary },
  identityChipTextActive: { color: Colors.textInverse },
  identityDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  generationEditRow: { flex: 1, alignItems: "flex-end" as const },
  generationDisplay: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.backgroundDark },
  generationDisplayText: { fontSize: 14, fontWeight: "700" as const, color: Colors.text },
  generationEditGroup: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  generationEditInput: { backgroundColor: Colors.backgroundDark, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: Colors.text, minWidth: 60, textAlign: "center" as const, borderWidth: 1, borderColor: Colors.border },
  estChipSmall: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.backgroundDark, borderWidth: 1, borderColor: Colors.border },
  estChipSmallActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  estChipSmallText: { fontSize: 12, fontWeight: "600" as const, color: Colors.textTertiary },
  estChipSmallTextActive: { color: Colors.textInverse },
  generationDoneBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primary },
  generationDoneBtnText: { fontSize: 12, fontWeight: "700" as const, color: Colors.textInverse },
  mergedCount: { fontSize: 13, fontWeight: "600" as const, color: Colors.textTertiary },
  mergeButton: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.surface, gap: 8, borderWidth: 1, borderColor: Colors.primary + "30" },
  mergeButtonText: { fontSize: 15, fontWeight: "600" as const, color: Colors.primary },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" as const },
  modalContent: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: "80%" as const },
  modalHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: "800" as const, color: Colors.text },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 14 },
  modalSearchWrap: { marginBottom: 12 },
  modalSearchInput: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  modalList: { maxHeight: 400 },
  mergeRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  mergeRowInfo: { flex: 1 },
  mergeRowTag: { fontSize: 15, fontWeight: "700" as const, color: Colors.text },
  mergeRowName: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  mergeRowMeta: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  mergeEmpty: { fontSize: 14, color: Colors.textTertiary, textAlign: "center" as const, paddingVertical: 24 },
  doctorButtonWrap: { paddingHorizontal: 20, marginTop: 20 },
  doctorButton: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: Colors.warning, borderRadius: 14, paddingVertical: 14, gap: 8, shadowColor: Colors.warning, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  doctorButtonText: { fontSize: 16, fontWeight: "700" as const, color: Colors.textInverse },
  doctoringCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginLeft: 8, marginBottom: 8, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  doctoringCardHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  doctoringCardHeaderLeft: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  doctoringEmoji: { fontSize: 14 },
  treatmentRow: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 4, marginTop: 6 },
  treatmentLabel: { fontSize: 12, fontWeight: "700" as const, color: Colors.primary },
  treatmentText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  attributionText: { fontSize: 11, fontWeight: "600" as const, color: Colors.textTertiary, marginTop: 8, fontStyle: "italic" as const },
  resolveBtn: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, marginTop: 8, alignSelf: "flex-start" as const, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.success + "15", borderWidth: 1, borderColor: Colors.success + "30" },
  resolveBtnText: { fontSize: 12, fontWeight: "600" as const, color: Colors.success },
  resolvedBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, marginTop: 6, alignSelf: "flex-start" as const },
  resolvedBadgeText: { fontSize: 11, fontWeight: "600" as const, color: Colors.success },
});
