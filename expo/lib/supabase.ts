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
): Promise<void> {
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
 updated_at: a.updatedAt,
 }));
 const { error } = await supabase.from("animals").upsert(rows, { onConflict: "id" });
 if (error) console.log("[sync] pushAnimalsBatch error", error.message);
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
