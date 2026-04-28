import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { Animal } from "@/types";

const ONBOARDING_KEY = "ranchtrack_onboarding_complete";
const RANCH_CONFIG_KEY = "ranchtrack_ranch_config";

export interface RanchConfig {
  trackCalvingGroups: boolean;
  trackProcessing: boolean;
  trackDoctoring: boolean;
}

export interface ImportRecord {
  tagNumber: string;
  animalType: "cow" | "calf" | "bull" | "unknown";
  breed?: string;
  birthDate?: string;
  sex?: string;
  name?: string;
  notes?: string;
}

export interface ImportIssue {
  index: number;
  tagNumber: string;
  type: "duplicate" | "missing_tag" | "unknown_type";
  message: string;
}

const DEFAULT_CONFIG: RanchConfig = {
  trackCalvingGroups: true,
  trackProcessing: true,
  trackDoctoring: true,
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function detectAnimalType(value: string): ImportRecord["animalType"] {
  const v = value.toLowerCase().trim();
  if (["cow", "female", "f", "heifer"].includes(v)) return "cow";
  if (["calf", "baby", "newborn"].includes(v)) return "calf";
  if (["bull", "male", "m", "steer"].includes(v)) return "bull";
  return "unknown";
}

function detectSex(animalType: ImportRecord["animalType"], rawSex?: string): Animal["sex"] {
  if (rawSex) {
    const s = rawSex.toLowerCase().trim();
    if (["female", "f", "cow", "heifer"].includes(s)) return "female";
    if (["male", "m", "bull"].includes(s)) return "male";
    if (["steer", "s"].includes(s)) return "steer";
    if (["heifer", "h"].includes(s)) return "heifer";
  }
  switch (animalType) {
    case "cow": return "female";
    case "bull": return "male";
    default: return "female";
  }
}

export function parseCSV(content: string): { records: ImportRecord[]; issues: ImportIssue[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { records: [], issues: [] };

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

  const tagCol = headers.findIndex((h) =>
    ["tag", "tagnumber", "tagid", "tagno", "id", "eartag", "number"].includes(h),
  );
  const typeCol = headers.findIndex((h) =>
    ["type", "animaltype", "category", "class", "kind"].includes(h),
  );
  const breedCol = headers.findIndex((h) =>
    ["breed", "breeding", "breedtype"].includes(h),
  );
  const birthCol = headers.findIndex((h) =>
    ["birth", "birthdate", "dob", "dateofbirth", "born"].includes(h),
  );
  const sexCol = headers.findIndex((h) =>
    ["sex", "gender"].includes(h),
  );
  const nameCol = headers.findIndex((h) =>
    ["name", "animalname", "nickname"].includes(h),
  );
  const notesCol = headers.findIndex((h) =>
    ["notes", "note", "comments", "comment", "description"].includes(h),
  );

  const records: ImportRecord[] = [];
  const issues: ImportIssue[] = [];
  const seenTags = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.every((f) => f === "")) continue;

    const tagNumber = tagCol >= 0 ? fields[tagCol]?.trim() ?? "" : fields[0]?.trim() ?? "";

    if (!tagNumber) {
      issues.push({
        index: i - 1,
        tagNumber: "(empty)",
        type: "missing_tag",
        message: `Row ${i}: Missing tag number`,
      });
      continue;
    }

    const rawType = typeCol >= 0 ? fields[typeCol]?.trim() : "";
    const animalType = rawType ? detectAnimalType(rawType) : "unknown";

    if (animalType === "unknown" && rawType) {
      issues.push({
        index: records.length,
        tagNumber,
        type: "unknown_type",
        message: `Tag ${tagNumber}: Unknown animal type "${rawType}"`,
      });
    }

    if (seenTags.has(tagNumber.toLowerCase())) {
      issues.push({
        index: records.length,
        tagNumber,
        type: "duplicate",
        message: `Tag ${tagNumber}: Duplicate tag number in import`,
      });
    }
    seenTags.add(tagNumber.toLowerCase());

    records.push({
      tagNumber,
      animalType,
      breed: breedCol >= 0 ? fields[breedCol]?.trim() || undefined : undefined,
      birthDate: birthCol >= 0 ? fields[birthCol]?.trim() || undefined : undefined,
      sex: sexCol >= 0 ? fields[sexCol]?.trim() || undefined : undefined,
      name: nameCol >= 0 ? fields[nameCol]?.trim() || undefined : undefined,
      notes: notesCol >= 0 ? fields[notesCol]?.trim() || undefined : undefined,
    });
  }

  return { records, issues };
}

export function importRecordToAnimal(
  record: ImportRecord,
  ranchId: string,
  businessYearId: string,
): Omit<Animal, "id" | "ranchId" | "createdAt" | "updatedAt"> {
  const sex = detectSex(record.animalType, record.sex);
  return {
    tagId: record.tagNumber,
    name: record.name,
    species: "cattle",
    breed: record.breed || "Unknown",
    birthDate: record.birthDate || new Date().toISOString().split("T")[0],
    sex,
    notes: record.notes || "",
    status: "active",
    markedForSale: false,
    businessYearId,
    identityStatus: "unknown",
  };
}

export const [OnboardingProvider, useOnboarding] = createContextHook(() => {
  const queryClient = useQueryClient();

  const completedQuery = useQuery({
    queryKey: ["onboardingComplete"],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_KEY);
        return stored === "true";
      } catch {
        return false;
      }
    },
  });

  const configQuery = useQuery({
    queryKey: ["ranchConfig"],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(RANCH_CONFIG_KEY);
        if (stored) return JSON.parse(stored) as RanchConfig;
        return DEFAULT_CONFIG;
      } catch {
        return DEFAULT_CONFIG;
      }
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData(["onboardingComplete"], true);
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (config: RanchConfig) => {
      await AsyncStorage.setItem(RANCH_CONFIG_KEY, JSON.stringify(config));
      return config;
    },
    onSuccess: (config) => {
      queryClient.setQueryData(["ranchConfig"], config);
    },
  });

  const isOnboardingComplete = completedQuery.data === true;
  const isLoading = completedQuery.isLoading;
  const ranchConfig = configQuery.data ?? DEFAULT_CONFIG;

  const completeOnboarding = useCallback(async () => {
    await completeOnboardingMutation.mutateAsync();
  }, [completeOnboardingMutation]);

  const saveConfig = useCallback(
    (config: RanchConfig) => {
      saveConfigMutation.mutate(config);
    },
    [saveConfigMutation],
  );

  return useMemo(
    () => ({
      isOnboardingComplete,
      isLoading,
      ranchConfig,
      completeOnboarding,
      saveConfig,
    }),
    [isOnboardingComplete, isLoading, ranchConfig, completeOnboarding, saveConfig],
  );
});
