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

// ─── Calving ──────────────────────────────────────────────────────────────────

export interface CalvingList {
  id: string;
  ranchId: string;
  name: string;
  color: string;
  businessYearId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalvingRecord {
  id: string;
  calvingListId: string;
  businessYearId: string;
  birthMonth: number;
  birthDay: number;
  date: string;
  cowTag: string;
  calfTag: string;
  assisted: boolean;
  calfType?: "heifer" | "steer" | "bull";
  sireTag?: string;
  birthWeight?: number;
  birthWeightUnit?: "lbs" | "kg";
  notes?: string;
  photoUrl?: string;
  cowId?: string;
  calfId?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Processing ───────────────────────────────────────────────────────────────

/**
 * A user-defined group of animals for processing purposes.
 * Completely user-named — Yearling Heifers, 1st Calf Cows, Bulls, etc.
 * Reusable across events. Tied to a business year.
 */
export interface ProcessingGroup {
  id: string;
  ranchId: string;
  name: string;
  color: string;
  animalIds: string[];
  businessYearId: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Processing event types.
 * Treatment is excluded — that falls under Doctoring.
 */
export type ProcessingEventType =
  | "vaccination"
  | "preg_check"
  | "blood_test"
  | "custom";

/**
 * A work event applied to a processing group on a specific date.
 * Examples: Spring Preg Check, Fall Vaccination, Trich Testing
 */
export interface ProcessingEvent {
  id: string;
  ranchId: string;
  name: string;
  type: ProcessingEventType;
  customTypeName?: string;
  date: string;
  groupId: string;
  businessYearId: string;
  status: "not_started" | "in_progress" | "completed";
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One animal's individual result within a processing event.
 *
 * For Preg Check: result is "bred" or "open"
 * For all other types: result is "done" or "not_done"
 */
export type ProcessingResult =
  | "done"
  | "not_done"
  | "bred"
  | "open";

export interface ProcessingRecord {
  id: string;
  eventId: string;
  animalId: string;
  result: ProcessingResult;
  notes?: string;
  recordedBy?: string;
  recordedByName?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Business Year ────────────────────────────────────────────────────────────

export interface BusinessYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

// ─── Supporting types ─────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string;
  ranchId: string;
  userId: string;
  userName: string;
  action: string;
  entityType?: "animal" | "health" | "weight" | "processing" | "message" | "member" | "calving";
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

export type ListType = "vaccinations" | "to_be_sold" | "birthing" | "custom";

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
