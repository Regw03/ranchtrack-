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
} from "@/lib/supabase";
// eslint-disable-next-line rork/general-context-optimization
import {
  Animal,
  WeightRecord,
  HealthRecord,
  BreedingRecord,
  CalvingRecord,
  BusinessYear,
  ActivityLogEntry,
  Message,
  Ranch,
  RanchMember,
  User,
  CustomList,
  CalvingList,
  CalvingGroup,
  BreedingGroup,
  HerdGroup,
  IdentityStatus,
  GenerationConfidence,
  DoctoringEvent,
  RanchNote,
} from "@/types";
import {
  MOCK_ANIMALS,
  MOCK_WEIGHT_RECORDS,
  MOCK_HEALTH_RECORDS,
  MOCK_BREEDING_RECORDS,
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
  calvingGroupCowIds: string[];
  calvingGroupCalfIds: string[];
  breedingGroupIds: string[];
}

interface DeceasedSnapshot {
  animalId: string;
  markedForSale: boolean;
  saleNote?: string;
  previousStatus: "active" | "sold";
  listIds: string[];
  calvingGroupCowIds: string[];
  calvingGroupCalfIds: string[];
  breedingGroupIds: string[];
}

const STORAGE_KEYS = {
  animals: "ranchtrack_animals",
  soldSnapshots: "ranchtrack_sold_snapshots",
  weightRecords: "ranchtrack_weight_records",
  healthRecords: "ranchtrack_health_records",
  breedingRecords: "ranchtrack_breeding_records",
  calvingRecords: "ranchtrack_calving_records",
  businessYears: "ranchtrack_business_years",
  activeBusinessYearId: "ranchtrack_active_business_year_id",
  activityLog: "ranchtrack_activity_log",
  messages: "ranchtrack_messages",
  ranch: "ranchtrack_ranch",
  currentUserId: "ranchtrack_current_user",
  customLists: "ranchtrack_custom_lists",
  calvingLists: "ranchtrack_calving_lists",
  calvingGroups: "ranchtrack_calving_groups",
  breedingGroups: "ranchtrack_breeding_groups",
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
  if (animal.sex === "heifer") return "heifers";
  if (animal.sex === "steer") return "steers";

  if (animal.motherId) {
    const birthDate = animal.birthDate ? parseBirthDate(animal.birthDate) : null;
    const now = new Date();
    if (birthDate) {
      const ageInMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
      if (ageInMonths < 12) {
        return "calves";
      }
    } else {
      return "calves";
    }
  }

  if (animal.birthDate) {
    const birthDate = parseBirthDate(animal.birthDate);
    const now = new Date();
    const ageInMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
    if (ageInMonths < 12) {
      return "calves";
    }
  }

  switch (animal.sex) {
    case "female":
      return "cows";
    case "male":
      return "bulls";
    default:
      return "other";
  }
}

export const HERD_GROUP_CONFIG: Record<HerdGroup, { label: string; emoji: string; color: string }> = {
  cows: { label: "Cows", emoji: "🐄", color: "#3D8B5E" },
  heifers: { label: "Heifers", emoji: "🐂", color: "#D4943A" },
  calves: { label: "Calves", emoji: "🐮", color: "#2D7A9C" },
  bulls: { label: "Bulls", emoji: "🐃", color: "#C4622D" },
  steers: { label: "Steers", emoji: "🐄", color: "#7B5EA7" },
  other: { label: "Other", emoji: "🐾", color: "#6B6B6B" },
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

  const breedingRecordsQuery = useQuery({
    queryKey: ["breedingRecords"],
    queryFn: () => loadFromStorage<BreedingRecord[]>(STORAGE_KEYS.breedingRecords, MOCK_BREEDING_RECORDS),
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

  const calvingGroupsQuery = useQuery({
    queryKey: ["calvingGroups"],
    queryFn: () => loadFromStorage<CalvingGroup[]>(STORAGE_KEYS.calvingGroups, []),
  });

  const breedingGroupsQuery = useQuery({
    queryKey: ["breedingGroups"],
    queryFn: () => loadFromStorage<BreedingGroup[]>(STORAGE_KEYS.breedingGroups, []),
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
  const breedingRecords = breedingRecordsQuery.data ?? [];
  const calvingRecords = calvingRecordsQuery.data ?? [];
  const businessYears = businessYearsQuery.data ?? [DEFAULT_BUSINESS_YEAR];
  const activeBusinessYearId = activeBusinessYearIdQuery.data ?? DEFAULT_BUSINESS_YEAR.id;
  const activityLog = activityQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const customLists = customListsQuery.data ?? [];
  const allCalvingLists = calvingListsQuery.data ?? [];
  const allCalvingGroups = calvingGroupsQuery.data ?? [];
  const allBreedingGroups = breedingGroupsQuery.data ?? [];

  const calvingLists = useMemo(
    () => allCalvingLists.filter((l) => l.businessYearId === activeBusinessYearId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allCalvingLists.length, activeBusinessYearId],
  );

  const calvingGroups = useMemo(
    () => allCalvingGroups.filter((g) => g.businessYearId === activeBusinessYearId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allCalvingGroups.length, activeBusinessYearId],
  );

  const breedingGroups = useMemo(
    () => allBreedingGroups.filter((g) => g.businessYearId === activeBusinessYearId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allBreedingGroups.length, activeBusinessYearId],
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

  const bredAnimals = useMemo(
    () => {
      const bredAnimalIds = new Set<string>();
      breedingRecords
        .filter((r) => (r.status === "bred" || r.status === "confirmed") && (!r.businessYearId || r.businessYearId === activeBusinessYearId))
        .forEach((r) => bredAnimalIds.add(r.animalId));
      return activeAnimals.filter((a) => bredAnimalIds.has(a.id));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeAnimals, breedingRecords.length, activeBusinessYearId],
  );

  const openAnimals = useMemo(
    () => {
      const bredAnimalIds = new Set<string>();
      breedingRecords
        .filter((r) => (r.status === "bred" || r.status === "confirmed") && (!r.businessYearId || r.businessYearId === activeBusinessYearId))
        .forEach((r) => bredAnimalIds.add(r.animalId));
      return activeAnimals.filter(
        (a) => (a.sex === "female" || a.sex === "heifer") && !bredAnimalIds.has(a.id),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeAnimals, breedingRecords.length, activeBusinessYearId],
  );

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

  const addHealthRecordMutation = useMutation({
    mutationFn: async (record: Omit<HealthRecord, "id">) => {
      const newRecord: HealthRecord = { ...record, id: generateId() };
      const current = queryClient.getQueryData<HealthRecord[]>(["healthRecords"]) ?? [];
      const updated = [...current, newRecord];
      await saveToStorage(STORAGE_KEYS.healthRecords, updated);
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

  const addBreedingRecordMutation = useMutation({
    mutationFn: async (record: Omit<BreedingRecord, "id">) => {
      const newRecord: BreedingRecord = {
        ...record,
        id: generateId(),
        businessYearId: record.businessYearId ?? activeBusinessYearId,
      };
      const current = queryClient.getQueryData<BreedingRecord[]>(["breedingRecords"]) ?? [];
      const updated = [...current, newRecord];
      await saveToStorage(STORAGE_KEYS.breedingRecords, updated);
      const animal = animals.find((a) => a.id === record.animalId);
      if (animal) {
        await logActivity(`Added breeding record for ${getAnimalDisplayName(animal)}`, "breeding", animal.id);
      }
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["breedingRecords"], updated);
    },
  });

  const quickSetBreedingStatus = useMutation({
    mutationFn: async ({ animalId, status, dueDate }: { animalId: string; status: "bred" | "open"; dueDate?: string }) => {
      const current = queryClient.getQueryData<BreedingRecord[]>(["breedingRecords"]) ?? [];
      const existingIdx = current.findIndex(
        (r) => r.animalId === animalId && (r.businessYearId === activeBusinessYearId || !r.businessYearId),
      );

      let updated: BreedingRecord[];
      if (existingIdx >= 0) {
        updated = current.map((r, i) =>
          i === existingIdx ? { ...r, status, expectedDueDate: dueDate ?? r.expectedDueDate } : r,
        );
      } else {
        const newRecord: BreedingRecord = {
          id: generateId(),
          animalId,
          lastBredDate: new Date().toISOString().split("T")[0],
          expectedDueDate: dueDate ?? "",
          status,
          businessYearId: activeBusinessYearId,
          notes: "",
        };
        updated = [...current, newRecord];
      }

      await saveToStorage(STORAGE_KEYS.breedingRecords, updated);
      const animal = animals.find((a) => a.id === animalId);
      if (animal) {
        await logActivity(`Set ${getAnimalDisplayName(animal)} as ${status}`, "breeding", animalId);
      }
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["breedingRecords"], updated);
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

  const getBreedingRecordsForAnimal = useCallback(
    (animalId: string) =>
      breedingRecords.filter((r) => r.animalId === animalId).sort((a, b) => new Date(b.lastBredDate).getTime() - new Date(a.lastBredDate).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [breedingRecords.length],
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

  const getAnimalBreedingStatus = useCallback(
    (animalId: string): "bred" | "confirmed" | "delivered" | "open" | "none" => {
      const records = breedingRecords.filter((r) => r.animalId === animalId);
      if (records.length === 0) return "none";
      const latest = records.sort((a, b) => new Date(b.lastBredDate).getTime() - new Date(a.lastBredDate).getTime())[0];
      return latest.status;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [breedingRecords.length],
  );

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
      const currentGroups = queryClient.getQueryData<CalvingGroup[]>(["calvingGroups"]) ?? [];

      const currentBreedingGroups = queryClient.getQueryData<BreedingGroup[]>(["breedingGroups"]) ?? [];

      const snapshot: SoldSnapshot = {
        animalId,
        markedForSale: animal?.markedForSale ?? false,
        saleNote: animal?.saleNote,
        listIds: currentLists.filter((l) => l.animalIds.includes(animalId)).map((l) => l.id),
        calvingGroupCowIds: currentGroups.filter((g) => g.cowIds.includes(animalId)).map((g) => g.id),
        calvingGroupCalfIds: currentGroups.filter((g) => g.calfIds.includes(animalId)).map((g) => g.id),
        breedingGroupIds: currentBreedingGroups.filter((g) => g.animalIds.includes(animalId)).map((g) => g.id),
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

      const updatedGroups = currentGroups.map((g) => {
        const hasCow = g.cowIds.includes(animalId);
        const hasCalf = g.calfIds.includes(animalId);
        if (hasCow || hasCalf) {
          return {
            ...g,
            cowIds: hasCow ? g.cowIds.filter((id) => id !== animalId) : g.cowIds,
            calfIds: hasCalf ? g.calfIds.filter((id) => id !== animalId) : g.calfIds,
            updatedAt: new Date().toISOString(),
          };
        }
        return g;
      });
      await saveToStorage(STORAGE_KEYS.calvingGroups, updatedGroups);

      const updatedBreedingGroups = currentBreedingGroups.map((g) => {
        if (g.animalIds.includes(animalId)) {
          return { ...g, animalIds: g.animalIds.filter((id) => id !== animalId), updatedAt: new Date().toISOString() };
        }
        return g;
      });
      await saveToStorage(STORAGE_KEYS.breedingGroups, updatedBreedingGroups);

      if (animal) {
        await logActivity(`Marked ${getAnimalDisplayName(animal)} as sold`, "animal", animalId);
      }
      return { updatedAnimals, updatedLists, updatedGroups, updatedSnapshots, updatedBreedingGroups };
    },
    onSuccess: ({ updatedAnimals, updatedLists, updatedGroups, updatedSnapshots, updatedBreedingGroups }) => {
      queryClient.setQueryData(["animals"], updatedAnimals);
      queryClient.setQueryData(["customLists"], updatedLists);
      queryClient.setQueryData(["calvingGroups"], updatedGroups);
      queryClient.setQueryData(["soldSnapshots"], updatedSnapshots);
      queryClient.setQueryData(["breedingGroups"], updatedBreedingGroups);
    },
  });

  const markAsDeceased = useMutation({
    mutationFn: async (animalId: string) => {
      const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
      const animal = currentAnimals.find((a) => a.id === animalId);

      const currentLists = queryClient.getQueryData<CustomList[]>(["customLists"]) ?? [];
      const currentGroups = queryClient.getQueryData<CalvingGroup[]>(["calvingGroups"]) ?? [];

      const currentBreedingGroups = queryClient.getQueryData<BreedingGroup[]>(["breedingGroups"]) ?? [];

      const snapshot: DeceasedSnapshot = {
        animalId,
        markedForSale: animal?.markedForSale ?? false,
        saleNote: animal?.saleNote,
        previousStatus: (animal?.status === "sold" ? "sold" : "active") as "active" | "sold",
        listIds: currentLists.filter((l) => l.animalIds.includes(animalId)).map((l) => l.id),
        calvingGroupCowIds: currentGroups.filter((g) => g.cowIds.includes(animalId)).map((g) => g.id),
        calvingGroupCalfIds: currentGroups.filter((g) => g.calfIds.includes(animalId)).map((g) => g.id),
        breedingGroupIds: currentBreedingGroups.filter((g) => g.animalIds.includes(animalId)).map((g) => g.id),
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

      const updatedGroups = currentGroups.map((g) => {
        const hasCow = g.cowIds.includes(animalId);
        const hasCalf = g.calfIds.includes(animalId);
        if (hasCow || hasCalf) {
          return {
            ...g,
            cowIds: hasCow ? g.cowIds.filter((id) => id !== animalId) : g.cowIds,
            calfIds: hasCalf ? g.calfIds.filter((id) => id !== animalId) : g.calfIds,
            updatedAt: new Date().toISOString(),
          };
        }
        return g;
      });
      await saveToStorage(STORAGE_KEYS.calvingGroups, updatedGroups);

      const updatedBreedingGroups = currentBreedingGroups.map((g) => {
        if (g.animalIds.includes(animalId)) {
          return { ...g, animalIds: g.animalIds.filter((id) => id !== animalId), updatedAt: new Date().toISOString() };
        }
        return g;
      });
      await saveToStorage(STORAGE_KEYS.breedingGroups, updatedBreedingGroups);

      if (animal) {
        await logActivity(`Marked ${getAnimalDisplayName(animal)} as deceased`, "animal", animalId);
      }
      return { updatedAnimals, updatedLists, updatedGroups, updatedSnapshots, updatedBreedingGroups };
    },
    onSuccess: ({ updatedAnimals, updatedLists, updatedGroups, updatedSnapshots, updatedBreedingGroups }) => {
      queryClient.setQueryData(["animals"], updatedAnimals);
      queryClient.setQueryData(["customLists"], updatedLists);
      queryClient.setQueryData(["calvingGroups"], updatedGroups);
      queryClient.setQueryData(["deceasedSnapshots"], updatedSnapshots);
      queryClient.setQueryData(["breedingGroups"], updatedBreedingGroups);
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

      const currentGroups = queryClient.getQueryData<CalvingGroup[]>(["calvingGroups"]) ?? [];
      let updatedGroups = currentGroups;
      if (snapshot && (snapshot.calvingGroupCowIds.length > 0 || snapshot.calvingGroupCalfIds.length > 0)) {
        updatedGroups = currentGroups.map((g) => {
          const shouldAddCow = snapshot.calvingGroupCowIds.includes(g.id) && !g.cowIds.includes(animalId);
          const shouldAddCalf = snapshot.calvingGroupCalfIds.includes(g.id) && !g.calfIds.includes(animalId);
          if (shouldAddCow || shouldAddCalf) {
            return {
              ...g,
              cowIds: shouldAddCow ? [...g.cowIds, animalId] : g.cowIds,
              calfIds: shouldAddCalf ? [...g.calfIds, animalId] : g.calfIds,
              updatedAt: new Date().toISOString(),
            };
          }
          return g;
        });
        await saveToStorage(STORAGE_KEYS.calvingGroups, updatedGroups);
      }

      const currentBreedingGroups = queryClient.getQueryData<BreedingGroup[]>(["breedingGroups"]) ?? [];
      let updatedBreedingGroups = currentBreedingGroups;
      if (snapshot && (snapshot.breedingGroupIds?.length ?? 0) > 0) {
        updatedBreedingGroups = currentBreedingGroups.map((g) => {
          if (snapshot.breedingGroupIds?.includes(g.id) && !g.animalIds.includes(animalId)) {
            return { ...g, animalIds: [...g.animalIds, animalId], updatedAt: new Date().toISOString() };
          }
          return g;
        });
        await saveToStorage(STORAGE_KEYS.breedingGroups, updatedBreedingGroups);
      }

      const updatedSnapshots = currentSnapshots.filter((s) => s.animalId !== animalId);
      await saveToStorage(STORAGE_KEYS.deceasedSnapshots, updatedSnapshots);

      const animal = currentAnimals.find((a) => a.id === animalId);
      if (animal) {
        await logActivity(`Undid deceased status for ${getAnimalDisplayName(animal)} — restored to previous state`, "animal", animalId);
      }
      return { updatedAnimals, updatedLists, updatedGroups, updatedSnapshots, updatedBreedingGroups };
    },
    onSuccess: ({ updatedAnimals, updatedLists, updatedGroups, updatedSnapshots, updatedBreedingGroups }) => {
      queryClient.setQueryData(["animals"], updatedAnimals);
      queryClient.setQueryData(["customLists"], updatedLists);
      queryClient.setQueryData(["calvingGroups"], updatedGroups);
      queryClient.setQueryData(["deceasedSnapshots"], updatedSnapshots);
      queryClient.setQueryData(["breedingGroups"], updatedBreedingGroups);
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

      const currentGroups = queryClient.getQueryData<CalvingGroup[]>(["calvingGroups"]) ?? [];
      let updatedGroups = currentGroups;
      if (snapshot && (snapshot.calvingGroupCowIds.length > 0 || snapshot.calvingGroupCalfIds.length > 0)) {
        updatedGroups = currentGroups.map((g) => {
          const shouldAddCow = snapshot.calvingGroupCowIds.includes(g.id) && !g.cowIds.includes(animalId);
          const shouldAddCalf = snapshot.calvingGroupCalfIds.includes(g.id) && !g.calfIds.includes(animalId);
          if (shouldAddCow || shouldAddCalf) {
            return {
              ...g,
              cowIds: shouldAddCow ? [...g.cowIds, animalId] : g.cowIds,
              calfIds: shouldAddCalf ? [...g.calfIds, animalId] : g.calfIds,
              updatedAt: new Date().toISOString(),
            };
          }
          return g;
        });
        await saveToStorage(STORAGE_KEYS.calvingGroups, updatedGroups);
      }

      const currentBreedingGroups = queryClient.getQueryData<BreedingGroup[]>(["breedingGroups"]) ?? [];
      let updatedBreedingGroups = currentBreedingGroups;
      if (snapshot && (snapshot.breedingGroupIds?.length ?? 0) > 0) {
        updatedBreedingGroups = currentBreedingGroups.map((g) => {
          if (snapshot.breedingGroupIds?.includes(g.id) && !g.animalIds.includes(animalId)) {
            return { ...g, animalIds: [...g.animalIds, animalId], updatedAt: new Date().toISOString() };
          }
          return g;
        });
        await saveToStorage(STORAGE_KEYS.breedingGroups, updatedBreedingGroups);
      }

      const updatedSnapshots = currentSnapshots.filter((s) => s.animalId !== animalId);
      await saveToStorage(STORAGE_KEYS.soldSnapshots, updatedSnapshots);

      const animal = currentAnimals.find((a) => a.id === animalId);
      if (animal) {
        await logActivity(`Undid sold status for ${getAnimalDisplayName(animal)} — restored to previous state`, "animal", animalId);
      }
      return { updatedAnimals, updatedLists, updatedGroups, updatedSnapshots, updatedBreedingGroups };
    },
    onSuccess: ({ updatedAnimals, updatedLists, updatedGroups, updatedSnapshots, updatedBreedingGroups }) => {
      queryClient.setQueryData(["animals"], updatedAnimals);
      queryClient.setQueryData(["customLists"], updatedLists);
      queryClient.setQueryData(["calvingGroups"], updatedGroups);
      queryClient.setQueryData(["soldSnapshots"], updatedSnapshots);
      queryClient.setQueryData(["breedingGroups"], updatedBreedingGroups);
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

  // ─── End calving list mutations ─────────────────────────────────────────────

  const createCalvingGroupMutation = useMutation({
    mutationFn: async (group: Omit<CalvingGroup, "id" | "ranchId" | "businessYearId" | "createdAt" | "updatedAt">) => {
      const newGroup: CalvingGroup = {
        ...group,
        id: generateId(),
        ranchId: ranch.id,
        businessYearId: activeBusinessYearId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const current = queryClient.getQueryData<CalvingGroup[]>(["calvingGroups"]) ?? [];
      const updated = [...current, newGroup];
      await saveToStorage(STORAGE_KEYS.calvingGroups, updated);
      await logActivity(`Created calving group "${newGroup.name}"`);
      return { updated, newGroup };
    },
    onSuccess: ({ updated }) => {
      queryClient.setQueryData(["calvingGroups"], updated);
    },
  });

  const updateCalvingGroupMutation = useMutation({
    mutationFn: async (group: CalvingGroup) => {
      const current = queryClient.getQueryData<CalvingGroup[]>(["calvingGroups"]) ?? [];
      const updated = current.map((g) =>
        g.id === group.id ? { ...group, updatedAt: new Date().toISOString() } : g,
      );
      await saveToStorage(STORAGE_KEYS.calvingGroups, updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["calvingGroups"], updated);
    },
  });

  const deleteCalvingGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const current = queryClient.getQueryData<CalvingGroup[]>(["calvingGroups"]) ?? [];
      const group = current.find((g) => g.id === groupId);
      const updated = current.filter((g) => g.id !== groupId);
      await saveToStorage(STORAGE_KEYS.calvingGroups, updated);
      if (group) {
        await logActivity(`Deleted calving group "${group.name}"`);
      }
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["calvingGroups"], updated);
    },
  });

  const addCowToCalvingGroupMutation = useMutation({
    mutationFn: async ({ groupId, cowId }: { groupId: string; cowId: string }) => {
      const current = queryClient.getQueryData<CalvingGroup[]>(["calvingGroups"]) ?? [];
      const updated = current.map((g) => {
        if (g.id === groupId && !g.cowIds.includes(cowId)) {
          return { ...g, cowIds: [...g.cowIds, cowId], updatedAt: new Date().toISOString() };
        }
        return g;
      });
      await saveToStorage(STORAGE_KEYS.calvingGroups, updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["calvingGroups"], updated);
    },
  });

  const removeCowFromCalvingGroupMutation = useMutation({
    mutationFn: async ({ groupId, cowId }: { groupId: string; cowId: string }) => {
      const current = queryClient.getQueryData<CalvingGroup[]>(["calvingGroups"]) ?? [];
      const updated = current.map((g) => {
        if (g.id === groupId) {
          return { ...g, cowIds: g.cowIds.filter((id) => id !== cowId), updatedAt: new Date().toISOString() };
        }
        return g;
      });
      await saveToStorage(STORAGE_KEYS.calvingGroups, updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["calvingGroups"], updated);
    },
  });

  const addCalfToCalvingGroupMutation = useMutation({
    mutationFn: async ({ groupId, calfId }: { groupId: string; calfId: string }) => {
      const current = queryClient.getQueryData<CalvingGroup[]>(["calvingGroups"]) ?? [];
      const updated = current.map((g) => {
        if (g.id === groupId && !g.calfIds.includes(calfId)) {
          return { ...g, calfIds: [...g.calfIds, calfId], updatedAt: new Date().toISOString() };
        }
        return g;
      });
      await saveToStorage(STORAGE_KEYS.calvingGroups, updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["calvingGroups"], updated);
    },
  });

  const getCalvingGroupById = useCallback(
    (id: string) => allCalvingGroups.find((g) => g.id === id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allCalvingGroups.length, allCalvingGroups],
  );

  const getCalvingGroupsForCow = useCallback(
    (cowId: string) => allCalvingGroups.filter((g) => g.cowIds.includes(cowId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allCalvingGroups.length, allCalvingGroups],
  );

  const createBreedingGroupMutation = useMutation({
    mutationFn: async (group: Omit<BreedingGroup, "id" | "ranchId" | "businessYearId" | "createdAt" | "updatedAt">) => {
      const newGroup: BreedingGroup = {
        ...group,
        id: generateId(),
        ranchId: ranch.id,
        businessYearId: activeBusinessYearId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const current = queryClient.getQueryData<BreedingGroup[]>(["breedingGroups"]) ?? [];
      const updated = [...current, newGroup];
      await saveToStorage(STORAGE_KEYS.breedingGroups, updated);
      await logActivity(`Created breeding group "${newGroup.name}"`);
      return { updated, newGroup };
    },
    onSuccess: ({ updated }) => {
      queryClient.setQueryData(["breedingGroups"], updated);
    },
  });

  const updateBreedingGroupMutation = useMutation({
    mutationFn: async (group: BreedingGroup) => {
      const current = queryClient.getQueryData<BreedingGroup[]>(["breedingGroups"]) ?? [];
      const updated = current.map((g) =>
        g.id === group.id ? { ...group, updatedAt: new Date().toISOString() } : g,
      );
      await saveToStorage(STORAGE_KEYS.breedingGroups, updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["breedingGroups"], updated);
    },
  });

  const deleteBreedingGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const current = queryClient.getQueryData<BreedingGroup[]>(["breedingGroups"]) ?? [];
      const group = current.find((g) => g.id === groupId);
      const updated = current.filter((g) => g.id !== groupId);
      await saveToStorage(STORAGE_KEYS.breedingGroups, updated);
      if (group) {
        await logActivity(`Deleted breeding group "${group.name}"`);
      }
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["breedingGroups"], updated);
    },
  });

  const addAnimalToBreedingGroupMutation = useMutation({
    mutationFn: async ({ groupId, animalId }: { groupId: string; animalId: string }) => {
      const current = queryClient.getQueryData<BreedingGroup[]>(["breedingGroups"]) ?? [];
      const updated = current.map((g) => {
        if (g.id === groupId && !g.animalIds.includes(animalId)) {
          return { ...g, animalIds: [...g.animalIds, animalId], updatedAt: new Date().toISOString() };
        }
        return g;
      });
      await saveToStorage(STORAGE_KEYS.breedingGroups, updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["breedingGroups"], updated);
    },
  });

  const removeAnimalFromBreedingGroupMutation = useMutation({
    mutationFn: async ({ groupId, animalId }: { groupId: string; animalId: string }) => {
      const current = queryClient.getQueryData<BreedingGroup[]>(["breedingGroups"]) ?? [];
      const updated = current.map((g) => {
        if (g.id === groupId) {
          return { ...g, animalIds: g.animalIds.filter((id) => id !== animalId), updatedAt: new Date().toISOString() };
        }
        return g;
      });
      await saveToStorage(STORAGE_KEYS.breedingGroups, updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["breedingGroups"], updated);
    },
  });

  const getBreedingGroupById = useCallback(
    (id: string) => allBreedingGroups.find((g) => g.id === id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allBreedingGroups.length, allBreedingGroups],
  );

  const getBreedingGroupsForAnimal = useCallback(
    (animalId: string) => allBreedingGroups.filter((g) => g.animalIds.includes(animalId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allBreedingGroups.length, allBreedingGroups],
  );

  const breedingRecordsForYear = useMemo(
    () => breedingRecords.filter((r) => !r.businessYearId || r.businessYearId === activeBusinessYearId)
      .sort((a, b) => new Date(b.lastBredDate).getTime() - new Date(a.lastBredDate).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [breedingRecords.length, activeBusinessYearId],
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
        generation: keepAnimal.generation ?? removeAnimal.generation,
        generationConfidence: keepAnimal.generationConfidence === "confirmed" ? "confirmed" : removeAnimal.generationConfidence ?? keepAnimal.generationConfidence,
        identityStatus: "confirmed",
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

      const currentBR = queryClient.getQueryData<BreedingRecord[]>(["breedingRecords"]) ?? [];
      const updatedBR = currentBR.map((r) => {
        let updated = r;
        if (r.animalId === removeId) updated = { ...updated, animalId: keepId };
        if (r.sireId === removeId) updated = { ...updated, sireId: keepId };
        return updated;
      });
      await saveToStorage(STORAGE_KEYS.breedingRecords, updatedBR);

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

      const currentCG = queryClient.getQueryData<CalvingGroup[]>(["calvingGroups"]) ?? [];
      const updatedCG = currentCG.map((g) => {
        let cowIds = g.cowIds;
        let calfIds = g.calfIds;
        if (cowIds.includes(removeId)) {
          cowIds = cowIds.filter((id) => id !== removeId);
          if (!cowIds.includes(keepId)) cowIds.push(keepId);
        }
        if (calfIds.includes(removeId)) {
          calfIds = calfIds.filter((id) => id !== removeId);
          if (!calfIds.includes(keepId)) calfIds.push(keepId);
        }
        return { ...g, cowIds, calfIds, updatedAt: new Date().toISOString() };
      });
      await saveToStorage(STORAGE_KEYS.calvingGroups, updatedCG);

      const currentBG = queryClient.getQueryData<BreedingGroup[]>(["breedingGroups"]) ?? [];
      const updatedBG = currentBG.map((g) => {
        if (g.animalIds.includes(removeId)) {
          const ids = g.animalIds.filter((id) => id !== removeId);
          if (!ids.includes(keepId)) ids.push(keepId);
          return { ...g, animalIds: ids, updatedAt: new Date().toISOString() };
        }
        return g;
      });
      await saveToStorage(STORAGE_KEYS.breedingGroups, updatedBG);

      await logActivity(
        `Merged ${getAnimalDisplayName(removeAnimal)} into ${getAnimalDisplayName(mergedAnimal)}`,
        "animal",
        keepId,
      );

      return { updatedAnimals, updatedWR, updatedHR, updatedBR, updatedLists, updatedCG, updatedBG };
    },
    onSuccess: ({ updatedAnimals, updatedWR, updatedHR, updatedBR, updatedLists, updatedCG, updatedBG }) => {
      queryClient.setQueryData(["animals"], updatedAnimals);
      queryClient.setQueryData(["weightRecords"], updatedWR);
      queryClient.setQueryData(["healthRecords"], updatedHR);
      queryClient.setQueryData(["breedingRecords"], updatedBR);
      queryClient.setQueryData(["customLists"], updatedLists);
      queryClient.setQueryData(["calvingGroups"], updatedCG);
      queryClient.setQueryData(["breedingGroups"], updatedBG);
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
        throw new Error("No ranch found with that code");
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

      const merged = Array.from(localById.values());
      await saveToStorage(STORAGE_KEYS.animals, merged);

      const localOnlyAnimals = merged.filter(
        (a) => a.ranchId === current.id && !remoteIds.has(a.id),
      );
      if (localOnlyAnimals.length > 0) {
        console.log(`[syncAnimals] pushing ${localOnlyAnimals.length} local-only animals to cloud`);
        void pushAnimalsBatchToCloud(localOnlyAnimals, currentUserId || null);
      }

      console.log(`[syncAnimals] merged ${merged.length} animals (remote: ${remoteRows.length})`);
      return merged;
    },
    onSuccess: (merged) => {
      if (merged) queryClient.setQueryData(["animals"], merged);
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
          console.log("[AppState] app foregrounded — refreshing ranch members");
          refreshRanchMutation.mutate();
        }
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      queryClient.setQueryData(["breedingRecords"], []);
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
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["ranchNotes"], updated);
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
    calvingGroups,
    breedingGroups,
    weightRecords,
    healthRecords,
    breedingRecords,
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
    bredAnimals,
    openAnimals,
    forSaleAnimals,
    soldAnimals,
    deceasedAnimals,
    calvingRecordsForYear,
    breedingRecordsForYear,
    addAnimal: addAnimalMutation.mutateAsync,
    updateAnimal: updateAnimalMutation.mutateAsync,
    deleteAnimal: deleteAnimalMutation.mutateAsync,
    addWeightRecord: addWeightRecordMutation.mutateAsync,
    addHealthRecord: addHealthRecordMutation.mutateAsync,
    addBreedingRecord: addBreedingRecordMutation.mutateAsync,
    quickSetBreedingStatus: quickSetBreedingStatus.mutateAsync,
    createBusinessYear: createBusinessYearMutation.mutateAsync,
    setActiveBusinessYear: setActiveBusinessYearMutation.mutateAsync,
    sendMessage: sendMessageMutation.mutateAsync,
    getAnimalById,
    getWeightRecordsForAnimal,
    getHealthRecordsForAnimal,
    getBreedingRecordsForAnimal,
    isAddingAnimal: addAnimalMutation.isPending,
    getAnimalBreedingStatus,
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
    createCalvingGroup: createCalvingGroupMutation.mutateAsync,
    updateCalvingGroup: updateCalvingGroupMutation.mutateAsync,
    deleteCalvingGroup: deleteCalvingGroupMutation.mutateAsync,
    addCowToCalvingGroup: addCowToCalvingGroupMutation.mutateAsync,
    removeCowFromCalvingGroup: removeCowFromCalvingGroupMutation.mutateAsync,
    addCalfToCalvingGroup: addCalfToCalvingGroupMutation.mutateAsync,
    getCalvingGroupById,
    getCalvingGroupsForCow,
    createBreedingGroup: createBreedingGroupMutation.mutateAsync,
    updateBreedingGroup: updateBreedingGroupMutation.mutateAsync,
    deleteBreedingGroup: deleteBreedingGroupMutation.mutateAsync,
    addAnimalToBreedingGroup: addAnimalToBreedingGroupMutation.mutateAsync,
    removeAnimalFromBreedingGroup: removeAnimalFromBreedingGroupMutation.mutateAsync,
    getBreedingGroupById,
    getBreedingGroupsForAnimal,
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
  };
});
