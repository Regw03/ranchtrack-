import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { parseBirthDate } from "@/utils/helpers";
import { requireRanch } from "@/utils/ranchGuard";
import {
 supabase,
 generateInviteCode,
 pushAnimalToCloud,
 pushAnimalsBatchToCloud,
 deleteAnimalInCloud,
 fetchRanchAnimals,
 pushBusinessYearToCloud,
 pushActiveBusinessYearToCloud,
 fetchBusinessYears,
 pushBusinessYearsBatchToCloud,
 pushCalvingListToCloud,
 deleteCalvingListInCloud,
 pushCalvingRecordToCloud,
 deleteCalvingRecordInCloud,
 fetchCalvingData,
 type UserRole,
 type RemoteCalvingListRow,
 type RemoteCalvingRecordRow,
 pushDoctoringEventToCloud,
 deleteDoctoringEventInCloud,
 fetchDoctoringEvents,
 type RemoteDoctoringEventRow,
 pushWeightRecordToCloud,
 pushHealthRecordToCloud,
 fetchWeightHealthData,
 type RemoteWeightRecordRow,
 type RemoteHealthRecordRow,
 pushCustomListToCloud,
 deleteCustomListInCloud,
 fetchCustomLists,
 type RemoteCustomListRow,
 pushRanchNoteToCloud,
 deleteRanchNoteInCloud,
 fetchRanchNotes,
 type RemoteRanchNoteRow,
} from "@/lib/supabase";
import { scheduleAllNotifications } from "@/lib/notifications";
// eslint-disable-next-line rork/general-context-optimization
import {
 Animal,
 WeightRecord,
 HealthRecord,
 CalvingRecord,
 BusinessYear,
 ActivityLogEntry,
 Message,
 Ranch,
 RanchMember,
 User,
 CustomList,
 CalvingList,
 HerdGroup,
 DoctoringEvent,
 RanchNote,
} from "@/types";
import {
 MOCK_ANIMALS,
 MOCK_WEIGHT_RECORDS,
 MOCK_HEALTH_RECORDS,
 MOCK_ACTIVITY,
 MOCK_MESSAGES,
 MOCK_RANCH,
} from "@/mocks/animals";
import { getAnimalDisplayName } from "@/mocks/animals";


interface SoldSnapshot {
 animalId: string;
 markedForSale: boolean;
 saleNote?: string;
 listIds: string[];
 calvingGroupCowIds?: string[];
 calvingGroupCalfIds?: string[];
 breedingGroupIds?: string[];
}

interface DeceasedSnapshot {
 animalId: string;
 markedForSale: boolean;
 saleNote?: string;
 previousStatus: "active" | "sold";
 listIds: string[];
 calvingGroupCowIds?: string[];
 calvingGroupCalfIds?: string[];
 breedingGroupIds?: string[];
}

const STORAGE_KEYS = {
 animals: "ranchtrack_animals",
 soldSnapshots: "ranchtrack_sold_snapshots",
 weightRecords: "ranchtrack_weight_records",
 healthRecords: "ranchtrack_health_records",
 calvingRecords: "ranchtrack_calving_records",
 businessYears: "ranchtrack_business_years",
 activeBusinessYearId: "ranchtrack_active_business_year_id",
 activityLog: "ranchtrack_activity_log",
 messages: "ranchtrack_messages",
 ranch: "ranchtrack_ranch",
 currentUserId: "ranchtrack_current_user",
 customLists: "ranchtrack_custom_lists",
 calvingLists: "ranchtrack_calving_lists",
 deceasedSnapshots: "ranchtrack_deceased_snapshots",
 doctoringEvents: "ranchtrack_doctoring_events",
 ranchNotes: "ranchtrack_ranch_notes",
 users: "ranchtrack_users",
 currentUserIdValue: "ranchtrack_current_user_id",
} as const;

async function loadFromStorage<T>(key: string, fallback: T): Promise<T> {
 try {
 const stored = await AsyncStorage.getItem(key);
 if (stored) {
 return JSON.parse(stored) as T;
 }
 await AsyncStorage.setItem(key, JSON.stringify(fallback));
 return fallback;
 } catch (e) {
 console.log("Error loading from storage:", key, e);
 return fallback;
 }
}

async function saveToStorage<T>(key: string, data: T): Promise<void> {
 try {
 await AsyncStorage.setItem(key, JSON.stringify(data));
 } catch (e) {
 console.log("Error saving to storage:", key, e);
 }
}

function generateId(): string {
 return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Generates an RFC4122 v4 UUID. Required for Supabase columns that are typed
 * as `uuid` (e.g. ranch_members.user_id). Falls back to Math.random when
 * crypto.randomUUID is unavailable.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true when `value` is a valid v4-shaped UUID string. Used to guard
 * Supabase inserts on columns typed as `uuid` so legacy locally-generated ids
 * don't reach the backend.
 */
function isUuid(value: string | undefined | null): value is string {
 return typeof value === "string" && UUID_REGEX.test(value);
}

function generateUuid(): string {
 const g = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
 if (g?.randomUUID) {
 try {
 return g.randomUUID();
 } catch (e) {
 console.log("[generateUuid] randomUUID failed, falling back", e);
 }
 }
 return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
 const r = (Math.random() * 16) | 0;
 const v = c === "x" ? r : (r & 0x3) | 0x8;
 return v.toString(16);
 });
}

const DEFAULT_BUSINESS_YEAR: BusinessYear = {
 id: "by-default",
 name: "Spring Calving 2026",
 startDate: "2026-01-01",
 endDate: "2026-12-31",
 isActive: true,
 createdAt: new Date().toISOString(),
};

export function getHerdGroup(animal: Animal): HerdGroup {
 // Sex-based groups take priority — a bull is always a bull, never a calf
 if (animal.sex === "heifer") return "heifers";
 if (animal.sex === "steer") return "steers";
 if (animal.sex === "male") return "bulls";
 if (animal.sex === "female") {
 // Female cattle/horses are calves only if under 12 months AND came from a calving event
 // Otherwise treat as a cow
 if (animal.motherId && animal.birthDate) {
 const birthDate = parseBirthDate(animal.birthDate);
 const now = new Date();
 const ageInMonths =
 (now.getFullYear() - birthDate.getFullYear()) * 12 +
 (now.getMonth() - birthDate.getMonth());
 if (ageInMonths < 12) return "calves";
 }
 return "cows";
 }
 return "other";
}

export const HERD_GROUP_CONFIG: Record<HerdGroup, { label: string; emoji: string; color: string }> = {
 cows: { label: "Cows", emoji: "🐄", color: "#3D8B5E" },
 heifers: { label: "Heifers", emoji: "🐂", color: "#D4943A" },
 calves: { label: "Calves", emoji: "🐮", color: "#2D7A9C" },
 bulls: { label: "Bulls", emoji: "🐃", color: "#C4622D" },
 steers: { label: "Steers", emoji: "🐄", color: "#7B5EA7" },
 other: { label: "Horses & Other", emoji: "🐎", color: "#6B6B6B" },
};

// eslint-disable-next-line rork/general-context-optimization
export const [RanchProvider, useRanch] = createContextHook(() => {
 const queryClient = useQueryClient();

 const usersQuery = useQuery({
 queryKey: ["users"],
 queryFn: () => loadFromStorage<User[]>(STORAGE_KEYS.users, []),
 });
 const users = usersQuery.data ?? [];

 const currentUserIdQuery = useQuery({
 queryKey: ["currentUserId"],
 queryFn: () => loadFromStorage<string>(STORAGE_KEYS.currentUserIdValue, ""),
 });
 const currentUserId = currentUserIdQuery.data ?? "";
 const currentUser = useMemo(
 () => users.find((u) => u.id === currentUserId),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [users.length, currentUserId],
 );
 const currentUserName = currentUser?.name ?? "";

 const ranchQuery = useQuery({
 queryKey: ["ranch"],
 queryFn: () => loadFromStorage<Ranch>(STORAGE_KEYS.ranch, MOCK_RANCH),
 });

 const animalsQuery = useQuery({
 queryKey: ["animals"],
 queryFn: () => loadFromStorage<Animal[]>(STORAGE_KEYS.animals, MOCK_ANIMALS),
 });

 const weightRecordsQuery = useQuery({
 queryKey: ["weightRecords"],
 queryFn: () => loadFromStorage<WeightRecord[]>(STORAGE_KEYS.weightRecords, MOCK_WEIGHT_RECORDS),
 });

 const healthRecordsQuery = useQuery({
 queryKey: ["healthRecords"],
 queryFn: () => loadFromStorage<HealthRecord[]>(STORAGE_KEYS.healthRecords, MOCK_HEALTH_RECORDS),
 });


 const calvingRecordsQuery = useQuery({
 queryKey: ["calvingRecords"],
 queryFn: () => loadFromStorage<CalvingRecord[]>(STORAGE_KEYS.calvingRecords, []),
 });

 const businessYearsQuery = useQuery({
 queryKey: ["businessYears"],
 queryFn: () => loadFromStorage<BusinessYear[]>(STORAGE_KEYS.businessYears, [DEFAULT_BUSINESS_YEAR]),
 });

 const activeBusinessYearIdQuery = useQuery({
 queryKey: ["activeBusinessYearId"],
 queryFn: () => loadFromStorage<string>(STORAGE_KEYS.activeBusinessYearId, DEFAULT_BUSINESS_YEAR.id),
 });

 const activityQuery = useQuery({
 queryKey: ["activityLog"],
 queryFn: () => loadFromStorage<ActivityLogEntry[]>(STORAGE_KEYS.activityLog, MOCK_ACTIVITY),
 });

 const messagesQuery = useQuery({
 queryKey: ["messages"],
 queryFn: () => loadFromStorage<Message[]>(STORAGE_KEYS.messages, MOCK_MESSAGES),
 });

 const customListsQuery = useQuery({
 queryKey: ["customLists"],
 queryFn: () => loadFromStorage<CustomList[]>(STORAGE_KEYS.customLists, []),
 });

 const calvingListsQuery = useQuery({
 queryKey: ["calvingLists"],
 queryFn: () => loadFromStorage<CalvingList[]>(STORAGE_KEYS.calvingLists, []),
 });



 const soldSnapshotsQuery = useQuery({
 queryKey: ["soldSnapshots"],
 queryFn: () => loadFromStorage<SoldSnapshot[]>(STORAGE_KEYS.soldSnapshots, []),
 });
 const _soldSnapshots = soldSnapshotsQuery.data ?? [];

 const deceasedSnapshotsQuery = useQuery({
 queryKey: ["deceasedSnapshots"],
 queryFn: () => loadFromStorage<DeceasedSnapshot[]>(STORAGE_KEYS.deceasedSnapshots, []),
 });
 const _deceasedSnapshots = deceasedSnapshotsQuery.data ?? [];

 const doctoringEventsQuery = useQuery({
 queryKey: ["doctoringEvents"],
 queryFn: () => loadFromStorage<DoctoringEvent[]>(STORAGE_KEYS.doctoringEvents, []),
 });
 const doctoringEvents = doctoringEventsQuery.data ?? [];

 const ranchNotesQuery = useQuery({
 queryKey: ["ranchNotes"],
 queryFn: () => loadFromStorage<RanchNote[]>(STORAGE_KEYS.ranchNotes, []),
 });
 const ranchNotes = ranchNotesQuery.data ?? [];

 const ranch = ranchQuery.data ?? MOCK_RANCH;
 const animals = animalsQuery.data ?? [];
 const weightRecords = weightRecordsQuery.data ?? [];
 const healthRecords = healthRecordsQuery.data ?? [];
 const calvingRecords = calvingRecordsQuery.data ?? [];
 const businessYears = businessYearsQuery.data ?? [DEFAULT_BUSINESS_YEAR];
 const activeBusinessYearId = activeBusinessYearIdQuery.data ?? DEFAULT_BUSINESS_YEAR.id;
 const activityLog = activityQuery.data ?? [];
 const messages = messagesQuery.data ?? [];
 const customLists = customListsQuery.data ?? [];
 const allCalvingLists = calvingListsQuery.data ?? [];

 const calvingLists = useMemo(
 () => allCalvingLists.filter((l) => l.businessYearId === activeBusinessYearId),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [allCalvingLists.length, activeBusinessYearId],
 );



 const isLoading = animalsQuery.isLoading || ranchQuery.isLoading || businessYearsQuery.isLoading;

 const activeBusinessYear = useMemo(
 () => businessYears.find((by) => by.id === activeBusinessYearId) ?? businessYears[0] ?? DEFAULT_BUSINESS_YEAR,
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [businessYears.length, activeBusinessYearId],
 );

 const getBusinessYearName = useCallback(
 (yearId?: string): string => {
 if (!yearId) return "";
 const year = businessYears.find((by) => by.id === yearId);
 return year?.name ?? "";
 },
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [businessYears.length],
 );

 const isDuplicateTagInSameYear = useCallback(
 (tagId: string, businessYearId?: string, excludeAnimalId?: string): boolean => {
 return animals.some(
 (a) =>
 a.tagId.toLowerCase() === tagId.toLowerCase() &&
 a.id !== excludeAnimalId &&
 (a.businessYearId ?? "") === (businessYearId ?? ""),
 );
 },
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [animals.length],
 );

 const getAnimalDisplayWithYear = useCallback(
 (animal: Animal): string => {
 const baseName = getAnimalDisplayName(animal);
 const hasDuplicateTag = animals.some(
 (a) => a.id !== animal.id && a.tagId.toLowerCase() === animal.tagId.toLowerCase(),
 );
 if (hasDuplicateTag && animal.businessYearId) {
 const yearName = getBusinessYearName(animal.businessYearId);
 if (yearName) return `${baseName} (${yearName})`;
 }
 return baseName;
 },
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [animals.length, getBusinessYearName],
 );

 const logActivity = useCallback(
 async (action: string, entityType?: ActivityLogEntry["entityType"], entityId?: string) => {
 const entry: ActivityLogEntry = {
 id: generateId(),
 ranchId: ranch.id,
 userId: currentUserId,
 userName: currentUserName,
 action,
 entityType,
 entityId,
 timestamp: new Date().toISOString(),
 };
 const current = queryClient.getQueryData<ActivityLogEntry[]>(["activityLog"]) ?? [];
 const updated = [entry, ...current];
 queryClient.setQueryData(["activityLog"], updated);
 await saveToStorage(STORAGE_KEYS.activityLog, updated);
 },
 [ranch.id, queryClient],
 );

 const animalsSaleKey = useMemo(
 () => animals.map((a) => `${a.id}:${a.status}:${a.markedForSale}`).join(","),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [animals],
 );

 const activeAnimals = useMemo(
 () => animals.filter((a) => a.status === "active"),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [animalsSaleKey],
 );

 const animalsByHerdGroup = useMemo(() => {
 const groups: Record<HerdGroup, Animal[]> = {
 cows: [],
 heifers: [],
 calves: [],
 bulls: [],
 steers: [],
 other: [],
 };
 activeAnimals.forEach((animal) => {
 const group = getHerdGroup(animal);
 groups[group].push(animal);
 });
 return groups;
 }, [activeAnimals]);


 const forSaleAnimals = useMemo(
 () => animals.filter((a) => a.markedForSale && a.status === "active"),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [animalsSaleKey],
 );

 const soldAnimals = useMemo(
 () => animals.filter((a) => a.status === "sold"),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [animalsSaleKey],
 );

 const deceasedAnimals = useMemo(
 () => animals.filter((a) => a.status === "deceased"),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [animalsSaleKey],
 );

 const calvingRecordsForYear = useMemo(
 () => calvingRecords.filter((r) => r.businessYearId === activeBusinessYearId)
 .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [calvingRecords.length, activeBusinessYearId],
 );

 const addAnimalMutation = useMutation({
 mutationFn: async (animal: Omit<Animal, "id" | "ranchId" | "createdAt" | "updatedAt">) => {
 requireRanch(ranch.id, "add animal");
 const newAnimal: Animal = {
 ...animal,
 id: generateId(),
 ranchId: ranch.id,
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 };
 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const updated = [...currentAnimals, newAnimal];
 await saveToStorage(STORAGE_KEYS.animals, updated);
 await logActivity(`Added new animal: ${getAnimalDisplayName(newAnimal)} (${newAnimal.tagId})`, "animal", newAnimal.id);
 void pushAnimalToCloud(newAnimal, currentUserId || null);
 return { updated, newAnimal };
 },
 onSuccess: ({ updated }) => {
 queryClient.setQueryData(["animals"], updated);
 },
 });

 const updateAnimalMutation = useMutation({
 mutationFn: async (animal: Animal) => {
 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const updatedAnimal: Animal = { ...animal, updatedAt: new Date().toISOString() };
 const updated = currentAnimals.map((a) => (a.id === animal.id ? updatedAnimal : a));
 await saveToStorage(STORAGE_KEYS.animals, updated);
 await logActivity(`Updated ${getAnimalDisplayName(animal)}`, "animal", animal.id);
 void pushAnimalToCloud(updatedAnimal, currentUserId || null);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["animals"], updated);
 },
 });

 const deleteAnimalMutation = useMutation({
 mutationFn: async (animalId: string) => {
 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const animal = currentAnimals.find((a) => a.id === animalId);
 const updated = currentAnimals.filter((a) => a.id !== animalId);
 await saveToStorage(STORAGE_KEYS.animals, updated);
 void deleteAnimalInCloud(animalId, ranch.id);

 const currentCalving = queryClient.getQueryData<CalvingRecord[]>(["calvingRecords"]) ?? [];
 const updatedCalving = currentCalving.filter((r) => r.calfId !== animalId);
 if (updatedCalving.length !== currentCalving.length) {
 await saveToStorage(STORAGE_KEYS.calvingRecords, updatedCalving);
 queryClient.setQueryData(["calvingRecords"], updatedCalving);
 }

 if (animal) {
 await logActivity(`Removed ${getAnimalDisplayName(animal)} (${animal.tagId})`, "animal", animalId);
 }
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["animals"], updated);
 },
 });

 const addWeightRecordMutation = useMutation({
 mutationFn: async (record: Omit<WeightRecord, "id">) => {
 const newRecord: WeightRecord = { ...record, id: generateId() };
 const current = queryClient.getQueryData<WeightRecord[]>(["weightRecords"]) ?? [];
 const updated = [...current, newRecord];
 await saveToStorage(STORAGE_KEYS.weightRecords, updated);
 void pushWeightRecordToCloud(newRecord, ranch.id);
 const animal = animals.find((a) => a.id === record.animalId);
 if (animal) {
 await logActivity(`Added weight record for ${getAnimalDisplayName(animal)} (${record.weight} ${record.unit})`, "weight", animal.id);
 }
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["weightRecords"], updated);
 },
 });

 const deleteWeightRecordMutation = useMutation({
 mutationFn: async (recordId: string) => {
 const current = queryClient.getQueryData<WeightRecord[]>(["weightRecords"]) ?? [];
 const updated = current.filter((r) => r.id !== recordId);
 await saveToStorage(STORAGE_KEYS.weightRecords, updated);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["weightRecords"], updated);
 },
 });

 const addHealthRecordMutation = useMutation({
 mutationFn: async (record: Omit<HealthRecord, "id">) => {
 const newRecord: HealthRecord = { ...record, id: generateId() };
 const current = queryClient.getQueryData<HealthRecord[]>(["healthRecords"]) ?? [];
 const updated = [...current, newRecord];
 await saveToStorage(STORAGE_KEYS.healthRecords, updated);
 void pushHealthRecordToCloud(newRecord, ranch.id);
 const animal = animals.find((a) => a.id === record.animalId);
 if (animal) {
 await logActivity(`Logged ${record.type} for ${getAnimalDisplayName(animal)}`, "health", animal.id);
 }
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["healthRecords"], updated);
 },
 });

 const deleteHealthRecordMutation = useMutation({
 mutationFn: async (recordId: string) => {
 const current = queryClient.getQueryData<HealthRecord[]>(["healthRecords"]) ?? [];
 const updated = current.filter((r) => r.id !== recordId);
 await saveToStorage(STORAGE_KEYS.healthRecords, updated);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["healthRecords"], updated);
 },
 });


 const createBusinessYearMutation = useMutation({
 mutationFn: async (year: Omit<BusinessYear, "id" | "createdAt">) => {
 const newYear: BusinessYear = {
 ...year,
 id: generateId(),
 createdAt: new Date().toISOString(),
 };
 const current = queryClient.getQueryData<BusinessYear[]>(["businessYears"]) ?? [];
 const updated = [...current, newYear];
 await saveToStorage(STORAGE_KEYS.businessYears, updated);
 if (year.isActive) {
 await saveToStorage(STORAGE_KEYS.activeBusinessYearId, newYear.id);
 queryClient.setQueryData(["activeBusinessYearId"], newYear.id);
 }

 // Push new year to cloud; if active, push the active year selection too
 void pushBusinessYearToCloud(newYear, ranch.id, currentUserRole);
 if (year.isActive) {
 void pushActiveBusinessYearToCloud(newYear.id, ranch.id, currentUserRole);
 }

 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const promotedCalves: Animal[] = [];
 const updatedAnimals = currentAnimals.map((a) => {
 const isActiveFemale = a.status === "active" && a.sex === "female";
 const isCalf = getHerdGroup(a) === "calves";
 if (isActiveFemale && isCalf) {
 console.log(`Promoting calf ${a.tagId} to replacement heifer for new business year: ${newYear.name}`);
 const promoted = { ...a, sex: "heifer" as const, updatedAt: new Date().toISOString() };
 promotedCalves.push(promoted);
 return promoted;
 }
 return a;
 });

 if (promotedCalves.length > 0) {
 await saveToStorage(STORAGE_KEYS.animals, updatedAnimals);
 queryClient.setQueryData(["animals"], updatedAnimals);
 await logActivity(
 `Promoted ${promotedCalves.length} female calf${promotedCalves.length > 1 ? "s" : ""} to replacement heifer${promotedCalves.length > 1 ? "s" : ""} for ${newYear.name}`,
 );
 }

 await logActivity(`Created business year: ${newYear.name}`);
 return { updated, newYear };
 },
 onSuccess: ({ updated }) => {
 queryClient.setQueryData(["businessYears"], updated);
 },
 });

 const setActiveBusinessYearMutation = useMutation({
 mutationFn: async (yearId: string) => {
 await saveToStorage(STORAGE_KEYS.activeBusinessYearId, yearId);
 // Push active year change to cloud (owner/manager only enforced by the function)
 void pushActiveBusinessYearToCloud(yearId, ranch.id, currentUserRole);
 return yearId;
 },
 onSuccess: (yearId) => {
 queryClient.setQueryData(["activeBusinessYearId"], yearId);
 },
 });

 const sendMessageMutation = useMutation({
 mutationFn: async (messageText: string) => {
 const newMessage: Message = {
 id: generateId(),
 ranchId: ranch.id,
 userId: currentUserId,
 userName: currentUserName,
 message: messageText,
 timestamp: new Date().toISOString(),
 };
 const updated = [...messages, newMessage];
 await saveToStorage(STORAGE_KEYS.messages, updated);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["messages"], updated);
 },
 });

 const getAnimalById = useCallback(
 (id: string) => animals.find((a) => a.id === id),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [animalsQuery.dataUpdatedAt],
 );

 const getWeightRecordsForAnimal = useCallback(
 (animalId: string) =>
 weightRecords.filter((r) => r.animalId === animalId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [weightRecords.length],
 );

 const getHealthRecordsForAnimal = useCallback(
 (animalId: string) =>
 healthRecords.filter((r) => r.animalId === animalId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [healthRecords.length],
 );


 const animalStats = useMemo(() => {
 const allActive = animals.filter((a) => a.status === "active");
 const breedingHerd = allActive.filter((a) => getHerdGroup(a) !== "calves");
 const calvesCount = allActive.filter((a) => getHerdGroup(a) === "calves").length;
 const bySpecies = breedingHerd.reduce<Record<string, number>>((acc, a) => {
 acc[a.species] = (acc[a.species] || 0) + 1;
 return acc;
 }, {});
 const forSale = animals.filter((a) => a.markedForSale).length;
 return {
 total: breedingHerd.length,
 calvesCount,
 bySpecies,
 active: breedingHerd.length,
 forSale,
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [animals.length]);


 const getAnimalVaccinationStatus = useCallback(
 (animalId: string): "vaccinated" | "needs_vaccination" | "no_records" => {
 const records = healthRecords.filter((r) => r.animalId === animalId && r.type === "vaccination");
 if (records.length === 0) return "no_records";
 const latest = records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
 const monthsSince = (Date.now() - new Date(latest.date).getTime()) / (30.44 * 86400000);
 return monthsSince <= 12 ? "vaccinated" : "needs_vaccination";
 },
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [healthRecords.length],
 );

 const getSubLists = useCallback(
 (parentId: string) => customLists.filter((l) => l.parentId === parentId),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [customLists.length, customLists],
 );

 const createListMutation = useMutation({
 mutationFn: async (list: Omit<CustomList, "id" | "ranchId" | "createdAt" | "updatedAt" | "createdBy">) => {
 const newList: CustomList = {
 ...list,
 id: generateId(),
 ranchId: ranch.id,
 createdBy: currentUserId,
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 };
 const updated = [...customLists, newList];
 await saveToStorage(STORAGE_KEYS.customLists, updated);
 await logActivity(`Created list "${newList.name}"`);
 void pushCustomListToCloud(newList, currentUserRole);
 return { updated, newList };
 },
 onSuccess: ({ updated }) => {
 queryClient.setQueryData(["customLists"], updated);
 },
 });

 const updateListMutation = useMutation({
 mutationFn: async (list: CustomList) => {
 const updated = customLists.map((l) =>
 l.id === list.id ? { ...list, updatedAt: new Date().toISOString() } : l,
 );
 await saveToStorage(STORAGE_KEYS.customLists, updated);
 const updatedList = updated.find((l) => l.id === list.id);
 if (updatedList) void pushCustomListToCloud(updatedList, currentUserRole);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["customLists"], updated);
 },
 });

 const deleteListMutation = useMutation({
 mutationFn: async (listId: string) => {
 const list = customLists.find((l) => l.id === listId);
 const updated = customLists.filter((l) => l.id !== listId);
 await saveToStorage(STORAGE_KEYS.customLists, updated);
 if (list) {
 await logActivity(`Deleted list "${list.name}"`);
 void deleteCustomListInCloud(listId, currentUserRole);
 }
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["customLists"], updated);
 },
 });

 const addAnimalToListMutation = useMutation({
 mutationFn: async ({ listId, animalId }: { listId: string; animalId: string }) => {
 const updated = customLists.map((l) => {
 if (l.id === listId && !l.animalIds.includes(animalId)) {
 return { ...l, animalIds: [...l.animalIds, animalId], updatedAt: new Date().toISOString() };
 }
 return l;
 });
 await saveToStorage(STORAGE_KEYS.customLists, updated);
 const updatedList = updated.find((l) => l.id === listId);
 if (updatedList) void pushCustomListToCloud(updatedList, currentUserRole);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["customLists"], updated);
 },
 });

 const removeAnimalFromListMutation = useMutation({
 mutationFn: async ({ listId, animalId }: { listId: string; animalId: string }) => {
 const updated = customLists.map((l) => {
 if (l.id === listId) {
 return { ...l, animalIds: l.animalIds.filter((id) => id !== animalId), updatedAt: new Date().toISOString() };
 }
 return l;
 });
 await saveToStorage(STORAGE_KEYS.customLists, updated);
 const updatedList = updated.find((l) => l.id === listId);
 if (updatedList) void pushCustomListToCloud(updatedList, currentUserRole);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["customLists"], updated);
 },
 });

 const toggleMarkedForSale = useMutation({
 mutationFn: async ({ animalId, note }: { animalId: string; note?: string }) => {
 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const updated = currentAnimals.map((a) =>
 a.id === animalId
 ? { ...a, markedForSale: !a.markedForSale, saleNote: note ?? a.saleNote, updatedAt: new Date().toISOString() }
 : a,
 );
 await saveToStorage(STORAGE_KEYS.animals, updated);
 const changed = updated.find((a) => a.id === animalId);
 if (changed) void pushAnimalToCloud(changed, currentUserId || null);
 const animal = currentAnimals.find((a) => a.id === animalId);
 if (animal) {
 const newStatus = !animal.markedForSale;
 await logActivity(
 `${newStatus ? "Marked" : "Unmarked"} ${getAnimalDisplayName(animal)} for sale`,
 "animal",
 animalId,
 );
 }
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["animals"], updated);
 },
 });

 const markAsSold = useMutation({
 mutationFn: async (animalId: string) => {
 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const animal = currentAnimals.find((a) => a.id === animalId);

 const currentLists = queryClient.getQueryData<CustomList[]>(["customLists"]) ?? [];


 const snapshot: SoldSnapshot = {
 animalId,
 markedForSale: animal?.markedForSale ?? false,
 saleNote: animal?.saleNote,
 listIds: currentLists.filter((l) => l.animalIds.includes(animalId)).map((l) => l.id),
 };
 const currentSnapshots = queryClient.getQueryData<SoldSnapshot[]>(["soldSnapshots"]) ?? [];
 const updatedSnapshots = [...currentSnapshots.filter((s) => s.animalId !== animalId), snapshot];
 await saveToStorage(STORAGE_KEYS.soldSnapshots, updatedSnapshots);

 const updatedAnimals = currentAnimals.map((a) =>
 a.id === animalId
 ? { ...a, status: "sold" as const, markedForSale: false, updatedAt: new Date().toISOString() }
 : a,
 );
 await saveToStorage(STORAGE_KEYS.animals, updatedAnimals);
 const changedAnimal = updatedAnimals.find((a) => a.id === animalId);
 if (changedAnimal) void pushAnimalToCloud(changedAnimal, currentUserId || null);

 const updatedLists = currentLists.map((l) => {
 if (l.animalIds.includes(animalId)) {
 return { ...l, animalIds: l.animalIds.filter((id) => id !== animalId), updatedAt: new Date().toISOString() };
 }
 return l;
 });
 await saveToStorage(STORAGE_KEYS.customLists, updatedLists);

 if (animal) {
 await logActivity(`Marked ${getAnimalDisplayName(animal)} as sold`, "animal", animalId);
 }
 return { updatedAnimals, updatedLists, updatedSnapshots };
 },
 onSuccess: ({ updatedAnimals, updatedLists, updatedSnapshots }) => {
 queryClient.setQueryData(["animals"], updatedAnimals);
 queryClient.setQueryData(["customLists"], updatedLists);
 queryClient.setQueryData(["soldSnapshots"], updatedSnapshots);
 },
 });

 const markAsDeceased = useMutation({
 mutationFn: async (animalId: string) => {
 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const animal = currentAnimals.find((a) => a.id === animalId);

 const currentLists = queryClient.getQueryData<CustomList[]>(["customLists"]) ?? [];


 const snapshot: DeceasedSnapshot = {
 animalId,
 markedForSale: animal?.markedForSale ?? false,
 saleNote: animal?.saleNote,
 previousStatus: (animal?.status === "sold" ? "sold" : "active") as "active" | "sold",
 listIds: currentLists.filter((l) => l.animalIds.includes(animalId)).map((l) => l.id),
 };
 const currentSnapshots = queryClient.getQueryData<DeceasedSnapshot[]>(["deceasedSnapshots"]) ?? [];
 const updatedSnapshots = [...currentSnapshots.filter((s) => s.animalId !== animalId), snapshot];
 await saveToStorage(STORAGE_KEYS.deceasedSnapshots, updatedSnapshots);

 const updatedAnimals = currentAnimals.map((a) =>
 a.id === animalId
 ? { ...a, status: "deceased" as const, markedForSale: false, updatedAt: new Date().toISOString() }
 : a,
 );
 await saveToStorage(STORAGE_KEYS.animals, updatedAnimals);
 const changedAnimal = updatedAnimals.find((a) => a.id === animalId);
 if (changedAnimal) void pushAnimalToCloud(changedAnimal, currentUserId || null);

 const updatedLists = currentLists.map((l) => {
 if (l.animalIds.includes(animalId)) {
 return { ...l, animalIds: l.animalIds.filter((id) => id !== animalId), updatedAt: new Date().toISOString() };
 }
 return l;
 });
 await saveToStorage(STORAGE_KEYS.customLists, updatedLists);

 if (animal) {
 await logActivity(`Marked ${getAnimalDisplayName(animal)} as deceased`, "animal", animalId);
 }
 return { updatedAnimals, updatedLists, updatedSnapshots };
 },
 onSuccess: ({ updatedAnimals, updatedLists, updatedSnapshots }) => {
 queryClient.setQueryData(["animals"], updatedAnimals);
 queryClient.setQueryData(["customLists"], updatedLists);
 queryClient.setQueryData(["deceasedSnapshots"], updatedSnapshots);
 },
 });

 const undoDeceased = useMutation({
 mutationFn: async (animalId: string) => {
 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const currentSnapshots = queryClient.getQueryData<DeceasedSnapshot[]>(["deceasedSnapshots"]) ?? [];
 const snapshot = currentSnapshots.find((s) => s.animalId === animalId);

 const updatedAnimals = currentAnimals.map((a) =>
 a.id === animalId
 ? {
 ...a,
 status: (snapshot?.previousStatus ?? "active") as "active" | "sold",
 markedForSale: snapshot?.markedForSale ?? false,
 saleNote: snapshot?.saleNote ?? a.saleNote,
 updatedAt: new Date().toISOString(),
 }
 : a,
 );
 await saveToStorage(STORAGE_KEYS.animals, updatedAnimals);
 const changedAnimal = updatedAnimals.find((a) => a.id === animalId);
 if (changedAnimal) void pushAnimalToCloud(changedAnimal, currentUserId || null);

 const currentLists = queryClient.getQueryData<CustomList[]>(["customLists"]) ?? [];
 let updatedLists = currentLists;
 if (snapshot && snapshot.listIds.length > 0) {
 updatedLists = currentLists.map((l) => {
 if (snapshot.listIds.includes(l.id) && !l.animalIds.includes(animalId)) {
 return { ...l, animalIds: [...l.animalIds, animalId], updatedAt: new Date().toISOString() };
 }
 return l;
 });
 await saveToStorage(STORAGE_KEYS.customLists, updatedLists);
 }

 const updatedSnapshots = currentSnapshots.filter((s) => s.animalId !== animalId);
 await saveToStorage(STORAGE_KEYS.deceasedSnapshots, updatedSnapshots);

 const animal = currentAnimals.find((a) => a.id === animalId);
 if (animal) {
 await logActivity(`Undid deceased status for ${getAnimalDisplayName(animal)} — restored to previous state`, "animal", animalId);
 }
 return { updatedAnimals, updatedLists, updatedSnapshots };
 },
 onSuccess: ({ updatedAnimals, updatedLists, updatedSnapshots }) => {
 queryClient.setQueryData(["animals"], updatedAnimals);
 queryClient.setQueryData(["customLists"], updatedLists);
 queryClient.setQueryData(["deceasedSnapshots"], updatedSnapshots);
 },
 });

 const undoSold = useMutation({
 mutationFn: async (animalId: string) => {
 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const currentSnapshots = queryClient.getQueryData<SoldSnapshot[]>(["soldSnapshots"]) ?? [];
 const snapshot = currentSnapshots.find((s) => s.animalId === animalId);

 const updatedAnimals = currentAnimals.map((a) =>
 a.id === animalId
 ? {
 ...a,
 status: "active" as const,
 markedForSale: snapshot?.markedForSale ?? true,
 saleNote: snapshot?.saleNote ?? a.saleNote,
 updatedAt: new Date().toISOString(),
 }
 : a,
 );
 await saveToStorage(STORAGE_KEYS.animals, updatedAnimals);
 const changedAnimal = updatedAnimals.find((a) => a.id === animalId);
 if (changedAnimal) void pushAnimalToCloud(changedAnimal, currentUserId || null);

 const currentLists = queryClient.getQueryData<CustomList[]>(["customLists"]) ?? [];
 let updatedLists = currentLists;
 if (snapshot && snapshot.listIds.length > 0) {
 updatedLists = currentLists.map((l) => {
 if (snapshot.listIds.includes(l.id) && !l.animalIds.includes(animalId)) {
 return { ...l, animalIds: [...l.animalIds, animalId], updatedAt: new Date().toISOString() };
 }
 return l;
 });
 await saveToStorage(STORAGE_KEYS.customLists, updatedLists);
 }

 const updatedSnapshots = currentSnapshots.filter((s) => s.animalId !== animalId);
 await saveToStorage(STORAGE_KEYS.soldSnapshots, updatedSnapshots);

 const animal = currentAnimals.find((a) => a.id === animalId);
 if (animal) {
 await logActivity(`Undid sold status for ${getAnimalDisplayName(animal)} — restored to previous state`, "animal", animalId);
 }
 return { updatedAnimals, updatedLists, updatedSnapshots };
 },
 onSuccess: ({ updatedAnimals, updatedLists, updatedSnapshots }) => {
 queryClient.setQueryData(["animals"], updatedAnimals);
 queryClient.setQueryData(["customLists"], updatedLists);
 queryClient.setQueryData(["soldSnapshots"], updatedSnapshots);
 },
 });

 const getListsForAnimal = useCallback(
 (animalId: string) => customLists.filter((l) => l.animalIds.includes(animalId)),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [customLists.length, customLists],
 );

 const getListById = useCallback(
 (id: string) => customLists.find((l) => l.id === id),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [customLists.length, customLists],
 );

 // ─── Calving List mutations (new simple system) ───────────────────────────

 const createCalvingListMutation = useMutation({
 mutationFn: async (list: { name: string; color: string }) => {
 requireRanch(ranch.id, "create calving list");
 const newList: CalvingList = {
 id: generateId(),
 ranchId: ranch.id,
 name: list.name,
 color: list.color,
 businessYearId: activeBusinessYearId,
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 };
 const current = queryClient.getQueryData<CalvingList[]>(["calvingLists"]) ?? [];
 const updated = [...current, newList];
 await saveToStorage(STORAGE_KEYS.calvingLists, updated);
 await logActivity(`Created calving list "${newList.name}"`);
 void pushCalvingListToCloud(newList, ranch.id, currentUserRole);
 return { updated, newList };
 },
 onSuccess: ({ updated }) => {
 queryClient.setQueryData(["calvingLists"], updated);
 },
 });

 const updateCalvingListMutation = useMutation({
 mutationFn: async (list: CalvingList) => {
 const current = queryClient.getQueryData<CalvingList[]>(["calvingLists"]) ?? [];
 const updated = current.map((l) =>
 l.id === list.id ? { ...list, updatedAt: new Date().toISOString() } : l,
 );
 await saveToStorage(STORAGE_KEYS.calvingLists, updated);
 const updatedList = updated.find((l) => l.id === list.id);
 if (updatedList) void pushCalvingListToCloud(updatedList, ranch.id, currentUserRole);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["calvingLists"], updated);
 },
 });

 const deleteCalvingListMutation = useMutation({
 mutationFn: async (listId: string) => {
 const current = queryClient.getQueryData<CalvingList[]>(["calvingLists"]) ?? [];
 const list = current.find((l) => l.id === listId);
 const updated = current.filter((l) => l.id !== listId);
 await saveToStorage(STORAGE_KEYS.calvingLists, updated);
 const currentRecords = queryClient.getQueryData<CalvingRecord[]>(["calvingRecords"]) ?? [];
 const updatedRecords = currentRecords.filter((r) => r.calvingListId !== listId);
 await saveToStorage(STORAGE_KEYS.calvingRecords, updatedRecords);
 queryClient.setQueryData(["calvingRecords"], updatedRecords);
 if (list) await logActivity(`Deleted calving list "${list.name}"`);
 void deleteCalvingListInCloud(listId, currentUserRole);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["calvingLists"], updated);
 },
 });

 const logCalvingEventMutation = useMutation({
 mutationFn: async (record: {
 calvingListId: string;
 birthMonth: number;
 birthDay: number;
 cowTag: string;
 calfTag: string;
 assisted: boolean;
 calfType?: "heifer" | "steer" | "bull";
 sireTag?: string;
 birthWeight?: number;
 birthWeightUnit?: "lbs" | "kg";
 notes?: string;
 photoUrl?: string;
 }) => {
 requireRanch(ranch.id, "log calving event");
 const now = new Date().toISOString();

 // Build the full ISO date from month + day + business year
 const activeYear = queryClient.getQueryData<BusinessYear[]>(["businessYears"])
 ?.find((y) => y.id === activeBusinessYearId);
 const yearNum = activeYear
 ? new Date(activeYear.startDate).getFullYear()
 : new Date().getFullYear();
 const mm = String(record.birthMonth).padStart(2, "0");
 const dd = String(record.birthDay).padStart(2, "0");
 const fullDate = `${yearNum}-${mm}-${dd}`;

 const newRecord: CalvingRecord = {
 id: generateId(),
 calvingListId: record.calvingListId,
 businessYearId: activeBusinessYearId,
 birthMonth: record.birthMonth,
 birthDay: record.birthDay,
 date: fullDate,
 cowTag: record.cowTag,
 calfTag: record.calfTag,
 assisted: record.assisted,
 calfType: record.calfType,
 sireTag: record.sireTag,
 birthWeight: record.birthWeight,
 birthWeightUnit: record.birthWeightUnit,
 notes: record.notes,
 photoUrl: record.photoUrl,
 createdBy: currentUserId,
 createdByName: currentUserName,
 createdAt: now,
 updatedAt: now,
 };

 // Try to link to existing cow animal by tag
 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const matchedCow = currentAnimals.find(
 (a) => a.tagId.toLowerCase() === record.cowTag.toLowerCase() && a.status === "active",
 );
 if (matchedCow) newRecord.cowId = matchedCow.id;

 // Auto-create the calf animal record
 const calfSex: Animal["sex"] =
 record.calfType === "heifer" ? "heifer" :
 record.calfType === "steer" ? "steer" : "male";

 const calfAnimal: Animal = {
 id: generateId(),
 ranchId: ranch.id,
 tagId: record.calfTag,
 species: "cattle",
 breed: matchedCow?.breed ?? "",
 birthDate: fullDate,
 sex: calfSex,
 notes: record.notes ?? "",
 status: "active",
 markedForSale: false,
 motherId: matchedCow?.id,
 businessYearId: activeBusinessYearId,
 createdAt: now,
 updatedAt: now,
 };

 newRecord.calfId = calfAnimal.id;

 const updatedAnimals = [...currentAnimals, calfAnimal];
 await saveToStorage(STORAGE_KEYS.animals, updatedAnimals);
 queryClient.setQueryData(["animals"], updatedAnimals);
 void pushAnimalToCloud(calfAnimal, currentUserId || null);

 const currentRecords = queryClient.getQueryData<CalvingRecord[]>(["calvingRecords"]) ?? [];
 const updatedRecords = [newRecord, ...currentRecords];
 await saveToStorage(STORAGE_KEYS.calvingRecords, updatedRecords);

 const list = allCalvingLists.find((l) => l.id === record.calvingListId);
 await logActivity(
 `Logged calving: Cow ${record.cowTag} → calf ${record.calfTag}${list ? ` (${list.name})` : ""}`,
 "calving",
 newRecord.id,
 );

 void pushCalvingRecordToCloud(newRecord, ranch.id, currentUserRole);
 return { newRecord, updatedRecords, calfAnimal };
 },
 onSuccess: ({ updatedRecords }) => {
 queryClient.setQueryData(["calvingRecords"], updatedRecords);
 },
 });

 const updateCalvingRecordMutation = useMutation({
 mutationFn: async (record: CalvingRecord) => {
 const current = queryClient.getQueryData<CalvingRecord[]>(["calvingRecords"]) ?? [];
 const updated = current.map((r) =>
 r.id === record.id ? { ...record, updatedAt: new Date().toISOString() } : r,
 );
 await saveToStorage(STORAGE_KEYS.calvingRecords, updated);
 void pushCalvingRecordToCloud(record, ranch.id, currentUserRole);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["calvingRecords"], updated);
 },
 });

 const deleteCalvingRecordMutation = useMutation({
 mutationFn: async (recordId: string) => {
 const current = queryClient.getQueryData<CalvingRecord[]>(["calvingRecords"]) ?? [];
 const updated = current.filter((r) => r.id !== recordId);
 await saveToStorage(STORAGE_KEYS.calvingRecords, updated);
 await logActivity("Deleted calving record", "calving", recordId);
 void deleteCalvingRecordInCloud(recordId);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["calvingRecords"], updated);
 },
 });

 const getCalvingListById = useCallback(
 (id: string) => allCalvingLists.find((l) => l.id === id),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [allCalvingLists.length, allCalvingLists],
 );

 const getCalvingRecordById = useCallback(
 (id: string) => (queryClient.getQueryData<CalvingRecord[]>(["calvingRecords"]) ?? []).find((r) => r.id === id),
 [queryClient],
 );

 const getCalvingRecordsForList = useCallback(
 (listId: string) =>
 (queryClient.getQueryData<CalvingRecord[]>(["calvingRecords"]) ?? [])
 .filter((r) => r.calvingListId === listId)
 .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
 [queryClient],
 );










 const mergeAnimalsMutation = useMutation({
 mutationFn: async ({ keepId, removeId }: { keepId: string; removeId: string }) => {
 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const keepAnimal = currentAnimals.find((a) => a.id === keepId);
 const removeAnimal = currentAnimals.find((a) => a.id === removeId);
 if (!keepAnimal || !removeAnimal) throw new Error("Animals not found");

 const mergedFromIds = [
 ...(keepAnimal.mergedFromIds ?? []),
 removeId,
 ...(removeAnimal.mergedFromIds ?? []),
 ];

 const mergedAnimal: Animal = {
 ...keepAnimal,
 name: keepAnimal.name || removeAnimal.name,
 notes: [keepAnimal.notes, removeAnimal.notes].filter(Boolean).join(" | "),
 photoUrl: keepAnimal.photoUrl || removeAnimal.photoUrl,
 motherId: keepAnimal.motherId || removeAnimal.motherId,
 sireId: keepAnimal.sireId || removeAnimal.sireId,
 mergedFromIds,
 updatedAt: new Date().toISOString(),
 };

 const updatedAnimals = currentAnimals
 .filter((a) => a.id !== removeId)
 .map((a) => (a.id === keepId ? mergedAnimal : a));
 await saveToStorage(STORAGE_KEYS.animals, updatedAnimals);
 void pushAnimalToCloud(mergedAnimal, currentUserId || null);
 void deleteAnimalInCloud(removeId, ranch.id);

 const currentWR = queryClient.getQueryData<WeightRecord[]>(["weightRecords"]) ?? [];
 const updatedWR = currentWR.map((r) => r.animalId === removeId ? { ...r, animalId: keepId } : r);
 await saveToStorage(STORAGE_KEYS.weightRecords, updatedWR);

 const currentHR = queryClient.getQueryData<HealthRecord[]>(["healthRecords"]) ?? [];
 const updatedHR = currentHR.map((r) => r.animalId === removeId ? { ...r, animalId: keepId } : r);
 await saveToStorage(STORAGE_KEYS.healthRecords, updatedHR);


 const currentLists = queryClient.getQueryData<CustomList[]>(["customLists"]) ?? [];
 const updatedLists = currentLists.map((l) => {
 if (l.animalIds.includes(removeId)) {
 const ids = l.animalIds.filter((id) => id !== removeId);
 if (!ids.includes(keepId)) ids.push(keepId);
 return { ...l, animalIds: ids, updatedAt: new Date().toISOString() };
 }
 return l;
 });
 await saveToStorage(STORAGE_KEYS.customLists, updatedLists);



 await logActivity(
 `Merged ${getAnimalDisplayName(removeAnimal)} into ${getAnimalDisplayName(mergedAnimal)}`,
 "animal",
 keepId,
 );

 return { updatedAnimals, updatedWR, updatedHR, updatedLists };
 },
 onSuccess: ({ updatedAnimals, updatedWR, updatedHR, updatedLists }) => {
 queryClient.setQueryData(["animals"], updatedAnimals);
 queryClient.setQueryData(["weightRecords"], updatedWR);
 queryClient.setQueryData(["healthRecords"], updatedHR);
 queryClient.setQueryData(["customLists"], updatedLists);
 },
 });

 const addDoctoringEventMutation = useMutation({
 mutationFn: async (event: Omit<DoctoringEvent, "id" | "ranchId" | "createdAt" | "updatedAt" | "createdBy" | "createdByName">) => {
 requireRanch(ranch.id, "create doctoring event");
 const newEvent: DoctoringEvent = {
 ...event,
 id: generateId(),
 ranchId: ranch.id,
 createdBy: currentUserId || undefined,
 createdByName: currentUserName || undefined,
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 };
 const current = queryClient.getQueryData<DoctoringEvent[]>(["doctoringEvents"]) ?? [];
 const updated = [newEvent, ...current];
 await saveToStorage(STORAGE_KEYS.doctoringEvents, updated);
 const animal = animals.find((a) => a.id === event.animalId);
 if (animal) {
 await logActivity(`Doctored ${getAnimalDisplayName(animal)} — ${event.type}`, "health", animal.id);
 }
 void pushDoctoringEventToCloud(newEvent, currentUserRole);
 return { updated, newEvent };
 },
 onSuccess: ({ updated }) => {
 queryClient.setQueryData(["doctoringEvents"], updated);
 },
 });

 const updateDoctoringEventMutation = useMutation({
 mutationFn: async (event: DoctoringEvent) => {
 const current = queryClient.getQueryData<DoctoringEvent[]>(["doctoringEvents"]) ?? [];
 const updated = current.map((e) =>
 e.id === event.id ? { ...event, updatedAt: new Date().toISOString() } : e,
 );
 await saveToStorage(STORAGE_KEYS.doctoringEvents, updated);
 void pushDoctoringEventToCloud(event, currentUserRole);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["doctoringEvents"], updated);
 },
 });

 const getDoctoringEventsForAnimal = useCallback(
 (animalId: string) =>
 doctoringEvents
 .filter((e) => e.animalId === animalId)
 .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [doctoringEvents.length],
 );

 const setRanchNameMutation = useMutation({
 mutationFn: async (name: string) => {
 const trimmed = name.trim();
 if (!trimmed) throw new Error("Ranch name cannot be empty");
 const current = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 const ownerId = current.ownerId || currentUserId;
 const members = current.members && current.members.length > 0
 ? current.members
 : [{ userId: ownerId, name: currentUserName, role: "owner" as const, joinedAt: new Date().toISOString() }];
 const updated: Ranch = {
 ...current,
 id: current.id || generateId(),
 name: trimmed,
 ownerId,
 members,
 inviteCode: current.inviteCode ?? "",
 createdAt: current.createdAt || new Date().toISOString(),
 };
 await saveToStorage(STORAGE_KEYS.ranch, updated);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["ranch"], updated);
 },
 });

 const setupRanchMutation = useMutation({
 mutationFn: async ({ userName, ranchName }: { userName: string; ranchName: string }) => {
 const trimmedUserName = userName.trim();
 const trimmedRanchName = ranchName.trim();
 if (!trimmedUserName) throw new Error("User name cannot be empty");
 if (!trimmedRanchName) throw new Error("Ranch name cannot be empty");

 const newUser: User = {
 id: generateUuid(),
 name: trimmedUserName,
 createdAt: new Date().toISOString(),
 };
 const currentUsers = queryClient.getQueryData<User[]>(["users"]) ?? [];
 const updatedUsers = [...currentUsers, newUser];

 const inviteCode = generateInviteCode();
 console.log("[setupRanch] creating ranch on backend with code", inviteCode);
 const { data: ranchRow, error: ranchErr } = await supabase
 .from("ranches")
 .insert({
 name: trimmedRanchName,
 invite_code: inviteCode,
 owner_id: newUser.id,
 created_at: new Date().toISOString(),
 })
 .select()
 .single();
 if (ranchErr || !ranchRow) {
 console.error("[setupRanch] backend error", ranchErr);
 throw new Error(ranchErr?.message ?? "Failed to create ranch");
 }

 const joinedAt = new Date().toISOString();
 const { error: memberErr } = await supabase.from("ranch_members").insert({
 ranch_id: ranchRow.id,
 user_id: newUser.id,
 name: newUser.name,
 role: "owner",
 joined_at: joinedAt,
 });
 if (memberErr) {
 console.error("[setupRanch] failed to add owner member", memberErr);
 throw new Error(memberErr.message);
 }

 await saveToStorage(STORAGE_KEYS.users, updatedUsers);
 await saveToStorage(STORAGE_KEYS.currentUserIdValue, newUser.id);

 const newRanch: Ranch = {
 id: ranchRow.id,
 name: ranchRow.name,
 ownerId: newUser.id,
 members: [
 {
 userId: newUser.id,
 name: newUser.name,
 role: "owner",
 joinedAt,
 },
 ],
 inviteCode: ranchRow.invite_code,
 createdAt: ranchRow.created_at,
 };
 await saveToStorage(STORAGE_KEYS.ranch, newRanch);

 console.log("[setupRanch] created", newUser.name, "at", newRanch.name, "code:", newRanch.inviteCode);
 return { newUser, newRanch, updatedUsers };
 },
 onSuccess: ({ newUser, newRanch, updatedUsers }) => {
 queryClient.setQueryData(["users"], updatedUsers);
 queryClient.setQueryData(["currentUserId"], newUser.id);
 queryClient.setQueryData(["ranch"], newRanch);
 },
 });

 const updateUserNameMutation = useMutation({
 mutationFn: async ({ userId, name }: { userId: string; name: string }) => {
 const trimmed = name.trim();
 if (!trimmed) throw new Error("Name cannot be empty");
 const currentUsers = queryClient.getQueryData<User[]>(["users"]) ?? [];
 const updatedUsers = currentUsers.map((u) =>
 u.id === userId ? { ...u, name: trimmed } : u,
 );
 await saveToStorage(STORAGE_KEYS.users, updatedUsers);

 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 const updatedMembers: RanchMember[] = currentRanch.members.map((m) =>
 m.userId === userId ? { ...m, name: trimmed } : m,
 );
 const updatedRanch: Ranch = { ...currentRanch, members: updatedMembers };
 await saveToStorage(STORAGE_KEYS.ranch, updatedRanch);

 return { updatedUsers, updatedRanch };
 },
 onSuccess: ({ updatedUsers, updatedRanch }) => {
 queryClient.setQueryData(["users"], updatedUsers);
 queryClient.setQueryData(["ranch"], updatedRanch);
 },
 });

 const [userSwitchToast, setUserSwitchToast] = useState<{ name: string; at: number } | null>(null);
 const dismissUserSwitchToast = useCallback(() => setUserSwitchToast(null), []);

 const setActiveUserMutation = useMutation({
 mutationFn: async (userId: string) => {
 await saveToStorage(STORAGE_KEYS.currentUserIdValue, userId);
 return userId;
 },
 onSuccess: (userId) => {
 queryClient.setQueryData(["currentUserId"], userId);
 const usersList = queryClient.getQueryData<User[]>(["users"]) ?? [];
 const switched = usersList.find((u) => u.id === userId);
 if (switched) {
 setUserSwitchToast({ name: switched.name, at: Date.now() });
 }
 },
 });

 const addUserMutation = useMutation({
 mutationFn: async (name: string) => {
 const trimmed = name.trim();
 if (!trimmed) throw new Error("User name cannot be empty");

 const newUser: User = {
 id: generateId(),
 name: trimmed,
 createdAt: new Date().toISOString(),
 };
 const currentUsers = queryClient.getQueryData<User[]>(["users"]) ?? [];
 const updatedUsers = [...currentUsers, newUser];
 await saveToStorage(STORAGE_KEYS.users, updatedUsers);

 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 const alreadyMember = currentRanch.members.some((m) => m.userId === newUser.id);
 const updatedRanch: Ranch = alreadyMember
 ? currentRanch
 : {
 ...currentRanch,
 members: [
 ...currentRanch.members,
 {
 userId: newUser.id,
 name: newUser.name,
 role: "member",
 joinedAt: new Date().toISOString(),
 },
 ],
 };
 if (!alreadyMember) {
 await saveToStorage(STORAGE_KEYS.ranch, updatedRanch);
 }
 await saveToStorage(STORAGE_KEYS.currentUserIdValue, newUser.id);

 return { newUser, updatedUsers, updatedRanch };
 },
 onSuccess: ({ newUser, updatedUsers, updatedRanch }) => {
 queryClient.setQueryData(["users"], updatedUsers);
 queryClient.setQueryData(["ranch"], updatedRanch);
 queryClient.setQueryData(["currentUserId"], newUser.id);
 setUserSwitchToast({ name: newUser.name, at: Date.now() });
 },
 });

 const inviteTeammateMutation = useMutation({
 mutationFn: async ({ name, role }: { name: string; role: "manager" | "member" }) => {
 const trimmed = name.trim();
 if (!trimmed) throw new Error("Name cannot be empty");

 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 const inviter = currentRanch.members.find((m) => m.userId === currentUserId);
 const inviterRole = inviter?.role;
 if (inviterRole !== "owner" && inviterRole !== "manager") {
 console.log("[inviteTeammate] blocked — role:", inviterRole);
 throw new Error("Only owners or managers can invite teammates");
 }

 const newUser: User = {
 id: generateUuid(),
 name: trimmed,
 createdAt: new Date().toISOString(),
 };
 const currentUsers = queryClient.getQueryData<User[]>(["users"]) ?? [];
 const updatedUsers = [...currentUsers, newUser];
 const joinedAt = new Date().toISOString();

 if (currentRanch.id && currentRanch.id !== MOCK_RANCH.id && isUuid(currentRanch.id)) {
 console.log("[inviteTeammate] inserting member", {
 ranch_id: currentRanch.id,
 user_id: newUser.id,
 role,
 });
 const { error: memberErr } = await supabase.from("ranch_members").insert({
 ranch_id: currentRanch.id,
 user_id: newUser.id,
 name: newUser.name,
 role,
 joined_at: joinedAt,
 });
 if (memberErr) {
 console.error(
 "[inviteTeammate] backend error",
 JSON.stringify({
 message: memberErr.message,
 code: (memberErr as { code?: string }).code,
 details: (memberErr as { details?: string }).details,
 hint: (memberErr as { hint?: string }).hint,
 }),
 );
 const friendly =
 (memberErr as { code?: string }).code === "23505"
 ? "This teammate is already in the ranch."
 : (memberErr as { code?: string }).code === "42501"
 ? "You don't have permission to invite teammates. Check Supabase RLS policies for ranch_members."
 : memberErr.message || "Failed to invite teammate";
 throw new Error(friendly);
 }
 } else if (currentRanch.id && !isUuid(currentRanch.id)) {
 console.log(
 "[inviteTeammate] skipping backend insert — legacy non-uuid ranch id",
 currentRanch.id,
 );
 }

 await saveToStorage(STORAGE_KEYS.users, updatedUsers);

 const updatedRanch: Ranch = {
 ...currentRanch,
 members: [
 ...currentRanch.members,
 {
 userId: newUser.id,
 name: newUser.name,
 role,
 joinedAt,
 },
 ],
 };
 await saveToStorage(STORAGE_KEYS.ranch, updatedRanch);
 await logActivity(`Invited ${newUser.name} as ${role}`, "member", newUser.id);
 return { newUser, updatedUsers, updatedRanch };
 },
 onSuccess: ({ updatedUsers, updatedRanch }) => {
 queryClient.setQueryData(["users"], updatedUsers);
 queryClient.setQueryData(["ranch"], updatedRanch);
 },
 });

 const generateInviteCodeMutation = useMutation({
 mutationFn: async () => {
 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 if (!currentRanch.id) throw new Error("No ranch found");
 const newCode = generateInviteCode();
 const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
 const { error } = await supabase
 .from("ranches")
 .update({ invite_code: newCode, invite_expiry: expiry })
 .eq("id", currentRanch.id);
 if (error) throw new Error(error.message);
 const updatedRanch = { ...currentRanch, inviteCode: newCode, inviteExpiry: expiry };
 await saveToStorage(STORAGE_KEYS.ranch, updatedRanch);
 queryClient.setQueryData(["ranch"], updatedRanch);
 return { code: newCode, expiry };
 },
 });

 const joinRanchMutation = useMutation({
 mutationFn: async ({ userName, code }: { userName: string; code: string }) => {
 const trimmedUserName = userName.trim();
 const trimmedCode = code.trim().toUpperCase();
 if (!trimmedUserName) throw new Error("Your name cannot be empty");
 if (!trimmedCode) throw new Error("Ranch code cannot be empty");

 console.log("[joinRanch] looking up code", trimmedCode);
 const { data: ranchRow, error: ranchErr } = await supabase
 .from("ranches")
 .select("*")
 .eq("invite_code", trimmedCode)
 .maybeSingle();
 if (ranchErr) {
 console.error("[joinRanch] lookup error", ranchErr);
 throw new Error(ranchErr.message);
 }
 if (!ranchRow) {
 throw new Error("No ranch found with that code. Make sure the code is correct and hasn't expired.");
 }
 if (ranchRow.invite_expiry && new Date(ranchRow.invite_expiry) < new Date()) {
 throw new Error("This invite code has expired. Ask the ranch owner to generate a new one.");
 }

 const newUser: User = {
 id: generateUuid(),
 name: trimmedUserName,
 createdAt: new Date().toISOString(),
 };
 const joinedAt = new Date().toISOString();

 const { error: memberErr } = await supabase.from("ranch_members").insert({
 ranch_id: ranchRow.id,
 user_id: newUser.id,
 name: newUser.name,
 role: "member",
 joined_at: joinedAt,
 });
 if (memberErr) {
 console.error("[joinRanch] failed to insert member", memberErr);
 throw new Error(memberErr.message);
 }

 const { data: memberRows, error: listErr } = await supabase
 .from("ranch_members")
 .select("*")
 .eq("ranch_id", ranchRow.id)
 .order("joined_at", { ascending: true });
 if (listErr) {
 console.error("[joinRanch] failed to list members", listErr);
 throw new Error(listErr.message);
 }

 const members: RanchMember[] = (memberRows ?? []).map((m) => ({
 userId: m.user_id,
 name: m.name,
 role: m.role as RanchMember["role"],
 joinedAt: m.joined_at,
 }));

 const currentUsers = queryClient.getQueryData<User[]>(["users"]) ?? [];
 const updatedUsers = [...currentUsers, newUser];
 await saveToStorage(STORAGE_KEYS.users, updatedUsers);
 await saveToStorage(STORAGE_KEYS.currentUserIdValue, newUser.id);

 const joinedRanch: Ranch = {
 id: ranchRow.id,
 name: ranchRow.name,
 ownerId: ranchRow.owner_id,
 members,
 inviteCode: ranchRow.invite_code,
 createdAt: ranchRow.created_at,
 };
 await saveToStorage(STORAGE_KEYS.ranch, joinedRanch);
 void supabase.from("ranches").update({ invite_expiry: new Date(0).toISOString() }).eq("id", ranchRow.id);

 console.log("[joinRanch] joined", joinedRanch.name, "as", newUser.name);
 return { newUser, updatedUsers, joinedRanch };
 },
 onSuccess: ({ newUser, updatedUsers, joinedRanch }) => {
 queryClient.setQueryData(["users"], updatedUsers);
 queryClient.setQueryData(["currentUserId"], newUser.id);
 queryClient.setQueryData(["ranch"], joinedRanch);
 },
 });

 const syncAnimalsMutation = useMutation({
 mutationFn: async () => {
 const current = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 if (!current.id) {
 console.log("[syncAnimals] no ranch yet, skipping");
 return null;
 }
 const { remoteRows, error } = await fetchRanchAnimals(current.id);
 if (error) {
 console.log("[syncAnimals] error", error);
 return null;
 }
 const localAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const localById = new Map<string, Animal>(localAnimals.map((a) => [a.id, a]));
 const remoteIds = new Set<string>();

 for (const row of remoteRows) {
 remoteIds.add(row.id);
 if (row.deleted) {
 if (localById.has(row.id)) {
 const local = localById.get(row.id)!;
 const localTs = new Date(local.updatedAt).getTime();
 const remoteTs = new Date(row.updated_at).getTime();
 if (remoteTs >= localTs) {
 localById.delete(row.id);
 }
 }
 continue;
 }
 const remoteAnimal: Animal = {
 ...row.data,
 id: row.id,
 ranchId: row.ranch_id,
 updatedAt: row.updated_at,
 };
 const local = localById.get(row.id);
 if (!local) {
 localById.set(row.id, remoteAnimal);
 continue;
 }
 const localTs = new Date(local.updatedAt).getTime();
 const remoteTs = new Date(row.updated_at).getTime();
 if (remoteTs > localTs) {
 localById.set(row.id, remoteAnimal);
 }
 }

 // Detect duplicate tag IDs within same business year
 const mergedList = Array.from(localById.values());
 const tagYearMap = new Map<string, Animal[]>();
 for (const animal of mergedList) {
   if (animal.status === "active") {
     const key = `${animal.tagId?.toLowerCase()}_${animal.businessYearId ?? ""}`;
     if (!tagYearMap.has(key)) tagYearMap.set(key, []);
     tagYearMap.get(key)!.push(animal);
   }
 }
 // Flag duplicates — keep newest, mark older ones for review
 const duplicateIds = new Set<string>();
 for (const [, dupes] of tagYearMap.entries()) {
   if (dupes.length > 1) {
     const sorted = dupes.sort((a, b) =>
       new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
     );
     // Keep the newest, flag the rest
     for (let i = 1; i < sorted.length; i++) {
       duplicateIds.add(sorted[i].id);
       console.warn(`[syncAnimals] duplicate tag detected: ${sorted[i].tagId} (id: ${sorted[i].id})`);
     }
   }
 }
 // Add _isDuplicate flag so UI can surface these
 const merged = mergedList.map((a) =>
   duplicateIds.has(a.id) ? { ...a, _isDuplicate: true } : a
 );
 await saveToStorage(STORAGE_KEYS.animals, merged);

 const localOnlyAnimals = merged.filter(
 (a) => a.ranchId === current.id && !remoteIds.has(a.id),
 );
 if (localOnlyAnimals.length > 0) {
 console.log(`[syncAnimals] pushing ${localOnlyAnimals.length} local-only animals to cloud`);
 const serverTimestamps = await pushAnimalsBatchToCloud(localOnlyAnimals, currentUserId || null);
 if (serverTimestamps) {
   // Update local records with server-generated timestamps
   const tsMap = new Map(serverTimestamps.map((r) => [r.id, r.updated_at]));
   for (const [id, animal] of localById.entries()) {
     if (tsMap.has(id)) {
       localById.set(id, { ...animal, updatedAt: tsMap.get(id)! });
     }
   }
 }
 }

 console.log(`[syncAnimals] merged ${merged.length} animals (remote: ${remoteRows.length})`);
 return merged;
 },
 onSuccess: (merged) => {
 if (merged) queryClient.setQueryData(["animals"], merged);
 },
 });

 // ─── Business Year sync ────────────────────────────────────────────────────

 const syncBusinessYearsMutation = useMutation({
 mutationFn: async () => {
 const current = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 if (!current.id || current.id === MOCK_RANCH.id) {
 console.log("[syncBusinessYears] no remote ranch yet, skipping");
 return null;
 }
 const { years: remoteYears, activeYearId: remoteActiveYearId, error } = await fetchBusinessYears(current.id);
 if (error) {
 console.log("[syncBusinessYears] fetch error", error);
 return null;
 }

 const localYears = queryClient.getQueryData<BusinessYear[]>(["businessYears"]) ?? [];
 const localIds = new Set(localYears.map((y) => y.id));

 // If nothing on server, push all local years up
 if (remoteYears.length === 0 && localYears.length > 0) {
 console.log("[syncBusinessYears] no remote years, pushing all local");
 void pushBusinessYearsBatchToCloud(localYears, current.id, currentUserRole);
 void pushActiveBusinessYearToCloud(activeBusinessYearId, current.id, currentUserRole);
 return { merged: localYears, activeYearId: activeBusinessYearId };
 }

 // Merge remote years into local
 const merged = [...localYears];
 for (const row of remoteYears) {
 if (!localIds.has(row.id)) {
 merged.push({
 id: row.id,
 name: row.name,
 startDate: row.start_date,
 endDate: row.end_date,
 isActive: row.is_active,
 createdAt: row.created_at,
 });
 }
 }

 await saveToStorage(STORAGE_KEYS.businessYears, merged);

 // Push any local-only years to server
 const remoteIds = new Set(remoteYears.map((r) => r.id));
 const localOnly = localYears.filter((y) => !remoteIds.has(y.id));
 if (localOnly.length > 0) {
 void pushBusinessYearsBatchToCloud(localOnly, current.id, currentUserRole);
 }

 // Members automatically follow the owner's active year selection
 const resolvedActiveYearId = remoteActiveYearId ?? activeBusinessYearId;
 if (resolvedActiveYearId !== activeBusinessYearId) {
 console.log("[syncBusinessYears] adopting remote active year", resolvedActiveYearId);
 await saveToStorage(STORAGE_KEYS.activeBusinessYearId, resolvedActiveYearId);
 }

 console.log(`[syncBusinessYears] merged ${merged.length} years (remote: ${remoteYears.length})`);
 return { merged, activeYearId: resolvedActiveYearId };
 },
 onSuccess: (result) => {
 if (result) {
 queryClient.setQueryData(["businessYears"], result.merged);
 queryClient.setQueryData(["activeBusinessYearId"], result.activeYearId);
 }
 },
 });

 const lastSyncedRanchIdRef = useRef<string>("");
 useEffect(() => {
 const rid = ranch.id;
 if (!rid) return;
 if (lastSyncedRanchIdRef.current === rid) return;
 lastSyncedRanchIdRef.current = rid;
 console.log("[syncAnimals] initial sync for ranch", rid);
 syncAnimalsMutation.mutate();
 syncBusinessYearsMutation.mutate();
 syncCalvingDataMutation.mutate();
 syncDoctoringEventsMutation.mutate();
 syncWeightHealthMutation.mutate();
 syncCustomListsMutation.mutate();
 syncRanchNotesMutation.mutate();

 // Schedule push notifications based on saved preferences
 void (async () => {
 try {
 const [breedingPref, healthPref] = await Promise.all([
 AsyncStorage.getItem("ranchtrack_notif_breeding"),
 AsyncStorage.getItem("ranchtrack_notif_health"),
 ]);
 const breedingEnabled = breedingPref !== "false";
 const doctoringEnabled = healthPref !== "false";
 const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
 const currentDoctoring = queryClient.getQueryData<DoctoringEvent[]>(["doctoringEvents"]) ?? [];
 await scheduleAllNotifications({
 breedingEnabled,
 doctoringEnabled,
 doctoringEvents: currentDoctoring,
 animals: currentAnimals,
 });
 } catch (e) {
 console.log("[notifications] launch scheduling failed", e);
 }
 })();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [ranch.id]);

 const appStateRef = useRef<string>(AppState.currentState);
 useEffect(() => {
 const subscription = AppState.addEventListener("change", (nextState: string) => {
 const wasBackground =
 appStateRef.current === "background" || appStateRef.current === "inactive";
 const nowActive = nextState === "active";
 appStateRef.current = nextState;
 if (wasBackground && nowActive) {
 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]);
 if (currentRanch?.id && currentRanch.id !== MOCK_RANCH.id) {
 console.log("[AppState] app foregrounded — refreshing ranch data");
 refreshRanchMutation.mutate();
 syncBusinessYearsMutation.mutate();
 syncCalvingDataMutation.mutate();
 syncDoctoringEventsMutation.mutate();
 syncWeightHealthMutation.mutate();
 syncCustomListsMutation.mutate();
 syncRanchNotesMutation.mutate();
 }
 }
 });
 return () => subscription.remove();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // ─── Custom Lists sync mutation ──────────────────────────────────────────
 const syncCustomListsMutation = useMutation({
 mutationFn: async () => {
 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 if (!currentRanch.id || currentRanch.id === MOCK_RANCH.id) return;

 const { lists: remoteLists, error } = await fetchCustomLists(currentRanch.id);
 if (error) {
 const local = queryClient.getQueryData<CustomList[]>(["customLists"]) ?? [];
 for (const l of local) void pushCustomListToCloud(l, currentUserRole);
 return;
 }

 const local = queryClient.getQueryData<CustomList[]>(["customLists"]) ?? [];
 const localIds = new Set(local.map((l) => l.id));
 const remoteIds = new Set(remoteLists.map((l: RemoteCustomListRow) => l.id));

 const newFromRemote: CustomList[] = remoteLists
 .filter((r: RemoteCustomListRow) => !localIds.has(r.id))
 .map((r: RemoteCustomListRow) => ({
 id: r.id,
 ranchId: currentRanch.id,
 name: r.name,
 color: r.color,
 icon: r.icon,
 listType: r.list_type as CustomList["listType"],
 species: (r.species as CustomList["species"]) ?? undefined,
 parentId: r.parent_id ?? undefined,
 animalIds: r.animal_ids,
 createdBy: r.created_by,
 createdAt: r.created_at,
 updatedAt: r.updated_at,
 }));

 if (newFromRemote.length > 0) {
 const merged = [...local, ...newFromRemote];
 await saveToStorage(STORAGE_KEYS.customLists, merged);
 queryClient.setQueryData(["customLists"], merged);
 console.log(`[syncCustomLists] added ${newFromRemote.length} lists from server`);
 }

 const localOnly = local.filter((l) => !remoteIds.has(l.id));
 for (const l of localOnly) void pushCustomListToCloud(l, currentUserRole);
 },
 onError: (e) => console.log("[syncCustomLists] error", e),
 });

 // ─── Calving sync mutation ───────────────────────────────────────────────
 const syncCalvingDataMutation = useMutation({
 mutationFn: async () => {
 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 if (!currentRanch.id || currentRanch.id === MOCK_RANCH.id) return;

 const { lists: remoteLists, records: remoteRecords, error } = await fetchCalvingData(currentRanch.id);
 if (error) {
 // Server error — push local data up
 const localLists = queryClient.getQueryData<CalvingList[]>(["calvingLists"]) ?? [];
 const localRecords = queryClient.getQueryData<CalvingRecord[]>(["calvingRecords"]) ?? [];
 for (const l of localLists) void pushCalvingListToCloud(l, currentRanch.id, currentUserRole);
 for (const r of localRecords) void pushCalvingRecordToCloud(r, currentRanch.id, currentUserRole);
 return;
 }

 // ── Merge lists ──────────────────────────────────────────────────────
 const localLists = queryClient.getQueryData<CalvingList[]>(["calvingLists"]) ?? [];
 const localListIds = new Set(localLists.map((l) => l.id));
 const remoteListIds = new Set(remoteLists.map((l: RemoteCalvingListRow) => l.id));

 // Add remote lists not seen locally
 const newLists: CalvingList[] = remoteLists
 .filter((r: RemoteCalvingListRow) => !localListIds.has(r.id))
 .map((r: RemoteCalvingListRow) => ({
 id: r.id,
 ranchId: currentRanch.id,
 name: r.name,
 color: r.color,
 businessYearId: r.business_year_id,
 createdAt: r.created_at,
 updatedAt: r.updated_at,
 }));

 let mergedLists = localLists;
 if (newLists.length > 0) {
 mergedLists = [...localLists, ...newLists];
 await saveToStorage(STORAGE_KEYS.calvingLists, mergedLists);
 queryClient.setQueryData(["calvingLists"], mergedLists);
 console.log(`[syncCalving] added ${newLists.length} lists from server`);
 }

 // Push local-only lists to server
 const localOnlyLists = localLists.filter((l) => !remoteListIds.has(l.id));
 for (const l of localOnlyLists) void pushCalvingListToCloud(l, currentRanch.id, currentUserRole);

 // ── Merge records ────────────────────────────────────────────────────
 const localRecords = queryClient.getQueryData<CalvingRecord[]>(["calvingRecords"]) ?? [];
 const localRecordIds = new Set(localRecords.map((r) => r.id));
 const remoteRecordIds = new Set(remoteRecords.map((r: RemoteCalvingRecordRow) => r.id));

 // Add remote records not seen locally
 const newRecords: CalvingRecord[] = remoteRecords
 .filter((r: RemoteCalvingRecordRow) => !localRecordIds.has(r.id))
 .map((r: RemoteCalvingRecordRow) => ({
 id: r.id,
 calvingListId: r.calving_list_id,
 businessYearId: r.business_year_id,
 birthMonth: r.birth_month,
 birthDay: r.birth_day,
 date: r.date,
 cowTag: r.cow_tag,
 calfTag: r.calf_tag,
 assisted: r.assisted,
 calfType: (r.calf_type as CalvingRecord["calfType"]) ?? undefined,
 sireTag: r.sire_tag ?? undefined,
 birthWeight: r.birth_weight ?? undefined,
 birthWeightUnit: (r.birth_weight_unit as CalvingRecord["birthWeightUnit"]) ?? undefined,
 notes: r.notes ?? undefined,
 photoUrl: r.photo_url ?? undefined,
 cowId: r.cow_id ?? undefined,
 calfId: r.calf_id ?? undefined,
 createdBy: r.created_by ?? undefined,
 createdByName: r.created_by_name ?? undefined,
 createdAt: r.created_at,
 updatedAt: r.updated_at,
 }));

 if (newRecords.length > 0) {
 const mergedRecords = [...localRecords, ...newRecords].sort(
 (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
 );
 await saveToStorage(STORAGE_KEYS.calvingRecords, mergedRecords);
 queryClient.setQueryData(["calvingRecords"], mergedRecords);
 console.log(`[syncCalving] added ${newRecords.length} records from server`);
 }

 // Push local-only records to server
 const localOnlyRecords = localRecords.filter((r) => !remoteRecordIds.has(r.id));
 for (const r of localOnlyRecords) void pushCalvingRecordToCloud(r, currentRanch.id, currentUserRole);
 },
 onError: (e) => console.log("[syncCalving] error", e),
 });

 // ─── Doctoring Events sync mutation ──────────────────────────────────────
 const syncDoctoringEventsMutation = useMutation({
 mutationFn: async () => {
 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 if (!currentRanch.id || currentRanch.id === MOCK_RANCH.id) return;

 const { events: remoteEvents, error } = await fetchDoctoringEvents(currentRanch.id);
 if (error) {
 // Server unreachable — push all local events up
 const localEvents = queryClient.getQueryData<DoctoringEvent[]>(["doctoringEvents"]) ?? [];
 for (const e of localEvents) void pushDoctoringEventToCloud(e, currentUserRole);
 return;
 }

 // Merge: add remote events not seen locally
 const localEvents = queryClient.getQueryData<DoctoringEvent[]>(["doctoringEvents"]) ?? [];
 const localIds = new Set(localEvents.map((e) => e.id));
 const remoteIds = new Set(remoteEvents.map((e: RemoteDoctoringEventRow) => e.id));

 const newFromRemote: DoctoringEvent[] = remoteEvents
 .filter((r: RemoteDoctoringEventRow) => !localIds.has(r.id))
 .map((r: RemoteDoctoringEventRow) => ({
 id: r.id,
 ranchId: currentRanch.id,
 animalId: r.animal_id,
 date: r.date,
 type: r.type as DoctoringEvent["type"],
 customTypeName: r.custom_type_name ?? undefined,
 notes: r.notes,
 treatment: r.treatment ?? undefined,
 followUpNeeded: r.follow_up_needed,
 resolved: r.resolved,
 createdBy: r.created_by ?? undefined,
 createdByName: r.created_by_name ?? undefined,
 createdAt: r.created_at,
 updatedAt: r.updated_at,
 }));

 if (newFromRemote.length > 0) {
 const merged = [...localEvents, ...newFromRemote].sort(
 (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
 );
 await saveToStorage(STORAGE_KEYS.doctoringEvents, merged);
 queryClient.setQueryData(["doctoringEvents"], merged);
 console.log(`[syncDoctoring] added ${newFromRemote.length} events from server`);
 }

 // Push local-only events to server
 const localOnly = localEvents.filter((e) => !remoteIds.has(e.id));
 for (const e of localOnly) void pushDoctoringEventToCloud(e, currentUserRole);
 },
 onError: (e) => console.log("[syncDoctoring] error", e),
 });

 // ─── Breeding sync mutation ───────────────────────────────────────────────

 // ─── Weight + Health Records sync mutation ───────────────────────────────
 const syncWeightHealthMutation = useMutation({
 mutationFn: async () => {
 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 if (!currentRanch.id || currentRanch.id === MOCK_RANCH.id) return;

 const { weightRecords: remoteWeights, healthRecords: remoteHealth, error } =
 await fetchWeightHealthData(currentRanch.id);

 if (error) {
 // Server unreachable — push all local records up
 const localWeights = queryClient.getQueryData<WeightRecord[]>(["weightRecords"]) ?? [];
 const localHealth = queryClient.getQueryData<HealthRecord[]>(["healthRecords"]) ?? [];
 for (const r of localWeights) void pushWeightRecordToCloud(r, currentRanch.id);
 for (const r of localHealth) void pushHealthRecordToCloud(r, currentRanch.id);
 return;
 }

 // ── Merge weight records ─────────────────────────────────────────────
 const localWeights = queryClient.getQueryData<WeightRecord[]>(["weightRecords"]) ?? [];
 const localWeightIds = new Set(localWeights.map((r) => r.id));
 const remoteWeightIds = new Set(remoteWeights.map((r: RemoteWeightRecordRow) => r.id));

 const newWeights: WeightRecord[] = remoteWeights
 .filter((r: RemoteWeightRecordRow) => !localWeightIds.has(r.id))
 .map((r: RemoteWeightRecordRow) => ({
 id: r.id,
 animalId: r.animal_id,
 date: r.date,
 weight: r.weight,
 unit: r.unit as WeightRecord["unit"],
 }));

 if (newWeights.length > 0) {
 const merged = [...localWeights, ...newWeights];
 await saveToStorage(STORAGE_KEYS.weightRecords, merged);
 queryClient.setQueryData(["weightRecords"], merged);
 console.log(`[syncWeightHealth] added ${newWeights.length} weight records from server`);
 }
 const localOnlyWeights = localWeights.filter((r) => !remoteWeightIds.has(r.id));
 for (const r of localOnlyWeights) void pushWeightRecordToCloud(r, currentRanch.id);

 // ── Merge health records ─────────────────────────────────────────────
 const localHealth = queryClient.getQueryData<HealthRecord[]>(["healthRecords"]) ?? [];
 const localHealthIds = new Set(localHealth.map((r) => r.id));
 const remoteHealthIds = new Set(remoteHealth.map((r: RemoteHealthRecordRow) => r.id));

 const newHealth: HealthRecord[] = remoteHealth
 .filter((r: RemoteHealthRecordRow) => !localHealthIds.has(r.id))
 .map((r: RemoteHealthRecordRow) => ({
 id: r.id,
 animalId: r.animal_id,
 type: r.type as HealthRecord["type"],
 date: r.date,
 description: r.description,
 notes: r.notes,
 administeredBy: r.administered_by ?? undefined,
 }));

 if (newHealth.length > 0) {
 const merged = [...localHealth, ...newHealth];
 await saveToStorage(STORAGE_KEYS.healthRecords, merged);
 queryClient.setQueryData(["healthRecords"], merged);
 console.log(`[syncWeightHealth] added ${newHealth.length} health records from server`);
 }
 const localOnlyHealth = localHealth.filter((r) => !remoteHealthIds.has(r.id));
 for (const r of localOnlyHealth) void pushHealthRecordToCloud(r, currentRanch.id);
 },
 onError: (e) => console.log("[syncWeightHealth] error", e),
 });

 // ─── Ranch Notes sync mutation ───────────────────────────────────────────
 const syncRanchNotesMutation = useMutation({
 mutationFn: async () => {
 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 if (!currentRanch.id || currentRanch.id === MOCK_RANCH.id) return;

 const { notes: remoteNotes, error } = await fetchRanchNotes(currentRanch.id);
 if (error) {
 const local = queryClient.getQueryData<RanchNote[]>(["ranchNotes"]) ?? [];
 for (const n of local) void pushRanchNoteToCloud(n, currentUserRole);
 return;
 }

 const local = queryClient.getQueryData<RanchNote[]>(["ranchNotes"]) ?? [];
 const localIds = new Set(local.map((n) => n.id));
 const remoteIds = new Set(remoteNotes.map((n: RemoteRanchNoteRow) => n.id));

 const newFromRemote: RanchNote[] = remoteNotes
 .filter((r: RemoteRanchNoteRow) => !localIds.has(r.id))
 .map((r: RemoteRanchNoteRow) => ({
 id: r.id,
 ranchId: currentRanch.id,
 text: r.text,
 createdBy: r.created_by,
 createdAt: r.created_at,
 updatedAt: r.updated_at,
 }));

 if (newFromRemote.length > 0) {
 const merged = [...local, ...newFromRemote].sort(
 (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
 );
 await saveToStorage(STORAGE_KEYS.ranchNotes, merged);
 queryClient.setQueryData(["ranchNotes"], merged);
 console.log(`[syncRanchNotes] added ${newFromRemote.length} notes from server`);
 }

 const localOnly = local.filter((n) => !remoteIds.has(n.id));
 for (const n of localOnly) void pushRanchNoteToCloud(n, currentUserRole);
 },
 onError: (e) => console.log("[syncRanchNotes] error", e),
 });

 const refreshRanchMutation = useMutation({
 mutationFn: async () => {
 const current = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 if (!current.id || current.id === MOCK_RANCH.id) {
 console.log("[refreshRanch] no remote ranch yet, skipping");
 return null;
 }
 const [{ data: ranchRow, error: ranchErr }, { data: memberRows, error: listErr }] = await Promise.all([
 supabase.from("ranches").select("*").eq("id", current.id).maybeSingle(),
 supabase
 .from("ranch_members")
 .select("*")
 .eq("ranch_id", current.id)
 .order("joined_at", { ascending: true }),
 ]);
 if (ranchErr) {
 console.error("[refreshRanch] ranch error", ranchErr);
 throw new Error(ranchErr.message);
 }
 if (listErr) {
 console.error("[refreshRanch] members error", listErr);
 throw new Error(listErr.message);
 }
 if (!ranchRow) {
 console.log("[refreshRanch] ranch not found on backend");
 return null;
 }
 const members: RanchMember[] = (memberRows ?? []).map((m) => ({
 userId: m.user_id,
 name: m.name,
 role: m.role as RanchMember["role"],
 joinedAt: m.joined_at,
 }));
 const updated: Ranch = {
 id: ranchRow.id,
 name: ranchRow.name,
 ownerId: ranchRow.owner_id,
 members,
 inviteCode: ranchRow.invite_code,
 createdAt: ranchRow.created_at,
 };
 await saveToStorage(STORAGE_KEYS.ranch, updated);
 return updated;
 },
 onSuccess: (updated) => {
 if (updated) queryClient.setQueryData(["ranch"], updated);
 void syncAnimalsMutation.mutateAsync();
 void syncBusinessYearsMutation.mutateAsync();
 },
 });

 const resetAppMutation = useMutation({
 mutationFn: async () => {
 const keys = Object.values(STORAGE_KEYS);
 await Promise.all([
 ...keys.map((k) => AsyncStorage.removeItem(k)),
 AsyncStorage.removeItem("ranchtrack_onboarding_complete"),
 AsyncStorage.removeItem("ranchtrack_ranch_config"),
 ]);
 console.log("[resetApp] cleared all storage");
 return true;
 },
 onSuccess: () => {
 queryClient.setQueryData(["ranch"], MOCK_RANCH);
 queryClient.setQueryData(["users"], []);
 queryClient.setQueryData(["currentUserId"], "");
 queryClient.setQueryData(["animals"], []);
 queryClient.setQueryData(["weightRecords"], []);
 queryClient.setQueryData(["healthRecords"], []);
 queryClient.setQueryData(["calvingRecords"], []);
 queryClient.setQueryData(["activityLog"], []);
 queryClient.setQueryData(["messages"], []);
 queryClient.setQueryData(["customLists"], []);
 queryClient.setQueryData(["calvingLists"], []);
 queryClient.setQueryData(["calvingGroups"], []);
 queryClient.setQueryData(["breedingGroups"], []);
 queryClient.setQueryData(["soldSnapshots"], []);
 queryClient.setQueryData(["deceasedSnapshots"], []);
 queryClient.setQueryData(["doctoringEvents"], []);
 queryClient.setQueryData(["ranchNotes"], []);
 queryClient.setQueryData(["onboardingComplete"], false);
 },
 });

 const addRanchNoteMutation = useMutation({
 mutationFn: async (text: string) => {
 requireRanch(ranch.id, "create note");
 const trimmed = text.trim();
 if (!trimmed) throw new Error("Note text cannot be empty");
 const newNote: RanchNote = {
 id: generateId(),
 ranchId: ranch.id,
 text: trimmed,
 createdBy: currentUserId,
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 };
 const current = queryClient.getQueryData<RanchNote[]>(["ranchNotes"]) ?? [];
 const updated = [newNote, ...current];
 await saveToStorage(STORAGE_KEYS.ranchNotes, updated);
 void pushRanchNoteToCloud(newNote, currentUserRole);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["ranchNotes"], updated);
 },
 });

 const updateRanchNoteMutation = useMutation({
 mutationFn: async ({ id, text }: { id: string; text: string }) => {
 const trimmed = text.trim();
 const current = queryClient.getQueryData<RanchNote[]>(["ranchNotes"]) ?? [];
 const updated = current.map((n) =>
 n.id === id ? { ...n, text: trimmed, updatedAt: new Date().toISOString() } : n,
 );
 await saveToStorage(STORAGE_KEYS.ranchNotes, updated);
 const updatedNote = updated.find((n) => n.id === id);
 if (updatedNote) void pushRanchNoteToCloud(updatedNote, currentUserRole);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["ranchNotes"], updated);
 },
 });

 const deleteRanchNoteMutation = useMutation({
 mutationFn: async (id: string) => {
 const current = queryClient.getQueryData<RanchNote[]>(["ranchNotes"]) ?? [];
 const updated = current.filter((n) => n.id !== id);
 await saveToStorage(STORAGE_KEYS.ranchNotes, updated);
 void deleteRanchNoteInCloud(id);
 return updated;
 },
 onSuccess: (updated) => {
 queryClient.setQueryData(["ranchNotes"], updated);
 },
 });

 const updateMemberRoleMutation = useMutation({
 mutationFn: async ({ userId, newRole }: { userId: string; newRole: "manager" | "member" }) => {
 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 const updater = currentRanch.members.find((m) => m.userId === currentUserId);

 // Only owner can change roles
 if (updater?.role !== "owner") {
 throw new Error("Only the ranch owner can change member roles.");
 }
 const target = currentRanch.members.find((m) => m.userId === userId);
 if (!target) throw new Error("Member not found.");
 if (target.role === "owner") throw new Error("Cannot change the owner role.");
 if (userId === currentUserId) throw new Error("You cannot change your own role.");

 // Update in Supabase
 if (currentRanch.id && currentRanch.id !== MOCK_RANCH.id) {
 const { error } = await supabase
 .from("ranch_members")
 .update({ role: newRole })
 .eq("ranch_id", currentRanch.id)
 .eq("user_id", userId);
 if (error) throw new Error(error.message);
 }

 // Update local
 const updatedMembers = currentRanch.members.map((m) =>
 m.userId === userId ? { ...m, role: newRole } : m
 );
 const updatedRanch = { ...currentRanch, members: updatedMembers };
 await saveToStorage(STORAGE_KEYS.ranch, updatedRanch);
 await logActivity(`Changed ${target.name} role to ${newRole}`);
 return updatedRanch;
 },
 onSuccess: (updatedRanch) => {
 queryClient.setQueryData(["ranch"], updatedRanch);
 },
 });

 const removeTeammateMutation = useMutation({
 mutationFn: async (userId: string) => {
 const currentRanch = queryClient.getQueryData<Ranch>(["ranch"]) ?? ranch;
 const remover = currentRanch.members.find((m) => m.userId === currentUserId);
 const removerRole = remover?.role;
 const target = currentRanch.members.find((m) => m.userId === userId);

 // Permission checks
 if (removerRole !== "owner" && removerRole !== "manager") {
 throw new Error("Only owners or managers can remove teammates.");
 }
 if (!target) throw new Error("Member not found.");
 if (target.role === "owner") {
 throw new Error("The ranch owner cannot be removed.");
 }
 if (removerRole === "manager" && target.role === "manager") {
 throw new Error("Managers cannot remove other managers. Only the owner can do that.");
 }
 if (userId === currentUserId) {
 throw new Error("You cannot remove yourself.");
 }

 // Remove from Supabase
 if (currentRanch.id && currentRanch.id !== MOCK_RANCH.id) {
 const { error } = await supabase
 .from("ranch_members")
 .delete()
 .eq("ranch_id", currentRanch.id)
 .eq("user_id", userId);
 if (error) throw new Error(error.message);
 }

 // Update local ranch
 const updatedMembers = currentRanch.members.filter((m) => m.userId !== userId);
 const updatedRanch = { ...currentRanch, members: updatedMembers };
 await saveToStorage(STORAGE_KEYS.ranch, updatedRanch);
 await logActivity(`Removed team member: ${target.name}`);
 return updatedRanch;
 },
 onSuccess: (updatedRanch) => {
 queryClient.setQueryData(["ranch"], updatedRanch);
 },
 });

 const needsAttentionAnimals = useMemo(() => {
 const animalIdsNeedingAttention = new Set<string>();
 doctoringEvents.forEach((e) => {
 if (e.followUpNeeded && !e.resolved) {
 animalIdsNeedingAttention.add(e.animalId);
 }
 });
 return animals.filter((a) => a.status === "active" && animalIdsNeedingAttention.has(a.id));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [doctoringEvents.length, animalsSaleKey]);

 const currentUserRole: "owner" | "manager" | "member" | "worker" | null = useMemo(() => {
 const m = ranch.members.find((mm) => mm.userId === currentUserId);
 return (m?.role ?? null) as "owner" | "manager" | "member" | "worker" | null;
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [ranch.members, currentUserId]);

 const canInviteTeammates = currentUserRole === "owner" || currentUserRole === "manager";

 return {
 ranch,
 activeRanchId: ranch.id,
 currentUserRole,
 canInviteTeammates,
 inviteTeammate: inviteTeammateMutation.mutateAsync,
 isInvitingTeammate: inviteTeammateMutation.isPending,
 removeTeammate: removeTeammateMutation.mutateAsync,
 isRemovingTeammate: removeTeammateMutation.isPending,
 updateMemberRole: updateMemberRoleMutation.mutateAsync,
 isUpdatingMemberRole: updateMemberRoleMutation.isPending,
 generateNewInviteCode: generateInviteCodeMutation.mutateAsync,
 isGeneratingInviteCode: generateInviteCodeMutation.isPending,
 setRanchName: setRanchNameMutation.mutateAsync,
 isSettingRanchName: setRanchNameMutation.isPending,
 ranchNotes,
 users,
 currentUser,
 setupRanch: setupRanchMutation.mutateAsync,
 isSettingUpRanch: setupRanchMutation.isPending,
 joinRanch: joinRanchMutation.mutateAsync,
 isJoiningRanch: joinRanchMutation.isPending,
 refreshRanch: refreshRanchMutation.mutateAsync,
 isRefreshingRanch: refreshRanchMutation.isPending,
 updateUserName: updateUserNameMutation.mutateAsync,
 isUpdatingUserName: updateUserNameMutation.isPending,
 setActiveUser: setActiveUserMutation.mutateAsync,
 addUserAndSwitch: addUserMutation.mutateAsync,
 isAddingUser: addUserMutation.isPending,
 userSwitchToast,
 dismissUserSwitchToast,
 addRanchNote: addRanchNoteMutation.mutateAsync,
 updateRanchNote: updateRanchNoteMutation.mutateAsync,
 deleteRanchNote: deleteRanchNoteMutation.mutateAsync,
 animals,
 activeAnimals,
 calvingLists,
 allCalvingLists,
 weightRecords,
 healthRecords,
 calvingRecords,
 businessYears,
 activeBusinessYear,
 activeBusinessYearId,
 activityLog,
 messages,
 customLists,
 isLoading,
 currentUserId,
 currentUserName,
 animalStats,
 animalsByHerdGroup,
 forSaleAnimals,
 soldAnimals,
 deceasedAnimals,
 calvingRecordsForYear,
 addAnimal: addAnimalMutation.mutateAsync,
 updateAnimal: updateAnimalMutation.mutateAsync,
 deleteAnimal: deleteAnimalMutation.mutateAsync,
 addWeightRecord: addWeightRecordMutation.mutateAsync,
 addHealthRecord: addHealthRecordMutation.mutateAsync,
 deleteWeightRecord: deleteWeightRecordMutation.mutateAsync,
 deleteHealthRecord: deleteHealthRecordMutation.mutateAsync,
 createBusinessYear: createBusinessYearMutation.mutateAsync,
 setActiveBusinessYear: setActiveBusinessYearMutation.mutateAsync,
 sendMessage: sendMessageMutation.mutateAsync,
 getAnimalById,
 getWeightRecordsForAnimal,
 getHealthRecordsForAnimal,
 isAddingAnimal: addAnimalMutation.isPending,
 getAnimalVaccinationStatus,
 toggleMarkedForSale: (animalId: string, note?: string) => toggleMarkedForSale.mutateAsync({ animalId, note }),
 markAsSold: markAsSold.mutateAsync,
 undoSold: undoSold.mutateAsync,
 markAsDeceased: markAsDeceased.mutateAsync,
 undoDeceased: undoDeceased.mutateAsync,
 createList: createListMutation.mutateAsync,
 updateList: updateListMutation.mutateAsync,
 deleteList: deleteListMutation.mutateAsync,
 addAnimalToList: addAnimalToListMutation.mutateAsync,
 removeAnimalFromList: removeAnimalFromListMutation.mutateAsync,
 getListsForAnimal,
 getListById,
 getSubLists,
 getBusinessYearName,
 isDuplicateTagInSameYear,
 getAnimalDisplayWithYear,
 createCalvingList: createCalvingListMutation.mutateAsync,
 updateCalvingList: updateCalvingListMutation.mutateAsync,
 deleteCalvingList: deleteCalvingListMutation.mutateAsync,
 logCalvingEvent: logCalvingEventMutation.mutateAsync,
 isLoggingCalvingEvent: logCalvingEventMutation.isPending,
 updateCalvingRecord: updateCalvingRecordMutation.mutateAsync,
 deleteCalvingRecord: deleteCalvingRecordMutation.mutateAsync,
 getCalvingListById,
 getCalvingRecordById,
 getCalvingRecordsForList,
 mergeAnimals: mergeAnimalsMutation.mutateAsync,
 isMergingAnimals: mergeAnimalsMutation.isPending,
 doctoringEvents,
 addDoctoringEvent: addDoctoringEventMutation.mutateAsync,
 updateDoctoringEvent: updateDoctoringEventMutation.mutateAsync,
 getDoctoringEventsForAnimal,
 needsAttentionAnimals,
 isAddingDoctoringEvent: addDoctoringEventMutation.isPending,
 resetApp: resetAppMutation.mutateAsync,
 isResettingApp: resetAppMutation.isPending,
 syncAnimals: syncAnimalsMutation.mutateAsync,
 isSyncingAnimals: syncAnimalsMutation.isPending,
 syncBusinessYears: syncBusinessYearsMutation.mutateAsync,
 isSyncingBusinessYears: syncBusinessYearsMutation.isPending,
 syncCalvingData: syncCalvingDataMutation.mutateAsync,
 isSyncingCalvingData: syncCalvingDataMutation.isPending,
 syncDoctoringEvents: syncDoctoringEventsMutation.mutateAsync,
 isSyncingDoctoringEvents: syncDoctoringEventsMutation.isPending,
 syncWeightHealth: syncWeightHealthMutation.mutateAsync,
 isSyncingWeightHealth: syncWeightHealthMutation.isPending,
 syncCustomLists: syncCustomListsMutation.mutateAsync,
 isSyncingCustomLists: syncCustomListsMutation.isPending,
 syncRanchNotes: syncRanchNotesMutation.mutateAsync,
 isSyncingRanchNotes: syncRanchNotesMutation.isPending,
 };
});