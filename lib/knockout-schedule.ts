export type KnockoutScheduleEntry = {
  matchNumber: number;
  scheduledAt: Date;
  venue: string;
  city: string;
  country: string;
};

function schedule(
  matchNumber: number,
  scheduledAt: string,
  venue: string,
  city: string,
  country: string
): KnockoutScheduleEntry {
  return {
    matchNumber,
    scheduledAt: new Date(scheduledAt),
    venue,
    city,
    country,
  };
}

export const KNOCKOUT_SCHEDULE: Record<string, KnockoutScheduleEntry> = {
  // Codes are bracket positions, not chronological order.
  "R32-1": schedule(74, "2026-06-29T20:30:00Z", "Gillette Stadium", "Boston / Foxborough", "USA"),
  "R32-2": schedule(77, "2026-06-30T21:00:00Z", "MetLife Stadium", "New York / East Rutherford", "USA"),
  "R32-3": schedule(73, "2026-06-28T19:00:00Z", "SoFi Stadium", "Los Angeles", "USA"),
  "R32-4": schedule(75, "2026-06-30T01:00:00Z", "Estadio BBVA", "Monterrey", "Mexico"),
  "R32-5": schedule(83, "2026-07-02T23:00:00Z", "BMO Field", "Toronto", "Canada"),
  "R32-6": schedule(84, "2026-07-02T19:00:00Z", "SoFi Stadium", "Los Angeles", "USA"),
  "R32-7": schedule(81, "2026-07-02T00:00:00Z", "Levi's Stadium", "San Francisco / Santa Clara", "USA"),
  "R32-8": schedule(82, "2026-07-01T20:00:00Z", "Lumen Field", "Seattle", "USA"),
  "R32-9": schedule(76, "2026-06-29T17:00:00Z", "NRG Stadium", "Houston", "USA"),
  "R32-10": schedule(78, "2026-06-30T17:00:00Z", "AT&T Stadium", "Dallas / Arlington", "USA"),
  "R32-11": schedule(79, "2026-07-01T01:00:00Z", "Estadio Azteca", "Mexico City", "Mexico"),
  "R32-12": schedule(80, "2026-07-01T16:00:00Z", "Mercedes-Benz Stadium", "Atlanta", "USA"),
  "R32-13": schedule(86, "2026-07-03T22:00:00Z", "Hard Rock Stadium", "Miami", "USA"),
  "R32-14": schedule(88, "2026-07-03T18:00:00Z", "AT&T Stadium", "Dallas / Arlington", "USA"),
  "R32-15": schedule(85, "2026-07-03T03:00:00Z", "BC Place", "Vancouver", "Canada"),
  "R32-16": schedule(87, "2026-07-04T01:30:00Z", "Arrowhead Stadium", "Kansas City", "USA"),
  "R16-1": schedule(89, "2026-07-04T21:00:00Z", "Lincoln Financial Field", "Philadelphia", "USA"),
  "R16-2": schedule(90, "2026-07-04T17:00:00Z", "NRG Stadium", "Houston", "USA"),
  "R16-3": schedule(93, "2026-07-06T19:00:00Z", "AT&T Stadium", "Dallas / Arlington", "USA"),
  "R16-4": schedule(94, "2026-07-07T00:00:00Z", "Lumen Field", "Seattle", "USA"),
  "R16-5": schedule(91, "2026-07-05T20:00:00Z", "MetLife Stadium", "New York / East Rutherford", "USA"),
  "R16-6": schedule(92, "2026-07-06T00:00:00Z", "Estadio Azteca", "Mexico City", "Mexico"),
  "R16-7": schedule(95, "2026-07-07T16:00:00Z", "Mercedes-Benz Stadium", "Atlanta", "USA"),
  "R16-8": schedule(96, "2026-07-07T20:00:00Z", "BC Place", "Vancouver", "Canada"),
  "QF-1": schedule(97, "2026-07-09T20:00:00Z", "Gillette Stadium", "Boston / Foxborough", "USA"),
  "QF-2": schedule(98, "2026-07-10T19:00:00Z", "SoFi Stadium", "Los Angeles", "USA"),
  "QF-3": schedule(99, "2026-07-11T21:00:00Z", "Hard Rock Stadium", "Miami", "USA"),
  "QF-4": schedule(100, "2026-07-12T01:00:00Z", "Arrowhead Stadium", "Kansas City", "USA"),
  "SF-1": schedule(101, "2026-07-14T19:00:00Z", "AT&T Stadium", "Dallas / Arlington", "USA"),
  "SF-2": schedule(102, "2026-07-15T19:00:00Z", "Mercedes-Benz Stadium", "Atlanta", "USA"),
  "3P": schedule(103, "2026-07-18T21:00:00Z", "Hard Rock Stadium", "Miami", "USA"),
  "F": schedule(104, "2026-07-19T19:00:00Z", "MetLife Stadium", "New York / East Rutherford", "USA"),
};

export function knockoutScheduleForCode(bracketCode: string | null | undefined): KnockoutScheduleEntry | null {
  return bracketCode ? KNOCKOUT_SCHEDULE[bracketCode] ?? null : null;
}
