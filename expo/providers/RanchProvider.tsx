import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { parseBirthDate } from "@/utils/helpers";
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
  CustomList,
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
  calvingGroups: "ranchtrack_calving_groups",
  breedingGroups: "ranchtrack_breeding_groups",
  deceasedSnapshots: "ranchtrack_deceased_snapshots",
  doctoringEvents: "ranchtrack_doctoring_events",
  ranchNotes: "ranchtrack_ranch_notes",
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
  const currentUserId = "user-1";
  const currentUserName = "Jake Morrison";

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
  const allCalvingGroups = calvingGroupsQuery.data ?? [];
  const allBreedingGroups = breedingGroupsQuery.data ?? [];

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
      return { updated, newAnimal };
    },
    onSuccess: ({ updated }) => {
      queryClient.setQueryData(["animals"], updated);
    },
  });

  const updateAnimalMutation = useMutation({
    mutationFn: async (animal: Animal) => {
      const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];
      const updated = currentAnimals.map((a) => (a.id === animal.id ? { ...animal, updatedAt: new Date().toISOString() } : a));
      await saveToStorage(STORAGE_KEYS.animals, updated);
      await logActivity(`Updated ${getAnimalDisplayName(animal)}`, "animal", animal.id);
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

  const logCalvingMutation = useMutation({
    mutationFn: async (record: Omit<CalvingRecord, "id" | "createdAt"> & { calfGeneration?: number; calfGenerationConfidence?: GenerationConfidence; calfIdentityStatus?: IdentityStatus }) => {
      const { calfGeneration, calfGenerationConfidence, calfIdentityStatus, ...calvingData } = record;
      const newRecord: CalvingRecord = {
        ...calvingData,
        id: generateId(),
        businessYearId: calvingData.businessYearId || activeBusinessYearId,
        createdAt: new Date().toISOString(),
      };

      const currentCalving = queryClient.getQueryData<CalvingRecord[]>(["calvingRecords"]) ?? [];
      const updatedCalving = [newRecord, ...currentCalving];
      await saveToStorage(STORAGE_KEYS.calvingRecords, updatedCalving);

      const currentAnimals = queryClient.getQueryData<Animal[]>(["animals"]) ?? [];

      const calvingBusinessYearId = calvingData.businessYearId || activeBusinessYearId;

      let finalGeneration: number | undefined = calfGeneration;
      let finalGenConfidence: GenerationConfidence | undefined = calfGenerationConfidence;
      if (finalGeneration == null) {
        const existingCalvesInYear = currentAnimals.filter(
          (a) => a.businessYearId === calvingBusinessYearId,
        );
        finalGeneration = existingCalvesInYear.length > 0
          ? Math.max(...existingCalvesInYear.filter((a) => a.generation != null).map((a) => a.generation!), 0) + 1
          : 1;
        if (!finalGenConfidence) finalGenConfidence = "confirmed";
      }

      const calfAnimal: Animal = {
        id: generateId(),
        ranchId: ranch.id,
        tagId: calvingData.calfTagId,
        species: "cattle",
        breed: calvingData.calfBreed,
        birthDate: calvingData.date,
        sex: calvingData.calfSex === "male" ? "male" : "female",
        notes: calvingData.notes,
        status: "active",
        markedForSale: false,
        motherId: calvingData.motherId,
        businessYearId: calvingBusinessYearId,
        generation: finalGeneration,
        generationConfidence: finalGenConfidence ?? "confirmed",
        identityStatus: calfIdentityStatus ?? "confirmed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updatedAnimals = [...currentAnimals, calfAnimal];
      await saveToStorage(STORAGE_KEYS.animals, updatedAnimals);

      const updatedCalvingWithCalf = updatedCalving.map((r) =>
        r.id === newRecord.id ? { ...r, calfId: calfAnimal.id } : r,
      );
      await saveToStorage(STORAGE_KEYS.calvingRecords, updatedCalvingWithCalf);

      const breedingCurrent = queryClient.getQueryData<BreedingRecord[]>(["breedingRecords"]) ?? [];
      const updatedBreeding = breedingCurrent.map((r) =>
        r.animalId === record.motherId && (r.status === "bred" || r.status === "confirmed")
          ? { ...r, status: "delivered" as const }
          : r,
      );
      await saveToStorage(STORAGE_KEYS.breedingRecords, updatedBreeding);

      const mother = currentAnimals.find((a) => a.id === calvingData.motherId);
      await logActivity(
        `Logged calving: ${mother ? getAnimalDisplayName(mother) : "Unknown"} → calf ${calvingData.calfTagId}`,
        "calving",
        newRecord.id,
      );

      return { updatedCalving: updatedCalvingWithCalf, updatedAnimals, updatedBreeding, newCalf: calfAnimal };
    },
    onSuccess: ({ updatedCalving, updatedAnimals, updatedBreeding }) => {
      queryClient.setQueryData(["calvingRecords"], updatedCalving);
      queryClient.setQueryData(["animals"], updatedAnimals);
      queryClient.setQueryData(["breedingRecords"], updatedBreeding);
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
    const total = animals.length;
    const bySpecies = animals.reduce<Record<string, number>>((acc, a) => {
      acc[a.species] = (acc[a.species] || 0) + 1;
      return acc;
    }, {});
    const active = animals.filter((a) => a.status === "active").length;
    const forSale = animals.filter((a) => a.markedForSale).length;
    return { total, bySpecies, active, forSale };
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
    mutationFn: async (event: Omit<DoctoringEvent, "id" | "ranchId" | "createdAt" | "updatedAt">) => {
      if (!ranch.id) throw new Error("Cannot create doctoring event without an active ranch");
      const newEvent: DoctoringEvent = {
        ...event,
        id: generateId(),
        ranchId: ranch.id,
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

  const addRanchNoteMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!ranch.id) throw new Error("Cannot create note without an active ranch");
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

  return {
    ranch,
    activeRanchId: ranch.id,
    setRanchName: setRanchNameMutation.mutateAsync,
    isSettingRanchName: setRanchNameMutation.isPending,
    ranchNotes,
    addRanchNote: addRanchNoteMutation.mutateAsync,
    updateRanchNote: updateRanchNoteMutation.mutateAsync,
    deleteRanchNote: deleteRanchNoteMutation.mutateAsync,
    animals,
    activeAnimals,
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
    logCalving: logCalvingMutation.mutateAsync,
    createBusinessYear: createBusinessYearMutation.mutateAsync,
    setActiveBusinessYear: setActiveBusinessYearMutation.mutateAsync,
    sendMessage: sendMessageMutation.mutateAsync,
    getAnimalById,
    getWeightRecordsForAnimal,
    getHealthRecordsForAnimal,
    getBreedingRecordsForAnimal,
    isAddingAnimal: addAnimalMutation.isPending,
    isLoggingCalving: logCalvingMutation.isPending,
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
  };
});
