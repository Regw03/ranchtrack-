export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function parseBirthDate(birthDate: string): Date {
  const trimmed = birthDate.trim();
  if (/^\d{4}$/.test(trimmed)) {
    return new Date(parseInt(trimmed, 10), 0, 1);
  }
  return new Date(trimmed);
}

export function isYearOnly(birthDate: string): boolean {
  return /^\d{4}$/.test(birthDate.trim());
}

export function getAnimalAge(birthDate: string): string {
  const birth = parseBirthDate(birthDate);
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  const years = Math.floor(diffMs / (365.25 * 86400000));
  const months = Math.floor((diffMs % (365.25 * 86400000)) / (30.44 * 86400000));

  if (isYearOnly(birthDate)) {
    return years > 0 ? `~${years}y` : "<1y";
  }

  if (years > 0) {
    return months > 0 ? `${years}y ${months}mo` : `${years}y`;
  }
  return `${months}mo`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAgeInMonths(birthDate: string): number {
  const birth = parseBirthDate(birthDate);
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  return Math.floor(diffMs / (30.44 * 86400000));
}

export type GenerationLabel = "calf" | "yearling" | "mature" | "foal";

const GENERATION_THRESHOLDS: Record<string, { young: { label: GenerationLabel; maxMonths: number }; yearling: { label: GenerationLabel; maxMonths: number }; mature: { label: GenerationLabel } }> = {
  cattle: { young: { label: "calf", maxMonths: 12 }, yearling: { label: "yearling", maxMonths: 24 }, mature: { label: "mature" } },
  horse: { young: { label: "foal", maxMonths: 12 }, yearling: { label: "yearling", maxMonths: 24 }, mature: { label: "mature" } },
};

export function getGenerationLabel(species: string, birthDate: string): GenerationLabel {
  const ageMonths = getAgeInMonths(birthDate);
  const thresholds = GENERATION_THRESHOLDS[species] ?? GENERATION_THRESHOLDS.cattle;
  if (ageMonths <= thresholds.young.maxMonths) return thresholds.young.label;
  if (ageMonths <= thresholds.yearling.maxMonths) return thresholds.yearling.label;
  return thresholds.mature.label;
}

export function getGenerationDisplayLabel(label: GenerationLabel): string {
  const map: Record<GenerationLabel, string> = {
    calf: "Calf",
    yearling: "Yearling",
    mature: "Mature",
    foal: "Foal",
  };
  return map[label] ?? label;
}
