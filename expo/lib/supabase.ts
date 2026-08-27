import { createClient } from "@supabase/supabase-js";
import type { Animal, BusinessYear } from "@/types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
 auth: {
   persistSession: true,
   autoRefreshToken: true,
   detectSessionInUrl: false,
 },
});

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function signUpWithEmail(email: string, password: string): Promise<string> {
 const { data, error } = await supabase.auth.signUp({ email, password });
 if (error) throw new Error(error.message);
 const userId = data.user?.id;
 if (!userId) throw new Error("Sign up succeeded but no user ID was returned.");
 return userId;
}

export async function signInWithEmail(email: string, password: string): Promise<string> {
 const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 if (error) throw new Error(error.message);
 const userId = data.user?.id;
 if (!userId) throw new Error("Sign in succeeded but no user ID was returned.");
 return userId;
}

export async function resendConfirmationEmail(email: string): Promise<void> {
 const { error } = await supabase.auth.resend({ type: "signup", email });
 if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
 const { error } = await supabase.auth.signOut();
 if (error) throw new Error(error.message);
}

export async function getCurrentAuthUserId(): Promise<string | null> {
 const { data } = await supabase.auth.getSession();
 return data.session?.user?.id ?? null;
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
 const { error } = await supabase.auth.resetPasswordForEmail(email);
 if (error) throw new Error(error.message);
}

// ─── Invite code ──────────────────────────────────────────────────────────────

export function generateInviteCode(): string {
 const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
 let code = "";
 for (let i = 0; i < 6; i += 1) {
   code += chars[Math.floor(Math.random() * chars.length)];
 }
 return code;
}

// ─── Remote row types ─────────────────────────────────────────────────────────

export interface RemoteRanchRow {
 id: string;
 name: string;
 invite_code: string;
 owner_id: string;
 created_at: string;
}

export interface RemoteRanchMemberRow {
 ranch_id: string;
 user_id: string;
 name: string;
 role: "owner" | "manager" | "member";
 joined_at: string;
}

export interface RemoteAnimalRow {
 id: string;
 ranch_id: string;
 tag: string;
 created_by: string | null;
 data: Animal;
 deleted: boolean;
 created_at: string;
 updated_at: string;
}

export interface RemoteBusinessYearRow {
 id: string;
 ranch_id: string;
 name: string;
 start_date: string;
 end_date: string;
 is_active: boolean;
 created_at: string;
 updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRemoteRanch(ranchId: string | undefined | null): ranchId is string {
 return !!ranchId && ranchId.length > 0;
}

export type UserRole = "owner" | "manager" | "member" | "worker" | null;
const canOverwrite = (role: UserRole) => role === "owner" || role === "manager";

// ─── Animal sync ──────────────────────────────────────────────────────────────

export async function pushAnimalToCloud(
 animal: Animal,
 createdBy: string | null,
): Promise<void> {
 if (!isRemoteRanch(animal.ranchId)) return;
 try {
   const { error } = await supabase.from("animals").upsert(
     {
       id: animal.id,
       ranch_id: animal.ranchId,
       tag: animal.tagId,
       created_by: createdBy,
       data: animal,
       deleted: false,
       created_at: animal.createdAt,
       updated_at: animal.updatedAt,
     },
     { onConflict: "id" },
   );
   if (error) console.log("[sync] pushAnimal error", error.message);
 } catch (e) {
   console.log("[sync] pushAnimal exception", e);
 }
}

export async function deleteAnimalInCloud(animalId: string, ranchId: string): Promise<void> {
 if (!isRemoteRanch(ranchId)) return;
 try {
   const { error } = await supabase
     .from("animals")
     .update({ deleted: true, updated_at: new Date().toISOString() })
     .eq("id", animalId);
   if (error) console.log("[sync] deleteAnimal error", error.message);
 } catch (e) {
   console.log("[sync] deleteAnimal exception", e);
 }
}

export interface AnimalSyncResult {
 remoteRows: RemoteAnimalRow[];
 error?: string;
}

export async function fetchRanchAnimals(ranchId: string): Promise<AnimalSyncResult> {
 if (!isRemoteRanch(ranchId)) return { remoteRows: [] };
 try {
   const { data, error } = await supabase
     .from("animals")
     .select("*")
     .eq("ranch_id", ranchId);
   if (error) {
     console.log("[sync] fetchAnimals error", error.message);
     return { remoteRows: [], error: error.message };
   }
   return { remoteRows: (data ?? []) as RemoteAnimalRow[] };
 } catch (e) {
   const msg = e instanceof Error ? e.message : "Unknown error";
   console.log("[sync] fetchAnimals exception", msg);
   return { remoteRows: [], error: msg };
 }
}

export async function pushAnimalsBatchToCloud(
 animals: Animal[],
 createdBy: string | null,
): Promise<{ id: string; updated_at: string }[] | null | undefined> {
 const remoteAnimals = animals.filter((a) => isRemoteRanch(a.ranchId));
 if (remoteAnimals.length === 0) return;
 try {
   const rows = remoteAnimals.map((a) => ({
     id: a.id,
     ranch_id: a.ranchId,
     tag: a.tagId,
     created_by: createdBy,
     data: a,
     deleted: false,
     created_at: a.createdAt,
     updated_at: new Date().toISOString(), // will be overwritten by server
   }));
   const { data: upserted, error } = await supabase
     .from("animals")
     .upsert(rows, { onConflict: "id" })
     .select("id, updated_at");
   if (error) {
     console.log("[sync] pushAnimalsBatch error", error.message);
   } else if (upserted) {
     // Return server timestamps so local records can be updated
     return upserted as { id: string; updated_at: string }[];
   }
   return null;
 } catch (e) {
   console.log("[sync] pushAnimalsBatch exception", e);
 }
}

// ─── Business Year sync ───────────────────────────────────────────────────────

/**
 * Push a single business year to Supabase.
 * Owner/Manager: upsert (last write wins).
 * Member/Hand: insert only — never overwrites existing.
 */
export async function pushBusinessYearToCloud(
 year: BusinessYear,
 ranchId: string,
 userRole: UserRole,
): Promise<void> {
 if (!isRemoteRanch(ranchId)) return;
 try {
   const row: RemoteBusinessYearRow = {
     id: year.id,
     ranch_id: ranchId,
     name: year.name,
     start_date: year.startDate,
     end_date: year.endDate,
     is_active: year.isActive,
     created_at: year.createdAt,
     updated_at: new Date().toISOString(),
   };

   if (canOverwrite(userRole)) {
     const { error } = await supabase
       .from("business_years")
       .upsert(row, { onConflict: "id" });
     if (error) console.log("[sync] pushBusinessYear upsert error", error.message);
   } else {
     // Member — insert only, ignore if already exists
     const { error } = await supabase.from("business_years").insert(row);
     if (error && error.code !== "23505") {
       console.log("[sync] pushBusinessYear insert error", error.message);
     }
   }
 } catch (e) {
   console.log("[sync] pushBusinessYear exception", e);
 }
}

/**
 * Push the active business year selection to Supabase.
 * Only owner/manager can change the active year.
 */
export async function pushActiveBusinessYearToCloud(
 activeYearId: string,
 ranchId: string,
 userRole: UserRole,
): Promise<void> {
 if (!isRemoteRanch(ranchId) || !canOverwrite(userRole)) return;
 try {
   const { error } = await supabase
     .from("ranch_active_year")
     .upsert(
       {
         ranch_id: ranchId,
         active_year_id: activeYearId,
         updated_at: new Date().toISOString(),
       },
       { onConflict: "ranch_id" },
     );
   if (error) console.log("[sync] pushActiveYear error", error.message);
 } catch (e) {
   console.log("[sync] pushActiveYear exception", e);
 }
}

export interface BusinessYearSyncResult {
 years: RemoteBusinessYearRow[];
 activeYearId: string | null;
 error?: string;
}

/**
 * Fetch all business years for a ranch from Supabase.
 * Called on app launch so new devices get the correct seasons.
 */
export async function fetchBusinessYears(
 ranchId: string,
): Promise<BusinessYearSyncResult> {
 if (!isRemoteRanch(ranchId)) return { years: [], activeYearId: null };
 try {
   const [yearsResult, activeResult] = await Promise.all([
     supabase
       .from("business_years")
       .select("*")
       .eq("ranch_id", ranchId)
       .order("created_at", { ascending: true }),
     supabase
       .from("ranch_active_year")
       .select("active_year_id")
       .eq("ranch_id", ranchId)
       .maybeSingle(),
   ]);

   if (yearsResult.error) {
     console.log("[sync] fetchBusinessYears error", yearsResult.error.message);
     return { years: [], activeYearId: null, error: yearsResult.error.message };
   }

   return {
     years: (yearsResult.data ?? []) as RemoteBusinessYearRow[],
     activeYearId: activeResult.data?.active_year_id ?? null,
   };
 } catch (e) {
   const msg = e instanceof Error ? e.message : "Unknown error";
   console.log("[sync] fetchBusinessYears exception", msg);
   return { years: [], activeYearId: null, error: msg };
 }
}

/**
 * Push all local business years to Supabase in one batch.
 * Used on first sync after sign-in on a new device.
 */
export async function pushBusinessYearsBatchToCloud(
 years: BusinessYear[],
 ranchId: string,
 userRole: UserRole,
): Promise<void> {
 if (!isRemoteRanch(ranchId) || years.length === 0) return;
 try {
   const rows = years.map((y) => ({
     id: y.id,
     ranch_id: ranchId,
     name: y.name,
     start_date: y.startDate,
     end_date: y.endDate,
     is_active: y.isActive,
     created_at: y.createdAt,
     updated_at: new Date().toISOString(),
   }));

   if (canOverwrite(userRole)) {
     const { error } = await supabase
       .from("business_years")
       .upsert(rows, { onConflict: "id" });
     if (error) console.log("[sync] pushBusinessYearsBatch error", error.message);
   } else {
     for (const row of rows) {
       const { error } = await supabase.from("business_years").insert(row);
       if (error && error.code !== "23505") {
         console.log("[sync] pushBusinessYearsBatch insert error", error.message);
       }
     }
   }
 } catch (e) {
   console.log("[sync] pushBusinessYearsBatch exception", e);
 }
}

// ─── Calving List sync ────────────────────────────────────────────────────────

export interface RemoteCalvingListRow {
 id: string;
 ranch_id: string;
 name: string;
 color: string;
 business_year_id: string;
 deleted: boolean;
 created_at: string;
 updated_at: string;
}

export interface RemoteCalvingRecordRow {
 id: string;
 ranch_id: string;
 calving_list_id: string;
 business_year_id: string;
 birth_month: number;
 birth_day: number;
 date: string;
 cow_tag: string;
 calf_tag: string;
 assisted: boolean;
 calf_type: string | null;
 sire_tag: string | null;
 birth_weight: number | null;
 birth_weight_unit: string | null;
 notes: string | null;
 photo_url: string | null;
 cow_id: string | null;
 calf_id: string | null;
 created_by: string | null;
 created_by_name: string | null;
 deleted: boolean;
 created_at: string;
 updated_at: string;
}

/** Push a single calving list to Supabase. */
export async function pushCalvingListToCloud(
 list: import("@/types").CalvingList,
 ranchId: string,
 userRole: UserRole,
): Promise<void> {
 if (!isRemoteRanch(ranchId)) return;
 try {
   const row: RemoteCalvingListRow = {
     id: list.id,
     ranch_id: ranchId,
     name: list.name,
     color: list.color,
     business_year_id: list.businessYearId,
     deleted: false,
     created_at: list.createdAt,
     updated_at: list.updatedAt,
   };
   if (canOverwrite(userRole)) {
     const { error } = await supabase.from("calving_lists").upsert(row, { onConflict: "id" });
     if (error) console.log("[sync] pushCalvingList upsert error", error.message);
   } else {
     const { error } = await supabase.from("calving_lists").insert(row);
     if (error && error.code !== "23505") console.log("[sync] pushCalvingList insert error", error.message);
   }
 } catch (e) { console.log("[sync] pushCalvingList exception", e); }
}

/** Soft-delete a calving list in Supabase (owner/manager only). */
export async function deleteCalvingListInCloud(
 listId: string,
 userRole: UserRole,
): Promise<void> {
 if (!canOverwrite(userRole)) return;
 try {
   const { error } = await supabase
     .from("calving_lists")
     .update({ deleted: true, updated_at: new Date().toISOString() })
     .eq("id", listId);
   if (error) console.log("[sync] deleteCalvingList error", error.message);
 } catch (e) { console.log("[sync] deleteCalvingList exception", e); }
}

/** Push a single calving record to Supabase. Merge strategy — all roles can push. */
export async function pushCalvingRecordToCloud(
 record: import("@/types").CalvingRecord,
 ranchId: string,
 userRole: UserRole,
): Promise<void> {
 if (!isRemoteRanch(ranchId)) return;
 try {
   const row: RemoteCalvingRecordRow = {
     id: record.id,
     ranch_id: ranchId,
     calving_list_id: record.calvingListId,
     business_year_id: record.businessYearId,
     birth_month: record.birthMonth,
     birth_day: record.birthDay,
     date: record.date,
     cow_tag: record.cowTag,
     calf_tag: record.calfTag,
     assisted: record.assisted,
     calf_type: record.calfType ?? null,
     sire_tag: record.sireTag ?? null,
     birth_weight: record.birthWeight ?? null,
     birth_weight_unit: record.birthWeightUnit ?? null,
     notes: record.notes ?? null,
     photo_url: record.photoUrl ?? null,
     cow_id: record.cowId ?? null,
     calf_id: record.calfId ?? null,
     created_by: record.createdBy ?? null,
     created_by_name: record.createdByName ?? null,
     deleted: false,
     created_at: record.createdAt,
     updated_at: record.updatedAt,
   };
   if (canOverwrite(userRole)) {
     // Owner/manager — last write wins
     const { error } = await supabase.from("calving_records").upsert(row, { onConflict: "id" });
     if (error) console.log("[sync] pushCalvingRecord upsert error", error.message);
   } else {
     // Member — insert new, update only if they created it
     const { data: existing } = await supabase
       .from("calving_records")
       .select("id, created_by")
       .eq("id", record.id)
       .maybeSingle();
     if (!existing) {
       const { error } = await supabase.from("calving_records").insert(row);
       if (error && error.code !== "23505") console.log("[sync] pushCalvingRecord insert error", error.message);
     } else if (existing.created_by === record.createdBy) {
       // Only update records they created
       const { error } = await supabase
         .from("calving_records")
         .update({ ...row })
         .eq("id", record.id);
       if (error) console.log("[sync] pushCalvingRecord update error", error.message);
     }
   }
 } catch (e) { console.log("[sync] pushCalvingRecord exception", e); }
}

/** Soft-delete a calving record in Supabase. */
export async function deleteCalvingRecordInCloud(recordId: string): Promise<void> {
 try {
   const { error } = await supabase
     .from("calving_records")
     .update({ deleted: true, updated_at: new Date().toISOString() })
     .eq("id", recordId);
   if (error) console.log("[sync] deleteCalvingRecord error", error.message);
 } catch (e) { console.log("[sync] deleteCalvingRecord exception", e); }
}

export interface CalvingListSyncResult {
 lists: RemoteCalvingListRow[];
 records: RemoteCalvingRecordRow[];
 error?: string;
}

/** Fetch all calving lists and records for a ranch from Supabase. */
export async function fetchCalvingData(ranchId: string): Promise<CalvingListSyncResult> {
 if (!isRemoteRanch(ranchId)) return { lists: [], records: [] };
 try {
   const [listsResult, recordsResult] = await Promise.all([
     supabase.from("calving_lists").select("*").eq("ranch_id", ranchId).eq("deleted", false),
     supabase.from("calving_records").select("*").eq("ranch_id", ranchId).eq("deleted", false),
   ]);
   if (listsResult.error) {
     console.log("[sync] fetchCalvingData lists error", listsResult.error.message);
     return { lists: [], records: [], error: listsResult.error.message };
   }
   return {
     lists: (listsResult.data ?? []) as RemoteCalvingListRow[],
     records: (recordsResult.data ?? []) as RemoteCalvingRecordRow[],
   };
 } catch (e) {
   const msg = e instanceof Error ? e.message : "Unknown error";
   console.log("[sync] fetchCalvingData exception", msg);
   return { lists: [], records: [], error: msg };
 }
}

// ─── Doctoring Events sync ────────────────────────────────────────────────────

export interface RemoteDoctoringEventRow {
 id: string;
 ranch_id: string;
 animal_id: string;
 date: string;
 type: string;
 custom_type_name: string | null;
 notes: string;
 treatment: string | null;
 follow_up_needed: boolean;
 resolved: boolean;
 created_by: string | null;
 created_by_name: string | null;
 deleted: boolean;
 created_at: string;
 updated_at: string;
}

/**
 * Push a single doctoring event to Supabase.
 * Owner/Manager: last write wins.
 * Member: insert new records only, update only their own.
 */
export async function pushDoctoringEventToCloud(
 event: import("@/types").DoctoringEvent,
 userRole: UserRole,
): Promise<void> {
 if (!isRemoteRanch(event.ranchId)) return;
 try {
   const row: RemoteDoctoringEventRow = {
     id: event.id,
     ranch_id: event.ranchId,
     animal_id: event.animalId,
     date: event.date,
     type: event.type,
     custom_type_name: event.customTypeName ?? null,
     notes: event.notes,
     treatment: event.treatment ?? null,
     follow_up_needed: event.followUpNeeded,
     resolved: event.resolved,
     created_by: event.createdBy ?? null,
     created_by_name: event.createdByName ?? null,
     deleted: false,
     created_at: event.createdAt,
     updated_at: event.updatedAt,
   };

   if (canOverwrite(userRole)) {
     const { error } = await supabase
       .from("doctoring_events")
       .upsert(row, { onConflict: "id" });
     if (error) console.log("[sync] pushDoctoringEvent upsert error", error.message);
   } else {
     // Member — insert new, or update only if they created it
     const { data: existing } = await supabase
       .from("doctoring_events")
       .select("id, created_by")
       .eq("id", event.id)
       .maybeSingle();
     if (!existing) {
       const { error } = await supabase.from("doctoring_events").insert(row);
       if (error && error.code !== "23505")
         console.log("[sync] pushDoctoringEvent insert error", error.message);
     } else if (existing.created_by === event.createdBy) {
       const { error } = await supabase
         .from("doctoring_events")
         .update(row)
         .eq("id", event.id);
       if (error) console.log("[sync] pushDoctoringEvent update error", error.message);
     }
   }
 } catch (e) {
   console.log("[sync] pushDoctoringEvent exception", e);
 }
}

/** Soft-delete a doctoring event in Supabase. */
export async function deleteDoctoringEventInCloud(eventId: string): Promise<void> {
 try {
   const { error } = await supabase
     .from("doctoring_events")
     .update({ deleted: true, updated_at: new Date().toISOString() })
     .eq("id", eventId);
   if (error) console.log("[sync] deleteDoctoringEvent error", error.message);
 } catch (e) {
   console.log("[sync] deleteDoctoringEvent exception", e);
 }
}

export interface DoctoringEventSyncResult {
 events: RemoteDoctoringEventRow[];
 error?: string;
}

/** Fetch all doctoring events for a ranch from Supabase. */
export async function fetchDoctoringEvents(
 ranchId: string,
): Promise<DoctoringEventSyncResult> {
 if (!isRemoteRanch(ranchId)) return { events: [] };
 try {
   const { data, error } = await supabase
     .from("doctoring_events")
     .select("*")
     .eq("ranch_id", ranchId)
     .eq("deleted", false);
   if (error) {
     console.log("[sync] fetchDoctoringEvents error", error.message);
     return { events: [], error: error.message };
   }
   return { events: (data ?? []) as RemoteDoctoringEventRow[] };
 } catch (e) {
   const msg = e instanceof Error ? e.message : "Unknown error";
   console.log("[sync] fetchDoctoringEvents exception", msg);
   return { events: [], error: msg };
 }
}

// ─── Breeding sync ────────────────────────────────────────────────────────────

export interface RemoteBreedingRecordRow {
 id: string;
 ranch_id: string;
 animal_id: string;
 sire_id: string | null;
 last_bred_date: string;
 expected_due_date: string;
 status: string;
 business_year_id: string | null;
 notes: string;
 deleted: boolean;
 created_at: string;
 updated_at: string;
}

export interface RemoteBreedingGroupRow {
 id: string;
 ranch_id: string;
 name: string;
 color: string;
 animal_ids: string[];
 business_year_id: string;
 deleted: boolean;
 created_at: string;
 updated_at: string;
}

/** Push a single breeding record. Owner/manager: upsert. Member: insert or update own. */
export async function pushBreedingRecordToCloud(
 record: { id: string; animalId: string; sireId?: string; lastBredDate: string; expectedDueDate: string; status: string; businessYearId?: string; notes: string },
 ranchId: string,
 userRole: UserRole,
): Promise<void> {
 if (!isRemoteRanch(ranchId)) return;
 try {
   const row: RemoteBreedingRecordRow = {
     id: record.id,
     ranch_id: ranchId,
     animal_id: record.animalId,
     sire_id: record.sireId ?? null,
     last_bred_date: record.lastBredDate,
     expected_due_date: record.expectedDueDate,
     status: record.status,
     business_year_id: record.businessYearId ?? null,
     notes: record.notes,
     deleted: false,
     created_at: new Date().toISOString(),
     updated_at: new Date().toISOString(),
   };
   if (canOverwrite(userRole)) {
     const { error } = await supabase.from("breeding_records").upsert(row, { onConflict: "id" });
     if (error) console.log("[sync] pushBreedingRecord error", error.message);
   } else {
     const { error } = await supabase.from("breeding_records").insert(row);
     if (error && error.code !== "23505") console.log("[sync] pushBreedingRecord insert error", error.message);
   }
 } catch (e) { console.log("[sync] pushBreedingRecord exception", e); }
}

/** Soft-delete a breeding record. */
export async function deleteBreedingRecordInCloud(recordId: string): Promise<void> {
 try {
   const { error } = await supabase
     .from("breeding_records")
     .update({ deleted: true, updated_at: new Date().toISOString() })
     .eq("id", recordId);
   if (error) console.log("[sync] deleteBreedingRecord error", error.message);
 } catch (e) { console.log("[sync] deleteBreedingRecord exception", e); }
}

/** Push a single breeding group. Owner/manager: upsert. Member: insert only. */
export async function pushBreedingGroupToCloud(
 group: { id: string; ranchId: string; name: string; color: string; animalIds: string[]; businessYearId: string; createdAt: string; updatedAt: string },
 userRole: UserRole,
): Promise<void> {
 if (!isRemoteRanch(group.ranchId)) return;
 try {
   const row: RemoteBreedingGroupRow = {
     id: group.id,
     ranch_id: group.ranchId,
     name: group.name,
     color: group.color,
     animal_ids: group.animalIds,
     business_year_id: group.businessYearId,
     deleted: false,
     created_at: group.createdAt,
     updated_at: group.updatedAt,
   };
   if (canOverwrite(userRole)) {
     const { error } = await supabase.from("breeding_groups").upsert(row, { onConflict: "id" });
     if (error) console.log("[sync] pushBreedingGroup error", error.message);
   } else {
     const { error } = await supabase.from("breeding_groups").insert(row);
     if (error && error.code !== "23505") console.log("[sync] pushBreedingGroup insert error", error.message);
   }
 } catch (e) { console.log("[sync] pushBreedingGroup exception", e); }
}

/** Soft-delete a breeding group (owner/manager only). */
export async function deleteBreedingGroupInCloud(
 groupId: string,
 userRole: UserRole,
): Promise<void> {
 if (!canOverwrite(userRole)) return;
 try {
   const { error } = await supabase
     .from("breeding_groups")
     .update({ deleted: true, updated_at: new Date().toISOString() })
     .eq("id", groupId);
   if (error) console.log("[sync] deleteBreedingGroup error", error.message);
 } catch (e) { console.log("[sync] deleteBreedingGroup exception", e); }
}

export interface BreedingSyncResult {
 records: RemoteBreedingRecordRow[];
 groups: RemoteBreedingGroupRow[];
 error?: string;
}

/** Fetch all breeding records and groups for a ranch. */
export async function fetchBreedingData(ranchId: string): Promise<BreedingSyncResult> {
 if (!isRemoteRanch(ranchId)) return { records: [], groups: [] };
 try {
   const [recordsResult, groupsResult] = await Promise.all([
     supabase.from("breeding_records").select("*").eq("ranch_id", ranchId).eq("deleted", false),
     supabase.from("breeding_groups").select("*").eq("ranch_id", ranchId).eq("deleted", false),
   ]);
   if (recordsResult.error) {
     console.log("[sync] fetchBreedingData error", recordsResult.error.message);
     return { records: [], groups: [], error: recordsResult.error.message };
   }
   return {
     records: (recordsResult.data ?? []) as RemoteBreedingRecordRow[],
     groups: (groupsResult.data ?? []) as RemoteBreedingGroupRow[],
   };
 } catch (e) {
   const msg = e instanceof Error ? e.message : "Unknown error";
   console.log("[sync] fetchBreedingData exception", msg);
   return { records: [], groups: [], error: msg };
 }
}

// ─── Weight & Health Records sync ────────────────────────────────────────────

export interface RemoteWeightRecordRow {
 id: string;
 ranch_id: string;
 animal_id: string;
 date: string;
 weight: number;
 unit: string;
 deleted: boolean;
 created_at: string;
 updated_at: string;
}

export interface RemoteHealthRecordRow {
 id: string;
 ranch_id: string;
 animal_id: string;
 type: string;
 date: string;
 description: string;
 notes: string;
 administered_by: string | null;
 deleted: boolean;
 created_at: string;
 updated_at: string;
}

/** Push a weight record. All roles can add — merge strategy. */
export async function pushWeightRecordToCloud(
 record: import("@/types").WeightRecord,
 ranchId: string,
): Promise<void> {
 if (!isRemoteRanch(ranchId)) return;
 try {
   const row: RemoteWeightRecordRow = {
     id: record.id,
     ranch_id: ranchId,
     animal_id: record.animalId,
     date: record.date,
     weight: record.weight,
     unit: record.unit,
     deleted: false,
     created_at: new Date().toISOString(),
     updated_at: new Date().toISOString(),
   };
   const { error } = await supabase
     .from("weight_records")
     .upsert(row, { onConflict: "id" });
   if (error) console.log("[sync] pushWeightRecord error", error.message);
 } catch (e) { console.log("[sync] pushWeightRecord exception", e); }
}

/** Push a health record. All roles can add — merge strategy. */
export async function pushHealthRecordToCloud(
 record: import("@/types").HealthRecord,
 ranchId: string,
): Promise<void> {
 if (!isRemoteRanch(ranchId)) return;
 try {
   const row: RemoteHealthRecordRow = {
     id: record.id,
     ranch_id: ranchId,
     animal_id: record.animalId,
     type: record.type,
     date: record.date,
     description: record.description,
     notes: record.notes,
     administered_by: record.administeredBy ?? null,
     deleted: false,
     created_at: new Date().toISOString(),
     updated_at: new Date().toISOString(),
   };
   const { error } = await supabase
     .from("health_records")
     .upsert(row, { onConflict: "id" });
   if (error) console.log("[sync] pushHealthRecord error", error.message);
 } catch (e) { console.log("[sync] pushHealthRecord exception", e); }
}

export interface WeightHealthSyncResult {
 weightRecords: RemoteWeightRecordRow[];
 healthRecords: RemoteHealthRecordRow[];
 error?: string;
}

/** Fetch all weight and health records for a ranch. */
export async function fetchWeightHealthData(
 ranchId: string,
): Promise<WeightHealthSyncResult> {
 if (!isRemoteRanch(ranchId)) return { weightRecords: [], healthRecords: [] };
 try {
   const [weightResult, healthResult] = await Promise.all([
     supabase.from("weight_records").select("*").eq("ranch_id", ranchId).eq("deleted", false),
     supabase.from("health_records").select("*").eq("ranch_id", ranchId).eq("deleted", false),
   ]);
   if (weightResult.error) {
     console.log("[sync] fetchWeightHealth error", weightResult.error.message);
     return { weightRecords: [], healthRecords: [], error: weightResult.error.message };
   }
   return {
     weightRecords: (weightResult.data ?? []) as RemoteWeightRecordRow[],
     healthRecords: (healthResult.data ?? []) as RemoteHealthRecordRow[],
   };
 } catch (e) {
   const msg = e instanceof Error ? e.message : "Unknown error";
   console.log("[sync] fetchWeightHealth exception", msg);
   return { weightRecords: [], healthRecords: [], error: msg };
 }
}

// ─── Processing Sessions sync ─────────────────────────────────────────────────

export interface RemoteProcessingSessionRow {
 id: string;
 ranch_id: string;
 name: string;
 business_year_id: string;
 groups: unknown[];
 events: unknown[];
 notes: string;
 deleted: boolean;
 created_at: string;
 updated_at: string;
}

/**
 * Push a single processing session to Supabase.
 * Sessions store groups and events as JSON — whole session pushed on any change.
 * Owner/Manager: last write wins. Member: insert new, update own.
 */
export async function pushProcessingSessionToCloud(
 session: Record<string, any>,
 userRole: UserRole,
): Promise<void> {
 if (!isRemoteRanch(session.ranchId)) return;
 try {
   const row: RemoteProcessingSessionRow = {
     id: session.id,
     ranch_id: session.ranchId,
     name: session.name,
     business_year_id: session.businessYearId,
     groups: session.groups,
     events: session.events,
     notes: session.notes,
     deleted: false,
     created_at: session.createdAt,
     updated_at: session.updatedAt,
   };
   if (canOverwrite(userRole)) {
     const { error } = await supabase
       .from("processing_sessions")
       .upsert(row, { onConflict: "id" });
     if (error) console.log("[sync] pushProcessingSession upsert error", error.message);
   } else {
     // Member — insert new sessions, don't overwrite existing ones
     const { data: existing } = await supabase
       .from("processing_sessions")
       .select("id")
       .eq("id", session.id)
       .maybeSingle();
     if (!existing) {
       const { error } = await supabase.from("processing_sessions").insert(row);
       if (error && error.code !== "23505")
         console.log("[sync] pushProcessingSession insert error", error.message);
     } else {
       // Member can update — they work inside sessions logging events
       const { error } = await supabase
         .from("processing_sessions")
         .update({ groups: row.groups, events: row.events, updated_at: row.updated_at })
         .eq("id", session.id);
       if (error) console.log("[sync] pushProcessingSession update error", error.message);
     }
   }
 } catch (e) { console.log("[sync] pushProcessingSession exception", e); }
}

/** Soft-delete a processing session (owner/manager only). */
export async function deleteProcessingSessionInCloud(
 sessionId: string,
 userRole: UserRole,
): Promise<void> {
 if (!canOverwrite(userRole)) return;
 try {
   const { error } = await supabase
     .from("processing_sessions")
     .update({ deleted: true, updated_at: new Date().toISOString() })
     .eq("id", sessionId);
   if (error) console.log("[sync] deleteProcessingSession error", error.message);
 } catch (e) { console.log("[sync] deleteProcessingSession exception", e); }
}

export interface ProcessingSessionSyncResult {
 sessions: RemoteProcessingSessionRow[];
 error?: string;
}

/** Fetch all processing sessions for a ranch. */
export async function fetchProcessingSessions(
 ranchId: string,
): Promise<ProcessingSessionSyncResult> {
 if (!isRemoteRanch(ranchId)) return { sessions: [] };
 try {
   const { data, error } = await supabase
     .from("processing_sessions")
     .select("*")
     .eq("ranch_id", ranchId)
     .eq("deleted", false);
   if (error) {
     console.log("[sync] fetchProcessingSessions error", error.message);
     return { sessions: [], error: error.message };
   }
   return { sessions: (data ?? []) as RemoteProcessingSessionRow[] };
 } catch (e) {
   const msg = e instanceof Error ? e.message : "Unknown error";
   console.log("[sync] fetchProcessingSessions exception", msg);
   return { sessions: [], error: msg };
 }
}

// ─── Custom Lists sync ────────────────────────────────────────────────────────

export interface RemoteCustomListRow {
 id: string;
 ranch_id: string;
 name: string;
 color: string;
 icon: string;
 list_type: string;
 species: string | null;
 parent_id: string | null;
 animal_ids: string[];
 created_by: string;
 deleted: boolean;
 created_at: string;
 updated_at: string;
}

/**
 * Push a custom list to Supabase.
 * Owner/Manager: upsert (last write wins).
 * Member: insert new only — never overwrites.
 */
export async function pushCustomListToCloud(
 list: import("@/types").CustomList,
 userRole: UserRole,
): Promise<void> {
 if (!isRemoteRanch(list.ranchId)) return;
 try {
   const row: RemoteCustomListRow = {
     id: list.id,
     ranch_id: list.ranchId,
     name: list.name,
     color: list.color,
     icon: list.icon,
     list_type: list.listType,
     species: list.species ?? null,
     parent_id: list.parentId ?? null,
     animal_ids: list.animalIds,
     created_by: list.createdBy,
     deleted: false,
     created_at: list.createdAt,
     updated_at: list.updatedAt,
   };
   if (canOverwrite(userRole)) {
     const { error } = await supabase
       .from("custom_lists")
       .upsert(row, { onConflict: "id" });
     if (error) console.log("[sync] pushCustomList upsert error", error.message);
   } else {
     const { error } = await supabase.from("custom_lists").insert(row);
     if (error && error.code !== "23505")
       console.log("[sync] pushCustomList insert error", error.message);
   }
 } catch (e) { console.log("[sync] pushCustomList exception", e); }
}

/** Soft-delete a custom list (owner/manager only). */
export async function deleteCustomListInCloud(
 listId: string,
 userRole: UserRole,
): Promise<void> {
 if (!canOverwrite(userRole)) return;
 try {
   const { error } = await supabase
     .from("custom_lists")
     .update({ deleted: true, updated_at: new Date().toISOString() })
     .eq("id", listId);
   if (error) console.log("[sync] deleteCustomList error", error.message);
 } catch (e) { console.log("[sync] deleteCustomList exception", e); }
}

export interface CustomListSyncResult {
 lists: RemoteCustomListRow[];
 error?: string;
}

/** Fetch all custom lists for a ranch. */
export async function fetchCustomLists(ranchId: string): Promise<CustomListSyncResult> {
 if (!isRemoteRanch(ranchId)) return { lists: [] };
 try {
   const { data, error } = await supabase
     .from("custom_lists")
     .select("*")
     .eq("ranch_id", ranchId)
     .eq("deleted", false);
   if (error) {
     console.log("[sync] fetchCustomLists error", error.message);
     return { lists: [], error: error.message };
   }
   return { lists: (data ?? []) as RemoteCustomListRow[] };
 } catch (e) {
   const msg = e instanceof Error ? e.message : "Unknown error";
   console.log("[sync] fetchCustomLists exception", msg);
   return { lists: [], error: msg };
 }
}

// ─── Ranch Notes sync ─────────────────────────────────────────────────────────

export interface RemoteRanchNoteRow {
 id: string;
 ranch_id: string;
 text: string;
 created_by: string;
 deleted: boolean;
 created_at: string;
 updated_at: string;
}

/** Push a ranch note. All roles can add and edit notes. */
export async function pushRanchNoteToCloud(
 note: import("@/types").RanchNote,
 userRole: UserRole,
): Promise<void> {
 if (!isRemoteRanch(note.ranchId)) return;
 try {
   const row: RemoteRanchNoteRow = {
     id: note.id,
     ranch_id: note.ranchId,
     text: note.text,
     created_by: note.createdBy,
     deleted: false,
     created_at: note.createdAt,
     updated_at: note.updatedAt,
   };
   if (canOverwrite(userRole)) {
     const { error } = await supabase
       .from("ranch_notes")
       .upsert(row, { onConflict: "id" });
     if (error) console.log("[sync] pushRanchNote upsert error", error.message);
   } else {
     // Member — insert new, update own
     const { data: existing } = await supabase
       .from("ranch_notes")
       .select("id, created_by")
       .eq("id", note.id)
       .maybeSingle();
     if (!existing) {
       const { error } = await supabase.from("ranch_notes").insert(row);
       if (error && error.code !== "23505")
         console.log("[sync] pushRanchNote insert error", error.message);
     } else if (existing.created_by === note.createdBy) {
       const { error } = await supabase
         .from("ranch_notes")
         .update({ text: row.text, updated_at: row.updated_at })
         .eq("id", note.id);
       if (error) console.log("[sync] pushRanchNote update error", error.message);
     }
   }
 } catch (e) { console.log("[sync] pushRanchNote exception", e); }
}

/** Soft-delete a ranch note. */
export async function deleteRanchNoteInCloud(noteId: string): Promise<void> {
 try {
   const { error } = await supabase
     .from("ranch_notes")
     .update({ deleted: true, updated_at: new Date().toISOString() })
     .eq("id", noteId);
   if (error) console.log("[sync] deleteRanchNote error", error.message);
 } catch (e) { console.log("[sync] deleteRanchNote exception", e); }
}

export interface RanchNoteSyncResult {
 notes: RemoteRanchNoteRow[];
 error?: string;
}

/** Fetch all ranch notes for a ranch. */
export async function fetchRanchNotes(ranchId: string): Promise<RanchNoteSyncResult> {
 if (!isRemoteRanch(ranchId)) return { notes: [] };
 try {
   const { data, error } = await supabase
     .from("ranch_notes")
     .select("*")
     .eq("ranch_id", ranchId)
     .eq("deleted", false)
     .order("created_at", { ascending: false });
   if (error) {
     console.log("[sync] fetchRanchNotes error", error.message);
     return { notes: [], error: error.message };
   }
   return { notes: (data ?? []) as RemoteRanchNoteRow[] };
 } catch (e) {
   const msg = e instanceof Error ? e.message : "Unknown error";
   console.log("[sync] fetchRanchNotes exception", msg);
   return { notes: [], error: msg };
 }
}
// ─── Processing Sync ──────────────────────────────────────────────────────────

export async function pushProcessingGroupToCloud(
  group: import("@/types").ProcessingGroup,
): Promise<void> {
  if (!isRemoteRanch(group.ranchId)) return;
  try {
    const { error } = await supabase.from("processing_groups").upsert({
      id: group.id,
      ranch_id: group.ranchId,
      name: group.name,
      color: group.color,
      animal_ids: group.animalIds,
      business_year_id: group.businessYearId,
      created_by: group.createdBy ?? null,
      deleted: false,
      created_at: group.createdAt,
      updated_at: group.updatedAt,
    }, { onConflict: "id" });
    if (error) console.log("[sync] pushProcessingGroup error", error.message);
  } catch (e) { console.log("[sync] pushProcessingGroup exception", e); }
}

export async function pushProcessingEventToCloud(
  event: import("@/types").ProcessingEvent,
): Promise<void> {
  if (!isRemoteRanch(event.ranchId)) return;
  try {
    const { error } = await supabase.from("processing_events").upsert({
      id: event.id,
      ranch_id: event.ranchId,
      name: event.name,
      type: event.type,
      custom_type_name: event.customTypeName ?? null,
      date: event.date,
      group_id: event.groupId,
      business_year_id: event.businessYearId,
      status: event.status,
      notes: event.notes ?? null,
      created_by: event.createdBy ?? null,
      created_by_name: event.createdByName ?? null,
      deleted: false,
      created_at: event.createdAt,
      updated_at: event.updatedAt,
    }, { onConflict: "id" });
    if (error) console.log("[sync] pushProcessingEvent error", error.message);
  } catch (e) { console.log("[sync] pushProcessingEvent exception", e); }
}

export async function pushProcessingRecordToCloud(
  record: import("@/types").ProcessingRecord,
  eventRanchId: string,
): Promise<void> {
  if (!isRemoteRanch(eventRanchId)) return;
  try {
    const { error } = await supabase.from("processing_records").upsert({
      id: record.id,
      event_id: record.eventId,
      animal_id: record.animalId,
      result: record.result,
      notes: record.notes ?? null,
      recorded_by: record.recordedBy ?? null,
      recorded_by_name: record.recordedByName ?? null,
      deleted: false,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    }, { onConflict: "id" });
    if (error) console.log("[sync] pushProcessingRecord error", error.message);
  } catch (e) { console.log("[sync] pushProcessingRecord exception", e); }
}

export async function fetchProcessingData(ranchId: string): Promise<{
  groups: { id: string; name: string; color: string; animal_ids: string[]; business_year_id: string; created_by: string | null; created_at: string; updated_at: string }[];
  events: { id: string; ranch_id: string; name: string; type: string; custom_type_name: string | null; date: string; group_id: string; business_year_id: string; status: string; notes: string | null; created_by: string | null; created_by_name: string | null; created_at: string; updated_at: string }[];
  records: { id: string; event_id: string; animal_id: string; result: string; notes: string | null; recorded_by: string | null; recorded_by_name: string | null; created_at: string; updated_at: string }[];
}> {
  const [groupsRes, eventsRes, recordsRes] = await Promise.all([
    supabase.from("processing_groups").select("*").eq("ranch_id", ranchId).eq("deleted", false),
    supabase.from("processing_events").select("*").eq("ranch_id", ranchId).eq("deleted", false),
    supabase.from("processing_records").select("pr.*").from("processing_records as pr").join("processing_events as pe", "pr.event_id", "pe.id").eq("pe.ranch_id", ranchId).eq("pr.deleted", false),
  ]);
  return {
    groups: (groupsRes.data ?? []) as any[],
    events: (eventsRes.data ?? []) as any[],
    records: (recordsRes.data ?? []) as any[],
  };
}