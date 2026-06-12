import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import {
  ProcessingSession,
  SessionGroup,
  SessionEvent,
  SessionGroupStatus,
  HealthEventType,
} from "@/types";
import { useRanch } from "@/providers/RanchProvider";
import { requireRanch } from "@/utils/ranchGuard";
import {
  pushProcessingSessionToCloud,
  deleteProcessingSessionInCloud,
  fetchProcessingSessions,
  type RemoteProcessingSessionRow,
} from "@/lib/supabase";
import { AppState } from "react-native";

const STORAGE_KEY = "ranchtrack_processing_sessions";

async function loadFromStorage<T>(key: string, fallback: T): Promise<T> {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
    await AsyncStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  } catch (e) {
    console.log("Error loading processing sessions:", e);
    return fallback;
  }
}

async function saveToStorage<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.log("Error saving processing sessions:", e);
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function computeSessionProgress(session: ProcessingSession): { completed: number; total: number; label: string } {
  const total = session.groups.length;
  if (total === 0) return { completed: 0, total: 0, label: "No groups" };
  const completed = session.groups.filter((g) => g.status === "completed").length;
  const inProgress = session.groups.filter((g) => g.status === "in_progress").length;
  if (completed === total) return { completed, total, label: "Completed" };
  if (inProgress > 0 || completed > 0) return { completed, total, label: "In Progress" };
  return { completed, total, label: "Not Started" };
}

// eslint-disable-next-line rork/general-context-optimization
export const [ProcessingSessionProvider, useProcessingSessions] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { activeRanchId, currentUserRole } = useRanch();

  const sessionsQuery = useQuery({
    queryKey: ["processingSessions"],
    queryFn: () => loadFromStorage<ProcessingSession[]>(STORAGE_KEY, []),
  });

  const sessions = sessionsQuery.data ?? [];
  const isLoading = sessionsQuery.isLoading;

  const getSessionsByYear = useCallback(
    (businessYearId: string) =>
      sessions.filter((s) => s.businessYearId === businessYearId),
    [sessions],
  );

  const getSessionById = useCallback(
    (id: string) => sessions.find((s) => s.id === id),
    [sessions],
  );

  const getSessionProgress = useCallback(
    (session: ProcessingSession) => computeSessionProgress(session),
    [],
  );

  const createSessionMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      businessYearId: string;
      groups: Omit<SessionGroup, "id">[];
      notes: string;
    }) => {
      requireRanch(activeRanchId, "create processing session");
      const newSession: ProcessingSession = {
        id: generateId(),
        ranchId: activeRanchId,
        name: data.name,
        businessYearId: data.businessYearId,
        groups: data.groups.map((g) => ({ ...g, id: generateId() })),
        events: [],
        notes: data.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const current = queryClient.getQueryData<ProcessingSession[]>(["processingSessions"]) ?? [];
      const updated = [newSession, ...current];
      await saveToStorage(STORAGE_KEY, updated);
      console.log("Created processing session:", newSession.name);
      void pushProcessingSessionToCloud(newSession, currentUserRole);
      return { updated, newSession };
    },
    onSuccess: ({ updated }) => {
      queryClient.setQueryData(["processingSessions"], updated);
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (session: ProcessingSession) => {
      const current = queryClient.getQueryData<ProcessingSession[]>(["processingSessions"]) ?? [];
      const updated = current.map((s) =>
        s.id === session.id ? { ...session, updatedAt: new Date().toISOString() } : s,
      );
      await saveToStorage(STORAGE_KEY, updated);
      const updatedSession = updated.find((s) => s.id === session.id);
      if (updatedSession) void pushProcessingSessionToCloud(updatedSession, currentUserRole);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["processingSessions"], updated);
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const current = queryClient.getQueryData<ProcessingSession[]>(["processingSessions"]) ?? [];
      const updated = current.filter((s) => s.id !== sessionId);
      await saveToStorage(STORAGE_KEY, updated);
      console.log("Deleted processing session:", sessionId);
      void deleteProcessingSessionInCloud(sessionId, currentUserRole);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["processingSessions"], updated);
    },
  });

  const addGroupToSessionMutation = useMutation({
    mutationFn: async ({ sessionId, group }: { sessionId: string; group: Omit<SessionGroup, "id"> }) => {
      const current = queryClient.getQueryData<ProcessingSession[]>(["processingSessions"]) ?? [];
      const updated = current.map((s) => {
        if (s.id === sessionId) {
          return {
            ...s,
            groups: [...s.groups, { ...group, id: generateId() }],
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
      await saveToStorage(STORAGE_KEY, updated);
      const pushed1 = updated.find((s) => s.id === sessionId);
      if (pushed1) void pushProcessingSessionToCloud(pushed1, currentUserRole);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["processingSessions"], updated);
    },
  });

  const updateGroupStatusMutation = useMutation({
    mutationFn: async ({ sessionId, groupId, status }: { sessionId: string; groupId: string; status: SessionGroupStatus }) => {
      const current = queryClient.getQueryData<ProcessingSession[]>(["processingSessions"]) ?? [];
      const updated = current.map((s) => {
        if (s.id === sessionId) {
          return {
            ...s,
            groups: s.groups.map((g) => (g.id === groupId ? { ...g, status } : g)),
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
      await saveToStorage(STORAGE_KEY, updated);
      const pushed2 = updated.find((s) => s.id === sessionId);
      if (pushed2) void pushProcessingSessionToCloud(pushed2, currentUserRole);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["processingSessions"], updated);
    },
  });

  const removeGroupFromSessionMutation = useMutation({
    mutationFn: async ({ sessionId, groupId }: { sessionId: string; groupId: string }) => {
      const current = queryClient.getQueryData<ProcessingSession[]>(["processingSessions"]) ?? [];
      const updated = current.map((s) => {
        if (s.id === sessionId) {
          return {
            ...s,
            groups: s.groups.filter((g) => g.id !== groupId),
            events: s.events.filter((e) => e.groupId !== groupId),
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
      await saveToStorage(STORAGE_KEY, updated);
      const pushed3 = updated.find((s) => s.id === sessionId);
      if (pushed3) void pushProcessingSessionToCloud(pushed3, currentUserRole);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["processingSessions"], updated);
    },
  });

  const logSessionEventMutation = useMutation({
    mutationFn: async (data: {
      sessionId: string;
      type: HealthEventType;
      customTypeName?: string;
      name: string;
      groupId: string;
      notes: string;
    }) => {
      const newEvent: SessionEvent = {
        id: generateId(),
        sessionId: data.sessionId,
        type: data.type,
        customTypeName: data.customTypeName,
        name: data.name,
        groupId: data.groupId,
        completedDate: new Date().toISOString().split("T")[0],
        notes: data.notes,
        createdAt: new Date().toISOString(),
      };
      const current = queryClient.getQueryData<ProcessingSession[]>(["processingSessions"]) ?? [];
      const updated = current.map((s) => {
        if (s.id === data.sessionId) {
          return {
            ...s,
            events: [newEvent, ...s.events],
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
      await saveToStorage(STORAGE_KEY, updated);
      console.log("Logged session event:", newEvent.name);
      const pushedSession = updated.find((s) => s.id === data.sessionId);
      if (pushedSession) void pushProcessingSessionToCloud(pushedSession, currentUserRole);
      return { updated, newEvent };
    },
    onSuccess: ({ updated }) => {
      queryClient.setQueryData(["processingSessions"], updated);
    },
  });

  const deleteSessionEventMutation = useMutation({
    mutationFn: async ({ sessionId, eventId }: { sessionId: string; eventId: string }) => {
      const current = queryClient.getQueryData<ProcessingSession[]>(["processingSessions"]) ?? [];
      const updated = current.map((s) => {
        if (s.id === sessionId) {
          return {
            ...s,
            events: s.events.filter((e) => e.id !== eventId),
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });
      await saveToStorage(STORAGE_KEY, updated);
      const pushed4 = updated.find((s) => s.id === sessionId);
      if (pushed4) void pushProcessingSessionToCloud(pushed4, currentUserRole);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["processingSessions"], updated);
    },
  });

  // ─── Sync mutation ────────────────────────────────────────────────────────
  const syncSessionsMutation = useMutation({
    mutationFn: async () => {
      if (!activeRanchId) return;
      const { sessions: remoteSessions, error } = await fetchProcessingSessions(activeRanchId);
      if (error) {
        // Push all local sessions up
        const local = queryClient.getQueryData<ProcessingSession[]>(["processingSessions"]) ?? [];
        for (const s of local) void pushProcessingSessionToCloud(s, currentUserRole);
        return;
      }
      const local = queryClient.getQueryData<ProcessingSession[]>(["processingSessions"]) ?? [];
      const localIds = new Set(local.map((s) => s.id));
      const remoteIds = new Set(remoteSessions.map((s: RemoteProcessingSessionRow) => s.id));

      // Add sessions from server not seen locally
      const newFromRemote: ProcessingSession[] = remoteSessions
        .filter((r: RemoteProcessingSessionRow) => !localIds.has(r.id))
        .map((r: RemoteProcessingSessionRow) => ({
          id: r.id,
          ranchId: activeRanchId,
          name: r.name,
          businessYearId: r.business_year_id,
          groups: r.groups,
          events: r.events,
          notes: r.notes,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));

      if (newFromRemote.length > 0) {
        const merged = [...local, ...newFromRemote].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        await saveToStorage(STORAGE_KEY, merged);
        queryClient.setQueryData(["processingSessions"], merged);
        console.log(`[syncSessions] added ${newFromRemote.length} sessions from server`);
      }

      // Push local-only sessions to server
      const localOnly = local.filter((s) => !remoteIds.has(s.id));
      for (const s of localOnly) void pushProcessingSessionToCloud(s, currentUserRole);
    },
    onError: (e) => console.log("[syncSessions] error", e),
  });

  const lastSyncedRanchIdRef = useRef<string>("");
  useEffect(() => {
    if (!activeRanchId) return;
    if (lastSyncedRanchIdRef.current === activeRanchId) return;
    lastSyncedRanchIdRef.current = activeRanchId;
    syncSessionsMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRanchId]);

  const appStateRef = useRef<string>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: string) => {
      const wasBackground =
        appStateRef.current === "background" || appStateRef.current === "inactive";
      const nowActive = nextState === "active";
      appStateRef.current = nextState;
      if (wasBackground && nowActive && activeRanchId) {
        syncSessionsMutation.mutate();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRanchId]);

  return {
    sessions,
    isLoading,
    getSessionsByYear,
    getSessionById,
    getSessionProgress,
    createSession: createSessionMutation.mutateAsync,
    updateSession: updateSessionMutation.mutateAsync,
    deleteSession: deleteSessionMutation.mutateAsync,
    addGroupToSession: addGroupToSessionMutation.mutateAsync,
    updateGroupStatus: updateGroupStatusMutation.mutateAsync,
    removeGroupFromSession: removeGroupFromSessionMutation.mutateAsync,
    logSessionEvent: logSessionEventMutation.mutateAsync,
    deleteSessionEvent: deleteSessionEventMutation.mutateAsync,
    isCreating: createSessionMutation.isPending,
    syncSessions: syncSessionsMutation.mutateAsync,
    isSyncingSessions: syncSessionsMutation.isPending,
  };
});
