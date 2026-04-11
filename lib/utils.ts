export function format(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function disciplineColor(discipline: string): string {
  const d = discipline.toLowerCase();
  if (d.includes("final") && !d.includes("kvarts") && !d.includes("semi") && !d.includes("åttondels")) return "badge-gold";
  if (d.includes("semi")) return "badge-yellow";
  if (d.includes("kvarts")) return "badge-green";
  if (d.includes("åttondels")) return "badge-teal";
  if (d.includes("grupp")) return "badge-blue";
  return "badge-gray";
}

export function genderLabel(gender: string): string {
  return gender === "W" ? "Damer" : "Herrar";
}

export function genderColor(gender: string): string {
  return gender === "W" ? "badge-rose" : "badge-teal";
}
