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

type UserRole = "owner" | "manager" | "member" | "worker" | null;
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
