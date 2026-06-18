import React, { createContext, useContext, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRanch } from "@/providers/RanchProvider";
import {
 ProcessingGroup,
 ProcessingEvent,
 ProcessingRecord,
 ProcessingEventType,
 ProcessingResult,
} from "@/types";

// ─── Storage keys ─────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
 groups: "ranchtrack_processing_groups",
 events: "ranchtrack_processing_events",
 records: "ranchtrack_processing_records",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
 return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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
 },
 });

 const deleteGroupMutation = useMutation({
 mutationFn: async (groupId: string) => {
 const current = queryClient.getQueryData<ProcessingGroup[]>(["processingGroups"]) ?? [];
 const updated = current.filter((g) => g.id !== groupId);
 await save(STORAGE_KEYS.groups, updated);
 queryClient.setQueryData(["processingGroups"], updated);
 // Also remove all events for this group
 const currentEvents = queryClient.getQueryData<ProcessingEvent[]>(["processingEvents"]) ?? [];
 const updatedEvents = currentEvents.filter((e) => e.groupId !== groupId);
 await save(STORAGE_KEYS.events, updatedEvents);
 queryClient.setQueryData(["processingEvents"], updatedEvents);
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
 },
 });

 const deleteEventMutation = useMutation({
 mutationFn: async (eventId: string) => {
 const current = queryClient.getQueryData<ProcessingEvent[]>(["processingEvents"]) ?? [];
 const updated = current.filter((e) => e.id !== eventId);
 await save(STORAGE_KEYS.events, updated);
 queryClient.setQueryData(["processingEvents"], updated);
 // Remove all records for this event
 const currentRecords = queryClient.getQueryData<ProcessingRecord[]>(["processingRecords"]) ?? [];
 const updatedRecords = currentRecords.filter((r) => r.eventId !== eventId);
 await save(STORAGE_KEYS.records, updatedRecords);
 queryClient.setQueryData(["processingRecords"], updatedRecords);
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

 // Auto-update event status based on how many animals are recorded
 const eventRecords = updated.filter((r) => r.eventId === input.eventId);
 const group = (queryClient.getQueryData<ProcessingGroup[]>(["processingGroups"]) ?? [])
 .find((g) => {
 const events = queryClient.getQueryData<ProcessingEvent[]>(["processingEvents"]) ?? [];
 return events.find((e) => e.id === input.eventId)?.groupId === g.id;
 });

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
 }
 },
 });

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
 };

 return (
 <ProcessingContext.Provider value={value}>
 {children}
 </ProcessingContext.Provider>
 );
}
