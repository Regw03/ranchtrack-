import { Animal, WeightRecord, HealthRecord, BreedingRecord, ActivityLogEntry, Message, Ranch } from "@/types";

export const MOCK_RANCH: Ranch = {
  id: "ranch-1",
  name: "My Ranch",
  ownerId: "user-1",
  members: [
    { userId: "user-1", name: "Owner", role: "owner", joinedAt: new Date().toISOString() },
  ],
  inviteCode: "",
  createdAt: new Date().toISOString(),
};

export const MOCK_ANIMALS: Animal[] = [];

export const MOCK_WEIGHT_RECORDS: WeightRecord[] = [];

export const MOCK_HEALTH_RECORDS: HealthRecord[] = [];

export const MOCK_BREEDING_RECORDS: BreedingRecord[] = [];

export const MOCK_ACTIVITY: ActivityLogEntry[] = [];

export const MOCK_MESSAGES: Message[] = [];

export const SPECIES_OPTIONS: { label: string; value: string }[] = [
  { label: "Cattle", value: "cattle" },
  { label: "Horse", value: "horse" },
];

export const SPECIES_ICONS: Record<string, string> = {
  cattle: "🐄",
  horse: "🐴",
};

export const GENDER_TITLES: Record<string, Record<string, string>> = {
  cattle: { male: "Bull", female: "Cow", steer: "Steer", heifer: "Heifer" },
  horse: { male: "Stallion", female: "Mare", gelding: "Gelding", filly: "Filly", colt: "Colt" },
};

export function getGenderTitle(species: string, sex: string): string {
  const titles = GENDER_TITLES[species] ?? GENDER_TITLES.cattle;
  return titles[sex] ?? sex;
}

export function getGenderOptions(species: string): { value: string; label: string; icon: string }[] {
  const base = [
    { value: "female", label: getGenderTitle(species, "female"), icon: "♀" },
    { value: "male", label: getGenderTitle(species, "male"), icon: "♂" },
  ];
  if (species === "cattle") {
    base.push(
      { value: "heifer", label: "Heifer", icon: "♀" },
      { value: "steer", label: "Steer", icon: "♂" },
    );
  }
  if (species === "horse") {
    base.push(
      { value: "gelding", label: "Gelding", icon: "♂" },
      { value: "filly", label: "Filly", icon: "♀" },
      { value: "colt", label: "Colt", icon: "♂" },
    );
  }
  return base;
}

export function getAnimalDisplayName(animal: { name?: string; tagId: string }): string {
  return animal.name?.trim() || animal.tagId;
}

export const BIRTHING_TITLES: Record<string, string> = {
  cattle: "Calving",
  horse: "Foaling",
};

export function getBirthingTitle(species: string): string {
  return BIRTHING_TITLES[species] ?? "Birthing";
}

export const LIST_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  vaccinations: { icon: "💉", color: "#2D7A9C" },
  breeding: { icon: "🤰", color: "#7B5EA7" },
  to_be_sold: { icon: "💰", color: "#C4622D" },
  birthing: { icon: "🐣", color: "#3D8B5E" },
};
