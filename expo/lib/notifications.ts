import * as Notifications from "expo-notifications";
import type { Animal, BreedingRecord, DoctoringEvent } from "@/types";

interface ScheduleParams {
  breedingEnabled: boolean;
  doctoringEnabled: boolean;
  breedingRecords: BreedingRecord[];
  doctoringEvents: DoctoringEvent[];
  animals: Animal[];
}

/**
 * Schedules push notifications for breeding due dates and unresolved
 * doctoring follow-ups. Cancels all previously scheduled notifications
 * first to avoid duplicates.
 */
export async function scheduleAllNotifications(params: ScheduleParams): Promise<void> {
  const { breedingEnabled, doctoringEnabled, breedingRecords, doctoringEvents, animals } =
    params;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const scheduled: Notifications.NotificationRequestInput[] = [];
  const now = new Date();
  const animalById = new Map(animals.map((a) => [a.id, a]));

  if (breedingEnabled) {
    for (const record of breedingRecords) {
      if (
        record.status !== "bred" &&
        record.status !== "confirmed"
      )
        continue;
      if (!record.expectedDueDate) continue;

      const due = new Date(record.expectedDueDate);
      if (due <= now) continue;

      // Notify 7 days before due date
      const trigger = new Date(due);
      trigger.setDate(trigger.getDate() - 7);
      if (trigger <= now) continue;

      const animal = animalById.get(record.animalId);
      const tag = animal?.tagId ?? "Unknown";
      scheduled.push({
        content: {
          title: `Breeding Due: ${tag}`,
          body: `Expected due date ${due.toLocaleDateString([], { month: "short", day: "numeric" })} — one week away.`,
          data: { type: "breeding", animalId: record.animalId },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
      });
    }
  }

  if (doctoringEnabled) {
    for (const event of doctoringEvents) {
      if (!event.followUpNeeded || event.resolved) continue;

      // Notify 3 days after the event if still unresolved
      const eventDate = new Date(event.date);
      const trigger = new Date(eventDate);
      trigger.setDate(trigger.getDate() + 3);
      if (trigger <= now) continue;

      const animal = animalById.get(event.animalId);
      const tag = animal?.tagId ?? "Unknown";
      const typeLabel =
        event.type === "custom"
          ? event.customTypeName ?? "Custom"
          : event.type;
      scheduled.push({
        content: {
          title: `Follow-Up: ${tag}`,
          body: `${typeLabel} on ${eventDate.toLocaleDateString([], { month: "short", day: "numeric" })} needs follow-up.`,
          data: { type: "doctoring", animalId: event.animalId, eventId: event.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
      });
    }
  }

  for (const req of scheduled) {
    await Notifications.scheduleNotificationAsync(req);
  }

  console.log(
    `[notifications] scheduled ${scheduled.length} notifications (breeding: ${breedingEnabled}, doctoring: ${doctoringEnabled})`,
  );
}
