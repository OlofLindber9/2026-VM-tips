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
  return "badge-blue";
}

export function genderLabel(gender: string): string {
  return gender === "W" ? "Women" : "Men";
}
