/**
 * exportCalving.ts
 *
 * Exports calving records to a CSV file.
 */

import { Platform } from "react-native";
import { CalvingRecord, CalvingList } from "@/types";

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

// ─── Calving CSV builder ──────────────────────────────────────────────────────

/**
 * Converts calving records into a CSV string.
 * Records are sorted oldest → newest by full birth date.
 * Optional fields always appear as columns — left blank if not recorded.
 */
export function buildCalvingCSV(
  records: CalvingRecord[],
  calvingLists: CalvingList[],
): string {
  const listName = (id: string): string =>
    calvingLists.find((l) => l.id === id)?.name ?? "";

  const headers = [
    "Calving List",
    "Cow Tag",
    "Calf Tag",
    "Birth Month",
    "Birth Day",
    "Full Birth Date",
    "Assisted",
    "Calf Type",
    "Sire Tag",
    "Birth Weight",
    "Birth Weight Unit",
    "Logged By",
    "Notes",
  ];

  const sorted = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const rows = sorted.map((r) => [
    listName(r.calvingListId),
    r.cowTag,
    r.calfTag,
    r.birthMonth,
    r.birthDay,
    r.date,
    r.assisted ? "Yes" : "No",
    r.calfType ?? "",
    r.sireTag ?? "",
    r.birthWeight != null ? String(r.birthWeight) : "",
    r.birthWeightUnit ?? "",
    r.createdByName ?? "",
    r.notes ?? "",
  ]);

  return buildCSV(headers, rows);
}

// ─── Platform export ──────────────────────────────────────────────────────────

function filename(listLabel?: string): string {
  const date = new Date().toISOString().split("T")[0];
  const slug = listLabel
    ? `-${listLabel.toLowerCase().replace(/\s+/g, "-")}`
    : "";
  return `ranchtrack-calving${slug}-${date}.csv`;
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
      dialogTitle: "Export Calving Records",
      UTI: "public.comma-separated-values-text",
    });
  }
}

/**
 * Main export function.
 * Call this when the user taps the export button on the calving screen.
 *
 * @param records - from useRanch().calvingRecords
 *                  pre-filter by calvingListId to export a single list
 * @param calvingLists - from useRanch().calvingLists (used to resolve list names)
 * @param listLabel - optional — used in the filename when exporting a single list
 *                    e.g. "Spring 2025" → ranchtrack-calving-spring-2025-2025-04-15.csv
 */
export async function exportCalving(
  records: CalvingRecord[],
  calvingLists: CalvingList[],
  listLabel?: string,
): Promise<void> {
  const csv = buildCalvingCSV(records, calvingLists);
  const name = filename(listLabel);

  if (Platform.OS === "web") {
    downloadWeb(csv, name);
  } else {
    await shareNative(csv, name);
  }
}
