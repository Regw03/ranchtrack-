/**
 * csvExport.ts
 *
 * Shared CSV-building and platform export helpers used by the herd, calving,
 * processing, and custom-list exporters.
 */

import { Platform } from "react-native";

export function cell(value: string | number | boolean | null | undefined): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n");
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
async function shareNative(csv: string, name: string, dialogTitle: string): Promise<void> {
  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");

  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(csv);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/csv",
      dialogTitle,
      UTI: "public.comma-separated-values-text",
    });
  }
}

/** Downloads (web) or shares (native) a CSV file, dispatching by platform. */
export async function exportCSV(csv: string, name: string, dialogTitle: string): Promise<void> {
  if (Platform.OS === "web") {
    downloadWeb(csv, name);
  } else {
    await shareNative(csv, name, dialogTitle);
  }
}
