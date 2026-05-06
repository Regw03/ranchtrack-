import { createClient } from "@supabase/supabase-js";
import type { Animal } from "@/types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// ─── Auth helpers ────────────────────────────────────────────────────────────

/** Sign up a new user with email + password. Returns the user's UUID. */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<string> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  const userId = data.user?.id;
  if (!userId) throw new Error("Sign up succeeded but no user ID was returned.");
  return userId;
}

/** Sign in a returning user with email + password. Returns the user's UUID. */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<string> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  const userId = data.user?.id;
  if (!userId) throw new Error("Sign in succeeded but no user ID was returned.");
  return userId;
}

/** Resend the email confirmation link to a user who has signed up but not yet confirmed. */
export async function resendConfirmationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });
  if (error) throw new Error(error.message);
}

/** Sign out the current user. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/** Returns the currently signed-in user's UUID, or null if not signed in. */
export async function getCurrentAuthUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ─── Invite code ─────────────────────────────────────────────────────────────

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── Remote row types ────────────────────────────────────────────────────────

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

// ─── Animal sync ─────────────────────────────────────────────────────────────

function isRemoteRanch(ranchId: string | undefined | null): ranchId is string {
  return !!ranchId && ranchId.length > 0;
}

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
    if (error) {
      console.log("[sync] pushAnimal error", error.message);
    }
  } catch (e) {
    console.log("[sync] pushAnimal exception", e);
  }
}

export async function deleteAnimalInCloud(
  animalId: string,
  ranchId: string,
): Promise<void> {
  if (!isRemoteRanch(ranchId)) return;
  try {
    const { error } = await supabase
      .from("animals")
      .update({ deleted: true, updated_at: new Date().toISOString() })
      .eq("id", animalId);
    if (error) {
      console.log("[sync] deleteAnimal error", error.message);
    }
  } catch (e) {
    console.log("[sync] deleteAnimal exception", e);
  }
}

export interface AnimalSyncResult {
  remoteRows: RemoteAnimalRow[];
  error?: string;
}

export async function fetchRanchAnimals(
  ranchId: string,
): Promise<AnimalSyncResult> {
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
    const { error } = await supabase
      .from("animals")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.log("[sync] pushAnimalsBatch error", error.message);
    }
  } catch (e) {
    console.log("[sync] pushAnimalsBatch exception", e);
  }
}
