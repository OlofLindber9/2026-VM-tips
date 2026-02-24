export function format(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function disciplineColor(discipline: string): string {
  const d = discipline.toLowerCase();
  if (d.includes("sprint")) return "badge-yellow";
  if (d.includes("relay")) return "badge-red";
  if (d.includes("skiathlon") || d.includes("pursuit")) return "badge-green";
  if (d.includes("mass start")) return "badge-purple";
  return "badge-blue"; // distance races (10km, 15km, 30km, etc.)
}

export function techniqueColor(technique: string): string {
  const t = technique.toLowerCase();
  if (t === "classic") return "badge-purple";
  if (t === "free") return "badge-green";
  return "badge-gray";
}

export function genderLabel(gender: string): string {
  return gender === "W" ? "Women" : "Men";
}

export function genderColor(gender: string): string {
  return gender === "W" ? "badge-rose" : "badge-teal";
}

/** FIS Cross-Country WC points per finishing position (1st–30th). */
const WC_POINTS_TABLE = [
  100, 80, 60, 50, 45, 40, 36, 32, 29, 26,
   24, 22, 20, 18, 16, 15, 14, 13, 12, 11,
   10,  9,  8,  7,  6,  5,  4,  3,  2,  1,
];

export function wcPoints(rank: number | null): number {
  if (!rank || rank < 1 || rank > 30) return 0;
  return WC_POINTS_TABLE[rank - 1];
}
