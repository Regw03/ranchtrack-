import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  ProcessingSession,
  SessionGroup,
  SessionEvent,
  SessionGroupStatus,
  HealthEventType,
} from "@/types";

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
      const newSession: ProcessingSession = {
        id: generateId(),
        ranchId: "ranch-1",
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
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["processingSessions"], updated);
    },
  });

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
  };
});
