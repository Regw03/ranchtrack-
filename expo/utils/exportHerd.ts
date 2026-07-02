/**
 * exportHerd.ts
 *
 * Exports the full animal herd to a CSV file.
 */

import { Platform } from "react-native";
import { Animal, BusinessYear } from "@/types";
import { getHerdGroup } from "@/providers/RanchProvider";

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

// ─── Herd CSV builder ─────────────────────────────────────────────────────────

/**
 * Converts the animal list into a CSV string.
 * Includes all animals: active, sold, and deceased.
 * Resolves mother/sire IDs to tag numbers where possible.
 */
export function buildHerdCSV(
  animals: Animal[],
  businessYears: BusinessYear[],
): string {
  const yearName = (id?: string): string =>
    businessYears.find((y) => y.id === id)?.name ?? "";

  // Resolve an animal ID to its tag number
  const tagById = (id?: string): string =>
    id ? (animals.find((a) => a.id === id)?.tagId ?? "") : "";

  const headers = [
    "Tag ID",
    "Name",
    "Species",
    "Breed",
    "Birth Date",
    "Sex",
    "Herd Group",
    "Status",
    "Marked for Sale",
    "Sale Note",
    "Mother Tag ID",
    "Sire Tag ID",
    "Business Year",
    "Notes",
  ];

  const rows = animals.map((a) => [
    a.tagId,
    a.name ?? "",
    a.species,
    a.breed,
    a.birthDate,
    a.sex,
    getHerdGroup(a),
    a.status,
    a.markedForSale ? "Yes" : "No",
    a.saleNote ?? "",
    tagById(a.motherId),
    tagById(a.sireId),
    yearName(a.businessYearId),
    a.notes,
  ]);

  return buildCSV(headers, rows);
}

// ─── Platform export ──────────────────────────────────────────────────────────

function filename(): string {
  const date = new Date().toISOString().split("T")[0];
  return `ranchtrack-herd-${date}.csv`;
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
      dialogTitle: "Export Herd List",
      UTI: "public.comma-separated-values-text",
    });
  }
}

/**
 * Main export function.
 * Call this when the user taps the export button on the herd screen.
 *
 * @param animals - from useRanch().animals (includes all statuses)
 * @param businessYears - from useRanch().businessYears
 */
export async function exportHerd(
  animals: Animal[],
  businessYears: BusinessYear[],
): Promise<void> {
  const csv = buildHerdCSV(animals, businessYears);
  const name = filename();

  if (Platform.OS === "web") {
    downloadWeb(csv, name);
  } else {
    await shareNative(csv, name);
  }
}
