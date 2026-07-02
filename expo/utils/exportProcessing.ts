/**
 * exportProcessing.ts
 *
 * Exports processing data to a CSV file.
 * Structure: Group → Event → per-animal Record, flattened to one row per animal per event.
 */

import { Platform } from "react-native";
import { Animal, BusinessYear, ProcessingGroup, ProcessingEvent, ProcessingRecord } from "@/types";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function cell(value: string | number | boolean | null | undefined): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}

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

/** Web: triggers a browser file download */
function downloadWeb(csv: string, name: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", name);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Native: writes to a temp file then opens the share sheet */
async function shareNative(csv: string, name: string): Promise<void> {
  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");

  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(csv);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/csv",
      dialogTitle: "Export Processing Records",
      UTI: "public.comma-separated-values-text",
    });
  }
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
  const name = filename(label);

  if (Platform.OS === "web") {
    downloadWeb(csv, name);
  } else {
    await shareNative(csv, name);
  }
}
