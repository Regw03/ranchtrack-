export type UserRole = "owner" | "manager" | "worker" | "member";

export interface User {
  id: string;
  name: string;
  createdAt: string;
}

export interface RanchMember {
  userId: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  joinedAt: string;
}

export interface Ranch {
  id: string;
  name: string;
  ownerId: string;
  members: RanchMember[];
  inviteCode: string;
  createdAt: string;
}

export type Species = "cattle" | "horse";

export type HerdGroup = "cows" | "heifers" | "calves" | "bulls" | "steers" | "other";

export interface Animal {
  id: string;
  ranchId: string;
  tagId: string;
  name?: string;
  species: Species;
  breed: string;
  birthDate: string;
  sex: "male" | "female" | "steer" | "heifer";
  notes: string;
  photoUrl?: string;
  status: "active" | "sold" | "deceased";
  markedForSale: boolean;
  saleNote?: string;
  motherId?: string;
  sireId?: string;
  businessYearId?: string;
  mergedFromIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WeightRecord {
  id: string;
  animalId: string;
  date: string;
  weight: number;
  unit: "lbs" | "kg";
}

export type HealthRecordType = "vaccination" | "treatment" | "checkup" | "injury" | "other";

export interface HealthRecord {
  id: string;
  animalId: string;
  type: HealthRecordType;
  date: string;
  description: string;
  notes: string;
  administeredBy?: string;
}

// ─── Processing (unified breeding + work system) ────────────────────────────

export type ProcessingEventType = "vaccination" | "preg_check" | "blood_test" | "custom";

/**
 * Processing result for a single animal within an event.
 * Preg Check events use "bred" | "open". All other event types use "done" | "not_done".
 */
export type ProcessingResult = "bred" | "open" | "done" | "not_done";

/**
 * A user-defined group of specific animals (e.g. "Yearling Heifers", "1st Calf Cows").
 * Tied to a business year. Used as the target when creating a processing event.
 */
export interface ProcessingGroup {
  id: string;
  ranchId: string;
  name: string;
  color: string;
  animalIds: string[];
  businessYearId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A work event applied to a ProcessingGroup on a specific date.
 * Examples: Vaccination day, Preg Check, Blood Test, or a custom procedure.
 */
export interface ProcessingEvent {
  id: string;
  ranchId: string;
  processingGroupId: string;
  date: string;
  type: ProcessingEventType;
  customTypeName?: string;
  notes: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One animal's individual result within a ProcessingEvent.
 * For Preg Check events, result is "bred" or "open".
 * For all other event types, result is "done" or "not_done".
 */
export interface ProcessingRecord {
  id: string;
  processingEventId: string;
  animalId: string;
  result: ProcessingResult;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Calving ──────────────────────────────────────────────────────────────────

/**
 * A calving list is a named group for organizing calving events.
 * Completely optional naming — user names them however they want.
 * Tied to a business year. At least one list must exist before logging.
 */
export interface CalvingList {
  id: string;
  ranchId: string;
  name: string;
  color: string;
  businessYearId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One calving event — a cow/calf pair record.
 *
 * Required at log time:
 * cowTag, calfTag, birthMonth, birthDay, assisted
 *
 * Year is derived from the active business year — not entered by the user.
 * All other fields are optional and fully editable at any time.
 */
export interface CalvingRecord {
  id: string;
  calvingListId: string;
  businessYearId: string;

  // Date — only month and day entered by user
  // year is derived from business year and stored in full ISO date for sorting
  birthMonth: number; // 1–12
  birthDay: number; // 1–31
  date: string; // full ISO date built from month + day + business year

  // Required
  cowTag: string;
  calfTag: string;
  assisted: boolean;

  // Optional — all editable after the fact
  calfType?: "heifer" | "steer" | "bull";
  sireTag?: string;
  birthWeight?: number;
  birthWeightUnit?: "lbs" | "kg";
  notes?: string;
  photoUrl?: string; // hero image on pair profile

  // Auto-linked animal IDs when tags match existing animals
  cowId?: string;
  calfId?: string;

  // Attribution
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

// Keep the old CalvingGroup type temporarily so existing data doesn't break
// during migration. Will be fully removed in a future cleanup.
/** @deprecated Use CalvingList instead */
export interface CalvingGroup {
  id: string;
  ranchId: string;
  name: string;
  color: string;
  cowIds: string[];
  calfIds: string[];
  businessYearId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Everything else (unchanged) ─────────────────────────────────────────────

export interface BusinessYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  ranchId: string;
  userId: string;
  userName: string;
  action: string;
  entityType?: "animal" | "health" | "weight" | "breeding" | "message" | "member" | "calving";
  entityId?: string;
  timestamp: string;
}

export interface Message {
  id: string;
  ranchId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

export type ListType = "vaccinations" | "breeding" | "to_be_sold" | "birthing" | "custom";

export interface CustomList {
  id: string;
  ranchId: string;
  name: string;
  color: string;
  icon: string;
  listType: ListType;
  species?: Species;
  parentId?: string;
  animalIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type DoctoringEventType = "injury" | "illness" | "lameness" | "infection" | "custom";

export interface DoctoringEvent {
  id: string;
  ranchId: string;
  animalId: string;
  date: string;
  type: DoctoringEventType;
  customTypeName?: string;
  notes: string;
  treatment?: string;
  followUpNeeded: boolean;
  resolved: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RanchNote {
  id: string;
  ranchId: string;
  text: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}


