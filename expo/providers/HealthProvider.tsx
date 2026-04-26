import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  HealthEvent,
  HealthEventTemplate,
  HealthEventStatus,
  HealthEventType,
  HealthEventTarget,
} from "@/types";
import { useRanch } from "@/providers/RanchProvider";
import { requireRanch } from "@/utils/ranchGuard";

const STORAGE_KEYS = {
  healthEvents: "ranchtrack_health_events",
  healthEventTemplates: "ranchtrack_health_event_templates",
} as const;

async function loadFromStorage<T>(key: string, fallback: T): Promise<T> {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
    await AsyncStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  } catch (e) {
    console.log("Error loading from storage:", key, e);
    return fallback;
  }
}

async function saveToStorage<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.log("Error saving to storage:", key, e);
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function computeStatus(event: HealthEvent): HealthEventStatus {
  if (event.completedDate) return "completed";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(event.dueDate);
  due.setHours(0, 0, 0, 0);
  return due < now ? "overdue" : "upcoming";
}

export const HEALTH_EVENT_TYPE_CONFIG: Record<HealthEventType, { label: string; color: string; icon: string }> = {
  vaccination: { label: "Vaccination", color: "#3D8B5E", icon: "syringe" },
  blood_test: { label: "Blood Test", color: "#C44D3D", icon: "droplet" },
  treatment: { label: "Treatment", color: "#2D7A9C", icon: "pill" },
  inspection: { label: "Inspection", color: "#D4943A", icon: "clipboard" },
  custom: { label: "Custom", color: "#7B5EA7", icon: "tag" },
};

// eslint-disable-next-line rork/general-context-optimization
export const [HealthProvider, useHealth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { activeRanchId } = useRanch();

  const eventsQuery = useQuery({
    queryKey: ["healthEvents"],
    queryFn: () => loadFromStorage<HealthEvent[]>(STORAGE_KEYS.healthEvents, []),
  });

  const templatesQuery = useQuery({
    queryKey: ["healthEventTemplates"],
    queryFn: () => loadFromStorage<HealthEventTemplate[]>(STORAGE_KEYS.healthEventTemplates, []),
  });

  const rawEvents = eventsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const isLoading = eventsQuery.isLoading || templatesQuery.isLoading;

  const events = useMemo(() => {
    return rawEvents.map((e) => ({ ...e, status: computeStatus(e) }));
  }, [rawEvents]);

  const upcomingEvents = useMemo(
    () => events
      .filter((e) => e.status === "upcoming")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [events],
  );

  const completedEvents = useMemo(
    () => events
      .filter((e) => e.status === "completed")
      .sort((a, b) => new Date(b.completedDate ?? b.dueDate).getTime() - new Date(a.completedDate ?? a.dueDate).getTime()),
    [events],
  );

  const overdueEvents = useMemo(
    () => events
      .filter((e) => e.status === "overdue")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [events],
  );

  const createEventMutation = useMutation({
    mutationFn: async (event: Omit<HealthEvent, "id" | "ranchId" | "status" | "createdAt" | "updatedAt">) => {
      requireRanch(activeRanchId, "create health event");
      const newEvent: HealthEvent = {
        ...event,
        id: generateId(),
        ranchId: activeRanchId,
        status: "upcoming",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      newEvent.status = computeStatus(newEvent);
      const current = queryClient.getQueryData<HealthEvent[]>(["healthEvents"]) ?? [];
      const updated = [newEvent, ...current];
      await saveToStorage(STORAGE_KEYS.healthEvents, updated);
      console.log("Created health event:", newEvent.name);
      return { updated, newEvent };
    },
    onSuccess: ({ updated }) => {
      queryClient.setQueryData(["healthEvents"], updated);
    },
  });

  const completeEventMutation = useMutation({
    mutationFn: async ({ eventId, exceptionAnimalIds }: { eventId: string; exceptionAnimalIds?: string[] }) => {
      const current = queryClient.getQueryData<HealthEvent[]>(["healthEvents"]) ?? [];
      const updated = current.map((e) =>
        e.id === eventId
          ? {
              ...e,
              completedDate: new Date().toISOString().split("T")[0],
              status: "completed" as const,
              exceptionAnimalIds: exceptionAnimalIds ?? e.exceptionAnimalIds,
              updatedAt: new Date().toISOString(),
            }
          : e,
      );
      await saveToStorage(STORAGE_KEYS.healthEvents, updated);
      console.log("Completed health event:", eventId);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["healthEvents"], updated);
    },
  });

  const uncompleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const current = queryClient.getQueryData<HealthEvent[]>(["healthEvents"]) ?? [];
      const updated = current.map((e) => {
        if (e.id === eventId) {
          const withoutComplete = { ...e, completedDate: undefined, updatedAt: new Date().toISOString() };
          return { ...withoutComplete, status: computeStatus(withoutComplete) };
        }
        return e;
      });
      await saveToStorage(STORAGE_KEYS.healthEvents, updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["healthEvents"], updated);
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const current = queryClient.getQueryData<HealthEvent[]>(["healthEvents"]) ?? [];
      const updated = current.filter((e) => e.id !== eventId);
      await saveToStorage(STORAGE_KEYS.healthEvents, updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["healthEvents"], updated);
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (template: Omit<HealthEventTemplate, "id" | "ranchId" | "createdAt">) => {
      requireRanch(activeRanchId, "create health event template");
      const newTemplate: HealthEventTemplate = {
        ...template,
        id: generateId(),
        ranchId: activeRanchId,
        createdAt: new Date().toISOString(),
      };
      const current = queryClient.getQueryData<HealthEventTemplate[]>(["healthEventTemplates"]) ?? [];
      const updated = [...current, newTemplate];
      await saveToStorage(STORAGE_KEYS.healthEventTemplates, updated);
      console.log("Created health event template:", newTemplate.name);
      return { updated, newTemplate };
    },
    onSuccess: ({ updated }) => {
      queryClient.setQueryData(["healthEventTemplates"], updated);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const current = queryClient.getQueryData<HealthEventTemplate[]>(["healthEventTemplates"]) ?? [];
      const updated = current.filter((t) => t.id !== templateId);
      await saveToStorage(STORAGE_KEYS.healthEventTemplates, updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["healthEventTemplates"], updated);
    },
  });

  const getEventById = useCallback(
    (id: string) => events.find((e) => e.id === id),
    [events],
  );

  return {
    events,
    templates,
    isLoading,
    upcomingEvents,
    completedEvents,
    overdueEvents,
    createEvent: createEventMutation.mutateAsync,
    completeEvent: completeEventMutation.mutateAsync,
    uncompleteEvent: uncompleteEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
    createTemplate: createTemplateMutation.mutateAsync,
    deleteTemplate: deleteTemplateMutation.mutateAsync,
    getEventById,
    isCreating: createEventMutation.isPending,
  };
});
