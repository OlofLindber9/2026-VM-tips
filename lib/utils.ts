export function format(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function disciplineColor(discipline: string): string {
  const d = discipline.toLowerCase();
  if (d.includes("final")) return "badge-yellow";
  if (d.includes("semi")) return "badge-green";
  if (d.includes("quarter")) return "badge-purple";
  if (d.includes("group")) return "badge-blue";
  return "badge-gray";
}

export function genderLabel(gender: string): string {
  return gender === "W" ? "Women" : "Men";
}

export function genderColor(gender: string): string {
  return gender === "W" ? "badge-rose" : "badge-teal";
}
