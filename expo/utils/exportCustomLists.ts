/**
 * exportCustomLists.ts
 *
 * Exports custom lists (vaccinations / to_be_sold / birthing / custom) to a CSV file.
 * One row per animal per list. Sub-lists include the parent list name.
 */

import { CustomList, Animal } from "@/types";
import { buildCSV, exportCSV } from "@/utils/csvExport";

// ─── Custom lists CSV builder ─────────────────────────────────────────────────

/**
 * Converts custom lists into a CSV string.
 * One row per animal per list.
 * Sub-lists include the parent list name in the Parent List column.
 * Empty lists emit one row with blank animal fields so the list is visible in the export.
 *
 * List types: vaccinations / to_be_sold / birthing / custom
 */
export function buildCustomListsCSV(
  customLists: CustomList[],
  animals: Animal[],
): string {
  const parentName = (id?: string): string =>
    id ? (customLists.find((l) => l.id === id)?.name ?? "") : "";

  const headers = [
    "List Name",
    "List Type", // vaccinations / to_be_sold / birthing / custom
    "Parent List", // optional — name of parent list if this is a sub-list
    "Species Filter", // optional — cattle / horse if list is species-specific
    "Animal Tag ID",
    "Animal Name", // optional — blank if unnamed
    "Breed",
    "Sex",
    "Birth Date",
    "Status", // active / sold / deceased
    "Marked for Sale",
    "Notes", // optional
  ];

  const rows: (string | number | boolean | null | undefined)[][] = [];

  // Sort lists: parent lists first, then sub-lists; alphabetically within each
  const sortedLists = [...customLists].sort((a, b) => {
    if (!a.parentId && b.parentId) return -1;
    if (a.parentId && !b.parentId) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const list of sortedLists) {
    if (list.animalIds.length === 0) {
      // Empty list — emit one row so it appears in the export
      rows.push([
        list.name,
        list.listType,
        parentName(list.parentId),
        list.species ?? "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      continue;
    }

    for (const animalId of list.animalIds) {
      const animal = animals.find((a) => a.id === animalId);
      rows.push([
        list.name,
        list.listType,
        parentName(list.parentId),
        list.species ?? "",
        animal?.tagId ?? "",
        animal?.name ?? "",
        animal?.breed ?? "",
        animal?.sex ?? "",
        animal?.birthDate ?? "",
        animal?.status ?? "",
        animal?.markedForSale ? "Yes" : "No",
        animal?.notes ?? "",
      ]);
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
  return `ranchtrack-lists${slug}-${date}.csv`;
}

/**
 * Main export function.
 * Call this when the user taps the export button on a list screen.
 *
 * @param customLists - from useRanch().customLists
 *                      pre-filter before passing for subset exports:
 *                      single list: customLists.filter((l) => l.id === list.id)
 *                      by type: customLists.filter((l) => l.listType === "to_be_sold")
 * @param animals - from useRanch().animals
 * @param label - optional — used in the filename to identify the subset
 *                e.g. "Spring Vaccinations" → ranchtrack-lists-spring-vaccinations-2025-04-15.csv
 */
export async function exportCustomLists(
  customLists: CustomList[],
  animals: Animal[],
  label?: string,
): Promise<void> {
  const csv = buildCustomListsCSV(customLists, animals);
  await exportCSV(csv, filename(label), "Export Lists");
}
