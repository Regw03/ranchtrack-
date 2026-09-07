/**
 * exportProcessing.ts
 *
 * Exports processing data to a CSV file.
 * Structure: Group → Event → per-animal Record, flattened to one row per animal per event.
 */

import { Animal, BusinessYear, ProcessingGroup, ProcessingEvent, ProcessingRecord } from "@/types";
import { buildCSV, exportCSV } from "@/utils/csvExport";

// ─── Processing CSV builder ───────────────────────────────────────────────────

/**
 * Flattens processing data into one row per animal per event.
 *
 * Event types: vaccination / preg_check / blood_test / custom
 * Results: done / not_done (all event types)
 *          bred / open (preg_check only)
 *
 * Animals with no recorded result still appear — Result column left blank.
 * Events with no animals in the group emit one blank row so the event is visible.
 *
 * Rows are sorted by: Group name → Event date (oldest first) → Animal tag ID
 */
export function buildProcessingCSV(
  groups: ProcessingGroup[],
  events: ProcessingEvent[],
  records: ProcessingRecord[],
  animals: Animal[],
  businessYears: BusinessYear[],
): string {
  const tagById = (id: string): string =>
    animals.find((a) => a.id === id)?.tagId ?? "";

  const nameById = (id: string): string =>
    animals.find((a) => a.id === id)?.name ?? "";

  const yearName = (id: string): string =>
    businessYears.find((y) => y.id === id)?.name ?? "";

  const headers = [
    "Group Name",
    "Business Year",
    "Event Name",
    "Event Type",
    "Custom Event Name",
    "Event Date",
    "Event Status",
    "Event Notes",
    "Animal Tag ID",
    "Animal Name",
    "Result",
    "Recorded By",
    "Animal Notes",
  ];

  const rows: (string | number | boolean | null | undefined)[][] = [];

  const sortedGroups = [...groups].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const group of sortedGroups) {
    const groupEvents = events
      .filter((e) => e.groupId === group.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const event of groupEvents) {
      const eventRecords = records.filter((r) => r.eventId === event.id);

      if (group.animalIds.length === 0) {
        rows.push([
          group.name,
          yearName(group.businessYearId),
          event.name,
          event.type,
          event.customTypeName ?? "",
          event.date,
          event.status,
          event.notes ?? "",
          "",
          "",
          "",
          "",
          "",
        ]);
        continue;
      }

      const sortedAnimalIds = [...group.animalIds].sort((a, b) =>
        tagById(a).localeCompare(tagById(b)),
      );

      for (const animalId of sortedAnimalIds) {
        const record = eventRecords.find((r) => r.animalId === animalId);
        rows.push([
          group.name,
          yearName(group.businessYearId),
          event.name,
          event.type,
          event.customTypeName ?? "",
          event.date,
          event.status,
          event.notes ?? "",
          tagById(animalId),
          nameById(animalId),
          record?.result ?? "",
          record?.recordedByName ?? "",
          record?.notes ?? "",
        ]);
      }
    }
  }

  return buildCSV(headers, rows);
}

// ─── Platform export ──────────────────────────────────────────────────────────

function filename(label?: string): string {
  const date = new Date().toISOString().split("T")[0];
  const slug = label
    ? `-${label.toLowerCase().replace(/\s+/g, "-")}`
    : "";
  return `ranchtrack-processing${slug}-${date}.csv`;
}

/**
 * Main export function.
 *
 * @param groups - from useProcessing().processingGroups
 * @param events - from useProcessing().processingEvents
 * @param records - from useProcessing().processingRecords
 * @param animals - from useRanch().animals
 * @param businessYears - from useRanch().businessYears
 * @param label - optional — used in the filename for single group/event exports
 */
export async function exportProcessing(
  groups: ProcessingGroup[],
  events: ProcessingEvent[],
  records: ProcessingRecord[],
  animals: Animal[],
  businessYears: BusinessYear[],
  label?: string,
): Promise<void> {
  const csv = buildProcessingCSV(groups, events, records, animals, businessYears);
  await exportCSV(csv, filename(label), "Export Processing Records");
}
