/**
 * exportHerd.ts
 *
 * Exports the full animal herd to a CSV file.
 */

import { Animal, BusinessYear } from "@/types";
import { getHerdGroup } from "@/providers/RanchProvider";
import { buildCSV, exportCSV } from "@/utils/csvExport";

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
  await exportCSV(csv, filename(), "Export Herd List");
}
