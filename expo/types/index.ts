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

export type IdentityStatus = "confirmed" | "estimated" | "unknown";
export type GenerationConfidence = "confirmed" | "estimated";

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
  generation?: number;
  generationConfidence?: GenerationConfidence;
  identityStatus?: IdentityStatus;
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

export interface BreedingRecord {
  id: string;
  animalId: string;
  sireId?: string;
  lastBredDate: string;
  expectedDueDate: string;
  status: "bred" | "confirmed" | "delivered" | "open";
  businessYearId?: string;
  notes: string;
}

// ─── Calving ──────────────────────────────────────────────────────────────────

/**
 * A calving list is simply a named container for calving events.
 * No cow pre-assignment — cows are entered at the time of logging.
 * Tied to a business year but viewable across years.
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
 * One calving event. Contains all information about a single cow/calf pair.
 * calfType replaces the old calfSex field with clearer ranch terminology.
 * All optional fields can be filled in later — nothing blocks saving.
 */
export interface CalvingRecord {
  id: string;
  // Which list this record belongs to
  calvingListId: string;
  // Business year for filtering
  businessYearId: string;
  // Core fields — required at log time
  date: string;
  cowTag: string; // typed manually — no lookup required
  calfTag: string; // typed manually
  calfType: "heifer" | "steer" | "bull";
  // Optional fields — can be added/edited at any time
  calfBreed?: string;
  birthWeight?: number;
  birthWeightUnit?: "lbs" | "kg";
  assisted?: boolean;
  cowNotes?: string; // notes specific to the cow during this event
  calfNotes?: string; // notes specific to the calf
  photoUrl?: string; // optional photo on the record profile
  // Links to actual animal records if they exist
  cowId?: string; // linked animal record for the cow (if found)
  calfId?: string; // linked animal record for the calf (auto-created)
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

export interface BreedingGroup {
  id: string;
  ranchId: string;
  name: string;
  color: string;
  animalIds: string[];
  businessYearId: string;
  createdAt: string;
  updatedAt: string;
}

export type HealthEventType = "vaccination" | "blood_test" | "treatment" | "inspection" | "custom";
export type HealthEventStatus = "upcoming" | "completed" | "overdue";

export type HealthEventTargetType = "herd" | "calving_group" | "breeding_group" | "custom_group";

export interface HealthEventTarget {
  type: HealthEventTargetType;
  id: string;
  name: string;
}

export interface HealthEvent {
  id: string;
  ranchId: string;
  templateId?: string;
  type: HealthEventType;
  customTypeName?: string;
  name: string;
  dueDate: string;
  completedDate?: string;
  status: HealthEventStatus;
  target: HealthEventTarget;
  exceptionAnimalIds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthEventTemplate {
  id: string;
  ranchId: string;
  name: string;
  type: HealthEventType;
  customTypeName?: string;
  suggestedIntervalDays?: number;
  notes: string;
  createdAt: string;
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

export type SessionGroupStatus = "not_started" | "in_progress" | "completed";

export interface SessionGroup {
  id: string;
  type: "calving_group" | "breeding_group" | "custom";
  groupId?: string;
  name: string;
  status: SessionGroupStatus;
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  type: HealthEventType;
  customTypeName?: string;
  name: string;
  groupId: string;
  completedDate: string;
  notes: string;
  createdAt: string;
}

export interface ProcessingSession {
  id: string;
  ranchId: string;
  name: string;
  businessYearId: string;
  groups: SessionGroup[];
  events: SessionEvent[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}
