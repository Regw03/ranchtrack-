import React, { createContext, useContext, useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRanch } from "@/providers/RanchProvider";
import {
  supabase,
  pushProcessingGroupToCloud,
  pushProcessingEventToCloud,
  pushProcessingRecordToCloud,
  deleteProcessingGroupInCloud,
  deleteProcessingEventInCloud,
  deleteProcessingRecordInCloud,
  fetchProcessingData,
  type RemoteProcessingGroupRow,
  type RemoteProcessingEventRow,
  type RemoteProcessingRecordRow,
} from "@/lib/supabase";
import {
 ProcessingGroup,
 ProcessingEvent,
 ProcessingRecord,
 ProcessingEventType,
 ProcessingResult,
} from "@/types";
import { generateId } from "@/utils/helpers";

// ─── Storage keys ─────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
 groups: "ranchtrack_processing_groups",
 events: "ranchtrack_processing_events",
 records: "ranchtrack_processing_records",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function load<T>(key: string, fallback: T): Promise<T> {
 try {
 const stored = await AsyncStorage.getItem(key);
 return stored ? (JSON.parse(stored) as T) : fallback;
 } catch {
 return fallback;
 }
}

async function save<T>(key: string, value: T): Promise<void> {
 await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface ProcessingContextValue {
 // Groups
 processingGroups: ProcessingGroup[];
 createProcessingGroup: (input: { name: string; color: string }) => Promise<ProcessingGroup>;
 updateProcessingGroup: (group: ProcessingGroup) => Promise<void>;
 deleteProcessingGroup: (groupId: string) => Promise<void>;
 addAnimalToGroup: (groupId: string, animalId: string) => Promise<void>;
 removeAnimalFromGroup: (groupId: string, animalId: string) => Promise<void>;
 getProcessingGroupById: (id: string) => ProcessingGroup | undefined;

 // Events
 processingEvents: ProcessingEvent[];
 createProcessingEvent: (input: {
 name: string;
 type: ProcessingEventType;
 customTypeName?: string;
 date: string;
 groupId: string;
 notes?: string;
 }) => Promise<ProcessingEvent>;
 updateProcessingEvent: (event: ProcessingEvent) => Promise<void>;
 deleteProcessingEvent: (eventId: string) => Promise<void>;
 getEventsForGroup: (groupId: string) => ProcessingEvent[];
 getProcessingEventById: (id: string) => ProcessingEvent | undefined;

 // Records (per-animal results)
 processingRecords: ProcessingRecord[];
 setProcessingRecord: (input: {
 eventId: string;
 animalId: string;
 result: ProcessingResult;
 notes?: string;
 }) => Promise<void>;
 getRecordsForEvent: (eventId: string) => ProcessingRecord[];
 getRecordForAnimal: (eventId: string, animalId: string) => ProcessingRecord | undefined;

 // Computed
 getEventProgress: (eventId: string, groupId: string) => {
 total: number;
 done: number;
 pct: number;
 };

 isLoading: boolean;

 // Cloud sync
 syncProcessing: () => Promise<void>;
 isSyncingProcessing: boolean;

 // Local data management
 resetProcessing: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ProcessingContext = createContext<ProcessingContextValue | null>(null);

export function useProcessing(): ProcessingContextValue {
 const ctx = useContext(ProcessingContext);
 if (!ctx) throw new Error("useProcessing must be used within ProcessingProvider");
 return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProcessingProvider({ children }: { children: React.ReactNode }) {
 const queryClient = useQueryClient();
 const { ranch, currentUserId, currentUserName, activeBusinessYearId, activeBusinessYear } = useRanch();
 const safeYearId = activeBusinessYearId ?? activeBusinessYear?.id ?? "";

 // ─── Queries ───────────────────────────────────────────────────────────────

 const groupsQuery = useQuery({
 queryKey: ["processingGroups"],
 queryFn: () => load<ProcessingGroup[]>(STORAGE_KEYS.groups, []),
 });

 const eventsQuery = useQuery({
 queryKey: ["processingEvents"],
 queryFn: () => load<ProcessingEvent[]>(STORAGE_KEYS.events, []),
 });

 const recordsQuery = useQuery({
 queryKey: ["processingRecords"],
 queryFn: () => load<ProcessingRecord[]>(STORAGE_KEYS.records, []),
 });

 const allGroups = groupsQuery.data ?? [];
 const allEvents = eventsQuery.data ?? [];
 const allRecords = recordsQuery.data ?? [];

 // Filter to active business year
 const processingGroups = allGroups.filter(
 (g) => g.businessYearId === safeYearId,
 );
 const processingEvents = allEvents.filter(
 (e) => e.businessYearId === safeYearId,
 );
 const processingRecords = allRecords;

 // ─── Group mutations ───────────────────────────────────────────────────────

 const createGroupMutation = useMutation({
 mutationFn: async (input: { name: string; color: string }) => {
 const now = new Date().toISOString();
 const newGroup: ProcessingGroup = {
 id: generateId(),
 ranchId: ranch.id,
 name: input.name,
 color: input.color,
 animalIds: [],
 businessYearId: safeYearId,
 createdBy: currentUserId ?? undefined,
 createdAt: now,
 updatedAt: now,
 };
 const current = queryClient.getQueryData<ProcessingGroup[]>(["processingGroups"]) ?? [];
 const updated = [...current, newGroup];
 await save(STORAGE_KEYS.groups, updated);
 queryClient.setQueryData(["processingGroups"], updated);
 void pushProcessingGroupToCloud(newGroup);
 return newGroup;
 },
 });

 const updateGroupMutation = useMutation({
 mutationFn: async (group: ProcessingGroup) => {
 const current = queryClient.getQueryData<ProcessingGroup[]>(["processingGroups"]) ?? [];
 const updated = current.map((g) =>
 g.id === group.id ? { ...group, updatedAt: new Date().toISOString() } : g,
 );
 await save(STORAGE_KEYS.groups, updated);
 queryClient.setQueryData(["processingGroups"], updated);
 const updatedGroup = updated.find((g) => g.id === group.id);
 if (updatedGroup) void pushProcessingGroupToCloud(updatedGroup);
 },
 });

 const deleteGroupMutation = useMutation({
 mutationFn: async (groupId: string) => {
 const current = queryClient.getQueryData<ProcessingGroup[]>(["processingGroups"]) ?? [];
 const updated = current.filter((g) => g.id !== groupId);
 await save(STORAGE_KEYS.groups, updated);
 queryClient.setQueryData(["processingGroups"], updated);
 void deleteProcessingGroupInCloud(groupId);

 // Also remove all events for this group, and any records tied to those events
 const currentEvents = queryClient.getQueryData<ProcessingEvent[]>(["processingEvents"]) ?? [];
 const removedEvents = currentEvents.filter((e) => e.groupId === groupId);
 const updatedEvents = currentEvents.filter((e) => e.groupId !== groupId);
 await save(STORAGE_KEYS.events, updatedEvents);
 queryClient.setQueryData(["processingEvents"], updatedEvents);
 for (const e of removedEvents) void deleteProcessingEventInCloud(e.id);

 if (removedEvents.length > 0) {
 const removedEventIds = new Set(removedEvents.map((e) => e.id));
 const currentRecords = queryClient.getQueryData<ProcessingRecord[]>(["processingRecords"]) ?? [];
 const removedRecords = currentRecords.filter((r) => removedEventIds.has(r.eventId));
 const updatedRecords = currentRecords.filter((r) => !removedEventIds.has(r.eventId));
 await save(STORAGE_KEYS.records, updatedRecords);
 queryClient.setQueryData(["processingRecords"], updatedRecords);
 for (const r of removedRecords) void deleteProcessingRecordInCloud(r.id);
 }
 },
 });

 const addAnimalToGroupMutation = useMutation({
 mutationFn: async ({ groupId, animalId }: { groupId: string; animalId: string }) => {
 const current = queryClient.getQueryData<ProcessingGroup[]>(["processingGroups"]) ?? [];
 const updated = current.map((g) =>
 g.id === groupId && !g.animalIds.includes(animalId)
 ? { ...g, animalIds: [...g.animalIds, animalId], updatedAt: new Date().toISOString() }
 : g,
 );
 await save(STORAGE_KEYS.groups, updated);
 queryClient.setQueryData(["processingGroups"], updated);
 const updatedGroup = updated.find((g) => g.id === groupId);
 if (updatedGroup) void pushProcessingGroupToCloud(updatedGroup);
 },
 });

 const removeAnimalFromGroupMutation = useMutation({
 mutationFn: async ({ groupId, animalId }: { groupId: string; animalId: string }) => {
 const current = queryClient.getQueryData<ProcessingGroup[]>(["processingGroups"]) ?? [];
 const updated = current.map((g) =>
 g.id === groupId
 ? { ...g, animalIds: g.animalIds.filter((id) => id !== animalId), updatedAt: new Date().toISOString() }
 : g,
 );
 await save(STORAGE_KEYS.groups, updated);
 queryClient.setQueryData(["processingGroups"], updated);
 const updatedGroup = updated.find((g) => g.id === groupId);
 if (updatedGroup) void pushProcessingGroupToCloud(updatedGroup);
 },
 });

 // ─── Event mutations ───────────────────────────────────────────────────────

 const createEventMutation = useMutation({
 mutationFn: async (input: {
 name: string;
 type: ProcessingEventType;
 customTypeName?: string;
 date: string;
 groupId: string;
 notes?: string;
 }) => {
 const now = new Date().toISOString();
 const newEvent: ProcessingEvent = {
 id: generateId(),
 ranchId: ranch.id,
 name: input.name,
 type: input.type,
 customTypeName: input.customTypeName,
 date: input.date,
 groupId: input.groupId,
 businessYearId: safeYearId,
 status: "not_started",
 notes: input.notes,
 createdBy: currentUserId ?? undefined,
 createdByName: currentUserName ?? undefined,
 createdAt: now,
 updatedAt: now,
 };
 const current = queryClient.getQueryData<ProcessingEvent[]>(["processingEvents"]) ?? [];
 const updated = [newEvent, ...current];
 await save(STORAGE_KEYS.events, updated);
 queryClient.setQueryData(["processingEvents"], updated);
 void pushProcessingEventToCloud(newEvent);
 return newEvent;
 },
 });

 const updateEventMutation = useMutation({
 mutationFn: async (event: ProcessingEvent) => {
 const current = queryClient.getQueryData<ProcessingEvent[]>(["processingEvents"]) ?? [];
 const updated = current.map((e) =>
 e.id === event.id ? { ...event, updatedAt: new Date().toISOString() } : e,
 );
 await save(STORAGE_KEYS.events, updated);
 queryClient.setQueryData(["processingEvents"], updated);
 const updatedEvent = updated.find((e) => e.id === event.id);
 if (updatedEvent) void pushProcessingEventToCloud(updatedEvent);
 },
 });

 const deleteEventMutation = useMutation({
 mutationFn: async (eventId: string) => {
 const current = queryClient.getQueryData<ProcessingEvent[]>(["processingEvents"]) ?? [];
 const updated = current.filter((e) => e.id !== eventId);
 await save(STORAGE_KEYS.events, updated);
 queryClient.setQueryData(["processingEvents"], updated);
 void deleteProcessingEventInCloud(eventId);

 // Remove all records for this event
 const currentRecords = queryClient.getQueryData<ProcessingRecord[]>(["processingRecords"]) ?? [];
 const removedRecords = currentRecords.filter((r) => r.eventId === eventId);
 const updatedRecords = currentRecords.filter((r) => r.eventId !== eventId);
 await save(STORAGE_KEYS.records, updatedRecords);
 queryClient.setQueryData(["processingRecords"], updatedRecords);
 for (const r of removedRecords) void deleteProcessingRecordInCloud(r.id);
 },
 });

 // ─── Record mutations (per-animal results) ─────────────────────────────────

 const setRecordMutation = useMutation({
 mutationFn: async (input: {
 eventId: string;
 animalId: string;
 result: ProcessingResult;
 notes?: string;
 }) => {
 const now = new Date().toISOString();
 const current = queryClient.getQueryData<ProcessingRecord[]>(["processingRecords"]) ?? [];
 const existing = current.find(
 (r) => r.eventId === input.eventId && r.animalId === input.animalId,
 );

 let updated: ProcessingRecord[];
 if (existing) {
 updated = current.map((r) =>
 r.eventId === input.eventId && r.animalId === input.animalId
 ? { ...r, result: input.result, notes: input.notes, updatedAt: now }
 : r,
 );
 } else {
 const newRecord: ProcessingRecord = {
 id: generateId(),
 eventId: input.eventId,
 animalId: input.animalId,
 result: input.result,
 notes: input.notes,
 recordedBy: currentUserId ?? undefined,
 recordedByName: currentUserName ?? undefined,
 createdAt: now,
 updatedAt: now,
 };
 updated = [...current, newRecord];
 }

 await save(STORAGE_KEYS.records, updated);
 queryClient.setQueryData(["processingRecords"], updated);

 const savedRecord = updated.find(
 (r) => r.eventId === input.eventId && r.animalId === input.animalId,
 );
 const events = queryClient.getQueryData<ProcessingEvent[]>(["processingEvents"]) ?? [];
 const event = events.find((e) => e.id === input.eventId);
 if (savedRecord && event) void pushProcessingRecordToCloud(savedRecord, event.ranchId);

 // Auto-update event status based on how many animals are recorded
 const eventRecords = updated.filter((r) => r.eventId === input.eventId);
 const group = (queryClient.getQueryData<ProcessingGroup[]>(["processingGroups"]) ?? [])
 .find((g) => event?.groupId === g.id);

 if (group) {
 const total = group.animalIds.length;
 const done = eventRecords.length;
 let newStatus: ProcessingEvent["status"] = "not_started";
 if (done > 0 && done < total) newStatus = "in_progress";
 if (done >= total && total > 0) newStatus = "completed";

 const currentEvents = queryClient.getQueryData<ProcessingEvent[]>(["processingEvents"]) ?? [];
 const updatedEvents = currentEvents.map((e) =>
 e.id === input.eventId ? { ...e, status: newStatus, updatedAt: now } : e,
 );
 await save(STORAGE_KEYS.events, updatedEvents);
 queryClient.setQueryData(["processingEvents"], updatedEvents);
 const updatedEvent = updatedEvents.find((e) => e.id === input.eventId);
 if (updatedEvent) void pushProcessingEventToCloud(updatedEvent);
 }
 },
 });

 const resetProcessingMutation = useMutation({
 mutationFn: async () => {
 await Promise.all(Object.values(STORAGE_KEYS).map((k) => AsyncStorage.removeItem(k)));
 },
 onSuccess: () => {
 queryClient.setQueryData(["processingGroups"], []);
 queryClient.setQueryData(["processingEvents"], []);
 queryClient.setQueryData(["processingRecords"], []);
 },
 });

 // ─── Cloud sync ─────────────────────────────────────────────────────────────

 const syncProcessingMutation = useMutation({
 mutationFn: async () => {
 if (!ranch.id) return;
 const { groups: remoteGroups, events: remoteEvents, records: remoteRecords, error } =
 await fetchProcessingData(ranch.id);

 if (error) {
 const localGroups = queryClient.getQueryData<ProcessingGroup[]>(["processingGroups"]) ?? [];
 const localEvents = queryClient.getQueryData<ProcessingEvent[]>(["processingEvents"]) ?? [];
 const localRecords = queryClient.getQueryData<ProcessingRecord[]>(["processingRecords"]) ?? [];
 for (const g of localGroups) void pushProcessingGroupToCloud(g);
 for (const e of localEvents) void pushProcessingEventToCloud(e);
 for (const r of localRecords) void pushProcessingRecordToCloud(r, ranch.id);
 return;
 }

 // ── Merge groups ─────────────────────────────────────────────────────
 const localGroups = queryClient.getQueryData<ProcessingGroup[]>(["processingGroups"]) ?? [];
 const localGroupById = new Map(localGroups.map((g) => [g.id, g]));
 const remoteSeenGroupIds = new Set<string>();
 let groupsAdded = 0;
 let groupsRemoved = 0;

 for (const row of remoteGroups as RemoteProcessingGroupRow[]) {
 remoteSeenGroupIds.add(row.id);
 if (row.deleted) {
 const existing = localGroupById.get(row.id);
 if (existing) {
 const localTs = new Date(existing.updatedAt).getTime();
 const remoteTs = new Date(row.updated_at).getTime();
 if (remoteTs >= localTs) {
 localGroupById.delete(row.id);
 groupsRemoved += 1;
 }
 }
 continue;
 }
 if (!localGroupById.has(row.id)) {
 localGroupById.set(row.id, {
 id: row.id,
 ranchId: row.ranch_id,
 name: row.name,
 color: row.color,
 animalIds: row.animal_ids,
 businessYearId: row.business_year_id,
 createdBy: row.created_by ?? undefined,
 createdAt: row.created_at,
 updatedAt: row.updated_at,
 });
 groupsAdded += 1;
 }
 }

 const mergedGroups = Array.from(localGroupById.values());
 if (groupsAdded > 0 || groupsRemoved > 0) {
 await save(STORAGE_KEYS.groups, mergedGroups);
 queryClient.setQueryData(["processingGroups"], mergedGroups);
 }
 const localOnlyGroups = mergedGroups.filter((g) => !remoteSeenGroupIds.has(g.id));
 for (const g of localOnlyGroups) void pushProcessingGroupToCloud(g);

 // ── Merge events ─────────────────────────────────────────────────────
 const localEvents = queryClient.getQueryData<ProcessingEvent[]>(["processingEvents"]) ?? [];
 const localEventById = new Map(localEvents.map((e) => [e.id, e]));
 const remoteSeenEventIds = new Set<string>();
 let eventsAdded = 0;
 let eventsRemoved = 0;

 for (const row of remoteEvents as RemoteProcessingEventRow[]) {
 remoteSeenEventIds.add(row.id);
 if (row.deleted) {
 const existing = localEventById.get(row.id);
 if (existing) {
 const localTs = new Date(existing.updatedAt).getTime();
 const remoteTs = new Date(row.updated_at).getTime();
 if (remoteTs >= localTs) {
 localEventById.delete(row.id);
 eventsRemoved += 1;
 }
 }
 continue;
 }
 if (!localEventById.has(row.id)) {
 localEventById.set(row.id, {
 id: row.id,
 ranchId: row.ranch_id,
 name: row.name,
 type: row.type as ProcessingEventType,
 customTypeName: row.custom_type_name ?? undefined,
 date: row.date,
 groupId: row.group_id,
 businessYearId: row.business_year_id,
 status: row.status as ProcessingEvent["status"],
 notes: row.notes ?? undefined,
 createdBy: row.created_by ?? undefined,
 createdByName: row.created_by_name ?? undefined,
 createdAt: row.created_at,
 updatedAt: row.updated_at,
 });
 eventsAdded += 1;
 }
 }

 const mergedEvents = Array.from(localEventById.values());
 if (eventsAdded > 0 || eventsRemoved > 0) {
 await save(STORAGE_KEYS.events, mergedEvents);
 queryClient.setQueryData(["processingEvents"], mergedEvents);
 }
 const localOnlyEvents = mergedEvents.filter((e) => !remoteSeenEventIds.has(e.id));
 for (const e of localOnlyEvents) void pushProcessingEventToCloud(e);

 // ── Merge records ────────────────────────────────────────────────────
 const localRecords = queryClient.getQueryData<ProcessingRecord[]>(["processingRecords"]) ?? [];
 const localRecordById = new Map(localRecords.map((r) => [r.id, r]));
 const remoteSeenRecordIds = new Set<string>();
 let recordsAdded = 0;
 let recordsRemoved = 0;

 for (const row of remoteRecords as RemoteProcessingRecordRow[]) {
 remoteSeenRecordIds.add(row.id);
 if (row.deleted) {
 const existing = localRecordById.get(row.id);
 if (existing) {
 const localTs = new Date(existing.updatedAt).getTime();
 const remoteTs = new Date(row.updated_at).getTime();
 if (remoteTs >= localTs) {
 localRecordById.delete(row.id);
 recordsRemoved += 1;
 }
 }
 continue;
 }
 if (!localRecordById.has(row.id)) {
 localRecordById.set(row.id, {
 id: row.id,
 eventId: row.event_id,
 animalId: row.animal_id,
 result: row.result as ProcessingResult,
 notes: row.notes ?? undefined,
 recordedBy: row.recorded_by ?? undefined,
 recordedByName: row.recorded_by_name ?? undefined,
 createdAt: row.created_at,
 updatedAt: row.updated_at,
 });
 recordsAdded += 1;
 }
 }

 const mergedRecords = Array.from(localRecordById.values());
 if (recordsAdded > 0 || recordsRemoved > 0) {
 await save(STORAGE_KEYS.records, mergedRecords);
 queryClient.setQueryData(["processingRecords"], mergedRecords);
 }
 const localOnlyRecords = mergedRecords.filter((r) => !remoteSeenRecordIds.has(r.id));
 for (const r of localOnlyRecords) void pushProcessingRecordToCloud(r, ranch.id);
 },
 onError: (e) => console.log("[syncProcessing] error", e),
 });

 const lastSyncedRanchIdRef = useRef<string>("");
 useEffect(() => {
 if (!ranch.id) return;
 if (lastSyncedRanchIdRef.current === ranch.id) return;
 lastSyncedRanchIdRef.current = ranch.id;
 syncProcessingMutation.mutate();

 const interval = setInterval(() => {
 if (ranch.id) syncProcessingMutation.mutate();
 }, 60000);
 return () => clearInterval(interval);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [ranch.id]);

 const appStateRef = useRef<string>(AppState.currentState);
 useEffect(() => {
 const subscription = AppState.addEventListener("change", (nextState) => {
 if (appStateRef.current.match(/inactive|background/) && nextState === "active" && ranch.id) {
 syncProcessingMutation.mutate();
 }
 appStateRef.current = nextState;
 });
 return () => subscription.remove();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [ranch.id]);

 // Supabase Realtime — instant sync when processing data changes on any device.
 // processing_records has no ranch_id column (it's scoped via its event), so
 // that subscription can't be filtered by ranch — the sync call it triggers
 // re-fetches scoped to ranch.id regardless, so this is just a harmless extra
 // wakeup when another ranch's processing data changes.
 useEffect(() => {
 if (!ranch.id) return;
 const channel = supabase
 .channel(`processing-${ranch.id}`)
 .on("postgres_changes", { event: "*", schema: "public", table: "processing_groups", filter: `ranch_id=eq.${ranch.id}` },
 () => { syncProcessingMutation.mutate(); }
 )
 .on("postgres_changes", { event: "*", schema: "public", table: "processing_events", filter: `ranch_id=eq.${ranch.id}` },
 () => { syncProcessingMutation.mutate(); }
 )
 .on("postgres_changes", { event: "*", schema: "public", table: "processing_records" },
 () => { syncProcessingMutation.mutate(); }
 )
 .subscribe();
 return () => { void supabase.removeChannel(channel); };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [ranch.id]);

 // ─── Lookups ───────────────────────────────────────────────────────────────

 const getProcessingGroupById = useCallback(
 (id: string) => allGroups.find((g) => g.id === id),
 [allGroups],
 );

 const getEventsForGroup = useCallback(
 (groupId: string) => processingEvents.filter((e) => e.groupId === groupId),
 [processingEvents],
 );

 const getProcessingEventById = useCallback(
 (id: string) => allEvents.find((e) => e.id === id),
 [allEvents],
 );

 const getRecordsForEvent = useCallback(
 (eventId: string) => allRecords.filter((r) => r.eventId === eventId),
 [allRecords],
 );

 const getRecordForAnimal = useCallback(
 (eventId: string, animalId: string) =>
 allRecords.find((r) => r.eventId === eventId && r.animalId === animalId),
 [allRecords],
 );

 const getEventProgress = useCallback(
 (eventId: string, groupId: string) => {
 const group = allGroups.find((g) => g.id === groupId);
 const total = group?.animalIds.length ?? 0;
 const done = allRecords.filter((r) => r.eventId === eventId).length;
 const pct = total > 0 ? Math.round((done / total) * 100) : 0;
 return { total, done, pct };
 },
 [allGroups, allRecords],
 );

 // ─── Context value ─────────────────────────────────────────────────────────

 const value: ProcessingContextValue = {
 processingGroups,
 createProcessingGroup: createGroupMutation.mutateAsync,
 updateProcessingGroup: updateGroupMutation.mutateAsync,
 deleteProcessingGroup: deleteGroupMutation.mutateAsync,
 addAnimalToGroup: (groupId, animalId) =>
 addAnimalToGroupMutation.mutateAsync({ groupId, animalId }),
 removeAnimalFromGroup: (groupId, animalId) =>
 removeAnimalFromGroupMutation.mutateAsync({ groupId, animalId }),
 getProcessingGroupById,

 processingEvents,
 createProcessingEvent: createEventMutation.mutateAsync,
 updateProcessingEvent: updateEventMutation.mutateAsync,
 deleteProcessingEvent: deleteEventMutation.mutateAsync,
 getEventsForGroup,
 getProcessingEventById,

 processingRecords,
 setProcessingRecord: setRecordMutation.mutateAsync,
 getRecordsForEvent,
 getRecordForAnimal,

 getEventProgress,

 isLoading:
 groupsQuery.isLoading || eventsQuery.isLoading || recordsQuery.isLoading,

 syncProcessing: async () => { await syncProcessingMutation.mutateAsync(); },
 isSyncingProcessing: syncProcessingMutation.isPending,

 resetProcessing: async () => { await resetProcessingMutation.mutateAsync(); },
 };

 return (
 <ProcessingContext.Provider value={value}>
 {children}
 </ProcessingContext.Provider>
 );
}
